// Headless browser click-through of every page plus the main office workflows.
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const BASE = 'http://localhost:4000';
const OUT = '/home/claude/e2e/shots';
fs.mkdirSync(OUT, { recursive: true });

const problems = [];
const results = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) problems.push(`console: ${m.text()} @ ${page.url()}`); });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message} @ ${page.url()}`));
  page.on('response', (r) => { const u = r.url(); if (u.includes('/api/') && r.status() >= 500) problems.push(`HTTP ${r.status()} ${u}`); });
  page.on('dialog', (d) => d.dismiss());

  const waitIdle = async () => { try { await page.waitForNetworkIdle({ idleTime: 400, timeout: 8000 }); } catch { /* ok */ } };
  const shot = async (name) => { await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false }); };
  const clickText = async (text, sel = 'button, a') => {
    const handles = await page.$$(sel);
    for (const h of handles) {
      const t = await h.evaluate((el) => el.innerText.trim());
      const visible = await h.evaluate((el) => !!(el.offsetWidth || el.offsetHeight));
      if (visible && t.includes(text)) { await h.click(); return true; }
    }
    throw new Error(`No clickable "${text}" on ${page.url()}`);
  };
  const typeInto = async (labelText, value) => {
    const ok = await page.evaluate((lt, v) => {
      const scope = document.querySelector('[role=dialog]') || document;
      const labels = [...scope.querySelectorAll('label')].filter((l) => (l.querySelector('.label')?.textContent || '').trim().startsWith(lt));
      const l = labels.find((x) => x.offsetParent !== null);
      if (!l) return false;
      const el = l.querySelector('input, select, textarea');
      const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
      el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
      if (el.tagName === 'SELECT') el.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }, labelText, value);
    if (!ok) throw new Error(`No field "${labelText}" on ${page.url()}`);
    await sleep(120);
  };
  const bodyHas = async (text) => page.evaluate((t) => document.body.innerText.includes(t), text);
  const errorsOnPage = async () => page.evaluate(() => [...document.querySelectorAll('[role=alert]')].map((e) => e.innerText).filter(Boolean));
  const step = async (name, fn) => {
    try { await fn(); results.push(`PASS ${name}`); } catch (e) { results.push(`FAIL ${name}: ${e.message}`); await shot(`FAIL-${name.replace(/\W+/g, '_')}`); }
  };

  await step('login', async () => {
    await page.goto(BASE, { waitUntil: 'networkidle0' });
    await shot('00-login');
    await page.type('input[autocomplete=username]', 'admin');
    await page.type('input[type=password]', 'Admin@12345');
    await page.click('button[type=submit]');
    await page.waitForFunction(() => document.body.innerText.toLowerCase().includes('total land area'), { timeout: 10000 });
    await waitIdle(); await sleep(600);
    await shot('01-dashboard');
  });

  const routes = ['/lands', '/lands/1', '/societies', '/societies/1', '/plots', '/plots/1', '/plot-map', '/customers', '/customers/1', '/customers/new', '/bookings', '/bookings/1',
    '/bookings/new', '/collect', '/receipts', '/receipts/1', '/installments', '/transfers', '/transfers/1', '/transfers/new', '/expenses', '/reports', '/settings', '/users', '/audit', '/backup', '/change-password'];
  for (const r of routes) {
    await step(`page ${r}`, async () => {
      await page.goto(BASE + r, { waitUntil: 'networkidle0' });
      await sleep(300);
      const errs = await errorsOnPage();
      if (errs.length) throw new Error(`error box: ${errs.join(' | ')}`);
      if (await bodyHas('Something went wrong')) throw new Error('server error text');
      await shot(`page${r.replace(/\//g, '_')}`);
    });
  }

  for (const r of ['summary', 'collections', 'daily-cash', 'monthly-cash', 'overdue', 'upcoming', 'sales', 'receivables', 'expenses', 'expense-list', 'inventory']) {
    await step(`report ${r}`, async () => {
      await page.goto(`${BASE}/reports?r=${r}`, { waitUntil: 'networkidle0' });
      await sleep(250);
      const errs = await errorsOnPage();
      if (errs.length) throw new Error(errs.join(' | '));
      if (r === 'summary') await shot('report-summary');
      if (r === 'overdue') await shot('report-overdue');
    });
  }

  await step('register customer', async () => {
    await page.goto(`${BASE}/customers/new`, { waitUntil: 'networkidle0' });
    await typeInto('Full name', 'Test Browser Customer');
    await typeInto("Father's", 'Test Father');
    await typeInto('CNIC number', '3520299999991');
    await typeInto('Mobile number', '0300-9999999');
    await clickText('Save customer');
    await page.waitForFunction(() => location.pathname.match(/\/customers\/\d+$/), { timeout: 8000 });
    await waitIdle();
    if (!(await bodyHas('Test Browser Customer'))) throw new Error('profile not shown');
    await shot('customer-profile-new');
  });

  await step('new booking wizard (30% + 36 monthly + 6 half-yearly)', async () => {
    const plots = await page.evaluate(async () => (await (await fetch('/api/plots?status=AVAILABLE&size=5')).json()));
    const p = plots[0];
    await page.goto(`${BASE}/bookings/new?plot_id=${p.id}`, { waitUntil: 'networkidle0' });
    await page.type('input[placeholder^="Search by name"]', 'Test Browser');
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => b.innerText.includes('Test Browser Customer')), { timeout: 8000 });
    await clickText('Test Browser Customer');
    await sleep(300);
    await clickText('30%');
    await page.evaluate(() => { const cb = [...document.querySelectorAll('label')].find((l) => l.innerText.includes('Add extra (balloon)')).querySelector('input'); cb.click(); });
    await sleep(200);
    await typeInto('Amount each', '200000');
    await page.waitForFunction(() => document.body.innerText.includes('43 payments') && ![...document.querySelectorAll('button')].find((b) => b.innerText.includes('Confirm booking')).disabled, { timeout: 10000 });
    await shot('booking-wizard');
    await clickText('Confirm booking');
    await page.waitForFunction(() => document.body.innerText.includes('Booking confirmed'), { timeout: 10000 });
    await waitIdle(); await sleep(400);
    await shot('booking-detail-created');
  });

  let bookingUrl;
  await step('collect payment (next installment)', async () => {
    bookingUrl = page.url().split('?')[0];
    const bid = bookingUrl.split('/').pop();
    await page.goto(`${BASE}/collect?booking_id=${bid}`, { waitUntil: 'networkidle0' });
    await clickText('Next installment');
    await sleep(200);
    await shot('collect-payment');
    await clickText('Save payment');
    await page.waitForFunction(() => document.body.innerText.includes('Payment saved'), { timeout: 10000 });
    await shot('collect-payment-saved');
  });

  await step('partial payment then reversal', async () => {
    const bid = bookingUrl.split('/').pop();
    await page.goto(`${BASE}/collect?booking_id=${bid}`, { waitUntil: 'networkidle0' });
    await typeInto('Amount received', '12345');
    await typeInto('Payment method', 'BANK_TRANSFER');
    await typeInto('Reference', 'IBFT-778');
    await clickText('Save payment');
    await page.waitForFunction(() => document.body.innerText.includes('Payment saved'), { timeout: 10000 });
    const pays = await page.evaluate(async (b) => (await (await fetch(`/api/payments?booking_id=${b}`)).json()), bid);
    const p = pays.find((x) => Number(x.amount) === 12345);
    await page.goto(`${BASE}/receipts/${p.id}`, { waitUntil: 'networkidle0' });
    await clickText('Reverse');
    await page.type('textarea', 'Entered on wrong booking');
    await clickText('Reverse payment');
    await page.waitForFunction(() => document.body.innerText.includes('Reversed on'), { timeout: 10000 });
    await shot('receipt-reversed');
  });

  await step('over-payment is refused', async () => {
    const bid = bookingUrl.split('/').pop();
    await page.goto(`${BASE}/collect?booking_id=${bid}`, { waitUntil: 'networkidle0' });
    await typeInto('Amount received', '999999999');
    await clickText('Save payment');
    await page.waitForFunction(() => document.body.innerText.includes('Over-payment is not allowed'), { timeout: 8000 });
  });

  await step('edit schedule dialog opens and validates', async () => {
    await page.goto(bookingUrl, { waitUntil: 'networkidle0' });
    await clickText('Edit schedule');
    await sleep(300);
    if (!(await bodyHas('matches final price'))) throw new Error('total check not shown');
    await shot('schedule-editor');
    await clickText('Cancel', '.fixed button');
  });

  await step('add expense', async () => {
    await page.goto(`${BASE}/expenses`, { waitUntil: 'networkidle0' });
    await clickText('Add expense');
    await sleep(300);
    const catId = await page.evaluate(async () => (await (await fetch('/api/expenses/categories')).json()).find((c) => c.name === 'Marketing').id);
    await typeInto('Category', String(catId));
    await typeInto('Description', 'Browser test banner');
    await typeInto('Amount (Rs)', '15000');
    await clickText('Save expense');
    await page.waitForFunction(() => document.body.innerText.includes('Attach the bill'), { timeout: 8000 });
    await clickText('Done');
  });

  await step('bulk add plots', async () => {
    await page.goto(`${BASE}/plots?society_id=1`, { waitUntil: 'networkidle0' });
    await clickText('Bulk add');
    await sleep(300);
    const blocks = await page.evaluate(async () => (await (await fetch('/api/societies/1')).json()).blocks);
    await typeInto('Society', '1');
    await sleep(500);
    await typeInto('Block', String(blocks[1].id));
    await typeInto('Prefix', 'B-');
    await typeInto('Start number', '101');
    await typeInto('How many', '5');
    await clickText('Create 5 plots');
    await page.waitForFunction(() => document.body.innerText.includes('B-101'), { timeout: 8000 });
  });

  await step('transfer with dues check', async () => {
    await page.goto(`${BASE}/transfers/new?booking_id=2`, { waitUntil: 'networkidle0' });
    await sleep(300);
    if (!(await bodyHas('Pending dues'))) throw new Error('overdue booking 2 should show pending dues');
    await shot('transfer-dues-pending');
  });

  await step('reserve and release a plot', async () => {
    const plots = await page.evaluate(async () => (await (await fetch('/api/plots?status=AVAILABLE')).json()));
    await page.goto(`${BASE}/plots/${plots[3].id}`, { waitUntil: 'networkidle0' });
    await clickText('Reserve');
    await sleep(300);
    await typeInto('Or reserved for', 'Phone enquiry');
    await clickText('Reserve', '.fixed button');
    await page.waitForFunction(() => document.body.innerText.includes('Release reservation'), { timeout: 8000 });
    await clickText('Release reservation');
    await clickText('Confirm', '.fixed button');
    await page.waitForFunction(() => document.body.innerText.includes('Reserve'), { timeout: 8000 });
  });

  await step('backup now', async () => {
    await page.goto(`${BASE}/backup`, { waitUntil: 'networkidle0' });
    await clickText('Backup now');
    await page.waitForFunction(() => document.body.innerText.includes('Backup created'), { timeout: 30000 });
    await sleep(500);
    await shot('backup');
  });

  await step('mobile layout', async () => {
    await page.setViewport({ width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 });
    await page.goto(BASE, { waitUntil: 'networkidle0' });
    await sleep(500);
    await shot('mobile-dashboard');
    await page.click('button[aria-label="Open menu"]');
    await sleep(300);
    await shot('mobile-menu');
    await page.goto(`${BASE}/plot-map`, { waitUntil: 'networkidle0' });
    await sleep(400);
    await shot('mobile-plotmap');
    await page.goto(`${BASE}/customers`, { waitUntil: 'networkidle0' });
    await sleep(300);
    await shot('mobile-customers');
    await page.setViewport({ width: 1440, height: 900 });
  });

  await step('viewer role is read-only with masked CNIC', async () => {
    const ctx = await browser.createBrowserContext();
    const v = await ctx.newPage();
    await v.setViewport({ width: 1440, height: 900 });
    await v.goto(BASE, { waitUntil: 'networkidle0' });
    await v.type('input[autocomplete=username]', 'viewer');
    await v.type('input[type=password]', 'Passw0rd!');
    await v.click('button[type=submit]');
    await v.waitForFunction(() => document.body.innerText.toLowerCase().includes('total land area'), { timeout: 10000 });
    await v.goto(`${BASE}/customers`, { waitUntil: 'networkidle0' });
    const masked = await v.evaluate(() => document.body.innerText.includes('*******'));
    const canAdd = await v.evaluate(() => document.body.innerText.includes('Register customer'));
    if (!masked) throw new Error('CNIC not masked for viewer');
    if (canAdd) throw new Error('viewer sees register button');
    await ctx.close();
  });

  await step('logout', async () => {
    await page.goto(BASE, { waitUntil: 'networkidle0' });
    await clickText('Log out');
    await page.waitForFunction(() => document.body.innerText.includes('Sign in'), { timeout: 8000 });
  });

  await browser.close();
  console.log(results.join('\n'));
  console.log(`\n${results.filter((r) => r.startsWith('PASS')).length} passed, ${results.filter((r) => r.startsWith('FAIL')).length} failed`);
  console.log(problems.length ? `\nPROBLEMS:\n${[...new Set(problems)].join('\n')}` : '\nNo console/page/server errors.');
}
main().catch((e) => { console.error(e); process.exit(1); });

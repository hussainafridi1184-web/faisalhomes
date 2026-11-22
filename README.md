# FAISAL HOMES

**Real Estate Society, Land, Plotting & Installment Management Software**: self-hosted, no monthly subscription.

Land records → societies & blocks → plots → customers → bookings with installment plans → payments & receipts →
transfers → expenses → financial reports, with role-based security, audit trail and automatic backups.

| Document | What it covers |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Technology, database design, business and accounting rules, permissions |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Installing on a Windows office PC or a VPS, backups, **cost breakdown** |
| [PROJECT_STATUS.md](PROJECT_STATUS.md) | What is complete and tested, known limitations, next steps |

## Quick start (Windows)
1. Install **PostgreSQL 16** and **Node.js 22 LTS** (free).
2. Run `setup-windows.bat` and enter your PostgreSQL password in `.env` when Notepad opens. Then run `setup-windows.bat` again.
3. Run `start-windows.bat` → http://localhost:4000 → create the administrator.

Want to explore first? In `server/` run `npm run seed:demo` on an empty database (login `admin` / `Admin@12345`).

## Quick start (any OS, command line)
```
cp .env.example .env          # set DATABASE_URL
npm run setup                 # installs server, creates/updates the database
npm start                     # http://localhost:4000
npm test                      # 31 integration tests (needs a PostgreSQL server; uses database faisal_homes_test)
```
The web interface is already built in `client/dist`. To change the interface: `npm run build:client`.

## Daily use: a short guide for office staff

**Sell a plot.** Click **New Booking**, then:
1. Search for the customer (or click *Register a new customer*).
2. Choose the society, block and available plot. The size and price fill in automatically.
3. Enter the discount and booking amount (use the 10/20/25/30% buttons).
4. Choose the plan, e.g. *Monthly*, 36 installments. Tick *extra (balloon) payments* for 6 half-yearly payments.
5. Check the schedule on the right. It must say "matches the final price".
6. Click **Confirm booking**, then **Print booking receipt** and **Print booking confirmation**.

**Receive an installment.** Click **Collect Payment**, then:
1. Search the customer, CNIC, mobile or plot number.
2. Click *Next installment*, *All overdue* or *Full balance*, or type any amount (partial payments are fine).
3. Choose the method (cheque needs the cheque number), then **Save payment** → **Print receipt**.

**Wrong entry?** Open the receipt and click **Reverse** (admin only, a reason is required). Nothing is ever deleted. The reversal is shown in the cash book and audit log.

**Who has not paid?** Go to **Installments → Overdue customers**. The **Remind** button opens WhatsApp with a ready message.

**Transfer a plot.** Open the booking and click **Transfer** (admin), then choose the new owner, fee and witnesses. Print the transfer letter.
If installments are overdue, the system blocks the transfer unless an admin enters an override reason.

**Daily closing.** Go to **Reports → Daily Cash Report** and print or export to Excel.

**End of day.** Backups run automatically. Check **Backup & Restore** to see the latest one, and copy it to a USB drive or Google Drive weekly.

## Roles
| Role | Can do |
|---|---|
| Admin | Everything, including cancellations, reversals, transfers, schedule changes, users, settings, backups |
| Accountant | Collect payments, receipts, expenses, all reports |
| Sales Staff | Register customers, reserve plots, create bookings (with booking receipt) |
| Viewer | Read-only access; CNIC numbers are masked |

## Project layout
```
server/     Node.js + Express API, SQL migrations, business services, PDF/Excel, backups, tests
client/     React + Tailwind web interface (built copy in client/dist)
tests/e2e/  Headless-browser smoke test
storage/    Created at runtime: uploads/ (documents, logo) and backups/
```

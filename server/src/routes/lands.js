'use strict';
const express = require('express');
const { pool, withTx } = require('../db/pool');
const { requirePerm } = require('../middleware/auth');
const { audit } = require('../lib/audit');
const settings = require('../lib/settings');
const { notFound } = require('../lib/errors');
const { z, parse, reqText, optText, optMoney, optNumber, optDate, optCnic, phone } = require('../lib/validate');

const router = express.Router();
require('../lib/validate').numericParams(router, 'id');

const LAND_SELECT = `
  SELECT l.*,
    COALESCE(x.extra_cost, 0)::numeric(16,2) AS extra_cost,
    (l.purchase_price + COALESCE(x.extra_cost, 0))::numeric(16,2) AS total_investment,
    COALESCE(x.paid_to_seller, 0)::numeric(16,2) AS paid_to_seller,
    (l.purchase_price - COALESCE(x.paid_to_seller, 0))::numeric(16,2) AS payable_to_seller,
    COALESCE(s.society_count, 0)::int AS society_count,
    COALESCE(s.plotted_marla, 0)::numeric(14,4) AS plotted_marla
  FROM lands l
  LEFT JOIN (
    SELECT e.land_id,
      SUM(e.amount) FILTER (WHERE c.cost_type <> 'LAND_PAYMENT') AS extra_cost,
      SUM(e.amount) FILTER (WHERE c.cost_type = 'LAND_PAYMENT') AS paid_to_seller
    FROM expenses e JOIN expense_categories c ON c.id = e.category_id
    WHERE e.status = 'ACTIVE' AND e.land_id IS NOT NULL GROUP BY e.land_id
  ) x ON x.land_id = l.id
  LEFT JOIN (
    SELECT so.land_id, COUNT(DISTINCT so.id) AS society_count, SUM(p.size_marla) FILTER (WHERE p.status <> 'CANCELLED') AS plotted_marla
    FROM societies so LEFT JOIN plots p ON p.society_id = so.id GROUP BY so.land_id
  ) s ON s.land_id = l.id`;

router.get('/', requirePerm('land.view', 'society.edit'), async (req, res) => {
  const where = req.query.include_archived === '1' ? '' : "WHERE l.status = 'ACTIVE'";
  res.json((await pool.query(`${LAND_SELECT} ${where} ORDER BY l.name`)).rows);
});

router.get('/:id', requirePerm('land.view'), async (req, res) => {
  const id = Number(req.params.id);
  const land = (await pool.query(`${LAND_SELECT} WHERE l.id = $1`, [id])).rows[0];
  if (!land) throw notFound('Land');
  const societies = (await pool.query('SELECT id, name, code, status FROM societies WHERE land_id = $1 ORDER BY name', [id])).rows;
  const expenses = (await pool.query(
    `SELECT e.id, e.expense_no, e.expense_date, e.description, e.amount, e.method, e.status, e.paid_to, c.name AS category, c.cost_type
     FROM expenses e JOIN expense_categories c ON c.id = e.category_id WHERE e.land_id = $1 ORDER BY e.expense_date DESC, e.id DESC`, [id])).rows;
  res.json({ ...land, societies, expenses });
});

const schema = z.object({
  name: reqText('Land name'),
  location: optText,
  area_kanal: optNumber('Kanal'),
  area_marla: optNumber('Marla'),
  area_sqft: optNumber('Square feet'),
  marla_sqft: optNumber('Marla square feet'),
  saleable_marla: optNumber('Saleable area'),
  kanal_marla: optNumber('Marla per Kanal'),
  purchase_price: optMoney('Purchase price'),
  purchase_date: optDate('Purchase date'),
  seller_name: optText, seller_father_name: optText, seller_cnic: optCnic('Seller CNIC'), seller_mobile: phone('Seller mobile'), seller_address: optText,
  owner_name: optText, ownership_details: optText,
  registry_no: optText, registry_date: optDate('Registry date'), mutation_no: optText, mutation_date: optDate('Mutation date'),
  khasra_no: optText, khewat_no: optText, notes: optText,
});

async function computeArea(b) {
  const m = await settings.get('measurement');
  const marlaSqft = b.marla_sqft || Number(m.marla_sqft) || 272.25;
  const kanalMarla = b.kanal_marla || Number(m.kanal_marla) || 20;
  const k = b.area_kanal || 0; const mr = b.area_marla || 0; const sq = b.area_sqft || 0;
  const totalSqft = Math.round((k * kanalMarla * marlaSqft + mr * marlaSqft + sq) * 100) / 100;
  const totalMarla = Math.round((totalSqft / marlaSqft) * 10000) / 10000;
  if (totalSqft <= 0) { const { badRequest } = require('../lib/errors'); throw badRequest('Enter the land area (Kanal, Marla or square feet)'); }
  return { marlaSqft, kanalMarla, k, mr, sq, totalSqft, totalMarla };
}

const FIELDS = ['name', 'location', 'saleable_marla', 'purchase_price', 'purchase_date', 'seller_name', 'seller_father_name', 'seller_cnic', 'seller_mobile', 'seller_address',
  'owner_name', 'ownership_details', 'registry_no', 'registry_date', 'mutation_no', 'mutation_date', 'khasra_no', 'khewat_no', 'notes'];

router.post('/', requirePerm('land.edit'), async (req, res) => {
  const b = parse(schema, req.body);
  const a = await computeArea(b);
  const row = await withTx(async (c) => {
    const vals = FIELDS.map((f) => b[f] ?? null);
    const r = (await c.query(
      `INSERT INTO lands (${FIELDS.join(',')}, area_kanal, area_marla, area_sqft, marla_sqft, kanal_marla, total_sqft, total_marla, created_by, updated_by)
       VALUES (${FIELDS.map((_, i) => `$${i + 1}`).join(',')}, $${FIELDS.length + 1}, $${FIELDS.length + 2}, $${FIELDS.length + 3}, $${FIELDS.length + 4},
               $${FIELDS.length + 5}, $${FIELDS.length + 6}, $${FIELDS.length + 7}, $${FIELDS.length + 8}, $${FIELDS.length + 8}) RETURNING *`,
      [...vals, a.k, a.mr, a.sq, a.marlaSqft, a.kanalMarla, a.totalSqft, a.totalMarla, req.user.id])).rows[0];
    await audit(c, req, { action: 'CREATE', entity: 'land', entityId: r.id, summary: `Land "${r.name}" added (${r.total_marla} Marla)`, after: r });
    return r;
  });
  res.status(201).json(row);
});

router.put('/:id', requirePerm('land.edit'), async (req, res) => {
  const id = Number(req.params.id);
  const b = parse(schema, req.body);
  const a = await computeArea(b);
  const row = await withTx(async (c) => {
    const before = (await c.query('SELECT * FROM lands WHERE id = $1 FOR UPDATE', [id])).rows[0];
    if (!before) throw notFound('Land');
    const sets = FIELDS.map((f, i) => `${f} = $${i + 2}`).join(', ');
    const n = FIELDS.length;
    const r = (await c.query(
      `UPDATE lands SET ${sets}, area_kanal=$${n + 2}, area_marla=$${n + 3}, area_sqft=$${n + 4}, marla_sqft=$${n + 5}, kanal_marla=$${n + 6},
        total_sqft=$${n + 7}, total_marla=$${n + 8}, updated_by=$${n + 9}, updated_at=now() WHERE id=$1 RETURNING *`,
      [id, ...FIELDS.map((f) => b[f] ?? null), a.k, a.mr, a.sq, a.marlaSqft, a.kanalMarla, a.totalSqft, a.totalMarla, req.user.id])).rows[0];
    await audit(c, req, { action: 'UPDATE', entity: 'land', entityId: id, summary: `Land "${r.name}" updated`, before, after: r });
    return r;
  });
  res.json(row);
});

router.post('/:id/status', requirePerm('land.edit'), async (req, res) => {
  const id = Number(req.params.id);
  const status = req.body.status === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE';
  await withTx(async (c) => {
    const r = await c.query('UPDATE lands SET status=$2, updated_at=now(), updated_by=$3 WHERE id=$1 RETURNING name', [id, status, req.user.id]);
    if (!r.rowCount) throw notFound('Land');
    await audit(c, req, { action: 'UPDATE', entity: 'land', entityId: id, summary: `Land "${r.rows[0].name}" ${status === 'ARCHIVED' ? 'archived' : 'restored'}` });
  });
  res.json({ ok: true });
});

module.exports = router;

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Plus, Pencil, Archive, RotateCcw } from 'lucide-react';
import { api } from '../lib/api.js';
import { useApi, useRefreshAll } from '../lib/hooks.js';
import { useAuth } from '../lib/auth.jsx';
import { area, date, pkr, sqft, num } from '../lib/format.js';
import DataTable from '../components/DataTable.jsx';
import DocumentsPanel from '../components/DocumentsPanel.jsx';
import { Card, ErrorBox, Input, KV, Loading, Modal, PageHeader, StatusBadge, Textarea, useToast, Checkbox } from '../components/ui.jsx';

const EMPTY = { name: '', location: '', saleable_marla: '', area_kanal: '', area_marla: '', area_sqft: '', marla_sqft: '', kanal_marla: '', purchase_price: '', purchase_date: '',
  seller_name: '', seller_father_name: '', seller_cnic: '', seller_mobile: '', seller_address: '', owner_name: '', ownership_details: '', registry_no: '',
  registry_date: '', mutation_no: '', mutation_date: '', khasra_no: '', khewat_no: '', notes: '' };

export function LandForm({ open, onClose, land }) {
  const { settings } = useAuth();
  const toast = useToast();
  const refresh = useRefreshAll();
  const [f, setF] = useState(EMPTY);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    const m = settings.measurement || {};
    setF(land ? Object.fromEntries(Object.keys(EMPTY).map((k) => [k, land[k] === null || land[k] === undefined ? '' : String(land[k])]))
      : { ...EMPTY, marla_sqft: String(m.marla_sqft || 272.25), kanal_marla: String(m.kanal_marla || 20) });
    setErr(null);
  }, [open, land, settings.measurement]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const total = useMemo(() => {
    const ms = Number(f.marla_sqft) || 272.25; const km = Number(f.kanal_marla) || 20;
    const s = (Number(f.area_kanal) || 0) * km * ms + (Number(f.area_marla) || 0) * ms + (Number(f.area_sqft) || 0);
    return { sqft: s, marla: s / ms };
  }, [f]);
  const save = async (e) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      if (land) await api.put(`/lands/${land.id}`, f); else await api.post('/lands', f);
      toast(land ? 'Land updated' : 'Land added'); refresh(); onClose();
    } catch (ex) { setErr(ex); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title={land ? 'Edit land' : 'Add new land'} size="lg"
      footer={<><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button><button type="submit" form="land-form" className="btn-primary" disabled={busy}>Save land</button></>}>
      <form id="land-form" onSubmit={save} className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Land name" required value={f.name} onChange={set('name')} placeholder="e.g. Mauza Kot — Khasra 211" />
          <Input label="Location" value={f.location} onChange={set('location')} />
        </div>
        <fieldset className="rounded-lg border border-slate-200 p-3">
          <legend className="px-1 text-sm font-semibold text-navy-900">Area</legend>
          <div className="grid gap-3 sm:grid-cols-5">
            <Input label="Kanal" inputMode="decimal" value={f.area_kanal} onChange={set('area_kanal')} />
            <Input label="Marla" inputMode="decimal" value={f.area_marla} onChange={set('area_marla')} />
            <Input label="Square feet" inputMode="decimal" value={f.area_sqft} onChange={set('area_sqft')} />
            <Input label="1 Marla = sq ft" inputMode="decimal" value={f.marla_sqft} onChange={set('marla_sqft')} hint="Local measure" />
            <Input label="1 Kanal = Marla" inputMode="decimal" value={f.kanal_marla} onChange={set('kanal_marla')} />
          </div>
          <div className="mt-2 rounded-md bg-navy-50 px-3 py-2 text-sm text-navy-900">Total: <b>{area(total.marla)}</b> = <b>{num(total.marla.toFixed(4))} Marla</b> = {sqft(total.sqft)}</div>
          <Input label="Expected saleable area (Marla)" className="mt-3 sm:w-1/2" inputMode="decimal" value={f.saleable_marla} onChange={set('saleable_marla')}
            hint="Plottable area after roads, parks and common areas. Used for cost per Marla until all plots are created." />
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Purchase price (Rs)" inputMode="decimal" value={f.purchase_price} onChange={set('purchase_price')} />
          <Input label="Purchase date" type="date" value={f.purchase_date} onChange={set('purchase_date')} />
        </div>
        <fieldset className="rounded-lg border border-slate-200 p-3">
          <legend className="px-1 text-sm font-semibold text-navy-900">Seller</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Seller name" value={f.seller_name} onChange={set('seller_name')} />
            <Input label="Father name" value={f.seller_father_name} onChange={set('seller_father_name')} />
            <Input label="CNIC" value={f.seller_cnic} onChange={set('seller_cnic')} placeholder="35202-1234567-1" />
            <Input label="Mobile" value={f.seller_mobile} onChange={set('seller_mobile')} />
            <Input label="Address" className="sm:col-span-2" value={f.seller_address} onChange={set('seller_address')} />
          </div>
        </fieldset>
        <fieldset className="rounded-lg border border-slate-200 p-3">
          <legend className="px-1 text-sm font-semibold text-navy-900">Ownership & revenue records</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Owner (in records)" value={f.owner_name} onChange={set('owner_name')} />
            <Input label="Khasra no" value={f.khasra_no} onChange={set('khasra_no')} />
            <Input label="Registry no" value={f.registry_no} onChange={set('registry_no')} />
            <Input label="Registry date" type="date" value={f.registry_date} onChange={set('registry_date')} />
            <Input label="Mutation (Intiqal) no" value={f.mutation_no} onChange={set('mutation_no')} />
            <Input label="Mutation date" type="date" value={f.mutation_date} onChange={set('mutation_date')} />
            <Input label="Khewat no" value={f.khewat_no} onChange={set('khewat_no')} />
            <Textarea label="Ownership details" className="sm:col-span-2" value={f.ownership_details} onChange={set('ownership_details')} rows={2} />
            <Textarea label="Notes" className="sm:col-span-2" value={f.notes} onChange={set('notes')} rows={2} />
          </div>
        </fieldset>
        <ErrorBox error={err} />
      </form>
    </Modal>
  );
}

export function LandsPage() {
  const { can } = useAuth();
  const nav = useNavigate();
  const [archived, setArchived] = useState(false);
  const { data, isLoading, error } = useApi(`/lands${archived ? '?include_archived=1' : ''}`);
  const [form, setForm] = useState(false);
  const cols = [
    { key: 'name', header: 'Land', render: (r) => <div><div className="font-semibold text-navy-900">{r.name}</div><div className="text-xs text-slate-500">{r.location}</div></div> },
    { key: 'total_marla', header: 'Area', render: (r) => <div>{area(r.total_marla)}<div className="text-xs text-slate-500">{num(r.total_marla)} Marla</div></div> },
    { key: 'purchase_date', header: 'Purchased', render: (r) => date(r.purchase_date) },
    { key: 'purchase_price', header: 'Purchase price', align: 'right', render: (r) => pkr(r.purchase_price) },
    { key: 'total_investment', header: 'Total investment', align: 'right', render: (r) => <b>{pkr(r.total_investment)}</b> },
    { key: 'payable_to_seller', header: 'Payable to seller', align: 'right', render: (r) => pkr(r.payable_to_seller) },
    { key: 'society_count', header: 'Societies', align: 'right' },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ];
  return (
    <>
      <PageHeader title="Land Management" subtitle="Land purchased for plotting, with seller, registry and investment details"
        actions={can('land.edit') && <button type="button" className="btn-primary" onClick={() => setForm(true)}><Plus className="h-4 w-4" />Add land</button>} />
      <ErrorBox error={error} />
      {isLoading ? <Loading /> : <DataTable columns={cols} rows={data} onRowClick={(r) => nav(`/lands/${r.id}`)} empty="No land added yet."
        toolbar={<Checkbox label="Show archived" checked={archived} onChange={setArchived} />} />}
      <LandForm open={form} onClose={() => setForm(false)} />
    </>
  );
}

export function LandDetailPage() {
  const { id } = useParams();
  const { can } = useAuth();
  const toast = useToast();
  const refresh = useRefreshAll();
  const { data: l, isLoading, error } = useApi(`/lands/${id}`);
  const [edit, setEdit] = useState(false);
  if (isLoading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  const toggle = async () => { await api.post(`/lands/${id}/status`, { status: l.status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE' }); toast('Updated'); refresh(); };
  return (
    <>
      <PageHeader title={l.name} subtitle={l.location} back={{ to: '/lands', label: 'All land' }}
        actions={can('land.edit') && <>
          <button type="button" className="btn-secondary" onClick={toggle}>{l.status === 'ACTIVE' ? <><Archive className="h-4 w-4" />Archive</> : <><RotateCcw className="h-4 w-4" />Restore</>}</button>
          <button type="button" className="btn-primary" onClick={() => setEdit(true)}><Pencil className="h-4 w-4" />Edit</button>
        </>} />
      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Investment" className="lg:col-span-1">
          <dl className="space-y-2 text-sm">
            {[['Purchase price', l.purchase_price], ['Additional land costs', l.extra_cost], ['Total land investment', l.total_investment, true], ['Paid to seller', l.paid_to_seller], ['Still payable to seller', l.payable_to_seller]].map(([k, v, b]) => (
              <div key={k} className={`flex justify-between ${b ? 'border-y border-slate-200 py-2 font-bold text-navy-900' : ''}`}><dt>{k}</dt><dd className="tabular-nums">{pkr(v)}</dd></div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-slate-500">Payments to the seller are recorded in Expenses → "Land Purchase" linked to this land. Other expenses linked to this land (registry fee, survey…) are added to its cost.</p>
        </Card>
        <Card title="Details" className="lg:col-span-2">
          <KV items={[
            ['Area', `${area(l.total_marla)} (${num(l.total_marla)} Marla · ${sqft(l.total_sqft)})`], ['Entered as', `${num(l.area_kanal)} K, ${num(l.area_marla)} M, ${num(l.area_sqft)} sq ft`],
            ['Conversion', `1 Marla = ${num(l.marla_sqft)} sq ft · 1 Kanal = ${num(l.kanal_marla)} Marla`], ['Plotted / expected saleable', `${num(l.plotted_marla)} / ${l.saleable_marla ? num(l.saleable_marla) : '—'} Marla`],
            ['Purchase date', date(l.purchase_date)], ['Status', <StatusBadge key="s" status={l.status} />],
            ['Seller', [l.seller_name, l.seller_father_name && `s/o ${l.seller_father_name}`].filter(Boolean).join(' ')], ['Seller CNIC / mobile', [l.seller_cnic, l.seller_mobile].filter(Boolean).join(' · ')],
            ['Seller address', l.seller_address], ['Owner in records', l.owner_name],
            ['Registry', [l.registry_no, l.registry_date && date(l.registry_date)].filter(Boolean).join(' · ')], ['Mutation (Intiqal)', [l.mutation_no, l.mutation_date && date(l.mutation_date)].filter(Boolean).join(' · ')],
            ['Khasra / Khewat', [l.khasra_no, l.khewat_no].filter(Boolean).join(' / ')], ['Ownership details', l.ownership_details], ['Notes', l.notes],
          ]} />
          {l.societies.length > 0 && <div className="mt-4 text-sm">Societies on this land: {l.societies.map((s) => <Link key={s.id} to={`/societies/${s.id}`} className="mr-2 font-semibold text-navy-700 hover:underline">{s.name}</Link>)}</div>}
        </Card>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card title="Expenses linked to this land" bodyClass="p-0">
          <table className="min-w-full divide-y divide-slate-100 text-sm"><tbody className="divide-y divide-slate-100">
            {l.expenses.map((e) => (
              <tr key={e.id} className={e.status !== 'ACTIVE' ? 'text-slate-400 line-through' : ''}><td className="td">{date(e.expense_date)}</td><td className="td">{e.category}<div className="text-xs text-slate-500">{e.description}</div></td><td className="td num">{pkr(e.amount)}</td></tr>
            ))}
            {!l.expenses.length && <tr><td className="td text-slate-500">No linked expenses.</td></tr>}
          </tbody></table>
        </Card>
        <DocumentsPanel entityType="LAND" entityId={l.id} types={['REGISTRY', 'MUTATION', 'OWNERSHIP_DOCUMENT', 'SALE_AGREEMENT', 'LEGAL_DOCUMENT', 'OTHER']} title="Land documents" />
      </div>
      <LandForm open={edit} onClose={() => setEdit(false)} land={l} />
    </>
  );
}

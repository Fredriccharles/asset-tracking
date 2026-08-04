import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import Alert from '../components/Alert';
import Pagination from '../components/Pagination';
import * as api from '../api/api';
import { errMsg } from '../api/api';
import { useAuth } from '../context/AuthContext';

export default function Retirements() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState({ data: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [eligibleItems, setEligibleItems] = useState([]);
  const [form, setForm] = useState({ item_id: '', reason: '', disposal_method: '', disposal_value: '' });

  const q = params.get('q') || '';
  const page = parseInt(params.get('page') || '1', 10);
  const pageSize = 15;

  const load = useCallback(() => {
    setLoading(true);
    api.listRetirements({ q, page, pageSize })
      .then((res) => setData(res.data))
      .catch((err) => setError(errMsg(err)))
      .finally(() => setLoading(false));
  }, [q, page]);

  useEffect(() => { load(); }, [load]);

  const updateParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    next.set('page', '1');
    setParams(next);
  };

  const openModal = () => {
    setForm({ item_id: '', reason: '', disposal_method: '', disposal_value: '' });
    api.listItems({ pageSize: 200 }).then((res) =>
      setEligibleItems(res.data.data.filter((i) => i.status === 'available' || i.status === 'under_repair'))
    );
    setModalOpen(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.retireItem(form);
      setModalOpen(false);
      setSuccess('Asset retired successfully. Its record is preserved for history.');
      load();
    } catch (err) { setError(errMsg(err)); }
  };

  return (
    <Layout
      title="Retirement & Disposal"
      subtitle="Retired assets keep their full history — nothing is ever deleted"
actions={isAdmin ? <button className="btn-primary" onClick={openModal}>+ Retire Asset</button> : null}
    >
      <Alert message={error} onClose={() => setError('')} />
      <Alert type="success" message={success} onClose={() => setSuccess('')} />

      <div className="card p-4 mb-4">
        <input
          className="input max-w-xs"
          placeholder="Search item, reason…"
          defaultValue={q}
          onBlur={(e) => updateParam('q', e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && updateParam('q', e.target.value)}
        />
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Asset</th>
              <th className="text-left px-4 py-3">Retired Date</th>
              <th className="text-left px-4 py-3">Reason</th>
              <th className="text-left px-4 py-3">Disposal Method</th>
              <th className="text-right px-4 py-3">Disposal Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading ? (
              <tr><td colSpan={5} className="text-center py-8 text-neutral-400">Loading…</td></tr>
            ) : data.data.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-neutral-400">No retired assets.</td></tr>
            ) : (
              data.data.map((r) => (
                <tr key={r.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <Link to={`/items/${r.item_id}`} className="font-medium text-neutral-900 hover:text-brand-600">{r.item_name}</Link>
                    <div className="text-xs text-neutral-400 font-mono">{r.asset_code}</div>
                  </td>
                  <td className="px-4 py-3 text-neutral-500">{r.retired_date}</td>
                  <td className="px-4 py-3">{r.reason}</td>
                  <td className="px-4 py-3">{r.disposal_method || '—'}</td>
                  <td className="px-4 py-3 text-right">{r.disposal_value != null ? `$${Number(r.disposal_value).toFixed(2)}` : '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} pageSize={pageSize} total={data.total} onChange={(p) => updateParam('page', String(p))} />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Retire Asset">
        <form onSubmit={submit} className="space-y-4">
          <p className="text-xs text-danger-700 bg-danger-50 border border-danger-200 rounded-lg px-3 py-2">
            Retirement is permanent and cannot be undone from the UI. The record stays in the system forever for audit purposes.
          </p>
          <div>
            <label className="label">Asset *</label>
            <select className="input" required value={form.item_id} onChange={(e) => setForm({ ...form, item_id: e.target.value })}>
              <option value="">Select an asset…</option>
              {eligibleItems.map((i) => (
                <option key={i.id} value={i.id}>{i.asset_code} — {i.name} ({i.status})</option>
              ))}
            </select>
            {eligibleItems.length === 0 && (
              <p className="text-xs text-neutral-400 mt-1">No eligible assets (checked-out items must be returned first).</p>
            )}
          </div>
          <div>
            <label className="label">Reason *</label>
            <textarea className="input" required rows={2} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </div>
          <div>
            <label className="label">Disposal Method</label>
            <input className="input" value={form.disposal_method} onChange={(e) => setForm({ ...form, disposal_method: e.target.value })} placeholder="e.g. Recycled, Sold, Donated" />
          </div>
          <div>
            <label className="label">Disposal Value</label>
            <input type="number" step="0.01" className="input" value={form.disposal_value} onChange={(e) => setForm({ ...form, disposal_value: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn-danger">Retire Asset</button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}

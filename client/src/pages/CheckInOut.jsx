import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import Alert from '../components/Alert';
import Pagination from '../components/Pagination';
import StatusBadge from '../components/StatusBadge';
import * as api from '../api/api';
import { errMsg } from '../api/api';
import { useAuth } from '../context/AuthContext';

export default function CheckInOut() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState({ data: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [availableItems, setAvailableItems] = useState([]);
  const [form, setForm] = useState({ item_id: '', checked_out_to: '', department: '', expected_return_date: '' });

  const status = params.get('status') || '';
  const q = params.get('q') || '';
  const page = parseInt(params.get('page') || '1', 10);
  const pageSize = 15;

  const load = useCallback(() => {
    setLoading(true);
    api.listCheckouts({ status, q, page, pageSize })
      .then((res) => setData(res.data))
      .catch((err) => setError(errMsg(err)))
      .finally(() => setLoading(false));
  }, [status, q, page]);

  useEffect(() => { load(); }, [load]);

  const updateParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    next.set('page', '1');
    setParams(next);
  };

  const openModal = () => {
    setForm({ item_id: '', checked_out_to: '', department: '', expected_return_date: '' });
    api.listItems({ status: 'available', pageSize: 200 }).then((res) => setAvailableItems(res.data.data));
    setModalOpen(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.checkOutItem(form);
      setModalOpen(false);
      setSuccess('Item checked out successfully.');
      load();
    } catch (err) { setError(errMsg(err)); }
  };

  const checkin = async (id) => {
    try {
      await api.checkInItem(id, {});
      setSuccess('Item checked in successfully.');
      load();
    } catch (err) { setError(errMsg(err)); }
  };

  return (
    <Layout
      title="Check-In / Check-Out"
      subtitle="Track who currently holds each asset"
actions={isAdmin ? <button className="btn-primary" onClick={openModal}>+ New Check-Out</button> : null}
    >
      <Alert message={error} onClose={() => setError('')} />
      <Alert type="success" message={success} onClose={() => setSuccess('')} />

      <div className="card p-4 mb-4 flex flex-wrap gap-3">
        <input
          className="input max-w-xs"
          placeholder="Search by name or holder…"
          defaultValue={q}
          onBlur={(e) => updateParam('q', e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && updateParam('q', e.target.value)}
        />
        <select className="input max-w-[160px]" value={status} onChange={(e) => updateParam('status', e.target.value)}>
          <option value="">All</option>
          <option value="active">Active</option>
          <option value="returned">Returned</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Asset</th>
              <th className="text-left px-4 py-3">Checked Out To</th>
              <th className="text-left px-4 py-3">Out Date</th>
              <th className="text-left px-4 py-3">Expected Return</th>
              <th className="text-left px-4 py-3">Returned</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading ? (
              <tr><td colSpan={7} className="text-center py-8 text-neutral-400">Loading…</td></tr>
            ) : data.data.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-neutral-400">No check-out records found.</td></tr>
            ) : (
              data.data.map((c) => (
                <tr key={c.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <Link to={`/items/${c.item_id}`} className="font-medium text-neutral-900 hover:text-brand-600">{c.item_name}</Link>
                    <div className="text-xs text-neutral-400 font-mono">{c.asset_code}</div>
                  </td>
                  <td className="px-4 py-3">{c.checked_out_to}{c.department ? ` (${c.department})` : ''}</td>
                  <td className="px-4 py-3 text-neutral-500">{c.checkout_date}</td>
                  <td className="px-4 py-3 text-neutral-500">{c.expected_return_date || '—'}</td>
                  <td className="px-4 py-3 text-neutral-500">{c.return_date || '—'}</td>
                  <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
<td className="px-4 py-3 text-right">
                    {c.status === 'active' && isAdmin && (
                      <button className="text-brand-600 hover:underline text-xs" onClick={() => checkin(c.id)}>Check In</button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} pageSize={pageSize} total={data.total} onChange={(p) => updateParam('page', String(p))} />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Check-Out">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Asset *</label>
            <select className="input" required value={form.item_id} onChange={(e) => setForm({ ...form, item_id: e.target.value })}>
              <option value="">Select an available asset…</option>
              {availableItems.map((i) => (
                <option key={i.id} value={i.id}>{i.asset_code} — {i.name}</option>
              ))}
            </select>
            {availableItems.length === 0 && (
              <p className="text-xs text-neutral-400 mt-1">No assets are currently available to check out.</p>
            )}
          </div>
          <div>
            <label className="label">Checked Out To *</label>
            <input className="input" required value={form.checked_out_to} onChange={(e) => setForm({ ...form, checked_out_to: e.target.value })} />
          </div>
          <div>
            <label className="label">Department</label>
            <input className="input" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
          </div>
          <div>
            <label className="label">Expected Return Date</label>
            <input type="date" className="input" value={form.expected_return_date} onChange={(e) => setForm({ ...form, expected_return_date: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary">Check Out</button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}

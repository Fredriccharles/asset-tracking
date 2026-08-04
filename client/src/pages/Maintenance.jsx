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

export default function Maintenance() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState({ data: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [newModal, setNewModal] = useState(false);
  const [eligibleItems, setEligibleItems] = useState([]);
  const [newForm, setNewForm] = useState({ item_id: '', issue_description: '', priority: 'medium', reported_by: '', assigned_to: '' });

  const [updateModal, setUpdateModal] = useState(null); // ticket being updated
  const [updateForm, setUpdateForm] = useState({ status: '', assigned_to: '', resolution_notes: '', cost: '' });

  const status = params.get('status') || '';
  const q = params.get('q') || '';
  const page = parseInt(params.get('page') || '1', 10);
  const pageSize = 15;

  const load = useCallback(() => {
    setLoading(true);
    api.listTickets({ status, q, page, pageSize })
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

  const openNew = () => {
    setNewForm({ item_id: '', issue_description: '', priority: 'medium', reported_by: '', assigned_to: '' });
    api.listItems({ pageSize: 200 }).then((res) =>
      setEligibleItems(res.data.data.filter((i) => i.status !== 'retired' && i.status !== 'checked_out'))
    );
    setNewModal(true);
  };

  const submitNew = async (e) => {
    e.preventDefault();
    try {
      await api.createTicket(newForm);
      setNewModal(false);
      setSuccess('Maintenance ticket opened. Asset marked Under Repair.');
      load();
    } catch (err) { setError(errMsg(err)); }
  };

  const openUpdate = (ticket) => {
    setUpdateModal(ticket);
    setUpdateForm({ status: ticket.status, assigned_to: ticket.assigned_to || '', resolution_notes: ticket.resolution_notes || '', cost: ticket.cost ?? '' });
  };

  const submitUpdate = async (e) => {
    e.preventDefault();
    try {
      await api.updateTicket(updateModal.id, updateForm);
      setUpdateModal(null);
      setSuccess('Ticket updated.');
      load();
    } catch (err) { setError(errMsg(err)); }
  };

  return (
    <Layout
      title="Maintenance Tickets"
      subtitle="Repairs currently block an asset from being checked out"
actions={isAdmin ? <button className="btn-primary" onClick={openNew}>+ New Ticket</button> : null}
    >
      <Alert message={error} onClose={() => setError('')} />
      <Alert type="success" message={success} onClose={() => setSuccess('')} />

      <div className="card p-4 mb-4 flex flex-wrap gap-3">
        <input
          className="input max-w-xs"
          placeholder="Search issue, item, code…"
          defaultValue={q}
          onBlur={(e) => updateParam('q', e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && updateParam('q', e.target.value)}
        />
        <select className="input max-w-[160px]" value={status} onChange={(e) => updateParam('status', e.target.value)}>
          <option value="">All Statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Asset</th>
              <th className="text-left px-4 py-3">Issue</th>
              <th className="text-left px-4 py-3">Priority</th>
              <th className="text-left px-4 py-3">Reported</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading ? (
              <tr><td colSpan={6} className="text-center py-8 text-neutral-400">Loading…</td></tr>
            ) : data.data.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-neutral-400">No tickets found.</td></tr>
            ) : (
              data.data.map((t) => (
                <tr key={t.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <Link to={`/items/${t.item_id}`} className="font-medium text-neutral-900 hover:text-brand-600">{t.item_name}</Link>
                    <div className="text-xs text-neutral-400 font-mono">{t.asset_code}</div>
                  </td>
                  <td className="px-4 py-3 max-w-xs truncate">{t.issue_description}</td>
                  <td className="px-4 py-3 capitalize">{t.priority}</td>
                  <td className="px-4 py-3 text-neutral-500">{t.reported_date}</td>
                  <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
<td className="px-4 py-3 text-right">
                    {!['completed', 'cancelled'].includes(t.status) && isAdmin && (
                      <button className="text-brand-600 hover:underline text-xs" onClick={() => openUpdate(t)}>Update</button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} pageSize={pageSize} total={data.total} onChange={(p) => updateParam('page', String(p))} />

      <Modal open={newModal} onClose={() => setNewModal(false)} title="New Maintenance Ticket">
        <form onSubmit={submitNew} className="space-y-4">
          <div>
            <label className="label">Asset *</label>
            <select className="input" required value={newForm.item_id} onChange={(e) => setNewForm({ ...newForm, item_id: e.target.value })}>
              <option value="">Select an asset…</option>
              {eligibleItems.map((i) => (
                <option key={i.id} value={i.id}>{i.asset_code} — {i.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Issue Description *</label>
            <textarea className="input" required rows={3} value={newForm.issue_description} onChange={(e) => setNewForm({ ...newForm, issue_description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Priority</label>
              <select className="input" value={newForm.priority} onChange={(e) => setNewForm({ ...newForm, priority: e.target.value })}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="label">Assigned To</label>
              <input className="input" value={newForm.assigned_to} onChange={(e) => setNewForm({ ...newForm, assigned_to: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Reported By</label>
            <input className="input" value={newForm.reported_by} onChange={(e) => setNewForm({ ...newForm, reported_by: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setNewModal(false)}>Cancel</button>
            <button type="submit" className="btn-primary">Open Ticket</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!updateModal} onClose={() => setUpdateModal(null)} title={`Update Ticket — ${updateModal?.item_name || ''}`}>
        {updateModal && (
          <form onSubmit={submitUpdate} className="space-y-4">
            <div>
              <label className="label">Status</label>
              <select className="input" value={updateForm.status} onChange={(e) => setUpdateForm({ ...updateForm, status: e.target.value })}>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              {(updateForm.status === 'completed' || updateForm.status === 'cancelled') && (
                <p className="text-xs text-success-700 bg-success-50 border border-success-200 rounded-lg px-3 py-2 mt-2">
                  Closing this ticket will release the asset back to <strong>Available</strong> (if no other open tickets exist).
                </p>
              )}
            </div>
            <div>
              <label className="label">Assigned To</label>
              <input className="input" value={updateForm.assigned_to} onChange={(e) => setUpdateForm({ ...updateForm, assigned_to: e.target.value })} />
            </div>
            <div>
              <label className="label">Resolution Notes</label>
              <textarea className="input" rows={2} value={updateForm.resolution_notes} onChange={(e) => setUpdateForm({ ...updateForm, resolution_notes: e.target.value })} />
            </div>
            <div>
              <label className="label">Cost</label>
              <input type="number" step="0.01" className="input" value={updateForm.cost} onChange={(e) => setUpdateForm({ ...updateForm, cost: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setUpdateModal(null)}>Cancel</button>
              <button type="submit" className="btn-primary">Save</button>
            </div>
          </form>
        )}
      </Modal>
    </Layout>
  );
}

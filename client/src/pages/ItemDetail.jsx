import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import Alert from '../components/Alert';
import StatusBadge from '../components/StatusBadge';
import * as api from '../api/api';
import { errMsg } from '../api/api';

export default function ItemDetail() {
  const { id } = useParams();
  const [item, setItem] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [checkoutModal, setCheckoutModal] = useState(false);
  const [checkoutForm, setCheckoutForm] = useState({ checked_out_to: '', department: '', expected_return_date: '' });

  const [ticketModal, setTicketModal] = useState(false);
  const [ticketForm, setTicketForm] = useState({ issue_description: '', priority: 'medium', reported_by: '' });

  const [retireModal, setRetireModal] = useState(false);
  const [retireForm, setRetireForm] = useState({ reason: '', disposal_method: '', disposal_value: '' });

  const load = useCallback(() => {
    api.getItem(id).then((res) => setItem(res.data)).catch((err) => setError(errMsg(err)));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const doCheckout = async (e) => {
    e.preventDefault();
    try {
      await api.checkOutItem({ item_id: item.id, ...checkoutForm });
      setCheckoutModal(false);
      setSuccess('Item checked out.');
      load();
    } catch (err) { setError(errMsg(err)); }
  };

  const doCheckin = async (checkoutId) => {
    try {
      await api.checkInItem(checkoutId, {});
      setSuccess('Item checked in.');
      load();
    } catch (err) { setError(errMsg(err)); }
  };

  const doTicket = async (e) => {
    e.preventDefault();
    try {
      await api.createTicket({ item_id: item.id, ...ticketForm });
      setTicketModal(false);
      setSuccess('Maintenance ticket opened. Item is now marked under repair.');
      load();
    } catch (err) { setError(errMsg(err)); }
  };

  const doRetire = async (e) => {
    e.preventDefault();
    try {
      await api.retireItem({ item_id: item.id, ...retireForm });
      setRetireModal(false);
      setSuccess('Item retired.');
      load();
    } catch (err) { setError(errMsg(err)); }
  };

  if (!item) {
    return <Layout title="Loading…"><Alert message={error} /></Layout>;
  }

  return (
    <Layout
      title={item.name}
      subtitle={`Asset Code: ${item.asset_code}`}
      actions={
        <>
          <Link to="/items" className="btn-secondary">← Back to Assets</Link>
          {item.status === 'available' && (
            <button className="btn-primary" onClick={() => setCheckoutModal(true)}>Check Out</button>
          )}
          {item.status !== 'retired' && item.status !== 'checked_out' && (
            <button className="btn-secondary" onClick={() => setTicketModal(true)}>Report Issue</button>
          )}
          {(item.status === 'available' || item.status === 'under_repair') && (
            <button className="btn-danger" onClick={() => setRetireModal(true)}>Retire</button>
          )}
        </>
      }
    >
      <Alert message={error} onClose={() => setError('')} />
      <Alert type="success" message={success} onClose={() => setSuccess('')} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-5 lg:col-span-1 h-fit">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-neutral-900">Details</h3>
            <StatusBadge status={item.status} />
          </div>
          <dl className="text-sm space-y-2">
            <Row label="Category" value={item.category_name || '—'} />
            <Row label="Model" value={item.model || '—'} />
            <Row label="Serial Number" value={item.serial_number || '—'} />
            <Row label="Supplier" value={item.supplier || '—'} />
            <Row label="Purchase Date" value={item.purchase_date || '—'} />
            <Row label="Purchase Cost" value={item.purchase_cost != null ? `$${Number(item.purchase_cost).toFixed(2)}` : '—'} />
            
          </dl>
          {item.retirement && (
            <div className="mt-4 pt-4 border-t border-neutral-100 text-sm">
              <p className="font-medium text-neutral-700 mb-1">Retirement Record</p>
              <Row label="Retired" value={item.retirement.retired_date} />
              <Row label="Reason" value={item.retirement.reason} />
              <Row label="Disposal" value={item.retirement.disposal_method || '—'} />
            </div>
          )}
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="card p-5">
            <h3 className="font-semibold text-neutral-900 mb-3">Check-Out History</h3>
            {item.checkouts.length === 0 ? (
              <p className="text-sm text-neutral-400">No check-out history.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-xs text-neutral-500 uppercase">
                  <tr><th className="text-left py-1">Held By</th><th className="text-left py-1">Out</th><th className="text-left py-1">In</th><th className="text-left py-1">Status</th><th></th></tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {item.checkouts.map((c) => (
                    <tr key={c.id}>
                      <td className="py-2">{c.checked_out_to}</td>
                      <td className="py-2 text-neutral-500">{c.checkout_date}</td>
                      <td className="py-2 text-neutral-500">{c.return_date || '—'}</td>
                      <td className="py-2"><StatusBadge status={c.status} /></td>
                      <td className="py-2 text-right">
                        {c.status === 'active' && (
                          <button className="text-brand-600 hover:underline text-xs" onClick={() => doCheckin(c.id)}>Check In</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card p-5">
            <h3 className="font-semibold text-neutral-900 mb-3">Maintenance History</h3>
            {item.maintenance_tickets.length === 0 ? (
              <p className="text-sm text-neutral-400">No maintenance tickets.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-xs text-neutral-500 uppercase">
                  <tr><th className="text-left py-1">Issue</th><th className="text-left py-1">Priority</th><th className="text-left py-1">Reported</th><th className="text-left py-1">Status</th></tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {item.maintenance_tickets.map((t) => (
                    <tr key={t.id}>
                      <td className="py-2">{t.issue_description}</td>
                      <td className="py-2 capitalize text-neutral-600">{t.priority}</td>
                      <td className="py-2 text-neutral-500">{t.reported_date}</td>
                      <td className="py-2"><StatusBadge status={t.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <Link to="/maintenance" className="text-sm text-brand-600 hover:underline mt-3 inline-block">
              Manage tickets in Maintenance →
            </Link>
          </div>
        </div>
      </div>

      <Modal open={checkoutModal} onClose={() => setCheckoutModal(false)} title="Check Out Item">
        <form onSubmit={doCheckout} className="space-y-4">
          <div>
            <label className="label">Checked Out To *</label>
            <input className="input" required value={checkoutForm.checked_out_to} onChange={(e) => setCheckoutForm({ ...checkoutForm, checked_out_to: e.target.value })} />
          </div>
          <div>
            <label className="label">Department</label>
            <input className="input" value={checkoutForm.department} onChange={(e) => setCheckoutForm({ ...checkoutForm, department: e.target.value })} />
          </div>
          <div>
            <label className="label">Expected Return Date</label>
            <input type="date" className="input" value={checkoutForm.expected_return_date} onChange={(e) => setCheckoutForm({ ...checkoutForm, expected_return_date: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setCheckoutModal(false)}>Cancel</button>
            <button type="submit" className="btn-primary">Check Out</button>
          </div>
        </form>
      </Modal>

      <Modal open={ticketModal} onClose={() => setTicketModal(false)} title="Report Maintenance Issue">
        <form onSubmit={doTicket} className="space-y-4">
          <p className="text-xs text-brand-700 bg-brand-50 border border-brand-200 rounded-lg px-3 py-2">
            Opening a ticket immediately marks this asset as <strong>Under Repair</strong>, which blocks it from being checked out until the ticket is closed.
          </p>
          <div>
            <label className="label">Issue Description *</label>
            <textarea className="input" required rows={3} value={ticketForm.issue_description} onChange={(e) => setTicketForm({ ...ticketForm, issue_description: e.target.value })} />
          </div>
          <div>
            <label className="label">Priority</label>
            <select className="input" value={ticketForm.priority} onChange={(e) => setTicketForm({ ...ticketForm, priority: e.target.value })}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div>
            <label className="label">Reported By</label>
            <input className="input" value={ticketForm.reported_by} onChange={(e) => setTicketForm({ ...ticketForm, reported_by: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setTicketModal(false)}>Cancel</button>
            <button type="submit" className="btn-primary">Open Ticket</button>
          </div>
        </form>
      </Modal>

      <Modal open={retireModal} onClose={() => setRetireModal(false)} title="Retire Asset">
        <form onSubmit={doRetire} className="space-y-4">
          <p className="text-xs text-danger-700 bg-danger-50 border border-danger-200 rounded-lg px-3 py-2">
            Retirement is permanent. The asset record is preserved for history but can no longer be checked out or edited.
          </p>
          <div>
            <label className="label">Reason *</label>
            <textarea className="input" required rows={2} value={retireForm.reason} onChange={(e) => setRetireForm({ ...retireForm, reason: e.target.value })} />
          </div>
          <div>
            <label className="label">Disposal Method</label>
            <input className="input" value={retireForm.disposal_method} onChange={(e) => setRetireForm({ ...retireForm, disposal_method: e.target.value })} placeholder="e.g. Recycled, Sold, Donated" />
          </div>
          <div>
            <label className="label">Disposal Value</label>
            <input type="number" step="0.01" className="input" value={retireForm.disposal_value} onChange={(e) => setRetireForm({ ...retireForm, disposal_value: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setRetireModal(false)}>Cancel</button>
            <button type="submit" className="btn-danger">Retire Asset</button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="text-neutral-900 text-right">{value}</dd>
    </div>
  );
}

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileText } from 'lucide-react';
import Layout from '../components/Layout';
import Alert from '../components/Alert';
import Pagination from '../components/Pagination';
import * as api from '../api/api';
import { errMsg } from '../api/api';

export default function AuditLog() {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState({ data: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  const q = params.get('q') || '';
  const page = parseInt(params.get('page') || '1', 10);
  const pageSize = 25;

  const load = useCallback(() => {
    setLoading(true);
    api.listAudit({ q, page, pageSize })
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

  const exportPdf = async () => {
    setExporting(true);
    try {
      await api.downloadReport('audit', { format: 'pdf' });
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setExporting(false);
    }
  };

  return (
    <Layout
      title="Audit Log"
      subtitle="A complete, append-only record of every admin action"
      actions={
        <button className="btn-secondary" disabled={exporting} onClick={exportPdf}>
          <FileText size={15} strokeWidth={1.75} />
          {exporting ? 'Generating…' : 'Export PDF'}
        </button>
      }
    >
      <Alert message={error} onClose={() => setError('')} />

      <div className="card p-4 mb-4">
        <input
          className="input max-w-sm"
          placeholder="Search user, action, details…"
          defaultValue={q}
          onBlur={(e) => updateParam('q', e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && updateParam('q', e.target.value)}
        />
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Date/Time</th>
              <th className="text-left px-4 py-3">User</th>
              <th className="text-left px-4 py-3">Action</th>
              <th className="text-left px-4 py-3">Entity</th>
              <th className="text-left px-4 py-3">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading ? (
              <tr><td colSpan={5} className="text-center py-8 text-neutral-400">Loading…</td></tr>
            ) : data.data.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-neutral-400">No audit entries found.</td></tr>
            ) : (
              data.data.map((a) => (
                <tr key={a.id} className="hover:bg-neutral-50 align-top">
                  <td className="px-4 py-3 text-neutral-500 whitespace-nowrap">{a.created_at}</td>
                  <td className="px-4 py-3">{a.username}</td>
<td className="px-4 py-3 font-medium text-neutral-800">{actionLabel(a.action)}</td>
                  <td className="px-4 py-3 text-neutral-600">{a.entity_type ? `${entityLabel(a.entity_type)} #${a.entity_id}` : '—'}</td>
                  <td className="px-4 py-3 text-neutral-500 max-w-sm truncate" title={a.details}>{renderDetails(a)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} pageSize={pageSize} total={data.total} onChange={(p) => updateParam('page', String(p))} />
    </Layout>
  );
}

const ACTION_LABELS = {
  LOGIN: 'Login',
  LOGOUT: 'Logout',
  PASSWORD_CHANGE: 'Password Change',
  USER_CREATE: 'User Created',
  USER_UPDATE: 'User Updated',
  ITEM_CREATE: 'Item Created',
  ITEM_UPDATE: 'Item Updated',
  ITEM_RETIRE: 'Item Retired',
  CATEGORY_CREATE: 'Category Created',
  SUBCATEGORY_CREATE: 'Subcategory Created',
  CHECKOUT: 'Check-Out',
  CHECKIN: 'Check-In',
  TICKET_CREATE: 'Maintenance Ticket Opened',
  TICKET_UPDATE: 'Maintenance Ticket Updated',
  BACKUP_CREATE: 'Backup Created',
  RESTORE: 'Database Restored',
  REPORT_GENERATE: 'Report Generated',
};

const ENTITY_LABELS = {
  item: 'Item',
  checkout: 'Check-Out',
  maintenance_ticket: 'Maintenance Ticket',
  retirement: 'Retirement',
  category: 'Category',
  subcategory: 'Subcategory',
  user: 'User',
  backup: 'Backup',
  report: 'Report',
};

function prettyCode(value, map) {
  if (!value) return value || '—';
  const mapped = map[value];
  if (mapped !== undefined) return mapped;
  return String(value)
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

const actionLabel = (a) => prettyCode(a, ACTION_LABELS);
const entityLabel = (e) => prettyCode(e, ENTITY_LABELS);

function renderDetails(a) {
  if (!a.details) return '—';
  try {
    const obj = typeof a.details === 'string' ? JSON.parse(a.details) : a.details;
    if (!obj || Object.keys(obj).length === 0) return '—';

    // Friendly formatting for common keys
    if (obj.username && Object.keys(obj).length === 1) return obj.username;

    const parts = [];
    for (const [k, v] of Object.entries(obj)) {
      if (v === null || v === undefined || v === '') continue;
      // shorten long strings
      const val = typeof v === 'string' && v.length > 100 ? `${v.slice(0, 100)}…` : String(v);
      parts.push(`${k.replace(/_/g, ' ')}: ${val}`);
    }
    return parts.join(', ');
  } catch (err) {
    return String(a.details || '—');
  }
}

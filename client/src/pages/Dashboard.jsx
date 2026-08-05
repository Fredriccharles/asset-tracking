import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import * as api from '../api/api';
import { errMsg } from '../api/api';
import Alert from '../components/Alert';
import { useAuth } from '../context/AuthContext';

const STAT_DEFS = [
  { key: 'available', label: 'Available', color: 'bg-success-600', to: '/items?status=available' },
  { key: 'checked_out', label: 'Checked Out', color: 'bg-brand-600', to: '/items?status=checked_out' },
  { key: 'under_repair', label: 'Under Repair', color: 'bg-danger-600', to: '/items?status=under_repair' },
  { key: 'retired', label: 'Retired', color: 'bg-neutral-400', to: '/items?status=retired' },
];

function money(n) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'PHP' }).format(n || 0);
}

const ACTIVITY_LABELS = {
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

const ACTIVITY_ENTITY_LABELS = {
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

function niceLabel(value, map) {
  if (!value) return '';
  const mapped = map[value];
  if (mapped !== undefined) return mapped;
  return String(value)
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export default function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .getDashboardSummary()
      .then((res) => setSummary(res.data))
      .catch((err) => setError(errMsg(err)));
  }, []);

  const availableByCategory = summary?.availableByCategory || [];
  const availableAssets = summary?.availableAssets || [];

  return (
    <Layout title="Dashboard" subtitle="Overview of your asset fleet">
      <Alert message={error} onClose={() => setError('')} />

      {!summary ? (
        <div className="text-neutral-400 text-sm">Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {STAT_DEFS.map((s) => (
              <Link key={s.key} to={s.to} className="card p-5 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3">
                  <span className={`w-2.5 h-2.5 rounded-full ${s.color}`} />
                  <span className="text-sm text-neutral-500">{s.label}</span>
                </div>
                <div className="text-3xl font-bold text-neutral-900 mt-2">
                  {summary.statusCounts[s.key] ?? 0}
                </div>
              </Link>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            <div className="card p-5">
              <div className="text-sm text-neutral-500 mb-1">Total Fleet Value (active)</div>
              <div className="text-2xl font-bold text-neutral-900">{money(summary.totalValue)}</div>
            </div>
            <Link to="/maintenance?status=open" className="card p-5 hover:shadow-md transition-shadow">
              <div className="text-sm text-neutral-500 mb-1">Open Maintenance Tickets</div>
              <div className="text-2xl font-bold text-danger-600">{summary.openTickets}</div>
            </Link>
            <Link to="/checkouts?status=active" className="card p-5 hover:shadow-md transition-shadow">
              <div className="text-sm text-neutral-500 mb-1">Overdue Check-Outs</div>
              <div className="text-2xl font-bold text-danger-600">{summary.overdueCheckouts}</div>
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="card p-5">
              <h3 className="font-semibold text-neutral-900 mb-4">Assets by Category</h3>
              {summary.byCategory.length === 0 ? (
                <p className="text-sm text-neutral-400">No active assets yet.</p>
              ) : (
                <div className="space-y-3">
                  {summary.byCategory.map((c) => {
                    const max = Math.max(...summary.byCategory.map((x) => x.count));
                    return (
                      <div key={c.category}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-neutral-700">{c.category}</span>
                          <span className="text-neutral-500">{c.count}</span>
                        </div>
                        <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-brand-500 rounded-full"
                            style={{ width: `${(c.count / max) * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="card p-5">
              <h3 className="font-semibold text-neutral-900 mb-4">Available Assets by Category</h3>
              {availableByCategory.length === 0 ? (
                <p className="text-sm text-neutral-400">No assets are currently available to use.</p>
              ) : (
                <div className="space-y-3">
                  {availableByCategory.map((c) => {
                    const max = Math.max(...availableByCategory.map((x) => x.count));
                    return (
                      <div key={c.category}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-neutral-700">{c.category}</span>
                          <span className="text-success-700 font-medium">{c.count}</span>
                        </div>
                        <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-success-500 rounded-full"
                            style={{ width: `${(c.count / max) * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <Link to="/items?status=available" className="text-sm text-brand-600 hover:underline mt-4 inline-block">
                View all available assets →
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-5">
              <h3 className="font-semibold text-neutral-900 mb-4">Recently Available Assets</h3>
              {availableAssets.length === 0 ? (
                <p className="text-sm text-neutral-400">No assets are currently available to use.</p>
              ) : (
                <ul className="divide-y divide-neutral-100">
                  {availableAssets.map((a) => (
                    <li key={a.id} className="py-2.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <Link to={`/items/${a.id}`} className="font-medium text-neutral-900 hover:text-brand-600 truncate block">
                          {a.name}
                        </Link>
                        <div className="text-xs text-neutral-400">
                          <span className="font-mono">{a.asset_code}</span>
                          {a.category_name ? ` · ${a.category_name}` : ''}
                          {a.subcategory_name ? ` / ${a.subcategory_name}` : ''}
                          {a.location ? ` · ${a.location}` : ''}
                        </div>
                      </div>
                      <span className="shrink-0 text-xs font-medium text-success-700 bg-success-50 border border-success-200 rounded-full px-2.5 py-1">
                        Available
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="card p-5">
              <h3 className="font-semibold text-neutral-900 mb-4">Recent Activity</h3>
              {summary.recentActivity.length === 0 ? (
                <p className="text-sm text-neutral-400">No activity yet.</p>
              ) : (
                <ul className="space-y-3">
                  {summary.recentActivity.map((a, i) => (
                    <li key={i} className="flex items-start justify-between text-sm">
                      <div>
<span className="font-medium text-neutral-800">{niceLabel(a.action, ACTIVITY_LABELS)}</span>
                        <span className="text-neutral-400"> — {a.entity_type ? `${niceLabel(a.entity_type, ACTIVITY_ENTITY_LABELS)} #${a.entity_id}` : ''}</span>
                      </div>
                      <span className="text-neutral-400 whitespace-nowrap ml-3">{a.created_at}</span>
                    </li>
                  ))}
                </ul>
              )}
{isAdmin ? (
                <Link to="/audit" className="text-sm text-brand-600 hover:underline mt-4 inline-block">
                  View full audit log →
                </Link>
              ) : (
                <p className="text-sm text-neutral-400 mt-4">Recent administrator activity.</p>
              )}
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import * as api from '../api/api';
import { errMsg } from '../api/api';
import Alert from '../components/Alert';

const STAT_DEFS = [
  { key: 'available', label: 'Available', color: 'bg-success-600', to: '/items?status=available' },
  { key: 'checked_out', label: 'Checked Out', color: 'bg-brand-600', to: '/items?status=checked_out' },
  { key: 'under_repair', label: 'Under Repair', color: 'bg-danger-600', to: '/items?status=under_repair' },
  { key: 'retired', label: 'Retired', color: 'bg-neutral-400', to: '/items?status=retired' },
];

function money(n) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'PHP' }).format(n || 0);
}

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .getDashboardSummary()
      .then((res) => setSummary(res.data))
      .catch((err) => setError(errMsg(err)));
  }, []);

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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
              <h3 className="font-semibold text-neutral-900 mb-4">Recent Activity</h3>
              {summary.recentActivity.length === 0 ? (
                <p className="text-sm text-neutral-400">No activity yet.</p>
              ) : (
                <ul className="space-y-3">
                  {summary.recentActivity.map((a, i) => (
                    <li key={i} className="flex items-start justify-between text-sm">
                      <div>
                        <span className="font-medium text-neutral-800">{a.action.replace(/_/g, ' ')}</span>
                        <span className="text-neutral-400"> — {a.entity_type} #{a.entity_id}</span>
                      </div>
                      <span className="text-neutral-400 whitespace-nowrap ml-3">{a.created_at}</span>
                    </li>
                  ))}
                </ul>
              )}
              <Link to="/audit" className="text-sm text-brand-600 hover:underline mt-4 inline-block">
                View full audit log →
              </Link>
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}

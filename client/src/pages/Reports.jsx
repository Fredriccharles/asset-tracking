import { useState } from 'react';
import { FileText, FileSpreadsheet } from 'lucide-react';
import Layout from '../components/Layout';
import Alert from '../components/Alert';
import * as api from '../api/api';
import { errMsg } from '../api/api';

const REPORTS = [
  {
    key: 'items',
    title: 'Asset Inventory Report',
    description: 'Full list of assets with category, status, location, and cost.',
    filters: [
      { name: 'status', label: 'Status', options: ['', 'available', 'checked_out', 'under_repair', 'retired'] },
    ],
  },
  {
    key: 'checkouts',
    title: 'Check-Out / Check-In History',
    description: 'Every check-out event with holder, dates, and return status.',
    filters: [{ name: 'status', label: 'Status', options: ['', 'active', 'returned'] }],
  },
  {
    key: 'maintenance',
    title: 'Maintenance Tickets Report',
    description: 'Repair tickets with priority, cost, and resolution details.',
    filters: [{ name: 'status', label: 'Status', options: ['', 'open', 'in_progress', 'completed', 'cancelled'] }],
  },
  {
    key: 'retirements',
    title: 'Retirement / Disposal Report',
    description: 'All retired assets with reason and disposal method.',
    filters: [],
  },
  {
    key: 'audit',
    title: 'Admin Audit Log Report',
    description: 'Complete history of every administrative action taken in the system.',
    filters: [],
  },
];

export default function Reports() {
  const [error, setError] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [filterState, setFilterState] = useState({});

  const setFilter = (reportKey, name, value) => {
    setFilterState((s) => ({ ...s, [reportKey]: { ...s[reportKey], [name]: value } }));
  };

  const download = async (reportKey, format) => {
    setBusyKey(`${reportKey}-${format}`);
    setError('');
    try {
      const params = { ...(filterState[reportKey] || {}), format };
      Object.keys(params).forEach((k) => { if (!params[k]) delete params[k]; });
      await api.downloadReport(reportKey, params);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusyKey('');
    }
  };

  return (
    <Layout title="Reports" subtitle="Export PDF or Excel reports for any part of the system">
      <Alert message={error} onClose={() => setError('')} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {REPORTS.map((r) => (
          <div key={r.key} className="card p-5">
            <h3 className="font-semibold text-neutral-900">{r.title}</h3>
            <p className="text-sm text-neutral-500 mt-1 mb-4">{r.description}</p>

            {r.filters.length > 0 && (
              <div className="flex gap-3 mb-4">
                {r.filters.map((f) => (
                  <select
                    key={f.name}
                    className="input"
                    value={(filterState[r.key] || {})[f.name] || ''}
                    onChange={(e) => setFilter(r.key, f.name, e.target.value)}
                  >
                    {f.options.map((opt) => (
                      <option key={opt} value={opt}>{opt ? opt.replace(/_/g, ' ') : `All ${f.label}`}</option>
                    ))}
                  </select>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <button
                className="btn-secondary"
                disabled={busyKey === `${r.key}-pdf`}
                onClick={() => download(r.key, 'pdf')}
              >
                <FileText size={15} strokeWidth={1.75} />
                {busyKey === `${r.key}-pdf` ? 'Generating…' : 'Download PDF'}
              </button>
              <button
                className="btn-secondary"
                disabled={busyKey === `${r.key}-excel`}
                onClick={() => download(r.key, 'excel')}
              >
                <FileSpreadsheet size={15} strokeWidth={1.75} />
                {busyKey === `${r.key}-excel` ? 'Generating…' : 'Download Excel'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}

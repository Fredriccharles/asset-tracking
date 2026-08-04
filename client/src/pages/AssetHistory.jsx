import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronRight, Search, PackagePlus, Pencil, ArrowRightLeft, LogOut, LogIn,
  Wrench, CheckCircle2, Archive, RefreshCcw,
} from 'lucide-react';
import Layout from '../components/Layout';
import Alert from '../components/Alert';
import StatusBadge from '../components/StatusBadge';
import * as api from '../api/api';
import { errMsg } from '../api/api';

// Visual language for each event type — icon + the app's restrained
// semantic palette (blue = informational/in-progress, green = success/
// completed, red = needs-attention/permanent, neutral = closed-out).
const EVENT_META = {
  registration: { label: 'Registered', icon: PackagePlus, color: 'text-brand-700', dot: 'bg-brand-600' },
  edit: { label: 'Edited', icon: Pencil, color: 'text-neutral-600', dot: 'bg-neutral-400' },
  transfer: { label: 'Transferred', icon: ArrowRightLeft, color: 'text-brand-700', dot: 'bg-brand-600' },
  checkout: { label: 'Checked Out', icon: LogOut, color: 'text-brand-700', dot: 'bg-brand-600' },
  return: { label: 'Returned', icon: LogIn, color: 'text-success-700', dot: 'bg-success-600' },
  maintenance_opened: { label: 'Maintenance Opened', icon: Wrench, color: 'text-danger-700', dot: 'bg-danger-600' },
  maintenance_updated: { label: 'Maintenance Updated', icon: Wrench, color: 'text-brand-700', dot: 'bg-brand-600' },
  maintenance_completed: { label: 'Maintenance Completed', icon: CheckCircle2, color: 'text-success-700', dot: 'bg-success-600' },
  status_change: { label: 'Status Changed', icon: RefreshCcw, color: 'text-neutral-600', dot: 'bg-neutral-400' },
  retirement: { label: 'Retired', icon: Archive, color: 'text-danger-700', dot: 'bg-danger-600' },
};

const EVENT_TYPES = Object.keys(EVENT_META);

function Crumb({ children, active }) {
  return (
    <span className={active ? 'font-medium text-neutral-900' : 'text-neutral-400'}>{children}</span>
  );
}

export default function AssetHistory() {
  const [error, setError] = useState('');

  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [assets, setAssets] = useState([]);

  const [categoryId, setCategoryId] = useState('');
  const [subcategoryId, setSubcategoryId] = useState('');
  const [assetId, setAssetId] = useState('');
  const [assetSearch, setAssetSearch] = useState('');

  const [timelineData, setTimelineData] = useState(null); // { item, timeline }
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineQuery, setTimelineQuery] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState('');

  const [loadingCats, setLoadingCats] = useState(true);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [loadingAssets, setLoadingAssets] = useState(false);

  // Level 1
  useEffect(() => {
    setLoadingCats(true);
    api.listHistoryCategories()
      .then((res) => setCategories(res.data))
      .catch((err) => setError(errMsg(err)))
      .finally(() => setLoadingCats(false));
  }, []);

  // Level 2 — reload whenever the chosen category changes
  useEffect(() => {
    setSubcategoryId('');
    setAssetId('');
    setAssets([]);
    setTimelineData(null);
    if (!categoryId) { setSubcategories([]); return; }
    setLoadingSubs(true);
    api.listHistorySubcategories(categoryId)
      .then((res) => setSubcategories(res.data))
      .catch((err) => setError(errMsg(err)))
      .finally(() => setLoadingSubs(false));
  }, [categoryId]);

  // Level 3 — reload whenever category, subcategory, or the model search box changes
  const loadAssets = useCallback(() => {
    if (!categoryId) { setAssets([]); return; }
    setLoadingAssets(true);
    api.listHistoryAssets({ category_id: categoryId, subcategory_id: subcategoryId || undefined, q: assetSearch || undefined })
      .then((res) => setAssets(res.data))
      .catch((err) => setError(errMsg(err)))
      .finally(() => setLoadingAssets(false));
  }, [categoryId, subcategoryId, assetSearch]);

  useEffect(() => {
    setAssetId('');
    setTimelineData(null);
    loadAssets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId, subcategoryId]);

  // Level 4 — the timeline itself
  const loadTimeline = useCallback(() => {
    if (!assetId) { setTimelineData(null); return; }
    setTimelineLoading(true);
    api.getAssetTimeline(assetId, { q: timelineQuery || undefined, event_type: eventTypeFilter || undefined })
      .then((res) => setTimelineData(res.data))
      .catch((err) => setError(errMsg(err)))
      .finally(() => setTimelineLoading(false));
  }, [assetId, timelineQuery, eventTypeFilter]);

  useEffect(() => { loadTimeline(); }, [loadTimeline]);

  const selectedCategory = categories.find((c) => String(c.id) === String(categoryId));
  const selectedSubcategory = subcategories.find((s) => String(s.id) === String(subcategoryId));
  const selectedAsset = assets.find((a) => String(a.id) === String(assetId));

  return (
    <Layout title="Asset History" subtitle="Browse by category to view a permanent, read-only timeline for any asset">
      <Alert message={error} onClose={() => setError('')} />

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm mb-4">
        <Crumb active={!categoryId}>All Categories</Crumb>
        {selectedCategory && (<><ChevronRight size={14} className="text-neutral-300" /><Crumb active={!subcategoryId && !assetId}>{selectedCategory.name}</Crumb></>)}
        {selectedSubcategory && (<><ChevronRight size={14} className="text-neutral-300" /><Crumb active={!assetId}>{selectedSubcategory.name}</Crumb></>)}
        {selectedAsset && (<><ChevronRight size={14} className="text-neutral-300" /><Crumb active>{selectedAsset.name}</Crumb></>)}
      </div>

      {/* Four-level cascading navigation */}
      <div className="card p-4 mb-6 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label className="label">1. Asset Category</label>
          <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} disabled={loadingCats}>
            <option value="">{loadingCats ? 'Loading…' : 'Select a category…'}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.asset_count})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">2. Subcategory</label>
          <select className="input" value={subcategoryId} onChange={(e) => setSubcategoryId(e.target.value)} disabled={!categoryId || loadingSubs}>
            <option value="">{!categoryId ? 'Select a category first' : loadingSubs ? 'Loading…' : subcategories.length ? 'All Subcategories' : 'No subcategories'}</option>
            {subcategories.map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({s.asset_count})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">3. Asset / Model</label>
          <select className="input" value={assetId} onChange={(e) => setAssetId(e.target.value)} disabled={!categoryId || loadingAssets}>
            <option value="">{!categoryId ? 'Select a category first' : loadingAssets ? 'Loading…' : 'Select an asset…'}</option>
            {assets.map((a) => (
              <option key={a.id} value={a.id}>{a.name}{a.model ? ` — ${a.model}` : ''} ({a.asset_code})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Filter models by name</label>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              className="input pl-8"
              placeholder="e.g. Nitro, FX3…"
              value={assetSearch}
              disabled={!categoryId}
              onChange={(e) => setAssetSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Level 4 — Asset Timeline */}
      {!assetId ? (
        <div className="card p-10 text-center text-neutral-400 text-sm">
          Select a category, then narrow down to a specific asset above to view its full timeline.
        </div>
      ) : (
        <div className="card p-5">
          <div className="flex items-start justify-between flex-wrap gap-3 mb-5">
            <div>
              <h3 className="font-semibold text-neutral-900 text-lg">{timelineData?.item?.name}</h3>
              <p className="text-sm text-neutral-500 font-mono">{timelineData?.item?.asset_code}</p>
            </div>
            {timelineData?.item && (
              <div className="flex items-center gap-3">
                <StatusBadge status={timelineData.item.status} />
                <Link to={`/items/${timelineData.item.id}`} className="text-sm text-brand-600 hover:underline">
                  Open asset record →
                </Link>
              </div>
            )}
          </div>

          {/* Search + filter the timeline itself */}
          <div className="flex flex-wrap gap-3 mb-5">
            <div className="relative flex-1 min-w-[220px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                className="input pl-8"
                placeholder="Search this asset's history…"
                value={timelineQuery}
                onChange={(e) => setTimelineQuery(e.target.value)}
              />
            </div>
            <select className="input max-w-[220px]" value={eventTypeFilter} onChange={(e) => setEventTypeFilter(e.target.value)}>
              <option value="">All Event Types</option>
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>{EVENT_META[t].label}</option>
              ))}
            </select>
            {(timelineQuery || eventTypeFilter) && (
              <button className="text-sm text-neutral-500 hover:text-neutral-700" onClick={() => { setTimelineQuery(''); setEventTypeFilter(''); }}>
                Clear
              </button>
            )}
          </div>

          {/* Read-only chronological timeline */}
          {timelineLoading ? (
            <div className="text-center py-10 text-neutral-400 text-sm">Loading timeline…</div>
          ) : !timelineData || timelineData.timeline.length === 0 ? (
            <div className="text-center py-10 text-neutral-400 text-sm">No matching history entries.</div>
          ) : (
            <ol className="relative border-l-2 border-neutral-100 ml-2">
              {timelineData.timeline.map((event) => {
                const meta = EVENT_META[event.event_type] || EVENT_META.status_change;
                const Icon = meta.icon;
                return (
                  <li key={event.id} className="mb-6 ml-6 last:mb-0">
                    <span className={`absolute -left-[9px] flex h-4 w-4 items-center justify-center rounded-full ${meta.dot}`} />
                    <div className="flex items-center gap-2 mb-0.5">
                      <Icon size={14} strokeWidth={1.75} className={meta.color} />
                      <span className={`text-sm font-semibold ${meta.color}`}>{meta.label}</span>
                      <span className="text-xs text-neutral-400">{event.event_date}</span>
                    </div>
                    <p className="text-sm text-neutral-700">{event.description}</p>
                    {event.performed_by && (
                      <p className="text-xs text-neutral-400 mt-0.5">by {event.performed_by}</p>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}
    </Layout>
  );
}

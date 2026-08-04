import { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import Alert from '../components/Alert';
import Pagination from '../components/Pagination';
import StatusBadge from '../components/StatusBadge';
import * as api from '../api/api';
import { errMsg } from '../api/api';

const EMPTY_FORM = {
  asset_code: '', name: '', category_id: '', subcategory_id: '', description: '', model: '',
  serial_number: '', purchase_date: '', purchase_cost: '', supplier: '',
  notes: '',
};

export default function Items() {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState({ data: [], total: 0 });
  const [categories, setCategories] = useState([]);
  const [filterSubcategories, setFilterSubcategories] = useState([]);
  const [formSubcategories, setFormSubcategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [catModalOpen, setCatModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [subModalOpen, setSubModalOpen] = useState(false);
  const [newSubName, setNewSubName] = useState('');
  const [newSubCategoryId, setNewSubCategoryId] = useState('');

  const q = params.get('q') || '';
  const status = params.get('status') || '';
  const category_id = params.get('category_id') || '';
  const subcategory_id = params.get('subcategory_id') || '';
  const page = parseInt(params.get('page') || '1', 10);
  const pageSize = 15;

  const load = useCallback(() => {
    setLoading(true);
    api
      .listItems({ q, status, category_id, subcategory_id, page, pageSize, sort: 'updated_at', order: 'desc' })
      .then((res) => setData(res.data))
      .catch((err) => setError(errMsg(err)))
      .finally(() => setLoading(false));
  }, [q, status, category_id, subcategory_id, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.listCategories().then((res) => setCategories(res.data)).catch(() => {});
  }, [catModalOpen]);

  // Filter row's subcategory dropdown follows the filter row's category.
  useEffect(() => {
    if (!category_id) { setFilterSubcategories([]); return; }
    api.listSubcategories(category_id).then((res) => setFilterSubcategories(res.data)).catch(() => {});
  }, [category_id, subModalOpen]);

  // Form's subcategory dropdown follows whatever category is chosen inside the modal.
  useEffect(() => {
    if (!form.category_id) { setFormSubcategories([]); return; }
    api.listSubcategories(form.category_id).then((res) => setFormSubcategories(res.data)).catch(() => {});
  }, [form.category_id, subModalOpen]);

  const updateParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    if (key === 'category_id') next.delete('subcategory_id'); // changing category resets subcategory filter
    next.set('page', '1');
    setParams(next);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditingId(item.id);
    setForm({
      asset_code: item.asset_code, name: item.name, category_id: item.category_id || '',
      subcategory_id: item.subcategory_id || '',
      description: item.description || '', model: item.model || '',
      serial_number: item.serial_number || '', purchase_date: item.purchase_date || '',
      purchase_cost: item.purchase_cost ?? '', supplier: item.supplier || '',
      notes: item.notes || '',
    });
    setFormError('');
    setModalOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      if (editingId) {
        await api.updateItem(editingId, form);
        setSuccess('Item updated successfully.');
      } else {
        await api.createItem(form);
        setSuccess('Item created successfully.');
      }
      setModalOpen(false);
      load();
    } catch (err) {
      setFormError(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  const saveCategory = async (e) => {
    e.preventDefault();
    try {
      await api.createCategory({ name: newCatName });
      setNewCatName('');
      setCatModalOpen(false);
    } catch (err) {
      setError(errMsg(err));
    }
  };

  const saveSubcategory = async (e) => {
    e.preventDefault();
    try {
      await api.createSubcategory({ name: newSubName, category_id: newSubCategoryId });
      setNewSubName('');
      setSubModalOpen(false);
    } catch (err) {
      setError(errMsg(err));
    }
  };

  return (
    <Layout
      title="Asset Inventory"
      subtitle={`${data.total} item${data.total === 1 ? '' : 's'} in the registry`}
      actions={
        <>
          <button className="btn-secondary" onClick={() => setCatModalOpen(true)}>+ Category</button>
          <button className="btn-secondary" onClick={() => { setNewSubCategoryId(category_id || ''); setSubModalOpen(true); }}>+ Subcategory</button>
          <button className="btn-primary" onClick={openCreate}>+ Add Asset</button>
        </>
      }
    >
      <Alert message={error} onClose={() => setError('')} />
      <Alert type="success" message={success} onClose={() => setSuccess('')} />

      <div className="card p-4 mb-4 flex flex-wrap gap-3 items-center">
        <input
          className="input max-w-xs"
          placeholder="Search name, code, serial…"
          defaultValue={q}
          onKeyDown={(e) => e.key === 'Enter' && updateParam('q', e.target.value)}
          onBlur={(e) => updateParam('q', e.target.value)}
        />
        <select className="input max-w-[160px]" value={status} onChange={(e) => updateParam('status', e.target.value)}>
          <option value="">All Statuses</option>
          <option value="available">Available</option>
          <option value="checked_out">Checked Out</option>
          <option value="under_repair">Under Repair</option>
          <option value="retired">Retired</option>
        </select>
        <select className="input max-w-[200px]" value={category_id} onChange={(e) => updateParam('category_id', e.target.value)}>
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          className="input max-w-[200px]"
          value={subcategory_id}
          disabled={!category_id}
          onChange={(e) => updateParam('subcategory_id', e.target.value)}
        >
          <option value="">{category_id ? 'All Subcategories' : 'Select a category first'}</option>
          {filterSubcategories.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        {(q || status || category_id || subcategory_id) && (
          <button className="text-sm text-neutral-500 hover:text-neutral-700" onClick={() => setParams({})}>
            Clear filters
          </button>
        )}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Asset Code</th>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Category</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-right px-4 py-3">Cost</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading ? (
              <tr><td colSpan={6} className="text-center py-8 text-neutral-400">Loading…</td></tr>
            ) : data.data.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-neutral-400">No assets found.</td></tr>
            ) : (
              data.data.map((item) => (
                <tr key={item.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3 font-mono text-xs">{item.asset_code}</td>
                  <td className="px-4 py-3 font-medium text-neutral-900">
                    <Link to={`/items/${item.id}`} className="hover:text-brand-600">{item.name}</Link>
                  </td>
                  <td className="px-4 py-3 text-neutral-600">
                    {item.category_name || '—'}{item.subcategory_name ? ` / ${item.subcategory_name}` : ''}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                  <td className="px-4 py-3 text-right text-neutral-600">
                    {item.purchase_cost != null ? `$${Number(item.purchase_cost).toFixed(2)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button className="text-brand-600 hover:underline text-xs mr-3" onClick={() => openEdit(item)}>Edit</button>
                    <Link to={`/items/${item.id}`} className="text-neutral-500 hover:underline text-xs">View</Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} pageSize={pageSize} total={data.total} onChange={(p) => updateParam('page', String(p))} />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Edit Asset' : 'Add New Asset'} width="max-w-2xl">
        <form onSubmit={save} className="space-y-4">
          <Alert message={formError} onClose={() => setFormError('')} />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Asset Code *</label>
              <input className="input" required value={form.asset_code} onChange={(e) => setForm({ ...form, asset_code: e.target.value })} placeholder="e.g. IT-0001" />
            </div>
            <div>
              <label className="label">Name *</label>
              <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="label">Category</label>
              <select
                className="input"
                value={form.category_id}
                onChange={(e) => setForm({ ...form, category_id: e.target.value, subcategory_id: '' })}
              >
                <option value="">Uncategorized</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Subcategory</label>
              <select
                className="input"
                value={form.subcategory_id}
                disabled={!form.category_id}
                onChange={(e) => setForm({ ...form, subcategory_id: e.target.value })}
              >
                <option value="">{form.category_id ? 'None' : 'Select a category first'}</option>
                {formSubcategories.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            
            <div>
              <label className="label">Model</label>
              <input className="input" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
            </div>
            <div>
              <label className="label">Serial Number</label>
              <input className="input" value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} />
            </div>
            <div>
              <label className="label">Supplier</label>
              <input className="input" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
            </div>
            <div>
              <label className="label">Purchase Date</label>
              <input type="date" className="input" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} />
            </div>
            <div>
              <label className="label">Purchase Cost</label>
              <input type="number" step="0.01" className="input" value={form.purchase_cost} onChange={(e) => setForm({ ...form, purchase_cost: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save Asset'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={catModalOpen} onClose={() => setCatModalOpen(false)} title="Add Category" width="max-w-sm">
        <form onSubmit={saveCategory} className="space-y-4">
          <div>
            <label className="label">Category Name *</label>
            <input className="input" required value={newCatName} onChange={(e) => setNewCatName(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setCatModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary">Add</button>
          </div>
        </form>
      </Modal>

      <Modal open={subModalOpen} onClose={() => setSubModalOpen(false)} title="Add Subcategory" width="max-w-sm">
        <form onSubmit={saveSubcategory} className="space-y-4">
          <div>
            <label className="label">Parent Category *</label>
            <select className="input" required value={newSubCategoryId} onChange={(e) => setNewSubCategoryId(e.target.value)}>
              <option value="">Select a category…</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Subcategory Name *</label>
            <input className="input" required value={newSubName} onChange={(e) => setNewSubName(e.target.value)} placeholder="e.g. Laptop" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setSubModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary">Add</button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}

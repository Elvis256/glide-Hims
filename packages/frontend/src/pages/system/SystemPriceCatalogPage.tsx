import { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../services/api';
import SystemPagination from '../../components/SystemPagination';
import { CatalogItem, fmtMoney, unwrap } from './saas/_shared';

export default function SystemPriceCatalogPage() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const filteredItems = useMemo(() => {
    if (!debouncedSearch) return items;
    const q = debouncedSearch.toLowerCase();
    return items.filter((item) =>
      item.code.toLowerCase().includes(q) ||
      item.name.toLowerCase().includes(q) ||
      (item.description && item.description.toLowerCase().includes(q))
    );
  }, [items, debouncedSearch]);

  const paginatedItems = useMemo(
    () => filteredItems.slice((page - 1) * pageSize, page * pageSize),
    [filteredItems, page, pageSize],
  );

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/saas-revenue/price-catalog');
      setItems(unwrap<CatalogItem[]>(r) || []);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load price catalog');
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const handleSave = async (data: Partial<CatalogItem>) => {
    try {
      if (editing?.id) {
        await api.put(`/saas-revenue/price-catalog/${editing.id}`, data);
      } else {
        await api.post('/saas-revenue/price-catalog', data);
      }
      setEditing(null);
      setShowNew(false);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save catalog item');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this catalog item?')) return;
    try {
      await api.delete(`/saas-revenue/price-catalog/${id}`);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete catalog item');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Price Catalog</h1>
          <p className="text-sm text-gray-500">Manage module and service pricing for quotations</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="inline-flex items-center gap-2 px-3 py-2 border rounded text-sm hover:bg-gray-50"><RefreshCw className="w-4 h-4" /> Refresh</button>
          <button onClick={() => { setEditing(null); setShowNew(true); }} className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"><Plus className="w-4 h-4" /> Add Item</button>
        </div>
      </div>

      <input
        type="text"
        placeholder="Search..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="px-3 py-2 border border-gray-200 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Price</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Active</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedItems.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-mono text-gray-900">{item.code}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{item.name}</td>
                  <td className="px-4 py-3 text-sm"><span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs">{item.category}</span></td>
                  <td className="px-4 py-3 text-sm text-right font-medium">{fmtMoney(item.unitPriceMinor, item.currency)}</td>
                  <td className="px-4 py-3 text-center">{item.isActive ? <span className="text-emerald-600">Yes</span> : <span className="text-gray-400">No</span>}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => { setEditing(item); setShowNew(true); }} className="text-blue-600 hover:text-blue-800 mr-2"><Pencil className="w-4 h-4 inline" /></button>
                    <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:text-red-800"><Trash2 className="w-4 h-4 inline" /></button>
                  </td>
                </tr>
              ))}
              {filteredItems.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No catalog items found</td></tr>}
            </tbody>
          </table>
          <SystemPagination page={page} pageSize={pageSize} total={filteredItems.length} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
        </div>
      )}

      {/* Modal for create/edit */}
      {showNew && <CatalogModal item={editing} onSave={handleSave} onClose={() => { setShowNew(false); setEditing(null); }} />}
    </div>
  );
}

function CatalogModal({ item, onSave, onClose }: { item: CatalogItem | null; onSave: (d: any) => void; onClose: () => void }) {
  const [form, setForm] = useState({
    code: item?.code ?? '',
    name: item?.name ?? '',
    description: item?.description ?? '',
    category: item?.category ?? 'module',
    unitPriceMinor: item?.unitPriceMinor ?? 0,
    currency: item?.currency ?? 'UGX',
    isActive: item?.isActive ?? true,
    sortOrder: item?.sortOrder ?? 0,
  });
  const [saving, setSaving] = useState(false);

  const handle = async () => {
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md space-y-4">
        <h2 className="text-lg font-bold">{item ? 'Edit Catalog Item' : 'New Catalog Item'}</h2>
        <div className="space-y-3">
          <div><label className="block text-sm font-medium mb-1">Code</label><input className="w-full border rounded px-3 py-2 text-sm" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
          <div><label className="block text-sm font-medium mb-1">Name</label><input className="w-full border rounded px-3 py-2 text-sm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="block text-sm font-medium mb-1">Description</label><textarea className="w-full border rounded px-3 py-2 text-sm" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-sm font-medium mb-1">Category</label>
              <select className="w-full border rounded px-3 py-2 text-sm" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as any })}>
                <option value="module">Module</option><option value="hardware">Hardware</option><option value="training">Training</option>
                <option value="implementation">Implementation</option><option value="support">Support</option><option value="other">Other</option>
              </select>
            </div>
            <div><label className="block text-sm font-medium mb-1">Currency</label>
              <select className="w-full border rounded px-3 py-2 text-sm" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                <option value="UGX">UGX</option><option value="USD">USD</option><option value="KES">KES</option><option value="TZS">TZS</option><option value="RWF">RWF</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-sm font-medium mb-1">Price (minor units)</label><input type="number" className="w-full border rounded px-3 py-2 text-sm" value={form.unitPriceMinor} onChange={(e) => setForm({ ...form, unitPriceMinor: parseInt(e.target.value) || 0 })} /></div>
            <div><label className="block text-sm font-medium mb-1">Sort Order</label><input type="number" className="w-full border rounded px-3 py-2 text-sm" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })} /></div>
          </div>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Active</label>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 border rounded text-sm hover:bg-gray-50">Cancel</button>
          <button onClick={handle} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}

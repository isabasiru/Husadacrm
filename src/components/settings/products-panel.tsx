'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2, PackageOpen, CheckCircle, XCircle, GripVertical, CornerDownRight } from 'lucide-react';

type Product = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  isActive: boolean;
  sortOrder: number;
  parentId?: string | null;
  parent?: { id: string; name: string } | null;
  subProducts?: Product[];
};

type Props = {
  initialProducts: Product[];
};

export function ProductsPanel({ initialProducts }: Props) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    category: '',
    isActive: true,
    parentId: '',
  });

  const resetForm = () => {
    setForm({ name: '', description: '', category: '', isActive: true, parentId: '' });
    setIsCreating(false);
    setEditingId(null);
  };

  const startEdit = (p: Product) => {
    setEditingId(p.id);
    setIsCreating(false);
    setForm({
      name: p.name,
      description: p.description || '',
      category: p.category || '',
      isActive: p.isActive,
      parentId: p.parentId || '',
    });
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setLoading(true);
    try {
      if (editingId) {
        const res = await fetch(`/api/products/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (data.success) {
          setProducts(prev => prev.map(p => p.id === editingId ? data.product : p));
          resetForm();
        }
      } else {
        const res = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, sortOrder: products.length }),
        });
        const data = await res.json();
        if (data.success) {
          setProducts(prev => [...prev, data.product]);
          resetForm();
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (p: Product) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/products/${p.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !p.isActive }),
      });
      const data = await res.json();
      if (data.success) {
        setProducts(prev => prev.map(x => x.id === p.id ? data.product : x));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Nonaktifkan produk ini? Produk yang sudah di-assign ke leads tetap tersimpan.')) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setProducts(prev => prev.map(p => p.id === id ? { ...p, isActive: false } : p));
      }
    } finally {
      setLoading(false);
    }
  };

  // Filter possible parent categories (active products that do not have a parent and are not the current edited product)
  const parentCandidates = products.filter(p => !p.parentId && p.id !== editingId && p.isActive);

  // Grouping products
  const rootProducts = products.filter(p => !p.parentId);
  const getSubProducts = (parentId: string) => products.filter(p => p.parentId === parentId);

  const renderProductItem = (product: Product, isChild = false) => {
    return (
      <div
        key={product.id}
        className={`card p-4 flex items-start gap-3 transition-all ${
          !product.isActive ? 'opacity-50' : ''
        } ${isChild ? 'ml-8 bg-muted/20 border-l-2 border-primary/20' : ''}`}
      >
        {isChild ? (
          <CornerDownRight className="w-4 h-4 text-muted-foreground/50 mt-0.5 shrink-0" />
        ) : (
          <GripVertical className="w-4 h-4 text-muted-foreground/40 mt-0.5 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-foreground">{product.name}</span>
            {product.category && (
              <span className="text-[11px] px-2 py-0.5 bg-primary/10 text-primary rounded font-medium">
                {product.category}
              </span>
            )}
            {product.isActive ? (
              <span className="text-[11px] px-2 py-0.5 bg-green-500/10 text-green-600 dark:text-green-400 rounded font-medium flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Aktif
              </span>
            ) : (
              <span className="text-[11px] px-2 py-0.5 bg-muted text-muted-foreground rounded font-medium flex items-center gap-1">
                <XCircle className="w-3 h-3" /> Nonaktif
              </span>
            )}
          </div>
          {product.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2 whitespace-pre-line">
              {product.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => handleToggleActive(product)}
            disabled={loading}
            title={product.isActive ? 'Nonaktifkan' : 'Aktifkan'}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            {product.isActive ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
          </button>
          <button
            onClick={() => startEdit(product)}
            disabled={loading}
            className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDelete(product.id)}
            disabled={loading}
            className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Produk & Layanan</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Kelola produk yang ditampilkan ke leads dan digunakan chatbot (mendukung sub-produk bertingkat)
          </p>
        </div>
        <button
          onClick={() => { setIsCreating(true); setEditingId(null); resetForm(); setIsCreating(true); }}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Tambah Produk / Sub-produk
        </button>
      </div>

      {/* Add/Edit Form */}
      {(isCreating || editingId) && (
        <div className="card p-5 border-2 border-primary/20 bg-primary/3">
          <h3 className="font-semibold text-sm text-foreground mb-4">
            {editingId ? '✏️ Edit Produk' : '➕ Produk Baru'}
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Nama Produk / Sub-produk <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Contoh: REZUM WATER VAPOR THERAPY atau Scaling Gigi"
                className="w-full input-field text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Kategori Parent (Opsional)</label>
              <select
                value={form.parentId}
                onChange={e => setForm(f => ({ ...f, parentId: e.target.value }))}
                className="w-full input-field text-sm bg-background border border-border rounded-md px-3 py-2"
              >
                <option value="">-- Tanpa Parent (Jadikan Kategori Utama) --</option>
                {parentCandidates.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Kategori</label>
              <input
                type="text"
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                placeholder="Contoh: Urologi, Gigi, Kandungan"
                className="w-full input-field text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Deskripsi</label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Deskripsi produk / keunggulan layanan..."
                rows={4}
                className="w-full input-field text-sm resize-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={form.isActive}
                onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                className="w-4 h-4 rounded"
              />
              <label htmlFor="isActive" className="text-sm text-foreground">Aktif (tampil di chatbot)</label>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleSave}
              disabled={loading || !form.name.trim()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Menyimpan...' : 'Simpan'}
            </button>
            <button
              onClick={resetForm}
              className="px-4 py-2 bg-muted text-foreground rounded-lg text-sm font-medium hover:bg-secondary transition-colors"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* Products List */}
      {products.length === 0 ? (
        <div className="card p-12 text-center">
          <PackageOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">Belum ada produk</p>
          <p className="text-sm text-muted-foreground mt-1">Tambahkan produk pertama Anda</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rootProducts.map((rootProduct) => {
            const subProducts = getSubProducts(rootProduct.id);
            return (
              <div key={rootProduct.id} className="space-y-1">
                {renderProductItem(rootProduct, false)}
                {subProducts.map((subProduct) => renderProductItem(subProduct, true))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

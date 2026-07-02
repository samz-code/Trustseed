import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { Tables, InsertTables } from '../lib/supabase';
import {
  Plus,
  Search,
  PiggyBank,
  X,
  Loader2,
  RefreshCw,
  AlertCircle,
  Pencil,
  Ban,
  CheckCircle,
  Percent,
  Lock,
  Calendar,
} from 'lucide-react';

type SavingsProduct = Tables<'savings_products'>;
type Compounding = SavingsProduct['interest_compounding'];

interface ProductForm {
  name: string;
  code: string;
  description: string;
  interest_rate: string;
  interest_compounding: Compounding;
  min_balance: string;
  min_opening_balance: string;
  max_balance: string;
  max_withdrawal_per_month: string;
  withdrawal_fee: string;
  maintenance_fee: string;
  withdrawal_notice_days: string;
  is_fixed_deposit: boolean;
  term_months: string;
  early_withdrawal_penalty: string;
}

const EMPTY_FORM: ProductForm = {
  name: '',
  code: '',
  description: '',
  interest_rate: '',
  interest_compounding: 'monthly',
  min_balance: '0',
  min_opening_balance: '0',
  max_balance: '',
  max_withdrawal_per_month: '',
  withdrawal_fee: '0',
  maintenance_fee: '0',
  withdrawal_notice_days: '0',
  is_fixed_deposit: false,
  term_months: '',
  early_withdrawal_penalty: '0',
};

function formatMoney(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function SavingsProductsPage() {
  const { tenant } = useAuth();
  const [products, setProducts] = useState<SavingsProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<SavingsProduct | null>(null);
  const [formData, setFormData] = useState<ProductForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase
        .from('savings_products')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setProducts(data ?? []);
    } catch (err) {
      console.error('Error loading savings products:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load savings products');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [tenant]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      const matchesSearch =
        q === '' || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [products, searchQuery, statusFilter]);

  const validateForm = (): string | null => {
    if (!formData.name.trim()) return 'Product name is required.';
    if (!formData.code.trim()) return 'Product code is required.';
    if (!editingProduct) {
      const codeExists = products.some(
        (p) => p.code.trim().toLowerCase() === formData.code.trim().toLowerCase()
      );
      if (codeExists) return `Product code "${formData.code.trim()}" is already in use.`;
    }

    const rate = parseFloat(formData.interest_rate);
    if (formData.interest_rate === '' || Number.isNaN(rate) || rate < 0 || rate > 100) {
      return 'A valid interest rate between 0 and 100 is required.';
    }

    const minBalance = parseFloat(formData.min_balance) || 0;
    const minOpening = parseFloat(formData.min_opening_balance) || 0;
    const maxBalance = formData.max_balance ? parseFloat(formData.max_balance) : null;
    if (maxBalance !== null && maxBalance <= minBalance) {
      return 'Maximum balance must be greater than the minimum balance.';
    }
    if (minOpening < minBalance) {
      return 'Minimum opening balance cannot be less than the minimum balance.';
    }

    if (formData.is_fixed_deposit) {
      const term = formData.term_months ? parseInt(formData.term_months, 10) : NaN;
      if (!formData.term_months || Number.isNaN(term) || term < 1) {
        return 'Fixed deposit products require a valid term in months.';
      }
    }

    return null;
  };

  const openCreateForm = () => {
    setEditingProduct(null);
    setFormData(EMPTY_FORM);
    setFormError(null);
    setShowForm(true);
  };

  const openEditForm = (product: SavingsProduct) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      code: product.code,
      description: product.description ?? '',
      interest_rate: String(product.interest_rate),
      interest_compounding: product.interest_compounding,
      min_balance: String(product.min_balance),
      min_opening_balance: String(product.min_opening_balance),
      max_balance: product.max_balance !== null ? String(product.max_balance) : '',
      max_withdrawal_per_month:
        product.max_withdrawal_per_month !== null ? String(product.max_withdrawal_per_month) : '',
      withdrawal_fee: String(product.withdrawal_fee),
      maintenance_fee: String(product.maintenance_fee),
      withdrawal_notice_days: String(product.withdrawal_notice_days),
      is_fixed_deposit: product.is_fixed_deposit,
      term_months: product.term_months !== null ? String(product.term_months) : '',
      early_withdrawal_penalty: String(product.early_withdrawal_penalty),
    });
    setFormError(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingProduct(null);
    setFormData(EMPTY_FORM);
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!tenant) {
      setFormError('No institution context found. Please sign in again.');
      return;
    }

    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        interest_rate: parseFloat(formData.interest_rate),
        interest_compounding: formData.interest_compounding,
        min_balance: parseFloat(formData.min_balance) || 0,
        min_opening_balance: parseFloat(formData.min_opening_balance) || 0,
        max_balance: formData.max_balance ? parseFloat(formData.max_balance) : null,
        max_withdrawal_per_month: formData.max_withdrawal_per_month
          ? parseInt(formData.max_withdrawal_per_month, 10)
          : null,
        withdrawal_fee: parseFloat(formData.withdrawal_fee) || 0,
        maintenance_fee: parseFloat(formData.maintenance_fee) || 0,
        withdrawal_notice_days: parseInt(formData.withdrawal_notice_days, 10) || 0,
        is_fixed_deposit: formData.is_fixed_deposit,
        term_months: formData.is_fixed_deposit && formData.term_months ? parseInt(formData.term_months, 10) : null,
        early_withdrawal_penalty: parseFloat(formData.early_withdrawal_penalty) || 0,
      };

      if (editingProduct) {
        const { error } = await supabase
          .from('savings_products')
          .update(payload)
          .eq('id', editingProduct.id)
          .eq('tenant_id', tenant.id);
        if (error) throw error;
      } else {
        const insert: InsertTables<'savings_products'> = {
          tenant_id: tenant.id,
          code: formData.code.trim(),
          status: 'active',
          ...payload,
        };
        const { error } = await supabase.from('savings_products').insert(insert);
        if (error) {
          if ((error as { code?: string }).code === '23505') {
            throw new Error(`Product code "${formData.code.trim()}" is already in use.`);
          }
          throw error;
        }
      }

      await loadProducts();
      closeForm();
    } catch (err) {
      console.error('Error saving savings product:', err);
      setFormError(err instanceof Error ? err.message : 'Failed to save savings product');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (product: SavingsProduct) => {
    if (!tenant) return;
    setTogglingId(product.id);
    try {
      const { error } = await supabase
        .from('savings_products')
        .update({ status: product.status === 'active' ? 'inactive' : 'active' })
        .eq('id', product.id)
        .eq('tenant_id', tenant.id);
      if (error) throw error;
      await loadProducts();
    } catch (err) {
      console.error('Error toggling product status:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to update product status');
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#641f60]">Savings Products</h1>
          <p className="text-slate-600 mt-1">Configure the savings products your institution offers</p>
        </div>
        <button
          onClick={openCreateForm}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#ee7b22] hover:bg-[#c46040] text-white font-medium rounded-lg shadow-lg hover:shadow-xl transition-all"
        >
          <Plus className="w-5 h-5" />
          Add Product
        </button>
      </div>

      {loadError && (
        <div className="bg-[#c46040]/10 border border-[#c46040]/30 rounded-xl p-4 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-[#c46040]/15 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-6 h-6 text-[#c46040]" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-[#c46040]">Couldn&rsquo;t load savings products</h3>
            <p className="text-sm text-slate-600">{loadError}</p>
          </div>
          <button
            onClick={loadProducts}
            className="px-4 py-2 bg-[#ee7b22] hover:bg-[#c46040] text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or code..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#641f60]" />
          </div>
        ) : filteredProducts.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                className={`px-6 py-4 hover:bg-slate-50 transition-colors ${
                  product.status === 'inactive' ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#1ebcb2] to-[#159089] flex items-center justify-center text-white flex-shrink-0">
                    <PiggyBank className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-slate-900 truncate">{product.name}</h3>
                          {product.is_fixed_deposit && (
                            <span title="Fixed deposit">
                              <Lock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-500 font-mono">{product.code}</p>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize flex-shrink-0 ${
                          product.status === 'active'
                            ? 'bg-[#1ebcb2]/10 text-[#1ebcb2]'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {product.status}
                      </span>
                    </div>
                    {product.description && (
                      <p className="text-sm text-slate-600 mt-1">{product.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-slate-600">
                      <span className="flex items-center gap-1.5">
                        <Percent className="w-4 h-4 text-[#641f60]" />
                        {product.interest_rate}% ({product.interest_compounding})
                      </span>
                      <span className="text-slate-500">
                        Min balance: {formatMoney(product.min_balance)}
                      </span>
                      <span className="text-slate-500">
                        Min opening: {formatMoney(product.min_opening_balance)}
                      </span>
                      {product.is_fixed_deposit && product.term_months && (
                        <span className="flex items-center gap-1.5 text-[#ee7b22]">
                          <Calendar className="w-4 h-4" />
                          {product.term_months} month term
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => openEditForm(product)}
                      className="p-2 rounded-lg text-slate-400 hover:text-[#641f60] hover:bg-slate-100 transition-colors"
                      aria-label="Edit product"
                    >
                      <Pencil className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => toggleStatus(product)}
                      disabled={togglingId === product.id}
                      className="p-2 rounded-lg text-slate-400 hover:text-[#c46040] hover:bg-slate-100 transition-colors disabled:opacity-50"
                      aria-label={product.status === 'active' ? 'Deactivate product' : 'Activate product'}
                    >
                      {togglingId === product.id ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : product.status === 'active' ? (
                        <Ban className="w-5 h-5" />
                      ) : (
                        <CheckCircle className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <PiggyBank className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">No savings products found</h3>
            <p className="text-slate-500 text-center max-w-sm">
              {searchQuery || statusFilter !== 'all'
                ? 'No products match your search or filter.'
                : 'Create your first savings product to start opening accounts.'}
            </p>
            {!searchQuery && statusFilter === 'all' && (
              <button
                onClick={openCreateForm}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#ee7b22] hover:bg-[#c46040] text-white font-medium rounded-lg transition-colors"
              >
                <Plus className="w-5 h-5" />
                Add First Product
              </button>
            )}
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-[#641f60]">
                {editingProduct ? 'Edit Savings Product' : 'Add Savings Product'}
              </h2>
              <button
                onClick={closeForm}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Product Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                    placeholder="Regular Savings"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Product Code *</label>
                  <input
                    type="text"
                    required
                    disabled={!!editingProduct}
                    value={formData.code}
                    onChange={(e) => setFormData((prev) => ({ ...prev, code: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent disabled:bg-slate-50 disabled:text-slate-500"
                    placeholder="REG-SAV"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Interest Rate (% p.a.) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    required
                    value={formData.interest_rate}
                    onChange={(e) => setFormData((prev) => ({ ...prev, interest_rate: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Compounding</label>
                  <select
                    value={formData.interest_compounding}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, interest_compounding: e.target.value as Compounding }))
                    }
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="annually">Annually</option>
                  </select>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Min Balance</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.min_balance}
                    onChange={(e) => setFormData((prev) => ({ ...prev, min_balance: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Min Opening Balance</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.min_opening_balance}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, min_opening_balance: e.target.value }))
                    }
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Max Balance</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.max_balance}
                    onChange={(e) => setFormData((prev) => ({ ...prev, max_balance: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                    placeholder="No cap"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Max Withdrawals / Month
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.max_withdrawal_per_month}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, max_withdrawal_per_month: e.target.value }))
                    }
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                    placeholder="Unlimited"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Withdrawal Fee</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.withdrawal_fee}
                    onChange={(e) => setFormData((prev) => ({ ...prev, withdrawal_fee: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Maintenance Fee</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.maintenance_fee}
                    onChange={(e) => setFormData((prev) => ({ ...prev, maintenance_fee: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={formData.is_fixed_deposit}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, is_fixed_deposit: e.target.checked }))
                    }
                    className="rounded border-slate-300 text-[#1ebcb2] focus:ring-[#1ebcb2]"
                  />
                  This is a fixed deposit product (locked term)
                </label>
              </div>

              {formData.is_fixed_deposit && (
                <div className="grid md:grid-cols-2 gap-4 bg-slate-50 rounded-lg p-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Term (months) *</label>
                    <input
                      type="number"
                      min="1"
                      required={formData.is_fixed_deposit}
                      value={formData.term_months}
                      onChange={(e) => setFormData((prev) => ({ ...prev, term_months: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Early Withdrawal Penalty (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.early_withdrawal_penalty}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, early_withdrawal_penalty: e.target.value }))
                      }
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                    />
                  </div>
                </div>
              )}

              {formError && (
                <div className="p-3 bg-[#c46040]/10 border border-[#c46040]/30 rounded-lg text-[#c46040] text-sm">
                  {formError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={closeForm}
                  className="px-4 py-2.5 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 bg-[#ee7b22] hover:bg-[#c46040] text-white font-medium rounded-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Plus className="w-5 h-5" />
                      {editingProduct ? 'Save Changes' : 'Create Product'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { Tables, InsertTables } from '../lib/supabase';
import {
  Plus,
  Search,
  Landmark,
  X,
  Loader2,
  RefreshCw,
  AlertCircle,
  Pencil,
  Ban,
  CheckCircle,
  Percent,
  Calendar,
  Shield,
} from 'lucide-react';

type LoanProduct = Tables<'loan_products'>;
type InterestType = LoanProduct['interest_type'];

interface ProductForm {
  name: string;
  code: string;
  description: string;
  min_amount: string;
  max_amount: string;
  interest_type: InterestType;
  default_interest_rate: string;
  min_term_months: string;
  max_term_months: string;
  grace_period_days: string;
  penalty_rate: string;
  late_fee: string;
  requires_collateral: boolean;
}

const EMPTY_FORM: ProductForm = {
  name: '',
  code: '',
  description: '',
  min_amount: '',
  max_amount: '',
  interest_type: 'reducing_balance',
  default_interest_rate: '',
  min_term_months: '1',
  max_term_months: '',
  grace_period_days: '0',
  penalty_rate: '0',
  late_fee: '0',
  requires_collateral: false,
};

function formatMoney(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function LoanProductsPage() {
  const { tenant } = useAuth();
  const [products, setProducts] = useState<LoanProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<LoanProduct | null>(null);
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
        .from('loan_products')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setProducts(data ?? []);
    } catch (err) {
      console.error('Error loading loan products:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load loan products');
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

    const minAmount = parseFloat(formData.min_amount);
    const maxAmount = formData.max_amount ? parseFloat(formData.max_amount) : null;
    if (!formData.min_amount || Number.isNaN(minAmount) || minAmount < 0) {
      return 'A valid minimum amount is required.';
    }
    if (maxAmount !== null && (Number.isNaN(maxAmount) || maxAmount <= minAmount)) {
      return 'Maximum amount must be greater than the minimum amount.';
    }

    const rate = parseFloat(formData.default_interest_rate);
    if (!formData.default_interest_rate || Number.isNaN(rate) || rate < 0 || rate > 100) {
      return 'A valid interest rate between 0 and 100 is required.';
    }

    const minTerm = parseInt(formData.min_term_months, 10);
    const maxTerm = formData.max_term_months ? parseInt(formData.max_term_months, 10) : null;
    if (!formData.min_term_months || Number.isNaN(minTerm) || minTerm < 1) {
      return 'A valid minimum term (in months) is required.';
    }
    if (maxTerm !== null && (Number.isNaN(maxTerm) || maxTerm < minTerm)) {
      return 'Maximum term must be at least the minimum term.';
    }

    return null;
  };

  const openCreateForm = () => {
    setEditingProduct(null);
    setFormData(EMPTY_FORM);
    setFormError(null);
    setShowForm(true);
  };

  const openEditForm = (product: LoanProduct) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      code: product.code,
      description: product.description ?? '',
      min_amount: String(product.min_amount),
      max_amount: product.max_amount !== null ? String(product.max_amount) : '',
      interest_type: product.interest_type,
      default_interest_rate: String(product.default_interest_rate),
      min_term_months: String(product.min_term_months),
      max_term_months: product.max_term_months !== null ? String(product.max_term_months) : '',
      grace_period_days: String(product.grace_period_days),
      penalty_rate: String(product.penalty_rate),
      late_fee: String(product.late_fee),
      requires_collateral: product.requires_collateral,
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
      const minAmount = parseFloat(formData.min_amount);
      const maxAmount = formData.max_amount ? parseFloat(formData.max_amount) : null;
      const rate = parseFloat(formData.default_interest_rate);
      const minTerm = parseInt(formData.min_term_months, 10);
      const maxTerm = formData.max_term_months ? parseInt(formData.max_term_months, 10) : null;
      const graceDays = parseInt(formData.grace_period_days, 10) || 0;
      const penaltyRate = parseFloat(formData.penalty_rate) || 0;
      const lateFee = parseFloat(formData.late_fee) || 0;

      if (editingProduct) {
        const { error } = await supabase
          .from('loan_products')
          .update({
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            min_amount: minAmount,
            max_amount: maxAmount,
            interest_type: formData.interest_type,
            default_interest_rate: rate,
            min_term_months: minTerm,
            max_term_months: maxTerm,
            grace_period_days: graceDays,
            penalty_rate: penaltyRate,
            late_fee: lateFee,
            requires_collateral: formData.requires_collateral,
          })
          .eq('id', editingProduct.id)
          .eq('tenant_id', tenant.id);

        if (error) throw error;
      } else {
        const insert: InsertTables<'loan_products'> = {
          tenant_id: tenant.id,
          name: formData.name.trim(),
          code: formData.code.trim(),
          description: formData.description.trim() || null,
          min_amount: minAmount,
          max_amount: maxAmount,
          interest_type: formData.interest_type,
          default_interest_rate: rate,
          min_term_months: minTerm,
          max_term_months: maxTerm,
          grace_period_days: graceDays,
          penalty_rate: penaltyRate,
          late_fee: lateFee,
          requires_collateral: formData.requires_collateral,
          status: 'active',
        };

        const { error } = await supabase.from('loan_products').insert(insert);
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
      console.error('Error saving loan product:', err);
      setFormError(err instanceof Error ? err.message : 'Failed to save loan product');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (product: LoanProduct) => {
    if (!tenant) return;
    setTogglingId(product.id);
    try {
      const { error } = await supabase
        .from('loan_products')
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#641f60]">Loan Products</h1>
          <p className="text-slate-600 mt-1">Configure the loan products your institution offers</p>
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
            <h3 className="font-semibold text-[#c46040]">Couldn&rsquo;t load loan products</h3>
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

      {/* Filters */}
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

      {/* Product list */}
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
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#641f60] to-[#4a1646] flex items-center justify-center text-white flex-shrink-0">
                    <Landmark className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-slate-900 truncate">{product.name}</h3>
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
                        {product.default_interest_rate}% ({product.interest_type.replace('_', ' ')})
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-[#1ebcb2]" />
                        {product.min_term_months}
                        {product.max_term_months ? `–${product.max_term_months}` : '+'} months
                      </span>
                      <span className="text-slate-500">
                        {formatMoney(product.min_amount)}
                        {product.max_amount ? ` – ${formatMoney(product.max_amount)}` : '+'}
                      </span>
                      {product.requires_collateral && (
                        <span className="flex items-center gap-1.5 text-[#ee7b22]">
                          <Shield className="w-4 h-4" />
                          Collateral required
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
              <Landmark className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">No loan products found</h3>
            <p className="text-slate-500 text-center max-w-sm">
              {searchQuery || statusFilter !== 'all'
                ? 'No products match your search or filter.'
                : 'Create your first loan product to start accepting applications.'}
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

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-[#641f60]">
                {editingProduct ? 'Edit Loan Product' : 'Add Loan Product'}
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
                    placeholder="Business Loan"
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
                    placeholder="BIZ-LOAN"
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
                  placeholder="Short description of this loan product"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Minimum Amount *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formData.min_amount}
                    onChange={(e) => setFormData((prev) => ({ ...prev, min_amount: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                    placeholder="1000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Maximum Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.max_amount}
                    onChange={(e) => setFormData((prev) => ({ ...prev, max_amount: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                    placeholder="Leave blank for no cap"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Interest Type</label>
                  <select
                    value={formData.interest_type}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, interest_type: e.target.value as InterestType }))
                    }
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                  >
                    <option value="reducing_balance">Reducing Balance</option>
                    <option value="flat">Flat</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Default Interest Rate (% p.a.) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    required
                    value={formData.default_interest_rate}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, default_interest_rate: e.target.value }))
                    }
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                    placeholder="15"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Minimum Term (months) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.min_term_months}
                    onChange={(e) => setFormData((prev) => ({ ...prev, min_term_months: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Maximum Term (months)</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.max_term_months}
                    onChange={(e) => setFormData((prev) => ({ ...prev, max_term_months: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                    placeholder="Leave blank for no cap"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Grace Period (days)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.grace_period_days}
                    onChange={(e) => setFormData((prev) => ({ ...prev, grace_period_days: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Penalty Rate (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.penalty_rate}
                    onChange={(e) => setFormData((prev) => ({ ...prev, penalty_rate: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Late Fee</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.late_fee}
                    onChange={(e) => setFormData((prev) => ({ ...prev, late_fee: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={formData.requires_collateral}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, requires_collateral: e.target.checked }))
                  }
                  className="rounded border-slate-300 text-[#1ebcb2] focus:ring-[#1ebcb2]"
                />
                Requires collateral
              </label>

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
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { LoanProduct, LoanApplication, LoanAccount, Customer } from '../types';
import {
  Plus,
  Search,
  Banknote,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  DollarSign,
  Calendar,
  TrendingUp,
  AlertCircle,
  Eye,
  FileText,
} from 'lucide-react';

interface LoansPageProps {
  tab?: 'products' | 'applications' | 'active' | 'repayments';
}

export function LoansPage({ tab = 'products' }: LoansPageProps) {
  const { tenant, branch, admin } = useAuth();
  const [activeTab, setActiveTab] = useState(tab);
  const [products, setProducts] = useState<LoanProduct[]>([]);
  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [loans, setLoans] = useState<LoanAccount[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showProductForm, setShowProductForm] = useState(false);
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (tenant) {
      loadData();
    }
  }, [tenant, branch]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [productsRes, appsRes, loansRes, customersRes] = await Promise.all([
        supabase.from('loan_products').select('*').eq('tenant_id', tenant!.id),
        supabase.from('loan_applications').select('*, customer:customers(*), product:loan_products(*)').eq('tenant_id', tenant!.id).order('created_at', { ascending: false }),
        supabase.from('loan_accounts').select('*, customer:customers(*), product:loan_products(*)').eq('tenant_id', tenant!.id),
        supabase.from('customers').select('*').eq('tenant_id', tenant!.id).eq('status', 'active'),
      ]);

      if (productsRes.data) setProducts(productsRes.data as LoanProduct[]);
      if (appsRes.data) setApplications(appsRes.data as LoanApplication[]);
      if (loansRes.data) setLoans(loansRes.data as LoanAccount[]);
      if (customersRes.data) setCustomers(customersRes.data as Customer[]);
    } catch (err) {
      console.error('Error loading loans data:', err);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'products', label: 'Loan Products', icon: <Banknote className="w-4 h-4" /> },
    { id: 'applications', label: 'Applications', icon: <FileText className="w-4 h-4" /> },
    { id: 'active', label: 'Active Loans', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'repayments', label: 'Repayments', icon: <DollarSign className="w-4 h-4" /> },
  ];

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; text: string }> = {
      active: { bg: 'bg-green-100', text: 'text-green-700' },
      pending: { bg: 'bg-amber-100', text: 'text-amber-700' },
      approved: { bg: 'bg-blue-100', text: 'text-blue-700' },
      rejected: { bg: 'bg-red-100', text: 'text-red-700' },
      completed: { bg: 'bg-slate-100', text: 'text-slate-700' },
      draft: { bg: 'bg-slate-100', text: 'text-slate-500' },
    };
    const style = styles[status] || styles.pending;
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#641f60]">Loans Management</h1>
          <p className="text-slate-600 mt-1">Manage loan products, applications, and repayments</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowProductForm(true)}
            className="px-4 py-2 border border-[#1ebcb2] text-[#1ebcb2] rounded-lg hover:bg-[#1ebcb2]/10 transition-all"
          >
            <Plus className="w-4 h-4 inline mr-2" />
            Product
          </button>
          <button
            onClick={() => setShowApplicationForm(true)}
            className="px-4 py-2.5 bg-gradient-to-r from-[#ee7b22] to-[#c46040] text-white font-medium rounded-lg shadow-lg hover:shadow-xl transition-all"
          >
            <Plus className="w-5 h-5 inline mr-2" />
            New Application
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-[#dae1e1] p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-[#ee7b22]/10">
              <Banknote className="w-6 h-6 text-[#ee7b22]" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Products</p>
              <p className="text-2xl font-bold text-slate-900">{products.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-[#dae1e1] p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-[#1ebcb2]/10">
              <Clock className="w-6 h-6 text-[#1ebcb2]" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Pending</p>
              <p className="text-2xl font-bold text-slate-900">{applications.filter(a => a.status === 'pending' || a.status === 'submitted' || a.status === 'under_review').length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-[#dae1e1] p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-[#641f60]/10">
              <TrendingUp className="w-6 h-6 text-[#641f60]" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Active Loans</p>
              <p className="text-2xl font-bold text-slate-900">{loans.filter(l => l.status === 'active').length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-[#dae1e1] p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-green-100">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Total Outstanding</p>
              <p className="text-2xl font-bold text-slate-900">
                ${loans.reduce((sum, l) => sum + (l.total_outstanding || 0), 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-[#dae1e1] p-2">
        <div className="flex gap-2 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-[#ee7b22] to-[#c46040] text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl border border-[#dae1e1] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#1ebcb2]" />
          </div>
        ) : (
          <>
            {activeTab === 'products' && (
              <div className="divide-y divide-[#dae1e1]">
                {products.length > 0 ? products.map(product => (
                  <div key={product.id} className="p-6 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-slate-900">{product.name}</h3>
                        <p className="text-sm text-slate-500">{product.code}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-[#ee7b22]">{product.default_interest_rate}% p.a.</p>
                        <p className="text-sm text-slate-500">Up to ${product.max_amount?.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="py-12 text-center">
                    <Banknote className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500">No loan products yet</p>
                    <button
                      onClick={() => setShowProductForm(true)}
                      className="mt-4 px-4 py-2 bg-[#ee7b22] text-white rounded-lg"
                    >
                      Create First Product
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'applications' && (
              <div className="divide-y divide-[#dae1e1]">
                {applications.length > 0 ? applications.map(app => (
                  <div key={app.id} className="p-6 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-[#1ebcb2]/10 flex items-center justify-center">
                          <FileText className="w-6 h-6 text-[#1ebcb2]" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-900">
                            {(app as any).customer?.first_name} {(app as any).customer?.last_name}
                          </h3>
                          <p className="text-sm text-slate-500">{app.application_number}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {getStatusBadge(app.status)}
                        <div className="text-right">
                          <p className="text-lg font-bold text-slate-900">${app.requested_amount?.toLocaleString()}</p>
                          <p className="text-sm text-slate-500">{app.term_months} months</p>
                        </div>
                        <button className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                          <Eye className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="py-12 text-center">
                    <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500">No applications yet</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'active' && (
              <div className="divide-y divide-[#dae1e1]">
                {loans.filter(l => l.status === 'active').length > 0 ? loans.filter(l => l.status === 'active').map(loan => (
                  <div key={loan.id} className="p-6 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-[#641f60]/10 flex items-center justify-center">
                          <TrendingUp className="w-6 h-6 text-[#641f60]" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-900">
                            {(loan as any).customer?.first_name} {(loan as any).customer?.last_name}
                          </h3>
                          <p className="text-sm text-slate-500">{loan.loan_number}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-lg font-bold text-[#ee7b22]">${loan.total_outstanding?.toLocaleString()}</p>
                          <p className="text-sm text-slate-500">Outstanding</p>
                        </div>
                        <button className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                          <Eye className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="py-12 text-center">
                    <TrendingUp className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500">No active loans</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'repayments' && (
              <div className="py-12 text-center">
                <DollarSign className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">Repayment tracking coming soon</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Product Form Modal */}
      {showProductForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
            <div className="p-6 border-b border-[#dae1e1]">
              <h2 className="text-xl font-bold text-[#641f60]">Create Loan Product</h2>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              setSubmitting(true);
              // Implementation would go here
              setSubmitting(false);
              setShowProductForm(false);
              loadData();
            }} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Product Name</label>
                <input type="text" className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2]" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Min Amount</label>
                  <input type="number" className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Max Amount</label>
                  <input type="number" className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Interest Rate (%)</label>
                  <input type="number" step="0.1" className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Max Term (months)</label>
                  <input type="number" className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2]" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowProductForm(false)} className="px-4 py-2 border border-slate-300 rounded-lg">Cancel</button>
                <button type="submit" disabled={submitting} className="px-6 py-2 bg-gradient-to-r from-[#ee7b22] to-[#c46040] text-white rounded-lg">
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Application Form Modal */}
      {showApplicationForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-[#dae1e1]">
              <h2 className="text-xl font-bold text-[#641f60]">New Loan Application</h2>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              setSubmitting(false);
              setShowApplicationForm(false);
              loadData();
            }} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Customer *</label>
                  <select className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2]">
                    <option value="">Select customer</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Product</label>
                  <select className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2]">
                    <option value="">Select product</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Amount *</label>
                  <input type="number" required className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Term (months) *</label>
                  <input type="number" required className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2]" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Purpose</label>
                <textarea rows={2} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2]" />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowApplicationForm(false)} className="px-4 py-2 border border-slate-300 rounded-lg">Cancel</button>
                <button type="submit" disabled={submitting} className="px-6 py-2 bg-gradient-to-r from-[#ee7b22] to-[#c46040] text-white rounded-lg">
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Submit Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

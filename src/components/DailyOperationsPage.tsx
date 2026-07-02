import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { DailyOperation } from '../types';
import {
  Sun,
  Moon,
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Loader2,
  Banknote,
  Smartphone,
  Building,
  Shield,
  DollarSign,
  RefreshCcw
} from 'lucide-react';

interface DailyOperationsProps {
  mode: 'opening' | 'closing';
}

interface FloatAccount {
  float_type: string;
  balance: number;
}

export function DailyOperationsPage({ mode }: DailyOperationsProps) {
  const { tenant, branch, admin } = useAuth();
  const [todayOperation, setTodayOperation] = useState<DailyOperation | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [balances, setBalances] = useState<Record<string, number>>({
    cash: 0,
    usd: 0,
    kes: 0,
    ssp: 0,
    mtn_momo: 0,
    mpesa: 0,
    bank: 0,
    safe: 0,
    vault: 0,
  });

  const isOpening = mode === 'opening';
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (tenant && branch) {
      loadData();
    }
  }, [tenant, branch, mode]);

  const loadData = async () => {
    try {
      const [opsRes, floatRes] = await Promise.all([
        supabase
          .from('daily_operations')
          .select('*')
          .eq('tenant_id', tenant!.id)
          .eq('branch_id', branch!.id)
          .eq('operation_date', today)
          .maybeSingle(),
        supabase
          .from('float_accounts')
          .select('*')
          .eq('tenant_id', tenant!.id)
          .eq('branch_id', branch!.id)
          .eq('status', 'active'),
      ]);

      if (opsRes.error) throw opsRes.error;
      if (floatRes.error) throw floatRes.error;

      const operation = opsRes.data as DailyOperation | null;
      setTodayOperation(operation);

      if (operation?.opening_balances && typeof operation.opening_balances === 'object') {
        setBalances(prev => ({
          ...prev,
          ...(operation.opening_balances as Record<string, number>),
        }));
      } else if (floatRes.data && floatRes.data.length > 0) {
        const initialBalances: Record<string, number> = {};
        (floatRes.data as FloatAccount[]).forEach(f => {
          if (f.float_type && f.balance !== undefined) {
            initialBalances[f.float_type] = f.balance;
          }
        });
        setBalances(prev => ({ ...prev, ...initialBalances }));
      }
    } catch (err) {
      console.error('Error loading daily operations:', err);
      setError('Failed to load daily operations data');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (!tenant || !branch || !admin) {
        throw new Error('Missing required data');
      }

      if (isOpening) {
        if (todayOperation) {
          const { error: updateError } = await supabase
            .from('daily_operations')
            .update({
              state: 'active',
              opening_balances: balances,
              opened_by: admin.id,
              opened_at: new Date().toISOString(),
              approval_status: 'approved',
              approved_by: admin.id,
              approved_at: new Date().toISOString(),
            } as any)
            .eq('id', todayOperation.id);

          if (updateError) throw updateError;
        } else {
          const { error: insertError } = await supabase.from('daily_operations').insert({
            tenant_id: tenant.id,
            branch_id: branch.id,
            operation_date: today,
            state: 'active',
            opening_balances: balances,
            opened_by: admin.id,
            opened_at: new Date().toISOString(),
            approval_status: 'approved',
            approved_by: admin.id,
            approved_at: new Date().toISOString(),
          } as any);

          if (insertError) throw insertError;
        }
      } else {
        if (!todayOperation) throw new Error('No daily operation found');

        const { error: updateError } = await supabase
          .from('daily_operations')
          .update({
            state: 'closed',
            closing_balances: balances,
            closed_by: admin.id,
            closed_at: new Date().toISOString(),
          })
          .eq('id', todayOperation.id);

        if (updateError) throw updateError;
      }

      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process operation');
    } finally {
      setSubmitting(false);
    }
  };

  const updateBalance = (key: string, value: number) => {
    setBalances(prev => ({ ...prev, [key]: value }));
  };

  const getFloatIcon = (type: string) => {
    const icons: Record<string, React.ReactNode> = {
      cash: <Banknote className="w-5 h-5" />,
      usd: <DollarSign className="w-5 h-5" />,
      kes: <DollarSign className="w-5 h-5" />,
      ssp: <DollarSign className="w-5 h-5" />,
      mtn_momo: <Smartphone className="w-5 h-5" />,
      mpesa: <Smartphone className="w-5 h-5" />,
      bank: <Building className="w-5 h-5" />,
      safe: <Shield className="w-5 h-5" />,
      vault: <Shield className="w-5 h-5" />,
    };
    return icons[type] || <Banknote className="w-5 h-5" />;
  };

  const floatTypes = [
    { key: 'cash', label: 'Cash in Drawer', currency: tenant?.settings?.default_currency || 'USD' },
    { key: 'usd', label: 'USD Float', currency: 'USD' },
    { key: 'kes', label: 'KES Float', currency: 'KES' },
    { key: 'ssp', label: 'SSP Float', currency: 'SSP' },
    { key: 'mtn_momo', label: 'MTN Mobile Money', currency: 'USD' },
    { key: 'mpesa', label: 'M-Pesa', currency: 'KES' },
    { key: 'bank', label: 'Bank Balance', currency: 'USD' },
    { key: 'safe', label: 'Safe Balance', currency: 'USD' },
    { key: 'vault', label: 'Vault Balance', currency: 'USD' },
  ];

  const totalBalance = Object.values(balances).reduce((sum, val) => sum + (val || 0), 0);

  if (!branch) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900">No Branch Selected</h2>
          <p className="text-slate-600 mt-1">Please select a branch to manage daily operations.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div
          className={`p-4 rounded-xl ${
            isOpening ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 'bg-gradient-to-r from-indigo-500 to-purple-500'
          } text-white`}
        >
          {isOpening ? <Sun className="w-8 h-8" /> : <Moon className="w-8 h-8" />}
        </div>
        <div className="flex-1 ml-4">
          <h1 className="text-2xl font-bold text-slate-900">
            Daily {isOpening ? 'Opening' : 'Closing'}
          </h1>
          <p className="text-slate-600 mt-1">
            {branch.name} - {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="text-right">
          <div
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${
              todayOperation?.state === 'active'
                ? 'bg-green-100 text-green-700'
                : todayOperation?.state === 'closed'
                ? 'bg-slate-100 text-slate-700'
                : 'bg-amber-100 text-amber-700'
            }`}
          >
            <Clock className="w-4 h-4" />
            {todayOperation?.state === 'active'
              ? 'Operations Active'
              : todayOperation?.state === 'closed'
              ? 'Day Closed'
              : 'Pending Opening'}
          </div>
        </div>
      </div>

      {/* Status Banner */}
      {todayOperation && isOpening && todayOperation.state !== 'pending_opening' && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-4">
          <CheckCircle className="w-8 h-8 text-green-600 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-green-900">Day Already Opened</h3>
            <p className="text-sm text-green-700">
              Operations are active. Opened at{' '}
              {new Date(todayOperation.opened_at || '').toLocaleTimeString()}
            </p>
          </div>
        </div>
      )}

      {todayOperation && !isOpening && todayOperation.state === 'closed' && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center gap-4">
          <CheckCircle className="w-8 h-8 text-slate-600 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-slate-900">Day Already Closed</h3>
            <p className="text-sm text-slate-700">
              Closed at {new Date(todayOperation.closed_at || '').toLocaleTimeString()}
            </p>
          </div>
        </div>
      )}

      {/* Balance Form */}
      <form onSubmit={handleSubmit}>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="font-semibold text-slate-900">
              {isOpening ? 'Enter Opening Balances' : 'Enter Closing Balances'}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Verify and record the {isOpening ? 'starting' : 'ending'} balances for all float types
            </p>
          </div>

          <div className="p-6">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {floatTypes.map(float => (
                <div
                  key={float.key}
                  className="p-4 border border-slate-200 rounded-lg hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-lg bg-slate-100 text-slate-600">
                      {getFloatIcon(float.key)}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{float.label}</p>
                      <p className="text-xs text-slate-500">{float.currency}</p>
                    </div>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
                      {float.currency === 'USD' ? '$' : float.currency === 'KES' ? 'KES ' : float.currency === 'SSP' ? 'SSP ' : '$'}
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={balances[float.key] || 0}
                      onChange={e => updateBalance(float.key, parseFloat(e.target.value) || 0)}
                      disabled={submitting}
                      className="w-full pl-12 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:bg-slate-50"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="mt-6 p-4 bg-slate-50 rounded-lg flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Estimated Value (USD equivalent)</p>
                <p className="text-xs text-slate-400">For display purposes only</p>
              </div>
              <p className="text-2xl font-bold text-slate-900">
                ${totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {error && (
            <div className="px-6 pb-4">
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                {error}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <p className="text-sm text-slate-600">
              By submitting, you confirm these balances are accurate and verified.
            </p>
            <button
              type="submit"
              disabled={submitting || (todayOperation?.state === 'active' && isOpening) || (!todayOperation && !isOpening)}
              className={`px-6 py-2.5 font-medium rounded-lg shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all ${
                isOpening
                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {isOpening ? 'Open Day' : 'Close Day'}
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Previous Day Reference */}
      {isOpening && !todayOperation && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
          <RefreshCcw className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <p className="font-medium text-blue-900">Previous Day's Closing</p>
            <p className="text-sm text-blue-700">
              If this is not your first day, verify that opening balances match yesterday's closing balances.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

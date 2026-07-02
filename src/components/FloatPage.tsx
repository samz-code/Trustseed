import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { FloatAccount } from '../types';
import {
  Receipt,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Loader2,
  RefreshCcw,
  Building,
} from 'lucide-react';

export function FloatPage() {
  const { tenant, branch } = useAuth();
  const [floatAccounts, setFloatAccounts] = useState<FloatAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tenant && branch) {
      loadData();
    }
  }, [tenant, branch]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('float_accounts')
        .select('*')
        .eq('tenant_id', tenant!.id)
        .eq('branch_id', branch!.id);

      if (error) throw error;
      setFloatAccounts((data || []) as FloatAccount[]);
    } catch (err) {
      console.error('Error loading float accounts:', err);
    } finally {
      setLoading(false);
    }
  };

  const totalBalance = floatAccounts.reduce((sum, f) => sum + (f.balance || 0), 0);

  const getFloatIcon = (type: string) => {
    const icons: Record<string, string> = {
      cash: '💵',
      usd: '💵',
      kes: '💵',
      ssp: '💵',
      mtn_momo: '📱',
      mpesa: '📱',
      bank: '🏦',
      safe: '🔒',
      vault: '🏛️',
    };
    return icons[type] || '💰';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#641f60]">Float Management</h1>
          <p className="text-slate-600 mt-1">Track and manage your branch float positions</p>
        </div>
        <button
          onClick={loadData}
          className="px-4 py-2 border border-[#dae1e1] rounded-lg hover:bg-slate-50 transition-all flex items-center gap-2"
        >
          <RefreshCcw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-[#dae1e1] p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-[#ee7b22]/10">
              <DollarSign className="w-6 h-6 text-[#ee7b22]" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Total Float</p>
              <p className="text-2xl font-bold text-slate-900">${totalBalance.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-[#dae1e1] p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-[#1ebcb2]/10">
              <TrendingUp className="w-6 h-6 text-[#1ebcb2]" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Active Accounts</p>
              <p className="text-2xl font-bold text-slate-900">{floatAccounts.filter(f => f.status === 'active').length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-[#dae1e1] p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-[#c46040]/10">
              <AlertCircle className="w-6 h-6 text-[#c46040]" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Low Alerts</p>
              <p className="text-2xl font-bold text-slate-900">
                {floatAccounts.filter(f => f.balance < (f.min_threshold || 0)).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Float Accounts */}
      <div className="bg-white rounded-xl border border-[#dae1e1] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#1ebcb2]" />
          </div>
        ) : floatAccounts.length > 0 ? (
          <div className="divide-y divide-[#dae1e1]">
            {floatAccounts.map(account => (
              <div key={account.id} className="p-6 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#ee7b22] to-[#c46040] flex items-center justify-center text-white text-2xl">
                    {getFloatIcon(account.float_type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-slate-900 capitalize">{account.float_type.replace('_', ' ')}</h3>
                        <p className="text-sm text-slate-500">{account.currency}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-slate-900">${account.balance?.toLocaleString()}</p>
                        {account.balance < (account.min_threshold || 0) && (
                          <p className="text-xs text-[#c46040] flex items-center justify-end gap-1">
                            <AlertCircle className="w-3 h-3" /> Below minimum
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-4 text-sm text-slate-600">
                      <span>Min: ${account.min_threshold?.toLocaleString()}</span>
                      {account.max_threshold && <span>Max: ${account.max_threshold?.toLocaleString()}</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center">
            <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No float accounts configured</p>
            <p className="text-sm text-slate-400">Complete daily opening to initialize float accounts</p>
          </div>
        )}
      </div>
    </div>
  );
}

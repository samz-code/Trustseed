import { supabase } from './supabase';

export interface ReportFilters {
  tenantId: string;
  branchId?: string;
  startDate: string;
  endDate: string;
  transactionTypes?: string[];
  currencies?: string[];
}

export interface TransactionReport {
  transactions: any[];
  summary: {
    totalTransactions: number;
    totalAmount: number;
    byType: Record<string, number>;
    byCurrency: Record<string, number>;
    totalDeposits: number;
    totalWithdrawals: number;
    netCashflow: number;
  };
  dailySummary: Array<{
    date: string;
    deposits: number;
    withdrawals: number;
    count: number;
  }>;
}

export class ReportService {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  async generateTransactionReport(filters: ReportFilters): Promise<TransactionReport> {
    let query = supabase
      .from('transactions')
      .select(`
        *,
        from_customer:from_customer_id(id, first_name, last_name, business_name),
        to_customer:to_customer_id(id, first_name, last_name, business_name),
        branch:branch_id(id, name, code)
      `)
      .eq('tenant_id', this.tenantId)
      .gte('created_at', filters.startDate)
      .lte('created_at', filters.endDate)
      .in('status', ['completed', 'approved', 'processing']);

    if (filters.branchId) {
      query = query.eq('branch_id', filters.branchId);
    }

    if (filters.transactionTypes && filters.transactionTypes.length > 0) {
      query = query.in('transaction_type', filters.transactionTypes);
    }

    if (filters.currencies && filters.currencies.length > 0) {
      query = query.in('currency', filters.currencies);
    }

    const { data: transactions, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    // Generate summary
    const summary = this.generateSummary(transactions);
    const dailySummary = this.generateDailySummary(transactions);

    return {
      transactions,
      summary,
      dailySummary,
    };
  }

  private generateSummary(transactions: any[]) {
    const byType: Record<string, number> = {};
    const byCurrency: Record<string, number> = {};
    let totalAmount = 0;
    let totalDeposits = 0;
    let totalWithdrawals = 0;

    transactions.forEach(tx => {
      const amount = Number(tx.amount || 0);
      totalAmount += amount;

      // By type
      byType[tx.transaction_type] = (byType[tx.transaction_type] || 0) + 1;

      // By currency
      byCurrency[tx.currency] = (byCurrency[tx.currency] || 0) + amount;

      // Deposits vs withdrawals
      if (tx.transaction_type.includes('deposit')) {
        totalDeposits += amount;
      } else if (tx.transaction_type.includes('withdrawal')) {
        totalWithdrawals += amount;
      }
    });

    return {
      totalTransactions: transactions.length,
      totalAmount,
      byType,
      byCurrency,
      totalDeposits,
      totalWithdrawals,
      netCashflow: totalDeposits - totalWithdrawals,
    };
  }

  private generateDailySummary(transactions: any[]) {
    const dailyMap = new Map<string, { deposits: number; withdrawals: number; count: number }>();

    transactions.forEach(tx => {
      const date = new Date(tx.created_at).toISOString().split('T')[0];
      const amount = Number(tx.amount || 0);

      if (!dailyMap.has(date)) {
        dailyMap.set(date, { deposits: 0, withdrawals: 0, count: 0 });
      }

      const day = dailyMap.get(date)!;
      day.count++;

      if (tx.transaction_type.includes('deposit')) {
        day.deposits += amount;
      } else if (tx.transaction_type.includes('withdrawal')) {
        day.withdrawals += amount;
      }
    });

    return Array.from(dailyMap.entries())
      .map(([date, data]) => ({
        date,
        ...data,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async getGeneralLedger(startDate: string, endDate: string) {
    const { data, error } = await supabase
      .from('journal_lines')
      .select(`
        *,
        journal_entry:journal_entry_id(
          id,
          entry_date,
          description,
          reference,
          transaction:transaction_id(
            transaction_type,
            created_at
          )
        )
      `)
      .eq('tenant_id', this.tenantId)
      .gte('journal_entry.entry_date', startDate)
      .lte('journal_entry.entry_date', endDate)
      .order('journal_entry.entry_date', { ascending: true });

    if (error) throw error;

    // Group by account
    const ledger: Record<string, {
      account_code: string;
      debit: number;
      credit: number;
      balance: number;
      transactions: any[];
    }> = {};

    data?.forEach(line => {
      if (!ledger[line.account_code]) {
        ledger[line.account_code] = {
          account_code: line.account_code,
          debit: 0,
          credit: 0,
          balance: 0,
          transactions: [],
        };
      }

      const entry = ledger[line.account_code];
      entry.debit += Number(line.debit || 0);
      entry.credit += Number(line.credit || 0);
      entry.balance = entry.debit - entry.credit;
      entry.transactions.push(line);
    });

    return ledger;
  }

  async getTrialBalance() {
    const { data, error } = await supabase
      .from('journal_lines')
      .select(`
        account_code,
        debit,
        credit
      `)
      .eq('tenant_id', this.tenantId);

    if (error) throw error;

    const summary: Record<string, { debit: number; credit: number; balance: number }> = {};

    data?.forEach(line => {
      if (!summary[line.account_code]) {
        summary[line.account_code] = { debit: 0, credit: 0, balance: 0 };
      }

      summary[line.account_code].debit += Number(line.debit || 0);
      summary[line.account_code].credit += Number(line.credit || 0);
      summary[line.account_code].balance = 
        summary[line.account_code].debit - summary[line.account_code].credit;
    });

    return summary;
  }
}
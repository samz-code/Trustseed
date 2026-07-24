import { supabase } from './supabase';

interface Transaction {
  id: string;
  tenant_id: string;
  transaction_type: string;
  amount: number;
  currency: string;
  status: string;
  from_customer_id?: string;
  to_customer_id?: string;
  description?: string;
  branch_id?: string;
  created_by?: string;
  created_at: string;
  reference?: string;
}

interface JournalEntry {
  id: string;
  tenant_id: string;
  transaction_id: string;
  entry_date: string;
  description: string;
  status: 'draft' | 'posted' | 'reversed';
  reference: string;
  created_at: string;
}

interface JournalLine {
  journal_entry_id: string;
  account_code: string;
  debit: number;
  credit: number;
  description?: string;
  tenant_id: string;
}

// Account codes mapping
const ACCOUNTS = {
  CASH_KES: '1010',
  CASH_USD: '1020',
  CASH_EUR: '1030',
  LOAN_RECEIVABLE: '1040',
  CUSTOMER_DEPOSITS: '2010',
  LOAN_INTEREST_INCOME: '3010',
  FEE_INCOME: '3020',
  SAVINGS_DEPOSITS: '2030',
  EXPENSE: '4010',
} as const;

export class TransactionPostingService {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  async postTransaction(transaction: Transaction): Promise<{ success: boolean; journalId?: string; error?: any }> {
    try {
      // Create journal entry
      const journalEntry = await this.createJournalEntry(transaction);
      
      // Create journal lines based on transaction type
      const lines = this.getJournalLines(transaction, journalEntry.id);
      
      // Save journal lines
      await this.saveJournalLines(lines);

      // Update transaction status to 'posted'
      await this.updateTransactionStatus(transaction.id);

      return { success: true, journalId: journalEntry.id };
    } catch (error) {
      console.error('Error posting transaction:', error);
      return { success: false, error };
    }
  }

  private async createJournalEntry(transaction: Transaction): Promise<JournalEntry> {
    const { data, error } = await supabase
      .from('journal_entries')
      .insert({
        tenant_id: this.tenantId,
        transaction_id: transaction.id,
        entry_date: transaction.created_at,
        description: `${this.formatTransactionType(transaction.transaction_type)} - ${transaction.description || transaction.id}`,
        status: 'posted',
        reference: transaction.reference || transaction.id,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  private getJournalLines(transaction: Transaction, journalEntryId: string): JournalLine[] {
    const lines: JournalLine[] = [];
    const amount = Number(transaction.amount);
    
    // Get cash account based on currency
    const cashAccount = this.getCashAccount(transaction.currency);

    switch (transaction.transaction_type) {
      case 'deposit':
      case 'savings_deposit':
        // Debit: Cash, Credit: Customer Deposits
        lines.push({
          journal_entry_id: journalEntryId,
          tenant_id: this.tenantId,
          account_code: cashAccount,
          debit: amount,
          credit: 0,
          description: `Cash received from ${transaction.from_customer_id || 'customer'}`,
        });
        lines.push({
          journal_entry_id: journalEntryId,
          tenant_id: this.tenantId,
          account_code: ACCOUNTS.CUSTOMER_DEPOSITS,
          debit: 0,
          credit: amount,
          description: `Deposit by ${transaction.from_customer_id || 'customer'}`,
        });
        break;

      case 'withdrawal':
      case 'savings_withdrawal':
        // Debit: Customer Deposits, Credit: Cash
        lines.push({
          journal_entry_id: journalEntryId,
          tenant_id: this.tenantId,
          account_code: ACCOUNTS.CUSTOMER_DEPOSITS,
          debit: amount,
          credit: 0,
          description: `Withdrawal by ${transaction.from_customer_id || 'customer'}`,
        });
        lines.push({
          journal_entry_id: journalEntryId,
          tenant_id: this.tenantId,
          account_code: cashAccount,
          debit: 0,
          credit: amount,
          description: `Cash paid to ${transaction.from_customer_id || 'customer'}`,
        });
        break;

      case 'loan_disbursement':
        // Debit: Loan Receivable, Credit: Cash
        lines.push({
          journal_entry_id: journalEntryId,
          tenant_id: this.tenantId,
          account_code: ACCOUNTS.LOAN_RECEIVABLE,
          debit: amount,
          credit: 0,
          description: `Loan disbursed to ${transaction.to_customer_id || 'customer'}`,
        });
        lines.push({
          journal_entry_id: journalEntryId,
          tenant_id: this.tenantId,
          account_code: cashAccount,
          debit: 0,
          credit: amount,
          description: `Cash disbursed for loan`,
        });
        break;

      case 'loan_repayment':
        // Debit: Cash, Credit: Loan Receivable
        const interestAmount = amount * 0.15; // Assuming 15% interest
        const principalAmount = amount - interestAmount;
        
        lines.push({
          journal_entry_id: journalEntryId,
          tenant_id: this.tenantId,
          account_code: cashAccount,
          debit: amount,
          credit: 0,
          description: `Loan repayment received from ${transaction.from_customer_id || 'customer'}`,
        });
        lines.push({
          journal_entry_id: journalEntryId,
          tenant_id: this.tenantId,
          account_code: ACCOUNTS.LOAN_RECEIVABLE,
          debit: 0,
          credit: principalAmount,
          description: `Loan principal repayment`,
        });
        lines.push({
          journal_entry_id: journalEntryId,
          tenant_id: this.tenantId,
          account_code: ACCOUNTS.LOAN_INTEREST_INCOME,
          debit: 0,
          credit: interestAmount,
          description: `Loan interest income`,
        });
        break;

      case 'transfer':
        // Transfer between customers - no cash movement
        // Debit: Sender's deposit, Credit: Receiver's deposit
        lines.push({
          journal_entry_id: journalEntryId,
          tenant_id: this.tenantId,
          account_code: ACCOUNTS.CUSTOMER_DEPOSITS,
          debit: amount,
          credit: 0,
          description: `Transfer from ${transaction.from_customer_id || 'sender'}`,
        });
        lines.push({
          journal_entry_id: journalEntryId,
          tenant_id: this.tenantId,
          account_code: ACCOUNTS.CUSTOMER_DEPOSITS,
          debit: 0,
          credit: amount,
          description: `Transfer to ${transaction.to_customer_id || 'receiver'}`,
        });
        break;

      case 'branch_transfer':
        // Transfer between branches
        // Debit: Sending branch cash, Credit: Receiving branch cash
        lines.push({
          journal_entry_id: journalEntryId,
          tenant_id: this.tenantId,
          account_code: cashAccount,
          debit: amount,
          credit: 0,
          description: `Branch transfer from ${transaction.description || 'sending branch'}`,
        });
        lines.push({
          journal_entry_id: journalEntryId,
          tenant_id: this.tenantId,
          account_code: cashAccount,
          debit: 0,
          credit: amount,
          description: `Branch transfer to receiving branch`,
        });
        break;

      case 'expense':
        // Debit: Expense, Credit: Cash
        lines.push({
          journal_entry_id: journalEntryId,
          tenant_id: this.tenantId,
          account_code: ACCOUNTS.EXPENSE,
          debit: amount,
          credit: 0,
          description: `Expense: ${transaction.description || 'operational expense'}`,
        });
        lines.push({
          journal_entry_id: journalEntryId,
          tenant_id: this.tenantId,
          account_code: cashAccount,
          debit: 0,
          credit: amount,
          description: `Cash paid for expense`,
        });
        break;

      default:
        // Default posting: Debit/Credit based on transaction type
        lines.push({
          journal_entry_id: journalEntryId,
          tenant_id: this.tenantId,
          account_code: cashAccount,
          debit: this.isInflow(transaction.transaction_type) ? amount : 0,
          credit: this.isOutflow(transaction.transaction_type) ? amount : 0,
          description: `${transaction.transaction_type} transaction`,
        });
    }

    return lines;
  }

  private getCashAccount(currency: string): string {
    switch (currency.toUpperCase()) {
      case 'KES': return ACCOUNTS.CASH_KES;
      case 'USD': return ACCOUNTS.CASH_USD;
      case 'EUR': return ACCOUNTS.CASH_EUR;
      default: return ACCOUNTS.CASH_KES;
    }
  }

  private isInflow(type: string): boolean {
    return ['deposit', 'savings_deposit', 'loan_repayment', 'transfer_in'].includes(type);
  }

  private isOutflow(type: string): boolean {
    return ['withdrawal', 'savings_withdrawal', 'loan_disbursement', 'transfer_out', 'expense'].includes(type);
  }

  private formatTransactionType(type: string): string {
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private async saveJournalLines(lines: JournalLine[]): Promise<void> {
    const { error } = await supabase
      .from('journal_lines')
      .insert(lines);

    if (error) throw error;
  }

  private async updateTransactionStatus(transactionId: string): Promise<void> {
    const { error } = await supabase
      .from('transactions')
      .update({ 
        status: 'completed',
        posted_at: new Date().toISOString()
      })
      .eq('id', transactionId);

    if (error) throw error;
  }
}
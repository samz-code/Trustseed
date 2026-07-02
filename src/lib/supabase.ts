import { createClient } from '@supabase/supabase-js';
import type {
  OnboardingPhase,
  UserRole,
  TransactionType,
  TransactionStatus,
  TenantSettings,
} from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. ' +
    'Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your .env file, ' +
    'then fully restart the dev server (stop and re-run npm run dev).'
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string;
          name: string;
          slug: string;
          plan: 'starter' | 'professional' | 'enterprise';
          status: 'active' | 'suspended' | 'archived';
          onboarding_phase: OnboardingPhase;
          onboarding_completed: boolean;
          settings: TenantSettings;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          plan: 'starter' | 'professional' | 'enterprise';
          status?: 'active' | 'suspended' | 'archived';
          onboarding_phase?: OnboardingPhase;
          onboarding_completed?: boolean;
          settings?: TenantSettings;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          plan?: 'starter' | 'professional' | 'enterprise';
          status?: 'active' | 'suspended' | 'archived';
          onboarding_phase?: OnboardingPhase;
          onboarding_completed?: boolean;
          settings?: TenantSettings;
        };
        Relationships: [];
      };
      tenant_admins: {
        Row: {
          id: string;
          tenant_id: string;
          user_id: string | null;
          email: string;
          full_name: string;
          role: UserRole;
          status: 'active' | 'pending' | 'inactive';
          phone: string | null;
          two_factor_enabled: boolean;
          last_login: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          user_id?: string | null;
          email: string;
          full_name: string;
          role: UserRole;
          status?: 'active' | 'pending' | 'inactive';
          phone?: string | null;
          two_factor_enabled?: boolean;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          user_id?: string | null;
          email?: string;
          full_name?: string;
          role?: UserRole;
          status?: 'active' | 'pending' | 'inactive';
          phone?: string | null;
          two_factor_enabled?: boolean;
        };
        Relationships: [];
      };
      branches: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          code: string;
          address: string | null;
          is_head_office: boolean;
          manager_id: string | null;
          status: 'active' | 'inactive';
          operating_currencies: string[];
          first_day_setup_completed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          code: string;
          address?: string | null;
          is_head_office?: boolean;
          manager_id?: string | null;
          status?: 'active' | 'inactive';
          operating_currencies?: string[];
          first_day_setup_completed?: boolean;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          name?: string;
          code?: string;
          address?: string | null;
          is_head_office?: boolean;
          manager_id?: string | null;
          status?: 'active' | 'inactive';
          operating_currencies?: string[];
          first_day_setup_completed?: boolean;
        };
        Relationships: [];
      };
      customers: {
        Row: {
          id: string;
          tenant_id: string;
          branch_id: string | null;
          customer_type: 'individual' | 'business' | 'organization';
          first_name: string | null;
          last_name: string | null;
          business_name: string | null;
          email: string | null;
          phone: string;
          address: string | null;
          city: string | null;
          country: string | null;
          id_type: string | null;
          id_number: string | null;
          id_expiry: string | null;
          date_of_birth: string | null;
          nationality: string | null;
          kyc_status: 'pending' | 'verified' | 'rejected' | 'expired';
          kyc_verified_at: string | null;
          kyc_verified_by: string | null;
          aml_status: 'pending' | 'clear' | 'flagged' | 'blocked';
          aml_checked_at: string | null;
          risk_level: 'low' | 'medium' | 'high';
          status: 'active' | 'frozen' | 'closed';
          customer_number: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          branch_id?: string | null;
          customer_type?: 'individual' | 'business' | 'organization';
          first_name?: string | null;
          last_name?: string | null;
          business_name?: string | null;
          email?: string | null;
          phone: string;
          address?: string | null;
          city?: string | null;
          country?: string | null;
          id_type?: string | null;
          id_number?: string | null;
          id_expiry?: string | null;
          date_of_birth?: string | null;
          nationality?: string | null;
          kyc_status?: 'pending' | 'verified' | 'rejected' | 'expired';
          aml_status?: 'pending' | 'clear' | 'flagged' | 'blocked';
          risk_level?: 'low' | 'medium' | 'high';
          status?: 'active' | 'frozen' | 'closed';
          metadata?: Json;
        };
        Update: {
          id?: string;
          branch_id?: string | null;
          customer_type?: 'individual' | 'business' | 'organization';
          first_name?: string | null;
          last_name?: string | null;
          business_name?: string | null;
          email?: string | null;
          phone?: string;
          address?: string | null;
          city?: string | null;
          country?: string | null;
          id_type?: string | null;
          id_number?: string | null;
          id_expiry?: string | null;
          date_of_birth?: string | null;
          nationality?: string | null;
          kyc_status?: 'pending' | 'verified' | 'rejected' | 'expired';
          kyc_verified_at?: string | null;
          kyc_verified_by?: string | null;
          aml_status?: 'pending' | 'clear' | 'flagged' | 'blocked';
          aml_checked_at?: string | null;
          risk_level?: 'low' | 'medium' | 'high';
          status?: 'active' | 'frozen' | 'closed';
          metadata?: Json;
        };
        Relationships: [];
      };
      wallets: {
        Row: {
          id: string;
          tenant_id: string;
          branch_id: string | null;
          customer_id: string;
          wallet_type: string;
          currency: string;
          account_number: string | null;
          balance: number;
          available_balance: number;
          held_balance: number;
          status: 'active' | 'frozen' | 'closed';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          branch_id?: string | null;
          customer_id: string;
          wallet_type: string;
          currency: string;
          status?: 'active' | 'frozen' | 'closed';
        };
        Update: {
          id?: string;
          branch_id?: string | null;
          wallet_type?: string;
          currency?: string;
          balance?: number;
          available_balance?: number;
          held_balance?: number;
          status?: 'active' | 'frozen' | 'closed';
        };
        Relationships: [];
      };
      daily_operations: {
        Row: {
          id: string;
          tenant_id: string;
          branch_id: string;
          operation_date: string;
          state: 'pending_opening' | 'opening' | 'active' | 'closing' | 'closed';
          opening_balances: Json;
          closing_balances: Json;
          total_transactions: number;
          total_debits: number;
          total_credits: number;
          opened_by: string | null;
          closed_by: string | null;
          opened_at: string | null;
          closed_at: string | null;
          approval_status: 'pending' | 'approved' | 'rejected';
          approved_by: string | null;
          approved_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          branch_id: string;
          operation_date: string;
          state?: 'pending_opening' | 'opening' | 'active' | 'closing' | 'closed';
          opening_balances?: Json;
          closing_balances?: Json;
          total_transactions?: number;
          total_debits?: number;
          total_credits?: number;
          opened_by?: string | null;
          opened_at?: string | null;
        };
        Update: {
          state?: 'pending_opening' | 'opening' | 'active' | 'closing' | 'closed';
          opening_balances?: Json;
          closing_balances?: Json;
          total_transactions?: number;
          total_debits?: number;
          total_credits?: number;
          closed_by?: string | null;
          closed_at?: string | null;
          approval_status?: 'pending' | 'approved' | 'rejected';
          approved_by?: string | null;
          approved_at?: string | null;
          notes?: string | null;
        };
        Relationships: [];
      };
      transactions: {
        Row: {
          id: string;
          tenant_id: string;
          branch_id: string | null;
          transaction_type: TransactionType;
          reference: string;
          amount: number;
          currency: string;
          fee_amount: number;
          fee_currency: string | null;
          exchange_rate: number | null;
          from_wallet_id: string | null;
          to_wallet_id: string | null;
          from_customer_id: string | null;
          to_customer_id: string | null;
          sender_name: string | null;
          sender_phone: string | null;
          receiver_name: string | null;
          receiver_phone: string | null;
          destination_country: string | null;
          purpose: string | null;
          notes: string | null;
          status: TransactionStatus;
          is_international: boolean;
          requires_compliance_check: boolean;
          compliance_status: 'pending' | 'passed' | 'flagged' | 'blocked' | null;
          compliance_checked_at: string | null;
          compliance_checked_by: string | null;
          current_approval_level: number;
          required_approval_level: number;
          created_by: string;
          approved_by: string | null;
          approved_at: string | null;
          completed_at: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          branch_id?: string | null;
          transaction_type: TransactionType;
          amount: number;
          currency: string;
          fee_amount?: number;
          from_wallet_id?: string | null;
          to_wallet_id?: string | null;
          from_customer_id?: string | null;
          to_customer_id?: string | null;
          sender_name?: string | null;
          sender_phone?: string | null;
          receiver_name?: string | null;
          receiver_phone?: string | null;
          destination_country?: string | null;
          purpose?: string | null;
          notes?: string | null;
          is_international?: boolean;
          requires_compliance_check?: boolean;
          created_by: string;
          required_approval_level?: number;
          metadata?: Json;
        };
        Update: {
          status?: TransactionStatus;
          compliance_status?: 'pending' | 'passed' | 'flagged' | 'blocked' | null;
          compliance_checked_at?: string | null;
          compliance_checked_by?: string | null;
          current_approval_level?: number;
          approved_by?: string | null;
          approved_at?: string | null;
          completed_at?: string | null;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          id: string;
          tenant_id: string;
          plan: 'starter' | 'professional' | 'enterprise';
          billing_cycle: 'monthly' | 'annual';
          monthly_fee: number;
          status: 'active' | 'past_due' | 'grace_period' | 'suspended' | 'canceled';
          current_period_start: string | null;
          current_period_end: string | null;
          grace_period_ends: string | null;
          stripe_subscription_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          plan: 'starter' | 'professional' | 'enterprise';
          billing_cycle: 'monthly' | 'annual';
          monthly_fee: number;
          status?: 'active' | 'past_due' | 'grace_period' | 'suspended' | 'canceled';
          current_period_start?: string | null;
          current_period_end?: string | null;
          grace_period_ends?: string | null;
          stripe_subscription_id?: string | null;
        };
        Update: {
          status?: 'active' | 'past_due' | 'grace_period' | 'suspended' | 'canceled';
          current_period_end?: string | null;
          grace_period_ends?: string | null;
        };
        Relationships: [];
      };
      loan_accounts: {
        Row: {
          id: string;
          tenant_id: string;
          branch_id: string | null;
          application_id: string;
          customer_id: string;
          loan_number: string;
          product_id: string | null;
          principal_amount: number;
          interest_rate: number;
          interest_type: string;
          term_months: number;
          disbursement_date: string | null;
          maturity_date: string | null;
          outstanding_principal: number;
          outstanding_interest: number;
          outstanding_fees: number;
          outstanding_penalty: number;
          total_outstanding: number;
          amount_past_due: number;
          days_past_due: number;
          next_payment_date: string | null;
          next_payment_amount: number | null;
          status: 'active' | 'fully_paid' | 'defaulted' | 'written_off' | 'restructured' | 'closed';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          branch_id?: string | null;
          application_id: string;
          customer_id: string;
          product_id?: string | null;
          principal_amount: number;
          interest_rate: number;
          term_months: number;
          status?: 'active' | 'fully_paid' | 'defaulted' | 'written_off' | 'restructured' | 'closed';
        };
        Update: {
          disbursement_date?: string | null;
          maturity_date?: string | null;
          outstanding_principal?: number;
          outstanding_interest?: number;
          total_outstanding?: number;
          amount_past_due?: number;
          days_past_due?: number;
          next_payment_date?: string | null;
          next_payment_amount?: number | null;
          last_payment_date?: string | null;
          last_payment_amount?: number | null;
          status?: 'active' | 'fully_paid' | 'defaulted' | 'written_off' | 'restructured' | 'closed';
        };
        Relationships: [];
      };
      savings_accounts: {
        Row: {
          id: string;
          tenant_id: string;
          branch_id: string | null;
          customer_id: string;
          product_id: string;
          account_number: string;
          balance: number;
          available_balance: number;
          held_balance: number;
          accrued_interest: number;
          status: 'active' | 'frozen' | 'closed' | 'matured' | 'dormant';
          opened_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          branch_id?: string | null;
          customer_id: string;
          product_id: string;
          balance?: number;
          available_balance?: number;
          status?: 'active' | 'frozen' | 'closed' | 'matured' | 'dormant';
        };
        Update: {
          balance?: number;
          available_balance?: number;
          held_balance?: number;
          accrued_interest?: number;
          status?: 'active' | 'frozen' | 'closed' | 'matured' | 'dormant';
        };
        Relationships: [];
      };
      transaction_approvals: {
        Row: {
          id: string;
          tenant_id: string;
          transaction_id: string;
          approval_level: number;
          required_role: string;
          approver_id: string | null;
          status: 'pending' | 'approved' | 'rejected' | 'skipped';
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          transaction_id: string;
          approval_level: number;
          required_role: string;
          approver_id?: string | null;
          status?: 'pending' | 'approved' | 'rejected' | 'skipped';
          notes?: string | null;
        };
        Update: {
          approver_id?: string | null;
          status?: 'pending' | 'approved' | 'rejected' | 'skipped';
          notes?: string | null;
        };
        Relationships: [];
      };
      chart_of_accounts: {
        Row: {
          id: string;
          tenant_id: string;
          account_code: string;
          account_name: string;
          account_type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
          account_category: string | null;
          parent_account_id: string | null;
          is_active: boolean;
          allow_manual_entry: boolean;
          is_system_account: boolean;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          account_code: string;
          account_name: string;
          account_type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
          account_category?: string | null;
          parent_account_id?: string | null;
          is_active?: boolean;
          allow_manual_entry?: boolean;
          is_system_account?: boolean;
          description?: string | null;
        };
        Update: {
          account_name?: string;
          account_category?: string | null;
          parent_account_id?: string | null;
          is_active?: boolean;
          allow_manual_entry?: boolean;
          description?: string | null;
        };
        Relationships: [];
      };
      journal_entries: {
        Row: {
          id: string;
          tenant_id: string;
          branch_id: string | null;
          entry_number: string;
          entry_date: string;
          reference_type: string | null;
          reference_id: string | null;
          description: string | null;
          status: 'draft' | 'posted' | 'reversed';
          posted_at: string | null;
          posted_by: string | null;
          reversed_entry_id: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          branch_id?: string | null;
          entry_date: string;
          reference_type?: string | null;
          reference_id?: string | null;
          description?: string | null;
          status?: 'draft' | 'posted' | 'reversed';
          created_by: string;
        };
        Update: {
          status?: 'draft' | 'posted' | 'reversed';
          posted_at?: string | null;
          posted_by?: string | null;
          reversed_entry_id?: string | null;
          description?: string | null;
        };
        Relationships: [];
      };
      journal_entry_lines: {
        Row: {
          id: string;
          tenant_id: string;
          journal_entry_id: string;
          account_id: string;
          debit_amount: number;
          credit_amount: number;
          line_number: number;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          journal_entry_id: string;
          account_id: string;
          debit_amount?: number;
          credit_amount?: number;
          line_number: number;
          description?: string | null;
        };
        Update: {
          description?: string | null;
        };
        Relationships: [];
      };
      loan_products: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          code: string;
          description: string | null;
          min_amount: number;
          max_amount: number | null;
          interest_type: 'flat' | 'reducing_balance';
          min_interest_rate: number;
          max_interest_rate: number | null;
          default_interest_rate: number;
          min_term_months: number;
          max_term_months: number | null;
          grace_period_days: number;
          penalty_rate: number;
          late_fee: number;
          requires_collateral: boolean;
          collateral_types: string[] | null;
          status: 'active' | 'inactive';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          code: string;
          description?: string | null;
          min_amount?: number;
          max_amount?: number | null;
          interest_type?: 'flat' | 'reducing_balance';
          min_interest_rate?: number;
          max_interest_rate?: number | null;
          default_interest_rate: number;
          min_term_months?: number;
          max_term_months?: number | null;
          grace_period_days?: number;
          penalty_rate?: number;
          late_fee?: number;
          requires_collateral?: boolean;
          collateral_types?: string[] | null;
          status?: 'active' | 'inactive';
        };
        Update: {
          name?: string;
          description?: string | null;
          min_amount?: number;
          max_amount?: number | null;
          interest_type?: 'flat' | 'reducing_balance';
          min_interest_rate?: number;
          max_interest_rate?: number | null;
          default_interest_rate?: number;
          min_term_months?: number;
          max_term_months?: number | null;
          grace_period_days?: number;
          penalty_rate?: number;
          late_fee?: number;
          requires_collateral?: boolean;
          collateral_types?: string[] | null;
          status?: 'active' | 'inactive';
        };
        Relationships: [];
      };
      loan_applications: {
        Row: {
          id: string;
          tenant_id: string;
          branch_id: string | null;
          customer_id: string;
          product_id: string;
          application_number: string;
          requested_amount: number;
          approved_amount: number | null;
          currency: string;
          term_months: number;
          purpose: string | null;
          collateral_type: string | null;
          collateral_description: string | null;
          collateral_value: number | null;
          guarantor_name: string | null;
          guarantor_phone: string | null;
          monthly_income: number | null;
          employment_status: string | null;
          employer_name: string | null;
          status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'withdrawn' | 'disbursed';
          credit_score: number | null;
          rejection_reason: string | null;
          submitted_at: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          approved_by: string | null;
          approved_at: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          branch_id?: string | null;
          customer_id: string;
          product_id: string;
          requested_amount: number;
          currency: string;
          term_months: number;
          purpose?: string | null;
          collateral_type?: string | null;
          collateral_description?: string | null;
          collateral_value?: number | null;
          guarantor_name?: string | null;
          guarantor_phone?: string | null;
          monthly_income?: number | null;
          employment_status?: string | null;
          employer_name?: string | null;
          status?: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'withdrawn' | 'disbursed';
          created_by: string;
        };
        Update: {
          approved_amount?: number | null;
          status?: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'withdrawn' | 'disbursed';
          credit_score?: number | null;
          rejection_reason?: string | null;
          submitted_at?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          approved_by?: string | null;
          approved_at?: string | null;
        };
        Relationships: [];
      };
      loan_payment_schedule: {
        Row: {
          id: string;
          tenant_id: string;
          loan_account_id: string;
          payment_number: number;
          due_date: string;
          principal_due: number;
          interest_due: number;
          fees_due: number;
          penalty_due: number;
          total_due: number;
          principal_paid: number;
          interest_paid: number;
          fees_paid: number;
          penalty_paid: number;
          total_paid: number;
          paid_date: string | null;
          payment_method: string | null;
          transaction_id: string | null;
          status: 'pending' | 'paid' | 'partially_paid' | 'overdue' | 'waived';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          loan_account_id: string;
          payment_number: number;
          due_date: string;
          principal_due: number;
          interest_due: number;
          fees_due?: number;
          penalty_due?: number;
          total_due: number;
          status?: 'pending' | 'paid' | 'partially_paid' | 'overdue' | 'waived';
        };
        Update: {
          principal_paid?: number;
          interest_paid?: number;
          fees_paid?: number;
          penalty_paid?: number;
          total_paid?: number;
          paid_date?: string | null;
          payment_method?: string | null;
          transaction_id?: string | null;
          status?: 'pending' | 'paid' | 'partially_paid' | 'overdue' | 'waived';
        };
        Relationships: [];
      };
      savings_products: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          code: string;
          description: string | null;
          interest_rate: number;
          interest_compounding: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually';
          min_balance: number;
          min_opening_balance: number;
          max_balance: number | null;
          max_withdrawal_per_month: number | null;
          withdrawal_fee: number;
          maintenance_fee: number;
          withdrawal_notice_days: number;
          term_months: number | null;
          early_withdrawal_penalty: number;
          is_fixed_deposit: boolean;
          status: 'active' | 'inactive';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          code: string;
          description?: string | null;
          interest_rate?: number;
          interest_compounding?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually';
          min_balance?: number;
          min_opening_balance?: number;
          max_balance?: number | null;
          max_withdrawal_per_month?: number | null;
          withdrawal_fee?: number;
          maintenance_fee?: number;
          withdrawal_notice_days?: number;
          term_months?: number | null;
          early_withdrawal_penalty?: number;
          is_fixed_deposit?: boolean;
          status?: 'active' | 'inactive';
        };
        Update: {
          name?: string;
          description?: string | null;
          interest_rate?: number;
          interest_compounding?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually';
          min_balance?: number;
          min_opening_balance?: number;
          max_balance?: number | null;
          max_withdrawal_per_month?: number | null;
          withdrawal_fee?: number;
          maintenance_fee?: number;
          withdrawal_notice_days?: number;
          term_months?: number | null;
          early_withdrawal_penalty?: number;
          is_fixed_deposit?: boolean;
          status?: 'active' | 'inactive';
        };
        Relationships: [];
      };
      exchange_rates: {
        Row: {
          id: string;
          tenant_id: string;
          branch_id: string | null;
          from_currency: string;
          to_currency: string;
          buy_rate: number;
          sell_rate: number;
          reference_rate: number | null;
          is_active: boolean;
          effective_from: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          branch_id?: string | null;
          from_currency: string;
          to_currency: string;
          buy_rate: number;
          sell_rate: number;
          reference_rate?: number | null;
          is_active?: boolean;
          effective_from?: string;
          created_by?: string | null;
        };
        Update: {
          from_currency?: string;
          to_currency?: string;
          buy_rate?: number;
          sell_rate?: number;
          reference_rate?: number | null;
          is_active?: boolean;
          effective_from?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];

export type InsertTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];

export type UpdateTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
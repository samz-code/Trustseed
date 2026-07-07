import { ReactNode } from "react";

export type Tenant = {
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

export type OnboardingPhase =
  | 'business_registration'
  | 'administrator_setup'
  | 'subscription_selection'
  | 'payment'
  | 'provisioning'
  | 'branch_setup'
  | 'first_day_setup'
  | 'completed';

export type TenantSettings = {
  default_currency: string;
  enabled_currencies: string[];
  branding: {
    primary_color: string;
    secondary_color: string;
    accent_color?: string;
    logo_url: string | null;
  };
  timezone: string;
  language: string;
  website?: string | null;
  notification_settings: {
    sms_enabled: boolean;
    email_enabled: boolean;
    push_enabled: boolean;
  };
  compliance: {
    large_transaction_threshold: number;
    kyc_required: boolean;
    aml_screening_enabled: boolean;
  };
  integrations?: Record<string, Record<string, string>>;
};

export type TenantAdmin = {
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

export type UserRole =
  | 'super_admin'
  | 'institution_admin'
  | 'head_office_admin'
  | 'branch_manager'
  | 'teller'
  | 'cashier'
  | 'finance_officer'
  | 'accountant'
  | 'loan_officer'
  | 'forex_officer'
  | 'customer_service'
  | 'compliance_officer'
  | 'auditor';

export type Branch = {
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

export type Customer = {
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
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type Wallet = {
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

export type SavingsProduct = {
  min_opening_balance: number;
  min_balance: ReactNode;
  id: string;
  tenant_id: string;
  name: string;
  code: string;
  description: string | null;
  interest_rate: number;
  minimum_balance: number;
  currency: string;
  maturity_period_months: number | null;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
};

export type SavingsAccount = {
  id: string;
  tenant_id: string;
  branch_id: string | null;
  customer_id: string;
  product_id: string;
  account_number: string;
  balance: number;
  available_balance: number;
  total_interest_earned: number;
  status: 'active' | 'frozen' | 'closed';
  opened_at: string;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DailyOperation = {
  id: string;
  tenant_id: string;
  branch_id: string;
  operation_date: string;
  state: 'pending_opening' | 'opening' | 'active' | 'closing' | 'closed';
  opening_balances: Record<string, number>;
  closing_balances: Record<string, number>;
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

export type Transaction = {
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
  created_at: string;
  updated_at: string;

  // --- Transactions v2 (migration_transactions_v2.sql) ---------------------
  // These columns are added by the migration. Optional (`?`) so any existing
  // code that constructs a Transaction without them still type-checks.
  /** How the customer funds a deposit / receives a withdrawal. */
  payment_source?: 'cash' | 'momo' | 'mpesa' | 'bank' | null;
  /** Target currency for transfers and forex (the currency received). */
  to_currency?: string | null;
  /** Charges / commission on an international transfer. */
  charges?: number | null;
  /** Branch float account a forex trade settles against (FK -> float_accounts). */
  float_account_id?: string | null;
  /** Loan account a disbursement pays out against (FK -> loan_accounts). */
  loan_account_id?: string | null;
  /** Free-text approval reference captured at loan disbursement. */
  approval_reference?: string | null;
};

export type TransactionType =
  | 'deposit'
  | 'withdrawal'
  | 'transfer'
  | 'forex_buy'
  | 'forex_sell'
  | 'loan_disbursement'
  | 'loan_repayment'
  | 'savings_deposit'
  | 'savings_withdrawal'
  | 'float_allocation'
  | 'float_return'
  | 'float_transfer'
  | 'branch_transfer';

export type TransactionStatus =
  | 'pending'
  | 'approved'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'reversed'
  | 'cancelled';

export type Subscription = {
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

export type AuthState = {
  user: User | null;
  tenant: Tenant | null;
  admin: TenantAdmin | null;
  branch: Branch | null;
  loading: boolean;
  error: string | null;
};

export type User = {
  id: string;
  email: string;
  created_at: string;
};

// ============================================================================
// FloatAccount
// ----------------------------------------------------------------------------
// Branch float position (cash drawer, MoMo/M-Pesa till, bank, safe, vault),
// stored in the `float_accounts` table and surfaced on FloatPage. Forex
// transactions settle against one via `Transaction.float_account_id`.
// If your project ALREADY exports FloatAccount from another file, delete this
// block to avoid a duplicate-identifier error. Extra fields are optional so
// this stays compatible with whatever columns your table actually has.
// ============================================================================
export type FloatAccount = {
  id: string;
  tenant_id: string;
  branch_id: string | null;
  float_type: string;
  currency: string;
  balance: number;
  min_threshold: number | null;
  max_threshold: number | null;
  status: 'active' | 'inactive' | 'frozen';
  created_at: string;
  updated_at: string;
};

// ============================================================================
// LoanAccount
// ----------------------------------------------------------------------------
// TransactionsPage needs a LoanAccount type. This is intentionally loose: real
// loan_accounts columns vary (loan_number vs account_number, principal_amount
// vs outstanding_balance), so optional fields + an index signature let the
// page read whatever exists without type errors. If you ALREADY declare
// LoanAccount elsewhere, delete this block to avoid a duplicate identifier.
// ============================================================================
export type LoanAccount = {
  id: string;
  tenant_id: string;
  branch_id?: string | null;
  customer_id: string;
  status: string;
  // Whichever of these your table has:
  account_number?: string;
  loan_number?: string;
  currency?: string;
  outstanding_balance?: number;
  current_balance?: number;
  balance?: number;
  principal_amount?: number;
  principal?: number;
  created_at?: string;
  updated_at?: string;
  // Allow any additional columns your table defines.
  [key: string]: unknown;
};
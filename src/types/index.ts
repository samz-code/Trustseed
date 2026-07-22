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
  /** Printed in the header of remittance vouchers and receipts. */
  address?: string | null;
  phone?: string | null;
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
  min_balance: number;
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

  // --- Remittance voucher fields (voucher_fields_migration.sql) ------------
  // Printed on the landscape remittance voucher. Optional so existing code
  // that builds a Transaction without them still type-checks.
  /** Sender physical address, printed on the voucher. */
  sender_address?: string | null;
  /** Sender ID/passport number, captured for compliance and printed. */
  sender_id_number?: string | null;
  /** Receiver payout city, printed alongside destination_country. */
  receiver_city?: string | null;
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

export type ExchangeRate = {
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

  // --- Automatic daily rates (auto_rates_and_momo_migration.sql) ----------
  // The market API supplies a MID rate. A bureau buys below and sells above
  // it, and that difference is its margin, so the nightly job recomputes
  // buy/sell from the mid using this spread rather than writing the mid into
  // both. Optional so code predating the migration still type-checks.
  /** Margin either side of mid. 1.0 means buy = mid-1%, sell = mid+1%. */
  spread_percent?: number;
  /** When false, the daily job skips this pair and it is priced by hand. */
  auto_update?: boolean;
  /** When the daily job last recalculated this pair. */
  last_auto_update?: string | null;
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

// ============================================================================
// PLATFORM OWNER (Trust Seed staff)
// ----------------------------------------------------------------------------
// Distinct from UserRole, which is institution-level. A subscriber's top admin
// has UserRole 'super_admin'; that is NOT platform ownership. Platform staff
// live in the separate platform_admins table and administer ALL institutions.
// ============================================================================

export type PlatformRole = 'platform_owner' | 'platform_admin' | 'platform_support';

export type PlatformAdmin = {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  role: PlatformRole;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
};

/** Shape returned by the platform_metrics() RPC. */
export type PlatformMetrics = {
  institutions_total: number;
  institutions_active: number;
  institutions_suspended: number;
  users_total: number;
  customers_total: number;
  branches_total: number;
  transactions_total: number;
  transaction_volume: number;
  mrr: number;
};

// ============================================================================
// PLATFORM INVOICES
// ----------------------------------------------------------------------------
// A billing event: what Trust Seed charged an institution, for which period,
// and once settled, how it was actually paid.
//
// Subscription amounts are always USD. When an institution settles in local
// currency (e.g. M-Pesa in KES), the local amount AND the exchange rate used
// at that moment are stored on the row, so a receipt printed a year later
// still reflects what was really collected rather than today's rate.
// ============================================================================

export type PlatformInvoiceStatus = 'open' | 'paid' | 'overdue' | 'void';

export type PlatformPaymentMethod = 'mpesa' | 'momo' | 'paypal' | 'bank' | 'card' | 'manual';

export type PlatformInvoice = {
  id: string;
  invoice_number: string;
  tenant_id: string;
  subscription_id: string | null;
  period_start: string;
  period_end: string;
  amount_usd: number;
  plan: string;
  billing_cycle: string;
  status: PlatformInvoiceStatus;
  issued_at: string;
  due_at: string;
  paid_at: string | null;
  payment_method: PlatformPaymentMethod | null;
  amount_paid_usd: number | null;
  amount_paid_local: number | null;
  local_currency: string | null;
  fx_rate: number | null;
  provider_reference: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

// ============================================================================
// LOAN PRODUCTS AND APPLICATIONS
// ----------------------------------------------------------------------------
// These were referenced by LoansPage but never defined, so the page could not
// type-check against real data. Shapes follow the loan_products and
// loan_applications tables.
// ============================================================================

export type LoanInterestType = 'flat' | 'reducing_balance';

export type LoanProduct = {
  id: string;
  tenant_id: string;
  name: string;
  code: string;
  description: string | null;
  min_amount: number;
  max_amount: number | null;
  interest_type: LoanInterestType;
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

export type LoanApplicationStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'withdrawn'
  | 'disbursed';

export type LoanApplication = {
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
  status: LoanApplicationStatus;
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
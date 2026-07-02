/*
# Trust Seed Platform - Loans, Savings & Accounting Module

This migration establishes loan management, savings accounts, and general ledger accounting.

## 1. New Tables

### loan_products
- `id` (uuid, primary key)
- `tenant_id` (uuid, references tenants)
- `name` (text) - Product name (e.g., "Personal Loan", "Business Loan")
- `code` (text) - Product code
- `min_amount` (decimal)
- `max_amount` (decimal)
- `interest_type` (text, check: flat/reducing_balance)
- `interest_rate` (decimal) - Annual interest rate percentage
- `min_term` (int) - Minimum term in months
- `max_term` (int) - Maximum term in months
- `grace_period_days` (int)
- `penalty_rate` (decimal) - Penalty rate for late payments
- `requires_collateral` (boolean)
- `status` (text, check: active/inactive)
- `created_at`, `updated_at` (timestamps)

### loan_applications
- `id` (uuid, primary key)
- `tenant_id` (uuid, references tenants)
- `branch_id` (uuid, references branches)
- `customer_id` (uuid, references customers)
- `product_id` (uuid, references loan_products)
- `application_number` (text, unique)
- `requested_amount` (decimal)
- `approved_amount` (decimal)
- `currency` (text)
- `term_months` (int)
- `purpose` (text)
- `collateral_description` (text)
- `collateral_value` (decimal)
- `status` (text, check: draft/submitted/under_review/approved/rejected/disbursed)
- `credit_score` (int)
- `risk_assessment` (jsonb)
- `submitted_at` (timestamp)
- `reviewed_by` (uuid)
- `reviewed_at` (timestamp)
- `approved_by` (uuid)
- `approved_at` (timestamp)
- `rejection_reason` (text)
- `created_by` (uuid)
- `created_at`, `updated_at` (timestamps)

### loan_accounts
- `id` (uuid, primary key)
- `tenant_id` (uuid, references tenants)
- `branch_id` (uuid, references branches)
- `application_id` (uuid, references loan_applications)
- `customer_id` (uuid, references customers)
- `loan_number` (text, unique)
- `principal_amount` (decimal)
- `interest_rate` (decimal)
- `term_months` (int)
- `disbursement_date` (date)
- `maturity_date` (date)
- `outstanding_principal` (decimal)
- `outstanding_interest` (decimal)
- `outstanding_fees` (decimal)
- `total_outstanding` (decimal)
- `amount_past_due` (decimal)
- `days_past_due` (int, default: 0)
- `next_payment_date` (date)
- `next_payment_amount` (decimal)
- `status` (text, check: active/fully_paid/defaulted/written_off/restructured)
- `created_at`, `updated_at` (timestamps)

### loan_payments_schedule
- `id` (uuid, principal key)
- `tenant_id` (uuid, references tenants)
- `loan_account_id` (uuid, references loan_accounts)
- `payment_number` (int)
- `due_date` (date)
- `principal_due` (decimal)
- `interest_due` (decimal)
- `fees_due` (decimal)
- `total_due` (decimal)
- `principal_paid` (decimal, default: 0)
- `interest_paid` (decimal, default: 0)
- `fees_paid` (decimal, default: 0)
- `total_paid` (decimal, default: 0)
- `paid_date` (date)
- `status` (text, check: pending/paid/partially_paid/overdue/waived)
- `created_at`, `updated_at` (timestamps)

### savings_products
- `id` (uuid, primary key)
- `tenant_id` (uuid, references tenants)
- `name` (text) - Product name
- `code` (text)
- `interest_rate` (decimal) - Annual interest rate
- `interest_compounding` (text, check: monthly/quarterly/annually)
- `min_balance` (decimal)
- `min_opening_balance` (decimal)
- `max_withdrawal_per_month` (int)
- `withdrawal_fee` (decimal)
- `account_maintenance_fee` (decimal)
- `status` (text, check: active/inactive)
- `created_at`, `updated_at` (timestamps)

### savings_accounts
- `id` (uuid, primary key)
- `tenant_id` (uuid, references tenants)
- `branch_id` (uuid, references branches)
- `customer_id` (uuid, references customers)
- `product_id` (uuid, references savings_products)
- `account_number` (text, unique)
- `balance` (decimal, default: 0)
- `available_balance` (decimal, default: 0)
- `held_balance` (decimal, default: 0)
- `accrued_interest` (decimal, default: 0)
- `last_interest_posted` (date)
- `withdrawals_this_month` (int, default: 0)
- `opened_at` (timestamp)
- `status` (text, check: active/frozen/closed/matured)
- `created_at`, `updated_at` (timestamps)

### chart_of_accounts
- `id` (uuid, primary key)
- `tenant_id` (uuid, references tenants)
- `account_code` (text, not null)
- `account_name` (text, not null)
- `account_type` (text, check: asset/liability/equity/revenue/expense)
- `account_category` (text) - cash, bank, receivable, payable, etc.
- `parent_account_id` (uuid, references chart_of_accounts)
- `is_active` (boolean, default: true)
- `allow_manual_entry` (boolean, default: true)
- `description` (text)
- `created_at`, `updated_at` (timestamps)
- Unique constraint on (tenant_id, account_code)

### journal_entries
- `id` (uuid, primary key)
- `tenant_id` (uuid, references tenants)
- `branch_id` (uuid, references branches)
- `entry_number` (text, unique)
- `entry_date` (date)
- `reference_type` (text) - transaction, loan, savings, etc.
- `reference_id` (uuid)
- `description` (text)
- `status` (text, check: draft/posted/reversed)
- `posted_at` (timestamp)
- `posted_by` (uuid)
- `created_by` (uuid)
- `created_at`, `updated_at` (timestamps)

### journal_entry_lines
- `id` (uuid, primary key)
- `tenant_id` (uuid, references tenants)
- `journal_entry_id` (uuid, references journal_entries)
- `account_id` (uuid, references chart_of_accounts)
- `debit_amount` (decimal, default: 0)
- `credit_amount` (decimal, default: 0)
- `line_number` (int)
- `description` (text)
- `created_at` (timestamp)
*/

-- Loan Products
CREATE TABLE IF NOT EXISTS loan_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  description text,
  min_amount decimal(18,2) DEFAULT 0,
  max_amount decimal(18,2),
  interest_type text NOT NULL DEFAULT 'reducing_balance' CHECK (interest_type IN ('flat', 'reducing_balance')),
  min_interest_rate decimal(5,2) DEFAULT 0,
  max_interest_rate decimal(5,2),
  default_interest_rate decimal(5,2) NOT NULL,
  min_term_months int DEFAULT 1,
  max_term_months int,
  grace_period_days int DEFAULT 0,
  penalty_rate decimal(5,2) DEFAULT 0,
  late_fee decimal(18,2) DEFAULT 0,
  requires_collateral boolean DEFAULT false,
  collateral_types text[],
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, code)
);

-- Loan Applications
CREATE TABLE IF NOT EXISTS loan_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES loan_products(id),
  application_number text UNIQUE NOT NULL DEFAULT 'LA' || to_char(now(), 'YYYYMMDD') || '-' || LPAD(floor(random() * 10000)::text, 4, '0'),
  requested_amount decimal(18,2) NOT NULL,
  approved_amount decimal(18,2),
  currency text NOT NULL,
  term_months int NOT NULL,
  purpose text,
  purpose_details jsonb,
  collateral_type text,
  collateral_description text,
  collateral_value decimal(18,2),
  collateral_documents jsonb DEFAULT '[]'::jsonb,
  guarantor_name text,
  guarantor_phone text,
  guarantor_id_type text,
  guarantor_id_number text,
  monthly_income decimal(18,2),
  employment_status text,
  employer_name text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'withdrawn', 'disbursed')),
  credit_score int,
  risk_assessment jsonb,
  debt_to_income_ratio decimal(5,2),
  rejection_reason text,
  submitted_at timestamptz,
  reviewed_by uuid REFERENCES tenant_admins(id),
  reviewed_at timestamptz,
  approved_by uuid REFERENCES tenant_admins(id),
  approved_at timestamptz,
  created_by uuid NOT NULL REFERENCES tenant_admins(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loan_apps_customer ON loan_applications(tenant_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_loan_apps_status ON loan_applications(tenant_id, status);

-- Loan Accounts
CREATE TABLE IF NOT EXISTS loan_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  application_id uuid NOT NULL REFERENCES loan_applications(id),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  loan_number text UNIQUE NOT NULL DEFAULT 'LN' || to_char(now(), 'YYYYMMDD') || '-' || LPAD(floor(random() * 10000)::text, 4, '0'),
  product_id uuid REFERENCES loan_products(id),
  principal_amount decimal(18,2) NOT NULL,
  interest_rate decimal(5,2) NOT NULL,
  interest_type text NOT NULL DEFAULT 'reducing_balance',
  term_months int NOT NULL,
  disbursement_date date,
  first_payment_date date,
  maturity_date date,
  outstanding_principal decimal(18,2) NOT NULL DEFAULT 0,
  outstanding_interest decimal(18,2) NOT NULL DEFAULT 0,
  outstanding_fees decimal(18,2) DEFAULT 0,
  outstanding_penalty decimal(18,2) DEFAULT 0,
  total_outstanding decimal(18,2) NOT NULL DEFAULT 0,
  principal_paid decimal(18,2) DEFAULT 0,
  interest_paid decimal(18,2) DEFAULT 0,
  fees_paid decimal(18,2) DEFAULT 0,
  penalty_paid decimal(18,2) DEFAULT 0,
  total_paid decimal(18,2) DEFAULT 0,
  amount_past_due decimal(18,2) DEFAULT 0,
  days_past_due int DEFAULT 0,
  next_payment_date date,
  next_payment_amount decimal(18,2),
  last_payment_date date,
  last_payment_amount decimal(18,2),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'fully_paid', 'defaulted', 'written_off', 'restructured', 'closed')),
  restructure_count int DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loan_accounts_customer ON loan_accounts(tenant_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_loan_accounts_status ON loan_accounts(tenant_id, status);

-- Loan Payment Schedule
CREATE TABLE IF NOT EXISTS loan_payment_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  loan_account_id uuid NOT NULL REFERENCES loan_accounts(id) ON DELETE CASCADE,
  payment_number int NOT NULL,
  due_date date NOT NULL,
  principal_due decimal(18,2) NOT NULL,
  interest_due decimal(18,2) NOT NULL,
  fees_due decimal(18,2) DEFAULT 0,
  penalty_due decimal(18,2) DEFAULT 0,
  total_due decimal(18,2) NOT NULL,
  principal_paid decimal(18,2) DEFAULT 0,
  interest_paid decimal(18,2) DEFAULT 0,
  fees_paid decimal(18,2) DEFAULT 0,
  penalty_paid decimal(18,2) DEFAULT 0,
  total_paid decimal(18,2) DEFAULT 0,
  paid_date date,
  payment_method text,
  transaction_id uuid,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'partially_paid', 'overdue', 'waived')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(loan_account_id, payment_number)
);

CREATE INDEX IF NOT EXISTS idx_loan_schedule_account ON loan_payment_schedule(tenant_id, loan_account_id);

-- Savings Products
CREATE TABLE IF NOT EXISTS savings_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  description text,
  interest_rate decimal(5,2) NOT NULL DEFAULT 0,
  interest_compounding text NOT NULL DEFAULT 'monthly' CHECK (interest_compounding IN ('daily', 'weekly', 'monthly', 'quarterly', 'annually')),
  min_balance decimal(18,2) DEFAULT 0,
  min_opening_balance decimal(18,2) DEFAULT 0,
  max_balance decimal(18,2),
  max_withdrawal_per_month int,
  withdrawal_fee decimal(18,2) DEFAULT 0,
  maintenance_fee decimal(18,2) DEFAULT 0,
  withdrawal_notice_days int DEFAULT 0,
  term_months int,
  early_withdrawal_penalty decimal(5,2) DEFAULT 0,
  is_fixed_deposit boolean DEFAULT false,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, code)
);

-- Savings Accounts
CREATE TABLE IF NOT EXISTS savings_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES savings_products(id),
  account_number text UNIQUE NOT NULL DEFAULT 'SA' || to_char(now(), 'YYYYMMDD') || '-' || LPAD(floor(random() * 10000)::text, 4, '0'),
  balance decimal(18,2) NOT NULL DEFAULT 0,
  available_balance decimal(18,2) NOT NULL DEFAULT 0,
  held_balance decimal(18,2) DEFAULT 0,
  accrued_interest decimal(18,2) DEFAULT 0,
  last_interest_posted_date date,
  last_interest_calculation_date date,
  withdrawals_this_month int DEFAULT 0,
  withdrawal_reset_date date,
  maturity_date date,
  opened_at timestamptz DEFAULT now(),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'frozen', 'closed', 'matured', 'dormant')),
  dormant_since date,
  closed_at timestamptz,
  closure_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_savings_customer ON savings_accounts(tenant_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_savings_status ON savings_accounts(tenant_id, status);

-- Chart of Accounts
CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  account_code text NOT NULL,
  account_name text NOT NULL,
  account_type text NOT NULL CHECK (account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
  account_category text,
  parent_account_id uuid REFERENCES chart_of_accounts(id) ON DELETE SET NULL,
  is_active boolean DEFAULT true,
  allow_manual_entry boolean DEFAULT true,
  is_system_account boolean DEFAULT false,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, account_code)
);

CREATE INDEX IF NOT EXISTS idx_coa_type ON chart_of_accounts(tenant_id, account_type);

-- Journal Entries
CREATE TABLE IF NOT EXISTS journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  entry_number text UNIQUE NOT NULL DEFAULT 'JE' || to_char(now(), 'YYYYMMDDHH24MISS') || '-' || LPAD(floor(random() * 1000)::text, 3, '0'),
  entry_date date NOT NULL,
  reference_type text,
  reference_id uuid,
  description text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'reversed')),
  posted_at timestamptz,
  posted_by uuid REFERENCES tenant_admins(id),
  reversed_entry_id uuid REFERENCES journal_entries(id),
  created_by uuid NOT NULL REFERENCES tenant_admins(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(tenant_id, entry_date DESC);

-- Journal Entry Lines
CREATE TABLE IF NOT EXISTS journal_entry_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  journal_entry_id uuid NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES chart_of_accounts(id),
  debit_amount decimal(18,2) DEFAULT 0,
  credit_amount decimal(18,2) DEFAULT 0,
  line_number int NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON journal_entry_lines(tenant_id, journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON journal_entry_lines(tenant_id, account_id);

-- Enable RLS
ALTER TABLE loan_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_payment_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entry_lines ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "select_own_loan_products" ON loan_products;
CREATE POLICY "select_own_loan_products" ON loan_products FOR SELECT
  TO authenticated USING (tenant_id = get_user_tenant_id());
DROP POLICY IF EXISTS "insert_own_loan_products" ON loan_products;
CREATE POLICY "insert_own_loan_products" ON loan_products FOR INSERT
  TO authenticated WITH CHECK (tenant_id = get_user_tenant_id());
DROP POLICY IF EXISTS "update_own_loan_products" ON loan_products;
CREATE POLICY "update_own_loan_products" ON loan_products FOR UPDATE
  TO authenticated USING (tenant_id = get_user_tenant_id()) WITH CHECK (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "select_own_loan_applications" ON loan_applications;
CREATE POLICY "select_own_loan_applications" ON loan_applications FOR SELECT
  TO authenticated USING (tenant_id = get_user_tenant_id());
DROP POLICY IF EXISTS "insert_own_loan_applications" ON loan_applications;
CREATE POLICY "insert_own_loan_applications" ON loan_applications FOR INSERT
  TO authenticated WITH CHECK (tenant_id = get_user_tenant_id());
DROP POLICY IF EXISTS "update_own_loan_applications" ON loan_applications;
CREATE POLICY "update_own_loan_applications" ON loan_applications FOR UPDATE
  TO authenticated USING (tenant_id = get_user_tenant_id()) WITH CHECK (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "select_own_loan_accounts" ON loan_accounts;
CREATE POLICY "select_own_loan_accounts" ON loan_accounts FOR SELECT
  TO authenticated USING (tenant_id = get_user_tenant_id());
DROP POLICY IF EXISTS "insert_own_loan_accounts" ON loan_accounts;
CREATE POLICY "insert_own_loan_accounts" ON loan_accounts FOR INSERT
  TO authenticated WITH CHECK (tenant_id = get_user_tenant_id());
DROP POLICY IF EXISTS "update_own_loan_accounts" ON loan_accounts;
CREATE POLICY "update_own_loan_accounts" ON loan_accounts FOR UPDATE
  TO authenticated USING (tenant_id = get_user_tenant_id()) WITH CHECK (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "select_own_loan_schedule" ON loan_payment_schedule;
CREATE POLICY "select_own_loan_schedule" ON loan_payment_schedule FOR SELECT
  TO authenticated USING (tenant_id = get_user_tenant_id());
DROP POLICY IF EXISTS "insert_own_loan_schedule" ON loan_payment_schedule;
CREATE POLICY "insert_own_loan_schedule" ON loan_payment_schedule FOR INSERT
  TO authenticated WITH CHECK (tenant_id = get_user_tenant_id());
DROP POLICY IF EXISTS "update_own_loan_schedule" ON loan_payment_schedule;
CREATE POLICY "update_own_loan_schedule" ON loan_payment_schedule FOR UPDATE
  TO authenticated USING (tenant_id = get_user_tenant_id()) WITH CHECK (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "select_own_savings_products" ON savings_products;
CREATE POLICY "select_own_savings_products" ON savings_products FOR SELECT
  TO authenticated USING (tenant_id = get_user_tenant_id());
DROP POLICY IF EXISTS "insert_own_savings_products" ON savings_products;
CREATE POLICY "insert_own_savings_products" ON savings_products FOR INSERT
  TO authenticated WITH CHECK (tenant_id = get_user_tenant_id());
DROP POLICY IF EXISTS "update_own_savings_products" ON savings_products;
CREATE POLICY "update_own_savings_products" ON savings_products FOR UPDATE
  TO authenticated USING (tenant_id = get_user_tenant_id()) WITH CHECK (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "select_own_savings_accounts" ON savings_accounts;
CREATE POLICY "select_own_savings_accounts" ON savings_accounts FOR SELECT
  TO authenticated USING (tenant_id = get_user_tenant_id());
DROP POLICY IF EXISTS "insert_own_savings_accounts" ON savings_accounts;
CREATE POLICY "insert_own_savings_accounts" ON savings_accounts FOR INSERT
  TO authenticated WITH CHECK (tenant_id = get_user_tenant_id());
DROP POLICY IF EXISTS "update_own_savings_accounts" ON savings_accounts;
CREATE POLICY "update_own_savings_accounts" ON savings_accounts FOR UPDATE
  TO authenticated USING (tenant_id = get_user_tenant_id()) WITH CHECK (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "select_own_chart_of_accounts" ON chart_of_accounts;
CREATE POLICY "select_own_chart_of_accounts" ON chart_of_accounts FOR SELECT
  TO authenticated USING (tenant_id = get_user_tenant_id());
DROP POLICY IF EXISTS "insert_own_chart_of_accounts" ON chart_of_accounts;
CREATE POLICY "insert_own_chart_of_accounts" ON chart_of_accounts FOR INSERT
  TO authenticated WITH CHECK (tenant_id = get_user_tenant_id());
DROP POLICY IF EXISTS "update_own_chart_of_accounts" ON chart_of_accounts;
CREATE POLICY "update_own_chart_of_accounts" ON chart_of_accounts FOR UPDATE
  TO authenticated USING (tenant_id = get_user_tenant_id()) WITH CHECK (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "select_own_journal_entries" ON journal_entries;
CREATE POLICY "select_own_journal_entries" ON journal_entries FOR SELECT
  TO authenticated USING (tenant_id = get_user_tenant_id());
DROP POLICY IF EXISTS "insert_own_journal_entries" ON journal_entries;
CREATE POLICY "insert_own_journal_entries" ON journal_entries FOR INSERT
  TO authenticated WITH CHECK (tenant_id = get_user_tenant_id());
DROP POLICY IF EXISTS "update_own_journal_entries" ON journal_entries;
CREATE POLICY "update_own_journal_entries" ON journal_entries FOR UPDATE
  TO authenticated USING (tenant_id = get_user_tenant_id()) WITH CHECK (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "select_own_journal_lines" ON journal_entry_lines;
CREATE POLICY "select_own_journal_lines" ON journal_entry_lines FOR SELECT
  TO authenticated USING (tenant_id = get_user_tenant_id());
DROP POLICY IF EXISTS "insert_own_journal_lines" ON journal_entry_lines;
CREATE POLICY "insert_own_journal_lines" ON journal_entry_lines FOR INSERT
  TO authenticated WITH CHECK (tenant_id = get_user_tenant_id());

-- Update triggers
CREATE TRIGGER trigger_update_loan_products_updated_at BEFORE UPDATE ON loan_products FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_update_loan_applications_updated_at BEFORE UPDATE ON loan_applications FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_update_loan_accounts_updated_at BEFORE UPDATE ON loan_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_update_loan_schedule_updated_at BEFORE UPDATE ON loan_payment_schedule FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_update_savings_products_updated_at BEFORE UPDATE ON savings_products FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_update_savings_accounts_updated_at BEFORE UPDATE ON savings_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_update_chart_of_accounts_updated_at BEFORE UPDATE ON chart_of_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_update_journal_entries_updated_at BEFORE UPDATE ON journal_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at();
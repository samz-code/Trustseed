/*
# Trust Seed Platform - Multi-Tenant Foundation

This migration establishes the core multi-tenant architecture for the Trust Seed Enterprise Financial Platform.

## 1. New Tables

### tenants
- `id` (uuid, primary key) - Unique identifier for each institution
- `name` (text, not null) - Institution name
- `slug` (text, unique) - URL-friendly identifier for subdomain routing
- `plan` (text, check: starter/professional/enterprise) - Subscription tier
- `status` (text, check: active/suspended/archived, default: active) - Operational status
- `onboarding_phase` (text, check enumeration) - Current onboarding phase
- `onboarding_completed` (boolean, default: false) - Whether onboarding is complete
- `settings` (jsonb) - Institution-specific configuration (branding, currencies, etc.)
- `created_at`, `updated_at` (timestamps)

### tenant_admins
- `id` (uuid, primary key)
- `tenant_id` (uuid, references tenants) - The institution this admin belongs to
- `user_id` (uuid, references auth.users) - Supabase auth user
- `email` (text, not null)
- `full_name` (text, not null)
- `role` (text, check: super_admin/institution_admin/head_office_admin/branch_manager/teller/cashier/finance_officer/accountant/loan_officer/forex_officer/customer_service/compliance_officer/auditor)
- `status` (text, check: active/pending/inactive, default: pending)
- `phone` (text)
- `two_factor_enabled` (boolean, default: false)
- `created_at`, `updated_at` (timestamps)
- Unique constraint on (tenant_id, user_id)

### subscriptions
- `id` (uuid, primary key)
- `tenant_id` (uuid, unique, references tenants) - One subscription per tenant
- `plan` (text, not null) - Subscription tier
- `billing_cycle` (text, check: monthly/annual)
- `monthly_fee` (decimal) - Current rate
- `status` (text, check: active/past_due/grace_period/suspended/canceled)
- `current_period_start` (date)
- `current_period_end` (date)
- `grace_period_ends` (date) - Optional grace period for late payment
- `stripe_subscription_id` (text) - External payment reference
- `created_at`, `updated_at` (timestamps)

### branches
- `id` (uuid, primary key)
- `tenant_id` (uuid, references tenants) - Institution this branch belongs to
- `name` (text, not null) - Branch name
- `code` (text, not null) - Branch code
- `address` (text)
- `is_head_office` (boolean, default: false) - Marks head office branch
- `manager_id` (uuid, references tenant_admins) - Branch manager
- `status` (text, check: active/inactive, default: active)
- `operating_currencies` (text array) - Currencies this branch operates in
- `created_at`, `updated_at` (timestamps)
- Unique constraint on (tenant_id, code)

### daily_operations
- `id` (uuid, primary key)
- `tenant_id` (uuid, references tenants)
- `branch_id` (uuid, references branches)
- `operation_date` (date, not null) - Business date
- `state` (text, check: pending_opening/opening/active/closing/closed, default: pending_opening)
- `opening_balances` (jsonb) - Opening balances per currency/channel
- `closing_balances` (jsonb) - Closing balances per currency/channel
- `total_transactions` (int, default: 0)
- `total_debits` (decimal, default: 0)
- `total_credits` (decimal, default: 0)
- `opened_by` (uuid, references tenant_admins)
- `closed_by` (uuid, references tenant_admins)
- `opened_at`, `closed_at` (timestamps)
- `approval_status` (text, check: pending/approved/rejected)
- `approved_by` (uuid, references tenant_admins)
- `approved_at` (timestamp)
- `created_at`, `updated_at` (timestamps)
- Unique constraint on (tenant_id, branch_id, operation_date)

### customers
- `id` (uuid, primary key)
- `tenant_id` (uuid, references tenants)
- `branch_id` (uuid, references branches) - Primary branch
- `customer_type` (text, check: individual/business/organization)
- `first_name` (text)
- `last_name` (text)
- `business_name` (text)
- `email` (text)
- `phone` (text, not null)
- `address` (text)
- `city` (text)
- `country` (text)
- `id_type` (text) - National ID, Passport, etc.
- `id_number` (text)
- `id_expiry` (date)
- `kyc_status` (text, check: pending/verified/rejected/expired, default: pending)
- `kyc_verified_at` (timestamp)
- `kyc_verified_by` (uuid, references tenant_admins)
- `aml_status` (text, check: pending/clear/flagged/blocked, default: pending)
- `aml_checked_at` (timestamp)
- `risk_level` (text, check: low/medium/high)
- `status` (text, check: active/frozen/closed, default: active)
- `metadata` (jsonb)
- `created_at`, `updated_at` (timestamps)
- Index on (tenant_id, phone)

### wallet_ledger
- `id` (uuid, primary key)
- `tenant_id` (uuid, references tenants)
- `wallet_id` (uuid, references wallets)
- `transaction_id` (uuid) - Reference to originating transaction
- `entry_type` (text, check: credit/debit)
- `amount` (decimal(18,2), not null)
- `balance_before` (decimal(18,2), not null)
- `balance_after` (decimal(18,2), not null)
- `reference` (text)
- `description` (text)
- `metadata` (jsonb)
- `created_by` (uuid, references tenant_admins)
- `created_at` (timestamp, default: now()) - IMMUTABLE: no updates allowed
- Index on (tenant_id, wallet_id, created_at DESC)

### audit_logs
- `id` (uuid, primary key)
- `tenant_id` (uuid, references tenants)
- `branch_id` (uuid, references branches)
- `user_id` (uuid, references tenant_admins)
- `entity_type` (text, not null)
- `entity_id` (uuid)
- `action` (text, not null) - create, update, delete, approve, reject, etc.
- `before_state` (jsonb)
- `after_state` (jsonb)
- `ip_address` (text)
- `user_agent` (text)
- `created_at` (timestamp, default: now()) - IMMUTABLE
- Index on (tenant_id, created_at DESC)
- Index on (tenant_id, entity_type, entity_id)

## 2. Security (RLS Policies)

All tables have Row Level Security enabled with tenant isolation:
- Users can only access data from their own tenant
- Role-based permissions for sensitive operations
- Customer data is protected from cross-tenant access
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tenants table (institutions)
CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  plan text NOT NULL CHECK (plan IN ('starter', 'professional', 'enterprise')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'archived')),
  onboarding_phase text NOT NULL DEFAULT 'business_registration' CHECK (onboarding_phase IN (
    'business_registration',
    'administrator_setup',
    'subscription_selection',
    'payment',
    'provisioning',
    'branch_setup',
    'first_day_setup',
    'completed'
  )),
  onboarding_completed boolean DEFAULT false,
  settings jsonb DEFAULT '{
    "default_currency": "USD",
    "enabled_currencies": ["USD"],
    "branding": {
      "primary_color": "#1e40af",
      "secondary_color": "#3b82f6",
      "logo_url": null
    },
    "timezone": "UTC",
    "language": "en",
    "notification_settings": {
      "sms_enabled": true,
      "email_enabled": true,
      "push_enabled": true
    },
    "compliance": {
      "large_transaction_threshold": 10000,
      "kyc_required": true,
      "aml_screening_enabled": true
    }
  }'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tenant administrators/staff
CREATE TABLE IF NOT EXISTS tenant_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN (
    'super_admin',
    'institution_admin',
    'head_office_admin',
    'branch_manager',
    'teller',
    'cashier',
    'finance_officer',
    'accountant',
    'loan_officer',
    'forex_officer',
    'customer_service',
    'compliance_officer',
    'auditor'
  )),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'pending', 'inactive')),
  phone text,
  two_factor_enabled boolean DEFAULT false,
  last_login timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, user_id),
  UNIQUE(tenant_id, email)
);

-- Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  plan text NOT NULL CHECK (plan IN ('starter', 'professional', 'enterprise')),
  billing_cycle text NOT NULL CHECK (billing_cycle IN ('monthly', 'annual')),
  monthly_fee decimal(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'grace_period', 'suspended', 'canceled')),
  current_period_start date,
  current_period_end date,
  grace_period_ends date,
  stripe_subscription_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Branches
CREATE TABLE IF NOT EXISTS branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  address text,
  is_head_office boolean DEFAULT false,
  manager_id uuid REFERENCES tenant_admins(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  operating_currencies text[] DEFAULT ARRAY['USD']::text[],
  first_day_setup_completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, code)
);

-- Daily Operations
CREATE TABLE IF NOT EXISTS daily_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  operation_date date NOT NULL,
  state text NOT NULL DEFAULT 'pending_opening' CHECK (state IN ('pending_opening', 'opening', 'active', 'closing', 'closed')),
  opening_balances jsonb DEFAULT '{}'::jsonb,
  closing_balances jsonb DEFAULT '{}'::jsonb,
  total_transactions int DEFAULT 0,
  total_debits decimal(18,2) DEFAULT 0,
  total_credits decimal(18,2) DEFAULT 0,
  opened_by uuid REFERENCES tenant_admins(id),
  closed_by uuid REFERENCES tenant_admins(id),
  opened_at timestamptz,
  closed_at timestamptz,
  approval_status text DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  approved_by uuid REFERENCES tenant_admins(id),
  approved_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, branch_id, operation_date)
);

-- Customers
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  customer_type text NOT NULL DEFAULT 'individual' CHECK (customer_type IN ('individual', 'business', 'organization')),
  first_name text,
  last_name text,
  business_name text,
  email text,
  phone text NOT NULL,
  address text,
  city text,
  country text,
  id_type text,
  id_number text,
  id_expiry date,
  date_of_birth date,
  nationality text,
  kyc_status text NOT NULL DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'verified', 'rejected', 'expired')),
  kyc_verified_at timestamptz,
  kyc_verified_by uuid REFERENCES tenant_admins(id),
  aml_status text NOT NULL DEFAULT 'pending' CHECK (aml_status IN ('pending', 'clear', 'flagged', 'blocked')),
  aml_checked_at timestamptz,
  risk_level text DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'frozen', 'closed')),
  customer_number text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customers_tenant_phone ON customers(tenant_id, phone);
CREATE INDEX IF NOT EXISTS idx_customers_tenant_status ON customers(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_customers_kyc_status ON customers(tenant_id, kyc_status);

-- Wallets
CREATE TABLE IF NOT EXISTS wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  wallet_type text NOT NULL CHECK (wallet_type IN ('cash', 'usd', 'kes', 'ssp', 'eur', 'gbp', 'mtn_momo', 'mpesa', 'bank', 'digital')),
  currency text NOT NULL,
  account_number text UNIQUE,
  balance decimal(18,2) NOT NULL DEFAULT 0,
  available_balance decimal(18,2) NOT NULL DEFAULT 0,
  held_balance decimal(18,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'frozen', 'closed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, customer_id, wallet_type)
);

CREATE INDEX IF NOT EXISTS idx_wallets_tenant_customer ON wallets(tenant_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_wallets_tenant_status ON wallets(tenant_id, status);

-- Wallet Ledger (IMMUTABLE transaction log)
CREATE TABLE IF NOT EXISTS wallet_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  wallet_id uuid NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  transaction_id uuid,
  entry_type text NOT NULL CHECK (entry_type IN ('credit', 'debit')),
  amount decimal(18,2) NOT NULL,
  balance_before decimal(18,2) NOT NULL,
  balance_after decimal(18,2) NOT NULL,
  reference text,
  description text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES tenant_admins(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallet_ledger_tenant_wallet ON wallet_ledger(tenant_id, wallet_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_transaction ON wallet_ledger(tenant_id, transaction_id);

-- Audit Logs (IMMUTABLE)
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  user_id uuid REFERENCES tenant_admins(id) ON DELETE SET NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  before_state jsonb,
  after_state jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_date ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(tenant_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(tenant_id, user_id);

-- Enable RLS on all tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's tenant
CREATE OR REPLACE FUNCTION get_user_tenant_id()
RETURNS uuid LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT tenant_id FROM tenant_admins 
  WHERE user_id = auth.uid() 
  AND status = 'active'
  LIMIT 1;
$$;

-- RLS Policies for tenants
DROP POLICY IF EXISTS "select_own_tenant" ON tenants;
CREATE POLICY "select_own_tenant" ON tenants FOR SELECT
  TO authenticated
  USING (id = get_user_tenant_id());

DROP POLICY IF EXISTS "update_own_tenant" ON tenants;
CREATE POLICY "update_own_tenant" ON tenants FOR UPDATE
  TO authenticated
  USING (id = get_user_tenant_id())
  WITH CHECK (id = get_user_tenant_id());

-- RLS Policies for tenant_admins
DROP POLICY IF EXISTS "select_own_tenant_admins" ON tenant_admins;
CREATE POLICY "select_own_tenant_admins" ON tenant_admins FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "insert_own_tenant_admins" ON tenant_admins;
CREATE POLICY "insert_own_tenant_admins" ON tenant_admins FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "update_own_tenant_admins" ON tenant_admins;
CREATE POLICY "update_own_tenant_admins" ON tenant_admins FOR UPDATE
  TO authenticated
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "delete_own_tenant_admins" ON tenant_admins;
CREATE POLICY "delete_own_tenant_admins" ON tenant_admins FOR DELETE
  TO authenticated
  USING (tenant_id = get_user_tenant_id());

-- RLS Policies for subscriptions
DROP POLICY IF EXISTS "select_own_subscription" ON subscriptions;
CREATE POLICY "select_own_subscription" ON subscriptions FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "update_own_subscription" ON subscriptions;
CREATE POLICY "update_own_subscription" ON subscriptions FOR UPDATE
  TO authenticated
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

-- RLS Policies for branches
DROP POLICY IF EXISTS "select_own_branches" ON branches;
CREATE POLICY "select_own_branches" ON branches FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "insert_own_branches" ON branches;
CREATE POLICY "insert_own_branches" ON branches FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "update_own_branches" ON branches;
CREATE POLICY "update_own_branches" ON branches FOR UPDATE
  TO authenticated
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

-- RLS Policies for daily_operations
DROP POLICY IF EXISTS "select_own_daily_ops" ON daily_operations;
CREATE POLICY "select_own_daily_ops" ON daily_operations FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "insert_own_daily_ops" ON daily_operations;
CREATE POLICY "insert_own_daily_ops" ON daily_operations FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "update_own_daily_ops" ON daily_operations;
CREATE POLICY "update_own_daily_ops" ON daily_operations FOR UPDATE
  TO authenticated
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

-- RLS Policies for customers
DROP POLICY IF EXISTS "select_own_customers" ON customers;
CREATE POLICY "select_own_customers" ON customers FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "insert_own_customers" ON customers;
CREATE POLICY "insert_own_customers" ON customers FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "update_own_customers" ON customers;
CREATE POLICY "update_own_customers" ON customers FOR UPDATE
  TO authenticated
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "delete_own_customers" ON customers;
CREATE POLICY "delete_own_customers" ON customers FOR DELETE
  TO authenticated
  USING (tenant_id = get_user_tenant_id());

-- RLS Policies for wallets
DROP POLICY IF EXISTS "select_own_wallets" ON wallets;
CREATE POLICY "select_own_wallets" ON wallets FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "insert_own_wallets" ON wallets;
CREATE POLICY "insert_own_wallets" ON wallets FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "update_own_wallets" ON wallets;
CREATE POLICY "update_own_wallets" ON wallets FOR UPDATE
  TO authenticated
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

-- RLS Policies for wallet_ledger (read-only after insert)
DROP POLICY IF EXISTS "select_own_ledger" ON wallet_ledger;
CREATE POLICY "select_own_ledger" ON wallet_ledger FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "insert_own_ledger" ON wallet_ledger;
CREATE POLICY "insert_own_ledger" ON wallet_ledger FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id());

-- RLS Policies for audit_logs (read-only, admin only)
DROP POLICY IF EXISTS "select_own_audit" ON audit_logs;
CREATE POLICY "select_own_audit" ON audit_logs FOR SELECT
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND EXISTS (
      SELECT 1 FROM tenant_admins 
      WHERE user_id = auth.uid() 
      AND tenant_id = get_user_tenant_id()
      AND role IN ('super_admin', 'institution_admin', 'auditor', 'compliance_officer')
    )
  );

DROP POLICY IF EXISTS "insert_own_audit" ON audit_logs;
CREATE POLICY "insert_own_audit" ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id());

-- Sequences for auto-number generation
CREATE SEQUENCE IF NOT EXISTS customer_seq;
CREATE SEQUENCE IF NOT EXISTS wallet_seq;

-- Auto-generate customer numbers
CREATE OR REPLACE FUNCTION generate_customer_number()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.customer_number IS NULL THEN
    NEW.customer_number := 'C' || to_char(now(), 'YYYYMM') || '-' || 
      LPAD(nextval('customer_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_generate_customer_number
  BEFORE INSERT ON customers
  FOR EACH ROW
  EXECUTE FUNCTION generate_customer_number();

-- Auto-generate wallet account numbers
CREATE OR REPLACE FUNCTION generate_wallet_account_number()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.account_number IS NULL THEN
    NEW.account_number := 'W' || to_char(now(), 'YYYYMMDD') || '-' || 
      LPAD(nextval('wallet_seq')::text, 8, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_generate_wallet_account_number
  BEFORE INSERT ON wallets
  FOR EACH ROW
  EXECUTE FUNCTION generate_wallet_account_number();

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Apply update triggers to all relevant tables
CREATE TRIGGER trigger_update_tenants_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_update_tenant_admins_updated_at BEFORE UPDATE ON tenant_admins FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_update_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_update_branches_updated_at BEFORE UPDATE ON branches FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_update_daily_operations_updated_at BEFORE UPDATE ON daily_operations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_update_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_update_wallets_updated_at BEFORE UPDATE ON wallets FOR EACH ROW EXECUTE FUNCTION update_updated_at();
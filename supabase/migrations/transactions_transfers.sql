/*
# Trust Seed Platform - Transactions & Money Transfer Module

This migration establishes the transaction processing system including money transfers, approvals, and float management.

## 1. New Tables

### transactions
- `id` (uuid, primary key)
- `tenant_id` (uuid, references tenants)
- `branch_id` (uuid, references branches)
- `transaction_type` (text, check: deposit/withdrawal/transfer/forex/loan_disbursement/loan_repayment/savings_deposit/savings_withdrawal/float_allocation/float_return)
- `reference` (text, unique) - Unique transaction reference number
- `amount` (decimal(18,2))
- `currency` (text)
- `fee_amount` (decimal(18,2), default: 0)
- `fee_currency` (text)
- `exchange_rate` (decimal(18,8)) - For forex transactions
- `from_wallet_id` (uuid, references wallets)
- `to_wallet_id` (uuid, references wallets)
- `from_customer_id` (uuid, references customers)
- `to_customer_id` (uuid, references customers)
- `sender_name` (text) - For external transfers
- `sender_phone` (text)
- `receiver_name` (text)
- `receiver_phone` (text)
- `destination_country` (text) - For international transfers
- `purpose` (text)
- `notes` (text)
- `status` (text, check: pending/approved/processing/completed/failed/reversed)
- `compliance_status` (text, check: pending/passed/flagged/blocked)
- `compliance_checked_at` (timestamp)
- `compliance_checked_by` (uuid)
- `created_by` (uuid, references tenant_admins)
- `approved_by` (uuid, references tenant_admins)
- `approved_at` (timestamp)
- `completed_at` (timestamp)
- `created_at`, `updated_at` (timestamps)

### transaction_approvals
- `id` (uuid, primary key)
- `tenant_id` (uuid, references tenants)
- `transaction_id` (uuid, references transactions)
- `approval_level` (int)
- `required_role` (text) - Role required for this approval level
- `approver_id` (uuid, references tenant_admins)
- `status` (text, check: pending/approved/rejected)
- `notes` (text)
- `created_at`, `updated_at` (timestamps)

### float_accounts
- `id` (uuid, primary key)
- `tenant_id` (uuid, references tenants)
- `branch_id` (uuid, references branches)
- `float_type` (text, check: cash/usd/kes/ssp/mtn_momo/mpesa/bank)
- `currency` (text)
- `balance` (decimal(18,2), default: 0)
- `min_threshold` (decimal(18,2)) - Low float alert threshold
- `max_threshold` (decimal(18,2)) - Excess float alert threshold
- `status` (text, check: active/inactive)
- `created_at`, `updated_at` (timestamps)
- Unique constraint on (tenant_id, branch_id, float_type)

### float_ledger
- `id` (uuid, primary key)
- `tenant_id` (uuid, references tenants)
- `float_account_id` (uuid, references float_accounts)
- `transaction_id` (uuid, references transactions)
- `entry_type` (text, check: credit/debit)
- `amount` (decimal(18,2))
- `balance_before` (decimal(18,2))
- `balance_after` (decimal(18,2))
- `description` (text)
- `created_by` (uuid, references tenant_admins)
- `created_at` (timestamp) - IMMUTABLE

### exchange_rates
- `id` (uuid, primary key)
- `tenant_id` (uuid, references tenants)
- `from_currency` (text)
- `to_currency` (text)
- `buy_rate` (decimal(18,8)) - Rate for buying from customers
- `sell_rate` (decimal(18,8)) - Rate for selling to customers
- `mid_rate` (decimal(18,8)) - Market mid-rate
- `source` (text) - Exchange rate source
- `valid_from` (timestamp)
- `valid_until` (timestamp)
- `created_by` (uuid, references tenant_admins)
- `created_at` (timestamp)

## 2. Security
- RLS enabled on all tables with tenant isolation
- Approval workflow policies based on role hierarchy
*/

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN (
    'deposit', 'withdrawal', 'transfer', 'forex_buy', 'forex_sell',
    'loan_disbursement', 'loan_repayment', 'savings_deposit', 'savings_withdrawal',
    'float_allocation', 'float_return', 'float_transfer', 'branch_transfer'
  )),
  reference text UNIQUE NOT NULL DEFAULT 'TXN' || to_char(now(), 'YYYYMMDDHH24MISS') || '-' || LPAD(floor(random() * 10000)::text, 4, '0'),
  amount decimal(18,2) NOT NULL,
  currency text NOT NULL,
  fee_amount decimal(18,2) DEFAULT 0,
  fee_currency text,
  exchange_rate decimal(18,8),
  
  -- Wallet references
  from_wallet_id uuid REFERENCES wallets(id) ON DELETE SET NULL,
  to_wallet_id uuid REFERENCES wallets(id) ON DELETE SET NULL,
  
  -- Customer references
  from_customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  to_customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  
  -- External transfer details
  sender_name text,
  sender_phone text,
  sender_id_type text,
  sender_id_number text,
  receiver_name text,
  receiver_phone text,
  receiver_id_type text,
  receiver_id_number text,
  destination_country text,
  
  -- Transaction details
  purpose text,
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  
  -- Status tracking
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'processing', 'completed', 'failed', 'reversed', 'cancelled')),
  
  -- Compliance
  is_international boolean DEFAULT false,
  requires_compliance_check boolean DEFAULT false,
  compliance_status text CHECK (compliance_status IN ('pending', 'passed', 'flagged', 'blocked')),
  compliance_checked_at timestamptz,
  compliance_checked_by uuid REFERENCES tenant_admins(id),
  compliance_notes text,
  
  -- Approval workflow
  current_approval_level int DEFAULT 0,
  required_approval_level int DEFAULT 1,
  
  -- Audit trail
  created_by uuid NOT NULL REFERENCES tenant_admins(id),
  approved_by uuid REFERENCES tenant_admins(id),
  approved_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_tenant_branch ON transactions(tenant_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_customer ON transactions(tenant_id, from_customer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_customer_to ON transactions(tenant_id, to_customer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_wallet ON transactions(tenant_id, from_wallet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_wallet_to ON transactions(tenant_id, to_wallet_id);

-- Transaction approvals
CREATE TABLE IF NOT EXISTS transaction_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  transaction_id uuid NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  approval_level int NOT NULL,
  required_role text NOT NULL,
  approver_id uuid REFERENCES tenant_admins(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'skipped')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trans_approvals_pending ON transaction_approvals(tenant_id, status);

-- Float accounts
CREATE TABLE IF NOT EXISTS float_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  float_type text NOT NULL CHECK (float_type IN ('cash', 'usd', 'kes', 'ssp', 'eur', 'gbp', 'mtn_momo', 'mpesa', 'bank', 'safe', 'vault', 'teller_float')),
  currency text NOT NULL,
  balance decimal(18,2) NOT NULL DEFAULT 0,
  min_threshold decimal(18,2) DEFAULT 0,
  max_threshold decimal(18,2),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'frozen')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, branch_id, float_type)
);

CREATE INDEX IF NOT EXISTS idx_float_accounts_branch ON float_accounts(tenant_id, branch_id);

-- Float ledger (IMMUTABLE)
CREATE TABLE IF NOT EXISTS float_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  float_account_id uuid NOT NULL REFERENCES float_accounts(id) ON DELETE CASCADE,
  transaction_id uuid REFERENCES transactions(id),
  entry_type text NOT NULL CHECK (entry_type IN ('credit', 'debit')),
  amount decimal(18,2) NOT NULL,
  balance_before decimal(18,2) NOT NULL,
  balance_after decimal(18,2) NOT NULL,
  description text,
  created_by uuid REFERENCES tenant_admins(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_float_ledger_account ON float_ledger(tenant_id, float_account_id, created_at DESC);

-- Exchange rates
CREATE TABLE IF NOT EXISTS exchange_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  from_currency text NOT NULL,
  to_currency text NOT NULL,
  buy_rate decimal(18,8) NOT NULL,
  sell_rate decimal(18,8) NOT NULL,
  mid_rate decimal(18,8),
  spread_percent decimal(5,4),
  source text DEFAULT 'manual',
  valid_from timestamptz DEFAULT now(),
  valid_until timestamptz,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES tenant_admins(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, from_currency, to_currency, valid_from)
);

CREATE INDEX IF NOT EXISTS idx_exchange_rates_active ON exchange_rates(tenant_id, is_active, valid_from DESC);

-- Enable RLS
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE float_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE float_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for transactions
DROP POLICY IF EXISTS "select_own_transactions" ON transactions;
CREATE POLICY "select_own_transactions" ON transactions FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "insert_own_transactions" ON transactions;
CREATE POLICY "insert_own_transactions" ON transactions FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "update_own_transactions" ON transactions;
CREATE POLICY "update_own_transactions" ON transactions FOR UPDATE
  TO authenticated
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

-- RLS Policies for transaction_approvals
DROP POLICY IF EXISTS "select_own_trans_approvals" ON transaction_approvals;
CREATE POLICY "select_own_trans_approvals" ON transaction_approvals FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "insert_own_trans_approvals" ON transaction_approvals;
CREATE POLICY "insert_own_trans_approvals" ON transaction_approvals FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "update_own_trans_approvals" ON transaction_approvals;
CREATE POLICY "update_own_trans_approvals" ON transaction_approvals FOR UPDATE
  TO authenticated
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

-- RLS Policies for float_accounts
DROP POLICY IF EXISTS "select_own_float_accounts" ON float_accounts;
CREATE POLICY "select_own_float_accounts" ON float_accounts FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "insert_own_float_accounts" ON float_accounts;
CREATE POLICY "insert_own_float_accounts" ON float_accounts FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "update_own_float_accounts" ON float_accounts;
CREATE POLICY "update_own_float_accounts" ON float_accounts FOR UPDATE
  TO authenticated
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

-- RLS Policies for float_ledger
DROP POLICY IF EXISTS "select_own_float_ledger" ON float_ledger;
CREATE POLICY "select_own_float_ledger" ON float_ledger FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "insert_own_float_ledger" ON float_ledger;
CREATE POLICY "insert_own_float_ledger" ON float_ledger FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id());

-- RLS Policies for exchange_rates
DROP POLICY IF EXISTS "select_own_exchange_rates" ON exchange_rates;
CREATE POLICY "select_own_exchange_rates" ON exchange_rates FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "insert_own_exchange_rates" ON exchange_rates;
CREATE POLICY "insert_own_exchange_rates" ON exchange_rates FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "update_own_exchange_rates" ON exchange_rates;
CREATE POLICY "update_own_exchange_rates" ON exchange_rates FOR UPDATE
  TO authenticated
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

-- Update triggers
CREATE TRIGGER trigger_update_transactions_updated_at BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_update_trans_approvals_updated_at BEFORE UPDATE ON transaction_approvals FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_update_float_accounts_updated_at BEFORE UPDATE ON float_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
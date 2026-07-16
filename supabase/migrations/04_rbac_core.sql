-- ============================================================================
-- 04_rbac_core.sql
-- TrustSeed RBAC / Permission Layer
-- ----------------------------------------------------------------------------
-- ADDITIVE + IDEMPOTENT. Safe to run multiple times. Breaks nothing.
--
-- Schema facts this migration is built against (from existing migrations):
--   tenant_admins(id PK, tenant_id, user_id -> auth.users(id), role text CHECK, ...)
--     -> auth link is tenant_admins.user_id = auth.uid()
--     -> a person's ADMIN ROW id (tenant_admins.id) is what audit_logs.user_id references
--   audit_logs(id, tenant_id, branch_id, user_id -> tenant_admins(id),
--              entity_type, entity_id, action, before_state, after_state,
--              ip_address, user_agent, created_at)  [ALREADY EXISTS]
--   get_user_tenant_id()  [ALREADY EXISTS]
--   13 fixed roles enforced by CHECK on tenant_admins.role
--
-- What this adds:
--   * permissions            (catalog of "module.action" strings)
--   * role_permissions       (maps existing text roles -> permissions)
--   * SQL helpers: current_admin_id(), current_user_role(), is_platform_admin(),
--                  is_full_access_admin(), has_permission(text)
--   * RLS on the two new tables
--   * seed of the full permission catalog + role grants
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. TABLES
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module text NOT NULL,
  action text NOT NULL,
  permission text NOT NULL UNIQUE,          -- e.g. 'loans.approve'
  description text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_permissions_module ON permissions(module);

-- role is the same text domain used by tenant_admins.role (super_admin, teller, ...)
-- We do NOT create a roles table: roles are already a fixed enum-via-CHECK.
CREATE TABLE IF NOT EXISTS role_permissions (
  role text NOT NULL,
  permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (role, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role);

-- ----------------------------------------------------------------------------
-- 2. HELPER FUNCTIONS  (SECURITY DEFINER so RLS can call them without recursion)
-- ----------------------------------------------------------------------------

-- The tenant_admins.id row for the currently authenticated user (or NULL).
-- Use this for audit_logs.user_id (which references tenant_admins.id).
CREATE OR REPLACE FUNCTION current_admin_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM tenant_admins
  WHERE user_id = auth.uid()
    AND status = 'active'
  LIMIT 1;
$$;

-- The role string of the current user (or NULL if not an admin / not active).
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM tenant_admins
  WHERE user_id = auth.uid()
    AND status = 'active'
  LIMIT 1;
$$;

-- The branch_id of the current user (or NULL). Reads primary_branch_id if the
-- column exists on tenant_admins; falls back to NULL otherwise. Branch scoping
-- for staff is enforced by existing table policies, this is a convenience read.
CREATE OR REPLACE FUNCTION current_branch_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_branch uuid;
  v_has_col boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tenant_admins'
      AND column_name = 'primary_branch_id'
  ) INTO v_has_col;

  IF v_has_col THEN
    EXECUTE 'SELECT primary_branch_id FROM tenant_admins WHERE user_id = auth.uid() AND status = ''active'' LIMIT 1'
      INTO v_branch;
  ELSE
    v_branch := NULL;
  END IF;

  RETURN v_branch;
END;
$$;

-- Platform super admin (belongs to no institution conceptually; bypasses tenant).
CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT current_user_role() = 'super_admin';
$$;

-- Roles that hold ALL permissions inside their tenant (wildcard).
CREATE OR REPLACE FUNCTION is_full_access_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT current_user_role() IN ('super_admin', 'institution_admin');
$$;

-- Core check. TRUE if the current user's role grants the given permission.
-- super_admin / institution_admin short-circuit to TRUE.
CREATE OR REPLACE FUNCTION has_permission(p_permission text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  v_role := current_user_role();
  IF v_role IS NULL THEN
    RETURN false;
  END IF;

  IF v_role IN ('super_admin', 'institution_admin') THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM role_permissions rp
    JOIN permissions p ON p.id = rp.permission_id
    WHERE rp.role = v_role
      AND p.permission = p_permission
  );
END;
$$;

-- Convenience: full flat permission list for the current user (used by client).
-- Returns '*' as a single row for full-access admins.
CREATE OR REPLACE FUNCTION my_permissions()
RETURNS TABLE (permission text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  v_role := current_user_role();
  IF v_role IS NULL THEN
    RETURN;
  END IF;

  IF v_role IN ('super_admin', 'institution_admin') THEN
    RETURN QUERY SELECT '*'::text;
    RETURN;
  END IF;

  RETURN QUERY
    SELECT p.permission
    FROM role_permissions rp
    JOIN permissions p ON p.id = rp.permission_id
    WHERE rp.role = v_role
    ORDER BY p.permission;
END;
$$;

GRANT EXECUTE ON FUNCTION current_admin_id()        TO authenticated;
GRANT EXECUTE ON FUNCTION current_user_role()        TO authenticated;
GRANT EXECUTE ON FUNCTION current_branch_id()        TO authenticated;
GRANT EXECUTE ON FUNCTION is_platform_admin()        TO authenticated;
GRANT EXECUTE ON FUNCTION is_full_access_admin()     TO authenticated;
GRANT EXECUTE ON FUNCTION has_permission(text)       TO authenticated;
GRANT EXECUTE ON FUNCTION my_permissions()           TO authenticated;

-- ----------------------------------------------------------------------------
-- 3. RLS ON NEW TABLES
--    Catalog tables are read-only to all authenticated users; writes are
--    reserved for full-access admins (managed through Users & Roles UI / seed).
-- ----------------------------------------------------------------------------

ALTER TABLE permissions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_permissions" ON permissions;
CREATE POLICY "read_permissions" ON permissions
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "manage_permissions" ON permissions;
CREATE POLICY "manage_permissions" ON permissions
  FOR ALL TO authenticated
  USING (is_full_access_admin())
  WITH CHECK (is_full_access_admin());

DROP POLICY IF EXISTS "read_role_permissions" ON role_permissions;
CREATE POLICY "read_role_permissions" ON role_permissions
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "manage_role_permissions" ON role_permissions;
CREATE POLICY "manage_role_permissions" ON role_permissions
  FOR ALL TO authenticated
  USING (is_full_access_admin())
  WITH CHECK (is_full_access_admin());

-- ----------------------------------------------------------------------------
-- 4. SEED: PERMISSION CATALOG
--    Idempotent via ON CONFLICT on the unique 'permission' column.
-- ----------------------------------------------------------------------------

INSERT INTO permissions (module, action, permission, description) VALUES
  -- dashboard
  ('dashboard','view','dashboard.view','View dashboard'),

  -- members / customers (both aliases used across the app)
  ('members','view','members.view','View members'),
  ('members','create','members.create','Create members'),
  ('members','update','members.update','Update members'),
  ('members','delete','members.delete','Delete members'),
  ('members','export','members.export','Export members'),
  ('members','print','members.print','Print member records'),
  ('customers','view','customers.view','View customers'),

  -- wallets
  ('wallets','view','wallets.view','View wallets'),
  ('wallets','create','wallets.create','Create wallets'),
  ('wallets','update','wallets.update','Update wallets'),

  -- transactions
  ('transactions','view','transactions.view','View transactions'),
  ('transactions','create','transactions.create','Create transactions'),
  ('transactions','approve','transactions.approve','Approve transactions'),
  ('transactions','export','transactions.export','Export transactions'),

  -- transfers
  ('transfers','view','transfers.view','View money transfers'),
  ('transfers','create','transfers.create','Create money transfers'),

  -- forex
  ('forex','view','forex.view','View forex desk'),
  ('forex','create','forex.create','Create forex trades'),
  ('forex','manage','forex.manage','Manage exchange rates'),

  -- loans
  ('loans','view','loans.view','View loans'),
  ('loans','create','loans.create','Create loan applications'),
  ('loans','update','loans.update','Update loans'),
  ('loans','delete','loans.delete','Delete loans'),
  ('loans','approve','loans.approve','Approve loans'),
  ('loans','reject','loans.reject','Reject loans'),
  ('loans','disburse','loans.disburse','Disburse loans'),
  ('loans','manage','loans.manage','Manage loan products'),
  ('loans','export','loans.export','Export loans'),

  -- savings
  ('savings','view','savings.view','View savings'),
  ('savings','create','savings.create','Create savings accounts'),
  ('savings','update','savings.update','Update savings'),
  ('savings','close','savings.close','Close savings accounts'),
  ('savings','export','savings.export','Export savings'),

  -- expenses
  ('expenses','view','expenses.view','View expenses'),
  ('expenses','create','expenses.create','Record expenses'),
  ('expenses','approve','expenses.approve','Approve expenses'),

  -- float
  ('float','view','float.view','View float'),
  ('float','manage','float.manage','Manage float'),

  -- operations
  ('operations','view','operations.view','View daily operations'),
  ('operations','manage','operations.manage','Manage daily opening/closing/transfers'),

  -- accounting
  ('accounting','view','accounting.view','View accounting'),
  ('accounting','create','accounting.create','Create journal entries'),
  ('accounting','update','accounting.update','Update accounting records'),
  ('accounting','export','accounting.export','Export accounting'),

  -- reports
  ('reports','view','reports.view','View reports'),
  ('reports','export','reports.export','Export reports'),
  ('reports','print','reports.print','Print reports'),

  -- users & roles
  ('users','view','users.view','View users'),
  ('users','create','users.create','Create users'),
  ('users','update','users.update','Update users'),
  ('users','delete','users.delete','Delete users'),
  ('users','reset_password','users.reset_password','Reset user passwords'),
  ('users','assign_role','users.assign_role','Assign roles'),

  -- settings
  ('settings','view','settings.view','View settings'),
  ('settings','manage','settings.manage','Manage settings'),

  -- audit
  ('audit','view','audit.view','View audit logs'),
  ('audit','export','audit.export','Export audit logs'),

  -- notifications
  ('notifications','view','notifications.view','View notifications'),
  ('notifications','create','notifications.create','Create notifications'),
  ('notifications','send','notifications.send','Send notifications')
ON CONFLICT (permission) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 5. SEED: ROLE -> PERMISSION GRANTS
--    super_admin & institution_admin are wildcarded in code (has_permission),
--    so we do not seed rows for them (keeps table lean and avoids drift).
--    All other roles are granted explicitly per the SACCO hierarchy.
--    Idempotent: builds grants via a temp mapping and ON CONFLICT.
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  grants text[][] := ARRAY[
    -- head_office_admin: institution-wide read + approvals + branch mgmt
    ['head_office_admin','dashboard.view'],
    ['head_office_admin','members.view'],
    ['head_office_admin','members.export'],
    ['head_office_admin','wallets.view'],
    ['head_office_admin','transactions.view'],
    ['head_office_admin','transactions.approve'],
    ['head_office_admin','transactions.export'],
    ['head_office_admin','transfers.view'],
    ['head_office_admin','forex.view'],
    ['head_office_admin','loans.view'],
    ['head_office_admin','loans.approve'],
    ['head_office_admin','loans.reject'],
    ['head_office_admin','loans.export'],
    ['head_office_admin','savings.view'],
    ['head_office_admin','savings.export'],
    ['head_office_admin','expenses.view'],
    ['head_office_admin','expenses.approve'],
    ['head_office_admin','float.view'],
    ['head_office_admin','operations.view'],
    ['head_office_admin','operations.manage'],
    ['head_office_admin','accounting.view'],
    ['head_office_admin','reports.view'],
    ['head_office_admin','reports.export'],
    ['head_office_admin','reports.print'],
    ['head_office_admin','users.view'],
    ['head_office_admin','audit.view'],
    ['head_office_admin','notifications.view'],

    -- branch_manager: own branch operational control
    ['branch_manager','dashboard.view'],
    ['branch_manager','members.view'],
    ['branch_manager','members.create'],
    ['branch_manager','members.update'],
    ['branch_manager','members.export'],
    ['branch_manager','wallets.view'],
    ['branch_manager','wallets.create'],
    ['branch_manager','wallets.update'],
    ['branch_manager','transactions.view'],
    ['branch_manager','transactions.create'],
    ['branch_manager','transactions.approve'],
    ['branch_manager','transfers.view'],
    ['branch_manager','transfers.create'],
    ['branch_manager','loans.view'],
    ['branch_manager','loans.approve'],
    ['branch_manager','loans.reject'],
    ['branch_manager','savings.view'],
    ['branch_manager','expenses.view'],
    ['branch_manager','expenses.approve'],
    ['branch_manager','float.view'],
    ['branch_manager','operations.view'],
    ['branch_manager','operations.manage'],
    ['branch_manager','reports.view'],
    ['branch_manager','reports.export'],
    ['branch_manager','users.view'],
    ['branch_manager','notifications.view'],

    -- finance_officer: cash, deposits, withdrawals, payments, financial reports
    ['finance_officer','dashboard.view'],
    ['finance_officer','members.view'],
    ['finance_officer','wallets.view'],
    ['finance_officer','transactions.view'],
    ['finance_officer','transactions.create'],
    ['finance_officer','transactions.export'],
    ['finance_officer','transfers.view'],
    ['finance_officer','transfers.create'],
    ['finance_officer','expenses.view'],
    ['finance_officer','expenses.create'],
    ['finance_officer','float.view'],
    ['finance_officer','float.manage'],
    ['finance_officer','reports.view'],
    ['finance_officer','reports.export'],
    ['finance_officer','notifications.view'],

    -- accountant: ledgers, journals, statements
    ['accountant','dashboard.view'],
    ['accountant','accounting.view'],
    ['accountant','accounting.create'],
    ['accountant','accounting.update'],
    ['accountant','accounting.export'],
    ['accountant','transactions.view'],
    ['accountant','reports.view'],
    ['accountant','reports.export'],
    ['accountant','reports.print'],
    ['accountant','notifications.view'],

    -- compliance_officer: KYC/AML/risk, read-only across the board
    ['compliance_officer','dashboard.view'],
    ['compliance_officer','members.view'],
    ['compliance_officer','wallets.view'],
    ['compliance_officer','transactions.view'],
    ['compliance_officer','loans.view'],
    ['compliance_officer','savings.view'],
    ['compliance_officer','reports.view'],
    ['compliance_officer','reports.export'],
    ['compliance_officer','audit.view'],
    ['compliance_officer','audit.export'],
    ['compliance_officer','notifications.view'],

    -- loan_officer: originate & review, CANNOT approve
    ['loan_officer','dashboard.view'],
    ['loan_officer','members.view'],
    ['loan_officer','customers.view'],
    ['loan_officer','loans.view'],
    ['loan_officer','loans.create'],
    ['loan_officer','loans.update'],
    ['loan_officer','loans.export'],
    ['loan_officer','reports.view'],
    ['loan_officer','notifications.view'],

    -- forex_officer
    ['forex_officer','dashboard.view'],
    ['forex_officer','forex.view'],
    ['forex_officer','forex.create'],
    ['forex_officer','forex.manage'],
    ['forex_officer','transactions.view'],
    ['forex_officer','transactions.create'],
    ['forex_officer','reports.view'],
    ['forex_officer','notifications.view'],

    -- teller: deposits, withdrawals, receipts, repayments
    ['teller','dashboard.view'],
    ['teller','members.view'],
    ['teller','wallets.view'],
    ['teller','transactions.view'],
    ['teller','transactions.create'],
    ['teller','transfers.view'],
    ['teller','transfers.create'],
    ['teller','loans.view'],
    ['teller','notifications.view'],

    -- cashier: receive cash, daily balancing, reconciliation
    ['cashier','dashboard.view'],
    ['cashier','transactions.view'],
    ['cashier','transactions.create'],
    ['cashier','float.view'],
    ['cashier','operations.view'],
    ['cashier','operations.manage'],
    ['cashier','reports.view'],
    ['cashier','notifications.view'],

    -- customer_service: register/update members, open accounts, statements
    ['customer_service','dashboard.view'],
    ['customer_service','members.view'],
    ['customer_service','members.create'],
    ['customer_service','members.update'],
    ['customer_service','members.print'],
    ['customer_service','customers.view'],
    ['customer_service','wallets.view'],
    ['customer_service','wallets.create'],
    ['customer_service','reports.view'],
    ['customer_service','reports.print'],
    ['customer_service','notifications.view'],

    -- auditor: read-only everything, plus audit export
    ['auditor','dashboard.view'],
    ['auditor','members.view'],
    ['auditor','wallets.view'],
    ['auditor','transactions.view'],
    ['auditor','transfers.view'],
    ['auditor','forex.view'],
    ['auditor','loans.view'],
    ['auditor','savings.view'],
    ['auditor','expenses.view'],
    ['auditor','float.view'],
    ['auditor','operations.view'],
    ['auditor','accounting.view'],
    ['auditor','reports.view'],
    ['auditor','reports.export'],
    ['auditor','users.view'],
    ['auditor','audit.view'],
    ['auditor','audit.export'],
    ['auditor','notifications.view']
  ];
  i int;
BEGIN
  FOR i IN 1 .. array_length(grants, 1) LOOP
    INSERT INTO role_permissions (role, permission_id)
    SELECT grants[i][1], p.id
    FROM permissions p
    WHERE p.permission = grants[i][2]
    ON CONFLICT (role, permission_id) DO NOTHING;
  END LOOP;
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. AUDIT WRITE HELPER  (matches EXISTING audit_logs columns exactly)
--    Callable from client via RPC. Resolves tenant/admin from the session.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION log_audit_event(
  p_entity_type text,
  p_action text,
  p_entity_id uuid DEFAULT NULL,
  p_before jsonb DEFAULT NULL,
  p_after jsonb DEFAULT NULL,
  p_ip text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid := get_user_tenant_id();
  v_admin  uuid := current_admin_id();
  v_branch uuid := current_branch_id();
  v_id     uuid;
BEGIN
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'No tenant context for audit event';
  END IF;

  INSERT INTO audit_logs (
    tenant_id, branch_id, user_id,
    entity_type, entity_id, action,
    before_state, after_state,
    ip_address, user_agent
  )
  VALUES (
    v_tenant, v_branch, v_admin,
    p_entity_type, p_entity_id, p_action,
    p_before, p_after,
    p_ip, p_user_agent
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION log_audit_event(text, text, uuid, jsonb, jsonb, text, text)
  TO authenticated;

-- ============================================================================
-- END 04_rbac_core.sql
-- ============================================================================
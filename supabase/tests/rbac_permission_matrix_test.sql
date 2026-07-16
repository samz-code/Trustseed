-- ============================================================================
-- rbac_permission_matrix_test.sql
-- Verifies the seeded role -> permission grants match the SACCO spec.
-- Pure data assertions against role_permissions + permissions. Does NOT need
-- a logged-in user (it checks the grant table directly, not has_permission()).
--
-- Run in the Supabase SQL editor AFTER applying 04_rbac_core.sql.
-- Each block RAISES EXCEPTION on failure, so a clean run = all green.
-- super_admin / institution_admin are wildcarded in code and intentionally
-- have NO rows here, so they are asserted absent, not present.
-- ============================================================================

DO $$
DECLARE
  -- expected: role has this permission
  expect_true  text[][] := ARRAY[
    ['loan_officer','loans.create'],
    ['loan_officer','loans.update'],
    ['branch_manager','loans.approve'],
    ['head_office_admin','loans.approve'],
    ['teller','transactions.create'],
    ['finance_officer','float.manage'],
    ['accountant','accounting.create'],
    ['compliance_officer','audit.view'],
    ['forex_officer','forex.manage'],
    ['customer_service','members.create'],
    ['auditor','audit.export'],
    ['cashier','operations.manage']
  ];
  -- expected: role does NOT have this permission (key negative controls)
  expect_false text[][] := ARRAY[
    ['loan_officer','loans.approve'],      -- loan officers cannot approve
    ['auditor','members.create'],          -- auditor is read-only
    ['auditor','loans.approve'],           -- auditor cannot approve
    ['teller','loans.approve'],            -- tellers cannot approve loans
    ['customer_service','transactions.approve'],
    ['cashier','users.create'],            -- cashier has no user mgmt
    ['accountant','loans.disburse']        -- accountant is books-only
  ];
  i int;
  v_role text;
  v_perm text;
  v_has boolean;
  v_failures int := 0;
BEGIN
  -- Positive assertions
  FOR i IN 1 .. array_length(expect_true, 1) LOOP
    v_role := expect_true[i][1];
    v_perm := expect_true[i][2];
    SELECT EXISTS (
      SELECT 1 FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE rp.role = v_role AND p.permission = v_perm
    ) INTO v_has;
    IF NOT v_has THEN
      RAISE WARNING 'MISSING grant: % should have %', v_role, v_perm;
      v_failures := v_failures + 1;
    END IF;
  END LOOP;

  -- Negative assertions
  FOR i IN 1 .. array_length(expect_false, 1) LOOP
    v_role := expect_false[i][1];
    v_perm := expect_false[i][2];
    SELECT EXISTS (
      SELECT 1 FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE rp.role = v_role AND p.permission = v_perm
    ) INTO v_has;
    IF v_has THEN
      RAISE WARNING 'UNEXPECTED grant: % should NOT have %', v_role, v_perm;
      v_failures := v_failures + 1;
    END IF;
  END LOOP;

  -- Wildcard roles must have zero explicit rows
  IF EXISTS (SELECT 1 FROM role_permissions WHERE role IN ('super_admin','institution_admin')) THEN
    RAISE WARNING 'Wildcard roles should have no explicit role_permissions rows';
    v_failures := v_failures + 1;
  END IF;

  IF v_failures > 0 THEN
    RAISE EXCEPTION 'RBAC matrix test FAILED with % problem(s). See warnings above.', v_failures;
  END IF;

  RAISE NOTICE 'RBAC matrix test PASSED: all role/permission assertions hold.';
END;
$$;

-- Handy inventory: permission counts per role (super_admin/institution_admin
-- show 0 because they are wildcarded in code).
SELECT rp.role, count(*) AS granted_permissions
FROM role_permissions rp
GROUP BY rp.role
ORDER BY granted_permissions DESC, rp.role;
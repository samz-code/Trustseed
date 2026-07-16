// src/constants/roles.ts
// The 13 roles enforced by the CHECK constraint on tenant_admins.role.
// Order reflects the SACCO user hierarchy (highest privilege first).

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  INSTITUTION_ADMIN: 'institution_admin',
  HEAD_OFFICE_ADMIN: 'head_office_admin',
  BRANCH_MANAGER: 'branch_manager',
  FINANCE_OFFICER: 'finance_officer',
  ACCOUNTANT: 'accountant',
  COMPLIANCE_OFFICER: 'compliance_officer',
  LOAN_OFFICER: 'loan_officer',
  FOREX_OFFICER: 'forex_officer',
  TELLER: 'teller',
  CASHIER: 'cashier',
  CUSTOMER_SERVICE: 'customer_service',
  AUDITOR: 'auditor',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

// Roles that hold every permission within their tenant (client mirror of
// is_full_access_admin() in SQL). Keep in sync with the DB helper.
export const FULL_ACCESS_ROLES: Role[] = [ROLES.SUPER_ADMIN, ROLES.INSTITUTION_ADMIN];

// Platform-level role that bypasses tenant isolation (mirror of is_platform_admin()).
export const PLATFORM_ROLES: Role[] = [ROLES.SUPER_ADMIN];

// Roles with institution-wide (all-branch) visibility. Mirrors HEAD_OFFICE_ROLES
// already used in DashboardLayout.tsx.
export const HEAD_OFFICE_ROLES: Role[] = [
  ROLES.SUPER_ADMIN,
  ROLES.INSTITUTION_ADMIN,
  ROLES.HEAD_OFFICE_ADMIN,
];

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: 'Super Admin',
  institution_admin: 'Institution Admin',
  head_office_admin: 'Head Office Admin',
  branch_manager: 'Branch Manager',
  finance_officer: 'Finance Officer',
  accountant: 'Accountant',
  compliance_officer: 'Compliance Officer',
  loan_officer: 'Loan Officer',
  forex_officer: 'Forex Officer',
  teller: 'Teller',
  cashier: 'Cashier',
  customer_service: 'Customer Service',
  auditor: 'Auditor',
};

export function isRole(value: string | null | undefined): value is Role {
  return !!value && (Object.values(ROLES) as string[]).includes(value);
}
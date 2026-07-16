// src/constants/permissions.ts
// Single source of truth for permission strings on the client.
// These MUST match the `permission` column seeded in 04_rbac_core.sql.

export const PERMISSIONS = {
  dashboard: {
    view: 'dashboard.view',
  },
  members: {
    view: 'members.view',
    create: 'members.create',
    update: 'members.update',
    delete: 'members.delete',
    export: 'members.export',
    print: 'members.print',
  },
  customers: {
    view: 'customers.view',
  },
  wallets: {
    view: 'wallets.view',
    create: 'wallets.create',
    update: 'wallets.update',
  },
  transactions: {
    view: 'transactions.view',
    create: 'transactions.create',
    approve: 'transactions.approve',
    export: 'transactions.export',
  },
  transfers: {
    view: 'transfers.view',
    create: 'transfers.create',
  },
  forex: {
    view: 'forex.view',
    create: 'forex.create',
    manage: 'forex.manage',
  },
  loans: {
    view: 'loans.view',
    create: 'loans.create',
    update: 'loans.update',
    delete: 'loans.delete',
    approve: 'loans.approve',
    reject: 'loans.reject',
    disburse: 'loans.disburse',
    manage: 'loans.manage',
    export: 'loans.export',
  },
  savings: {
    view: 'savings.view',
    create: 'savings.create',
    update: 'savings.update',
    close: 'savings.close',
    export: 'savings.export',
  },
  expenses: {
    view: 'expenses.view',
    create: 'expenses.create',
    approve: 'expenses.approve',
  },
  float: {
    view: 'float.view',
    manage: 'float.manage',
  },
  operations: {
    view: 'operations.view',
    manage: 'operations.manage',
  },
  accounting: {
    view: 'accounting.view',
    create: 'accounting.create',
    update: 'accounting.update',
    export: 'accounting.export',
  },
  reports: {
    view: 'reports.view',
    export: 'reports.export',
    print: 'reports.print',
  },
  users: {
    view: 'users.view',
    create: 'users.create',
    update: 'users.update',
    delete: 'users.delete',
    resetPassword: 'users.reset_password',
    assignRole: 'users.assign_role',
  },
  settings: {
    view: 'settings.view',
    manage: 'settings.manage',
  },
  audit: {
    view: 'audit.view',
    export: 'audit.export',
  },
  notifications: {
    view: 'notifications.view',
    create: 'notifications.create',
    send: 'notifications.send',
  },
} as const;

// Wildcard sentinel returned by the DB for full-access admins.
export const WILDCARD = '*';

// Flat union type of every known permission string.
type Leaves<T> = T extends string ? T : T extends object ? Leaves<T[keyof T]> : never;
export type PermissionString = Leaves<typeof PERMISSIONS>;

// Flat array of all permission strings (useful for tooling / validation).
export const ALL_PERMISSIONS: string[] = Object.values(PERMISSIONS).flatMap((group) =>
  Object.values(group),
);
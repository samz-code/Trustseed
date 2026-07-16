// src/components/auth/PermissionGuard.tsx
// Gates children behind one or more permissions.
//
// Button usage (hide when not permitted):
//   <PermissionGuard permission="loans.approve">
//     <button onClick={approve}>Approve loan</button>
//   </PermissionGuard>
//
// Page usage (show fallback when not permitted):
//   <PermissionGuard permission="reports.view" fallback={<Unauthorized />}>
//     <ReportsPage />
//   </PermissionGuard>
//
// Multiple permissions:
//   any (default): user needs at least one
//   all:           user needs every one
//   <PermissionGuard permission={['loans.approve','loans.reject']} mode="any">

import React from 'react';
import { usePermissions } from '../../hooks/usePermissions';

interface PermissionGuardProps {
  permission: string | string[];
  mode?: 'any' | 'all';
  fallback?: React.ReactNode;
  /** While the permission set is still loading, render nothing by default. */
  loadingFallback?: React.ReactNode;
  children: React.ReactNode;
}

export function PermissionGuard({
  permission,
  mode = 'any',
  fallback = null,
  loadingFallback = null,
  children,
}: PermissionGuardProps) {
  const { hasPermission, hasAnyPermission, hasAllPermissions, loading } = usePermissions();

  if (loading) return <>{loadingFallback}</>;

  const perms = Array.isArray(permission) ? permission : [permission];
  const allowed =
    perms.length === 1
      ? hasPermission(perms[0])
      : mode === 'all'
        ? hasAllPermissions(perms)
        : hasAnyPermission(perms);

  return <>{allowed ? children : fallback}</>;
}

export default PermissionGuard;
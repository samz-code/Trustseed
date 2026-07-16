// src/components/auth/RoleGuard.tsx
// Gates children behind one or more roles. Prefer PermissionGuard for actions;
// use RoleGuard only for genuinely role-shaped UI (e.g. the platform super-admin
// area). Roles use the string values from constants/roles.ts.
//
//   <RoleGuard roles={['super_admin']} fallback={<Unauthorized />}>
//     <PlatformSettings />
//   </RoleGuard>

import React from 'react';
import { usePermissions } from '../../hooks/usePermissions';

interface RoleGuardProps {
  roles: string | string[];
  fallback?: React.ReactNode;
  loadingFallback?: React.ReactNode;
  children: React.ReactNode;
}

export function RoleGuard({
  roles,
  fallback = null,
  loadingFallback = null,
  children,
}: RoleGuardProps) {
  const { hasAnyRole, loading } = usePermissions();

  if (loading) return <>{loadingFallback}</>;

  const roleList = Array.isArray(roles) ? roles : [roles];
  return <>{hasAnyRole(roleList) ? children : fallback}</>;
}

export default RoleGuard;
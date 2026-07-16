// src/hooks/usePermissions.ts
// Permission checks for the current user, backed by AuthContext state.
//
// DashboardLayout.tsx already calls: const { hasPermission } = usePermissions();
// This hook keeps that contract and adds hasRole / hasAnyRole / canAccess.
//
// The permission list itself is loaded once after login by AuthContext
// (see contexts/AuthContext.tsx -> fetchMyPermissions). This hook is a pure,
// synchronous reader over that cached state.

import { useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { WILDCARD } from '../constants/permissions';
import { FULL_ACCESS_ROLES, type Role } from '../constants/roles';

export interface UsePermissionsResult {
  permissions: string[];
  role: string | null;
  isWildcard: boolean;
  loading: boolean;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
  hasRole: (role: string) => boolean;
  hasAnyRole: (roles: string[]) => boolean;
  canAccess: (permission: string) => boolean; // alias of hasPermission for readability
}

export function usePermissions(): UsePermissionsResult {
  const { permissions, permissionsLoading, admin } = useAuth();

  const role = admin?.role ?? null;

  const set = useMemo(() => new Set(permissions ?? []), [permissions]);

  const isWildcard = useMemo(
    () => set.has(WILDCARD) || (!!role && (FULL_ACCESS_ROLES as string[]).includes(role)),
    [set, role],
  );

  const hasPermission = useCallback(
    (permission: string): boolean => {
      if (isWildcard) return true;
      return set.has(permission);
    },
    [isWildcard, set],
  );

  const hasAnyPermission = useCallback(
    (perms: string[]): boolean => {
      if (isWildcard) return true;
      return perms.some((p) => set.has(p));
    },
    [isWildcard, set],
  );

  const hasAllPermissions = useCallback(
    (perms: string[]): boolean => {
      if (isWildcard) return true;
      return perms.every((p) => set.has(p));
    },
    [isWildcard, set],
  );

  const hasRole = useCallback((r: string): boolean => role === r, [role]);

  const hasAnyRole = useCallback(
    (roles: string[]): boolean => !!role && roles.includes(role),
    [role],
  );

  return {
    permissions: permissions ?? [],
    role,
    isWildcard,
    loading: permissionsLoading,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    hasAnyRole,
    canAccess: hasPermission,
  };
}

export type { Role };
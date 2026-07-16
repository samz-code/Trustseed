// src/services/permission.service.ts
// Reads the current user's flat permission set from the DB via the
// my_permissions() RPC defined in 04_rbac_core.sql.
//
// Returns either ['*'] for full-access admins, or the explicit list of
// permission strings granted to the user's role.

import { supabase } from '../lib/supabase';
import { WILDCARD } from '../constants/permissions';

export interface PermissionLoadResult {
  permissions: string[];
  isWildcard: boolean;
  error: string | null;
}

/**
 * Fetch the authenticated user's permissions.
 * Falls back gracefully to an empty set on error so the UI stays usable
 * (RLS remains the real enforcement boundary regardless of client state).
 */
export async function fetchMyPermissions(): Promise<PermissionLoadResult> {
  try {
    const { data, error } = await supabase.rpc('my_permissions');

    if (error) throw error;

    const rows = (data ?? []) as Array<{ permission: string } | string>;
    const permissions = rows
      .map((r) => (typeof r === 'string' ? r : r?.permission))
      .filter((p): p is string => typeof p === 'string' && p.length > 0);

    const isWildcard = permissions.includes(WILDCARD);

    return { permissions, isWildcard, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load permissions';
    // Common first-run case: migration not applied yet.
    if (/function .*my_permissions.* does not exist/i.test(message)) {
      return {
        permissions: [],
        isWildcard: false,
        error: 'Permissions are not set up yet. Run migration 04_rbac_core.sql.',
      };
    }
    return { permissions: [], isWildcard: false, error: message };
  }
}
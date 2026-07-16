// src/services/audit.service.ts
// Thin client wrapper over the log_audit_event() RPC (04_rbac_core.sql).
// tenant_id, branch_id and user_id (tenant_admins.id) are resolved server-side
// from the session, so callers only pass the business details.

import { supabase } from '../lib/supabase';

export interface AuditEvent {
  entityType: string; // e.g. 'loan_application', 'user', 'transaction'
  action: string; // e.g. 'approve', 'create', 'delete', 'export'
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
}

/**
 * Record a sensitive action. Fire-and-forget by design: auditing must never
 * block or fail the primary operation, so errors are logged, not thrown.
 * Returns the new audit row id, or null on failure.
 */
export async function logAudit(event: AuditEvent): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('log_audit_event', {
      p_entity_type: event.entityType,
      p_action: event.action,
      p_entity_id: event.entityId ?? null,
      p_before: (event.before ?? null) as never,
      p_after: (event.after ?? null) as never,
      p_ip: null, // client cannot read its public IP reliably; captured server-side if needed
      p_user_agent:
        typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 500) : null,
    });

    if (error) throw error;
    return (data as string) ?? null;
  } catch (err) {
    console.error('Audit log failed:', err);
    return null;
  }
}
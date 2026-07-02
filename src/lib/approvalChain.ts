import { supabase } from './supabase';
import type { InsertTables } from './supabase';

/**
 * Approval chain generation.
 *
 * A transaction that requires sign-off gets a set of transaction_approvals
 * rows, one per level, each naming the role that must approve that level.
 * The ApprovalsPage enforces that levels are actioned in ascending order and
 * that the acting admin holds the required role.
 *
 * The chain is derived from the transaction's required_approval_level plus a
 * standard role ladder. This mirrors the Approval Matrix:
 *   L1 teller (submit)  -> L2 branch_manager -> L3 finance_officer
 *   -> L4 compliance_officer -> L5 head_office_admin
 *
 * Levels beyond the ladder length fall back to institution_admin.
 */

const ROLE_LADDER: string[] = [
  'teller',
  'branch_manager',
  'finance_officer',
  'compliance_officer',
  'head_office_admin',
];

export function roleForLevel(level: number): string {
  // level is 1-based. Level 1 is the submitter (teller); approvals typically
  // start at level 2, but we generate a row per level so the chain is complete.
  const idx = level - 1;
  return ROLE_LADDER[idx] ?? 'institution_admin';
}

export interface BuildApprovalChainArgs {
  tenantId: string;
  transactionId: string;
  requiredApprovalLevel: number; // highest level required, e.g. 3
  startLevel?: number; // first level that needs approval (default 2; level 1 = submitter)
}

/**
 * Inserts the approval-chain rows for a transaction. Returns the number of
 * approval rows created. Safe no-op (returns 0) when no approval is required.
 *
 * Throws on insert failure so the caller can surface it; the caller decides
 * whether the transaction should still stand (the transaction row already
 * exists at this point).
 */
export async function buildApprovalChain(args: BuildApprovalChainArgs): Promise<number> {
  const { tenantId, transactionId, requiredApprovalLevel, startLevel = 2 } = args;

  if (!requiredApprovalLevel || requiredApprovalLevel < startLevel) {
    return 0; // nothing to approve beyond the submitter
  }

  const rows: InsertTables<'transaction_approvals'>[] = [];
  for (let level = startLevel; level <= requiredApprovalLevel; level++) {
    rows.push({
      tenant_id: tenantId,
      transaction_id: transactionId,
      approval_level: level,
      required_role: roleForLevel(level),
      status: 'pending',
    });
  }

  if (rows.length === 0) return 0;

  const { error } = await supabase.from('transaction_approvals').insert(rows);
  if (error) throw error;
  return rows.length;
}
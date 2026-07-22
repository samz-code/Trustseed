import { supabase } from './supabase';

// NOTE: `expenses` and `expense_categories` are not yet in your generated
// Supabase types (src/types or wherever `Database` lives). Until you run
// `npx supabase gen types typescript` against a DB that has these tables,
// every `.from('expenses')` / `.from('expense_categories')` call is cast
// through `as any` - the same pattern already used for `notifications` in
// DashboardLayout.tsx. All casts are isolated to this file; every exported
// function still has a fully-typed signature, so callers get full type
// safety. Once you regenerate types, you can delete the `as any` casts and
// this file will keep working unchanged.

export interface ExpenseCategory {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

export type ExpenseStatus = 'pending' | 'approved' | 'rejected' | 'paid';
export type ExpensePaymentMethod =
  | 'cash'
  | 'bank_transfer'
  | 'mpesa'
  | 'card'
  | 'cheque'
  | 'other';

export interface ExpenseRow {
  id: string;
  tenant_id: string;
  branch_id: string | null;
  category_id: string | null;
  description: string;
  amount: number;
  currency: string;
  expense_date: string;
  payment_method: ExpensePaymentMethod;
  reference_number: string | null;
  vendor_name: string | null;
  receipt_url: string | null;
  status: ExpenseStatus;
  required_role: string;
  submitted_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;

  // Added by expense_float_link.sql. Null until the expense is actually paid:
  // an approved-but-unpaid expense has not cost the branch anything yet.
  float_account_id?: string | null;
  paid_at?: string | null;
  paid_by?: string | null;
  /** The float movement created when this was paid, for reconciliation. */
  transaction_id?: string | null;

  categoryName?: string;
  branchName?: string;
}

/** A till an expense can be paid from. */
export interface PayableFloatAccount {
  id: string;
  float_type: string;
  currency: string;
  balance: number;
  branch_id: string | null;
}

export interface CreateExpenseInput {
  tenantId: string;
  branchId: string | null;
  categoryId: string | null;
  description: string;
  amount: number;
  currency: string;
  expenseDate: string;
  paymentMethod: ExpensePaymentMethod;
  referenceNumber?: string | null;
  vendorName?: string | null;
  notes?: string | null;
  submittedBy: string | null;
}

const DEFAULT_CATEGORY_NAMES = [
  'Rent',
  'Utilities',
  'Salaries & Wages',
  'Office Supplies',
  'Marketing',
  'Transport',
  'IT & Software',
  'Bank Charges',
  'Other',
];

/**
 * Ensures a tenant has at least the default expense categories seeded.
 * Safe to call repeatedly - relies on the (tenant_id, name) unique
 * constraint and ignores conflicts.
 */
export async function ensureDefaultExpenseCategories(tenantId: string): Promise<void> {
  const { data: existing, error: fetchError } = await (supabase.from('expense_categories') as any)
    .select('id')
    .eq('tenant_id', tenantId)
    .limit(1);

  if (fetchError) {
    console.error('Error checking expense categories:', fetchError);
    return;
  }
  if (existing && existing.length > 0) return;

  const rows: Array<{ tenant_id: string; name: string; is_active: boolean }> =
    DEFAULT_CATEGORY_NAMES.map((name) => ({
      tenant_id: tenantId,
      name,
      is_active: true,
    }));

  const { error: insertError } = await (supabase.from('expense_categories') as any).insert(rows);
  if (insertError) {
    console.error('Error seeding default expense categories:', insertError);
  }
}

export async function fetchExpenseCategories(tenantId: string): Promise<ExpenseCategory[]> {
  const { data, error } = await (supabase.from('expense_categories') as any)
    .select('id, tenant_id, name, description, is_active')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) throw error;
  return (data ?? []) as ExpenseCategory[];
}

export interface FetchExpensesOptions {
  tenantId: string;
  branchId?: string | null;
  status?: ExpenseStatus | 'all';
  fromDate?: string;
  toDate?: string;
  limit?: number;
}

export async function fetchExpenses(options: FetchExpensesOptions): Promise<ExpenseRow[]> {
  const { tenantId, branchId, status, fromDate, toDate, limit = 50 } = options;

  let query = (supabase.from('expenses') as any)
    .select(
      'id, tenant_id, branch_id, category_id, description, amount, currency, expense_date, payment_method, reference_number, vendor_name, receipt_url, status, required_role, submitted_by, approved_by, approved_at, rejection_reason, notes, created_at, updated_at'
    )
    .eq('tenant_id', tenantId)
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (branchId) query = query.eq('branch_id', branchId);
  if (status && status !== 'all') query = query.eq('status', status);
  if (fromDate) query = query.gte('expense_date', fromDate);
  if (toDate) query = query.lte('expense_date', toDate);

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as ExpenseRow[];
  if (rows.length === 0) return [];

  const categoryIds = Array.from(
    new Set(rows.map((r) => r.category_id).filter((v): v is string => !!v))
  );
  const branchIds = Array.from(
    new Set(rows.map((r) => r.branch_id).filter((v): v is string => !!v))
  );

  const categoryMap = new Map<string, string>();
  if (categoryIds.length > 0) {
    const { data: cats, error: catError } = await (supabase.from('expense_categories') as any)
      .select('id, name')
      .in('id', categoryIds);
    if (catError) throw catError;
    ((cats ?? []) as Array<{ id: string; name: string }>).forEach((c) =>
      categoryMap.set(c.id, c.name)
    );
  }

  const branchMap = new Map<string, string>();
  if (branchIds.length > 0) {
    const { data: brs, error: brError } = await supabase
      .from('branches')
      .select('id, name')
      .in('id', branchIds);
    if (brError) throw brError;
    ((brs ?? []) as Array<{ id: string; name: string }>).forEach((b) =>
      branchMap.set(b.id, b.name)
    );
  }

  return rows.map((r) => ({
    ...r,
    categoryName: r.category_id
      ? categoryMap.get(r.category_id) ?? 'Uncategorized'
      : 'Uncategorized',
    branchName: r.branch_id ? branchMap.get(r.branch_id) ?? undefined : undefined,
  }));
}

export interface ExpenseSummary {
  totalToday: number;
  totalThisMonth: number;
  pendingCount: number;
  pendingTotal: number;
}

export async function fetchExpenseSummary(
  tenantId: string,
  branchId: string | null
): Promise<ExpenseSummary> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayIso = todayStart.toISOString().slice(0, 10);

  const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
  const monthIso = monthStart.toISOString().slice(0, 10);

  let monthQuery = (supabase.from('expenses') as any)
    .select('amount, expense_date, status')
    .eq('tenant_id', tenantId)
    .gte('expense_date', monthIso)
    .in('status', ['approved', 'paid']);
  if (branchId) monthQuery = monthQuery.eq('branch_id', branchId);

  const { data: monthRows, error: monthError } = await monthQuery;
  if (monthError) throw monthError;

  const monthData = (monthRows ?? []) as Array<{
    amount: number;
    expense_date: string;
    status: string;
  }>;

  const totalThisMonth = monthData.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const totalToday = monthData
    .filter((r) => r.expense_date === todayIso)
    .reduce((sum, r) => sum + Number(r.amount || 0), 0);

  let pendingQuery = (supabase.from('expenses') as any)
    .select('amount', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .eq('status', 'pending');
  if (branchId) pendingQuery = pendingQuery.eq('branch_id', branchId);

  const { data: pendingRows, count: pendingCount, error: pendingError } = await pendingQuery;
  if (pendingError) throw pendingError;

  const pendingData = (pendingRows ?? []) as Array<{ amount: number }>;
  const pendingTotal = pendingData.reduce((sum, r) => sum + Number(r.amount || 0), 0);

  return {
    totalToday,
    totalThisMonth,
    pendingCount: pendingCount ?? 0,
    pendingTotal,
  };
}

export async function createExpense(input: CreateExpenseInput): Promise<ExpenseRow> {
  const { data, error } = await (supabase.from('expenses') as any)
    .insert({
      tenant_id: input.tenantId,
      branch_id: input.branchId,
      category_id: input.categoryId,
      description: input.description.trim(),
      amount: input.amount,
      currency: input.currency,
      expense_date: input.expenseDate,
      payment_method: input.paymentMethod,
      reference_number: input.referenceNumber?.trim() || null,
      vendor_name: input.vendorName?.trim() || null,
      notes: input.notes?.trim() || null,
      submitted_by: input.submittedBy,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw error;
  return data as ExpenseRow;
}

export async function approveExpense(id: string, approvedBy: string | null): Promise<void> {
  const { error } = await (supabase.from('expenses') as any)
    .update({
      status: 'approved',
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
      rejection_reason: null,
    })
    .eq('id', id);
  if (error) throw error;
}

export async function rejectExpense(id: string, reason: string): Promise<void> {
  const { error } = await (supabase.from('expenses') as any)
    .update({
      status: 'rejected',
      rejection_reason: reason.trim() || 'No reason provided',
    })
    .eq('id', id);
  if (error) throw error;
}

/**
 * Tills that can settle an expense: active accounts in the same currency,
 * with enough in them to cover the amount.
 *
 * Filtering by balance here means the operator is not offered a till that
 * would then be refused by the database. The refusal still exists server-side
 * — this only avoids presenting a choice that cannot work.
 */
export async function fetchPayableFloatAccounts(
  tenantId: string,
  currency: string,
  minimumBalance = 0
): Promise<PayableFloatAccount[]> {
  const { data, error } = await (supabase.from('float_accounts') as any)
    .select('id, float_type, currency, balance, branch_id')
    .eq('tenant_id', tenantId)
    .eq('currency', currency)
    .eq('status', 'active')
    .gte('balance', minimumBalance)
    .order('balance', { ascending: false });
  if (error) throw error;
  return (data ?? []) as PayableFloatAccount[];
}

export interface ExpensePaymentResult {
  transactionId: string;
  newFloatBalance: number;
}

/**
 * Pays an expense from a specific till.
 *
 * This previously only flipped `status` to 'paid', leaving the float
 * untouched: the books said the money was spent while the drawer still
 * showed it. Now it calls expense_mark_paid(), which debits the till, writes
 * the ledger entry and marks the expense paid inside ONE database
 * transaction. Either all three happen or none do — there is no state where
 * cash has left but the expense still reads unpaid, or vice versa.
 *
 * The database also enforces what the UI cannot be trusted to: the expense
 * must be approved first, the currencies must match, and the till must
 * actually hold enough. Those come back as errors and should be shown to the
 * operator verbatim, since they say exactly what is wrong.
 */
export async function markExpensePaid(
  id: string,
  floatAccountId: string
): Promise<ExpensePaymentResult> {
  if (!floatAccountId) {
    throw new Error('Choose which till this expense is being paid from.');
  }

  const { data, error } = await (supabase.rpc as any)('expense_mark_paid', {
    p_expense_id: id,
    p_float_account_id: floatAccountId,
  });
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  return {
    transactionId: row?.transaction_id ?? '',
    newFloatBalance: Number(row?.new_float_balance ?? 0),
  };
}

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await (supabase.from('expenses') as any).delete().eq('id', id);
  if (error) throw error;
}
/**
 * PATCH for src/components/TransactionsPage.tsx
 * ------------------------------------------------------------------
 * 1. Run float_transaction_rpc_migration.sql in Supabase first.
 * 2. Replace the existing `handleSubmit` function with the version below.
 * 3. Add the small `refreshFloatAccounts` helper near your other effects
 *    (right after the "Float / reserve accounts" useEffect works fine).
 *
 * What changed and why:
 * - Previously: transactions.insert() -> transaction_approvals.insert()
 *   -> notifications.insert(), as three separate client calls, and the
 *   float_accounts.balance column was never touched after the balance
 *   check. So float balances stayed frozen forever.
 * - Now: one supabase.rpc() call does the insert + float balance update
 *   + approval record atomically in the database (row-locked), so the
 *   balance always reflects what actually moved through it, and two
 *   simultaneous submissions can't both overdraw the same float account.
 * - After a successful submit we also refetch float accounts so the
 *   modal/list immediately shows the new balance instead of the stale
 *   one loaded on mount.
 */

// --- add near your other float-related effects --------------------------
const refreshFloatAccounts = async () => {
  if (!tenant) return;
  try {
    const updated = await fetchFloatAccounts(tenant.id, branch?.id ?? null);
    setFloatAccounts(updated);
  } catch (err) {
    console.error('Error refreshing float accounts:', err);
  }
};

// --- replace the existing handleSubmit with this -------------------------
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setError(null);
  setSubmitting(true);

  try {
    if (!tenant || !admin) throw new Error('Missing tenant or admin');
    if (formData.amount <= 0) throw new Error('Amount must be greater than 0');

    const type = formData.transaction_type;
    const isTransfer = type === 'transfer';
    const isForex = type === 'forex_buy' || type === 'forex_sell';
    const isLoan = type === 'loan_disbursement';
    const isFloatTopUp = type === 'float_allocation';

    if (isLoan && !formData.loan_account_id) throw new Error('Select a loan account to disburse against');

    if (isTransfer && !formData.to_customer_id && !formData.receiver_name.trim()) {
      throw new Error("No registered customer found for that phone number — enter the recipient's name to continue as an external transfer.");
    }
    if (isTransfer && !formData.receiver_phone.trim()) {
      throw new Error('Recipient phone number is required.');
    }

    const isDebit = FLOAT_DEBIT_TYPES.includes(type);
    const isCredit = FLOAT_CREDIT_TYPES.includes(type);

    if (!formData.float_account_id) {
      throw new Error(
        `Select the ${floatCurrency} float/reserve account this transaction ${isDebit ? 'draws from' : 'credits'}.`
      );
    }
    const floatAccount = floatAccounts.find((f) => f.id === formData.float_account_id);
    if (!floatAccount) throw new Error('Selected float account could not be found. Please refresh and try again.');

    // Amount that actually moves against the float pool for this transaction.
    const feeComponent = isTransfer ? transferFee : 0;
    const debitAmount = isForex ? amountReceived : formData.amount + feeComponent;
    const creditAmount = formData.amount;

    // Fast client-side pre-check for immediate feedback. The RPC below
    // re-checks this authoritatively (with a row lock), so this is just
    // for a snappier error message — it is not the source of truth.
    if (isDebit) {
      const availableBalance = Number(floatAccount.balance ?? 0);
      if (debitAmount > availableBalance) {
        throw new Error(
          `Insufficient float balance. Available: ${floatAccount.currency} ${availableBalance.toLocaleString(undefined, {
            minimumFractionDigits: 2,
          })}, required: ${floatAccount.currency} ${debitAmount.toLocaleString(undefined, {
            minimumFractionDigits: 2,
          })}.`
        );
      }
    }

    // Signed delta applied to float_accounts.balance atomically inside the RPC.
    const floatDelta = isDebit ? -debitAmount : isCredit ? creditAmount : 0;

    const requiredRole = resolveRequiredRole(formData.amount, formData.is_international);
    const requiresApproval = requiredRole !== null;
    const approvalLevel = requiredRole === 'compliance_officer' ? 2 : requiresApproval ? 1 : 0;

    let fromWalletId: string | null = formData.from_wallet_id || null;
    let toWalletId: string | null = formData.to_wallet_id || null;
    if (isForex) {
      fromWalletId = formData.from_wallet_id || null;
      toWalletId = null;
    }
    if (isLoan) {
      fromWalletId = null;
      toWalletId = formData.from_wallet_id || null;
    }
    if (isFloatTopUp) {
      fromWalletId = null;
      toWalletId = null;
    }

    const feeAmount = isTransfer ? transferFee : 0;

    const transactionPayload = {
      tenant_id: tenant.id,
      branch_id: branch?.id || null,
      transaction_type: type,
      amount: formData.amount,
      currency: formData.currency,
      to_currency: isTransfer || isForex ? formData.to_currency : null,
      fee_amount: feeAmount,
      fee_currency: isTransfer ? formData.currency : null,
      charges: isTransfer ? feeAmount : null,
      from_customer_id: isFloatTopUp ? null : formData.from_customer_id || null,
      to_customer_id: isTransfer ? formData.to_customer_id || null : null,
      from_wallet_id: fromWalletId,
      to_wallet_id: toWalletId,
      sender_name: formData.sender_name || null,
      sender_phone: formData.sender_phone || null,
      receiver_name: isTransfer ? formData.receiver_name || null : null,
      receiver_phone: isTransfer ? formData.receiver_phone || null : null,
      destination_country: isTransfer ? formData.destination_country || null : null,
      is_international: isTransfer ? formData.is_international : false,
      requires_compliance_check: isTransfer ? formData.is_international : false,
      payment_source:
        type === 'deposit' || type === 'withdrawal' || isFloatTopUp ? formData.payment_source || null : null,
      exchange_rate: isTransfer || isForex ? formData.exchange_rate || null : null,
      float_account_id: formData.float_account_id,
      loan_account_id: isLoan ? formData.loan_account_id || null : null,
      approval_reference: isLoan ? formData.approval_reference || null : null,
      purpose: formData.purpose || null,
      notes: formData.notes || null,
      status: (requiresApproval ? 'pending' : 'approved') as Transaction['status'],
      created_by: admin.id,
      required_approval_level: approvalLevel,
    };

    // Single atomic call: inserts the transaction, locks + updates the
    // float account balance, and creates the approval record — all inside
    // one DB transaction, so the float balance can never drift out of sync
    // with the transactions that moved it.
    const { error: rpcError } = await supabase.rpc('create_transaction_with_float_update', {
      p_transaction: transactionPayload,
      p_float_account_id: formData.float_account_id,
      p_float_delta: floatDelta,
      p_requires_approval: requiresApproval,
      p_required_role: requiredRole,
      p_approval_level: approvalLevel,
      p_notification: requiresApproval
        ? {
            tenant_id: tenant.id,
            branch_id: branch?.id || null,
            title: `${roleLabel(requiredRole!)} approval needed`,
            message: `${type.replace(/_/g, ' ')} of ${formData.currency} ${formData.amount.toLocaleString()} is awaiting approval.`,
            type: 'warning',
            link_path: 'approvals',
          }
        : null,
    });

    if (rpcError) throw rpcError;

    await loadData();
    await refreshFloatAccounts();
    setShowForm(false);
    resetForm();
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Failed to create transaction');
  } finally {
    setSubmitting(false);
  }
};
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { Tables, InsertTables } from '../lib/supabase';
import {
  Plus,
  Search,
  BookOpen,
  X,
  Loader2,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Trash2,
  Send,
  FileEdit,
} from 'lucide-react';

type JournalEntry = Tables<'journal_entries'>;
type JournalLine = Tables<'journal_entry_lines'>;
type Account = Tables<'chart_of_accounts'>;

interface DraftLine {
  key: string;
  account_id: string;
  debit_amount: string;
  credit_amount: string;
  description: string;
}

function newDraftLine(): DraftLine {
  return {
    key: Math.random().toString(36).slice(2),
    account_id: '',
    debit_amount: '',
    credit_amount: '',
    description: '',
  };
}

function formatMoney(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function JournalEntriesPage() {
  const { tenant, branch, admin } = useAuth();

  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [linesByEntry, setLinesByEntry] = useState<Record<string, JournalLine[]>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'posted' | 'reversed'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandLoading, setExpandLoading] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [entryDescription, setEntryDescription] = useState('');
  const [entryReferenceType, setEntryReferenceType] = useState('');
  const [draftLines, setDraftLines] = useState<DraftLine[]>([newDraftLine(), newDraftLine()]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [postingId, setPostingId] = useState<string | null>(null);

  const loadEntries = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    setLoadError(null);
    try {
      let entriesQuery = supabase
        .from('journal_entries')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (branch) {
        entriesQuery = entriesQuery.eq('branch_id', branch.id);
      }

      const accountsQuery = supabase
        .from('chart_of_accounts')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .order('account_code', { ascending: true });

      const [entriesRes, accountsRes] = await Promise.all([entriesQuery, accountsQuery]);

      if (entriesRes.error) throw entriesRes.error;
      if (accountsRes.error) throw accountsRes.error;

      setEntries(entriesRes.data ?? []);
      setAccounts(accountsRes.data ?? []);
      setLinesByEntry({});
      setExpandedId(null);
    } catch (err) {
      console.error('Error loading journal entries:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load journal entries');
      setEntries([]);
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, [tenant, branch]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return entries.filter((e) => {
      const matchesStatus = statusFilter === 'all' || e.status === statusFilter;
      const matchesSearch =
        q === '' ||
        e.entry_number.toLowerCase().includes(q) ||
        (e.description ?? '').toLowerCase().includes(q) ||
        (e.reference_type ?? '').toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [entries, searchQuery, statusFilter]);

  const accountLabel = (id: string): string => {
    const a = accounts.find((acc) => acc.id === id);
    return a ? `${a.account_code} · ${a.account_name}` : 'Unknown account';
  };

  const toggleExpand = async (entry: JournalEntry) => {
    if (expandedId === entry.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(entry.id);
    if (linesByEntry[entry.id]) return; // already loaded

    setExpandLoading(entry.id);
    try {
      const { data, error } = await supabase
        .from('journal_entry_lines')
        .select('*')
        .eq('journal_entry_id', entry.id)
        .order('line_number', { ascending: true });
      if (error) throw error;
      setLinesByEntry((prev) => ({ ...prev, [entry.id]: data ?? [] }));
    } catch (err) {
      console.error('Error loading entry lines:', err);
      setLinesByEntry((prev) => ({ ...prev, [entry.id]: [] }));
    } finally {
      setExpandLoading(null);
    }
  };

  // --- Draft form line management ---

  const updateLine = (key: string, patch: Partial<DraftLine>) => {
    setDraftLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const addLine = () => setDraftLines((prev) => [...prev, newDraftLine()]);

  const removeLine = (key: string) => {
    setDraftLines((prev) => (prev.length <= 2 ? prev : prev.filter((l) => l.key !== key)));
  };

  const lineTotals = useMemo(() => {
    let debit = 0;
    let credit = 0;
    for (const l of draftLines) {
      debit += parseFloat(l.debit_amount) || 0;
      credit += parseFloat(l.credit_amount) || 0;
    }
    return { debit, credit, balanced: Math.abs(debit - credit) < 0.005 && debit > 0 };
  }, [draftLines]);

  const resetForm = () => {
    setEntryDate(new Date().toISOString().slice(0, 10));
    setEntryDescription('');
    setEntryReferenceType('');
    setDraftLines([newDraftLine(), newDraftLine()]);
    setFormError(null);
  };

  const openForm = () => {
    resetForm();
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    resetForm();
  };

  const validateDraft = (): string | null => {
    if (!entryDate) return 'Entry date is required.';
    const usableLines = draftLines.filter(
      (l) => l.account_id && (parseFloat(l.debit_amount) > 0 || parseFloat(l.credit_amount) > 0)
    );
    if (usableLines.length < 2) return 'Add at least two lines with an account and an amount.';
    for (const l of draftLines) {
      const d = parseFloat(l.debit_amount) || 0;
      const c = parseFloat(l.credit_amount) || 0;
      if ((d > 0 || c > 0) && !l.account_id) return 'Every line with an amount must have an account selected.';
      if (d > 0 && c > 0) return 'A line cannot have both a debit and a credit amount — use separate lines.';
    }
    if (!lineTotals.balanced) {
      return `Entry is not balanced: debits ${formatMoney(lineTotals.debit)} vs credits ${formatMoney(lineTotals.credit)}.`;
    }
    return null;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!tenant) {
      setFormError('No institution context found. Please sign in again.');
      return;
    }
    if (!admin) {
      setFormError('Could not determine the current admin user. Please sign in again.');
      return;
    }

    const validationError = validateDraft();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const entryInsert: InsertTables<'journal_entries'> = {
        tenant_id: tenant.id,
        branch_id: branch?.id ?? null,
        entry_date: entryDate,
        reference_type: entryReferenceType.trim() || null,
        description: entryDescription.trim() || null,
        status: 'draft',
        created_by: admin.id,
      };

      const { data: createdEntry, error: entryError } = await supabase
        .from('journal_entries')
        .insert(entryInsert)
        .select()
        .maybeSingle();

      if (entryError) throw entryError;
      if (!createdEntry) throw new Error('Journal entry was not created.');

      const usableLines = draftLines.filter(
        (l) => l.account_id && (parseFloat(l.debit_amount) > 0 || parseFloat(l.credit_amount) > 0)
      );

      const lineInserts: InsertTables<'journal_entry_lines'>[] = usableLines.map((l, idx) => ({
        tenant_id: tenant.id,
        journal_entry_id: createdEntry.id,
        account_id: l.account_id,
        debit_amount: parseFloat(l.debit_amount) || 0,
        credit_amount: parseFloat(l.credit_amount) || 0,
        line_number: idx + 1,
        description: l.description.trim() || null,
      }));

      const { error: linesError } = await supabase.from('journal_entry_lines').insert(lineInserts);

      if (linesError) {
        // The entry header exists but its lines failed to save. There is no
        // DELETE permission on journal_entries (by design, for audit
        // integrity), so we cannot silently roll it back. Surface this
        // clearly instead of pretending nothing happened.
        throw new Error(
          `Entry ${createdEntry.entry_number} was created, but its line items failed to save: ${linesError.message}. ` +
            'This draft entry currently has no lines — you will need to review it or create a replacement.'
        );
      }

      await loadEntries();
      closeForm();
    } catch (err) {
      console.error('Error creating journal entry:', err);
      setFormError(err instanceof Error ? err.message : 'Failed to create journal entry');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePost = async (entry: JournalEntry) => {
    if (!tenant || !admin) return;

    // Re-verify balance from the actual saved lines before posting, not just
    // trusting client state from entry creation time.
    setPostingId(entry.id);
    try {
      const { data: lines, error: linesError } = await supabase
        .from('journal_entry_lines')
        .select('*')
        .eq('journal_entry_id', entry.id);
      if (linesError) throw linesError;

      const lineRows = lines ?? [];
      if (lineRows.length < 2) {
        throw new Error('This entry has fewer than two lines and cannot be posted.');
      }
      const totalDebit = lineRows.reduce((s, l) => s + Number(l.debit_amount || 0), 0);
      const totalCredit = lineRows.reduce((s, l) => s + Number(l.credit_amount || 0), 0);
      if (Math.abs(totalDebit - totalCredit) >= 0.005) {
        throw new Error(
          `Cannot post: debits (${formatMoney(totalDebit)}) do not equal credits (${formatMoney(totalCredit)}).`
        );
      }

      const { error: updateError } = await supabase
        .from('journal_entries')
        .update({
          status: 'posted',
          posted_at: new Date().toISOString(),
          posted_by: admin.id,
        })
        .eq('id', entry.id)
        .eq('tenant_id', tenant.id);

      if (updateError) throw updateError;

      await loadEntries();
    } catch (err) {
      console.error('Error posting journal entry:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to post journal entry');
    } finally {
      setPostingId(null);
    }
  };

  const getStatusBadge = (status: JournalEntry['status']) => {
    const map: Record<JournalEntry['status'], { cls: string; icon: React.ReactNode }> = {
      draft: { cls: 'bg-[#ee7b22]/10 text-[#ee7b22]', icon: <FileEdit className="w-3.5 h-3.5" /> },
      posted: { cls: 'bg-[#1ebcb2]/10 text-[#1ebcb2]', icon: <CheckCircle className="w-3.5 h-3.5" /> },
      reversed: { cls: 'bg-slate-100 text-slate-600', icon: <RefreshCw className="w-3.5 h-3.5" /> },
    };
    const s = map[status];
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium capitalize ${s.cls}`}>
        {s.icon}
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#641f60]">Journal Entries</h1>
          <p className="text-slate-600 mt-1">Post and review manual and automatic journal entries</p>
        </div>
        <button
          onClick={openForm}
          disabled={accounts.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#ee7b22] hover:bg-[#c46040] text-white font-medium rounded-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-5 h-5" />
          New Entry
        </button>
      </div>

      {accounts.length === 0 && !loading && (
        <div className="bg-[#ee7b22]/10 border border-[#ee7b22]/30 rounded-xl p-4 text-sm text-[#641f60]">
          You need at least one active account in your Chart of Accounts before you can create journal entries.
        </div>
      )}

      {/* Load error */}
      {loadError && (
        <div className="bg-[#c46040]/10 border border-[#c46040]/30 rounded-xl p-4 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-[#c46040]/15 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-6 h-6 text-[#c46040]" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-[#c46040]">Something went wrong</h3>
            <p className="text-sm text-slate-600">{loadError}</p>
          </div>
          <button
            onClick={loadEntries}
            className="px-4 py-2 bg-[#ee7b22] hover:bg-[#c46040] text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by entry number, description, or reference..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="posted">Posted</option>
            <option value="reversed">Reversed</option>
          </select>
        </div>
      </div>

      {/* Entries list */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#641f60]" />
          </div>
        ) : filteredEntries.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {filteredEntries.map((entry) => {
              const lines = linesByEntry[entry.id];
              const isExpanded = expandedId === entry.id;
              return (
                <div key={entry.id}>
                  <button
                    onClick={() => toggleExpand(entry)}
                    className="w-full px-5 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors text-left"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm font-medium text-slate-700">
                          {entry.entry_number}
                        </span>
                        {getStatusBadge(entry.status)}
                      </div>
                      <p className="text-sm text-slate-600 truncate mt-0.5">
                        {entry.description || 'No description'}
                      </p>
                    </div>
                    <span className="text-sm text-slate-500 flex-shrink-0">
                      {new Date(entry.entry_date).toLocaleDateString()}
                    </span>
                    {entry.status === 'draft' && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePost(entry);
                        }}
                        role="button"
                        className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1ebcb2] hover:bg-[#641f60] text-white text-xs font-medium rounded-lg transition-colors"
                      >
                        {postingId === entry.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                        Post
                      </span>
                    )}
                  </button>

                  {isExpanded && (
                    <div className="px-5 pb-4 bg-slate-50">
                      {expandLoading === entry.id ? (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 className="w-5 h-5 animate-spin text-[#641f60]" />
                        </div>
                      ) : lines && lines.length > 0 ? (
                        <div className="rounded-lg border border-slate-200 overflow-hidden bg-white">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-slate-100 text-slate-600 text-xs uppercase">
                                <th className="text-left px-4 py-2">Account</th>
                                <th className="text-left px-4 py-2">Description</th>
                                <th className="text-right px-4 py-2">Debit</th>
                                <th className="text-right px-4 py-2">Credit</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {lines.map((line) => (
                                <tr key={line.id}>
                                  <td className="px-4 py-2 text-slate-800">{accountLabel(line.account_id)}</td>
                                  <td className="px-4 py-2 text-slate-500">{line.description || '—'}</td>
                                  <td className="px-4 py-2 text-right font-mono">
                                    {Number(line.debit_amount) > 0 ? formatMoney(Number(line.debit_amount)) : ''}
                                  </td>
                                  <td className="px-4 py-2 text-right font-mono">
                                    {Number(line.credit_amount) > 0 ? formatMoney(Number(line.credit_amount)) : ''}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="bg-slate-50 font-semibold">
                                <td className="px-4 py-2" colSpan={2}>
                                  Total
                                </td>
                                <td className="px-4 py-2 text-right font-mono">
                                  {formatMoney(lines.reduce((s, l) => s + Number(l.debit_amount || 0), 0))}
                                </td>
                                <td className="px-4 py-2 text-right font-mono">
                                  {formatMoney(lines.reduce((s, l) => s + Number(l.credit_amount || 0), 0))}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      ) : (
                        <p className="text-sm text-slate-400 py-4 text-center">No lines on this entry.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <BookOpen className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">No journal entries found</h3>
            <p className="text-slate-500 text-center max-w-sm">
              {searchQuery || statusFilter !== 'all'
                ? 'No entries match your search or filter.'
                : 'Create your first journal entry to get started.'}
            </p>
          </div>
        )}
      </div>

      {/* Create Entry Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-[#641f60]">New Journal Entry</h2>
              <button
                onClick={closeForm}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-5">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Entry Date *</label>
                  <input
                    type="date"
                    required
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Reference Type</label>
                  <input
                    type="text"
                    value={entryReferenceType}
                    onChange={(e) => setEntryReferenceType(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                    placeholder="manual, adjustment, correction..."
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  value={entryDescription}
                  onChange={(e) => setEntryDescription(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                  placeholder="What is this entry for?"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-slate-700">Lines *</label>
                  <button
                    type="button"
                    onClick={addLine}
                    className="text-sm font-medium text-[#1ebcb2] hover:text-[#641f60] transition-colors inline-flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    Add Line
                  </button>
                </div>

                <div className="space-y-2">
                  {draftLines.map((line, idx) => (
                    <div key={line.key} className="grid grid-cols-12 gap-2 items-start bg-slate-50 rounded-lg p-2">
                      <div className="col-span-4">
                        <select
                          value={line.account_id}
                          onChange={(e) => updateLine(line.key, { account_id: e.target.value })}
                          className="w-full px-2 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                        >
                          <option value="">Select account</option>
                          {accounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.account_code} · {a.account_name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-3">
                        <input
                          type="text"
                          value={line.description}
                          onChange={(e) => updateLine(line.key, { description: e.target.value })}
                          placeholder={`Line ${idx + 1} note`}
                          className="w-full px-2 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.debit_amount}
                          onChange={(e) =>
                            updateLine(line.key, { debit_amount: e.target.value, credit_amount: '' })
                          }
                          placeholder="Debit"
                          className="w-full px-2 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent text-right"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.credit_amount}
                          onChange={(e) =>
                            updateLine(line.key, { credit_amount: e.target.value, debit_amount: '' })
                          }
                          placeholder="Credit"
                          className="w-full px-2 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent text-right"
                        />
                      </div>
                      <div className="col-span-1 flex justify-center pt-2">
                        <button
                          type="button"
                          onClick={() => removeLine(line.key)}
                          disabled={draftLines.length <= 2}
                          className="text-slate-400 hover:text-[#c46040] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          aria-label="Remove line"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div
                  className={`mt-3 flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium ${
                    lineTotals.balanced
                      ? 'bg-[#1ebcb2]/10 text-[#1ebcb2]'
                      : 'bg-[#ee7b22]/10 text-[#ee7b22]'
                  }`}
                >
                  <span>
                    Debit total: {formatMoney(lineTotals.debit)} &nbsp;|&nbsp; Credit total:{' '}
                    {formatMoney(lineTotals.credit)}
                  </span>
                  <span>{lineTotals.balanced ? 'Balanced ✓' : 'Not balanced'}</span>
                </div>
              </div>

              {formError && (
                <div className="p-3 bg-[#c46040]/10 border border-[#c46040]/30 rounded-lg text-[#c46040] text-sm">
                  {formError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={closeForm}
                  className="px-4 py-2.5 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !lineTotals.balanced}
                  className="px-6 py-2.5 bg-[#ee7b22] hover:bg-[#c46040] text-white font-medium rounded-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Plus className="w-5 h-5" />
                      Save as Draft
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
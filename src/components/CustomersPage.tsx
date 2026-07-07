import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { InsertTables } from '../lib/supabase';
import type { Customer } from '../types';
import {
  Plus,
  Search,
  Filter,
  User,
  Building,
  Landmark,
  Phone,
  Mail,
  MapPin,
  Shield,
  ShieldCheck,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  Eye,
  Edit,
  X,
  Loader2,
  RefreshCw,
  Ban,
  RotateCcw,
  Calendar,
  BadgeCheck,
  ShieldAlert,
  Upload,
  FileText,
  Trash2,
  ExternalLink,
} from 'lucide-react';

type CustomerType = 'individual' | 'business' | 'organization';

// ---- Identification documents ---------------------------------------------

type DocSlot = 'id_front' | 'id_back' | 'proof_of_address' | 'photo';

interface DocSlotConfig {
  key: DocSlot;
  label: string;
  hint: string;
}

const DOC_SLOTS: DocSlotConfig[] = [
  { key: 'id_front', label: 'ID Front', hint: 'Front of national ID, passport, or license' },
  { key: 'id_back', label: 'ID Back', hint: 'Back of the ID (if applicable)' },
  { key: 'proof_of_address', label: 'Proof of Address', hint: 'Utility bill or bank statement, last 3 months' },
  { key: 'photo', label: 'Passport Photo', hint: 'Clear, recent photo of the customer' },
];

const ALLOWED_DOC_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_DOC_SIZE = 5 * 1024 * 1024; // 5MB

interface UploadedDocument {
  name: string;
  url: string;
  path: string;
  size: number;
  uploaded_at: string;
}

function isImageDoc(doc: { url: string; name: string }): boolean {
  return /\.(jpe?g|png|webp|gif)$/i.test(doc.name) || /\.(jpe?g|png|webp|gif)$/i.test(doc.url);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function getCustomerDocuments(c: Customer | null): Partial<Record<DocSlot, UploadedDocument>> {
  if (!c) return {};
  const meta =
    c.metadata && typeof c.metadata === 'object' && !Array.isArray(c.metadata)
      ? (c.metadata as Record<string, unknown>)
      : {};
  const docs = meta.documents;
  return docs && typeof docs === 'object' && !Array.isArray(docs)
    ? (docs as Partial<Record<DocSlot, UploadedDocument>>)
    : {};
}

// ---- Form -------------------------------------------------------------

interface CustomerForm {
  customer_type: CustomerType;
  first_name: string;
  last_name: string;
  business_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  id_type: string;
  id_number: string;
  id_expiry: string;
  date_of_birth: string;
  nationality: string;
  gender: string;
  occupation: string;
  source_of_funds: string;
  is_pep: boolean;
}

const EMPTY_FORM: CustomerForm = {
  customer_type: 'individual',
  first_name: '',
  last_name: '',
  business_name: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  country: '',
  id_type: '',
  id_number: '',
  id_expiry: '',
  date_of_birth: '',
  nationality: '',
  gender: '',
  occupation: '',
  source_of_funds: '',
  is_pep: false,
};

function customerDisplayName(c: Customer): string {
  if (c.customer_type !== 'individual') return c.business_name || 'Unnamed business';
  return `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unnamed';
}

function fmtDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

export function CustomersPage() {
  const { tenant, branch, admin } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Create / edit form
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState<CustomerForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Identification documents (form state)
  const [pendingFiles, setPendingFiles] = useState<Partial<Record<DocSlot, File>>>({});
  const [previewUrls, setPreviewUrls] = useState<Partial<Record<DocSlot, string>>>({});
  const [savedDocuments, setSavedDocuments] = useState<Partial<Record<DocSlot, UploadedDocument>>>({});
  const [removedSlots, setRemovedSlots] = useState<Set<DocSlot>>(new Set());
  const [docErrors, setDocErrors] = useState<Partial<Record<DocSlot, string>>>({});
  const [docUploading, setDocUploading] = useState(false);
  const fileInputRefs = useRef<Partial<Record<DocSlot, HTMLInputElement | null>>>({});

  // Detail / KYC review modal
  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [showRejectReason, setShowRejectReason] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // Compliance actions (KYC verify/reject, AML clear/flag, freeze/close) are
  // restricted to compliance-capable roles. Everyone else gets read-only view.
  const canReview =
    admin?.role === 'super_admin' ||
    admin?.role === 'institution_admin' ||
    admin?.role === 'head_office_admin' ||
    admin?.role === 'branch_manager' ||
    admin?.role === 'compliance_officer' ||
    admin?.role === 'customer_service';

  const loadCustomers = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    setLoadError(null);
    try {
      let query = supabase
        .from('customers')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });

      if (branch) {
        query = query.eq('branch_id', branch.id);
      }

      const { data, error: queryError } = await query;
      if (queryError) throw queryError;
      setCustomers((data ?? []) as Customer[]);
    } catch (err) {
      console.error('Error loading customers:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load customers');
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [tenant, branch]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  // Keep the open detail modal in sync with refreshed data.
  useEffect(() => {
    if (detailCustomer) {
      const updated = customers.find((c) => c.id === detailCustomer.id);
      if (updated) setDetailCustomer(updated);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers]);

  // Revoke any local object URLs on unmount so we don't leak memory.
  useEffect(() => {
    return () => {
      Object.values(previewUrls).forEach((url) => url && URL.revokeObjectURL(url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredCustomers = customers.filter((c) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      q === '' ||
      c.first_name?.toLowerCase().includes(q) ||
      c.last_name?.toLowerCase().includes(q) ||
      c.business_name?.toLowerCase().includes(q) ||
      c.phone.includes(searchQuery.trim()) ||
      c.email?.toLowerCase().includes(q) ||
      c.customer_number?.toLowerCase().includes(q);

    const matchesFilter = filterStatus === 'all' || c.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const validateForm = (): string | null => {
    if (formData.customer_type === 'individual') {
      if (!formData.first_name.trim()) return 'First name is required.';
      if (!formData.last_name.trim()) return 'Last name is required.';
      if (!formData.date_of_birth) return 'Date of birth is required.';
    } else {
      if (!formData.business_name.trim()) return 'Business/organization name is required.';
    }
    if (!formData.phone.trim()) return 'Phone number is required.';
    if (formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      return 'Please enter a valid email address.';
    }
    if (!formData.id_type) return 'ID type is required.';
    if (!formData.id_number.trim()) return 'ID number is required.';
    return null;
  };

  // ---- Document handling ---------------------------------------------------

  const resetDocumentState = () => {
    Object.values(previewUrls).forEach((url) => url && URL.revokeObjectURL(url));
    setPendingFiles({});
    setPreviewUrls({});
    setSavedDocuments({});
    setRemovedSlots(new Set());
    setDocErrors({});
  };

  const handleFileSelect = (slot: DocSlot, file: File | undefined) => {
    if (!file) return;
    setDocErrors((prev) => ({ ...prev, [slot]: undefined }));

    if (!ALLOWED_DOC_TYPES.includes(file.type)) {
      setDocErrors((prev) => ({ ...prev, [slot]: 'Only JPG, PNG, WEBP, or PDF files are allowed.' }));
      return;
    }
    if (file.size > MAX_DOC_SIZE) {
      setDocErrors((prev) => ({ ...prev, [slot]: 'File must be smaller than 5MB.' }));
      return;
    }

    setPendingFiles((prev) => ({ ...prev, [slot]: file }));
    setRemovedSlots((prev) => {
      const next = new Set(prev);
      next.delete(slot);
      return next;
    });

    setPreviewUrls((prev) => {
      const next = { ...prev };
      if (next[slot]) URL.revokeObjectURL(next[slot]!);
      if (file.type.startsWith('image/')) {
        next[slot] = URL.createObjectURL(file);
      } else {
        delete next[slot];
      }
      return next;
    });
  };

  const clearDocumentSlot = (slot: DocSlot) => {
    setPendingFiles((prev) => {
      const next = { ...prev };
      delete next[slot];
      return next;
    });
    setPreviewUrls((prev) => {
      const url = prev[slot];
      if (url) URL.revokeObjectURL(url);
      const next = { ...prev };
      delete next[slot];
      return next;
    });
    if (savedDocuments[slot]) {
      setRemovedSlots((prev) => new Set(prev).add(slot));
    }
    setDocErrors((prev) => ({ ...prev, [slot]: undefined }));
    const input = fileInputRefs.current[slot];
    if (input) input.value = '';
  };

  // Uploads any newly-selected files and applies any removals, returning the
  // merged documents map to persist on the customer's metadata. Runs only
  // once we have a real customer id (new customers are inserted first).
  const uploadDocuments = async (
    customerId: string
  ): Promise<Partial<Record<DocSlot, UploadedDocument>>> => {
    if (!tenant) throw new Error('No institution context found.');
    const results: Partial<Record<DocSlot, UploadedDocument>> = { ...savedDocuments };

    for (const slot of removedSlots) {
      const existing = savedDocuments[slot];
      if (existing?.path) {
        await supabase.storage.from('customer-documents').remove([existing.path]).catch(() => {
          // Best-effort: don't let a storage hiccup block saving the customer.
        });
      }
      delete results[slot];
    }

    const entries = Object.entries(pendingFiles) as [DocSlot, File][];
    for (const [slot, file] of entries) {
      const ext = file.name.split('.').pop() || 'bin';
      const path = `${tenant.id}/${customerId}/${slot}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('customer-documents')
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: publicUrlData } = supabase.storage.from('customer-documents').getPublicUrl(path);
      results[slot] = {
        name: file.name,
        url: publicUrlData.publicUrl,
        path,
        size: file.size,
        uploaded_at: new Date().toISOString(),
      };
    }

    return results;
  };

  const openCreateForm = () => {
    setEditingCustomer(null);
    setFormData(EMPTY_FORM);
    setError(null);
    resetDocumentState();
    setShowForm(true);
  };

  const openEditForm = (customer: Customer) => {
    const meta =
      customer.metadata && typeof customer.metadata === 'object' && !Array.isArray(customer.metadata)
        ? (customer.metadata as Record<string, unknown>)
        : {};
    const compliance =
      meta.compliance && typeof meta.compliance === 'object' && !Array.isArray(meta.compliance)
        ? (meta.compliance as Record<string, unknown>)
        : {};

    setEditingCustomer(customer);
    setFormData({
      customer_type: customer.customer_type,
      first_name: customer.first_name ?? '',
      last_name: customer.last_name ?? '',
      business_name: customer.business_name ?? '',
      email: customer.email ?? '',
      phone: customer.phone,
      address: customer.address ?? '',
      city: customer.city ?? '',
      country: customer.country ?? '',
      id_type: customer.id_type ?? '',
      id_number: customer.id_number ?? '',
      id_expiry: customer.id_expiry ? customer.id_expiry.slice(0, 10) : '',
      date_of_birth: customer.date_of_birth ? customer.date_of_birth.slice(0, 10) : '',
      nationality: customer.nationality ?? '',
      gender: typeof compliance.gender === 'string' ? compliance.gender : '',
      occupation: typeof compliance.occupation === 'string' ? compliance.occupation : '',
      source_of_funds: typeof compliance.source_of_funds === 'string' ? compliance.source_of_funds : '',
      is_pep: compliance.is_pep === true,
    });
    setError(null);
    resetDocumentState();
    setSavedDocuments(getCustomerDocuments(customer));
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingCustomer(null);
    setFormData(EMPTY_FORM);
    setError(null);
    resetDocumentState();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!tenant) {
      setError('No institution context found. Please sign in again.');
      return;
    }

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const trimmedEmail = formData.email.trim();
      // date_of_birth and nationality are real columns on `customers`, so they
      // go in the main insert/update payload below. The remaining fields have
      // no dedicated columns yet, so they live under metadata.compliance.
      const compliance = {
        gender: formData.gender || null,
        occupation: formData.occupation.trim() || null,
        source_of_funds: formData.source_of_funds || null,
        is_pep: formData.is_pep,
      };

      let customerId: string;

      if (editingCustomer) {
        // UPDATE existing customer. Do not touch KYC/AML/status here; those are
        // managed through the review modal so an edit can't silently re-open a
        // verified record.
        const existingMeta =
          editingCustomer.metadata &&
          typeof editingCustomer.metadata === 'object' &&
          !Array.isArray(editingCustomer.metadata)
            ? (editingCustomer.metadata as Record<string, unknown>)
            : {};
        const { error: updateError } = await supabase
          .from('customers')
          .update({
            customer_type: formData.customer_type,
            first_name: formData.first_name.trim() || null,
            last_name: formData.last_name.trim() || null,
            business_name: formData.business_name.trim() || null,
            email: trimmedEmail || null,
            phone: formData.phone.trim(),
            address: formData.address.trim() || null,
            city: formData.city.trim() || null,
            country: formData.country.trim() || null,
            id_type: formData.id_type || null,
            id_number: formData.id_number.trim() || null,
            id_expiry: formData.id_expiry || null,
            date_of_birth: formData.date_of_birth || null,
            nationality: formData.nationality.trim() || null,
            metadata: { ...existingMeta, compliance },
          })
          .eq('id', editingCustomer.id)
          .eq('tenant_id', tenant.id);
        if (updateError) throw updateError;
        customerId = editingCustomer.id;
      } else {
        // CREATE. Empty strings for optional text -> null; date MUST be null
        // when blank (Postgres rejects '' for a date).
        const insert: InsertTables<'customers'> = {
          tenant_id: tenant.id,
          branch_id: branch?.id ?? null,
          customer_type: formData.customer_type,
          first_name: formData.first_name.trim() || null,
          last_name: formData.last_name.trim() || null,
          business_name: formData.business_name.trim() || null,
          email: trimmedEmail || null,
          phone: formData.phone.trim(),
          address: formData.address.trim() || null,
          city: formData.city.trim() || null,
          country: formData.country.trim() || null,
          id_type: formData.id_type || null,
          id_number: formData.id_number.trim() || null,
          id_expiry: formData.id_expiry || null,
          date_of_birth: formData.date_of_birth || null,
          nationality: formData.nationality.trim() || null,
          kyc_status: 'pending',
          aml_status: 'pending',
          status: 'active',
          metadata: { compliance },
        };
        const { data: inserted, error: insertError } = await supabase
          .from('customers')
          .insert(insert)
          .select('id')
          .single();
        if (insertError) throw insertError;
        customerId = inserted.id;
      }

      // Upload / remove identification documents now that we have a real id.
      if (Object.keys(pendingFiles).length > 0 || removedSlots.size > 0) {
        setDocUploading(true);
        try {
          const documents = await uploadDocuments(customerId);
          const { data: currentRow, error: fetchMetaError } = await supabase
            .from('customers')
            .select('metadata')
            .eq('id', customerId)
            .single();
          if (fetchMetaError) throw fetchMetaError;
          const currentMeta =
            currentRow?.metadata &&
            typeof currentRow.metadata === 'object' &&
            !Array.isArray(currentRow.metadata)
              ? (currentRow.metadata as Record<string, unknown>)
              : {};
          const { error: docUpdateError } = await supabase
            .from('customers')
            .update({ metadata: { ...currentMeta, documents } as any })
            .eq('id', customerId)
            .eq('tenant_id', tenant.id);
          if (docUpdateError) throw docUpdateError;
        } finally {
          setDocUploading(false);
        }
      }

      await loadCustomers();
      closeForm();
    } catch (err) {
      console.error('Error saving customer:', err);
      setError(err instanceof Error ? err.message : 'Failed to save customer');
    } finally {
      setSubmitting(false);
    }
  };

  // ---- KYC / AML review actions -------------------------------------------

  const openDetail = (customer: Customer) => {
    setDetailCustomer(customer);
    setReviewError(null);
    setShowRejectReason(false);
    setRejectReason('');
  };

  const closeDetail = () => {
    setDetailCustomer(null);
    setReviewError(null);
    setShowRejectReason(false);
    setRejectReason('');
  };

  const patchCustomer = async (id: string, patch: Partial<Omit<InsertTables<'customers'>, 'tenant_id'>>) => {
    if (!tenant) throw new Error('No institution context found.');
    const { error: updateError } = await supabase
      .from('customers')
      .update(patch)
      .eq('id', id)
      .eq('tenant_id', tenant.id);
    if (updateError) throw updateError;
  };

  const verifyKyc = async (customer: Customer) => {
    if (!canReview) return;
    setReviewBusy(true);
    setReviewError(null);
    try {
      const existingMeta =
        customer.metadata && typeof customer.metadata === 'object' && !Array.isArray(customer.metadata)
          ? (customer.metadata as Record<string, unknown>)
          : {};
      await patchCustomer(customer.id, {
        kyc_status: 'verified',
        metadata: {
          ...existingMeta,
          kyc_verified_at: new Date().toISOString(),
          kyc_verified_by: admin?.id ?? null,
        },
      });
      await loadCustomers();
    } catch (err) {
      console.error('Error verifying KYC:', err);
      setReviewError(err instanceof Error ? err.message : 'Failed to verify KYC');
    } finally {
      setReviewBusy(false);
    }
  };

  const rejectKyc = async (customer: Customer) => {
    if (!canReview) return;
    if (!rejectReason.trim()) {
      setReviewError('A rejection reason is required.');
      return;
    }
    setReviewBusy(true);
    setReviewError(null);
    try {
      // Store the reason on metadata so it isn't lost (schema has no dedicated
      // kyc_rejection_reason column).
      const existingMeta =
        customer.metadata && typeof customer.metadata === 'object' && !Array.isArray(customer.metadata)
          ? (customer.metadata as Record<string, unknown>)
          : {};
      await patchCustomer(customer.id, {
        kyc_status: 'rejected',
        metadata: {
          ...existingMeta,
          kyc_rejection_reason: rejectReason.trim(),
          kyc_rejected_at: new Date().toISOString(),
          kyc_verified_at: null,
          kyc_verified_by: null,
        },
      });
      await loadCustomers();
      setShowRejectReason(false);
      setRejectReason('');
    } catch (err) {
      console.error('Error rejecting KYC:', err);
      setReviewError(err instanceof Error ? err.message : 'Failed to reject KYC');
    } finally {
      setReviewBusy(false);
    }
  };

  const setAml = async (customer: Customer, status: 'clear' | 'flagged') => {
    if (!canReview) return;
    setReviewBusy(true);
    setReviewError(null);
    try {
      const existingMeta = customer.metadata ?? {};
      await patchCustomer(customer.id, {
        aml_status: status,
        metadata: {
          ...existingMeta,
          aml_checked_at: new Date().toISOString(),
        },
      });
      await loadCustomers();
    } catch (err) {
      console.error('Error updating AML status:', err);
      setReviewError(err instanceof Error ? err.message : 'Failed to update AML status');
    } finally {
      setReviewBusy(false);
    }
  };

  const setAccountStatus = async (customer: Customer, status: 'active' | 'frozen' | 'closed') => {
    if (!canReview) return;
    setReviewBusy(true);
    setReviewError(null);
    try {
      await patchCustomer(customer.id, { status });
      await loadCustomers();
    } catch (err) {
      console.error('Error updating account status:', err);
      setReviewError(err instanceof Error ? err.message : 'Failed to update account status');
    } finally {
      setReviewBusy(false);
    }
  };

  // ---- Badges --------------------------------------------------------------

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: 'bg-[#1ebcb2]/10 text-[#1ebcb2]',
      frozen: 'bg-[#ee7b22]/10 text-[#ee7b22]',
      closed: 'bg-slate-100 text-slate-600',
    };
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${styles[status] || styles.active}`}>
        {status}
      </span>
    );
  };

  const getKycBadge = (status: string) => {
    const icons: Record<string, React.ReactNode> = {
      verified: <CheckCircle className="w-4 h-4" />,
      pending: <Clock className="w-4 h-4" />,
      rejected: <XCircle className="w-4 h-4" />,
      expired: <AlertCircle className="w-4 h-4" />,
    };
    const colors: Record<string, string> = {
      verified: 'bg-[#1ebcb2]/10 text-[#1ebcb2]',
      pending: 'bg-[#ee7b22]/10 text-[#ee7b22]',
      rejected: 'bg-[#c46040]/10 text-[#c46040]',
      expired: 'bg-[#ee7b22]/10 text-[#ee7b22]',
    };
    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium capitalize ${colors[status] || colors.pending}`}>
        {icons[status] || icons.pending}
        KYC: {status}
      </span>
    );
  };

  const getAmlBadge = (status: string) => {
    const colors: Record<string, string> = {
      clear: 'bg-[#1ebcb2]/10 text-[#1ebcb2]',
      pending: 'bg-[#ee7b22]/10 text-[#ee7b22]',
      flagged: 'bg-[#c46040]/10 text-[#c46040]',
      blocked: 'bg-[#c46040]/10 text-[#c46040]',
    };
    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium capitalize ${colors[status] || colors.pending}`}>
        <ShieldAlert className="w-4 h-4" />
        AML: {status}
      </span>
    );
  };

  const typeIcon = (type: CustomerType) => {
    if (type === 'business') return <Building className="w-6 h-6" />;
    if (type === 'organization') return <Landmark className="w-6 h-6" />;
    return <User className="w-6 h-6" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#641f60]">Customers</h1>
          <p className="text-slate-600 mt-1">Manage your customer accounts and KYC verification</p>
        </div>
        <button
          onClick={openCreateForm}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#ee7b22] hover:bg-[#c46040] text-white font-medium rounded-lg shadow-lg hover:shadow-xl transition-all"
        >
          <Plus className="w-5 h-5" />
          Add Customer
        </button>
      </div>

      {/* Load error banner */}
      {loadError && (
        <div className="bg-[#c46040]/10 border border-[#c46040]/30 rounded-xl p-4 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-[#c46040]/15 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-6 h-6 text-[#c46040]" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-[#c46040]">Couldn&rsquo;t load customers</h3>
            <p className="text-sm text-slate-600">{loadError}</p>
          </div>
          <button
            onClick={loadCustomers}
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
              placeholder="Search by name, phone, email, or customer number..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent transition-all"
            />
          </div>
          <div className="flex items-center gap-3">
            <Filter className="w-5 h-5 text-slate-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent transition-all"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="frozen">Frozen</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Customer list */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#641f60]" />
          </div>
        ) : filteredCustomers.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {filteredCustomers.map((customer) => (
              <div key={customer.id} className="px-4 sm:px-6 py-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#641f60] to-[#4a1646] flex items-center justify-center text-white font-medium flex-shrink-0">
                    {customer.customer_type !== 'individual' ? (
                      typeIcon(customer.customer_type)
                    ) : (
                      (customer.first_name?.[0] || '') + (customer.last_name?.[0] || '') || (
                        <User className="w-6 h-6" />
                      )
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-4">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-slate-900 truncate">
                          {customerDisplayName(customer)}
                        </h3>
                        <p className="text-sm text-slate-500">{customer.customer_number}</p>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-3 flex-wrap flex-shrink-0">
                        {getKycBadge(customer.kyc_status)}
                        {getStatusBadge(customer.status)}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-2 text-sm text-slate-600">
                      <span className="flex items-center gap-1.5">
                        <Phone className="w-4 h-4" />
                        {customer.phone}
                      </span>
                      {customer.email && (
                        <span className="flex items-center gap-1.5">
                          <Mail className="w-4 h-4" />
                          {customer.email}
                        </span>
                      )}
                      {customer.city && (
                        <span className="flex items-center gap-1.5">
                          <MapPin className="w-4 h-4" />
                          {customer.city}
                          {customer.country ? `, ${customer.country}` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => openDetail(customer)}
                      className="p-2 rounded-lg text-slate-400 hover:text-[#641f60] hover:bg-slate-100 transition-colors"
                      aria-label="View customer"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => openEditForm(customer)}
                      className="p-2 rounded-lg text-slate-400 hover:text-[#641f60] hover:bg-slate-100 transition-colors"
                      aria-label="Edit customer"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <User className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">No customers found</h3>
            <p className="text-slate-500 text-center max-w-sm">
              {searchQuery || filterStatus !== 'all'
                ? 'No customers match your search or filter. Try adjusting them.'
                : 'Get started by adding your first customer to the system.'}
            </p>
            {!searchQuery && filterStatus === 'all' && (
              <button
                onClick={openCreateForm}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#ee7b22] hover:bg-[#c46040] text-white font-medium rounded-lg transition-colors"
              >
                <Plus className="w-5 h-5" />
                Add First Customer
              </button>
            )}
          </div>
        )}
      </div>

      {/* Add / Edit Customer Modal — bottom sheet on mobile, centered dialog on desktop, always scrollable */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto overscroll-contain">
            <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-lg sm:text-xl font-bold text-[#641f60]">
                {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
              </h2>
              <button
                onClick={closeForm}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-6">
              {/* Customer Type */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Customer Type</label>
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  {(['individual', 'business', 'organization'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, customer_type: type }))}
                      className={`p-3 sm:p-4 rounded-lg border-2 text-center transition-all flex flex-col items-center gap-1.5 ${
                        formData.customer_type === type
                          ? 'border-[#641f60] bg-[#641f60]/5 text-[#641f60]'
                          : 'border-slate-200 hover:border-slate-300 text-slate-500'
                      }`}
                    >
                      {type === 'individual' ? (
                        <User className="w-5 h-5 sm:w-6 sm:h-6" />
                      ) : type === 'business' ? (
                        <Building className="w-5 h-5 sm:w-6 sm:h-6" />
                      ) : (
                        <Landmark className="w-5 h-5 sm:w-6 sm:h-6" />
                      )}
                      <span className="text-xs sm:text-sm font-medium capitalize">{type}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Name */}
              <div className="grid md:grid-cols-2 gap-4">
                {formData.customer_type === 'individual' ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">First Name *</label>
                      <input
                        type="text"
                        required
                        value={formData.first_name}
                        onChange={(e) => setFormData((prev) => ({ ...prev, first_name: e.target.value }))}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Last Name *</label>
                      <input
                        type="text"
                        required
                        value={formData.last_name}
                        onChange={(e) => setFormData((prev) => ({ ...prev, last_name: e.target.value }))}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                      />
                    </div>
                  </>
                ) : (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Business/Organization Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.business_name}
                      onChange={(e) => setFormData((prev) => ({ ...prev, business_name: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                    />
                  </div>
                )}
              </div>

              {/* Contact */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                    placeholder="+254..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                    placeholder="email@example.com"
                  />
                </div>
              </div>

              {/* Address */}
              <div className="grid md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Physical Address</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                    placeholder="Street address"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData((prev) => ({ ...prev, city: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Country</label>
                <input
                  type="text"
                  value={formData.country}
                  onChange={(e) => setFormData((prev) => ({ ...prev, country: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                  placeholder="Kenya"
                />
              </div>

              {/* Identification & Compliance */}
              <div className="border-t border-slate-200 pt-6">
                <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-[#641f60]" />
                  Identification &amp; Compliance
                </h3>

                {/* Core identity details */}
                <div className="grid sm:grid-cols-2 gap-4 mb-4">
                  {formData.customer_type === 'individual' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Date of Birth *</label>
                      <input
                        type="date"
                        required
                        value={formData.date_of_birth}
                        onChange={(e) => setFormData((prev) => ({ ...prev, date_of_birth: e.target.value }))}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nationality</label>
                    <input
                      type="text"
                      value={formData.nationality}
                      onChange={(e) => setFormData((prev) => ({ ...prev, nationality: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                      placeholder="Kenyan"
                    />
                  </div>
                  {formData.customer_type === 'individual' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Gender</label>
                      <select
                        value={formData.gender}
                        onChange={(e) => setFormData((prev) => ({ ...prev, gender: e.target.value }))}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                      >
                        <option value="">Select gender</option>
                        <option value="female">Female</option>
                        <option value="male">Male</option>
                        <option value="other">Other</option>
                        <option value="prefer_not_to_say">Prefer not to say</option>
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Occupation</label>
                    <input
                      type="text"
                      value={formData.occupation}
                      onChange={(e) => setFormData((prev) => ({ ...prev, occupation: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                      placeholder="e.g. Teacher, Shop owner"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Source of Funds</label>
                    <select
                      value={formData.source_of_funds}
                      onChange={(e) => setFormData((prev) => ({ ...prev, source_of_funds: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                    >
                      <option value="">Select source</option>
                      <option value="salary">Salary/Employment</option>
                      <option value="business_income">Business Income</option>
                      <option value="investments">Investments</option>
                      <option value="inheritance">Inheritance</option>
                      <option value="remittance">Remittance</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2 sm:pt-7">
                    <input
                      id="is_pep"
                      type="checkbox"
                      checked={formData.is_pep}
                      onChange={(e) => setFormData((prev) => ({ ...prev, is_pep: e.target.checked }))}
                      className="w-4 h-4 rounded border-slate-300 text-[#641f60] focus:ring-[#1ebcb2]"
                    />
                    <label htmlFor="is_pep" className="text-sm text-slate-700">
                      Politically Exposed Person (PEP)
                    </label>
                  </div>
                </div>

                {/* ID document details */}
                <div className="grid md:grid-cols-3 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">ID Type *</label>
                    <select
                      required
                      value={formData.id_type}
                      onChange={(e) => setFormData((prev) => ({ ...prev, id_type: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                    >
                      <option value="">Select ID type</option>
                      <option value="national_id">National ID</option>
                      <option value="passport">Passport</option>
                      <option value="driving_license">Driving License</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">ID Number *</label>
                    <input
                      type="text"
                      required
                      value={formData.id_number}
                      onChange={(e) => setFormData((prev) => ({ ...prev, id_number: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Expiry Date</label>
                    <input
                      type="date"
                      value={formData.id_expiry}
                      onChange={(e) => setFormData((prev) => ({ ...prev, id_expiry: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Document uploads */}
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-1">Supporting Documents</p>
                  <p className="text-xs text-slate-500 mb-3">
                    Upload clear photos or scans (JPG, PNG, or PDF, up to 5MB each).
                  </p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {DOC_SLOTS.map((slot) => {
                      const pendingFile = pendingFiles[slot.key];
                      const preview = previewUrls[slot.key];
                      const saved = !removedSlots.has(slot.key) ? savedDocuments[slot.key] : undefined;
                      const docError = docErrors[slot.key];
                      const hasFile = !!pendingFile || !!saved;

                      return (
                        <div
                          key={slot.key}
                          className={`relative rounded-lg border-2 border-dashed p-3 transition-colors ${
                            docError
                              ? 'border-[#c46040] bg-[#c46040]/5'
                              : hasFile
                              ? 'border-[#1ebcb2] bg-[#1ebcb2]/5'
                              : 'border-slate-300 hover:border-slate-400'
                          }`}
                        >
                          <input
                            ref={(el) => (fileInputRefs.current[slot.key] = el)}
                            type="file"
                            accept="image/jpeg,image/png,image/webp,application/pdf"
                            className="hidden"
                            onChange={(e) => handleFileSelect(slot.key, e.target.files?.[0])}
                          />

                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className="text-xs font-semibold text-slate-700">{slot.label}</p>
                            {hasFile && (
                              <button
                                type="button"
                                onClick={() => clearDocumentSlot(slot.key)}
                                className="text-slate-400 hover:text-[#c46040] transition-colors flex-shrink-0"
                                aria-label={`Remove ${slot.label}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>

                          {!hasFile ? (
                            <button
                              type="button"
                              onClick={() => fileInputRefs.current[slot.key]?.click()}
                              className="w-full flex flex-col items-center justify-center gap-1.5 py-4 text-slate-400 hover:text-[#641f60] transition-colors"
                            >
                              <Upload className="w-6 h-6" />
                              <span className="text-xs">{slot.hint}</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => fileInputRefs.current[slot.key]?.click()}
                              className="w-full flex items-center gap-2.5 text-left"
                            >
                              {preview ? (
                                <img
                                  src={preview}
                                  alt={`${slot.label} preview`}
                                  className="w-12 h-12 rounded-md object-cover border border-slate-200 flex-shrink-0"
                                />
                              ) : saved && isImageDoc(saved) ? (
                                <img
                                  src={saved.url}
                                  alt={`${slot.label} preview`}
                                  className="w-12 h-12 rounded-md object-cover border border-slate-200 flex-shrink-0"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-md bg-slate-100 flex items-center justify-center flex-shrink-0">
                                  <FileText className="w-6 h-6 text-slate-400" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-slate-700 truncate">
                                  {pendingFile?.name || saved?.name}
                                </p>
                                <p className="text-[11px] text-slate-500">
                                  {pendingFile
                                    ? `${formatFileSize(pendingFile.size)} · pending upload`
                                    : saved
                                    ? `${formatFileSize(saved.size)} · uploaded`
                                    : ''}
                                </p>
                              </div>
                            </button>
                          )}

                          {docError && <p className="text-[11px] text-[#c46040] mt-1">{docError}</p>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-4 bg-[#c46040]/10 border border-[#c46040]/30 rounded-lg text-[#c46040] text-sm">
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={closeForm}
                  className="px-4 py-2.5 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 bg-[#ee7b22] hover:bg-[#c46040] text-white font-medium rounded-lg shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {docUploading ? 'Uploading documents...' : editingCustomer ? 'Saving...' : 'Creating...'}
                    </>
                  ) : editingCustomer ? (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Save Changes
                    </>
                  ) : (
                    <>
                      <Plus className="w-5 h-5" />
                      Create Customer
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail / KYC review Modal */}
      {detailCustomer && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto overscroll-contain">
            <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-lg sm:text-xl font-bold text-[#641f60]">Customer Details</h2>
              <button
                onClick={closeDetail}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-6">
              {/* Identity header */}
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#641f60] to-[#4a1646] flex items-center justify-center text-white flex-shrink-0">
                  {detailCustomer.customer_type !== 'individual' ? (
                    typeIcon(detailCustomer.customer_type)
                  ) : (
                    <span className="font-semibold">
                      {(detailCustomer.first_name?.[0] || '') + (detailCustomer.last_name?.[0] || '') || 'U'}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-slate-900">{customerDisplayName(detailCustomer)}</h3>
                  <p className="text-sm text-slate-500">
                    {detailCustomer.customer_number} &middot;{' '}
                    <span className="capitalize">{detailCustomer.customer_type}</span>
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {getKycBadge(detailCustomer.kyc_status)}
                    {getAmlBadge(detailCustomer.aml_status)}
                    {getStatusBadge(detailCustomer.status)}
                  </div>
                </div>
              </div>

              {/* Contact + ID grid */}
              <div className="grid sm:grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-400 uppercase">Contact</p>
                  <p className="flex items-center gap-2 text-slate-700">
                    <Phone className="w-4 h-4 text-slate-400" />
                    {detailCustomer.phone}
                  </p>
                  {detailCustomer.email && (
                    <p className="flex items-center gap-2 text-slate-700">
                      <Mail className="w-4 h-4 text-slate-400" />
                      {detailCustomer.email}
                    </p>
                  )}
                  {(detailCustomer.city || detailCustomer.country || detailCustomer.address) && (
                    <p className="flex items-center gap-2 text-slate-700">
                      <MapPin className="w-4 h-4 text-slate-400" />
                      {[detailCustomer.address, detailCustomer.city, detailCustomer.country]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-400 uppercase">Identification</p>
                  <p className="text-slate-700">
                    <span className="text-slate-400">Type: </span>
                    {detailCustomer.id_type ? detailCustomer.id_type.replace(/_/g, ' ') : '—'}
                  </p>
                  <p className="text-slate-700">
                    <span className="text-slate-400">Number: </span>
                    {detailCustomer.id_number || '—'}
                  </p>
                  <p className="flex items-center gap-2 text-slate-700">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-400">Expiry: </span>
                    {fmtDate(detailCustomer.id_expiry)}
                  </p>
                </div>
              </div>

              {/* Compliance details, if captured */}
              {(() => {
                const meta =
                  detailCustomer.metadata &&
                  typeof detailCustomer.metadata === 'object' &&
                  !Array.isArray(detailCustomer.metadata)
                    ? (detailCustomer.metadata as Record<string, unknown>)
                    : {};
                const compliance =
                  meta.compliance && typeof meta.compliance === 'object' && !Array.isArray(meta.compliance)
                    ? (meta.compliance as Record<string, unknown>)
                    : {};
                // date_of_birth and nationality live on the customer row itself;
                // show the section whenever any compliance-relevant field exists.
                const hasAnyData =
                  !!detailCustomer.date_of_birth ||
                  !!detailCustomer.nationality ||
                  !!compliance.gender ||
                  !!compliance.occupation ||
                  !!compliance.source_of_funds ||
                  compliance.is_pep === true;
                if (!hasAnyData) return null;
                const rows: [string, string][] = [
                  ['Date of Birth', fmtDate(detailCustomer.date_of_birth)],
                  ['Nationality', detailCustomer.nationality || '—'],
                  ['Gender', typeof compliance.gender === 'string' && compliance.gender ? compliance.gender.replace(/_/g, ' ') : '—'],
                  ['Occupation', typeof compliance.occupation === 'string' && compliance.occupation ? compliance.occupation : '—'],
                  ['Source of Funds', typeof compliance.source_of_funds === 'string' && compliance.source_of_funds ? compliance.source_of_funds.replace(/_/g, ' ') : '—'],
                  ['PEP Status', compliance.is_pep === true ? 'Politically Exposed' : 'Not flagged'],
                ];
                return (
                  <div className="border-t border-slate-200 pt-4">
                    <p className="text-xs font-semibold text-slate-400 uppercase mb-2">Compliance Profile</p>
                    <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                      {rows.map(([label, value]) => (
                        <p key={label} className="text-slate-700 capitalize">
                          <span className="text-slate-400 normal-case">{label}: </span>
                          {value}
                        </p>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Uploaded documents */}
              {(() => {
                const docs = getCustomerDocuments(detailCustomer);
                const entries = DOC_SLOTS.map((slot) => ({ slot, doc: docs[slot.key] })).filter((e) => e.doc);
                if (entries.length === 0) return null;
                return (
                  <div className="border-t border-slate-200 pt-4">
                    <p className="text-xs font-semibold text-slate-400 uppercase mb-2">Uploaded Documents</p>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {entries.map(({ slot, doc }) => (
                        <a
                          key={slot.key}
                          href={doc!.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2.5 p-2.5 rounded-lg border border-slate-200 hover:border-[#1ebcb2] transition-colors"
                        >
                          {isImageDoc(doc!) ? (
                            <img
                              src={doc!.url}
                              alt={slot.label}
                              className="w-10 h-10 rounded-md object-cover border border-slate-200 flex-shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-md bg-slate-100 flex items-center justify-center flex-shrink-0">
                              <FileText className="w-5 h-5 text-slate-400" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-slate-700">{slot.label}</p>
                            <p className="text-[11px] text-slate-500 truncate">{doc!.name}</p>
                          </div>
                          <ExternalLink className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        </a>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* KYC / AML review panel */}
              <div className="border-t border-slate-200 pt-6">
                <h3 className="text-sm font-semibold text-slate-900 mb-1 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-[#641f60]" />
                  Compliance Review
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  KYC verified {fmtDate(detailCustomer.kyc_verified_at)} &middot; AML checked{' '}
                  {fmtDate(detailCustomer.aml_checked_at)}
                </p>

                {!canReview ? (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-500">
                    You have view-only access. Compliance actions require a compliance, manager, or admin role.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* KYC actions */}
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-2">KYC Status</p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => verifyKyc(detailCustomer)}
                          disabled={reviewBusy || detailCustomer.kyc_status === 'verified'}
                          className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#1ebcb2] hover:bg-[#159089] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <BadgeCheck className="w-4 h-4" />
                          Verify KYC
                        </button>
                        <button
                          onClick={() => {
                            setShowRejectReason((v) => !v);
                            setReviewError(null);
                          }}
                          disabled={reviewBusy}
                          className="inline-flex items-center gap-1.5 px-3 py-2 border border-[#c46040] text-[#c46040] hover:bg-[#c46040]/10 text-sm font-medium rounded-lg transition-colors disabled:opacity-40"
                        >
                          <XCircle className="w-4 h-4" />
                          Reject KYC
                        </button>
                      </div>

                      {showRejectReason && (
                        <div className="mt-3 space-y-2">
                          <textarea
                            rows={2}
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Reason for rejection (required)..."
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1ebcb2] focus:border-transparent"
                            autoFocus
                          />
                          <button
                            onClick={() => rejectKyc(detailCustomer)}
                            disabled={reviewBusy}
                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#c46040] hover:bg-[#641f60] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40"
                          >
                            {reviewBusy ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <XCircle className="w-4 h-4" />
                            )}
                            Confirm Rejection
                          </button>
                        </div>
                      )}
                    </div>

                    {/* AML actions */}
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-2">AML Screening</p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => setAml(detailCustomer, 'clear')}
                          disabled={reviewBusy || detailCustomer.aml_status === 'clear'}
                          className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#1ebcb2] hover:bg-[#159089] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Mark Clear
                        </button>
                        <button
                          onClick={() => setAml(detailCustomer, 'flagged')}
                          disabled={reviewBusy || detailCustomer.aml_status === 'flagged'}
                          className="inline-flex items-center gap-1.5 px-3 py-2 border border-[#ee7b22] text-[#ee7b22] hover:bg-[#ee7b22]/10 text-sm font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <AlertCircle className="w-4 h-4" />
                          Flag
                        </button>
                      </div>
                    </div>

                    {/* Account status actions */}
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-2">Account Status</p>
                      <div className="flex flex-wrap gap-2">
                        {detailCustomer.status !== 'active' && (
                          <button
                            onClick={() => setAccountStatus(detailCustomer, 'active')}
                            disabled={reviewBusy}
                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#1ebcb2] hover:bg-[#159089] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40"
                          >
                            <RotateCcw className="w-4 h-4" />
                            Reactivate
                          </button>
                        )}
                        {detailCustomer.status !== 'frozen' && (
                          <button
                            onClick={() => setAccountStatus(detailCustomer, 'frozen')}
                            disabled={reviewBusy}
                            className="inline-flex items-center gap-1.5 px-3 py-2 border border-[#ee7b22] text-[#ee7b22] hover:bg-[#ee7b22]/10 text-sm font-medium rounded-lg transition-colors disabled:opacity-40"
                          >
                            <AlertCircle className="w-4 h-4" />
                            Freeze
                          </button>
                        )}
                        {detailCustomer.status !== 'closed' && (
                          <button
                            onClick={() => setAccountStatus(detailCustomer, 'closed')}
                            disabled={reviewBusy}
                            className="inline-flex items-center gap-1.5 px-3 py-2 border border-[#c46040] text-[#c46040] hover:bg-[#c46040]/10 text-sm font-medium rounded-lg transition-colors disabled:opacity-40"
                          >
                            <Ban className="w-4 h-4" />
                            Close
                          </button>
                        )}
                      </div>
                    </div>

                    {reviewError && (
                      <div className="p-3 bg-[#c46040]/10 border border-[#c46040]/30 rounded-lg text-[#c46040] text-sm">
                        {reviewError}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  onClick={() => {
                    const c = detailCustomer;
                    closeDetail();
                    openEditForm(c);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <Edit className="w-4 h-4" />
                  Edit Details
                </button>
                <button
                  onClick={closeDetail}
                  className="px-6 py-2.5 bg-[#641f60] hover:bg-[#4a1646] text-white font-medium rounded-lg transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
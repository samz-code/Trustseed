import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';
import type { Tenant, TenantAdmin, Branch } from '../types';
import { applyBranding, resetBranding } from '../lib/branding';
// [[RBAC]] permission loading
import { fetchMyPermissions } from '../services/permission.service';
import { WILDCARD } from '../constants/permissions';
import { FULL_ACCESS_ROLES } from '../constants/roles';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  tenant: Tenant | null;
  admin: TenantAdmin | null;
  branch: Branch | null;
  branches: Branch[];
  loading: boolean;
  error: string | null;
  // True when this login has no tenant_admins row yet AND signed up via the
  // self-serve flow (pending_provisioning metadata) - i.e. they need to
  // finish paying, not contact an admin.
  needsPayment: boolean;
  pendingPlan: string | null;
  pendingInstitutionName: string | null;
  // [[RBAC]] flat permission set for the signed-in user ('*' => full access),
  // plus helpers. usePermissions() reads these.
  permissions: string[];
  permissionsLoading: boolean;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
  refreshPermissions: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    institutionName: string,
    plan?: string
  ) => Promise<void>;
  signOut: () => Promise<void>;
  setBranch: (branch: Branch) => void;
  refreshTenant: () => Promise<void>;
  completeProvisioning: (institutionName: string, plan?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Pulls brand colors out of tenant settings and applies them as CSS variables.
// Kept here so every path that sets the tenant (initial load, refresh) themes
// the app consistently. Maps secondary->accent too, since the app palette has
// three brand roles but Settings currently exposes primary + secondary.
function applyTenantBranding(tenant: Tenant | null) {
  const settings = tenant?.settings as
    | { branding?: { primary_color?: string | null; secondary_color?: string | null; accent_color?: string | null } }
    | null;
  const branding = settings?.branding;
  applyBranding({
    primary: branding?.primary_color ?? null,
    secondary: branding?.secondary_color ?? null,
    accent: branding?.accent_color ?? branding?.secondary_color ?? null,
  });
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [admin, setAdmin] = useState<TenantAdmin | null>(null);
  const [branch, setBranch] = useState<Branch | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsPayment, setNeedsPayment] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<string | null>(null);
  const [pendingInstitutionName, setPendingInstitutionName] = useState<string | null>(null);
  // [[RBAC]] permission state
  const [permissions, setPermissions] = useState<string[]>([]);
  const [permissionsLoading, setPermissionsLoading] = useState(false);

  // Stable across renders: does not depend on `branch`, so it never forces
  // the auth-state-change effect below to re-subscribe when the user
  // switches branches. Default-branch selection uses a functional update
  // instead, so it always sees the latest `branch` state without needing
  // it in the dependency array.
  //
  // Takes the full User object (not just the id) so it can read
  // user_metadata to tell "awaiting payment" apart from "not an admin".
  const loadUserTenant = useCallback(async (authUser: User) => {
    try {
      const { data: adminData, error: adminError } = await supabase
        .from('tenant_admins')
        .select('*')
        .eq('user_id', authUser.id)
        .eq('status', 'active')
        .maybeSingle();

      if (adminError) throw adminError;

      if (!adminData) {
        setTenant(null);
        setAdmin(null);
        setBranches([]);
        setPermissions([]); // [[RBAC]] no admin row -> no permissions
        applyTenantBranding(null);

        const meta = authUser.user_metadata as {
          pending_provisioning?: boolean;
          plan?: string;
          institution_name?: string;
        } | null;

        if (meta?.pending_provisioning) {
          // Self-serve signup that hasn't completed payment yet.
          setNeedsPayment(true);
          setPendingPlan(meta.plan ?? 'professional');
          setPendingInstitutionName(meta.institution_name ?? null);
          setError(null);
        } else {
          // Account exists in auth but was never linked to a tenant
          // (e.g. invited staff whose provisioning didn't complete).
          setNeedsPayment(false);
          setError('No active staff account found for this login. Contact your administrator.');
        }
        return;
      }

      // Provisioned - clear any stale "needs payment" state.
      setNeedsPayment(false);
      setPendingPlan(null);
      setPendingInstitutionName(null);
      setAdmin(adminData);

      // [[RBAC]] Load this user's permission set (role -> permissions via RPC).
      // Runs here so it stays in sync on initial session, auth-state-change,
      // and refreshTenant() - all of which call loadUserTenant().
      setPermissionsLoading(true);
      const permResult = await fetchMyPermissions();
      setPermissions(permResult.permissions);
      if (permResult.error) console.warn('Permission load:', permResult.error);
      setPermissionsLoading(false);

      const { data: tenantData, error: tenantError } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', adminData.tenant_id)
        .maybeSingle();

      if (tenantError) throw tenantError;
      if (tenantData) {
        setTenant(tenantData as Tenant);
        applyTenantBranding(tenantData as Tenant);
      }

      const { data: branchesData, error: branchesError } = await supabase
        .from('branches')
        .select('*')
        .eq('tenant_id', adminData.tenant_id)
        .eq('status', 'active')
        .order('is_head_office', { ascending: false });

      if (branchesError) throw branchesError;

      const loadedBranches = branchesData || [];
      setBranches(loadedBranches);

      if (loadedBranches.length > 0) {
        setBranch((prev: Branch | null) => {
          if (prev) return prev;
          const headOffice = loadedBranches.find((b: Branch) => b.is_head_office);
          return headOffice || loadedBranches[0];
        });
      }
    } catch (err) {
      console.error('Error loading tenant:', err);
      setError(err instanceof Error ? err.message : 'Failed to load tenant data');
    }
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          (async () => {
            await loadUserTenant(session.user);
            setLoading(false);
          })();
        } else {
          setTenant(null);
          setAdmin(null);
          setBranches([]);
          setBranch(null);
          setPermissions([]); // [[RBAC]] clear on sign-out
          setNeedsPayment(false);
          setPendingPlan(null);
          setPendingInstitutionName(null);
          resetBranding();
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        loadUserTenant(session.user).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadUserTenant]);

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      throw signInError;
    }
  }, []);

  // institutionName + plan travel in user metadata so, if they abandon
  // checkout, the next login knows this is a "finish paying" case rather
  // than a dead orphaned account.
  const signUp = useCallback(
    async (
      email: string,
      password: string,
      fullName: string,
      institutionName: string,
      plan: string = 'professional'
    ) => {
      setError(null);
      setLoading(true);

      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            institution_name: institutionName,
            plan,
            pending_provisioning: true,
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        throw signUpError;
      }

      setPendingPlan(plan);
      setPendingInstitutionName(institutionName);
      setNeedsPayment(true);
      setLoading(false);
    },
    []
  );

  const signOut = useCallback(async () => {
    setError(null);
    const { error: signOutError } = await supabase.auth.signOut();

    if (signOutError) {
      setError(signOutError.message);
      throw signOutError;
    }

    setUser(null);
    setSession(null);
    setTenant(null);
    setAdmin(null);
    setBranches([]);
    setBranch(null);
    setPermissions([]); // [[RBAC]] clear on sign-out
    setNeedsPayment(false);
    setPendingPlan(null);
    setPendingInstitutionName(null);
    resetBranding();
  }, []);

  const refreshTenant = useCallback(async () => {
    if (user) {
      setLoading(true);
      await loadUserTenant(user);
      setLoading(false);
    }
  }, [user, loadUserTenant]);

  // [[RBAC]] Re-fetch permissions without a full tenant reload. Call this after
  // an admin changes a user's role, so the change reflects without a re-login.
  const refreshPermissions = useCallback(async () => {
    if (!admin) {
      setPermissions([]);
      return;
    }
    setPermissionsLoading(true);
    const result = await fetchMyPermissions();
    setPermissions(result.permissions);
    if (result.error) console.warn('Permission refresh:', result.error);
    setPermissionsLoading(false);
  }, [admin]);

  // Call once payment has actually succeeded (placeholder button today,
  // a payment-processor webhook confirmation later). Runs the atomic
  // provisioning function, then reloads tenant state.
  const completeProvisioning = useCallback(
    async (institutionName: string, plan: string = 'professional') => {
      setError(null);
      setLoading(true);
      try {
        // supabase.rpc typings may restrict available function names; cast to any
        const { error: rpcError } = await supabase.rpc(
          ('provision_tenant_after_payment' as unknown) as any,
          { p_institution_name: institutionName, p_plan: plan } as any
        );
        if (rpcError) throw rpcError;

        if (user) {
          await loadUserTenant(user);
        }
        setNeedsPayment(false);
      } catch (err) {
        console.error('Provisioning error:', err);
        setError(err instanceof Error ? err.message : 'Failed to activate your account');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [user, loadUserTenant]
  );

  // [[RBAC]] Convenience checks. Wildcard roles (super_admin/institution_admin)
  // resolve to true even before the permission list arrives, matching the
  // server-side has_permission() short-circuit.
  const isWildcard =
    permissions.includes(WILDCARD) ||
    (!!admin?.role && (FULL_ACCESS_ROLES as string[]).includes(admin.role));

  const hasPermission = useCallback(
    (permission: string) => isWildcard || permissions.includes(permission),
    [isWildcard, permissions]
  );

  const hasRole = useCallback((role: string) => admin?.role === role, [admin?.role]);

  const value: AuthContextType = {
    user,
    session,
    tenant,
    admin,
    branch,
    branches,
    loading,
    error,
    needsPayment,
    pendingPlan,
    pendingInstitutionName,
    permissions, // [[RBAC]]
    permissionsLoading, // [[RBAC]]
    hasPermission, // [[RBAC]]
    hasRole, // [[RBAC]]
    refreshPermissions, // [[RBAC]]
    signIn,
    signUp,
    signOut,
    setBranch,
    refreshTenant,
    completeProvisioning,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
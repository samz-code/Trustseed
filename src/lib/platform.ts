import { supabase } from './supabase';

export interface PlatformMetrics {
  total_institutions: number;
  active_institutions: number;
  suspended_institutions: number;
  total_users: number;
  total_customers: number;
  total_branches: number;
  transaction_volume: number;
  mrr: number; // Monthly Recurring Revenue
}

export interface TenantManagementRow {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'suspended';
  plan_tier: 'starter' | 'growth' | 'enterprise';
  created_at: string;
  branch_count: number;
  user_count: number;
  customer_count: number;
  billing_status: 'active' | 'past_due' | 'grace' | 'canceled';
  monthly_fee: number;
  next_billing_date: string;
}

export interface AuditLogRow {
  id: string;
  action_type: string;
  description: string;
  performed_by_name: string;
  created_at: string;
}

export async function fetchPlatformMetrics(): Promise<PlatformMetrics> {
  // RPC wrapper calling a database aggregate function or compiling table counts
  const { data, error } = await supabase.rpc('get_platform_metrics');
  if (!error && data) return data;
  
  // Fallback graceful query compilation if direct consolidated RPC hasn't completed migrations
  const [tenants, branches, users] = await Promise.all([
    supabase.from('tenants').select('id, status', { count: 'exact' }),
    supabase.from('branches').select('id', { count: 'exact' }),
    supabase.from('tenant_admins').select('id', { count: 'exact' })
  ]);

  const tenantList = tenants.data || [];
  return {
    total_institutions: tenantList.length,
    active_institutions: tenantList.filter(t => t.status === 'active').length,
    suspended_institutions: tenantList.filter(t => t.status === 'suspended').length,
    total_users: users.count || 0,
    total_customers: 0, // Compiled abstract aggregate view boundary
    total_branches: branches.count || 0,
    transaction_volume: 0,
    mrr: tenantList.filter(t => t.status === 'active').length * 150 // Mock logic baseline
  };
}
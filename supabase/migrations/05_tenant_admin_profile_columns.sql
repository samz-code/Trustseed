-- ============================================================================
-- 05_tenant_admin_profile_columns.sql
-- Adds columns DashboardLayout.tsx already reads/writes but the base schema
-- doesn't declare yet. All additive + idempotent.
--   * avatar_gender    -- 'male' | 'female'   (profile modal)
--   * avatar_variant   -- int  (shuffle look) (profile modal)
--   * primary_branch_id-- optional home branch (used by current_branch_id())
-- Without these, the profile "Save Changes" update silently drops the avatar
-- fields (or errors, depending on PostgREST settings).
-- ============================================================================

ALTER TABLE tenant_admins
  ADD COLUMN IF NOT EXISTS avatar_gender text
    CHECK (avatar_gender IN ('male', 'female'));

ALTER TABLE tenant_admins
  ADD COLUMN IF NOT EXISTS avatar_variant integer DEFAULT 0;

ALTER TABLE tenant_admins
  ADD COLUMN IF NOT EXISTS primary_branch_id uuid
    REFERENCES branches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tenant_admins_primary_branch
  ON tenant_admins(primary_branch_id);

-- ============================================================================
-- END 05_tenant_admin_profile_columns.sql
-- ============================================================================
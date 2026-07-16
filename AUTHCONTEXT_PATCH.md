# AuthContext.tsx — RBAC merge patch

Your existing `AuthContext.tsx` already handles signup, provisioning, branding,
`needsPayment`, `refreshTenant`, and branch loading. **Keep all of it.** Apply
these five small edits to add permissions. Each edit is marked so you can find
the exact spot.

---

## Edit 1 — add imports (top of file, with the other imports)

```ts
import { fetchMyPermissions } from '../services/permission.service';
import { WILDCARD } from '../constants/permissions';
import { FULL_ACCESS_ROLES } from '../constants/roles';
```

---

## Edit 2 — extend the context type

In `interface AuthContextType { ... }`, add these fields (anywhere in the block):

```ts
  permissions: string[];
  permissionsLoading: boolean;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
  refreshPermissions: () => Promise<void>;
```

---

## Edit 3 — add state (with the other useState calls)

```ts
  const [permissions, setPermissions] = useState<string[]>([]);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
```

---

## Edit 4 — load + clear permissions alongside the admin row

Your `loadUserTenant` already sets `admin`. Add permission loading in the SAME
places you set/clear the admin.

### 4a. When NO admin row is found (inside `if (!adminData) { ... }`)
Add near the other reset lines (where you `setAdmin(null)`):

```ts
        setPermissions([]);
```

### 4b. Right AFTER `setAdmin(adminData);` (the provisioned branch)
Add:

```ts
        // Load this user's permission set (role -> permissions via RLS RPC).
        setPermissionsLoading(true);
        const permResult = await fetchMyPermissions();
        setPermissions(permResult.permissions);
        if (permResult.error) console.warn('Permission load:', permResult.error);
        setPermissionsLoading(false);
```

> This runs inside `loadUserTenant`, which is already called on initial session,
> on auth-state-change, and by `refreshTenant()` — so permissions stay in sync
> automatically after sign-in and after a `refreshTenant()`.

### 4c. In the signed-out branch of the `onAuthStateChange` effect
Where you already reset `setTenant(null); setAdmin(null); ...`, add:

```ts
          setPermissions([]);
```

### 4d. In `signOut`
Where you reset the other state, add:

```ts
    setPermissions([]);
```

---

## Edit 5 — expose helpers + values

Just BEFORE `const value: AuthContextType = { ... }`, add:

```ts
  const isWildcard =
    permissions.includes(WILDCARD) ||
    (!!admin?.role && (FULL_ACCESS_ROLES as string[]).includes(admin.role));

  const hasPermission = useCallback(
    (permission: string) => isWildcard || permissions.includes(permission),
    [isWildcard, permissions]
  );

  const hasRole = useCallback((role: string) => admin?.role === role, [admin?.role]);

  const refreshPermissions = useCallback(async () => {
    if (!admin) {
      setPermissions([]);
      return;
    }
    setPermissionsLoading(true);
    const result = await fetchMyPermissions();
    setPermissions(result.permissions);
    setPermissionsLoading(false);
  }, [admin]);
```

Then add these to the `value` object:

```ts
    permissions,
    permissionsLoading,
    hasPermission,
    hasRole,
    refreshPermissions,
```

---

That's the whole change. Nothing you already have is removed or renamed.
`usePermissions()` reads `permissions` / `permissionsLoading` from this context,
so once these edits are in, every guard and the dynamic sidebar work.
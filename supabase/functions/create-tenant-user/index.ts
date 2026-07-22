// supabase/functions/create-tenant-user/index.ts
//
// Creates a staff account for an institution, either by emailing an invite or
// by setting a temporary password on the spot.
//
// WHY THIS RUNS SERVER-SIDE
// Creating an auth account requires the service role key, which bypasses all
// Row Level Security. Anyone holding it can read and write every
// institution's data, so it can never reach the browser. This function holds
// it, and refuses to act unless the caller proves they are an admin OF THE
// TENANT they are adding a user to.
//
// TWO MODES
//   invite   - Supabase emails a set-password link. Nobody, including the
//              admin, ever knows the person's password. This is the default.
//   password - The admin sets a temporary password and hands it over. For
//              staff without reliable email, which in a rural branch is a
//              real situation rather than a hypothetical. The account is
//              flagged must_change_password so the temporary one dies at
//              first sign-in: an admin-known password that persists would
//              undermine every audit trail, because "the teller did it"
//              stops being provable.
//
// DEPLOY
//   supabase functions deploy create-tenant-user
//
// The function verifies the caller's JWT, so deploy WITHOUT --no-verify-jwt.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ROLES = [
  'super_admin',
  'institution_admin',
  'head_office_admin',
  'branch_manager',
  'teller',
  'cashier',
  'finance_officer',
  'accountant',
  'loan_officer',
  'forex_officer',
  'customer_service',
  'compliance_officer',
  'auditor',
];

// Only these roles may create staff accounts. A teller cannot mint colleagues.
const CAN_CREATE_USERS = ['super_admin', 'institution_admin', 'head_office_admin'];

// Roles a non-super_admin may not hand out, so an institution_admin cannot
// quietly promote someone above themselves.
const RESTRICTED_ROLES = ['super_admin'];

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !serviceKey || !anonKey) {
      throw new Error('SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SUPABASE_ANON_KEY must be set.');
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ success: false, message: 'Not signed in.' }, 401);
    }

    // 1. Who is calling? Resolved from their own JWT, not from anything they
    //    sent in the body, so the caller cannot claim to be someone else.
    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user: callerUser },
      error: callerErr,
    } = await caller.auth.getUser();

    if (callerErr || !callerUser) {
      return json({ success: false, message: 'Could not verify who is signed in.' }, 401);
    }

    const body = await req.json();
    const {
      tenant_id,
      email,
      full_name,
      role,
      phone,
      mode = 'invite',
      password,
      branch_id,
    } = body ?? {};

    if (!tenant_id || !email || !full_name || !role) {
      return json(
        { success: false, message: 'tenant_id, email, full_name and role are all required.' },
        400
      );
    }
    if (!ALLOWED_ROLES.includes(role)) {
      return json({ success: false, message: `Unknown role: ${role}` }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // 2. Is the caller an admin OF THIS TENANT? Checked against the database
    //    rather than trusted from the request. Someone could call this
    //    endpoint directly with another institution's tenant_id, and this is
    //    what stops them.
    const { data: callerAdmin, error: adminErr } = await admin
      .from('tenant_admins')
      .select('id, role, tenant_id, status')
      .eq('user_id', callerUser.id)
      .eq('tenant_id', tenant_id)
      .eq('status', 'active')
      .maybeSingle();

    if (adminErr) throw adminErr;
    if (!callerAdmin) {
      return json(
        { success: false, message: 'You are not an active member of that institution.' },
        403
      );
    }
    if (!CAN_CREATE_USERS.includes(callerAdmin.role)) {
      return json(
        { success: false, message: 'Your role cannot create staff accounts.' },
        403
      );
    }
    if (RESTRICTED_ROLES.includes(role) && callerAdmin.role !== 'super_admin') {
      return json(
        { success: false, message: `Only a super admin can assign the ${role} role.` },
        403
      );
    }

    const normalisedEmail = String(email).trim().toLowerCase();

    // 3. Already a member here? Re-inviting would create a duplicate row.
    const { data: existingMember } = await admin
      .from('tenant_admins')
      .select('id')
      .eq('tenant_id', tenant_id)
      .eq('email', normalisedEmail)
      .maybeSingle();

    if (existingMember) {
      return json(
        { success: false, message: `${normalisedEmail} is already a member of this institution.` },
        409
      );
    }

    // 4. Does an auth account already exist for this email? Someone may work
    //    at another institution on the platform, in which case we link the
    //    existing account rather than trying to create a duplicate.
    let authUserId: string | null = null;
    let invited = false;
    let tempPassword: string | null = null;

    const { data: listed } = await admin.auth.admin.listUsers();
    const existingAuth = listed?.users?.find(
      (u: { email?: string }) => u.email?.toLowerCase() === normalisedEmail
    );

    if (existingAuth) {
      authUserId = existingAuth.id;
    } else if (mode === 'password') {
      if (!password || String(password).length < 8) {
        return json(
          { success: false, message: 'Temporary password must be at least 8 characters.' },
          400
        );
      }

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: normalisedEmail,
        password: String(password),
        email_confirm: true, // no inbox needed, which is the point of this mode
        user_metadata: {
          full_name,
          // Read at sign-in to force a change. A temporary password the admin
          // knows must not survive the first login.
          must_change_password: true,
        },
      });
      if (createErr) throw createErr;

      authUserId = created.user?.id ?? null;
      tempPassword = String(password);
    } else {
      // Default: Supabase emails a set-password link and nobody else ever
      // learns the password.
      const { data: invitedUser, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(
        normalisedEmail,
        { data: { full_name } }
      );
      if (inviteErr) throw inviteErr;

      authUserId = invitedUser.user?.id ?? null;
      invited = true;
    }

    if (!authUserId) {
      throw new Error('The account was not created. No user id came back.');
    }

    // 5. Link them to the institution. Active immediately when a password was
    //    set, since they can already sign in; pending when invited, until
    //    they accept.
    const { error: memberErr } = await admin.from('tenant_admins').insert({
      tenant_id,
      user_id: authUserId,
      email: normalisedEmail,
      full_name,
      role,
      phone: phone || null,
      branch_id: branch_id || null,
      status: mode === 'password' || existingAuth ? 'active' : 'pending',
    });

    if (memberErr) {
      // The auth account exists but the membership failed. Say so plainly
      // rather than reporting success: the admin needs to know the account is
      // half-created so it can be fixed rather than silently retried.
      throw new Error(
        `The login was created, but linking it to the institution failed (${memberErr.message}). ` +
          'Add them again to complete the link.'
      );
    }

    return json({
      success: true,
      user_id: authUserId,
      invited,
      linked_existing: !!existingAuth,
      temp_password: tempPassword,
      message: existingAuth
        ? `${normalisedEmail} already had a Trust Seed account and has been added to this institution.`
        : invited
        ? `An invitation has been emailed to ${normalisedEmail}.`
        : `Account created for ${normalisedEmail}. They must change the temporary password at first sign-in.`,
    });
  } catch (err) {
    console.error('create-tenant-user failed:', err);
    return json(
      {
        success: false,
        message: err instanceof Error ? err.message : 'Could not create the user.',
      },
      500
    );
  }
});
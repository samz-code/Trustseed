// supabase/functions/send-invite/index.ts
//
// Invites a team member with a PASSWORDLESS magic-link login:
//   1. Verifies the caller is a signed-in all-branch admin.
//   2. Creates the Supabase auth user (no password needed).
//   3. Generates a one-time magic login link.
//   4. Links the pending tenant_admins row to the new auth user.
//   5. Emails the link via Resend or SendGrid.
//
// The invited person clicks the link and is signed straight in — they never
// need a password. For later logins they use "Email me a login link" on the
// sign-in page (see magic-link-login.snippet.tsx).
//
// Deploy:  supabase functions deploy send-invite
// Secrets: EMAIL_PROVIDER, RESEND_API_KEY | SENDGRID_API_KEY, FROM_EMAIL,
//          FROM_NAME (optional), APP_URL   (see EMAIL_SETUP.md)
//
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are injected
// automatically. Make sure APP_URL is in Auth → URL Configuration → Redirect URLs.

// deno-lint-ignore-file
/// <reference lib="deno.ns" />
import { createClient } from 'npm:@supabase/supabase-js@2.45.0';

const ALL_BRANCH_ROLES = new Set(['super_admin', 'institution_admin', 'head_office_admin']);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function roleLabel(role: string): string {
  return role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

interface InvitePayload {
  email?: string;
  full_name?: string;
  role?: string;
  branch_name?: string | null;
}

// ---- Email template (solid brand colours only — no gradients, no emoji) -----
function buildEmailHtml(opts: {
  fullName: string;
  tenantName: string;
  roleName: string;
  branchName: string | null;
  inviterName: string | null;
  actionUrl: string;
}): string {
  const { fullName, tenantName, roleName, branchName, inviterName, actionUrl } = opts;
  const safeName = escapeHtml(fullName || 'there');
  const safeTenant = escapeHtml(tenantName);
  const safeRole = escapeHtml(roleName);
  const safeBranch = branchName ? escapeHtml(branchName) : null;
  const safeInviter = inviterName ? escapeHtml(inviterName) : null;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#dae1e1;font-family:Arial,Helvetica,sans-serif;color:#1e293b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#dae1e1;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #dae1e1;">
        <tr><td style="height:6px;background-color:#641f60;"></td></tr>
        <tr><td style="padding:32px 32px 8px 32px;">
          <div style="font-size:18px;font-weight:bold;color:#641f60;">Trust Seed</div>
        </td></tr>
        <tr><td style="padding:8px 32px 0 32px;">
          <h1 style="font-size:22px;color:#641f60;margin:0 0 12px 0;">You've been invited</h1>
          <p style="font-size:15px;line-height:1.6;margin:0 0 16px 0;">
            Hi ${safeName},${safeInviter ? ` ${safeInviter} has` : ' you have been'} invited to join
            <strong>${safeTenant}</strong> on Trust Seed as a <strong>${safeRole}</strong>${
    safeBranch ? ` for <strong>${safeBranch}</strong>` : ''
  }.
          </p>
          <p style="font-size:15px;line-height:1.6;margin:0 0 24px 0;">
            Your account is ready. Click the button below to log in securely &mdash;
            <strong>no password needed</strong>.
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:10px;background-color:#ee7b22;">
            <a href="${actionUrl}" target="_blank"
               style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:10px;">
              Log in to Trust Seed
            </a>
          </td></tr></table>
          <p style="font-size:13px;line-height:1.6;color:#64748b;margin:24px 0 0 0;">
            This is a one-time secure login link that expires shortly. If it has expired, go to the
            sign-in page and choose "Email me a login link".
          </p>
          <p style="font-size:13px;line-height:1.6;color:#64748b;margin:12px 0 0 0;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="${actionUrl}" style="color:#1ebcb2;word-break:break-all;">${actionUrl}</a>
          </p>
        </td></tr>
        <tr><td style="padding:24px 32px 32px 32px;">
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 16px 0;">
          <p style="font-size:12px;color:#94a3b8;margin:0;">
            You received this because someone invited you to a Trust Seed institution. If you weren't expecting this, you can ignore this email.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildEmailText(opts: {
  fullName: string;
  tenantName: string;
  roleName: string;
  branchName: string | null;
  actionUrl: string;
}): string {
  const { fullName, tenantName, roleName, branchName, actionUrl } = opts;
  return [
    `Hi ${fullName || 'there'},`,
    '',
    `You've been invited to join ${tenantName} on Trust Seed as a ${roleName}` +
      (branchName ? ` for ${branchName}.` : '.'),
    '',
    'Your account is ready. Log in securely with this one-time link (no password needed):',
    actionUrl,
    '',
    'If the link has expired, go to the sign-in page and choose "Email me a login link".',
  ].join('\n');
}

// ---- Providers -------------------------------------------------------------
async function sendViaResend(a: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${a.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: a.from, to: [a.to], subject: a.subject, html: a.html, text: a.text }),
  });
  if (!res.ok) return { ok: false, error: `Resend ${res.status}: ${await res.text()}` };
  return { ok: true };
}

async function sendViaSendgrid(a: {
  apiKey: string;
  fromEmail: string;
  fromName: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${a.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: a.to }] }],
      from: { email: a.fromEmail, name: a.fromName },
      subject: a.subject,
      content: [
        { type: 'text/plain', value: a.text },
        { type: 'text/html', value: a.html },
      ],
    }),
  });
  if (!res.ok) return { ok: false, error: `SendGrid ${res.status}: ${await res.text()}` };
  return { ok: true };
}

// ---- Handler ---------------------------------------------------------------
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'Missing authorization token.' }, 401);

  // 1) Identify the caller.
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser();
  if (userErr || !user) return json({ error: 'Invalid or expired session.' }, 401);

  // 2) Verify the caller is an all-branch admin and get their tenant.
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: callerRow, error: callerErr } = await admin
    .from('tenant_admins')
    .select('tenant_id, role, status, full_name')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();
  if (callerErr) return json({ error: `Permission check failed: ${callerErr.message}` }, 500);
  if (!callerRow || !ALL_BRANCH_ROLES.has(callerRow.role)) {
    return json({ error: 'You do not have permission to send invitations.' }, 403);
  }

  // 3) Validate payload.
  let payload: InvitePayload;
  try {
    payload = (await req.json()) as InvitePayload;
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }
  const email = (payload.email ?? '').trim().toLowerCase();
  const fullName = (payload.full_name ?? '').trim();
  const role = (payload.role ?? '').trim();
  const branchName = payload.branch_name ? String(payload.branch_name) : null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'A valid recipient email is required.' }, 400);
  }

  // 4) Tenant display name (from the caller's tenant — never client-supplied).
  const { data: tenantRow } = await admin
    .from('tenants')
    .select('name')
    .eq('id', callerRow.tenant_id)
    .maybeSingle();
  const tenantName = tenantRow?.name ?? 'your institution';

  // 5) Email config.
  const provider = (Deno.env.get('EMAIL_PROVIDER') ?? 'resend').toLowerCase();
  const fromEmail = Deno.env.get('FROM_EMAIL');
  const fromName = Deno.env.get('FROM_NAME') ?? 'Trust Seed';
  const appUrl = (Deno.env.get('APP_URL') ?? '').replace(/\/+$/, '');
  if (!fromEmail) return json({ error: 'FROM_EMAIL is not configured.' }, 500);

  // 6) Provision the auth user (passwordless). Ignore "already registered".
  const { error: createErr } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (createErr && !/already|registered|exists/i.test(createErr.message)) {
    return json({ error: `Could not create account: ${createErr.message}` }, 500);
  }

  // 7) Generate a one-time magic login link.
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: appUrl ? { redirectTo: appUrl } : undefined,
  });
  const actionUrl = linkData?.properties?.action_link;
  if (linkErr || !actionUrl) {
    return json({ error: `Could not generate login link: ${linkErr?.message ?? 'unknown error'}` }, 500);
  }

  // 8) Link the auth user to the pending tenant_admins row (covers both new and
  //    pre-existing auth users; a DB trigger also handles self sign-ups).
  const authUserId = linkData.user?.id;
  if (authUserId) {
    await admin
      .from('tenant_admins')
      .update({ user_id: authUserId, status: 'active' })
      .eq('tenant_id', callerRow.tenant_id)
      .eq('email', email)
      .is('user_id', null);
  }

  // 9) Send the email.
  const roleName = role ? roleLabel(role) : 'team member';
  const html = buildEmailHtml({
    fullName,
    tenantName,
    roleName,
    branchName,
    inviterName: callerRow.full_name ?? null,
    actionUrl,
  });
  const text = buildEmailText({ fullName, tenantName, roleName, branchName, actionUrl });
  const subject = `You've been invited to ${tenantName} on Trust Seed`;

  let result: { ok: boolean; error?: string };
  if (provider === 'sendgrid') {
    const key = Deno.env.get('SENDGRID_API_KEY');
    if (!key) return json({ error: 'SENDGRID_API_KEY is not configured.' }, 500);
    result = await sendViaSendgrid({ apiKey: key, fromEmail, fromName, to: email, subject, html, text });
  } else {
    const key = Deno.env.get('RESEND_API_KEY');
    if (!key) return json({ error: 'RESEND_API_KEY is not configured.' }, 500);
    result = await sendViaResend({ apiKey: key, from: `${fromName} <${fromEmail}>`, to: email, subject, html, text });
  }

  if (!result.ok) return json({ error: result.error ?? 'Failed to send email.' }, 502);
  return json({ sent: true });
});
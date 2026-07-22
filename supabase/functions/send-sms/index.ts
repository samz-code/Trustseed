// ============================================================================
// SMS WORKER
//
// Drains queued SMS notifications and hands them to Africa's Talking, then
// reports each result back so the row is marked sent, retried, or failed.
//
// Deploy:
//   supabase functions deploy send-sms --no-verify-jwt
//
// Invoke on a schedule (pg_cron, or Supabase's scheduled functions):
//   every minute is usually enough; repayment SMS should land within a minute
//   of the customer leaving the counter.
//
// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the function
// environment. Both are injected by default on Supabase.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// How many messages to take per invocation. Kept modest so a single run can't
// exhaust the function timeout and leave rows stuck in 'sending'.
const BATCH_SIZE = 25;

interface NotificationRow {
  id: string;
  tenant_id: string;
  channel: string;
  recipient: string | null;
  body: string;
  attempts: number;
}

interface SmsProvider {
  id: string;
  provider: string;
  username: string | null;
  api_key: string | null;
  sender_id: string | null;
  is_sandbox: boolean;
}

// ----------------------------------------------------------------------------
// Number normalisation.
//
// Tellers enter numbers however they like: 0712..., +254712..., 254712...,
// sometimes with spaces. Africa's Talking requires full E.164. Getting this
// wrong is the single most common reason a message silently never arrives.
// ----------------------------------------------------------------------------

const DEFAULT_DIALLING_CODE = "254"; // Kenya

function normalisePhone(raw: string, fallbackCode = DEFAULT_DIALLING_CODE): string | null {
  if (!raw) return null;

  let n = raw.replace(/[\s\-()]/g, "");

  if (n.startsWith("+")) {
    n = n.slice(1);
  } else if (n.startsWith("00")) {
    n = n.slice(2);
  } else if (n.startsWith("0")) {
    // Local format: drop the trunk zero and prepend the country code.
    n = fallbackCode + n.slice(1);
  } else if (!/^(254|256|255|250|211)/.test(n)) {
    // No recognisable country code and no leading zero. Assume local.
    n = fallbackCode + n;
  }

  if (!/^\d{9,15}$/.test(n)) return null;
  return "+" + n;
}

function countryCodeOf(e164: string): string | null {
  const digits = e164.replace(/^\+/, "");
  for (const code of ["254", "256", "255", "250", "211"]) {
    if (digits.startsWith(code)) return code;
  }
  return null;
}

// ----------------------------------------------------------------------------
// Africa's Talking send.
//
// The API returns 201 with a per-recipient status array even when individual
// numbers fail, so a 2xx response is not on its own a success.
// ----------------------------------------------------------------------------

async function sendViaAfricasTalking(
  provider: SmsProvider,
  to: string,
  message: string,
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  if (!provider.username || !provider.api_key) {
    return { ok: false, error: "SMS provider is missing username or API key" };
  }

  const endpoint = provider.is_sandbox
    ? "https://api.sandbox.africastalking.com/version1/messaging"
    : "https://api.africastalking.com/version1/messaging";

  const form = new URLSearchParams();
  form.set("username", provider.username);
  form.set("to", to);
  form.set("message", message);
  if (provider.sender_id) form.set("from", provider.sender_id);

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        apiKey: provider.api_key,
      },
      body: form.toString(),
    });
  } catch (err) {
    // Network failure. Worth retrying, so report as a soft failure.
    return { ok: false, error: `Network error: ${String(err)}` };
  }

  const text = await res.text();

  if (!res.ok) {
    return { ok: false, error: `Provider returned ${res.status}: ${text.slice(0, 300)}` };
  }

  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: `Unparseable provider response: ${text.slice(0, 300)}` };
  }

  const recipients = parsed?.SMSMessageData?.Recipients ?? [];

  if (recipients.length === 0) {
    // No recipients accepted. The human-readable reason is in Message, and it
    // is usually a sender ID that has not been approved or an empty balance.
    const msg = parsed?.SMSMessageData?.Message ?? "No recipients accepted";
    return { ok: false, error: msg };
  }

  const r = recipients[0];
  // Africa's Talking uses 100 (processed), 101 (sent), 102 (queued) for
  // success. Anything else is a rejection with a reason in statusCode.
  const accepted = [100, 101, 102].includes(Number(r.statusCode));

  if (!accepted) {
    return { ok: false, error: `${r.status ?? "Rejected"} (code ${r.statusCode})` };
  }

  return { ok: true, messageId: r.messageId };
}

// ----------------------------------------------------------------------------
// Main.
// ----------------------------------------------------------------------------

Deno.serve(async (req) => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const summary = { claimed: 0, sent: 0, failed: 0, skipped: 0 };

  try {
    const { data: claimed, error: claimErr } = await supabase.rpc("claim_notifications", {
      p_channel: "sms",
      p_limit: BATCH_SIZE,
    });

    if (claimErr) throw claimErr;

    const rows = (claimed ?? []) as NotificationRow[];
    summary.claimed = rows.length;

    if (rows.length === 0) {
      return new Response(JSON.stringify({ ok: true, ...summary }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Credentials are per tenant, and a batch usually spans only one or two.
    // Cache so a batch of 25 does not make 25 identical lookups.
    const providerCache = new Map<string, SmsProvider | null>();

    async function providerFor(tenantId: string, countryCode: string | null) {
      const key = `${tenantId}:${countryCode ?? "any"}`;
      if (providerCache.has(key)) return providerCache.get(key)!;

      const { data, error } = await supabase.rpc("sms_provider_for", {
        p_tenant_id: tenantId,
        p_country_code: countryCode,
      });

      const provider = error || !data ? null : (data as SmsProvider);
      providerCache.set(key, provider);
      return provider;
    }

    for (const row of rows) {
      const to = normalisePhone(row.recipient ?? "");

      if (!to) {
        // Unusable number. No amount of retrying fixes this, so fail it
        // immediately rather than burning five attempts.
        await supabase.rpc("mark_notification_result", {
          p_id: row.id,
          p_success: false,
          p_provider: "africas_talking",
          p_error: `Unusable phone number: ${row.recipient ?? "(empty)"}`,
        });
        summary.failed += 1;
        continue;
      }

      const provider = await providerFor(row.tenant_id, countryCodeOf(to));

      if (!provider) {
        await supabase.rpc("mark_notification_result", {
          p_id: row.id,
          p_success: false,
          p_error: "No active SMS provider configured for this institution",
        });
        summary.failed += 1;
        continue;
      }

      const result = await sendViaAfricasTalking(provider, to, row.body);

      await supabase.rpc("mark_notification_result", {
        p_id: row.id,
        p_success: result.ok,
        p_provider: provider.provider,
        p_provider_message_id: result.messageId ?? null,
        p_error: result.error ?? null,
      });

      if (result.ok) summary.sent += 1;
      else summary.failed += 1;
    }

    return new Response(JSON.stringify({ ok: true, ...summary }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("SMS worker error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err), ...summary }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
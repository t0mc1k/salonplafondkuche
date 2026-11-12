// Supabase Edge Function: send-push  (Version 4.1.00)
// Sendet die fälligen Einträge aus public.push_queue als Web-Push an die Geräte der Mitarbeiter.
// Wird von der Datenbank aufgerufen (pg_net + pg_cron), NICHT von der App.
// Einstellungen (Secrets): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, PUSH_SHARED_SECRET
// Deploy: "Verify JWT" AUSSCHALTEN (der Aufruf kommt von der Datenbank mit dem Header x-push-secret).
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com";
const SHARED_SECRET = Deno.env.get("PUSH_SHARED_SECRET") ?? "";

if (VAPID_PUBLIC && VAPID_PRIVATE) webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// Kategorien, die immer gesendet werden (nicht abschaltbar)
const ALWAYS = new Set(["test"]);
const URGENT = new Set(["fault_urgent", "mgr_swap", "test"]);

type Sub = { id: string; staff_name: string; endpoint: string; p256dh: string; auth: string; lang: string; is_admin: boolean };
type Row = {
  id: number; target_type: "user" | "admins" | "all"; target_name: string | null; exclude_name: string | null;
  category: string; payload: any; url: string | null; tag: string | null;
};

const low = (s: string | null | undefined) => String(s ?? "").trim().toLowerCase();

export function pickRecipients(row: Row, subs: Sub[]): Sub[] {
  const ex = low(row.exclude_name);
  return subs.filter((s) => {
    if (ex && low(s.staff_name) === ex) return false;
    if (row.target_type === "user") return low(s.staff_name) === low(row.target_name);
    if (row.target_type === "admins") return !!s.is_admin;
    return true;
  });
}

// Bestimmt Kategorie + Text für genau diese Person (Erwähnungen im Chat haben Vorrang)
export function buildFor(row: Row, sub: Sub, prefs: Record<string, boolean>) {
  const lang = sub.lang === "en" ? "en" : "de";
  const mentions: string[] = Array.isArray(row.payload?.mentions) ? row.payload.mentions : [];
  let category = row.category;
  let msg = row.payload?.[lang] ?? row.payload?.de ?? {};
  if (row.category === "chat" && mentions.includes(low(sub.staff_name))) {
    // Wer mit @Name erwähnt wurde, bekommt eine eigene Meldung (Kategorie „mention“), auch wenn „Chat“ ausgeschaltet ist
    category = "mention";
    msg = row.payload?.[`mention_${lang}`] ?? msg;
  }
  if (!ALWAYS.has(category) && prefs[category] === false) return null;
  return {
    category,
    body: JSON.stringify({
      title: msg.title ?? "Salonplafond",
      body: msg.body ?? "",
      groupTitle: msg.groupTitle ?? null,
      groupBody: msg.groupBody ?? null,
      tag: row.tag ?? category,
      url: row.url ?? "",
      cat: category,
    }),
    urgent: URGENT.has(category),
  };
}

Deno.serve(async (req) => {
  if (!SHARED_SECRET || req.headers.get("x-push-secret") !== SHARED_SECRET) {
    return new Response("forbidden", { status: 403 });
  }
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return new Response("VAPID keys missing", { status: 500 });

  const { data: batch, error } = await db.rpc("push_claim_batch", { p_limit: 40 });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  const rows = (batch ?? []) as Row[];
  if (!rows.length) return new Response(JSON.stringify({ processed: 0 }), { headers: { "content-type": "application/json" } });

  const { data: subsData } = await db.from("push_subscriptions").select("*");
  const subs = (subsData ?? []) as Sub[];
  const { data: prefData } = await db.from("push_prefs").select("*");
  const prefs = new Map<string, Record<string, boolean>>();
  for (const p of prefData ?? []) prefs.set(low(p.staff_name), p.prefs ?? {});

  let sent = 0, failed = 0;
  for (const row of rows) {
    try {
      const recipients = pickRecipients(row, subs);
      let ok = 0, bad = 0, lastErr = "";
      for (const sub of recipients) {
        const built = buildFor(row, sub, prefs.get(low(sub.staff_name)) ?? {});
        if (!built) continue;
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            built.body,
            { TTL: 6 * 3600, urgency: built.urgent ? "high" : "normal" },
          );
          ok++;
        } catch (e: any) {
          const code = e?.statusCode;
          if (code === 404 || code === 410) {
            await db.from("push_subscriptions").delete().eq("id", sub.id);   // Gerät existiert nicht mehr
          } else { bad++; lastErr = `${code ?? ""} ${e?.message ?? e}`.slice(0, 250); }
        }
      }
      if (ok > 0 || bad === 0) { await db.rpc("push_finish", { p_id: row.id, p_status: ok > 0 ? "sent" : "skipped", p_error: "" }); sent++; }
      else { await db.rpc("push_finish", { p_id: row.id, p_status: "failed", p_error: lastErr }); failed++; }
    } catch (e: any) {
      await db.rpc("push_finish", { p_id: row.id, p_status: "failed", p_error: String(e?.message ?? e) });
      failed++;
    }
  }
  return new Response(JSON.stringify({ processed: rows.length, sent, failed }), { headers: { "content-type": "application/json" } });
});

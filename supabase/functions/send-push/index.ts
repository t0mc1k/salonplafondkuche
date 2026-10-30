// Supabase Edge Function: send-push
// Wird von Datenbank-Triggern (sql/1.2.00_push.sql, 1.2.01_push_details.sql) aufgerufen, wenn in der Schichtübergabe
// eine Aufgabe neu ist oder ihren Status ändert oder im Chat eine Nachricht kommt.
// Schickt Web-Push mit Absender und Text an alle Geräte außer dem Auslöser.
//
// Deploy:  supabase functions deploy send-push --no-verify-jwt
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:...), WEBHOOK_SECRET
// (SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY stellt Supabase automatisch bereit.)

import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
);

type Item = {
  item_name: string;
  station: string;
  author_name?: string;
  is_optional?: boolean;
  notes?: string | null;
  status?: string;
  old_status?: string;
};

const STATUS_TEXT: Record<string, string> = { done: '✔ erledigt', in_progress: '▶ in Arbeit', open: '↩ wieder offen' };
const MAX_LINES = 5;

function moreLine(total: number): string[] {
  return total > MAX_LINES ? [`+ ${total - MAX_LINES} weitere`] : [];
}

// Baut Titel und Text der Mitteilung: wer hat was geschrieben
function buildPayload(kind: string, actor: string, items: Item[], message: string, hasImage: boolean) {
  if (kind === 'chat') {
    return {
      title: `💬 ${actor}`,
      body: (message.trim() || (hasImage ? '📷 Foto' : 'Neue Nachricht')).slice(0, 200),
      tag: `chat-${actor}`,
      url: './?view=chat',
    };
  }
  if (kind === 'insert') {
    const stations = [...new Set(items.map((i) => i.station))];
    const lines = [`${actor}:`].concat(
      items.slice(0, MAX_LINES).map((i) => `• ${i.is_optional ? 'Evtl. ' : ''}${i.item_name}${i.notes ? ` (${i.notes})` : ''}`),
      moreLine(items.length),
    );
    return {
      title: `📋 Neue Übergabe · ${stations.slice(0, 2).join(', ')}${stations.length > 2 ? ` +${stations.length - 2}` : ''}`,
      body: lines.join('\n'),
      tag: `ho-new-${actor}`,
      url: './?view=handover',
    };
  }
  const lines = items.slice(0, MAX_LINES).map((i) => `${i.item_name} (${i.station}) ${STATUS_TEXT[i.status ?? ''] ?? ''}`.trim())
    .concat(moreLine(items.length));
  return { title: '🔄 Übergabe aktualisiert', body: lines.join('\n'), tag: 'ho-status', url: './?view=handover' };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (req.headers.get('x-webhook-secret') !== Deno.env.get('WEBHOOK_SECRET')) {
    return new Response('Forbidden', { status: 403 });
  }

  let body: { kind?: string; actor?: string; items?: Item[]; message?: string; has_image?: boolean };
  try { body = await req.json(); } catch { return new Response('Bad request', { status: 400 }); }
  const kind = String(body.kind ?? 'insert');
  const items = Array.isArray(body.items) ? body.items : [];
  if (kind !== 'chat' && items.length === 0) return new Response(JSON.stringify({ sent: 0 }), { status: 200 });

  const actor = String(body.actor ?? '');
  const payload = JSON.stringify(buildPayload(kind, actor, items, String(body.message ?? ''), !!body.has_image));

  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth, staff:staff_id(name)');
  if (error) return new Response(error.message, { status: 500 });

  const recipients = (subs ?? []).filter((s: any) => {
    const name = Array.isArray(s.staff) ? s.staff[0]?.name : s.staff?.name;
    return String(name ?? '').toLowerCase() !== actor.toLowerCase();   // Auslöser selbst nicht benachrichtigen
  });

  let sent = 0;
  await Promise.allSettled(recipients.map(async (s: any) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload,
        { TTL: 60 * 60 * 12, urgency: 'high' },
      );
      sent++;
    } catch (e: any) {
      // Gerät existiert nicht mehr (App deinstalliert, Berechtigung entzogen): Eintrag löschen
      if (e?.statusCode === 404 || e?.statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
      } else {
        console.error('Push-Fehler', e?.statusCode, e?.body ?? e?.message);
      }
    }
  }));

  return new Response(JSON.stringify({ sent, recipients: recipients.length }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
});

// Supabase Edge Function: scan-special  (Version 4.1.06)
// Liest ein Foto vom Zettel mit Tageskuchen / Tagessuppe (Name, Preis, Allergene A–R) und gibt die erkannten
// Einträge als Vorschlag zurück. Es wird NICHTS gespeichert: Der Manager prüft und bestätigt in der App.
// Secrets: GEMINI_API_KEY (Pflicht, derselbe wie bei tomi-ai), GEMINI_MODEL_SCAN (optional: eigenes Modell, wird zuerst versucht)
// Nur Manager/Developer (Prüfung über x-staff-token und die Datenbankfunktion tomi_whoami).
// Das Foto wird nur zur Erkennung an Google Gemini geschickt und nicht gespeichert.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const MODEL_ENV = (Deno.env.get("GEMINI_MODEL_SCAN") ?? "").trim();
const DAILY_LIMIT = 200;               // zählt gemeinsam mit TomiAI (Funktion tomi_use)
const MAX_BASE64 = 7_000_000;          // ca. 5 MB Bild
const ALLERGENS = ["A", "B", "C", "D", "E", "F", "G", "H", "L", "M", "N", "O", "P", "R"];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-staff-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });

// <<helpers (reine Funktionen, ohne Datenbank und Netzwerk)
// Allergen-Buchstaben bereinigen: nur A–R laut Verordnung, Großbuchstaben, ohne Doppelte, sortiert
export function cleanAllergens(v: unknown): string[] {
  const raw = Array.isArray(v) ? v.join(",") : String(v ?? "");
  const found = new Set<string>();
  for (const ch of raw.toUpperCase().replace(/[^A-Z]/g, "")) if (ALLERGENS.includes(ch)) found.add(ch);
  return ALLERGENS.filter((c) => found.has(c));
}

const KINDS = ["cake", "soup", "dish"];
const isoDate = (v: unknown): string | null => {
  const s = String(v ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(s + "T00:00:00Z");
  return isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : s;
};

export type ScanItem = {
  kind: "cake" | "soup" | "dish"; name: string; description: string; price: number | null;
  allergens: string[]; valid_from: string | null; valid_to: string | null; uncertain: boolean;
};

// Antwort der KI prüfen und in sichere Einträge umwandeln
export function sanitizeScan(parsed: any): { items: ScanItem[]; readable: boolean; allergensVisible: boolean; note: string } {
  const list = Array.isArray(parsed?.items) ? parsed.items : [];
  const items: ScanItem[] = [];
  for (const it of list.slice(0, 12)) {
    const name = String(it?.name ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
    if (!name) continue;
    const kind = KINDS.includes(String(it?.kind)) ? (it.kind as ScanItem["kind"]) : "dish";
    const p = typeof it?.price === "number" ? it.price : parseFloat(String(it?.price ?? "").replace(",", "."));
    const price = Number.isFinite(p) && p >= 0 && p < 1000 ? Math.round(p * 100) / 100 : null;
    let vf = isoDate(it?.valid_from), vt = isoDate(it?.valid_to);
    if (vf && vt && vt < vf) { vf = null; vt = null; }
    items.push({
      kind, name,
      description: String(it?.description ?? "").replace(/\s+/g, " ").trim().slice(0, 300),
      price, allergens: cleanAllergens(it?.allergens), valid_from: vf, valid_to: vt,
      uncertain: !!it?.uncertain,
    });
  }
  return {
    items,
    readable: parsed?.readable !== false && items.length > 0,
    allergensVisible: parsed?.allergens_visible !== false,
    note: String(parsed?.note ?? "").slice(0, 300),
  };
}

export function scanModels(env: string): string[] {
  // Fürs Lesen von Schrift lieber das bessere „Flash“ zuerst, „Lite“ nur als Reserve
  return Array.from(new Set([env, "gemini-2.5-flash", "gemini-flash-latest", "gemini-2.5-flash-lite", "gemini-flash-lite-latest"].filter(Boolean)));
}
// >>helpers

const SCHEMA = {
  type: "OBJECT",
  properties: {
    readable: { type: "BOOLEAN" },
    allergens_visible: { type: "BOOLEAN" },
    note: { type: "STRING" },
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          kind: { type: "STRING", enum: ["cake", "soup", "dish"] },
          name: { type: "STRING" },
          description: { type: "STRING" },
          price: { type: "NUMBER", nullable: true },
          allergens: { type: "ARRAY", items: { type: "STRING" } },
          valid_from: { type: "STRING", nullable: true },
          valid_to: { type: "STRING", nullable: true },
          uncertain: { type: "BOOLEAN" },
        },
        required: ["kind", "name", "allergens", "uncertain"],
      },
    },
  },
  required: ["readable", "allergens_visible", "items"],
};

const PROMPT = `You read a photo of a paper sheet or board from an Austrian/German restaurant with the daily specials ("Tageskuchen", "Tagessuppe", sometimes "Tagesgericht").
Extract every special as a separate item.
- kind: "soup" for soups (Suppe, Cremesuppe, Eintopf-like soups), "cake" for cakes, tarts, strudel and sweet baked desserts (Kuchen, Torte), otherwise "dish".
- name: exactly as written on the sheet (keep the original language and spelling). Do not translate.
- description: only if clearly written (e.g. "mit Sahne"), otherwise an empty string.
- price: number in euro if a price is visible, otherwise null.
- allergens: the allergen letters printed next to the item. Valid letters are A, B, C, D, E, F, G, H, L, M, N, O, P, R (Austrian EU allergen codes; A=gluten, B=crustaceans, C=eggs, D=fish, E=peanuts, F=soy, G=milk, H=nuts, L=celery, M=mustard, N=sesame, O=sulphites, P=lupin, R=molluscs). They often appear after the name like "A, C, G", "ACG" or "(A,G)". Return ONLY letters you can actually see. If you cannot see any letters for an item return an empty list. NEVER guess or infer allergens from the dish name.
- valid_from / valid_to: only if a date or weekday range is clearly visible, as YYYY-MM-DD, otherwise null.
- uncertain: true if the handwriting/print for that item (name, price or letters) is hard to read.
Set allergens_visible to false if the sheet shows no allergen letters at all. Set readable to false if there is no readable list of specials in the photo. Put a short remark in "note" if something is unclear.
Do not invent items. Answer with JSON only.`;

async function refund(name: string) {
  try {
    if (!SERVICE_KEY) return;
    await createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } }).rpc("tomi_refund", { p_name: name });
  } catch (_) { /* ignorieren */ }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  if (!GEMINI_KEY) return json({ error: "not_configured" }, 500);

  const token = req.headers.get("x-staff-token") ?? "";
  if (!token) return json({ error: "auth" }, 401);
  const db = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false }, global: { headers: { "x-staff-token": token } } });
  const who = await db.rpc("tomi_whoami");
  const me = who.data as any;
  if (who.error || !me?.name) return json({ error: "auth" }, 401);
  if (!me.is_admin) return json({ error: "forbidden" }, 403);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  const mime = ["image/jpeg", "image/png", "image/webp"].includes(String(body?.mime)) ? String(body.mime) : "image/jpeg";
  const data = String(body?.image ?? "").replace(/^data:[^,]*,/, "").replace(/\s+/g, "");
  if (!data || !/^[A-Za-z0-9+/=]+$/.test(data)) return json({ error: "bad_request" }, 400);
  if (data.length > MAX_BASE64) return json({ error: "too_large" }, 413);

  const quota = await db.rpc("tomi_use", { p_limit: DAILY_LIMIT });
  if (quota.error) return json({ error: /quota/.test(quota.error.message) ? "quota" : "quota_check" }, /quota/.test(quota.error.message) ? 429 : 500);

  const started = Date.now();
  const models = scanModels(MODEL_ENV);
  const log: string[] = [];
  let parsed: any = null, lastStatus = 0, sawBusy = false;

  outer:
  for (const model of models) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      if (Date.now() - started > 45000) { log.push("time limit"); break outer; }
      const genConfig: any = { temperature: 0.1, maxOutputTokens: 3000, responseMimeType: "application/json", responseSchema: SCHEMA };
      if (/2\.5/.test(model)) genConfig.thinkingConfig = { thinkingBudget: 0 };
      let res: Response;
      try {
        res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_KEY },
          signal: AbortSignal.timeout(25000),
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ inlineData: { mimeType: mime, data } }, { text: PROMPT }] }],
            generationConfig: genConfig,
          }),
        });
      } catch (e) { log.push(`${model} #${attempt} network: ${e}`); sawBusy = true; await new Promise((r) => setTimeout(r, 600)); continue; }
      lastStatus = res.status;
      if (res.ok) {
        try {
          const j = await res.json();
          const text = (j?.candidates?.[0]?.content?.parts ?? []).map((p: any) => p?.text ?? "").join("").trim();
          parsed = JSON.parse(text.replace(/^```json|```$/g, "").trim());
          log.push(`${model} #${attempt} ok`);
          break outer;
        } catch (e) { log.push(`${model} #${attempt} bad json: ${e}`); break; }   // nächstes Modell
      }
      const t = (await res.text()).slice(0, 200);
      log.push(`${model} #${attempt} ${res.status} ${t}`);
      if ([429, 500, 503, 504].includes(res.status)) { sawBusy = true; if (attempt === 1) await new Promise((r) => setTimeout(r, 700)); continue; }
      if (res.status === 404 || (res.status === 400 && !/API[_ ]?KEY/i.test(t))) break;   // nächstes Modell
      break outer;                                                                       // Schlüssel ungültig o. Ä.
    }
  }
  console.log(`scan-special: ${Date.now() - started}ms bytes=${Math.round(data.length * 0.75)}`, log.join(" | "));

  if (!parsed) {
    await refund(me.name);
    return json({ error: sawBusy ? "busy" : "ai", status: lastStatus }, sawBusy ? 503 : 502);
  }
  const out = sanitizeScan(parsed);
  if (!out.readable) await refund(me.name);   // nichts erkannt: zählt nicht gegen das Tageslimit
  return json({ ok: true, ...out });
});

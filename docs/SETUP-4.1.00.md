# Einrichtung Version 4.1.00 – Push-Benachrichtigungen und TomiAI

Reihenfolge einhalten. Alles in Supabase (Dashboard). Dauer: ca. 20–30 Minuten.
Voraussetzung: `sql/3.1.02_chat.sql` und `sql/3.2.03_betrieb.sql` wurden schon ausgeführt.

## 1. SQL ausführen
1. Supabase → **SQL Editor** → Inhalt von `sql/4.1.00_push_tomi.sql` einfügen → **Run** (bei „Potential issue detected“ → *Run query*).
2. **Database → Extensions**: `pg_net` und `pg_cron` müssen aktiv sein. Falls du sie gerade erst aktiviert hast: das SQL aus Schritt 1 **noch einmal** ausführen (dann wird der Minuten-Job angelegt).

## 2. Push-Schlüssel erzeugen (VAPID)
1. Öffne die Datei `tools/vapid-generator.html` auf deinem Computer (Doppelklick) und klicke auf **Neues Schlüsselpaar erzeugen**.
2. Der **öffentliche** Schlüssel kommt gleich in die App (Schritt 5) und in Supabase. Der **private** Schlüssel nur in Supabase (Schritt 3). Nie in den Chat oder in den App-Code!

## 3. Secrets setzen
Supabase → **Edge Functions → Secrets** (oder *Project Settings → Edge Functions*), diese Einträge anlegen:

| Name | Wert |
|---|---|
| `VAPID_PUBLIC_KEY` | öffentlicher Schlüssel aus Schritt 2 |
| `VAPID_PRIVATE_KEY` | privater Schlüssel aus Schritt 2 |
| `VAPID_SUBJECT` | `mailto:kdstom@outlook.com` |
| `PUSH_SHARED_SECRET` | eine lange zufällige Zeichenfolge (mind. 32 Zeichen, z. B. aus einem Passwort-Generator) |
| `GEMINI_API_KEY` | dein **neuer** Gemini-Schlüssel (den alten im Chat veröffentlichten bitte in Google löschen) |
| `GEMINI_MODEL` | optional, z. B. `gemini-2.5-flash` (Standard) |

(`SUPABASE_URL`, `SUPABASE_ANON_KEY` und `SUPABASE_SERVICE_ROLE_KEY` stellt Supabase den Funktionen automatisch bereit.)

## 4. Edge Functions bereitstellen
Supabase → **Edge Functions → Deploy a new function → Via Editor**:
1. Name **`send-push`**, Code aus `supabase/functions/send-push/index.ts` einfügen. Unter den Einstellungen **„Verify JWT“ AUSSCHALTEN**. Deploy.
2. Name **`tomi-ai`**, Code aus `supabase/functions/tomi-ai/index.ts` einfügen. „Verify JWT“ kann an bleiben. Deploy.

(Alternative mit der Supabase-CLI: `supabase functions deploy send-push --no-verify-jwt` und `supabase functions deploy tomi-ai`.)

## 5. Geheimwort in der Datenbank eintragen
Im SQL Editor (dasselbe Geheimwort wie `PUSH_SHARED_SECRET`):
```sql
update public.push_config
   set shared_secret = 'HIER_DAS_GEHEIMWORT_EINTRAGEN'
 where id = 1;
select * from public.push_config;   -- function_url muss auf .../functions/v1/send-push zeigen
```

## 6. App hochladen
1. **Ab Version 4.1.02:** den öffentlichen Schlüssel einmal in der Datenbank speichern (SQL `sql/4.1.02_push_key.sql` ausführen, dann `update public.push_config set vapid_public_key = '…' where id = 1;`). Nur falls das nicht geht: in `js/push.js` bei `PUSH_VAPID_PUBLIC_KEY = '...'` eintragen (wird bei jedem Update überschrieben).
2. Alle Dateien der neuen Version hochladen (Ordner `supabase/`, `tools/`, `docs/` müssen nicht auf die Webseite).
3. App einmal ganz schließen und neu öffnen (bzw. Einstellungen → „Neu laden“).

## 7. Testen
- **Push:** Einstellungen → „🔔 Push-Benachrichtigungen“ → *Aktivieren* → *Test senden*. Nach wenigen Sekunden kommt die Meldung (auch bei geschlossener App).
  - Prüfen: `select id, category, status, error from public.push_queue order by id desc limit 10;` (Status `sent` = gesendet, `failed` = siehe Spalte `error`).
  - Edge Functions → `send-push` → **Logs** zeigt Fehler. Die Antworten des Datenbank-Aufrufs: `select * from net._http_response order by created desc limit 5;`
- **iPhone:** Die App muss über Safari → *Teilen* → *Zum Home-Bildschirm* installiert und von dort geöffnet sein. Erst dann kann man Benachrichtigungen aktivieren (iOS 16.4 oder neuer).
- **TomiAI:** Knopf „✨ TomiAI“ unten links → eine Frage stellen, z. B. „Wie macht man einen Negroni?“.

## 8. Bekannte Grenzen
- Zustellung ist nicht garantiert (Energiesparmodus, „Nicht stören“, Fokus-Modus). Für Notfälle später zusätzlich E-Mail.
- Arbeitsplan-Meldungen kommen mit ca. 1–2 Minuten Verzögerung gebündelt (ein Import = eine Meldung pro Person). Dafür ist `pg_cron` nötig.
- TomiAI: Tageslimit 60 Anfragen pro Mitarbeiter, 200 pro Manager (in `supabase/functions/tomi-ai/index.ts` änderbar). Der Verlauf wird nicht gespeichert.

## 9. Gemini-Schlüssel erneuern
Weil der erste Schlüssel im Chat stand: in Google AI Studio / Cloud Console den alten Schlüssel **löschen**, einen neuen erzeugen und nur im Supabase-Secret `GEMINI_API_KEY` eintragen.

## Update 4.1.01 (TomiAI bei Überlastung)
1. Supabase → Edge Functions → **tomi-ai** → Code **ersetzen** durch `supabase/functions/tomi-ai/index.ts` → Deploy.
2. (Empfohlen) SQL Editor: `sql/4.1.01_tomi_refund.sql` ausführen.
3. Optional Secret `GEMINI_MODEL` auf `gemini-2.5-flash-lite` stellen, wenn das Hauptmodell oft überlastet ist. Ausweichmodelle sind automatisch eingebaut (gemini-2.5-flash-lite, gemini-2.0-flash).

## Update 4.1.02
1. SQL Editor: `sql/4.1.02_push_key.sql` ausführen und danach **einmal** `update public.push_config set vapid_public_key = 'DEIN_OEFFENTLICHER_SCHLUESSEL' where id = 1;` (derselbe Wert wie das Secret `VAPID_PUBLIC_KEY`).
2. Edge Function **tomi-ai** mit dem neuen Code aus `supabase/functions/tomi-ai/index.ts` ersetzen und deployen.
3. Secret `GEMINI_MODEL` am besten **löschen** (oder auf `gemini-flash-latest` setzen). Dann wählt TomiAI selbst ein passendes Modell. Im Log von `tomi-ai` steht danach `gemini: <modell> #1 ok`.

## Update 4.1.03/4.1.04 (Login-Protokoll, Online-Status, Begrüßung, Einstellungs-Reiter)
1. SQL Editor: `sql/4.1.04_presence_log.sql` ausführen (Tabellen `nx_sessions`, `nx_activity`, Funktionen, Trigger, Einstellung „Begrüßungsanimation“). Eine Edge Function oder ein Secret ist nicht nötig.
2. App hochladen und einmal ganz schließen/neu öffnen. Ab dann läuft pro geöffneter App einmal pro Minute ein kleiner Anruf (`presence_ping`). Das sind etwa 500 000 winzige Anfragen pro Monat bei 40 Personen, ohne Limit im Free-Plan (Prüfen: Dashboard → Settings → Usage).
3. Prüfen: Dashboard → „🔐 Login-Protokoll“ → Reiter Live zeigt dich selbst mit Gerät und Bereich.
4. Datenschutz: Keine IP-Adressen, Chat-Inhalte werden nie gespeichert, automatische Löschung nach 90 Tagen (beim Anmelden), „🗑️ Protokoll leeren“ löscht sofort. Bitte das Team informieren (Hinweis steht auch in Einstellungen → Konto).

Hinweis 4.1.04: Die Tabelle `staff_sessions` gehört zur Anmeldung der App und darf nicht verändert werden. Das Login-Protokoll nutzt eigene Tabellen mit der Vorsilbe `nx_`. Die Datei `sql/4.1.03_presence_log.sql` gibt es nicht mehr; falls sie schon (teilweise) ausgeführt wurde, ist nichts aufzuräumen, denn sie ist vor Änderungen abgebrochen.

## Update 4.1.05 (Urlaub & Krankmeldung, schnelleres TomiAI, TomiAI-Knopf verschiebbar)
Reihenfolge einhalten:
1. **SQL Editor:** `sql/4.1.05_absences.sql` ausführen (Tabelle `absence_requests`, Funktionen, Push-Trigger, neue Push-Kategorien). Bei „Potential issue detected“ → *Run query*. Das Skript darf mehrmals ausgeführt werden. Voraussetzung: `4.1.00_push_tomi.sql` und `3.2.03_betrieb.sql` wurden schon ausgeführt.
2. **Edge Function tomi-ai** neu bereitstellen (Code aus `supabase/functions/tomi-ai/index.ts` einfügen und deployen, oder `supabase functions deploy tomi-ai`). Die Funktion `send-push` bleibt unverändert, die neuen Push-Meldungen laufen darüber.
3. **App hochladen:** alle geänderten Dateien aus dem 4.1.05-Paket ersetzen und die neuen Dateien `js/version.js` und `js/absence.js` mit hochladen. Danach die App einmal ganz schließen und neu öffnen (oder unter Menü → „App neu laden“).
4. **Prüfen:**
   - Dashboard zeigt die Kachel **🏖️ Urlaub / Krank**. Als Kellner einen Urlaub beantragen, als Manager erscheint eine rote Zahl und eine Push-Meldung. Nach dem Genehmigen fragt die App, ob **U/K** in den Arbeitsplan eingetragen werden soll.
   - Einstellungen → 🎨 Darstellung → **✨ TomiAI-Knopf**: ausblenden, „Knopf verschieben“ einschalten und den Knopf ziehen.
   - Einstellungen: Auf schmalen Fenstern erscheinen bei den Reitern die Pfeile ‹ ›.
   - Im Log von `tomi-ai` steht jetzt z. B. `tomi: topics=sched context=120ms prompt=2400 chars (~700 tokens)`. Das zeigt, wie viel an die KI geschickt wurde.

**Neu für Entwickler: Versionsnummer nur an einer Stelle.** Bei einer neuen Version:
- `js/version.js`: `APP_VERSION` ändern (einzige Stelle; Titel, Anzeige in der App, `?v=` aller Dateien und der Service Worker folgen automatisch).
- `js/changelog.js`: oben einen neuen Eintrag einfügen.
- Eine neue JS-Datei muss in `js/version.js` in der Liste `APP_SCRIPTS` eingetragen werden (nicht mehr in `index.html`).
- `js/version.js` wird absichtlich ohne `?v=` geladen, damit sie immer frisch ist.
- Nicht automatisch ändern sich die Verlaufseinträge in `changelog.js`, Dateinamen im Ordner `sql/` und diese Dokumentation.

**TomiAI-Hinweise:** Standardmäßig versucht TomiAI zuerst `gemini-2.5-flash-lite` (schnell), bei Plan-Änderungen durch Manager zuerst `gemini-2.5-flash`. Ist das Secret `GEMINI_MODEL` gesetzt, wird dieses Modell immer zuerst genommen. Wenn dir die Antworten zu knapp vorkommen, das Secret auf `gemini-2.5-flash` setzen.

## Update 4.1.06 (Tagesangebot: Tageskuchen & Tagessuppe, Zettel per Foto einlesen)
Reihenfolge einhalten:
1. **SQL Editor:** `sql/4.1.06_daily_specials.sql` ausführen (Tabelle `daily_specials`). Bei „Potential issue detected“ → *Run query*. Das Skript darf mehrmals ausgeführt werden.
2. **Neue Edge Function `scan-special`** bereitstellen: Im Supabase Dashboard → Edge Functions → neue Funktion `scan-special` anlegen und den Code aus `supabase/functions/scan-special/index.ts` einfügen, oder per Konsole `supabase functions deploy scan-special`. Sie verwendet dasselbe Secret `GEMINI_API_KEY` wie `tomi-ai` (nichts Neues einzutragen). Optional: Secret `GEMINI_MODEL_SCAN`, falls du ein bestimmtes Modell zum Lesen der Zettel willst (Standard: `gemini-2.5-flash`).
3. **Edge Function `tomi-ai`** neu bereitstellen (TomiAI kennt jetzt das Tagesangebot).
4. **App hochladen:** alle geänderten Dateien aus dem 4.1.06-Paket ersetzen und die neue Datei `js/specials.js` mit hochladen. Danach die App einmal ganz schließen und neu öffnen (oder Menü → „App neu laden“).
5. **Prüfen:**
   - Dashboard zeigt die Kachel **🍰 Tagesangebot** (bei Bar bzw. Service).
   - Als Manager: **➕ Neu** → Suppe und Kuchen für heute eintragen. Kellner sehen sie sofort im Reiter „Heute“.
   - Als Manager: **📷 Foto scannen** → Zettel fotografieren → Ergebnis neben dem Foto prüfen → Häkchen setzen → Speichern.
   - TomiAI fragen: „Was ist heute die Suppe und welche Allergene hat sie?“

**Hinweise zum Foto-Scan:**
- Nur Manager und Developer können scannen. Das Foto wird nur zum Lesen an Google Gemini geschickt, **nicht gespeichert**.
- Gespeichert wird erst nach dem Häkchen „Ich habe Namen und Allergene mit dem Original verglichen“. Die KI liest nur Buchstaben, die auf dem Zettel stehen. Sie rät nie Allergene aus dem Namen des Gerichts. Für die Richtigkeit der Allergene ist immer der Manager verantwortlich.
- Jeder Scan zählt zum Tageslimit der KI-Anfragen (gemeinsam mit TomiAI). Wird nichts erkannt, wird der Versuch gutgeschrieben.
- Weitere Arten wie „Tagesgericht“: in `js/specials.js` die Liste `SP_KINDS` erweitern (die Datenbank erlaubt `dish` bereits).
- `js/specials.js` ist in `js/version.js` unter `APP_SCRIPTS` eingetragen.

## Update 4.1.07 (Mitteilungen 🔔, Fenster per Klick daneben schließen, TomiAI: vollständige Tagesliste)
Reihenfolge einhalten:
1. **SQL Editor:** `sql/4.1.07_inbox.sql` ausführen (Tabellen `inbox_items` und `inbox_state`, Funktionen `inbox_list`, `inbox_unread_count`, `inbox_mark_read` und eine erweiterte `push_enqueue`, die Meldungen zusätzlich als Mitteilung speichert). Bei „Potential issue detected“ → *Run query*. Das Skript darf mehrmals ausgeführt werden. Voraussetzung: `4.1.00_push_tomi.sql` wurde schon ausgeführt.
2. **Edge Function `tomi-ai`** neu bereitstellen (`supabase/functions/tomi-ai/index.ts`). **Wichtig:** Hast du in dieser Datei selbst etwas geändert (z. B. die Modell-Reihenfolge in der Funktion `modelsFor`), diese Änderung nach dem Einfügen wieder eintragen. Wenn du die Modelle über das Secret `GEMINI_MODEL` gesetzt hast, bleibt das unverändert wirksam.
3. **App hochladen:** alle geänderten Dateien aus dem 4.1.07-Paket ersetzen und die neuen Dateien `js/inbox.js` und `js/dialogs.js` mit hochladen. Danach die App einmal ganz schließen und neu öffnen.
4. **Prüfen:**
   - Unter dem Datum im Dashboard erscheint beim ersten Start **„🚀 Neu in v4.1.07“**. Tippen öffnet „Was ist neu?“, danach verschwindet der Hinweis.
   - Als Kellner Urlaub beantragen, als Manager genehmigen: Beim Kellner blinkt **„🔔 1 neu“**. Das klappt auch, wenn Push auf dem Gerät aus ist.
   - Fenster öffnen und neben das Fenster klicken: es schließt. Etwas eintippen und daneben klicken: es bleibt offen und wackelt. Ein/Aus unter Einstellungen → Darstellung → **Fenster**.
   - TomiAI fragen: „kto zajtra pracuje“. Die Antwort nennt alle Personen mit Anzahl. Im Log von `tomi-ai` steht `prompt=… chars`.
   - Tritt bei TomiAI ein Fehler auf, zeigen Manager/Developer in eckigen Klammern einen kurzen Code, z. B. `[429×2]` (Limit) oder `[timeout]`. Normale Mitarbeiter sehen ihn nicht.

**Hinweise:**
- Mitteilungen werden 30 Tage angezeigt, ältere Einträge nach 45 Tagen gelöscht. Chat gehört nicht dazu. Welche Arten du bekommst, folgt den Einstellungen unter Hinweise (Push und Mitteilungen).
- Vor Ausführen des SQL zeigt die Glocke nichts an (außer „Neue Version“), und das Fenster weist auf das fehlende SQL hin.
- `js/inbox.js` und `js/dialogs.js` sind in `js/version.js` unter `APP_SCRIPTS` eingetragen.

## Update 4.2.00 (Exklusiv-Schicht: Tischtabelle)
Reihenfolge einhalten:
1. **SQL Editor:** `sql/4.2.00_exclusive.sql` ausführen (Tabellen `exclusive_shifts` und `exclusive_tables`, Funktion `exclusive_set_field`; alles nur für Manager/Developer). Bei „Potential issue detected“ → *Run query*. Das Skript darf mehrmals ausgeführt werden.
2. **App hochladen:** alle geänderten Dateien aus dem 4.2.00-Paket ersetzen und die neue Datei `js/exclusive.js` mit hochladen. Danach die App einmal ganz schließen und neu öffnen. Die Edge Functions bleiben unverändert.
3. **Prüfen** (als Manager): Dashboard → Bereich Bar → **🍽️ Exklusiv-Schicht** → **➕ Neue Schicht** → Tische wählen → Werte eintragen: Summen unten stimmen. **🖨️ Drucken** und **📊 Excel** testen.

**Hinweise:**
- Die Tabelle ist nur für Manager und Developer sichtbar und änderbar (auch in der Datenbank abgesichert). Eine Küchenansicht und Live-Anbindung sind bewusst noch nicht enthalten. Die Daten liegen in einfachen Tabellen, damit später eine andere App angebunden werden kann.
- Die Excel-Datei wird ohne Zusatzbibliothek direkt in der App erzeugt (Aussehen wie die Vorlage: grüne Kopfzeile, gelbe Tisch-Nr., graue Summenzeile, fixierte Kopfzeile und Spalten, Querformat).
- `js/exclusive.js` ist in `js/version.js` unter `APP_SCRIPTS` eingetragen.


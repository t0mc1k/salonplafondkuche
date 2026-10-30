# Salonplafond KÜCHE – Projektstruktur

Statische Web-App (kein Build nötig). Läuft auf GitHub Pages, Daten in Supabase.

```
index.html          Aufbau der Seite (HTML: Fenster/Modals, Buttons) + Liste der Skripte
css/style.css       Aussehen (eigene Styles, Druck-Layout)
js/                 Logik, in Themen aufgeteilt (siehe unten)
```

## Wo steht was?

| Ich will ändern ...                                     | Datei                |
|---------------------------------------------------------|----------------------|
| Supabase-Adresse/Key, gemeinsame Variablen, Hilfsfunktionen | js/config.js    |
| Einstellungen & Zentrale (Design, Schrift, Sortierung, Blur ...) | js/settings.js |
| Menü, Einstellungen, Theme, Blur, Hinweise (Toast), Vollbild, Foto-Vorschau | js/ui.js |
| PIN-Login, Rollen/Rechte, Abmelden, Hinweis bei Kollegen-Login | js/auth.js    |
| Eigenes Profil, Profil anderer Mitarbeiter              | js/profile.js        |
| Personal & PINs, Login-Historie (Admin)                 | js/staff-admin.js    |
| Team-Chat                                               | js/chat.js           |
| Support-Tickets                                         | js/tickets.js        |
| Version, Changelog („Was ist neu?“), Team-News          | js/changelog.js      |
| Arbeitsplan                                             | js/schedule.js       |
| Saisons                                                 | js/seasons.js        |
| Gerichteliste, Filter, Detail-Fenster, Rezept drucken   | js/dishes.js         |
| Gericht anlegen/ändern/löschen, Zutaten, Foto-Upload    | js/dish-admin.js     |
| Multi-View-Korb, Drag & Drop, Gericht tauschen          | js/tray.js           |
| Einkaufsliste / Inventur                                | js/shopping.js       |
| Excel-Import, Export (Excel/CSV)                        | js/import-export.js  |
| Speisekarten-Druck A3                                         | js/print-a3.js       |
| Programmstart                                           | js/app.js            |
| Neues Fenster / neuer Button / Text auf der Seite       | index.html           |
| Farben, Abstände, Druck-Layout                          | css/style.css        |

Meistens ändert man nur EINE Datei (bei neuen Buttons zusätzlich index.html).

## Regeln

1. Klassische Skripte, KEIN `import`/`export`. Alle Funktionen sind global,
   weil `onclick="..."` im HTML sie direkt aufruft.
2. Reihenfolge in index.html ist wichtig: `config.js` zuerst, `app.js` zuletzt.
3. Funktionsnamen müssen im ganzen Projekt eindeutig sein. Vor dem Anlegen
   einer neuen Funktion im Repository nach dem Namen suchen (GitHub: Taste `/`
   bzw. Code-Suche), sonst überschreibt die später geladene Datei die andere
   ohne Fehlermeldung.
4. Neue Funktion: in die Datei, die zum Thema passt. Gehört sie zu keinem Thema,
   neue Datei `js/xyz.js` anlegen und in index.html eine Zeile
   `<script src="js/xyz.js?v=..."></script>` VOR `app.js` einfügen.
5. Rechte werden NICHT im Browser entschieden, sondern in Supabase (RLS + Funktionen).
   Neue Tabellen immer mit Row Level Security und passenden Regeln anlegen.

## Neue Version veröffentlichen

1. Dateien ändern.
2. In `js/changelog.js`: `APP_VERSION` auf die neue Nummer setzen und GANZ OBEN in
   `CHANGELOG` einen neuen Eintrag einfügen. Die bisherige Version rutscht
   automatisch ins Archiv, alle sichtbaren Versionsnummern (Titel, Menü, Fußzeile,
   Changelog) übernehmen die Nummer selbst.
3. In index.html alle `?v=...` durch die neue Nummer ersetzen (Suchen & Ersetzen),
   damit Browser keine alten Dateien aus dem Cache laden.
4. Auf GitHub hochladen (commit). Nach 1–2 Minuten ist die Seite aktualisiert.
5. Seite mit Strg+F5 neu laden und in der Konsole (F12) auf rote Fehler prüfen.

## Datenbank-Änderungen (Supabase)

Jede Änderung an der Datenbank liegt als SQL-Datei im Ordner `sql/` (nach Version benannt).
Die Datei im Supabase „SQL Editor“ ausführen, bevor die passende App-Version hochgeladen wird.

## Erste Einrichtung (neue Supabase-Datenbank)

1. Supabase > SQL Editor: `sql/1.0.00_setup.sql` ausführen (Tabellen, Funktionen, Regeln, Foto-Speicher „kitchen“).
2. `sql/1.0.00_first_developer.sql`: bei `v_pin` eigenen PIN eintragen und ausführen.
3. Dateien auf GitHub Pages hochladen, Seite öffnen, mit dem Developer-Konto anmelden.
4. Menü > Personal & PINs: Köche anlegen.

Ab Version 1.1.00 zusätzlich: `sql/1.1.00_handovers.sql` ausführen (Schichtübergabe, js/handovers.js).
Ab Version 1.1.01 zusätzlich: `sql/1.1.01_roles_functions.sql` ausführen (Rolle Sous Chef, Funktionen der Köche).

Wichtige Namen in der Datenbank: Tabellen `dishes` und `kitchen_handovers`, Recht `can_edit_recipes`, Storage-Bucket `kitchen`.

## App installieren (ab 1.1.02)

Dateien `manifest.webmanifest`, `sw.js`, `js/pwa.js` und der Ordner `icons/` müssen **im selben Ordner wie index.html** liegen (GitHub Pages, HTTPS).
In der App: Menü > App installieren (oder Einstellungen > App). Nach einem Update einmal neu laden (Ctrl+F5), der Service Worker holt immer zuerst die neueste Version.

## WhatsApp und Benachrichtigungen (ab 1.2.00)

**WhatsApp**: funktioniert ohne Einrichtung. Die Nachricht wird kopiert und `https://wa.me/?text=...` geöffnet. Der Ersatz-Gruppenlink steht in `js/handovers.js` (Konstante `WA_FALLBACK_GROUP`).

**Benachrichtigungen bei geöffneter App**: funktioniert sofort (Einstellungen > App > Benachrichtigungen > Aktivieren).

**Push bei geschlossener App** (einmalige Einrichtung):
1. `sql/1.2.00_push.sql` in Supabase ausführen. Das Ergebnis `webhook_secret` am Ende kopieren.
2. VAPID-Schlüssel erzeugen: Datei `tools/vapid-keys.html` im Browser öffnen und „Schlüssel erzeugen“ klicken (alternativ `npx web-push generate-vapid-keys`).
3. Den **öffentlichen** Schlüssel in `js/config.js` bei `VAPID_PUBLIC_KEY` eintragen.
4. Edge Function bereitstellen (Supabase CLI): 
   `supabase link --project-ref rdymkhkowbyslhfnbubk`
   `supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:deine@mail.at WEBHOOK_SECRET=<webhook_secret aus Schritt 1>`
   `supabase functions deploy send-push --no-verify-jwt`
5. Ab Version 1.2.01 zusätzlich `sql/1.2.01_push_details.sql` ausführen und die Edge Function neu bereitstellen (Mitteilungen mit Text, Chat).
6. App neu hochladen, in der App Benachrichtigungen aktivieren.

Der private Schlüssel gehört nur in die Supabase-Secrets, niemals in die App-Dateien.
iPhone: Push funktioniert erst ab iOS 16.4 und nur, wenn die App über „Zum Home-Bildschirm“ installiert ist.

Ohne Kommandozeile geht die Bereitstellung auch im Supabase-Dashboard: **Edge Functions → Deploy a new function → Via Editor**, Name `send-push`, Inhalt von `supabase/functions/send-push/index.ts` einfügen, bei den Einstellungen „Verify JWT“ ausschalten. Die vier Secrets stehen unter **Edge Functions → Secrets**.

Hinweis Android: Die graue Mitteilung „Küche – Tippen kopiert die URL dieser App“ stammt von Edge/Chrome selbst (Anzeige für installierte Web-Apps) und nicht von der App. Mitteilungen der App erscheinen separat, mit Titel und Text.

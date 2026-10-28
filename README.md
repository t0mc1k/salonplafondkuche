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

Wichtige Namen in der Datenbank: Tabellen `dishes` und `kitchen_handovers`, Recht `can_edit_recipes`, Storage-Bucket `kitchen`.

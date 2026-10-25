# Salonplafond BAR – Projektstruktur

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
| Menü, Einstellungen, Theme, Vollbild, Foto-Vorschau     | js/ui.js             |
| PIN-Login, Rollen/Rechte, Abmelden                      | js/auth.js           |
| Eigenes Profil, Profil anderer Mitarbeiter              | js/profile.js        |
| Personal & PINs, Login-Historie (Admin)                 | js/staff-admin.js    |
| Team-Chat                                               | js/chat.js           |
| Support-Tickets, Changelog                              | js/tickets.js        |
| Arbeitsplan                                             | js/schedule.js       |
| Saisons                                                 | js/seasons.js        |
| Getränkeliste, Filter, Detail-Fenster, Rezept drucken   | js/drinks.js         |
| Getränk anlegen/ändern/löschen, Zutaten, Foto-Upload    | js/drink-admin.js    |
| Multi-View-Korb, Drag & Drop, Getränk tauschen          | js/tray.js           |
| Einkaufsliste / Inventur                                | js/shopping.js       |
| Excel-Import, Export (Excel/CSV)                        | js/import-export.js  |
| Karten-Druck A3                                         | js/print-a3.js       |
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
2. In index.html alle `?v=3.0.52` durch die neue Version ersetzen
   (Suchen & Ersetzen), damit Browser keine alten Dateien aus dem Cache laden.
   Sichtbare Versionsnummer (Titel, Menü, Fußzeile) ebenfalls anpassen.
3. Auf GitHub hochladen (commit). Nach 1–2 Minuten ist die Seite aktualisiert.
4. Seite mit Strg+F5 neu laden und in der Konsole (F12) auf rote Fehler prüfen.

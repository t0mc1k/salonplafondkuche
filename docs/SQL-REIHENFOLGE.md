# SQL-Dateien der Küche: Reihenfolge

Im Supabase **SQL Editor** der Küchen-Datenbank nacheinander ausführen. Jede Datei ist mehrfach ausführbar.
Neue Datenbank = alle der Reihe nach. Bei einem Update nur die neuen Dateien.

| Datei | Inhalt | In App-Version |
|---|---|---|
| `1.0.00_init.sql` | Personal, PIN-Login, Rollen, Hilfsfunktionen, Start-PIN 1234 | 1.0.00 |
| `1.0.01_recipes.sql` | Rezepte, Foto-Speicher | 1.0.01 |
| `1.0.02_workplan.sql` | Dienstplan nach KW, Veröffentlichung | 1.0.02 |
| `1.0.03_exclusive_days.sql` | Exklusiv-Tage im Dienstplan | 1.0.04 |
| `1.0.04_fridge_temps.sql` | Kühlschrank-Temperaturen | 1.0.06 |
| `1.0.05_dishwash.sql` | Abwasher | 1.0.08 |
| `1.0.06_chat_tickets_prefs.sql` | Team-Chat, Tickets, Einstellungen, Schlüssel für die Bar-Datenbank | 1.0.09 |
| `1.0.07_betrieb.sql` | Checklisten, Schichttausch, Stunden, Speisekarte & Allergene, Störungen, Verluste & Bruch | 1.0.09 |
| `1.0.08_push.sql` | Push-Meldungen (Server-Teil) und TomiAI-Zähler | 1.0.09 |
| `1.0.09_presence_absence_inbox.sql` | Online-Status & Login-Protokoll, Urlaub/Krank, Tagesangebot, Mitteilungen | 1.0.09 |
| `1.0.10_pin_change.sql` | PIN beim ersten Login ändern, Start-PIN für Developer sichtbar | 1.0.10 |
| `1.0.11_kitchen_areas.sql` | Checklisten-Bereiche der Küche (Küche, Patisserie, Lager) | 1.0.10 |

**Nur für die BAR-Datenbank:** `sql/bar-side/bar_bridge_for_kitchen.sql`, Anleitung in `docs/BAR-BRIDGE.md`.

`0.0.00_reset.sql` löscht ALLES im Schema public. Nur für einen kompletten Neustart der Küchen-Datenbank.

## Nicht übernommen aus der Bar
Fundsachen, Exklusiv-Schicht (kommt aus der Bar), Gastronaut-Sync (Reservierungen werden aus der Bar gelesen),
Getränke-Fotos (3.1.04). Arbeitsplan-Rechte (3.2.03, Abschnitt 0) gelten durch `1.0.02` anders: Mitarbeiter sehen nur
veröffentlichte Wochen.

## Push und TomiAI
Die Datenbank-Seite ist mit `1.0.08` fertig. Zum Senden von Push-Meldungen und für TomiAI fehlen noch die Edge Functions
`send-push` und `tomi-ai` (Ordner `supabase/functions/`) samt Schlüsseln (VAPID, Google/Gemini). Anleitung:
`docs/SETUP-4.1.00.md`. Ohne sie läuft die App normal, nur ohne Push und ohne TomiAI-Antworten.

# Zugang der Küche zur Bar-Datenbank (nur lesen)

Die Küche zeigt zwei Dinge aus der Bar-Datenbank an. Sie kann dort **nichts ändern**.

| Was | Wie gelesen | Wer sieht es in der Küche |
|---|---|---|
| **Reservierungen** (Gastronaut, Tabelle `gastronaut_sync`) | direkt, die Tabelle ist in der Bar schon für die App lesbar | alle außer Abwashern |
| **Exklusiv-Schicht** (Tische, Soll/Ist, Gerichte) | über die Funktion `kitchen_read_exclusive` mit gemeinsamem Schlüssel | Manager, Developer, Köche |

Die Exklusiv-Schicht wird weiter **nur in der Bar-App** angelegt und gepflegt. In der Küche kann man sie ansehen,
drucken und als Excel speichern.

## Warum ein Schlüssel?

In der Bar sind die Exklusiv-Tabellen nur für angemeldete Manager lesbar. Die Küche ist dort nicht angemeldet.
Damit die Daten nicht für jeden offen sind, gibt es eine Lese-Funktion, die nur mit einem langen gemeinsamen
Schlüssel antwortet:

- **Bar-Datenbank** speichert nur einen **Hash** des Schlüssels (`kitchen_bridge`).
- **Küchen-Datenbank** speichert den Schlüssel in `bridge_config` und gibt ihn nur an angemeldete
  Manager, Developer und Köche aus (`get_bar_bridge_key()`). Abwasher bekommen ihn nicht.
- Der Schlüssel steht **nicht im Programmcode** und nicht auf GitHub.

## Einrichtung (einmalig, 3 Schritte)

Ersetze `DEIN_SCHLUESSEL` überall durch denselben langen Zufallstext (mindestens 32 Zeichen, Buchstaben und Zahlen).

**1. In der BAR-Datenbank** (SQL Editor des Bar-Projekts): den Inhalt von
`sql/bar-side/bar_bridge_for_kitchen.sql` ausführen, danach:

```sql
insert into public.kitchen_bridge (id, key_hash)
values (1, extensions.crypt('DEIN_SCHLUESSEL', extensions.gen_salt('bf')))
on conflict (id) do update set key_hash = excluded.key_hash;
```

**2. In der KÜCHEN-Datenbank** (SQL Editor des Küchen-Projekts, nach `sql/1.0.06_chat_tickets_prefs.sql`):

```sql
insert into public.bridge_config (id, bar_key) values (1, 'DEIN_SCHLUESSEL')
on conflict (id) do update set bar_key = excluded.bar_key;
```

**3.** App neu laden (Strg+F5), als Manager oder Koch anmelden, Kachel „Exklusiv-Schicht“ öffnen.

## Schlüssel ändern

Beide SQL-Befehle mit dem neuen Schlüssel erneut ausführen (Bar und Küche). Bis beide geändert sind, zeigt die Küche
„Kein Zugriff auf die Bar-Datenbank“.

## Was die Bar-Datenbank durch die Brücke bekommt

Nur eine Tabelle (`kitchen_bridge`) und eine Funktion (`kitchen_read_exclusive`). Bestehende Tabellen, Rechte und
die Bar-App bleiben unverändert. Die Funktion liest nur (keine Schreibzugriffe) und liefert höchstens 60 Schichten
von 30 Tagen zurück bis 90 Tage voraus.

## Fehlermeldungen in der Küchen-App

| Meldung | Ursache |
|---|---|
| „Die Bar-Datenbank ist noch nicht für die Küche freigegeben“ | Schritt 1 fehlt |
| „Kein Schlüssel für die Bar-Datenbank hinterlegt“ | Schritt 2 fehlt |
| „Kein Zugriff auf die Bar-Datenbank“ | Schlüssel in Bar und Küche sind verschieden |

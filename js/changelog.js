/* ============================================================
   js/changelog.js
   „Was ist neu?“ (Änderungsliste) und dessen Bedienung

   NEUE VERSION VERÖFFENTLICHEN:
   1. In js/version.js die Nummer APP_VERSION ändern (einzige Stelle für die Versionsnummer!).
   2. Hier oben in CHANGELOG einen neuen Eintrag einfügen (neueste Version zuerst).
      Die bisher aktuelle Version rutscht automatisch ins Archiv.
   Titel, Anzeige in der App, „?v=“ (Cache) und Service Worker nehmen die Nummer selbst aus version.js.
   Änderungs-Typen: 'new' Neu, 'improved' Verbessert, 'fixed' Behoben,
                    'security' Sicherheit, 'info' Allgemein
   ============================================================ */

    const CHANGELOG = [
  { version: '1.0.29', range: '', date: 'November 2026', title: 'Neues App-Symbol mit Kochmütze',
    changes: [
      ['improved', 'Das App-Symbol bleibt (gelb, dunkler Ring), bekommt aber eine weiße Kochmütze oben drauf. So erkennst du auf dem Startbildschirm sofort die Küchen-App. Gilt für Symbol, Browser-Tab und Benachrichtigungen.'],
      ['info', 'Ein bereits installiertes Symbol aktualisiert sich nicht immer von selbst: Zum Ändern die App vom Startbildschirm entfernen und neu installieren („Zum Home-Bildschirm“). Android aktualisiert es manchmal nach einigen Tagen automatisch.']
    ] },
  { version: '1.0.28', range: '', date: 'November 2026', title: 'Datenbank-Verwaltung für den Developer',
    changes: [
      ['new', 'Neue Kachel „🗄️ Datenbank-Verwaltung“ (nur Developer, unter „Sicherheit & System“). 📊 Übersicht: Größe der Datenbank und des Foto-Speichers mit Balken (Free / Pro), jede Tabelle mit Zeilenzahl und Größe, Foto-Speicher nach Bereich.'],
      ['new', '🖼️ Fotos: alle gespeicherten Fotos als Kacheln mit Größe, Datum und Verwendung (Rezept, Abwasher, Chat …). Nicht verwendete Fotos (Reste von abgebrochenen Uploads) werden erkannt. Fotos einzeln, ausgewählt oder alle nicht verwendeten löschen. Foto und Vorschau werden zusammen entfernt, die App warnt bei noch verwendeten Fotos.'],
      ['new', '🧹 Aufbewahrung: Regeln „älter als X Tage löschen“ für Chat, Abwasher, Störungen, Verluste, Tickets, Bestelllisten, Protokolle, Push-Warteschlange u. a. (alle zuerst aus, mit Mindestwerten für Temperatur- und Personaldaten). Probelauf, „Jetzt ausführen“ und automatischer Zeitplan (alle 1 bis 30 Tage, Uhrzeit UTC). Foto-Dateien werden dabei wirklich aus dem Speicher gelöscht.'],
      ['info', 'Einrichtung: sql/1.0.16_db_admin.sql ausführen und die Edge Function db-admin bereitstellen (supabase/functions/db-admin/index.ts, Verify JWT aus). Für den Zeitplan zusätzlich die Erweiterung pg_cron aktivieren. Details in docs/SETUP-4.1.00.md.']
    ] },
  { version: '1.0.27', range: '', date: 'November 2026', title: 'Abwasher: Fotos der Arbeit (3) und mehr Fotos je Ort (5), Speicher-Übersicht',
    changes: [
      ['new', 'Abwasher: Beim Erledigen gibt es „📷“ (Erledigt mit Foto): bis zu 3 Fotos der Arbeit (z. B. vorher / nachher), aufnehmen oder aus der Galerie. Bei erledigten Aufgaben kannst du Fotos später hinzufügen oder entfernen (Eintragender bis 24 Stunden, Leitung immer). Die Fotos erscheinen als kleine Bilder bei der Aufgabe und im Detail der Übersicht.'],
      ['new', 'Orte (Leitung): bis zu 5 Fotos pro Aufgabe (das erste ist das Hauptfoto, ⭐ ändert es). In der Aufgabenliste zeigt das Vorschaubild „+N“, ein Tipp öffnet die Galerie.'],
      ['improved', 'Sparsam mit Speicher und Datenvolumen: Fotos der Arbeit werden auf 1280 px, Ort-Fotos auf 1600 px verkleinert, dazu gibt es eine winzige Vorschau für die Listen. Entfernte, abgebrochene oder gelöschte Fotos werden wirklich aus dem Speicher gelöscht.'],
      ['new', 'Orte (Leitung): „📦 Foto-Speicher“ zeigt, wie viel Platz die Fotos belegen (aufgeteilt nach Bereich, mit Balken und Tarif Free 1 GB / Pro 100 GB). „🧹 Alte Arbeitsfotos löschen“ entfernt Fotos älter als X Tage (die Einträge bleiben).'],
      ['info', 'Einrichtung: sql/1.0.15_wash_photos.sql im Supabase SQL Editor der Küche ausführen.']
    ] },
  { version: '1.0.26', range: '', date: 'November 2026', title: 'Display am Kühlgerät ablesen, Abwasher-Aufgaben als Liste',
    changes: [
      ['new', 'Kühlschrank-Temperaturen: „📟 Display“. Die rote digitale Anzeige am Kühlgerät fotografieren (oder ein Foto wählen), die KI liest die Temperatur. Du siehst die Zahl groß, vergleichst mit dem Foto, korrigierst bei Bedarf (± dreht das Vorzeichen, z. B. wenn bei einem Tiefkühler das Minus fehlt) und speicherst. Danach ist gleich das nächste Gerät vorgewählt. Datum frei wählbar (nicht in der Zukunft).'],
      ['improved', 'Abwasher → Meine Aufgaben: kompakte Liste statt großer Karten. Links ein kleines Vorschaubild (Tippen = groß), in der Mitte Name, Beschreibung und wer es erledigt hat, rechts „✓ Erledigt“ und 👥. Offene Aufgaben stehen oben, erledigte darunter.'],
      ['info', 'Einrichtung: Edge Function scan-temps erneut bereitstellen (dieselbe Datei supabase/functions/scan-temps/index.ts, sie kennt jetzt auch das Display). SQL ist nicht nötig.']
    ] },
  { version: '1.0.25', range: '', date: 'November 2026', title: 'Tägliche Bestellliste, Temperaturen teilen & per Foto',
    changes: [
      ['new', 'Bestellliste ist jetzt eine tägliche Meldung: pro Tag eine Liste mit Datum (z. B. „Sa 14.11.2026“). Mit ‹ › blätterst du durch die gespeicherten Tage, „Heute“ springt zu heute, 📅 wählt ein Datum, 📜 zeigt alle gespeicherten Tage. Ein neuer Tag beginnt automatisch eine neue Liste. Erledigte Listen lassen sich wieder öffnen.'],
      ['new', 'Kühlschrank-Temperaturen: „📤 Teilen“ mit Vorschau der Monatstabelle (Rot = außerhalb Soll), WhatsApp (Bild, PDF oder Text mit den Abweichungen), als Bild oder PDF speichern und drucken.'],
      ['new', 'Kühlschrank-Temperaturen: „📷 Foto einlesen“. Die ausgefüllte Papierliste fotografieren oder ein vorhandenes Foto / eine Datei wählen. Die KI liest die Werte, du kontrollierst und korrigierst jeden Wert (orange = unsicher, rot = außerhalb Soll, blau = neu), erst dann wird gespeichert. Kühlgeräte werden über den Spaltennamen zugeordnet.'],
      ['info', 'Einrichtung: sql/1.0.14_order_daily.sql ausführen und die Edge Function scan-temps bereitstellen (supabase/functions/scan-temps/index.ts, Verify JWT aus, siehe docs/SETUP-4.1.00.md). Das Teilen-Modul (js/share-doc.js) ist neu, die Bestellliste nutzt es jetzt ebenfalls.']
    ] },
  { version: '1.0.24', range: '', date: 'November 2026', title: 'Stunden & Lohn: Woche oder Monat',
    changes: [
      ['new', 'Stunden & Lohn hat wieder die Monatsansicht: Umschalter „Woche | Monat“ neben der Zeitraum-Anzeige. Die Woche (KW, Mo–So) bleibt die Standardansicht. Beim Umschalten springt die App zum passenden Monat bzw. zur passenden Woche. Pause (30 Min.), Summen ohne/mit Pause, Detail pro Tag und Excel funktionieren in beiden Ansichten.']
    ] },
  { version: '1.0.23', range: '', date: 'November 2026', title: 'Stunden & Lohn pro Woche',
    changes: [
      ['improved', 'Stunden & Lohn rechnet jetzt pro Kalenderwoche (Montag bis Sonntag, KW und Datum wie im Dienstplan) statt pro Monat. Wochenwahl mit ‹ ›, „Heute“ springt zur aktuellen Woche. Wochen über einen Monatswechsel werden richtig zusammengezählt.'],
      ['improved', 'Excel: „Stunden_KW47_….xlsx“ mit der Woche als Blattname. Pause automatisch 30 Min., Summen ohne und mit Pause bleiben.']
    ] },
  { version: '1.0.22', range: '', date: 'November 2026', title: 'Dienstplan: Person aus einer Woche entfernen',
    changes: [
      ['new', 'Dienstplan (Manager/Developer): Neben dem Namen steht „✕“. Es entfernt die Person aus der angezeigten Woche (alle Einträge dieser 7 Tage), auch aus alten, schon veröffentlichten Wochen. Das Mitarbeiter-Konto und andere Wochen bleiben unverändert.'],
      ['improved', 'Personen ohne Einträge in der Woche sind für die Leitung abgeblendet („nicht im Plan“), Mitarbeiter sehen sie gar nicht mehr.']
    ] },
  { version: '1.0.21', range: '', date: 'November 2026', title: 'Abwasher: Foto in der Übersicht, zu zweit putzen, Rangliste für alle',
    changes: [
      ['new', 'Übersicht (Leitung): Ein Tipp auf einen erledigten Eintrag zeigt das Foto des Ortes groß, dazu Beschreibung, wer und wann.'],
      ['new', 'Zu zweit putzen: Beim Abhaken gibt es „👥 Zu zweit“, nach dem Abhaken „👥“ (Eintragender bis 24 Stunden, Leitung jederzeit). Der Kollege steht beim Eintrag und bekommt ebenfalls den Punkt, auch in der Rangliste und in der gespeicherten Monatswertung.'],
      ['new', 'Rangliste und Monate sehen jetzt alle Abwasher (eigene Zeile markiert), nicht nur die Leitung.'],
      ['info', 'Einrichtung: sql/1.0.13_wash_helpers.sql im Supabase SQL Editor der Küche ausführen.']
    ] },
  { version: '1.0.20', range: '', date: 'November 2026', title: 'Dienstplan: neue Personen, Tippfehler, F/S; Teilen; Pause',
    changes: [
      ['improved', 'Dienstplan-Foto und Excel-Import ordnen Personen nur über den NAMEN zu, nicht mehr über Zeilen oder Reihenfolge. Tippfehler wie „Tomas Kardoszzzzz“ werden automatisch zu „Tomas Kardos“. Die KI wurde für schräge Fotos und leere/Gruppenzeilen angewiesen, Zeile für Zeile am Namen entlangzulesen.'],
      ['new', 'Neue Person im Plan (z. B. neuer Lehrling): Du wählst pro Person „👤 Konto anlegen (PIN 1234)“, „✔ Zuordnen“ zu einer vorhandenen Person oder „📄 Nur im Dienstplan“ (ohne Konto). Position und Team aus dem Plan werden übernommen. Gespeichert wird erst, wenn alle geklärt sind. Gleiche Personen in zwei Zeilen und Personen, die auf dem Foto fehlen, werden gemeldet.'],
      ['improved', 'Frei heißt jetzt „F“ (nicht mehr OFF). F, FF, OFF, X und „frei“ werden alle als Frei erkannt. Neu: „S“ = Schule (Lehrlinge). Im Zellen-Dialog gibt es „Frei (F)“ und „Schule (S)“.'],
      ['improved', 'Dienstplan-Tabelle wie der echte Aushang: Spalte „Position“, ohne „Unterschrift“. Auch im Excel-Export.'],
      ['new', 'Orte (Abwasher) und Störung melden: Foto jetzt wahlweise „📷 aufnehmen“ oder „🖼️ Datei / Galerie wählen“ (vorher startete immer die Kamera).'],
      ['new', 'Bestellliste: „📤 Teilen“ mit Vorschau des Dokuments, Teilen über WhatsApp (Bild oder PDF, über das Teilen-Menü des Handys), als Text in WhatsApp, als Bild (PNG) oder PDF speichern, drucken. Nach „Ich bin fertig“ steht der Knopf ganz oben.'],
      ['new', 'Stunden & Lohn: bei jeder Schicht über 6 Stunden werden automatisch 30 Minuten Pause abgezogen (im Tag änderbar). Es gibt zwei Summen: ohne Pause und mit Pause, in der Übersicht, im Detail und im Excel.'],
      ['info', 'Einrichtung: Edge Function scan-roster neu bereitstellen (Datei supabase/functions/scan-roster/index.ts), sonst bleibt die alte KI-Anweisung aktiv. Alles andere gilt sofort nach dem Hochladen.']
    ] },
  { version: '1.0.19', range: '', date: 'November 2026', title: 'Mitteilungen im Stil „NeXuS Glass“ lesbar',
    changes: [
      ['fixed', 'Im dunklen Stil „NeXuS Glass“ war der blinkende Mitteilungs-Chip unter der Begrüßung (🔔 neu / 🚀 Neu in v…) dunkel auf dunkel und der Text nicht zu sehen. Jetzt steht er in hellem Gold.']
    ] },
  { version: '1.0.18', range: '', date: 'November 2026', title: 'Exklusiv-Schicht: Vollbild passt die ganze Tabelle an',
    changes: [
      ['improved', 'Vollbild: Die Tabelle wird automatisch so skaliert, dass sie komplett auf den Bildschirm passt, ohne Scrollen (auch nach dem Drehen des Handys). Der Kopf mit Titel ist im Vollbild ausgeblendet, damit mehr Platz bleibt.']
    ] },
  { version: '1.0.17', range: '', date: 'November 2026', title: 'Exklusiv-Schicht: automatisch aktuell, Vollbild, Drehen',
    changes: [
      ['new', 'Exklusiv-Schicht: Solange das Fenster offen ist, holt sich die App alle 5 Sekunden die neuesten Daten aus der Bar (Anzeige „● live“). „Neu laden“ ist nicht mehr nötig, bleibt aber als Knopf. Die Scroll-Position bleibt erhalten.'],
      ['new', 'Neuer Knopf „⛶ Vollbild“: Die Tabelle füllt das ganze Fenster, damit man alles sieht.'],
      ['fixed', 'Handy drehen: Die installierte App war auf Hochformat festgelegt, jetzt dreht sie mit (Querformat möglich). Falls es noch nicht dreht: Drehsperre des Handys ausschalten und die App neu vom Home-Bildschirm öffnen (gegebenenfalls einmal neu installieren).']
    ] },
  { version: '1.0.16', range: '', date: 'November 2026', title: 'Bestellliste Gemüse / Obst',
    changes: [
      ['new', 'Neue Kachel „🥬 Bestellliste Gemüse / Obst“ für alle. Jeder trägt ein, was bestellt werden muss: Rubriken zum Aufklappen, Mengen mit + / −, Suche und „Nur Bestellte“. Die Produkte stammen aus der Vorlage „Hye Bestelliste.xlsx“, eigene Produkte lassen sich mit „＋ Produkt“ ergänzen.'],
      ['new', 'Live: Trägt ein Kollege etwas ein, erscheint es sofort auch bei den anderen. Unter der Liste steht, wer zuletzt etwas geändert hat und wann.'],
      ['new', '„✅ Ich bin fertig“ schließt die Liste mit Name und Zeit. Danach startet man eine neue Bestellung, frühere Bestellungen stehen unter 📜.'],
      ['new', '📗 Excel und 🖨️ Drucken im Aussehen der Vorlage (drei Blöcke Produkt | Menge | Einheit, A4 hoch), darunter Name und Zeit der letzten Änderung.'],
      ['info', 'Einrichtung: sql/1.0.12_order_list.sql im Supabase SQL Editor der Küche ausführen.']
    ] },
  { version: '1.0.15', range: '', date: 'November 2026', title: 'Dienstplan per Foto einlesen',
    changes: [
      ['new', 'Im Dienstplan: „📷 Foto scannen“ (Manager/Developer). Den ausgedruckten Plan mit der Handykamera fotografieren oder ein Foto aus der Galerie wählen. Die KI liest die Tabelle (Zeiten, Stationen, OFF, K, U, ZA, geteilte Dienste, Exklusiv-Tage).'],
      ['new', 'Vor dem Foto steht ein deutlicher Hinweis zur Qualität (gutes Handy, hohe Auflösung, ganze Seite, gerade von oben, gutes Licht, keine WhatsApp-Bilder). Kleine oder stark komprimierte Fotos werden erkannt und gemeldet.'],
      ['new', 'Kontrolle vor dem Speichern: Jede Zelle ist bearbeitbar. Orange = unsicher gelesen, rot = ungültig, blau unterstrichen = anders als im gespeicherten Plan (so fällt auf, wenn jemand am Aushang seine Schicht geändert hat). Gespeichert wird erst nach deiner Bestätigung, als Entwurf der geöffneten Woche. Das Foto wird nicht gespeichert.'],
      ['info', 'Einrichtung: Edge Function scan-roster bereitstellen (Verify JWT aus), siehe docs/SETUP-4.1.00.md. Nutzt denselben GEMINI_API_KEY wie TomiAI.']
    ] },
  { version: '1.0.14', range: '', date: 'November 2026', title: 'Abwasher mit Leitungsrolle: „Meine Arbeit“',
    changes: [
      ['improved', 'Wer Leitung ist und selbst abwäscht (z. B. Developer mit Zusatzrolle Abwasher), sieht auf dem Dashboard ganz oben die Gruppe „🧽 Meine Arbeit“ mit der Kachel Abwasher.'],
      ['improved', 'Im Fenster Abwasher sind „Meine Arbeit“ (✅ Meine Aufgaben mit dem Knopf ✓ Erledigt, ➕ Extra) und „Leitung“ (Übersicht, Rangliste, Monate, Orte) klar getrennt. Der Untertitel erklärt, wo abgehakt wird.'],
      ['improved', 'Gibt es noch keine Aufgaben, steht jetzt, dass sie zuerst unter „⚙️ Orte“ angelegt werden müssen.']
    ] },
  { version: '1.0.13', range: '', date: 'November 2026', title: 'Übersichtlichere Anmeldung',
    changes: [
      ['improved', 'Anmeldung: Die Namen stehen nach Teams geordnet (Leitung, AM-Team, PM-Team, Lehrling, Reinigung) und werden vollständig angezeigt, nichts wird mehr abgeschnitten. Auf dem Handy in zwei Spalten.']
    ] },
  { version: '1.0.12', range: '', date: 'November 2026', title: 'Tagesangebot kommt aus der Bar',
    changes: [
      ['new', 'Das Tagesangebot (Tageskuchen und Tagessuppe mit Allergenen) wird aus der Bar-App gelesen. In der Küche nur ansehen (Heute, Kommend, 🔄 Neu laden). Eintragen und Foto-Scan gibt es nur in der Bar-App.'],
      ['new', 'TomiAI beantwortet Fragen zum Tagesangebot ebenfalls mit den Daten der Bar. Ist die Bar nicht erreichbar, sagt er das ehrlich.'],
      ['improved', 'TomiAI nutzt die aktuellen Gemini-Modelle (die 2.5-Modelle sind abgeschaltet) und antwortet bei Überlastung deutlich schneller.'],
      ['info', 'Einrichtung: sql/bar-side/bar_bridge_for_kitchen.sql in der BAR-Datenbank noch einmal ausführen (Funktion kitchen_read_specials). Edge Function tomi-ai neu bereitstellen.']
    ] },
  { version: '1.0.11', range: '', date: 'November 2026', title: 'TomiAI und Push für die Küche',
    changes: [
      ['new', 'TomiAI kennt jetzt die Rezepte der Küche (Zutaten, Portionen, Garmethode, Zeit, Allergene), die Speisekarte, das Tagesangebot, Checklisten und den Dienstplan. Er antwortet als Assistent der Küche, nicht mehr der Bar.'],
      ['new', 'Push-Meldungen: neuer Dienstplan (erst wenn die Woche veröffentlicht ist), Chat und @Erwähnungen, Urlaub/Krank, Schichttausch, Störungen und Tickets. Einstellbar pro Person unter Hinweise.'],
      ['improved', 'TomiAI-Vorschläge für den Dienstplan kennen jetzt OFF, U, K und ZA.'],
      ['fixed', 'Der Push-Schlüssel der Bar steckte noch als Reserve im Code. Er ist entfernt: Ohne eigene Einrichtung zeigt die App „nicht eingerichtet“.'],
      ['info', 'Einrichtung: docs/SETUP-4.1.00.md (Secrets, Edge Functions send-push, tomi-ai, scan-special, Schlüssel in push_config).']
    ] },
  { version: '1.0.10', range: '', date: 'November 2026', title: 'Eigener PIN, Küchen-Texte überall, Rezepte-Import',
    changes: [
      ['new', 'Eigener PIN: Wer mit dem Start-PIN anmeldet, muss sofort einen eigenen PIN festlegen. Zu einfache PINs (1234, 1111 …) sind nicht erlaubt. Der eigene PIN ist für niemanden lesbar.'],
      ['new', 'Developer sehen im Profil einer Person den Start-PIN, solange sie noch keinen eigenen gesetzt hat. Danach steht dort „hat einen eigenen PIN gesetzt“. Ein neuer Start-PIN hebt auch eine Sperre auf.'],
      ['improved', 'Alle Texte sind auf die Küche umgestellt: Rezepte statt Getränke, Köche statt Kellner, Störungen mit Küchen-Bereichen (Küche, Patisserie, Spülküche, Lager), Verluste mit Geschirr und Ware, Checklisten für Küche, Patisserie und Lager, Hilfe-Kapitel inklusive neuer Kapitel für Dienstplan, Reservierungen, Abwasher, Temperaturen und PIN.'],
      ['new', 'Rezepte: Export als Excel/CSV mit allen Feldern und Import aus einer Excel-Tabelle (eine Zeile pro Rezept) mit Vorlage zum Herunterladen. Rezepte mit gleichem Namen in der Saison werden übersprungen.'],
      ['improved', 'Multi-View, Einkaufsliste/Inventur und Saisons arbeiten mit den Rezept-Feldern (Portionen, Methode, Zeit, Anrichten). Der alte Import des Monats-Arbeitsplans ist entfallen: Pläne importierst du im Dienstplan.'],
      ['improved', '„Was ist neu?“ enthält nur noch die Versionen der Küche. App-Name in Installation und Benachrichtigungen: Salonplafond Küche.'],
      ['info', 'Einrichtung: sql/1.0.10_pin_change.sql und sql/1.0.11_kitchen_areas.sql im Supabase SQL Editor ausführen.']
    ] },
  { version: '1.0.09', range: '', date: 'November 2026', title: 'Bar-Module laufen in der Küchen-Datenbank, Zugang zur Bar (nur lesen)',
    changes: [
      ['new', 'Reservierungen (Gastronaut) kommen jetzt direkt aus der Bar-Datenbank. Nur lesen.'],
      ['new', 'Exklusiv-Schicht: Manager, Developer und Köche sehen die von der Bar eingetragenen Tische, Soll/Ist und Gerichte (ansehen, drucken, Excel). Angelegt und geändert wird sie nur in der Bar-App. Der Zugang läuft über einen gemeinsamen Schlüssel, der nicht im Code steht (docs/BAR-BRIDGE.md).'],
      ['fixed', 'Team-Chat, Tickets, Störungen, Verluste & Bruch, Checklisten, Speisekarte & Allergene, Schichttausch, Stunden, Urlaub/Krank, Online-Status und Mitteilungen haben jetzt ihre Tabellen in der Küchen-Datenbank und funktionieren wieder. Fundsachen bleibt entfernt.'],
      ['improved', 'Meldung „Neuer Dienstplan“ erscheint erst, wenn eine Woche veröffentlicht wird (nicht bei Entwürfen).'],
      ['info', 'Einrichtung: sql/1.0.06 bis 1.0.09 ausführen (Reihenfolge in docs/SQL-REIHENFOLGE.md). Für die Bar-Verbindung zusätzlich docs/BAR-BRIDGE.md.']
    ] },
  { version: '1.0.08', range: '', date: 'November 2026', title: 'Neu: Abwasher',
    changes: [
      ['new', 'Neuer Bereich „🧽 Abwasher“: Orte/Aufgaben mit Foto und Rhythmus (täglich, wöchentlich, monatlich). Der Abwasher drückt „✓ Erledigt“, Name und Datum/Uhrzeit werden automatisch gespeichert.'],
      ['new', 'Extra-Einträge: Der Abwasher kann zusätzlich etwas eintragen, das er über die Liste hinaus geputzt hat. Extras zählen in der Wertung mit.'],
      ['new', 'Manager/Developer: Orte anlegen, ändern, ausblenden und mit Foto versehen; Übersicht aller Einträge pro Monat (Excel); Rangliste der Abwasher mit „Bester im Monat“; Monate werden nach Monatsende automatisch gespeichert („🗂️ Monate“).'],
      ['info', 'Rechte: Abwasher (Hauptrolle oder Zusatzrolle) sehen nur ihren Bereich. Köche haben keinen Zugriff. Die Rangliste sehen nur Manager/Developer.'],
      ['info', 'Einrichtung: sql/1.0.05_dishwash.sql im Supabase SQL Editor ausführen.']
    ] },
  { version: '1.0.07', range: '', date: 'November 2026', title: 'Mein Arbeitsplan ohne Pausen',
    changes: [
      ['improved', 'Mein Arbeitsplan: Die Pausen-Eingabe wurde entfernt. Angezeigt werden Schichten, Station und die geplanten Stunden. Frei (OFF), Urlaub, Krank und Zeitausgleich (ZA) werden richtig benannt.']
    ] },
  { version: '1.0.06', range: '', date: 'November 2026', title: 'Neu: Kühlschrank-Temperaturen',
    changes: [
      ['new', 'Neue Kachel „🌡️ Kühlschrank-Temperaturen“ (nur Manager/Developer): Monatstabelle mit allen Kühlgeräten aus der Vorlage Temperaturlisten.xlsx, einmal täglich eintragen.'],
      ['new', 'Jedes Gerät hat einen Soll-Bereich (z. B. Fleisch KH 1–3 °C, TK max. -18 °C). Werte außerhalb werden rot und zählen in der Zusammenfassung. Wer eingetragen hat und wann, wird automatisch gespeichert.'],
      ['new', 'Kühlgeräte und Soll-Bereiche lassen sich unter „⚙️ Kühlgeräte“ ändern, ausblenden oder neu anlegen. Export als Excel.'],
      ['info', 'Einrichtung: sql/1.0.04_fridge_temps.sql im Supabase SQL Editor ausführen.']
    ] },
  { version: '1.0.05', range: '', date: 'November 2026', title: 'Dienstplan-Import: jede Farbe markiert Exklusiv-Tage',
    changes: [
      ['improved', 'Als Exklusiv-Tag gilt jetzt jede Hintergrundfarbe im Datum oder Tagesnamen (nicht nur Orange). Weiß, Grau und „ohne Füllung“ zählen nicht.']
    ] },
  { version: '1.0.04', range: '', date: 'November 2026', title: 'Dienstplan: Exklusiv-Schicht und schlauere Blatt-Wahl',
    changes: [
      ['new', 'Exklusiv-Schicht pro Tag: Der Tageskopf wird orange mit „⭐ Exklusiv“. Manager schalten es per Klick auf den Tageskopf ein oder aus; das Team sieht es in veröffentlichten Wochen.'],
      ['new', 'Der Excel-Import erkennt orangen Hintergrund im Datum (oder Tagesnamen) als Exklusiv-Tag und zeigt ihn in der Bestätigung an.'],
      ['improved', 'Import wählt das Blatt zuerst nach der Datumszeile im Blatt, dann nach „KW 46“ im Blatt, dann nach dem Blattnamen. Bei Unklarheit erscheint eine nummerierte Liste.'],
      ['info', 'Einrichtung: sql/1.0.03_exclusive_days.sql im Supabase SQL Editor ausführen.']
    ] },
  { version: '1.0.03', range: '', date: 'November 2026', title: 'Dienstplan-Import: Blatt-Auswahl',
    changes: [
      ['improved', 'Import: Bei Excel-Dateien mit vielen Blättern wird das Blatt mit der passenden KW automatisch gewählt. Gibt es keins oder mehrere, erscheint eine nummerierte Liste zur Auswahl. Das gewählte Blatt steht in der Bestätigung.']
    ] },
  { version: '1.0.02', range: '', date: 'November 2026', title: 'Dienstplan: 24-Stunden-Zeit und Excel-Import',
    changes: [
      ['fixed', 'Uhrzeiten im Dienstplan werden im 24-Stunden-Format eingegeben (z. B. 14:30), nicht mehr mit AM/PM. Eingabe auch nur mit Ziffern: 1430 wird 14:30.'],
      ['new', '„📥 Plan importieren“: fertigen Dienstplan als Excel (wie „Dienstplan KW 46.xlsx“) in die angezeigte Woche laden. Erkannt werden Zeiten wie 14:30 - 23:00/GM, geteilte Dienste (10:00-14:00/17:00-22:00) und OFF, K, ZA, U. Die Woche bleibt ein Entwurf, bis du sie veröffentlichst.']
    ] },
  { version: '1.0.01', range: '', date: 'November 2026', title: 'Salonplafond Küche: Rezepte, Dienstplan nach KW, Rollen',
    changes: [
      ['new', 'Neue Rollen: Koch, Abwasher, Manager, Developer. Zusatzrollen sind möglich (z. B. Developer, der auch Abwasher ist).'],
      ['new', 'Neue Datenbank: sql/1.0.00_init.sql legt Personal, PIN-Login und Login-Historie an. Start-PIN für alle: 1234.'],
      ['improved', 'Fundsachen (Lost & Found) wurde komplett entfernt: Kachel, Fenster, Hilfe-Kapitel und Login-Protokoll-Einträge.'],
      ['improved', 'Karten-Druck (A3) für Getränke wurde entfernt (Menüpunkt, Kachel und Fenster).'],
      ['new', 'Rezepte statt Getränke: Kategorien (Vorspeisen, Suppen, Hauptgerichte ...), Portionen, Zubereitungszeit, Garmethode, Zutaten mit Menge, Zubereitung, Anrichten, Allergene, bis zu 3 Fotos.'],
      ['new', 'Am Ende jedes Rezepts steht, wer es angelegt und wer es zuletzt geändert hat (wird von der Datenbank eingetragen).'],
      ['new', 'Rezepte bearbeiten dürfen Manager, Developer und Köche mit der Berechtigung „Darf Rezepte bearbeiten“. Abwasher dürfen Rezepte nur ansehen.'],
      ['info', 'Einrichtung: sql/1.0.01_recipes.sql im Supabase SQL Editor ausführen (Tabelle recipes, Foto-Speicher „photos“).'],
      ['new', 'Dienstplan nach Kalenderwochen: oben Datumsbereich und KW (z. B. KW 45 · 02.11.26 – 08.11.26), Spalten Name, Mo–So, Gesamt, Unterschrift, gruppiert nach Teams.'],
      ['new', 'Manager planen auch kommende Wochen (Entwurf) und veröffentlichen sie. Wechsel mit ‹ ›, Wochenwahl, „Heute“ und Chips der geplanten Wochen. „Vorwoche kopieren“ spart Zeit.'],
      ['new', 'Das Team sieht den Dienstplan nur lesend und nur veröffentlichte Wochen. Codes: OFF, U, K, ZA, dazu Station (z. B. GM, Entre).'],
      ['info', 'Einrichtung: sql/1.0.02_workplan.sql im Supabase SQL Editor ausführen (Tabellen work_schedules und plan_weeks).'],
      ['info', 'Weitere Küchen-Funktionen (Rezepte, Dienstplan, Kühlschrank-Temperaturen, Abwasher) folgen in den nächsten Versionen.']
    ] },
    ];

    const CHANGELOG_TYPES = {
      new:      { icon: '✨', label: 'Neu' },
      improved: { icon: '🔧', label: 'Verbessert' },
      fixed:    { icon: '🐞', label: 'Behoben' },
      security: { icon: '🔒', label: 'Sicherheit' },
      info:     { icon: '📌', label: 'Allgemein' }
    };
    const CHANGELOG_TYPE_ORDER = ['new', 'improved', 'fixed', 'security', 'info'];

    let changelogTab = 'current';
    let changelogFilter = 'all';
    let changelogQuery = '';
    let changelogNews = [];

    function versionLabel(e) {
      return e.range ? e.range : 'v' + e.version;
    }

    function applyVersionLabels() {
      document.title = 'Salonplafond NeXuS · KÜCHE v' + APP_VERSION;
      document.querySelectorAll('[data-app-version]').forEach(el => { el.textContent = 'v' + APP_VERSION; });
      document.querySelectorAll('[data-app-number]').forEach(el => { el.textContent = APP_VERSION; });
      document.querySelectorAll('[data-brand-header]').forEach(el => { el.textContent = 'KÜCHE v' + APP_VERSION; });
      const badge = document.getElementById('changelogVersionBadge');
      if (badge) badge.textContent = 'v' + APP_VERSION;
      if (CHANGELOG[0] && CHANGELOG[0].version !== APP_VERSION) {
        console.warn('Changelog: Der oberste Eintrag (' + CHANGELOG[0].version + ') passt nicht zu APP_VERSION (' + APP_VERSION + ').');
      }
    }

    function openChangelogModal() {
      closeSettingsMenu();
      changelogFilter = 'all';
      changelogQuery = '';
      const search = document.getElementById('clSearch');
      if (search) search.value = '';
      applyVersionLabels();
      renderChangelogCurrent();
      renderChangelogAll();
      setChangelogTab('current');
      loadChangelogNews();
      const modal = document.getElementById('changelogModal');
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }

    function closeChangelogModal() {
      const modal = document.getElementById('changelogModal');
      modal.classList.remove('flex');
      modal.classList.add('hidden');
    }

    function setChangelogTab(tab) {
      changelogTab = tab;
      ['current', 'all', 'news'].forEach(t => {
        const panel = document.getElementById('clPanel_' + t);
        const btn = document.getElementById('clTab_' + t);
        if (panel) panel.classList.toggle('hidden', t !== tab);
        if (btn) {
          btn.classList.toggle('active', t === tab);
          btn.setAttribute('aria-selected', t === tab ? 'true' : 'false');
        }
      });
      const body = document.getElementById('clBody');
      if (body) body.scrollTop = 0;
    }

    function changelogGroupsHtml(changes, onlyType) {
      let html = '';
      CHANGELOG_TYPE_ORDER.forEach(type => {
        if (onlyType && onlyType !== 'all' && onlyType !== type) return;
        const items = (changes || []).filter(c => c[0] === type);
        if (!items.length) return;
        const meta = CHANGELOG_TYPES[type];
        html += `
          <div class="cl-group">
            <div class="cl-group-head cl-t-${type}"><span>${meta.icon}</span> ${escapeHtml(meta.label)}</div>
            <ul class="cl-list">
              ${items.map(c => `<li>${escapeHtml(c[1])}</li>`).join('')}
            </ul>
          </div>`;
      });
      return html;
    }

    function renderChangelogCurrent() {
      const box = document.getElementById('clCurrentContent');
      if (!box || !CHANGELOG.length) return;
      const cur = CHANGELOG[0];
      const prev = CHANGELOG[1];
      box.innerHTML = `
        <div class="cl-hero">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="cl-ver">${escapeHtml(versionLabel(cur))}</span>
            <span class="cl-date">${escapeHtml(cur.date || '')}</span>
          </div>
          <h4 class="cl-title">${escapeHtml(cur.title || 'Neu in dieser Version')}</h4>
        </div>
        ${changelogGroupsHtml(cur.changes, 'all')}
        ${prev ? `<button type="button" onclick="setChangelogTab('all')" class="cl-link">📜 Frühere Versionen ansehen (zuletzt ${escapeHtml(versionLabel(prev))})</button>` : ''}
      `;
    }

    function changelogMatches(entry, change, q) {
      if (!q) return true;
      const hay = (versionLabel(entry) + ' ' + (entry.title || '') + ' ' + (entry.date || '') + ' ' + change[1]).toLowerCase();
      return hay.indexOf(q) !== -1;
    }

    function renderChangelogAll() {
      const list = document.getElementById('clAllList');
      const info = document.getElementById('clResultInfo');
      const countEl = document.getElementById('clAllCount');
      if (!list) return;
      const q = (changelogQuery || '').trim().toLowerCase();
      const f = changelogFilter;
      const filtering = !!q || f !== 'all';

      let shown = 0;
      let html = '';
      CHANGELOG.forEach((e, idx) => {
        const metaHit = q && (versionLabel(e) + ' ' + (e.title || '') + ' ' + (e.date || '')).toLowerCase().indexOf(q) !== -1;
        const changes = (e.changes || []).filter(c => (f === 'all' || c[0] === f) && (metaHit || changelogMatches(e, c, q)));
        if (!changes.length) return;
        shown++;
        const open = filtering || idx === 0;
        html += `
          <details class="cl-item" ${open ? 'open' : ''}>
            <summary>
              <span class="cl-ver">${escapeHtml(versionLabel(e))}</span>
              <span class="cl-sum-title">${escapeHtml(e.title || '')}</span>
              <span class="cl-date">${escapeHtml(e.date || '')}</span>
              <span class="cl-count">${changes.length}</span>
              <span class="cl-arrow">▸</span>
            </summary>
            <div class="cl-item-body">${changelogGroupsHtml(changes, 'all')}</div>
          </details>`;
      });

      list.innerHTML = html || `<p class="cl-empty">Keine Einträge gefunden. Versuche einen anderen Suchbegriff oder Filter.</p>`;
      if (info) info.textContent = filtering ? `${shown} von ${CHANGELOG.length} Versionen` : `${CHANGELOG.length} Versionen`;
      if (countEl) countEl.textContent = String(CHANGELOG.length);

      CHANGELOG_TYPE_ORDER.concat(['all']).forEach(t => {
        const chip = document.getElementById('clChip_' + t);
        if (chip) chip.classList.toggle('active', t === f);
      });
    }

    function setChangelogFilter(type) {
      changelogFilter = type;
      renderChangelogAll();
    }

    function onChangelogSearch(value) {
      changelogQuery = value || '';
      renderChangelogAll();
    }

    function toggleAllChangelogItems(open) {
      document.querySelectorAll('#clAllList details.cl-item').forEach(d => { d.open = !!open; });
    }

    async function loadChangelogNews() {
      const list = document.getElementById('clNewsList');
      const countEl = document.getElementById('clNewsCount');
      if (list) list.innerHTML = `<p class="cl-empty">Lade Team-News...</p>`;
      const { data, error } = await _supabase.from('support_tickets').select('*').eq('is_changelog', true).order('created_at', { ascending: false }).limit(50);
      if (error) {
        if (list) list.innerHTML = `<p class="cl-empty">Fehler beim Laden: ${escapeHtml(error.message)}</p>`;
        return;
      }
      changelogNews = data || [];
      if (countEl) countEl.textContent = String(changelogNews.length);
      renderChangelogNews();
    }

    function renderChangelogNews() {
      const list = document.getElementById('clNewsList');
      if (!list) return;
      if (!changelogNews.length) {
        list.innerHTML = `<p class="cl-empty">Noch keine Team-News veröffentlicht.</p>`;
        return;
      }
      list.innerHTML = changelogNews.map(item => {
        const dateStr = new Date(item.created_at).toLocaleDateString('de-AT');
        return `
          <div class="cl-news">
            <div class="cl-news-head">
              <span>${escapeHtml(item.author_email || 'Team')}</span>
              <span class="cl-date">${escapeHtml(dateStr)}</span>
            </div>
            <p class="cl-news-text">${escapeHtml(item.message)}</p>
          </div>`;
      }).join('');
    }

    async function submitNewChangelog() {
      checkManagerAuth(async () => {
        const textInput = document.getElementById('newChangelogText');
        const text = textInput.value.trim();
        if (!text) return alert("Bitte Neuigkeit eingeben.");

        const { error } = await _supabase.from('support_tickets').insert([{
          author_email: `${currentWaiterName} (${currentStaffRole || 'staff'})`,
          message: text,
          status: 'resolved',
          is_changelog: true,
          admin_comment: 'Veröffentlicht von ' + currentWaiterName
        }]);

        if (error) {
          alert("Fehler: " + error.message);
        } else {
          textInput.value = '';
          showAppToast({ initial: '📣', title: 'Neuigkeit veröffentlicht', text: 'Die Team-News ist jetzt für alle sichtbar.' });
          loadChangelogNews();
        }
      });
    }

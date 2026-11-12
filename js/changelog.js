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
  { version: '1.0.00', range: '', date: 'November 2026', title: 'Salonplafond Küche: neue Grundlage (Personal, Rollen, PIN-Login)',
    changes: [
      ['new', 'Neue Rollen: Koch, Abwasher, Manager, Developer. Zusatzrollen sind möglich (z. B. Developer, der auch Abwasher ist).'],
      ['new', 'Neue Datenbank: sql/1.0.00_init.sql legt Personal, PIN-Login und Login-Historie an. Start-PIN für alle: 1234.'],
      ['improved', 'Fundsachen (Lost & Found) wurde komplett entfernt: Kachel, Fenster, Hilfe-Kapitel und Login-Protokoll-Einträge.'],
      ['improved', 'Karten-Druck (A3) für Getränke wurde entfernt (Menüpunkt, Kachel und Fenster).'],
      ['new', 'Rezepte statt Getränke: Kategorien (Vorspeisen, Suppen, Hauptgerichte ...), Portionen, Zubereitungszeit, Garmethode, Zutaten mit Menge, Zubereitung, Anrichten, Allergene, bis zu 3 Fotos.'],
      ['new', 'Am Ende jedes Rezepts steht, wer es angelegt und wer es zuletzt geändert hat (wird von der Datenbank eingetragen).'],
      ['new', 'Rezepte bearbeiten dürfen Manager, Developer und Köche mit der Berechtigung „Darf Rezepte bearbeiten“. Abwasher sehen keine Rezepte.'],
      ['info', 'Einrichtung: sql/1.0.01_recipes.sql im Supabase SQL Editor ausführen (Tabelle recipes, Foto-Speicher „photos“).'],
      ['info', 'Weitere Küchen-Funktionen (Rezepte, Dienstplan, Kühlschrank-Temperaturen, Abwasher) folgen in den nächsten Versionen.']
    ] },
  { version: '4.2.02', range: '', date: 'November 2026', title: 'Neue Kachel „Reservierungen“ (Gastronaut)',
    changes: [
      ['new', 'Neue Kachel „📒 Reservierungen“: zeigt Frühschicht, Abendschicht und den ganzen Tag (Reservierungen und Gäste) aus Gastronaut, inklusive Liste mit Uhrzeit, Name und Tisch.'],
      ['info', 'Die Daten werden alle 30 Minuten aktualisiert und sind nicht garantiert aktuell. Das steht auch im Fenster.'],
      ['info', 'Einrichtung: sql/4.2.02_gastronaut.sql im Supabase SQL Editor ausführen (Leserecht auf gastronaut_sync).']
    ] },
  { version: '4.2.01', range: '', date: 'November 2026', title: 'Neuer Stil „NeXuS Glass“ (Glas-Look mit Bar-Hintergrund)',
    changes: [
      ['new', 'Einstellungen → Darstellung → Stil: „✨ NeXuS Glass“ schaltet einen Glas-Look in Schwarz und Gold mit Bar-Hintergrund ein (Anmeldung, Karten, Fenster, Eingabefelder). „Original“ bleibt der Standard.'],
      ['improved', 'Der Stil gehört zur Person: Wechseln mehrere Personen am selben Gerät, bekommt jede ihren eigenen Stil.'],
      ['fixed', 'Handy: Das Menü öffnet sich im Stil NeXuS Glass wieder korrekt. Hintergrund abgedunkelt, Kacheln und Knöpfe besser lesbar.'],
      ['info', 'Einrichtung: sql/4.2.01_skin.sql im Supabase SQL Editor ausführen (Stil pro Person, auf allen Geräten).'],
      ['info', 'NeXuS Glass ist immer dunkel und wird nur geladen, wenn er gewählt ist. Bei Ruckeln auf älteren Geräten „Weichzeichner“ ausschalten. Gespeichert pro Gerät, gedruckt wird immer im Original-Aussehen.']
    ] },
  { version: '4.2.00', range: '', date: 'November 2026', title: 'Exklusiv-Schicht: Tischtabelle mit Soll / Ist / Gerichten, Drucken und Excel',
    changes: [
      ['new', 'Neue Kachel „🍽️ Exklusiv-Schicht“ (nur Manager/Developer): Tabelle mit Soll, Ist, Tisch-Nr. und frei benennbaren Gerichten. Soll und Ist beginnen leer, Summen für Gäste und jedes Gericht stehen automatisch unten.'],
      ['new', 'Gerichtsnamen direkt in der Kopfzeile ändern. Über „Gerichte“ Spalten hinzufügen, löschen, ordnen und als „Anzahl“ oder „Notiz“ (z. B. Medium Well) festlegen.'],
      ['new', '„Tisch hinzufügen“ legt eine neue Zeile mit der nächsten Nummer an. Neue Schicht mit Standardtischen (101–110, 301–311, 401–411, 666), Auswahl einzelner Tische oder Übernahme der letzten Schicht.'],
      ['new', '🖨️ Drucken (A4/A3 quer) und 📊 Excel-Export im Aussehen der Vorlage, Summen unten.'],
      ['info', 'Einrichtung: sql/4.2.00_exclusive.sql im Supabase SQL Editor ausführen. Die Daten liegen in einfachen Tabellen (exclusive_shifts, exclusive_tables), damit später eine andere App angebunden werden kann.']
    ] },
  { version: '4.1.07', range: '', date: 'November 2026', title: 'Mitteilungen (🔔), Fenster per Klick daneben schließen, TomiAI: vollständige Tagesliste',
    changes: [
      ['new', '🔔 Mitteilungen: Unter Begrüßung und Datum im Dashboard blinkt „🔔 3 neu“, wenn etwas für dich da ist (genehmigter Urlaub, Schichttausch, neuer Arbeitsplan, ...). Tippen öffnet die Liste und springt ins passende Fenster. Das funktioniert auch, wenn Push auf dem Gerät nicht ankommt.'],
      ['new', '🚀 Neue App-Version: Es erscheint „Neu in v…“. Tippen zeigt, was neu ist, danach verschwindet der Hinweis.'],
      ['new', 'Fenster lassen sich per Klick auf den abgedunkelten Hintergrund schließen. Hast du etwas eingetippt, bleibt das Fenster zur Sicherheit offen. Ein/Aus unter Einstellungen → Darstellung → Fenster.'],
      ['fixed', 'TomiAI: „Wer arbeitet morgen?“ zeigt jetzt alle Personen mit Anzahl. Der Server stellt die Tagesliste vollständig zusammen, und große Arbeitspläne werden komplett geladen.'],
      ['improved', 'TomiAI-Fehlermeldungen nennen keinen Anbieter mehr. Manager und Developer sehen zusätzlich einen kurzen technischen Hinweis (z. B. „429×2“).'],
      ['info', 'Einrichtung: sql/4.1.07_inbox.sql im Supabase SQL Editor ausführen und die Edge Function tomi-ai neu bereitstellen.']
    ] },
  { version: '4.1.06', range: '', date: 'November 2026', title: 'Tagesangebot: Tageskuchen & Tagessuppe mit Allergenen, Zettel per Foto einlesen',
    changes: [
      ['new', 'Neue Kachel „🍰 Tagesangebot“ im Dashboard: Alle sehen den Tageskuchen und die Tagessuppe von heute mit Preis und Allergenen (A–R, auch im Klartext). Reiter „Kommend“ zeigt die nächsten Tage.'],
      ['new', 'Manager und Developer tragen Einträge mit Gültigkeit von–bis ein (Schnellwahl „Nur heute“, „Bis Sonntag“, „7 Tage“) und sehen den Verlauf.'],
      ['new', '📷 Foto scannen: Den Zettel fotografieren, die KI liest Namen, Preise und Allergen-Buchstaben. Du prüfst alles neben dem Foto, korrigierst bei Bedarf und speicherst erst nach Bestätigung. Das Foto wird nicht gespeichert.'],
      ['new', 'TomiAI kennt das Tagesangebot: „Was ist heute die Suppe und welche Allergene hat sie?“'],
      ['info', 'Einrichtung: sql/4.1.06_daily_specials.sql im Supabase SQL Editor ausführen, Edge Function scan-special bereitstellen (supabase functions deploy scan-special) und tomi-ai neu bereitstellen.']
    ] },
  { version: '4.1.05', range: '', date: 'November 2026', title: 'Urlaub & Krankmeldung, TomiAI schneller, verschiebbarer TomiAI-Knopf',
    changes: [
      ['new', 'Neue Kachel „Urlaub / Krank“ im Dashboard: Du kannst Urlaub beantragen und dich krank melden. Manager sehen alle Anträge, genehmigen oder lehnen ab und können Urlaub (U) bzw. Krank (K) mit einem Klick in den Arbeitsplan eintragen. Push-Benachrichtigungen für Anträge und Entscheidungen.'],
      ['new', 'Einstellungen → Darstellung: Der TomiAI-Knopf lässt sich ausblenden und – wenn eingeschaltet – mit Finger oder Maus an eine beliebige Stelle ziehen. „Position zurücksetzen“ bringt ihn zurück. TomiAI bleibt über das Dashboard erreichbar.'],
      ['improved', 'TomiAI antwortet deutlich schneller: Statt der ganzen Datenbank bekommt die KI nur noch das, was zur Frage passt (passende Getränke, relevante Tage im Arbeitsplan). Zufalls-Fragen („nenne mir 5 zufällige Drinks“) werden jetzt echt zufällig ausgewählt. Kürzere Wartezeit bei Überlastung.'],
      ['improved', 'Einstellungs-Reiter: Wenn nicht alle Reiter Platz haben, erscheinen Pfeile links/rechts (auch am PC bedienbar, zusätzlich Mausrad und Ziehen).'],
      ['improved', 'Die Versionsnummer steht nur noch an einer einzigen Stelle (js/version.js) – für Entwickler.'],
      ['info', 'Einrichtung: sql/4.1.05_absences.sql im Supabase SQL Editor ausführen. Danach die Edge Function tomi-ai neu bereitstellen (supabase functions deploy tomi-ai).']
    ] },
  { version: '4.1.04', range: '', date: 'November 2026', title: 'Login-Protokoll: sichere Datenbank-Namen',
    changes: [
      ['fixed', 'Die Datenbank-Einrichtung für das Login-Protokoll brach mit „column started_at does not exist“ ab, weil der Name einer neuen Tabelle schon von der App benutzt wird. Alle neuen Objekte heißen jetzt eindeutig (nx_...), bestehende Daten bleiben unberührt.']
    ] },
  { version: '4.1.03', range: '', date: 'November 2026', title: 'Login-Protokoll, Online-Status, Begrüßung & Einstellungs-Reiter',
    changes: [
      ['new', 'Login-Protokoll (Manager/Developer): Live-Ansicht (wer ist gerade wo), Sitzungen mit Gerät, Anmeldung, Abmeldung und Dauer, Aktivität (geöffnete Bereiche und wichtige Aktionen), Statistik pro Person und Excel-Export. Keine IP-Adressen, automatische Löschung nach 90 Tagen, jederzeit manuell leerbar.'],
      ['improved', 'Online-Status genauer: Wer in den letzten 3 Minuten aktiv war, ist online (vorher 15 Minuten). Das gilt im Chat, in der Personalliste und im Protokoll. Dafür sendet die App einmal pro Minute ein kleines Lebenszeichen, solange sie geöffnet ist.'],
      ['new', 'Begrüßungsanimation nach dem Anmelden mit dem App-Logo und „powered by TomiAI“. Tippen überspringt sie. Ausschalten: Einstellungen → Allgemein → Begrüßungsanimation (gilt für dein Konto).'],
      ['improved', 'Einstellungen übersichtlich in Reitern: Allgemein, Darstellung, Getränke, Hinweise, Konto, App. Die App merkt sich den zuletzt geöffneten Reiter.'],
      ['fixed', 'Die Push-Einstellungen waren für Kellner im Einstellungsfenster nicht sichtbar. Jetzt sind sie für alle im Reiter „Hinweise“.'],
      ['info', 'Einrichtung: sql/4.1.04_presence_log.sql im Supabase SQL Editor ausführen.']
    ] },
  { version: '4.1.02', range: '', date: 'November 2026', title: 'TomiAI findet das richtige Modell, Push-Schlüssel bleibt erhalten',
    changes: [
      ['fixed', 'TomiAI: Wenn ein bestimmtes Gemini-Modell nicht verfügbar ist, nutzt TomiAI jetzt automatisch das aktuelle Modell und fragt bei Bedarf Google, welche Modelle der Schlüssel kann.'],
      ['fixed', 'Push-Benachrichtigungen: Der öffentliche Schlüssel liegt jetzt in der Datenbank. Nach einem App-Update bleiben „Aktivieren“ und „Test senden“ dadurch immer verfügbar.']
    ] },
  { version: '4.1.01', range: '', date: 'November 2026', title: 'TomiAI: stabiler bei Überlastung',
    changes: [
      ['fixed', 'TomiAI antwortete manchmal nicht, wenn der KI-Dienst von Google kurz überlastet war. Jetzt versucht TomiAI es automatisch erneut und weicht bei Bedarf auf ein anderes Modell aus. Bleibt der Dienst überlastet, erscheint eine verständliche Meldung.'],
      ['improved', 'Fehlgeschlagene TomiAI-Anfragen zählen nicht mehr zum Tageslimit.']
    ] },
  { version: '4.1.00', range: '', date: 'November 2026', title: 'Benachrichtigungen & TomiAI',
    changes: [
      ['new', 'Push-Benachrichtigungen: Du bekommst eine Meldung auf dein Handy, auch wenn die App geschlossen ist: neue Chat-Nachrichten, @Erwähnungen, Änderungen am Arbeitsplan, Schichttausch-Anfragen und Entscheidungen, Team-News. Manager erfahren zusätzlich von Tauschanfragen zur Genehmigung, dringenden Störungen und neuen Tickets. Aktivieren: Dashboard-Karte oder Einstellungen → Push-Benachrichtigungen. Auf dem iPhone muss die App dafür auf dem Home-Bildschirm liegen.'],
      ['new', 'TomiAI: Der neue Assistent (Knopf „✨ TomiAI“ unten links). Er beantwortet Fragen zu Rezepten, Allergenen, Speisekarte, Checklisten und zur App, auf Deutsch, Englisch oder Slowakisch. Manager/Developer bekommen zusätzlich Hilfe bei Plan, Stunden, Tausch und Tickets: Änderungen schlägt TomiAI nur vor, du bestätigst sie mit einem Knopf.'],
      ['improved', 'Einzelne Meldungsarten lassen sich in den Einstellungen ein- und ausschalten. Beim Abmelden wird das Gerät von deinem Konto getrennt.'],
      ['info', 'Einrichtung durch Manager/Developer nötig: siehe docs/SETUP-4.1.00.md (SQL, Schlüssel, zwei Edge Functions). Der TomiAI-Gesprächsverlauf wird nicht gespeichert.']
    ] },
  { version: '4.0.02', range: '', date: 'November 2026', title: 'Englisch für das ganze Team & Startseite nach dem Login',
    changes: [
      ['new', 'Englisch erweitert: Die Getränke-Datenbank (Suche, Kategorien, Karten, Rezept, Drucken), Multi-View, Einkaufsliste und dein Profil lassen sich jetzt ebenfalls auf Englisch umstellen (Einstellungen → Sprache).'],
      ['improved', 'Beim Wechsel der Sprache werden Getränke-Liste, Kategorien und Multi-View-Leiste sofort neu gezeichnet. Die „Über mich“-Vorschläge im Profil werden in der gewählten Sprache gespeichert.'],
      ['improved', 'Zeitangaben wie „vor 5 Min.“ erscheinen in der gewählten Sprache.'],
      ['new', 'Einstellung „Nach dem Login öffnen“: Du wählst, ob nach der Anmeldung das Dashboard (Standard) oder direkt die Getränke geöffnet werden. Die Einstellung gehört zu deinem Konto und gilt auf jedem Gerät.'],
      ['new', 'Englisch vervollständigt: Team-Chat, Mein Arbeitsplan, Schichttausch, Checkliste, Speisekarte & Allergene, Störungen, Fundsachen und Verluste & Bruch lassen sich komplett auf Englisch nutzen. Manager-Ansichten, A3-Karte und „Was ist neu?“ bleiben Deutsch.']
    ] },
  { version: '4.0.01', range: '', date: 'November 2026', title: 'Hilfe & Anleitung, Englisch für das Team',
    changes: [
      ['new', 'Hilfe & Anleitung: Eine ausführliche Anleitung für alle Funktionen, Schritt für Schritt erklärt, mit Suche und häufigen Fragen. Du findest sie auf dem Dashboard und im Menü. Kapitel für Manager sind mit „Manager“ markiert.'],
      ['new', 'Englisch: Die App lässt sich auf Englisch umstellen. Auf der Anmeldeseite oben rechts „DE | EN“, in der App unter Einstellungen → Sprache. Die Sprache merkt sich das Gerät.'],
      ['info', 'Zuerst übersetzt: Anmeldung, Dashboard, Menü, Einstellungen, Kopf der Getränke-Seite und die Hilfe. Weitere Bereiche für das Team folgen in den nächsten Versionen. Manager-Fenster, A3-Karte und „Was ist neu?“ bleiben Deutsch.'],
      ['improved', '„Mein Arbeitsplan“ im Menü und in der Getränke-Datenbank öffnet jetzt den neuen Monatskalender mit Pausen und Schichttausch.']
    ] },
  { version: '4.0.00', range: '', date: 'November 2026', title: 'Fehlerbehebungen & Verlauf aufräumen',
    changes: [
      ['fixed', 'In Eingabefeldern und Fenstern (Mengen, Minuten, Preise, PIN, Suche ...) ließen sich keine Zahlen eintippen und mit Backspace nichts löschen. Das funktioniert wieder überall.'],
      ['new', 'Schichttausch → Verlauf: Manager und Developer können einzelne Einträge oder den gesamten Verlauf löschen.'],
    ] },
  { version: '3.2.03', range: '', date: 'November 2026', title: 'Checklisten, Schichttausch, Stunden, Speisekarte & mehr',
    changes: [
      ['new', 'Checklisten & Standards: Aufgaben für Öffnung, Laufend und Schließung, getrennt nach Bar, Service und Terrasse. Eine gemeinsame Liste pro Tag: Wer abhakt, steht mit Name und Uhrzeit dabei. Manager/Developer legen die Aufgaben selbst an und ändern sie. Für das Team heißt die Kachel „Meine Schicht“.'],
      ['new', 'Schichttausch: Anfrage direkt an einen Kollegen oder in die Börse für alle. Wer die Schicht übernimmt, bestätigt; am Ende entscheidet immer der Manager. Erst dann wird der Arbeitsplan geändert.'],
      ['new', 'Mein Arbeitsplan: Monatskalender mit deinen Schichten, Pausen (Minuten) und Tausch-Anfrage pro Tag.'],
      ['new', 'Stunden & Lohn (Manager/Developer): Monatsstunden pro Person (geplant − Pause + Korrektur), Korrekturen pro Tag und Excel-Export für die Lohnverrechnung. Ohne Zuschläge.'],
      ['new', 'Speisekarte & Allergene: Speisekarte pro Saison mit Allergenen A–R (Österreich), Suche, Ausblenden nach Allergen und Einfügen aus Excel. Die Getränke sind ebenfalls nach Allergenen durchsuchbar.'],
      ['new', 'Störungen melden (mit Foto und Dringlichkeit), Fundsachen und Verluste & Bruch: drei getrennte Funktionen für das ganze Team. Störungen und Verluste sehen Manager/Developer, Fundsachen alle.'],
      ['improved', 'Das Dashboard hat neue Kacheln und Zähler (Tausch-Anfragen, neue Störungen).'],
      ['info', 'Wichtig für den Betrieb: Den Arbeitsplan können nur noch Manager und Developer ändern (auch der Excel-Import).']
    ] },
  { version: '3.2.02', range: '', date: 'November 2026', title: 'Einfachere, kompakte Anmeldung',
    changes: [
      ['improved', 'Anmeldung komplett vereinfacht: alles passt auf einen Bildschirm, ein kleiner Kopf statt großem Logo, alle Namen in einer kompakten Liste (A–Z) mit Suche und den letzten 3 Anmeldungen als schnelle Knöpfe.'],
      ['improved', 'PIN-Eingabe übersichtlicher: gewählter Name mit Foto und „Ändern“, PIN als Punkte, kleinere Zahlentasten. Am Computer geht die Eingabe auch mit der Tastatur (Enter = Anmelden, Esc = Name ändern).'],
      ['improved', 'Leitung (Manager/Developer) steht nicht mehr in einem eigenen Bereich, sondern ist in der Liste klein beschriftet.'],
      ['info', 'Die „klassische Ansicht“ der Anmeldung entfällt, weil die neue Liste sie ersetzt.']
    ] },
  { version: '3.2.01', range: '', date: 'November 2026', title: 'Dashboard als Startseite & Team-Arbeitsplan',
    changes: [
      ['new', 'Dashboard als Startseite: Nach dem Login siehst du zuerst übersichtliche Kacheln statt direkt der Getränkeliste. Manager und Developer bekommen vier Bereiche (Bar & Betrieb, Team & Personal, Sicherheit & System, Support & Infos), Kellner ihre vier wichtigsten Kacheln: Getränke & Rezepte, Mein Arbeitsplan, Team-Chat und Was ist neu?.'],
      ['new', 'Team & Arbeitsplan (Manager/Developer): Monatsraster für das ganze Team mit Schichten pro Tag, Stunden pro Mitarbeiter, Besetzung pro Tag, Monatswechsel und Excel-Export. Schichten lassen sich per Tipp auf ein Feld ändern (auch Frei, Urlaub, Krank).'],
      ['new', 'Zähler auf den Kacheln: ungelesene Chat-Nachrichten und offene Support-Tickets.'],
      ['improved', 'In der Getränke-Datenbank gibt es oben „← Dashboard“; auch der Zurück-Knopf am Handy führt zurück zum Dashboard. Im Menü stehen „Dashboard“ und „Getränke & Rezepte“ ganz oben.'],
      ['improved', 'Die Team-Ansicht im alten Arbeitsplan-Fenster sehen jetzt nur noch Manager und Developer; Kellner sehen weiterhin ihren eigenen Plan.']
    ] },
  { version: '3.1.04', range: '', date: 'Oktober 2026', title: 'Schnellere Anmeldung, mehrere Fotos & klarere Handy-Ansicht',
    changes: [
      ['new', 'Bis zu 3 Fotos pro Getränk: Hauptfoto festlegen, Fotos entfernen, direkt vom Handy aufnehmen oder hochladen. Im Detail gibt es eine kleine Galerie. Fotos werden vor dem Hochladen automatisch verkleinert.'],
      ['improved', 'Anmeldung neu: „Zuletzt auf diesem Gerät“ ganz oben, Namenssuche, Team und Leitung (Manager/Developer) getrennt und alles kompakt statt langem Scrollen. Mit dem Link unter der Liste kannst du jederzeit zur klassischen Ansicht wechseln.'],
      ['improved', 'Handy-Kopf wie in der Küche-App: voller Name „Salonplafond BAR“, Chat und Einstellungen als Symbole sowie eine Zeile mit deinem Foto, Namen und „Wechseln“.'],
      ['improved', 'Der Arbeitsplan ist am Handy nicht mehr auf der Startseite, sondern in Mein Profil (und weiter im Menü). Am Computer bleibt er auf der Startseite.'],
      ['fixed', 'Saison und Filter werden am Handy nicht mehr abgeschnitten.']
    ] },
  { version: '3.1.03', range: '', date: 'Oktober 2026', title: 'Handy-Ansicht & App installieren',
    changes: [
      ['new', 'App installierbar: Symbol auf dem Startbildschirm (Android, iPhone, Computer). Sie startet ohne Browser-Leiste, öffnet schneller und auch bei schwachem Netz. Installieren-Knopf und Anleitung findest du unter Menü → App installieren bzw. in den Einstellungen.'],
      ['improved', 'Handy-Ansicht deutlich einfacher: schlanke Kopfleiste (Chat und Menü), Kategorien und Schnellzugriff (Saison, Arbeitsplan, Filter) als wischbare Reihen und ein runder ➕-Knopf unten rechts für neue Getränke.'],
      ['improved', 'Benutzer wechseln und Vollbild liegen am Handy im Menü; am Computer bleibt alles wie gewohnt in der Kopfleiste.'],
      ['improved', '„App neu laden“ leert jetzt auch den Zwischenspeicher der App.'],
      ['fixed', 'Die Kategorien-Leiste blieb nach dem Start leer, bis man eine Saison oder Kategorie wählte.']
    ] },
  { version: '3.1.02', range: '', date: 'Oktober 2026', title: 'Team-Chat, neues Menü, Einstellungen & augenschonender Hellmodus',
    changes: [
      ['new', 'Team-Chat als echte Kommunikations-App: Reaktionen mit Emoji, Nachrichten bearbeiten, Fotos senden, wichtige Nachricht anpinnen, Suche, „schreibt ...“-Anzeige, Trennung nach Tagen und Markierung neuer Nachrichten.'],
      ['new', 'Neue Kategorie direkt beim Anlegen eines Getränks erstellen. Sie erscheint nach dem Speichern automatisch in der Kategorien-Leiste.'],
      ['new', 'Einstellungen & Zentrale mit vielen neuen Optionen: Design Hell/Dunkel/Automatisch, Schriftgröße, Sortierung, Preise ein/aus, weniger Animationen sowie einzeln schaltbare Hinweise und Chat-Ton.'],
      ['improved', 'Menü übersichtlich in Bereiche gegliedert (Getränke & Karte, Team & Arbeit, Verwaltung, App) – jeder Punkt mit kurzer Erklärung und dein Profil gleich oben.'],
      ['improved', 'Mein Profil neu gestaltet: Profilkarte, Status-Vorschläge, PIN mit Wiederholung und Übersicht deiner Rechte.'],
      ['improved', 'Getränke-Formular neu aufgebaut: Bestseller, Vegan, Glutenfrei und Laktosefrei sind jetzt einstellbar, dazu Live-Marge und Foto-Vorschau.'],
      ['improved', 'Hellmodus augenschonender: warmer Hintergrund, kräftigere Textfarben und keine dunklen Menüs mehr.'],
      ['fixed', 'Der Hell/Dunkel-Schalter folgt jetzt der App-Einstellung statt dem Gerät. Dadurch waren Menüs im hellen Modus teils dunkel und Texte schwer lesbar.'],
      ['fixed', 'Changelog: Die Reiter wurden bei „Alle Versionen“ und „Team-News“ verdeckt.'],
      ['fixed', 'Design und Ansicht werden jetzt dauerhaft gemerkt.']
    ] },
  { version: '3.1.01', range: '', date: 'Oktober 2026', title: 'Weichzeichner, neue Verwaltung & neuer Changelog',
    changes: [
      ['new', 'Weichzeichner-Effekt (Milchglas) in Dialogen, Menüs und Hinweisen – in den Einstellungen & Zentrale ein- und ausschaltbar.'],
      ['new', 'Hinweis oben rechts, sobald sich ein Kollege anmeldet. Er verschwindet nach wenigen Sekunden von selbst.'],
      ['new', 'Die Logo-Animation zeigt jetzt das Profilfoto des angemeldeten Benutzers.'],
      ['improved', 'Personal & PINs (Zentrale) komplett neu gestaltet: Suche, Filter nach Rolle, übersichtliche Karten und ein eigener Bearbeiten-Bildschirm mit PIN-Hilfe.'],
      ['improved', 'Changelog neu aufgebaut: Reiter „Neu in dieser Version“, „Alle Versionen“ (aufklappbar, mit Suche und Filter) und „Team-News“. Ältere Versionen wandern automatisch ins Archiv.'],
      ['fixed', 'Logo: über dem O ist jetzt eine einzige durchgehende Linie statt zwei getrennter Striche.'],
      ['fixed', 'Login-Protokoll leeren funktioniert wieder (deutsche Beschriftung, serverseitig abgesichert).']
    ] },
  { version: '3.1.00', range: '', date: 'Oktober 2026', title: 'Modularisierung & Chat',
    changes: [
      ['improved', 'App in übersichtliche Module aufgeteilt (einfacher zu warten und zu erweitern).'],
      ['new', 'Team-Chat: @-Vorschläge beim Tippen und Textformatierung (fett, kursiv).'],
      ['new', 'Login-Protokoll kann geleert werden; der Menüpunkt dafür entfällt, die Verwaltung liegt unter Personal & PINs.'],
      ['fixed', 'Saison-Dialog: Der Schließen-Button überlappt nicht mehr mit „Neue Saison“.']
    ] },
  { version: '3.0.52', range: '', date: 'Oktober 2026', title: 'Menü, Multi-View & Textschutz',
    changes: [
      ['new', 'Getränke lassen sich per Drag & Drop (Maus oder langes Drücken am Handy) in den Multi-View ziehen.'],
      ['fixed', 'Das Menü lässt sich am PC wieder mit dem Mausrad scrollen.'],
      ['security', 'Texte aus der Datenbank (Namen, Chat, Tickets, Rezepte) werden vor der Anzeige abgesichert.']
    ] },
  { version: '3.0.51', range: '', date: 'Oktober 2026', title: 'Deutsche Oberfläche',
    changes: [
      ['improved', 'Deutsche Oberfläche; Saisons kommen nur noch aus der Datenbank (kein festes Sommer 2026).'],
      ['fixed', 'Mobilmenü bleibt im Bildschirm und ist scrollbar.']
    ] },
  { version: '3.0.50', range: '', date: 'Oktober 2026', title: 'Sicherer Login',
    changes: [
      ['security', 'PIN-Login über den Server: PINs werden nur noch verschlüsselt gespeichert, nach mehreren Fehlversuchen wird kurz gesperrt.'],
      ['security', 'Rechte pro Mitarbeiter („Darf Getränke bearbeiten“) und abgesicherte Datenbank (Chat, Tickets, Fotos, Personal).']
    ] },
  { version: "3.0.49", range: "", date: "Oktober 2026", title: "Arbeitsplan & Versionshistorie",
    changes: [ ['info', "Persönlicher Arbeitsplan für das Servicepersonal mit Testhinweis sowie vollständige, gegliederte Versionshistorie von v1.0 bis v3.0.49."] ] },
  { version: "3.0.47", range: "", date: "Oktober 2026", title: "Saison-Löschung & Benachrichtigungen",
    changes: [ ['info', "Entfernen der Login-Benachrichtigungsanimation für Kollegen; kaskadierendes Löschen von Saisons (z. B. Summer 2026 inklusive aller zugehörigen Drinks)."] ] },
  { version: "3.0.46", range: "v3.0.40 – v3.0.46", date: "September - Oktober 2026", title: "PIN-Login, Chat & Profile",
    changes: [ ['info', "Einführung des PIN-Login-Grids für das Personal, Speichern der Login-Historie (login_history), Online-Status-Erkennung, verbesserter Echtzeit-Team-Chat mit @Mentions sowie Profilen mit Bio und Fotos."] ] },
  { version: "3.0.39", range: "v3.0.30 – v3.0.39", date: "August - September 2026", title: "Saisons, Margen & A3-Druck",
    changes: [ ['info', "Unterstützung mehrerer Saisons, dynamische Berechnung von Margen und Wareneinsatz, A3-Druckvorschau für 3 Drinks, verbesserter Excel/CSV-Import/Export-Assistent."] ] },
  { version: "3.0.29", range: "v3.0.20 – v3.0.29", date: "Juli - August 2026", title: "Bar Tray & Multi-View",
    changes: [ ['info', "Einführung des Bar Trays und des Multi-View-Rezeptvergleichs, Filter nach Allergien, vegan, glutenfrei, laktosefrei und Glastyp."] ] },
  { version: "3.0.19", range: "v1.0 – v3.0.19", date: "2026", title: "Grundlagen der App",
    changes: [ ['info', "Grundlegende Getränkeliste, Kategorien (Cocktails, Mocktails, Salonplafond Classic, After Dinner Drinks, APERITIF), dunkler/heller Modus und Fotos über Supabase Storage."] ] }
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

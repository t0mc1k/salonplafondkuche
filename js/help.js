/* ============================================================
   js/help.js  (v4.0.01)
   Hilfe & Anleitung: Schritt-für-Schritt-Erklärungen für alle Funktionen.
   - Kapitel für Kellner: Deutsch und Englisch.
   - Kapitel für Manager/Developer (Badge „Manager“): nur Deutsch.

   NEUE FUNKTION DOKUMENTIEREN: in HELP_CHAPTERS ein Kapitel ergänzen.
   Felder: id, grp ('start' | 'work' | 'faq' | 'mgr'), icon, mgr (true = nur Manager),
           t (Titel), s (Kurzbeschreibung), intro, where ("Wo finde ich das?"),
           steps (Liste), points ("Gut zu wissen", Liste), tip (Hinweis).
   Jedes Textfeld hat { de: …, en: … }. Listen: { de: […], en: […] }.
   Regel für neue Kellner-Funktionen: Kapitel in DE UND EN schreiben.
   ============================================================ */

    const HELP_UI = {
      title: { de: '📖 Hilfe & Anleitung', en: '📖 Help & Guide' },
      sub: { de: 'So funktioniert die App. Tippe auf ein Thema, um es aufzuklappen.', en: 'How the app works. Tap a topic to open it.' },
      search: { de: '🔍 Frage oder Stichwort, z. B. „Pause“ oder „tauschen“ ...', en: '🔍 Question or keyword, e.g. “break” or “swap” ...' },
      tabAll: { de: 'Alles', en: 'All' }, tabStart: { de: 'Erste Schritte', en: 'Getting started' },
      tabWork: { de: 'Funktionen', en: 'Features' }, tabFaq: { de: 'Häufige Fragen', en: 'FAQ' }, tabMgr: { de: 'Für Manager', en: 'For managers' },
      gStart: { de: 'Erste Schritte', en: 'Getting started' }, gWork: { de: 'Funktionen im Alltag', en: 'Everyday features' },
      gFaq: { de: 'Häufige Fragen', en: 'Frequently asked questions' }, gMgr: { de: 'Für Manager und Developer', en: 'For managers and developers' },
      where: { de: 'Wo finde ich das?', en: 'Where do I find it?' }, steps: { de: 'So geht’s', en: 'How to' },
      points: { de: 'Gut zu wissen', en: 'Good to know' }, tipLabel: { de: 'Tipp', en: 'Tip' },
      none: { de: 'Dazu habe ich nichts gefunden. Versuche ein anderes Wort, z. B. „Plan“, „PIN“ oder „Foto“.', en: 'Nothing found. Try another word, e.g. “schedule”, “PIN” or “photo”.' },
      deOnly: { de: 'nur Deutsch', en: 'German only' }, close: { de: 'Fertig', en: 'Done' }
    };
    const hpu = k => HELP_UI[k][currentLang] || HELP_UI[k].de;

    const HELP_CHAPTERS = [
      // =================================================================== ERSTE SCHRITTE
      { id: 'login', kw: 'anmelden einloggen einlogin login pin passwort code abmelden ausloggen logout sprache password sign in log out language wechseln', grp: 'start', icon: '🔐',
        t: { de: 'Anmelden & Abmelden', en: 'Logging in & out' },
        s: { de: 'Name wählen, PIN eingeben, Sprache wechseln.', en: 'Choose your name, enter your PIN, change the language.' },
        intro: { de: 'Du meldest dich mit deinem Namen und deinem persönlichen PIN-Code an. Den PIN bekommst du vom Manager.', en: 'You log in with your name and your personal PIN code. Your manager gives you the PIN.' },
        where: { de: 'Das ist die erste Seite, wenn du die App öffnest.', en: 'This is the first page when you open the app.' },
        steps: {
          de: ['Tippe in der Liste auf <b>deinen Namen</b>. Bei vielen Namen kannst du oben im Suchfeld tippen. Die letzten drei Personen, die sich auf diesem Gerät angemeldet haben, stehen als schnelle Knöpfe ganz oben.',
               'Gib deinen <b>PIN</b> mit den großen Zahlentasten ein. Am Computer kannst du auch die Tastatur benutzen.',
               'Tippe auf <b>Anmelden</b> (am Computer: Enter-Taste). Du landest auf dem Dashboard.'],
          en: ['Tap <b>your name</b> in the list. If there are many names, type in the search box at the top. The last three people who logged in on this device are shown as quick buttons at the very top.',
               'Enter your <b>PIN</b> with the big number keys. On a computer you can also use the keyboard.',
               'Tap <b>Log in</b> (on a computer: Enter key). You will arrive on the dashboard.'] },
        points: {
          de: ['Der PIN hat 4 bis 6 Ziffern. <b>C</b> löscht alles, <b>⌫</b> löscht die letzte Ziffer.',
               'Falscher Name gewählt? Tippe auf <b>Ändern</b> (am Computer: Esc-Taste).',
               'Bei falschem PIN erscheint eine rote Meldung. Nach zu vielen Fehlversuchen musst du 10 Minuten warten.',
               '<b>Abmelden:</b> Menü ☰ → „Benutzer wechseln“. Am Computer gibt es oben auch den Knopf „🚪 Benutzer wechseln“. Melde dich immer ab, wenn eine andere Person das Gerät benutzt.',
               '<b>Sprache:</b> Oben rechts auf der Anmeldeseite findest du <b>DE | EN</b>. Die Sprache merkt sich das Gerät.', 'Nach dem Anmelden öffnet sich das Dashboard. Möchtest du direkt bei den Getränken starten, stelle das in den Einstellungen unter „Nach dem Login öffnen“ ein.'],
          en: ['The PIN has 4 to 6 digits. <b>C</b> deletes everything, <b>⌫</b> deletes the last digit.',
               'Picked the wrong name? Tap <b>Change</b> (on a computer: Esc key).',
               'A wrong PIN shows a red message. After too many wrong tries you must wait 10 minutes.',
               '<b>Logging out:</b> Menu ☰ → “Switch user”. On a computer there is also a “🚪 Switch user” button at the top. Always log out when someone else uses the device.',
               '<b>Language:</b> At the top right of the login page you find <b>DE | EN</b>. The device remembers your choice.', 'After logging in the dashboard opens. If you would rather start straight with the drinks, set this in the settings under “Open after login”.'] },
        tip: { de: 'Gib deinen PIN nie weiter. Alles, was du in der App machst (Abhaken, Melden, Chat), wird mit deinem Namen gespeichert.', en: 'Never share your PIN. Everything you do in the app (ticking tasks, reporting, chat) is saved with your name.' } },

      { id: 'dashboard', kw: 'startseite kacheln home start tiles zurück back zahl badge', grp: 'start', icon: '🏠',
        t: { de: 'Das Dashboard (Startseite)', en: 'The dashboard (start page)' },
        s: { de: 'Alle Funktionen als Kacheln, mit Zählern.', en: 'All features as tiles, with counters.' },
        intro: { de: 'Nach dem Anmelden siehst du das Dashboard. Jede Kachel öffnet eine Funktion. Du siehst nur Kacheln, die für deine Rolle gedacht sind.', en: 'After logging in you see the dashboard. Each tile opens a feature. You only see tiles meant for your role.' },
        where: { de: 'Das ist deine Startseite. Zurück kommst du immer über Menü ☰ → „Dashboard“ oder mit dem Knopf „← Dashboard“ in der Getränke-Datenbank.', en: 'This is your start page. You can always get back with Menu ☰ → “Dashboard” or with the “← Dashboard” button inside the drinks database.' },
        steps: {
          de: ['Tippe auf eine Kachel, z. B. <b>🍸 Getränke & Rezepte</b>.', 'Arbeite in der Funktion. Fenster schließt du mit <b>×</b> oder <b>Fertig</b>.', 'Mit <b>← Dashboard</b> (oder der Zurück-Taste am Handy) kommst du zurück.'],
          en: ['Tap a tile, e.g. <b>🍸 Drinks & Recipes</b>.', 'Work in the feature. Close windows with <b>×</b> or <b>Done</b>.', 'Use <b>← Dashboard</b> (or the back button on your phone) to go back.'] },
        points: {
          de: ['<b>Rote Zahl</b> auf einer Kachel: Dort wartet etwas auf dich (z. B. ungelesene Chat-Nachrichten oder eine Tausch-Anfrage).', 'Oben steht dein Name, die Begrüßung und das heutige Datum.', 'Kacheln für Kellner: Meine Schicht, Mein Arbeitsplan, Schichttausch, Team-Chat, Getränke & Rezepte, Speisekarte & Allergene, Störung melden, Fundsachen, Bruch melden, Hilfe, Was ist neu?.'],
          en: ['A <b>red number</b> on a tile means something is waiting for you (e.g. unread chat messages or a swap request).', 'At the top you see your name, a greeting and today’s date.', 'Tiles for waiters: My Shift, My Schedule, Shift Swap, Team Chat, Drinks & Recipes, Food Menu & Allergens, Report a Fault, Lost & Found, Report Breakage, Help, What’s new?.'] } },

      { id: 'menu', kw: 'menü menu zahnrad einstellungen schnellzugriff shortcut', grp: 'start', icon: '☰',
        t: { de: 'Das Menü ☰', en: 'The menu ☰' },
        s: { de: 'Schnellzugriff, Profil, Einstellungen, Abmelden.', en: 'Shortcuts, profile, settings, log out.' },
        intro: { de: 'Das Menü ist immer oben rechts erreichbar, egal wo du gerade bist.', en: 'The menu is always at the top right, no matter where you are.' },
        where: { de: 'Oben rechts: am Handy das Zahnrad-Symbol ⚙️, am Computer der Knopf „☰ Menü“.', en: 'Top right: on a phone the cog icon ⚙️, on a computer the “☰ Menu” button.' },
        points: {
          de: ['<b>Ganz oben:</b> dein Name und Foto. Tippe darauf, um dein Profil zu öffnen.', '<b>Dashboard / Getränke & Rezepte:</b> springen direkt dorthin.', '<b>Getränke & Karte:</b> Saison wählen, Einkaufsliste / Inventur, Karten-Druck (A3).', '<b>Team & Arbeit:</b> Team-Chat und Mein Arbeitsplan.', '<b>App:</b> Einstellungen, Daten aktualisieren, App installieren, Vollbild, Hilfe, Was ist neu?, Support.', '<b>Benutzer wechseln:</b> meldet dich ab.', 'Der kleine Punkt am Menü-Knopf bedeutet: Es gibt etwas Neues (z. B. eine Antwort auf dein Ticket).'],
          en: ['<b>At the very top:</b> your name and photo. Tap it to open your profile.', '<b>Dashboard / Drinks & Recipes:</b> jump straight there.', '<b>Drinks & Menu:</b> choose season, shopping list / stocktake, menu print (A3).', '<b>Team & Work:</b> Team Chat and My Schedule.', '<b>App:</b> settings, refresh data, install app, fullscreen, help, what’s new, support.', '<b>Switch user:</b> logs you out.', 'The small dot on the menu button means there is something new (e.g. an answer to your ticket).'] } },

      { id: 'profile', kw: 'profil foto bild avatar pin ändern über mich bio photo picture change pin about me', grp: 'start', icon: '👤',
        t: { de: 'Mein Profil', en: 'My profile' },
        s: { de: 'Foto, „Über mich“, PIN ändern.', en: 'Photo, “About me”, change PIN.' },
        intro: { de: 'So sehen dich deine Kollegen im Chat und in der Personalliste.', en: 'This is how your colleagues see you in the chat and in the staff list.' },
        where: { de: 'Menü ☰ → ganz oben auf deinen Namen tippen.', en: 'Menu ☰ → tap your name at the very top.' },
        steps: {
          de: ['Tippe auf <b>📷 Foto ändern</b>, wähle ein Bild oder mache ein Foto. Mit <b>🔍 Foto ansehen</b> siehst du es groß.', 'Schreibe bei <b>Über mich</b> einen kurzen Text (bis 140 Zeichen) oder tippe auf einen Vorschlag wie „Hinter der Bar“ oder „In der Pause“. <b>Leeren</b> löscht den Text.', 'Willst du einen neuen PIN? Gib ihn bei <b>Neuer PIN</b> und <b>PIN wiederholen</b> ein (4 bis 6 Ziffern). Mit „Anzeigen / verbergen“ siehst du, was du tippst. Lässt du die Felder leer, bleibt dein PIN gleich.', 'Tippe auf <b>💾 Speichern</b>. Solange du nicht gespeichert hast, steht „Ungespeicherte Änderungen“ unten.'],
          en: ['Tap <b>📷 Change photo</b>, pick a picture or take a photo. <b>🔍 View photo</b> shows it large.', 'Under <b>About me</b> write a short text (up to 140 characters) or tap a suggestion like “Behind the bar” or “On a break”. <b>Clear</b> deletes the text.', 'Want a new PIN? Enter it under <b>New PIN</b> and <b>Repeat PIN</b> (4 to 6 digits). “Show / hide” lets you see what you type. If you leave the fields empty, your PIN stays the same.', 'Tap <b>💾 Save</b>. Until you save, “Unsaved changes” is shown at the bottom.'] },
        points: { de: ['Unter <b>Meine Rechte</b> siehst du, was du in der App darfst.', 'Auf das Profil einer Kollegin oder eines Kollegen kommst du, wenn du im Chat auf den Namen oder das Foto tippst.'], en: ['Under <b>My rights</b> you see what you are allowed to do in the app.', 'To see a colleague’s profile, tap their name or photo in the chat.'] } },

      { id: 'settings', kw: 'einstellung sprache language englisch deutsch english hell dunkel dark light schrift größe text size ton sound hinweis benachrichtigung theme', grp: 'start', icon: '⚙️',
        t: { de: 'Einstellungen & Sprache', en: 'Settings & language' },
        s: { de: 'Sprache, Hell/Dunkel, Schriftgröße, Hinweise.', en: 'Language, light/dark, text size, notifications.' },
        intro: { de: 'Die meisten Einstellungen gelten nur auf dem Gerät, das du gerade benutzt, und werden automatisch gespeichert. „Nach dem Login öffnen“ und die Begrüßungsanimation gehören zu deinem Konto und gelten auf jedem Gerät.', en: 'Most settings only apply to the device you are using and are saved automatically. “Open after login” and the welcome animation belong to your account and apply on every device.' },
        where: { de: 'Menü ☰ → „Einstellungen & Zentrale“.', en: 'Menu ☰ → “Settings & Control Centre”.' },
        steps: {
          de: ['Die Einstellungen sind in <b>Reitern</b> geordnet: 🏠 Allgemein, 🎨 Darstellung, 🍸 Getränke, 🔔 Hinweise, 👤 Konto, 🧰 App. Die App merkt sich, welchen Reiter du zuletzt geöffnet hast.', 'Reiter <b>Allgemein</b>: <b>Sprache / Language</b>. Tippe auf <b>Deutsch</b> oder <b>English</b>. Die App wechselt sofort.', '<b>Design:</b> Hell (gut bei Tageslicht), Dunkel (angenehm abends an der Bar) oder Auto (folgt dem Gerät).', '<b>Schriftgröße:</b> Klein, Normal, Groß, Sehr groß. Das vergrößert alle Texte.', 'Ebenfalls unter <b>Allgemein</b>: <b>Begrüßungsanimation</b> ein- oder ausschalten.', '<b>Nach dem Login öffnen:</b> Wähle, ob sich nach der Anmeldung das <b>Dashboard</b> (Standard) oder direkt die <b>Getränke</b> öffnen. Die Einstellung wird in deinem Konto gespeichert und gilt auf jedem Gerät.', '<b>Getränke:</b> Ansicht (Karten mit Foto oder Liste), Sortierung, Preise anzeigen, aktive Saison.', '<b>Hinweise:</b> Kurze Meldung, wenn sich ein Kollege anmeldet; Hinweis und Ton bei neuer Chat-Nachricht.'],
          en: ['The settings are organised in <b>tabs</b>: 🏠 General, 🎨 Appearance, 🍸 Drinks, 🔔 Notifications, 👤 Account, 🧰 App. The app remembers the tab you used last.', 'Tab <b>General</b>: <b>Language / Sprache</b>. Tap <b>Deutsch</b> or <b>English</b>. The app switches immediately.', 'Also in <b>General</b>: <b>Welcome animation</b> – switch the short animation after login on or off.', '<b>Theme:</b> Light (good in daylight), Dark (pleasant in the evening at the bar) or Auto (follows the device).', '<b>Text size:</b> Small, Normal, Large, Extra large. This enlarges all text.', '<b>Open after login:</b> Choose whether the <b>dashboard</b> (default) or the <b>drinks</b> open straight after you log in. The setting is saved in your account and applies on every device.', '<b>Drinks:</b> view (cards with photo or list), sorting, show prices, active season.', '<b>Notifications:</b> a short notice when a colleague logs in; a notice and sound for new chat messages.'] },
        points: { de: ['„Weichzeichner“ und „Animationen reduzieren“ helfen bei älteren Handys und sparen Akku.', '<b>App neu laden</b> hilft, wenn etwas hängt oder alt aussieht. <b>Einstellungen zurücksetzen</b> stellt alles auf Standard.', 'Mitarbeiter mit Rechten können hier zwischen „Kellner“- und „Verwaltung“-Ansicht wechseln.', 'Passen nicht alle Reiter auf den Bildschirm, erscheinen links/rechts <b>Pfeile ‹ ›</b>. Du kannst auch mit dem Mausrad scrollen oder mit gedrückter Maustaste ziehen.', 'Unter <b>🎨 Darstellung → ✨ TomiAI-Knopf</b> kannst du den schwebenden Knopf ausblenden (TomiAI bleibt über das Dashboard erreichbar) oder „Knopf verschieben“ einschalten und ihn mit Finger oder Maus an eine beliebige Stelle ziehen. „Position zurücksetzen“ bringt ihn zurück. Das gilt nur auf diesem Gerät.', 'Unter <b>🎨 Darstellung → 🪟 Fenster</b> schaltest du ein, ob ein Klick auf den abgedunkelten Hintergrund ein Fenster schließt (Standard: an). Hast du etwas eingetippt, bleibt das Fenster zur Sicherheit offen und wackelt kurz.'], en: ['“Blur effect” and “Reduce animations” help on older phones and save battery.', '<b>Reload app</b> helps if something is stuck or looks outdated. <b>Reset settings</b> sets everything back to default.', 'Staff with extra rights can switch here between “Waiter” and “Admin” view.', 'If not all tabs fit on the screen, <b>arrows ‹ ›</b> appear on the left/right. You can also scroll with the mouse wheel or drag with the mouse button held down.', 'Under <b>🎨 Appearance → ✨ TomiAI button</b> you can hide the floating button (TomiAI stays available from the dashboard) or switch on “Move button” and drag it anywhere with your finger or mouse. “Reset position” puts it back. This applies to this device only.', 'Under <b>🎨 Appearance → 🪟 Windows</b> you switch whether clicking the dimmed background closes a window (default: on). If you have typed something, the window stays open to be safe and shakes briefly.'] } },

      { id: 'install', kw: 'installieren startbildschirm homescreen pwa update aktualisieren neu laden reload install', grp: 'start', icon: '📲',
        t: { de: 'App installieren & aktualisieren', en: 'Installing & updating the app' },
        s: { de: 'Symbol auf dem Startbildschirm, neue Version laden.', en: 'Home-screen icon, loading a new version.' },
        intro: { de: 'Du kannst die App wie eine normale App auf dem Startbildschirm speichern. Sie startet dann ohne Browser-Leiste.', en: 'You can save the app on your home screen like a normal app. It then starts without the browser bar.' },
        where: { de: 'Menü ☰ → „App installieren“ oder Einstellungen → „📲 So geht’s“.', en: 'Menu ☰ → “Install app” or Settings → “📲 How to”.' },
        steps: { de: ['Tippe auf <b>App installieren</b> bzw. <b>So geht’s</b>.', 'Folge den Schritten für dein Gerät (iPhone: „Teilen“ → „Zum Home-Bildschirm“; Android: „Installieren“ oder „Zum Startbildschirm hinzufügen“).', 'Öffne die App künftig über das neue Symbol.'], en: ['Tap <b>Install app</b> or <b>How to</b>.', 'Follow the steps for your device (iPhone: “Share” → “Add to Home Screen”; Android: “Install” or “Add to Home screen”).', 'From now on, open the app with the new icon.'] },
        points: { de: ['Nach einem Update zeigt dir „Was ist neu?“ die Neuerungen. Wenn noch die alte Version läuft: Einstellungen → <b>🔄 Neu laden</b> oder die App einmal ganz schließen und neu öffnen.', 'Menü ☰ → <b>Daten aktualisieren</b> lädt nur die Getränke neu.', 'Die App braucht Internet, um Daten zu laden und zu speichern.'], en: ['After an update, “What’s new?” shows the changes. If the old version still runs: Settings → <b>🔄 Reload</b> or close the app completely and reopen it.', 'Menu ☰ → <b>Refresh data</b> only reloads the drinks.', 'The app needs internet to load and save data.'] } },

      // =================================================================== FUNKTIONEN
      { id: 'drinks', kw: 'getränk getränke cocktail rezept zutaten menge filter suche kategorie favorit herz drucken pdf glas drink recipe ingredients search favourite print', grp: 'work', icon: '🍸',
        t: { de: 'Getränke & Rezepte', en: 'Drinks & Recipes' },
        s: { de: 'Suchen, filtern, Rezept öffnen, Favoriten, drucken.', en: 'Search, filter, open a recipe, favourites, print.' },
        intro: { de: 'Hier findest du alle Getränke mit Zutaten, Mengen und Zubereitung. So hast du an der Bar immer die richtige Antwort.', en: 'Here you find all drinks with ingredients, amounts and preparation. That way you always have the right answer at the bar.' },
        where: { de: 'Dashboard → Kachel „🍸 Getränke & Rezepte“ (oder Menü ☰ → „Getränke & Rezepte“).', en: 'Dashboard → tile “🍸 Drinks & Recipes” (or Menu ☰ → “Drinks & Recipes”).' },
        steps: {
          de: ['Tippe oben ins <b>Suchfeld</b> und schreibe einen Teil des Namens oder einer Zutat.', 'Wähle unter <b>Kategorie</b> eine Gruppe (z. B. Cocktails). „Alle“ zeigt alles.', 'Mit <b>⚡ Filter</b> klappst du die Filter auf: TOP / Highlight, Vegan, Glutenfrei, Laktosefrei, Alkoholfrei, Schicht-Favoriten und die Glas-Typen.', 'Tippe auf eine <b>Getränke-Karte</b>. Es öffnet sich das Rezept mit Glas, Methode, Zutaten und Mengen, Garnitur, Zubereitung und Allergenen.', 'Gibt es Fotos (bis zu 3), tippe auf die kleinen Bilder oder auf „🖼️ Foto anzeigen“.'],
          en: ['Tap the <b>search box</b> at the top and type part of a name or an ingredient.', 'Under <b>Category</b> choose a group (e.g. Cocktails). “All” shows everything.', 'With <b>⚡ Filter</b> you open the filters: TOP / Highlight, Vegan, Gluten-free, Lactose-free, Alcohol-free, Shift favourites and the glass types.', 'Tap a <b>drink card</b>. The recipe opens with glass, method, ingredients and amounts, garnish, preparation and allergens.', 'If there are photos (up to 3), tap the small pictures or “🖼️ Show photo”.'] },
        points: {
          de: ['<b>❤️ Schicht-Favorit:</b> Tippe auf das Herz auf der Karte (oder im Rezept auf „Schicht-Favorit“). Deine Favoriten findest du mit dem Filter „❤️ Schicht-Favoriten“ wieder. Sie werden auf diesem Gerät gespeichert.', '<b>🖨️ Drucken / PDF:</b> Im Rezept tippen, dann wählen: mit Bild oder ohne Bild (nur Text).', '<b>Saison:</b> Die Karte zeigt die aktive Saison. Tippe auf „📅 Saison:“, um zu wechseln (siehe Saison wählen im Menü).', 'In den Einstellungen kannst du Karten- oder Listenansicht, Sortierung und Preise ein- oder ausschalten.', 'Allergene stehen im Rezept unter „⚠️ Allergene“. Mehr dazu im Kapitel „Speisekarte & Allergene“.'],
          en: ['<b>❤️ Shift favourite:</b> tap the heart on the card (or “Shift favourite” inside the recipe). You find your favourites again with the filter “❤️ Shift favourites”. They are saved on this device.', '<b>🖨️ Print / PDF:</b> tap it inside the recipe, then choose: with image or without image (text only).', '<b>Season:</b> the menu shows the active season. Tap “📅 Season:” to switch (see Choose season in the menu).', 'In the settings you can switch card or list view, sorting and prices on or off.', 'Allergens are shown in the recipe under “⚠️ Allergens”. More in the chapter “Food Menu & Allergens”.'] },
        tip: { de: 'Das Rezept findest du nicht? Lösche die Suche mit dem Kreuz und prüfe, ob oben „Alle“ gewählt ist und kein Filter aktiv ist.', en: 'Can’t find the recipe? Clear the search with the cross and check that “All” is selected and no filter is active.' } },

      { id: 'multiview', kw: 'vergleichen korb multi view mehrere nebeneinander compare basket', grp: 'work', icon: '⚡',
        t: { de: 'Multi-View: Rezepte vergleichen', en: 'Multi-View: compare recipes' },
        s: { de: 'Bis zu 6 Getränke nebeneinander ansehen.', en: 'View up to 6 drinks side by side.' },
        intro: { de: 'Mit Multi-View legst du mehrere Getränke in einen „Korb“ und siehst die Rezepte nebeneinander. Praktisch, wenn ein Gast sich zwischen mehreren Cocktails entscheidet oder du mehrere Drinks gleichzeitig vorbereitest.', en: 'With Multi-View you put several drinks into a “basket” and see the recipes next to each other. Handy when a guest chooses between several cocktails or when you prepare several drinks at once.' },
        where: { de: 'In der Getränke-Datenbank: der Knopf <b>⚡</b> auf jeder Getränke-Karte.', en: 'In the drinks database: the <b>⚡</b> button on every drink card.' },
        steps: {
          de: ['Tippe bei jedem gewünschten Getränk auf <b>⚡</b>. Es kommt in den Korb (maximal <b>6</b>). Du kannst eine Karte auch nach unten in die Zone „Hier loslassen für Multi-View“ ziehen.', 'Unten erscheint die Leiste <b>⚡ Multi-View (Zahl)</b>. Tippe darauf.', 'Du siehst die Rezepte nebeneinander. Mit „🔄“ ersetzt du ein Getränk durch ein anderes aus der aktuellen Saison.', 'Zum Leeren tippe unten auf <b>🗑️</b>. Mit dem × beim Namen nimmst du ein einzelnes Getränk heraus.'],
          en: ['Tap <b>⚡</b> on every drink you want. It goes into the basket (maximum <b>6</b>). You can also drag a card down into the zone “Release here for Multi-View”.', 'The bar <b>⚡ Multi-View (number)</b> appears at the bottom. Tap it.', 'You see the recipes side by side. With “🔄” you replace a drink with another one from the current season.', 'To empty the basket tap <b>🗑️</b> at the bottom. The × next to a name removes a single drink.'] },
        points: { de: ['Ist der Korb voll (6/6), erscheint ein Hinweis. Nimm erst ein Getränk heraus.', 'Der Korb ist nur ein Hilfsmittel für den Moment und wird beim Neuladen der App geleert.'], en: ['When the basket is full (6/6) a notice appears. Remove a drink first.', 'The basket is only a helper for the moment and is emptied when the app is reloaded.'] } },

      { id: 'shopping', kw: 'einkaufsliste inventur zutaten bestellen einkauf excel stocktake shopping order', grp: 'work', icon: '🛒',
        t: { de: 'Einkaufsliste / Inventur', en: 'Shopping list / Stocktake' },
        s: { de: 'Alle Zutaten der aktiven Saison zusammengerechnet.', en: 'All ingredients of the active season added up.' },
        intro: { de: 'Die App rechnet alle Zutaten der aktiven Saison zusammen. So siehst du, was du für die Karte brauchst, und kannst Inventur machen.', en: 'The app adds up all ingredients of the active season. You see what you need for the menu and can do a stocktake.' },
        where: { de: 'Menü ☰ → „Einkaufsliste / Inventur“.', en: 'Menu ☰ → “Shopping list / Stocktake”.' },
        steps: { de: ['Öffne die Einkaufsliste im Menü.', 'Prüfe die Zutaten und Mengen.', 'Tippe auf <b>🖨️ Einkaufsliste drucken</b> oder <b>📗 Als Excel exportieren</b>.'], en: ['Open the shopping list in the menu.', 'Check the ingredients and amounts.', 'Tap <b>🖨️ Print shopping list</b> or <b>📗 Export as Excel</b>.'] },
        points: { de: ['Die Liste gilt für die Saison, die gerade aktiv ist. Wechsle vorher die Saison, wenn du eine andere brauchst.'], en: ['The list applies to the season that is currently active. Switch the season first if you need another one.'] } },

      { id: 'allergens', kw: 'allergie allergen unverträglichkeit nuss nüsse gluten laktose milch ei sesam sulfit speisekarte essen gericht food allergy intolerance nut milk egg dish', grp: 'work', icon: '🍽️',
        t: { de: 'Speisekarte & Allergene', en: 'Food Menu & Allergens' },
        s: { de: 'Gerichte nachschauen, Allergene A–R, Gäste mit Unverträglichkeit.', en: 'Look up dishes, allergens A–R, guests with intolerances.' },
        intro: { de: 'Wenn ein Gast fragt „Ist da Nuss oder Gluten drin?“, schaust du hier nach. In Österreich werden Allergene mit Buchstaben angegeben (A bis R).', en: 'When a guest asks “Does it contain nuts or gluten?”, look here. In Austria allergens are marked with letters (A to R).' },
        where: { de: 'Dashboard → Kachel „🍽️ Speisekarte & Allergene“.', en: 'Dashboard → tile “🍽️ Food Menu & Allergens”.' },
        steps: {
          de: ['Wähle oben <b>🍽️ Speisekarte</b> (Gerichte) oder <b>🍸 Getränke</b>.', 'Suche im Feld nach dem Namen.', 'Tippe auf einen oder mehrere <b>Buchstaben</b> (A–R). Alle Einträge, die dieses Allergen enthalten, werden <b>ausgeblendet</b>. Übrig bleibt, was der Gast essen kann.', 'Mit <b>ℹ️ A–R</b> siehst du, was jeder Buchstabe bedeutet.'],
          en: ['At the top choose <b>🍽️ Food menu</b> (dishes) or <b>🍸 Drinks</b>.', 'Search for a name in the box.', 'Tap one or more <b>letters</b> (A–R). All entries containing that allergen are <b>hidden</b>. What remains is what the guest can have.', 'With <b>ℹ️ A–R</b> you see what each letter means.'] },
        points: {
          de: ['<b>A</b> Glutenhaltiges Getreide · <b>B</b> Krebstiere · <b>C</b> Eier · <b>D</b> Fisch · <b>E</b> Erdnüsse · <b>F</b> Soja · <b>G</b> Milch / Laktose · <b>H</b> Schalenfrüchte (Nüsse) · <b>L</b> Sellerie · <b>M</b> Senf · <b>N</b> Sesam · <b>O</b> Sulfite · <b>P</b> Lupinen · <b>R</b> Weichtiere.', 'Gerichte, die gerade nicht verfügbar sind, sind grau markiert.', 'Bei Getränken steht das Allergen als Text im Rezept. Der Filter sucht darin nach Stichwörtern. Er ist eine Hilfe, aber kein Ersatz für einen Blick ins Rezept.', 'Gibt es mehrere Speisekarten (z. B. nach Saison), wähle oben die richtige.'],
          en: ['<b>A</b> Cereals containing gluten · <b>B</b> Crustaceans · <b>C</b> Eggs · <b>D</b> Fish · <b>E</b> Peanuts · <b>F</b> Soy · <b>G</b> Milk / lactose · <b>H</b> Tree nuts · <b>L</b> Celery · <b>M</b> Mustard · <b>N</b> Sesame · <b>O</b> Sulphites · <b>P</b> Lupin · <b>R</b> Molluscs.', 'Dishes that are not available right now are greyed out.', 'For drinks the allergen is written as text in the recipe. The filter searches it for keywords. It is a help, but not a replacement for checking the recipe.', 'If there are several menus (e.g. by season), choose the right one at the top.'] },
        tip: { de: 'Bei schweren Allergien immer zusätzlich in der Küche nachfragen. Die App zeigt nur, was eingetragen ist.', en: 'For severe allergies always check with the kitchen as well. The app only shows what has been entered.' } },

      { id: 'specials', kw: 'tagesangebot tageskuchen tagessuppe suppe kuchen torte heute tagesgericht allergene angebot daily special soup cake today dessert foto scan', grp: 'work', icon: '🍰',
        t: { de: 'Tagesangebot (Kuchen & Suppe)', en: 'Daily Specials (Cake & Soup)' },
        s: { de: 'Was es heute gibt – mit Allergenen.', en: 'What is on today – with allergens.' },
        intro: { de: 'Hier siehst du den <b>Tageskuchen</b> und die <b>Tagessuppe</b> von heute mit Preis und Allergenen. So kannst du Gästen schnell und sicher Auskunft geben.', en: 'Here you see today’s <b>cake</b> and <b>soup</b> with price and allergens, so you can answer guests quickly and safely.' },
        where: { de: 'Dashboard → Kachel „🍰 Tagesangebot“.', en: 'Dashboard → tile “🍰 Daily specials”.' },
        steps: {
          de: ['Öffne die Kachel <b>🍰 Tagesangebot</b>.', 'Im Reiter <b>📌 Heute</b> stehen Suppe und Kuchen von heute. Unter dem Namen sind die Allergene als Buchstaben und im Klartext angegeben.', 'Im Reiter <b>📅 Kommend</b> siehst du, was für die nächsten Tage eingetragen ist.', 'Mit <b>ℹ️ A–R</b> öffnest du die Liste aller Allergen-Buchstaben.'],
          en: ['Open the tile <b>🍰 Daily specials</b>.', 'The tab <b>📌 Today</b> shows today’s soup and cake. Under the name the allergens are shown as letters and in plain text.', 'The tab <b>📅 Upcoming</b> shows what is entered for the next days.', 'With <b>ℹ️ A–R</b> you open the list of all allergen letters.'] },
        points: {
          de: ['Steht dort „Heute noch nichts eingetragen“, hat der Manager es noch nicht erfasst. Frag dann in der Küche nach.', '„Keine Allergene eingetragen“ heißt nur, dass keine erfasst wurden, nicht dass das Gericht allergenfrei ist. Im Zweifel in der Küche nachfragen.'],
          en: ['If it says “Nothing entered for today yet”, the manager has not added it yet. Please ask in the kitchen.', '“No allergens entered” only means none were recorded, not that the dish is allergen-free. If in doubt, ask the kitchen.'] } },

      { id: 'checklist', kw: 'aufgaben to-do todo öffnung schließung eis kasse kaffeemaschine terrasse abhaken tasks opening closing ice till tick', grp: 'work', icon: '✅',
        t: { de: 'Meine Schicht: Checkliste', en: 'My Shift: Checklist' },
        s: { de: 'Aufgaben für Öffnung, Laufend und Schließung abhaken.', en: 'Tick off tasks for opening, ongoing and closing.' },
        intro: { de: 'Die Checkliste zeigt, was bei Öffnung, während der Schicht und bei Schließung erledigt werden muss, z. B. Eis auffüllen, Kaffeemaschine reinigen, Kassa zählen. Es gibt <b>eine gemeinsame Liste pro Tag</b> für das ganze Team.', en: 'The checklist shows what has to be done at opening, during the shift and at closing, e.g. refill ice, clean the coffee machine, count the till. There is <b>one shared list per day</b> for the whole team.' },
        where: { de: 'Dashboard → Kachel „✅ Meine Schicht“.', en: 'Dashboard → tile “✅ My Shift”.' },
        steps: {
          de: ['Öffne die Kachel. Oben siehst du Knöpfe <b>Alle / Bar / Service / Terrasse</b>. Die App wählt automatisch deinen Bereich, wenn er im Arbeitsplan steht.', 'Die Aufgaben sind gruppiert: <b>🌅 Öffnung</b>, <b>🔄 Laufend</b>, <b>🌙 Schließung</b>.', 'Tippe auf eine Aufgabe, wenn sie erledigt ist. Sie wird grün und zeigt <b>deinen Namen und die Uhrzeit</b>.', 'Der Balken oben zeigt, wie viele Aufgaben schon erledigt sind.'],
          en: ['Open the tile. At the top you see buttons <b>All / Bar / Service / Terrace</b>. The app picks your area automatically if it is in the schedule.', 'Tasks are grouped: <b>🌅 Opening</b>, <b>🔄 Ongoing</b>, <b>🌙 Closing</b>.', 'Tap a task when it is done. It turns green and shows <b>your name and the time</b>.', 'The bar at the top shows how many tasks are already done.'] },
        points: {
          de: ['Hat jemand anderes die Aufgabe schon erledigt, siehst du das sofort mit seinem Namen. Es muss nichts doppelt gemacht werden.', 'Aus Versehen angetippt? Tippe nochmal darauf. Zurücknehmen kann nur die Person, die abgehakt hat, oder ein Manager.', 'Als Betriebstag zählt die Zeit bis 5 Uhr früh noch zum Vortag. Wer nach Mitternacht schließt, hakt also im selben „Tag“ ab.', 'Die Aufgaben legt der Manager fest. Fehlt etwas, sag ihm Bescheid.'],
          en: ['If someone else already did the task, you see it straight away with their name. Nothing has to be done twice.', 'Tapped by mistake? Tap it again. Only the person who ticked it, or a manager, can undo it.', 'The business day counts until 5 a.m. as the previous day. So if you close after midnight, you tick in the same “day”.', 'The manager defines the tasks. If something is missing, tell them.'] } },

      { id: 'myplan', kw: 'dienstplan plan schicht schichten arbeitszeit stunden pause freie tage urlaub krank schedule shift hours break holiday sick', grp: 'work', icon: '🗓️',
        t: { de: 'Mein Arbeitsplan & Pausen', en: 'My Schedule & breaks' },
        s: { de: 'Deine Schichten im Monat, Pause eintragen, Stunden sehen.', en: 'Your shifts for the month, enter breaks, see hours.' },
        intro: { de: 'Hier siehst du alle deine Schichten im Monat, wie lange du arbeitest und kannst deine Pause eintragen. Der Manager nutzt das später für die Stunden.', en: 'Here you see all your shifts in the month and how long you work, and you can enter your break. The manager uses this later for the hours.' },
        where: { de: 'Dashboard → Kachel „🗓️ Mein Arbeitsplan“ (oder Menü ☰ → „Mein Arbeitsplan“).', en: 'Dashboard → tile “🗓️ My Schedule” (or Menu ☰ → “My Schedule”).' },
        steps: {
          de: ['Öffne die Kachel. Du siehst deine Schichten für den aktuellen Monat. Heute ist orange umrandet.', 'Mit <b>‹</b> und <b>›</b> wechselst du den Monat.', 'Bei jeder Schicht gibt es das Feld <b>Pause (Min.)</b>. Trage die Minuten ein, z. B. 30. Es wird sofort gespeichert und die Stunden werden neu gerechnet.', 'Oben siehst du <b>Schichten</b> und <b>Std. netto</b> (geplante Zeit minus Pausen).'],
          en: ['Open the tile. You see your shifts for the current month. Today has an orange border.', 'Use <b>‹</b> and <b>›</b> to change the month.', 'Every shift has a <b>Break (min.)</b> field. Enter the minutes, e.g. 30. It is saved immediately and the hours are recalculated.', 'At the top you see <b>Shifts</b> and <b>hrs. net</b> (planned time minus breaks).'] },
        points: { de: ['<b>Frei</b>, <b>Urlaub</b> und <b>Krank</b> werden als Eintrag angezeigt, ohne Stunden.', 'Schichten über Mitternacht (z. B. 17:00–01:00) werden richtig gerechnet.', 'Hast du länger oder kürzer gearbeitet als geplant? Das korrigiert der Manager bei den Stunden. Sag ihm Bescheid.', 'Der Plan wird vom Manager gepflegt (Excel-Import). Stimmt etwas nicht, frag ihn.'], en: ['<b>Off</b>, <b>Holiday</b> and <b>Sick</b> are shown as an entry, without hours.', 'Shifts over midnight (e.g. 17:00–01:00) are calculated correctly.', 'Did you work longer or shorter than planned? The manager corrects this in the hours. Tell them.', 'The manager maintains the schedule (Excel import). If something is wrong, ask them.'] } },

      { id: 'swap', kw: 'tauschen tausch übernehmen abgeben schicht börse kollege wechsel swap trade take over give away board colleague', grp: 'work', icon: '🔄',
        t: { de: 'Schichttausch', en: 'Shift Swap' },
        s: { de: 'Schicht an Kollegen übergeben oder in die Börse stellen.', en: 'Hand over a shift to a colleague or put it on the board.' },
        intro: { de: 'Du kannst eine Schicht an einen Kollegen abgeben. Es gibt <b>zwei Wege</b>: direkt an eine Person, die schon zugesagt hat, oder in die <b>Börse</b>, wo sie jeder freie Kollege übernehmen kann. In beiden Fällen entscheidet am Ende der <b>Manager</b>. Erst wenn er zustimmt, ändert sich der Arbeitsplan.', en: 'You can hand a shift over to a colleague. There are <b>two ways</b>: directly to one person who has already agreed, or onto the <b>board</b>, where any free colleague can take it. In both cases the <b>manager</b> decides in the end. The schedule only changes once they approve.' },
        where: { de: 'Anfrage stellen: Mein Arbeitsplan → bei der Schicht „🔄 Tausch anfragen“. Alles verwalten: Dashboard → Kachel „🔄 Schichttausch“.', en: 'Make a request: My Schedule → on the shift “🔄 Request swap”. Manage everything: Dashboard → tile “🔄 Shift Swap”.' },
        steps: {
          de: ['Öffne <b>Mein Arbeitsplan</b> und tippe bei der Schicht auf <b>🔄 Tausch anfragen</b> (geht nur für heutige und künftige Schichten).', 'Wähle <b>👤 An einen Kollegen</b> und suche eine Person aus der Liste. Dort stehen nur Kollegen, die an dem Tag <b>keine Schicht</b> haben. Oder wähle <b>📢 In die Börse</b>.', 'Schreibe wenn du willst eine kurze Nachricht und tippe auf <b>Anfrage senden</b>.', 'Der Kollege sieht die Anfrage unter <b>📩 Für mich</b> und tippt auf <b>Annehmen</b> oder <b>Ablehnen</b>. In der Börse tippt ein Kollege unter <b>📢 Börse</b> auf <b>Übernehmen</b>. Wer zuerst kommt, bekommt die Schicht.', 'Danach wartet die Anfrage auf den <b>Manager</b>. Du siehst den Stand unter <b>👤 Meine</b>. Bei Genehmigung wechselt die Schicht im Plan zum Kollegen.'],
          en: ['Open <b>My Schedule</b> and tap <b>🔄 Request swap</b> on the shift (only possible for today’s and future shifts).', 'Choose <b>👤 To a colleague</b> and pick a person from the list. It only lists colleagues who have <b>no shift</b> on that day. Or choose <b>📢 Put on the board</b>.', 'If you like, write a short message and tap <b>Send request</b>.', 'The colleague sees the request under <b>📩 For me</b> and taps <b>Accept</b> or <b>Decline</b>. On the board a colleague taps <b>Take over</b> under <b>📢 Board</b>. Whoever is first gets the shift.', 'The request then waits for the <b>manager</b>. You see the status under <b>👤 Mine</b>. If approved, the shift moves to the colleague in the schedule.'] },
        points: {
          de: ['<b>Status:</b> „Wartet auf Antwort“ (Kollege muss noch antworten) → „Wartet auf Manager“ → „Genehmigt“ oder „Vom Manager abgelehnt“. Weitere: „Vom Kollegen abgelehnt“, „Zurückgezogen“.', 'Du kannst eine Anfrage mit <b>Zurückziehen</b> zurücknehmen, solange noch nicht entschieden wurde.', 'Pro Tag kann es nur eine offene Anfrage geben.', 'Die rote Zahl auf der Kachel zeigt neue Anfragen für dich oder offene Schichten in der Börse.', 'Bis der Manager genehmigt hat, bleibt die Schicht bei dir. Erscheine zur Schicht, wenn noch nichts entschieden ist.'],
          en: ['<b>Status:</b> “Waiting for reply” (colleague still has to answer) → “Waiting for manager” → “Approved” or “Rejected by manager”. Others: “Declined by colleague”, “Withdrawn”.', 'You can take back a request with <b>Withdraw</b> as long as it has not been decided.', 'There can only be one open request per day.', 'The red number on the tile shows new requests for you or open shifts on the board.', 'Until the manager has approved, the shift stays with you. Turn up for your shift if nothing has been decided.'] } },

      { id: 'inbox', kw: 'mitteilungen glocke neu benachrichtigung ungelesen blinkt neue version was ist neu push notification bell unread new version', grp: 'work', icon: '🔔',
        t: { de: 'Mitteilungen (🔔 unter dem Datum)', en: 'Notifications (🔔 under the date)' },
        s: { de: 'Was ist neu und was betrifft dich?', en: 'What is new and what concerns you?' },
        intro: { de: 'Unter dem Datum im Dashboard blinkt <b>🔔 3 neu</b>, sobald etwas Neues für dich da ist, zum Beispiel ein genehmigter Urlaub, ein Schichttausch, ein neuer Arbeitsplan oder eine <b>neue App-Version</b>. Das funktioniert auch dann, wenn Push-Benachrichtigungen auf deinem Gerät nicht ankommen.', en: 'Under the date on the dashboard, <b>🔔 3 new</b> blinks as soon as there is something new for you, for example approved vacation, a shift swap, a new schedule or a <b>new app version</b>. This also works if push notifications do not arrive on your device.' },
        where: { de: 'Dashboard → blinkendes Symbol unter dem Datum.', en: 'Dashboard → blinking icon under the date.' },
        steps: {
          de: ['Tippe auf <b>🔔 neu</b> unter dem Datum.', 'Ungelesene Einträge sind orange markiert. Tippe einen Eintrag an, um direkt in das passende Fenster zu springen (z. B. Urlaub, Schichttausch, Arbeitsplan).', 'Bei einer neuen App-Version steht oben <b>🚀 Neue Version</b>. Tippen zeigt, was neu ist. Danach verschwindet dieser Hinweis.', 'Sobald du das Fenster geöffnet hast, gelten die Mitteilungen als gelesen und das Blinken hört auf.'],
          en: ['Tap <b>🔔 new</b> under the date.', 'Unread entries are marked orange. Tap an entry to jump straight to the matching window (e.g. vacation, shift swap, schedule).', 'For a new app version, <b>🚀 New version</b> appears at the top. Tapping shows what is new. After that this hint disappears.', 'As soon as you have opened the window, the notifications count as read and the blinking stops.'] },
        points: {
          de: ['Mitteilungen bleiben 30 Tage sichtbar. Chat-Nachrichten gehören nicht dazu (die haben ihren eigenen Zähler).', 'Welche Arten von Mitteilungen du bekommst, stellst du unter Einstellungen → Hinweise ein (gilt für Push und Mitteilungen).'],
          en: ['Notifications stay visible for 30 days. Chat messages are not included (they have their own counter).', 'You choose which kinds of notifications you get under Settings → Notifications (applies to push and this list).'] } },

      { id: 'absence', kw: 'urlaub krank krankmeldung krankenstand abwesend frei beantragen dovolenka vacation holiday sick leave ill report request absent', grp: 'work', icon: '🏖️',
        t: { de: 'Urlaub & Krankmeldung', en: 'Vacation & Sick Report' },
        s: { de: 'Urlaub beantragen oder dich krank melden.', en: 'Request vacation or report sick.' },
        intro: { de: 'Hier beantragst du Urlaub oder meldest dich krank. Der Manager bekommt sofort eine Benachrichtigung. Urlaub entscheidet der Manager, eine Krankmeldung nimmt er zur Kenntnis. Danach trägt er <b>U</b> (Urlaub) bzw. <b>K</b> (Krank) in den Arbeitsplan ein.', en: 'Here you request vacation or report sick. Your manager is notified right away. The manager decides on vacation and acknowledges a sick report. Then they enter <b>U</b> (vacation) or <b>K</b> (sick) in the schedule.' },
        where: { de: 'Dashboard → Kachel „🏖️ Urlaub / Krank“.', en: 'Dashboard → tile “🏖️ Vacation / Sick”.' },
        steps: {
          de: ['Öffne die Kachel <b>🏖️ Urlaub / Krank</b>.', 'Für Urlaub: Reiter <b>🏖️ Urlaub</b>. Wähle <b>Von</b> und <b>Bis (einschließlich)</b>, schreibe wenn du willst eine Nachricht und tippe auf <b>Antrag senden</b>.', 'Für Krankheit: Reiter <b>🤒 Krank melden</b>. Wähle <b>Krank ab</b> und <b>Voraussichtlich bis</b> und tippe auf <b>Krank melden</b>. Bei kurzfristigem Ausfall ruf bitte zusätzlich kurz den Manager an.', 'Unter <b>👤 Meine</b> siehst du den Stand deiner Meldungen. Du bekommst eine Benachrichtigung, sobald der Manager entschieden hat.'],
          en: ['Open the tile <b>🏖️ Vacation / Sick</b>.', 'For vacation: tab <b>🏖️ Vacation</b>. Choose <b>From</b> and <b>Until (inclusive)</b>, add a message if you like and tap <b>Send request</b>.', 'If you are ill: tab <b>🤒 Report sick</b>. Choose <b>Sick from</b> and <b>Expected until</b> and tap <b>Report sick</b>. If you cannot make it at short notice, please also call your manager.', 'Under <b>👤 Mine</b> you see the status of your requests. You get a notification as soon as the manager has decided.'] },
        points: {
          de: ['<b>Urlaub</b> kann nur für heute oder die Zukunft beantragt werden. <b>Krank</b> kannst du bis zu 7 Tage rückwirkend melden.', 'Solange noch nicht entschieden wurde, kannst du eine Meldung mit <b>Zurückziehen</b> zurücknehmen.', 'Für denselben Zeitraum kann es nur eine offene Meldung geben.', 'Ob die Benachrichtigungen ankommen, stellst du unter Einstellungen → Hinweise ein.'],
          en: ['<b>Vacation</b> can only be requested for today or the future. You can report <b>sick</b> up to 7 days back.', 'As long as nothing has been decided, you can take a request back with <b>Withdraw</b>.', 'There can only be one open request for the same period.', 'You can choose which notifications you get under Settings → Notifications.'] } },

      { id: 'fault', kw: 'kaputt defekt reparatur störung wasser spülmaschine melden notfall dringend broken repair damage fault water dishwasher urgent emergency', grp: 'work', icon: '🛠️',
        t: { de: 'Störung melden (Defekte)', en: 'Report a Fault' },
        s: { de: 'Etwas ist kaputt? Direkt dem Manager melden, mit Foto.', en: 'Something broken? Report it straight to the manager, with a photo.' },
        intro: { de: 'Wenn ein Gerät oder etwas im Lokal kaputt ist (z. B. kein Wasser an der Bar, Spülmaschine defekt), meldest du es hier. Nur der Manager (und Developer) sieht die Meldungen.', en: 'If a device or something in the venue is broken (e.g. no water at the bar, dishwasher broken), report it here. Only the manager (and developer) sees the reports.' },
        where: { de: 'Dashboard → Kachel „🛠️ Störung melden“.', en: 'Dashboard → tile “🛠️ Report a Fault”.' },
        steps: {
          de: ['Tippe auf <b>➕ Störung melden</b>.', 'Wähle den <b>Bereich</b> (z. B. Bar) und dann <b>Was ist kaputt?</b> (z. B. Spüle / Wasserhahn). Bei „Sonstiges“ schreibst du selbst dazu, was es ist.', 'Beschreibe das Problem kurz, z. B. „Es kommt kein Wasser aus dem Hahn“.', 'Wähle die <b>Dringlichkeit</b>: <b>Normal</b>, <b>Dringend</b> oder <b>Notfall</b> (Gefahr oder der Betrieb geht nicht weiter, z. B. Wasser läuft aus).', 'Wenn möglich, mache ein <b>Foto</b>. Das ist freiwillig, hilft aber sehr. Tippe dann auf <b>Absenden</b>.'],
          en: ['Tap <b>➕ Report a fault</b>.', 'Choose the <b>area</b> (e.g. Bar) and then <b>What is broken?</b> (e.g. Sink / tap). For “Other” you write yourself what it is.', 'Describe the problem briefly, e.g. “No water comes out of the tap”.', 'Choose the <b>urgency</b>: <b>Normal</b>, <b>Urgent</b> or <b>Emergency</b> (danger, or business cannot continue, e.g. water is leaking).', 'If possible, take a <b>photo</b>. It is optional but helps a lot. Then tap <b>Send</b>.'] },
        points: { de: ['Unter der Kachel siehst du deine eigenen Meldungen und den Stand: <b>Neu</b>, <b>In Arbeit</b>, <b>Erledigt</b>. Der Manager kann eine Notiz dazuschreiben.', 'Das ist nicht für Fehler in der App. Dafür gibt es „Support & Tickets“ im Menü.'], en: ['Under the tile you see your own reports and their status: <b>New</b>, <b>In progress</b>, <b>Done</b>. The manager can add a note.', 'This is not for errors in the app. For those there is “Support & Tickets” in the menu.'] } },

      { id: 'found', kw: 'fundsachen verloren vergessen liegen gelassen geldbörse schlüssel handy gast lost found forgotten wallet keys phone guest', grp: 'work', icon: '🧳',
        t: { de: 'Fundsachen (Lost & Found)', en: 'Lost & Found' },
        s: { de: 'Was Gäste liegen gelassen haben, eintragen und finden.', en: 'Record and find what guests left behind.' },
        intro: { de: 'Hat ein Gast etwas vergessen, trägst du es hier ein. Meldet sich der Gast, findest du die Sache schnell wieder. Kontaktdaten von Gästen werden <b>nicht</b> gespeichert.', en: 'If a guest forgot something, record it here. If the guest comes back, you can find the item quickly. Guests’ contact details are <b>not</b> stored.' },
        where: { de: 'Dashboard → Kachel „🧳 Fundsachen“.', en: 'Dashboard → tile “🧳 Lost & Found”.' },
        steps: {
          de: ['Tippe auf <b>➕ Fund eintragen</b>.', 'Schreibe, <b>was</b> es ist (z. B. „Schwarze Geldbörse“), <b>wo</b> gefunden (z. B. Tisch 12) und <b>wann</b>. Die Zeit ist schon auf jetzt eingestellt.', 'Schreibe, <b>wo du es aufbewahrst</b> (z. B. „Schublade Bar“). Mache wenn möglich ein <b>Foto</b>.', 'Tippe auf <b>Speichern</b>.', 'Kommt der Gast: Suche die Sache oben im Suchfeld und tippe auf <b>✓ Zurückgegeben</b>. Wirft man sie weg: <b>Entsorgt</b>.'],
          en: ['Tap <b>➕ Record item</b>.', 'Write <b>what</b> it is (e.g. “Black wallet”), <b>where</b> it was found (e.g. table 12) and <b>when</b>. The time is already set to now.', 'Write <b>where you keep it</b> (e.g. “Bar drawer”). Take a <b>photo</b> if possible.', 'Tap <b>Save</b>.', 'When the guest comes: search for the item in the search box and tap <b>✓ Returned</b>. If it is thrown away: <b>Disposed</b>.'] },
        points: { de: ['Oben wählst du <b>Gelagert</b>, <b>Zurückgegeben</b>, <b>Entsorgt</b> oder <b>Alle</b>.', 'Bei jeder Sache steht, wie viele Tage sie schon liegt.', 'Es wird gespeichert, wer sie eingetragen und wer sie zurückgegeben hat.'], en: ['At the top choose <b>Stored</b>, <b>Returned</b>, <b>Disposed</b> or <b>All</b>.', 'Every item shows how many days it has been lying there.', 'It is saved who recorded it and who handed it back.'] } },

      { id: 'loss', kw: 'bruch glas gebrochen kaputt verschüttet abschreibung verlust broken glass spill write-off loss breakage', grp: 'work', icon: '🔨',
        t: { de: 'Bruch & Verluste melden', en: 'Report Breakage & Losses' },
        s: { de: 'Zerbrochene Gläser, Verschüttetes, Abschreibungen.', en: 'Broken glasses, spills, write-offs.' },
        intro: { de: 'Ist ein Glas zerbrochen oder eine Flasche ausgelaufen? Trage es hier kurz ein. Der Manager sieht so, was wie oft kaputtgeht, und kann besser bestellen.', en: 'Did a glass break or a bottle spill? Record it here briefly. This way the manager sees what breaks how often and can order better.' },
        where: { de: 'Dashboard → Kachel „🔨 Bruch melden“.', en: 'Dashboard → tile “🔨 Report Breakage”.' },
        steps: {
          de: ['Tippe auf <b>➕ Melden</b>.', 'Schreibe bei <b>Was?</b> den Artikel (z. B. „Weinglas“, oder wähle einen Vorschlag aus der Liste).', 'Trage die <b>Anzahl</b> und das <b>Datum</b> ein (heute ist voreingestellt).', 'Wähle den <b>Grund</b>: <b>🔨 Bruch</b>, <b>💧 Verschüttet</b>, <b>📉 Abschreibung</b> oder <b>📦 Sonstiges</b>. Eine Notiz ist freiwillig.', 'Tippe auf <b>Speichern</b>.'],
          en: ['Tap <b>➕ Report</b>.', 'Under <b>What?</b> write the item (e.g. “Wine glass”, or pick a suggestion from the list).', 'Enter the <b>quantity</b> and the <b>date</b> (today is preset).', 'Choose the <b>reason</b>: <b>🔨 Breakage</b>, <b>💧 Spilled</b>, <b>📉 Write-off</b> or <b>📦 Other</b>. A note is optional.', 'Tap <b>Save</b>.'] },
        points: { de: ['Du siehst nur deine eigenen Meldungen. Mit ‹ › wechselst du den Monat.', 'Preise werden hier nicht erfasst, nur die Menge.'], en: ['You only see your own reports. Use ‹ › to change the month.', 'Prices are not recorded here, only the quantity.'] } },

      { id: 'chat', kw: 'nachricht schreiben team foto emoji antworten erwähnung message write photo reply mention', grp: 'work', icon: '💬',
        t: { de: 'Team-Chat', en: 'Team Chat' },
        s: { de: 'Nachrichten an das ganze Team, Fotos, Antworten, Reaktionen.', en: 'Messages to the whole team, photos, replies, reactions.' },
        intro: { de: 'Der Team-Chat ist ein gemeinsamer Chat für alle Kollegen. Hier gibt es Infos, Fragen und kurze Absprachen. Jede Nachricht sehen alle.', en: 'The Team Chat is a shared chat for all colleagues. It is for info, questions and short arrangements. Everyone sees every message.' },
        where: { de: 'Oben der Umschlag <b>✉️</b>, Dashboard → Kachel „💬 Team-Chat“ oder Menü ☰ → „Team-Chat“.', en: 'The envelope <b>✉️</b> at the top, Dashboard → tile “💬 Team Chat” or Menu ☰ → “Team Chat”.' },
        steps: {
          de: ['Öffne den Chat. Die neuesten Nachrichten sind unten.', 'Schreibe unten ins Feld und tippe auf <b>Senden ➔</b>.', 'Mit <b>📷</b> schickst du ein Foto, mit <b>😊</b> ein Emoji.', 'Mit <b>@</b> und einem Namen erwähnst du jemanden. Die Person wird darauf aufmerksam gemacht.', 'Bei einer Nachricht kannst du <b>antworten</b>, mit einem Emoji <b>reagieren</b> oder <b>anheften</b>. Eigene Nachrichten kannst du <b>bearbeiten</b> und <b>löschen</b>.'],
          en: ['Open the chat. The newest messages are at the bottom.', 'Write in the box at the bottom and tap <b>Send ➔</b>.', 'With <b>📷</b> you send a photo, with <b>😊</b> an emoji.', 'With <b>@</b> and a name you mention someone. That person gets a notice.', 'On a message you can <b>reply</b>, <b>react</b> with an emoji or <b>pin</b> it. You can <b>edit</b> and <b>delete</b> your own messages.'] },
        points: { de: ['<b>B</b>, <b>I</b>, <b>S</b>, <b>&lt;/&gt;</b> über dem Feld formatieren Text (fett, kursiv, durchgestrichen, Code).', 'Mit 🔍 suchst du alte Nachrichten, mit 👥 siehst du, wer im Team ist und wer gerade online ist.', 'Eine <b>rote Zahl</b> bzw. ein Punkt am Umschlag zeigt ungelesene Nachrichten.', 'In den Einstellungen schaltest du Hinweis und Ton bei neuen Nachrichten ein oder aus.', 'Der Chat ist für das Team. Schreibe nichts, was nicht alle lesen sollen.'], en: ['<b>B</b>, <b>I</b>, <b>S</b>, <b>&lt;/&gt;</b> above the box format text (bold, italic, strikethrough, code).', 'With 🔍 you search old messages, with 👥 you see who is on the team and who is online.', 'A <b>red number</b> or a dot on the envelope shows unread messages.', 'In the settings you switch the notice and sound for new messages on or off.', 'The chat is for the team. Do not write anything that not everyone should read.'] } },

      { id: 'support', kw: 'ticket fehler problem frage wunsch anfrage support error bug question wish', grp: 'work', icon: '🛟',
        t: { de: 'Support & Tickets', en: 'Support & Tickets' },
        s: { de: 'Fehler in der App melden, Fragen und Wünsche.', en: 'Report app errors, questions and wishes.' },
        intro: { de: 'Wenn in der App etwas nicht funktioniert oder du eine Frage oder einen Wunsch hast, schreibst du ein Ticket.', en: 'If something in the app does not work, or you have a question or a wish, write a ticket.' },
        where: { de: 'Menü ☰ → „Support & Tickets“.', en: 'Menu ☰ → “Support & Tickets”.' },
        steps: { de: ['Öffne „Support & Tickets“.', 'Schreibe bei <b>Neue Anfrage</b>, was passiert ist oder was du dir wünschst. Je genauer, desto besser (wo, was hast du getippt, was war zu sehen).', 'Tippe auf <b>Absenden</b>.', 'Unten siehst du deine Anfragen und die Antworten. Erledigte sind mit ✓ markiert.'], en: ['Open “Support & Tickets”.', 'Under <b>New request</b> write what happened or what you wish for. The more precise the better (where, what you tapped, what you saw).', 'Tap <b>Send</b>.', 'Below you see your requests and the answers. Finished ones are marked ✓.'] },
        points: { de: ['Für kaputte Geräte im Lokal nimmst du stattdessen „Störung melden“.'], en: ['For broken devices in the venue use “Report a Fault” instead.'] } },

      { id: 'news', kw: 'neuigkeiten neu version news update changelog team-news special', grp: 'work', icon: '🚀',
        t: { de: 'Was ist neu?', en: 'What’s new?' },
        s: { de: 'Neuigkeiten der App und Team-News vom Manager.', en: 'App news and team news from the manager.' },
        intro: { de: 'Hier steht, was sich in der App geändert hat (Versionen) und was der Manager dem Team mitteilen will (Team-News, z. B. Specials). <b>Dieser Bereich ist nur auf Deutsch.</b>', en: 'Here you see what changed in the app (versions) and what the manager wants to tell the team (team news, e.g. specials). <b>This area is in German only.</b>' },
        where: { de: 'Dashboard → „🚀 Was ist neu?“ oder Menü ☰.', en: 'Dashboard → “🚀 What’s new?” or Menu ☰.' },
        points: { de: ['Reiter: <b>✨ Neu in dieser Version</b>, <b>📜 Alle Versionen</b>, <b>📣 Team-News</b>.', 'Filter: Neu, Verbessert, Behoben, Sicherheit. Mit „Alle aufklappen“ liest du alles.'], en: ['Tabs: <b>✨ New in this version</b>, <b>📜 All versions</b>, <b>📣 Team news</b>.', 'Filters: New, Improved, Fixed, Security. “Expand all” lets you read everything.'] } },

      { id: 'push', kw: 'benachrichtigung benachrichtigungen push meldung hinweis handy iphone android notification notifications alert chat plan tausch', grp: 'work', icon: '🔔',
        t: { de: 'Benachrichtigungen (Push)', en: 'Notifications (push)' },
        s: { de: 'Auch bei geschlossener App erfahren, was sich ändert.', en: 'Find out what changed, even when the app is closed.' },
        intro: { de: 'Mit Push-Benachrichtigungen bekommst du eine Meldung auf dein Handy, auch wenn die App gerade zu ist: neue Chat-Nachrichten, Änderungen an deinem Arbeitsplan, Anfragen zum Schichttausch und Neuigkeiten vom Manager.', en: 'With push notifications you get a message on your phone even when the app is closed: new chat messages, changes to your schedule, shift swap requests and news from the manager.' },
        where: { de: 'Dashboard → Karte „🔔 Nichts mehr verpassen“ oder Einstellungen → „🔔 Push-Benachrichtigungen“.', en: 'Dashboard → card “🔔 Never miss anything” or Settings → “🔔 Push notifications”.' },
        steps: {
          de: ['<b>Android:</b> Tippe auf <b>Aktivieren</b> und erlaube Benachrichtigungen.', '<b>iPhone / iPad:</b> Es geht nur mit der App auf dem Home-Bildschirm. Öffne die App in Safari, tippe auf <b>Teilen</b> → <b>Zum Home-Bildschirm</b>, öffne die App dann <b>von dort</b>, gehe zu Einstellungen → „Push-Benachrichtigungen“ und tippe auf <b>Aktivieren</b>.', 'Mit <b>Test senden</b> prüfst du, ob alles funktioniert. Die Meldung kommt nach wenigen Sekunden.', 'Unter „Worüber möchtest du informiert werden?“ schaltest du einzelne Arten ein oder aus: Chat, Erwähnungen (@), Arbeitsplan, Schichttausch, Team-News.', 'Tippst du auf eine Meldung, öffnet sich die App direkt beim passenden Fenster (z. B. im Chat).'],
          en: ['<b>Android:</b> Tap <b>Enable</b> and allow notifications.', '<b>iPhone / iPad:</b> This only works with the app on your home screen. Open the app in Safari, tap <b>Share</b> → <b>Add to Home Screen</b>, then open the app <b>from there</b>, go to Settings → “Push notifications” and tap <b>Enable</b>.', 'Use <b>Send a test</b> to check that everything works. The message arrives after a few seconds.', 'Under “What do you want to be notified about?” you switch single types on or off: chat, mentions (@), schedule, shift swaps, team news.', 'When you tap a notification, the app opens straight at the right window (e.g. the chat).'] },
        points: {
          de: ['Die Meldungen gehören zu <b>deinem Konto</b>. Wenn du dich abmeldest, bekommt das Gerät deine Meldungen nicht mehr. Teilst du ein Gerät, melde dich immer ab.', 'Mehrere neue Chat-Nachrichten werden zusammengefasst („3 neue Nachrichten“).', 'Änderungen am Arbeitsplan melden wir gebündelt, eine Minute nach der Änderung.', 'Bei „Nicht stören“, Fokus-Modus oder Energiesparen kann eine Meldung später kommen.', 'Wenn „blockiert“ steht: In den Einstellungen deines Handys oder Browsers Benachrichtigungen für diese App erlauben und die App neu laden.', 'Manager sehen zusätzlich: Tausch wartet auf Genehmigung, dringende Störungen, neue Tickets.'],
          en: ['Notifications belong to <b>your account</b>. When you log out, the device no longer receives your messages. If you share a device, always log out.', 'Several new chat messages are grouped (“3 new messages”).', 'Schedule changes are reported in a bundle, one minute after the change.', 'With “Do not disturb”, focus mode or battery saver a notification may arrive later.', 'If it says “blocked”: allow notifications for this app in your phone or browser settings and reload the app.', 'Managers also get: swap waiting for approval, urgent faults, new tickets.'] } },

      { id: 'tomi', kw: 'tomi ai ki assistent gemini frage fragen hilfe rezept allergen chat bot künstliche intelligenz assistant question help', grp: 'work', icon: '✨',
        t: { de: 'TomiAI: dein Assistent', en: 'TomiAI: your assistant' },
        s: { de: 'Fragen zu Rezepten, Allergenen, Speisekarte und der App stellen.', en: 'Ask about recipes, allergens, the food menu and the app.' },
        intro: { de: 'TomiAI ist ein Assistent mit künstlicher Intelligenz. Er kennt die Daten der App (Getränke, Speisekarte, Checklisten) und beantwortet deine Fragen in einfacher Sprache.', en: 'TomiAI is an assistant with artificial intelligence. It knows the data in the app (drinks, food menu, checklists) and answers your questions in plain language.' },
        where: { de: 'Der Knopf <b>✨ TomiAI</b> unten links, oder auf dem Dashboard die Kachel „✨ TomiAI“.', en: 'The <b>✨ TomiAI</b> button at the bottom left, or the tile “✨ TomiAI” on the dashboard.' },
        steps: {
          de: ['Tippe auf <b>✨ TomiAI</b>.', 'Schreibe deine Frage oder tippe auf einen Vorschlag, z. B. „Wie macht man einen Negroni?“ oder „Welche Drinks sind vegan?“.', 'Lies die Antwort. Du kannst direkt nachfragen („Und ohne Alkohol?“).', 'Du kannst auf Deutsch, Englisch oder Slowakisch schreiben. Tomi antwortet in deiner Sprache.'],
          en: ['Tap <b>✨ TomiAI</b>.', 'Write your question or tap a suggestion, e.g. “How do I make a Negroni?” or “Which drinks are vegan?”.', 'Read the answer. You can ask follow-up questions (“And without alcohol?”).', 'You can write in German, English or Slovak. Tomi answers in your language.'] },
        points: {
          de: ['<b>Bei Allergenen immer in der Küche nachfragen.</b> TomiAI kann Fehler machen und kennt nur, was in der App steht.', 'Weiß Tomi etwas nicht, sagt er es und schlägt vor, den Manager zu fragen. Er erfindet nichts.', 'Tomi kann nichts in der App ändern. Für Schichttausch nimmst du „Mein Arbeitsplan“.', 'Das Gespräch wird <b>nicht gespeichert</b>. Schließt du das Fenster, ist es weg.', 'Es gibt ein Tageslimit pro Person. Ist es erreicht, geht es morgen weiter.'],
          en: ['<b>For allergens always check with the kitchen.</b> TomiAI can make mistakes and only knows what is in the app.', 'If Tomi does not know something, it says so and suggests asking the manager. It does not make things up.', 'Tomi cannot change anything in the app. For shift swaps use “My Schedule”.', 'The conversation is <b>not saved</b>. When you close the window it is gone.', 'There is a daily limit per person. When it is reached, it continues tomorrow.'] } },

      // =================================================================== FAQ
      { id: 'faq-pin', grp: 'faq', icon: '❓', t: { de: 'Ich habe meinen PIN vergessen.', en: 'I forgot my PIN.' }, s: { de: '', en: '' },
        intro: { de: 'Frage einen Manager. Er kann in „Personal & PINs“ einen neuen PIN für dich festlegen. Danach kannst du ihn selbst im Profil ändern.', en: 'Ask a manager. They can set a new PIN for you in “Staff & PINs”. After that you can change it yourself in your profile.' } },
      { id: 'faq-name', grp: 'faq', icon: '❓', t: { de: 'Mein Name steht nicht in der Liste.', en: 'My name is not in the list.' }, s: { de: '', en: '' },
        intro: { de: 'Der Manager muss dich erst unter „Personal & PINs“ anlegen. Dann erscheint dein Name. Tippe vorher auf „Daten aktualisieren“ oder öffne die App neu.', en: 'The manager has to add you first under “Staff & PINs”. Then your name appears. Before that, tap “Refresh data” or reopen the app.' } },
      { id: 'faq-tile', grp: 'faq', icon: '❓', t: { de: 'Ich sehe eine Kachel nicht, die ein Kollege hat.', en: 'I don’t see a tile that a colleague has.' }, s: { de: '', en: '' },
        intro: { de: 'Manche Kacheln gibt es nur für Manager (z. B. Team & Arbeitsplan, Stunden & Lohn, Personal & PINs). Wenn du Rechte hast, kontrolliere in den Einstellungen, ob „Kellner“ statt „Verwaltung“ gewählt ist.', en: 'Some tiles are only for managers (e.g. Team Schedule, Hours & Payroll, Staff & PINs). If you have extra rights, check in the settings whether “Waiter” is selected instead of “Admin”.' } },
      { id: 'faq-hang', grp: 'faq', icon: '❓', t: { de: 'Die App hängt oder zeigt alte Daten.', en: 'The app is stuck or shows old data.' }, s: { de: '', en: '' },
        intro: { de: 'Menü ☰ → „Daten aktualisieren“. Hilft das nicht: Einstellungen → „🔄 Neu laden“. Als letztes die App ganz schließen und neu öffnen. Prüfe auch dein Internet.', en: 'Menu ☰ → “Refresh data”. If that does not help: Settings → “🔄 Reload”. As a last step close the app completely and reopen it. Also check your internet.' } },
      { id: 'faq-db', grp: 'faq', icon: '❓', t: { de: 'Es steht „Datenbank noch nicht eingerichtet“.', en: 'It says “Database not set up yet”.' }, s: { de: '', en: '' },
        intro: { de: 'Das ist kein Fehler von dir. Eine neue Funktion braucht noch eine Einrichtung durch den Manager oder Developer. Sag ihm Bescheid.', en: 'This is not your mistake. A new feature still needs to be set up by the manager or developer. Let them know.' } },
      { id: 'faq-lang', grp: 'faq', icon: '❓', t: { de: 'Wie ändere ich die Sprache?', en: 'How do I change the language?' }, s: { de: '', en: '' },
        intro: { de: 'Auf der Anmeldeseite oben rechts <b>DE | EN</b>, oder in der App: Menü ☰ → Einstellungen → „Sprache / Language“. Manche Bereiche (Manager-Fenster, A3-Karte, „Was ist neu?“) bleiben Deutsch.', en: 'On the login page at the top right <b>DE | EN</b>, or inside the app: Menu ☰ → Settings → “Language / Sprache”. Some areas (manager windows, A3 menu, “What’s new?”) stay in German.' } },
      { id: 'faq-undo', grp: 'faq', icon: '❓', t: { de: 'Ich habe aus Versehen etwas abgehakt oder gemeldet.', en: 'I ticked or reported something by mistake.' }, s: { de: '', en: '' },
        intro: { de: 'Checkliste: nochmal antippen. Tausch-Anfrage: „Zurückziehen“. Störung, Fund, Bruch: sag dem Manager Bescheid, er kann Einträge löschen.', en: 'Checklist: tap it again. Swap request: “Withdraw”. Fault, lost item, breakage: tell the manager, they can delete entries.' } },
      { id: 'faq-photo', grp: 'faq', icon: '❓', t: { de: 'Das Foto lässt sich nicht hochladen.', en: 'The photo won’t upload.' }, s: { de: '', en: '' },
        intro: { de: 'Prüfe das Internet und versuche es mit einem anderen Bild. Wähle ein normales Foto (JPG oder PNG). Warte, bis „Foto hochgeladen“ erscheint, bevor du auf Speichern oder Absenden tippst.', en: 'Check the internet and try another picture. Choose a normal photo (JPG or PNG). Wait until “Photo uploaded” appears before you tap Save or Send.' } },
      { id: 'faq-sound', grp: 'faq', icon: '❓', t: { de: 'Ich bekomme keinen Hinweis oder Ton im Chat.', en: 'I get no notice or sound in the chat.' }, s: { de: '', en: '' },
        intro: { de: 'Einstellungen → „🔔 Hinweise“: „Neue Chat-Nachricht“ und „Ton bei neuer Nachricht“ einschalten. Am Handy darf der Ton nicht auf lautlos stehen.', en: 'Settings → “🔔 Notifications”: switch on “New chat message” and “Sound for new messages”. On a phone, the device must not be on silent.' } },
      { id: 'faq-push', kw: 'iphone benachrichtigung keine meldung push notification ios', grp: 'faq', icon: '❓', t: { de: 'Ich bekomme auf dem iPhone keine Benachrichtigungen.', en: 'I get no notifications on my iPhone.' }, s: { de: '', en: '' },
        intro: { de: 'Auf dem iPhone funktionieren Benachrichtigungen nur, wenn die App auf dem Home-Bildschirm liegt (Safari → Teilen → Zum Home-Bildschirm) und du sie von dort öffnest. Dann in den Einstellungen der App „Push-Benachrichtigungen“ aktivieren. Nötig ist iOS 16.4 oder neuer. Prüfe auch „Nicht stören“ und die iPhone-Einstellungen → Mitteilungen.', en: 'On the iPhone notifications only work if the app is on your home screen (Safari → Share → Add to Home Screen) and you open it from there. Then enable “Push notifications” in the app settings. iOS 16.4 or newer is required. Also check “Do not disturb” and iPhone Settings → Notifications.' } },
      { id: 'faq-tomi', kw: 'tomi ai ki ausgelastet überlastet busy fehler nicht erreichbar limit', grp: 'faq', icon: '❓', t: { de: 'TomiAI sagt „stark ausgelastet“ oder „nicht erreichbar“.', en: 'TomiAI says “very busy” or “not reachable”.' }, s: { de: '', en: '' },
        intro: { de: 'Der KI-Dienst von Google ist manchmal kurz überlastet. TomiAI versucht es automatisch noch einmal und weicht auf ein anderes Modell aus. Hilft das nicht, warte eine Minute und frage erneut. Fehlgeschlagene Anfragen zählen nicht zum Tageslimit.', en: 'Google’s AI service is sometimes briefly overloaded. TomiAI automatically tries again and switches to another model. If that does not help, wait a minute and ask again. Failed requests do not count towards the daily limit.' } },
      { id: 'faq-offline', grp: 'faq', icon: '❓', t: { de: 'Funktioniert die App ohne Internet?', en: 'Does the app work without internet?' }, s: { de: '', en: '' },
        intro: { de: 'Nein, nicht richtig. Die Oberfläche öffnet sich, aber Daten wie Getränke, Plan und Chat werden aus dem Internet geladen und gespeichert. Ohne Verbindung geht das nicht.', en: 'Not properly. The interface opens, but data like drinks, schedule and chat are loaded from and saved to the internet. Without a connection that does not work.' } },

      // =================================================================== MANAGER (nur Deutsch)
      { id: 'm-roles', grp: 'mgr', mgr: true, icon: '🧑‍💼', t: { de: 'Rollen & Rechte', en: 'Roles & rights' }, s: { de: 'Kellner, Manager, Developer.', en: '' },
        intro: { de: 'Es gibt drei Rollen. <b>Kellner:</b> Rezepte ansehen, Chat, eigenes Profil, eigener Plan, Checklisten und Meldungen. <b>Manager:</b> zusätzlich Personal, Tickets, Login-Protokoll, Plan, Stunden und Getränke verwalten. <b>Developer:</b> wie Manager, zusätzlich Tickets löschen.', en: '' },
        points: { de: ['Einzelne Mitarbeiter können das Recht „Getränke bearbeiten“ bekommen (Neue Getränke, Saisons, Import). Das stellst du in „Personal & PINs“ ein.', 'Ob du die Verwaltungs-Knöpfe siehst, bestimmt die Einstellung <b>Einstellungen → Ansichtsmodus (Kellner / Verwaltung)</b>.', 'Den Arbeitsplan (auch Excel-Import) dürfen nur Manager und Developer ändern.'], en: [] } },

      { id: 'm-drinks', grp: 'mgr', mgr: true, icon: '🍸', t: { de: 'Getränke anlegen & bearbeiten', en: '' }, s: { de: 'Das Formular in 7 Schritten.', en: '' },
        intro: { de: 'Neues Getränk: Menü ☰ → „➕ Neues Getränk hinzufügen“ (oder der ➕-Knopf in der Datenbank). Bestehendes bearbeiten: im Rezept „✏️ Bearbeiten“. Pflichtfelder sind nur <b>Name</b> und <b>Kategorie</b>.', en: '' },
        steps: { de: ['<b>1 · Grunddaten:</b> Name, Kategorie (neue Kategorien entstehen automatisch), Saison / Zeitraum.', '<b>2 · Zubereitung:</b> Glas / Equipment, Eis (Cubed, Crushed, Ice Ball, None), Methode, Garnitur.', '<b>3 · Zutaten & Mengen:</b> mit „+ Zutat hinzufügen“ Zeile für Zeile.', '<b>4 · Schritt für Schritt</b> (optional).', '<b>5 · Eigenschaften & Allergene:</b> Bestseller / TOP, Vegan, Glutenfrei, Laktosefrei und häufige Allergene (Sulfite, Gluten, Laktose, Ei, Nüsse, Soja). Diese Texte nutzt auch der Allergen-Filter.', '<b>6 · Preis & Wareneinsatz:</b> bei beiden Preisen siehst du die Marge.', '<b>7 · Fotos:</b> bis zu 3. Das erste ist das Hauptfoto, mit ⭐ machst du ein anderes dazu.', 'Tippe auf <b>💾 Getränk speichern</b>.'], en: [] },
        points: { de: ['Löschen: im Rezept „🗑️ Löschen“. Das lässt sich nicht rückgängig machen.'], en: [] } },

      { id: 'm-seasons', grp: 'mgr', mgr: true, icon: '📅', t: { de: 'Saisons verwalten', en: '' }, s: { de: 'Neue Karte anlegen, wechseln, umbenennen.', en: '' },
        intro: { de: 'Eine Saison ist eine Getränkekarte (z. B. „Winter 2026“). Die aktive Saison sehen alle.', en: '' },
        steps: { de: ['Dashboard → „📅 Saison wählen“ (oder Menü ☰).', 'Tippe auf eine Saison, um sie zu aktivieren.', '„➕ Neue Saison“ legt eine neue Karte an. Umbenennen und Löschen findest du bei jeder Saison.'], en: [] },
        points: { de: ['Löschen einer Saison löscht auch die Getränke darin. Sichere vorher per Export (Excel).'], en: [] } },

      { id: 'm-import', grp: 'mgr', mgr: true, icon: '📊', t: { de: 'Import & Export', en: '' }, s: { de: 'Getränke und Arbeitsplan per Excel.', en: '' },
        intro: { de: 'Dashboard → „📊 Import & Export“. Zwei Reiter: Getränke und Arbeitsplan.', en: '' },
        steps: { de: ['<b>Getränke exportieren:</b> Saison wählen, dann Excel (.xlsx) oder CSV.', '<b>Getränke importieren:</b> Excel-Datei wählen, Ziel-Saison wählen, „Getränke-Import starten“.', '<b>Arbeitsplan importieren (DPL):</b> Excel-Datei des Monats wählen, Monat und Jahr einstellen, „Arbeitsplan importieren & speichern“. Zweizeilige Schichten und Teilschichten erkennt das Programm selbst.'], en: [] },
        points: { de: ['Der Import eines Monats ersetzt den bisherigen Plan dieses Monats.', 'Nach dem Import siehst du das Ergebnis sofort in „Team & Arbeitsplan“.'], en: [] } },

      { id: 'm-print', grp: 'mgr', mgr: true, icon: '🖨️', t: { de: 'Karten-Druck (A3)', en: '' }, s: { de: 'Bis zu 3 Getränke als A3-Karte.', en: '' },
        intro: { de: 'Dashboard → „🖨️ Karte drucken / PDF“.', en: '' },
        steps: { de: ['Saison wählen.', 'Druck-Optionen: „Mit Bild drucken“ und „Mit Preis drucken“.', 'Maximal <b>3 Getränke</b> auswählen (der Zähler zeigt „x / 3“).', 'Auf „🖨️ A3 Vorschau & Drucken“ tippen und im Druckdialog drucken oder als PDF speichern.'], en: [] } },

      { id: 'm-teamplan', grp: 'mgr', mgr: true, icon: '📆', t: { de: 'Team & Arbeitsplan', en: '' }, s: { de: 'Monatsraster, Stunden, Schichten planen.', en: '' },
        intro: { de: 'Das ganze Team in einem Monatsraster: Zeilen sind Mitarbeiter, Spalten die Tage. Rechts stehen die Stunden pro Person, unten die Besetzung pro Tag.', en: '' },
        steps: { de: ['Dashboard → „📆 Team & Arbeitsplan“. Mit ‹ › wechselst du den Monat, „Heute“ springt zurück.', 'Tippe auf ein <b>Feld</b>, um die Schicht zu ändern: Beginn / Ende, zweite Schicht (geteilter Dienst), Station oder Schnellwahl <b>Frei (X)</b>, <b>Urlaub (U)</b>, <b>Krank (K)</b>. „Leeren“ entfernt den Eintrag.', 'Mitarbeiter ohne Schicht nimmst du mit „➕ Mitarbeiter aufnehmen“ ins Raster.', '„📗 Excel“ exportiert den Monat, „📥 Plan importieren“ öffnet den Import.'], en: [] },
        points: { de: ['Grün = Schicht, grau = Frei, blau = Urlaub / Krank. Wochenenden sind orange beschriftet, der heutige Tag ist hervorgehoben.', 'Die Stunden hier sind die geplante Zeit ohne Pausen. Für die Lohnverrechnung nimmst du „Stunden & Lohn“.'], en: [] } },

      { id: 'm-swapapprove', grp: 'mgr', mgr: true, icon: '🔄', t: { de: 'Schichttausch genehmigen', en: '' }, s: { de: 'Anfragen prüfen und entscheiden.', en: '' },
        intro: { de: 'Wenn ein Kollege eine Schicht übernommen hat, wartet die Anfrage auf dich. Die rote Zahl auf der Kachel „🔄 Schichttausch“ zeigt, wie viele es sind.', en: '' },
        steps: { de: ['Öffne die Kachel. Der Reiter <b>✅ Genehmigen</b> zeigt alle Anfragen, die auf dich warten.', 'Tippe auf <b>✓ Genehmigen</b> oder <b>✗ Ablehnen</b> und schreibe wenn gewünscht eine Nachricht.', 'Bei Genehmigung wechselt die Schicht im Arbeitsplan automatisch zum übernehmenden Kollegen. Die App prüft vorher, ob er an dem Tag wirklich frei ist.'], en: [] },
        points: { de: ['Im Reiter <b>📜 Verlauf</b> siehst du erledigte Anfragen. Du kannst einzelne Einträge oder den gesamten Verlauf löschen (offene Anfragen bleiben).', 'Nur Manager und Developer ändern den Plan. Kellner können das nicht.'], en: [] } },

      { id: 'm-absence', grp: 'mgr', mgr: true, icon: '🏖️', t: { de: 'Urlaub & Krankmeldungen', en: '' }, s: { de: 'Anträge entscheiden, U/K in den Plan eintragen.', en: '' },
        intro: { de: 'Urlaubsanträge und Krankmeldungen deines Teams landen in der Kachel „🏖️ Urlaub / Krank“. Die rote Zahl zeigt, wie viele auf dich warten. Du bekommst dazu auch eine Benachrichtigung (abschaltbar unter Einstellungen → Hinweise).', en: '' },
        steps: { de: ['Öffne die Kachel. Der Reiter <b>✅ Offen</b> zeigt alles, was auf dich wartet.', 'Urlaub: <b>✓ Genehmigen</b> oder <b>✗ Ablehnen</b> (mit optionaler Nachricht). Krankmeldung: <b>👍 Zur Kenntnis nehmen</b>.', 'Danach fragt die App, ob <b>U</b> bzw. <b>K</b> für alle Tage des Zeitraums in den Arbeitsplan eingetragen werden soll. Vorher zeigt sie, wie viele Tage schon eine Schicht haben, die dabei ersetzt wird.', 'Hast du das übersprungen, findest du den Eintrag weiter unter <b>Offen</b> mit dem Knopf <b>📆 In Arbeitsplan eintragen</b>.'], en: [] },
        points: { de: ['Im Reiter <b>📜 Alle</b> siehst du jede Meldung des Teams und kannst erledigte Einträge löschen.', 'Eine Krankmeldung wird nur zur Kenntnis genommen, sie kann nicht abgelehnt werden.', 'Nur Manager und Developer sehen alle Meldungen. Kellner sehen nur ihre eigenen.'], en: [] } },

      { id: 'm-specials', grp: 'mgr', mgr: true, icon: '📷', t: { de: 'Tagesangebot pflegen & Zettel scannen', en: '' }, s: { de: 'Kuchen und Suppe eintragen, per Foto einlesen.', en: '' },
        intro: { de: 'Du trägst Tageskuchen und Tagessuppe mit Allergenen ein. Statt zu tippen kannst du den <b>Zettel fotografieren</b>: Die KI liest Namen, Preis und Allergen-Buchstaben, du prüfst das Ergebnis und speicherst es.', en: '' },
        steps: { de: ['Öffne die Kachel <b>🍰 Tagesangebot</b> und tippe unten auf <b>📷 Foto scannen</b>.', 'Wähle <b>Foto aufnehmen</b> (Kamera) oder <b>Aus Galerie / Datei wählen</b>. Fotografiere die ganze Liste samt Allergen-Buchstaben, gerade und bei gutem Licht.', 'Warte kurz (5–15 Sekunden). Danach siehst du das <b>Foto</b> und darunter die erkannten Einträge. Gelb markierte waren schwer lesbar.', 'Prüfe <b>Namen, Preise und vor allem die Allergene</b> und korrigiere, was nicht stimmt. Stelle bei Bedarf „Gültig von/bis“ ein.', 'Setze das Häkchen „Ich habe Namen und Allergene mit dem Original verglichen“ und tippe auf <b>💾 Speichern</b>.', 'Von Hand eintragen geht mit <b>➕ Neu</b>. Mit <b>✏️ Bearbeiten</b> und <b>🗑 Löschen</b> änderst du bestehende Einträge.'], en: [] },
        points: { de: ['Das Foto wird nur zum Lesen an die KI geschickt und <b>nicht gespeichert</b>.', 'Die KI kann sich bei Handschrift oder kleiner Schrift irren. Gespeichert wird deshalb nie ohne deine Bestätigung. Für die Richtigkeit der Allergene bist du verantwortlich.', 'Erkennt die KI keine Allergen-Buchstaben, trägst du sie selbst ein. Sie werden nie aus dem Namen des Gerichts geraten.', 'Das Scannen zählt zum Tageslimit der KI-Anfragen (zusammen mit TomiAI).'], en: [] } },

      { id: 'm-exclusive', grp: 'mgr', mgr: true, icon: '🍽️', t: { de: 'Exklusiv-Schicht (Tischtabelle)', en: '' }, s: { de: 'Tische, Gäste und Gerichte; Summen, Drucken, Excel.', en: '' },
        intro: { de: 'Für exklusive Schichten führst du eine Tabelle mit <b>Soll</b> (so viele Gäste sollen am Tisch sitzen), <b>Ist</b> (so viele sind gekommen), <b>Tisch-Nr.</b> und den <b>Gerichten</b>. Unten stehen automatisch die Summen. Nur Manager und Developer sehen und bearbeiten das.', en: '' },
        where: { de: 'Dashboard → Kachel „🍽️ Exklusiv-Schicht“ (Bereich Bar).', en: '' },
        steps: { de: ['Tippe auf <b>➕ Neue Schicht</b>. Gib Name und Datum an und wähle die Tische (alle Standardtische sind vorgewählt, du kannst einzelne abwählen oder eigene Nummern ergänzen). Mit „Gerichte und Tische der letzten Schicht übernehmen“ startest du schnell.', 'Trage <b>Soll</b> und <b>Ist</b> sowie die Anzahl je Gericht in die Zellen ein. Soll und Ist beginnen leer. <b>Enter</b> springt eine Zeile tiefer. Alles wird sofort gespeichert, die Summen unten rechnen mit.', 'Der Name eines Gerichts (Tag, Fisch, Rav ...) lässt sich direkt in der <b>grünen Kopfzeile</b> ändern. Über <b>🍽️ Gerichte</b> fügst du Spalten hinzu, löschst sie, ordnest sie um und wählst „Anzahl“ oder „Notiz“ (freier Text, z. B. Medium Well, wird nicht gezählt).', '<b>➕ Tisch hinzufügen</b> legt eine neue Zeile mit der nächsten Tisch-Nummer an. Mit 🗑 löschst du einen Tisch.', '<b>🖨️ Drucken</b> (A4 oder A3 quer) und <b>📊 Excel</b> erstellen die Tabelle im Aussehen der Vorlage mit Summen unten.', 'Über <b>⋯</b> änderst du Name/Datum, schließt die Schicht ab (dann nur lesen) oder löschst sie.'], en: [] },
        points: { de: ['Summen: Soll, Ist und jedes Gericht. Notizen und Tisch-Nummern werden nicht gezählt.', 'Barmitarbeiter und Kellner sehen diese Kachel nicht.', 'Eine abgeschlossene Schicht lässt sich über „⋯“ wieder öffnen.'], en: [] } },

      { id: 'm-payroll', grp: 'mgr', mgr: true, icon: '💶', t: { de: 'Stunden & Lohn', en: '' }, s: { de: 'Monatsstunden für die Lohnverrechnung.', en: '' },
        intro: { de: 'Rechnung pro Person: <b>Gesamt = geplante Zeit − Pause + Korrektur</b>. Zuschläge (Sonntag, Feiertag, Nacht) werden nicht gerechnet.', en: '' },
        steps: { de: ['Dashboard → „💶 Stunden & Lohn“. Wähle den Monat mit ‹ ›.', 'Die Tabelle zeigt pro Mitarbeiter Schichten, geplante Stunden, Pause, Korrektur und Gesamt.', 'Tippe auf einen Mitarbeiter. Pro Tag kannst du <b>Pause</b> (Minuten), <b>Korrektur</b> (Minuten, plus oder minus) und eine Notiz eintragen und mit 💾 speichern.', '„📗 Excel für die Lohnverrechnung“ erstellt eine Datei mit Zusammenfassung und Details pro Tag.'], en: [] },
        points: { de: ['Die Pause tragen die Mitarbeiter meist selbst unter „Mein Arbeitsplan“ ein. Du kannst sie hier ändern.', 'Korrektur-Beispiele: +30 = eine halbe Stunde länger gearbeitet, −15 = früher gegangen.', 'Stunden werden mit bis zu zwei Nachkommastellen angezeigt (z. B. 4,75).'], en: [] } },

      { id: 'm-staff', grp: 'mgr', mgr: true, icon: '👤', t: { de: 'Personal & PINs', en: '' }, s: { de: 'Mitarbeiter anlegen, Rollen, Rechte, PIN.', en: '' },
        intro: { de: 'Dashboard → „👤 Personal & PINs“. Du siehst alle Mitarbeiter mit Filter (Alle, Kellner, Manager, Developer).', en: '' },
        steps: { de: ['<b>➕ Neuer Mitarbeiter:</b> Name, optional Profilbild, <b>Rolle</b> (Kellner / Manager / Developer), <b>PIN</b> (4 bis 6 Ziffern, „🎲 Vorschlag“ erzeugt einen) und <b>Rechte</b>.', 'Zum Bearbeiten tippst du auf einen Mitarbeiter in der Liste. Hier kannst du auch einen vergessenen PIN neu setzen.', 'Mit „📜 Login-Protokoll“ siehst du, wer sich wann angemeldet hat.'], en: [] },
        points: { de: ['Vergib jedem Mitarbeiter einen eigenen PIN. Der Name in der Personalliste sollte zum Namen im Arbeitsplan passen, sonst findet „Mein Arbeitsplan“ die Schichten nicht.'], en: [] } },

      { id: 'm-login', grp: 'mgr', mgr: true, icon: '🔐', t: { de: 'Login-Protokoll', en: '' }, s: { de: 'Wer war wann wo angemeldet und was wurde gemacht.', en: '' },
        intro: { de: 'Das Login-Protokoll zeigt, wer sich wann angemeldet hat, mit welchem Gerät, wie lange die Person in der App war, welche Bereiche sie geöffnet hat und welche wichtigen Aktionen sie ausgeführt hat. Es hilft bei der Sicherheit und wenn du später nachvollziehen willst, wer etwas geändert hat.', en: '' },
        where: { de: 'Dashboard → „🔐 Login-Protokoll“ (oder Personal & PINs → „📜 Login-Protokoll“).', en: '' },
        steps: { de: ['<b>🟢 Live:</b> Wer ist gerade online und in welchem Bereich? Online heißt: in den letzten 3 Minuten gesehen. Die Liste aktualisiert sich alle 20 Sekunden.', '<b>🕒 Sitzungen:</b> Jede Anmeldung mit Gerät, Beginn, Ende und Dauer. „Abgemeldet“ = ausdrücklich abgemeldet, „Keine Aktivität mehr“ = die App wurde einfach verlassen (Ende = zuletzt gesehen).', '<b>📋 Aktivität:</b> Zeitliche Liste der geöffneten Bereiche und wichtigen Aktionen (Aufgabe abgehakt, Tausch angefragt/entschieden, Störung gemeldet, Bruch gemeldet, Fundsache, Arbeitsplan geändert, Getränk angelegt/geändert/gelöscht, im Chat geschrieben, Ticket). Filter nach Person und Art.', '<b>📊 Statistik:</b> Pro Person: Anzahl Sitzungen, Zeit in der App, Ø Sitzung, Aktionen, meistgenutzte Bereiche.', 'Oben wählst du den Zeitraum (Heute, 7, 30, 90 Tage). Mit <b>📗 Excel</b> exportierst du die gerade angezeigte Liste.'], en: [] },
        points: { de: ['<b>Datenschutz:</b> Es werden keine IP-Adressen gespeichert, und Chat-Texte werden nie protokolliert (nur „hat geschrieben“). Alles wird nach <b>90 Tagen automatisch gelöscht</b>. Informiere dein Team, dass es dieses Protokoll gibt (in den Einstellungen → Konto steht ein Hinweis für alle).', 'Mit <b>🗑️ Protokoll leeren</b> löschst du das gesamte Protokoll sofort. Das kann nicht rückgängig gemacht werden.', 'Schließt jemand die App einfach, wird die Abmeldung nicht gemeldet. Du siehst dann „Keine Aktivität mehr“ mit der Zeit der letzten Aktivität.', 'Der Online-Status im Chat und in der Personalliste nutzt dieselbe 3-Minuten-Regel.'], en: [] } },

      { id: 'm-checklists', grp: 'mgr', mgr: true, icon: '✅', t: { de: 'Checklisten verwalten', en: '' }, s: { de: 'Aufgaben anlegen und ordnen, Tage prüfen.', en: '' },
        intro: { de: 'Dashboard → „✅ Checklisten & Standards“. Du siehst die Liste wie das Team und kannst zusätzlich jedes Datum aufrufen, um zu prüfen, wer was wann erledigt hat.', en: '' },
        steps: { de: ['Tippe auf <b>⚙️ Aufgaben verwalten</b>.', '<b>➕ Neue Aufgabe:</b> Text, <b>Bereich</b> (Bar, Service, Terrasse) und <b>Zeitpunkt</b> (Öffnung, Laufend, Schließung).', 'Mit <b>↑ ↓</b> änderst du die Reihenfolge, mit <b>✎</b> bearbeitest du, mit <b>⏸</b> blendest du eine Aufgabe aus, mit <b>🗑</b> löschst du sie.', 'Am Anfang kannst du „📋 Beispielaufgaben einfügen“ und diese anpassen.'], en: [] },
        points: { de: ['Besser <b>⏸ ausblenden</b> als löschen: Beim Löschen verschwindet auch die Historie dieser Aufgabe.', 'Du kannst jedes erledigte Häkchen zurücknehmen.'], en: [] } },

      { id: 'm-menu', grp: 'mgr', mgr: true, icon: '🍽️', t: { de: 'Speisekarte verwalten', en: '' }, s: { de: 'Gerichte mit Allergenen pro Saison.', en: '' },
        intro: { de: 'Dashboard → „🍽️ Speisekarte & Allergene“ → unten „✏️ Karte bearbeiten“.', en: '' },
        steps: { de: ['<b>➕ Neue Karte</b> anlegen (z. B. „Winter 2026“). Mit „Für Personal ausblenden“ siehst nur du sie, bis sie fertig ist.', '<b>➕ Gericht:</b> Name, Kategorie, optional Preis und Beschreibung, und die <b>Allergen-Buchstaben A–R</b>.', 'Viele Gerichte auf einmal: <b>📋 Aus Excel einfügen</b>. Pro Zeile: <code>Kategorie ; Name ; Preis ; Allergene ; Beschreibung</code>. Allergene als Buchstaben (A,G,O oder AGO). Aus Excel kopierte Zeilen funktionieren direkt.', 'Mit „⏸ Nicht verfügbar“ markierst du ein Gericht vorübergehend grau.'], en: [] } },

      { id: 'm-faults', grp: 'mgr', mgr: true, icon: '🛠️', t: { de: 'Störungen bearbeiten', en: '' }, s: { de: 'Meldungen ansehen und abschließen.', en: '' },
        intro: { de: 'Dashboard → „🛠️ Störungen“. Die rote Zahl zeigt neue Meldungen. Notfall und Dringend sind farbig markiert.', en: '' },
        steps: { de: ['Reiter <b>Offen</b> zeigt alles Unerledigte, <b>Alle</b> auch Erledigtes.', 'Setze den Stand mit <b>In Arbeit</b> oder <b>✓ Erledigt</b>. Wer erledigt hat und wann, wird gespeichert.', '„📝 Notiz“ schreibt etwas dazu (z. B. „Techniker kommt Montag“). Der Melder sieht die Notiz.'], en: [] },
        points: { de: ['Die Liste der Bereiche und Geräte steht in der Datei <code>js/reports.js</code> (MAINT_LOCATIONS) und kann erweitert werden.'], en: [] } },

      { id: 'm-losses', grp: 'mgr', mgr: true, icon: '🔨', t: { de: 'Verluste & Bruch auswerten', en: '' }, s: { de: 'Monatsübersicht und Excel.', en: '' },
        intro: { de: 'Dashboard → „🔨 Verluste & Bruch“. Du siehst alle Meldungen des Teams pro Monat, die Summe pro Grund und die am häufigsten betroffenen Artikel. „📗 Excel“ exportiert den Monat, mit 🗑 löschst du Einträge.', en: '' } },

      { id: 'm-tomi', grp: 'mgr', mgr: true, icon: '✨', t: { de: 'TomiAI im Manager-Modus', en: '' }, s: { de: 'Plan, Stunden, Tausch und Tickets mit KI-Hilfe.', en: '' },
        intro: { de: 'Als Manager/Developer kann TomiAI mehr als für Kellner: Er kennt den ganzen Arbeitsplan (aktueller und nächster Monat), die Tausch-Anfragen, offene Tickets und Störungen. <b>Er ändert nie selbst etwas.</b> Änderungen schlägt er nur vor, du bestätigst sie mit einem Knopf.', en: '' },
        steps: { de: ['Frage z. B. „Wer ist am Freitag frei?“, „Fasse die Stunden diesen Monat zusammen“, „Wer könnte die Schicht von Anna am Samstag übernehmen?“ oder „Welche Tickets sind offen? Schlage Antworten vor.“', 'Bei Änderungen am Plan oder bei Tauschanfragen erscheinen unter der Antwort <b>Vorschläge</b> („Vorschlag (noch nicht ausgeführt)“).', 'Prüfe den Vorschlag und tippe auf <b>✅ Bestätigen</b>. Erst dann wird der Arbeitsplan geändert bzw. der Tausch entschieden. Mit <b>✖ Verwerfen</b> passiert nichts.'], en: [] },
        points: { de: ['Vorschläge: Schicht setzen, Frei/Urlaub/Krank eintragen, Eintrag löschen, Tausch genehmigen oder ablehnen.', 'Die Rechte kommen vom Server: nur Manager und Developer sehen Vorschläge. Kellner bekommen nur Auskünfte.', 'Antworten auf Tickets und Texte für Team-News schreibt Tomi als Entwurf; du kopierst sie selbst.', 'Prüfe Namen und Zeiten, bevor du bestätigst. TomiAI kann sich irren.', 'Tageslimit: 200 Anfragen pro Manager.'], en: [] } },

      { id: 'm-support', grp: 'mgr', mgr: true, icon: '🛟', t: { de: 'Support-Tickets & Team-News', en: '' }, s: { de: 'Anfragen beantworten, News veröffentlichen.', en: '' },
        intro: { de: 'Unter „🛟 Support & Tickets“ siehst du alle Anfragen des Teams, kannst sie als erledigt markieren und kommentieren. In „🚀 Was ist neu?“ kannst du unter „📣 Team-News“ Mitteilungen und Specials an alle veröffentlichen.', en: '' } }
    ];

    // ---------------------------------------------------------------
    let hp = { m: null, tab: 'all', q: '', open: {} };

    function hpTxt(o) { return o ? (o[currentLang] !== undefined && o[currentLang] !== '' ? o[currentLang] : o.de) : ''; }
    function hpList(o) { return o ? ((o[currentLang] && o[currentLang].length) ? o[currentLang] : (o.de || [])) : []; }
    const hpFlat = s => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').toLowerCase();
    // gibt es diese Seite überhaupt auf Englisch? (Manager-Kapitel nur Deutsch)
    const hpIsDeOnly = ch => !!ch.mgr && currentLang === 'en';

    function hpVisibleChapters() {
      return HELP_CHAPTERS.filter(ch => !ch.mgr || userIsAdmin);
    }

    function hpHaystack(ch) {
      return hpFlat([ch.kw || '', hpTxt(ch.t), hpTxt(ch.s), hpTxt(ch.intro), hpTxt(ch.where), hpList(ch.steps).join(' '), hpList(ch.points).join(' '), hpTxt(ch.tip)].join(' '));
    }

    function openHelpModal(chapterId) {
      closeSettingsMenu();
      hp.tab = 'all'; hp.q = ''; hp.open = {};
      if (chapterId) { hp.open[chapterId] = true; }
      hp.m = fmOpen('hpModal', { title: hpu('title'), sub: hpu('sub') });
      hpRenderAll(true);
      if (chapterId) setTimeout(() => { const el = document.getElementById('hp-' + chapterId); if (el) el.scrollIntoView({ block: 'start' }); }, 80);
    }

    function hpRenderAll(full) {
      if (!hp.m || !document.getElementById('hpModal')) return;
      if (full) {
        const tabs = [['all', 'tabAll'], ['start', 'tabStart'], ['work', 'tabWork'], ['faq', 'tabFaq']];
        if (userIsAdmin) tabs.push(['mgr', 'tabMgr']);
        hp.m.setToolbar(`
          <input type="search" id="hpSearch" class="ui-search" placeholder="${escapeHtml(hpu('search'))}" value="${escapeHtml(hp.q)}" oninput="hpOnSearch(this.value)">
          <div class="fm-tabs" style="margin-top:.5rem">${tabs.map(tb => `<button type="button" class="fm-tab${hp.tab === tb[0] ? ' active' : ''}" onclick="hpSetTab('${tb[0]}')">${escapeHtml(hpu(tb[1]))}</button>`).join('')}</div>`);
      }
      hp.m.setBody(hpBodyHtml());
      hp.m.setFoot(`<button type="button" class="ui-btn-primary" onclick="fmClose('hpModal')">${escapeHtml(hpu('close'))}</button>`);
    }

    function hpBodyHtml() {
      const q = hp.q.trim().toLowerCase();
      let list = hpVisibleChapters().filter(ch => hp.tab === 'all' || ch.grp === hp.tab);
      if (q) list = list.filter(ch => hpHaystack(ch).indexOf(q) !== -1);
      if (!list.length) return `<p class="staff-empty">${escapeHtml(hpu('none'))}</p>`;
      const groups = [['start', 'gStart'], ['work', 'gWork'], ['faq', 'gFaq'], ['mgr', 'gMgr']];
      return groups.map(g => {
        const items = list.filter(ch => ch.grp === g[0]);
        if (!items.length) return '';
        return `<div class="hp-group">${escapeHtml(hpu(g[1]))}</div>` + items.map(ch => hpChapterHtml(ch, !!q)).join('');
      }).join('');
    }

    function hpChapterHtml(ch, forceOpen) {
      const open = forceOpen || hp.open[ch.id];
      const steps = hpList(ch.steps), points = hpList(ch.points);
      let body = '';
      if (hpIsDeOnly(ch)) body += `<p class="fm-hint">${escapeHtml(hpu('deOnly'))}</p>`;
      if (ch.intro) body += `<p>${hpTxt(ch.intro)}</p>`;
      if (ch.where) body += `<h5>${escapeHtml(hpu('where'))}</h5><p>${hpTxt(ch.where)}</p>`;
      if (steps.length) body += `<h5>${escapeHtml(hpu('steps'))}</h5><ol>${steps.map(x => `<li>${x}</li>`).join('')}</ol>`;
      if (points.length) body += `<h5>${escapeHtml(hpu('points'))}</h5><ul>${points.map(x => `<li>${x}</li>`).join('')}</ul>`;
      if (ch.tip) body += `<div class="hp-tip">💡 <b>${escapeHtml(hpu('tipLabel'))}:</b> ${hpTxt(ch.tip)}</div>`;
      const isFaq = ch.grp === 'faq';
      return `<div class="hp-chapter${open ? ' open' : ''}" id="hp-${ch.id}">
        <button type="button" class="hp-head" onclick="hpToggle('${ch.id}')">
          <span class="hp-ico">${ch.icon}</span>
          <span class="fm-grow"><span class="hp-title${isFaq ? ' hp-faq-q' : ''}">${escapeHtml(hpTxt(ch.t))}${ch.mgr ? '<span class="hp-mgr">Manager</span>' : ''}</span>${hpTxt(ch.s) ? `<span class="hp-sum" style="display:block">${escapeHtml(hpTxt(ch.s))}</span>` : ''}</span>
          <span class="hp-chev">›</span>
        </button>
        <div class="hp-content">${body}</div>
      </div>`;
    }

    function hpToggle(id) {
      hp.open[id] = !hp.open[id];
      const el = document.getElementById('hp-' + id);
      if (el) el.classList.toggle('open', !!hp.open[id]);
    }
    function hpSetTab(tab) { hp.tab = tab; hpRenderAll(true); }
    function hpOnSearch(v) { hp.q = v; hpRenderAll(false); }

    // Sprache wurde gewechselt, während die Hilfe offen ist
    function helpOnLanguageChange() {
      if (!document.getElementById('hpModal')) return;
      const root = document.getElementById('hpModal');
      const h = root.querySelector('.ui-head-title'); if (h) h.textContent = hpu('title');
      const s = root.querySelector('.ui-head-sub'); if (s) s.textContent = hpu('sub');
      hpRenderAll(true);
    }

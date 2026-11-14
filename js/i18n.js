/* ============================================================
   js/i18n.js  (v4.0.01)
   Sprachen: Deutsch (de) und Englisch (en). Der Wechsel gilt pro Gerät
   (localStorage „nexus_lang“). Übersetzt werden die Teile für Kellner:
   Anmeldung, Kopf/Menü, Dashboard, Einstellungen, Getränke-Kopf und Hilfe.
   Manager-Fenster, A3-Karte und „Was ist neu?“ bleiben deutsch.

   NEUEN TEXT ÜBERSETZBAR MACHEN:
   1) In I18N_DICT unten einen Eintrag ergänzen: 'bereich.name': { de: '…', en: '…' }
   2) Im HTML:    <span data-i18n="bereich.name">Deutscher Text</span>
      (Platzhalter: data-i18n-ph, data-i18n-title, data-i18n-aria)
      Im JavaScript: t('bereich.name', { name: 'Anna' })   // {name} im Text wird ersetzt
   Jede neue Funktion für Kellner braucht Deutsch UND Englisch.
   ============================================================ */

    let currentLang = (function () {
      try { return localStorage.getItem('nexus_lang') === 'en' ? 'en' : 'de'; } catch (e) { return 'de'; }
    })();

    const I18N_DICT = {
 "login.who": {
  "de": "Wer bist du?",
  "en": "Who are you?"
 },
 "login.loading": {
  "de": "Personal wird geladen ...",
  "en": "Loading team ..."
 },
 "login.enterPin": {
  "de": "PIN eingeben",
  "en": "Enter PIN"
 },
 "login.change": {
  "de": "Ändern",
  "en": "Change"
 },
 "login.submit": {
  "de": "Anmelden",
  "en": "Log in"
 },
 "login.title": {
  "de": "Anmeldung",
  "en": "Login"
 },
 "login.search": {
  "de": "🔍 Name suchen ...",
  "en": "🔍 Search name ..."
 },
 "login.recent": {
  "de": "Zuletzt angemeldet",
  "en": "Last logged in"
 },
 "login.noStaff": {
  "de": "Kein Personal in der Datenbank gefunden.",
  "en": "No staff found in the database."
 },
 "login.noName": {
  "de": "Kein Name gefunden. Prüfe die Schreibweise.",
  "en": "No name found. Check the spelling."
 },
 "login.pin4": {
  "de": "Bitte mindestens 4 Ziffern eingeben.",
  "en": "Please enter at least 4 digits."
 },
 "login.tooMany": {
  "de": "Zu viele Versuche. Bitte in 10 Minuten erneut versuchen.",
  "en": "Too many attempts. Please try again in 10 minutes."
 },
 "login.error": {
  "de": "Fehler: {msg}",
  "en": "Error: {msg}"
 },
 "login.wrongPin": {
  "de": "Falscher PIN-Code!",
  "en": "Wrong PIN code!"
 },
 "role.staff": {
  "de": "Koch",
  "en": "Cook"
 },
 "role.kitchen": {
  "de": "Koch",
  "en": "Cook"
 },
 "role.dishwasher": {
  "de": "Abwasher",
  "en": "Dishwasher"
 },
 "role.manager": {
  "de": "Manager",
  "en": "Manager"
 },
 "role.developer": {
  "de": "Developer",
  "en": "Developer"
 },
 "hdr.switch": {
  "de": "🚪 Benutzer wechseln",
  "en": "🚪 Switch user"
 },
 "hdr.fullscreen": {
  "de": "⛶ Vollbild",
  "en": "⛶ Fullscreen"
 },
 "hdr.menu": {
  "de": "☰ Menü",
  "en": "☰ Menu"
 },
 "menu.dashboard": {
  "de": "Dashboard",
  "en": "Dashboard"
 },
 "menu.dashboardSub": {
  "de": "Zurück zur Startseite",
  "en": "Back to the start page"
 },
 "menu.drinks": {
  "de": "Rezepte",
  "en": "Recipes"
 },
 "menu.drinksSub": {
  "de": "Rezeptdatenbank öffnen",
  "en": "Open recipe database"
 },
 "menu.addDrink": {
  "de": "➕ Neues Rezept hinzufügen",
  "en": "➕ Add new recipe"
 },
 "menu.secDrinks": {
  "de": "Rezepte & Saison",
  "en": "Recipes & Season"
 },
 "menu.season": {
  "de": "Saison wählen",
  "en": "Choose season"
 },
 "menu.seasonSub": {
  "de": "Aktive Speisekarte wechseln",
  "en": "Switch the active menu"
 },
 "menu.newSeason": {
  "de": "Neue Saison erstellen",
  "en": "Create new season"
 },
 "menu.newSeasonSub": {
  "de": "Neue Speisekarte anlegen",
  "en": "Set up a new menu"
 },
 "menu.shopping": {
  "de": "Einkaufsliste / Inventur",
  "en": "Shopping list / Stocktake"
 },
 "menu.shoppingSub": {
  "de": "Zutaten der Saison zusammenrechnen",
  "en": "Add up the ingredients of the season"
 },
 "menu.print": {
  "de": "Karten-Druck (A3)",
  "en": "Menu print (A3)"
 },
 "menu.printSub": {
  "de": "Getränkekarte zum Ausdrucken",
  "en": "Drinks menu to print"
 },
 "menu.impexp": {
  "de": "Import & Export",
  "en": "Import & Export"
 },
 "menu.impexpSub": {
  "de": "Excel oder CSV",
  "en": "Excel or CSV"
 },
 "menu.secTeam": {
  "de": "Team & Arbeit",
  "en": "Team & Work"
 },
 "menu.chat": {
  "de": "Team-Chat",
  "en": "Team Chat"
 },
 "menu.chatSub": {
  "de": "Nachrichten an das ganze Team",
  "en": "Messages to the whole team"
 },
 "menu.myplan": {
  "de": "Mein Arbeitsplan",
  "en": "My Schedule"
 },
 "menu.myplanSub": {
  "de": "Deine Schichten",
  "en": "Your shifts"
 },
 "menu.secApp": {
  "de": "App",
  "en": "App"
 },
 "menu.settings": {
  "de": "Einstellungen & Zentrale",
  "en": "Settings & Control Centre"
 },
 "menu.settingsSub": {
  "de": "Design, Schrift, Hinweise, Sortierung",
  "en": "Theme, text size, notifications, sorting"
 },
 "menu.refresh": {
  "de": "Daten aktualisieren",
  "en": "Refresh data"
 },
 "menu.refreshSub": {
  "de": "Rezepte neu laden",
  "en": "Reload the recipes"
 },
 "menu.install": {
  "de": "App installieren",
  "en": "Install app"
 },
 "menu.installSub": {
  "de": "Symbol auf dem Startbildschirm",
  "en": "Icon on your home screen"
 },
 "menu.fullscreen": {
  "de": "Vollbild",
  "en": "Fullscreen"
 },
 "menu.fullscreenSub": {
  "de": "Ganzer Bildschirm ein/aus",
  "en": "Full screen on/off"
 },
 "menu.news": {
  "de": "Was ist neu?",
  "en": "What's new?"
 },
 "menu.newsSub": {
  "de": "Neuigkeiten in ",
  "en": "News in "
 },
 "menu.support": {
  "de": "Support & Tickets",
  "en": "Support & Tickets"
 },
 "menu.supportSub": {
  "de": "Fehler melden oder Fragen stellen",
  "en": "Report problems or ask questions"
 },
 "menu.logout": {
  "de": "Benutzer wechseln",
  "en": "Switch user"
 },
 "menu.logoutSub": {
  "de": "Abmelden",
  "en": "Log out"
 },
 "menu.help": {
  "de": "Hilfe & Anleitung",
  "en": "Help & Guide"
 },
 "menu.helpSub": {
  "de": "So funktioniert die App",
  "en": "How the app works"
 },
 "menu.profileEdit": {
  "de": "{role} · Profil bearbeiten",
  "en": "{role} · Edit profile"
 },
 "menu.profile": {
  "de": "Mein Profil",
  "en": "My profile"
 },
 "menu.seasonActive": {
  "de": "Aktiv: {name}",
  "en": "Active: {name}"
 },
 "dv.title": {
  "de": "🍳 Rezepte",
  "en": "🍳 Recipes"
 },
 "dv.category": {
  "de": "Kategorie:",
  "en": "Category:"
 },
 "dv.season": {
  "de": " Saison:",
  "en": " Season:"
 },
 "dv.schedule": {
  "de": "🗓️ Arbeitsplan",
  "en": "🗓️ Schedule"
 },
 "dv.diet": {
  "de": "Ernährung & Bestseller:",
  "en": "Diet & bestsellers:"
 },
 "dv.top": {
  "de": "⭐ TOP / Highlight",
  "en": "⭐ TOP / Highlight"
 },
 "dv.vegan": {
  "de": "🌱 Vegan",
  "en": "🌱 Vegan"
 },
 "dv.gluten": {
  "de": "🌾 Glutenfrei",
  "en": "🌾 Gluten-free"
 },
 "dv.lactose": {
  "de": "🥛 Laktosefrei",
  "en": "🥛 Lactose-free"
 },
 "dv.noalc": {
  "de": "🚫 Alkoholfrei",
  "en": "🚫 Alcohol-free"
 },
 "dv.fav": {
  "de": "❤️ Schicht-Favoriten",
  "en": "❤️ Shift favourites"
 },
 "dv.glass": {
  "de": "🔥 Nach Garmethode filtern:",
  "en": "🔥 Filter by cooking method:"
 },
 "set.title": {
  "de": "⚙️ Einstellungen & Zentrale",
  "en": "⚙️ Settings & Control Centre"
 },
 "set.sub": {
  "de": "Die meisten Einstellungen gelten nur auf diesem Gerät. Startseite und Begrüßungsanimation gelten für dein Konto.",
  "en": "Most settings apply to this device only. Start page and welcome animation apply to your account."
 },
 "set.appearance": {
  "de": "🎨 Darstellung",
  "en": "🎨 Appearance"
 },
 "set.theme": {
  "de": "Design",
  "en": "Theme"
 },
 "set.skin": {
  "de": "Stil",
  "en": "Style"
 },
 "set.skinSub": {
  "de": "„NeXuS Glass“: Glas-Look mit Hintergrundbild (immer dunkel). Braucht mehr Leistung, bei Ruckeln „Weichzeichner“ ausschalten.",
  "en": "“NeXuS Glass”: glass look with a background image (always dark). Needs more performance; if it stutters, turn off “Blur effect”."
 },
 "set.skinClassic": {
  "de": "Original",
  "en": "Original"
 },
 "set.light": {
  "de": "☀️ Hell",
  "en": "☀️ Light"
 },
 "set.dark": {
  "de": "🌙 Dunkel",
  "en": "🌙 Dark"
 },
 "set.font": {
  "de": "Schriftgröße",
  "en": "Text size"
 },
 "set.fontSub": {
  "de": "Vergrößert alle Texte der App.",
  "en": "Enlarges all text in the app."
 },
 "set.fs90": {
  "de": "Klein",
  "en": "Small"
 },
 "set.fs100": {
  "de": "Normal",
  "en": "Normal"
 },
 "set.fs112": {
  "de": "Groß",
  "en": "Large"
 },
 "set.fs125": {
  "de": "Sehr groß",
  "en": "Extra large"
 },
 "set.blur": {
  "de": "Weichzeichner (Blur)",
  "en": "Blur effect"
 },
 "set.blurSub": {
  "de": "Milchglas-Effekt in Dialogen, Menüs und Hinweisen. Auf schwächeren Geräten ausschalten.",
  "en": "Frosted-glass effect in dialogs, menus and notices. Turn it off on weaker devices."
 },
 "set.motion": {
  "de": "Animationen reduzieren",
  "en": "Reduce animations"
 },
 "set.motionSub": {
  "de": "Weniger Bewegung und Übergänge, ruhiger und akkusparender.",
  "en": "Less movement and transitions; calmer and easier on the battery."
 },
 "set.drinks": {
  "de": "🍳 Rezepte",
  "en": "🍳 Recipes"
 },
 "set.view": {
  "de": "Ansicht",
  "en": "View"
 },
 "set.viewSub": {
  "de": "Karten mit Foto oder kompakte Liste.",
  "en": "Cards with a photo, or a compact list."
 },
 "set.cards": {
  "de": "▦ Karten",
  "en": "▦ Cards"
 },
 "set.list": {
  "de": "☰ Liste",
  "en": "☰ List"
 },
 "set.sort": {
  "de": "Sortierung",
  "en": "Sorting"
 },
 "set.sortSub": {
  "de": "Reihenfolge der Rezepte in der Liste.",
  "en": "Order of the recipes in the list."
 },
 "set.sortNew": {
  "de": "Neueste zuerst",
  "en": "Newest first"
 },
 "set.sortPA": {
  "de": "Preis aufsteigend",
  "en": "Price: low to high"
 },
 "set.sortPD": {
  "de": "Preis absteigend",
  "en": "Price: high to low"
 },
 "set.sortFav": {
  "de": "Favoriten zuerst",
  "en": "Favourites first"
 },
 "set.prices": {
  "de": "Preise anzeigen",
  "en": "Show prices"
 },
 "set.pricesSub": {
  "de": "Preis neben dem Namen auf Karten und im Detail.",
  "en": "Price next to the name on cards and in the detail view."
 },
 "set.season": {
  "de": "Aktive Saison",
  "en": "Active season"
 },
 "set.seasonSub": {
  "de": "Welche Karte gerade angezeigt wird.",
  "en": "Which menu is currently shown."
 },
 "set.notif": {
  "de": "🔔 Hinweise",
  "en": "🔔 Notifications"
 },
 "set.nLogin": {
  "de": "Wenn sich ein Kollege anmeldet",
  "en": "When a colleague logs in"
 },
 "set.nLoginSub": {
  "de": "Kurzer Hinweis oben rechts mit Foto.",
  "en": "A short notice at the top right, with a photo."
 },
 "set.nChat": {
  "de": "Neue Chat-Nachricht",
  "en": "New chat message"
 },
 "set.nChatSub": {
  "de": "Hinweis, wenn der Chat gerade geschlossen ist.",
  "en": "A notice when the chat is closed."
 },
 "set.nSound": {
  "de": "Ton bei neuer Nachricht",
  "en": "Sound for new messages"
 },
 "set.nSoundSub": {
  "de": "Leiser Signalton im Chat.",
  "en": "A quiet alert sound in the chat."
 },
 "set.rights": {
  "de": "👤 Ansicht für Mitarbeiter mit Rechten",
  "en": "👤 View for staff with extra rights"
 },
 "set.mode": {
  "de": "Ansichtsmodus",
  "en": "View mode"
 },
 "set.modeSub": {
  "de": "Die Koch-Ansicht blendet Verwaltungs-Knöpfe aus.",
  "en": "The cook view hides the management buttons."
 },
 "set.modeStaff": {
  "de": "Koch",
  "en": "Cook"
 },
 "set.modeAdmin": {
  "de": "Verwaltung",
  "en": "Admin"
 },
 "set.install": {
  "de": "📲 App installieren",
  "en": "📲 Install app"
 },
 "set.installOn": {
  "de": "Auf dem Startbildschirm",
  "en": "On the home screen"
 },
 "set.installSub": {
  "de": "Mit einem Symbol auf dem Startbildschirm startet die App wie eine normale App.",
  "en": "With an icon on your home screen, the app starts like a normal app."
 },
 "set.installBtn": {
  "de": "📲 So geht’s",
  "en": "📲 How to"
 },
 "set.app": {
  "de": "🧰 App",
  "en": "🧰 App"
 },
 "set.version": {
  "de": "Version",
  "en": "Version"
 },
 "set.news": {
  "de": "🚀 Was ist neu?",
  "en": "🚀 What's new?"
 },
 "set.reload": {
  "de": "App neu laden",
  "en": "Reload app"
 },
 "set.reloadSub": {
  "de": "Hilft, wenn etwas hängt oder alt aussieht.",
  "en": "Helps if something is stuck or looks outdated."
 },
 "set.reloadBtn": {
  "de": "🔄 Neu laden",
  "en": "🔄 Reload"
 },
 "set.reset": {
  "de": "Einstellungen zurücksetzen",
  "en": "Reset settings"
 },
 "set.resetSub": {
  "de": "Setzt alle Einstellungen dieses Geräts auf Standard.",
  "en": "Resets all settings of this device to the default."
 },
 "set.resetBtn": {
  "de": "↩️ Zurücksetzen",
  "en": "↩️ Reset"
 },
 "set.done": {
  "de": "Fertig",
  "en": "Done"
 },
 "set.sortName": {
  "de": "Name A – Z",
  "en": "Name A – Z"
 },
 "set.langTitle": {
  "de": "Sprache / Language",
  "en": "Language / Sprache"
 },
 "set.langSub": {
  "de": "Gilt für Anmeldung, Dashboard, Menü, Einstellungen und Hilfe.",
  "en": "Applies to login, dashboard, menu, settings and help."
 },
 "set.themeAuto": {
  "de": "Folgt dem Gerät – aktuell: {mode}",
  "en": "Follows the device – currently: {mode}"
 },
 "set.themeDark": {
  "de": "Dunkel",
  "en": "Dark"
 },
 "set.themeLight": {
  "de": "Hell",
  "en": "Light"
 },
 "dash.g.bar": {
  "de": "🍳 Küche & Betrieb",
  "en": "🍳 Kitchen & Operations"
 },
 "dash.g.std": {
  "de": "✅ Standards & Betrieb",
  "en": "✅ Standards & Operations"
 },
 "dash.g.team": {
  "de": "👥 Team & Personal",
  "en": "👥 Team & Staff"
 },
 "dash.g.sys": {
  "de": "🔐 Sicherheit & System",
  "en": "🔐 Security & System"
 },
 "dash.g.info": {
  "de": "💡 Support & Infos",
  "en": "💡 Support & Info"
 },
 "dash.g.shift": {
  "de": "🕒 Meine Schicht",
  "en": "🕒 My Shift"
 },
 "dash.g.barService": {
  "de": "🍳 Küche & Service",
  "en": "🍳 Kitchen & Service"
 },
 "dash.drinks": {
  "de": "Rezepte",
  "en": "Recipes"
 },
 "dash.drinksSub": {
  "de": "{n} Rezepte · Datenbank öffnen",
  "en": "{n} recipes · open database"
 },
 "dash.drinksSub0": {
  "de": "Rezeptdatenbank öffnen",
  "en": "Open recipe database"
 },
 "dash.allergens": {
  "de": "Speisekarte & Allergene",
  "en": "Food Menu & Allergens"
 },
 "dash.allergensSub": {
  "de": "Gerichte, Allergene A–R",
  "en": "Dishes, allergens A–R"
 },
 "dash.season": {
  "de": "Saison wählen",
  "en": "Choose season"
 },
 "dash.seasonSub0": {
  "de": "Aktive Karte wählen",
  "en": "Choose the active menu"
 },
 "dash.print": {
  "de": "Karte drucken / PDF",
  "en": "Print menu / PDF"
 },
 "dash.printSub": {
  "de": "A3-Getränkekarte",
  "en": "A3 drinks menu"
 },
 "dash.impexp": {
  "de": "Import & Export",
  "en": "Import & Export"
 },
 "dash.impexpSub": {
  "de": "Excel oder CSV",
  "en": "Excel or CSV"
 },
 "dash.checklistA": {
  "de": "Checklisten & Standards",
  "en": "Checklists & Standards"
 },
 "dash.checklistAS": {
  "de": "Öffnung, Schließung, Aufgaben",
  "en": "Opening, closing, tasks"
 },
 "dash.checklistS": {
  "de": "Meine Schicht",
  "en": "My Shift"
 },
 "dash.checklistSS": {
  "de": "Aufgaben für heute",
  "en": "Tasks for today"
 },
 "dash.maintA": {
  "de": "Störungen",
  "en": "Fault Reports"
 },
 "dash.maintAS": {
  "de": "Gemeldete Defekte",
  "en": "Reported defects"
 },
 "dash.maintS": {
  "de": "Störung melden",
  "en": "Report a Fault"
 },
 "dash.maintSS": {
  "de": "Etwas kaputt?",
  "en": "Something broken?"
 },
 "dash.reserv": {
  "de": "Reservierungen",
  "en": "Reservations"
 },
 "dash.reservSub": {
  "de": "Früh, Abend und Tag gesamt",
  "en": "Early, evening and day total"
 },
 "dash.lossA": {
  "de": "Verluste & Bruch",
  "en": "Losses & Breakage"
 },
 "dash.lossAS": {
  "de": "Übersicht & Export",
  "en": "Overview & export"
 },
 "dash.lossS": {
  "de": "Bruch melden",
  "en": "Report Breakage"
 },
 "dash.lossSS": {
  "de": "Zerbrochenes, Verschüttetes",
  "en": "Breakage, spills"
 },
 "dash.teamplan": {
  "de": "Dienstplan",
  "en": "Weekly roster"
 },
 "dash.teamplanSub": {
  "de": "Woche (KW), Schichten, Veröffentlichung",
  "en": "Week, shifts, publishing"
 },
 "dash.fridge": {
  "de": "Kühlschrank-Temperaturen",
  "en": "Fridge temperatures"
 },
 "dash.fridgeSub": {
  "de": "Temperaturliste, einmal täglich",
  "en": "Temperature log, once a day"
 },
 "dash.order": {
  "de": "Bestellliste Gemüse / Obst",
  "en": "Vegetable / fruit order list"
 },
 "dash.orderSub": {
  "de": "Alle tragen ein, live, mit Druck & Excel",
  "en": "Everyone adds items, live, with print & Excel"
 },
 "dash.wash": {
  "de": "Abwasher",
  "en": "Dishwashing"
 },
 "dash.washSub": {
  "de": "Aufgaben abhaken, Extra eintragen",
  "en": "Tick off tasks, add extras"
 },
 "dash.washSubA": {
  "de": "Aufgaben, Übersicht, Rangliste",
  "en": "Tasks, overview, ranking"
 },
 "dash.swaps": {
  "de": "Schichttausch",
  "en": "Shift Swap"
 },
 "dash.swapsA": {
  "de": "Anfragen genehmigen",
  "en": "Approve requests"
 },
 "dash.swapsS": {
  "de": "Tauschen & Börse",
  "en": "Swap & board"
 },
 "dash.payroll": {
  "de": "Stunden & Lohn",
  "en": "Hours & Payroll"
 },
 "dash.payrollSub": {
  "de": "Wochenstunden (KW), Excel",
  "en": "Weekly hours (week), Excel"
 },
 "dash.staff": {
  "de": "Personal & PINs",
  "en": "Staff & PINs"
 },
 "dash.staffSub": {
  "de": "Mitarbeiter, Rollen, Rechte",
  "en": "Employees, roles, rights"
 },
 "dash.chat": {
  "de": "Team-Chat",
  "en": "Team Chat"
 },
 "dash.chatSub": {
  "de": "Nachrichten ans Team",
  "en": "Messages to the team"
 },
 "dash.myplan": {
  "de": "Mein Arbeitsplan",
  "en": "My Schedule"
 },
 "dash.myplanSub": {
  "de": "Schichten, Pausen, Tausch",
  "en": "Shifts, breaks, swaps"
 },
 "dash.login": {
  "de": "Login-Protokoll",
  "en": "Login Log"
 },
 "dash.loginSub": {
  "de": "Wer war wann online",
  "en": "Who was online and when"
 },
 "dash.settings": {
  "de": "Einstellungen",
  "en": "Settings"
 },
 "dash.settingsSub": {
  "de": "Design, Schrift, Hinweise",
  "en": "Theme, text size, notifications"
 },
 "dash.news": {
  "de": "Was ist neu?",
  "en": "What's new?"
 },
 "dash.newsSub": {
  "de": "Neuigkeiten (auf Deutsch)",
  "en": "News (in German)"
 },
 "dash.support": {
  "de": "Support & Tickets",
  "en": "Support & Tickets"
 },
 "dash.supportSub": {
  "de": "App-Fehler melden",
  "en": "Report app problems"
 },
 "dash.help": {
  "de": "Hilfe & Anleitung",
  "en": "Help & Guide"
 },
 "dash.helpSub": {
  "de": "So funktioniert alles",
  "en": "How everything works"
 },
 "dash.morning": {
  "de": "Guten Morgen, {name}!",
  "en": "Good morning, {name}!"
 },
 "dash.hello": {
  "de": "Hallo, {name}!",
  "en": "Hello, {name}!"
 },
 "dash.evening": {
  "de": "Guten Abend, {name}!",
  "en": "Good evening, {name}!"
 },
 "common.close": {
  "de": "Schließen",
  "en": "Close"
 },
 "common.done": {
  "de": "Fertig",
  "en": "Done"
 },
 "dv.loading": {
  "de": "Lade Rezepte aus der Datenbank...",
  "en": "Loading recipes from the database..."
 },
 "dv.search": {
  "de": "🔍 Rezept oder Zutat suchen...",
  "en": "🔍 Search recipe or ingredient..."
 },
 "dv.backTitle": {
  "de": "Zurück zum Dashboard",
  "en": "Back to the dashboard"
 },
 "dv.seasonTitle": {
  "de": "Klicken, um Saison zu wechseln",
  "en": "Tap to switch season"
 },
 "hdr.profileTitle": {
  "de": "Klicken, um mein Profil zu öffnen",
  "en": "Tap to open my profile"
 },
 "tray.clear": {
  "de": "Leeren",
  "en": "Clear"
 },
 "cat.all": {
  "de": "Alle",
  "en": "All"
 },
 "dv.noGlass": {
  "de": "Keine Garmethoden vorhanden",
  "en": "No cooking methods available"
 },
 "dv.empty": {
  "de": "Keine Rezepte in dieser Saison gefunden.",
  "en": "No recipes found in this season."
 },
 "dv.noImage": {
  "de": "Kein Bild",
  "en": "No image"
 },
 "dv.drinkWord": {
  "de": "Rezept",
  "en": "Recipe"
 },
 "drm.bigPhoto": {
  "de": "Klicken für Großansicht",
  "en": "Tap to enlarge"
 },
 "drm.noIng": {
  "de": "Keine Zutaten angegeben",
  "en": "No ingredients listed"
 },
 "drm.allergens": {
  "de": "Allergene:",
  "en": "Allergens:"
 },
 "drm.prep": {
  "de": "Zubereitung",
  "en": "Preparation"
 },
 "drm.lastChange": {
  "de": "🕒 Letzte Änderung: {date}",
  "en": "🕒 Last changed: {date}"
 },
 "drm.favOn": {
  "de": "Favorit ✓",
  "en": "Favourite ✓"
 },
 "drm.favOff": {
  "de": "Schicht-Favorit",
  "en": "Shift favourite"
 },
 "drm.photo": {
  "de": "🖼️ Foto anzeigen",
  "en": "🖼️ Show photo"
 },
 "drm.edit": {
  "de": "✏️ Bearbeiten",
  "en": "✏️ Edit"
 },
 "drm.del": {
  "de": "🗑️ Löschen",
  "en": "🗑️ Delete"
 },
 "drm.print": {
  "de": "🖨️ Drucken / PDF",
  "en": "🖨️ Print / PDF"
 },
 "drm.close": {
  "de": "✕ Schließen",
  "en": "✕ Close"
 },
 "prn.title": {
  "de": "Drucken-Optionen",
  "en": "Print options"
 },
 "prn.sub": {
  "de": "Wähle aus, wie das Rezept gedruckt werden soll:",
  "en": "Choose how the recipe should be printed:"
 },
 "prn.img": {
  "de": "🖼️ Mit Bild drucken",
  "en": "🖼️ Print with image"
 },
 "prn.noimg": {
  "de": "📄 Ohne Bild drucken (Text pur)",
  "en": "📄 Print without image (text only)"
 },
 "shop.title": {
  "de": "🛒 Einkaufsliste & Inventur",
  "en": "🛒 Shopping list & Stocktake"
 },
 "shop.intro": {
  "de": "Übersicht aller benötigten Zutaten für die aktive Saison: ",
  "en": "Overview of all ingredients needed for the active season: "
 },
 "shop.print": {
  "de": "🖨️ Einkaufsliste drucken",
  "en": "🖨️ Print shopping list"
 },
 "shop.excel": {
  "de": "📗 Als Excel exportieren",
  "en": "📗 Export as Excel"
 },
 "mv.title": {
  "de": "⚡ Multi-View: Rezepte im direkten Vergleich",
  "en": "⚡ Multi-View: recipes side by side"
 },
 "rep.title": {
  "de": "🔄 Rezept ersetzen",
  "en": "🔄 Replace recipe"
 },
 "rep.sub": {
  "de": "Wähle ein neues Rezept aus der aktuellen Saison, das dieses ersetzen soll:",
  "en": "Choose a new recipe from the current season to replace this one:"
 },
 "shop.empty": {
  "de": "Keine Zutaten in dieser Saison gefunden.",
  "en": "No ingredients found in this season."
 },
 "shop.noExport": {
  "de": "Keine Zutaten für den Export vorhanden.",
  "en": "No ingredients to export."
 },
 "shop.colIng": {
  "de": "Zutat / Produkt",
  "en": "Ingredient / product"
 },
 "shop.colUse": {
  "de": "Verwendung & Mengen",
  "en": "Use & amounts"
 },
 "shop.xlsIng": {
  "de": "Zutat",
  "en": "Ingredient"
 },
 "shop.xlsUse": {
  "de": "Verwendung und Mengen",
  "en": "Use and amounts"
 },
 "tray.max": {
  "de": "Für den Schnellvergleich können maximal 6 Rezepte gleichzeitig ausgewählt werden.",
  "en": "You can select a maximum of 6 recipes for the quick comparison."
 },
 "tray.already": {
  "de": "„{name}“ ist schon im Multi-View",
  "en": "“{name}” is already in Multi-View"
 },
 "tray.added": {
  "de": "„{name}“ zum Multi-View hinzugefügt ({n}/6)",
  "en": "“{name}” added to Multi-View ({n}/6)"
 },
 "tray.full": {
  "de": "⚡ Multi-View ist voll (6/6)",
  "en": "⚡ Multi-View is full (6/6)"
 },
 "tray.drop": {
  "de": "⚡ Hier loslassen für Multi-View ({n}/6)",
  "en": "⚡ Release here for Multi-View ({n}/6)"
 },
 "tray.noIng": {
  "de": "Keine Zutaten",
  "en": "No ingredients"
 },
 "tray.prep": {
  "de": "Zubereitung:",
  "en": "Preparation:"
 },
 "tray.swap": {
  "de": "🔄 Tauschen",
  "en": "🔄 Swap"
 },
 "tray.glass": {
  "de": "Methode:",
  "en": "Method:"
 },
 "tray.ingredients": {
  "de": "Zutaten:",
  "en": "Ingredients:"
 },
 "tray.amount": {
  "de": "Menge:",
  "en": "Amount:"
 },
 "prof.title": {
  "de": "👤 Mein Profil",
  "en": "👤 My profile"
 },
 "prof.sub": {
  "de": "So sehen dich deine Kollegen im Chat und in der Personalliste.",
  "en": "This is how your colleagues see you in the chat and in the staff list."
 },
 "prof.photo": {
  "de": "📷 Foto ändern",
  "en": "📷 Change photo"
 },
 "prof.viewPhoto": {
  "de": "🔍 Foto ansehen",
  "en": "🔍 View photo"
 },
 "prof.plan": {
  "de": "Mein Arbeitsplan",
  "en": "My Schedule"
 },
 "prof.planSub": {
  "de": "Deine Schichten ansehen",
  "en": "View your shifts"
 },
 "prof.about": {
  "de": "Über mich",
  "en": "About me"
 },
 "prof.btnBar": {
  "de": "🍳 In der Küche",
  "en": "🍳 In the kitchen"
 },
 "prof.btnPause": {
  "de": "☕ In der Pause",
  "en": "☕ On a break"
 },
 "prof.btnIn": {
  "de": "🔥 Voll dabei",
  "en": "🔥 All in"
 },
 "prof.clear": {
  "de": "Leeren",
  "en": "Clear"
 },
 "prof.pinTitle": {
  "de": "PIN-Code ändern",
  "en": "Change PIN code"
 },
 "prof.newPin": {
  "de": "Neuer PIN",
  "en": "New PIN"
 },
 "prof.repeatPin": {
  "de": "PIN wiederholen",
  "en": "Repeat PIN"
 },
 "prof.pinHint": {
  "de": "Leer lassen, wenn dein PIN gleich bleiben soll.",
  "en": "Leave empty if your PIN should stay the same."
 },
 "prof.showHide": {
  "de": "👁️ Anzeigen / verbergen",
  "en": "👁️ Show / hide"
 },
 "prof.rights": {
  "de": "Meine Rechte",
  "en": "My rights"
 },
 "prof.unsaved": {
  "de": "● Ungespeicherte Änderungen",
  "en": "● Unsaved changes"
 },
 "prof.save": {
  "de": "💾 Speichern",
  "en": "💾 Save"
 },
 "prof.aboutColon": {
  "de": "Über mich:",
  "en": "About me:"
 },
 "prof.noBio": {
  "de": "Keine Beschreibung angegeben.",
  "en": "No description given."
 },
 "prof.bioBar": {
  "de": "🍳 In der Küche",
  "en": "🍳 In the kitchen"
 },
 "prof.bioPause": {
  "de": "☕ In der Pause",
  "en": "☕ On a break"
 },
 "prof.bioIn": {
  "de": "🔥 Heute voll dabei",
  "en": "🔥 All in today"
 },
 "prof.bioPh": {
  "de": "Schreibe etwas über dich oder deinen Status ...",
  "en": "Write something about yourself or your status ..."
 },
 "prof.pinPh": {
  "de": "4 bis 6 Ziffern",
  "en": "4 to 6 digits"
 },
 "prof.pinPh2": {
  "de": "Zur Kontrolle",
  "en": "To confirm"
 },
 "prof.r1": {
  "de": "Rezepte ansehen, Chat nutzen, eigenes Profil bearbeiten",
  "en": "View recipes, use the chat, edit your own profile"
 },
 "prof.r2": {
  "de": "Rezepte anlegen, ändern und löschen",
  "en": "Create, change and delete recipes"
 },
 "prof.r3": {
  "de": "Personal, PINs und Login-Protokoll verwalten",
  "en": "Manage staff, PINs and the login log"
 },
 "prof.r4": {
  "de": "Tickets löschen",
  "en": "Delete tickets"
 },
 "prof.allowed": {
  "de": "✔ erlaubt",
  "en": "✔ allowed"
 },
 "prof.notAllowed": {
  "de": "– nicht erlaubt",
  "en": "– not allowed"
 },
 "prof.bioEmpty": {
  "de": "Noch keine Beschreibung – schreibe unten etwas über dich.",
  "en": "No description yet – write something about yourself below."
 },
 "prof.pinLenErr": {
  "de": "Der PIN muss aus 4 bis 6 Ziffern bestehen.",
  "en": "The PIN must have 4 to 6 digits."
 },
 "prof.pinMismatch": {
  "de": "Die beiden PINs stimmen nicht überein.",
  "en": "The two PINs do not match."
 },
 "prof.pinRepeat": {
  "de": "Bitte den PIN zur Kontrolle wiederholen.",
  "en": "Please repeat the PIN to confirm."
 },
 "prof.pinOk": {
  "de": "✔ PIN passt.",
  "en": "✔ PIN matches."
 },
 "prof.loadErr": {
  "de": "Fehler beim Laden des Profils.",
  "en": "Error loading the profile."
 },
 "prof.lastLogin": {
  "de": "Zuletzt angemeldet: {when}",
  "en": "Last login: {when}"
 },
 "prof.noPhotoTitle": {
  "de": "Noch kein Foto",
  "en": "No photo yet"
 },
 "prof.noPhotoText": {
  "de": "Lade zuerst ein Profilfoto hoch.",
  "en": "Upload a profile photo first."
 },
 "prof.err": {
  "de": "Fehler: {msg}",
  "en": "Error: {msg}"
 },
 "prof.newPhoto": {
  "de": "✔ Neues Foto – mit „Speichern“ übernehmen.",
  "en": "✔ New photo – apply it with “Save”."
 },
 "prof.saveErr": {
  "de": "Fehler beim Speichern: {msg}",
  "en": "Error while saving: {msg}"
 },
 "prof.savedTitle": {
  "de": "Profil gespeichert",
  "en": "Profile saved"
 },
 "prof.savedPin": {
  "de": "Dein neuer PIN gilt ab dem nächsten Login.",
  "en": "Your new PIN applies from your next login."
 },
 "prof.savedOk": {
  "de": "Deine Änderungen sind übernommen.",
  "en": "Your changes have been saved."
 },
 "prof.role": {
  "de": "Rolle: {role}",
  "en": "Role: {role}"
 },
 "time.never": {
  "de": "noch nie",
  "en": "never"
 },
 "time.unknown": {
  "de": "unbekannt",
  "en": "unknown"
 },
 "time.now": {
  "de": "gerade eben",
  "en": "just now"
 },
 "time.min": {
  "de": "vor {n} Min.",
  "en": "{n} min ago"
 },
 "time.hour": {
  "de": "vor {n} Std.",
  "en": "{n} h ago"
 },
 "time.yesterday": {
  "de": "gestern",
  "en": "yesterday"
 },
 "time.days": {
  "de": "vor {n} Tagen",
  "en": "{n} days ago"
 },
 "set.startTitle": {
  "de": "Nach dem Login öffnen",
  "en": "Open after login"
 },
 "set.startSub": {
  "de": "Welche Seite sich nach der Anmeldung zuerst öffnet. Gilt auf allen deinen Geräten.",
  "en": "Which page opens first after login. Applies on all your devices."
 },
 "set.startDash": {
  "de": "🏠 Dashboard",
  "en": "🏠 Dashboard"
 },
 "set.startDrinks": {
  "de": "🍳 Rezepte",
  "en": "🍳 Recipes"
 },
 "set.startSaved": {
  "de": "Startseite gespeichert",
  "en": "Start page saved"
 },
 "set.startDeviceOnly": {
  "de": "Nur auf diesem Gerät gespeichert (Datenbank-Update fehlt).",
  "en": "Saved on this device only (database update missing)."
 },
 "chat.title": {
  "de": "💬 Team-Chat",
  "en": "💬 Team Chat"
 },
 "chat.team": {
  "de": "Team",
  "en": "Team"
 },
 "chat.loadMembers": {
  "de": "Lade Mitglieder ...",
  "en": "Loading members ..."
 },
 "chat.loadMsgs": {
  "de": "Lade Chat-Nachrichten ...",
  "en": "Loading chat messages ..."
 },
 "chat.newBtn": {
  "de": "↓ Neue Nachrichten",
  "en": "↓ New messages"
 },
 "chat.editTitle": {
  "de": "✏️ Nachricht bearbeiten",
  "en": "✏️ Edit message"
 },
 "chat.editSub": {
  "de": "Ändere den Text und sende ihn erneut ab.",
  "en": "Change the text and send it again."
 },
 "chat.send": {
  "de": "Senden ➔",
  "en": "Send ➔"
 },
 "chat.online": {
  "de": "🟢 Online: ",
  "en": "🟢 Online: "
 },
 "chat.seenAll": {
  "de": " · Nachrichten sehen alle Kollegen",
  "en": " · All colleagues see the messages"
 },
 "chat.member1": {
  "de": "{n} Mitglied",
  "en": "{n} member"
 },
 "chat.memberN": {
  "de": "{n} Mitglieder",
  "en": "{n} members"
 },
 "chat.searchTitle": {
  "de": "Im Chat suchen",
  "en": "Search the chat"
 },
 "chat.teamTitle": {
  "de": "Team anzeigen",
  "en": "Show team"
 },
 "chat.searchPh": {
  "de": "🔍 Nachrichten oder Namen suchen ...",
  "en": "🔍 Search messages or names ..."
 },
 "chat.cancelReply": {
  "de": "Antwort abbrechen",
  "en": "Cancel reply"
 },
 "chat.cancelEdit": {
  "de": "Bearbeiten abbrechen",
  "en": "Cancel editing"
 },
 "chat.removeImg": {
  "de": "Bild entfernen",
  "en": "Remove image"
 },
 "chat.bold": {
  "de": "Fett (Strg+B)",
  "en": "Bold (Ctrl+B)"
 },
 "chat.italic": {
  "de": "Kursiv (Strg+I)",
  "en": "Italic (Ctrl+I)"
 },
 "chat.strike": {
  "de": "Durchgestrichen",
  "en": "Strikethrough"
 },
 "chat.code": {
  "de": "Code",
  "en": "Code"
 },
 "chat.mention": {
  "de": "Kollegen erwähnen",
  "en": "Mention a colleague"
 },
 "chat.emoji": {
  "de": "Emoji",
  "en": "Emoji"
 },
 "chat.sendPhoto": {
  "de": "Foto senden",
  "en": "Send photo"
 },
 "chat.inputPh": {
  "de": "Nachricht schreiben ... (@ erwähnt Kollegen)",
  "en": "Write a message ... (@ mentions colleagues)"
 },
 "chat.hintEnter": {
  "de": "Enter sendet, Shift+Enter macht eine neue Zeile",
  "en": "Enter sends, Shift+Enter starts a new line"
 },
 "chat.viewProfile": {
  "de": "Profil ansehen",
  "en": "View profile"
 },
 "chat.today": {
  "de": "Heute",
  "en": "Today"
 },
 "chat.yesterday": {
  "de": "Gestern",
  "en": "Yesterday"
 },
 "chat.newMsgs": {
  "de": "Neue Nachrichten",
  "en": "New messages"
 },
 "chat.photoWord": {
  "de": "Foto",
  "en": "Photo"
 },
 "chat.photo": {
  "de": "📷 Foto",
  "en": "📷 Photo"
 },
 "chat.unpin": {
  "de": "Anheften lösen",
  "en": "Unpin"
 },
 "chat.pin": {
  "de": "Anpinnen",
  "en": "Pin"
 },
 "chat.reply": {
  "de": "Antworten",
  "en": "Reply"
 },
 "chat.react": {
  "de": "Reagieren",
  "en": "React"
 },
 "common.delete": {
  "de": "Löschen",
  "en": "Delete"
 },
 "chat.edited": {
  "de": "bearbeitet",
  "en": "edited"
 },
 "chat.noMembers": {
  "de": "Keine Mitglieder gefunden.",
  "en": "No members found."
 },
 "chat.mentionTitle": {
  "de": "Klicken, um @{name} zu erwähnen",
  "en": "Tap to mention @{name}"
 },
 "chat.typing": {
  "de": "schreibt ...",
  "en": "is typing ..."
 },
 "chat.onlineDot": {
  "de": "online · ",
  "en": "online · "
 },
 "chat.err": {
  "de": "Fehler: {msg}",
  "en": "Error: {msg}"
 },
 "chat.noHits": {
  "de": "Keine Treffer für „{q}“.",
  "en": "No results for “{q}”."
 },
 "chat.editFail": {
  "de": "Die Nachricht konnte nicht geändert werden",
  "en": "The message could not be changed"
 },
 "chat.sendFail": {
  "de": "Fehler beim Senden:",
  "en": "Error while sending:"
 },
 "chat.confirmDel": {
  "de": "Möchtest du diese Nachricht löschen?",
  "en": "Do you want to delete this message?"
 },
 "chat.delFail": {
  "de": "Fehler beim Löschen:",
  "en": "Error while deleting:"
 },
 "chat.pickPhoto": {
  "de": "Bitte ein Foto auswählen.",
  "en": "Please choose a photo."
 },
 "chat.tooBig": {
  "de": "Das Foto ist größer als 8 MB.",
  "en": "The photo is larger than 8 MB."
 },
 "chat.uploading": {
  "de": "⏳ Foto wird hochgeladen ...",
  "en": "⏳ Uploading photo ..."
 },
 "chat.uploadFail": {
  "de": "Foto konnte nicht hochgeladen werden:",
  "en": "Photo could not be uploaded:"
 },
 "chat.mentionedYou": {
  "de": "{name} hat dich erwähnt",
  "en": "{name} mentioned you"
 },
 "chat.typing1": {
  "de": "{a} schreibt ...",
  "en": "{a} is typing ..."
 },
 "chat.typingN": {
  "de": "{a} und {b} schreiben ...",
  "en": "{a} and {b} are typing ..."
 },
 "dash.tomi": {
  "de": "TomiAI",
  "en": "TomiAI"
 },
 "dash.tomiSubS": {
  "de": "Fragen & Hilfe",
  "en": "Questions & help"
 },
 "dash.tomiSubA": {
  "de": "Assistent & Planung",
  "en": "Assistant & planning"
 },
 "push.title": {
  "de": "🔔 Push-Benachrichtigungen",
  "en": "🔔 Push notifications"
 },
 "push.enable": {
  "de": "Benachrichtigungen aktivieren",
  "en": "Enable notifications"
 },
 "push.disable": {
  "de": "Auf diesem Gerät ausschalten",
  "en": "Turn off on this device"
 },
 "push.test": {
  "de": "Test senden",
  "en": "Send a test"
 },
 "push.testSent": {
  "de": "Test gesendet. Er kommt in wenigen Sekunden.",
  "en": "Test sent. It arrives in a few seconds."
 },
 "push.on": {
  "de": "✅ Aktiv auf diesem Gerät",
  "en": "✅ Active on this device"
 },
 "push.stUnconfigured": {
  "de": "Noch nicht eingerichtet. Ein Manager/Developer muss zuerst die Push-Schlüssel eintragen (siehe Einrichtungs-Anleitung).",
  "en": "Not set up yet. A manager/developer has to enter the push keys first (see the setup guide)."
 },
 "push.stUnsupported": {
  "de": "Dieses Gerät oder dieser Browser unterstützt keine Push-Benachrichtigungen.",
  "en": "This device or browser does not support push notifications."
 },
 "push.stIos": {
  "de": "Auf iPhone/iPad funktionieren Benachrichtigungen nur, wenn die App auf dem Home-Bildschirm liegt: Tippe in Safari auf „Teilen“ → „Zum Home-Bildschirm“, öffne die App dann von dort und aktiviere die Benachrichtigungen.",
  "en": "On iPhone/iPad notifications only work if the app is on your home screen: in Safari tap “Share” → “Add to Home Screen”, then open the app from there and enable notifications."
 },
 "push.stDenied": {
  "de": "Benachrichtigungen sind blockiert. Erlaube sie in den Einstellungen deines Geräts oder Browsers für diese App und lade die App neu.",
  "en": "Notifications are blocked. Allow them in your device or browser settings for this app and reload the app."
 },
 "push.stOff": {
  "de": "Aus. Aktiviere sie, um auch bei geschlossener App Bescheid zu bekommen.",
  "en": "Off. Enable them to be notified even when the app is closed."
 },
 "push.denied": {
  "de": "Du hast Benachrichtigungen nicht erlaubt.",
  "en": "You did not allow notifications."
 },
 "push.enabled": {
  "de": "Benachrichtigungen aktiviert",
  "en": "Notifications enabled"
 },
 "push.disabled": {
  "de": "Benachrichtigungen ausgeschaltet",
  "en": "Notifications turned off"
 },
 "push.error": {
  "de": "Fehler: {msg}",
  "en": "Error: {msg}"
 },
 "push.what": {
  "de": "Worüber möchtest du informiert werden?",
  "en": "What do you want to be notified about?"
 },
 "push.mgrWhat": {
  "de": "Für Manager",
  "en": "For managers"
 },
 "push.cChat": {
  "de": "💬 Neue Chat-Nachrichten",
  "en": "💬 New chat messages"
 },
 "push.cChatSub": {
  "de": "Alle Nachrichten im Team-Chat",
  "en": "All messages in the team chat"
 },
 "push.cMention": {
  "de": "@ Erwähnungen",
  "en": "@ Mentions"
 },
 "push.cMentionSub": {
  "de": "Wenn dich jemand im Chat mit @ erwähnt",
  "en": "When someone mentions you with @ in the chat"
 },
 "push.cPlan": {
  "de": "🗓️ Änderungen am Arbeitsplan",
  "en": "🗓️ Schedule changes"
 },
 "push.cPlanSub": {
  "de": "Dein Plan wurde geändert oder neu erstellt",
  "en": "Your schedule was changed or created"
 },
 "push.cSwap": {
  "de": "🔄 Schichttausch",
  "en": "🔄 Shift swaps"
 },
 "push.cSwapSub": {
  "de": "Anfragen an dich, Börse und Entscheidungen",
  "en": "Requests to you, the board and decisions"
 },
 "push.cNews": {
  "de": "📣 Team-News",
  "en": "📣 Team news"
 },
 "push.cNewsSub": {
  "de": "Neuigkeiten und Specials vom Manager",
  "en": "News and specials from the manager"
 },
 "push.cMgrSwap": {
  "de": "✅ Tausch wartet auf Genehmigung",
  "en": "✅ Swap waiting for approval"
 },
 "push.cFaultUrgent": {
  "de": "🚨 Dringende Störungen und Notfälle",
  "en": "🚨 Urgent faults and emergencies"
 },
 "push.cFault": {
  "de": "🛠️ Weitere Störungen",
  "en": "🛠️ Other faults"
 },
 "push.cTicket": {
  "de": "🛟 Neue Tickets",
  "en": "🛟 New tickets"
 },
 "push.bTitle": {
  "de": "🔔 Nichts mehr verpassen",
  "en": "🔔 Never miss anything"
 },
 "push.bText": {
  "de": "Aktiviere Benachrichtigungen und erfahre auch bei geschlossener App von neuen Nachrichten, Planänderungen und Tausch-Anfragen.",
  "en": "Enable notifications to hear about new messages, schedule changes and swap requests even when the app is closed."
 },
 "push.bIosTitle": {
  "de": "📲 Für Benachrichtigungen: App auf den Home-Bildschirm",
  "en": "📲 For notifications: add the app to your home screen"
 },
 "push.bIosText": {
  "de": "Tippe in Safari auf „Teilen“ → „Zum Home-Bildschirm“ und öffne die App dann von dort. Erst dann sind Benachrichtigungen auf dem iPhone möglich.",
  "en": "In Safari tap “Share” → “Add to Home Screen”, then open the app from there. Only then are notifications possible on the iPhone."
 },
 "push.bEnable": {
  "de": "Aktivieren",
  "en": "Enable"
 },
 "push.bLater": {
  "de": "Später",
  "en": "Later"
 },
 "tomi.fab": {
  "de": "TomiAI",
  "en": "TomiAI"
 },
 "tomi.title": {
  "de": "✨ TomiAI",
  "en": "✨ TomiAI"
 },
 "tomi.subStaff": {
  "de": "Fragen zu Rezepten, Allergenen, Speisekarte und der App",
  "en": "Questions about recipes, allergens, the food menu and the app"
 },
 "tomi.subAdmin": {
  "de": "Assistent für Rezepte, Team und Planung (Manager-Modus)",
  "en": "Assistant for recipes, team and planning (manager mode)"
 },
 "tomi.hello": {
  "de": "Hallo {name}! Ich bin Tomi. Was möchtest du wissen?",
  "en": "Hi {name}! I am Tomi. What would you like to know?"
 },
 "tomi.helloAdmin": {
  "de": "Als Manager helfe ich dir auch bei Plan, Stunden, Tausch und Tickets. Änderungen mache ich nie selbst, ich schlage sie nur vor.",
  "en": "As a manager I can also help you with the schedule, hours, swaps and tickets. I never change anything myself, I only suggest."
 },
 "tomi.ph": {
  "de": "Frage stellen ...",
  "en": "Ask a question ..."
 },
 "tomi.send": {
  "de": "Senden",
  "en": "Send"
 },
 "tomi.thinking": {
  "de": "Tomi denkt nach ...",
  "en": "Tomi is thinking ..."
 },
 "tomi.disc": {
  "de": "TomiAI kann Fehler machen. Bei Allergenen immer in der Küche nachfragen.",
  "en": "TomiAI can make mistakes. For allergens always check with the kitchen."
 },
 "tomi.errAuth": {
  "de": "Bitte melde dich neu an.",
  "en": "Please log in again."
 },
 "tomi.errQuota": {
  "de": "Du hast das Tageslimit für TomiAI erreicht. Morgen geht es weiter.",
  "en": "You have reached the daily limit for TomiAI. Try again tomorrow."
 },
 "tomi.errNotConfigured": {
  "de": "TomiAI ist noch nicht eingerichtet (KI-Schlüssel fehlt). Bitte den Manager/Developer informieren.",
  "en": "TomiAI is not set up yet (AI key missing). Please tell the manager/developer."
 },
 "tomi.errDeploy": {
  "de": "TomiAI ist noch nicht eingerichtet (Funktion nicht gefunden). Bitte den Manager/Developer informieren.",
  "en": "TomiAI is not set up yet (function not found). Please tell the manager/developer."
 },
 "tomi.errBusy": {
  "de": "TomiAI ist gerade stark ausgelastet. Bitte versuche es in einer Minute noch einmal.",
  "en": "TomiAI is very busy right now. Please try again in a minute."
 },
 "tomi.errAi": {
  "de": "TomiAI ist gerade nicht erreichbar. Bitte versuche es später noch einmal.",
  "en": "TomiAI is not reachable right now. Please try again later."
 },
 "tomi.propTitle": {
  "de": "Vorschlag (noch nicht ausgeführt)",
  "en": "Proposal (not done yet)"
 },
 "tomi.confirm": {
  "de": "✅ Bestätigen",
  "en": "✅ Confirm"
 },
 "tomi.discard": {
  "de": "✖ Verwerfen",
  "en": "✖ Discard"
 },
 "tomi.done": {
  "de": "✔ Ausgeführt",
  "en": "✔ Done"
 },
 "tomi.failed": {
  "de": "⚠️ Fehlgeschlagen: {msg}",
  "en": "⚠️ Failed: {msg}"
 },
 "tomi.discarded": {
  "de": "Verworfen",
  "en": "Discarded"
 },
 "tomi.chipS1": {
  "de": "Wie macht man einen Negroni?",
  "en": "How do I make a Negroni?"
 },
 "tomi.chipS2": {
  "de": "Welche Rezepte sind vegan?",
  "en": "Which recipes are vegan?"
 },
 "tomi.chipS3": {
  "de": "Was darf jemand mit Nuss-Allergie essen?",
  "en": "What can someone with a nut allergy eat?"
 },
 "tomi.chipS4": {
  "de": "Wann arbeite ich diese Woche?",
  "en": "When do I work this week?"
 },
 "tomi.chipM1": {
  "de": "Wer ist am Freitag frei?",
  "en": "Who is free on Friday?"
 },
 "tomi.chipM2": {
  "de": "Fasse die Stunden diesen Monat zusammen",
  "en": "Summarise the hours this month"
 },
 "tomi.chipM3": {
  "de": "Welche Tausch-Anfragen warten auf mich?",
  "en": "Which swap requests are waiting for me?"
 },
 "tomi.chipM4": {
  "de": "Welche Tickets sind offen? Schlage Antworten vor.",
  "en": "Which tickets are open? Suggest replies."
 },
 "set.tabGeneral": {
  "de": "🏠 Allgemein",
  "en": "🏠 General"
 },
 "set.tabLook": {
  "de": "🎨 Darstellung",
  "en": "🎨 Appearance"
 },
 "set.tabDrinks": {
  "de": "🍳 Rezepte",
  "en": "🍳 Recipes"
 },
 "set.tabNotif": {
  "de": "🔔 Hinweise",
  "en": "🔔 Notifications"
 },
 "set.tabAccount": {
  "de": "👤 Konto",
  "en": "👤 Account"
 },
 "set.tabApp": {
  "de": "🧰 App",
  "en": "🧰 App"
 },
 "set.generalHead": {
  "de": "🏠 Allgemein",
  "en": "🏠 General"
 },
 "set.introTitle": {
  "de": "Begrüßungsanimation",
  "en": "Welcome animation"
 },
 "set.introSub": {
  "de": "Kurze Animation nach dem Anmelden. Gilt für dein Konto auf allen Geräten.",
  "en": "A short animation after logging in. Applies to your account on all devices."
 },
 "set.introSaved": {
  "de": "Einstellung gespeichert",
  "en": "Setting saved"
 },
 "set.accHead": {
  "de": "👤 Konto",
  "en": "👤 Account"
 },
 "set.accProfile": {
  "de": "Mein Profil",
  "en": "My profile"
 },
 "set.accProfileSub": {
  "de": "Foto, „Über mich“ und PIN ändern.",
  "en": "Change photo, “About me” and PIN."
 },
 "set.open": {
  "de": "Öffnen",
  "en": "Open"
 },
 "set.accLogout": {
  "de": "Benutzer wechseln",
  "en": "Switch user"
 },
 "set.accLogoutSub": {
  "de": "Abmelden und einen anderen Namen wählen.",
  "en": "Log out and choose another name."
 },
 "set.accLogoutBtn": {
  "de": "Abmelden",
  "en": "Log out"
 },
 "set.privHead": {
  "de": "🔒 Datenschutz",
  "en": "🔒 Privacy"
 },
 "set.privText": {
  "de": "Zur Sicherheit speichert die App deine Anmeldezeit, das Gerät, die geöffneten Bereiche und wichtige Aktionen (z. B. Aufgabe abgehakt). Nur Manager sehen das. Es werden keine IP-Adressen gespeichert und alles wird nach 90 Tagen automatisch gelöscht.",
  "en": "For security the app stores your login time, device, the sections you open and important actions (e.g. task ticked). Only managers can see this. No IP addresses are stored and everything is deleted automatically after 90 days."
 },
 "intro.welcome": {
  "de": "Willkommen, {name}",
  "en": "Welcome, {name}"
 },
 "intro.system": {
  "de": "im System",
  "en": "to the system"
 },
 "intro.skip": {
  "de": "Tippen zum Überspringen",
  "en": "Tap to skip"
 },
 "dash.absence": {
  "de": "Urlaub / Krank",
  "en": "Vacation / Sick"
 },
 "dash.absenceA": {
  "de": "Anträge & Krankmeldungen",
  "en": "Requests & sick reports"
 },
 "dash.absenceS": {
  "de": "Urlaub beantragen, krank melden",
  "en": "Request vacation, report sick"
 },
 "push.cAbsence": {
  "de": "🏖️ Entscheidung zu Urlaub / Krankmeldung",
  "en": "🏖️ Decision on vacation / sick report"
 },
 "push.cMgrAbsence": {
  "de": "🏖️ Neuer Urlaubsantrag / neue Krankmeldung",
  "en": "🏖️ New vacation request / sick report"
 },
 "set.tomiHead": {
  "de": "✨ TomiAI-Knopf",
  "en": "✨ TomiAI button"
 },
 "set.tomiShow": {
  "de": "TomiAI-Knopf anzeigen",
  "en": "Show TomiAI button"
 },
 "set.tomiShowSub": {
  "de": "Der schwebende Knopf unten links. Ausgeblendet erreichst du TomiAI weiter über das Dashboard.",
  "en": "The floating button at the bottom left. When hidden, you can still open TomiAI from the dashboard."
 },
 "set.tomiMove": {
  "de": "Knopf verschieben",
  "en": "Move button"
 },
 "set.tomiMoveSub": {
  "de": "Eingeschaltet kannst du den Knopf mit Finger oder Maus an eine beliebige Stelle ziehen. Gilt nur auf diesem Gerät.",
  "en": "When on, you can drag the button anywhere with your finger or mouse. Applies to this device only."
 },
 "set.tomiReset": {
  "de": "Position zurücksetzen",
  "en": "Reset position"
 },
 "set.tomiResetSub": {
  "de": "Bringt den Knopf an die ursprüngliche Stelle.",
  "en": "Puts the button back in its original place."
 },
 "set.tomiResetBtn": {
  "de": "↩️ Zurücksetzen",
  "en": "↩️ Reset"
 },
 "set.tabsPrev": {
  "de": "Weitere Reiter links",
  "en": "More tabs to the left"
 },
 "set.tabsNext": {
  "de": "Weitere Reiter rechts",
  "en": "More tabs to the right"
 },
 "dash.specials": {
  "de": "Tagesangebot",
  "en": "Daily specials"
 },
 "dash.specialsSub": {
  "de": "Kuchen & Suppe heute, mit Allergenen",
  "en": "Cake & soup today, with allergens"
 },
 "set.winHead": {
  "de": "🪟 Fenster",
  "en": "🪟 Windows"
 },
 "set.closeOutside": {
  "de": "Fenster per Klick daneben schließen",
  "en": "Close windows by clicking outside"
 },
 "set.closeOutsideSub": {
  "de": "Ein Klick auf den abgedunkelten Hintergrund schließt das Fenster. Hast du etwas eingetippt, bleibt es zur Sicherheit offen.",
  "en": "Clicking the dimmed background closes the window. If you have typed something, it stays open to be safe."
 },
 "dash.exclusive": {
  "de": "Exklusiv-Schicht",
  "en": "Exclusive shift"
 },
 "dash.exclusiveSub": {
  "de": "Tische, Gäste & Gerichte",
  "en": "Tables, guests & dishes"
 }
};

    function langLocale() { return currentLang === 'en' ? 'en-GB' : 'de-AT'; }

    function t(key, vars) {
      const e = I18N_DICT[key];
      let s = e ? (e[currentLang] !== undefined ? e[currentLang] : e.de) : key;
      if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
      return s;
    }

    function applyTranslations(root) {
      const scope = root || document;
      scope.querySelectorAll('[data-i18n]').forEach(el => {
        const e = I18N_DICT[el.getAttribute('data-i18n')];
        if (e) el.textContent = e[currentLang] !== undefined ? e[currentLang] : e.de;
      });
      [['data-i18n-ph', 'placeholder'], ['data-i18n-title', 'title'], ['data-i18n-aria', 'aria-label']].forEach(p => {
        scope.querySelectorAll('[' + p[0] + ']').forEach(el => {
          const e = I18N_DICT[el.getAttribute(p[0])];
          if (e) el.setAttribute(p[1], e[currentLang] !== undefined ? e[currentLang] : e.de);
        });
      });
    }

    function updateLangSwitchUI() {
      document.querySelectorAll('[data-lang]').forEach(b => b.classList.toggle('active', b.getAttribute('data-lang') === currentLang));
    }

    function setLanguage(lang) {
      if (lang !== 'de' && lang !== 'en') return;
      currentLang = lang;
      try { localStorage.setItem('nexus_lang', lang); } catch (e) {}
      document.documentElement.lang = lang;
      applyTranslations();
      updateLangSwitchUI();
      if (typeof fmApplyLocale === 'function') fmApplyLocale();
      // offene Betriebs-Fenster schließen (sie werden beim nächsten Öffnen in der neuen Sprache gezeichnet); die Hilfe zeichnet sich selbst neu
      document.querySelectorAll('.fm-root').forEach(el => { if (el.id !== 'hpModal') el.remove(); });
      if (!document.querySelector('.fm-root')) document.body.classList.remove('fm-open');
      if (typeof renderLoginGrid === 'function') renderLoginGrid();
      if (typeof currentWaiterName !== 'undefined' && currentWaiterName) {
        if (typeof applyRoleUI === 'function') applyRoleUI();
        if (typeof updateActiveSeasonBadgeUI === 'function') updateActiveSeasonBadgeUI();
        if (typeof renderDashboard === 'function') renderDashboard();
        if (typeof updateUnifiedSettingsUI === 'function') updateUnifiedSettingsUI();
        // Getränke-Seite neu zeichnen (Kategorien, Karten, Glas-Filter, Multi-View-Leiste)
        try {
          if (typeof renderCategories === 'function') renderCategories();
          if (typeof renderGlassFilterButtons === 'function') renderGlassFilterButtons();
          if (typeof renderDrinks === 'function') renderDrinks();
          if (typeof renderBarTrayUI === 'function') renderBarTrayUI();
        } catch (e) {}
      }
      if (typeof pushOnLanguageChange === 'function') pushOnLanguageChange();
      if (typeof helpOnLanguageChange === 'function') helpOnLanguageChange();
    }

    document.documentElement.lang = currentLang;
    applyTranslations();
    updateLangSwitchUI();

/* ============================================================
   js/version.js  (v4.2.00)
   DIE EINZIGE STELLE FÜR DIE VERSIONSNUMMER.

   NEUE VERSION VERÖFFENTLICHEN:
   1. Unten APP_VERSION auf die neue Nummer setzen.
   2. In js/changelog.js oben einen neuen Eintrag einfügen.
   Mehr nicht: Titel, Anzeige in der App, Zwischenspeicher („?v=“)
   aller Skripte/Stile und der Service Worker holen sich die Nummer von hier.

   Diese Datei wird in index.html OHNE „?v=“ geladen (damit sie immer frisch ist).
   ============================================================ */
    const APP_VERSION = '1.0.20';

    // Dateinamen mit Versionsnummer (Cache-Busting), z. B. appAsset('js/ui.js') -> 'js/ui.js?v=4.1.05'
    function appAsset(path) { return path + '?v=' + encodeURIComponent(APP_VERSION); }

    // Reihenfolge ist wichtig (wie früher in index.html). Neue Datei: hier an der richtigen Stelle ergänzen.
    const APP_SCRIPTS = [
      'js/config.js', 'js/i18n.js', 'js/i18n-ui.js', 'js/ui.js', 'js/settings.js', 'js/dialogs.js', 'js/pwa.js', 'js/auth.js',
      'js/profile.js', 'js/staff-admin.js', 'js/chat.js', 'js/tickets.js', 'js/changelog.js', 'js/schedule.js',
      'js/team-plan.js', 'js/roster-scan.js', 'js/feature-ui.js', 'js/checklists.js', 'js/shift-swap.js', 'js/absence.js', 'js/payroll.js',
      'js/menu-allergens.js', 'js/specials.js', 'js/exclusive.js', 'js/reservations.js', 'js/inbox.js', 'js/reports.js', 'js/help.js', 'js/push.js', 'js/presence.js', 'js/login-log.js',
      'js/intro.js', 'js/tomi.js', 'js/seasons.js', 'js/drinks.js', 'js/drink-admin.js', 'js/tray.js',
      'js/shopping.js', 'js/import-export.js', 'js/fridge-temps.js', 'js/dishwash.js', 'js/order-list.js', 'js/dashboard.js', 'js/app.js'
    ];

    // Stylesheet sofort einbinden (diese Datei steht im <head>)
    document.write('<link rel="stylesheet" href="' + appAsset('css/style.css') + '">');
    // Stil „NeXuS Glass“ (v4.2.01): Zusatz-Stylesheet und Klasse nur laden, wenn gewählt (sonst keine Mehrkosten)
    try {
      if ((JSON.parse(localStorage.getItem('salon_settings') || '{}')).skin === 'glass') {
        document.documentElement.classList.add('skin-glass');
        document.write('<link rel="stylesheet" id="skinGlassCss" href="' + appAsset('css/theme-nexus-glass.css') + '">');
      }
    } catch (e) {}
    document.title = 'Salonplafond NeXuS · KÜCHE v' + APP_VERSION;

    // Wird am Ende von <body> aufgerufen: lädt alle Skripte nacheinander (document.write = gleiche Reihenfolge und
    // gleiches Startverhalten wie fest eingetragene <script>-Zeilen).
    function loadAppScripts() {
      APP_SCRIPTS.forEach(function (p) { document.write('<script src="' + appAsset(p) + '"><\/script>'); });
    }

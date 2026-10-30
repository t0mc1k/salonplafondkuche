/* ============================================================
   js/config.js
   Grundeinstellungen: Supabase-Verbindung, Login-Token, Hilfsfunktionen (escapeHtml, jsArg) und gemeinsame Variablen
   ============================================================ */
    const SUPABASE_URL = "https://rdymkhkowbyslhfnbubk.supabase.co";
    const SUPABASE_KEY = "sb_publishable_LcNoUZdhjjZQVGd5ng5RpA_n5m7T3Cr";
    const STAFF_TOKEN_KEY = 'kueche_staff_token';
    const STAFF_TOKEN_EXP_KEY = 'kueche_staff_token_exp';
    function getStaffToken() {
      try {
        const t = sessionStorage.getItem(STAFF_TOKEN_KEY);
        const exp = Number(sessionStorage.getItem(STAFF_TOKEN_EXP_KEY) || 0);
        if (t && exp > Date.now()) return t;
      } catch (e) {}
      return '';
    }
    function setStaffSession(token) {
      sessionStorage.setItem(STAFF_TOKEN_KEY, token);
      sessionStorage.setItem(STAFF_TOKEN_EXP_KEY, String(Date.now() + 15 * 60 * 60 * 1000));
    }
    function clearStaffSession() {
      sessionStorage.removeItem(STAFF_TOKEN_KEY);
      sessionStorage.removeItem(STAFF_TOKEN_EXP_KEY);
    }
    // Dateiname für Storage bereinigen (keine Leerzeichen/Sonderzeichen, sonst lehnt Supabase den Upload ab)
    function safeFileName(name) {
      const n = String(name || 'foto').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return n.replace(/[^A-Za-z0-9._-]+/g, '_').slice(-80);
    }
    // Web-Push (Benachrichtigungen bei geschlossener App). Öffentlicher VAPID-Schlüssel hier eintragen
    // (erzeugen mit: npx web-push generate-vapid-keys). Leer = nur Mitteilungen bei geöffneter App.
    const VAPID_PUBLIC_KEY = '';

    // Rollen & Funktionen (Rolle = Rechte, Funktion = Position in der Küche, nur für Köche)
    const ROLE_LABELS = { developer: 'Developer', manager: 'Küchenchef', souschef: 'Sous Chef', staff: 'Koch' };
    const JOB_FUNCTIONS = ['Breakfast / Lunch', 'Mittag', 'Lehrling', 'Saucier', 'Garde / Saucier', 'Entre', 'Garde / Entre'];
    function roleLabel(role) { return ROLE_LABELS[role] || ROLE_LABELS.staff; }
    function isAdminRole(role) { return role === 'manager' || role === 'souschef' || role === 'developer'; }
    function rolePillClass(role) { return role === 'developer' ? 'pill-dev' : (isAdminRole(role) ? 'pill-manager' : 'pill-staff'); }
    // Text unter dem Namen: Funktion (Köche) oder Rolle (Leitung)
    function staffTitle(s) { return (s && s.role === 'staff' && s.job_title) ? s.job_title : roleLabel(s && s.role); }
    function escapeHtml(v) {
      return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    }
    function jsArg(v) {
      // sicheres Argument für onclick="...": JSON-String + HTML-Escape
      return escapeHtml(JSON.stringify(String(v == null ? '' : v)));
    }
    const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      global: {
        fetch: (input, init = {}) => {
          const url = typeof input === 'string' ? input : (input && input.url) || '';
          const token = getStaffToken();
          if (token && url.indexOf('/rest/v1/') !== -1) {
            const headers = new Headers(init.headers || {});
            headers.set('x-staff-token', token);
            return fetch(input, { ...init, headers });
          }
          return fetch(input, init);
        }
      }
    });

    let pendingAuthCallback = null;
    let currentPhotoPreviewUrl = null;
    let currentLoggedInUserEmail = "";
    
    let currentWaiterName = sessionStorage.getItem('kueche_waiter_name') || "";
    let currentWaiterAvatar = "";
    let currentStaffRole = "";
    let userIsAdmin = false;   // Küchenchef / Sous Chef / Developer (vom Server)
    let currentStaffJob = "";  // eigene Funktion (z. B. Saucier)
    let userCanEdit = false;   // darf Rezepte bearbeiten (vom Server)
    let staffDatabaseRecords = [];
    let currentEnteredPin = "";
    let selectedWaiterForPin = "";
    let chatRealtimeSubscription = null;
    let chatSidebarOpen = false;

    let viewMode = 'grid';
    let themeMode = 'dark';
    let allDishes = [];
    let selectedCat = 'Alle';
    let activeSpecialFilter = null;
    let selectedPlateFilter = null;
    let currentSeasonFilter = null;
    let isAdmin = false;
    let shiftFavorites = JSON.parse(localStorage.getItem('kueche_shift_favorites') || '[]');
    let traySelection = JSON.parse(localStorage.getItem('kueche_tray') || '[]');

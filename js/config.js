/* ============================================================
   js/config.js
   Grundeinstellungen: Supabase-Verbindung, Login-Token, Hilfsfunktionen (escapeHtml, jsArg) und gemeinsame Variablen
   ============================================================ */
    const SUPABASE_URL = "https://jhirewwpsehqrmbnuspt.supabase.co";
    const SUPABASE_KEY = "sb_publishable_CcQaQXBhDYFVHUUl4IQv2w_zB1ks42J";
    const STAFF_TOKEN_KEY = 'salon_staff_token';
    const STAFF_TOKEN_EXP_KEY = 'salon_staff_token_exp';
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

    // Bar-Datenbank: NUR LESEN (Reservierungen aus Gastronaut, Exklusiv-Schichten). Eigener Client, ohne Login der Küche.
    // Der Zugang zu den Exklusiv-Schichten läuft über einen gemeinsamen Schlüssel (docs/BAR-BRIDGE.md), nicht über diese Datei.
    const BAR_SUPABASE_URL = "https://asrrkjcxqqvxzlikdkaq.supabase.co";
    const BAR_SUPABASE_KEY = "sb_publishable_2tw50zmlzxDClPx7zwnT3g_k2WiaUuL";
    const _barSupabase = supabase.createClient(BAR_SUPABASE_URL, BAR_SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

    let pendingAuthCallback = null;
    let currentPhotoPreviewUrl = null;
    let currentLoggedInUserEmail = "";
    
    let currentWaiterName = sessionStorage.getItem('salon_waiter_name') || "";
    let currentWaiterAvatar = "";
    let currentStaffRole = "";
    let currentStaffExtraRoles = [];   // Zusatzrollen, z. B. ['dishwasher']
    function staffHasRole(r) { return currentStaffRole === r || currentStaffExtraRoles.indexOf(r) !== -1; }
    let userIsAdmin = false;   // manager / developer (vom Server)
    let userCanEdit = false;   // darf Getränke bearbeiten (vom Server)
    let staffDatabaseRecords = [];
    let currentEnteredPin = "";
    let selectedWaiterForPin = "";
    let chatRealtimeSubscription = null;
    let chatSidebarOpen = false;

    let viewMode = 'grid';
    let themeMode = 'dark';
    let allDrinks = [];
    let selectedCat = 'Alle';
    let activeSpecialFilter = null;
    let selectedGlassFilter = null;
    let currentSeasonFilter = null;
    let isAdmin = false;
    let shiftFavorites = JSON.parse(localStorage.getItem('salon_shift_favorites') || '[]');
    let barTraySelection = JSON.parse(localStorage.getItem('salon_bar_tray') || '[]');

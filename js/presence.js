/* ============================================================
   js/presence.js  (v4.1.03)
   Anwesenheit / Online-Status und Login-Protokoll (Datenquelle):
   - Beim Anmelden startet eine Sitzung (Gerät, Zeit). Alle 60 Sekunden („ping“), solange die App sichtbar ist.
   - „Online“ = in den letzten 3 Minuten gesehen (vorher 15 Minuten).
   - Geöffnete Bereiche werden gesammelt und mit dem Ping mitgeschickt (keine zusätzlichen Anfragen).
   - Wichtige Aktionen (Aufgabe abgehakt, Tausch, Störung ...) protokolliert die Datenbank selbst (Trigger).
   - Keine IP-Adressen. Aufbewahrung 90 Tage (automatisch). Nur Manager/Developer sehen das Protokoll.
   Funktionen: presence_start / presence_ping / presence_end (SQL 4.1.03). Ohne SQL läuft die App wie bisher.
   ============================================================ */

    const PRESENCE_PING_MS = 60000;
    const PRESENCE_ONLINE_MS = 3 * 60 * 1000;
    const PRESENCE_GAP_NEW_SESSION_MS = 15 * 60 * 1000;   // länger weg: neue Sitzung

    // Funktion (öffnet einen Bereich) -> Name des Bereichs im Protokoll
    const PRESENCE_SECTIONS = {
      showDashboard: 'dashboard', openDrinksView: 'drinks', openAllergenModal: 'allergens', openChecklistModal: 'checklist',
      openMyPlanModal: 'myplan', openSwapModal: 'swaps', openAbsenceModal: 'absence', openSpecialsModal: 'specials', openExclusiveModal: 'exclusive', openReservationsModal: 'reservations', openTeamChatModal: 'chat', openMaintenanceModal: 'faults',
      openLossModal: 'loss', openHelpModal: 'help', openTomiModal: 'tomi', openShoppingModal: 'shopping',
      openUserProfileModal: 'profile', openUnifiedSettingsModal: 'settings', openChangelogModal: 'news', openSupportModal: 'support',
      openTeamPlanModal: 'teamplan', openFridgeTempModal: 'fridge', openDishwashModal: 'wash', openPayrollModal: 'payroll', openStaffPinModal: 'staff', openLoginLogModal: 'loginlog',
      openSeasonModal: 'season', openImportExportModal: 'impexp', openMultiViewModal: 'multiview'
    };

    let presenceSid = null;
    let presenceMap = null;            // Name (klein) -> Zeitpunkt „zuletzt gesehen“ (ms, Uhr dieses Geräts)
    let presenceAvailable = true;
    let presenceTimer = null;
    let presenceQueue = [];
    let presenceSection = 'dashboard';
    let presenceLastPing = 0;
    let presenceLastKey = '';
    let presenceLastKeyAt = 0;
    let presenceWrapped = false;
    let presenceListeners = false;
    let presenceBusy = false;

    function presenceDevice() {
      const ua = navigator.userAgent || '';
      let os = 'Gerät';
      if (/iPhone/.test(ua)) os = 'iPhone'; else if (/iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) os = 'iPad';
      else if (/Android/.test(ua)) os = /Mobile/.test(ua) ? 'Android' : 'Android-Tablet';
      else if (/Windows/.test(ua)) os = 'Windows'; else if (/Mac OS X/.test(ua)) os = 'Mac'; else if (/Linux/.test(ua)) os = 'Linux';
      let br = '';
      if (/EdgA?\//.test(ua)) br = 'Edge'; else if (/OPR\//.test(ua)) br = 'Opera'; else if (/SamsungBrowser/.test(ua)) br = 'Samsung Browser';
      else if (/Firefox|FxiOS/.test(ua)) br = 'Firefox'; else if (/Chrome|CriOS/.test(ua)) br = 'Chrome'; else if (/Safari/.test(ua)) br = 'Safari';
      let standalone = false;
      try { standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch (e) {}
      return os + (br ? ' · ' + br : '') + (standalone ? ' (App)' : '');
    }

    // Wer ist online? (3-Minuten-Regel; ohne Anwesenheits-Daten wie bisher 15 Minuten ab letzter Aktivität)
    function isStaffOnline(s) {
      const name = String((s && s.name) || s || '').toLowerCase();
      if (presenceMap) {
        const seen = presenceMap.get(name);
        return !!seen && Date.now() - seen <= PRESENCE_ONLINE_MS;
      }
      return !!(s && s.last_used_at && Date.now() - new Date(s.last_used_at).getTime() <= 15 * 60000);
    }

    // ---------- Bereiche mitschreiben ----------
    function presenceWrapSections() {
      if (presenceWrapped) return;
      presenceWrapped = true;
      Object.keys(PRESENCE_SECTIONS).forEach(name => {
        const orig = window[name];
        if (typeof orig !== 'function') return;
        window[name] = function () { presenceLogSection(PRESENCE_SECTIONS[name]); return orig.apply(this, arguments); };
      });
    }
    function presenceLogSection(key) {
      presenceSection = key;
      const now = Date.now();
      if (key === presenceLastKey && now - presenceLastKeyAt < 5000) return;   // gleiche Seite kurz hintereinander nicht doppelt
      presenceLastKey = key; presenceLastKeyAt = now;
      if (presenceSid && presenceQueue.length < 60) presenceQueue.push({ k: 'section', d: key });
    }

    // ---------- Sitzung ----------
    async function presenceStart() {
      presenceStop();
      presenceWrapSections();
      try {
        const { data, error } = await _supabase.rpc('nx_presence_start', { p_device: presenceDevice(), p_version: (typeof APP_VERSION !== 'undefined' ? APP_VERSION : '') });
        if (error || !data) { presenceAvailable = false; presenceMap = null; return; }
        presenceAvailable = true;
        presenceSid = data;
      } catch (e) { presenceAvailable = false; return; }
      presenceQueue = [];
      presenceLastKey = '';
      presenceLogSection(presenceSection || 'dashboard');
      await presencePing();
      presenceTimer = setInterval(presenceTick, PRESENCE_PING_MS);
      if (!presenceListeners) {
        presenceListeners = true;
        document.addEventListener('visibilitychange', presenceOnVisibility);
      }
    }

    function presenceStop() {
      if (presenceTimer) { clearInterval(presenceTimer); presenceTimer = null; }
    }

    async function presenceTick() {
      if (document.hidden || !currentWaiterName) return;
      await presencePing();
    }

    async function presenceOnVisibility() {
      if (document.hidden || !currentWaiterName || !presenceAvailable) return;
      if (Date.now() - presenceLastPing > PRESENCE_GAP_NEW_SESSION_MS) {
        // lange weg gewesen: alte Sitzung beenden, neue beginnen
        const old = presenceSid;
        presenceSid = null;
        if (old) { try { await _supabase.rpc('nx_presence_end', { p_sid: old, p_reason: 'timeout', p_events: [] }); } catch (e) {} }
        await presenceStart();
      } else {
        presencePing();
      }
    }

    async function presencePing() {
      if (!presenceAvailable || !presenceSid || presenceBusy) return;
      presenceBusy = true;
      const events = presenceQueue.splice(0, 30);
      try {
        const { data, error } = await _supabase.rpc('nx_presence_ping', { p_sid: presenceSid, p_section: presenceSection, p_events: events });
        presenceLastPing = Date.now();
        if (error) { presenceQueue = events.concat(presenceQueue).slice(0, 60); return; }
        if (data && Array.isArray(data.online)) {
          const now = Date.now();
          presenceMap = new Map(data.online.map(o => [String(o.name).toLowerCase(), now - (Number(o.age_s) || 0) * 1000]));
          presenceRefreshUi();
        }
        if (data && data.session === false) {
          // Sitzung nicht mehr bekannt (z. B. Protokoll geleert): neu beginnen
          presenceSid = null;
          presenceBusy = false;
          await presenceStart();
          return;
        }
      } catch (e) {
        presenceQueue = events.concat(presenceQueue).slice(0, 60);
      }
      presenceBusy = false;
    }

    async function presenceEnd(reason) {
      presenceStop();
      const sid = presenceSid;
      presenceSid = null;
      presenceMap = null;
      if (!sid || !presenceAvailable) return;
      const events = presenceQueue.splice(0, 30);
      try {
        await Promise.race([
          _supabase.rpc('nx_presence_end', { p_sid: sid, p_reason: reason || 'logout', p_events: events }),
          new Promise(resolve => setTimeout(resolve, 1500))
        ]);
      } catch (e) {}
    }

    // Anzeigen auffrischen, die vom Online-Status abhängen
    function presenceRefreshUi() {
      try {
        const chat = document.getElementById('teamChatModal');
        if (chat && !chat.classList.contains('hidden') && typeof renderChatSidebar === 'function') renderChatSidebar();
        const label = document.getElementById('chatOnlineCountLabel');
        if (label && Array.isArray(staffDatabaseRecords) && staffDatabaseRecords.length) {
          const n = staffDatabaseRecords.filter(isStaffOnline).length;
          label.innerText = t(n === 1 ? 'chat.member1' : 'chat.memberN', { n });
        }
        const list = document.getElementById('staffPinModal');
        if (list && !list.classList.contains('hidden') && typeof renderStaffList === 'function') renderStaffList();
      } catch (e) {}
    }

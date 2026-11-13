/* ============================================================
   js/dashboard.js
   Dashboard (Startseite nach dem Login) + Wechsel zwischen
   Dashboard und Getränke-Datenbank.

   NEUE KACHEL HINZUFÜGEN: unten in dashTileDefs() einen Eintrag ergänzen
   (id, icon, title, sub, run = Funktionsname als Text, need = wer sie sieht).
   Und in dashLayoutFor() die id in die gewünschte Gruppe eintragen.
   ============================================================ */

    // ---------- Welche Kacheln gibt es? ----------
    // need: 'all' = alle, 'edit' = darf Getränke bearbeiten, 'admin' = Manager/Developer
    function dashTileDefs() {
      const seasonSub = (typeof currentSeasonFilter !== 'undefined' && currentSeasonFilter)
        ? t('menu.seasonActive', { name: currentSeasonFilter }) : t('dash.seasonSub0');
      const n = (typeof allDrinks !== 'undefined') ? allDrinks.length : 0;
      const drinkSub = n ? t('dash.drinksSub', { n }) : t('dash.drinksSub0');
      const adm = !!userIsAdmin;
      return {
        drinks:   { icon: '🍸', title: t('dash.drinks'), sub: drinkSub, run: 'openDrinksView', need: 'all', primary: true },
        allergens:{ icon: '🍽️', title: t('dash.allergens'), sub: t('dash.allergensSub'), run: 'openAllergenModal', need: 'all' },
        exclusive:{ icon: '🍽️', title: t('dash.exclusive'), sub: t('dash.exclusiveSub'), run: 'openExclusiveModal', need: 'admin' },
        specials: { icon: '🍰', title: t('dash.specials'), sub: t('dash.specialsSub'), run: 'openSpecialsModal', need: 'all' },
        reserv:   { icon: '📒', title: t('dash.reserv'), sub: t('dash.reservSub'), run: 'openReservationsModal', need: 'all' },
        season:   { icon: '📅', title: t('dash.season'), sub: seasonSub, run: 'openSeasonModal', need: 'admin' },
        impexp:   { icon: '📊', title: t('dash.impexp'), sub: t('dash.impexpSub'), run: 'openImportExportModal', need: 'edit' },
        checklist:{ icon: '✅', title: adm ? t('dash.checklistA') : t('dash.checklistS'), sub: adm ? t('dash.checklistAS') : t('dash.checklistSS'), run: 'openChecklistModal', need: 'all' },
        maint:    { icon: '🛠️', title: adm ? t('dash.maintA') : t('dash.maintS'), sub: adm ? t('dash.maintAS') : t('dash.maintSS'), run: 'openMaintenanceModal', need: 'all', badge: 'dashMaintBadge' },
        loss:     { icon: '🔨', title: adm ? t('dash.lossA') : t('dash.lossS'), sub: adm ? t('dash.lossAS') : t('dash.lossSS'), run: 'openLossModal', need: 'all' },
        wash:     { icon: '🧽', title: t('dash.wash'), sub: userIsAdmin ? t('dash.washSubA') : t('dash.washSub'), run: 'openDishwashModal', need: 'wash', primary: !userIsAdmin },
        fridge:   { icon: '🌡️', title: t('dash.fridge'), sub: t('dash.fridgeSub'), run: 'openFridgeTempModal', need: 'admin' },
        teamplan: { icon: '📆', title: t('dash.teamplan'), sub: t('dash.teamplanSub'), run: 'openTeamPlanModal', need: 'all' },
        swaps:    { icon: '🔄', title: t('dash.swaps'), sub: adm ? t('dash.swapsA') : t('dash.swapsS'), run: 'openSwapModal', need: 'all', badge: 'dashSwapBadge' },
        absence:  { icon: '🏖️', title: t('dash.absence'), sub: adm ? t('dash.absenceA') : t('dash.absenceS'), run: 'openAbsenceModal', need: 'all', badge: 'dashAbsBadge' },
        payroll:  { icon: '💶', title: t('dash.payroll'), sub: t('dash.payrollSub'), run: 'openPayrollModal', need: 'admin' },
        staff:    { icon: '👤', title: t('dash.staff'), sub: t('dash.staffSub'), run: 'openStaffPinModal', need: 'admin' },
        chat:     { icon: '💬', title: t('dash.chat'), sub: t('dash.chatSub'), run: 'openTeamChatModal', need: 'all', badge: 'dashChatBadge' },
        myplan:   { icon: '🗓️', title: t('dash.myplan'), sub: t('dash.myplanSub'), run: 'openMyPlanModal', need: 'all' },
        login:    { icon: '🔐', title: t('dash.login'), sub: t('dash.loginSub'), run: 'openLoginLogModal', need: 'admin' },
        settings: { icon: '⚙️', title: t('dash.settings'), sub: t('dash.settingsSub'), run: 'openUnifiedSettingsModal', need: 'admin' },
        news:     { icon: '🚀', title: t('dash.news'), sub: t('dash.newsSub'), run: 'openChangelogModal', need: 'all' },
        tomi:     { icon: '✨', title: t('dash.tomi'), sub: adm ? t('dash.tomiSubA') : t('dash.tomiSubS'), run: 'openTomiModal', need: 'all', ai: true },
        help:     { icon: '📖', title: t('dash.help'), sub: t('dash.helpSub'), run: 'openHelpModal', need: 'all' },
        support:  { icon: '🛟', title: t('dash.support'), sub: t('dash.supportSub'), run: 'openSupportModal', need: 'admin', badge: 'dashTicketBadge' }
      };
    }

    // ---------- Anordnung je Rolle ----------
    function dashLayoutFor() {
      if (userIsAdmin) {
        return [
          { title: t('dash.g.bar'),  ids: ['drinks', 'allergens', 'specials', 'reserv', 'exclusive', 'season', 'impexp'] },
          { title: t('dash.g.std'),  ids: ['checklist', 'fridge', 'wash', 'maint', 'loss'] },
          { title: t('dash.g.team'), ids: ['teamplan', 'swaps', 'absence', 'payroll', 'staff', 'chat'] },
          { title: t('dash.g.sys'),  ids: ['login', 'settings'] },
          { title: t('dash.g.info'), ids: ['news', 'tomi', 'help', 'support'] }
        ];
      }
      // Abwasher: Rezepte nur ansehen (Abwasher-Aufgaben kommen in einer späteren Version)
      if (currentStaffRole === 'dishwasher') {
        return [{ title: t('dash.g.shift'), ids: ['wash', 'myplan', 'teamplan', 'swaps', 'absence', 'chat', 'drinks', 'help', 'news'] }];
      }
      // Koch (+ Import, falls Rezepte-Recht)
      const bar = ['drinks', 'allergens', 'specials', 'reserv', 'maint', 'loss', 'tomi', 'help', 'news'];
      if (userCanEdit) bar.splice(1, 0, 'impexp');
      return [
        { title: t('dash.g.shift'),      ids: ['checklist', 'myplan', 'teamplan', 'swaps', 'absence', 'chat'] },
        { title: t('dash.g.barService'), ids: bar }
      ];
    }

    // ---------- Anzeigen ----------
    function dashTileHtml(id, d) {
      const badge = d.badge ? `<span id="${d.badge}" class="dash-badge hidden">0</span>` : '';
      return `
        <button type="button" onclick="dashRun(${jsArg(d.run)})" class="dash-tile${d.primary ? ' dash-tile-primary' : ''}" data-tile="${escapeHtml(id)}">
          <span class="dash-ico">${d.icon}${badge}</span>
          <span class="dash-text"><b>${escapeHtml(d.title)}</b><small>${escapeHtml(d.sub)}</small></span>
          <span class="dash-arrow">›</span>
        </button>`;
    }

    function renderDashboard() {
      const groupsEl = document.getElementById('dashGroups');
      if (!groupsEl) return;
      const defs = dashTileDefs();

      const hello = document.getElementById('dashHello');
      if (hello) {
        const h = new Date().getHours();
        hello.textContent = t(h < 11 ? 'dash.morning' : (h < 18 ? 'dash.hello' : 'dash.evening'), { name: currentWaiterName || '' });
      }
      const dateEl = document.getElementById('dashDate');
      if (dateEl) dateEl.textContent = new Date().toLocaleDateString(langLocale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      const pill = document.getElementById('dashRolePill');
      if (pill) {
        pill.textContent = ({ developer: t('role.developer'), manager: t('role.manager'), dishwasher: t('role.dishwasher') })[currentStaffRole] || t('role.kitchen');
        pill.className = 'staff-pill ' + (currentStaffRole === 'developer' ? 'pill-dev' : currentStaffRole === 'manager' ? 'pill-manager' : 'pill-staff');
      }

      if (typeof inboxRefresh === 'function') inboxRefresh();   // 🔔 Mitteilungen unter dem Datum

      groupsEl.innerHTML = dashLayoutFor().map(g => {
        const tiles = g.ids.map(id => defs[id] ? dashTileHtml(id, defs[id]) : '').join('');
        return `<section class="dash-group">
          ${g.title ? `<h3 class="dash-group-title">${escapeHtml(g.title)}</h3>` : ''}
          <div class="dash-grid">${tiles}</div>
        </section>`;
      }).join('');

      refreshDashboardBadges();
      loadDashboardCounts();
      if (typeof rsvLoadHero === 'function') rsvLoadHero();
      if (typeof pushRenderBanner === 'function') pushRenderBanner();
    }

    // Kachel antippen: Funktion aufrufen (nur bekannte Funktionen, nie beliebigen Text ausführen)
    function dashRun(fnName) {
      const allowed = Object.values(dashTileDefs()).map(d => d.run);
      if (allowed.indexOf(fnName) === -1) return;
      const fn = window[fnName];
      if (typeof fn === 'function') fn();
    }

    // Zähler auf den Kacheln (Chat ungelesen, offene Tickets, Tausch, Störungen)
    function refreshDashboardBadges() {
      const set = (id, n) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = n > 99 ? '99+' : String(n);
        el.classList.toggle('hidden', !(n > 0));
      };
      set('dashChatBadge', (typeof chatUnreadCount !== 'undefined') ? chatUnreadCount : 0);
      set('dashTicketBadge', window.dashPendingTickets || 0);
      set('dashSwapBadge', window.dashSwapCount || 0);
      set('dashAbsBadge', window.dashAbsCount || 0);
      set('dashMaintBadge', window.dashMaintCount || 0);
    }

    // Zähler für Tausch-Anfragen, Urlaub/Krank und Störungen laden (höchstens alle 20 Sekunden)
    let dashCountsAt = 0;
    async function loadDashboardCounts(force) {
      if (!currentWaiterName) return;
      if (!force && Date.now() - dashCountsAt < 20000) return;
      dashCountsAt = Date.now();
      const me = String(currentWaiterName).toLowerCase();
      try {
        const today = fmIso(new Date(Date.now() - 86400000));
        const sw = await _supabase.from('shift_swaps').select('status, kind, requester, target_name, work_date')
          .in('status', ['open', 'awaiting_manager']).gte('work_date', today);
        if (!sw.error) {
          let n = 0;
          (sw.data || []).forEach(s => {
            if (s.status === 'awaiting_manager') { if (userIsAdmin) n++; }
            else if (s.kind === 'pool' ? String(s.requester).toLowerCase() !== me : String(s.target_name || '').toLowerCase() === me) n++;
          });
          window.dashSwapCount = n;
        }
        if (userIsAdmin) {
          // Urlaubsanträge/Krankmeldungen, die auf den Manager warten (Tabelle erst ab SQL 4.1.05)
          const ab = await _supabase.from('absence_requests').select('id').eq('status', 'pending');
          if (!ab.error) window.dashAbsCount = (ab.data || []).length;
        }
        if (userIsAdmin) {
          const mt = await _supabase.from('maintenance_reports').select('id').eq('status', 'neu');
          if (!mt.error) window.dashMaintCount = (mt.data || []).length;
        }
      } catch (e) {}
      refreshDashboardBadges();
    }

    // ---------- Wechsel Dashboard <-> Getränke-Datenbank ----------
    function isDrinksViewOpen() {
      const v = document.getElementById('drinksView');
      return !!v && !v.classList.contains('hidden');
    }

    function showDashboard(opts) {
      const o = opts || {};
      const dash = document.getElementById('dashboardView');
      const drinks = document.getElementById('drinksView');
      if (!dash || !drinks) return;
      closeSettingsMenu();
      renderDashboard();
      drinks.classList.add('hidden');
      dash.classList.remove('hidden');
      document.body.classList.add('on-dashboard');
      if (!o.fromPopState && history.state && history.state.view === 'drinks') {
        // Zurück-Knopf der App = Zurück im Browser, damit der Verlauf stimmt
        try { history.back(); return; } catch (e) {}
      }
      window.scrollTo({ top: 0 });
    }

    function openDrinksView(opts) {
      const o = opts || {};
      const dash = document.getElementById('dashboardView');
      const drinks = document.getElementById('drinksView');
      if (!dash || !drinks) return;
      closeSettingsMenu();
      dash.classList.add('hidden');
      drinks.classList.remove('hidden');
      document.body.classList.remove('on-dashboard');
      if (!o.fromPopState) {
        try { history.pushState({ view: 'drinks' }, '', '#drinks'); } catch (e) {}
      }
      window.scrollTo({ top: 0 });
    }

    // Android-Zurück / Browser-Zurück: aus der Datenbank zurück zum Dashboard
    window.addEventListener('popstate', () => {
      if (!currentWaiterName) return;
      if (history.state && history.state.view === 'drinks') openDrinksView({ fromPopState: true });
      else showDashboard({ fromPopState: true });
    });


    // ---------- Startseite nach dem Login (Dashboard oder Getränke) ----------
    // Gespeichert im Konto (Funktionen get/set_my_start_page, SQL 4.0.02) und als Kopie im Gerät.
    let userStartPage = 'dashboard';

    function startPageKey() { return 'nexus_start_' + String(currentWaiterName || '').toLowerCase(); }

    function readLocalStartPage() {
      try { return localStorage.getItem(startPageKey()) === 'drinks' ? 'drinks' : 'dashboard'; } catch (e) { return 'dashboard'; }
    }

    async function loadStartPage() {
      userStartPage = readLocalStartPage();
      if (typeof readLocalIntro === 'function') userIntroEnabled = readLocalIntro();
      const timeout = () => new Promise(resolve => setTimeout(() => resolve({ timeout: true }), 1500));
      try {
        // Neu (SQL 4.1.03): Startseite und Begrüßungsanimation in einer Abfrage
        const res = await Promise.race([_supabase.rpc('get_my_ui_prefs'), timeout()]);
        if (res && !res.timeout && !res.error && res.data && typeof res.data === 'object') {
          if (res.data.start_page === 'drinks' || res.data.start_page === 'dashboard') {
            userStartPage = res.data.start_page;
            try { localStorage.setItem(startPageKey(), userStartPage); } catch (e) {}
          }
          if (typeof res.data.intro === 'boolean') {
            userIntroEnabled = res.data.intro;
            try { localStorage.setItem(introLocalKey(), userIntroEnabled ? 'on' : 'off'); } catch (e) {}
          }
        } else {
          // Ältere Datenbank (nur SQL 4.0.02): nur die Startseite
          const r2 = await Promise.race([_supabase.rpc('get_my_start_page'), timeout()]);
          if (r2 && !r2.timeout && !r2.error && (r2.data === 'drinks' || r2.data === 'dashboard')) {
            userStartPage = r2.data;
            try { localStorage.setItem(startPageKey(), r2.data); } catch (e) {}
          }
        }
      } catch (e) {}
      updateStartPageUI();
      if (typeof updateIntroUI === 'function') updateIntroUI();
      return userStartPage;
    }

    async function setStartPage(page) {
      userStartPage = page === 'drinks' ? 'drinks' : 'dashboard';
      try { localStorage.setItem(startPageKey(), userStartPage); } catch (e) {}
      updateStartPageUI();
      const { error } = await _supabase.rpc('set_my_start_page', { p_page: userStartPage });
      fmToast(error ? t('set.startDeviceOnly') : t('set.startSaved'));
    }

    function updateStartPageUI() {
      document.querySelectorAll('[data-startpage]').forEach(b => b.classList.toggle('active', b.getAttribute('data-startpage') === userStartPage));
    }

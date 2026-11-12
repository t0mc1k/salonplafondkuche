/* ============================================================
   js/settings.js
   Einstellungen & Zentrale: persönliche Einstellungen dieses Geräts
   (Design, Schrift, Ansicht, Blur, Sortierung, Hinweise ...)
   Gespeichert im Browser (localStorage), gelten nur auf diesem Gerät.
   ============================================================ */
    const SETTINGS_KEY = 'salon_settings';
    const SETTINGS_DEFAULTS = {
      theme: 'dark',          // 'dark' | 'light' | 'auto'
      skin: 'classic',        // 'classic' | 'glass' (NeXuS Glass, v4.2.01, siehe css/theme-nexus-glass.css)
      fontScale: 100,         // Prozent: 90 | 100 | 112 | 125
      viewMode: 'grid',       // 'grid' | 'list'
      sort: 'newest',         // newest | name_asc | name_desc | price_asc | price_desc | favorites
      showPrices: true,
      reduceMotion: false,
      loginToast: true,       // Hinweis, wenn sich ein Kollege anmeldet
      chatToast: true,        // Hinweis bei neuer Chat-Nachricht
      chatSound: false,       // Ton bei neuer Chat-Nachricht
      tomiFab: true,          // TomiAI-Knopf auf dem Bildschirm anzeigen (v4.1.05)
      tomiMove: false,        // TomiAI-Knopf verschiebbar (v4.1.05); Position siehe tomi.js
      closeOutside: true      // Fenster per Klick auf den Hintergrund schließen (v4.1.07, siehe dialogs.js)
    };
    let appSettings = Object.assign({}, SETTINGS_DEFAULTS);

    function loadSettings() {
      try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (raw) Object.assign(appSettings, JSON.parse(raw));
      } catch (e) {}
      if (['dark', 'light', 'auto'].indexOf(appSettings.theme) === -1) appSettings.theme = 'dark';
      if (appSettings.skin !== 'glass') appSettings.skin = 'classic';
      viewMode = appSettings.viewMode === 'list' ? 'list' : 'grid';
    }

    function saveSettings() {
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(appSettings));
        localStorage.setItem('salon_theme', appSettings.theme);   // wird beim Start vor dem Rendern gelesen
      } catch (e) {}
    }

    function getSetting(key) {
      return appSettings[key];
    }

    // ---------- Design (Dunkel / Hell / Automatisch) ----------
    function resolveTheme() {
      if (appSettings.skin === 'glass') return 'dark';   // NeXuS Glass ist immer dunkel
      if (appSettings.theme === 'auto') {
        const dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        return dark ? 'dark' : 'light';
      }
      return appSettings.theme;
    }

    function applyTheme() {
      themeMode = resolveTheme();
      const dark = themeMode === 'dark';
      document.documentElement.classList.toggle('dark', dark);
      document.body.classList.toggle('dark-mode', dark);
      document.body.classList.toggle('light-mode', !dark);
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', dark ? '#0f172a' : '#f6f4ef');
    }

    // Stil „NeXuS Glass“: Zusatz-Stylesheet erst beim Einschalten laden
    function applySkin() {
      const glass = appSettings.skin === 'glass';
      if (glass && !document.getElementById('skinGlassCss')) {
        const l = document.createElement('link');
        l.rel = 'stylesheet'; l.id = 'skinGlassCss'; l.href = appAsset('css/theme-nexus-glass.css');
        document.head.appendChild(l);
      }
      document.documentElement.classList.toggle('skin-glass', glass);
    }

    // Stil gehört zur Person: Konto (SQL 4.2.01) + Kopie pro Person im Gerät
    function skinKey() { return 'nexus_skin_' + String(currentWaiterName || '').toLowerCase(); }

    async function loadUserSkin() {
      let skin = null;
      try { skin = localStorage.getItem(skinKey()); } catch (e) {}
      try {
        const res = await Promise.race([_supabase.rpc('get_my_skin'), new Promise(r => setTimeout(() => r({ timeout: true }), 1500))]);
        if (res && !res.timeout && !res.error && (res.data === 'glass' || res.data === 'classic')) {
          skin = res.data;
          try { localStorage.setItem(skinKey(), skin); } catch (e) {}
        }
      } catch (e) {}
      if ((skin === 'glass' || skin === 'classic') && skin !== appSettings.skin) {
        appSettings.skin = skin;
        saveSettings();
        applySkin();
        applyTheme();
        updateUnifiedSettingsUI();
      }
    }

    async function saveUserSkin(skin) {
      try { localStorage.setItem(skinKey(), skin); } catch (e) {}
      try { await _supabase.rpc('set_my_skin', { p_skin: skin }); } catch (e) {}
    }

    function toggleThemeMode() {
      setSetting('theme', themeMode === 'dark' ? 'light' : 'dark');
    }

    // ---------- Weichzeichner (Blur) ----------
    function isBlurEnabled() {
      return document.documentElement.classList.contains('blur-on');
    }

    function setBlurEnabled(on) {
      document.documentElement.classList.toggle('blur-on', !!on);
      try { localStorage.setItem('salon_blur', on ? 'on' : 'off'); } catch (e) {}
      updateUnifiedSettingsUI();
    }

    function toggleBlurEffect() {
      setBlurEnabled(!isBlurEnabled());
    }

    // ---------- Einstellung setzen / anwenden ----------
    function setSetting(key, value) {
      if (key === 'fontScale') value = Number(value);
      appSettings[key] = value;
      saveSettings();
      if (key === 'skin') saveUserSkin(value);
      applySetting(key);
      updateUnifiedSettingsUI();
    }

    function applySetting(key) {
      switch (key) {
        case 'theme': applyTheme(); break;
        case 'skin': applySkin(); applyTheme(); break;
        case 'fontScale': document.documentElement.style.fontSize = appSettings.fontScale + '%'; break;
        case 'reduceMotion': document.documentElement.classList.toggle('reduce-motion', !!appSettings.reduceMotion); break;
        case 'tomiFab':
        case 'tomiMove':
          document.documentElement.classList.toggle('tomi-fab-off', appSettings.tomiFab === false);
          if (typeof tomiFabApply === 'function') tomiFabApply();
          break;
        case 'sort':
        case 'showPrices':
          if (typeof renderDrinks === 'function' && Array.isArray(allDrinks) && allDrinks.length) renderDrinks();
          break;
      }
    }

    function applyAllSettings() {
      applySkin();
      applyTheme();
      applySetting('fontScale');
      applySetting('reduceMotion');
      applySetting('tomiFab');
      if (!applyAllSettings._bound && window.matchMedia) {
        applyAllSettings._bound = true;
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const onChange = () => { if (appSettings.theme === 'auto') applyTheme(); };
        if (mq.addEventListener) mq.addEventListener('change', onChange);
      }
    }

    function resetSettings() {
      if (!confirm('Alle Einstellungen dieses Geräts auf Standard zurücksetzen?')) return;
      appSettings = Object.assign({}, SETTINGS_DEFAULTS);
      viewMode = 'grid';
      saveSettings();
      if (typeof tomiFabResetPosition === 'function') tomiFabResetPosition(true);
      setBlurEnabled(true);
      applyAllSettings();
      renderDrinks();
      updateUnifiedSettingsUI();
      showAppToast({ initial: '↩️', title: 'Einstellungen zurückgesetzt', text: 'Alles steht wieder auf Standard.' });
    }

    // ---------- Getränke: Ansicht & Sortierung ----------
    function setViewMode(mode) {
      viewMode = mode === 'list' ? 'list' : 'grid';
      appSettings.viewMode = viewMode;
      saveSettings();
      updateUnifiedSettingsUI();
      renderDrinks();
    }

    function sortDrinks(list) {
      const mode = appSettings.sort;
      if (mode === 'newest') return list;   // schon nach Erstellung sortiert
      const cmp = (a, b) => String(a || '').localeCompare(String(b || ''), 'de', { sensitivity: 'base' });
      const price = d => (d.selling_price === null || d.selling_price === undefined || d.selling_price === '') ? null : parseFloat(d.selling_price);
      const arr = list.slice();
      if (mode === 'name_asc') arr.sort((a, b) => cmp(a.name, b.name));
      else if (mode === 'name_desc') arr.sort((a, b) => cmp(b.name, a.name));
      else if (mode === 'price_asc' || mode === 'price_desc') {
        const dir = mode === 'price_asc' ? 1 : -1;
        arr.sort((a, b) => {
          const pa = price(a), pb = price(b);
          if (pa === null && pb === null) return 0;
          if (pa === null) return 1;      // ohne Preis immer ans Ende
          if (pb === null) return -1;
          return (pa - pb) * dir;
        });
      } else if (mode === 'favorites') {
        arr.sort((a, b) => (shiftFavorites.includes(b.id) ? 1 : 0) - (shiftFavorites.includes(a.id) ? 1 : 0));
      }
      return arr;
    }

    // ---------- Dialog „Einstellungen & Zentrale“ ----------
    function openUnifiedSettingsModal() {
      closeSettingsMenu();
      renderUnifiedSeasonSelect();
      updateUnifiedSettingsUI();
      const modal = document.getElementById('unifiedSettingsModal');
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      let tab = 'general';
      try { tab = localStorage.getItem('nexus_settings_tab') || 'general'; } catch (e) {}
      setSettingsTab(tab);
      setTimeout(settingsTabsUpdate, 0);
    }

    function closeUnifiedSettingsModal() {
      const modal = document.getElementById('unifiedSettingsModal');
      modal.classList.remove('flex');
      modal.classList.add('hidden');
    }

    function updateUnifiedSettingsUI() {
      // Auswahl-Knöpfe (Segmente)
      document.querySelectorAll('[data-setting]').forEach(btn => {
        const key = btn.getAttribute('data-setting');
        btn.classList.toggle('active', String(appSettings[key]) === btn.getAttribute('data-value'));
      });
      // Schalter
      document.querySelectorAll('[data-setting-check]').forEach(input => {
        input.checked = !!appSettings[input.getAttribute('data-setting-check')];
      });
      const blurCheck = document.getElementById('unifiedBlurCheck');
      if (blurCheck) blurCheck.checked = isBlurEnabled();

      const moveRows = document.getElementById('setTomiMoveRows');
      if (moveRows) moveRows.classList.toggle('hidden', appSettings.tomiFab === false);

      const sortSel = document.getElementById('unifiedSortSelect');
      if (sortSel) sortSel.value = appSettings.sort;

      // Verwaltungs-Ansicht nur für Mitarbeiter mit Rechten
      const modeGroup = document.getElementById('setGroupMode');
      if (modeGroup) modeGroup.classList.toggle('hidden', !(userIsAdmin || userCanEdit));
      ['Staff', 'Admin'].forEach(k => {
        const b = document.getElementById('unifiedMode' + k);
        if (b) b.classList.toggle('active', k === 'Admin' ? !!isAdmin : !isAdmin);
      });

      const themeInfo = document.getElementById('settingsThemeInfo');
      if (themeInfo) themeInfo.textContent = appSettings.theme === 'auto'
        ? t('set.themeAuto', { mode: themeMode === 'dark' ? t('set.themeDark') : t('set.themeLight') }) : '';
      if (typeof updateStartPageUI === 'function') updateStartPageUI();
      if (typeof updateIntroUI === 'function') updateIntroUI();
      if (typeof pushRefresh === 'function') pushRefresh();
      const accName = document.getElementById('setAccName');
      if (accName) accName.textContent = currentWaiterName || '–';
      const accRole = document.getElementById('setAccRole');
      if (accRole) accRole.textContent = ({ developer: t('role.developer'), manager: t('role.manager') }[currentStaffRole]) || t('role.staff');
    }

    function setAdminView(on) {
      if (!userIsAdmin && !userCanEdit) return;
      isAdmin = !!on;
      if (!isAdmin && typeof resetForm === 'function') resetForm();
      applyRoleUI();
      renderDrinks();
      updateUnifiedSettingsUI();
    }

    function renderUnifiedSeasonSelect() {
      const seasons = getAllSeasons();
      const select = document.getElementById('unifiedSeasonSelect');
      let html = '';
      seasons.forEach(s => {
        html += `<option value="${escapeHtml(s)}" ${currentSeasonFilter === s ? 'selected' : ''}>📅 ${escapeHtml(s)}</option>`;
      });
      select.innerHTML = html;
    }

    function onUnifiedSeasonChange(selectEl) {
      selectSeason(selectEl.value);
    }

    loadSettings();

    // Einstellungen in Reitern: den zuletzt benutzten Reiter merkt sich das Gerät
    function setSettingsTab(id) {
      if (['general', 'look', 'drinks', 'notif', 'account', 'app'].indexOf(id) === -1) id = 'general';
      document.querySelectorAll('#settingsTabs .set-tab').forEach(b => b.classList.toggle('active', b.getAttribute('data-settab') === id));
      document.querySelectorAll('#settingsBody .set-panel').forEach(p => p.classList.toggle('active', p.getAttribute('data-panel') === id));
      try { localStorage.setItem('nexus_settings_tab', id); } catch (e) {}
      const body = document.getElementById('settingsBody');
      if (body) body.scrollTop = 0;
      // Aktiven Reiter nur seitlich ins Bild holen (ohne die Seite zu verschieben)
      const bar = document.getElementById('settingsTabs'), act = document.querySelector('#settingsTabs .set-tab.active');
      if (bar && act) {
        const l = act.offsetLeft - bar.offsetLeft, r = l + act.offsetWidth;
        if (l < bar.scrollLeft) bar.scrollLeft = Math.max(0, l - 40);
        else if (r > bar.scrollLeft + bar.clientWidth) bar.scrollLeft = r - bar.clientWidth + 40;
      }
      settingsTabsUpdate();
    }

    // ---------- Einstellungs-Reiter: Pfeile, Mausrad und Ziehen (v4.1.05) ----------
    // Die Pfeile erscheinen nur, wenn links/rechts noch weitere Reiter versteckt sind.
    function settingsTabsUpdate() {
      const bar = document.getElementById('settingsTabs');
      const wrap = document.getElementById('settingsTabsWrap');
      if (!bar || !wrap) return;
      const max = bar.scrollWidth - bar.clientWidth;
      const canLeft = bar.scrollLeft > 4;
      const canRight = max > 4 && bar.scrollLeft < max - 4;
      wrap.classList.toggle('can-left', canLeft);
      wrap.classList.toggle('can-right', canRight);
    }

    function settingsTabsScroll(dir) {
      const bar = document.getElementById('settingsTabs');
      if (!bar) return;
      const step = Math.max(120, Math.round(bar.clientWidth * 0.7));
      try { bar.scrollBy({ left: dir * step, behavior: 'smooth' }); } catch (e) { bar.scrollLeft += dir * step; }
    }

    function settingsTabsInit() {
      const bar = document.getElementById('settingsTabs');
      if (!bar || bar._init) return;
      bar._init = true;
      bar.addEventListener('scroll', settingsTabsUpdate, { passive: true });
      window.addEventListener('resize', settingsTabsUpdate);
      // Mausrad: senkrechtes Rollen bewegt die Reiter seitwärts
      bar.addEventListener('wheel', e => {
        if (bar.scrollWidth <= bar.clientWidth) return;
        const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        if (!d) return;
        bar.scrollLeft += d;
        e.preventDefault();
      }, { passive: false });
      // Mit gedrückter Maustaste ziehen (Touch scrollt ohnehin von selbst)
      let down = false, moved = false, startX = 0, startLeft = 0;
      bar.addEventListener('mousedown', e => {
        if (e.button !== 0 || bar.scrollWidth <= bar.clientWidth) return;
        down = true; moved = false; startX = e.clientX; startLeft = bar.scrollLeft;
      });
      window.addEventListener('mousemove', e => {
        if (!down) return;
        const dx = e.clientX - startX;
        if (Math.abs(dx) > 4) { moved = true; bar.classList.add('dragging'); }
        if (moved) bar.scrollLeft = startLeft - dx;
      });
      window.addEventListener('mouseup', () => {
        if (!down) return;
        down = false;
        bar.classList.remove('dragging');
      });
      // Nach dem Ziehen keinen Klick auf einen Reiter auslösen
      bar.addEventListener('click', e => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
    }
    settingsTabsInit();

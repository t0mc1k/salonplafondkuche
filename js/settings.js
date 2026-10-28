/* ============================================================
   js/settings.js
   Einstellungen & Zentrale: persönliche Einstellungen dieses Geräts
   (Design, Schrift, Ansicht, Blur, Sortierung, Hinweise ...)
   Gespeichert im Browser (localStorage), gelten nur auf diesem Gerät.
   ============================================================ */
    const SETTINGS_KEY = 'kueche_settings';
    const SETTINGS_DEFAULTS = {
      theme: 'dark',          // 'dark' | 'light' | 'auto'
      fontScale: 100,         // Prozent: 90 | 100 | 112 | 125
      viewMode: 'grid',       // 'grid' | 'list'
      sort: 'newest',         // newest | name_asc | name_desc | price_asc | price_desc | favorites
      showPrices: true,
      reduceMotion: false,
      loginToast: true,       // Hinweis, wenn sich ein Kollege anmeldet
      chatToast: true,        // Hinweis bei neuer Chat-Nachricht
      chatSound: false        // Ton bei neuer Chat-Nachricht
    };
    let appSettings = Object.assign({}, SETTINGS_DEFAULTS);

    function loadSettings() {
      try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (raw) Object.assign(appSettings, JSON.parse(raw));
      } catch (e) {}
      if (['dark', 'light', 'auto'].indexOf(appSettings.theme) === -1) appSettings.theme = 'dark';
      viewMode = appSettings.viewMode === 'list' ? 'list' : 'grid';
    }

    function saveSettings() {
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(appSettings));
        localStorage.setItem('kueche_theme', appSettings.theme);   // wird beim Start vor dem Rendern gelesen
      } catch (e) {}
    }

    function getSetting(key) {
      return appSettings[key];
    }

    // ---------- Design (Dunkel / Hell / Automatisch) ----------
    function resolveTheme() {
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

    function toggleThemeMode() {
      setSetting('theme', themeMode === 'dark' ? 'light' : 'dark');
    }

    // ---------- Weichzeichner (Blur) ----------
    function isBlurEnabled() {
      return document.documentElement.classList.contains('blur-on');
    }

    function setBlurEnabled(on) {
      document.documentElement.classList.toggle('blur-on', !!on);
      try { localStorage.setItem('kueche_blur', on ? 'on' : 'off'); } catch (e) {}
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
      applySetting(key);
      updateUnifiedSettingsUI();
    }

    function applySetting(key) {
      switch (key) {
        case 'theme': applyTheme(); break;
        case 'fontScale': document.documentElement.style.fontSize = appSettings.fontScale + '%'; break;
        case 'reduceMotion': document.documentElement.classList.toggle('reduce-motion', !!appSettings.reduceMotion); break;
        case 'sort':
        case 'showPrices':
          if (typeof renderDishes === 'function' && Array.isArray(allDishes) && allDishes.length) renderDishes();
          break;
      }
    }

    function applyAllSettings() {
      applyTheme();
      applySetting('fontScale');
      applySetting('reduceMotion');
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
      setBlurEnabled(true);
      applyAllSettings();
      renderDishes();
      updateUnifiedSettingsUI();
      showAppToast({ initial: '↩️', title: 'Einstellungen zurückgesetzt', text: 'Alles steht wieder auf Standard.' });
    }

    function reloadApp() {
      location.reload();
    }

    // ---------- Gerichte: Ansicht & Sortierung ----------
    function setViewMode(mode) {
      viewMode = mode === 'list' ? 'list' : 'grid';
      appSettings.viewMode = viewMode;
      saveSettings();
      updateUnifiedSettingsUI();
      renderDishes();
    }

    function sortDishes(list) {
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
      const body = document.getElementById('settingsBody');
      if (body) body.scrollTop = 0;
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
        ? 'Folgt dem Gerät – aktuell: ' + (themeMode === 'dark' ? 'Dunkel' : 'Hell') : '';
    }

    function setAdminView(on) {
      if (!userIsAdmin && !userCanEdit) return;
      isAdmin = !!on;
      if (!isAdmin && typeof resetForm === 'function') resetForm();
      applyRoleUI();
      renderDishes();
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

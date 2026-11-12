/* ============================================================
   js/auth.js
   Anmeldung per PIN, Rollen/Rechte, Abmelden, Berechtigungsprüfung
   ============================================================ */
    async function fetchStaffByName(name) {
      const { data, error } = await _supabase.rpc('list_staff');
      if (error) return { data: null, error };
      const rec = (data || []).find(x => x.name === name);
      return { data: rec || null, error: rec ? null : { message: 'nicht gefunden' } };
    }

    // ---------- Anmeldung: Namen wählen ----------
    // Eine kompakte Liste für alle: oben „Zuletzt“ (max. 3), darunter alle Namen A–Z.
    // Leitung (Manager/Developer) ist nur klein beschriftet. Suche erscheint ab 8 Personen.
    function getRecentLogins() {
      try {
        const list = JSON.parse(localStorage.getItem('salon_recent_logins') || '[]');
        return Array.isArray(list) ? list.filter(n => typeof n === 'string') : [];
      } catch (e) { return []; }
    }

    function rememberRecentLogin(name) {
      try {
        const list = getRecentLogins().filter(n => n.toLowerCase() !== String(name).toLowerCase());
        list.unshift(name);
        localStorage.setItem('salon_recent_logins', JSON.stringify(list.slice(0, 3)));
      } catch (e) {}
    }

    function loginAvatarHtml(staff, size) {
      return staff.avatar_url
        ? `<img src="${escapeHtml(staff.avatar_url)}" class="login-av ${size || ''}" alt="">`
        : `<span class="login-av ${size || ''}">${escapeHtml(String(staff.name).charAt(0).toUpperCase())}</span>`;
    }

    function loginTileHtml(staff) {
      const role = ({ developer: t('role.developer'), manager: t('role.manager'), dishwasher: t('role.dishwasher') }[staff.role]) || '';
      return `
        <button type="button" onclick="selectWaiterForLogin(${jsArg(staff.name)})" class="login-tile" title="${escapeHtml(staff.name)}">
          ${loginAvatarHtml(staff)}
          <span class="login-name">${escapeHtml(staff.name)}</span>
          ${role ? `<span class="login-role">${escapeHtml(role)}</span>` : ''}
        </button>`;
    }

    function sortedStaff(list) {
      return list.slice().sort((a, b) => String(a.name).localeCompare(String(b.name), 'de', { sensitivity: 'base' }));
    }

    function renderLoginGrid() {
      const container = document.getElementById('waiterGridContainer');
      const searchRow = document.getElementById('loginSearchRow');
      const recentRow = document.getElementById('loginRecentRow');
      if (!container) return;
      const data = staffDatabaseRecords || [];

      if (!data.length) {
        container.innerHTML = `<p class="login-empty">${escapeHtml(t('login.noStaff'))}</p>`;
        if (searchRow) searchRow.classList.add('hidden');
        if (recentRow) recentRow.innerHTML = '';
        return;
      }

      if (searchRow) searchRow.classList.toggle('hidden', data.length < 8);
      const q = ((document.getElementById('loginSearchInput') || {}).value || '').trim().toLowerCase();

      if (recentRow) {
        const recent = q ? [] : getRecentLogins().map(n => data.find(s => String(s.name).toLowerCase() === n.toLowerCase())).filter(Boolean);
        recentRow.innerHTML = recent.map(s => `
          <button type="button" onclick="selectWaiterForLogin(${jsArg(s.name)})" class="login-chip" title="${escapeHtml(t('login.recent'))}">
            ${loginAvatarHtml(s, 'sm')}<span>${escapeHtml(s.name)}</span>
          </button>`).join('');
      }

      const list = sortedStaff(data.filter(s => !q || String(s.name).toLowerCase().indexOf(q) !== -1));
      container.innerHTML = list.length
        ? `<div class="login-grid">${list.map(loginTileHtml).join('')}</div>`
        : `<p class="login-empty">${escapeHtml(t('login.noName'))}</p>`;
    }

    function loginPickFirstMatch() {
      const first = document.querySelector('#waiterGridContainer .login-tile');
      if (first) first.click();
    }

    async function loadStaffPresenceRecordsForLogin() {
      const { data, error } = await _supabase.rpc('list_staff');
      if (error || !data || data.length === 0) {
        staffDatabaseRecords = [];
        renderLoginGrid();
        return;
      }
      staffDatabaseRecords = data;
      renderLoginGrid();
    }

    function selectWaiterForLogin(name) {
      selectedWaiterForPin = name;
      document.getElementById('selectedWaiterLabel').innerText = name;
      const rec = (staffDatabaseRecords || []).find(x => x.name === name);
      document.getElementById('selectedWaiterAvatar').outerHTML = loginAvatarHtml(rec || { name: name }, 'lg').replace('class="login-av', 'id="selectedWaiterAvatar" class="login-av');
      document.getElementById('loginPickerWrap').classList.add('hidden');
      document.getElementById('pinInputSection').classList.remove('hidden');
      currentEnteredPin = "";
      updatePinDisplay();
      document.getElementById('pinAuthError').classList.add('hidden');
    }

    function resetWaiterSelection() {
      selectedWaiterForPin = "";
      document.getElementById('selectedWaiterLabel').innerText = "";
      const sInput = document.getElementById('loginSearchInput');
      if (sInput) sInput.value = '';
      renderLoginGrid();
      document.getElementById('pinInputSection').classList.add('hidden');
      document.getElementById('loginPickerWrap').classList.remove('hidden');
      currentEnteredPin = "";
      updatePinDisplay();
      document.getElementById('pinAuthError').classList.add('hidden');
    }

    function appendPinNum(num) {
      if (currentEnteredPin.length < 6) {
        currentEnteredPin += num;
        updatePinDisplay();
      }
    }

    function clearPinInput() {
      currentEnteredPin = "";
      updatePinDisplay();
      document.getElementById('pinAuthError').classList.add('hidden');
    }

    function backspacePinInput() {
      currentEnteredPin = currentEnteredPin.slice(0, -1);
      updatePinDisplay();
      document.getElementById('pinAuthError').classList.add('hidden');
    }

    function updatePinDisplay() {
      const inputEl = document.getElementById('loginPinInput');
      inputEl.value = "•".repeat(currentEnteredPin.length);
      const dots = document.getElementById('loginPinDots');
      if (dots) {
        const total = Math.max(4, currentEnteredPin.length);
        dots.innerHTML = Array.from({ length: total }, (_, i) => `<span class="login-dot${i < currentEnteredPin.length ? ' on' : ''}"></span>`).join('');
      }
    }

    let pinLoginBusy = false;
    async function submitPinLogin() {
      const errDiv = document.getElementById('pinAuthError');
      errDiv.classList.add('hidden');
      if (!selectedWaiterForPin || pinLoginBusy) return;

      if (currentEnteredPin.length < 4) {
        errDiv.innerText = t('login.pin4');
        errDiv.classList.remove('hidden');
        return;
      }

      pinLoginBusy = true;
      const { data, error } = await _supabase.rpc('login_with_pin', { p_name: selectedWaiterForPin, p_pin: currentEnteredPin });
      pinLoginBusy = false;

      if (error) {
        errDiv.innerText = (error.message || '').indexOf('Zu viele') !== -1
          ? t('login.tooMany')
          : t('login.error', { msg: error.message });
        errDiv.classList.remove('hidden');
        currentEnteredPin = "";
        updatePinDisplay();
        return;
      }

      const row = Array.isArray(data) ? data[0] : data;
      if (!row) {
        errDiv.innerText = t('login.wrongPin');
        errDiv.classList.remove('hidden');
        currentEnteredPin = "";
        updatePinDisplay();
        return;
      }

      setStaffSession(row.out_token);
      rememberRecentLogin(row.out_name);
      currentWaiterName = row.out_name;
      sessionStorage.setItem('salon_waiter_name', currentWaiterName);
      currentEnteredPin = "";
      updatePinDisplay();
      await finalizeAppStartForStaff({
        name: row.out_name,
        role: row.out_role,
        avatar_url: row.out_avatar,
        can_edit_drinks: row.out_can_edit_drinks,
        extra_roles: row.out_extra_roles
      }, { fresh: true });
    }

    async function finalizeAppStartForStaff(staffRecord, opts) {
      document.getElementById('authContainer').classList.add('hidden');
      document.getElementById('appContainer').classList.remove('hidden');

      currentWaiterAvatar = staffRecord.avatar_url || "";
      updateHeaderAvatarUI();

      currentStaffRole = staffRecord.role || 'kitchen';
      currentStaffExtraRoles = Array.isArray(staffRecord.extra_roles) ? staffRecord.extra_roles : [];
      userIsAdmin = (currentStaffRole === 'manager' || currentStaffRole === 'developer');
      userCanEdit = userIsAdmin || staffRecord.can_edit_drinks === true;
      isAdmin = userIsAdmin || userCanEdit;   // Verwaltungsansicht standardmäßig an
      applyRoleUI();

      await loadDrinks();
      await checkPendingTicketsBadge();
      setupChatRealtimeListener();
      startLoginWatcher();
      // Startseite nach dem Login: Dashboard (Standard) oder Getränke, je nach Einstellung des Kontos
      await loadStartPage();
      if (typeof loadUserSkin === 'function') await loadUserSkin();   // Stil „NeXuS Glass“ dieser Person (v4.2.01)
      showDashboard();
      if (userStartPage === 'drinks') openDrinksView();
      if (typeof pushOnLogin === 'function') pushOnLogin();   // Gerät für Benachrichtigungen dieser Person zuordnen
      if (typeof presenceStart === 'function') presenceStart();   // Sitzung für Login-Protokoll / Online-Status
      if (opts && opts.fresh && typeof introMaybePlay === 'function') introMaybePlay();   // Begrüßungsanimation (nur nach echter Anmeldung)
    }

    // ---------- Hinweis, wenn sich ein Kollege anmeldet ----------
    let loginWatchTimer = null;
    let loginWatchBaseline = null;   // Map: Name -> letzter Login (ms)

    async function pollLoginWatcher() {
      if (document.hidden || !currentWaiterName) return;
      const { data, error } = await _supabase.rpc('list_staff');
      if (error || !Array.isArray(data)) return;

      const fresh = new Map(data.map(st => [st.name, st.last_used_at ? new Date(st.last_used_at).getTime() : 0]));
      if (loginWatchBaseline) {
        data.forEach(st => {
          const before = loginWatchBaseline.get(st.name) || 0;
          const now = fresh.get(st.name) || 0;
          const isMe = st.name.toLowerCase() === currentWaiterName.toLowerCase();
          const recent = (Date.now() - now) < 2 * 60 * 1000;
          if (!isMe && now > before && recent && getSetting('loginToast')) {
            showAppToast({
              avatarUrl: st.avatar_url,
              initial: st.name.charAt(0).toUpperCase(),
              title: st.name + ' hat sich angemeldet',
              text: '👋 Dein Kollege ist jetzt online.',
              ms: 6000
            });
          }
        });
      }
      loginWatchBaseline = fresh;
      staffDatabaseRecords = data;   // aktuelle Fotos/Namen für Chat und @-Vorschläge
    }

    function startLoginWatcher() {
      stopLoginWatcher();
      pollLoginWatcher();
      loginWatchTimer = setInterval(pollLoginWatcher, 30000);
    }

    function stopLoginWatcher() {
      if (loginWatchTimer) clearInterval(loginWatchTimer);
      loginWatchTimer = null;
      loginWatchBaseline = null;
    }

    function setVisible(id, on, useFlex) {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.toggle('hidden', !on);
      if (useFlex) el.classList.toggle('flex', on);
    }

    function applyRoleUI() {
      const showEdit = isAdmin && userCanEdit;
      const showAdmin = isAdmin && userIsAdmin;
      setVisible('btnMenuImportExport', showEdit, true);
      setVisible('menuAddDrinkBtn', showEdit, true);
      setVisible('addDrinkBtnContainer', showEdit, false);
      setVisible('menuStaffPinBtn', showAdmin, true);
      setVisible('menuAdminSection', showAdmin, true);
      setVisible('menuNewSeasonBtn', showEdit, true);
      setVisible('adminChangelogFormContainer', showAdmin, false);
      if (typeof updateHeaderAvatarUI === 'function') updateHeaderAvatarUI();
      if (typeof renderDashboard === 'function' && !isDrinksViewOpen()) renderDashboard();
      const mobileLabel = document.getElementById('mobileUserLabel');
      if (mobileLabel) mobileLabel.textContent = (currentWaiterName || '') + ' (' + (({ developer: t('role.developer'), manager: t('role.manager') })[currentStaffRole] || t('role.staff')) + ')';
      const label = document.getElementById('currentUserEmail');
      if (label) {
        const roleTxt = (userIsAdmin || userCanEdit) && currentStaffRole && currentStaffRole !== 'staff' ? ` (${escapeHtml(currentStaffRole)})` : '';
        label.innerHTML = `<span class="text-amber-600 dark:text-amber-400 font-black">${escapeHtml(currentWaiterName)}${roleTxt}</span>`;
      }
    }

    async function handleLogout() {
      closeSettingsMenu();
      stopLoginWatcher();
      if (typeof presenceEnd === 'function') await presenceEnd('logout');   // Abmeldung ins Protokoll
      if (typeof pushOnLogout === 'function') await pushOnLogout();   // Gerät von dieser Person trennen, solange der Token noch gilt
      try { await _supabase.rpc('logout_staff'); } catch (e) {}
      clearStaffSession();
      sessionStorage.removeItem('salon_waiter_name');
      currentWaiterName = "";
      currentWaiterAvatar = "";
      currentStaffRole = "";
      userIsAdmin = false;
      userCanEdit = false;
      isAdmin = false;
      currentEnteredPin = "";
      selectedWaiterForPin = "";
      updatePinDisplay();
      resetWaiterSelection();
      document.getElementById('appContainer').classList.add('hidden');
      document.getElementById('authContainer').classList.remove('hidden');
      document.getElementById('drinksView').classList.add('hidden');
      document.getElementById('dashboardView').classList.remove('hidden');
      document.body.classList.add('on-dashboard');
      await loadStaffPresenceRecordsForLogin();
    }

    function checkManagerAuth(callback) {
      if (userIsAdmin) {
        if (callback) callback();
        return;
      }
      alert("Diese Aktion ist nur für Manager und Developer erlaubt.");
    }

    function checkDrinkEditAuth(callback) {
      if (userCanEdit) {
        if (callback) callback();
        return;
      }
      alert("Du hast keine Berechtigung, Getränke zu bearbeiten.");
    }

    // PIN auch mit der Computer-Tastatur eingeben (nur sichtbar, wenn der PIN-Schritt offen ist)
    document.addEventListener('keydown', e => {
      // Nur wenn die Anmeldung wirklich sichtbar ist. Sonst würden in der App
      // Zahlen und Backspace in allen Eingabefeldern verschluckt (Fehler in 3.2.02/3.2.03).
      const auth = document.getElementById('authContainer');
      const sec = document.getElementById('pinInputSection');
      if (!auth || auth.classList.contains('hidden') || !sec || sec.classList.contains('hidden')) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^[0-9]$/.test(e.key)) { e.preventDefault(); appendPinNum(e.key); }
      else if (e.key === 'Backspace') { e.preventDefault(); backspacePinInput(); }
      else if (e.key === 'Enter') { e.preventDefault(); submitPinLogin(); }
      else if (e.key === 'Escape') { e.preventDefault(); resetWaiterSelection(); }
    });

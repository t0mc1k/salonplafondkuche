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

    async function loadStaffPresenceRecordsForLogin() {
      const { data, error } = await _supabase.rpc('list_staff');
      const gridContainer = document.getElementById('waiterGridContainer');
      if (error || !data || data.length === 0) {
        gridContainer.innerHTML = `<p class="col-span-full text-slate-500 italic text-xs text-center py-4">Kein Personal in Datenbank gefunden</p>`;
        staffDatabaseRecords = [];
        return;
      }
      staffDatabaseRecords = data;
      
      gridContainer.innerHTML = data.map(staff => {
        let avatarHtml = staff.avatar_url 
          ? `<img src="${escapeHtml(staff.avatar_url)}" class="w-12 h-12 rounded-full object-cover border border-amber-500/50 shadow" alt="${escapeHtml(staff.name)}">` 
          : `<div class="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-amber-700 dark:text-amber-400 font-black flex items-center justify-center border border-slate-300 dark:border-slate-700 text-sm">${escapeHtml(staff.name.charAt(0).toUpperCase())}</div>`;

        return `
          <button type="button" onclick="selectWaiterForLogin(${jsArg(staff.name)})" class="p-3 bg-slate-100 dark:bg-slate-950 hover:bg-amber-500/20 hover:border-amber-500 border border-slate-300 dark:border-slate-800 rounded-xl flex flex-col items-center justify-center gap-1.5 transition group">
            ${avatarHtml}
            <span class="text-xs font-black text-slate-900 dark:text-white group-hover:text-amber-400 truncate w-full">${escapeHtml(staff.name)}</span>
            <span class="text-[9px] text-slate-600 dark:text-slate-400 uppercase tracking-wider">${escapeHtml(staff.role || 'staff')}</span>
          </button>
        `;
      }).join('');
    }

    function selectWaiterForLogin(name) {
      selectedWaiterForPin = name;
      document.getElementById('selectedWaiterLabel').innerText = `👤 ${name}`;
      document.getElementById('waiterGridContainer').classList.add('hidden');
      document.getElementById('pinInputSection').classList.remove('hidden');
      currentEnteredPin = "";
      updatePinDisplay();
      document.getElementById('pinAuthError').classList.add('hidden');
    }

    function resetWaiterSelection() {
      selectedWaiterForPin = "";
      document.getElementById('selectedWaiterLabel').innerText = "";
      document.getElementById('pinInputSection').classList.add('hidden');
      document.getElementById('waiterGridContainer').classList.remove('hidden');
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
    }

    let pinLoginBusy = false;
    async function submitPinLogin() {
      const errDiv = document.getElementById('pinAuthError');
      errDiv.classList.add('hidden');
      if (!selectedWaiterForPin || pinLoginBusy) return;

      if (currentEnteredPin.length < 4) {
        errDiv.innerText = "Bitte mindestens 4 Ziffern eingeben.";
        errDiv.classList.remove('hidden');
        return;
      }

      pinLoginBusy = true;
      const { data, error } = await _supabase.rpc('login_with_pin', { p_name: selectedWaiterForPin, p_pin: currentEnteredPin });
      pinLoginBusy = false;

      if (error) {
        errDiv.innerText = (error.message || '').indexOf('Zu viele') !== -1
          ? "Zu viele Versuche. Bitte in 10 Minuten erneut versuchen."
          : "Fehler: " + error.message;
        errDiv.classList.remove('hidden');
        currentEnteredPin = "";
        updatePinDisplay();
        return;
      }

      const row = Array.isArray(data) ? data[0] : data;
      if (!row) {
        errDiv.innerText = "Falscher PIN-Code!";
        errDiv.classList.remove('hidden');
        currentEnteredPin = "";
        updatePinDisplay();
        return;
      }

      setStaffSession(row.out_token);
      currentWaiterName = row.out_name;
      sessionStorage.setItem('kueche_waiter_name', currentWaiterName);
      currentEnteredPin = "";
      updatePinDisplay();
      await finalizeAppStartForStaff({
        name: row.out_name,
        role: row.out_role,
        avatar_url: row.out_avatar,
        can_edit_recipes: row.out_can_edit_recipes
      });
    }

    async function finalizeAppStartForStaff(staffRecord) {
      document.getElementById('authContainer').classList.add('hidden');
      document.getElementById('appContainer').classList.remove('hidden');

      currentWaiterAvatar = staffRecord.avatar_url || "";
      updateHeaderAvatarUI();

      currentStaffRole = staffRecord.role || 'staff';
      userIsAdmin = (currentStaffRole === 'manager' || currentStaffRole === 'developer');
      userCanEdit = userIsAdmin || staffRecord.can_edit_recipes === true;
      isAdmin = userIsAdmin || userCanEdit;   // Verwaltungsansicht standardmäßig an
      applyRoleUI();

      await loadDishes();
      await checkPendingTicketsBadge();
      if (typeof startHandoverBadgePolling === 'function') startHandoverBadgePolling();
      setupChatRealtimeListener();
      startLoginWatcher();
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
      loginWatchTimer = setInterval(pollLoginWatcher, 15000);
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
      setVisible('menuAddDishBtn', showEdit, true);
      setVisible('addDishBtnContainer', showEdit, false);
      setVisible('menuStaffPinBtn', showAdmin, true);
      setVisible('menuAdminSection', showAdmin, true);
      setVisible('menuNewSeasonBtn', showEdit, true);
      setVisible('adminChangelogFormContainer', showAdmin, false);
      if (typeof updateHeaderAvatarUI === 'function') updateHeaderAvatarUI();
      const label = document.getElementById('currentUserEmail');
      if (label) {
        const roleTxt = (userIsAdmin || userCanEdit) && currentStaffRole && currentStaffRole !== 'staff' ? ` (${escapeHtml(currentStaffRole)})` : '';
        label.innerHTML = `<span class="text-amber-600 dark:text-amber-400 font-black">${escapeHtml(currentWaiterName)}${roleTxt}</span>`;
      }
    }

    async function handleLogout() {
      closeSettingsMenu();
      stopLoginWatcher();
      try { await _supabase.rpc('logout_staff'); } catch (e) {}
      clearStaffSession();
      sessionStorage.removeItem('kueche_waiter_name');
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
      await loadStaffPresenceRecordsForLogin();
    }

    function checkManagerAuth(callback) {
      if (userIsAdmin) {
        if (callback) callback();
        return;
      }
      alert("Diese Aktion ist nur für Manager und Developer erlaubt.");
    }

    function checkDishEditAuth(callback) {
      if (userCanEdit) {
        if (callback) callback();
        return;
      }
      alert("Du hast keine Berechtigung, Gerichte zu bearbeiten.");
    }

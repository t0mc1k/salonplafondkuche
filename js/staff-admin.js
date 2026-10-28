/* ============================================================
   js/staff-admin.js
   Verwaltung (nur Küchenchef, Sous Chef und Developer): Personal & PINs, Login-Protokoll, Online-Übersicht
   ============================================================ */
    async function openLoginHistoryModal() {
      closeSettingsMenu();
      checkManagerAuth(async () => {
        await loadLoginHistoryRecords();
        await loadOnlineUsersSummary();
        const modal = document.getElementById('loginHistoryModal');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
      });
    }

    function closeLoginHistoryModal() {
      const modal = document.getElementById('loginHistoryModal');
      modal.classList.remove('flex');
      modal.classList.add('hidden');
    }

    async function loadOnlineUsersSummary() {
      const container = document.getElementById('onlineUsersListContainer');
      const countBadge = document.getElementById('onlineCountBadge');
      container.innerHTML = `<span class="text-slate-500 italic">Lade Online-Status...</span>`;

      const { data, error } = await _supabase.rpc('list_staff');
      if (error || !data) {
        container.innerHTML = `<span class="text-red-700 dark:text-red-400">Fehler beim Laden</span>`;
        countBadge.innerText = "0";
        return 0;
      }

      const now = new Date();
      let onlineUsers = data.filter(staff => {
        if (!staff.last_used_at) return false;
        let lastActive = new Date(staff.last_used_at);
        let diffMinutes = (now - lastActive) / (1000 * 60);
        return diffMinutes <= 15;
      });

      countBadge.innerText = onlineUsers.length;

      const chatCountLabel = document.getElementById('chatOnlineCountLabel');
      if (chatCountLabel) chatCountLabel.innerText = `${onlineUsers.length} ${onlineUsers.length === 1 ? 'Mitglied' : 'Mitglieder'}`;

      if (onlineUsers.length === 0) {
        container.innerHTML = `<span class="text-slate-600 dark:text-slate-400 italic">Keine Benutzer in den letzten 15 Minuten aktiv.</span>`;
        return 0;
      }

      container.innerHTML = onlineUsers.map(user => {
        return `
          <span class="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-500/30 text-[11px] flex items-center gap-1">
            🟢 ${escapeHtml(user.name)} <span class="text-[9px] opacity-75 uppercase">(${escapeHtml(staffTitle(user))})</span>
          </span>
        `;
      }).join('');

      return onlineUsers.length;
    }

    async function loadLoginHistoryRecords() {
      const container = document.getElementById('loginHistoryListContainer');
      container.innerHTML = `<p class="text-slate-500 italic text-xs text-center py-4">Lade Login-Protokoll...</p>`;

      const { data, error } = await _supabase.from('login_history').select('*').order('logged_in_at', { ascending: false }).limit(50);
      if (error) {
        container.innerHTML = `<p class="text-red-500 text-xs text-center py-4">Fehler: ${escapeHtml(error.message)}</p>`;
        return;
      }

      if (!data || data.length === 0) {
        container.innerHTML = `<p class="text-slate-500 italic text-xs text-center py-4">Keine Logins in der Historie gefunden.</p>`;
        return;
      }

      container.innerHTML = data.map(item => {
        let dateStr = new Date(item.logged_in_at).toLocaleString();
        let roleBadge = `<span class="px-2 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] uppercase font-bold">${escapeHtml(roleLabel(item.role))}</span>`;
        return `
          <div class="custom-box p-3 rounded-xl border flex items-center justify-between gap-2 text-xs">
            <div class="flex items-center gap-2">
              <span class="text-amber-500 font-bold">👤 ${escapeHtml(item.user_name)}</span>
              ${roleBadge}
            </div>
            <span class="text-slate-600 dark:text-slate-400 text-[11px]">${dateStr}</span>
          </div>
        `;
      }).join('');
    }

    // ---------- Login-Protokoll leeren ----------
    async function clearLoginHistoryLogs() {
      checkManagerAuth(async () => {
        if (!confirm("Möchtest du das gesamte Login-Protokoll wirklich unwiderruflich löschen?")) return;

        const { data, error } = await _supabase.rpc('admin_clear_login_history');
        if (error) {
          alert("Fehler beim Löschen des Protokolls: " + error.message);
          return;
        }

        await loadLoginHistoryRecords();
        showAppToast({
          initial: '🧹',
          title: 'Login-Protokoll geleert',
          text: (typeof data === 'number' ? data : 0) + ' Einträge wurden gelöscht.'
        });
      });
    }

    // ---------- Personal & PINs ----------
    let staffListCache = [];
    let staffRoleFilter = 'all';

    function openStaffPinModal() {
      closeSettingsMenu();
      checkManagerAuth(() => {
        resetStaffForm();
        showStaffView('list');
        const search = document.getElementById('staffSearchInput');
        if (search) search.value = '';
        staffRoleFilter = 'all';
        loadStaffManagementList();
        const modal = document.getElementById('staffPinManagementModal');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
      });
    }

    function openStaffPinModalFromMenu() {
      openStaffPinModal();
    }

    function closeStaffPinModal() {
      const modal = document.getElementById('staffPinManagementModal');
      modal.classList.remove('flex');
      modal.classList.add('hidden');
      loadStaffPresenceRecordsForLogin();
    }

    function showStaffView(view) {
      const list = document.getElementById('staffViewList');
      const form = document.getElementById('staffViewForm');
      if (!list || !form) return;
      const isForm = view === 'form';
      list.classList.toggle('hidden', isForm);
      list.classList.toggle('flex', !isForm);
      form.classList.toggle('hidden', !isForm);
      form.classList.toggle('flex', isForm);
      const scroller = document.getElementById('staffFormScroll');
      if (isForm && scroller) scroller.scrollTop = 0;
    }

    function startNewStaff() {
      resetStaffForm();
      document.getElementById('staffFormTitle').innerText = "➕ Neuer Mitarbeiter";
      document.getElementById('staffPinHint').innerText = "Pflichtfeld: 4 bis 6 Ziffern.";
      showStaffView('form');
      document.getElementById('staffInputName').focus();
    }

    function cancelStaffForm() {
      resetStaffForm();
      showStaffView('list');
    }

    function resetStaffForm() {
      document.getElementById('editingStaffOriginalName').value = '';
      document.getElementById('staffInputName').value = '';
      document.getElementById('staffInputPin').value = '';
      document.getElementById('staffInputPin').type = 'password';
      document.getElementById('staffInputCanEdit').checked = false;
      document.getElementById('staffInputJob').value = '';
      document.getElementById('staffInputAvatar').value = '';
      document.getElementById('staffAvatarFile').value = '';
      document.getElementById('staffAvatarStatus').innerText = '';
      document.getElementById('staffFormTitle').innerText = "➕ Neuer Mitarbeiter";
      document.getElementById('staffPinHint').innerText = "Pflichtfeld: 4 bis 6 Ziffern.";
      setStaffRole('staff');
      updateStaffAvatarPreview();
    }

    function setStaffRole(role) {
      const sel = document.getElementById('staffInputRole');
      if (sel) sel.value = role;
      ['staff', 'manager', 'souschef', 'developer'].forEach(r => {
        const b = document.getElementById('staffRoleBtn_' + r);
        if (b) b.classList.toggle('active', r === role);
      });
      // Funktion (Saucier, Entre ...) gibt es nur für Köche
      const jobSec = document.getElementById('staffJobSection');
      if (jobSec) jobSec.classList.toggle('hidden', role !== 'staff');
      if (role !== 'staff') document.getElementById('staffInputJob').value = '';
      renderStaffJobChips();
      // Manager/Developer dürfen immer Rezepte bearbeiten
      const canEdit = document.getElementById('staffInputCanEdit');
      const note = document.getElementById('staffCanEditNote');
      const always = isAdminRole(role);
      if (canEdit) {
        if (always) canEdit.checked = true;
        canEdit.disabled = always;
      }
      if (note) note.innerText = always ? 'Küchenchef, Sous Chef und Developer dürfen Gerichte immer bearbeiten.' : 'Erlaubt dem Mitarbeiter, Gerichte anzulegen, zu ändern und zu löschen.';
    }

    function setStaffJob(job) {
      const inp = document.getElementById('staffInputJob');
      inp.value = (inp.value === job) ? '' : job;   // nochmal klicken = Funktion entfernen
      renderStaffJobChips();
    }

    function renderStaffJobChips() {
      const box = document.getElementById('staffJobChips');
      if (!box) return;
      const cur = document.getElementById('staffInputJob').value;
      box.innerHTML = JOB_FUNCTIONS.map(j =>
        `<button type="button" class="ui-chip${j === cur ? ' active' : ''}" onclick="setStaffJob(${jsArg(j)})">${escapeHtml(j)}</button>`
      ).join('');
    }

    function updateStaffAvatarPreview() {
      const box = document.getElementById('staffAvatarPreview');
      if (!box) return;
      const url = document.getElementById('staffInputAvatar').value.trim();
      const name = document.getElementById('staffInputName').value.trim();
      box.innerHTML = '';
      if (url) {
        const img = document.createElement('img');
        img.src = url;
        img.alt = '';
        img.className = 'w-full h-full object-cover';
        box.appendChild(img);
      } else {
        box.textContent = name ? name.charAt(0).toUpperCase() : '?';
      }
    }

    function toggleStaffPinVisibility() {
      const input = document.getElementById('staffInputPin');
      input.type = input.type === 'password' ? 'text' : 'password';
    }

    function generateStaffPin() {
      let pin = '';
      for (let i = 0; i < 4; i++) pin += Math.floor(Math.random() * 10);
      const input = document.getElementById('staffInputPin');
      input.value = pin;
      input.type = 'text';
    }

    async function uploadStaffAvatarToSupabase(event) {
      const file = event.target.files[0];
      if (!file) return;
      const status = document.getElementById('staffAvatarStatus');
      status.innerText = "⏳ Foto wird hochgeladen...";

      const fileName = `avatar_${Date.now()}_${safeFileName(file.name)}`;
      let { data, error } = await _supabase.storage.from('kitchen').upload(fileName, file);

      if (error) {
        status.innerText = 'Fehler: ' + error.message;
        return;
      }

      let { data: publicURLData } = _supabase.storage.from('kitchen').getPublicUrl(fileName);
      if (publicURLData && publicURLData.publicUrl) {
        document.getElementById('staffInputAvatar').value = publicURLData.publicUrl;
        status.innerText = '✔ Foto hinzugefügt – mit „Speichern“ übernehmen.';
        updateStaffAvatarPreview();
      }
    }

    async function loadStaffManagementList() {
      const container = document.getElementById('staffManagementListContainer');
      container.innerHTML = `<p class="staff-empty">Lade Personal...</p>`;

      const { data, error } = await _supabase.rpc('list_staff');
      if (error) {
        container.innerHTML = `<p class="staff-empty text-red-500">Fehler: ${escapeHtml(error.message)}</p>`;
        return;
      }
      staffListCache = data || [];
      renderStaffList();
    }

    function setStaffRoleFilter(role) {
      staffRoleFilter = role;
      renderStaffList();
    }

    function staffRolePill(role) {
      return `<span class="staff-pill ${rolePillClass(role)}">${escapeHtml(roleLabel(role))}</span>`;
    }

    function renderStaffList() {
      const container = document.getElementById('staffManagementListContainer');
      if (!container) return;

      const q = ((document.getElementById('staffSearchInput') || {}).value || '').trim().toLowerCase();
      const nowMs = Date.now();

      // Zusammenfassung
      const total = staffListCache.length;
      const admins = staffListCache.filter(s => isAdminRole(s.role)).length;
      const online = staffListCache.filter(s => s.last_used_at && (nowMs - new Date(s.last_used_at).getTime()) <= 15 * 60 * 1000).length;
      const withoutPin = staffListCache.filter(s => !s.has_pin).length;
      const sum = document.getElementById('staffSummary');
      if (sum) {
        sum.innerHTML = `
          <span class="staff-sum"><b>${total}</b> Mitarbeiter</span>
          <span class="staff-sum"><b>${admins}</b> Admins</span>
          <span class="staff-sum"><b class="text-emerald-500">${online}</b> online</span>
          ${withoutPin ? `<span class="staff-sum text-red-700 dark:text-red-400"><b>${withoutPin}</b> ohne PIN</span>` : ''}`;
      }

      // Filter-Chips
      ['all', 'staff', 'manager', 'souschef', 'developer'].forEach(r => {
        const chip = document.getElementById('staffChip_' + r);
        if (chip) chip.classList.toggle('active', r === staffRoleFilter);
      });

      const list = staffListCache.filter(s => {
        if (staffRoleFilter !== 'all' && (s.role || 'staff') !== staffRoleFilter) return false;
        if (q && (s.name || '').toLowerCase().indexOf(q) === -1) return false;
        return true;
      });

      if (!list.length) {
        container.innerHTML = `<p class="staff-empty">${total ? 'Keine Mitarbeiter gefunden.' : 'Noch kein Personal angelegt.'}</p>`;
        return;
      }

      container.innerHTML = list.map(staff => {
        const isDev = (staff.role === 'developer');
        const isOnline = staff.last_used_at && (nowMs - new Date(staff.last_used_at).getTime()) <= 15 * 60 * 1000;
        const avatar = staff.avatar_url
          ? `<img src="${escapeHtml(staff.avatar_url)}" class="w-full h-full object-cover" alt="">`
          : escapeHtml((staff.name || '?').charAt(0).toUpperCase());
        const deleteBtn = isDev
          ? `<span class="staff-lock" title="Developer-Konto ist geschützt">🔒</span>`
          : `<button type="button" onclick="deleteStaffMember(${jsArg(staff.name)})" class="staff-btn staff-btn-danger" title="Mitarbeiter löschen">🗑️</button>`;

        return `
          <div class="staff-card">
            <div class="staff-avatar">${avatar}${isOnline ? '<span class="staff-online" title="Gerade online"></span>' : ''}</div>
            <div class="staff-info">
              <div class="staff-name">${escapeHtml(staff.name)}</div>
              <div class="staff-badges">
                ${staffRolePill(staff.role)}
                ${staff.role === 'staff' && staff.job_title ? `<span class="staff-pill pill-ok" title="Funktion">🔪 ${escapeHtml(staff.job_title)}</span>` : ''}
                ${staff.can_edit_recipes ? '<span class="staff-pill pill-ok" title="Darf Rezepte bearbeiten">🍽️ Rezepte</span>' : ''}
                ${staff.has_pin ? '<span class="staff-pill pill-ok" title="PIN ist gesetzt">🔑 PIN</span>' : '<span class="staff-pill pill-warn" title="Es ist kein PIN gesetzt">⚠ PIN fehlt</span>'}
              </div>
              <div class="staff-meta">Zuletzt angemeldet: ${escapeHtml(formatRelativeTime(staff.last_used_at))}</div>
            </div>
            <div class="staff-actions">
              <button type="button" onclick="editStaffMember(${jsArg(staff.name)})" class="staff-btn" title="Bearbeiten">✏️ Bearbeiten</button>
              ${deleteBtn}
            </div>
          </div>`;
      }).join('');
    }

    function editStaffMember(name) {
      const staff = staffListCache.find(s => s.name === name);
      if (!staff) return;
      resetStaffForm();
      document.getElementById('editingStaffOriginalName').value = staff.name;
      document.getElementById('staffInputName').value = staff.name;
      document.getElementById('staffInputAvatar').value = staff.avatar_url || '';
      document.getElementById('staffInputCanEdit').checked = !!staff.can_edit_recipes;
      document.getElementById('staffAvatarStatus').innerText = staff.avatar_url ? '✔ Profilbild vorhanden' : '';
      document.getElementById('staffFormTitle').innerText = `✏️ ${staff.name} bearbeiten`;
      document.getElementById('staffPinHint').innerText = staff.has_pin
        ? "Leer lassen = PIN bleibt unverändert. Zum Ändern 4 bis 6 Ziffern eingeben."
        : "Für diesen Mitarbeiter ist noch kein PIN gesetzt: bitte 4 bis 6 Ziffern eingeben.";
      document.getElementById('staffInputJob').value = staff.job_title || '';
      setStaffRole(staff.role || 'staff');
      // „Darf Rezepte bearbeiten“ nach setStaffRole erneut korrekt setzen (Admins immer)
      if (!isAdminRole(staff.role)) {
        document.getElementById('staffInputCanEdit').checked = !!staff.can_edit_recipes;
      }
      updateStaffAvatarPreview();
      showStaffView('form');
    }

    async function saveStaffMember() {
      const originalName = document.getElementById('editingStaffOriginalName').value.trim();
      const newName = document.getElementById('staffInputName').value.trim();
      const pin = document.getElementById('staffInputPin').value.trim();
      const role = document.getElementById('staffInputRole').value;
      const avatar_url = document.getElementById('staffInputAvatar').value.trim();
      const canEdit = document.getElementById('staffInputCanEdit').checked;
      const jobTitle = role === 'staff' ? document.getElementById('staffInputJob').value.trim() : '';

      if (!newName) return alert("Bitte Name eingeben.");
      if (pin && !/^\d{4,6}$/.test(pin)) return alert("Der PIN muss aus 4 bis 6 Ziffern bestehen.");
      if (!originalName && !pin) return alert("Bitte einen PIN für den neuen Mitarbeiter festlegen.");

      const { error } = await _supabase.rpc('admin_save_staff', {
        p_original: originalName,
        p_name: newName,
        p_pin: pin,
        p_role: role,
        p_avatar: avatar_url,
        p_can_edit: canEdit,
        p_job_title: jobTitle
      });
      if (error) return alert("Fehler beim Speichern: " + error.message);

      showAppToast({
        avatarUrl: avatar_url,
        initial: newName.charAt(0).toUpperCase(),
        title: originalName ? 'Änderungen gespeichert' : 'Mitarbeiter angelegt',
        text: newName
      });
      resetStaffForm();
      showStaffView('list');
      await loadStaffManagementList();
      loadStaffPresenceRecordsForLogin();
    }

    async function deleteStaffMember(name) {
      if (!confirm(`Möchtest du ${name} wirklich aus der Datenbank löschen?`)) return;
      const { error } = await _supabase.rpc('admin_delete_staff', { p_name: name });
      if (error) {
        alert("Fehler beim Löschen: " + error.message);
      } else {
        showAppToast({ initial: '🗑️', title: 'Mitarbeiter gelöscht', text: name });
        await loadStaffManagementList();
        loadStaffPresenceRecordsForLogin();
      }
    }

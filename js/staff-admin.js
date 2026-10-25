/* ============================================================
   js/staff-admin.js
   Verwaltung (nur Manager/Developer): Personal & PINs, Login-Historie, Online-Übersicht
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

    function openLoginHistoryModalFromMenu() {
      openLoginHistoryModal();
    }

    function closeLoginHistoryModal() {
      const modal = document.getElementById('loginHistoryModal');
      modal.classList.remove('flex');
      modal.classList.add('hidden');
    }

    async function clearLoginHistoryLogs() {
      checkManagerAuth(async () => {
        if (!confirm("Möchten Sie wirklich das gesamte Login-Protokoll unwiderruflich löschen?")) return;
        
        // Zmazanie všetkých záznamov z tabuľky login_history
        const { error } = await _supabase.from('login_history').delete().neq('id', 0); // zmaže všetko, kde id != 0 (všetky riadky)
        
        if (error) {
          // Fallback ak tabuľka nemá stĺpec id, skúsime vymazať cez inú podmienku
          const { error: err2 } = await _supabase.from('login_history').delete().not('user_name', 'is', null);
          if (err2) {
            alert("Fehler beim Löschen des Protokolls: " + (error.message || err2.message));
            return;
          }
        }

        alert("Login-Protokoll wurde erfolgreich geleert!");
        await loadLoginHistoryRecords();
      });
    }

    async function loadOnlineUsersSummary() {
      const container = document.getElementById('onlineUsersListContainer');
      const countBadge = document.getElementById('onlineCountBadge');
      container.innerHTML = `<span class="text-slate-500 italic">Lade Online-Status...</span>`;

      const { data, error } = await _supabase.rpc('list_staff');
      if (error || !data) {
        container.innerHTML = `<span class="text-red-400">Fehler beim Laden</span>`;
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
        container.innerHTML = `<span class="text-slate-400 italic">Keine Benutzer in den letzten 15 Minuten aktiv.</span>`;
        return 0;
      }

      container.innerHTML = onlineUsers.map(user => {
        return `
          <span class="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 text-[11px] flex items-center gap-1">
            🟢 ${escapeHtml(user.name)} <span class="text-[9px] opacity-75 uppercase">(${escapeHtml(user.role || 'staff')})</span>
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
        let roleBadge = `<span class="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] uppercase font-bold">${escapeHtml(item.role || 'staff')}</span>`;
        return `
          <div class="custom-box p-3 rounded-xl border flex items-center justify-between gap-2 text-xs">
            <div class="flex items-center gap-2">
              <span class="text-amber-500 font-bold">👤 ${escapeHtml(item.user_name)}</span>
              ${roleBadge}
            </div>
            <span class="text-slate-400 text-[11px]">${dateStr}</span>
          </div>
        `;
      }).join('');
    }

    function openStaffPinModal() {
      closeSettingsMenu();
      checkManagerAuth(() => {
        resetStaffForm();
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

    function resetStaffForm() {
      document.getElementById('editingStaffOriginalName').value = '';
      document.getElementById('staffInputName').value = '';
      document.getElementById('staffInputPin').value = '';
      document.getElementById('staffInputPin').placeholder = 'z. B. 1234';
      document.getElementById('staffInputCanEdit').checked = false;
      document.getElementById('staffInputRole').value = 'staff';
      document.getElementById('staffInputAvatar').value = '';
      document.getElementById('staffAvatarFile').value = '';
      document.getElementById('staffAvatarStatus').innerText = '';
      document.getElementById('staffFormTitle').innerText = "➕ Neuen Mitarbeiter hinzufügen";
    }

    async function uploadStaffAvatarToSupabase(event) {
      const file = event.target.files[0];
      if (!file) return;
      const status = document.getElementById('staffAvatarStatus');
      status.innerText = "⏳ Foto wird hochgeladen...";
      
      const fileName = `avatar_${Date.now()}_${file.name}`;
      let { data, error } = await _supabase.storage.from('drinks').upload(fileName, file);
      
      if (error) {
        status.innerText = 'Fehler: ' + error.message;
        return;
      }
      
      let { data: publicURLData } = _supabase.storage.from('drinks').getPublicUrl(fileName);
      if (publicURLData && publicURLData.publicUrl) {
        document.getElementById('staffInputAvatar').value = publicURLData.publicUrl;
        status.innerText = '✔ Foto wurde erfolgreich hinzugefügt!';
        alert("Foto wurde erfolgreich hinzugefügt!");
      }
    }

    async function loadStaffManagementList() {
      const container = document.getElementById('staffManagementListContainer');
      container.innerHTML = `<p class="text-slate-500 italic text-xs text-center py-4">Lade Personal...</p>`;

      const { data, error } = await _supabase.rpc('list_staff');
      if (error) {
        container.innerHTML = `<p class="text-red-500 text-xs text-center py-4">Fehler: ${escapeHtml(error.message)}</p>`;
        return;
      }

      if (!data || data.length === 0) {
        container.innerHTML = `<p class="text-slate-500 italic text-xs text-center py-4">Kein Personal gefunden.</p>`;
        return;
      }

      container.innerHTML = data.map(staff => {
        let isDev = (staff.role === 'developer');
        let deleteBtnHtml = isDev 
          ? `<span class="text-[10px] text-amber-500 font-bold px-2 py-1 bg-amber-500/10 rounded border border-amber-500/30" title="Developer-Account ist geschützt">🔒 Geschützt</span>`
          : `<button onclick='deleteStaffMember(${jsArg(staff.name)})' class="px-2.5 py-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 font-bold rounded text-[11px]">🗑️ Löschen</button>`;

        let avatarImg = staff.avatar_url 
          ? `<img src="${escapeHtml(staff.avatar_url)}" class="w-8 h-8 rounded-full object-cover border border-amber-500/50 shrink-0" alt="">` 
          : `<div class="w-8 h-8 rounded-full bg-slate-800 text-amber-400 font-bold flex items-center justify-center border border-slate-700 text-xs shrink-0">${escapeHtml(staff.name.charAt(0).toUpperCase())}</div>`;

        return `
          <div class="custom-box p-3 rounded-xl border flex items-center justify-between gap-2 text-xs">
            <div class="flex items-center gap-2.5">
              ${avatarImg}
              <div>
                <span class="font-bold text-amber-600 dark:text-amber-400">${escapeHtml(staff.name)}</span>
                <span class="ml-2 px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">PIN: ${staff.has_pin ? 'gesetzt' : 'Nicht gesetzt'}</span>
                <span class="ml-1 px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px]">Rolle: ${escapeHtml(staff.role || 'staff')}</span>
                ${staff.can_edit_drinks ? '<span class="ml-1 px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px]">🍸 Drinks</span>' : ''}
              </div>
            </div>
            <div class="flex gap-1.5 items-center">
              <button onclick='editStaffMember(${jsArg(staff.name)}, "", ${jsArg(staff.role || 'staff')}, ${jsArg(staff.avatar_url || '')}, ${staff.can_edit_drinks ? 'true' : 'false'})' class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 font-bold rounded text-[11px]">✏️ Bearbeiten</button>
              ${deleteBtnHtml}
            </div>
          </div>
        `;
      }).join('');
    }

    function editStaffMember(name, pin, role, avatarUrl, canEdit) {
      document.getElementById('editingStaffOriginalName').value = name;
      document.getElementById('staffInputName').value = name;
      document.getElementById('staffInputPin').value = '';
      document.getElementById('staffInputPin').placeholder = 'leer = unverändert';
      document.getElementById('staffInputCanEdit').checked = !!canEdit;
      document.getElementById('staffInputRole').value = role;
      document.getElementById('staffInputAvatar').value = avatarUrl || '';
      document.getElementById('staffAvatarStatus').innerText = avatarUrl ? '✔ Bild vorhanden' : '';
      document.getElementById('staffFormTitle').innerText = `✏️ Mitarbeiter bearbeiten (${name})`;
    }

    async function saveStaffMember() {
      const originalName = document.getElementById('editingStaffOriginalName').value.trim();
      const newName = document.getElementById('staffInputName').value.trim();
      const pin = document.getElementById('staffInputPin').value.trim();
      const role = document.getElementById('staffInputRole').value;
      const avatar_url = document.getElementById('staffInputAvatar').value.trim();
      const canEdit = document.getElementById('staffInputCanEdit').checked;

      if (!newName) return alert("Bitte Name eingeben.");
      if (pin && !/^\d{4,6}$/.test(pin)) return alert("Der PIN muss aus 4 bis 6 Ziffern bestehen.");
      if (!originalName && !pin) return alert("Bitte einen PIN für den neuen Mitarbeiter festlegen.");

      const { error } = await _supabase.rpc('admin_save_staff', {
        p_original: originalName,
        p_name: newName,
        p_pin: pin,
        p_role: role,
        p_avatar: avatar_url,
        p_can_edit: canEdit
      });
      if (error) return alert("Fehler beim Speichern: " + error.message);

      alert("Erfolgreich gespeichert!");
      resetStaffForm();
      loadStaffManagementList();
      loadStaffPresenceRecordsForLogin();
    }

    async function deleteStaffMember(name) {
      if (!confirm(`Möchten Sie ${name} wirklich aus der Datenbank löschen?`)) return;
      const { error } = await _supabase.rpc('admin_delete_staff', { p_name: name });
      if (error) {
        alert("Fehler beim Löschen: " + error.message);
      } else {
        alert("Erfolgreich gelöscht!");
        loadStaffManagementList();
        loadStaffPresenceRecordsForLogin();
      }
    }

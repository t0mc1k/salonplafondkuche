/* ============================================================
   js/profile.js
   Eigenes Profil und Profilansicht anderer Mitarbeiter
   ============================================================ */
    function updateHeaderAvatarUI() {
      const container = document.getElementById('headerUserAvatarContainer');
      const menuThumbContainer = document.getElementById('menuAvatarThumbnailContainer');

      if (currentWaiterAvatar) {
        container.innerHTML = `<img src="${escapeHtml(currentWaiterAvatar)}" class="w-full h-full object-cover" alt="${escapeHtml(currentWaiterName)}">`;
        if (menuThumbContainer) {
          menuThumbContainer.innerHTML = `<img src="${escapeHtml(currentWaiterAvatar)}" class="w-full h-full object-cover" alt="${escapeHtml(currentWaiterName)}">`;
        }
      } else {
        let initial = currentWaiterName ? currentWaiterName.charAt(0).toUpperCase() : '?';
        container.innerHTML = `<span class="text-[10px] font-bold text-amber-400">${escapeHtml(initial)}</span>`;
        if (menuThumbContainer) {
          menuThumbContainer.innerHTML = `<span class="text-[10px] font-bold text-amber-400">${escapeHtml(initial)}</span>`;
        }
      }
    }

    async function openUserProfileModal() {
      closeSettingsMenu();
      if (!currentWaiterName) return alert("Du bist nicht angemeldet!");

      const { data, error } = await fetchStaffByName(currentWaiterName);
      if (error || !data) {
        alert("Fehler beim Laden des Profils.");
        return;
      }

      document.getElementById('profileModalName').innerText = data.name;
      document.getElementById('profileModalRole').innerText = `Rolle: ${data.role || 'staff'}`;
      document.getElementById('profileInputNewPin').value = '';
      document.getElementById('profileInputBio').value = data.bio || '';
      document.getElementById('profileInputAvatarUrl').value = data.avatar_url || '';
      document.getElementById('profileAvatarFile').value = '';
      document.getElementById('profileAvatarStatus').innerText = '';

      const avatarContainer = document.getElementById('profileModalAvatarContainer');
      if (data.avatar_url) {
        avatarContainer.innerHTML = `<img src="${escapeHtml(data.avatar_url)}" class="w-full h-full object-cover" alt="${escapeHtml(data.name)}">`;
      } else {
        avatarContainer.innerHTML = `<span class="text-xl font-black text-amber-400">${escapeHtml(data.name.charAt(0).toUpperCase())}</span>`;
      }

      const modal = document.getElementById('userProfileModal');
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }

    function openUserProfileModalFromMenu() {
      closeSettingsMenu();
      openUserProfileModal();
    }

    function closeUserProfileModal() {
      const modal = document.getElementById('userProfileModal');
      modal.classList.remove('flex');
      modal.classList.add('hidden');
    }

    function openMyFullAvatar() {
      let url = document.getElementById('profileInputAvatarUrl').value;
      if (!url && currentWaiterAvatar) url = currentWaiterAvatar;
      if (url) {
        openPhotoPreview(url);
      }
    }

    async function uploadMyAvatarToSupabase(event) {
      const file = event.target.files[0];
      if (!file) return;
      const status = document.getElementById('profileAvatarStatus');
      status.innerText = "⏳ Foto wird hochgeladen...";

      const fileName = `my_avatar_${Date.now()}_${file.name}`;
      let { data, error } = await _supabase.storage.from('drinks').upload(fileName, file);

      if (error) {
        status.innerText = 'Fehler: ' + error.message;
        return;
      }

      let { data: publicURLData } = _supabase.storage.from('drinks').getPublicUrl(fileName);
      if (publicURLData && publicURLData.publicUrl) {
        document.getElementById('profileInputAvatarUrl').value = publicURLData.publicUrl;
        const avatarContainer = document.getElementById('profileModalAvatarContainer');
        avatarContainer.innerHTML = `<img src="${publicURLData.publicUrl}" class="w-full h-full object-cover" alt="">`;
        status.innerText = '✔ Foto wurde erfolgreich hinzugefügt!';
        alert("Foto wurde erfolgreich hinzugefügt!");
      }
    }

    async function saveMyUserProfile() {
      const newPin = document.getElementById('profileInputNewPin').value.trim();
      const newBio = document.getElementById('profileInputBio').value.trim();
      const newAvatarUrl = document.getElementById('profileInputAvatarUrl').value.trim();

      if (newPin !== '' && !/^\d{4,6}$/.test(newPin)) {
        alert("Der PIN muss aus 4 bis 6 Ziffern bestehen.");
        return;
      }
      let updatePayload = {};
      if (newPin !== '') {
        updatePayload.pin = newPin;
      }
      updatePayload.bio = newBio;
      if (newAvatarUrl !== '') {
        updatePayload.avatar_url = newAvatarUrl;
        currentWaiterAvatar = newAvatarUrl;
      }

      const { error } = await _supabase.rpc('update_my_profile', { p_pin: newPin, p_bio: newBio, p_avatar: newAvatarUrl });
      if (error) {
        alert("Fehler beim Speichern: " + error.message);
      } else {
        alert("Dein Profil wurde erfolgreich aktualisiert!");
        updateHeaderAvatarUI();
        await loadStaffPresenceRecordsForLogin();
        closeUserProfileModal();
      }
    }

    async function openUserDetailModal(userName) {
      const { data, error } = await fetchStaffByName(userName);
      if (error || !data) {
        alert("Benutzerdetails konnten nicht geladen werden.");
        return;
      }

      document.getElementById('userDetailName').innerText = data.name;
      document.getElementById('userDetailRole').innerText = `Rolle: ${data.role || 'staff'}`;
      document.getElementById('userDetailBio').innerText = data.bio ? data.bio : "Keine Beschreibung angegeben.";

      const avatarContainer = document.getElementById('userDetailAvatarContainer');
      if (data.avatar_url) {
        avatarContainer.innerHTML = `<img src="${escapeHtml(data.avatar_url)}" class="w-full h-full object-cover" alt="${escapeHtml(data.name)}">`;
        avatarContainer.setAttribute('onclick', `openPhotoPreview(${JSON.stringify(String(data.avatar_url))})`);
      } else {
        avatarContainer.innerHTML = `<span class="text-2xl font-black text-amber-400">${escapeHtml(data.name.charAt(0).toUpperCase())}</span>`;
        avatarContainer.removeAttribute('onclick');
      }

      const modal = document.getElementById('userDetailModal');
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }

    function closeUserDetailModal() {
      const modal = document.getElementById('userDetailModal');
      modal.classList.remove('flex');
      modal.classList.add('hidden');
    }

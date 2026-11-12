/* ============================================================
   js/profile.js
   Eigenes Profil und Profilansicht anderer Mitarbeiter
   ============================================================ */
    function updateHeaderAvatarUI() {
      const container = document.getElementById('headerUserAvatarContainer');
      const mobileAv = document.getElementById('headerMobileAvatar');
      const menuThumbContainer = document.getElementById('menuAvatarThumbnailContainer');
      const menuName = document.getElementById('menuUserName');
      const menuRole = document.getElementById('menuUserRole');
      if (menuName) menuName.textContent = currentWaiterName || t('menu.profile');
      if (menuRole) menuRole.textContent = t('menu.profileEdit', { role: ({ developer: t('role.developer'), manager: t('role.manager') }[currentStaffRole] || t('role.staff')) });

      if (mobileAv) {
        mobileAv.innerHTML = '';
        if (currentWaiterAvatar) {
          const im = document.createElement('img');
          im.src = currentWaiterAvatar; im.alt = currentWaiterName || '';
          mobileAv.appendChild(im);
        } else {
          mobileAv.textContent = currentWaiterName ? currentWaiterName.charAt(0).toUpperCase() : '?';
        }
      }

      if (currentWaiterAvatar) {
        container.innerHTML = `<img src="${escapeHtml(currentWaiterAvatar)}" class="w-full h-full object-cover" alt="${escapeHtml(currentWaiterName)}">`;
        if (menuThumbContainer) {
          menuThumbContainer.innerHTML = `<img src="${escapeHtml(currentWaiterAvatar)}" class="w-full h-full object-cover" alt="${escapeHtml(currentWaiterName)}">`;
        }
      } else {
        let initial = currentWaiterName ? currentWaiterName.charAt(0).toUpperCase() : '?';
        container.innerHTML = `<span class="text-[10px] font-bold text-amber-700 dark:text-amber-400">${escapeHtml(initial)}</span>`;
        if (menuThumbContainer) {
          menuThumbContainer.innerHTML = `<span class="text-sm font-black text-amber-700 dark:text-amber-400">${escapeHtml(initial)}</span>`;
        }
      }
    }

    let profileSnapshot = { bio: '', avatar: '' };
    let profilePinVisible = false;

    function profileRoleLabel(role) {
      return ({ developer: t('role.developer'), manager: t('role.manager') }[role]) || t('role.staff');
    }

    function renderProfileAvatar(url, name) {
      const box = document.getElementById('profileModalAvatarContainer');
      if (!box) return;
      box.innerHTML = '';
      if (url) {
        const img = document.createElement('img');
        img.src = url;
        img.alt = name || '';
        box.appendChild(img);
      } else {
        box.textContent = (name || '?').charAt(0).toUpperCase();
      }
    }

    function renderProfileRights() {
      const box = document.getElementById('profileRightsBox');
      if (!box) return;
      const rights = [
        ['🍹', t('prof.r1'), true],
        ['🍸', t('prof.r2'), userCanEdit],
        ['👤', t('prof.r3'), userIsAdmin],
        ['🗑️', t('prof.r4'), currentStaffRole === 'developer']
      ];
      box.innerHTML = rights.map(r => `
        <div class="profile-right ${r[2] ? 'on' : 'off'}">
          <span class="profile-right-ico">${r[0]}</span>
          <span class="profile-right-text">${escapeHtml(r[1])}</span>
          <span class="profile-right-state">${r[2] ? t('prof.allowed') : t('prof.notAllowed')}</span>
        </div>`).join('');
    }

    function updateProfileBioPreview() {
      const bio = document.getElementById('profileInputBio').value.trim();
      const prev = document.getElementById('profileBioPreview');
      if (prev) prev.textContent = bio || t('prof.bioEmpty');
      const cnt = document.getElementById('profileBioCount');
      if (cnt) cnt.textContent = document.getElementById('profileInputBio').value.length + ' / 140';
    }

    function updateProfileDirty() {
      const bio = document.getElementById('profileInputBio').value.trim();
      const avatar = document.getElementById('profileInputAvatarUrl').value.trim();
      const pin = document.getElementById('profileInputNewPin').value.trim();
      const dirty = bio !== profileSnapshot.bio || avatar !== profileSnapshot.avatar || pin !== '';
      const hint = document.getElementById('profileDirtyHint');
      if (hint) hint.classList.toggle('hidden', !dirty);
      const btn = document.getElementById('profileSaveBtn');
      if (btn) btn.disabled = !dirty;
    }

    function onProfileBioInput() {
      updateProfileBioPreview();
      updateProfileDirty();
    }

    function setProfileBio(text) {
      document.getElementById('profileInputBio').value = text;
      onProfileBioInput();
    }

    function onProfilePinInput() {
      const p1 = document.getElementById('profileInputNewPin').value.trim();
      const p2 = document.getElementById('profileInputPin2').value.trim();
      const hint = document.getElementById('profilePinHint');
      let msg = t('prof.pinHint');
      let bad = false;
      if (p1 !== '') {
        if (!/^\d{4,6}$/.test(p1)) { msg = t('prof.pinLenErr'); bad = true; }
        else if (p2 !== '' && p1 !== p2) { msg = t('prof.pinMismatch'); bad = true; }
        else if (p2 === '') msg = t('prof.pinRepeat');
        else msg = t('prof.pinOk');
      }
      if (hint) {
        hint.textContent = msg;
        hint.classList.toggle('profile-bad', bad);
      }
      updateProfileDirty();
    }

    function toggleProfilePinVisibility() {
      profilePinVisible = !profilePinVisible;
      ['profileInputNewPin', 'profileInputPin2'].forEach(id => {
        document.getElementById(id).type = profilePinVisible ? 'text' : 'password';
      });
    }

    async function openUserProfileModal() {
      closeSettingsMenu();
      if (!currentWaiterName) return alert("Du bist nicht angemeldet!");

      const { data, error } = await fetchStaffByName(currentWaiterName);
      if (error || !data) {
        alert(t('prof.loadErr'));
        return;
      }

      document.getElementById('profileModalName').innerText = data.name;
      const roleEl = document.getElementById('profileModalRole');
      roleEl.innerText = profileRoleLabel(data.role);
      roleEl.className = 'staff-pill ' + (data.role === 'developer' ? 'pill-dev' : data.role === 'manager' ? 'pill-manager' : 'pill-staff');
      const last = document.getElementById('profileLastLogin');
      if (last) last.textContent = t('prof.lastLogin', { when: formatRelativeTime(data.last_used_at) });

      document.getElementById('profileInputNewPin').value = '';
      document.getElementById('profileInputPin2').value = '';
      profilePinVisible = false;
      ['profileInputNewPin', 'profileInputPin2'].forEach(id => { document.getElementById(id).type = 'password'; });
      document.getElementById('profileInputBio').value = data.bio || '';
      document.getElementById('profileInputAvatarUrl').value = data.avatar_url || '';
      document.getElementById('profileAvatarFile').value = '';
      document.getElementById('profileAvatarStatus').innerText = '';
      profileSnapshot = { bio: (data.bio || '').trim(), avatar: (data.avatar_url || '').trim() };

      renderProfileAvatar(data.avatar_url, data.name);
      renderProfileRights();
      updateProfileBioPreview();
      onProfilePinInput();

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
      } else {
        showAppToast({ initial: '📷', title: t('prof.noPhotoTitle'), text: t('prof.noPhotoText') });
      }
    }

    async function uploadMyAvatarToSupabase(event) {
      const file = event.target.files[0];
      if (!file) return;
      const status = document.getElementById('profileAvatarStatus');
      status.innerText = "⏳ Foto wird hochgeladen ...";

      const fileName = `my_avatar_${Date.now()}_${file.name}`;
      let { data, error } = await _supabase.storage.from('drinks').upload(fileName, file);

      if (error) {
        status.innerText = t('prof.err', { msg: error.message });
        return;
      }

      let { data: publicURLData } = _supabase.storage.from('drinks').getPublicUrl(fileName);
      if (publicURLData && publicURLData.publicUrl) {
        document.getElementById('profileInputAvatarUrl').value = publicURLData.publicUrl;
        renderProfileAvatar(publicURLData.publicUrl, currentWaiterName);
        status.innerText = t('prof.newPhoto');
        updateProfileDirty();
      }
    }

    async function saveMyUserProfile() {
      const newPin = document.getElementById('profileInputNewPin').value.trim();
      const pin2 = document.getElementById('profileInputPin2').value.trim();
      const newBio = document.getElementById('profileInputBio').value.trim();
      const newAvatarUrl = document.getElementById('profileInputAvatarUrl').value.trim();

      if (newPin !== '') {
        if (!/^\d{4,6}$/.test(newPin)) { alert("Der PIN muss aus 4 bis 6 Ziffern bestehen."); return; }
        if (newPin !== pin2) { alert("Die beiden PINs stimmen nicht überein."); return; }
        if (/^(\d)\1+$/.test(newPin) || newPin === '1234' || newPin === '123456' || newPin === '0123') {
          if (!confirm("Dieser PIN ist leicht zu erraten. Trotzdem verwenden?")) return;
        }
      }

      const { error } = await _supabase.rpc('update_my_profile', { p_pin: newPin, p_bio: newBio, p_avatar: newAvatarUrl });
      if (error) {
        alert(t('prof.saveErr', { msg: error.message }));
        return;
      }
      if (newAvatarUrl !== '') currentWaiterAvatar = newAvatarUrl;
      profileSnapshot = { bio: newBio, avatar: newAvatarUrl };
      updateHeaderAvatarUI();
      await loadStaffPresenceRecordsForLogin();
      closeUserProfileModal();
      showAppToast({
        avatarUrl: newAvatarUrl,
        initial: currentWaiterName.charAt(0).toUpperCase(),
        title: t('prof.savedTitle'),
        text: newPin !== '' ? t('prof.savedPin') : t('prof.savedOk')
      });
    }

    async function openUserDetailModal(userName) {
      const { data, error } = await fetchStaffByName(userName);
      if (error || !data) {
        alert("Benutzerdetails konnten nicht geladen werden.");
        return;
      }

      document.getElementById('userDetailName').innerText = data.name;
      document.getElementById('userDetailRole').innerText = t('prof.role', { role: profileRoleLabel(data.role || 'staff') });
      document.getElementById('userDetailBio').innerText = data.bio ? data.bio : t('prof.noBio');

      const avatarContainer = document.getElementById('userDetailAvatarContainer');
      if (data.avatar_url) {
        avatarContainer.innerHTML = `<img src="${escapeHtml(data.avatar_url)}" class="w-full h-full object-cover" alt="${escapeHtml(data.name)}">`;
        avatarContainer.setAttribute('onclick', `openPhotoPreview(${JSON.stringify(String(data.avatar_url))})`);
      } else {
        avatarContainer.innerHTML = `<span class="text-2xl font-black text-amber-700 dark:text-amber-400">${escapeHtml(data.name.charAt(0).toUpperCase())}</span>`;
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

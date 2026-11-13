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
      let { data, error } = await _supabase.storage.from('photos').upload(fileName, file);

      if (error) {
        status.innerText = t('prof.err', { msg: error.message });
        return;
      }

      let { data: publicURLData } = _supabase.storage.from('photos').getPublicUrl(fileName);
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

    // ---------- PIN-Pflicht: nach dem Login einen eigenen PIN wählen (v1.0.10) ----------
    const PIN_WEAK = ['1234', '4321', '0123', '123456', '654321', '1212', '1004', '2580', '121212', '012345'];
    function pinClientCheck(p1, p2) {
      if (!/^\d{4,6}$/.test(p1)) return fmL('Der PIN muss aus 4 bis 6 Ziffern bestehen.', 'The PIN must be 4 to 6 digits.');
      if (PIN_WEAK.indexOf(p1) !== -1 || /^(\d)\1+$/.test(p1)) return fmL('Dieser PIN ist zu einfach (z. B. 1234 oder 1111). Bitte einen anderen wählen.', 'This PIN is too easy (e.g. 1234 or 1111). Please choose another one.');
      if (p1 !== p2) return fmL('Die beiden PINs stimmen nicht überein.', 'The two PINs do not match.');
      return '';
    }

    async function pinForceChangeIfNeeded() {
      try {
        const { data, error } = await _supabase.rpc('get_my_pin_state');
        if (error || data !== true) return;   // Datenbank-Update fehlt oder PIN schon geändert
      } catch (e) { return; }
      const m = fmOpen('pinForce', {
        title: '🔐 ' + fmL('Eigenen PIN festlegen', 'Choose your own PIN'),
        sub: fmL('Du verwendest noch den Start-PIN. Wähle jetzt deinen eigenen PIN (4 bis 6 Ziffern). Danach geht es weiter.', 'You are still using the start PIN. Choose your own PIN now (4 to 6 digits).'),
        layer: 2
      });
      m.root.style.zIndex = '9500';
      const x = m.root.querySelector('[data-fm-close]'); if (x) x.remove();   // nicht schließbar
      m.setBody(`<div class="fm-stack">
        <div class="fm-field"><label class="form-label" for="pfPin1">${escapeHtml(fmL('Neuer PIN', 'New PIN'))}</label>
          <input type="password" id="pfPin1" inputmode="numeric" maxlength="6" autocomplete="new-password" class="ui-field tracking-widest" onkeydown="if(event.key==='Enter')document.getElementById('pfPin2').focus()"></div>
        <div class="fm-field"><label class="form-label" for="pfPin2">${escapeHtml(fmL('PIN wiederholen', 'Repeat PIN'))}</label>
          <input type="password" id="pfPin2" inputmode="numeric" maxlength="6" autocomplete="new-password" class="ui-field tracking-widest" onkeydown="if(event.key==='Enter')pinForceSave()"></div>
        <p id="pfErr" class="fm-hint" style="color:#ef4444;min-height:1.2em"></p>
        <p class="fm-hint">${escapeHtml(fmL('Merke dir den PIN gut. Nicht 1234 oder 1111. Vergessen? Der Manager kann ihn zurücksetzen.', 'Remember your PIN. Not 1234 or 1111. Forgot it? The manager can reset it.'))}</p>
      </div>`);
      m.setFoot(`<button type="button" class="ui-btn-ghost" onclick="fmClose('pinForce'); handleLogout()">${escapeHtml(fmL('Abmelden', 'Log out'))}</button>
        <button type="button" class="ui-btn-primary" id="pfBtn" onclick="pinForceSave()">💾 ${escapeHtml(fmL('PIN speichern', 'Save PIN'))}</button>`);
      setTimeout(() => { const i = document.getElementById('pfPin1'); if (i) i.focus(); }, 50);
    }

    async function pinForceSave() {
      const p1 = document.getElementById('pfPin1').value.trim(), p2 = document.getElementById('pfPin2').value.trim();
      const err = document.getElementById('pfErr');
      const msg = pinClientCheck(p1, p2);
      if (msg) { err.textContent = msg; return; }
      const btn = document.getElementById('pfBtn'); btn.disabled = true;
      const { error } = await _supabase.rpc('update_my_profile', { p_pin: p1, p_bio: null, p_avatar: '' });
      btn.disabled = false;
      if (error) { err.textContent = error.message; return; }
      fmClose('pinForce');
      showAppToast({ initial: '🔐', title: fmL('PIN gespeichert', 'PIN saved'), text: fmL('Ab jetzt meldest du dich mit deinem neuen PIN an.', 'From now on you sign in with your new PIN.') });
    }

    // Developer: Start-PIN anderer Personen im Profil (nur bis die Person einen eigenen PIN gesetzt hat)
    async function pinShowForDeveloper(name) {
      const el = document.getElementById('userDetailPin');
      if (!el) return;
      el.classList.add('hidden');
      if (currentStaffRole !== 'developer') return;
      try {
        const { data, error } = await _supabase.rpc('dev_get_staff_pin', { p_name: name });
        if (error || !data) return;
        el.classList.remove('hidden');
        if (data.pin) el.innerHTML = '🔑 Start-PIN: <b style="letter-spacing:.15em">' + escapeHtml(data.pin) + '</b> <span class="opacity-70">(noch nicht von der Person geändert)</span>';
        else if (data.own_pin_set) el.innerHTML = '🔒 Hat einen eigenen PIN gesetzt (nicht sichtbar). Bei Bedarf unter „Personal & PIN“ zurücksetzen.';
        else el.classList.add('hidden');
      } catch (e) {}
    }

    async function openUserDetailModal(userName) {
      const { data, error } = await fetchStaffByName(userName);
      if (error || !data) {
        alert("Benutzerdetails konnten nicht geladen werden.");
        return;
      }
      pinShowForDeveloper(data.name);

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

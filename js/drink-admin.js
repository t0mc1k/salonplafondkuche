/* ============================================================
   js/drink-admin.js
   Getränke bearbeiten: hinzufügen, ändern, löschen, Zutaten, Foto-Upload
   ============================================================ */
    function togglePresetAllergen(allergenName, isChecked) {
      const textarea = document.getElementById('dAllergens');
      let currentVal = textarea.value.trim();
      let list = currentVal ? currentVal.split(',').map(s => s.trim()).filter(Boolean) : [];
      if (isChecked) {
        if (!list.includes(allergenName)) list.push(allergenName);
      } else {
        list = list.filter(item => item !== allergenName);
      }
      textarea.value = list.join(', ');
    }

    function addIngredientRow(name = '', amount = '') {
      const container = document.getElementById('ingredientRowsContainer');
      const rowId = 'ing_row_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5);
      const div = document.createElement('div');
      div.id = rowId;
      div.className = 'flex gap-2 items-center';
      div.innerHTML = `
        <input type="text" autocomplete="off" placeholder="Zutat (z. B. Tequila)" value="${escapeHtml(name)}" class="ing-name ui-field flex-1" onkeydown="if (event.key === 'Enter') { event.preventDefault(); this.nextElementSibling.focus(); }">
        <input type="text" autocomplete="off" placeholder="Menge (z. B. 5 cl)" value="${escapeHtml(amount)}" class="ing-amount ui-field w-32 sm:w-40" onkeydown="if (event.key === 'Enter') { event.preventDefault(); addIngredientRow(); }">
        <button type="button" onclick="document.getElementById(${jsArg(rowId)}).remove()" class="ing-remove" title="Zutat entfernen">&times;</button>
      `;
      container.appendChild(div);
      if (!name && !amount && container.children.length > 1) div.querySelector('.ing-name').focus();
    }

    function getIngredientsData() {
      const rows = document.querySelectorAll('#ingredientRowsContainer > div');
      let ingredients = [];
      rows.forEach(row => {
        let name = row.querySelector('.ing-name').value.trim();
        let amount = row.querySelector('.ing-amount').value.trim();
        if (name) ingredients.push({ name, amount });
      });
      return ingredients;
    }

    function populateIngredientRows(ingredientsArr) {
      const container = document.getElementById('ingredientRowsContainer');
      container.innerHTML = '';
      if (Array.isArray(ingredientsArr) && ingredientsArr.length > 0) {
        ingredientsArr.forEach(item => addIngredientRow(item.name, item.amount));
      } else {
        addIngredientRow('', '');
      }
    }

    // ---------- Fotos (bis zu 3) ----------
    const MAX_DRINK_PHOTOS = 3;
    let drinkFormPhotos = [];

    // Foto vor dem Hochladen verkleinern (spart Datenvolumen und Speicher)
    async function compressImageFile(file, maxSide, quality) {
      try {
        if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
        const bmp = await createImageBitmap(file);
        const scale = Math.min(1, (maxSide || 1600) / Math.max(bmp.width, bmp.height));
        if (scale === 1 && file.size < 900 * 1024) { if (bmp.close) bmp.close(); return file; }
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(bmp.width * scale);
        canvas.height = Math.round(bmp.height * scale);
        canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
        if (bmp.close) bmp.close();
        const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', quality || 0.82));
        return blob && blob.size < file.size ? blob : file;
      } catch (e) { return file; }
    }

    function renderPhotoSlots() {
      const box = document.getElementById('photoSlots');
      if (!box) return;
      let html = drinkFormPhotos.map((u, i) => `
        <div class="photo-slot">
          <img src="${escapeHtml(u)}" alt="Foto ${i + 1}" onerror="this.replaceWith(Object.assign(document.createElement('span'), { textContent: 'Foto nicht ladbar' }))">
          <span class="photo-badge ${i === 0 ? 'main' : ''}">${i === 0 ? '⭐ Hauptfoto' : 'Foto ' + (i + 1)}</span>
          <div class="photo-slot-actions">
            ${i > 0 ? `<button type="button" onclick="makeMainPhoto(${i})" title="Als Hauptfoto festlegen">⭐</button>` : ''}
            <button type="button" class="danger" onclick="removeDrinkPhoto(${i})" title="Foto entfernen">✕</button>
          </div>
        </div>`).join('');
      if (drinkFormPhotos.length < MAX_DRINK_PHOTOS) {
        html += `<button type="button" class="photo-slot photo-add" onclick="document.getElementById('imageFile').click()">
          <span class="photo-add-ico">📷</span><span>Foto hinzufügen</span><small>${drinkFormPhotos.length} / ${MAX_DRINK_PHOTOS}</small>
        </button>`;
      }
      box.innerHTML = html;
    }

    function updatePhotoPreview() { renderPhotoSlots(); }

    function removeDrinkPhoto(i) {
      drinkFormPhotos.splice(i, 1);
      renderPhotoSlots();
    }

    function makeMainPhoto(i) {
      const [p] = drinkFormPhotos.splice(i, 1);
      drinkFormPhotos.unshift(p);
      renderPhotoSlots();
    }

    function addPhotoFromUrl() {
      const input = document.getElementById('dPhoto');
      const url = input.value.trim();
      if (!url) return;
      if (!/^https?:\/\//i.test(url)) return alert("Bitte eine gültige Bild-URL angeben (beginnt mit https://).");
      if (drinkFormPhotos.length >= MAX_DRINK_PHOTOS) return alert("Es sind höchstens " + MAX_DRINK_PHOTOS + " Fotos pro Getränk möglich.");
      if (drinkFormPhotos.indexOf(url) === -1) drinkFormPhotos.push(url);
      input.value = '';
      renderPhotoSlots();
    }

    async function uploadImageToSupabase(event) {
      const files = Array.prototype.slice.call(event.target.files || []);
      event.target.value = '';
      if (!files.length) return;
      const status = document.getElementById('uploadStatus');
      const free = MAX_DRINK_PHOTOS - drinkFormPhotos.length;
      if (free <= 0) { status.innerText = 'Es sind höchstens ' + MAX_DRINK_PHOTOS + ' Fotos möglich. Entferne zuerst eines.'; return; }
      const batch = files.filter(f => /^image\//.test(f.type)).slice(0, free);
      let note = '';
      if (files.length > batch.length) note = ' (maximal ' + MAX_DRINK_PHOTOS + ' Fotos – der Rest wurde ignoriert)';

      let done = 0;
      for (const file of batch) {
        status.innerText = `⏳ Foto ${done + 1} von ${batch.length} wird verkleinert und hochgeladen ...`;
        const prepared = await compressImageFile(file);
        const isJpeg = prepared !== file;
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const fileName = `${Date.now()}_${done}_${isJpeg ? safeName.replace(/\.[^.]+$/, '') + '.jpg' : safeName}`;
        const { error } = await _supabase.storage.from('drinks').upload(fileName, prepared, isJpeg ? { contentType: 'image/jpeg' } : undefined);
        if (error) {
          console.error("Supabase Storage Error:", error);
          status.innerText = 'Fehler: ' + error.message;
          renderPhotoSlots();
          return;
        }
        const { data: pub } = _supabase.storage.from('drinks').getPublicUrl(fileName);
        if (pub && pub.publicUrl) drinkFormPhotos.push(pub.publicUrl);
        done++;
        renderPhotoSlots();
      }
      status.innerText = `✔ ${done} Foto${done === 1 ? '' : 's'} hochgeladen${note}.`;
    }

    function toggleMode() {
      if (!userIsAdmin && !userCanEdit) {
        alert("Du hast keine Verwaltungsrechte.");
        return;
      }
      isAdmin = !isAdmin;
      if (!isAdmin) resetForm();
      applyRoleUI();
      renderDrinks();
    }

    function openAddDrinkModal() {
      checkDrinkEditAuth(() => {
        resetForm();
        document.getElementById('formTitle').innerText = "➕ Neues Getränk hinzufügen";
        renderSeasonFormSelect(currentSeasonFilter);
        document.getElementById('deleteFormBtn').classList.add('hidden');
        document.getElementById('adminModal').classList.remove('hidden');
        document.getElementById('adminModal').classList.add('flex');
      });
    }

    function openAddDrinkModalFromMenu() {
      closeSettingsMenu();
      openAddDrinkModal();
    }

    function closeAdminModal() {
      resetForm();
      document.getElementById('adminModal').classList.remove('flex');
      document.getElementById('adminModal').classList.add('hidden');
    }

    function editDrink(id) {
      const d = allDrinks.find(item => item.id === id);
      if (!d) return;
      closeModal();
      document.getElementById('editingId').value = d.id;
      document.getElementById('formTitle').innerText = "✏️ Getränk bearbeiten";
      document.getElementById('dName').value = d.name || '';
      formPendingCategories = [];
      renderCategoryChooser(d.category || '');
      renderSeasonFormSelect(d.season || getAllSeasons()[0]);
      document.getElementById('dGlass').value = d.glass_type || '';
      document.getElementById('dMethod').value = d.method || '';
      document.getElementById('dIce').value = d.ice || '';
      document.getElementById('dGarnish').value = d.garnish || '';
      populateIngredientRows(d.ingredients_json);
      document.getElementById('dCost').value = d.cost_price || '';
      document.getElementById('dPrice').value = d.selling_price || '';
      document.getElementById('dAllergens').value = d.allergens || '';
      document.getElementById('dRecipe').value = d.recipe || '';
      drinkFormPhotos = getDrinkPhotos(d);
      document.getElementById('dPhoto').value = '';
      document.getElementById('dFeatured').checked = !!d.is_featured;
      document.getElementById('dVegan').checked = !!d.is_vegan;
      document.getElementById('dGlutenfree').checked = !!d.is_glutenfree;
      document.getElementById('dLactosefree').checked = !!d.is_lactosefree;
      syncAllergenChecks();
      updateMarginPreview();
      updatePhotoPreview();
      document.getElementById('adminFormBody').scrollTop = 0;
      document.getElementById('deleteFormBtn').classList.remove('hidden');
      document.getElementById('adminModal').classList.remove('hidden');
      document.getElementById('adminModal').classList.add('flex');
    }

    async function deleteDrinkConfirm(id) {
      if (confirm("Möchten Sie dieses Getränk wirklich löschen?")) {
        const { error } = await _supabase.from('drinks').delete().eq('id', id);
        if (error) return alert("Error: " + error.message);
        closeModal();
        closeAdminModal();
        loadDrinks();
      }
    }

    function deleteDrinkFromForm() {
      const id = document.getElementById('editingId').value;
      if (id) checkDrinkEditAuth(() => deleteDrinkConfirm(id));
    }

    function resetForm() {
      document.getElementById('editingId').value = '';
      document.getElementById('dName').value = '';
      formPendingCategories = [];
      renderCategoryChooser('');
      toggleNewCategoryRow(false);
      populateIngredientRows([]);
      document.getElementById('dGlass').value = '';
      document.getElementById('dMethod').value = '';
      document.getElementById('dIce').value = '';
      document.getElementById('dGarnish').value = '';
      document.getElementById('dCost').value = '';
      document.getElementById('dPrice').value = '';
      document.getElementById('dAllergens').value = '';
      document.getElementById('dRecipe').value = '';
      drinkFormPhotos = [];
      document.getElementById('dPhoto').value = '';
      document.getElementById('dFeatured').checked = false;
      document.getElementById('dVegan').checked = false;
      document.getElementById('dGlutenfree').checked = false;
      document.getElementById('dLactosefree').checked = false;
      document.querySelectorAll('.preset-alg').forEach(c => c.checked = false);
      document.getElementById('uploadStatus').innerText = '';
      updateMarginPreview();
      updatePhotoPreview();
      document.getElementById('deleteFormBtn').classList.add('hidden');
    }

    async function saveDrink() {
      checkDrinkEditAuth(async () => {
        const name = document.getElementById('dName').value;
        const category = document.getElementById('dCategory').value.trim();
        if (!name.trim()) return alert("Bitte einen Namen angeben.");
        if (!category) return alert("Bitte eine Kategorie auswählen oder eine neue anlegen.");

        const rawCost = document.getElementById('dCost').value;
        const rawPrice = document.getElementById('dPrice').value;

        const drinkObj = {
          name, category,
          season: document.getElementById('dSeason').value,
          glass_type: document.getElementById('dGlass').value,
          method: document.getElementById('dMethod').value,
          ice: document.getElementById('dIce').value,
          garnish: document.getElementById('dGarnish').value,
          ingredients_json: getIngredientsData(),
          cost_price: rawCost !== '' ? parseFloat(rawCost) || null : null,
          selling_price: rawPrice !== '' ? parseFloat(rawPrice) || null : null,
          allergens: document.getElementById('dAllergens').value,
          recipe: document.getElementById('dRecipe').value,
          photo_url: drinkFormPhotos[0] || '',
          photo_urls: drinkFormPhotos.slice(0, MAX_DRINK_PHOTOS),
          is_featured: document.getElementById('dFeatured').checked,
          is_vegan: document.getElementById('dVegan').checked,
          is_glutenfree: document.getElementById('dGlutenfree').checked,
          is_lactosefree: document.getElementById('dLactosefree').checked,
          updated_at: new Date().toISOString()
        };

        const id = document.getElementById('editingId').value;
        const persist = obj => id
          ? _supabase.from('drinks').update(obj).select().eq('id', id)
          : _supabase.from('drinks').insert([obj]).select();
        let saveRes = await persist(drinkObj);
        let photosNote = false;
        if (saveRes.error && /photo_urls/.test(saveRes.error.message || '')) {
          // Spalte für mehrere Fotos fehlt noch in der Datenbank: ohne sie speichern (nur Hauptfoto)
          delete drinkObj.photo_urls;
          saveRes = await persist(drinkObj);
          photosNote = drinkFormPhotos.length > 1;
        }

        if (saveRes.error) {
          alert("Fehler beim Speichern: " + saveRes.error.message);
          return;
        }
        if (!saveRes.data || saveRes.data.length === 0) {
          alert("Das Getränk wurde NICHT gespeichert (keine Berechtigung in der Datenbank).");
          return;
        }

        closeAdminModal();
        await loadDrinks();
        showAppToast({ initial: '🍸', title: id ? 'Getränk gespeichert' : 'Getränk angelegt', text: photosNote ? name + ' – nur das Hauptfoto gespeichert (SQL für mehrere Fotos fehlt noch)' : name, ms: photosNote ? 8000 : 5000 });
      });
    }

    // ---------- Kategorie wählen / neu anlegen ----------
    let formPendingCategories = [];

    function renderCategoryChooser(selected) {
      const box = document.getElementById('categoryChips');
      const hidden = document.getElementById('dCategory');
      if (!box || !hidden) return;
      const cats = getAllCategories(formPendingCategories);
      if (selected && !cats.some(c => c.toLowerCase() === selected.toLowerCase())) cats.push(selected);
      hidden.value = selected || '';
      box.innerHTML = cats.map(c =>
        `<button type="button" class="ui-chip ${c === selected ? 'active' : ''}" onclick="selectDrinkCategory(${jsArg(c)})">${escapeHtml(c)}</button>`
      ).join('') + `<button type="button" class="ui-chip chip-new" onclick="toggleNewCategoryRow()">➕ Neue Kategorie</button>`;
    }

    function selectDrinkCategory(name) {
      renderCategoryChooser(name);
    }

    function toggleNewCategoryRow(force) {
      const row = document.getElementById('newCategoryRow');
      if (!row) return;
      const show = force === undefined ? row.classList.contains('hidden') : !!force;
      row.classList.toggle('hidden', !show);
      if (show) document.getElementById('dNewCategory').focus();
      else document.getElementById('dNewCategory').value = '';
    }

    function addNewCategory() {
      const input = document.getElementById('dNewCategory');
      const name = input.value.trim().replace(/\s+/g, ' ');
      if (!name) return;
      if (name.length > 30) return alert("Der Name der Kategorie darf höchstens 30 Zeichen lang sein.");
      const existing = getAllCategories(formPendingCategories).find(c => c.toLowerCase() === name.toLowerCase());
      if (existing) {
        selectDrinkCategory(existing);
        showAppToast({ initial: '🏷️', title: 'Kategorie gibt es schon', text: `„${existing}“ wurde ausgewählt.` });
      } else {
        formPendingCategories.push(name);
        selectDrinkCategory(name);
        showAppToast({ initial: '🏷️', title: 'Neue Kategorie', text: `„${name}“ wird mit diesem Getränk gespeichert.` });
      }
      toggleNewCategoryRow(false);
    }

    // ---------- Allergene, Marge, Foto vorschau ----------
    function syncAllergenChecks() {
      const text = document.getElementById('dAllergens').value;
      document.querySelectorAll('.preset-alg').forEach(chk => {
        const m = /togglePresetAllergen\('([^']+)'/.exec(chk.getAttribute('onchange') || '');
        if (m) chk.checked = text.indexOf(m[1]) !== -1;
      });
    }

    function updateMarginPreview() {
      const info = document.getElementById('dMarginInfo');
      if (!info) return;
      const cost = parseFloat(document.getElementById('dCost').value);
      const price = parseFloat(document.getElementById('dPrice').value);
      if (isNaN(cost) || isNaN(price) || price <= 0) {
        info.textContent = 'Gib beide Preise ein, dann siehst du hier die Marge.';
        info.classList.remove('margin-good', 'margin-bad');
        return;
      }
      const profit = price - cost;
      const pct = (profit / price) * 100;
      const quota = (cost / price) * 100;
      info.textContent = `Marge: € ${profit.toFixed(2)} (${pct.toFixed(0)} %) · Wareneinsatz-Quote: ${quota.toFixed(0)} %`;
      info.classList.toggle('margin-good', profit > 0);
      info.classList.toggle('margin-bad', profit <= 0);
    }


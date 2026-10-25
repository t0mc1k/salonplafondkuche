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
        <input type="text" autocomplete="off" placeholder="Zutat (z. B. Tequila)" value="${escapeHtml(name)}" class="ing-name flex-1 p-2 rounded border text-xs">
        <input type="text" autocomplete="off" placeholder="Menge (z. B. 5cl, 2 Dashes)" value="${escapeHtml(amount)}" class="ing-amount w-36 p-2 rounded border text-xs">
        <button type="button" onclick="document.getElementById(${jsArg(rowId)}).remove()" class="text-red-500 dark:text-red-400 hover:text-red-300 p-2 text-base font-bold">&times;</button>
      `;
      container.appendChild(div);
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

    async function uploadImageToSupabase(event) {
      const file = event.target.files[0];
      if (!file) return;
      const status = document.getElementById('uploadStatus');
      status.innerText = "⏳ Foto wird hochgeladen...";
      
      const fileName = `${Date.now()}_${file.name}`;
      let { data, error } = await _supabase.storage.from('drinks').upload(fileName, file);
      
      if (error) {
        console.error("Supabase Storage Error:", error);
        status.innerText = 'Fehler: ' + error.message;
        return;
      }
      
      let { data: publicURLData } = _supabase.storage.from('drinks').getPublicUrl(fileName);
      if (publicURLData && publicURLData.publicUrl) {
        document.getElementById('dPhoto').value = publicURLData.publicUrl;
        status.innerText = '✔ Foto wurde erfolgreich hinzugefügt!';
        alert("Foto wurde erfolgreich hinzugefügt!");
      }
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
      document.getElementsByName('dCatRadio').forEach(r => r.checked = (r.value === d.category));
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
      document.getElementById('dPhoto').value = d.photo_url || '';
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
      document.getElementsByName('dCatRadio').forEach(r => r.checked = false);
      populateIngredientRows([]);
      document.getElementById('dGlass').value = '';
      document.getElementById('dMethod').value = '';
      document.getElementById('dIce').value = '';
      document.getElementById('dGarnish').value = '';
      document.getElementById('dCost').value = '';
      document.getElementById('dPrice').value = '';
      document.getElementById('dAllergens').value = '';
      document.getElementById('dRecipe').value = '';
      document.getElementById('dPhoto').value = '';
      document.getElementById('deleteFormBtn').classList.add('hidden');
    }

    async function saveDrink() {
      checkDrinkEditAuth(async () => {
        const name = document.getElementById('dName').value;
        let category = '';
        document.getElementsByName('dCatRadio').forEach(r => { if (r.checked) category = r.value; });
        if (!name || !category) return alert("Bitte Name und Kategorie angeben.");

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
          photo_url: document.getElementById('dPhoto').value,
          updated_at: new Date().toISOString()
        };

        const id = document.getElementById('editingId').value;
        let saveRes;
        if (id) saveRes = await _supabase.from('drinks').update(drinkObj).select().eq('id', id);
        else saveRes = await _supabase.from('drinks').insert([drinkObj]).select();

        if (saveRes.error) {
          alert("Fehler beim Speichern: " + saveRes.error.message);
          return;
        }
        if (!saveRes.data || saveRes.data.length === 0) {
          alert("Das Getränk wurde NICHT gespeichert (keine Berechtigung in der Datenbank).");
          return;
        }

        closeAdminModal();
        loadDrinks();
      });
    }

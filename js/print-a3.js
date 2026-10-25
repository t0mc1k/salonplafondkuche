/* ============================================================
   js/print-a3.js
   Karten-Druck (A3)
   ============================================================ */
    function openA3PrintSetupModal() {
      closeSettingsMenu();
      const seasons = getAllSeasons();
      const select = document.getElementById('a3SeasonSelect');
      select.innerHTML = seasons.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
      if (currentSeasonFilter) select.value = currentSeasonFilter;
      renderA3DrinkSelectionList();
      const modal = document.getElementById('a3PrintSetupModal');
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }

    function closeA3PrintSetupModal() {
      document.getElementById('a3PrintSetupModal').classList.remove('flex');
      document.getElementById('a3PrintSetupModal').classList.add('hidden');
    }

    function renderA3DrinkSelectionList() {
      const selectedSeason = document.getElementById('a3SeasonSelect').value;
      const seasonDrinks = allDrinks.filter(d => (d.season || '') === selectedSeason);
      const container = document.getElementById('a3DrinkCheckboxList');

      if (seasonDrinks.length === 0) {
        container.innerHTML = `<p class="text-slate-500 italic text-xs text-center py-4">Keine Getränke in dieser Saison gefunden.</p>`;
        return;
      }

      container.innerHTML = seasonDrinks.map(d => `
        <label class="flex items-center gap-2.5 p-2 rounded hover:bg-slate-800/50 cursor-pointer text-xs">
          <input type="checkbox" name="a3DrinkCheckbox" value="${d.id}" onchange="updateA3SelectionCount()" class="accent-amber-500 w-4 h-4">
          <span class="font-bold">${escapeHtml(d.name)}</span> <span class="text-slate-400">(${escapeHtml(d.category || '')})</span>
        </label>
      `).join('');
      updateA3SelectionCount();
    }

    function updateA3SelectionCount() {
      const checked = document.querySelectorAll('input[name="a3DrinkCheckbox"]:checked');
      const badge = document.getElementById('a3SelectedCountBadge');
      badge.innerText = `${checked.length} / 3 gewählt`;
      if (checked.length > 3) {
        alert("Du kannst maximal 3 Getränke für die A3 Karte auswählen.");
        event.target.checked = false;
        updateA3SelectionCount();
      }
    }

    function generateA3PrintPreview() {
      const checked = document.querySelectorAll('input[name="a3DrinkCheckbox"]:checked');
      if (checked.length === 0) return alert("Bitte wähle mindestens ein Getränk aus.");

      const showImage = document.getElementById('a3OptionImage').checked;
      const showPrice = document.getElementById('a3OptionPrice').checked;

      const drinksListContainer = document.getElementById('a3PrintDrinksList');

      let html = '';
      checked.forEach(chk => {
        let d = allDrinks.find(item => item.id === chk.value);
        if (!d) return;

        let priceText = (showPrice && d.selling_price) ? ` — € ${parseFloat(d.selling_price).toFixed(2)}` : '';
        let photoHtml = (showImage && d.photo_url) ? `<img src="${escapeHtml(d.photo_url)}" class="w-full h-48 object-cover rounded-xl mb-4 border border-slate-300" alt="">` : '';

        let ingredientsHtml = '';
        if (Array.isArray(d.ingredients_json) && d.ingredients_json.length > 0) {
          ingredientsHtml = d.ingredients_json.map(i => `<div class="flex justify-between py-1 border-b border-slate-200 text-sm"><span>${escapeHtml(i.name)}</span><span class="font-bold">${escapeHtml(i.amount || '-')}</span></div>`).join('');
        }

        html += `
          <div class="p-6 border-2 border-slate-900 rounded-2xl flex flex-col gap-3 page-break bg-white">
            ${photoHtml}
            <div class="flex justify-between items-baseline">
              <h3 class="text-2xl font-black uppercase tracking-wide text-slate-900">${escapeHtml(d.name)}${priceText}</h3>
              <span class="text-xs font-bold uppercase text-slate-600">${escapeHtml(d.category || '')}</span>
            </div>
            <div class="text-xs text-slate-700 grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div><b>Glas:</b> ${escapeHtml(d.glass_type || '-')}</div>
              <div><b>Method:</b> ${escapeHtml(d.method || '-')}</div>
              <div><b>Ice:</b> ${escapeHtml(d.ice || '-')}</div>
              <div><b>Garnish:</b> ${escapeHtml(d.garnish || '-')}</div>
            </div>
            <div class="flex flex-col gap-1 mt-1">
              <span class="text-xs font-bold uppercase text-slate-900 border-b border-slate-300 pb-1">Zutaten:</span>
              ${ingredientsHtml}
            </div>
            ${d.recipe ? `<div class="text-xs text-slate-700 mt-2"><b>Zubereitung:</b> ${escapeHtml(d.recipe)}</div>` : ''}
          </div>
        `;
      });

      drinksListContainer.innerHTML = html;
      closeA3PrintSetupModal();

      const previewModal = document.getElementById('a3PrintPreviewModal');
      previewModal.classList.remove('hidden');
      previewModal.classList.add('flex');
    }

    function closeA3PrintPreviewModal() {
      const previewModal = document.getElementById('a3PrintPreviewModal');
      previewModal.classList.remove('flex');
      previewModal.classList.add('hidden');
    }

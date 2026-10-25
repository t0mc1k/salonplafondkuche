/* ============================================================
   js/drinks.js
   Getränkeliste: laden, filtern, anzeigen, Detail-Fenster, einzelnes Rezept drucken
   ============================================================ */
    function refreshData() {
      closeSettingsMenu();
      loadDrinks();
      checkPendingTicketsBadge();
    }

    function onSearchInput() {
      const val = document.getElementById('searchInput').value;
      const clearBtn = document.getElementById('clearSearchBtn');
      if (val.length > 0) { clearBtn.classList.remove('hidden'); clearBtn.classList.add('flex'); }
      else { clearBtn.classList.add('hidden'); clearBtn.classList.remove('flex'); }
      renderDrinks();
    }

    function clearSearch() {
      document.getElementById('searchInput').value = '';
      onSearchInput();
    }

    function toggleSpecialFilter(filterType) {
      if (activeSpecialFilter === filterType) activeSpecialFilter = null;
      else activeSpecialFilter = filterType;
      
      const filterButtons = { featured: 'filterFeatured', vegan: 'filterVegan', glutenfree: 'filterGluten', lactosefree: 'filterLactose', nonalcoholic: 'filterNonAlc', favorites: 'filterFavs' };
      Object.values(filterButtons).forEach(id => {
        const el = document.getElementById(id);
        if (el) el.className = 'px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 hover:border-amber-500 whitespace-nowrap';
      });
      if (activeSpecialFilter && filterButtons[activeSpecialFilter]) {
        const activeEl = document.getElementById(filterButtons[activeSpecialFilter]);
        if (activeEl) activeEl.className = 'px-3 py-1 rounded-full bg-amber-500 text-slate-950 font-bold border border-amber-400 whitespace-nowrap';
      }
      renderDrinks();
    }

    function toggleGlassFilter(glassType) {
      if (selectedGlassFilter === glassType) selectedGlassFilter = null;
      else selectedGlassFilter = glassType;
      renderGlassFilterButtons();
      renderDrinks();
    }

    function renderGlassFilterButtons() {
      let glasses = [];
      allDrinks.forEach(d => {
        if (d.glass_type && !glasses.includes(d.glass_type.trim())) glasses.push(d.glass_type.trim());
      });
      const container = document.getElementById('glassFilterContainer');
      if (glasses.length === 0) {
        container.innerHTML = `<span class="text-slate-500 italic">Keine Glas-Typen vorhanden</span>`;
        return;
      }
      container.innerHTML = glasses.map(g => {
        let active = selectedGlassFilter === g ? 'bg-amber-500 text-slate-950 font-bold border-amber-400' : 'custom-box hover:bg-slate-200 dark:hover:bg-slate-700';
        return `<button onclick="toggleGlassFilter(${jsArg(g)})" class="px-2.5 py-1 rounded-lg border text-xs ${active}">${escapeHtml(g)}</button>`;
      }).join('');
    }

    function toggleShiftFavorite(id, event) {
      if (event) event.stopPropagation();
      let index = shiftFavorites.indexOf(id);
      if (index > -1) {
        shiftFavorites.splice(index, 1);
      } else {
        shiftFavorites.push(id);
      }
      localStorage.setItem('salon_shift_favorites', JSON.stringify(shiftFavorites));
      renderDrinks();
      const d = allDrinks.find(item => item.id === id);
      if (d) openDrinkModal(id);
    }

    async function loadDrinks() {
      const { data, error } = await _supabase.from('drinks').select('*').order('created_at', { ascending: false });
      if (error) { console.error(error); return; }
      allDrinks = data || [];
      if (!currentSeasonFilter) {
        currentSeasonFilter = determineActiveSeasonAutomatically();
      }
      updateActiveSeasonBadgeUI();
      renderSeasonFormSelect(currentSeasonFilter);
      renderGlassFilterButtons();
      renderDrinks();
      renderBarTrayUI();
    }

    function renderCategories() {
      const fixedCategories = ['Alle', 'Cocktails', 'Mocktails', 'Salonplafond Classic', 'After Dinner Drinks', 'APERITTIF'];
      if (!fixedCategories.includes(selectedCat)) selectedCat = 'Alle';
      document.getElementById('categories').innerHTML = fixedCategories.map(c => `
        <button onclick="setCategory(${jsArg(c)})" class="px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap ${selectedCat === c ? 'bg-amber-500 text-slate-950 font-bold' : 'custom-box hover:bg-slate-200 dark:hover:bg-slate-700'}">${c}</button>
      `).join('');
    }

    function setCategory(cat) { selectedCat = cat; renderDrinks(); renderCategories(); }

    function renderDrinks() {
      const search = document.getElementById('searchInput').value.toLowerCase();
      let filtered = allDrinks.filter(d => {
        let drinkSeason = d.season || '';
        let matchesSeason = drinkSeason === currentSeasonFilter;
        const matchesCat = selectedCat === 'Alle' || d.category === selectedCat;
        let ingSearchText = Array.isArray(d.ingredients_json) ? d.ingredients_json.map(i => i.name).join(' ') : (d.ingredients || '');
        const matchesSearch = d.name.toLowerCase().includes(search) || ingSearchText.toLowerCase().includes(search);
        
        let matchesFilter = true;
        if (activeSpecialFilter === 'featured') matchesFilter = d.is_featured;
        if (activeSpecialFilter === 'vegan') matchesFilter = d.is_vegan || (d.allergens && d.allergens.toLowerCase().includes('vegan'));
        if (activeSpecialFilter === 'glutenfree') matchesFilter = d.is_glutenfree || (d.allergens && d.allergens.toLowerCase().includes('gluten'));
        if (activeSpecialFilter === 'lactosefree') matchesFilter = d.is_lactosefree || (d.allergens && d.allergens.toLowerCase().includes('laktose'));
        if (activeSpecialFilter === 'nonalcoholic') matchesFilter = d.category === 'Mocktails';
        if (activeSpecialFilter === 'favorites') matchesFilter = shiftFavorites.includes(d.id);
        
        let matchesGlass = selectedGlassFilter ? (d.glass_type && d.glass_type.trim() === selectedGlassFilter) : true;

        return matchesSeason && matchesCat && matchesSearch && matchesFilter && matchesGlass;
      });

      const container = document.getElementById('drinksGrid');
      if (filtered.length === 0) {
        container.className = 'block';
        container.innerHTML = '<p class="text-center text-slate-500 py-12">Keine Getränke in dieser Saison gefunden.</p>';
        return;
      }

      if (viewMode === 'grid') {
        container.className = 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6';
        container.innerHTML = filtered.map(d => {
          let photoHtml = d.photo_url ? `<img src="${escapeHtml(d.photo_url)}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300" alt="">` : `<div class="flex items-center justify-center h-full text-slate-500 text-xs">Kein Bild</div>`;
          let badgeHtml = d.is_featured ? '<span class="absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500 text-slate-950 shadow">⭐ TOP</span>' : '';
          let isFav = shiftFavorites.includes(d.id);
          let favBtnHtml = `<button onclick="toggleShiftFavorite(${jsArg(d.id)}, event)" class="absolute top-2 left-2 text-sm p-1 rounded-full bg-white/80 dark:bg-slate-900/80 hover:bg-white dark:hover:bg-slate-900 ${isFav ? 'text-red-500' : 'text-slate-400'}">${isFav ? '❤️' : '🤍'}</button>`;
          let isTray = barTraySelection.includes(d.id);
          let trayBtnHtml = `<button onclick="toggleBarTrayItem(${jsArg(d.id)}, event)" class="absolute bottom-2 right-2 text-xs px-2.5 py-1.5 rounded-xl font-black shadow-lg transition ${isTray ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-300' : 'bg-white/90 dark:bg-slate-900/90 text-amber-600 dark:text-amber-400 border border-amber-500/50 hover:bg-white dark:hover:bg-slate-900'}" title="In Multi-View werfen">⚡</button>`;
          let priceText = d.selling_price ? ` (€ ${parseFloat(d.selling_price).toFixed(2)})` : '';
          return `<div data-drink-id="${escapeHtml(d.id)}" onclick="openDrinkModal(${jsArg(d.id)})" class="card overflow-hidden cursor-pointer flex flex-col justify-between group"><div class="relative h-48 bg-slate-200 dark:bg-slate-800">${photoHtml}${badgeHtml}${favBtnHtml}${trayBtnHtml}<span class="absolute bottom-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded bg-white/90 dark:bg-slate-900/85 text-amber-600 dark:text-amber-400 border border-amber-500/30">${escapeHtml(d.category || 'Getränk')}</span></div><div class="p-4 text-center"><h3 class="text-lg font-bold group-hover:text-amber-500 transition">${escapeHtml(d.name)}${priceText}</h3><span class="text-xs text-slate-500 dark:text-slate-400 mt-1 inline-block">Klicken für Rezept</span></div></div>`;
        }).join('');
      } else {
        container.className = 'flex flex-col gap-3';
        container.innerHTML = filtered.map(d => {
          let photoHtml = d.photo_url ? `<img src="${escapeHtml(d.photo_url)}" class="w-14 h-14 object-cover rounded-lg shrink-0" alt="">` : `<div class="w-14 h-14 bg-slate-200 dark:bg-slate-800 rounded-lg shrink-0 flex items-center justify-center text-[10px] text-slate-500">No Pic</div>`;
          let badgeHtml = d.is_featured ? '<span class="text-xs font-bold px-2 py-0.5 rounded bg-amber-500 text-slate-950">⭐ TOP</span>' : '';
          let isFav = shiftFavorites.includes(d.id);
          let isTray = barTraySelection.includes(d.id);
          let trayBtnHtml = `<button onclick="toggleBarTrayItem(${jsArg(d.id)}, event)" class="text-xs px-2.5 py-1.5 rounded-xl font-bold transition ${isTray ? 'bg-amber-500 text-slate-950' : 'custom-box hover:bg-slate-200 dark:hover:bg-slate-700 text-amber-600 dark:text-amber-400 border'}" title="In Multi-View werfen">⚡</button>`;
          let priceText = d.selling_price ? ` (€ ${parseFloat(d.selling_price).toFixed(2)})` : '';
          return `<div data-drink-id="${escapeHtml(d.id)}" onclick="openDrinkModal(${jsArg(d.id)})" class="list-item p-3 cursor-pointer flex items-center justify-between gap-4 group"><div class="flex items-center gap-4 min-w-0">${photoHtml}<div class="min-w-0"><div class="flex items-center gap-2 flex-wrap"><h3 class="text-base font-bold group-hover:text-amber-500 transition truncate">${escapeHtml(d.name)}${priceText}</h3>${badgeHtml}</div><p class="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">${escapeHtml(d.method ? 'Method: ' + d.method : (d.category || ''))}</p></div></div><div class="flex items-center gap-2 shrink-0">${trayBtnHtml}<button onclick="toggleShiftFavorite(${jsArg(d.id)}, event)" class="text-sm p-1.5 rounded-lg custom-box border hover:bg-slate-200 dark:hover:bg-slate-700">${isFav ? '❤️' : '🤍'}</button><span class="text-xs font-semibold px-2.5 py-1 rounded custom-box border">${escapeHtml(d.category || 'Getränk')}</span></div></div>`;
        }).join('');
      }
    }

    function openDrinkModal(id) {
      const d = allDrinks.find(item => item.id === id);
      if (!d) return;
      
      currentPhotoPreviewUrl = d.photo_url || null;
      const photoBtn = document.getElementById('modalPhotoBtn');
      if (d.photo_url) {
        photoBtn.classList.remove('hidden');
        photoBtn.classList.add('flex');
      } else {
        photoBtn.classList.add('hidden');
        photoBtn.classList.remove('flex');
      }

      let html = '';
      if (d.photo_url) html += `<img id="printModalImage" src="${escapeHtml(d.photo_url)}" onclick="openPhotoPreview(${jsArg(d.photo_url)})" class="w-full h-64 object-cover rounded-xl mb-4 shadow cursor-pointer hover:opacity-95 transition" title="Klicken für Großansicht" alt="${escapeHtml(d.name)}">`;
      let priceText = d.selling_price ? ` (€ ${parseFloat(d.selling_price).toFixed(2)})` : '';
      html += `<div class="flex items-center gap-2 mb-2 flex-wrap"><span class="text-xs font-semibold px-2.5 py-1 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">${escapeHtml(d.category || 'Getränk')}</span></div>`;
      html += `<h2 class="text-3xl font-bold mb-4">${escapeHtml(d.name)}${priceText}</h2>`;

      if (userIsAdmin && isAdmin && d.selling_price && d.cost_price && parseFloat(d.selling_price) > 0) {
        let sp = parseFloat(d.selling_price);
        let cp = parseFloat(d.cost_price);
        let profit = sp - cp;
        let margin = ((profit / sp) * 100).toFixed(1);
        html += `<div class="no-print mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs flex justify-between items-center text-amber-700 dark:text-amber-300"><span>💶 Marge: <b>${margin}%</b> (Gewinn: <b>${profit.toFixed(2)} €</b>)</span><span class="text-[10px] text-slate-500 dark:text-slate-400">Wareneinsatz: ${cp.toFixed(2)} €</span></div>`;
      }

      html += `<div class="mb-6 border rounded-xl overflow-hidden custom-box text-xs">`;
      html += `<div class="grid grid-cols-2 border-b border-slate-200 dark:border-slate-800 p-2.5 bg-slate-100/50 dark:bg-slate-900/50"><div><span class="text-slate-500 dark:text-slate-400 font-semibold block">Glass:</span> ${escapeHtml(d.glass_type || '-')}</div><div><span class="text-slate-500 dark:text-slate-400 font-semibold block">Method:</span> ${escapeHtml(d.method || '-')}</div></div>`;
      html += `<div class="border-b border-slate-200 dark:border-slate-800 p-2.5 bg-slate-100/30 dark:bg-slate-900/30"><span class="text-slate-500 dark:text-slate-400 font-semibold block">Ice:</span> ${escapeHtml(d.ice || '-')}</div>`;
      html += `<div class="p-2.5 border-b border-slate-200 dark:border-slate-800"><div class="grid grid-cols-2 font-bold text-amber-600 dark:text-amber-400 pb-1.5 border-b border-slate-200 dark:border-slate-800 mb-1.5"><span>Ingredients:</span><span>Amount:</span></div>`;
      if (Array.isArray(d.ingredients_json) && d.ingredients_json.length > 0) {
        d.ingredients_json.forEach(ing => {
          html += `<div class="grid grid-cols-2 py-1 border-b border-slate-200 dark:border-slate-800/50 last:border-0"><span class="font-medium">${escapeHtml(ing.name)}</span><span class="text-amber-600 dark:text-amber-300 font-semibold">${escapeHtml(ing.amount || '-')}</span></div>`;
        });
      } else {
        html += `<div class="py-1 text-slate-500 italic">Keine Zutaten angegeben</div>`;
      }
      html += `</div>`;
      
      if (d.allergens) {
        html += `<div class="p-2.5 custom-box border-b border-slate-200 dark:border-slate-800"><span class="text-amber-600 dark:text-amber-400 font-semibold block mb-0.5">⚠️ Allergene:</span> <span>${escapeHtml(d.allergens)}</span></div>`;
      }

      html += `<div class="p-2.5 bg-slate-100/30 dark:bg-slate-900/30"><span class="text-slate-500 dark:text-slate-400 font-semibold block">Garnish:</span> ${escapeHtml(d.garnish || '-')}</div>`;
      html += `</div>`;

      if (d.recipe) {
        html += `<div class="mb-4 custom-box p-3 rounded-xl text-xs border"><p class="font-bold text-amber-600 dark:text-amber-400 mb-1">Zubereitung</p><p class="whitespace-pre-line">${escapeHtml(d.recipe)}</p></div>`;
      }

      if (d.updated_at) {
        let updateDate = new Date(d.updated_at).toLocaleString();
        html += `<div class="no-print text-[10px] text-slate-500 dark:text-slate-400 mt-2">🕒 Letzte Änderung: ${updateDate}</div>`;
      }

      document.getElementById('modalContent').innerHTML = html;
      
      let isFav = shiftFavorites.includes(d.id);
      document.getElementById('modalFavBtn').innerText = isFav ? 'Favorit ✓' : 'Schicht-Favorit';

      document.getElementById('modalFavBtn').onclick = function() {
        toggleShiftFavorite(d.id);
      };

      document.getElementById('modalEditBtn').onclick = function() {
        closeModal();
        checkDrinkEditAuth(() => editDrink(d.id));
      };

      document.getElementById('modalDeleteBtn').onclick = function() {
        checkDrinkEditAuth(() => deleteDrinkConfirm(d.id));
      };

      document.getElementById('drinkModal').classList.remove('hidden');
      document.getElementById('drinkModal').classList.add('flex');
    }

    function closeModal() {
      document.getElementById('drinkModal').classList.remove('flex');
      document.getElementById('drinkModal').classList.add('hidden');
    }

    function openPrintOptionsModal() {
      const modal = document.getElementById('printOptionsModal');
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }

    function closePrintOptionsModal() {
      const modal = document.getElementById('printOptionsModal');
      modal.classList.remove('flex');
      modal.classList.add('hidden');
    }

    function executePrint(withImage) {
      closePrintOptionsModal();
      if (withImage) {
        document.body.classList.remove('print-no-images');
      } else {
        document.body.classList.add('print-no-images');
      }
      window.print();
    }

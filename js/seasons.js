/* ============================================================
   js/seasons.js
   Saisons: erstellen, umbenennen, löschen, auswählen
   ============================================================ */
    function openSeasonModal() {
      closeSettingsMenu();
      renderSeasonModalList();
      document.getElementById('seasonModal').classList.remove('hidden');
      document.getElementById('seasonModal').classList.add('flex');
    }

    function closeSeasonModal() {
      document.getElementById('seasonModal').classList.remove('flex');
      document.getElementById('seasonModal').classList.add('hidden');
    }

    function createNewSeasonPrompt() {
      closeSettingsMenu();
      checkDishEditAuth(async () => {
        let newSeasonName = prompt("Namen für die neue Saison eingeben (z. B. Sommer 2027 oder 01.05.2027 - 31.10.2027):");
        if (!newSeasonName || newSeasonName.trim() === '') return;

        let formatted = newSeasonName.trim();
        
        const { error } = await _supabase.from('dishes').insert([{
          name: "Willkommens-Gericht (Saison-Start)",
          category: "Hauptgerichte",
          season: formatted,
          plate_type: "Teller",
          method: "",
          cook_time: "",
          garnish: "",
          ingredients_json: [{ name: "Neue Saison", amount: "1x" }],
          recipe: "Erstes Gericht dieser neuen Saison. Bitte bearbeiten oder löschen.",
          is_featured: false
        }]);

        if (error) {
          alert("Fehler beim Erstellen der Saison: " + error.message);
        } else {
          alert(`Saison "${formatted}" wurde erfolgreich erstellt!`);
          await loadDishes();
          selectSeason(formatted);
        }
      });
    }

    function getAllSeasons() {
      let seasons = [];
      allDishes.forEach(d => {
        if (d.season && d.season !== 'current' && !seasons.includes(d.season)) seasons.push(d.season);
      });
      return seasons;
    }

    function determineActiveSeasonAutomatically() {
      const seasons = getAllSeasons();
      return seasons[0] || null;
    }

    function updateActiveSeasonBadgeUI() {
      const menuSub = document.getElementById('menuSeasonSub');
      if (menuSub) menuSub.textContent = currentSeasonFilter ? 'Aktiv: ' + currentSeasonFilter : 'Aktive Karte wechseln';
      const badge = document.getElementById('activeSeasonBadge');
      const seasonNameEl = document.getElementById('activeSeasonName');
      if (!currentSeasonFilter) {
        badge.classList.remove('flex');
        badge.classList.add('hidden');
      } else {
        badge.classList.remove('hidden');
        badge.classList.add('flex');
        seasonNameEl.innerText = currentSeasonFilter;
      }
    }

    async function renameSeason(oldSeasonName, event) {
      if (event) event.stopPropagation();
      checkDishEditAuth(async () => {
        const newSeasonName = prompt(`Neuen Namen für die Saison "${oldSeasonName}" eingeben:`, oldSeasonName);
        if (!newSeasonName || newSeasonName.trim() === '' || newSeasonName.trim() === oldSeasonName) return;

        const formattedNewName = newSeasonName.trim();
        const { error } = await _supabase.from('dishes').update({ season: formattedNewName }).eq('season', oldSeasonName);
        
        if (error) {
          alert("Fehler beim Umbenennen: " + error.message);
          return;
        }

        alert(`Saison erfolgreich in "${formattedNewName}" umbenannt!`);
        currentSeasonFilter = formattedNewName;
        await loadDishes();
        closeSeasonModal();
      });
    }

    async function deleteEntireSeason(seasonKey, event) {
      if (event) event.stopPropagation();
      checkDishEditAuth(async () => {
        if (!confirm(`Möchten Sie wirklich die gesamte Saison "${seasonKey}" und alle darin enthaltenen Gerichte permanent löschen?`)) return;

        const { error: dishesErr } = await _supabase.from('dishes').delete().eq('season', seasonKey);
        if (dishesErr) {
          alert("Fehler beim Löschen der Gerichte der Saison: " + dishesErr.message);
          return;
        }

        alert(`Saison "${seasonKey}" wurde erfolgreich gelöscht!`);
        currentSeasonFilter = null;
        await loadDishes();
        closeSeasonModal();
      });
    }

    function renderSeasonModalList() {
      const seasons = getAllSeasons();
      const listContainer = document.getElementById('seasonModalList');
      if (seasons.length === 0) {
        listContainer.innerHTML = `<p class="text-slate-500 italic text-xs text-center py-4">Keine Saisons in der Datenbank gefunden.</p>`;
        return;
      }
      listContainer.innerHTML = seasons.map(s => {
        let activeClass = currentSeasonFilter === s ? 'border-amber-500 bg-amber-500/10' : 'custom-box border';
        
        let renameBtnHtml = `<button onclick="renameSeason(${jsArg(s)}, event)" class="p-1.5 px-2.5 bg-amber-500/25 hover:bg-amber-500 text-amber-700 dark:text-amber-400 hover:text-slate-950 rounded-lg transition text-xs font-bold border border-amber-500/30" title="Saison umbenennen">✏️</button>`;
        let deleteBtnHtml = `<button onclick="deleteEntireSeason(${jsArg(s)}, event)" class="p-1.5 px-2.5 bg-red-500/20 hover:bg-red-500 text-red-600 dark:text-red-400 hover:text-white rounded-lg transition text-xs font-bold border border-red-500/30 ml-1" title="Saison löschen">🗑️</button>`;

        return `
          <div class="p-3.5 rounded-xl ${activeClass} transition flex items-center justify-between gap-3 cursor-pointer hover:border-amber-400" onclick="selectSeason(${jsArg(s)})">
            <div class="flex flex-col text-left min-w-0">
              <span class="text-sm font-bold truncate">📅 ${escapeHtml(s)}</span>
              <span class="text-[10px] text-slate-600 dark:text-slate-400">${currentSeasonFilter === s ? 'Aktive Saison ✓' : 'Klicken zum Aktivieren'}</span>
            </div>
            <div class="flex items-center shrink-0" onclick="event.stopPropagation()">
              ${renameBtnHtml}
              ${deleteBtnHtml}
            </div>
          </div>
        `;
      }).join('');
    }

    function renderSeasonFormSelect(selectedVal = '') {
      const seasons = getAllSeasons();
      const select = document.getElementById('dSeason');
      let html = '';
      seasons.forEach(s => {
        html += `<option value="${escapeHtml(s)}" ${selectedVal === s ? 'selected' : ''}>📅 ${escapeHtml(s)}</option>`;
      });
      html += `<option value="addNew">➕ Neue Saison erstellen...</option>`;
      select.innerHTML = html;
      if (selectedVal) select.value = selectedVal;
    }

    function handleSeasonSelectChange(selectEl) {
      if (selectEl.value === 'addNew') {
        let newSeasonName = prompt('Zeitraum eingeben (z. B. 01.04.2027 – 30.09.2027):');
        if (newSeasonName && newSeasonName.trim() !== '') {
          let formattedName = newSeasonName.trim();
          let select = document.getElementById('dSeason');
          let opt = document.createElement('option');
          opt.value = formattedName;
          opt.text = `📅 ${formattedName}`;
          select.insertBefore(opt, select.lastElementChild);
          select.value = formattedName;
        } else {
          selectEl.value = getAllSeasons()[0];
        }
      }
    }

    function selectSeason(seasonKey) {
      currentSeasonFilter = seasonKey;
      closeSeasonModal();
      updateActiveSeasonBadgeUI();
      renderCategories();
      renderDishes();
    }

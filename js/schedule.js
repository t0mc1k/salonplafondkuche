/* ============================================================
   js/schedule.js
   Arbeitsplan (Supabase Integration: Fix Fokus & Live Search)
   ============================================================ */

    let currentScheduleView = 'personal'; // 'personal' alebo 'team'
    let teamSearchQuery = '';             // Text pre vyhľadávanie / filter mena
    let cachedTeamSchedules = [];         // Uložené dáta celého tímu pre rýchle filtrovanie bez zbytočného načítavania

    // Pomocná funkcia na prevod Excel desatinného čísla na čas "HH:MM"
    function excelDecimalToTime(val) {
      if (val === null || val === undefined || val === "") return "";
      let str = String(val).trim();

      if (str.includes(":") || isNaN(Number(str))) {
        return str;
      }

      let num = parseFloat(str);
      if (num >= 0) {
        let timeFraction = num % 1;
        let totalMinutes = Math.round(timeFraction * 24 * 60);
        let hours = Math.floor(totalMinutes / 60);
        let minutes = totalMinutes % 60;
        return String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0');
      }

      return str;
    }

    async function openWorkScheduleModal() {
      closeSettingsMenu();
      currentScheduleView = 'personal';
      teamSearchQuery = '';
      cachedTeamSchedules = [];
      renderScheduleModalContent();
    }

    async function renderScheduleModalContent() {
      const container = document.getElementById('workScheduleContentContainer');
      const modal = document.getElementById('workScheduleModal');
      modal.classList.remove('hidden');
      modal.classList.add('flex');

      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();

      let headerHtml = `
        <div class="flex justify-between items-center mb-3 pb-2 border-b border-slate-700">
          <div class="flex gap-1 bg-slate-800 p-1 rounded-lg">
            <button onclick="switchScheduleView('personal')" class="px-3 py-1 text-xs font-bold rounded transition ${currentScheduleView === 'personal' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'}">
              👤 Mein Plan
            </button>
            ${userIsAdmin ? `<button onclick="switchScheduleView('team')" class="px-3 py-1 text-xs font-bold rounded transition ${currentScheduleView === 'team' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'}">
              👥 Team-Ansicht (Manager)
            </button>` : ''}
          </div>
          <span class="text-[10px] uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-semibold">Live DB</span>
        </div>
      `;

      if (currentScheduleView === 'personal') {
        container.innerHTML = headerHtml + `<p class="text-slate-500 italic text-xs text-center py-4">Lade Arbeitsplan für ${escapeHtml(currentWaiterName)}...</p>`;

        try {
          const { data: schedules, error } = await _supabase
            .from("work_schedules")
            .select("*")
            .ilike("employee_name", `%${currentWaiterName}%`)
            .eq("month", currentMonth)
            .eq("year", currentYear)
            .order("day", { ascending: true });

          if (error) throw new Error(error.message);

          if (!schedules || schedules.length === 0) {
            container.innerHTML = headerHtml + `
              <p class="text-slate-500 italic text-xs text-center py-6">Keine Schichten für diesen Monat (${currentMonth}/${currentYear}) gefunden.</p>
            `;
            return;
          }

          let htmlRows = schedules.map(s => {
            let s1Start = excelDecimalToTime(s.shift_1_start);
            let s1End = excelDecimalToTime(s.shift_1_end);
            let s2Start = excelDecimalToTime(s.shift_2_start);
            let s2End = excelDecimalToTime(s.shift_2_end);

            let timeStr = "";
            if (s1Start && s1End) timeStr += `${s1Start} – ${s1End}`;
            else if (s1Start) timeStr += s1Start;

            if (s2Start && s2End) {
              if (timeStr) timeStr += " / ";
              timeStr += `${s2Start} – ${s2End}`;
            } else if (s2Start) {
              if (timeStr) timeStr += " / ";
              timeStr += s2Start;
            }

            if (!timeStr || timeStr === "X – X" || timeStr.toUpperCase() === "X") {
              timeStr = "Frei (X)";
            }

            return `
              <div class="custom-box p-2.5 rounded-lg border flex items-center justify-between text-xs">
                <div>
                  <span class="font-bold text-slate-900 dark:text-white">Tag ${s.day}.${currentMonth}.${currentYear}</span>
                  <span class="text-[10px] text-slate-600 dark:text-slate-400 block">Station: ${escapeHtml(s.station || '-')}</span>
                </div>
                <span class="font-bold text-amber-500">${escapeHtml(timeStr)}</span>
              </div>
            `;
          }).join('');

          container.innerHTML = headerHtml + `
            <div class="font-bold text-amber-600 dark:text-amber-400 mb-2">📅 Arbeitsplan ${currentMonth}/${currentYear} (Mitarbeiter: ${escapeHtml(currentWaiterName)})</div>
            <div class="flex flex-col gap-2">${htmlRows}</div>
          `;
        } catch (err) {
          container.innerHTML = headerHtml + `<p class="text-xs text-red-500">Fehler: ${escapeHtml(err.message)}</p>`;
        }

      } else {
        // TEAM / MANAGER ANSICHT
        if (cachedTeamSchedules.length === 0) {
          container.innerHTML = headerHtml + `<p class="text-slate-500 italic text-xs text-center py-4">Lade Team-Daten...</p>`;
          try {
            const { data: allSchedules, error } = await _supabase
              .from("work_schedules")
              .select("*")
              .eq("month", currentMonth)
              .eq("year", currentYear)
              .order("day", { ascending: true });

            if (error) throw new Error(error.message);
            cachedTeamSchedules = allSchedules || [];
          } catch (err) {
            container.innerHTML = headerHtml + `<p class="text-xs text-red-500">Fehler: ${escapeHtml(err.message)}</p>`;
            return;
          }
        }

        renderTeamViewContent(currentMonth, currentYear);
      }
    }

    function renderTeamViewContent(currentMonth, currentYear) {
      const container = document.getElementById('workScheduleContentContainer');
      
      // Zachováme hlavičku, ale vyrenderujeme formulár a zoznam
      const employees = [...new Set(cachedTeamSchedules.map(s => s.employee_name))].sort();

      let filteredSchedules = cachedTeamSchedules;
      if (teamSearchQuery && teamSearchQuery.trim() !== '') {
        const q = teamSearchQuery.toLowerCase().trim();
        filteredSchedules = cachedTeamSchedules.filter(s => s.employee_name && s.employee_name.toLowerCase().includes(q));
      }

      let optionsHtml = `<option value="">🌐 Alle Mitarbeiter anzeigen (${cachedTeamSchedules.length} Schichten)</option>`;
      employees.forEach(emp => {
        optionsHtml += `<option value="${escapeHtml(emp)}" ${teamSearchQuery.toLowerCase() === emp.toLowerCase() ? 'selected' : ''}>👤 ${escapeHtml(emp)}</option>`;
      });

      let htmlRows = filteredSchedules.map(s => {
        let s1Start = excelDecimalToTime(s.shift_1_start);
        let s1End = excelDecimalToTime(s.shift_1_end);
        let s2Start = excelDecimalToTime(s.shift_2_start);
        let s2End = excelDecimalToTime(s.shift_2_end);

        let timeStr = "";
        if (s1Start && s1End) timeStr += `${s1Start} – ${s1End}`;
        else if (s1Start) timeStr += s1Start;

        if (s2Start && s2End) {
          if (timeStr) timeStr += " / ";
          timeStr += `${s2Start} – ${s2End}`;
        } else if (s2Start) {
          if (timeStr) timeStr += " / ";
          timeStr += s2Start;
        }

        if (!timeStr || timeStr === "X – X" || timeStr.toUpperCase() === "X") {
          timeStr = "Frei (X)";
        }

        return `
          <div class="custom-box p-2.5 rounded-lg border flex items-center justify-between text-xs">
            <div>
              <span class="font-bold text-amber-500">${escapeHtml(s.employee_name)}</span>
              <span class="text-[10px] text-slate-600 dark:text-slate-400 block">Tag ${s.day}.${currentMonth}. | Station: ${escapeHtml(s.station || '-')}</span>
            </div>
            <span class="font-bold text-slate-900 dark:text-white">${escapeHtml(timeStr)}</span>
          </div>
        `;
      }).join('');

      // Ak kontajner už obsahuje hlavičku, updatneme len jej spodnú časť alebo celok, ale zachováme fokus inputu
      const existingInput = document.getElementById('teamSearchInput');
      const currentCursorPos = existingInput ? existingInput.selectionStart : 0;

      // Zostavíme celú HTML štruktúru
      let headerHtml = `
        <div class="flex justify-between items-center mb-3 pb-2 border-b border-slate-700">
          <div class="flex gap-1 bg-slate-800 p-1 rounded-lg">
            <button onclick="switchScheduleView('personal')" class="px-3 py-1 text-xs font-bold rounded transition ${currentScheduleView === 'personal' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'}">
              👤 Mein Plan
            </button>
            ${userIsAdmin ? `<button onclick="switchScheduleView('team')" class="px-3 py-1 text-xs font-bold rounded transition ${currentScheduleView === 'team' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'}">
              👥 Team-Ansicht (Manager)
            </button>` : ''}
          </div>
          <span class="text-[10px] uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-semibold">Live DB</span>
        </div>
      `;

      container.innerHTML = headerHtml + `
        <div class="mb-3 flex flex-col gap-2">
          <label class="block text-[11px] font-bold text-slate-400">Mitarbeiter suchen oder auswählen:</label>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
            <input type="text" id="teamSearchInput" value="${escapeHtml(teamSearchQuery === 'all' ? '' : teamSearchQuery)}" oninput="handleTeamSearchInput(this)" placeholder="🔍 Namen tippen (z. B. Benjamin)..." class="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded-lg p-2.5 focus:outline-none focus:border-amber-500">
            
            <select onchange="handleTeamSelectChange(this)" class="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded-lg p-2.5 focus:outline-none focus:border-amber-500">
              ${optionsHtml}
            </select>
          </div>
        </div>
        <div class="flex flex-col gap-2" id="teamSchedulesListContainer">
          ${htmlRows.length > 0 ? htmlRows : '<p class="text-xs text-slate-500 italic text-center py-4">Kein Mitarbeiter gefunden.</p>'}
        </div>
      `;

      // Vrátime fokus späť do vyhľadávacieho pola a nastavíme kurzor tam, kde bol
      const newInput = document.getElementById('teamSearchInput');
      if (newInput) {
        newInput.focus();
        try {
          newInput.setSelectionRange(currentCursorPos, currentCursorPos);
        } catch (e) {}
      }
    }

    function switchScheduleView(view) {
      currentScheduleView = view;
      teamSearchQuery = '';
      renderScheduleModalContent();
    }

    function handleTeamSearchInput(inputEl) {
      teamSearchQuery = inputEl.value;
      const now = new Date();
      renderTeamViewContent(now.getMonth() + 1, now.getFullYear());
    }

    function handleTeamSelectChange(selectEl) {
      teamSearchQuery = selectEl.value;
      const now = new Date();
      renderTeamViewContent(now.getMonth() + 1, now.getFullYear());
    }

    function closeWorkScheduleModal() {
      const modal = document.getElementById('workScheduleModal');
      modal.classList.remove('flex');
      modal.classList.add('hidden');
    }

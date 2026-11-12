/* ============================================================
   js/import-export.js
   Import aus Excel und Export (Excel/CSV) + Arbeitsplan Import (DPL)
   ============================================================ */

    function switchImportTab(tab) {
      const drinksSec = document.getElementById('importSectionDrinks');
      const scheduleSec = document.getElementById('importSectionSchedule');
      const btnDrinks = document.getElementById('tabBtnDrinks');
      const btnSchedule = document.getElementById('tabBtnSchedule');

      if (!drinksSec || !scheduleSec) return;

      if (tab === 'drinks') {
        drinksSec.classList.remove('hidden');
        drinksSec.classList.add('flex');
        scheduleSec.classList.remove('flex');
        scheduleSec.classList.add('hidden');
        if (btnDrinks) btnDrinks.className = "flex-1 py-2 px-3 text-xs font-bold rounded-lg transition bg-amber-500 text-slate-950 shadow-sm";
        if (btnSchedule) btnSchedule.className = "flex-1 py-2 px-3 text-xs font-bold rounded-lg transition text-slate-600 dark:text-slate-400 hover:text-amber-500";
      } else {
        drinksSec.classList.remove('flex');
        drinksSec.classList.add('hidden');
        scheduleSec.classList.remove('hidden');
        scheduleSec.classList.add('flex');
        if (btnSchedule) btnSchedule.className = "flex-1 py-2 px-3 text-xs font-bold rounded-lg transition bg-amber-500 text-slate-950 shadow-sm";
        if (btnDrinks) btnDrinks.className = "flex-1 py-2 px-3 text-xs font-bold rounded-lg transition text-slate-600 dark:text-slate-400 hover:text-amber-500";
      }
    }

    function exportToExcel() {
      if (!allDrinks || allDrinks.length === 0) return alert("Keine Getränke vorhanden.");
      let selectedExportSeason = document.getElementById('exportSeasonSelect').value;
      
      let filtered = selectedExportSeason === 'ALL' 
        ? allDrinks 
        : allDrinks.filter(d => (d.season || '') === selectedExportSeason);

      if (filtered.length === 0) return alert("Keine Getränke für diese Saison gefunden.");

      let dataToExport = filtered.map(d => ({
        Name: d.name || '',
        Category: d.category || '',
        Season: d.season || '',
        Glass: d.glass_type || '',
        Method: d.method || '',
        Ice: d.ice || '',
        Garnish: d.garnish || '',
        SellingPrice: d.selling_price || 0,
        CostPrice: d.cost_price || 0,
        Allergens: d.allergens || '',
        Recipe: d.recipe || ''
      }));
      let worksheet = XLSX.utils.json_to_sheet(dataToExport);
      let workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Getränke");
      XLSX.writeFile(workbook, `salonplafond_rezepte_${selectedExportSeason}.xlsx`);
    }

    function exportToCSV() {
      if (!allDrinks || allDrinks.length === 0) return alert("Keine Getränke vorhanden.");
      let selectedExportSeason = document.getElementById('exportSeasonSelect').value;
      
      let filtered = selectedExportSeason === 'ALL' 
        ? allDrinks 
        : allDrinks.filter(d => (d.season || '') === selectedExportSeason);

      if (filtered.length === 0) return alert("Keine Getränke für diese Saison gefunden.");

      let csvContent = "data:text/csv;charset=utf-8,Name;Category;Season;SellingPrice;CostPrice\r\n";
      filtered.forEach(d => {
        csvContent += `"${(d.name || '').replace(/"/g, '""')}";"${(d.category || '').replace(/"/g, '""')}";"${(d.season || '')}";${d.selling_price || 0};${d.cost_price || 0}\r\n`;
      });
      let link = document.createElement("a");
      link.setAttribute("href", encodeURI(csvContent));
      link.setAttribute("download", `salonplafond_export_${selectedExportSeason}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    function openImportExportModal() {
      closeSettingsMenu();
      checkDrinkEditAuth(() => {
        renderWizardSeasonSelect();
        renderExportSeasonSelect();
        switchImportTab('drinks');
        document.getElementById('wizardExcelFile').value = '';
        document.getElementById('scheduleExcelFile').value = '';
        document.getElementById('wizardStatus').innerText = '';
        document.getElementById('scheduleStatus').innerText = '';
        document.getElementById('importExportModal').classList.remove('hidden');
        document.getElementById('importExportModal').classList.add('flex');
      });
    }

    function closeImportExportModal() {
      document.getElementById('importExportModal').classList.remove('flex');
      document.getElementById('importExportModal').classList.add('hidden');
    }

    function renderWizardSeasonSelect() {
      const seasons = getAllSeasons();
      const select = document.getElementById('wizardSeasonSelect');
      if (!select) return;
      let html = '';
      seasons.forEach(s => {
        html += `<option value="${escapeHtml(s)}">📅 ${escapeHtml(s)}</option>`;
      });
      html += `<option value="addNew">➕ Neue Saison erstellen...</option>`;
      select.innerHTML = html;
      if (currentSeasonFilter) select.value = currentSeasonFilter;
    }

    function renderExportSeasonSelect() {
      const seasons = getAllSeasons();
      const select = document.getElementById('exportSeasonSelect');
      if (!select) return;
      let html = `<option value="ALL">🌐 Alle Saisons (Gesamte Datenbank)</option>`;
      seasons.forEach(s => {
        html += `<option value="${escapeHtml(s)}">📅 ${escapeHtml(s)}</option>`;
      });
      select.innerHTML = html;
      if (currentSeasonFilter) select.value = currentSeasonFilter;
    }

    function handleWizardSeasonChange(selectEl) {
      if (selectEl.value === 'addNew') {
        let newName = prompt('Zeitraum eingeben (z. B. 01.04.2027 – 30.09.2027):');
        if (newName && newName.trim() !== '') {
          let formatted = newName.trim();
          let opt = document.createElement('option');
          opt.value = formatted;
          opt.text = `📅 ${formatted}`;
          selectEl.insertBefore(opt, selectEl.lastElementChild);
          selectEl.value = formatted;
        } else {
          selectEl.value = getAllSeasons()[0];
        }
      }
    }

    function executeWizardImport() {
      const fileInput = document.getElementById('wizardExcelFile');
      const file = fileInput.files[0];
      if (!file) {
        alert("Bitte wählen Sie zuerst eine Excel-Datei aus.");
        return;
      }

      const targetSeason = document.getElementById('wizardSeasonSelect').value;
      const statusEl = document.getElementById('wizardStatus');
      statusEl.innerText = "⏳ Import prebieha...";

      const reader = new FileReader();
      reader.onload = async function(e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        let parsedDrinks = [];
        let currentDrink = null;
        let currentCat = "Cocktails";

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;

          const col0 = row[0] ? String(row[0]).trim() : "";
          const col1 = row[1] ? String(row[1]).trim() : "";

          if (["APERITTIF", "MOCKTAILS", "Cocktails", "After Dinner Drinks", "Salonplafond Classic"].includes(col1)) {
            currentCat = col1;
            continue;
          }

          if (col0.startsWith("Glass:")) {
            if (currentDrink) {
              currentDrink.glass_type = col0.replace("Glass:", "").trim();
              if (col1.startsWith("Method:")) currentDrink.method = col1.replace("Method:", "").trim();
            }
            continue;
          }

          if (col0.startsWith("Ice:")) {
            if (currentDrink) currentDrink.ice = col0.replace("Ice:", "").trim();
            continue;
          }

          if (col0 === "Garnish:") continue;

          if (col1.startsWith("Preis") || col1.startsWith("Price")) {
            if (currentDrink) {
              currentDrink.garnish = col0;
              let rawPrice = col1.replace("Preis", "").replace("Price", "").replace(",", ".").trim();
              let parsedPrice = parseFloat(rawPrice);
              currentDrink.selling_price = !isNaN(parsedPrice) ? parsedPrice : null;
              parsedDrinks.push(currentDrink);
              currentDrink = null;
            }
            continue;
          }

          if (col0 && !col0.startsWith("Ingredients:") && !currentDrink) {
            currentDrink = {
              name: col0,
              category: currentCat,
              season: targetSeason,
              ingredients_json: [],
              is_active: true
            };
            continue;
          }

          if (currentDrink && col0 && col0 !== "Ingredients:") {
            currentDrink.ingredients_json.push({ name: col0, amount: col1 });
          }
        }

        if (parsedDrinks.length > 0) {
          const { error } = await _supabase.from("recipes").insert(parsedDrinks);
          if (error) {
            statusEl.innerText = "Fehler: " + error.message;
          } else {
            statusEl.innerText = "✔ Import erfolgreich abgeschlossen!";
            alert(`Erfolg! ${parsedDrinks.length} Drinks für die Saison (${targetSeason}) importiert.`);
            closeImportExportModal();
            loadDrinks();
          }
        } else {
          statusEl.innerText = "Keine Drinks in der Datei gefunden.";
        }
      };
      reader.readAsArrayBuffer(file);
    }

    // KOMPLETNÝ PARSER PRE ARBEITSPLAN (DPL MA) S UKLADANÍM PRIAMO DO SUPABASE
    function executeScheduleImport() {
      const fileInput = document.getElementById('scheduleExcelFile');
      const file = fileInput.files[0];
      if (!file) {
        alert("Bitte wählen Sie zuerst eine Excel-Datei für den Arbeitsplan aus.");
        return;
      }

      const month = document.getElementById('scheduleMonthSelect').value;
      const year = document.getElementById('scheduleYearInput').value;
      const statusEl = document.getElementById('scheduleStatus');
      statusEl.innerText = "⏳ Arbeitsplan wird analysiert und in Datenbank gespeichert...";

      const reader = new FileReader();
      reader.onload = async function(e) {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

          let schedulesToInsert = [];

          // Prechádzame riadky s personálom (od riadku 3, kde sa striedajú 2 riadky na zamestnanca)
          for (let i = 3; i < rows.length; i += 2) {
            const rowTop = rows[i];     // Horný riadok (Začiatky zmien)
            const rowBot = rows[i + 1]; // Spodný riadok (Konce zmien)

            if (!rowTop || !rowTop[1]) continue;

            const employeeName = String(rowTop[1]).trim();
            const station = rowTop[2] ? String(rowTop[2]).trim() : '';

            // Dni začínajú od stĺpca 4, každý deň má 2 stĺpce (dopoludnie / popoludnie / delené smeny)
            for (let col = 4; col < rowTop.length; col += 2) {
              const dayNum = rows[1] && rows[1][col] !== undefined ? rows[1][col] : null;
              if (!dayNum || isNaN(dayNum)) continue;

              const slot1_start = rowTop[col] !== undefined ? rowTop[col] : null;
              const slot1_end = rowBot && rowBot[col] !== undefined ? rowBot[col] : null;
              const slot2_start = rowTop[col+1] !== undefined ? rowTop[col+1] : null;
              const slot2_end = rowBot && rowBot[col+1] !== undefined ? rowBot[col+1] : null;

              schedulesToInsert.push({
                employee_name: employeeName,
                station: station,
                month: parseInt(month),
                year: parseInt(year),
                day: parseInt(dayNum),
                shift_1_start: slot1_start !== null ? String(slot1_start) : null,
                shift_1_end: slot1_end !== null ? String(slot1_end) : null,
                shift_2_start: slot2_start !== null ? String(slot2_start) : null,
                shift_2_end: slot2_end !== null ? String(slot2_end) : null
              });
            }
          }

          if (schedulesToInsert.length > 0) {
            // Najprv vymažeme starý plán pre daný mesiac a rok, aby nedochádzalo k duplicitám
            const { error: deleteError } = await _supabase
              .from("work_schedules")
              .delete()
              .eq("month", parseInt(month))
              .eq("year", parseInt(year));

            if (deleteError) {
              console.warn("Hinweis beim Löschen alter Schichten:", deleteError.message);
            }

            // Vloženie nových dát do Supabase tabuľky work_schedules
            const { error: insertError } = await _supabase
              .from("work_schedules")
              .insert(schedulesToInsert);

            if (insertError) {
              throw new Error(insertError.message);
            }

            statusEl.innerText = `✔ Arbeitsplan erfolgreich in Supabase gespeichert!`;
            alert(`Erfolg! Der Arbeitsplan für ${schedulesToInsert.length} Schicht-Einträge wurde erfolgreich in der Datenbank gespeichert.`);
            closeImportExportModal();
          } else {
            statusEl.innerText = "Keine Schichten in der Excel-Datei gefunden.";
          }
        } catch (err) {
          console.error(err);
          statusEl.innerText = "Fehler beim Speichern: " + err.message;
          alert("Fehler beim Import in die Datenbank: " + err.message);
        }
      };
      reader.readAsArrayBuffer(file);
    }

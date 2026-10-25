/* ============================================================
   js/import-export.js
   Import aus Excel und Export (Excel/CSV)
   ============================================================ */
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
        document.getElementById('wizardExcelFile').value = '';
        document.getElementById('wizardStatus').innerText = '';
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
          const { error } = await _supabase.from("drinks").insert(parsedDrinks);
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

/* ============================================================
   js/import-export.js
   Import aus Excel und Export (Excel/CSV)
   ============================================================ */
    function exportToExcel() {
      if (!allDishes || allDishes.length === 0) return alert("Keine Gerichte vorhanden.");
      let selectedExportSeason = document.getElementById('exportSeasonSelect').value;
      
      let filtered = selectedExportSeason === 'ALL' 
        ? allDishes 
        : allDishes.filter(d => (d.season || '') === selectedExportSeason);

      if (filtered.length === 0) return alert("Keine Gerichte für diese Saison gefunden.");

      let dataToExport = filtered.map(d => ({
        Name: d.name || '',
        Kategorie: d.category || '',
        Saison: d.season || '',
        Geschirr: d.plate_type || '',
        Garmethode: d.method || '',
        Garzeit: d.cook_time || '',
        Garnitur: d.garnish || '',
        Zutaten: Array.isArray(d.ingredients_json) ? d.ingredients_json.map(i => i.name + (i.amount ? ': ' + i.amount : '')).join('; ') : '',
        Verkaufspreis: d.selling_price || 0,
        Wareneinsatz: d.cost_price || 0,
        Allergene: d.allergens || '',
        Zubereitung: d.recipe || ''
      }));
      let worksheet = XLSX.utils.json_to_sheet(dataToExport);
      let workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Gerichte");
      XLSX.writeFile(workbook, `kueche_rezepte_${selectedExportSeason}.xlsx`);
    }

    function exportToCSV() {
      if (!allDishes || allDishes.length === 0) return alert("Keine Gerichte vorhanden.");
      let selectedExportSeason = document.getElementById('exportSeasonSelect').value;
      
      let filtered = selectedExportSeason === 'ALL' 
        ? allDishes 
        : allDishes.filter(d => (d.season || '') === selectedExportSeason);

      if (filtered.length === 0) return alert("Keine Gerichte für diese Saison gefunden.");

      let csvContent = "data:text/csv;charset=utf-8,Name;Kategorie;Saison;Verkaufspreis;Wareneinsatz\r\n";
      filtered.forEach(d => {
        csvContent += `"${(d.name || '').replace(/"/g, '""')}";"${(d.category || '').replace(/"/g, '""')}";"${(d.season || '')}";${d.selling_price || 0};${d.cost_price || 0}\r\n`;
      });
      let link = document.createElement("a");
      link.setAttribute("href", encodeURI(csvContent));
      link.setAttribute("download", `kueche_export_${selectedExportSeason}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    function openImportExportModal() {
      closeSettingsMenu();
      checkDishEditAuth(() => {
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

    // Import: erste Tabelle der Excel-Datei, Kopfzeile mit diesen Spalten (Reihenfolge egal, nur "Name" ist Pflicht):
    // Name | Kategorie | Geschirr | Garmethode | Garzeit | Garnitur | Zutaten | Verkaufspreis | Wareneinsatz | Allergene | Zubereitung
    // Zutaten: "Zutat: Menge; Zutat: Menge"  (der Export erzeugt genau dieses Format)
    function importNum(v) {
      if (v === undefined || v === null || v === '') return null;
      const n = parseFloat(String(v).replace('€', '').replace(',', '.').trim());
      return isNaN(n) ? null : n;
    }

    function parseImportIngredients(text) {
      return String(text || '').split(/[;\n]/).map(p => p.trim()).filter(Boolean).map(p => {
        const i = p.indexOf(':');
        return i === -1 ? { name: p, amount: '' } : { name: p.slice(0, i).trim(), amount: p.slice(i + 1).trim() };
      }).filter(x => x.name);
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
      statusEl.innerText = "⏳ Import läuft ...";

      const reader = new FileReader();
      reader.onload = async function(e) {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

          const get = (r, ...keys) => {
            for (const k of Object.keys(r)) {
              if (keys.includes(k.trim().toLowerCase())) return String(r[k]).trim();
            }
            return '';
          };

          const parsed = [];
          rows.forEach(r => {
            const name = get(r, 'name');
            if (!name) return;
            parsed.push({
              name,
              category: get(r, 'kategorie', 'category') || 'Hauptgerichte',
              season: targetSeason,
              plate_type: get(r, 'geschirr'),
              method: get(r, 'garmethode', 'method'),
              cook_time: get(r, 'garzeit'),
              garnish: get(r, 'garnitur', 'garnish'),
              ingredients_json: parseImportIngredients(get(r, 'zutaten', 'ingredients')),
              selling_price: importNum(get(r, 'verkaufspreis', 'sellingprice', 'preis')),
              cost_price: importNum(get(r, 'wareneinsatz', 'costprice')),
              allergens: get(r, 'allergene', 'allergens'),
              recipe: get(r, 'zubereitung', 'recipe')
            });
          });

          if (parsed.length === 0) {
            statusEl.innerText = "Keine Gerichte in der Datei gefunden (Spalte „Name“ fehlt oder ist leer).";
            return;
          }

          const { error } = await _supabase.from("dishes").insert(parsed);
          if (error) {
            statusEl.innerText = "Fehler: " + error.message;
          } else {
            statusEl.innerText = "✔ Import erfolgreich abgeschlossen!";
            alert(`Erfolg! ${parsed.length} Gerichte für die Saison (${targetSeason}) importiert.`);
            closeImportExportModal();
            loadDishes();
          }
        } catch (err) {
          statusEl.innerText = "Fehler beim Lesen der Datei: " + err.message;
        }
      };
      reader.readAsArrayBuffer(file);
    }

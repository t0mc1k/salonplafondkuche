/* ============================================================
   js/import-export.js  (v1.0.10)
   Rezepte: Export (Excel/CSV) und Import aus einer Excel-Tabelle.
   - Eine Zeile pro Rezept, die Spalten stehen in der ersten Zeile (die Export-Datei ist zugleich die Vorlage).
   - Zutaten in EINER Zelle: „Mehl: 200 g; Butter: 100 g“ (Semikolon oder Zeilenumbruch trennt die Zutaten).
   - Den Dienstplan importierst du im Dienstplan selbst (📥 Plan importieren), nicht hier.
   ============================================================ */

    const IMP_HEADERS = ['Name', 'Kategorie', 'Saison', 'Portionen', 'Zubereitungszeit', 'Garmethode', 'Anrichten', 'Zutaten', 'Zubereitung', 'Allergene', 'Wareneinsatz', 'Verkaufspreis'];

    // erkannte Spaltenüberschriften (ohne Sonderzeichen, klein geschrieben)
    const IMP_ALIASES = {
      name: ['name', 'rezeptname', 'bezeichnung', 'gericht'],
      category: ['kategorie', 'category', 'gruppe'],
      season: ['saison', 'season', 'zeitraum'],
      portions: ['portionen', 'portion', 'menge', 'portions'],
      prep_time: ['zubereitungszeit', 'zeit', 'dauer', 'time'],
      method: ['garmethode', 'methode', 'method', 'technik'],
      plating: ['anrichten', 'garnitur', 'garnish', 'plating'],
      ingredients: ['zutaten', 'ingredients', 'zutat'],
      recipe: ['zubereitung', 'anleitung', 'recipe', 'schritte'],
      allergens: ['allergene', 'allergens', 'allergen'],
      cost_price: ['wareneinsatz', 'kosten', 'costprice', 'einkaufspreis'],
      selling_price: ['verkaufspreis', 'preis', 'sellingprice', 'price']
    };

    function impIngredientsToText(list) {
      return (Array.isArray(list) ? list : []).map(i => (i.amount ? i.name + ': ' + i.amount : i.name)).join('; ');
    }

    function impParseIngredients(txt) {
      return String(txt == null ? '' : txt).split(/\r?\n|;/).map(s => s.trim()).filter(Boolean).map(s => {
        let m = /^(.+?)\s*(?::|\s[–—-]\s)\s*(.+)$/.exec(s);   // „Mehl: 200 g“ oder „Mehl - 200 g“
        if (m) return { name: m[1].trim(), amount: m[2].trim() };
        m = /^(.+?)\s*\((.+)\)$/.exec(s);
        if (m) return { name: m[1].trim(), amount: m[2].trim() };
        return { name: s, amount: '' };
      });
    }

    function impNum(v) {
      if (v === null || v === undefined || v === '') return null;
      const n = parseFloat(String(v).replace(',', '.').replace(/[^\d.\-]/g, ''));
      return isNaN(n) ? null : n;
    }

    function impFiltered() {
      const sel = document.getElementById('exportSeasonSelect').value;
      return { sel, list: sel === 'ALL' ? allDrinks : allDrinks.filter(d => (d.season || '') === sel) };
    }

    function impRowOf(d) {
      return {
        Name: d.name || '', Kategorie: d.category || '', Saison: d.season || '', Portionen: d.portions || '',
        Zubereitungszeit: d.prep_time || '', Garmethode: d.method || '', Anrichten: d.plating || '',
        Zutaten: impIngredientsToText(d.ingredients_json), Zubereitung: d.recipe || '', Allergene: d.allergens || '',
        Wareneinsatz: d.cost_price == null ? '' : d.cost_price, Verkaufspreis: d.selling_price == null ? '' : d.selling_price
      };
    }

    function exportToExcel() {
      if (!allDrinks || allDrinks.length === 0) return alert('Keine Rezepte vorhanden.');
      const { sel, list } = impFiltered();
      if (list.length === 0) return alert('Keine Rezepte für diese Saison gefunden.');
      const ws = XLSX.utils.json_to_sheet(list.map(impRowOf), { header: IMP_HEADERS });
      ws['!cols'] = [{ wch: 28 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 24 }, { wch: 50 }, { wch: 60 }, { wch: 20 }, { wch: 12 }, { wch: 12 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Rezepte');
      XLSX.writeFile(wb, `salonplafond_rezepte_${sel}.xlsx`);
    }

    function exportToCSV() {
      if (!allDrinks || allDrinks.length === 0) return alert('Keine Rezepte vorhanden.');
      const { sel, list } = impFiltered();
      if (list.length === 0) return alert('Keine Rezepte für diese Saison gefunden.');
      const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
      let csv = '﻿' + IMP_HEADERS.map(q).join(';') + '\r\n';
      list.map(impRowOf).forEach(r => { csv += IMP_HEADERS.map(h => q(r[h])).join(';') + '\r\n'; });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      link.download = `salonplafond_rezepte_${sel}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(link.href), 2000);
    }

    // Leere Vorlage mit zwei Beispielzeilen
    function downloadRecipeTemplate() {
      const rows = [
        { Name: 'Gulaschsuppe', Kategorie: 'Suppen', Saison: '', Portionen: '10 Portionen', Zubereitungszeit: '2 Std', Garmethode: 'Schmoren', Anrichten: 'Petersilie, Sauerrahm',
          Zutaten: 'Rindfleisch: 1,5 kg; Zwiebeln: 800 g; Paprikapulver: 40 g; Rindsuppe: 3 l', Zubereitung: '1. Zwiebeln anrösten.\n2. Fleisch und Gewürze zugeben.\n3. Mit Suppe aufgießen und 90 Min schmoren.',
          Allergene: 'Sellerie', Wareneinsatz: 1.2, Verkaufspreis: 6.5 },
        { Name: 'Tiramisu', Kategorie: 'Desserts', Saison: '', Portionen: '1 GN 1/1', Zubereitungszeit: '30 Min', Garmethode: 'Kalt', Anrichten: 'Kakao',
          Zutaten: 'Mascarpone: 500 g; Eier: 6 Stk; Zucker: 120 g; Löffelbiskuit: 300 g; Espresso: 300 ml', Zubereitung: 'Creme rühren, Biskuits tränken, schichten, 4 Std kühlen.',
          Allergene: 'A, C, G', Wareneinsatz: 0.9, Verkaufspreis: 5.9 }
      ];
      const ws = XLSX.utils.json_to_sheet(rows, { header: IMP_HEADERS });
      ws['!cols'] = [{ wch: 24 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 22 }, { wch: 50 }, { wch: 60 }, { wch: 16 }, { wch: 12 }, { wch: 12 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Rezepte');
      XLSX.writeFile(wb, 'salonplafond_rezepte_vorlage.xlsx');
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
      let html = `<option value="ALL">🌐 Alle Saisons (gesamte Datenbank)</option>`;
      seasons.forEach(s => {
        html += `<option value="${escapeHtml(s)}">📅 ${escapeHtml(s)}</option>`;
      });
      select.innerHTML = html;
      if (currentSeasonFilter) select.value = currentSeasonFilter;
    }

    function handleWizardSeasonChange(selectEl) {
      if (selectEl.value === 'addNew') {
        let newName = prompt('Name der Saison eingeben (z. B. Winter 2026 oder 01.04.2027 – 30.09.2027):');
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

    // Excel lesen: erste Zeile = Spaltenüberschriften, danach eine Zeile pro Rezept
    function executeWizardImport() {
      const file = document.getElementById('wizardExcelFile').files[0];
      if (!file) { alert('Bitte zuerst eine Excel-Datei auswählen.'); return; }
      const targetSeason = document.getElementById('wizardSeasonSelect').value;
      if (!targetSeason || targetSeason === 'addNew') { alert('Bitte eine Saison wählen.'); return; }
      const statusEl = document.getElementById('wizardStatus');
      statusEl.innerText = '⏳ Datei wird gelesen ...';

      const reader = new FileReader();
      reader.onload = async function (e) {
        try {
          const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
          const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
          if (!rows.length) { statusEl.innerText = 'Die Datei ist leer.'; return; }

          // Überschriften den Feldern zuordnen
          const norm = s => String(s || '').toLowerCase().replace(/[^a-zäöüß]/g, '');
          const colOf = {};
          rows[0].forEach((h, i) => { const k = norm(h); Object.keys(IMP_ALIASES).forEach(f => { if (colOf[f] === undefined && IMP_ALIASES[f].indexOf(k) !== -1) colOf[f] = i; }); });
          if (colOf.name === undefined) { statusEl.innerText = 'Spalte „Name“ nicht gefunden. Bitte die Vorlage verwenden.'; return; }

          const cell = (r, f) => (colOf[f] === undefined || r[colOf[f]] === undefined) ? '' : String(r[colOf[f]]).trim();
          const existing = new Set(allDrinks.map(d => (d.season || '') + '|' + String(d.name || '').toLowerCase().trim()));
          const list = [];
          let skipped = 0, dupFile = new Set();
          for (let i = 1; i < rows.length; i++) {
            const r = rows[i];
            const name = cell(r, 'name');
            if (!name) continue;
            const season = cell(r, 'season') || targetSeason;
            const key = season + '|' + name.toLowerCase();
            if (existing.has(key) || dupFile.has(key)) { skipped++; continue; }
            dupFile.add(key);
            list.push({
              name: name.slice(0, 120), category: (cell(r, 'category') || 'Hauptgerichte').slice(0, 30), season,
              portions: cell(r, 'portions'), prep_time: cell(r, 'prep_time'), method: cell(r, 'method'), plating: cell(r, 'plating'),
              ingredients_json: impParseIngredients(r[colOf.ingredients]), recipe: cell(r, 'recipe'), allergens: cell(r, 'allergens'),
              cost_price: impNum(r[colOf.cost_price]), selling_price: impNum(r[colOf.selling_price])
            });
          }
          if (!list.length) { statusEl.innerText = skipped ? `Nichts zu importieren: ${skipped} Rezept(e) gibt es schon.` : 'Keine Rezepte in der Datei gefunden.'; return; }
          if (!confirm(`${list.length} Rezept(e) in die Saison „${targetSeason}“ importieren?` + (skipped ? `\n${skipped} Zeile(n) werden übersprungen (Rezept mit gleichem Namen gibt es schon).` : ''))) { statusEl.innerText = ''; return; }

          statusEl.innerText = '⏳ Import läuft ...';
          for (let i = 0; i < list.length; i += 50) {
            const { error } = await _supabase.from('recipes').insert(list.slice(i, i + 50));
            if (error) { statusEl.innerText = 'Fehler: ' + error.message + (i ? ` (${i} Rezepte waren schon importiert)` : ''); return; }
          }
          statusEl.innerText = '✔ Import abgeschlossen!';
          alert(`${list.length} Rezept(e) importiert.`);
          closeImportExportModal();
          loadDrinks();
        } catch (err) {
          statusEl.innerText = 'Datei konnte nicht gelesen werden: ' + (err && err.message ? err.message : err);
        }
      };
      reader.readAsArrayBuffer(file);
    }

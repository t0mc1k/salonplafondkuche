/* ============================================================
   js/fridge-temps.js  (v1.0.06)
   Temperaturlisten der Kühlschränke (nur Manager/Developer).
   Monatstabelle: Zeilen = Tage 01–31, Spalten = Kühlgeräte (Soll-Bereich im Kopf).
   Einmal täglich eintragen; Werte außerhalb des Soll-Bereichs werden rot.
   Wer eingetragen hat und wann, setzt die Datenbank selbst (Spalten recorded_by / recorded_at).
   Tabellen: fridges, fridge_temps (sql/1.0.04_fridge_temps.sql). Vorlage: Temperaturlisten.xlsx
   ============================================================ */

    let ft = { m: null, year: 0, month: 0, fridges: [], temps: {} };

    function ftDays() { return new Date(ft.year, ft.month, 0).getDate(); }
    function ftIso(day) { return ft.year + '-' + String(ft.month).padStart(2, '0') + '-' + String(day).padStart(2, '0'); }
    function ftFmt(v) { return String(v).replace('.', ','); }
    function ftNumOrNull(s) {
      const t = String(s == null ? '' : s).trim().replace(',', '.');
      if (t === '') return null;
      const n = Number(t);
      return isNaN(n) ? undefined : n;   // undefined = ungültig
    }
    function ftRange(f) {
      const lo = f.temp_min, hi = f.temp_max;
      if (lo != null && hi != null) return ftFmt(Number(lo)) + ' bis ' + ftFmt(Number(hi)) + ' °C';
      if (hi != null) return 'max. ' + ftFmt(Number(hi)) + ' °C';
      if (lo != null) return 'min. ' + ftFmt(Number(lo)) + ' °C';
      return 'kein Soll-Bereich';
    }
    function ftOut(f, v) {
      return (f.temp_min != null && v < Number(f.temp_min)) || (f.temp_max != null && v > Number(f.temp_max));
    }
    function ftErrorHtml(err) {
      const msg = (err && err.message) || String(err);
      if (/does not exist|schema cache|could not find the table/i.test(msg) || (err && err.code === '42P01')) {
        return '<p class="staff-empty" style="color:#ef4444">Die Datenbank ist noch nicht eingerichtet. Bitte zuerst sql/1.0.04_fridge_temps.sql im Supabase SQL Editor ausführen.</p>';
      }
      return '<p class="staff-empty" style="color:#ef4444">' + escapeHtml(msg) + '</p>';
    }

    // ---------- Öffnen ----------
    async function openFridgeTempModal() {
      closeSettingsMenu();
      if (!userIsAdmin) { alert('Nur Manager und Developer dürfen die Temperaturlisten führen.'); return; }
      const now = new Date();
      ft.year = now.getFullYear();
      ft.month = now.getMonth() + 1;
      ft.m = fmOpen('ftModal', {
        title: '🌡️ Kühlschrank-Temperaturen',
        sub: 'Einmal täglich eintragen. Rot = außerhalb des Soll-Bereichs. Wer eingetragen hat, wird automatisch gespeichert.',
        wide: true
      });
      await ftLoad();
    }

    function ftShiftMonth(delta) {
      ft.month += delta;
      if (ft.month < 1) { ft.month = 12; ft.year--; }
      if (ft.month > 12) { ft.month = 1; ft.year++; }
      ftLoad();
    }
    function ftToday() { const n = new Date(); ft.year = n.getFullYear(); ft.month = n.getMonth() + 1; ftLoad(); }

    async function ftLoad() {
      ft.m.setBody('<p class="staff-empty">Lade ...</p>');
      const [f, t] = await Promise.all([
        _supabase.from('fridges').select('*').eq('active', true).order('sort_order', { ascending: true }).order('name', { ascending: true }),
        _supabase.from('fridge_temps').select('*').gte('day', ftIso(1)).lte('day', ftIso(ftDays()))
      ]);
      if (f.error) { ft.m.setBody(ftErrorHtml(f.error)); return; }
      if (t.error) { ft.m.setBody(ftErrorHtml(t.error)); return; }
      ft.fridges = f.data || [];
      ft.temps = {};
      (t.data || []).forEach(r => { ft.temps[r.fridge_id + '|' + r.day] = r; });
      ftRender();
    }

    // ---------- Anzeigen ----------
    function ftCellHtml(f, day) {
      const iso = ftIso(day);
      const rec = ft.temps[f.id + '|' + iso];
      const future = iso > fmIso(new Date());
      const bad = rec && ftOut(f, Number(rec.temp));
      const title = rec ? escapeHtml((rec.recorded_by || '') + ' · ' + fmDateTime(rec.recorded_at)) : '';
      return `<td class="ft-cell"><input type="text" inputmode="decimal" autocomplete="off" maxlength="5" class="ft-in${bad ? ' ft-bad' : ''}"
        value="${rec ? escapeHtml(ftFmt(rec.temp)) : ''}" ${future ? 'disabled' : ''} title="${title}"
        data-f="${escapeHtml(f.id)}" data-d="${iso}" onfocus="this.select()" onchange="ftSave(this)"></td>`;
    }

    function ftByText(iso) {
      const names = [];
      ft.fridges.forEach(f => { const r = ft.temps[f.id + '|' + iso]; if (r && r.recorded_by && names.indexOf(r.recorded_by) === -1) names.push(r.recorded_by); });
      return names.map(n => n.split(' ').map(p => p.charAt(0)).join('')).join(', ');   // Kürzel, z. B. AK
    }

    function ftSummaryHtml() {
      const today = fmIso(new Date());
      let bad = 0, missing = 0, filled = 0;
      for (let d = 1; d <= ftDays(); d++) {
        const iso = ftIso(d);
        ft.fridges.forEach(f => {
          const r = ft.temps[f.id + '|' + iso];
          if (r) { filled++; if (ftOut(f, Number(r.temp))) bad++; }
          else if (iso <= today) missing++;
        });
      }
      return `<span><b>${filled}</b> Messwerte</span><span class="${bad ? 'ft-sum-bad' : ''}"><b>${bad}</b> außerhalb Soll</span><span class="${missing ? 'ft-sum-warn' : ''}"><b>${missing}</b> noch offen (bis heute)</span>`;
    }

    function ftRender() {
      ft.m.setToolbar(`<div class="fm-row-flex" style="justify-content:space-between;gap:.5rem">
        <div class="tp-monthnav">
          <button type="button" class="ui-btn-ghost" onclick="ftShiftMonth(-1)" aria-label="Vorheriger Monat">‹</button>
          <b class="tp-month-label">${escapeHtml(FM_MONTHS[ft.month - 1] + ' ' + ft.year)}</b>
          <button type="button" class="ui-btn-ghost" onclick="ftShiftMonth(1)" aria-label="Nächster Monat">›</button>
          <button type="button" class="ui-btn-ghost" onclick="ftToday()">Heute</button>
        </div>
        <div class="fm-row-flex" style="gap:.4rem">
          <button type="button" class="ui-btn-ghost" onclick="ftExportExcel()">📗 Excel</button>
          <button type="button" class="ui-btn-ghost" onclick="ftManage()">⚙️ Kühlgeräte</button>
        </div></div>`);
      if (!ft.fridges.length) {
        ft.m.setBody('<p class="staff-empty">Noch keine Kühlgeräte angelegt. Mit „⚙️ Kühlgeräte“ kannst du welche hinzufügen.</p>');
        ft.m.setFoot('<button type="button" class="ui-btn-primary" onclick="fmClose(\'ftModal\')">Fertig</button>');
        return;
      }
      const today = fmIso(new Date());
      let head = '<tr><th class="ft-day-col">Tag</th>' + ft.fridges.map(f =>
        `<th class="ft-head"><b>${escapeHtml(f.name)}</b><small>${escapeHtml(ftRange(f))}</small></th>`).join('') + '<th class="ft-by-col">Von</th></tr>';
      let body = '';
      for (let d = 1; d <= ftDays(); d++) {
        const iso = ftIso(d);
        const wd = new Date(ft.year, ft.month - 1, d).getDay();
        body += `<tr class="${iso === today ? 'ft-today' : ''}${wd === 0 || wd === 6 ? ' ft-weekend' : ''}">
          <th class="ft-day-col">${String(d).padStart(2, '0')}<small>${FM_DAYS[wd]}</small></th>
          ${ft.fridges.map(f => ftCellHtml(f, d)).join('')}
          <td class="ft-by-col" id="ftBy_${d}">${escapeHtml(ftByText(iso))}</td></tr>`;
      }
      ft.m.setBody(`<div id="ftSummary" class="tp-summary" style="padding:.5rem 1rem">${ftSummaryHtml()}</div>
        <div class="tp-wrap ft-wrap"><table class="ft-table"><thead>${head}</thead><tbody>${body}</tbody></table></div>`);
      ft.m.setFoot('<button type="button" class="ui-btn-primary" onclick="fmClose(\'ftModal\')">Fertig</button>');
      const t = ft.m.body.querySelector('tr.ft-today');
      if (t) t.scrollIntoView({ block: 'center' });
    }

    // ---------- Speichern (ein Wert pro Gerät und Tag) ----------
    async function ftSave(inp) {
      const fid = inp.dataset.f, iso = inp.dataset.d, key = fid + '|' + iso;
      const f = ft.fridges.find(x => x.id === fid);
      const old = ft.temps[key];
      const n = ftNumOrNull(inp.value);
      const restore = () => { inp.value = old ? ftFmt(old.temp) : ''; };
      if (n === undefined || (n !== null && (n < -60 || n > 60))) { fmToast('Bitte eine Temperatur wie 3 oder 3,5 eintragen.'); restore(); return; }
      if (n === null) {   // leeres Feld = Wert löschen
        if (!old) return;
        const del = await _supabase.from('fridge_temps').delete().eq('id', old.id);
        if (del.error) { fmToast(del.error.message); restore(); return; }
        delete ft.temps[key];
      } else {
        const r = await _supabase.from('fridge_temps').upsert({ fridge_id: fid, day: iso, temp: Math.round(n * 10) / 10 }, { onConflict: 'fridge_id,day' }).select();
        if (r.error || !r.data || !r.data.length) { fmToast(r.error ? r.error.message : 'Nicht gespeichert (keine Berechtigung).'); restore(); return; }
        ft.temps[key] = r.data[0];
        inp.value = ftFmt(r.data[0].temp);
      }
      const rec = ft.temps[key];
      inp.classList.toggle('ft-bad', !!rec && ftOut(f, Number(rec.temp)));
      inp.title = rec ? (rec.recorded_by || '') + ' · ' + fmDateTime(rec.recorded_at) : '';
      const by = document.getElementById('ftBy_' + parseInt(iso.slice(8), 10));
      if (by) by.textContent = ftByText(iso);
      const sum = document.getElementById('ftSummary');
      if (sum) sum.innerHTML = ftSummaryHtml();
      if (rec && ftOut(f, Number(rec.temp))) fmToast('⚠️ ' + f.name + ': ' + ftFmt(rec.temp) + ' °C liegt außerhalb (' + ftRange(f) + ').');
    }

    // ---------- Excel ----------
    function ftExportExcel() {
      if (typeof XLSX === 'undefined') return alert('Excel-Bibliothek nicht geladen.');
      const aoa = [['Temperaturliste ' + FM_MONTHS[ft.month - 1] + ' ' + ft.year], ['Tag'].concat(ft.fridges.map(f => f.name + ' (' + ftRange(f) + ')'), ['Von'])];
      for (let d = 1; d <= ftDays(); d++) {
        const iso = ftIso(d);
        aoa.push([String(d).padStart(2, '0')].concat(ft.fridges.map(f => { const r = ft.temps[f.id + '|' + iso]; return r ? Number(r.temp) : ''; }), [ftByText(iso)]));
      }
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = [{ wch: 6 }].concat(ft.fridges.map(() => ({ wch: 16 })), [{ wch: 10 }]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Temperaturen');
      XLSX.writeFile(wb, 'Temperaturliste_' + ft.year + '-' + String(ft.month).padStart(2, '0') + '.xlsx');
    }

    // ---------- Kühlgeräte verwalten ----------
    async function ftManage() {
      const m = fmOpen('ftManage', { title: '⚙️ Kühlgeräte', sub: 'Name und Soll-Bereich. Leer lassen = keine Grenze (z. B. Tiefkühler: nur Höchstwert -18).', layer: 2 });
      m.setBody('<p class="staff-empty">Lade ...</p>');
      const { data, error } = await _supabase.from('fridges').select('*').order('sort_order', { ascending: true }).order('name', { ascending: true });
      if (error) { m.setBody(ftErrorHtml(error)); return; }
      const row = f => `<div class="fm-item ft-man-row" data-id="${escapeHtml(f.id)}">
        <input type="text" class="ui-field ft-man-name" value="${escapeHtml(f.name)}" maxlength="40" placeholder="Name">
        <input type="text" class="ui-field ft-man-min" value="${f.temp_min == null ? '' : escapeHtml(ftFmt(f.temp_min))}" placeholder="min °C" inputmode="decimal">
        <input type="text" class="ui-field ft-man-max" value="${f.temp_max == null ? '' : escapeHtml(ftFmt(f.temp_max))}" placeholder="max °C" inputmode="decimal">
        <label class="ft-man-act"><input type="checkbox" class="ft-man-active" ${f.active ? 'checked' : ''}> aktiv</label>
        <button type="button" class="fm-btn fm-btn-ok" onclick="ftManageSave(this)">💾</button>
        ${f.id ? `<button type="button" class="fm-btn fm-btn-danger" onclick="ftManageDelete(this)" title="Gerät samt Messwerten löschen">🗑</button>` : ''}
      </div>`;
      m.setBody((data || []).map(row).join('') + `<h4 class="form-section-title" style="margin-top:1rem">➕ Neues Kühlgerät</h4>`
        + row({ id: '', name: '', temp_min: null, temp_max: null, active: true }).replace('💾', '➕ Anlegen'));
      m.setFoot('<button type="button" class="ui-btn-primary" onclick="fmClose(\'ftManage\'); ftLoad()">Fertig</button>');
    }

    async function ftManageSave(btn) {
      const rowEl = btn.closest('.ft-man-row');
      const id = rowEl.dataset.id;
      const name = rowEl.querySelector('.ft-man-name').value.trim();
      const lo = ftNumOrNull(rowEl.querySelector('.ft-man-min').value), hi = ftNumOrNull(rowEl.querySelector('.ft-man-max').value);
      if (!name) return fmToast('Bitte einen Namen eingeben.');
      if (lo === undefined || hi === undefined) return fmToast('Soll-Werte bitte als Zahl eintragen, z. B. 2 oder -18.');
      if (lo !== null && hi !== null && lo > hi) return fmToast('Der Mindestwert darf nicht über dem Höchstwert liegen.');
      const payload = { name, temp_min: lo, temp_max: hi, active: rowEl.querySelector('.ft-man-active').checked };
      const res = id ? await _supabase.from('fridges').update(payload).eq('id', id)
        : await _supabase.from('fridges').insert([Object.assign(payload, { sort_order: ft.fridges.length + 1 })]);
      if (res.error) return fmToast(/duplicate|unique/i.test(res.error.message) ? 'Dieser Name existiert schon.' : res.error.message);
      fmToast('Gespeichert');
      ftManage();
    }

    async function ftManageDelete(btn) {
      const rowEl = btn.closest('.ft-man-row');
      const name = rowEl.querySelector('.ft-man-name').value;
      if (!confirm('„' + name + '“ löschen? Alle Messwerte dieses Geräts werden ebenfalls gelöscht (nicht rückgängig). Tipp: „aktiv“ abwählen blendet es nur aus.')) return;
      const { error } = await _supabase.from('fridges').delete().eq('id', rowEl.dataset.id);
      if (error) return fmToast(error.message);
      ftManage();
    }

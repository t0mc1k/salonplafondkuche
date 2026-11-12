/* ============================================================
   js/team-plan.js
   Team & Arbeitsplan (nur Manager/Developer): Monatsraster für das ganze Team
   mit Schichten, Stunden pro Mitarbeiter, Besetzung pro Tag und Schicht-Planung.

   Daten: Tabelle work_schedules (wie beim Import in import-export.js)
   Spalten: employee_name, station, month, year, day,
            shift_1_start, shift_1_end, shift_2_start, shift_2_end
   Zeiten werden als "HH:MM" gespeichert. Excel-Dezimalwerte aus dem
   Import werden mit excelDecimalToTime() (schedule.js) gelesen.
   Sonderwerte im Beginn-Feld: X = frei, U = Urlaub, K = krank.
   ============================================================ */

    let tpYear = new Date().getFullYear();
    let tpMonth = new Date().getMonth() + 1;
    let tpRows = [];            // alle Schichten des Monats
    let tpExtraEmployees = [];  // Mitarbeiter, die nur im Raster stehen (noch ohne Schicht)
    let tpQuery = '';
    let tpEditing = null;       // { employee, day, existing }

    const TP_MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
    const TP_WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

    // ---------- Zeit-Hilfen ----------
    function tpToMinutes(val) {
      const t = excelDecimalToTime(val);
      const m = /^(\d{1,2}):(\d{2})/.exec(String(t || '').trim());
      if (!m) return null;
      return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
    }

    function tpShiftMinutes(start, end) {
      const a = tpToMinutes(start), b = tpToMinutes(end);
      if (a === null || b === null) return 0;
      let d = b - a;
      if (d <= 0) d += 24 * 60;   // Schicht über Mitternacht
      return d;
    }

    function tpCellMinutes(row) {
      if (!row) return 0;
      return tpShiftMinutes(row.shift_1_start, row.shift_1_end) + tpShiftMinutes(row.shift_2_start, row.shift_2_end);
    }

    function tpFormatHours(min) {
      if (!min) return '0';
      const h = min / 60;
      return (Math.round(h * 10) / 10).toString().replace('.', ',');
    }

    function tpShortTime(val) {
      const t = excelDecimalToTime(val);
      const m = /^(\d{1,2}):(\d{2})/.exec(String(t || '').trim());
      if (!m) return '';
      const h = String(parseInt(m[1], 10));
      return m[2] === '00' ? h : h + ':' + m[2];
    }

    // Sonderzeichen im Beginn-Feld (X, U, K ...) statt Uhrzeit?
    function tpSpecialCode(row) {
      if (!row) return '';
      const raw = String(row.shift_1_start == null ? '' : row.shift_1_start).trim();
      if (!raw) return '';
      if (tpToMinutes(raw) !== null) return '';
      if (!isNaN(Number(raw))) return '';
      return raw.toUpperCase().slice(0, 4);
    }

    function tpHasShift(row) {
      return !!row && !tpSpecialCode(row) && tpCellMinutes(row) > 0;
    }

    function tpTimeInput(val) {
      const t = excelDecimalToTime(val);
      const m = /^(\d{1,2}):(\d{2})/.exec(String(t || '').trim());
      return m ? String(m[1]).padStart(2, '0') + ':' + m[2] : '';
    }

    // ---------- Öffnen / Schließen ----------
    function openTeamPlanModal() {
      closeSettingsMenu();
      checkManagerAuth(() => {
        const now = new Date();
        tpYear = now.getFullYear();
        tpMonth = now.getMonth() + 1;
        tpQuery = '';
        tpExtraEmployees = [];
        const s = document.getElementById('tpSearch');
        if (s) s.value = '';
        const imp = document.getElementById('tpImportBtn');
        if (imp) imp.classList.toggle('hidden', !userCanEdit);
        const modal = document.getElementById('teamPlanModal');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        loadTeamPlan();
      });
    }

    function closeTeamPlanModal() {
      closeTeamPlanCell();
      const modal = document.getElementById('teamPlanModal');
      modal.classList.remove('flex');
      modal.classList.add('hidden');
    }

    function teamPlanShiftMonth(delta) {
      tpMonth += delta;
      if (tpMonth < 1) { tpMonth = 12; tpYear--; }
      if (tpMonth > 12) { tpMonth = 1; tpYear++; }
      tpExtraEmployees = [];
      loadTeamPlan();
    }

    function teamPlanToday() {
      const now = new Date();
      tpYear = now.getFullYear();
      tpMonth = now.getMonth() + 1;
      tpExtraEmployees = [];
      loadTeamPlan();
    }

    function onTeamPlanSearch(value) {
      tpQuery = String(value || '').trim().toLowerCase();
      renderTeamPlan();
    }

    // ---------- Laden ----------
    async function loadTeamPlan() {
      const wrap = document.getElementById('tpGridWrap');
      const label = document.getElementById('tpMonthLabel');
      if (label) label.textContent = TP_MONTHS[tpMonth - 1] + ' ' + tpYear;
      if (wrap) { wrap.innerHTML = '<p class="staff-empty">Lade Arbeitsplan ...</p>'; delete wrap.dataset.scrolled; }
      const { data, error } = await _supabase
        .from('work_schedules')
        .select('*')
        .eq('month', tpMonth)
        .eq('year', tpYear)
        .order('employee_name', { ascending: true })
        .order('day', { ascending: true });
      if (error) {
        if (wrap) wrap.innerHTML = `<p class="staff-empty" style="color:#ef4444">Fehler beim Laden: ${escapeHtml(error.message)}</p>`;
        return;
      }
      tpRows = data || [];
      renderTeamPlan();
    }

    // ---------- Raster zeichnen ----------
    function tpEmployees() {
      const map = new Map();   // name(lower) -> { name, station }
      tpRows.forEach(r => {
        const key = String(r.employee_name || '').trim().toLowerCase();
        if (!key) return;
        if (!map.has(key)) map.set(key, { name: String(r.employee_name).trim(), station: r.station || '' });
        else if (!map.get(key).station && r.station) map.get(key).station = r.station;
      });
      tpExtraEmployees.forEach(n => {
        const key = String(n).trim().toLowerCase();
        if (key && !map.has(key)) map.set(key, { name: String(n).trim(), station: '' });
      });
      return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base' }));
    }

    function tpFindRow(employee, day) {
      const e = String(employee).trim().toLowerCase();
      return tpRows.find(r => Number(r.day) === Number(day) && String(r.employee_name || '').trim().toLowerCase() === e) || null;
    }

    function tpCellHtml(row, employee, day) {
      let cls = 'tp-cell', inner = '';
      const code = tpSpecialCode(row);
      if (code) {
        if (code === 'X') { cls += ' tp-free'; inner = '<span class="tp-x">X</span>'; }
        else { cls += ' tp-special'; inner = `<span class="tp-code">${escapeHtml(code)}</span>`; }
      } else if (row && tpCellMinutes(row) > 0) {
        cls += ' tp-work';
        const l1 = `${tpShortTime(row.shift_1_start)}–${tpShortTime(row.shift_1_end)}`;
        const has2 = tpToMinutes(row.shift_2_start) !== null && tpToMinutes(row.shift_2_end) !== null;
        inner = `<span class="tp-t">${escapeHtml(l1)}</span>` + (has2 ? `<span class="tp-t">${escapeHtml(tpShortTime(row.shift_2_start) + '–' + tpShortTime(row.shift_2_end))}</span>` : '');
      }
      return `<td class="${cls}" onclick="openTeamPlanCell(${jsArg(employee)}, ${day})" title="${escapeHtml(employee)} · ${day}.${tpMonth}.">${inner}</td>`;
    }

    function renderTeamPlan() {
      const wrap = document.getElementById('tpGridWrap');
      if (!wrap) return;
      const daysInMonth = new Date(tpYear, tpMonth, 0).getDate();
      const today = new Date();
      const todayDay = (today.getFullYear() === tpYear && today.getMonth() + 1 === tpMonth) ? today.getDate() : -1;
      const meKey = String(currentWaiterName || '').trim().toLowerCase();

      let employees = tpEmployees();
      if (tpQuery) employees = employees.filter(e => e.name.toLowerCase().indexOf(tpQuery) !== -1);

      // Auswahl „Mitarbeiter aufnehmen“
      const present = new Set(tpEmployees().map(e => e.name.toLowerCase()));
      const addSel = document.getElementById('tpAddEmployee');
      if (addSel) {
        const candidates = (staffDatabaseRecords || []).map(s => s.name).filter(n => n && !present.has(String(n).toLowerCase()))
          .sort((a, b) => a.localeCompare(b, 'de', { sensitivity: 'base' }));
        addSel.innerHTML = '<option value="">➕ Mitarbeiter aufnehmen ...</option>' + candidates.map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('');
        addSel.classList.toggle('hidden', candidates.length === 0);
      }

      if (!employees.length) {
        wrap.innerHTML = `<p class="staff-empty">${tpRows.length || tpExtraEmployees.length ? 'Kein Mitarbeiter gefunden.' : 'Für diesen Monat gibt es noch keinen Plan. Importiere einen Excel-Plan oder nimm oben Mitarbeiter auf und plane die Schichten direkt im Raster.'}</p>`;
        document.getElementById('tpSummary').innerHTML = '';
        return;
      }

      // Kopf
      let head = '<tr><th class="tp-name-col tp-corner">Mitarbeiter</th>';
      for (let d = 1; d <= daysInMonth; d++) {
        const wd = new Date(tpYear, tpMonth - 1, d).getDay();
        const cls = 'tp-day' + (wd === 0 || wd === 6 ? ' tp-weekend' : '') + (d === todayDay ? ' tp-today' : '');
        head += `<th class="${cls}"><span class="tp-wd">${TP_WEEKDAYS[wd]}</span><span class="tp-dn">${d}</span></th>`;
      }
      head += '<th class="tp-sum-col">Std.</th></tr>';

      // Zeilen
      let totalMin = 0, totalShifts = 0;
      const perDay = new Array(daysInMonth + 1).fill(0);
      let body = '';
      employees.forEach(emp => {
        let rowMin = 0, rowShifts = 0;
        let cells = '';
        for (let d = 1; d <= daysInMonth; d++) {
          const row = tpFindRow(emp.name, d);
          if (tpHasShift(row)) { rowMin += tpCellMinutes(row); rowShifts++; perDay[d]++; }
          let html = tpCellHtml(row, emp.name, d);
          if (d === todayDay) html = html.replace('class="tp-cell', 'class="tp-cell tp-col-today');
          else if (new Date(tpYear, tpMonth - 1, d).getDay() % 6 === 0) html = html.replace('class="tp-cell', 'class="tp-cell tp-col-weekend');
          cells += html;
        }
        totalMin += rowMin; totalShifts += rowShifts;
        const isMe = meKey && emp.name.toLowerCase().indexOf(meKey) !== -1;
        body += `<tr class="${isMe ? 'tp-me' : ''}">
          <th class="tp-name-col"><span class="tp-name">${escapeHtml(emp.name)}</span>${emp.station ? `<small class="tp-station">${escapeHtml(emp.station)}</small>` : ''}</th>
          ${cells}
          <td class="tp-sum-col"><b>${tpFormatHours(rowMin)}</b><small>${rowShifts} Tage</small></td>
        </tr>`;
      });

      // Fuß: Besetzung pro Tag
      let foot = '<tr><th class="tp-name-col tp-foot-label">Besetzung</th>';
      for (let d = 1; d <= daysInMonth; d++) {
        foot += `<td class="tp-foot${d === todayDay ? ' tp-col-today' : ''}">${perDay[d] || ''}</td>`;
      }
      foot += `<td class="tp-sum-col"><b>${tpFormatHours(totalMin)}</b></td></tr>`;

      wrap.innerHTML = `<table class="tp-table"><thead>${head}</thead><tbody>${body}</tbody><tfoot>${foot}</tfoot></table>`;

      document.getElementById('tpSummary').innerHTML =
        `<span><b>${employees.length}</b> Mitarbeiter</span><span><b>${totalShifts}</b> Schichten</span><span><b>${tpFormatHours(totalMin)}</b> Std. gesamt</span>` +
        (employees.length ? `<span>Ø <b>${tpFormatHours(Math.round(totalMin / employees.length))}</b> Std. pro Person</span>` : '');

      // heute ins Bild scrollen (nur beim ersten Zeichnen des Monats)
      if (todayDay > 0 && !wrap.dataset.scrolled) {
        const th = wrap.querySelector('th.tp-today');
        if (th) wrap.scrollLeft = Math.max(0, th.offsetLeft - 160);
      }
      wrap.dataset.scrolled = '1';
    }

    function teamPlanAddEmployee(sel) {
      const name = sel.value;
      if (!name) return;
      if (tpExtraEmployees.indexOf(name) === -1) tpExtraEmployees.push(name);
      sel.value = '';
      renderTeamPlan();
    }

    // ---------- Schicht bearbeiten ----------
    function openTeamPlanCell(employee, day) {
      const row = tpFindRow(employee, day);
      tpEditing = { employee: employee, day: day, existing: row };
      const wd = TP_WEEKDAYS[new Date(tpYear, tpMonth - 1, day).getDay()];
      document.getElementById('tpCellTitle').textContent = employee;
      document.getElementById('tpCellSub').textContent = `${wd}, ${day}. ${TP_MONTHS[tpMonth - 1]} ${tpYear}`;

      const code = tpSpecialCode(row);
      document.getElementById('tpCellPresetCode').value = code;
      document.getElementById('tpS1Start').value = code ? '' : tpTimeInput(row && row.shift_1_start);
      document.getElementById('tpS1End').value = code ? '' : tpTimeInput(row && row.shift_1_end);
      document.getElementById('tpS2Start').value = code ? '' : tpTimeInput(row && row.shift_2_start);
      document.getElementById('tpS2End').value = code ? '' : tpTimeInput(row && row.shift_2_end);

      // Station: aus der Schicht, sonst die übliche Station des Mitarbeiters
      let station = row && row.station;
      if (!station) { const emp = tpEmployees().find(e => e.name.toLowerCase() === String(employee).toLowerCase()); station = emp ? emp.station : ''; }
      document.getElementById('tpStation').value = station || '';

      document.getElementById('tpCellDeleteBtn').classList.toggle('hidden', !row);
      ['tpS1Start', 'tpS1End', 'tpS2Start', 'tpS2End'].forEach(id => { document.getElementById(id).oninput = tpUpdateCellHours; });
      tpUpdateCellHours();

      const modal = document.getElementById('tpCellModal');
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }

    function closeTeamPlanCell() {
      const modal = document.getElementById('tpCellModal');
      if (!modal) return;
      modal.classList.remove('flex');
      modal.classList.add('hidden');
      tpEditing = null;
    }

    function tpCellPreset(code) {
      document.getElementById('tpCellPresetCode').value = code;
      ['tpS1Start', 'tpS1End', 'tpS2Start', 'tpS2End'].forEach(id => { document.getElementById(id).value = ''; });
      tpUpdateCellHours();
    }

    function tpUpdateCellHours() {
      const code = document.getElementById('tpCellPresetCode').value;
      const el = document.getElementById('tpCellHours');
      if (!el) return;
      if (code) {
        el.textContent = ({ X: 'Frei (X): keine Arbeitszeit.', U: 'Urlaub (U)', K: 'Krank (K)' })[code] || 'Eintrag: ' + code;
        return;
      }
      const v = id => document.getElementById(id).value;
      const min = tpShiftMinutes(v('tpS1Start'), v('tpS1End')) + tpShiftMinutes(v('tpS2Start'), v('tpS2End'));
      el.textContent = min ? `Arbeitszeit: ${tpFormatHours(min)} Std. (ohne Pausenabzug)` : 'Beginn und Ende eintragen oder oben Frei / Urlaub / Krank wählen.';
    }

    async function saveTeamPlanCell() {
      if (!tpEditing) return;
      const v = id => document.getElementById(id).value.trim();
      let code = document.getElementById('tpCellPresetCode').value;
      const s1a = v('tpS1Start'), s1b = v('tpS1End'), s2a = v('tpS2Start'), s2b = v('tpS2End');
      if (!code) {
        if ((s1a && !s1b) || (!s1a && s1b)) return alert('Schicht 1: bitte Beginn und Ende angeben.');
        if ((s2a && !s2b) || (!s2a && s2b)) return alert('Schicht 2: bitte Beginn und Ende angeben.');
        if (!s1a && s2a) return alert('Bitte zuerst Schicht 1 ausfüllen.');
        if (!s1a) return alert('Bitte eine Schicht eintragen oder Frei / Urlaub / Krank wählen.');
      }
      const payload = {
        station: v('tpStation') || null,
        shift_1_start: code || s1a || null,
        shift_1_end: code ? null : (s1b || null),
        shift_2_start: code ? null : (s2a || null),
        shift_2_end: code ? null : (s2b || null)
      };
      const key = { employee_name: tpEditing.employee, month: tpMonth, year: tpYear, day: tpEditing.day };
      let res;
      if (tpEditing.existing) {
        res = await _supabase.from('work_schedules').update(payload).match(key).select();
      } else {
        res = await _supabase.from('work_schedules').insert([Object.assign({}, key, payload)]).select();
      }
      if (res.error) return alert('Speichern fehlgeschlagen: ' + res.error.message);
      if (!res.data || !res.data.length) return alert('Es wurde nichts gespeichert. Vermutlich fehlt in der Datenbank die Berechtigung zum Ändern des Arbeitsplans.');
      closeTeamPlanCell();
      await loadTeamPlan();
    }

    async function deleteTeamPlanCell() {
      if (!tpEditing || !tpEditing.existing) return;
      const key = { employee_name: tpEditing.employee, month: tpMonth, year: tpYear, day: tpEditing.day };
      const { error } = await _supabase.from('work_schedules').delete().match(key);
      if (error) return alert('Löschen fehlgeschlagen: ' + error.message);
      closeTeamPlanCell();
      await loadTeamPlan();
    }

    // ---------- Excel-Export ----------
    function exportTeamPlanExcel() {
      if (typeof XLSX === 'undefined') return alert('Excel-Bibliothek nicht geladen.');
      const employees = tpEmployees();
      if (!employees.length) return alert('Für diesen Monat gibt es keine Daten zum Exportieren.');
      const daysInMonth = new Date(tpYear, tpMonth, 0).getDate();
      const header = ['Mitarbeiter', 'Station'];
      for (let d = 1; d <= daysInMonth; d++) header.push(TP_WEEKDAYS[new Date(tpYear, tpMonth - 1, d).getDay()] + ' ' + d);
      header.push('Stunden');
      const aoa = [header];
      employees.forEach(emp => {
        const line = [emp.name, emp.station || ''];
        let min = 0;
        for (let d = 1; d <= daysInMonth; d++) {
          const row = tpFindRow(emp.name, d);
          const code = tpSpecialCode(row);
          if (code) { line.push(code); continue; }
          if (!row || tpCellMinutes(row) === 0) { line.push(''); continue; }
          min += tpCellMinutes(row);
          let t = tpTimeInput(row.shift_1_start) + '-' + tpTimeInput(row.shift_1_end);
          if (tpToMinutes(row.shift_2_start) !== null) t += ' / ' + tpTimeInput(row.shift_2_start) + '-' + tpTimeInput(row.shift_2_end);
          line.push(t);
        }
        line.push(Math.round(min / 6) / 10);
        aoa.push(line);
      });
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = [{ wch: 18 }, { wch: 10 }].concat(new Array(daysInMonth).fill({ wch: 12 })).concat([{ wch: 9 }]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, TP_MONTHS[tpMonth - 1] + ' ' + tpYear);
      XLSX.writeFile(wb, `Arbeitsplan_${tpYear}-${String(tpMonth).padStart(2, '0')}.xlsx`);
    }

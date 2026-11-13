/* ============================================================
   js/team-plan.js
   Dienstplan nach Kalenderwochen (Mo–So): Kopf mit Datumsbereich und KW, Spalten Name, Mo–So,
   Gesamt, Unterschrift. Manager/Developer planen auch Wochen im Voraus (Entwurf) und
   veröffentlichen sie; alle anderen sehen nur veröffentlichte Wochen (nur ansehen).

   Daten (sql/1.0.02_workplan.sql): work_schedules (eine Zeile pro Person und Tag:
   employee_name, station, year, month, day, shift_1_start/end, shift_2_start/end) und
   plan_weeks (week_start = Montag, published).
   Zeiten "HH:MM". Sonderwerte im Beginn-Feld: OFF/X = frei, U = Urlaub, K = krank, ZA = Zeitausgleich.
   ============================================================ */

    let tpWeekStart = new Date();   // Montag der angezeigten Woche (wird beim Öffnen gesetzt)
    let tpRows = [];            // alle Schichten der Woche
    let tpWeeks = {};           // 'YYYY-MM-DD' (Montag) -> Zeile aus plan_weeks
    let tpQuery = '';
    let tpEditing = null;       // { employee, date, existing }

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

    // ---------- Kalenderwoche (Montag bis Sonntag) ----------
    function tpMondayOf(d) {
      const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
      return x;
    }
    function tpAddDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
    function tpIso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
    function tpParseIso(s) { const p = String(s).split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
    function tpDmy(d) { return String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getFullYear()).slice(2); }
    function tpDm(d) { return String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.'; }
    function tpIsoKw(d) {
      const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
      t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
      const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
      return Math.ceil(((t - y0) / 86400000 + 1) / 7);
    }
    function tpWeekRange(ws) { return tpDmy(ws) + ' – ' + tpDmy(tpAddDays(ws, 6)); }   // z. B. 02.11.26 – 08.11.26

    const TP_GROUP_ORDER = ['Leitung', 'AM-Team', 'Lehrling', 'PM-Team', 'Reinigung', 'Küche'];
    function tpStaffGroup(name) {
      const s = (staffDatabaseRecords || []).find(x => String(x.name).toLowerCase() === String(name).toLowerCase());
      if (!s) return 'Küche';
      if (s.team) return s.team;
      return s.role === 'manager' ? 'Leitung' : 'Küche';
    }

    // ---------- Öffnen / Schließen ----------
    // Alle dürfen den veröffentlichten Plan ansehen; bearbeiten nur Manager/Developer.
    function openTeamPlanModal() {
      closeSettingsMenu();
      tpWeekStart = tpMondayOf(new Date());
      tpQuery = '';
      const s = document.getElementById('tpSearch');
      if (s) s.value = '';
      ['tpPublishBtn', 'tpCopyBtn', 'tpImportBtn'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.toggle('hidden', !userIsAdmin);
      });
      const modal = document.getElementById('teamPlanModal');
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      loadTeamPlan();
    }

    function closeTeamPlanModal() {
      closeTeamPlanCell();
      const modal = document.getElementById('teamPlanModal');
      modal.classList.remove('flex');
      modal.classList.add('hidden');
    }

    function teamPlanShiftWeek(delta) { tpWeekStart = tpAddDays(tpWeekStart, 7 * delta); loadTeamPlan(); }
    function teamPlanToday() { tpWeekStart = tpMondayOf(new Date()); loadTeamPlan(); }
    function teamPlanGoWeek(iso) { tpWeekStart = tpMondayOf(tpParseIso(iso)); loadTeamPlan(); }
    function teamPlanPickWeek(value) {
      // <input type="week"> liefert z. B. "2026-W46"
      const m = /^(\d{4})-W(\d{2})$/.exec(String(value || ''));
      if (!m) return;
      const jan4 = new Date(Number(m[1]), 0, 4);
      tpWeekStart = tpAddDays(tpMondayOf(jan4), 7 * (Number(m[2]) - 1));
      loadTeamPlan();
    }

    function onTeamPlanSearch(value) {
      tpQuery = String(value || '').trim().toLowerCase();
      renderTeamPlan();
    }

    // ---------- Laden ----------
    async function loadTeamPlan() {
      const wrap = document.getElementById('tpGridWrap');
      if (wrap) wrap.innerHTML = '<p class="staff-empty">Lade Arbeitsplan ...</p>';
      tpUpdateWeekHeader();
      const iso = tpIso(tpWeekStart);
      const from = tpIso(tpAddDays(tpMondayOf(new Date()), -14));
      const [rowsRes, weeksRes] = await Promise.all([
        _supabase.from('work_schedules').select('*').eq('week_start', iso).order('employee_name', { ascending: true }).order('day', { ascending: true }),
        _supabase.from('plan_weeks').select('*').gte('week_start', from < iso ? from : iso).order('week_start', { ascending: true })
      ]);
      if (rowsRes.error) {
        if (wrap) wrap.innerHTML = `<p class="staff-empty" style="color:#ef4444">Fehler beim Laden: ${escapeHtml(rowsRes.error.message)}</p>`;
        return;
      }
      tpRows = rowsRes.data || [];
      tpWeeks = {};
      (weeksRes.data || []).forEach(w => { tpWeeks[w.week_start] = w; });
      tpUpdateWeekHeader();
      renderTeamPlan();
    }

    // Kopf: Datumsbereich + KW + Status + Wochenauswahl
    function tpUpdateWeekHeader() {
      const iso = tpIso(tpWeekStart);
      const meta = tpWeeks[iso];
      const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
      set('tpWeekRange', tpWeekRange(tpWeekStart));
      set('tpWeekKw', 'KW ' + tpIsoKw(tpWeekStart));
      const st = document.getElementById('tpWeekState');
      if (st) {
        const pub = !!(meta && meta.published);
        st.textContent = pub ? '✅ Veröffentlicht' : '✏️ Entwurf';
        st.className = 'tp-state ' + (pub ? 'tp-state-pub' : 'tp-state-draft');
        st.classList.toggle('hidden', !userIsAdmin && !pub);
      }
      const btn = document.getElementById('tpPublishBtn');
      if (btn) btn.textContent = (meta && meta.published) ? '↩️ Zurückziehen' : '📢 Veröffentlichen';
      const pick = document.getElementById('tpWeekPick');
      if (pick) {
        const kw = String(tpIsoKw(tpWeekStart)).padStart(2, '0');
        const thu = tpAddDays(tpWeekStart, 3);   // das Jahr der KW richtet sich nach dem Donnerstag
        pick.value = thu.getFullYear() + '-W' + kw;
      }
      const chips = document.getElementById('tpWeekChips');
      if (chips) {
        const cur = tpIso(tpMondayOf(new Date()));
        const list = Object.keys(tpWeeks).filter(k => k >= tpIso(tpAddDays(tpMondayOf(new Date()), -14)) && (userIsAdmin || tpWeeks[k].published));
        if (list.indexOf(cur) === -1) list.push(cur);
        if (list.indexOf(iso) === -1) list.push(iso);
        list.sort();
        chips.innerHTML = list.map(k => {
          const d = tpParseIso(k);
          const pub = tpWeeks[k] && tpWeeks[k].published;
          const mark = pub ? '✅' : (userIsAdmin ? '✏️' : '');
          return `<button type="button" class="ui-chip${k === iso ? ' active' : ''}" onclick="teamPlanGoWeek(${jsArg(k)})" title="${escapeHtml(tpWeekRange(d))}">KW ${tpIsoKw(d)} · ${tpDm(d)}${mark ? ' ' + mark : ''}</button>`;
        }).join('');
      }
    }

    // ---------- Raster zeichnen ----------
    function tpEmployees() {
      const map = new Map();   // name(lower) -> { name, station, group }
      const add = (name, station) => {
        const key = String(name || '').trim().toLowerCase();
        if (!key) return;
        if (!map.has(key)) map.set(key, { name: String(name).trim(), station: station || '', group: tpStaffGroup(name) });
      };
      (staffDatabaseRecords || []).forEach(s => add(s.name, ''));
      tpRows.forEach(r => add(r.employee_name, r.station));
      return Array.from(map.values()).sort((a, b) => {
        const ga = TP_GROUP_ORDER.indexOf(a.group), gb = TP_GROUP_ORDER.indexOf(b.group);
        const oa = ga === -1 ? 99 : ga, ob = gb === -1 ? 99 : gb;
        return oa - ob || a.name.localeCompare(b.name, 'de', { sensitivity: 'base' });
      });
    }

    function tpFindRow(employee, date) {
      const e = String(employee).trim().toLowerCase();
      return tpRows.find(r => Number(r.day) === date.getDate() && Number(r.month) === date.getMonth() + 1 && Number(r.year) === date.getFullYear()
        && String(r.employee_name || '').trim().toLowerCase() === e) || null;
    }

    function tpCellHtml(row, employee, date) {
      let cls = 'tp-cell', inner = '';
      const code = tpSpecialCode(row);
      if (code) {
        if (code === 'X' || code === 'OFF') { cls += ' tp-free'; inner = '<span class="tp-x">OFF</span>'; }
        else { cls += ' tp-special'; inner = `<span class="tp-code">${escapeHtml(code)}</span>`; }
      } else if (row && tpCellMinutes(row) > 0) {
        cls += ' tp-work';
        const l1 = `${tpShortTime(row.shift_1_start)}–${tpShortTime(row.shift_1_end)}`;
        const has2 = tpToMinutes(row.shift_2_start) !== null && tpToMinutes(row.shift_2_end) !== null;
        inner = `<span class="tp-t">${escapeHtml(l1)}</span>` + (has2 ? `<span class="tp-t">${escapeHtml(tpShortTime(row.shift_2_start) + '–' + tpShortTime(row.shift_2_end))}</span>` : '')
          + (row.station ? `<small class="tp-station">${escapeHtml(row.station)}</small>` : '');
      }
      const click = userIsAdmin ? ` onclick="openTeamPlanCell(${jsArg(employee)}, ${jsArg(tpIso(date))})"` : '';
      return `<td class="${cls}"${click} title="${escapeHtml(employee)} · ${tpDm(date)}">${inner}</td>`;
    }

    function renderTeamPlan() {
      const wrap = document.getElementById('tpGridWrap');
      if (!wrap) return;
      const today = tpIso(new Date());
      const days = [0, 1, 2, 3, 4, 5, 6].map(i => tpAddDays(tpWeekStart, i));
      const meKey = String(currentWaiterName || '').trim().toLowerCase();
      const iso = tpIso(tpWeekStart);
      const meta = tpWeeks[iso];

      // Mitarbeiter sehen nur veröffentlichte Wochen (die Datenbank liefert sonst auch nichts)
      if (!userIsAdmin && !(meta && meta.published)) {
        wrap.innerHTML = '<p class="staff-empty">Für diese Woche ist noch kein Dienstplan veröffentlicht.</p>';
        document.getElementById('tpSummary').innerHTML = '';
        return;
      }

      let employees = tpEmployees();
      if (tpQuery) employees = employees.filter(e => e.name.toLowerCase().indexOf(tpQuery) !== -1);
      if (!employees.length) {
        wrap.innerHTML = '<p class="staff-empty">Kein Mitarbeiter gefunden.</p>';
        document.getElementById('tpSummary').innerHTML = '';
        return;
      }

      let head = '<tr><th class="tp-name-col tp-corner">Name</th>';
      days.forEach((d, i) => {
        const cls = 'tp-day' + (i >= 5 ? ' tp-weekend' : '') + (tpIso(d) === today ? ' tp-today' : '');
        head += `<th class="${cls}"><span class="tp-wd">${TP_WEEKDAYS[d.getDay()]}</span><span class="tp-dn">${tpDm(d)}</span></th>`;
      });
      head += '<th class="tp-sum-col">Gesamt</th><th class="tp-sign-col">Unterschrift</th></tr>';

      let totalMin = 0, totalShifts = 0, lastGroup = null;
      const perDay = [0, 0, 0, 0, 0, 0, 0];
      let body = '';
      employees.forEach(emp => {
        if (emp.group !== lastGroup) {
          body += `<tr class="tp-group"><th colspan="10">${escapeHtml(emp.group)}</th></tr>`;
          lastGroup = emp.group;
        }
        let rowMin = 0, rowShifts = 0, cells = '';
        days.forEach((d, i) => {
          const row = tpFindRow(emp.name, d);
          if (tpHasShift(row)) { rowMin += tpCellMinutes(row); rowShifts++; perDay[i]++; }
          let html = tpCellHtml(row, emp.name, d);
          if (tpIso(d) === today) html = html.replace('class="tp-cell', 'class="tp-cell tp-col-today');
          else if (i >= 5) html = html.replace('class="tp-cell', 'class="tp-cell tp-col-weekend');
          cells += html;
        });
        totalMin += rowMin; totalShifts += rowShifts;
        const isMe = meKey && emp.name.toLowerCase() === meKey;
        body += `<tr class="${isMe ? 'tp-me' : ''}">
          <th class="tp-name-col"><span class="tp-name">${escapeHtml(emp.name)}</span></th>
          ${cells}
          <td class="tp-sum-col"><b>${tpFormatHours(rowMin)}</b><small>${rowShifts} Tage</small></td>
          <td class="tp-sign-col"></td>
        </tr>`;
      });

      let foot = '<tr><th class="tp-name-col tp-foot-label">Besetzung</th>';
      days.forEach((d, i) => { foot += `<td class="tp-foot${tpIso(d) === today ? ' tp-col-today' : ''}">${perDay[i] || ''}</td>`; });
      foot += `<td class="tp-sum-col"><b>${tpFormatHours(totalMin)}</b></td><td class="tp-sign-col"></td></tr>`;

      wrap.innerHTML = `<table class="tp-table"><thead>${head}</thead><tbody>${body}</tbody><tfoot>${foot}</tfoot></table>`;
      document.getElementById('tpSummary').innerHTML =
        `<span><b>${employees.length}</b> Mitarbeiter</span><span><b>${totalShifts}</b> Schichten</span><span><b>${tpFormatHours(totalMin)}</b> Std. gesamt</span>`;
    }

    // ---------- Veröffentlichen / Woche kopieren (nur Manager/Developer) ----------
    async function tpEnsureWeekRow() {
      const iso = tpIso(tpWeekStart);
      if (tpWeeks[iso]) return true;
      const { error } = await _supabase.from('plan_weeks').upsert({ week_start: iso, published: false }, { onConflict: 'week_start', ignoreDuplicates: true });
      if (error) { alert('Woche konnte nicht angelegt werden: ' + error.message); return false; }
      tpWeeks[iso] = { week_start: iso, published: false };
      return true;
    }

    async function teamPlanTogglePublish() {
      if (!userIsAdmin) return;
      const iso = tpIso(tpWeekStart);
      const publish = !(tpWeeks[iso] && tpWeeks[iso].published);
      const label = 'KW ' + tpIsoKw(tpWeekStart) + ' (' + tpWeekRange(tpWeekStart) + ')';
      if (!confirm(publish ? label + ' jetzt für das ganze Team veröffentlichen?' : label + ' zurückziehen? Das Team sieht diese Woche dann nicht mehr.')) return;
      const { error } = await _supabase.from('plan_weeks').upsert({ week_start: iso, published: publish }, { onConflict: 'week_start' });
      if (error) return alert('Fehlgeschlagen: ' + error.message);
      await loadTeamPlan();
      showAppToast({ initial: '📆', title: publish ? 'Dienstplan veröffentlicht' : 'Dienstplan zurückgezogen', text: label });
    }

    async function teamPlanCopyPrevWeek() {
      if (!userIsAdmin) return;
      const prevIso = tpIso(tpAddDays(tpWeekStart, -7));
      const { data, error } = await _supabase.from('work_schedules').select('*').eq('week_start', prevIso);
      if (error) return alert('Fehler: ' + error.message);
      if (!data || !data.length) return alert('In der Vorwoche gibt es keinen Plan zum Kopieren.');
      if (!confirm('Plan der Vorwoche (' + data.length + ' Einträge) in diese Woche kopieren? Vorhandene Einträge bleiben unverändert.')) return;
      if (!await tpEnsureWeekRow()) return;
      const rows = data.map(r => {
        const d = tpAddDays(tpParseIso(r.work_date), 7);
        return { employee_name: r.employee_name, station: r.station, year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate(),
          shift_1_start: r.shift_1_start, shift_1_end: r.shift_1_end, shift_2_start: r.shift_2_start, shift_2_end: r.shift_2_end };
      });
      const res = await _supabase.from('work_schedules').upsert(rows, { onConflict: 'employee_name,year,month,day', ignoreDuplicates: true });
      if (res.error) return alert('Kopieren fehlgeschlagen: ' + res.error.message);
      await loadTeamPlan();
    }

    // ---------- 24-Stunden-Zeit (HH:MM) ----------
    // Eingabe nur mit Ziffern: aus "1430" wird "14:30". Leer = '' ; ungültig = null.
    function tpTimeMask(el) {
      const d = el.value.replace(/\D/g, '').slice(0, 4);
      el.value = d.length > 2 ? d.slice(0, 2) + ':' + d.slice(2) : d;
    }
    function tpNormTime(s) {
      s = String(s || '').trim();
      if (!s) return '';
      const m = /^(\d{1,2})[:.](\d{2})$/.exec(s) || /^(\d{1,2})(\d{2})$/.exec(s);
      if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
      return String(m[1]).padStart(2, '0') + ':' + m[2];
    }

    // ---------- Import eines fertigen Dienstplans (Excel) ----------
    // Format wie „Dienstplan KW 46.xlsx“: Kopfzeile mit Montag … Sonntag, links der Name, Zellen wie
    // „14:30 - 23:00/GM“, „10:00-14:00/17:00-22:00“, OFF, K, ZA, U. Importiert in die ANGEZEIGTE Woche.
    function tpParseCell(raw) {
      if (raw === null || raw === undefined) return null;
      const txt = String(raw).trim();
      if (!txt) return null;
      const up = txt.toUpperCase();
      if (up === 'F' || up === 'X' || up === 'OFF' || up === 'FREI') return { code: 'OFF' };
      if (/^(K|ZA|U)$/.test(up)) return { code: up };
      const ranges = [];
      const rx = /(\d{1,2})[:.](\d{2})\s*-\s*(\d{1,2})[:.](\d{2})/g;
      let m, last = 0;
      while ((m = rx.exec(txt)) !== null) {
        const a = tpNormTime(m[1] + ':' + m[2]), b = tpNormTime(m[3] + ':' + m[4]);
        if (a && b) ranges.push([a, b]);
        last = rx.lastIndex;
      }
      if (ranges.length) {
        const st = /\/\s*([A-Za-zÄÖÜäöü.]{1,12})\s*$/.exec(txt.slice(last));
        return { s1: ranges[0], s2: ranges[1] || null, station: st ? st[1] : null };
      }
      if (up.length <= 4) return { code: up };   // andere Kurzcodes übernehmen
      return null;                                // freie Notizen ignorieren
    }

    async function teamPlanImportFile(input) {
      const file = input.files && input.files[0];
      input.value = '';
      if (!file || !userIsAdmin) return;
      if (typeof XLSX === 'undefined') return alert('Excel-Bibliothek nicht geladen.');
      try {
        const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
        const kw = tpIsoKw(tpWeekStart);
        // Blatt mit passender KW im Namen (z. B. „KW46 1211-1811“), sonst das erste Blatt
        // 1) Blatt mit der KW der angezeigten Woche im Namen (z. B. „KW46 1211-1811“) wird automatisch gewählt.
        // 2) Gibt es keins (oder mehrere), fragen wir mit einer nummerierten Liste nach.
        const kwSheets = wb.SheetNames.filter(n => { const m = /^KW\s*0*(\d+)/i.exec(n.trim()); return m && Number(m[1]) === kw; });
        let sheetName = kwSheets.length === 1 ? kwSheets[0] : '';
        if (!sheetName) {
          const list = kwSheets.length ? kwSheets : wb.SheetNames;
          const pick = prompt((kwSheets.length ? 'Mehrere Blätter für KW ' + kw + ' gefunden.' : 'Kein Blatt für KW ' + kw + ' gefunden.') + '\nBitte Nummer wählen:\n\n'
            + list.map((n, i) => (i + 1) + ' = ' + n.trim()).join('\n'), '1');
          const idx = parseInt(pick, 10) - 1;
          if (!(idx >= 0 && idx < list.length)) return;
          sheetName = list[idx];
        }
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, raw: true, defval: '' });
        const dayNames = ['montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag', 'sonntag'];
        let headRow = -1, cols = [];
        for (let i = 0; i < rows.length && headRow < 0; i++) {
          const idx = dayNames.map(n => rows[i].findIndex(c => String(c).trim().toLowerCase() === n));
          if (idx.every(x => x >= 0)) { headRow = i; cols = idx; }
        }
        if (headRow < 0) return alert('Kopfzeile mit Montag … Sonntag nicht gefunden. Bitte eine Datei im Dienstplan-Format wählen.');
        const nameCol = Math.max(0, rows[headRow].findIndex(c => String(c).trim().toLowerCase() === 'name'));
        const known = new Map((staffDatabaseRecords || []).map(s => [String(s.name).toLowerCase(), s.name]));
        const out = [], unknown = new Set();
        for (let r = headRow + 1; r < rows.length; r++) {
          const name = String(rows[r][nameCol] || '').trim();
          if (!name) continue;
          const cells = cols.map(c => tpParseCell(rows[r][c]));
          if (!cells.some(Boolean)) continue;   // Gruppen-Überschrift (AM-TEAM …) oder leere Zeile
          const person = known.get(name.toLowerCase()) || name;
          if (!known.has(name.toLowerCase())) unknown.add(name);
          cells.forEach((c, i) => {
            if (!c) return;
            const d = tpAddDays(tpWeekStart, i);
            const base = { employee_name: person, year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
            if (c.code) out.push(Object.assign(base, { station: null, shift_1_start: c.code, shift_1_end: null, shift_2_start: null, shift_2_end: null }));
            else out.push(Object.assign(base, { station: c.station || null, shift_1_start: c.s1[0], shift_1_end: c.s1[1], shift_2_start: c.s2 ? c.s2[0] : null, shift_2_end: c.s2 ? c.s2[1] : null }));
          });
        }
        if (!out.length) return alert('In der Datei wurden keine Schichten gefunden.');
        const msg = `Blatt „${sheetName}“ in KW ${kw} (${tpWeekRange(tpWeekStart)}) importieren?\n${out.length} Einträge.`
          + (unknown.size ? `\n\nNamen, die nicht im Personal stehen (werden trotzdem importiert):\n${Array.from(unknown).join(', ')}` : '')
          + '\n\nVorhandene Einträge dieser Woche für diese Personen werden überschrieben.';
        if (!confirm(msg)) return;
        if (!await tpEnsureWeekRow()) return;
        const res = await _supabase.from('work_schedules').upsert(out, { onConflict: 'employee_name,year,month,day' });
        if (res.error) return alert('Import fehlgeschlagen: ' + res.error.message);
        await loadTeamPlan();
        showAppToast({ initial: '📥', title: 'Dienstplan importiert', text: `KW ${kw}: ${out.length} Einträge (Entwurf, noch nicht veröffentlicht)` });
      } catch (e) {
        alert('Datei konnte nicht gelesen werden: ' + (e && e.message ? e.message : e));
      }
    }

    // ---------- Schicht bearbeiten ----------
    function openTeamPlanCell(employee, iso) {
      if (!userIsAdmin) return;
      const date = tpParseIso(iso);
      const row = tpFindRow(employee, date);
      tpEditing = { employee: employee, date: date, existing: row };
      document.getElementById('tpCellTitle').textContent = employee;
      document.getElementById('tpCellSub').textContent = `${TP_WEEKDAYS[date.getDay()]}, ${tpDmy(date)} · KW ${tpIsoKw(date)}`;

      const code = tpSpecialCode(row);
      document.getElementById('tpCellPresetCode').value = code;
      document.getElementById('tpS1Start').value = code ? '' : tpTimeInput(row && row.shift_1_start);
      document.getElementById('tpS1End').value = code ? '' : tpTimeInput(row && row.shift_1_end);
      document.getElementById('tpS2Start').value = code ? '' : tpTimeInput(row && row.shift_2_start);
      document.getElementById('tpS2End').value = code ? '' : tpTimeInput(row && row.shift_2_end);
      document.getElementById('tpStation').value = (row && row.station) || '';

      document.getElementById('tpCellDeleteBtn').classList.toggle('hidden', !row);
      ['tpS1Start', 'tpS1End', 'tpS2Start', 'tpS2End'].forEach(id => { document.getElementById(id).oninput = function () { tpTimeMask(this); tpUpdateCellHours(); }; });
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
        el.textContent = ({ X: 'Frei (OFF): keine Arbeitszeit.', OFF: 'Frei (OFF): keine Arbeitszeit.', U: 'Urlaub (U)', K: 'Krank (K)', ZA: 'Zeitausgleich (ZA)' })[code] || 'Eintrag: ' + code;
        return;
      }
      const v = id => document.getElementById(id).value;
      const min = tpShiftMinutes(v('tpS1Start'), v('tpS1End')) + tpShiftMinutes(v('tpS2Start'), v('tpS2End'));
      el.textContent = min ? `Arbeitszeit: ${tpFormatHours(min)} Std. (ohne Pausenabzug)` : 'Beginn und Ende eintragen oder oben Frei / Urlaub / Krank wählen.';
    }

    async function saveTeamPlanCell() {
      if (!tpEditing) return;
      const v = id => document.getElementById(id).value.trim();
      const code = document.getElementById('tpCellPresetCode').value;
      const s1a = tpNormTime(v('tpS1Start')), s1b = tpNormTime(v('tpS1End')), s2a = tpNormTime(v('tpS2Start')), s2b = tpNormTime(v('tpS2End'));
      if (!code) {
        if ([s1a, s1b, s2a, s2b].some(x => x === null)) return alert('Bitte die Uhrzeit im 24-Stunden-Format eintragen, z. B. 08:30 oder 14:30.');
        if ((s1a && !s1b) || (!s1a && s1b)) return alert('Schicht 1: bitte Beginn und Ende angeben.');
        if ((s2a && !s2b) || (!s2a && s2b)) return alert('Schicht 2: bitte Beginn und Ende angeben.');
        if (!s1a && s2a) return alert('Bitte zuerst Schicht 1 ausfüllen.');
        if (!s1a) return alert('Bitte eine Schicht eintragen oder Frei / Urlaub / Krank wählen.');
      }
      if (!await tpEnsureWeekRow()) return;
      const d = tpEditing.date;
      const payload = {
        station: v('tpStation') || null,
        shift_1_start: code || s1a || null,
        shift_1_end: code ? null : (s1b || null),
        shift_2_start: code ? null : (s2a || null),
        shift_2_end: code ? null : (s2b || null)
      };
      const key = { employee_name: tpEditing.employee, month: d.getMonth() + 1, year: d.getFullYear(), day: d.getDate() };
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
      const d = tpEditing.date;
      const key = { employee_name: tpEditing.employee, month: d.getMonth() + 1, year: d.getFullYear(), day: d.getDate() };
      const { error } = await _supabase.from('work_schedules').delete().match(key);
      if (error) return alert('Löschen fehlgeschlagen: ' + error.message);
      closeTeamPlanCell();
      await loadTeamPlan();
    }

    // ---------- Excel-Export (Wochenliste wie „Stundenliste Wöchentlich“) ----------
    function exportTeamPlanExcel() {
      if (typeof XLSX === 'undefined') return alert('Excel-Bibliothek nicht geladen.');
      const employees = tpEmployees();
      if (!employees.length) return alert('Keine Daten zum Exportieren.');
      const days = [0, 1, 2, 3, 4, 5, 6].map(i => tpAddDays(tpWeekStart, i));
      const names = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
      const aoa = [[tpWeekRange(tpWeekStart), 'KW ' + tpIsoKw(tpWeekStart)], ['NAME'].concat(names, ['Gesamt', 'Unterschrift'])];
      let lastGroup = null;
      employees.forEach(emp => {
        if (emp.group !== lastGroup) { aoa.push([emp.group]); lastGroup = emp.group; }
        const line = [emp.name];
        let min = 0;
        days.forEach(d => {
          const row = tpFindRow(emp.name, d);
          const code = tpSpecialCode(row);
          if (code) { line.push(code === 'X' ? 'OFF' : code); return; }
          if (!row || tpCellMinutes(row) === 0) { line.push(''); return; }
          min += tpCellMinutes(row);
          let t = tpTimeInput(row.shift_1_start) + ' - ' + tpTimeInput(row.shift_1_end);
          if (tpToMinutes(row.shift_2_start) !== null) t += ' / ' + tpTimeInput(row.shift_2_start) + ' - ' + tpTimeInput(row.shift_2_end);
          if (row.station) t += '/' + row.station;
          line.push(t);
        });
        line.push(Math.round(min / 6) / 10, '');
        aoa.push(line);
      });
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = [{ wch: 22 }].concat(new Array(7).fill({ wch: 20 })).concat([{ wch: 9 }, { wch: 18 }]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'KW ' + tpIsoKw(tpWeekStart));
      XLSX.writeFile(wb, `Dienstplan_KW${String(tpIsoKw(tpWeekStart)).padStart(2, '0')}_${tpIso(tpWeekStart)}.xlsx`);
    }

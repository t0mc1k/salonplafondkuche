/* ============================================================
   js/payroll.js  (v3.2.03)
   Stunden & Lohn (Manager/Developer): Wochenübersicht (Mo–So, KW wie im Dienstplan) oder Monatsübersicht für die Lohnverrechnung.
   Gesamt = geplante Arbeitszeit (Arbeitsplan) − Pause + Korrektur des Managers. Zeitraum: eine Kalenderwoche (Mo–So).
   Pause: automatisch 30 Minuten bei Schichten über 6 Stunden, solange der Manager keinen eigenen Wert einträgt.
   Es werden beide Summen gezeigt: ohne Pause (Plan + Korrektur) und mit Pause (netto). Keine Zuschläge.
   Tabellen: work_schedules, time_entries; Funktion set_time_entry (SQL 3.2.03)
   ============================================================ */

    const PR_BREAK_MIN = 30, PR_BREAK_AFTER = 360;   // automatische Pause: 30 Min. bei Schichten über 6 Std.
    const prAutoBreak = mins => (mins > PR_BREAK_AFTER ? PR_BREAK_MIN : 0);
    let pr = { m: null, mode: 'week', week: null, year: 0, month: 0, rows: [], entries: [], detail: null };   // week = Montag der angezeigten Woche; im Monatsmodus year/month

    const prWeekDays = () => [0, 1, 2, 3, 4, 5, 6].map(i => tpAddDays(pr.week, i));
    const prRowIso = r => r.year + '-' + String(r.month).padStart(2, '0') + '-' + String(r.day).padStart(2, '0');

    function openPayrollModal() {
      closeSettingsMenu();
      checkManagerAuth(() => {
        const now = new Date();
        pr.week = tpMondayOf(now); pr.year = now.getFullYear(); pr.month = now.getMonth() + 1;
        pr.detail = null;
        pr.m = fmOpen('prModal', { title: '💶 Stunden & Lohn', sub: 'Woche (Mo–So, wie im Dienstplan) oder Monat. Pause automatisch 30 Min. (Schichten über 6 Std.). Summe ohne und mit Pause. Ohne Zuschläge.', wide: true });
        prLoad();
      });
    }

    function prShift(delta) {
      if (pr.mode === 'month') {
        pr.month += delta;
        if (pr.month < 1) { pr.month = 12; pr.year--; }
        if (pr.month > 12) { pr.month = 1; pr.year++; }
      } else pr.week = tpAddDays(pr.week, 7 * delta);
      pr.detail = null;
      prLoad();
    }
    function prToday() { const n = new Date(); pr.week = tpMondayOf(n); pr.year = n.getFullYear(); pr.month = n.getMonth() + 1; pr.detail = null; prLoad(); }
    // Umschalten Woche <-> Monat: der Monat der angezeigten Woche (Donnerstag der Woche) bzw. die Woche des 1. des Monats
    function prSetMode(mode) {
      if (mode === pr.mode) return;
      if (mode === 'month') { const th = tpAddDays(pr.week, 3); pr.year = th.getFullYear(); pr.month = th.getMonth() + 1; }
      else pr.week = tpMondayOf(new Date(pr.year, pr.month - 1, 1));
      pr.mode = mode; pr.detail = null;
      prLoad();
    }
    // Zeitraum-Text für Kopf und Dateinamen
    const prPeriodLabel = () => pr.mode === 'month' ? FM_MONTHS[pr.month - 1] + ' ' + pr.year : 'KW ' + tpIsoKw(pr.week) + ' · ' + tpWeekRange(pr.week);

    async function prLoad() {
      pr.m.setBody('<p class="staff-empty">Lade ...</p>');
      let wd = prWeekDays();
      if (pr.mode === 'month') { const n = new Date(pr.year, pr.month, 0).getDate(); wd = Array.from({ length: n }, (_, i) => new Date(pr.year, pr.month - 1, i + 1)); }
      const first = tpIso(wd[0]), last = tpIso(wd[wd.length - 1]);
      // Eine Woche kann über einen Monatswechsel gehen: je Monat eine Abfrage
      const ym = {};
      wd.forEach(d => { const k = d.getFullYear() + '-' + (d.getMonth() + 1); (ym[k] = ym[k] || { y: d.getFullYear(), m: d.getMonth() + 1, days: [] }).days.push(d.getDate()); });
      const [schParts, te] = await Promise.all([
        Promise.all(Object.keys(ym).map(k => _supabase.from('work_schedules').select('*').eq('year', ym[k].y).eq('month', ym[k].m).in('day', ym[k].days))),
        _supabase.from('time_entries').select('*').gte('work_date', first).lte('work_date', last)
      ]);
      const sch = { error: (schParts.find(p => p.error) || {}).error, data: [].concat(...schParts.map(p => p.data || [])) };
      sch.data.sort((a, b) => String(a.employee_name).localeCompare(String(b.employee_name), 'de') || (a.month - b.month) || (a.day - b.day));
      if (sch.error) { pr.m.setBody(fmErrorHtml(sch.error)); return; }
      if (te.error) { pr.m.setBody(fmErrorHtml(te.error)); return; }
      pr.rows = sch.data || [];
      pr.entries = te.data || [];
      prRender();
    }

    // Name im Plan -> Name in der Personalliste (für time_entries)
    function prStaffName(rowName) {
      const n = String(rowName).trim().toLowerCase();
      const recs = (staffDatabaseRecords || []).map(s => s.name);
      const exact = recs.find(x => x.toLowerCase() === n);
      if (exact) return exact;
      const part = recs.filter(x => n.indexOf(x.toLowerCase()) !== -1).sort((a, b) => b.length - a.length)[0];
      return part || String(rowName).trim();
    }

    function prEntryFor(rowName, iso) {
      const sn = prStaffName(rowName).toLowerCase();
      return pr.entries.find(e => e.work_date === iso && String(e.employee_name).toLowerCase() === sn) || null;
    }

    // Pro Mitarbeiter zusammenrechnen
    function prAggregate() {
      const map = new Map();
      pr.rows.forEach(r => {
        const key = String(r.employee_name || '').trim();
        if (!key) return;
        if (!map.has(key)) map.set(key, { name: key, station: r.station || '', days: [], shifts: 0, planned: 0, brk: 0, adj: 0 });
        const e = map.get(key);
        const iso = prRowIso(r);
        const work = tpHasShift(r);
        const entry = prEntryFor(key, iso);
        const mins = work ? tpCellMinutes(r) : 0;
        // Korrekturen zählen auch an Tagen ohne Plan-Schicht (z. B. Einspringen)
        if (!work && !(entry && (entry.adjust_minutes || entry.break_minutes))) return;
        const brk = work ? (entry ? entry.break_minutes : prAutoBreak(mins)) : 0;   // ohne eigenen Eintrag: automatisch 30 Min.
        const adj = entry ? entry.adjust_minutes : 0;
        e.days.push({ day: r.day, iso, row: r, work, mins, brk, adj, note: entry ? entry.note : '', auto: work && !entry && brk > 0 });
        if (work) e.shifts++;
        e.planned += mins; e.brk += brk; e.adj += adj;
      });
      return Array.from(map.values())
        .sort((a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base' }));
    }

    const prNet = e => e.planned - e.brk + e.adj;         // mit Pause (netto)
    const prGross = e => e.planned + e.adj;               // ohne Pause
    // Stunden mit bis zu 2 Nachkommastellen (z. B. 4,75), für die Lohnverrechnung genau genug
    const prFmt = min => (Math.round(min / 60 * 100) / 100).toString().replace('.', ',');

    function prRender() {
      pr.m.setToolbar(`
        <div class="fm-row-flex" style="justify-content:space-between">
          <div class="tp-monthnav">
            <button type="button" onclick="prShift(-1)" class="ui-btn-ghost" aria-label="Zurück">‹</button>
            <b class="tp-month-label">${escapeHtml(prPeriodLabel())}</b>
            <button type="button" onclick="prShift(1)" class="ui-btn-ghost" aria-label="Weiter">›</button>
            <button type="button" onclick="prToday()" class="ui-btn-ghost">Heute</button>
            <span class="fm-tabs" style="margin-left:.4rem"><button type="button" class="fm-tab${pr.mode === 'week' ? ' active' : ''}" onclick="prSetMode('week')">Woche</button><button type="button" class="fm-tab${pr.mode === 'month' ? ' active' : ''}" onclick="prSetMode('month')">Monat</button></span>
          </div>
          <button type="button" class="ui-btn-ghost" onclick="prExportExcel()">📗 Excel für die Lohnverrechnung</button>
        </div>`);
      if (pr.detail) { prRenderDetail(); return; }

      const list = prAggregate();
      if (!list.length) {
        pr.m.setBody('<p class="staff-empty">Für diesen Zeitraum gibt es keinen Arbeitsplan.</p>');
        pr.m.setFoot('<button type="button" class="ui-btn-primary" onclick="fmClose(\'prModal\')">Fertig</button>');
        return;
      }
      const tot = list.reduce((a, e) => ({ planned: a.planned + e.planned, brk: a.brk + e.brk, adj: a.adj + e.adj }), { planned: 0, brk: 0, adj: 0 });
      let html = `<p class="fm-hint" style="margin-bottom:.6rem">Tippe auf einen Mitarbeiter, um Pausen und Korrekturen pro Tag zu sehen oder zu ändern.</p>
        <div style="overflow-x:auto"><table class="pr-table">
          <thead><tr><th>Mitarbeiter</th><th>Schichten</th><th>Geplant</th><th>Pause</th><th>Korrektur</th><th>Ohne Pause</th><th>Mit Pause</th></tr></thead><tbody>`;
      html += list.map(e => `<tr class="pr-click" onclick="prOpenDetail(${jsArg(e.name)})">
          <td><b>${escapeHtml(e.name)}</b>${e.station ? `<br><span class="fm-hint">${escapeHtml(e.station)}</span>` : ''}</td>
          <td>${e.shifts}</td><td>${prFmt(e.planned)}</td><td>${e.brk ? '−' + prFmt(e.brk) : '–'}</td>
          <td>${e.adj ? (e.adj > 0 ? '+' : '−') + prFmt(Math.abs(e.adj)) : '–'}</td><td>${prFmt(prGross(e))}</td><td><b>${prFmt(prNet(e))}</b></td></tr>`).join('');
      html += `</tbody><tfoot><tr><td><b>Gesamt</b></td><td>${list.reduce((a, e) => a + e.shifts, 0)}</td><td>${prFmt(tot.planned)}</td>
          <td>${tot.brk ? '−' + prFmt(tot.brk) : '–'}</td><td>${tot.adj ? (tot.adj > 0 ? '+' : '−') + prFmt(Math.abs(tot.adj)) : '–'}</td>
          <td><b>${prFmt(tot.planned + tot.adj)}</b></td><td><b>${prFmt(tot.planned - tot.brk + tot.adj)}</b></td></tr></tfoot></table></div>
        <p class="fm-hint" style="margin-top:.6rem">Pause: bei jeder Schicht über 6 Std. automatisch ${PR_BREAK_MIN} Min. (im Tag änderbar). <b>Ohne Pause</b> = Plan + Korrektur, <b>Mit Pause</b> = Plan − Pause + Korrektur (netto).</p>`;
      pr.m.setBody(html);
      pr.m.setFoot('<button type="button" class="ui-btn-primary" onclick="fmClose(\'prModal\')">Fertig</button>');
    }

    function prOpenDetail(name) { pr.detail = name; prRender(); }
    function prCloseDetail() { pr.detail = null; prRender(); }

    function prRenderDetail() {
      const e = prAggregate().find(x => x.name === pr.detail);
      if (!e) { pr.detail = null; prRender(); return; }
      let html = `<div class="fm-row-flex" style="justify-content:space-between;margin-bottom:.7rem">
          <button type="button" class="fm-btn" onclick="prCloseDetail()">← Alle Mitarbeiter</button>
          <b style="color:var(--ui-text)">${escapeHtml(e.name)} · ohne Pause ${prFmt(prGross(e))} Std. · mit Pause ${prFmt(prNet(e))} Std.</b>
        </div>
        <p class="fm-hint" style="margin-bottom:.6rem">Pause (automatisch ${PR_BREAK_MIN} Min. bei Schichten über 6 Std.) und Korrektur in Minuten. Korrektur: z. B. +30, wenn länger gearbeitet wurde, −15 wenn kürzer.</p>`;
      html += e.days.map(d => `
        <div class="mp-day" id="prDay${d.day}">
          <div class="mp-date">${FM_DAYS[fmParseIso(d.iso).getDay()]}<b>${d.day}</b><small>${String(fmParseIso(d.iso).getMonth() + 1).padStart(2, '0')}</small></div>
          <div class="fm-grow">
            <div class="mp-time">${d.work ? escapeHtml(mpShiftText(d.row)) : '<span class="fm-hint">Keine Plan-Schicht</span>'}${d.work ? ` <span class="fm-hint">· ${prFmt(d.mins)} Std.</span>` : ''}</div>
            <div class="fm-row-flex" style="margin-top:.4rem">
              <label class="fm-hint">Pause${d.auto ? ' (auto)' : ''}</label><input type="number" id="prBr${d.day}" class="ui-field pr-num" min="0" max="600" step="5" value="${d.work ? d.brk : (d.brk || '')}" placeholder="0">
              <label class="fm-hint">Korrektur</label><input type="number" id="prAd${d.day}" class="ui-field pr-num" min="-720" max="720" step="5" value="${d.adj || ''}" placeholder="0">
              <input type="text" id="prNo${d.day}" class="ui-field fm-grow" style="min-width:7rem" maxlength="100" placeholder="Notiz" value="${escapeHtml(d.note || '')}">
              <button type="button" class="fm-btn fm-btn-ok" onclick="prSaveDay(${jsArg(e.name)}, ${d.day}, ${jsArg(d.iso)})">💾</button>
            </div>
          </div>
        </div>`).join('');
      html += `<div class="pr-sumbox"><div><span>Summe ohne Pause</span><b>${prFmt(prGross(e))} Std.</b></div><div><span>Pause gesamt</span><b>−${prFmt(e.brk)} Std.</b></div><div><span>Summe mit Pause</span><b>${prFmt(prNet(e))} Std.</b></div></div>`;
      pr.m.setBody(html || '<p class="staff-empty">Keine Tage.</p>');
      pr.m.setFoot('<button type="button" class="ui-btn-primary" onclick="fmClose(\'prModal\')">Fertig</button>');
    }

    async function prSaveDay(name, day, iso) {
      const brk = Math.max(0, Math.min(600, parseInt(document.getElementById('prBr' + day).value, 10) || 0));
      const adj = Math.max(-720, Math.min(720, parseInt(document.getElementById('prAd' + day).value, 10) || 0));
      const note = document.getElementById('prNo' + day).value;
      const { error } = await _supabase.rpc('set_time_entry', {
        p_name: prStaffName(name), p_date: iso, p_break: brk, p_adjust: adj, p_note: note
      });
      if (error) return fmToast(fmDbError(error));
      fmToast('Gespeichert');
      const keep = pr.detail;
      await prLoad();
      pr.detail = keep;
      prRender();
    }

    // ---------- Excel ----------
    function prExportExcel() {
      if (typeof XLSX === 'undefined') return alert('Excel-Bibliothek nicht geladen.');
      const list = prAggregate();
      if (!list.length) return alert('Keine Daten zum Exportieren.');
      const h = min => Math.round(min / 60 * 100) / 100;
      const sum = [['Mitarbeiter', 'Station', 'Schichten', 'Geplant (Std.)', 'Pause (Std.)', 'Korrektur (Std.)', 'Summe ohne Pause (Std.)', 'Summe mit Pause (Std.)']];
      list.forEach(e => sum.push([e.name, e.station, e.shifts, h(e.planned), h(e.brk), h(e.adj), h(prGross(e)), h(prNet(e))]));
      sum.push(['Gesamt', '', list.reduce((a, e) => a + e.shifts, 0), h(list.reduce((a, e) => a + e.planned, 0)),
        h(list.reduce((a, e) => a + e.brk, 0)), h(list.reduce((a, e) => a + e.adj, 0)), h(list.reduce((a, e) => a + prGross(e), 0)), h(list.reduce((a, e) => a + prNet(e), 0))]);
      const det = [['Mitarbeiter', 'Datum', 'Schicht', 'Geplant (Std.)', 'Pause (Min.)', 'Korrektur (Min.)', 'Ohne Pause (Std.)', 'Mit Pause (Std.)', 'Notiz']];
      list.forEach(e => e.days.forEach(d => det.push([e.name, d.iso, d.work ? mpShiftText(d.row) : '', h(d.mins), d.brk, d.adj, h(d.mins + d.adj), h(d.mins - d.brk + d.adj), d.note || ''])));
      const wb = XLSX.utils.book_new();
      const w1 = XLSX.utils.aoa_to_sheet(sum); w1['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 15 }, { wch: 22 }, { wch: 20 }];
      const w2 = XLSX.utils.aoa_to_sheet(det); w2['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 15 }, { wch: 16 }, { wch: 16 }, { wch: 30 }];
      XLSX.utils.book_append_sheet(wb, w1, pr.mode === 'month' ? FM_MONTHS[pr.month - 1] + ' ' + pr.year : 'KW ' + tpIsoKw(pr.week));
      XLSX.utils.book_append_sheet(wb, w2, 'Details');
      XLSX.writeFile(wb, pr.mode === 'month' ? `Stunden_${pr.year}-${String(pr.month).padStart(2, '0')}.xlsx` : `Stunden_KW${String(tpIsoKw(pr.week)).padStart(2, '0')}_${tpIso(pr.week)}.xlsx`);
    }

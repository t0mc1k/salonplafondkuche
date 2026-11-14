/* ============================================================
   js/dishwash.js  (v1.0.08)
   Abwasher: Reinigungs-Aufgaben (Orte mit Foto, täglich/wöchentlich/monatlich), „Erledigt“-Knopf
   (Name und Zeit setzt die Datenbank), Extra-Einträge, Übersicht und Monats-Rangliste für den Manager.
   Rechte (Datenbank, RLS): Abwasher = Hauptrolle ODER Zusatzrolle dishwasher; Manager/Developer sehen alles
   und pflegen die Orte; Köche haben keinen Zugriff.
   Tabellen: wash_areas, wash_logs, wash_monthly (sql/1.0.05_dishwash.sql)
   ============================================================ */

    const DW_FREQ = { daily: ['Täglich', 'Daily'], weekly: ['Wöchentlich', 'Weekly'], monthly: ['Monatlich', 'Monthly'] };
    const DW_FREQ_ORDER = ['daily', 'weekly', 'monthly'];
    let dw = { m: null, tab: 'tasks', areas: [], logs: [], stat: { year: 0, month: 0, logs: [] }, archive: [], edit: null, photo: '' };

    function dwCanWash() { return typeof staffHasRole === 'function' && staffHasRole('dishwasher'); }
    function dwWashers() {
      return (staffDatabaseRecords || []).filter(s => s.role === 'dishwasher' || (Array.isArray(s.extra_roles) && s.extra_roles.indexOf('dishwasher') !== -1)).map(s => s.name);
    }
    function dwErr(err) {
      const msg = (err && err.message) || String(err);
      if (/does not exist|schema cache|could not find the (table|function)/i.test(msg) || (err && err.code === '42P01')) {
        return 'Die Datenbank ist für Abwasher noch nicht eingerichtet. Bitte zuerst sql/1.0.05_dishwash.sql im Supabase SQL Editor ausführen.';
      }
      return msg;
    }
    function dwErrHtml(err) { return '<p class="staff-empty" style="color:#ef4444">' + escapeHtml(dwErr(err)) + '</p>'; }

    // Beginn des aktuellen Zeitraums: heute / Montag dieser Woche / 1. des Monats (Ortszeit)
    function dwPeriodStart(freq) {
      const n = new Date();
      if (freq === 'daily') return new Date(n.getFullYear(), n.getMonth(), n.getDate());
      if (freq === 'weekly') return new Date(n.getFullYear(), n.getMonth(), n.getDate() - ((n.getDay() + 6) % 7));
      return new Date(n.getFullYear(), n.getMonth(), 1);
    }
    function dwPeriodText(freq) { return freq === 'daily' ? 'heute' : (freq === 'weekly' ? 'diese Woche' : 'diesen Monat'); }

    // ---------- Öffnen / Laden ----------
    async function openDishwashModal() {
      closeSettingsMenu();
      if (!userIsAdmin && !dwCanWash()) { alert('Dieser Bereich ist nur für Abwasher und die Leitung.'); return; }
      const now = new Date();
      dw.stat = { year: now.getFullYear(), month: now.getMonth() + 1, logs: [] };
      dw.tab = 'tasks';
      dw.m = fmOpen('dwModal', {
        title: '🧽 Abwasher',
        sub: dwCanWash() ? 'Hake erledigte Aufgaben ab (✓ Erledigt). Dein Name und die Zeit werden automatisch gespeichert.'
          : 'Aufgaben, Übersicht und Rangliste. Orte und Rhythmus pflegst du unter „Orte“.',
        wide: true
      });
      dw.m.setBody('<p class="staff-empty">Lade ...</p>');
      try { await _supabase.rpc('wash_close_due_months'); } catch (e) {}   // Monatswertung der Vormonate speichern
      await dwLoad();
    }

    async function dwLoad() {
      const since = new Date(); since.setDate(1); since.setDate(since.getDate() - 7);   // reicht für Woche/Monat/Tag
      const [a, l] = await Promise.all([
        _supabase.from('wash_areas').select('*').order('sort_order', { ascending: true }).order('name', { ascending: true }),
        _supabase.from('wash_logs').select('*').gte('done_at', since.toISOString()).order('done_at', { ascending: false }).limit(3000)
      ]);
      if (a.error) { dw.m.setBody(dwErrHtml(a.error)); return; }
      if (l.error) { dw.m.setBody(dwErrHtml(l.error)); return; }
      dw.areas = a.data || [];
      dw.logs = l.data || [];
      dwRender();
    }

    function dwTab(t) {
      dw.tab = t;
      if (t === 'overview' || t === 'rank') { dwLoadStat(); return; }
      if (t === 'archive') { dwLoadArchive(); return; }
      dwRender();
    }

    function dwTabsHtml() {
      const mine = [['tasks', dwCanWash() ? '✅ Meine Aufgaben' : '✅ Aufgaben']];
      if (dwCanWash()) mine.push(['extra', '➕ Extra']);
      const lead = userIsAdmin ? [['overview', '📋 Übersicht'], ['rank', '🏆 Rangliste'], ['archive', '🗂️ Monate'], ['areas', '⚙️ Orte']] : [];
      const btn = t => `<button type="button" class="fm-tab${dw.tab === t[0] ? ' active' : ''}" onclick="dwTab('${t[0]}')">${t[1]}</button>`;
      // Wer abwäscht UND Leitung ist (z. B. Developer + Abwasher): zwei klar getrennte Bereiche
      if (dwCanWash() && lead.length) {
        return `<div class="dw-modes"><div class="dw-mode"><small>🧽 Meine Arbeit</small><div class="fm-tabs">${mine.map(btn).join('')}</div></div>
          <div class="dw-mode"><small>🧑‍💼 Leitung</small><div class="fm-tabs">${lead.map(btn).join('')}</div></div></div>`;
      }
      return `<div class="fm-tabs">${mine.concat(lead).map(btn).join('')}</div>`;
    }

    function dwRender() {
      dw.m.setToolbar(dwTabsHtml());
      dw.m.setFoot('<button type="button" class="ui-btn-primary" onclick="fmClose(\'dwModal\')">Fertig</button>');
      if (dw.tab === 'tasks') return dwRenderTasks();
      if (dw.tab === 'extra') return dwRenderExtra();
      if (dw.tab === 'areas') return dwRenderAreas();
    }

    // ---------- Aufgaben ----------
    function dwLastDone(a) {
      const start = dwPeriodStart(a.frequency);
      return dw.logs.find(l => l.area_id === a.id && new Date(l.done_at) >= start) || null;   // logs sind nach Zeit absteigend sortiert
    }

    function dwRenderTasks() {
      const areas = dw.areas.filter(a => a.active);
      if (!areas.length) {
        dw.m.setBody(`<p class="staff-empty">${userIsAdmin ? 'Es gibt noch keine Aufgaben zum Abhaken. Lege zuerst unter „⚙️ Orte“ (Bereich Leitung) die Orte und Aufgaben an, danach erscheinen sie hier mit dem Knopf „✓ Erledigt“.' : 'Der Manager hat noch keine Aufgaben angelegt.'}</p>`);
        return;
      }
      const meLower = String(currentWaiterName || '').toLowerCase();
      let html = '';
      DW_FREQ_ORDER.forEach(freq => {
        const list = areas.filter(a => a.frequency === freq);
        if (!list.length) return;
        const doneCount = list.filter(a => dwLastDone(a)).length;
        html += `<h4 class="dw-group">${DW_FREQ[freq][0]} <small>${doneCount} / ${list.length} erledigt ${dwPeriodText(freq)}</small></h4><div class="dw-grid">`;
        html += list.map(a => {
          const last = dwLastDone(a);
          const photo = a.photo_url
            ? `<img class="dw-photo" src="${escapeHtml(a.photo_url)}" alt="${escapeHtml(a.name)}" loading="lazy" onclick="openPhotoPreview(${jsArg(a.photo_url)})">`
            : '<div class="dw-photo dw-nophoto">🧽</div>';
          let action;
          if (last) {
            const mine = String(last.done_by || '').toLowerCase() === meLower;
            const undo = (mine || userIsAdmin) && (userIsAdmin || (Date.now() - new Date(last.done_at).getTime() < 3600000))
              ? ` <button type="button" class="fm-btn" onclick="dwUndo(${jsArg(last.id)})" title="Eintrag zurücknehmen">↩️</button>` : '';
            action = `<div class="dw-done">✅ ${escapeHtml(last.done_by)} · ${escapeHtml(fmDateTime(last.done_at))}${undo}</div>`;
          } else if (dwCanWash() || userIsAdmin) {
            action = `<button type="button" class="ui-btn-primary dw-btn" onclick="dwMark(${jsArg(a.id)}, this)">✓ Erledigt</button>`;
          } else {
            action = '<div class="dw-open">⏳ Offen</div>';
          }
          return `<div class="dw-card${last ? ' dw-card-done' : ''}">${photo}<div class="dw-body">
              <div class="dw-name">${escapeHtml(a.name)}</div>
              ${a.description ? `<div class="dw-desc">${escapeHtml(a.description)}</div>` : ''}
              ${action}</div></div>`;
        }).join('');
        html += '</div>';
      });
      const mine = dw.logs.filter(l => String(l.done_by || '').toLowerCase() === meLower && dwInMonth(l.done_at, new Date().getFullYear(), new Date().getMonth() + 1)).length;
      if (dwCanWash()) html = `<div class="tp-summary" style="padding:.4rem 0 .6rem"><span><b>${mine}</b> Einträge von dir in diesem Monat</span></div>` + html;
      dw.m.setBody(html);
    }

    function dwInMonth(iso, y, m) { const d = new Date(iso); return d.getFullYear() === y && d.getMonth() + 1 === m; }

    async function dwMark(areaId, btn) {
      if (btn) btn.disabled = true;
      const { error } = await _supabase.from('wash_logs').insert([{ area_id: areaId }]);
      if (error) { if (btn) btn.disabled = false; return fmToast(dwErr(error)); }
      fmToast('✓ Gespeichert');
      await dwLoad();
    }

    async function dwUndo(logId) {
      if (!confirm('Diesen Eintrag zurücknehmen?')) return;
      const { error } = await _supabase.from('wash_logs').delete().eq('id', logId);
      if (error) return fmToast(dwErr(error));
      await dwLoad();
    }

    // ---------- Extra (etwas, das über die Liste hinaus geputzt wurde) ----------
    function dwRenderExtra() {
      const now = new Date();
      const meLower = String(currentWaiterName || '').toLowerCase();
      const mine = dw.logs.filter(l => !l.area_id && String(l.done_by || '').toLowerCase() === meLower && dwInMonth(l.done_at, now.getFullYear(), now.getMonth() + 1));
      dw.m.setBody(`<div class="fm-stack">
        <div class="fm-field"><label class="form-label" for="dwExtraText">Was hast du zusätzlich geputzt?</label>
          <div class="fm-row-flex" style="gap:.4rem">
            <input type="text" id="dwExtraText" class="ui-field" maxlength="120" autocomplete="off" placeholder="z. B. Fettfilter Dunstabzug"
              onkeydown="if (event.key === 'Enter') { event.preventDefault(); dwAddExtra(); }" style="flex:1">
            <button type="button" class="ui-btn-primary" onclick="dwAddExtra()">➕ Hinzufügen</button>
          </div>
          <p class="fm-hint">Extra-Einträge zählen in der Monatswertung mit.</p></div>
        <h4 class="dw-group">Deine Extra-Einträge in diesem Monat <small>${mine.length}</small></h4>
        ${mine.length ? mine.map(l => `<div class="fm-item"><div class="fm-item-main">
            <div class="fm-item-title">${escapeHtml(l.extra_text)}</div>
            <div class="fm-item-sub">${escapeHtml(fmDateTime(l.done_at))}</div>
            ${Date.now() - new Date(l.done_at).getTime() < 3600000 ? `<div class="fm-item-actions"><button type="button" class="fm-btn" onclick="dwUndo(${jsArg(l.id)})">↩️ Zurücknehmen</button></div>` : ''}
          </div></div>`).join('') : '<p class="staff-empty">Noch nichts eingetragen.</p>'}
      </div>`);
    }

    async function dwAddExtra() {
      const inp = document.getElementById('dwExtraText');
      const text = (inp && inp.value || '').trim();
      if (!text) return fmToast('Bitte eintragen, was du geputzt hast.');
      const { error } = await _supabase.from('wash_logs').insert([{ area_id: null, extra_text: text }]);
      if (error) return fmToast(dwErr(error));
      fmToast('✓ Extra gespeichert');
      await dwLoad();
    }

    // ---------- Übersicht & Rangliste (Manager/Developer) ----------
    async function dwLoadStat() {
      dw.m.setToolbar(dwTabsHtml());
      dw.m.setBody('<p class="staff-empty">Lade ...</p>');
      const y = dw.stat.year, mo = dw.stat.month;
      const from = new Date(y, mo - 1, 1).toISOString(), to = new Date(y, mo, 1).toISOString();
      const { data, error } = await _supabase.from('wash_logs').select('*').gte('done_at', from).lt('done_at', to).order('done_at', { ascending: false }).limit(3000);
      if (error) { dw.m.setBody(dwErrHtml(error)); return; }
      dw.stat.logs = data || [];
      dw.tab === 'rank' ? dwRenderRank() : dwRenderOverview();
    }

    function dwShiftStatMonth(delta) {
      dw.stat.month += delta;
      if (dw.stat.month < 1) { dw.stat.month = 12; dw.stat.year--; }
      if (dw.stat.month > 12) { dw.stat.month = 1; dw.stat.year++; }
      dwLoadStat();
    }
    function dwMonthNavHtml() {
      return `<div class="tp-monthnav" style="margin-bottom:.7rem">
        <button type="button" class="ui-btn-ghost" onclick="dwShiftStatMonth(-1)" aria-label="Vorheriger Monat">‹</button>
        <b class="tp-month-label">${escapeHtml(FM_MONTHS[dw.stat.month - 1] + ' ' + dw.stat.year)}</b>
        <button type="button" class="ui-btn-ghost" onclick="dwShiftStatMonth(1)" aria-label="Nächster Monat">›</button></div>`;
    }

    // Wertung pro Person: Aufgaben + Extras, sortiert nach Gesamt, dann Aufgaben, dann Name
    function dwScores(logs) {
      const map = new Map();
      dwWashers().forEach(n => map.set(n, { name: n, tasks: 0, extras: 0 }));
      logs.forEach(l => {
        if (!map.has(l.done_by)) map.set(l.done_by, { name: l.done_by, tasks: 0, extras: 0 });
        const s = map.get(l.done_by);
        if (l.area_id || !l.extra_text) s.tasks++; else s.extras++;
      });
      const list = Array.from(map.values()).map(s => Object.assign(s, { total: s.tasks + s.extras }));
      list.sort((a, b) => b.total - a.total || b.tasks - a.tasks || a.name.localeCompare(b.name, 'de'));
      let rank = 0, prev = null;
      list.forEach((s, i) => { const key = s.total + '/' + s.tasks; if (key !== prev) { rank = i + 1; prev = key; } s.rank = rank; });
      return list;
    }
    const DW_MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' };

    function dwRenderRank() {
      const list = dwScores(dw.stat.logs);
      const any = list.some(s => s.total > 0);
      const best = any ? list.filter(s => s.rank === 1) : [];
      const isCurrent = dw.stat.year === new Date().getFullYear() && dw.stat.month === new Date().getMonth() + 1;
      let html = dwMonthNavHtml();
      if (best.length) html += `<div class="dw-best">🏆 ${isCurrent ? 'Aktuell vorne' : 'Bester im Monat'}: <b>${best.map(b => escapeHtml(b.name)).join(' & ')}</b> mit ${best[0].total} Einträgen</div>`;
      html += `<div class="dw-rank">${list.length ? list.map(s => `<div class="dw-rank-row${s.rank === 1 && s.total > 0 ? ' dw-rank-first' : ''}">
          <span class="dw-rank-pos">${s.total > 0 ? (DW_MEDAL[s.rank] || s.rank + '.') : '–'}</span>
          <span class="dw-rank-name">${escapeHtml(s.name)}</span>
          <span class="dw-rank-meta">${s.tasks} Aufgaben · ${s.extras} Extra</span>
          <b class="dw-rank-total">${s.total}</b></div>`).join('') : '<p class="staff-empty">Keine Abwasher im Personal.</p>'}</div>
        <p class="fm-hint" style="margin-top:.6rem">${isCurrent ? 'Zwischenstand. Am Monatsende wird die Wertung automatisch gespeichert (siehe „🗂️ Monate“).' : 'Berechnet aus allen Einträgen dieses Monats.'}</p>`;
      dw.m.setBody(html);
      dw.m.setFoot('<button type="button" class="ui-btn-primary" onclick="fmClose(\'dwModal\')">Fertig</button>');
    }

    function dwRenderOverview() {
      const logs = dw.stat.logs;
      const tasks = logs.filter(l => l.area_id || !l.extra_text).length, extras = logs.length - tasks;
      let html = dwMonthNavHtml() + `<div class="tp-summary" style="padding:0 0 .6rem"><span><b>${logs.length}</b> Einträge</span><span><b>${tasks}</b> Aufgaben</span><span><b>${extras}</b> Extra</span></div>`;
      if (!logs.length) html += '<p class="staff-empty">Keine Einträge in diesem Monat.</p>';
      else {
        html += '<div class="dw-log">' + logs.map(l => `<div class="dw-log-row">
          <span class="dw-log-time">${escapeHtml(fmDateTime(l.done_at))}</span>
          <span class="dw-log-who">${escapeHtml(l.done_by)}</span>
          <span class="dw-log-what">${l.area_id || !l.extra_text ? escapeHtml(l.area_name || 'Aufgabe') : '➕ ' + escapeHtml(l.extra_text)}</span>
          <button type="button" class="fm-btn fm-btn-danger" onclick="dwUndoStat(${jsArg(l.id)})" title="Eintrag löschen">🗑</button></div>`).join('') + '</div>';
      }
      dw.m.setBody(html);
      dw.m.setFoot('<button type="button" class="ui-btn-ghost" onclick="dwExportExcel()">📗 Excel</button><button type="button" class="ui-btn-primary" onclick="fmClose(\'dwModal\')">Fertig</button>');
    }

    async function dwUndoStat(id) {
      if (!confirm('Eintrag endgültig löschen?')) return;
      const { error } = await _supabase.from('wash_logs').delete().eq('id', id);
      if (error) return fmToast(dwErr(error));
      await dwLoadStat();
    }

    function dwExportExcel() {
      if (typeof XLSX === 'undefined') return alert('Excel-Bibliothek nicht geladen.');
      const logs = dw.stat.logs;
      const rank = dwScores(logs);
      const wb = XLSX.utils.book_new();
      const a1 = [['Rang', 'Name', 'Aufgaben', 'Extra', 'Gesamt']].concat(rank.map(s => [s.rank, s.name, s.tasks, s.extras, s.total]));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(a1), 'Rangliste');
      const a2 = [['Zeit', 'Name', 'Aufgabe / Extra']].concat(logs.map(l => [fmDateTime(l.done_at), l.done_by, l.area_id || !l.extra_text ? (l.area_name || 'Aufgabe') : 'Extra: ' + l.extra_text]));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(a2), 'Einträge');
      XLSX.writeFile(wb, 'Abwasher_' + dw.stat.year + '-' + String(dw.stat.month).padStart(2, '0') + '.xlsx');
    }

    // ---------- Archiv: gespeicherte Monatswertungen ----------
    async function dwLoadArchive() {
      dw.m.setToolbar(dwTabsHtml());
      dw.m.setBody('<p class="staff-empty">Lade ...</p>');
      const { data, error } = await _supabase.from('wash_monthly').select('*').order('month', { ascending: false }).order('rank', { ascending: true }).limit(600);
      if (error) { dw.m.setBody(dwErrHtml(error)); return; }
      const byMonth = {};
      (data || []).forEach(r => { (byMonth[r.month] = byMonth[r.month] || []).push(r); });
      const months = Object.keys(byMonth).sort().reverse();
      dw.m.setBody(months.length ? months.map(k => {
        const d = fmParseIso(k), rows = byMonth[k];
        const win = rows.filter(r => r.rank === 1 && r.total > 0);
        return `<div class="dw-arch"><h4 class="dw-group">${escapeHtml(FM_MONTHS[d.getMonth()] + ' ' + d.getFullYear())}
            <small>${win.length ? '🏆 ' + escapeHtml(win.map(w => w.staff_name).join(' & ')) : 'keine Einträge'}</small></h4>
          ${rows.map(r => `<div class="dw-rank-row"><span class="dw-rank-pos">${r.total > 0 ? (DW_MEDAL[r.rank] || r.rank + '.') : '–'}</span>
            <span class="dw-rank-name">${escapeHtml(r.staff_name)}</span>
            <span class="dw-rank-meta">${r.tasks} Aufgaben · ${r.extras} Extra</span><b class="dw-rank-total">${r.total}</b></div>`).join('')}</div>`;
      }).join('') : '<p class="staff-empty">Noch keine abgeschlossenen Monate. Die Wertung wird automatisch nach Monatsende gespeichert.</p>');
      dw.m.setFoot('<button type="button" class="ui-btn-primary" onclick="fmClose(\'dwModal\')">Fertig</button>');
    }

    // ---------- Orte verwalten (Manager/Developer) ----------
    function dwRenderAreas() {
      let html = `<div class="fm-row-flex" style="justify-content:flex-end;margin-bottom:.6rem"><button type="button" class="ui-btn-primary" onclick="dwOpenAreaForm('')">➕ Neuer Ort / Aufgabe</button></div>`;
      html += dw.areas.length ? dw.areas.map(a => `<div class="fm-item${a.active ? '' : ' dw-inactive'}">
          ${a.photo_url ? `<img class="fm-thumb" src="${escapeHtml(a.photo_url)}" alt="" loading="lazy">` : '<div class="fm-thumb dw-nophoto">🧽</div>'}
          <div class="fm-item-main">
            <div class="fm-item-title">${escapeHtml(a.name)} ${fmStatusChip(DW_FREQ[a.frequency][0], 'blue')}${a.active ? '' : ' ' + fmStatusChip('ausgeblendet', 'gray')}</div>
            ${a.description ? `<div class="fm-item-sub">${escapeHtml(a.description)}</div>` : ''}
            <div class="fm-item-actions">
              <button type="button" class="fm-btn" onclick="dwOpenAreaForm(${jsArg(a.id)})">✏️ Bearbeiten</button>
              <button type="button" class="fm-btn fm-btn-danger" onclick="dwDeleteArea(${jsArg(a.id)})">🗑</button>
            </div></div></div>`).join('') : '<p class="staff-empty">Noch keine Orte. Lege z. B. „Fettabscheider“, „Bodenabläufe“ oder „Spülküche Wände“ an.</p>';
      dw.m.setBody(html);
    }

    function dwOpenAreaForm(id) {
      const a = id ? dw.areas.find(x => x.id === id) : null;
      dw.edit = a || { id: '', name: '', description: '', photo_url: '', frequency: 'weekly', active: true };
      dw.photo = dw.edit.photo_url || '';
      const m = fmOpen('dwForm', { title: a ? '✏️ Ort bearbeiten' : '➕ Neuer Ort / Aufgabe', layer: 2 });
      m.setBody(`<div class="fm-stack">
        <div class="fm-field"><label class="form-label" for="dwfName">Name des Ortes / der Aufgabe *</label>
          <input type="text" id="dwfName" class="ui-field" maxlength="80" value="${escapeHtml(dw.edit.name)}" placeholder="z. B. Bodenablauf Spülküche"></div>
        <div class="fm-field"><label class="form-label" for="dwfDesc">Beschreibung (optional)</label>
          <textarea id="dwfDesc" class="ui-field" rows="3" maxlength="400" placeholder="Was genau muss gemacht werden?">${escapeHtml(dw.edit.description)}</textarea></div>
        <div class="fm-field"><label class="form-label" for="dwfFreq">Wie oft?</label>
          <select id="dwfFreq" class="ui-field">${DW_FREQ_ORDER.map(f => `<option value="${f}"${dw.edit.frequency === f ? ' selected' : ''}>${DW_FREQ[f][0]}</option>`).join('')}</select>
          <p class="fm-hint">Wöchentlich = einmal pro Woche (Mo–So), monatlich = einmal pro Kalendermonat.</p></div>
        <div class="fm-field"><label class="form-label">Foto des Ortes</label>
          <div id="dwfPhotoBox">${dwPhotoBoxHtml()}</div>
          <input type="file" id="dwfPhotoCam" accept="image/*" capture="environment" onchange="dwPhotoPicked(this)" class="hidden">
          <input type="file" id="dwfPhotoGal" accept="image/*" onchange="dwPhotoPicked(this)" class="hidden">
          <div class="fm-row-flex" style="gap:.4rem;flex-wrap:wrap">
            <button type="button" class="ui-btn-ghost" onclick="document.getElementById('dwfPhotoCam').click()">📷 Foto aufnehmen</button>
            <button type="button" class="ui-btn-ghost" onclick="document.getElementById('dwfPhotoGal').click()">🖼️ Datei / Galerie wählen</button>
          </div>
          <div id="dwfPhotoStatus" class="fm-hint"></div></div>
        <label class="switch-row"><span>Aktiv (sichtbar für Abwasher)</span><span class="switch"><input type="checkbox" id="dwfActive" ${dw.edit.active ? 'checked' : ''}><span class="switch-track"></span></span></label>
      </div>`);
      m.setFoot(`<button type="button" class="ui-btn-ghost" onclick="fmClose('dwForm')">Abbrechen</button>
        <button type="button" class="ui-btn-primary" onclick="dwSaveArea()">💾 Speichern</button>`);
    }

    function dwPhotoBoxHtml() {
      return dw.photo ? `<img class="dw-formphoto" src="${escapeHtml(dw.photo)}" alt=""> <button type="button" class="fm-btn fm-btn-danger" onclick="dw.photo=''; document.getElementById('dwfPhotoBox').innerHTML=dwPhotoBoxHtml()">Foto entfernen</button>` : '';
    }

    async function dwPhotoPicked(input) {
      const f = input.files && input.files[0];
      if (!f) return;
      const st = document.getElementById('dwfPhotoStatus');
      st.textContent = '⏳ Foto wird hochgeladen ...';
      try { dw.photo = await fmUploadPhoto(f, 'abwasher'); st.textContent = '✔ Foto hochgeladen'; document.getElementById('dwfPhotoBox').innerHTML = dwPhotoBoxHtml(); }
      catch (e) { st.textContent = 'Fehler: ' + (e.message || e); }
    }

    async function dwSaveArea() {
      const name = document.getElementById('dwfName').value.trim();
      if (!name) return fmToast('Bitte einen Namen eingeben.');
      const payload = {
        name, description: document.getElementById('dwfDesc').value.trim(), frequency: document.getElementById('dwfFreq').value,
        photo_url: dw.photo || '', active: document.getElementById('dwfActive').checked
      };
      const res = dw.edit && dw.edit.id
        ? await _supabase.from('wash_areas').update(payload).eq('id', dw.edit.id)
        : await _supabase.from('wash_areas').insert([Object.assign(payload, { sort_order: dw.areas.length + 1 })]);
      if (res.error) return fmToast(dwErr(res.error));
      fmClose('dwForm');
      fmToast('Gespeichert');
      await dwLoad();
    }

    async function dwDeleteArea(id) {
      const a = dw.areas.find(x => x.id === id);
      if (!a || !confirm('„' + a.name + '“ löschen? Bisherige Einträge bleiben in der Übersicht erhalten. Tipp: „Aktiv“ abwählen blendet den Ort nur aus.')) return;
      const { error } = await _supabase.from('wash_areas').delete().eq('id', id);
      if (error) return fmToast(dwErr(error));
      await dwLoad();
    }

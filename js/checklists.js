/* ============================================================
   js/checklists.js  (v3.2.03)
   Checklisten & Standards: Öffnung / Laufend / Schließung für Bar, Service, Terrasse.
   - Eine gemeinsame Liste pro Betriebstag. Wer abhakt, steht mit Name + Uhrzeit dabei.
   - Manager/Developer verwalten die Aufgaben selbst (Bereich ⚙ Aufgaben).
   Tabellen: checklist_tasks, checklist_done (siehe sql/3.2.03_betrieb.sql)
   ============================================================ */

    const CL_AREAS = { bar: '🍸 Bar', service: '🍽️ Service', terrasse: '🌿 Terrasse' };
    const CL_PHASES = { opening: '🌅 Öffnung', ongoing: '🔄 Laufend', closing: '🌙 Schließung' };
    const CL_PHASE_ORDER = ['opening', 'ongoing', 'closing'];

    // Beispielaufgaben, die der Manager mit einem Klick einfügen kann (danach frei änderbar)
    const CL_SAMPLE_TASKS = [
      ['bar', 'opening', 'Eis auffüllen'],
      ['bar', 'opening', 'Kühlschränke und Vorräte kontrollieren'],
      ['bar', 'opening', 'Kaffeemaschine einschalten und spülen'],
      ['bar', 'opening', 'Garnituren vorbereiten (Zitrone, Limette, Minze)'],
      ['bar', 'ongoing', 'Bar abwischen und Gläser nachpolieren'],
      ['bar', 'closing', 'Kaffeemaschine reinigen'],
      ['bar', 'closing', 'Kassa zählen und Abrechnung machen'],
      ['bar', 'closing', 'Flaschen auffüllen und Bar putzen'],
      ['service', 'opening', 'Tische eindecken, Servietten und Speisekarten auflegen'],
      ['service', 'ongoing', 'Servietten nachfüllen'],
      ['service', 'closing', 'Tische abwischen, Stühle ordnen'],
      ['terrasse', 'opening', 'Terrasse aufsperren und Möbel aufstellen'],
      ['terrasse', 'ongoing', 'Terrasse laufend aufräumen'],
      ['terrasse', 'closing', 'Terrasse einräumen und absperren']
    ];

    let cl = { m: null, date: '', tasks: [], done: {}, area: 'all', manage: false };

    async function openChecklistModal() {
      closeSettingsMenu();
      cl.date = fmBizDate();
      cl.area = 'all';
      cl.manage = false;
      cl.m = fmOpen('clModal', { title: '✅ Checklisten', sub: 'Gemeinsame Aufgaben des Tages. Wer abhakt, steht mit Uhrzeit dabei.' });
      cl.m.setBody('<p class="staff-empty">Lade ...</p>');
      await clGuessArea();
      await clLoad();
    }

    // Standard-Bereich aus der heutigen Schicht (Station) ableiten
    async function clGuessArea() {
      try {
        const p = cl.date.split('-').map(Number);
        const { data } = await _supabase.from('work_schedules').select('station, employee_name')
          .eq('year', p[0]).eq('month', p[1]).eq('day', p[2]).ilike('employee_name', '%' + currentWaiterName + '%');
        const s = String(((data || [])[0] || {}).station || '').toLowerCase();
        if (/terr/.test(s)) cl.area = 'terrasse';
        else if (/bar/.test(s)) cl.area = 'bar';
        else if (/serv|saal|kell/.test(s)) cl.area = 'service';
      } catch (e) {}
    }

    async function clLoad() {
      const tq = _supabase.from('checklist_tasks').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: true });
      const [t, d] = await Promise.all([
        userIsAdmin && cl.manage ? tq : tq.eq('active', true),
        _supabase.from('checklist_done').select('*').eq('work_date', cl.date)
      ]);
      if (t.error) { cl.m.setBody(fmErrorHtml(t.error)); return; }
      if (d.error) { cl.m.setBody(fmErrorHtml(d.error)); return; }
      cl.tasks = t.data || [];
      cl.done = {};
      (d.data || []).forEach(r => { cl.done[r.task_id] = r; });
      clRender();
    }

    function clRender() {
      if (!cl.m) return;
      if (cl.manage) { clRenderManage(); return; }

      const areaTabs = ['all'].concat(Object.keys(CL_AREAS)).map(a =>
        `<button type="button" class="fm-tab${cl.area === a ? ' active' : ''}" onclick="clSetArea('${a}')">${a === 'all' ? 'Alle' : CL_AREAS[a]}</button>`).join('');
      const dateCtl = userIsAdmin
        ? `<input type="date" class="ui-field" style="width:auto" value="${cl.date}" onchange="clSetDate(this.value)">`
        : `<span class="fm-hint">${escapeHtml(fmDayLabel(cl.date))}</span>`;
      cl.m.setToolbar(`
        <div class="fm-row-flex" style="justify-content:space-between">
          <div class="fm-tabs">${areaTabs}</div>
          ${dateCtl}
        </div>`);

      const visible = cl.tasks.filter(t => cl.area === 'all' || t.area === cl.area);
      const doneCount = visible.filter(t => cl.done[t.id]).length;
      const pct = visible.length ? Math.round(doneCount / visible.length * 100) : 0;

      let html = `
        <div class="fm-row-flex" style="justify-content:space-between;margin-bottom:.4rem">
          <b style="font-size:.8rem;color:var(--ui-text)">${doneCount} von ${visible.length} erledigt</b>
          ${userIsAdmin ? '<button type="button" class="fm-btn" onclick="clToggleManage(true)">⚙️ Aufgaben verwalten</button>' : ''}
        </div>
        <div class="fm-progress" style="margin-bottom:1rem"><i style="width:${pct}%"></i></div>`;

      if (!cl.tasks.length) {
        html += `<p class="staff-empty">Noch keine Aufgaben angelegt.${userIsAdmin ? '' : ' Der Manager legt sie an.'}</p>`;
      } else if (!visible.length) {
        html += `<p class="staff-empty">Für diesen Bereich gibt es keine Aufgaben.</p>`;
      }

      CL_PHASE_ORDER.forEach(ph => {
        const list = visible.filter(t => t.phase === ph);
        if (!list.length) return;
        const dn = list.filter(t => cl.done[t.id]).length;
        html += `<div class="fm-sec-title"><span>${CL_PHASES[ph]}</span><span>${dn}/${list.length}</span></div>`;
        html += list.map(t => {
          const dr = cl.done[t.id];
          const meta = dr
            ? `✓ ${escapeHtml(dr.done_by)} · ${escapeHtml(fmTime(dr.done_at))}`
            : (cl.area === 'all' ? escapeHtml(CL_AREAS[t.area]) : '');
          return `<button type="button" class="cl-row${dr ? ' done' : ''}" onclick="clToggle(${jsArg(t.id)})">
            <span class="cl-box">✓</span>
            <span class="fm-grow"><span class="cl-title">${escapeHtml(t.title)}</span>${meta ? `<span class="cl-meta" style="display:block">${meta}</span>` : ''}</span>
          </button>`;
        }).join('');
      });

      cl.m.setBody(html);
      cl.m.setFoot('<button type="button" class="ui-btn-primary" onclick="fmClose(\'clModal\')">Fertig</button>');
    }

    function clSetArea(a) { cl.area = a; clRender(); }
    async function clSetDate(v) { if (v) { cl.date = v; await clLoad(); } }

    async function clToggle(taskId) {
      const dr = cl.done[taskId];
      if (dr) {
        if (!userIsAdmin && String(dr.done_by).toLowerCase() !== String(currentWaiterName).toLowerCase()) {
          return fmToast(fmL('Nur ' + dr.done_by + ' oder ein Manager kann das zurücknehmen.', 'Only ' + dr.done_by + ' or a manager can undo this.'));
        }
        const { error } = await _supabase.from('checklist_done').delete().eq('id', dr.id);
        if (error) return fmToast(fmDbError(error));
      } else {
        const { error } = await _supabase.from('checklist_done').insert([{ task_id: taskId, work_date: cl.date, done_by: currentWaiterName }]);
        if (error) {
          if (error.code === '23505') fmToast('Wurde gerade schon von jemand anderem erledigt.');
          else return fmToast(fmDbError(error));
        }
      }
      await clLoad();
    }

    // ---------- Verwaltung (Manager/Developer) ----------
    function clToggleManage(on) {
      if (!userIsAdmin) return;
      cl.manage = !!on;
      cl.m.setToolbar('');
      cl.m.setBody('<p class="staff-empty">Lade ...</p>');
      clLoad();
    }

    function clRenderManage() {
      cl.m.setToolbar(`
        <div class="fm-row-flex" style="justify-content:space-between">
          <button type="button" class="fm-btn" onclick="clToggleManage(false)">← Zurück zur Checkliste</button>
          <button type="button" class="ui-btn-primary" onclick="clOpenEdit()">➕ Neue Aufgabe</button>
        </div>`);
      let html = '';
      if (!cl.tasks.length) {
        html += `<p class="staff-empty">Noch keine Aufgaben. Lege eigene an oder füge Beispielaufgaben ein.</p>
          <div style="text-align:center"><button type="button" class="ui-btn-ghost" onclick="clInsertSamples()">📋 Beispielaufgaben einfügen</button></div>`;
      }
      Object.keys(CL_AREAS).forEach(area => {
        const inArea = cl.tasks.filter(t => t.area === area);
        if (!inArea.length) return;
        html += `<div class="fm-sec-title"><span>${CL_AREAS[area]}</span><span>${inArea.length}</span></div>`;
        CL_PHASE_ORDER.forEach(ph => {
          const list = inArea.filter(t => t.phase === ph);
          if (!list.length) return;
          html += `<p class="fm-hint" style="margin:.5rem 0 .25rem">${CL_PHASES[ph]}</p>`;
          html += list.map((t, i) => `
            <div class="fm-item" style="${t.active ? '' : 'opacity:.55'}">
              <div class="fm-item-main">
                <div class="fm-item-title">${escapeHtml(t.title)}</div>
                ${t.active ? '' : '<div class="fm-item-sub">Deaktiviert (wird nicht angezeigt)</div>'}
              </div>
              <div class="fm-row-flex" style="gap:.25rem;flex-shrink:0">
                <button type="button" class="fm-btn" ${i === 0 ? 'disabled style="opacity:.3"' : ''} onclick="clMove(${jsArg(t.id)}, -1)" title="Nach oben">↑</button>
                <button type="button" class="fm-btn" ${i === list.length - 1 ? 'disabled style="opacity:.3"' : ''} onclick="clMove(${jsArg(t.id)}, 1)" title="Nach unten">↓</button>
                <button type="button" class="fm-btn" onclick="clOpenEdit(${jsArg(t.id)})" title="Bearbeiten">✎</button>
                <button type="button" class="fm-btn" onclick="clSetActive(${jsArg(t.id)}, ${!t.active})" title="${t.active ? 'Deaktivieren' : 'Aktivieren'}">${t.active ? '⏸' : '▶'}</button>
                <button type="button" class="fm-btn fm-btn-danger" onclick="clDelete(${jsArg(t.id)})" title="Löschen">🗑</button>
              </div>
            </div>`).join('');
        });
      });
      cl.m.setBody(html);
      cl.m.setFoot('<button type="button" class="ui-btn-primary" onclick="fmClose(\'clModal\')">Fertig</button>');
    }

    async function clMove(id, dir) {
      const t = cl.tasks.find(x => x.id === id);
      if (!t) return;
      const group = cl.tasks.filter(x => x.area === t.area && x.phase === t.phase);
      const i = group.findIndex(x => x.id === id);
      const o = group[i + dir];
      if (!o) return;
      // Reihenfolge neu durchnummerieren, damit nichts doppelt ist
      const order = group.slice();
      order.splice(i, 1);
      order.splice(i + dir, 0, t);
      const base = Math.min.apply(null, group.map(x => x.sort_order));
      const updates = order.map((x, idx) => _supabase.from('checklist_tasks').update({ sort_order: base + idx }).eq('id', x.id));
      const res = await Promise.all(updates);
      const bad = res.find(r => r.error);
      if (bad) return fmToast(fmDbError(bad.error));
      await clLoad();
    }

    async function clSetActive(id, active) {
      const { error } = await _supabase.from('checklist_tasks').update({ active }).eq('id', id);
      if (error) return fmToast(fmDbError(error));
      await clLoad();
    }

    async function clDelete(id) {
      const t = cl.tasks.find(x => x.id === id);
      if (!t) return;
      if (!confirm(fmL(`Aufgabe „${t.title}“ endgültig löschen?\nDie erledigten Einträge dazu in der Historie werden auch gelöscht.\n(Tipp: Mit ⏸ kannst du sie nur ausblenden.)`, `Delete task “${t.title}” permanently?\nIts ticked entries in the history are deleted too.\n(Tip: with ⏸ you can just hide it.)`))) return;
      const { error } = await _supabase.from('checklist_tasks').delete().eq('id', id);
      if (error) return fmToast(fmDbError(error));
      await clLoad();
    }

    async function clInsertSamples() {
      let n = 0;
      const rows = CL_SAMPLE_TASKS.map(s => ({ area: s[0], phase: s[1], title: s[2], sort_order: n++, created_by: currentWaiterName }));
      const { error } = await _supabase.from('checklist_tasks').insert(rows);
      if (error) return fmToast(fmDbError(error));
      fmToast('Beispielaufgaben eingefügt. Du kannst sie jetzt ändern.');
      await clLoad();
    }

    function clOpenEdit(id) {
      const t = id ? cl.tasks.find(x => x.id === id) : null;
      const m = fmOpen('clEdit', { title: t ? 'Aufgabe bearbeiten' : 'Neue Aufgabe', layer: 2 });
      const opt = (obj, cur) => Object.keys(obj).map(k => `<option value="${k}"${k === cur ? ' selected' : ''}>${escapeHtml(obj[k])}</option>`).join('');
      m.setBody(`
        <div class="fm-stack">
          <div class="fm-field"><label class="form-label" for="clEdTitle">Aufgabe</label>
            <input type="text" id="clEdTitle" class="ui-field" maxlength="120" placeholder="z. B. Eis auffüllen" value="${escapeHtml(t ? t.title : '')}"></div>
          <div class="fm-grid2">
            <div class="fm-field"><label class="form-label" for="clEdArea">Bereich</label>
              <select id="clEdArea" class="ui-field">${opt(CL_AREAS, t ? t.area : (cl.area !== 'all' ? cl.area : 'bar'))}</select></div>
            <div class="fm-field"><label class="form-label" for="clEdPhase">Zeitpunkt</label>
              <select id="clEdPhase" class="ui-field">${opt(CL_PHASES, t ? t.phase : 'opening')}</select></div>
          </div>
        </div>`);
      m.setFoot(`<button type="button" class="ui-btn-ghost" onclick="fmClose('clEdit')">Abbrechen</button>
        <button type="button" class="ui-btn-primary" onclick="clSaveEdit(${jsArg(id || '')})">💾 Speichern</button>`);
      setTimeout(() => { const el = document.getElementById('clEdTitle'); if (el) el.focus(); }, 50);
    }

    async function clSaveEdit(id) {
      const title = document.getElementById('clEdTitle').value.trim();
      if (!title) return fmToast('Bitte eine Aufgabe eingeben.');
      const payload = { title, area: document.getElementById('clEdArea').value, phase: document.getElementById('clEdPhase').value };
      let res;
      if (id) {
        res = await _supabase.from('checklist_tasks').update(payload).eq('id', id);
      } else {
        const max = cl.tasks.reduce((a, x) => Math.max(a, x.sort_order || 0), 0);
        res = await _supabase.from('checklist_tasks').insert([Object.assign({ sort_order: max + 1, created_by: currentWaiterName }, payload)]);
      }
      if (res.error) return fmToast(fmDbError(res.error));
      fmClose('clEdit');
      await clLoad();
    }

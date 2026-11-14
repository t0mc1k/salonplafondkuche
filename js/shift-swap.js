/* ============================================================
   js/shift-swap.js  (v3.2.03)
   1) Mein Plan: eigener Monatskalender mit „Tausch“-Knopf (Pausen werden nicht mehr erfasst)
   2) Schichttausch: direkte Anfrage an einen Kollegen ODER Börse für alle.
      In beiden Fällen entscheidet am Ende der Manager; erst dann wird der
      Arbeitsplan umgeschrieben (SQL-Funktion decide_shift_swap).
   Tabelle: shift_swaps
   Nutzt Hilfsfunktionen aus team-plan.js (tpHasShift, tpCellMinutes, ...).
   ============================================================ */

    const SS_STATUS = {
      open: ['Wartet auf Antwort', 'amber'],
      awaiting_manager: ['Wartet auf Manager', 'blue'],
      approved: ['Genehmigt', 'green'],
      rejected: ['Vom Manager abgelehnt', 'red'],
      declined: ['Vom Kollegen abgelehnt', 'red'],
      cancelled: ['Zurückgezogen', 'gray']
    };

    // ---------------------------------------------------------------
    // MEIN PLAN
    // ---------------------------------------------------------------
    let mp = { m: null, year: 0, month: 0, rows: [], swaps: {} };

    function mpIso(day) {
      return mp.year + '-' + String(mp.month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
    }

    function openMyPlanModal() {
      closeSettingsMenu();
      const now = new Date();
      mp.year = now.getFullYear();
      mp.month = now.getMonth() + 1;
      mp.m = fmOpen('mpModal', { title: '🗓️ Mein Arbeitsplan', sub: 'Deine Schichten und Tausch-Anfragen.' });
      mpLoad();
    }

    function mpShiftMonth(delta) {
      mp.month += delta;
      if (mp.month < 1) { mp.month = 12; mp.year--; }
      if (mp.month > 12) { mp.month = 1; mp.year++; }
      mpLoad();
    }

    async function mpLoad() {
      mp.m.setBody('<p class="staff-empty">Lade ...</p>');
      const first = mpIso(1);
      const last = mpIso(new Date(mp.year, mp.month, 0).getDate());
      const [sch, sw] = await Promise.all([
        _supabase.from('work_schedules').select('*').eq('year', mp.year).eq('month', mp.month).ilike('employee_name', '%' + currentWaiterName + '%').order('day', { ascending: true }),
        _supabase.from('shift_swaps').select('*').gte('work_date', first).lte('work_date', last).order('created_at', { ascending: false })
      ]);
      if (sch.error) { mp.m.setBody(fmErrorHtml(sch.error)); return; }
      mp.rows = (sch.data || []).filter(r => fmIsMe(r.employee_name));
      // shift_swaps kann vor dem SQL fehlen: dann einfach ohne Tausch anzeigen
      mp.swaps = {};
      if (!sw.error) (sw.data || []).forEach(s => {
        if (String(s.requester).toLowerCase() !== String(currentWaiterName).toLowerCase()) return;
        if (s.status === 'cancelled') return;
        if (!mp.swaps[s.work_date]) mp.swaps[s.work_date] = s;
      });
      mp.noSql = !!sw.error;
      mpRender();
    }

    function mpShiftText(r) {
      const code = tpSpecialCode(r);
      if (code) return (code === 'X' || code === 'OFF') ? 'Frei' : (code === 'U' ? 'Urlaub' : (code === 'K' ? 'Krank' : (code === 'ZA' ? 'Zeitausgleich' : (code === 'S' ? 'Schule' : code))));
      let t = tpTimeInput(r.shift_1_start) + '–' + tpTimeInput(r.shift_1_end);
      if (tpToMinutes(r.shift_2_start) !== null && tpToMinutes(r.shift_2_end) !== null) t += ' · ' + tpTimeInput(r.shift_2_start) + '–' + tpTimeInput(r.shift_2_end);
      return t;
    }

    function mpRender() {
      const todayIso = fmIso(new Date());
      let planned = 0, count = 0;
      const items = mp.rows.map(r => {
        const iso = mpIso(r.day);
        const work = tpHasShift(r);
        const mins = work ? tpCellMinutes(r) : 0;
        if (work) { planned += mins; count++; }
        return { r, iso, work, mins };
      });

      mp.m.setToolbar(`
        <div class="fm-row-flex" style="justify-content:space-between">
          <div class="tp-monthnav">
            <button type="button" onclick="mpShiftMonth(-1)" class="ui-btn-ghost" aria-label="Vorheriger Monat">‹</button>
            <b class="tp-month-label">${FM_MONTHS[mp.month - 1]} ${mp.year}</b>
            <button type="button" onclick="mpShiftMonth(1)" class="ui-btn-ghost" aria-label="Nächster Monat">›</button>
          </div>
          <div class="tp-summary"><span><b>${count}</b> Schichten</span><span><b>${tpFormatHours(planned)}</b> Std.</span></div>
        </div>`);

      let html = '';
      if (mp.noSql) html += `<p class="fm-hint" style="margin-bottom:.6rem">Hinweis: Der Schichttausch ist erst verfügbar, wenn die Datenbank dafür eingerichtet ist.</p>`;
      if (!items.length) {
        html += `<p class="staff-empty">Für diesen Monat sind keine Schichten für dich eingetragen.</p>`;
      }
      html += items.map(it => {
        const d = fmParseIso(it.iso);
        const swap = mp.swaps[it.iso];
        const past = it.iso < todayIso;
        const cls = 'mp-day' + (it.iso === todayIso ? ' today' : '') + (past ? ' past' : '');
        let right = '';
        if (it.work) {
          if (swap) {
            const st = SS_STATUS[swap.status] || [swap.status, 'gray'];
            right += `<div style="margin-top:.4rem">${fmStatusChip('Tausch: ' + st[0], st[1])}${swap.taker_name ? ` <span class="fm-hint">→ ${escapeHtml(swap.taker_name)}</span>` : (swap.target_name ? ` <span class="fm-hint">→ ${escapeHtml(swap.target_name)}</span>` : ' <span class="fm-hint">Börse</span>')}</div>`;
          } else if (!past) {
            right += `<div style="margin-top:.4rem"><button type="button" class="fm-btn" onclick="ssOpenNew(${jsArg(it.iso)})">🔄 Tausch anfragen</button></div>`;
          }
        }
        return `<div class="${cls}">
          <div class="mp-date">${FM_DAYS[d.getDay()]}<b>${d.getDate()}</b></div>
          <div class="fm-grow">
            <div class="mp-time">${escapeHtml(mpShiftText(it.r))}${it.work ? ` <span class="fm-hint">· ${tpFormatHours(it.mins)} Std.</span>` : ''}</div>
            ${it.r.station ? `<div class="fm-item-sub">${escapeHtml(it.r.station)}</div>` : ''}
            ${right}
          </div>
        </div>`;
      }).join('');

      mp.m.setBody(html);
      mp.m.setFoot(`<button type="button" class="ui-btn-ghost" onclick="openSwapModal()">🔄 Schichttausch-Zentrale</button>
        <button type="button" class="ui-btn-primary" onclick="fmClose('mpModal')">Fertig</button>`);
    }

    // ---------------------------------------------------------------
    // TAUSCH ANFRAGEN (Formular)
    // ---------------------------------------------------------------
    async function ssOpenNew(iso) {
      const row = mp.rows.find(r => mpIso(r.day) === iso);
      if (!row) return;
      const m = fmOpen('ssNew', { title: '🔄 Schicht tauschen', sub: fmDayLabel(iso) + ' · ' + mpShiftText(row), layer: 2 });
      m.setBody('<p class="staff-empty">Prüfe, wer an diesem Tag frei ist ...</p>');

      // Wer hat an dem Tag keine Schicht?
      const p = iso.split('-').map(Number);
      const { data } = await _supabase.from('work_schedules').select('employee_name, shift_1_start, shift_1_end, shift_2_start, shift_2_end')
        .eq('year', p[0]).eq('month', p[1]).eq('day', p[2]);
      const busy = (data || []).filter(r => tpHasShift(r)).map(r => String(r.employee_name).trim().toLowerCase());
      const isBusy = n => { const l = n.toLowerCase(); return busy.some(b => b === l || b.indexOf(l) !== -1); };
      const free = (staffDatabaseRecords || []).map(s => s.name)
        .filter(n => n && n.toLowerCase() !== String(currentWaiterName).toLowerCase() && !isBusy(n))
        .sort((a, b) => a.localeCompare(b, 'de', { sensitivity: 'base' }));

      m.setBody(`
        <div class="fm-stack">
          <div class="fm-tabs">
            <button type="button" class="fm-tab active" id="ssKindDirect" onclick="ssSetKind('direct')">👤 An einen Kollegen</button>
            <button type="button" class="fm-tab" id="ssKindPool" onclick="ssSetKind('pool')">📢 In die Börse</button>
          </div>
          <input type="hidden" id="ssKind" value="direct">
          <div id="ssDirectBox" class="fm-field">
            <label class="form-label" for="ssTarget">Kollege (hat an dem Tag keine Schicht)</label>
            <select id="ssTarget" class="ui-field">
              <option value="">– bitte wählen –</option>
              ${free.map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('')}
            </select>
          </div>
          <p id="ssPoolHint" class="fm-hint hidden">Alle Kollegen, die an dem Tag frei sind, sehen die Schicht. Wer sie zuerst übernimmt, bekommt sie.</p>
          <div class="fm-field"><label class="form-label" for="ssNote">Nachricht (optional)</label>
            <textarea id="ssNote" class="ui-field" rows="2" maxlength="200" placeholder="z. B. Arzttermin am Nachmittag"></textarea></div>
          <p class="fm-hint">In beiden Fällen muss am Ende der Manager zustimmen. Erst dann ändert sich der Arbeitsplan.</p>
        </div>`);
      m.setFoot(`<button type="button" class="ui-btn-ghost" onclick="fmClose('ssNew')">Abbrechen</button>
        <button type="button" class="ui-btn-primary" onclick="ssSubmitNew(${jsArg(iso)}, ${jsArg(mpShiftText(row))})">Anfrage senden</button>`);
    }

    function ssSetKind(kind) {
      document.getElementById('ssKind').value = kind;
      document.getElementById('ssKindDirect').classList.toggle('active', kind === 'direct');
      document.getElementById('ssKindPool').classList.toggle('active', kind === 'pool');
      document.getElementById('ssDirectBox').classList.toggle('hidden', kind !== 'direct');
      document.getElementById('ssPoolHint').classList.toggle('hidden', kind !== 'pool');
    }

    async function ssSubmitNew(iso, shiftText) {
      const kind = document.getElementById('ssKind').value;
      const target = document.getElementById('ssTarget').value;
      if (kind === 'direct' && !target) return fmToast('Bitte einen Kollegen wählen.');
      const { error } = await _supabase.rpc('create_shift_swap', {
        p_date: iso, p_kind: kind, p_target: kind === 'direct' ? target : null,
        p_note: document.getElementById('ssNote').value.trim(), p_shift_text: shiftText
      });
      if (error) return fmToast(fmDbError(error));
      fmClose('ssNew');
      fmToast(kind === 'direct' ? fmL('Anfrage an ' + target + ' gesendet', 'Request sent to ' + target) : 'Schicht in die Börse gestellt');
      if (mp.m && document.getElementById('mpModal')) await mpLoad();
    }

    // ---------------------------------------------------------------
    // SCHICHTTAUSCH-ZENTRALE
    // ---------------------------------------------------------------
    let ss = { m: null, tab: 'pool', swaps: [] };

    function openSwapModal() {
      closeSettingsMenu();
      ss.m = fmOpen('ssModal', { title: '🔄 Schichttausch', sub: 'Börse, Anfragen an dich und deine eigenen Anfragen.', wide: false });
      ss.tab = userIsAdmin ? 'approve' : 'pool';
      ss.m.setBody('<p class="staff-empty">Lade ...</p>');
      ssLoad(true);
    }

    async function ssLoad(pickTab) {
      const since = fmIso(new Date(Date.now() - 45 * 86400000));
      const { data, error } = await _supabase.from('shift_swaps').select('*').gte('work_date', since).order('work_date', { ascending: true });
      if (error) { ss.m.setBody(fmErrorHtml(error)); return; }
      ss.swaps = data || [];
      if (pickTab) {
        const c = ssCounts();
        if (userIsAdmin) ss.tab = c.approve > 0 ? 'approve' : (c.incoming > 0 ? 'incoming' : 'pool');
        else ss.tab = c.incoming > 0 ? 'incoming' : 'pool';
      }
      ssRender();
    }

    const ssMe = () => String(currentWaiterName).toLowerCase();
    const ssIsFuture = s => s.work_date >= fmIso(new Date(Date.now() - 86400000));

    function ssLists() {
      const me = ssMe();
      return {
        approve: ss.swaps.filter(s => s.status === 'awaiting_manager'),
        pool: ss.swaps.filter(s => s.kind === 'pool' && s.status === 'open' && String(s.requester).toLowerCase() !== me && ssIsFuture(s)),
        incoming: ss.swaps.filter(s => s.kind === 'direct' && s.status === 'open' && String(s.target_name || '').toLowerCase() === me && ssIsFuture(s)),
        mine: ss.swaps.filter(s => String(s.requester).toLowerCase() === me || String(s.taker_name || '').toLowerCase() === me)
          .sort((a, b) => b.work_date.localeCompare(a.work_date)),
        history: ss.swaps.filter(s => ['approved', 'rejected', 'declined', 'cancelled'].indexOf(s.status) !== -1)
          .sort((a, b) => b.work_date.localeCompare(a.work_date))
      };
    }
    function ssCounts() {
      const l = ssLists();
      return { approve: l.approve.length, pool: l.pool.length, incoming: l.incoming.length, mine: l.mine.filter(s => s.status === 'open' || s.status === 'awaiting_manager').length };
    }

    function ssSetTab(t) { ss.tab = t; ssRender(); }

    function ssRender() {
      const c = ssCounts();
      const tabs = [];
      if (userIsAdmin) tabs.push(['approve', '✅ Genehmigen', c.approve]);
      tabs.push(['pool', '📢 Börse', c.pool], ['incoming', '📩 Für mich', c.incoming], ['mine', '👤 Meine', c.mine]);
      if (userIsAdmin) tabs.push(['history', '📜 Verlauf', 0]);
      ss.m.setToolbar(`<div class="fm-tabs">${tabs.map(t =>
        `<button type="button" class="fm-tab${ss.tab === t[0] ? ' active' : ''}" onclick="ssSetTab('${t[0]}')">${t[1]}${t[2] ? `<small>${t[2]}</small>` : ''}</button>`).join('')}</div>`);

      const list = ssLists()[ss.tab] || [];
      let html = '';
      if (!list.length) {
        html = `<p class="staff-empty">${({
          approve: 'Keine Anfragen, die auf deine Entscheidung warten.',
          pool: 'Zurzeit bietet niemand eine Schicht an.',
          incoming: 'Keine Anfragen an dich.',
          mine: 'Du hast noch keine Tausch-Anfragen.',
          history: 'Noch kein Verlauf.'
        })[ss.tab]}</p>`;
      }
      if (ss.tab === 'history' && userIsAdmin && list.length) {
        html = `<div class="fm-row-flex" style="justify-content:space-between;margin-bottom:.6rem">
          <span class="fm-hint">${list.length} Einträge im Verlauf</span>
          <button type="button" class="fm-btn fm-btn-danger" onclick="ssClearHistory()">🗑 Gesamten Verlauf löschen</button></div>` + html;
      }
      html += list.map(s => ssCardHtml(s)).join('');
      ss.m.setBody(html);
      ss.m.setFoot('<button type="button" class="ui-btn-primary" onclick="fmClose(\'ssModal\')">Fertig</button>');
    }

    function ssCardHtml(s) {
      const st = SS_STATUS[s.status] || [s.status, 'gray'];
      const me = ssMe();
      const isReq = String(s.requester).toLowerCase() === me;
      let line;
      if (s.kind === 'pool') line = `${escapeHtml(s.requester)} bietet die Schicht in der Börse an`;
      else line = `${escapeHtml(s.requester)} → ${escapeHtml(s.target_name || '?')}`;
      if (s.taker_name) line += ` · übernimmt: <b>${escapeHtml(s.taker_name)}</b>`;

      let actions = '';
      if (ss.tab === 'pool' && s.status === 'open') {
        actions += `<button type="button" class="fm-btn fm-btn-ok" onclick="ssTake(${jsArg(s.id)})">Übernehmen</button>`;
      }
      if (ss.tab === 'incoming' && s.status === 'open') {
        actions += `<button type="button" class="fm-btn fm-btn-ok" onclick="ssTake(${jsArg(s.id)})">Annehmen</button>
                    <button type="button" class="fm-btn fm-btn-danger" onclick="ssDecline(${jsArg(s.id)})">Ablehnen</button>`;
      }
      if (ss.tab === 'approve' && s.status === 'awaiting_manager') {
        actions += `<button type="button" class="fm-btn fm-btn-ok" onclick="ssDecide(${jsArg(s.id)}, true)">✓ Genehmigen</button>
                    <button type="button" class="fm-btn fm-btn-danger" onclick="ssDecide(${jsArg(s.id)}, false)">✗ Ablehnen</button>`;
      }
      if ((isReq || userIsAdmin) && (s.status === 'open' || s.status === 'awaiting_manager') && ss.tab !== 'approve') {
        actions += `<button type="button" class="fm-btn" onclick="ssCancel(${jsArg(s.id)})">Zurückziehen</button>`;
      }
      if (userIsAdmin && ss.tab === 'history') {
        actions += `<button type="button" class="fm-btn fm-btn-danger" onclick="ssDeleteOne(${jsArg(s.id)})">🗑 Löschen</button>`;
      }
      return `<div class="fm-item" style="flex-direction:column;align-items:stretch">
        <div class="fm-row-flex" style="justify-content:space-between">
          <div class="fm-item-title">${escapeHtml(fmDayLabel(s.work_date))} · ${escapeHtml(s.shift_text || '')}</div>
          ${fmStatusChip(st[0], st[1])}
        </div>
        <div class="fm-item-sub">${line}</div>
        ${s.note ? `<div class="fm-item-sub">💬 ${escapeHtml(s.note)}</div>` : ''}
        ${s.manager_note ? `<div class="fm-item-sub">📝 Manager: ${escapeHtml(s.manager_note)}</div>` : ''}
        ${actions ? `<div class="fm-item-actions">${actions}</div>` : ''}
      </div>`;
    }

    async function ssRpc(name, args, okMsg) {
      const { error } = await _supabase.rpc(name, args);
      if (error) { fmToast(fmDbError(error)); }
      else if (okMsg) fmToast(okMsg);
      await ssLoad(false);
      if (typeof loadDashboardCounts === 'function') loadDashboardCounts(true);
    }

    function ssTake(id) { return ssRpc('take_shift_swap', { p_id: id }, 'Erledigt. Jetzt entscheidet der Manager.'); }
    function ssDecline(id) { if (confirm('Anfrage ablehnen?')) return ssRpc('decline_shift_swap', { p_id: id }, 'Anfrage abgelehnt'); }
    function ssCancel(id) { if (confirm('Anfrage zurückziehen?')) return ssRpc('cancel_shift_swap', { p_id: id }, 'Zurückgezogen'); }
    function ssDecide(id, approve) {
      const note = prompt(approve ? 'Nachricht an die Beteiligten (optional):' : 'Grund für die Ablehnung (optional):', '');
      if (note === null) return;
      return ssRpc('decide_shift_swap', { p_id: id, p_approve: approve, p_note: note }, approve ? 'Genehmigt: Arbeitsplan wurde geändert' : 'Abgelehnt');
    }


    // Verlauf aufräumen (nur Manager/Developer; DB-Regel in sql/4.0.00.sql)
    async function ssDeleteOne(id) {
      if (!userIsAdmin) return;
      if (!confirm('Diesen Eintrag aus dem Verlauf löschen?')) return;
      const { error } = await _supabase.from('shift_swaps').delete().eq('id', id);
      if (error) return fmToast(fmDbError(error));
      await ssLoad(false);
    }

    async function ssClearHistory() {
      if (!userIsAdmin) return;
      if (!confirm('Den gesamten Verlauf löschen?\n(Genehmigte, abgelehnte und zurückgezogene Anfragen. Offene Anfragen bleiben erhalten.)')) return;
      const { error } = await _supabase.from('shift_swaps').delete().in('status', ['approved', 'rejected', 'declined', 'cancelled']);
      if (error) return fmToast(fmDbError(error));
      fmToast('Verlauf gelöscht');
      await ssLoad(false);
    }

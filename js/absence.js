/* ============================================================
   js/absence.js  (v4.1.05)
   Urlaub beantragen & Krankmeldung

   - Kellner/Barkeeper: Urlaub beantragen (von–bis), sich krank melden, eigene Meldungen sehen/zurückziehen.
   - Manager/Developer: Urlaub genehmigen oder ablehnen, Krankmeldungen zur Kenntnis nehmen und
     Urlaub (U) bzw. Krank (K) mit einem Klick in den Arbeitsplan eintragen.
   - Benachrichtigungen (Push) kommen aus der Datenbank (Trigger push_on_absence).
   Tabelle: absence_requests, Funktionen: create_absence_request, cancel_absence_request,
   decide_absence_request, absence_set_applied (siehe sql/4.1.05_absences.sql).
   Texte: zweisprachig mit fmL('Deutsch', 'English').
   ============================================================ */

    let ab = { m: null, tab: 'vac', rows: [] };

    const AB_STATUS = {
      pending:   { vacation: ['Wartet auf Entscheidung', 'Waiting for decision', 'amber'], sick: ['Wartet auf Kenntnisnahme', 'Waiting to be acknowledged', 'amber'] },
      approved:  { vacation: ['Genehmigt', 'Approved', 'green'] },
      rejected:  { vacation: ['Abgelehnt', 'Rejected', 'red'] },
      noted:     { sick: ['Zur Kenntnis genommen', 'Acknowledged', 'green'] },
      cancelled: { vacation: ['Zurückgezogen', 'Withdrawn', 'gray'], sick: ['Zurückgezogen', 'Withdrawn', 'gray'] }
    };

    function abStatusChip(r) {
      const st = (AB_STATUS[r.status] || {})[r.kind] || [r.status, r.status, 'gray'];
      return fmStatusChip(fmL(st[0], st[1]), st[2]);
    }

    function abKindLabel(kind) {
      return kind === 'sick' ? '🤒 ' + fmL('Krank', 'Sick') : '🏖️ ' + fmL('Urlaub', 'Vacation');
    }

    function abFmt(iso) {
      return fmParseIso(iso).toLocaleDateString(langLocale(), { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    function abDays(from, to) {
      const out = [];
      const d = fmParseIso(from), end = fmParseIso(to);
      while (d <= end && out.length < 400) { out.push(fmIso(d)); d.setDate(d.getDate() + 1); }
      return out;
    }

    function abRangeText(r) {
      const n = abDays(r.date_from, r.date_to).length;
      const range = r.date_from === r.date_to ? abFmt(r.date_from) : abFmt(r.date_from) + ' – ' + abFmt(r.date_to);
      return range + ' · ' + (n === 1 ? fmL('1 Tag', '1 day') : fmL(n + ' Tage', n + ' days'));
    }

    function abErrorHtml(err) {
      const msg = (err && err.message) ? String(err.message) : String(err || '');
      const code = (err && err.code) ? String(err.code) : '';
      if (/does not exist|schema cache|could not find the (function|table)/i.test(msg) || code === '42P01' || code === '42883' || /^PGRST20/.test(code)) {
        return `<p class="staff-empty" style="color:#ef4444">${escapeHtml(fmL(
          'Die Datenbank ist für diese Funktion noch nicht eingerichtet. Bitte zuerst sql/4.1.05_absences.sql im Supabase SQL Editor ausführen.',
          'The database is not set up for this feature yet. Please run sql/4.1.05_absences.sql in the Supabase SQL editor first.'))}</p>`;
      }
      return fmErrorHtml(err);
    }

    function abToastError(err) {
      const msg = (err && err.message) ? String(err.message) : String(err || '');
      if (/does not exist|schema cache|could not find the (function|table)/i.test(msg)) {
        return fmToast(fmL('Bitte zuerst sql/4.1.05_absences.sql ausführen.', 'Please run sql/4.1.05_absences.sql first.'));
      }
      fmToast(fmDbError(err));
    }

    // ---------------------------------------------------------------
    // Fenster
    // ---------------------------------------------------------------
    function openAbsenceModal() {
      closeSettingsMenu();
      ab.m = fmOpen('abModal', {
        title: '🏖️ ' + fmL('Urlaub / Krank', 'Vacation / Sick'),
        sub: userIsAdmin
          ? fmL('Anträge und Krankmeldungen deines Teams.', 'Requests and sick reports of your team.')
          : fmL('Urlaub beantragen oder dich krank melden.', 'Request vacation or report sick.')
      });
      ab.tab = userIsAdmin ? 'approve' : 'vac';
      ab.m.setBody('<p class="staff-empty">' + escapeHtml(fmL('Lade ...', 'Loading ...')) + '</p>');
      abLoad();
    }

    async function abLoad() {
      const { data, error } = await _supabase.from('absence_requests').select('*').order('created_at', { ascending: false }).limit(300);
      if (error) { ab.m.setBody(abErrorHtml(error)); return; }
      ab.rows = data || [];
      abRender();
    }

    const abMe = () => String(currentWaiterName || '').toLowerCase();
    const abToday = () => fmIso(new Date());

    function abLists() {
      const me = abMe();
      const since = fmIso(new Date(Date.now() - 30 * 86400000));
      return {
        // Offen = wartet auf Entscheidung, oder entschieden, aber noch nicht im Arbeitsplan
        approve: ab.rows.filter(r => r.status === 'pending'
          || ((r.status === 'approved' || r.status === 'noted') && !r.plan_applied && r.date_to >= since)),
        mine: ab.rows.filter(r => String(r.staff_name).toLowerCase() === me),
        history: ab.rows
      };
    }

    function abPendingCount() {
      return ab.rows.filter(r => r.status === 'pending').length;
    }

    function abSetTab(tab) { ab.tab = tab; abRender(); }

    function abRender() {
      const lists = abLists();
      const tabs = [];
      if (userIsAdmin) tabs.push(['approve', '✅ ' + fmL('Offen', 'Open'), abPendingCount()]);
      tabs.push(['vac', '🏖️ ' + fmL('Urlaub', 'Vacation'), 0], ['sick', '🤒 ' + fmL('Krank melden', 'Report sick'), 0],
        ['mine', '👤 ' + fmL('Meine', 'Mine'), lists.mine.filter(r => r.status === 'pending').length]);
      if (userIsAdmin) tabs.push(['history', '📜 ' + fmL('Alle', 'All'), 0]);
      ab.m.setToolbar(`<div class="fm-tabs">${tabs.map(t =>
        `<button type="button" class="fm-tab${ab.tab === t[0] ? ' active' : ''}" onclick="abSetTab('${t[0]}')">${t[1]}${t[2] ? `<small>${t[2]}</small>` : ''}</button>`).join('')}</div>`);

      let html = '';
      if (ab.tab === 'vac' || ab.tab === 'sick') {
        html = abFormHtml(ab.tab === 'sick' ? 'sick' : 'vacation');
        ab.m.setBody(html);
        ab.m.setFoot(`<button type="button" class="ui-btn-ghost" onclick="fmClose('abModal')">${escapeHtml(fmL('Schließen', 'Close'))}</button>
          <button type="button" class="ui-btn-primary" onclick="abSubmit(${jsArg(ab.tab === 'sick' ? 'sick' : 'vacation')})">${escapeHtml(ab.tab === 'sick' ? fmL('Krank melden', 'Report sick') : fmL('Antrag senden', 'Send request'))}</button>`);
        return;
      }
      const list = lists[ab.tab] || [];
      if (!list.length) {
        html = `<p class="staff-empty">${escapeHtml(({
          approve: fmL('Nichts offen. Alle Anträge sind erledigt.', 'Nothing open. All requests are done.'),
          mine: fmL('Du hast noch keine Meldungen.', 'You have no requests yet.'),
          history: fmL('Noch keine Einträge.', 'No entries yet.')
        })[ab.tab] || '')}</p>`;
      }
      html += list.map(r => abCardHtml(r)).join('');
      ab.m.setBody(html);
      ab.m.setFoot(`<button type="button" class="ui-btn-primary" onclick="fmClose('abModal')">${escapeHtml(fmL('Fertig', 'Done'))}</button>`);
    }

    function abFormHtml(kind) {
      const today = abToday();
      const isSick = kind === 'sick';
      const minFrom = isSick ? fmIso(new Date(Date.now() - 7 * 86400000)) : today;
      return `<div class="fm-stack">
        <p class="fm-hint">${escapeHtml(isSick
          ? fmL('Der Manager bekommt sofort eine Benachrichtigung. Bei kurzfristigem Ausfall bitte zusätzlich kurz anrufen.', 'Your manager is notified right away. If you cannot make it at short notice, please also call them.')
          : fmL('Der Manager entscheidet über deinen Antrag. Du bekommst eine Benachrichtigung.', 'Your manager decides on your request. You will get a notification.'))}</p>
        <div class="ab-dates">
          <div class="fm-field"><label class="form-label" for="abFrom">${escapeHtml(isSick ? fmL('Krank ab', 'Sick from') : fmL('Von', 'From'))}</label>
            <input type="date" id="abFrom" class="ui-field" value="${today}" min="${minFrom}" onchange="abSyncDates()"></div>
          <div class="fm-field"><label class="form-label" for="abTo">${escapeHtml(isSick ? fmL('Voraussichtlich bis', 'Expected until') : fmL('Bis (einschließlich)', 'Until (inclusive)'))}</label>
            <input type="date" id="abTo" class="ui-field" value="${today}" min="${today}"></div>
        </div>
        <div class="fm-field"><label class="form-label" for="abNote">${escapeHtml(fmL('Nachricht (optional)', 'Message (optional)'))}</label>
          <textarea id="abNote" class="ui-field" rows="2" maxlength="300" placeholder="${escapeHtml(isSick ? fmL('z. B. Fieber, melde mich morgen wieder', 'e.g. fever, I will update you tomorrow') : fmL('z. B. Familienfeier', 'e.g. family event'))}"></textarea></div>
      </div>`;
    }

    // „Bis“ darf nie vor „Von“ liegen
    function abSyncDates() {
      const f = document.getElementById('abFrom'), t = document.getElementById('abTo');
      if (!f || !t || !f.value) return;
      t.min = f.value;
      if (!t.value || t.value < f.value) t.value = f.value;
    }

    async function abSubmit(kind) {
      const from = (document.getElementById('abFrom') || {}).value;
      let to = (document.getElementById('abTo') || {}).value;
      const note = ((document.getElementById('abNote') || {}).value || '').trim();
      if (!from) return fmToast(fmL('Bitte ein Datum wählen.', 'Please choose a date.'));
      if (!to) to = from;
      if (to < from) return fmToast(fmL('Das Ende liegt vor dem Beginn.', 'The end is before the start.'));
      const { error } = await _supabase.rpc('create_absence_request', { p_kind: kind, p_from: from, p_to: to, p_note: note });
      if (error) return abToastError(error);
      fmToast(kind === 'sick' ? fmL('Krankmeldung gesendet. Gute Besserung!', 'Sick report sent. Get well soon!') : fmL('Antrag gesendet', 'Request sent'));
      ab.tab = 'mine';
      await abLoad();
      if (typeof loadDashboardCounts === 'function') loadDashboardCounts(true);
    }

    function abCardHtml(r) {
      const admin = !!userIsAdmin;
      const mine = String(r.staff_name).toLowerCase() === abMe();
      const showName = admin && ab.tab !== 'mine';
      let actions = '';

      if (admin && r.status === 'pending' && ab.tab !== 'mine') {
        if (r.kind === 'vacation') {
          actions += `<button type="button" class="fm-btn fm-btn-ok" onclick="abDecide(${jsArg(r.id)}, true)">✓ ${escapeHtml(fmL('Genehmigen', 'Approve'))}</button>
                      <button type="button" class="fm-btn fm-btn-danger" onclick="abDecide(${jsArg(r.id)}, false)">✗ ${escapeHtml(fmL('Ablehnen', 'Reject'))}</button>`;
        } else {
          actions += `<button type="button" class="fm-btn fm-btn-ok" onclick="abDecide(${jsArg(r.id)}, true)">👍 ${escapeHtml(fmL('Zur Kenntnis nehmen', 'Acknowledge'))}</button>`;
        }
      }
      if (admin && (r.status === 'approved' || r.status === 'noted') && !r.plan_applied) {
        actions += `<button type="button" class="fm-btn" onclick="abApplyPlan(${jsArg(r.id)})">📆 ${escapeHtml(fmL('In Arbeitsplan eintragen (' + (r.kind === 'sick' ? 'K' : 'U') + ')', 'Add to schedule (' + (r.kind === 'sick' ? 'K' : 'U') + ')'))}</button>`;
      }
      if ((mine || admin) && r.status === 'pending' && (ab.tab === 'mine' || !admin)) {
        actions += `<button type="button" class="fm-btn" onclick="abCancel(${jsArg(r.id)})">${escapeHtml(fmL('Zurückziehen', 'Withdraw'))}</button>`;
      } else if (admin && r.status === 'pending' && ab.tab === 'history') {
        actions += `<button type="button" class="fm-btn" onclick="abCancel(${jsArg(r.id)})">${escapeHtml(fmL('Zurückziehen', 'Withdraw'))}</button>`;
      }
      if (admin && ab.tab === 'history' && r.status !== 'pending') {
        actions += `<button type="button" class="fm-btn fm-btn-danger" onclick="abDeleteOne(${jsArg(r.id)})">🗑 ${escapeHtml(fmL('Löschen', 'Delete'))}</button>`;
      }

      const planNote = (r.status === 'approved' || r.status === 'noted')
        ? `<div class="fm-item-sub">${r.plan_applied ? '📆 ' + escapeHtml(fmL('Im Arbeitsplan eingetragen', 'Added to the schedule')) : '⏳ ' + escapeHtml(fmL('Noch nicht im Arbeitsplan', 'Not in the schedule yet'))}</div>` : '';

      return `<div class="fm-item" style="flex-direction:column;align-items:stretch">
        <div class="fm-row-flex" style="justify-content:space-between">
          <div class="fm-item-title">${escapeHtml(abKindLabel(r.kind))}${showName ? ' · ' + escapeHtml(r.staff_name) : ''}</div>
          ${abStatusChip(r)}
        </div>
        <div class="fm-item-sub">${escapeHtml(abRangeText(r))}</div>
        ${r.note ? `<div class="fm-item-sub">💬 ${escapeHtml(r.note)}</div>` : ''}
        ${r.manager_note ? `<div class="fm-item-sub">📝 ${escapeHtml(fmL('Manager', 'Manager'))}: ${escapeHtml(r.manager_note)}</div>` : ''}
        ${planNote}
        ${actions ? `<div class="fm-item-actions">${actions}</div>` : ''}
      </div>`;
    }

    // ---------------------------------------------------------------
    // Aktionen
    // ---------------------------------------------------------------
    async function abDecide(id, approve) {
      const r = ab.rows.find(x => x.id === id);
      if (!r) return;
      const note = prompt(approve
        ? fmL('Nachricht an ' + r.staff_name + ' (optional):', 'Message to ' + r.staff_name + ' (optional):')
        : fmL('Grund für die Ablehnung (optional):', 'Reason for rejection (optional):'), '');
      if (note === null) return;
      const { error } = await _supabase.rpc('decide_absence_request', { p_id: id, p_approve: approve, p_note: note });
      if (error) return abToastError(error);
      fmToast(approve ? (r.kind === 'sick' ? fmL('Zur Kenntnis genommen', 'Acknowledged') : fmL('Genehmigt', 'Approved')) : fmL('Abgelehnt', 'Rejected'));
      await abLoad();
      if (typeof loadDashboardCounts === 'function') loadDashboardCounts(true);
      if (approve) {
        const code = r.kind === 'sick' ? 'K' : 'U';
        if (confirm(fmL('Jetzt ' + code + ' für ' + r.staff_name + ' in den Arbeitsplan eintragen?', 'Add ' + code + ' for ' + r.staff_name + ' to the schedule now?'))) {
          await abApplyPlan(id, true);
        }
      }
    }

    async function abCancel(id) {
      if (!confirm(fmL('Meldung zurückziehen?', 'Withdraw this request?'))) return;
      const { error } = await _supabase.rpc('cancel_absence_request', { p_id: id });
      if (error) return abToastError(error);
      fmToast(fmL('Zurückgezogen', 'Withdrawn'));
      await abLoad();
      if (typeof loadDashboardCounts === 'function') loadDashboardCounts(true);
    }

    async function abDeleteOne(id) {
      if (!userIsAdmin) return;
      if (!confirm(fmL('Diesen Eintrag löschen?', 'Delete this entry?'))) return;
      const { error } = await _supabase.from('absence_requests').delete().eq('id', id);
      if (error) return abToastError(error);
      await abLoad();
    }

    // U bzw. K für jeden Tag des Zeitraums in den Arbeitsplan eintragen (nur Manager/Developer)
    async function abApplyPlan(id, skipConfirmIfNone) {
      if (!userIsAdmin) return;
      const r = ab.rows.find(x => x.id === id);
      if (!r) return;
      const code = r.kind === 'sick' ? 'K' : 'U';
      const days = abDays(r.date_from, r.date_to);

      // Bestehende Zeilen dieser Person in den betroffenen Monaten laden
      const months = {};
      days.forEach(iso => { const p = iso.split('-').map(Number); months[p[0] + '-' + p[1]] = [p[0], p[1]]; });
      const existing = [];
      for (const key of Object.keys(months)) {
        const ym = months[key];
        const res = await _supabase.from('work_schedules').select('*').eq('year', ym[0]).eq('month', ym[1])
          .ilike('employee_name', '%' + r.staff_name + '%');
        if (res.error) return fmToast(fmDbError(res.error));
        (res.data || []).forEach(row => { if (fmNameMatches(row.employee_name, r.staff_name)) existing.push(row); });
      }
      const rowFor = iso => {
        const p = iso.split('-').map(Number);
        return existing.find(x => x.year === p[0] && x.month === p[1] && x.day === p[2]);
      };
      const planName = existing.length ? existing[0].employee_name : r.staff_name;

      let replaced = 0, todo = 0;
      days.forEach(iso => {
        const row = rowFor(iso);
        if (row && String(row.shift_1_start || '').trim() === code) return;   // steht schon so im Plan
        todo++;
        if (row && typeof tpHasShift === 'function' && tpHasShift(row)) replaced++;
      });

      if (todo === 0) {
        await _supabase.rpc('absence_set_applied', { p_id: id, p_applied: true });
        fmToast(fmL('Steht schon so im Arbeitsplan.', 'Already in the schedule.'));
        await abLoad();
        return;
      }
      const msg = fmL(
        todo + ' Tag(e) als ' + code + ' für ' + r.staff_name + ' eintragen?' + (replaced ? '\n(' + replaced + ' davon haben schon eine Schicht, die ersetzt wird.)' : ''),
        'Add ' + todo + ' day(s) as ' + code + ' for ' + r.staff_name + '?' + (replaced ? '\n(' + replaced + ' of them already have a shift, which will be replaced.)' : ''));
      if (!confirm(msg)) return;

      let failed = 0;
      for (const iso of days) {
        const p = iso.split('-').map(Number);
        const row = rowFor(iso);
        if (row && String(row.shift_1_start || '').trim() === code) continue;
        const payload = { station: row ? (row.station || null) : null, shift_1_start: code, shift_1_end: null, shift_2_start: null, shift_2_end: null };
        let res;
        if (row) {
          res = await _supabase.from('work_schedules').update(payload)
            .match({ employee_name: row.employee_name, month: p[1], year: p[0], day: p[2] }).select();
        } else {
          res = await _supabase.from('work_schedules')
            .insert([Object.assign({ employee_name: planName, month: p[1], year: p[0], day: p[2] }, payload)]).select();
        }
        if (res.error || !res.data || !res.data.length) failed++;
      }
      if (failed) {
        fmToast(fmL(failed + ' Tag(e) konnten nicht eingetragen werden. Bitte im Arbeitsplan prüfen.', failed + ' day(s) could not be added. Please check the schedule.'));
        return;
      }
      const { error } = await _supabase.rpc('absence_set_applied', { p_id: id, p_applied: true });
      if (error) abToastError(error);
      fmToast(fmL('Im Arbeitsplan eingetragen (' + code + ')', 'Added to the schedule (' + code + ')'));
      await abLoad();
    }

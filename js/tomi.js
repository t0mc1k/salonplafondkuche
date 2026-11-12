/* ============================================================
   js/tomi.js  (v4.1.05)
   TomiAI: KI-Assistent für alle Mitarbeiter.
   - Kellner: Fragen zu Rezepten, Allergenen, Speisekarte, Checklisten und zur App.
   - Manager/Developer: zusätzlich Hilfe bei Plan, Stunden, Tausch und Tickets.
     Die KI ändert NIE selbst etwas. Sie macht Vorschläge, die der Manager hier bestätigen muss.
   - Der API-Schlüssel liegt nur auf dem Server (Edge Function tomi-ai, Secret GEMINI_API_KEY).
   - Der Gesprächsverlauf wird nicht gespeichert; er gilt nur, solange das Fenster offen ist.
   - v4.1.05: Der schwebende Knopf lässt sich in den Einstellungen ausblenden und verschieben
     (Position wird nur auf diesem Gerät gespeichert, siehe Abschnitt „TomiAI-Knopf“ unten).
   ============================================================ */

    let tomi = { m: null, hist: [], busy: false };

    function tomiChips() {
      return userIsAdmin
        ? ['tomi.chipM1', 'tomi.chipM2', 'tomi.chipM3', 'tomi.chipM4']
        : ['tomi.chipS1', 'tomi.chipS2', 'tomi.chipS3', 'tomi.chipS4'];
    }

    function openTomiModal() {
      if (tomiFabDragged) return;   // Nach dem Verschieben des Knopfes kein versehentliches Öffnen
      closeSettingsMenu();
      tomi.hist = [];
      tomi.busy = false;
      tomi.m = fmOpen('tomiModal', {
        title: t('tomi.title'),
        sub: userIsAdmin ? t('tomi.subAdmin') : t('tomi.subStaff'),
        onClose: () => { tomi.hist = []; tomi.busy = false; }
      });
      tomi.m.root.querySelector('.fm-card').classList.add('tomi-card');
      tomi.m.body.classList.add('tomi-body');
      tomi.m.setBody('<div id="tomiThread" class="tomi-thread"></div>');
      tomi.m.setFoot(`
        <div class="tomi-input">
          <textarea id="tomiInput" class="ui-field" rows="1" maxlength="1500" placeholder="${escapeHtml(t('tomi.ph'))}"
            onkeydown="tomiKey(event)" oninput="tomiGrow(this)"></textarea>
          <button type="button" id="tomiSendBtn" class="ui-btn-primary" onclick="tomiSend()" aria-label="${escapeHtml(t('tomi.send'))}">➤</button>
        </div>
        <p class="fm-hint tomi-disc">${escapeHtml(t('tomi.disc'))}</p>`);
      tomiRenderThread();
      setTimeout(() => { const i = document.getElementById('tomiInput'); if (i) i.focus(); }, 80);
    }

    function tomiKey(e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); tomiSend(); }
    }
    function tomiGrow(el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    }

    // Einfache Formatierung: **fett**, Listen mit „- “, Zeilenumbrüche (Text wird zuerst escaped)
    function tomiFormat(text) {
      const lines = escapeHtml(text).split('\n');
      let html = '', inList = false;
      lines.forEach(line => {
        const li = line.match(/^\s*(?:[-*•])\s+(.*)$/);
        const body = x => x.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
        if (li) {
          if (!inList) { html += '<ul>'; inList = true; }
          html += '<li>' + body(li[1]) + '</li>';
        } else {
          if (inList) { html += '</ul>'; inList = false; }
          html += line.trim() ? '<p>' + body(line) + '</p>' : '';
        }
      });
      if (inList) html += '</ul>';
      return html;
    }

    function tomiProposalLine(p) {
      if (p.type === 'swap_decide') return (p.approve ? '✅ ' : '❌ ') + 'Swap ' + p.swap_id;
      if (p.type === 'schedule_set') return `${p.employee} · ${p.date} · ${p.start}–${p.end}${p.start2 ? ' / ' + p.start2 + '–' + p.end2 : ''}${p.station ? ' · ' + p.station : ''}`;
      if (p.type === 'schedule_off') return `${p.employee} · ${p.date} · ${p.code}`;
      return `${p.employee} · ${p.date} · ✖`;
    }

    function tomiProposalHtml(mi, pi, p) {
      let actions;
      if (p.status === 'done') actions = `<span class="fm-chip fm-chip-green">${escapeHtml(t('tomi.done'))}</span>`;
      else if (p.status === 'discarded') actions = `<span class="fm-chip fm-chip-gray">${escapeHtml(t('tomi.discarded'))}</span>`;
      else actions = `${p.status === 'failed' ? `<span class="fm-chip fm-chip-red">${escapeHtml(t('tomi.failed', { msg: p.err || '' }))}</span> ` : ''}
        <button type="button" class="fm-btn fm-btn-ok" onclick="tomiApply(${mi}, ${pi})">${escapeHtml(t('tomi.confirm'))}</button>
        <button type="button" class="fm-btn" onclick="tomiDiscard(${mi}, ${pi})">${escapeHtml(t('tomi.discard'))}</button>`;
      return `<div class="tomi-prop"><div class="tomi-prop-title">${escapeHtml(t('tomi.propTitle'))}</div>
        <div>${escapeHtml(p.summary)}</div><div class="fm-hint">${escapeHtml(tomiProposalLine(p))}</div>
        <div class="fm-item-actions">${actions}</div></div>`;
    }

    function tomiRenderThread() {
      const box = document.getElementById('tomiThread');
      if (!box) return;
      let html = '';
      if (!tomi.hist.length) {
        html += `<div class="tomi-msg tomi-bot"><p>${escapeHtml(t('tomi.hello', { name: currentWaiterName }))}</p>${userIsAdmin ? `<p>${escapeHtml(t('tomi.helloAdmin'))}</p>` : ''}</div>`;
        html += `<div class="tomi-chips">${tomiChips().map(k => `<button type="button" class="fm-tab" onclick="tomiSend(${jsArg(t(k))})">${escapeHtml(t(k))}</button>`).join('')}</div>`;
      }
      tomi.hist.forEach((m, mi) => {
        if (m.role === 'user') html += `<div class="tomi-msg tomi-me">${escapeHtml(m.text).replace(/\n/g, '<br>')}</div>`;
        else html += `<div class="tomi-msg tomi-bot${m.error ? ' tomi-err' : ''}">${m.error ? `<p>${escapeHtml(m.text)}</p>` : tomiFormat(m.text)}${(m.proposals || []).map((p, pi) => tomiProposalHtml(mi, pi, p)).join('')}</div>`;
      });
      if (tomi.busy) html += `<div class="tomi-msg tomi-bot tomi-typing"><span></span><span></span><span></span><em>${escapeHtml(t('tomi.thinking'))}</em></div>`;
      box.innerHTML = html;
      box.scrollTop = box.scrollHeight;
      const btn = document.getElementById('tomiSendBtn');
      if (btn) btn.disabled = tomi.busy;
    }

    async function tomiErrorText(error, data) {
      let body = (data && typeof data === 'object') ? data : null;
      try {
        if (!body && error && error.context && typeof error.context.json === 'function') body = await error.context.json();
      } catch (e) {}
      const code = body && body.error;
      const status = error && error.context && error.context.status;
      let text;
      if (code === 'busy' || status === 503) text = t('tomi.errBusy');
      else if (code === 'auth' || status === 401) text = t('tomi.errAuth');
      else if (code === 'quota' || status === 429) text = t('tomi.errQuota');
      else if (code === 'not_configured') text = t('tomi.errNotConfigured');
      else if (status === 404) text = t('tomi.errDeploy');
      else text = t('tomi.errAi');
      // Nur Manager/Developer sehen einen kurzen technischen Hinweis (ohne Anbieternamen), z. B. „429×2, Timeout“
      const detail = (userIsAdmin && body && body.detail) ? String(body.detail) : (userIsAdmin && status ? 'HTTP ' + status : '');
      return detail ? text + ' [' + detail + ']' : text;
    }

    async function tomiSend(preset) {
      const input = document.getElementById('tomiInput');
      const text = String(preset != null ? preset : (input ? input.value : '')).trim();
      if (!text || tomi.busy) return;
      if (input) { input.value = ''; tomiGrow(input); }
      tomi.hist.push({ role: 'user', text });
      tomi.busy = true;
      tomiRenderThread();
      try {
        // Nur Texte senden (ohne Fehlermeldungen/Vorschläge); der Server prüft Person, Rolle und Tageslimit
        const messages = tomi.hist.filter(m => !m.error).map(m => ({ role: m.role, text: m.text }));
        const { data, error } = await _supabase.functions.invoke('tomi-ai', {
          body: { messages, lang: currentLang },
          headers: { 'x-staff-token': getStaffToken() }
        });
        if (error || !data || data.error || typeof data.reply !== 'string') {
          tomi.hist.push({ role: 'model', text: await tomiErrorText(error, data), error: true });
        } else {
          tomi.hist.push({ role: 'model', text: data.reply, proposals: userIsAdmin ? (data.proposals || []).map(p => Object.assign({ status: 'pending' }, p)) : [] });
        }
      } catch (e) {
        tomi.hist.push({ role: 'model', text: t('tomi.errAi'), error: true });
      }
      tomi.busy = false;
      tomiRenderThread();
      const i = document.getElementById('tomiInput');
      if (i) i.focus();
    }

    // ---------- Vorschläge ausführen (nur Manager, nur nach Bestätigung) ----------
    function tomiDiscard(mi, pi) {
      const p = tomi.hist[mi] && tomi.hist[mi].proposals && tomi.hist[mi].proposals[pi];
      if (!p) return;
      p.status = 'discarded';
      tomiRenderThread();
    }

    async function tomiApply(mi, pi) {
      const p = tomi.hist[mi] && tomi.hist[mi].proposals && tomi.hist[mi].proposals[pi];
      if (!p || p.status === 'done' || p.status === 'discarded' || !userIsAdmin) return;
      try {
        await tomiApplyOne(p);
        p.status = 'done';
        fmToast(t('tomi.done'));
      } catch (e) {
        p.status = 'failed';
        p.err = (e && e.message) || String(e);
      }
      tomiRenderThread();
    }

    async function tomiApplyOne(p) {
      if (p.type === 'swap_decide') {
        const { error } = await _supabase.rpc('decide_shift_swap', { p_id: p.swap_id, p_approve: !!p.approve, p_note: p.note || '' });
        if (error) throw new Error(fmDbError(error));
        if (typeof loadDashboardCounts === 'function') loadDashboardCounts(true);
        return;
      }
      const parts = String(p.date).split('-').map(Number);
      const y = parts[0], mo = parts[1], d = parts[2];
      const found = await _supabase.from('work_schedules').select('*').eq('year', y).eq('month', mo).eq('day', d).ilike('employee_name', '%' + p.employee + '%');
      if (found.error) throw new Error(fmDbError(found.error));
      const rows = found.data || [];
      const want = String(p.employee).trim().toLowerCase();
      const exact = rows.find(r => String(r.employee_name).trim().toLowerCase() === want) || rows.find(r => fmNameMatches(r.employee_name, p.employee)) || null;
      const key = exact ? { employee_name: exact.employee_name, year: y, month: mo, day: d } : null;

      if (p.type === 'schedule_clear') {
        if (!exact) throw new Error(fmL('Kein Eintrag vorhanden.', 'No entry found.'));
        const del = await _supabase.from('work_schedules').delete().match(key).select();
        if (del.error) throw new Error(fmDbError(del.error));
        return;
      }
      const payload = p.type === 'schedule_off'
        ? { shift_1_start: p.code, shift_1_end: null, shift_2_start: null, shift_2_end: null, station: (exact && exact.station) || null }
        : { shift_1_start: p.start, shift_1_end: p.end, shift_2_start: p.start2 || null, shift_2_end: p.end2 || null, station: p.station || (exact && exact.station) || null };
      const res = exact
        ? await _supabase.from('work_schedules').update(payload).match(key).select()
        : await _supabase.from('work_schedules').insert([Object.assign({ employee_name: p.employee, year: y, month: mo, day: d }, payload)]).select();
      if (res.error) throw new Error(fmDbError(res.error));
      if (!res.data || !res.data.length) throw new Error(fmL('Nichts gespeichert (fehlende Berechtigung?).', 'Nothing saved (missing permission?).'));
    }


    // ============================================================
    // TomiAI-Knopf: ausblenden / verschieben (v4.1.05)
    // Einstellungen: appSettings.tomiFab (anzeigen) und appSettings.tomiMove (verschiebbar).
    // Position: in Anteilen (0–1) der freien Fläche, damit sie nach Drehen/Skalieren des Bildschirms passt.
    // ============================================================
    const TOMI_POS_KEY = 'nexus_tomi_pos';
    let tomiFabDragged = false;

    function tomiFabLoadPos() {
      try {
        const v = JSON.parse(localStorage.getItem(TOMI_POS_KEY) || 'null');
        if (v && typeof v.x === 'number' && typeof v.y === 'number') return { x: Math.min(1, Math.max(0, v.x)), y: Math.min(1, Math.max(0, v.y)) };
      } catch (e) {}
      return null;
    }

    function tomiFabApply() {
      const fab = document.getElementById('tomiFab');
      if (!fab) return;
      const movable = !!(appSettings && appSettings.tomiMove) && !(appSettings && appSettings.tomiFab === false);
      fab.classList.toggle('tomi-fab-movable', movable);
      const pos = tomiFabLoadPos();
      if (!pos) {
        fab.style.left = ''; fab.style.top = ''; fab.style.bottom = ''; fab.style.right = '';
        return;
      }
      const w = fab.offsetWidth || 110, h = fab.offsetHeight || 40, m = 8;
      const freeX = Math.max(0, window.innerWidth - w - m * 2);
      const freeY = Math.max(0, window.innerHeight - h - m * 2);
      fab.style.left = Math.round(m + pos.x * freeX) + 'px';
      fab.style.top = Math.round(m + pos.y * freeY) + 'px';
      fab.style.bottom = 'auto';
      fab.style.right = 'auto';
    }

    function tomiFabResetPosition(silent) {
      try { localStorage.removeItem(TOMI_POS_KEY); } catch (e) {}
      tomiFabApply();
      if (!silent && typeof fmToast === 'function') fmToast(fmL('TomiAI-Knopf zurückgesetzt', 'TomiAI button reset'));
    }

    (function tomiFabInitDrag() {
      const fab = document.getElementById('tomiFab');
      if (!fab || fab._dragInit) return;
      fab._dragInit = true;
      let st = null;

      fab.addEventListener('pointerdown', e => {
        if (!fab.classList.contains('tomi-fab-movable')) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        const r = fab.getBoundingClientRect();
        st = { id: e.pointerId, sx: e.clientX, sy: e.clientY, left: r.left, top: r.top, w: r.width, h: r.height, moved: false };
        try { fab.setPointerCapture(e.pointerId); } catch (err) {}
      });

      fab.addEventListener('pointermove', e => {
        if (!st || e.pointerId !== st.id) return;
        const dx = e.clientX - st.sx, dy = e.clientY - st.sy;
        if (!st.moved && Math.hypot(dx, dy) < 6) return;
        st.moved = true;
        fab.classList.add('dragging');
        const m = 8;
        const left = Math.min(Math.max(m, st.left + dx), window.innerWidth - st.w - m);
        const top = Math.min(Math.max(m, st.top + dy), window.innerHeight - st.h - m);
        fab.style.left = Math.round(left) + 'px';
        fab.style.top = Math.round(top) + 'px';
        fab.style.bottom = 'auto';
        fab.style.right = 'auto';
        e.preventDefault();
      });

      const end = e => {
        if (!st || (e && e.pointerId !== st.id)) return;
        fab.classList.remove('dragging');
        try { fab.releasePointerCapture(st.id); } catch (err) {}
        if (st.moved) {
          const m = 8;
          const freeX = Math.max(1, window.innerWidth - st.w - m * 2);
          const freeY = Math.max(1, window.innerHeight - st.h - m * 2);
          const r = fab.getBoundingClientRect();
          const pos = { x: Math.min(1, Math.max(0, (r.left - m) / freeX)), y: Math.min(1, Math.max(0, (r.top - m) / freeY)) };
          try { localStorage.setItem(TOMI_POS_KEY, JSON.stringify(pos)); } catch (err) {}
          tomiFabDragged = true;
          setTimeout(() => { tomiFabDragged = false; }, 350);
        }
        st = null;
      };
      fab.addEventListener('pointerup', end);
      fab.addEventListener('pointercancel', end);
      window.addEventListener('resize', tomiFabApply);
      window.addEventListener('orientationchange', () => setTimeout(tomiFabApply, 200));
      tomiFabApply();
    })();

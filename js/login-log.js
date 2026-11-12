/* ============================================================
   js/login-log.js  (v4.1.03)
   Login-Protokoll (nur Manager/Developer), Deutsch.
   Reiter: Live (wer ist gerade wo) · Sitzungen (Anmeldung, Dauer, Abmeldung) · Aktivität (Bereiche + wichtige Aktionen) · Statistik.
   Daten: staff_sessions / staff_activity (SQL 4.1.03), keine IP-Adressen, 90 Tage Aufbewahrung, manuell löschbar.
   ============================================================ */

    const LL_SECTIONS = {
      dashboard: 'Dashboard', drinks: 'Getränke & Rezepte', allergens: 'Speisekarte & Allergene', checklist: 'Checkliste', myplan: 'Mein Arbeitsplan',
      swaps: 'Schichttausch', chat: 'Team-Chat', faults: 'Störungen', loss: 'Verluste & Bruch', help: 'Hilfe', tomi: 'TomiAI',
      shopping: 'Einkaufsliste', profile: 'Profil', settings: 'Einstellungen', news: 'Was ist neu?', support: 'Support', teamplan: 'Team & Arbeitsplan',
      payroll: 'Stunden & Lohn', staff: 'Personal & PINs', loginlog: 'Login-Protokoll', season: 'Saison', impexp: 'Import & Export', print: 'Karten-Druck', multiview: 'Multi-View'
    };
    const LL_EVENTS = {
      section: ['📍', 'Bereich geöffnet'], task_done: ['✅', 'Aufgabe abgehakt'], swap_request: ['🔄', 'Tausch angefragt'], swap_take: ['🤝', 'Tausch übernommen'],
      swap_decide: ['✅', 'Tausch entschieden'], swap_decline: ['❌', 'Tausch abgelehnt'], swap_cancel: ['↩️', 'Tausch zurückgezogen'],
      fault_report: ['🛠️', 'Störung gemeldet'], fault_status: ['🛠️', 'Störung bearbeitet'], loss_report: ['🔨', 'Bruch/Verlust gemeldet'],
      plan_change: ['📆', 'Arbeitsplan geändert'],
      drink_new: ['🍸', 'Getränk angelegt'], drink_edit: ['🍸', 'Getränk geändert'], drink_delete: ['🗑️', 'Getränk gelöscht'],
      chat_msg: ['💬', 'Im Chat geschrieben'], ticket_new: ['🛟', 'Ticket erstellt'], news_new: ['📣', 'Team-News veröffentlicht']
    };
    const LL_END = { logout: 'Abgemeldet', timeout: 'Keine Aktivität mehr', closed: 'App geschlossen' };

    let ll = { m: null, tab: 'live', days: 1, name: '', kind: '', data: [], timer: null };

    function llSection(k) { return LL_SECTIONS[k] || k || '–'; }
    function llDur(sec) {
      sec = Math.max(0, Math.round(sec || 0));
      if (sec < 60) return '< 1 Min.';
      const m = Math.round(sec / 60);
      if (m < 60) return m + ' Min.';
      return Math.floor(m / 60) + ' Std. ' + String(m % 60).padStart(2, '0') + ' Min.';
    }
    function llAge(sec) {
      if (sec < 90) return 'gerade eben';
      return 'vor ' + Math.round(sec / 60) + ' Min.';
    }
    function llDate(offsetDays) { return fmIso(new Date(Date.now() - offsetDays * 86400000)); }
    function llRange() { return { from: llDate(ll.days - 1), to: llDate(0) }; }
    function llDt(ts) {
      const d = new Date(ts);
      return d.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
    }

    function openLoginLogModal() {
      closeSettingsMenu();
      checkManagerAuth(() => {
        ll.tab = 'live'; ll.days = 1; ll.name = ''; ll.kind = '';
        ll.m = fmOpen('llModal', {
          title: '🔐 Login-Protokoll',
          sub: 'Wer war wann angemeldet, wo und wie lange. Keine IP-Adressen, automatische Löschung nach 90 Tagen.',
          wide: true,
          onClose: llStopTimer
        });
        llLoad();
      });
    }

    function llStopTimer() { if (ll.timer) { clearInterval(ll.timer); ll.timer = null; } }

    function llSetTab(tab) { ll.tab = tab; llLoad(); }
    function llSetDays(d) { ll.days = d; llLoad(); }
    function llSetName(v) { ll.name = v; llLoad(); }
    function llSetKind(v) { ll.kind = v; llLoad(); }

    async function llLoad() {
      llStopTimer();
      llToolbar();
      ll.m.setBody('<p class="staff-empty">Lade ...</p>');
      const r = llRange();
      let res;
      if (ll.tab === 'live') res = await _supabase.rpc('nx_admin_live');
      else if (ll.tab === 'sessions') res = await _supabase.rpc('nx_admin_sessions', { p_from: r.from, p_to: r.to, p_name: ll.name || null });
      else if (ll.tab === 'activity') res = await _supabase.rpc('nx_admin_activity', { p_from: r.from, p_to: r.to, p_name: ll.name || null, p_kind: ll.kind || null });
      else res = await _supabase.rpc('nx_admin_stats', { p_from: r.from, p_to: r.to });
      if (res.error) { ll.m.setBody(fmErrorHtml(res.error)); return; }
      ll.data = Array.isArray(res.data) ? res.data : [];
      llRender();
      if (ll.tab === 'live') ll.timer = setInterval(() => { if (document.getElementById('llModal')) llRefreshLive(); else llStopTimer(); }, 20000);
    }

    async function llRefreshLive() {
      const res = await _supabase.rpc('nx_admin_live');
      if (!res.error && Array.isArray(res.data)) { ll.data = res.data; llRender(); }
    }

    function llToolbar() {
      const tabs = [['live', '🟢 Live'], ['sessions', '🕒 Sitzungen'], ['activity', '📋 Aktivität'], ['stats', '📊 Statistik']];
      const names = Array.from(new Set((staffDatabaseRecords || []).map(s => s.name))).sort((a, b) => a.localeCompare(b, 'de'));
      const showFilters = ll.tab !== 'live';
      ll.m.setToolbar(`
        <div class="fm-tabs">${tabs.map(t => `<button type="button" class="fm-tab${ll.tab === t[0] ? ' active' : ''}" onclick="llSetTab('${t[0]}')">${t[1]}</button>`).join('')}</div>
        ${showFilters ? `<div class="fm-row-flex" style="margin-top:.5rem">
          <div class="fm-tabs">${[[1, 'Heute'], [7, '7 Tage'], [30, '30 Tage'], [90, '90 Tage']].map(d => `<button type="button" class="fm-tab${ll.days === d[0] ? ' active' : ''}" onclick="llSetDays(${d[0]})">${d[1]}</button>`).join('')}</div>
          ${ll.tab !== 'stats' ? `<select class="ui-field" style="width:auto" onchange="llSetName(this.value)"><option value="">Alle Personen</option>${names.map(n => `<option value="${escapeHtml(n)}"${ll.name === n ? ' selected' : ''}>${escapeHtml(n)}</option>`).join('')}</select>` : ''}
          ${ll.tab === 'activity' ? `<select class="ui-field" style="width:auto" onchange="llSetKind(this.value)"><option value="">Alles</option><option value="action"${ll.kind === 'action' ? ' selected' : ''}>Nur Aktionen</option><option value="section"${ll.kind === 'section' ? ' selected' : ''}>Nur Bereiche</option></select>` : ''}
          <button type="button" class="fm-btn" onclick="llExport()">📗 Excel</button>
        </div>` : ''}`);
      ll.m.setFoot(`<button type="button" class="fm-btn fm-btn-danger" onclick="llClear()">🗑️ Protokoll leeren</button>
        <span class="fm-grow"></span><button type="button" class="ui-btn-primary" onclick="fmClose('llModal'); llStopTimer()">Fertig</button>`);
    }

    function llRender() {
      const rows = ll.data;
      let html = '';
      if (ll.tab === 'live') {
        html += `<p class="fm-hint" style="margin-bottom:.6rem">Online = in den letzten 3 Minuten gesehen. Die Anzeige aktualisiert sich alle 20 Sekunden.</p>`;
        if (!rows.length) html += '<p class="staff-empty">Gerade ist niemand angemeldet.</p>';
        html += rows.map(r => {
          const on = r.age_s <= 180;
          return `<div class="fm-item"><div class="fm-item-main">
            <div class="fm-row-flex" style="justify-content:space-between;flex-wrap:nowrap">
              <div class="fm-item-title">${on ? '🟢' : '🟡'} ${escapeHtml(r.staff_name)}</div>
              ${on ? fmStatusChip('online', 'green') : fmStatusChip('inaktiv · ' + llAge(r.age_s), 'amber')}
            </div>
            <div class="fm-item-sub">📍 ${escapeHtml(llSection(r.section))} · ${escapeHtml(r.device || '–')}</div>
            <div class="fm-item-sub">Angemeldet seit ${escapeHtml(llDt(r.started_at))} · ${escapeHtml(llDur(r.seconds))}</div>
          </div></div>`;
        }).join('');
      } else if (ll.tab === 'sessions') {
        if (!rows.length) html += '<p class="staff-empty">Keine Sitzungen im gewählten Zeitraum.</p>';
        let day = '';
        rows.forEach(r => {
          const d = new Date(r.started_at).toLocaleDateString('de-AT', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
          if (d !== day) { day = d; html += `<div class="fm-sec-title"><span>${escapeHtml(d)}</span></div>`; }
          const end = r.active ? fmStatusChip('aktiv', 'green') : (r.end_reason === 'logout' ? fmStatusChip('Abgemeldet', 'gray') : fmStatusChip(LL_END[r.end_reason] || 'Keine Aktivität mehr', 'amber'));
          html += `<div class="fm-item"><div class="fm-item-main">
            <div class="fm-row-flex" style="justify-content:space-between;flex-wrap:nowrap"><div class="fm-item-title">${escapeHtml(r.staff_name)}</div>${end}</div>
            <div class="fm-item-sub">${escapeHtml(llDt(r.started_at).slice(-5))} bis ${r.active ? 'jetzt' : escapeHtml(llDt(r.ended_at || r.last_seen_at).slice(-5))} · <b>${escapeHtml(llDur(r.seconds))}</b> · ${escapeHtml(r.device || '–')}</div>
          </div></div>`;
        });
      } else if (ll.tab === 'activity') {
        if (!rows.length) html += '<p class="staff-empty">Keine Einträge im gewählten Zeitraum.</p>';
        let day = '';
        rows.forEach(r => {
          const d = new Date(r.created_at).toLocaleDateString('de-AT', { weekday: 'long', day: '2-digit', month: '2-digit' });
          if (d !== day) { day = d; html += `<div class="fm-sec-title"><span>${escapeHtml(d)}</span></div>`; }
          const ev = LL_EVENTS[r.event] || ['•', r.event];
          const detail = r.event === 'section' ? llSection(r.detail) : (r.detail || '');
          html += `<div class="fm-item"><div class="fm-item-main">
            <div class="fm-item-title">${ev[0]} ${escapeHtml(r.staff_name)} <span class="fm-hint">· ${escapeHtml(ev[1])}</span></div>
            <div class="fm-item-sub">${escapeHtml(new Date(r.created_at).toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' }))}${detail ? ' · ' + escapeHtml(detail) : ''}</div>
          </div></div>`;
        });
        if (rows.length >= 1000) html += '<p class="fm-hint" style="text-align:center;margin-top:.6rem">Es werden die letzten 1000 Einträge angezeigt. Bitte Zeitraum oder Person eingrenzen.</p>';
      } else {
        if (!rows.length) html += '<p class="staff-empty">Keine Daten im gewählten Zeitraum.</p>';
        else {
          html += `<div style="overflow-x:auto"><table class="pr-table"><thead><tr><th>Person</th><th>Sitzungen</th><th>Zeit in der App</th><th>Ø Sitzung</th><th>Aktionen</th><th>Zuletzt gesehen</th></tr></thead><tbody>`;
          html += rows.map(r => `<tr><td><b>${escapeHtml(r.staff_name)}</b>${(r.top_sections || []).length ? `<br><span class="fm-hint">${r.top_sections.map(s => escapeHtml(llSection(s.section)) + ' (' + s.n + ')').join(', ')}</span>` : ''}</td>
            <td>${r.sessions}</td><td>${escapeHtml(llDur(r.seconds))}</td><td>${escapeHtml(llDur(r.seconds / Math.max(1, r.sessions)))}</td><td>${r.actions}</td><td>${escapeHtml(llDt(r.last_seen))}</td></tr>`).join('');
          html += '</tbody></table></div>';
        }
      }
      ll.m.setBody(html);
    }

    function llExport() {
      if (typeof XLSX === 'undefined') return alert('Excel-Bibliothek nicht geladen.');
      if (!ll.data.length) return alert('Keine Daten zum Exportieren.');
      let aoa, name;
      if (ll.tab === 'sessions') {
        aoa = [['Person', 'Gerät', 'Anmeldung', 'Ende', 'Dauer (Min.)', 'Ende-Grund']];
        ll.data.forEach(r => aoa.push([r.staff_name, r.device || '', llDt(r.started_at), r.active ? 'aktiv' : llDt(r.ended_at || r.last_seen_at), Math.round(r.seconds / 60), r.active ? 'aktiv' : (LL_END[r.end_reason] || '')]));
        name = 'Sitzungen';
      } else if (ll.tab === 'activity') {
        aoa = [['Zeit', 'Person', 'Art', 'Ereignis', 'Detail']];
        ll.data.forEach(r => aoa.push([llDt(r.created_at), r.staff_name, r.kind === 'section' ? 'Bereich' : 'Aktion', (LL_EVENTS[r.event] || ['', r.event])[1], r.event === 'section' ? llSection(r.detail) : (r.detail || '')]));
        name = 'Aktivität';
      } else if (ll.tab === 'stats') {
        aoa = [['Person', 'Sitzungen', 'Zeit in der App (Min.)', 'Aktionen', 'Zuletzt gesehen', 'Top-Bereiche']];
        ll.data.forEach(r => aoa.push([r.staff_name, r.sessions, Math.round(r.seconds / 60), r.actions, llDt(r.last_seen), (r.top_sections || []).map(s => llSection(s.section) + ' (' + s.n + ')').join(', ')]));
        name = 'Statistik';
      } else return;
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = aoa[0].map(() => ({ wch: 22 }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, name);
      XLSX.writeFile(wb, `Login-Protokoll_${name}_${fmIso(new Date())}.xlsx`);
    }

    async function llClear() {
      if (!confirm('Das gesamte Login-Protokoll löschen?\n\nGelöscht werden alle Sitzungen, die Aktivität und die alte Anmelde-Liste. Das kann nicht rückgängig gemacht werden.')) return;
      const a = await _supabase.rpc('nx_admin_clear');
      if (a.error) return fmToast(fmDbError(a.error));
      try { await _supabase.rpc('admin_clear_login_history'); } catch (e) {}
      fmToast('Protokoll gelöscht');
      llLoad();
    }

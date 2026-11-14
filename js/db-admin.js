/* ============================================================
   js/db-admin.js  (v1.0.28)
   Datenbank-Verwaltung (nur Developer): Übersicht (Größe der Datenbank, jede Tabelle, Foto-Speicher),
   Fotos (alle gespeicherten Dateien ansehen, unbenutzte erkennen, löschen), Aufbewahrung (Regeln „älter als X Tage löschen“,
   Probelauf, Jetzt ausführen, automatischer Zeitplan).
   Datenbank: sql/1.0.16_db_admin.sql (Funktionen db_overview, db_photo_refs, retention_*, db_cleanup_run – alle prüfen „Developer“).
   Dateien auflisten/löschen: Edge Function db-admin (service_role, prüft ebenfalls „Developer“).
   ============================================================ */

    let da = { m: null, tab: 'overview', ov: null, items: null, refsErr: '', rules: null, cfg: null, trash: 0, cron: false, sel: new Set(), filter: 'all', sort: 'new', shown: 60, busy: false };

    const DA_TABLES = { staff: 'Mitarbeiter', auth_tokens: 'Anmelde-Token', login_history: 'Login-Protokoll', recipes: 'Rezepte', work_schedules: 'Dienstplan (Schichten)', plan_weeks: 'Dienstplan (Wochen)', fridges: 'Kühlgeräte', fridge_temps: 'Kühlschrank-Temperaturen', wash_areas: 'Abwasher: Orte', wash_logs: 'Abwasher: Erledigt-Einträge', wash_monthly: 'Abwasher: Monatswertung', team_chat: 'Team-Chat', chat_reactions: 'Chat-Reaktionen', support_tickets: 'Support-Tickets', push_subscriptions: 'Push-Anmeldungen', push_queue: 'Push-Warteschlange', tomi_usage: 'TomiAI-Zähler', nx_sessions: 'Online-Sitzungen', nx_activity: 'Aktivitäts-Protokoll', inbox_items: 'Mitteilungen', maintenance_reports: 'Störungen', loss_reports: 'Verluste & Bruch', checklist_done: 'Checklisten (erledigt)', checklist_tasks: 'Checklisten (Aufgaben)', shift_swaps: 'Schichttausch', absence_requests: 'Urlaub / Krank', time_entries: 'Stunden & Lohn', order_items: 'Bestellliste: Produkte', order_lists: 'Bestellliste: Tage', order_lines: 'Bestellliste: Mengen', daily_specials: 'Tagesangebote', food_items: 'Speisekarte', retention_rules: 'Aufbewahrungsregeln', storage_trash: 'Foto-Warteschlange' };
    const DA_PREFIX = { washlog: 'Abwasher: Fotos der Arbeit', washarea: 'Abwasher: Orte', abwasher: 'Abwasher: Orte (ältere)', recipe: 'Rezepte', recipes: 'Rezepte', chat: 'Chat', profile: 'Profile', staff: 'Profile', maint: 'Störungen', drink: 'Getränke / Rezepte' };
    const daFmt = b => b >= 1073741824 ? (b / 1073741824).toFixed(2).replace('.', ',') + ' GB' : (b >= 1048576 ? (b / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(0, Math.round(b / 1024)) + ' KB');
    const daPrefixName = p => DA_PREFIX[p] || p || 'Sonstige';
    function daPlan() { try { return localStorage.getItem('da_plan') === 'pro' ? 'pro' : 'free'; } catch (e) { return 'free'; } }
    function daSetPlan(v) { try { localStorage.setItem('da_plan', v); } catch (e) {} daRender(); }
    const daLimits = () => daPlan() === 'pro' ? { db: 8 * 1073741824, st: 100 * 1073741824, dbT: '8 GB', stT: '100 GB' } : { db: 524288000, st: 1073741824, dbT: '500 MB', stT: '1 GB' };

    function daErr(err) {
      const msg = (err && err.message) || String(err);
      if (/does not exist|schema cache|could not find the (table|function)/i.test(msg) || (err && err.code === '42P01')) return 'Die Datenbank-Verwaltung ist noch nicht eingerichtet. Bitte zuerst sql/1.0.16_db_admin.sql im Supabase SQL Editor ausführen.';
      if (/Keine Berechtigung/i.test(msg)) return 'Nur der Developer darf die Datenbank verwalten.';
      return msg;
    }
    const daErrHtml = err => '<p class="staff-empty" style="color:#ef4444">' + escapeHtml(daErr(err)) + '</p>';

    // Edge Function db-admin aufrufen
    async function daEdge(body) {
      const { data, error } = await _supabase.functions.invoke('db-admin', { body, headers: { 'x-staff-token': getStaffToken() } });
      const status = error && error.context && error.context.status;
      if (status === 404 || (error && /Failed to send|NetworkError|Failed to fetch/i.test(String(error.message || '')))) return { error: 'Die Funktion db-admin ist noch nicht eingerichtet (supabase/functions/db-admin bereitstellen, siehe docs/SETUP-4.1.00.md).' };
      if (status === 403) return { error: 'Nur der Developer darf das.' };
      if (error || !data || data.error) return { error: (data && (data.message || data.error)) || (error && error.message) || 'Fehler' };
      return { data };
    }

    // ---------- Öffnen ----------
    function openDbAdminModal() {
      if (typeof closeSettingsMenu === 'function') closeSettingsMenu();
      if (typeof currentStaffRole === 'undefined' || currentStaffRole !== 'developer') { alert('Die Datenbank-Verwaltung ist nur für den Developer.'); return; }
      da.tab = 'overview'; da.ov = null; da.items = null; da.rules = null; da.sel = new Set(); da.filter = 'all'; da.shown = 60;
      da.m = fmOpen('daModal', { title: '🗄️ Datenbank-Verwaltung', sub: 'Was ist wo gespeichert, Fotos ansehen und löschen, automatisch aufräumen. Nur für den Developer.', wide: true });
      daTab('overview');
    }
    function daTabsHtml() {
      return '<div class="fm-tabs">' + [['overview', '📊 Übersicht'], ['photos', '🖼️ Fotos'], ['rules', '🧹 Aufbewahrung']].map(t => `<button type="button" class="fm-tab${da.tab === t[0] ? ' active' : ''}" onclick="daTab('${t[0]}')">${t[1]}</button>`).join('') + '</div>';
    }
    async function daTab(t) {
      da.tab = t;
      da.m.setToolbar(daTabsHtml());
      da.m.setFoot('<button type="button" class="ui-btn-primary" onclick="fmClose(\'daModal\')">Fertig</button>');
      if (t === 'overview') return daLoadOverview();
      if (t === 'photos') return daLoadPhotos();
      return daLoadRules();
    }
    function daRender() { if (da.tab === 'overview') daRenderOverview(); else if (da.tab === 'photos') daRenderPhotos(); else daRenderRules(); }

    // ---------- 📊 Übersicht ----------
    async function daLoadOverview() {
      da.m.setBody('<p class="staff-empty">Lade ...</p>');
      const { data, error } = await _supabase.rpc('db_overview');
      if (error) { da.m.setBody(daErrHtml(error)); return; }
      da.ov = data; daRenderOverview();
    }
    function daBar(used, limit) {
      const pct = Math.min(100, used / limit * 100);
      return `<div class="dw-st-bar"><div class="dw-st-fill${pct > 80 ? ' hot' : ''}" style="width:${Math.max(1, pct)}%"></div></div><span class="fm-hint">${pct < 1 ? '< 1' : Math.round(pct)} % von ${daFmt(limit)}</span>`;
    }
    function daRenderOverview() {
      const o = da.ov; if (!o) return;
      const L = daLimits();
      const tables = (o.tables || []).slice().sort((a, b) => b.bytes - a.bytes);
      const maxB = Math.max(1, ...tables.map(t => t.bytes));
      const totalRows = tables.reduce((a, t) => a + Number(t.rows), 0);
      da.m.setBody(`<div class="da-cards">
          <div class="da-card"><b>🗄️ Datenbank</b><span class="da-big">${daFmt(o.db_bytes)}</span>${daBar(o.db_bytes, L.db)}<small>${tables.length} Tabellen · ${totalRows.toLocaleString('de-AT')} Zeilen</small></div>
          <div class="da-card"><b>🖼️ Foto-Speicher</b><span class="da-big">${daFmt(o.storage_bytes)}</span>${daBar(o.storage_bytes, L.st)}<small>${o.storage_files} Dateien</small></div>
          <div class="da-card"><b>Tarif</b><select class="ui-field" onchange="daSetPlan(this.value)"><option value="free"${daPlan() === 'free' ? ' selected' : ''}>Free (DB 500 MB, Fotos 1 GB)</option><option value="pro"${daPlan() === 'pro' ? ' selected' : ''}>Pro (DB 8 GB, Fotos 100 GB)</option></select><small>Nur für die Balken. Echte Grenzen: Supabase → Settings → Billing / Usage.</small></div></div>
        <h4 class="dw-group">Foto-Speicher nach Bereich</h4>
        <div class="da-rows">${(o.storage_prefixes || []).length ? (o.storage_prefixes || []).map(p => `<div class="da-row"><span>${escapeHtml(daPrefixName(p.prefix))}</span><span>${p.files} Dateien</span><b>${daFmt(Number(p.bytes))}</b></div>`).join('') : '<p class="staff-empty">Keine Fotos gespeichert.</p>'}</div>
        <h4 class="dw-group">Tabellen (nach Größe)</h4>
        <div class="da-rows">${tables.map(t => `<div class="da-row"><span class="da-tn" title="${escapeHtml(t.name)}">${escapeHtml(DA_TABLES[t.name] || t.name)}</span><span>${Number(t.rows).toLocaleString('de-AT')} Zeilen</span><b>${daFmt(t.bytes)}</b><i class="da-mini"><u style="width:${Math.max(2, t.bytes / maxB * 100)}%"></u></i></div>`).join('')}</div>
        <p class="fm-hint" style="margin-top:.6rem">Alte Daten automatisch löschen: Reiter „🧹 Aufbewahrung“. Fotos einzeln ansehen und löschen: „🖼️ Fotos“. Die Größe einer Tabelle enthält auch Indizes.</p>`);
    }

    // ---------- 🖼️ Fotos ----------
    async function daLoadPhotos() {
      da.m.setBody('<p class="staff-empty">Lade Dateien ... (kann bei vielen Fotos einen Moment dauern)</p>');
      const files = []; let offset = 0;
      for (let page = 0; page < 20; page++) {
        const r = await daEdge({ action: 'list', offset, limit: 1000 });
        if (r.error) { da.m.setBody(`<p class="staff-empty" style="color:#ef4444">${escapeHtml(r.error)}</p>`); return; }
        files.push(...r.data.files); offset += 1000;
        if (!r.data.more) break;
      }
      const refs = await _supabase.rpc('db_photo_refs');
      da.refsErr = refs.error ? daErr(refs.error) : '';
      const srcBy = new Map();
      (refs.data || []).forEach(x => { const p = fmPhotoPath(x.url); if (!p) return; if (!srcBy.has(p)) srcBy.set(p, new Set()); srcBy.get(p).add(x.source); });
      const names = new Set(files.map(f => f.name));
      const isThumb = f => /_t\.jpg$/.test(f.name) && files.some(o => o !== f && o.name.replace(/\.[A-Za-z0-9]+$/, '') === f.name.replace(/_t\.jpg$/, ''));
      const thumbs = new Map();
      files.filter(isThumb).forEach(f => thumbs.set(f.name.replace(/_t\.jpg$/, ''), f));
      const now = Date.now();
      da.items = files.filter(f => !isThumb(f)).map(f => {
        const base = f.name.replace(/\.[A-Za-z0-9]+$/, ''), th = thumbs.get(base) || null;
        const src = Array.from(srcBy.get(f.name) || []);
        const age = f.created_at ? now - new Date(f.created_at).getTime() : 1e12;
        return { name: f.name, thumb: th ? th.name : '', size: f.size + (th ? th.size : 0), created: f.created_at, prefix: f.name.split('_')[0], sources: src, used: src.length > 0, orphan: !src.length && age > 86400000 };
      });
      da.refsOk = !refs.error;
      da.sel = new Set(); da.shown = 60;
      daRenderPhotos();
    }
    const daUrl = n => _supabase.storage.from('photos').getPublicUrl(n).data.publicUrl;
    function daVisible() {
      let l = da.items || [];
      if (da.filter === 'used') l = l.filter(i => i.used);
      else if (da.filter === 'orphan') l = l.filter(i => i.orphan);
      else if (da.filter.indexOf('p:') === 0) l = l.filter(i => i.prefix === da.filter.slice(2));
      l = l.slice();
      if (da.sort === 'big') l.sort((a, b) => b.size - a.size);
      else if (da.sort === 'old') l.sort((a, b) => String(a.created).localeCompare(String(b.created)));
      else l.sort((a, b) => String(b.created).localeCompare(String(a.created)));
      return l;
    }
    function daRenderPhotos() {
      const all = da.items || [];
      const orphans = all.filter(i => i.orphan), orphanB = orphans.reduce((a, i) => a + i.size, 0), totalB = all.reduce((a, i) => a + i.size, 0);
      const pre = {}; all.forEach(i => { pre[i.prefix] = (pre[i.prefix] || 0) + 1; });
      const chip = (k, label) => `<button type="button" class="ui-chip${da.filter === k ? ' active' : ''}" onclick="daSetFilter('${k}')">${escapeHtml(label)}</button>`;
      const list = daVisible(), shown = list.slice(0, da.shown);
      const selB = Array.from(da.sel).reduce((a, n) => a + ((all.find(i => i.name === n) || {}).size || 0), 0);
      da.m.setBody(`${da.refsErr ? `<p class="rs-err">⚠️ ${escapeHtml(da.refsErr)}</p>` : ''}
        <div class="tp-summary" style="padding:0 0 .5rem"><span><b>${all.length}</b> Fotos</span><span><b>${daFmt(totalB)}</b> belegt</span><span class="${orphans.length ? 'ft-sum-warn' : ''}"><b>${orphans.length}</b> nicht verwendet (${daFmt(orphanB)})</span></div>
        <div class="da-chips">${chip('all', 'Alle (' + all.length + ')')}${chip('used', 'In Gebrauch (' + all.filter(i => i.used).length + ')')}${chip('orphan', '⚠️ Nicht verwendet (' + orphans.length + ')')}${Object.keys(pre).sort((a, b) => pre[b] - pre[a]).slice(0, 8).map(p => chip('p:' + p, daPrefixName(p) + ' (' + pre[p] + ')')).join('')}</div>
        <div class="da-bar"><select class="ui-field da-sort" onchange="daSetSort(this.value)"><option value="new"${da.sort === 'new' ? ' selected' : ''}>Neueste zuerst</option><option value="big"${da.sort === 'big' ? ' selected' : ''}>Größte zuerst</option><option value="old"${da.sort === 'old' ? ' selected' : ''}>Älteste zuerst</option></select>
          <button type="button" class="fm-btn" onclick="daSelectVisible()">☑ Alle ${list.length} auswählen</button>
          <button type="button" class="fm-btn" onclick="daClearSel()">Auswahl leeren</button></div>
        ${shown.length ? `<div class="da-grid">${shown.map(daCardHtml).join('')}</div>` : '<p class="staff-empty">Keine Fotos in dieser Ansicht.</p>'}
        ${list.length > shown.length ? `<div style="text-align:center;margin-top:.6rem"><button type="button" class="ui-btn-ghost" onclick="da.shown += 60; daRenderPhotos()">Mehr anzeigen (${list.length - shown.length} weitere)</button></div>` : ''}
        <p class="fm-hint" style="margin-top:.6rem">„Nicht verwendet“ = kein Eintrag in der Datenbank verweist auf das Foto (und es ist älter als 1 Tag). Solche Fotos entstehen z. B., wenn jemand ein Foto hochlädt und abbricht. Prüfe stichprobenartig, bevor du alle löschst. Wenn die Prüfung der Verwendung nicht möglich war, steht oben eine Warnung: dann nichts als „nicht verwendet“ löschen.</p>`);
      const orphanBtn = orphans.length ? `<button type="button" class="fm-btn fm-btn-danger" onclick="daDeleteOrphans()">🗑 Alle ${orphans.length} nicht verwendeten (${daFmt(orphanB)})</button>` : '';
      da.m.setFoot(`<div class="da-foot">${orphanBtn}<button type="button" class="fm-btn fm-btn-danger" ${da.sel.size ? '' : 'disabled'} onclick="daDeleteSelected()">🗑 Auswahl löschen (${da.sel.size} · ${daFmt(selB)})</button><button type="button" class="ui-btn-primary" onclick="fmClose('daModal')">Fertig</button></div>`);
    }
    function daCardHtml(i) {
      const url = daUrl(i.thumb || i.name), sel = da.sel.has(i.name);
      const when = i.created ? new Date(i.created).toLocaleDateString('de-AT') : '';
      const chips = i.used ? i.sources.map(s => `<span class="da-chip ok">${escapeHtml(s)}</span>`).join('') : (i.orphan ? '<span class="da-chip bad">nicht verwendet</span>' : '<span class="da-chip">neu</span>');
      return `<div class="da-item${sel ? ' sel' : ''}"><label class="da-check"><input type="checkbox" ${sel ? 'checked' : ''} onchange="daToggle(${jsArg(i.name)}, this.checked)"></label>
        <img src="${escapeHtml(url)}" loading="lazy" alt="" onclick="openPhotoPreview(${jsArg(daUrl(i.name))})" onerror="this.onerror=null;this.src=${jsArg(daUrl(i.name))}">
        <div class="da-meta"><b>${daFmt(i.size)}</b><span>${escapeHtml(when)}</span></div><div class="da-chips2">${chips}</div></div>`;
    }
    function daSetFilter(k) { da.filter = k; da.shown = 60; daRenderPhotos(); }
    function daSetSort(v) { da.sort = v; daRenderPhotos(); }
    function daToggle(name, on) { if (on) da.sel.add(name); else da.sel.delete(name); daRenderPhotos(); }
    function daSelectVisible() { daVisible().forEach(i => da.sel.add(i.name)); daRenderPhotos(); }
    function daClearSel() { da.sel = new Set(); daRenderPhotos(); }
    async function daDeleteNames(names) {
      const items = names.map(n => (da.items || []).find(i => i.name === n)).filter(Boolean);
      const files = []; items.forEach(i => { files.push(i.name); if (i.thumb) files.push(i.thumb); });
      let removed = 0;
      for (let k = 0; k < files.length; k += 100) {
        const r = await daEdge({ action: 'delete', paths: files.slice(k, k + 100) });
        if (r.error) { fmToast(r.error); break; }
        removed += r.data.removed;
      }
      fmToast('✓ ' + removed + ' Dateien gelöscht');
      await daLoadPhotos();
    }
    async function daDeleteSelected() {
      const names = Array.from(da.sel); if (!names.length) return;
      const items = names.map(n => da.items.find(i => i.name === n)).filter(Boolean);
      const used = items.filter(i => i.used);
      const sz = items.reduce((a, i) => a + i.size, 0);
      if (!confirm(`${items.length} Fotos (${daFmt(sz)}) endgültig löschen?` + (used.length ? `\n\n⚠️ ${used.length} davon werden noch verwendet (${Array.from(new Set(used.flatMap(i => i.sources))).join(', ')}). Dort erscheint danach ein kaputtes Bild.` : '') + '\n\nDas kann nicht rückgängig gemacht werden.')) return;
      await daDeleteNames(names);
    }
    async function daDeleteOrphans() {
      if (!da.refsOk) return alert('Die Prüfung, welche Fotos verwendet werden, ist fehlgeschlagen. Deshalb wird nichts gelöscht.');
      const o = (da.items || []).filter(i => i.orphan); if (!o.length) return;
      if (!confirm(`${o.length} nicht verwendete Fotos (${daFmt(o.reduce((a, i) => a + i.size, 0))}) endgültig löschen?\nKein Eintrag in der Datenbank verweist darauf. Das kann nicht rückgängig gemacht werden.`)) return;
      await daDeleteNames(o.map(i => i.name));
    }

    // ---------- 🧹 Aufbewahrung ----------
    async function daLoadRules() {
      da.m.setBody('<p class="staff-empty">Lade ...</p>');
      const { data, error } = await _supabase.rpc('retention_list');
      if (error) { da.m.setBody(daErrHtml(error)); return; }
      da.rules = data.rules; da.cfg = data.config; da.trash = Number(data.trash || 0); da.cron = !!data.cron;
      daRenderRules();
    }
    function daRenderRules() {
      const c = da.cfg || {};
      const row = r => `<div class="da-rule${r.enabled ? ' on' : ''}" data-key="${escapeHtml(r.key)}">
        <label class="da-rule-top"><span class="switch"><input type="checkbox" class="da-r-en" ${r.enabled ? 'checked' : ''}><span class="switch-track"></span></span>
          <b>${escapeHtml(r.label)}</b>${r.files ? ' <span class="da-chip ok">📷 + Fotos</span>' : ''}</label>
        <div class="da-rule-set">älter als <input type="number" class="ui-field da-r-days" min="${r.min_days}" max="3650" value="${r.keep_days}"> Tage löschen <small>(mindestens ${r.min_days})</small></div>
        <div class="fm-hint">${escapeHtml(r.descr)}${r.last_run_at ? ' · Letzter Lauf: ' + escapeHtml(new Date(r.last_run_at).toLocaleDateString('de-AT')) + ', ' + r.last_deleted + ' gelöscht' : ''}</div></div>`;
      da.m.setBody(`<div class="rs-box rs-warn"><h4>⚠️ Wichtig</h4><p class="rs-small">Gelöschte Daten sind endgültig weg (kein Papierkorb). Alle Regeln sind standardmäßig <b>aus</b>. Schalte nur ein, was du nicht mehr brauchst. Mit „👁 Probelauf“ siehst du vorher, wie viel gelöscht würde. Temperaturprotokolle und Personaldaten haben gesetzliche Aufbewahrungsfristen: dafür gelten Mindestwerte.</p></div>
        <h4 class="dw-group">Zeitplan</h4>
        <div class="da-sched">
          <label class="switch-row"><span>Automatisch ausführen</span><span class="switch"><input type="checkbox" id="daAuto" ${c.auto ? 'checked' : ''}><span class="switch-track"></span></span></label>
          <div class="fm-row-flex" style="gap:.6rem;flex-wrap:wrap;align-items:center">alle <select id="daEvery" class="ui-field da-sel">${[1, 3, 7, 14, 30].map(n => `<option value="${n}"${Number(c.every_days) === n ? ' selected' : ''}>${n} ${n === 1 ? 'Tag' : 'Tage'}</option>`).join('')}</select>
            um <input type="number" id="daHour" class="ui-field da-r-days" min="0" max="23" value="${c.run_hour == null ? 2 : c.run_hour}"> Uhr (UTC) <small>= ${(((c.run_hour == null ? 2 : c.run_hour) + 1) % 24)} Uhr Winter / ${(((c.run_hour == null ? 2 : c.run_hour) + 2) % 24)} Uhr Sommerzeit</small></div>
          <div class="fm-hint">${da.cron ? '✅ pg_cron ist aktiv.' : '⚠️ pg_cron ist nicht aktiv (Supabase → Database → Extensions). Ohne pg_cron läuft nichts automatisch, „Jetzt ausführen“ geht aber immer.'}${c.last_note ? ' · ' + escapeHtml(c.last_note) : ''}</div></div>
        <h4 class="dw-group">Regeln</h4>
        <div class="da-rules">${(da.rules || []).map(row).join('')}</div>
        ${da.trash ? `<p class="rs-err">🗑 ${da.trash} Foto-Dateien warten auf das Löschen. <button type="button" class="fm-btn" onclick="daRunTrash()">Jetzt löschen</button></p>` : ''}`);
      da.m.setFoot(`<div class="da-foot"><button type="button" class="fm-btn" onclick="daSaveRules(false)">💾 Speichern</button><button type="button" class="fm-btn" onclick="daDryRun()">👁 Probelauf</button><button type="button" class="fm-btn fm-btn-danger" onclick="daRunNow()">▶ Jetzt ausführen</button><button type="button" class="ui-btn-primary" onclick="fmClose('daModal')">Fertig</button></div>`);
    }
    function daCollect() {
      return Array.from(da.m.body.querySelectorAll('.da-rule')).map(el => ({ key: el.dataset.key, enabled: el.querySelector('.da-r-en').checked, keep_days: parseInt(el.querySelector('.da-r-days').value, 10) }));
    }
    async function daSaveRules(silent) {
      const rules = daCollect();
      if (rules.some(r => !r.keep_days || r.keep_days < 1)) { fmToast('Bitte bei jeder Regel eine Anzahl Tage eintragen.'); return false; }
      const a = await _supabase.rpc('retention_save', { p_rules: rules });
      if (a.error) { fmToast(daErr(a.error)); return false; }
      const s = await _supabase.rpc('retention_set_schedule', { p_auto: document.getElementById('daAuto').checked, p_every: parseInt(document.getElementById('daEvery').value, 10), p_hour: parseInt(document.getElementById('daHour').value, 10) || 0 });
      if (s.error) { fmToast(daErr(s.error)); return false; }
      if (!silent) { fmToast('✓ ' + (s.data || 'Gespeichert')); await daLoadRules(); }
      return true;
    }
    function daSummaryHtml(rows) {
      return rows.length ? '<div class="da-rows">' + rows.map(r => `<div class="da-row"><span>${escapeHtml(r.label)}</span><span>älter als ${r.keep_days} Tage</span><b>${r.affected}</b></div>`).join('') + '</div>' : '<p class="staff-empty">Keine Regel eingeschaltet.</p>';
    }
    async function daDryRun() {
      if (!await daSaveRules(true)) return;
      const { data, error } = await _supabase.rpc('db_cleanup_run', { p_dry: true });
      if (error) return fmToast(daErr(error));
      const m = fmOpen('daDry', { title: '👁 Probelauf', sub: 'So viele Einträge würden jetzt gelöscht. Es wird nichts verändert.', layer: 2 });
      m.setBody(daSummaryHtml(data || []));
      m.setFoot('<button type="button" class="ui-btn-primary" onclick="fmClose(\'daDry\')">OK</button>');
    }
    async function daRunNow() {
      if (!await daSaveRules(true)) return;
      const dry = await _supabase.rpc('db_cleanup_run', { p_dry: true });
      if (dry.error) return fmToast(daErr(dry.error));
      const rows = dry.data || [], total = rows.reduce((a, r) => a + Number(r.affected), 0);
      if (!rows.length) return alert('Es ist keine Regel eingeschaltet.');
      if (!confirm(rows.map(r => '• ' + r.label + ' (älter als ' + r.keep_days + ' Tage): ' + r.affected).join('\n') + '\n\nInsgesamt ' + total + ' Einträge werden endgültig gelöscht. Fortfahren?')) return;
      fmToast('Aufräumen läuft ...');
      const e = await daEdge({ action: 'cleanup' });
      if (e.error) {   // Edge Function fehlt: Einträge trotzdem per Datenbank löschen, Foto-Dateien bleiben in der Warteschlange
        const r = await _supabase.rpc('db_cleanup_run', { p_dry: false });
        if (r.error) return fmToast(daErr(r.error));
        alert('Die Einträge wurden gelöscht.\nDie zugehörigen Foto-Dateien wurden NICHT gelöscht, weil die Funktion db-admin nicht erreichbar ist (' + e.error + ').\nSie warten in der Warteschlange und werden gelöscht, sobald die Funktion eingerichtet ist.');
      } else fmToast('✓ Aufgeräumt: ' + total + ' Einträge, ' + ((e.data.trash && e.data.trash.files) || 0) + ' Dateien');
      await daLoadRules();
    }
    async function daRunTrash() {
      const e = await daEdge({ action: 'trash' });
      if (e.error) return alert(e.error);
      fmToast('✓ ' + (e.data.files || 0) + ' Dateien gelöscht');
      await daLoadRules();
    }

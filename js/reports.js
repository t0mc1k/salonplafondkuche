/* ============================================================
   js/reports.js  (v3.2.03)
   Zwei getrennte Funktionen (Fundsachen wurde in der Küchen-Version entfernt):
   1) Störungen melden (Geräte/Ausstattung) – sichtbar für Melder + Manager/Developer
   3) Verluste / Bruch (Geschirr, Verschüttetes, verdorbene Ware, Abschreibungen)
   Tabellen: maintenance_reports, loss_reports
   Fotos: gleicher Speicher wie Rezepte/Chat (Bucket „photos“).
   ============================================================ */

    // ---------------------------------------------------------------
    // 1) STÖRUNGEN
    // ---------------------------------------------------------------
    // TESTLISTE: hier einfach Bereiche und Geräte anpassen/ergänzen.
    const MAINT_LOCATIONS = {
      'Küche': ['Herd / Backofen', 'Kombidämpfer', 'Kühlschrank / Kühlung', 'Tiefkühler', 'Fritteuse / Grill', 'Dunstabzug', 'Spüle / Wasserhahn', 'Beleuchtung', 'Bonprinter / Bildschirm'],
      'Patisserie': ['Backofen', 'Kühlung', 'Mixer / Schlagmaschine', 'Teigausroller', 'Waage'],
      'Spülküche': ['Geschirrspüler', 'Abfluss / Fettabscheider', 'Wasser / Boiler', 'Regale', 'Müll / Entsorgung'],
      'Lager / Kühlraum': ['Kühlraum', 'Tiefkühlraum', 'Regale', 'Tür / Dichtung', 'Beleuchtung'],
      'WC / Garderobe': ['Wasser / Spülung', 'Licht', 'Seife / Papier-Spender', 'Spind / Schloss'],
      'Sonstiges': ['Sonstiges']
    };
    const MAINT_URGENCY = { normal: ['Normal', 'gray'], dringend: ['Dringend', 'amber'], notfall: ['Notfall', 'red'] };
    const MAINT_STATUS = { neu: ['Neu', 'amber'], in_arbeit: ['In Arbeit', 'blue'], erledigt: ['Erledigt', 'green'] };

    let mt = { m: null, list: [], filter: 'open', photoUrl: '' };

    async function openMaintenanceModal() {
      closeSettingsMenu();
      mt.filter = userIsAdmin ? 'open' : 'all';
      mt.m = fmOpen('mtModal', {
        title: userIsAdmin ? '🛠️ Störungen' : '🛠️ Störung melden',
        sub: userIsAdmin ? 'Gemeldete Defekte. Nur Manager/Developer sehen alle Meldungen.' : 'Etwas kaputt? Melde es hier direkt dem Manager.'
      });
      mt.m.setBody('<p class="staff-empty">Lade ...</p>');
      await mtLoad();
    }

    async function mtLoad() {
      const { data, error } = await _supabase.from('maintenance_reports').select('*').order('created_at', { ascending: false }).limit(300);
      if (error) { mt.m.setBody(fmErrorHtml(error)); return; }
      mt.list = data || [];
      mtRender();
    }

    function mtRender() {
      const open = mt.list.filter(r => r.status !== 'erledigt').length;
      mt.m.setToolbar(`<div class="fm-row-flex" style="justify-content:space-between">
          ${userIsAdmin ? `<div class="fm-tabs">
            <button type="button" class="fm-tab${mt.filter === 'open' ? ' active' : ''}" onclick="mtSetFilter('open')">Offen<small>${open}</small></button>
            <button type="button" class="fm-tab${mt.filter === 'all' ? ' active' : ''}" onclick="mtSetFilter('all')">Alle</button></div>` : '<span class="fm-hint">Deine Meldungen</span>'}
          <button type="button" class="ui-btn-primary" onclick="mtOpenForm()">➕ Störung melden</button>
        </div>`);
      const list = mt.list.filter(r => mt.filter === 'all' || r.status !== 'erledigt');
      let html = list.length ? '' : `<p class="staff-empty">${userIsAdmin ? 'Keine offenen Störungen. 👍' : 'Du hast noch nichts gemeldet.'}</p>`;
      html += list.map(r => {
        const u = MAINT_URGENCY[r.urgency] || ['', 'gray'], st = MAINT_STATUS[r.status] || [r.status, 'gray'];
        const photo = r.photo_url ? `<a href="${escapeHtml(r.photo_url)}" target="_blank" rel="noopener"><img class="fm-thumb" src="${escapeHtml(r.photo_url)}" alt="Foto" loading="lazy"></a>` : '';
        const adminBtns = userIsAdmin ? `<div class="fm-item-actions">
            ${r.status !== 'in_arbeit' ? `<button type="button" class="fm-btn" onclick="mtSetStatus(${jsArg(r.id)}, 'in_arbeit')">In Arbeit</button>` : ''}
            ${r.status !== 'erledigt' ? `<button type="button" class="fm-btn fm-btn-ok" onclick="mtSetStatus(${jsArg(r.id)}, 'erledigt')">✓ Erledigt</button>` : `<button type="button" class="fm-btn" onclick="mtSetStatus(${jsArg(r.id)}, 'neu')">Wieder öffnen</button>`}
            <button type="button" class="fm-btn" onclick="mtNote(${jsArg(r.id)})">📝 Notiz</button>
            <button type="button" class="fm-btn fm-btn-danger" onclick="mtDelete(${jsArg(r.id)})">🗑</button></div>` : '';
        return `<div class="fm-item">${photo}
          <div class="fm-item-main">
            <div class="fm-row-flex" style="justify-content:space-between;flex-wrap:nowrap">
              <div class="fm-item-title">${escapeHtml(r.device)} <span class="fm-hint">· ${escapeHtml(r.area)}</span></div>
              <div style="white-space:nowrap">${r.urgency !== 'normal' ? fmStatusChip(u[0], u[1]) + ' ' : ''}${fmStatusChip(st[0], st[1])}</div>
            </div>
            ${r.description ? `<div class="fm-item-sub">${escapeHtml(r.description)}</div>` : ''}
            <div class="fm-item-sub">${escapeHtml(r.reported_by)} · ${escapeHtml(fmDateTime(r.created_at))}${r.resolved_at ? ' · erledigt ' + escapeHtml(fmDateTime(r.resolved_at)) + (r.resolved_by ? ' von ' + escapeHtml(r.resolved_by) : '') : ''}</div>
            ${r.manager_note ? `<div class="fm-item-sub">📝 ${escapeHtml(r.manager_note)}</div>` : ''}
            ${adminBtns}
          </div></div>`;
      }).join('');
      mt.m.setBody(html);
      mt.m.setFoot('<button type="button" class="ui-btn-primary" onclick="fmClose(\'mtModal\')">Fertig</button>');
    }

    function mtSetFilter(f) { mt.filter = f; mtRender(); }

    function mtOpenForm() {
      mt.photoUrl = '';
      const m = fmOpen('mtForm', { title: '🛠️ Störung melden', layer: 2 });
      m.setBody(`<div class="fm-stack">
        <div class="fm-grid2">
          <div class="fm-field"><label class="form-label" for="mtArea">Bereich</label>
            <select id="mtArea" class="ui-field" onchange="mtFillDevices()">${Object.keys(MAINT_LOCATIONS).map(a => `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join('')}</select></div>
          <div class="fm-field"><label class="form-label" for="mtDevice">Was ist kaputt?</label>
            <select id="mtDevice" class="ui-field" onchange="mtDeviceChanged()"></select></div>
        </div>
        <div class="fm-field hidden" id="mtOtherBox"><label class="form-label" for="mtOther">Gerät / Ort genauer</label>
          <input type="text" id="mtOther" class="ui-field" maxlength="80"></div>
        <div class="fm-field"><label class="form-label" for="mtDesc">Was ist das Problem?</label>
          <textarea id="mtDesc" class="ui-field" rows="3" maxlength="500" placeholder="z. B. Es kommt kein Wasser aus dem Hahn"></textarea></div>
        <div class="fm-field"><label class="form-label">Wie dringend?</label>
          <div class="fm-tabs" id="mtUrg">${Object.keys(MAINT_URGENCY).map(k => `<button type="button" class="fm-tab${k === 'normal' ? ' active' : ''}" data-u="${k}" onclick="mtPickUrgency('${k}')">${MAINT_URGENCY[k][0]}</button>`).join('')}</div>
          <p class="fm-hint">Notfall = Gefahr oder Betrieb geht nicht weiter (z. B. Wasser läuft aus).</p></div>
        <div class="fm-field"><label class="form-label">Foto (optional)</label>
          <input type="file" id="mtPhoto" accept="image/*" capture="environment" onchange="mtPhotoPicked(this)" class="ui-field">
          <div id="mtPhotoStatus" class="fm-hint"></div></div>
        <input type="hidden" id="mtUrgency" value="normal">
      </div>`);
      m.setFoot(`<button type="button" class="ui-btn-ghost" onclick="fmClose('mtForm')">Abbrechen</button>
        <button type="button" class="ui-btn-primary" id="mtSendBtn" onclick="mtSubmit()">Absenden</button>`);
      mtFillDevices();
    }

    function mtFillDevices() {
      const area = document.getElementById('mtArea').value;
      const devs = (MAINT_LOCATIONS[area] || []).slice();
      if (devs.indexOf('Sonstiges') === -1) devs.push('Sonstiges');
      document.getElementById('mtDevice').innerHTML = devs.map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('');
      trDom(document.getElementById('mtDevice'));
      mtDeviceChanged();
    }
    function mtDeviceChanged() {
      document.getElementById('mtOtherBox').classList.toggle('hidden', document.getElementById('mtDevice').value !== 'Sonstiges');
    }
    function mtPickUrgency(k) {
      document.getElementById('mtUrgency').value = k;
      document.querySelectorAll('#mtUrg .fm-tab').forEach(b => b.classList.toggle('active', b.dataset.u === k));
    }
    async function mtPhotoPicked(input) {
      const f = input.files && input.files[0];
      if (!f) return;
      const st = document.getElementById('mtPhotoStatus');
      st.textContent = fmTr('⏳ Foto wird hochgeladen ...');
      try { mt.photoUrl = await fmUploadPhoto(f, 'stoerung'); st.textContent = fmTr('✔ Foto hochgeladen'); }
      catch (e) { mt.photoUrl = ''; st.textContent = fmL('Fehler: ', 'Error: ') + (e.message || e); }
    }
    async function mtSubmit() {
      const area = document.getElementById('mtArea').value;
      let device = document.getElementById('mtDevice').value;
      const other = document.getElementById('mtOther').value.trim();
      const desc = document.getElementById('mtDesc').value.trim();
      if (device === 'Sonstiges' && other) device = other;
      if (!desc && device === 'Sonstiges') return fmToast('Bitte beschreibe das Problem kurz.');
      const btn = document.getElementById('mtSendBtn'); btn.disabled = true;
      const { error } = await _supabase.from('maintenance_reports').insert([{
        area, device, description: desc || null, urgency: document.getElementById('mtUrgency').value,
        photo_url: mt.photoUrl || null, reported_by: currentWaiterName
      }]);
      btn.disabled = false;
      if (error) return fmToast(fmDbError(error));
      fmClose('mtForm');
      fmToast('Störung gemeldet. Der Manager sieht sie sofort.');
      await mtLoad();
      if (typeof loadDashboardCounts === 'function') loadDashboardCounts(true);
    }
    async function mtSetStatus(id, status) {
      const { error } = await _supabase.from('maintenance_reports').update({ status }).eq('id', id);
      if (error) return fmToast(fmDbError(error));
      await mtLoad();
      if (typeof loadDashboardCounts === 'function') loadDashboardCounts(true);
    }
    async function mtNote(id) {
      const r = mt.list.find(x => x.id === id);
      const note = prompt('Notiz zur Störung (z. B. „Techniker kommt Montag“):', (r && r.manager_note) || '');
      if (note === null) return;
      const { error } = await _supabase.from('maintenance_reports').update({ manager_note: note.trim() || null }).eq('id', id);
      if (error) return fmToast(fmDbError(error));
      await mtLoad();
    }
    async function mtDelete(id) {
      if (!confirm('Meldung endgültig löschen?')) return;
      const { error } = await _supabase.from('maintenance_reports').delete().eq('id', id);
      if (error) return fmToast(fmDbError(error));
      await mtLoad();
      if (typeof loadDashboardCounts === 'function') loadDashboardCounts(true);
    }

    // ---------------------------------------------------------------
    // 3) VERLUSTE / BRUCH
    // ---------------------------------------------------------------
    const LS_REASONS = { bruch: '🔨 Bruch', verschuettet: '💧 Verschüttet', abschreibung: '📉 Abschreibung', sonstiges: '📦 Sonstiges' };
    let ls = { m: null, list: [], year: 0, month: 0 };

    async function openLossModal() {
      closeSettingsMenu();
      const now = new Date();
      ls.year = now.getFullYear(); ls.month = now.getMonth() + 1;
      ls.m = fmOpen('lsModal', {
        title: '🔨 Verluste & Bruch',
        sub: userIsAdmin ? 'Alle Meldungen des Teams, mit Monatsübersicht.' : 'Melde Bruch oder Verluste. Du siehst deine eigenen Meldungen.',
        wide: !!userIsAdmin
      });
      ls.m.setBody('<p class="staff-empty">Lade ...</p>');
      await lsLoad();
    }

    function lsShiftMonth(d) {
      ls.month += d;
      if (ls.month < 1) { ls.month = 12; ls.year--; }
      if (ls.month > 12) { ls.month = 1; ls.year++; }
      lsLoad();
    }

    async function lsLoad() {
      const first = ls.year + '-' + String(ls.month).padStart(2, '0') + '-01';
      const last = ls.year + '-' + String(ls.month).padStart(2, '0') + '-' + String(new Date(ls.year, ls.month, 0).getDate()).padStart(2, '0');
      const { data, error } = await _supabase.from('loss_reports').select('*').gte('loss_date', first).lte('loss_date', last)
        .order('loss_date', { ascending: false }).order('created_at', { ascending: false });
      if (error) { ls.m.setBody(fmErrorHtml(error)); return; }
      ls.list = data || [];
      lsRender();
    }

    function lsRender() {
      ls.m.setToolbar(`<div class="fm-row-flex" style="justify-content:space-between">
          <div class="tp-monthnav">
            <button type="button" onclick="lsShiftMonth(-1)" class="ui-btn-ghost" aria-label="Vorheriger Monat">‹</button>
            <b class="tp-month-label">${FM_MONTHS[ls.month - 1]} ${ls.year}</b>
            <button type="button" onclick="lsShiftMonth(1)" class="ui-btn-ghost" aria-label="Nächster Monat">›</button>
          </div>
          <div class="fm-row-flex">
            ${userIsAdmin ? '<button type="button" class="ui-btn-ghost" onclick="lsExport()">📗 Excel</button>' : ''}
            <button type="button" class="ui-btn-primary" onclick="lsOpenForm()">➕ Melden</button>
          </div></div>`);

      let html = '';
      if (userIsAdmin && ls.list.length) {
        const byReason = {}, byItem = {};
        ls.list.forEach(r => {
          byReason[r.reason] = (byReason[r.reason] || 0) + r.quantity;
          const k = r.item.trim().toLowerCase();
          byItem[k] = byItem[k] || { name: r.item.trim(), qty: 0 };
          byItem[k].qty += r.quantity;
        });
        const top = Object.values(byItem).sort((a, b) => b.qty - a.qty).slice(0, 5);
        html += `<div class="form-section" style="margin-bottom:.9rem">
          <div class="form-section-title">Übersicht ${FM_MONTHS[ls.month - 1]}</div>
          <div class="fm-row-flex">${Object.keys(LS_REASONS).filter(k => byReason[k]).map(k => `<span class="fm-chip fm-chip-amber">${LS_REASONS[k]}: ${byReason[k]}</span>`).join('')}</div>
          <p class="fm-hint" style="margin-top:.5rem">Am häufigsten: ${top.map(t => escapeHtml(t.name) + ' (' + t.qty + ')').join(', ')}</p></div>`;
      }
      html += ls.list.length ? '' : '<p class="staff-empty">In diesem Monat gibt es keine Meldungen.</p>';
      html += ls.list.map(r => `<div class="fm-item">
          <div class="fm-item-main">
            <div class="fm-row-flex" style="justify-content:space-between;flex-wrap:nowrap">
              <div class="fm-item-title">${r.quantity} × ${escapeHtml(r.item)}</div>
              <span class="fm-chip fm-chip-gray">${escapeHtml(LS_REASONS[r.reason] || r.reason)}</span>
            </div>
            <div class="fm-item-sub">${escapeHtml(fmDayLabel(r.loss_date))} · ${escapeHtml(r.reported_by)}${r.note ? ' · ' + escapeHtml(r.note) : ''}</div>
            ${userIsAdmin ? `<div class="fm-item-actions"><button type="button" class="fm-btn fm-btn-danger" onclick="lsDelete(${jsArg(r.id)})">🗑</button></div>` : ''}
          </div></div>`).join('');
      ls.m.setBody(html);
      ls.m.setFoot('<button type="button" class="ui-btn-primary" onclick="fmClose(\'lsModal\')">Fertig</button>');
    }

    function lsOpenForm() {
      const names = Array.from(new Set((typeof allDrinks !== 'undefined' ? allDrinks : []).map(d => d.name))).slice(0, 500);
      const m = fmOpen('lsForm', { title: '🔨 Verlust / Bruch melden', layer: 2 });
      m.setBody(`<div class="fm-stack">
        <div class="fm-field"><label class="form-label" for="lsItem">Was?</label>
          <input type="text" id="lsItem" class="ui-field" list="lsItems" maxlength="120" placeholder="z. B. Teller, GN-Behälter, Pfanne, verdorbene Ware" autocomplete="off">
          <datalist id="lsItems">${names.map(n => `<option value="${escapeHtml(n)}">`).join('')}<option value="Teller"><option value="Schüssel"><option value="Glas"><option value="GN-Behälter"><option value="Pfanne"><option value="Messer"><option value="Verdorbene Ware"><option value="Verbranntes Essen"></datalist></div>
        <div class="fm-grid2">
          <div class="fm-field"><label class="form-label" for="lsQty">Anzahl</label>
            <input type="number" id="lsQty" class="ui-field" min="1" max="999" value="1"></div>
          <div class="fm-field"><label class="form-label" for="lsDate">Datum</label>
            <input type="date" id="lsDate" class="ui-field" value="${fmBizDate()}"></div>
        </div>
        <div class="fm-field"><label class="form-label">Grund</label>
          <div class="fm-tabs" id="lsReasonTabs">${Object.keys(LS_REASONS).map(k => `<button type="button" class="fm-tab${k === 'bruch' ? ' active' : ''}" data-r="${k}" onclick="lsPickReason('${k}')">${LS_REASONS[k]}</button>`).join('')}</div></div>
        <div class="fm-field"><label class="form-label" for="lsNote">Notiz (optional)</label>
          <input type="text" id="lsNote" class="ui-field" maxlength="150"></div>
        <input type="hidden" id="lsReason" value="bruch">
      </div>`);
      m.setFoot(`<button type="button" class="ui-btn-ghost" onclick="fmClose('lsForm')">Abbrechen</button>
        <button type="button" class="ui-btn-primary" onclick="lsSubmit()">💾 Speichern</button>`);
    }
    function lsPickReason(k) {
      document.getElementById('lsReason').value = k;
      document.querySelectorAll('#lsReasonTabs .fm-tab').forEach(b => b.classList.toggle('active', b.dataset.r === k));
    }
    async function lsSubmit() {
      const item = document.getElementById('lsItem').value.trim();
      if (!item) return fmToast('Bitte angeben, was es war.');
      const qty = Math.max(1, Math.min(999, parseInt(document.getElementById('lsQty').value, 10) || 1));
      const { error } = await _supabase.from('loss_reports').insert([{
        item, quantity: qty, reason: document.getElementById('lsReason').value,
        note: document.getElementById('lsNote').value.trim() || null,
        loss_date: document.getElementById('lsDate').value || fmBizDate(), reported_by: currentWaiterName
      }]);
      if (error) return fmToast(fmDbError(error));
      fmClose('lsForm');
      fmToast('Gespeichert');
      await lsLoad();
    }
    async function lsDelete(id) {
      if (!confirm('Meldung löschen?')) return;
      const { error } = await _supabase.from('loss_reports').delete().eq('id', id);
      if (error) return fmToast(fmDbError(error));
      await lsLoad();
    }
    function lsExport() {
      if (typeof XLSX === 'undefined') return alert('Excel-Bibliothek nicht geladen.');
      if (!ls.list.length) return alert('Keine Daten zum Exportieren.');
      const aoa = [['Datum', 'Artikel', 'Anzahl', 'Grund', 'Notiz', 'Gemeldet von']];
      ls.list.slice().reverse().forEach(r => aoa.push([r.loss_date, r.item, r.quantity, (LS_REASONS[r.reason] || r.reason).replace(/^\S+\s/, ''), r.note || '', r.reported_by]));
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = [{ wch: 12 }, { wch: 28 }, { wch: 8 }, { wch: 14 }, { wch: 30 }, { wch: 16 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Verluste');
      XLSX.writeFile(wb, `Verluste_${ls.year}-${String(ls.month).padStart(2, '0')}.xlsx`);
    }

/* ============================================================
   js/specials.js  (v4.1.06)
   Tagesangebot: Tageskuchen und Tagessuppe mit Allergenen A–R

   - Alle Mitarbeiter sehen, was HEUTE angeboten wird (Name, Preis, Allergene), dazu „Kommend“.
   - Manager/Developer pflegen die Einträge (mit Gültigkeit von–bis) und können den Zettel per FOTO einlesen:
     Die KI (Edge Function scan-special) liest Namen und Allergen-Buchstaben, der Manager prüft das Ergebnis
     neben dem Foto und speichert erst nach Bestätigung. Das Foto wird nicht gespeichert.
   Tabelle: daily_specials (siehe sql/4.1.06_daily_specials.sql). Allergen-Buchstaben: AL_CODES aus menu-allergens.js.
   Weitere Arten (z. B. Tagesgericht): in SP_KINDS ergänzen (die Datenbank erlaubt 'dish' bereits).
   ============================================================ */

    const SP_KINDS = [
      { id: 'soup', icon: '🍲', de: 'Tagessuppe', en: 'Soup of the day' },
      { id: 'cake', icon: '🍰', de: 'Tageskuchen', en: 'Cake of the day' }
      // { id: 'dish', icon: '🍽️', de: 'Tagesgericht', en: 'Dish of the day' }   // später einschalten
    ];
    const SP_EXTRA = { id: 'dish', icon: '🍽️', de: 'Tagesgericht', en: 'Dish of the day' };   // nur Anzeige, falls schon vorhanden

    let sp = { m: null, tab: 'today', rows: [], edit: { id: '', allergens: [] }, scan: null };

    const spToday = () => fmIso(new Date());
    const spKindInfo = id => SP_KINDS.find(k => k.id === id) || (id === SP_EXTRA.id ? SP_EXTRA : { id, icon: '🍽️', de: id, en: id });
    const spKindLabel = id => { const k = spKindInfo(id); return k.icon + ' ' + fmL(k.de, k.en); };
    const spFmtDate = iso => fmParseIso(iso).toLocaleDateString(langLocale(), { day: '2-digit', month: '2-digit' });

    function spRangeText(r) {
      return r.valid_from === r.valid_to ? spFmtDate(r.valid_from) : spFmtDate(r.valid_from) + ' – ' + spFmtDate(r.valid_to);
    }

    function spErrorHtml(err) {
      const msg = (err && err.message) ? String(err.message) : String(err || '');
      const code = (err && err.code) ? String(err.code) : '';
      if (/does not exist|schema cache/i.test(msg) || code === '42P01' || /^PGRST20/.test(code)) {
        return `<p class="staff-empty" style="color:#ef4444">${escapeHtml(fmL(
          'Die Datenbank ist für diese Funktion noch nicht eingerichtet. Bitte zuerst sql/4.1.06_daily_specials.sql im Supabase SQL Editor ausführen.',
          'The database is not set up for this feature yet. Please run sql/4.1.06_daily_specials.sql in the Supabase SQL editor first.'))}</p>`;
      }
      return fmErrorHtml(err);
    }

    function spToastError(err) {
      const msg = (err && err.message) ? String(err.message) : String(err || '');
      if (/does not exist|schema cache/i.test(msg)) return fmToast(fmL('Bitte zuerst sql/4.1.06_daily_specials.sql ausführen.', 'Please run sql/4.1.06_daily_specials.sql first.'));
      fmToast(fmDbError(err));
    }

    // Klartext der Allergene (auf dem Handy gibt es keinen Tooltip) – Mehrdeutigkeit vermeiden
    function spAllergenText(list) {
      if (!list || !list.length) return fmL('Keine Allergene eingetragen', 'No allergens entered');
      return list.map(c => c + ' = ' + (AL_CODES[c] || c)).join(' · ');
    }

    // ---------------------------------------------------------------
    // Hauptfenster
    // ---------------------------------------------------------------
    function openSpecialsModal() {
      closeSettingsMenu();
      sp.m = fmOpen('spModal', {
        title: '🍰 ' + fmL('Tagesangebot', 'Daily specials'),
        sub: fmL('Kuchen und Suppe von heute – mit Allergenen', 'Cake and soup of today – with allergens')
      });
      sp.tab = 'today';
      sp.m.setBody('<p class="staff-empty">' + escapeHtml(fmL('Lade ...', 'Loading ...')) + '</p>');
      spLoad();
    }

    async function spLoad() {
      const since = fmIso(new Date(Date.now() - 45 * 86400000));
      const { data, error } = await _supabase.from('daily_specials').select('*').gte('valid_to', since)
        .order('valid_from', { ascending: true }).order('created_at', { ascending: true }).limit(400);
      if (error) { sp.m.setBody(spErrorHtml(error)); sp.m.setToolbar(''); sp.m.setFoot(''); return; }
      sp.rows = data || [];
      spRender();
    }

    function spSetTab(tab) { sp.tab = tab; spRender(); }

    function spLists() {
      const t = spToday();
      return {
        today: sp.rows.filter(r => r.valid_from <= t && r.valid_to >= t),
        upcoming: sp.rows.filter(r => r.valid_from > t),
        history: sp.rows.filter(r => r.valid_to < t).slice().reverse()
      };
    }

    function spRender() {
      const lists = spLists();
      const tabs = [['today', '📌 ' + fmL('Heute', 'Today'), 0], ['upcoming', '📅 ' + fmL('Kommend', 'Upcoming'), lists.upcoming.length]];
      if (userIsAdmin) tabs.push(['history', '📜 ' + fmL('Verlauf', 'History'), 0]);
      sp.m.setToolbar(`<div class="fm-tabs">${tabs.map(t =>
        `<button type="button" class="fm-tab${sp.tab === t[0] ? ' active' : ''}" onclick="spSetTab('${t[0]}')">${t[1]}${t[2] ? `<small>${t[2]}</small>` : ''}</button>`).join('')}
        <button type="button" class="fm-tab" onclick="faShowLegend()">ℹ️ A–R</button></div>`);

      let html = '';
      if (sp.tab === 'today') {
        const kinds = SP_KINDS.slice();
        lists.today.forEach(r => { if (!kinds.some(k => k.id === r.kind)) kinds.push(spKindInfo(r.kind)); });
        html = kinds.map(k => {
          const items = lists.today.filter(r => r.kind === k.id);
          return `<div class="sp-group"><h4 class="sp-head">${escapeHtml(k.icon + ' ' + fmL(k.de, k.en))}</h4>
            ${items.length ? items.map(r => spCardHtml(r, false)).join('') : `<p class="sp-none">${escapeHtml(fmL('Heute noch nichts eingetragen.', 'Nothing entered for today yet.'))}</p>`}</div>`;
        }).join('');
      } else {
        const list = lists[sp.tab] || [];
        html = list.length ? list.map(r => spCardHtml(r, true)).join('')
          : `<p class="staff-empty">${escapeHtml(sp.tab === 'upcoming' ? fmL('Nichts Kommendes eingetragen.', 'Nothing upcoming.') : fmL('Noch keine älteren Einträge.', 'No older entries yet.'))}</p>`;
      }
      html += `<p class="fm-hint" style="margin-top:.8rem">${escapeHtml(fmL(
        'Allergene nach EU-Verordnung 1169/2011 (A–R). Im Zweifel bitte in der Küche nachfragen.',
        'Allergens according to EU regulation 1169/2011 (A–R). If in doubt, please ask the kitchen.'))}</p>`;
      sp.m.setBody(html);

      sp.m.setFoot(userIsAdmin
        ? `<button type="button" class="ui-btn-ghost" onclick="fmClose('spModal')">${escapeHtml(fmL('Schließen', 'Close'))}</button>
           <button type="button" class="ui-btn-ghost" onclick="spEdit('')">➕ ${escapeHtml(fmL('Neu', 'New'))}</button>
           <button type="button" class="ui-btn-primary" onclick="spScanOpen()">📷 ${escapeHtml(fmL('Foto scannen', 'Scan photo'))}</button>`
        : `<button type="button" class="ui-btn-primary" onclick="fmClose('spModal')">${escapeHtml(fmL('Fertig', 'Done'))}</button>`);
    }

    function spCardHtml(r, showKind) {
      const price = r.price != null ? `<span class="sp-price">€ ${Number(r.price).toFixed(2).replace('.', ',')}</span>` : '';
      const admin = userIsAdmin ? `<div class="fm-item-actions">
          <button type="button" class="fm-btn" onclick="spEdit(${jsArg(r.id)})">✏️ ${escapeHtml(fmL('Bearbeiten', 'Edit'))}</button>
          <button type="button" class="fm-btn fm-btn-danger" onclick="spDelete(${jsArg(r.id)})">🗑 ${escapeHtml(fmL('Löschen', 'Delete'))}</button>
        </div>` : '';
      return `<div class="sp-card">
        <div class="sp-top"><b class="sp-name">${showKind ? escapeHtml(spKindLabel(r.kind)) + ' · ' : ''}${escapeHtml(r.name)}</b>${price}</div>
        ${r.description ? `<div class="sp-desc">${escapeHtml(r.description)}</div>` : ''}
        <div class="sp-al">${(r.allergens || []).length ? faLetterBadges(r.allergens) : ''}<span class="sp-al-text">${escapeHtml(spAllergenText(r.allergens))}</span></div>
        <div class="sp-meta">${escapeHtml(fmL('Gültig', 'Valid'))}: ${escapeHtml(spRangeText(r))}${r.source === 'scan' ? ' · 📷' : ''}</div>
        ${admin}
      </div>`;
    }

    // ---------------------------------------------------------------
    // Eintrag anlegen / bearbeiten (Manager/Developer)
    // ---------------------------------------------------------------
    function spLetterPickerHtml(selected, onclickName) {
      return `<div class="al-filter pick">${AL_ORDER.map(c =>
        `<button type="button" class="${selected.indexOf(c) !== -1 ? 'on' : ''}" title="${escapeHtml(AL_CODES[c])}" onclick="${onclickName}('${c}', this)">${c}</button>`).join('')}</div>`;
    }

    function spEdit(id) {
      if (!userIsAdmin) return;
      const it = id ? sp.rows.find(x => x.id === id) : null;
      sp.edit = { id: id || '', allergens: it ? (it.allergens || []).slice() : [] };
      const today = spToday();
      const m = fmOpen('spEdit', { title: it ? fmL('Eintrag bearbeiten', 'Edit entry') : fmL('Neuer Eintrag', 'New entry'), layer: 2 });
      m.setBody(`<div class="fm-stack">
        <div class="fm-grid2">
          <div class="fm-field"><label class="form-label" for="speKind">${escapeHtml(fmL('Art', 'Type'))}</label>
            <select id="speKind" class="ui-field">${SP_KINDS.concat(it && !SP_KINDS.some(k => k.id === it.kind) ? [spKindInfo(it.kind)] : []).map(k =>
              `<option value="${k.id}"${it && it.kind === k.id ? ' selected' : ''}>${escapeHtml(k.icon + ' ' + fmL(k.de, k.en))}</option>`).join('')}</select></div>
          <div class="fm-field"><label class="form-label" for="spePrice">${escapeHtml(fmL('Preis € (optional)', 'Price € (optional)'))}</label>
            <input type="number" id="spePrice" class="ui-field" min="0" step="0.10" value="${it && it.price != null ? it.price : ''}"></div>
        </div>
        <div class="fm-field"><label class="form-label" for="speName">${escapeHtml(fmL('Name', 'Name'))}</label>
          <input type="text" id="speName" class="ui-field" maxlength="120" value="${escapeHtml(it ? it.name : '')}" placeholder="${escapeHtml(fmL('z. B. Kürbiscremesuppe', 'e.g. pumpkin cream soup'))}"></div>
        <div class="fm-field"><label class="form-label" for="speDesc">${escapeHtml(fmL('Beschreibung (optional)', 'Description (optional)'))}</label>
          <input type="text" id="speDesc" class="ui-field" maxlength="300" value="${escapeHtml(it ? it.description || '' : '')}"></div>
        <div class="fm-field"><label class="form-label">${escapeHtml(fmL('Allergene', 'Allergens'))}</label>
          ${spLetterPickerHtml(sp.edit.allergens, 'speToggle')}
          <p class="fm-hint" id="speAlText"></p></div>
        <div class="fm-grid2">
          <div class="fm-field"><label class="form-label" for="speFrom">${escapeHtml(fmL('Gültig von', 'Valid from'))}</label>
            <input type="date" id="speFrom" class="ui-field" value="${it ? it.valid_from : today}" onchange="speSyncDates()"></div>
          <div class="fm-field"><label class="form-label" for="speTo">${escapeHtml(fmL('Gültig bis', 'Valid until'))}</label>
            <input type="date" id="speTo" class="ui-field" value="${it ? it.valid_to : today}"></div>
        </div>
        <div class="fm-row-flex" style="gap:.4rem;flex-wrap:wrap">
          <button type="button" class="fm-btn" onclick="speRange(0)">${escapeHtml(fmL('Nur heute', 'Today only'))}</button>
          <button type="button" class="fm-btn" onclick="speRange('sun')">${escapeHtml(fmL('Bis Sonntag', 'Until Sunday'))}</button>
          <button type="button" class="fm-btn" onclick="speRange(6)">${escapeHtml(fmL('7 Tage', '7 days'))}</button>
        </div>
      </div>`);
      m.setFoot(`<button type="button" class="ui-btn-ghost" onclick="fmClose('spEdit')">${escapeHtml(fmL('Abbrechen', 'Cancel'))}</button>
        <button type="button" class="ui-btn-primary" onclick="spSave()">💾 ${escapeHtml(fmL('Speichern', 'Save'))}</button>`);
      speUpdateText();
    }

    function speToggle(c, btn) {
      const i = sp.edit.allergens.indexOf(c);
      if (i === -1) sp.edit.allergens.push(c); else sp.edit.allergens.splice(i, 1);
      btn.classList.toggle('on');
      speUpdateText();
    }
    function speUpdateText() {
      const el = document.getElementById('speAlText');
      if (el) el.textContent = spAllergenText(sp.edit.allergens.slice().sort((a, b) => AL_ORDER.indexOf(a) - AL_ORDER.indexOf(b)));
    }
    function speSyncDates() {
      const f = document.getElementById('speFrom'), t = document.getElementById('speTo');
      if (f && t && f.value && (!t.value || t.value < f.value)) t.value = f.value;
    }
    // Schnellwahl: 0 = nur am Starttag, 6 = 7 Tage, 'sun' = bis zum kommenden Sonntag
    function speRange(mode) {
      const f = document.getElementById('speFrom'), t = document.getElementById('speTo');
      if (!f || !t) return;
      if (!f.value) f.value = spToday();
      const d = fmParseIso(f.value);
      if (mode === 'sun') d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
      else d.setDate(d.getDate() + mode);
      t.value = fmIso(d);
    }

    async function spSave() {
      const name = document.getElementById('speName').value.trim();
      if (!name) return fmToast(fmL('Bitte einen Namen eingeben.', 'Please enter a name.'));
      const from = document.getElementById('speFrom').value, to = document.getElementById('speTo').value || from;
      if (!from) return fmToast(fmL('Bitte ein Datum wählen.', 'Please choose a date.'));
      if (to < from) return fmToast(fmL('Das Ende liegt vor dem Beginn.', 'The end is before the start.'));
      const priceRaw = document.getElementById('spePrice').value;
      const payload = {
        kind: document.getElementById('speKind').value, name,
        description: document.getElementById('speDesc').value.trim() || null,
        price: priceRaw === '' ? null : Math.round(parseFloat(priceRaw) * 100) / 100,
        allergens: sp.edit.allergens.slice().sort((a, b) => AL_ORDER.indexOf(a) - AL_ORDER.indexOf(b)),
        valid_from: from, valid_to: to
      };
      let res;
      if (sp.edit.id) res = await _supabase.from('daily_specials').update(payload).eq('id', sp.edit.id);
      else res = await _supabase.from('daily_specials').insert([Object.assign({ source: 'manual', created_by: currentWaiterName }, payload)]);
      if (res.error) return spToastError(res.error);
      fmClose('spEdit');
      fmToast(fmL('Gespeichert', 'Saved'));
      await spLoad();
    }

    async function spDelete(id) {
      if (!userIsAdmin) return;
      const it = sp.rows.find(x => x.id === id); if (!it) return;
      if (!confirm(fmL('„' + it.name + '“ löschen?', 'Delete “' + it.name + '”?'))) return;
      const { error } = await _supabase.from('daily_specials').delete().eq('id', id);
      if (error) return spToastError(error);
      await spLoad();
    }

    // ---------------------------------------------------------------
    // Foto scannen (Manager/Developer)
    // ---------------------------------------------------------------
    function spScanOpen() {
      if (!userIsAdmin) return;
      if (sp.scan && sp.scan.previewUrl) { try { URL.revokeObjectURL(sp.scan.previewUrl); } catch (e) {} }
      sp.scan = { items: [], previewUrl: '', from: spToday(), to: spToday(), note: '', allergensVisible: true };
      const m = fmOpen('spScan', { title: '📷 ' + fmL('Zettel einlesen', 'Scan the sheet'), sub: fmL('Die KI liest Namen und Allergene. Du prüfst das Ergebnis.', 'The AI reads names and allergens. You check the result.'), layer: 2 });
      m.setBody(`<div class="fm-stack">
          <p class="fm-hint">${escapeHtml(fmL(
            'Tipps: Zettel gerade und bei gutem Licht fotografieren, die ganze Liste samt Allergen-Buchstaben aufs Bild bringen. Das Foto wird nur zum Lesen an die KI geschickt und nicht gespeichert.',
            'Tips: Photograph the sheet straight on and in good light, with the whole list including the allergen letters. The photo is only sent to the AI for reading and is not stored.'))}</p>
          <input type="file" id="spFileCam" accept="image/*" capture="environment" class="hidden" onchange="spScanPicked(this)">
          <input type="file" id="spFileGal" accept="image/*" class="hidden" onchange="spScanPicked(this)">
          <button type="button" class="ui-btn-primary" style="padding:.9rem" onclick="document.getElementById('spFileCam').click()">📷 ${escapeHtml(fmL('Foto aufnehmen', 'Take photo'))}</button>
          <button type="button" class="ui-btn-ghost" style="padding:.8rem" onclick="document.getElementById('spFileGal').click()">🖼️ ${escapeHtml(fmL('Aus Galerie / Datei wählen', 'Choose from gallery / file'))}</button>
          <p class="fm-hint" id="spScanStatus"></p>
        </div>`);
      m.setFoot(`<button type="button" class="ui-btn-ghost" onclick="spScanClose()">${escapeHtml(fmL('Abbrechen', 'Cancel'))}</button>`);
    }

    function spScanClose() {
      if (sp.scan && sp.scan.previewUrl) { try { URL.revokeObjectURL(sp.scan.previewUrl); } catch (e) {} }
      sp.scan = null;
      fmClose('spScan');
    }

    function spBlobToBase64(blob) {
      return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(',')[1] || '');
        r.onerror = () => reject(new Error('read failed'));
        r.readAsDataURL(blob);
      });
    }

    async function spScanErrorText(error, data) {
      let code = data && data.error;
      try {
        if (!code && error && error.context && typeof error.context.json === 'function') code = (await error.context.json()).error;
      } catch (e) {}
      const status = error && error.context && error.context.status;
      if (code === 'forbidden' || status === 403) return fmL('Nur Manager und Developer dürfen Zettel einlesen.', 'Only managers and developers can scan sheets.');
      if (code === 'auth' || status === 401) return fmL('Anmeldung ungültig. Bitte neu anmelden.', 'Login invalid. Please log in again.');
      if (code === 'quota' || status === 429) return fmL('Das Tageslimit für KI-Anfragen ist erreicht. Bitte morgen erneut versuchen oder den Eintrag von Hand anlegen.', 'The daily limit for AI requests has been reached. Please try again tomorrow or enter it by hand.');
      if (code === 'busy' || status === 503) return fmL('Die KI ist gerade überlastet. Bitte in einer Minute erneut versuchen.', 'The AI is busy right now. Please try again in a minute.');
      if (code === 'too_large' || status === 413) return fmL('Das Foto ist zu groß. Bitte ein kleineres Foto wählen.', 'The photo is too large. Please choose a smaller one.');
      if (code === 'not_configured') return fmL('Der KI-Schlüssel (GEMINI_API_KEY) fehlt auf dem Server.', 'The AI key (GEMINI_API_KEY) is missing on the server.');
      if (status === 404 || (error && /Failed to send|NetworkError|Failed to fetch/i.test(String(error.message || '')))) {
        return fmL('Die Funktion scan-special ist noch nicht eingerichtet (supabase functions deploy scan-special).', 'The scan-special function is not deployed yet (supabase functions deploy scan-special).');
      }
      return fmL('Das Foto konnte nicht gelesen werden. Bitte erneut versuchen oder von Hand eintragen.', 'The photo could not be read. Please try again or enter it by hand.');
    }

    async function spScanPicked(input) {
      const file = input && input.files && input.files[0];
      if (!file || !sp.scan) return;
      const status = document.getElementById('spScanStatus');
      if (!/^image\//.test(file.type)) { if (status) status.textContent = fmL('Bitte ein Bild auswählen.', 'Please choose an image.'); return; }
      if (status) status.textContent = '⏳ ' + fmL('Die KI liest den Zettel (ca. 5–15 Sekunden) ...', 'The AI is reading the sheet (about 5–15 seconds) ...');
      try {
        let blob = (typeof compressImageFile === 'function') ? await compressImageFile(file, 1600, 0.82) : file;
        if (blob.size > 4.5 * 1024 * 1024 && typeof compressImageFile === 'function') blob = await compressImageFile(file, 1200, 0.7);
        if (blob.size > 5 * 1024 * 1024) throw Object.assign(new Error('too large'), { code: 'too_large' });
        const b64 = await spBlobToBase64(blob);
        const mime = /^image\/(jpeg|png|webp)$/.test(blob.type) ? blob.type : 'image/jpeg';
        if (sp.scan.previewUrl) { try { URL.revokeObjectURL(sp.scan.previewUrl); } catch (e) {} }
        sp.scan.previewUrl = URL.createObjectURL(blob);
        const { data, error } = await _supabase.functions.invoke('scan-special', {
          body: { image: b64, mime },
          headers: { 'x-staff-token': getStaffToken() }
        });
        if (!sp.scan) return;   // Fenster inzwischen geschlossen
        if (error || !data || data.error || !Array.isArray(data.items)) {
          if (status) status.textContent = '⚠️ ' + await spScanErrorText(error, data);
          input.value = '';
          return;
        }
        if (!data.readable || !data.items.length) {
          if (status) status.textContent = '⚠️ ' + fmL('Auf dem Foto wurde keine lesbare Liste gefunden. Bitte näher, gerader und heller fotografieren.', 'No readable list was found in the photo. Please take it closer, straighter and brighter.');
          input.value = '';
          return;
        }
        const withDates = data.items.find(i => i.valid_from && i.valid_to);
        sp.scan.from = withDates ? withDates.valid_from : spToday();
        sp.scan.to = withDates ? withDates.valid_to : spToday();
        sp.scan.note = data.note || '';
        sp.scan.allergensVisible = data.allergensVisible !== false;
        sp.scan.items = data.items.map(i => ({
          include: true, kind: SP_KINDS.some(k => k.id === i.kind) ? i.kind : (i.kind === 'cake' ? 'cake' : SP_KINDS[0].id),
          name: i.name, description: i.description || '', price: i.price, allergens: (i.allergens || []).slice(), uncertain: !!i.uncertain
        }));
        spScanReview();
      } catch (e) {
        if (status) status.textContent = '⚠️ ' + (e && e.code === 'too_large'
          ? fmL('Das Foto ist zu groß. Bitte ein kleineres Foto wählen.', 'The photo is too large. Please choose a smaller one.')
          : fmL('Das Foto konnte nicht verarbeitet werden.', 'The photo could not be processed.'));
        input.value = '';
      }
    }

    // Prüfen-Bildschirm: Foto neben den erkannten Einträgen, alles ist änderbar
    function spScanReview() {
      const s = sp.scan; if (!s) return;
      const m = fmOpen('spScan', { title: '✅ ' + fmL('Ergebnis prüfen', 'Check the result'), sub: fmL('Vergleiche mit dem Foto. Gespeichert wird erst nach deiner Bestätigung.', 'Compare with the photo. Nothing is saved until you confirm.'), layer: 2, wide: true });
      const warn = [];
      if (!s.allergensVisible) warn.push(fmL('Auf dem Zettel wurden keine Allergen-Buchstaben erkannt. Bitte unbedingt selbst eintragen.', 'No allergen letters were recognised on the sheet. Please add them yourself.'));
      if (s.items.some(i => i.uncertain)) warn.push(fmL('Gelb markierte Einträge waren schwer lesbar. Bitte besonders genau prüfen.', 'Entries marked yellow were hard to read. Please check them carefully.'));
      if (s.note) warn.push(s.note);
      m.setBody(`<div class="fm-stack">
        ${s.previewUrl ? `<img src="${s.previewUrl}" alt="" class="sp-photo" onclick="this.classList.toggle('big')">` : ''}
        ${warn.length ? `<div class="sp-warn">${warn.map(w => '⚠️ ' + escapeHtml(w)).join('<br>')}</div>` : ''}
        <div class="fm-grid2">
          <div class="fm-field"><label class="form-label" for="spsFrom">${escapeHtml(fmL('Gültig von', 'Valid from'))}</label>
            <input type="date" id="spsFrom" class="ui-field" value="${s.from}" onchange="spsDates()"></div>
          <div class="fm-field"><label class="form-label" for="spsTo">${escapeHtml(fmL('Gültig bis', 'Valid until'))}</label>
            <input type="date" id="spsTo" class="ui-field" value="${s.to}" onchange="spsDates()"></div>
        </div>
        ${s.items.map((it, i) => `<div class="sp-scan-item${it.uncertain ? ' unsure' : ''}" id="spsItem${i}">
          <label class="sp-scan-incl"><input type="checkbox" ${it.include ? 'checked' : ''} onchange="spsSet(${i},'include',this.checked)"> ${escapeHtml(fmL('Übernehmen', 'Import'))}</label>
          <div class="fm-grid2">
            <div class="fm-field"><label class="form-label">${escapeHtml(fmL('Art', 'Type'))}</label>
              <select class="ui-field" onchange="spsSet(${i},'kind',this.value)">${SP_KINDS.map(k =>
                `<option value="${k.id}"${it.kind === k.id ? ' selected' : ''}>${escapeHtml(k.icon + ' ' + fmL(k.de, k.en))}</option>`).join('')}</select></div>
            <div class="fm-field"><label class="form-label">${escapeHtml(fmL('Preis € (optional)', 'Price € (optional)'))}</label>
              <input type="number" class="ui-field" min="0" step="0.10" value="${it.price != null ? it.price : ''}" oninput="spsSet(${i},'price',this.value)"></div>
          </div>
          <div class="fm-field"><label class="form-label">${escapeHtml(fmL('Name', 'Name'))}</label>
            <input type="text" class="ui-field" maxlength="120" value="${escapeHtml(it.name)}" oninput="spsSet(${i},'name',this.value)"></div>
          <div class="fm-field"><label class="form-label">${escapeHtml(fmL('Allergene', 'Allergens'))}</label>
            <div class="al-filter pick">${AL_ORDER.map(c =>
              `<button type="button" class="${it.allergens.indexOf(c) !== -1 ? 'on' : ''}" title="${escapeHtml(AL_CODES[c])}" onclick="spsLetter(${i},'${c}',this)">${c}</button>`).join('')}</div>
            <p class="fm-hint" id="spsAl${i}">${escapeHtml(spAllergenText(it.allergens))}</p></div>
        </div>`).join('')}
        <label class="sp-confirm"><input type="checkbox" id="spsConfirm" onchange="spsUpdateSave()"> ${escapeHtml(fmL(
          'Ich habe Namen und Allergene mit dem Original verglichen und bestätige, dass sie stimmen.',
          'I have compared names and allergens with the original and confirm they are correct.'))}</label>
      </div>`);
      m.setFoot(`<button type="button" class="ui-btn-ghost" onclick="spScanOpen()">📷 ${escapeHtml(fmL('Neu fotografieren', 'Retake'))}</button>
        <button type="button" class="ui-btn-ghost" onclick="spScanClose()">${escapeHtml(fmL('Verwerfen', 'Discard'))}</button>
        <button type="button" class="ui-btn-primary" id="spsSave" onclick="spScanSave()" disabled>💾 ${escapeHtml(fmL('Speichern', 'Save'))}</button>`);
    }

    function spsSet(i, field, value) {
      const it = sp.scan && sp.scan.items[i]; if (!it) return;
      if (field === 'price') it.price = value === '' ? null : parseFloat(value);
      else it[field] = value;
      if (field === 'include') spsUpdateSave();
    }
    function spsLetter(i, c, btn) {
      const it = sp.scan && sp.scan.items[i]; if (!it) return;
      const k = it.allergens.indexOf(c);
      if (k === -1) it.allergens.push(c); else it.allergens.splice(k, 1);
      it.allergens.sort((a, b) => AL_ORDER.indexOf(a) - AL_ORDER.indexOf(b));
      btn.classList.toggle('on');
      const el = document.getElementById('spsAl' + i);
      if (el) el.textContent = spAllergenText(it.allergens);
    }
    function spsDates() {
      const f = document.getElementById('spsFrom'), t = document.getElementById('spsTo');
      if (!f || !t || !sp.scan) return;
      if (f.value && (!t.value || t.value < f.value)) t.value = f.value;
      sp.scan.from = f.value; sp.scan.to = t.value;
    }
    function spsUpdateSave() {
      const c = document.getElementById('spsConfirm'), b = document.getElementById('spsSave');
      if (b) b.disabled = !(c && c.checked && sp.scan && sp.scan.items.some(i => i.include));
    }

    async function spScanSave() {
      const s = sp.scan; if (!s || !userIsAdmin) return;
      const confirmBox = document.getElementById('spsConfirm');
      if (!confirmBox || !confirmBox.checked) return fmToast(fmL('Bitte zuerst bestätigen, dass du alles geprüft hast.', 'Please confirm that you have checked everything first.'));
      spsDates();
      if (!s.from) return fmToast(fmL('Bitte ein Datum wählen.', 'Please choose a date.'));
      const rows = s.items.filter(i => i.include).map(i => ({
        kind: i.kind, name: String(i.name || '').trim().slice(0, 120), description: String(i.description || '').trim().slice(0, 300) || null,
        price: i.price != null && isFinite(i.price) ? Math.round(i.price * 100) / 100 : null,
        allergens: (i.allergens || []).slice().sort((a, b) => AL_ORDER.indexOf(a) - AL_ORDER.indexOf(b)),
        valid_from: s.from, valid_to: s.to || s.from, source: 'scan', created_by: currentWaiterName
      }));
      if (!rows.length) return fmToast(fmL('Nichts zum Speichern ausgewählt.', 'Nothing selected to save.'));
      if (rows.some(r => !r.name)) return fmToast(fmL('Ein Eintrag hat keinen Namen.', 'An entry has no name.'));
      const { error } = await _supabase.from('daily_specials').insert(rows);
      if (error) return spToastError(error);
      const t = spToday();
      sp.tab = (s.from <= t && (s.to || s.from) >= t) ? 'today' : 'upcoming';
      spScanClose();
      fmToast(fmL(rows.length + ' Eintrag/Einträge gespeichert', rows.length + ' entry/entries saved'));
      await spLoad();
    }

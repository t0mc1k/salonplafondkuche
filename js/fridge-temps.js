/* ============================================================
   js/fridge-temps.js  (v1.0.06)
   Temperaturlisten der Kühlschränke (nur Manager/Developer).
   Monatstabelle: Zeilen = Tage 01–31, Spalten = Kühlgeräte (Soll-Bereich im Kopf).
   Einmal täglich eintragen; Werte außerhalb des Soll-Bereichs werden rot.
   Wer eingetragen hat und wann, setzt die Datenbank selbst (Spalten recorded_by / recorded_at).
   Tabellen: fridges, fridge_temps (sql/1.0.04_fridge_temps.sql). Vorlage: Temperaturlisten.xlsx
   ============================================================ */

    let ft = { m: null, year: 0, month: 0, fridges: [], temps: {} };

    function ftDays() { return new Date(ft.year, ft.month, 0).getDate(); }
    function ftIso(day) { return ft.year + '-' + String(ft.month).padStart(2, '0') + '-' + String(day).padStart(2, '0'); }
    function ftFmt(v) { return String(v).replace('.', ','); }
    function ftNumOrNull(s) {
      const t = String(s == null ? '' : s).trim().replace(',', '.');
      if (t === '') return null;
      const n = Number(t);
      return isNaN(n) ? undefined : n;   // undefined = ungültig
    }
    function ftRange(f) {
      const lo = f.temp_min, hi = f.temp_max;
      if (lo != null && hi != null) return ftFmt(Number(lo)) + ' bis ' + ftFmt(Number(hi)) + ' °C';
      if (hi != null) return 'max. ' + ftFmt(Number(hi)) + ' °C';
      if (lo != null) return 'min. ' + ftFmt(Number(lo)) + ' °C';
      return 'kein Soll-Bereich';
    }
    function ftOut(f, v) {
      return (f.temp_min != null && v < Number(f.temp_min)) || (f.temp_max != null && v > Number(f.temp_max));
    }
    function ftErrorHtml(err) {
      const msg = (err && err.message) || String(err);
      if (/does not exist|schema cache|could not find the table/i.test(msg) || (err && err.code === '42P01')) {
        return '<p class="staff-empty" style="color:#ef4444">Die Datenbank ist noch nicht eingerichtet. Bitte zuerst sql/1.0.04_fridge_temps.sql im Supabase SQL Editor ausführen.</p>';
      }
      return '<p class="staff-empty" style="color:#ef4444">' + escapeHtml(msg) + '</p>';
    }

    // ---------- Öffnen ----------
    async function openFridgeTempModal() {
      closeSettingsMenu();
      if (!userIsAdmin) { alert('Nur Manager und Developer dürfen die Temperaturlisten führen.'); return; }
      const now = new Date();
      ft.year = now.getFullYear();
      ft.month = now.getMonth() + 1;
      ft.m = fmOpen('ftModal', {
        title: '🌡️ Kühlschrank-Temperaturen',
        sub: 'Einmal täglich eintragen. Rot = außerhalb des Soll-Bereichs. Wer eingetragen hat, wird automatisch gespeichert.',
        wide: true
      });
      await ftLoad();
    }

    function ftShiftMonth(delta) {
      ft.month += delta;
      if (ft.month < 1) { ft.month = 12; ft.year--; }
      if (ft.month > 12) { ft.month = 1; ft.year++; }
      ftLoad();
    }
    function ftToday() { const n = new Date(); ft.year = n.getFullYear(); ft.month = n.getMonth() + 1; ftLoad(); }

    async function ftLoad() {
      ft.m.setBody('<p class="staff-empty">Lade ...</p>');
      const [f, t] = await Promise.all([
        _supabase.from('fridges').select('*').eq('active', true).order('sort_order', { ascending: true }).order('name', { ascending: true }),
        _supabase.from('fridge_temps').select('*').gte('day', ftIso(1)).lte('day', ftIso(ftDays()))
      ]);
      if (f.error) { ft.m.setBody(ftErrorHtml(f.error)); return; }
      if (t.error) { ft.m.setBody(ftErrorHtml(t.error)); return; }
      ft.fridges = f.data || [];
      ft.temps = {};
      (t.data || []).forEach(r => { ft.temps[r.fridge_id + '|' + r.day] = r; });
      ftRender();
    }

    // ---------- Anzeigen ----------
    function ftCellHtml(f, day) {
      const iso = ftIso(day);
      const rec = ft.temps[f.id + '|' + iso];
      const future = iso > fmIso(new Date());
      const bad = rec && ftOut(f, Number(rec.temp));
      const title = rec ? escapeHtml((rec.recorded_by || '') + ' · ' + fmDateTime(rec.recorded_at)) : '';
      return `<td class="ft-cell"><input type="text" inputmode="decimal" autocomplete="off" maxlength="5" class="ft-in${bad ? ' ft-bad' : ''}"
        value="${rec ? escapeHtml(ftFmt(rec.temp)) : ''}" ${future ? 'disabled' : ''} title="${title}"
        data-f="${escapeHtml(f.id)}" data-d="${iso}" onfocus="this.select()" onchange="ftSave(this)"></td>`;
    }

    function ftByText(iso) {
      const names = [];
      ft.fridges.forEach(f => { const r = ft.temps[f.id + '|' + iso]; if (r && r.recorded_by && names.indexOf(r.recorded_by) === -1) names.push(r.recorded_by); });
      return names.map(n => n.split(' ').map(p => p.charAt(0)).join('')).join(', ');   // Kürzel, z. B. AK
    }

    function ftSummaryHtml() {
      const today = fmIso(new Date());
      let bad = 0, missing = 0, filled = 0;
      for (let d = 1; d <= ftDays(); d++) {
        const iso = ftIso(d);
        ft.fridges.forEach(f => {
          const r = ft.temps[f.id + '|' + iso];
          if (r) { filled++; if (ftOut(f, Number(r.temp))) bad++; }
          else if (iso <= today) missing++;
        });
      }
      return `<span><b>${filled}</b> Messwerte</span><span class="${bad ? 'ft-sum-bad' : ''}"><b>${bad}</b> außerhalb Soll</span><span class="${missing ? 'ft-sum-warn' : ''}"><b>${missing}</b> noch offen (bis heute)</span>`;
    }

    function ftRender() {
      ft.m.setToolbar(`<div class="fm-row-flex" style="justify-content:space-between;gap:.5rem">
        <div class="tp-monthnav">
          <button type="button" class="ui-btn-ghost" onclick="ftShiftMonth(-1)" aria-label="Vorheriger Monat">‹</button>
          <b class="tp-month-label">${escapeHtml(FM_MONTHS[ft.month - 1] + ' ' + ft.year)}</b>
          <button type="button" class="ui-btn-ghost" onclick="ftShiftMonth(1)" aria-label="Nächster Monat">›</button>
          <button type="button" class="ui-btn-ghost" onclick="ftToday()">Heute</button>
        </div>
        <div class="fm-row-flex" style="gap:.4rem;flex-wrap:wrap">
          <button type="button" class="ui-btn-ghost" onclick="ftDisplayOpen()" title="Digitale Anzeige am Kühlgerät fotografieren">📟 Display</button>
          <button type="button" class="ui-btn-ghost" onclick="ftScanOpen()">📷 Liste einlesen</button>
          <button type="button" class="ui-btn-ghost" onclick="ftPreview()">📤 Teilen</button>
          <button type="button" class="ui-btn-ghost" onclick="ftExportExcel()">📗 Excel</button>
          <button type="button" class="ui-btn-ghost" onclick="ftManage()">⚙️ Kühlgeräte</button>
        </div></div>`);
      if (!ft.fridges.length) {
        ft.m.setBody('<p class="staff-empty">Noch keine Kühlgeräte angelegt. Mit „⚙️ Kühlgeräte“ kannst du welche hinzufügen.</p>');
        ft.m.setFoot('<button type="button" class="ui-btn-primary" onclick="fmClose(\'ftModal\')">Fertig</button>');
        return;
      }
      const today = fmIso(new Date());
      let head = '<tr><th class="ft-day-col">Tag</th>' + ft.fridges.map(f =>
        `<th class="ft-head"><b>${escapeHtml(f.name)}</b><small>${escapeHtml(ftRange(f))}</small></th>`).join('') + '<th class="ft-by-col">Von</th></tr>';
      let body = '';
      for (let d = 1; d <= ftDays(); d++) {
        const iso = ftIso(d);
        const wd = new Date(ft.year, ft.month - 1, d).getDay();
        body += `<tr class="${iso === today ? 'ft-today' : ''}${wd === 0 || wd === 6 ? ' ft-weekend' : ''}">
          <th class="ft-day-col">${String(d).padStart(2, '0')}<small>${FM_DAYS[wd]}</small></th>
          ${ft.fridges.map(f => ftCellHtml(f, d)).join('')}
          <td class="ft-by-col" id="ftBy_${d}">${escapeHtml(ftByText(iso))}</td></tr>`;
      }
      ft.m.setBody(`<div id="ftSummary" class="tp-summary" style="padding:.5rem 1rem">${ftSummaryHtml()}</div>
        <div class="tp-wrap ft-wrap"><table class="ft-table"><thead>${head}</thead><tbody>${body}</tbody></table></div>`);
      ft.m.setFoot('<button type="button" class="ui-btn-primary" onclick="fmClose(\'ftModal\')">Fertig</button>');
      const t = ft.m.body.querySelector('tr.ft-today');
      if (t) t.scrollIntoView({ block: 'center' });
    }

    // ---------- Speichern (ein Wert pro Gerät und Tag) ----------
    async function ftSave(inp) {
      const fid = inp.dataset.f, iso = inp.dataset.d, key = fid + '|' + iso;
      const f = ft.fridges.find(x => x.id === fid);
      const old = ft.temps[key];
      const n = ftNumOrNull(inp.value);
      const restore = () => { inp.value = old ? ftFmt(old.temp) : ''; };
      if (n === undefined || (n !== null && (n < -60 || n > 60))) { fmToast('Bitte eine Temperatur wie 3 oder 3,5 eintragen.'); restore(); return; }
      if (n === null) {   // leeres Feld = Wert löschen
        if (!old) return;
        const del = await _supabase.from('fridge_temps').delete().eq('id', old.id);
        if (del.error) { fmToast(del.error.message); restore(); return; }
        delete ft.temps[key];
      } else {
        const r = await _supabase.from('fridge_temps').upsert({ fridge_id: fid, day: iso, temp: Math.round(n * 10) / 10 }, { onConflict: 'fridge_id,day' }).select();
        if (r.error || !r.data || !r.data.length) { fmToast(r.error ? r.error.message : 'Nicht gespeichert (keine Berechtigung).'); restore(); return; }
        ft.temps[key] = r.data[0];
        inp.value = ftFmt(r.data[0].temp);
      }
      const rec = ft.temps[key];
      inp.classList.toggle('ft-bad', !!rec && ftOut(f, Number(rec.temp)));
      inp.title = rec ? (rec.recorded_by || '') + ' · ' + fmDateTime(rec.recorded_at) : '';
      const by = document.getElementById('ftBy_' + parseInt(iso.slice(8), 10));
      if (by) by.textContent = ftByText(iso);
      const sum = document.getElementById('ftSummary');
      if (sum) sum.innerHTML = ftSummaryHtml();
      if (rec && ftOut(f, Number(rec.temp))) fmToast('⚠️ ' + f.name + ': ' + ftFmt(rec.temp) + ' °C liegt außerhalb (' + ftRange(f) + ').');
    }

    // ---------- Excel ----------
    function ftExportExcel() {
      if (typeof XLSX === 'undefined') return alert('Excel-Bibliothek nicht geladen.');
      const aoa = [['Temperaturliste ' + FM_MONTHS[ft.month - 1] + ' ' + ft.year], ['Tag'].concat(ft.fridges.map(f => f.name + ' (' + ftRange(f) + ')'), ['Von'])];
      for (let d = 1; d <= ftDays(); d++) {
        const iso = ftIso(d);
        aoa.push([String(d).padStart(2, '0')].concat(ft.fridges.map(f => { const r = ft.temps[f.id + '|' + iso]; return r ? Number(r.temp) : ''; }), [ftByText(iso)]));
      }
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = [{ wch: 6 }].concat(ft.fridges.map(() => ({ wch: 16 })), [{ wch: 10 }]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Temperaturen');
      XLSX.writeFile(wb, 'Temperaturliste_' + ft.year + '-' + String(ft.month).padStart(2, '0') + '.xlsx');
    }

    // ---------- Teilen: Vorschau, WhatsApp, Bild, PDF, Druck (js/share-doc.js) ----------
    // Die Monatstabelle wird als A4-Querformat gezeichnet (Rot = außerhalb Soll).
    function ftRenderCanvas() {
      const W = 1754, H = 1240, M = 34, n = ftDays();
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const g = cv.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
      g.textBaseline = 'middle'; g.fillStyle = '#000'; g.textAlign = 'left';
      g.font = 'bold 36px Arial, Helvetica, sans-serif';
      g.fillText('Temperaturliste – ' + FM_MONTHS[ft.month - 1] + ' ' + ft.year, M, M + 20);
      const top = M + 56, bottom = H - M - 30, headH = 76;
      const rowH = Math.max(20, Math.min(38, (bottom - top - headH) / n));
      const dayW = 96, byW = 100, cols = ft.fridges.length || 1;
      const cw = (W - 2 * M - dayW - byW) / cols;
      g.lineWidth = 1.2; g.strokeStyle = '#444';
      const fit = (txt, maxW, size, bold) => { let s = size; g.font = (bold ? 'bold ' : '') + s + 'px Arial, Helvetica, sans-serif'; while (s > 9 && g.measureText(txt).width > maxW) { s--; g.font = (bold ? 'bold ' : '') + s + 'px Arial, Helvetica, sans-serif'; } };
      // Kopf
      g.fillStyle = '#e8e8e8'; g.fillRect(M, top, W - 2 * M, headH); g.fillStyle = '#000';
      g.strokeRect(M, top, dayW, headH); g.textAlign = 'center'; fit('Tag', dayW - 8, 24, true); g.fillText('Tag', M + dayW / 2, top + headH / 2);
      ft.fridges.forEach((f, i) => {
        const x = M + dayW + i * cw; g.strokeRect(x, top, cw, headH);
        fit(f.name, cw - 10, 24, true); g.fillText(f.name, x + cw / 2, top + 26);
        fit(ftRange(f), cw - 10, 17, false); g.fillStyle = '#444'; g.fillText(ftRange(f), x + cw / 2, top + 54); g.fillStyle = '#000';
      });
      const xb = M + dayW + cols * cw; g.strokeRect(xb, top, byW, headH); fit('Von', byW - 8, 24, true); g.fillText('Von', xb + byW / 2, top + headH / 2);
      // Zeilen
      const fs = Math.round(rowH * 0.55);
      for (let d = 1; d <= n; d++) {
        const y = top + headH + (d - 1) * rowH, iso = ftIso(d), wd = new Date(ft.year, ft.month - 1, d).getDay();
        if (wd === 0 || wd === 6) { g.fillStyle = '#f3f3f3'; g.fillRect(M, y, W - 2 * M, rowH); }
        g.fillStyle = '#000'; g.strokeRect(M, y, dayW, rowH);
        g.font = 'bold ' + fs + 'px Arial, Helvetica, sans-serif'; g.textAlign = 'center';
        g.fillText(String(d).padStart(2, '0') + ' ' + FM_DAYS[wd], M + dayW / 2, y + rowH / 2);
        ft.fridges.forEach((f, i) => {
          const x = M + dayW + i * cw, r = ft.temps[f.id + '|' + iso];
          if (r && ftOut(f, Number(r.temp))) { g.fillStyle = '#fcd9d9'; g.fillRect(x + 1, y + 1, cw - 2, rowH - 2); }
          g.strokeStyle = '#444'; g.strokeRect(x, y, cw, rowH);
          if (r) { g.fillStyle = ftOut(f, Number(r.temp)) ? '#c00000' : '#000'; g.font = (ftOut(f, Number(r.temp)) ? 'bold ' : '') + fs + 'px Arial, Helvetica, sans-serif'; g.fillText(ftFmt(r.temp), x + cw / 2, y + rowH / 2); }
        });
        g.fillStyle = '#000'; g.strokeRect(xb, y, byW, rowH); g.font = fs + 'px Arial, Helvetica, sans-serif'; g.fillText(ftByText(iso), xb + byW / 2, y + rowH / 2);
      }
      g.textAlign = 'left'; g.fillStyle = '#333'; g.font = 'italic 20px Arial, Helvetica, sans-serif';
      g.fillText('Rot = außerhalb des Soll-Bereichs · Von = Kürzel der Person · erstellt am ' + new Date().toLocaleDateString('de-AT') + ' · Salonplafond Küche', M, H - M + 6);
      return cv;
    }

    // Kurzer Text für WhatsApp: Zahl der Messwerte und alles außerhalb Soll
    function ftTextSummary() {
      const bad = [], today = fmIso(new Date());
      let filled = 0;
      for (let d = 1; d <= ftDays(); d++) {
        const iso = ftIso(d);
        ft.fridges.forEach(f => {
          const r = ft.temps[f.id + '|' + iso]; if (!r) return;
          filled++;
          if (ftOut(f, Number(r.temp))) bad.push(String(d).padStart(2, '0') + '.' + String(ft.month).padStart(2, '0') + '. ' + f.name + ': ' + ftFmt(r.temp) + ' °C (Soll ' + ftRange(f) + ')');
        });
      }
      const lines = ['*Temperaturliste ' + FM_MONTHS[ft.month - 1] + ' ' + ft.year + '*', filled + ' Messwerte · ' + bad.length + ' außerhalb Soll'];
      if (bad.length) { lines.push('', '⚠️ *Außerhalb Soll:*'); bad.slice(0, 25).forEach(b => lines.push('• ' + b)); if (bad.length > 25) lines.push('… und ' + (bad.length - 25) + ' weitere'); }
      else lines.push('✅ Alle Werte im Soll-Bereich.');
      if (ft.year + '-' + String(ft.month).padStart(2, '0') === today.slice(0, 7)) {
        const t = ft.fridges.map(f => { const r = ft.temps[f.id + '|' + today]; return r ? f.name + ' ' + ftFmt(r.temp) : null; }).filter(Boolean);
        if (t.length) lines.push('', '*Heute:* ' + t.join(' · '));
      }
      return lines.join('\n');
    }

    function ftPreview() {
      if (!ft.fridges.length) return fmToast('Keine Kühlgeräte angelegt.');
      shPreview({ title: 'Vorschau Temperaturliste', canvas: ftRenderCanvas(), landscape: true, base: 'Temperaturliste_' + ft.year + '-' + String(ft.month).padStart(2, '0'),
        text: ftTextSummary(), shareText: 'Temperaturliste ' + FM_MONTHS[ft.month - 1] + ' ' + ft.year });
    }

    // ---------- Foto / Datei einlesen (KI, Edge Function scan-temps) ----------
    let ftSc = null;   // { m, cells: { 'fridgeId|day': { v, unsure } }, days: [..], chk }

    function ftScanOpen() {
      if (!ft.fridges.length) return fmToast('Keine Kühlgeräte angelegt.');
      const m = fmOpen('ftScan', { title: '📷 Temperaturliste einlesen', sub: FM_MONTHS[ft.month - 1] + ' ' + ft.year + ' · die Werte werden erst nach deiner Kontrolle gespeichert', layer: 2, wide: true });
      ftSc = { m, cells: {}, days: [], chk: false };
      ftScanIntro(m);
    }
    function ftScanIntro(m, msg) {
      ftSc.m = m = m || ftSc.m;
      m.setToolbar('');
      m.setBody(`<div class="rs-box rs-warn"><h4>📸 Für ein gutes Ergebnis</h4><ul>
          <li>Die <b>ganze Tabelle</b> aufnehmen (alle Kühlgeräte als Spalten, alle Tage als Zeilen), <b>gerade von oben</b>, scharf und gut beleuchtet.</li>
          <li>Foto mit der Kamera-App in voller Auflösung, keine Screenshots, nichts über WhatsApp Verschicktes.</li>
          <li>Du kannst auch ein <b>vorhandenes Foto oder eine Bilddatei</b> auswählen.</li></ul>
          <p class="rs-small">Die KI kann sich bei Handschrift irren. Deshalb kontrollierst du im nächsten Schritt jeden Wert. Das Foto wird nur zum Lesen an Google Gemini geschickt und nicht gespeichert.</p></div>
        ${msg ? `<p class="rs-err">⚠️ ${escapeHtml(msg)}</p>` : ''}
        <input type="file" id="ftScanCam" accept="image/*" capture="environment" class="hidden" onchange="ftScanPicked(this)">
        <input type="file" id="ftScanGal" accept="image/*" class="hidden" onchange="ftScanPicked(this)">
        <div class="rs-actions">
          <button type="button" class="ui-btn-primary rs-big" onclick="document.getElementById('ftScanCam').click()">📷 Foto aufnehmen</button>
          <button type="button" class="ui-btn-ghost rs-big" onclick="document.getElementById('ftScanGal').click()">🖼️ Aus Galerie / Datei wählen</button></div>`);
      m.setFoot('<button type="button" class="ui-btn-ghost" onclick="fmClose(\'ftScan\')">Abbrechen</button>');
    }

    function ftScanErrText(error, data) {
      const code = data && data.error, status = error && error.context && error.context.status;
      if (code === 'forbidden' || status === 403) return 'Nur Manager und Developer dürfen die Temperaturliste einlesen.';
      if (code === 'auth' || status === 401) return 'Anmeldung ungültig. Bitte neu anmelden.';
      if (code === 'quota' || status === 429) return 'Das Tageslimit für KI-Anfragen ist erreicht. Bitte morgen erneut versuchen oder die Werte von Hand eintragen.';
      if (code === 'busy' || status === 503) return 'Die KI ist gerade überlastet. Bitte in einer Minute noch einmal versuchen.';
      if (code === 'too_large' || status === 413) return 'Das Foto ist zu groß. Bitte ein kleineres Foto wählen.';
      if (code === 'not_configured') return 'Der KI-Schlüssel (GEMINI_API_KEY) fehlt auf dem Server.';
      if (status === 404 || (error && /Failed to send|NetworkError|Failed to fetch/i.test(String(error.message || '')))) return 'Die Funktion scan-temps ist noch nicht eingerichtet (supabase/functions/scan-temps bereitstellen, siehe docs/SETUP-4.1.00.md).';
      return 'Das Foto konnte nicht gelesen werden. Bitte erneut versuchen oder besser fotografieren.';
    }

    async function ftScanPicked(input) {
      const file = input && input.files && input.files[0];
      if (!file || !ftSc) return;
      input.value = '';
      const m = ftSc.m;
      if (!/^image\//.test(file.type)) return ftScanIntro(m, 'Bitte ein Bild auswählen (JPEG oder PNG).');
      if (typeof rsPrepare !== 'function') return ftScanIntro(m, 'Bild-Funktion nicht geladen.');
      m.setToolbar(''); m.setFoot('');
      m.setBody('<div class="rs-busy"><div class="rs-spin"></div><p><b>Die KI liest die Temperaturliste …</b></p><p class="rs-small">Das dauert meist 15 bis 40 Sekunden. Bitte das Fenster offen lassen.</p></div>');
      try {
        const prep = await rsPrepare(file);
        const b64 = await rsBlobToBase64(prep.blob);
        const { data, error } = await _supabase.functions.invoke('scan-temps', {
          body: { image: b64, mime: 'image/jpeg', year: ft.year, month: ft.month, fridges: ft.fridges.map(f => ({ name: f.name, min: f.temp_min, max: f.temp_max })) },
          headers: { 'x-staff-token': getStaffToken() }
        });
        if (!ftSc) return;
        if (error || !data || data.error || !Array.isArray(data.days)) return ftScanIntro(m, ftScanErrText(error, data));
        if (!data.readable || !data.days.length) return ftScanIntro(m, 'Auf dem Foto wurde keine lesbare Temperaturtabelle gefunden.' + (data.note ? ' Hinweis der KI: ' + data.note : ''));
        ftScanReview(data);
      } catch (e) {
        if (ftSc) ftScanIntro(ftSc.m, e && e.code === 'too_large' ? 'Das Foto ist zu groß.' : 'Das Foto konnte nicht verarbeitet oder gesendet werden. Bitte Internet prüfen und noch einmal versuchen.');
      }
    }

    // Kontrolle: jeder Wert ist bearbeitbar. Orange = unsicher, rot = außerhalb Soll, blau unterstrichen = anders als bisher gespeichert.
    function ftScanReview(data) {
      ftSc.cells = {}; ftSc.days = []; ftSc.chk = false; ftSc.data = data;
      data.days.forEach(d => {
        ftSc.days.push(d.day);
        Object.keys(d.values).forEach(name => {
          const f = ft.fridges.find(x => x.name === name); if (!f) return;
          const e = d.values[name];
          ftSc.cells[f.id + '|' + d.day] = { v: e.v == null ? '' : ftFmt(e.v), unsure: !!e.uncertain };
        });
      });
      ftScanRender();
    }
    function ftScanCellClass(f, day) {
      const c = ftSc.cells[f.id + '|' + day] || { v: '', unsure: false };
      const n = ftNumOrNull(c.v);
      let cls = 'ft-sc-in';
      if (n === undefined || (n !== null && (n < -60 || n > 60))) cls += ' ft-sc-bad';
      else if (n !== null && ftOut(f, n)) cls += ' ft-sc-out';
      if (c.unsure && c.v !== '') cls += ' ft-sc-unsure';
      const old = ft.temps[f.id + '|' + ftIso(day)];
      if (n !== null && n !== undefined && (!old || Number(old.temp) !== n)) cls += ' ft-sc-chg';
      return cls;
    }
    function ftScanRender() {
      const m = ftSc.m, data = ftSc.data || {};
      const warns = [];
      if ((data.month && data.month !== ft.month) || (data.year && data.year !== ft.year)) warns.push(`Auf dem Foto steht ${data.month ? String(data.month).padStart(2, '0') : '?'}/${data.year || '?'}, geöffnet ist ${String(ft.month).padStart(2, '0')}/${ft.year}. Stimmt der Monat? Sonst Fenster schließen und den richtigen Monat öffnen.`);
      if (data.unmatched && data.unmatched.length) warns.push('Spalten, die keinem Kühlgerät zugeordnet werden konnten (ignoriert): ' + data.unmatched.join(', '));
      const head = '<tr><th class="ft-day-col">Tag</th>' + ft.fridges.map(f => `<th class="ft-head"><b>${escapeHtml(f.name)}</b><small>${escapeHtml(ftRange(f))}</small></th>`).join('') + '</tr>';
      const body = ftSc.days.map(d => `<tr><th class="ft-day-col">${String(d).padStart(2, '0')}</th>${ft.fridges.map(f => {
        const c = ftSc.cells[f.id + '|' + d] || { v: '' };
        return `<td class="ft-cell"><input type="text" inputmode="decimal" autocomplete="off" maxlength="6" class="${ftScanCellClass(f, d)}" value="${escapeHtml(c.v)}" data-f="${escapeHtml(f.id)}" data-d="${d}" onfocus="this.select()" oninput="ftScanCell(this)" onchange="ftScanDone(this)"></td>`;
      }).join('')}</tr>`).join('');
      m.setToolbar(`<div class="rs-bar"><span id="ftScStats" class="rs-stats"></span></div>`);
      m.setBody(`${warns.map(w => `<p class="rs-err">⚠️ ${escapeHtml(w)}</p>`).join('')}
        ${data.note ? `<p class="rs-small">📝 Hinweis der KI: ${escapeHtml(data.note)}</p>` : ''}
        <div class="rs-legend"><span class="rs-l rs-l-unsure">orange = unsicher gelesen</span><span class="rs-l rs-l-bad">rot = ungültig / außerhalb Soll</span><span class="rs-l rs-l-chg">blau unterstrichen = neu oder anders als gespeichert</span></div>
        <div class="tp-wrap ft-wrap"><table class="ft-table"><thead>${head}</thead><tbody>${body}</tbody></table></div>
        <label class="rs-confirm"><input type="checkbox" id="ftScChk" onchange="ftSc.chk = this.checked; ftScanStats()"> Ich habe alle Werte mit dem Foto verglichen.</label>`);
      m.setFoot(`<button type="button" class="ui-btn-ghost" onclick="ftScanIntro()">↩️ Neues Foto</button><button type="button" class="ui-btn-ghost" onclick="fmClose('ftScan')">Abbrechen</button>
        <button type="button" class="ui-btn-primary" id="ftScSave" onclick="ftScanSave()">💾 Werte übernehmen</button>`);
      ftScanStats();
    }
    function ftScanStats() {
      let cells = 0, bad = 0, unsure = 0, chg = 0, out = 0;
      ft.fridges.forEach(f => ftSc.days.forEach(d => {
        const c = ftSc.cells[f.id + '|' + d]; if (!c || c.v === '') return;
        const n = ftNumOrNull(c.v);
        if (n === undefined || (n !== null && (n < -60 || n > 60))) { bad++; return; }
        cells++; if (c.unsure) unsure++;
        if (n !== null && ftOut(f, n)) out++;
        const old = ft.temps[f.id + '|' + ftIso(d)];
        if (!old || Number(old.temp) !== n) chg++;
      }));
      ftSc.stat = { cells, bad, unsure, chg, out };
      const el = document.getElementById('ftScStats');
      if (el) el.innerHTML = `<b>${cells}</b> Werte · <span class="${chg ? 'rs-s-chg' : ''}"><b>${chg}</b> neu/anders</span> · <span class="${unsure ? 'rs-s-unsure' : ''}"><b>${unsure}</b> unsicher</span> · <span class="${out ? 'rs-s-bad' : ''}"><b>${out}</b> außerhalb Soll</span> · <span class="${bad ? 'rs-s-bad' : ''}"><b>${bad}</b> ungültig</span>`;
      const btn = document.getElementById('ftScSave');
      if (btn) { btn.disabled = !(ftSc.chk && bad === 0 && cells > 0); btn.title = bad ? 'Zuerst die ungültigen Werte korrigieren' : (ftSc.chk ? '' : 'Bitte zuerst bestätigen, dass du alles verglichen hast'); }
    }
    function ftScanCell(el) {
      const key = el.dataset.f + '|' + el.dataset.d, f = ft.fridges.find(x => x.id === el.dataset.f);
      ftSc.cells[key] = Object.assign(ftSc.cells[key] || {}, { v: el.value });
      el.className = ftScanCellClass(f, Number(el.dataset.d));
      ftScanStats();
    }
    function ftScanDone(el) {   // von Hand bestätigt: nicht mehr „unsicher“
      const key = el.dataset.f + '|' + el.dataset.d, f = ft.fridges.find(x => x.id === el.dataset.f);
      const c = ftSc.cells[key] = Object.assign(ftSc.cells[key] || {}, { v: el.value, unsure: false });
      const n = ftNumOrNull(c.v);
      if (n !== null && n !== undefined) { c.v = ftFmt(Math.round(n * 10) / 10); el.value = c.v; }
      el.className = ftScanCellClass(f, Number(el.dataset.d));
      ftScanStats();
    }
    async function ftScanSave() {
      if (!ftSc || !ftSc.chk) return;
      ftScanStats();
      if (ftSc.stat.bad) return alert('Bitte zuerst die ungültigen Werte korrigieren oder leeren.');
      const today = fmIso(new Date()), rows = [];
      ft.fridges.forEach(f => ftSc.days.forEach(d => {
        const c = ftSc.cells[f.id + '|' + d]; if (!c || c.v === '') return;
        const n = ftNumOrNull(c.v); if (n === null || n === undefined) return;
        const iso = ftIso(d); if (iso > today) return;   // keine Werte für die Zukunft
        rows.push({ fridge_id: f.id, day: iso, temp: Math.round(n * 10) / 10 });
      }));
      if (!rows.length) return alert('Es gibt nichts zu speichern.');
      const chg = rows.filter(r => { const o = ft.temps[r.fridge_id + '|' + r.day]; return !o || Number(o.temp) !== r.temp; }).length;
      if (!confirm(`${rows.length} Messwerte für ${FM_MONTHS[ft.month - 1]} ${ft.year} speichern?\n${chg} davon sind neu oder anders als bisher.\n\nVorhandene Werte an diesen Tagen werden überschrieben. Als Person wird dein Name eingetragen.`)) return;
      const btn = document.getElementById('ftScSave'); if (btn) btn.disabled = true;
      const res = await _supabase.from('fridge_temps').upsert(rows, { onConflict: 'fridge_id,day' });
      if (res.error) { if (btn) btn.disabled = false; return alert('Speichern fehlgeschlagen: ' + res.error.message); }
      fmClose('ftScan'); ftSc = null;
      await ftLoad();
      fmToast('✓ ' + rows.length + ' Messwerte aus dem Foto übernommen');
    }

    // ---------- Display ablesen (rote LED-Anzeige am Kühlgerät) ----------
    // Gerät und Datum wählen, Display fotografieren, die KI liest die Zahl, du bestätigst, danach gleich das nächste Gerät.
    let ftDp = null;   // { m, fridgeId, day, temp, unsure, url, saved: [] }

    function ftDisplayOpen() {
      if (!ft.fridges.length) return fmToast('Keine Kühlgeräte angelegt.');
      const m = fmOpen('ftDisp', { title: '📟 Display ablesen', sub: 'Foto der digitalen Anzeige am Kühlgerät. Die Zahl wird erst nach deiner Bestätigung gespeichert.', layer: 2 });
      ftDp = { m, fridgeId: ft.fridges[0].id, day: fmIso(new Date()), temp: '', unsure: false, url: '', saved: [], busy: false, msg: '' };
      ftDispRender();
    }
    const ftDispFridge = () => ft.fridges.find(f => f.id === ftDp.fridgeId) || ft.fridges[0];
    function ftDispRender() {
      const d = ftDp, f = ftDispFridge(), today = fmIso(new Date());
      const hasVal = d.temp !== '';
      const n = ftNumOrNull(d.temp);
      const valid = hasVal && n !== undefined && n !== null && n >= -60 && n <= 60;
      const out = valid && ftOut(f, n);
      const freezerHint = valid && f.temp_max != null && f.temp_max <= -10 && n > 0;
      d.m.setBody(`<div class="fm-stack">
        <label class="fm-lbl">Kühlgerät<select id="ftDpFridge" class="ui-input" onchange="ftDispPick(this.value)">${ft.fridges.map(x => `<option value="${escapeHtml(x.id)}"${x.id === f.id ? ' selected' : ''}>${escapeHtml(x.name)} (${escapeHtml(ftRange(x))})</option>`).join('')}</select></label>
        <label class="fm-lbl">Datum<input type="date" id="ftDpDay" class="ui-input" max="${today}" value="${escapeHtml(d.day)}" onchange="ftDp.day = this.value || ftDp.day"></label>
        <input type="file" id="ftDpCam" accept="image/*" capture="environment" class="hidden" onchange="ftDispPicked(this)">
        <input type="file" id="ftDpGal" accept="image/*" class="hidden" onchange="ftDispPicked(this)">
        <div class="rs-actions"><button type="button" class="ui-btn-primary rs-big" onclick="document.getElementById('ftDpCam').click()">📷 Display fotografieren</button>
          <button type="button" class="ui-btn-ghost rs-big" onclick="document.getElementById('ftDpGal').click()">🖼️ Aus Galerie / Datei wählen</button></div>
        <p class="fm-hint">Tipp: nah ran, die roten Ziffern mittig und scharf, möglichst ohne Spiegelung (Blitz aus, leicht schräg gegen Reflexe). Die Minuszeichen vor der Zahl müssen sichtbar sein.</p>
        ${d.busy ? '<div class="rs-busy"><div class="rs-spin"></div><p><b>Die KI liest das Display …</b></p></div>' : ''}
        ${d.msg ? `<p class="rs-err">⚠️ ${escapeHtml(d.msg)}</p>` : ''}
        ${d.url || hasVal ? `<div class="ft-dp-res">${d.url ? `<img class="ft-dp-img" src="${escapeHtml(d.url)}" alt="Display" onclick="openPhotoPreview(${jsArg(d.url)})">` : ''}
          <div class="ft-dp-val"><label class="fm-lbl">Gelesene Temperatur (°C)<div class="ft-dp-row"><input type="text" id="ftDpTemp" inputmode="decimal" class="ft-dp-in${d.unsure ? ' ft-sc-unsure' : ''}${out ? ' ft-sc-out' : ''}" value="${escapeHtml(d.temp)}" oninput="ftDispEdit(this.value)" onfocus="this.select()"><button type="button" class="ui-btn-ghost" onclick="ftDispSign()" title="Vorzeichen umdrehen">±</button></div></label>
            <div class="ft-dp-state ${out ? 'bad' : (valid ? 'ok' : '')}">${valid ? (out ? '⚠️ außerhalb Soll (' + escapeHtml(ftRange(f)) + ')' : '✅ im Soll-Bereich') : ''}</div>
            ${d.unsure ? '<div class="ft-dp-state bad">Die KI ist unsicher. Bitte mit dem Foto vergleichen.</div>' : ''}
            ${freezerHint ? '<div class="ft-dp-state bad">Tiefkühler: fehlt das Minuszeichen? Mit „±“ umdrehen.</div>' : ''}</div></div>` : ''}
        ${d.saved.length ? `<p class="fm-hint">✓ Gespeichert: ${escapeHtml(d.saved.join(' · '))}</p>` : ''}</div>`);
      d.m.setFoot(`<button type="button" class="ui-btn-ghost" onclick="fmClose('ftDisp')">Fertig</button>
        <button type="button" class="ui-btn-primary" id="ftDpSave" ${valid ? '' : 'disabled'} onclick="ftDispSave()">💾 Speichern & nächstes Gerät</button>`);
    }
    function ftDispPick(id) { ftDp.fridgeId = id; ftDp.temp = ''; ftDp.unsure = false; ftDp.url = ''; ftDp.msg = ''; ftDispRender(); }
    function ftDispEdit(v) {
      ftDp.temp = v; ftDp.unsure = false;
      const n = ftNumOrNull(v), f = ftDispFridge();
      const valid = v !== '' && n !== undefined && n !== null && n >= -60 && n <= 60;
      const b = document.getElementById('ftDpSave'); if (b) b.disabled = !valid;
      const inp = document.getElementById('ftDpTemp'); if (inp) { inp.classList.remove('ft-sc-unsure'); inp.classList.toggle('ft-sc-out', valid && ftOut(f, n)); }
    }
    function ftDispSign() { const n = ftNumOrNull(ftDp.temp); if (n === null || n === undefined) return; ftDp.temp = ftFmt(-n); ftDp.unsure = false; ftDispRender(); }

    async function ftDispPicked(input) {
      const file = input && input.files && input.files[0];
      if (!file || !ftDp) return;
      input.value = '';
      ftDp.msg = '';
      if (!/^image\//.test(file.type)) { ftDp.msg = 'Bitte ein Bild auswählen.'; return ftDispRender(); }
      if (typeof rsPrepare !== 'function') { ftDp.msg = 'Bild-Funktion nicht geladen.'; return ftDispRender(); }
      ftDp.busy = true; ftDp.temp = ''; ftDp.url = ''; ftDispRender();
      const f = ftDispFridge();
      try {
        const prep = await rsPrepare(file);
        const url = URL.createObjectURL(prep.blob);
        const b64 = await rsBlobToBase64(prep.blob);
        const { data, error } = await _supabase.functions.invoke('scan-temps', {
          body: { mode: 'display', image: b64, mime: 'image/jpeg', fridges: [{ name: f.name, min: f.temp_min, max: f.temp_max }] },
          headers: { 'x-staff-token': getStaffToken() }
        });
        if (!ftDp) return;
        ftDp.busy = false; ftDp.url = url;
        if (error || !data || data.error) { ftDp.msg = ftScanErrText(error, data); return ftDispRender(); }
        if (!data.readable || data.temp == null) { ftDp.msg = 'Auf dem Foto konnte keine Temperatur gelesen werden.' + (data.note ? ' Hinweis der KI: ' + data.note : '') + ' Du kannst den Wert auch selbst eintragen.'; return ftDispRender(); }
        ftDp.temp = ftFmt(data.temp); ftDp.unsure = !!data.uncertain;
        if (data.note) ftDp.msg = '';
        ftDispRender();
      } catch (e) {
        if (ftDp) { ftDp.busy = false; ftDp.msg = 'Das Foto konnte nicht verarbeitet oder gesendet werden. Bitte Internet prüfen und noch einmal versuchen.'; ftDispRender(); }
      }
    }

    async function ftDispSave() {
      const d = ftDp; if (!d) return;
      const f = ftDispFridge(), n = ftNumOrNull(d.temp);
      if (n === null || n === undefined || n < -60 || n > 60) return fmToast('Bitte eine Temperatur wie 3 oder -18 eintragen.');
      if (d.day > fmIso(new Date())) return fmToast('Das Datum liegt in der Zukunft.');
      const temp = Math.round(n * 10) / 10;
      const r = await _supabase.from('fridge_temps').upsert({ fridge_id: f.id, day: d.day, temp }, { onConflict: 'fridge_id,day' }).select();
      if (r.error || !r.data || !r.data.length) return fmToast(r.error ? r.error.message : 'Nicht gespeichert (keine Berechtigung).');
      if (ftOut(f, temp)) fmToast('⚠️ ' + f.name + ': ' + ftFmt(temp) + ' °C liegt außerhalb (' + ftRange(f) + ').');
      d.saved.push(f.name + ' ' + ftFmt(temp));
      // nächstes Gerät vorwählen
      const i = ft.fridges.findIndex(x => x.id === f.id);
      d.fridgeId = ft.fridges[(i + 1) % ft.fridges.length].id;
      d.temp = ''; d.unsure = false; d.url = ''; d.msg = '';
      ftDispRender();
      ftLoad();
    }

    // ---------- Kühlgeräte verwalten ----------
    async function ftManage() {
      const m = fmOpen('ftManage', { title: '⚙️ Kühlgeräte', sub: 'Name und Soll-Bereich. Leer lassen = keine Grenze (z. B. Tiefkühler: nur Höchstwert -18).', layer: 2 });
      m.setBody('<p class="staff-empty">Lade ...</p>');
      const { data, error } = await _supabase.from('fridges').select('*').order('sort_order', { ascending: true }).order('name', { ascending: true });
      if (error) { m.setBody(ftErrorHtml(error)); return; }
      const row = f => `<div class="fm-item ft-man-row" data-id="${escapeHtml(f.id)}">
        <input type="text" class="ui-field ft-man-name" value="${escapeHtml(f.name)}" maxlength="40" placeholder="Name">
        <input type="text" class="ui-field ft-man-min" value="${f.temp_min == null ? '' : escapeHtml(ftFmt(f.temp_min))}" placeholder="min °C" inputmode="decimal">
        <input type="text" class="ui-field ft-man-max" value="${f.temp_max == null ? '' : escapeHtml(ftFmt(f.temp_max))}" placeholder="max °C" inputmode="decimal">
        <label class="ft-man-act"><input type="checkbox" class="ft-man-active" ${f.active ? 'checked' : ''}> aktiv</label>
        <button type="button" class="fm-btn fm-btn-ok" onclick="ftManageSave(this)">💾</button>
        ${f.id ? `<button type="button" class="fm-btn fm-btn-danger" onclick="ftManageDelete(this)" title="Gerät samt Messwerten löschen">🗑</button>` : ''}
      </div>`;
      m.setBody((data || []).map(row).join('') + `<h4 class="form-section-title" style="margin-top:1rem">➕ Neues Kühlgerät</h4>`
        + row({ id: '', name: '', temp_min: null, temp_max: null, active: true }).replace('💾', '➕ Anlegen'));
      m.setFoot('<button type="button" class="ui-btn-primary" onclick="fmClose(\'ftManage\'); ftLoad()">Fertig</button>');
    }

    async function ftManageSave(btn) {
      const rowEl = btn.closest('.ft-man-row');
      const id = rowEl.dataset.id;
      const name = rowEl.querySelector('.ft-man-name').value.trim();
      const lo = ftNumOrNull(rowEl.querySelector('.ft-man-min').value), hi = ftNumOrNull(rowEl.querySelector('.ft-man-max').value);
      if (!name) return fmToast('Bitte einen Namen eingeben.');
      if (lo === undefined || hi === undefined) return fmToast('Soll-Werte bitte als Zahl eintragen, z. B. 2 oder -18.');
      if (lo !== null && hi !== null && lo > hi) return fmToast('Der Mindestwert darf nicht über dem Höchstwert liegen.');
      const payload = { name, temp_min: lo, temp_max: hi, active: rowEl.querySelector('.ft-man-active').checked };
      const res = id ? await _supabase.from('fridges').update(payload).eq('id', id)
        : await _supabase.from('fridges').insert([Object.assign(payload, { sort_order: ft.fridges.length + 1 })]);
      if (res.error) return fmToast(/duplicate|unique/i.test(res.error.message) ? 'Dieser Name existiert schon.' : res.error.message);
      fmToast('Gespeichert');
      ftManage();
    }

    async function ftManageDelete(btn) {
      const rowEl = btn.closest('.ft-man-row');
      const name = rowEl.querySelector('.ft-man-name').value;
      if (!confirm('„' + name + '“ löschen? Alle Messwerte dieses Geräts werden ebenfalls gelöscht (nicht rückgängig). Tipp: „aktiv“ abwählen blendet es nur aus.')) return;
      const { error } = await _supabase.from('fridges').delete().eq('id', rowEl.dataset.id);
      if (error) return fmToast(error.message);
      ftManage();
    }

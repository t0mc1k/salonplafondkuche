/* ============================================================
   js/roster-scan.js  (v1.0.15)
   Dienstplan per FOTO einlesen (nur Manager/Developer): Der ausgedruckte Plan wird fotografiert (Kamera oder Galerie),
   die KI (Edge Function scan-roster) liest die Tabelle, der Manager prüft und korrigiert jede Zelle im Fenster und
   erst dann wird in die angezeigte Woche geschrieben (als Entwurf, wie beim Excel-Import).
   Praktisch, weil der Plan im Betrieb hängt und manchmal von Hand geändert wird: Abweichungen zum gespeicherten Plan
   werden markiert. Das Foto wird nicht gespeichert. Nutzt Hilfen aus team-plan.js (tpParseCell, tpEnsureWeekRow ...).
   ============================================================ */

    const RS_DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
    let rs = null;   // { m, step, week, blob, previewUrl, rows, exclusive:Set, exclTouched, kw, note, chk }

    // ---------- Hilfen ----------
    function rsCellStatus(text) {
      const s = String(text == null ? '' : text).trim();
      if (!s) return 'empty';
      const p = tpParseCell(s);
      if (!p) return 'bad';
      if (p.code && ['OFF', 'K', 'U', 'ZA', 'S'].indexOf(p.code) === -1) return 'bad';   // z. B. „1“ oder „??“ sind keine Schicht
      return 'ok';
    }

    // Zelle in die einheitliche Schreibweise bringen („8.30-17“ -> 08:30 - 17:00 geht nur bei vollständiger Zeit)
    function rsFormatCell(text) {
      const s = String(text == null ? '' : text).trim();
      if (!s || rsCellStatus(s) !== 'ok') return s;
      const p = tpParseCell(s);
      if (p.code) return p.code === 'OFF' ? 'F' : p.code;   // Frei wird als „F“ geschrieben
      if (p.s2) return p.s1[0] + '-' + p.s1[1] + '/' + p.s2[0] + '-' + p.s2[1];
      return p.s1[0] + ' - ' + p.s1[1] + (p.station ? '/' + p.station : '');
    }

    // Bisheriger Eintrag im gespeicherten Plan (zum Vergleichen)
    function rsExistingText(name, dayIdx) {
      const row = tpFindRow(name, tpAddDays(rs.week, dayIdx));
      if (!row) return '';
      const code = tpSpecialCode(row);
      if (code) return (code === 'X' || code === 'OFF') ? 'F' : code;
      if (tpCellMinutes(row) === 0) return '';
      let t = tpTimeInput(row.shift_1_start) + ' - ' + tpTimeInput(row.shift_1_end);
      if (tpToMinutes(row.shift_2_start) !== null) t = tpTimeInput(row.shift_1_start) + '-' + tpTimeInput(row.shift_1_end) + '/' + tpTimeInput(row.shift_2_start) + '-' + tpTimeInput(row.shift_2_end);
      else if (row.station) t += '/' + row.station;
      return t;
    }
    const rsNorm = s => String(s || '').replace(/\s+/g, '').toLowerCase();
    const rsBlobToBase64 = blob => new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(',')[1] || '');
      r.onerror = () => reject(new Error('read failed'));
      r.readAsDataURL(blob);
    });

    // Foto vorbereiten: Ausrichtung beachten, auf höchstens 2800 px Kante verkleinern (Schrift bleibt lesbar), als JPEG
    async function rsPrepare(file) {
      let bmp;
      try { bmp = await createImageBitmap(file); }
      catch (e) { throw Object.assign(new Error('format'), { code: 'format' }); }
      const w0 = bmp.width, h0 = bmp.height;
      const scale = Math.min(1, 2800 / Math.max(w0, h0));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(w0 * scale); canvas.height = Math.round(h0 * scale);
      canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
      if (bmp.close) bmp.close();
      let q = 0.9, blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', q));
      while (blob && blob.size > 6 * 1024 * 1024 && q > 0.6) { q -= 0.1; blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', q)); }
      if (!blob || blob.size > 6.5 * 1024 * 1024) throw Object.assign(new Error('too large'), { code: 'too_large' });
      return { blob, w: w0, h: h0, outW: canvas.width, outH: canvas.height, size: file.size };
    }

    // ---------- Öffnen ----------
    function rsOpen() {
      if (!userIsAdmin) return;
      rs = { step: 'intro', week: new Date(tpWeekStart.getTime()), blob: null, previewUrl: '', rows: [], exclusive: new Set(), exclTouched: false, kw: null, note: '', info: null };
      rs.m = fmOpen('rsModal', { title: '📷 Dienstplan fotografieren', sub: 'KW ' + tpIsoKw(rs.week) + ' · ' + tpWeekRange(rs.week) + ' (Entwurf, wird erst nach deiner Kontrolle gespeichert)', layer: 2, wide: true });
      rs.m.root.classList.add('rs-root');
      rsRenderIntro();
    }

    function rsClose() {
      if (rs && rs.previewUrl) { try { URL.revokeObjectURL(rs.previewUrl); } catch (e) {} }
      rs = null;
      fmClose('rsModal');
    }

    // ---------- Schritt 1: Hinweise und Foto wählen ----------
    function rsRenderIntro(msg) {
      rs.step = 'intro';
      rs.m.setToolbar('');
      rs.m.setBody(`<div class="rs-box rs-warn">
          <h4>📸 Wichtig für ein gutes Ergebnis</h4>
          <ul>
            <li><b>Foto mit einem guten Handy</b> in hoher Auflösung machen (Kamera-App, keine Screenshots, nichts über WhatsApp geschicktes: das verkleinert das Bild stark).</li>
            <li><b>Die ganze Seite</b> aufnehmen: alle vier Ecken, die Zeile mit den Tagen und Datum und jede Zeile bis ganz unten müssen im Bild sein.</li>
            <li><b>Gerade von oben</b> fotografieren, nicht schräg, am besten im Querformat. Das Blatt soll das Bild füllen.</li>
            <li><b>Gutes, gleichmäßiges Licht</b>, keine Schatten und keine Spiegelung. <b>Handy ruhig halten</b>, bis das Bild scharf ist.</li>
            <li>Schwache oder alte Handykamera? Dann lieber die <b>Excel-Datei</b> importieren („📥 Plan importieren“).</li>
          </ul>
          <p class="rs-small">Die KI kann sich bei Handschrift und kleiner Schrift irren. Deshalb prüfst du im nächsten Schritt jede Zelle. Das Foto wird nur zum Lesen an Google Gemini geschickt und nicht gespeichert.</p>
        </div>
        ${msg ? `<p class="rs-err">⚠️ ${escapeHtml(msg)}</p>` : ''}
        <input type="file" id="rsFileCam" accept="image/*" capture="environment" class="hidden" onchange="rsPicked(this)">
        <input type="file" id="rsFileGal" accept="image/*" class="hidden" onchange="rsPicked(this)">
        <div class="rs-actions">
          <button type="button" class="ui-btn-primary rs-big" onclick="document.getElementById('rsFileCam').click()">📷 Foto aufnehmen</button>
          <button type="button" class="ui-btn-ghost rs-big" onclick="document.getElementById('rsFileGal').click()">🖼️ Aus Galerie / Datei wählen</button>
        </div>`);
      rs.m.setFoot(`<button type="button" class="ui-btn-ghost" onclick="rsClose()">Abbrechen</button>`);
    }

    // ---------- Schritt 2: Vorschau und Qualitätsprüfung ----------
    async function rsPicked(input) {
      const file = input && input.files && input.files[0];
      if (!file || !rs) return;
      input.value = '';
      if (!/^image\//.test(file.type)) { rsRenderIntro('Bitte ein Bild auswählen (JPEG oder PNG).'); return; }
      rs.m.setBody('<p class="staff-empty">⏳ Foto wird vorbereitet ...</p>'); rs.m.setFoot('');
      let prep;
      try { prep = await rsPrepare(file); }
      catch (e) { rsRenderIntro(e && e.code === 'too_large' ? 'Das Foto ist zu groß. Bitte ein anderes Foto wählen.' : 'Das Bildformat kann nicht gelesen werden. Bitte ein normales Foto (JPEG/PNG) wählen.'); return; }
      if (!rs) return;
      if (rs.previewUrl) { try { URL.revokeObjectURL(rs.previewUrl); } catch (e) {} }
      rs.blob = prep.blob; rs.previewUrl = URL.createObjectURL(prep.blob); rs.info = prep;
      rsRenderPreview();
    }

    function rsQualityWarnings() {
      const p = rs.info, w = [];
      const long = Math.max(p.w, p.h), short = Math.min(p.w, p.h);
      if (long < 1800 || short < 1100) w.push(`Das Foto ist klein (${p.w} × ${p.h} Pixel). Für gutes Lesen sind mindestens etwa 2000 Pixel Breite nötig. Bitte mit der Kamera-App in voller Auflösung neu fotografieren.`);
      if (p.size < 250 * 1024) w.push(`Die Datei ist sehr klein (${Math.round(p.size / 1024)} KB), das Bild wurde vermutlich stark komprimiert (z. B. durch WhatsApp oder einen Screenshot).`);
      return w;
    }

    function rsRenderPreview() {
      rs.step = 'preview';
      const warns = rsQualityWarnings();
      rs.m.setToolbar('');
      rs.m.setBody(`${warns.length ? `<div class="rs-box rs-warn"><h4>⚠️ Qualität prüfen</h4><ul>${warns.map(w => `<li>${escapeHtml(w)}</li>`).join('')}</ul></div>` : `<p class="rs-ok">✅ Auflösung sieht gut aus (${rs.info.w} × ${rs.info.h}).</p>`}
        <p class="rs-small">Prüfe: Ist die <b>ganze Seite</b> zu sehen, <b>scharf</b> und <b>gerade</b>? Tippe auf das Foto, um es groß anzusehen.</p>
        <img class="rs-preview" src="${escapeHtml(rs.previewUrl)}" alt="Dienstplan-Foto" onclick="openPhotoPreview(${jsArg(rs.previewUrl)})">`);
      rs.m.setFoot(`<button type="button" class="ui-btn-ghost" onclick="rsRenderIntro()">↩️ Anderes Foto</button>
        <button type="button" class="ui-btn-primary" onclick="rsRun()">🔍 ${warns.length ? 'Trotzdem erkennen' : 'Plan erkennen'}</button>`);
    }

    // ---------- Schritt 3: KI liest den Plan ----------
    async function rsErrorText(error, data) {
      let code = data && data.error;
      try { if (!code && error && error.context && typeof error.context.json === 'function') code = (await error.context.json()).error; } catch (e) {}
      const status = error && error.context && error.context.status;
      if (code === 'forbidden' || status === 403) return 'Nur Manager und Developer dürfen den Dienstplan einlesen.';
      if (code === 'auth' || status === 401) return 'Anmeldung ungültig. Bitte neu anmelden.';
      if (code === 'quota' || status === 429) return 'Das Tageslimit für KI-Anfragen ist erreicht. Bitte morgen erneut versuchen oder die Excel-Datei importieren.';
      if (code === 'busy' || status === 503) return 'Die KI ist gerade überlastet. Bitte in einer Minute noch einmal versuchen.';
      if (code === 'too_large' || status === 413) return 'Das Foto ist zu groß. Bitte ein kleineres Foto wählen.';
      if (code === 'not_configured') return 'Der KI-Schlüssel (GEMINI_API_KEY) fehlt auf dem Server.';
      if (status === 404 || (error && /Failed to send|NetworkError|Failed to fetch/i.test(String(error.message || '')))) return 'Die Funktion scan-roster ist noch nicht eingerichtet (siehe docs/SETUP-4.1.00.md).';
      return 'Das Foto konnte nicht gelesen werden. Bitte erneut versuchen, besser fotografieren oder die Excel-Datei importieren.';
    }

    async function rsRun() {
      if (!rs || !rs.blob) return;
      rs.step = 'busy';
      rs.m.setToolbar(''); rs.m.setFoot('');
      rs.m.setBody(`<div class="rs-busy"><div class="rs-spin"></div><p><b>Die KI liest den Dienstplan …</b></p><p class="rs-small">Das dauert meist 15 bis 40 Sekunden, bei Überlastung bis zu einer Minute. Bitte das Fenster offen lassen.</p></div>`);
      try {
        const b64 = await rsBlobToBase64(rs.blob);
        const names = (staffDatabaseRecords || []).map(s => s.name).filter(Boolean);
        const { data, error } = await _supabase.functions.invoke('scan-roster', {
          body: { image: b64, mime: 'image/jpeg', week_start: tpIso(rs.week), names },
          headers: { 'x-staff-token': getStaffToken() }
        });
        if (!rs) return;   // Fenster inzwischen geschlossen
        if (error || !data || data.error || !Array.isArray(data.rows)) { rs.step = 'preview'; rsRenderPreview(); rsShowError(await rsErrorText(error, data)); return; }
        if (!data.readable || !data.rows.length) { rs.step = 'preview'; rsRenderPreview(); rsShowError('Auf dem Foto wurde kein lesbarer Dienstplan gefunden. Bitte näher, gerader, heller und in voller Auflösung fotografieren.' + (data.note ? ' Hinweis der KI: ' + data.note : '')); return; }
        rsShowReview(data);
      } catch (e) {
        if (rs) { rs.step = 'preview'; rsRenderPreview(); rsShowError('Das Foto konnte nicht gesendet werden. Bitte Internet prüfen und noch einmal versuchen.'); }
      }
    }

    function rsShowError(msg) {
      const b = rs.m.body;
      b.insertAdjacentHTML('afterbegin', `<p class="rs-err">⚠️ ${escapeHtml(msg)}</p>`);
    }

    // ---------- Schritt 4: Kontrolle ----------
    function rsShowReview(data) {
      rs.step = 'review';
      rs.kw = data.kw || null; rs.note = data.note || ''; rs.dateFrom = data.date_from || null;
      rs.exclusive = new Set((data.exclusive_days || []).filter(n => n >= 0 && n <= 6));
      rs.exclTouched = false; rs.chk = false;
      rs.rows = data.rows.map(r => { const mt = tpMatchName(r.printed || r.name); return ({ name: mt.matched ? mt.name : (r.matched ? r.name : (r.printed || r.name)), printed: r.printed || r.name, matched: mt.matched || !!r.matched, planOnly: false, suggest: mt.suggest || '', position: r.position || '', group: r.group || '', cells: (r.cells || []).slice(0, 7).map(c => rsFormatCell(c)), flags: (r.uncertain || []).slice(0, 7).map(Boolean), keep: true }); });
      // dieselbe Person in zwei Zeilen = Zuordnung prüfen (nie auf Zeilenzahl/Reihenfolge verlassen)
      const seenN = {}; rs.dupes = [];
      rs.rows.forEach(r => { const k = tpPlainName(r.name); if (!k) return; if (seenN[k]) rs.dupes.push(r.name); seenN[k] = true; });
      rs.rows.forEach(r => { while (r.cells.length < 7) r.cells.push(''); while (r.flags.length < 7) r.flags.push(false); });
      rsRenderReview();
    }

    function rsCellClass(r, j) {
      const st = rsCellStatus(r.cells[j]);
      let c = 'rs-cell';
      if (st === 'bad') c += ' rs-bad';
      else if (r.flags[j] && st !== 'empty') c += ' rs-unsure';
      const old = rsExistingText(r.name, j);
      if (st !== 'empty' && rsNorm(old) !== rsNorm(r.cells[j])) c += ' rs-chg';
      return c;
    }

    function rsStats() {
      let bad = 0, unsure = 0, chg = 0, cells = 0, unknown = 0;
      rs.rows.forEach(r => {
        if (!r.keep) return;
        if (!r.matched && !r.planOnly && String(r.name).trim()) unknown++;
        r.cells.forEach((c, j) => {
          const st = rsCellStatus(c);
          if (st === 'empty') return;
          cells++;
          if (st === 'bad') bad++; else if (r.flags[j]) unsure++;
          if (rsNorm(rsExistingText(r.name, j)) !== rsNorm(c)) chg++;
        });
      });
      return { bad, unsure, chg, cells, unknown, rows: rs.rows.filter(r => r.keep).length };
    }

    function rsRenderReview() {
      const kwNow = tpIsoKw(rs.week);
      const days = [0, 1, 2, 3, 4, 5, 6].map(i => tpAddDays(rs.week, i));
      const warnings = [];
      if (rs.kw && rs.kw !== kwNow) warnings.push(`Auf dem Foto steht <b>KW ${rs.kw}</b>, im Dienstplan ist <b>KW ${kwNow}</b> geöffnet. Stimmt die Woche? Sonst Fenster schließen und die richtige Woche öffnen.`);
      if (rs.dateFrom && rs.dateFrom !== tpIso(rs.week)) warnings.push(`Auf dem Foto beginnt die Woche am <b>${tpDmy(tpParseIso(rs.dateFrom))}</b>, geöffnet ist die Woche ab <b>${tpDmy(rs.week)}</b>.`);
      rs.m.setToolbar(`<div class="rs-bar"><button type="button" class="fm-btn" onclick="openPhotoPreview(${jsArg(rs.previewUrl)})">🔍 Foto groß ansehen</button>
        <span id="rsStats" class="rs-stats"></span></div>`);
      const head = `<tr><th class="rs-name-col">Name</th>${days.map((d, i) => `<th class="rs-dayhead${rs.exclusive.has(i) ? ' rs-excl' : ''}" onclick="rsToggleExcl(${i})" title="Klick: Exklusiv-Schicht ein/aus">${RS_DAYS[i]}<small>${tpDm(d)}</small>${rs.exclusive.has(i) ? '<small>⭐</small>' : ''}</th>`).join('')}<th></th></tr>`;
      const body = rs.rows.map((r, i) => {
        return `<tr data-i="${i}" class="${r.keep ? '' : 'rs-off'}">
          <th class="rs-name-col"><input type="text" class="rs-name${(r.matched || r.planOnly) ? '' : ' rs-unknown'}" list="rsNames" value="${escapeHtml(r.name)}" onchange="rsName(${i}, this)" title="${r.matched ? (r.printed && r.printed !== r.name ? 'Auf dem Foto gelesen: ' + r.printed : 'Im Personal gefunden') : 'Nicht im Personal'}">
            ${r.matched ? '' : '<small class="rs-nm">' + (r.planOnly ? '📄 nur im Dienstplan' : '⚠️ neu / unklar') + '</small>'}</th>
          ${r.cells.map((c, j) => `<td><input type="text" class="${rsCellClass(r, j)}" value="${escapeHtml(c)}" data-i="${i}" data-j="${j}" title="${escapeHtml(rsTitle(r, j))}" onfocus="this.select()" oninput="rsCell(${i}, ${j}, this)" onchange="rsCellDone(${i}, ${j}, this)"></td>`).join('')}
          <td><button type="button" class="rs-del" onclick="rsDelRow(${i})" title="Zeile entfernen">🗑</button></td></tr>`;
      }).join('');
      if (rs.dupes && rs.dupes.length) warnings.push(`Dieselbe Person steht in mehreren Zeilen: <b>${escapeHtml(rs.dupes.join(', '))}</b>. Bitte Namen prüfen, sonst gewinnt die letzte Zeile.`);
      const present = new Set(rs.rows.filter(r => r.keep).map(r => tpPlainName(r.name)));
      const absent = tpEmployees().map(e => e.name).filter(n => !present.has(tpPlainName(n)) && tpRows.some(x => String(x.employee_name).toLowerCase() === n.toLowerCase()));
      if (absent.length) warnings.push(`Im gespeicherten Plan, aber nicht auf dem Foto gefunden: <b>${escapeHtml(absent.join(', '))}</b>. Ihre Einträge bleiben unverändert.`);
      const newPanel = rsNewPeopleHtml();
      rs.m.setBody(`${warnings.map(w => `<p class="rs-err">⚠️ ${w}</p>`).join('')}${newPanel}
        ${rs.note ? `<p class="rs-small">📝 Hinweis der KI: ${escapeHtml(rs.note)}</p>` : ''}
        <div class="rs-legend"><span class="rs-l rs-l-unsure">orange = unsicher gelesen</span><span class="rs-l rs-l-bad">rot = ungültig, bitte korrigieren</span><span class="rs-l rs-l-chg">blau unterstrichen = anders als im gespeicherten Plan</span></div>
        <div class="rs-wrap"><table class="rs-table"><thead>${head}</thead><tbody>${body}</tbody></table></div>
        <datalist id="rsNames">${(staffDatabaseRecords || []).map(s => `<option value="${escapeHtml(s.name)}">`).join('')}</datalist>
        <div class="rs-add"><button type="button" class="fm-btn" onclick="rsAddRow()">➕ Zeile hinzufügen</button></div>
        <label class="rs-confirm"><input type="checkbox" id="rsChk" onchange="rs.chk = this.checked; rsUpdateStats()"> Ich habe alle Werte mit dem Foto verglichen.</label>`);
      rs.m.setFoot(`<button type="button" class="ui-btn-ghost" onclick="rsRenderIntro()">↩️ Neues Foto</button>
        <button type="button" class="ui-btn-ghost" onclick="rsClose()">Abbrechen</button>
        <button type="button" class="ui-btn-primary" id="rsSaveBtn" onclick="rsSave()">💾 In Entwurf übernehmen</button>`);
      rsUpdateStats();
    }

    function rsTitle(r, j) {
      const old = rsExistingText(r.name, j);
      return (old ? 'Bisher im Plan: ' + old : 'Bisher im Plan: (leer)') + (r.flags[j] ? ' · von der KI als unsicher markiert' : '');
    }

    function rsUpdateStats() {
      const s = rsStats();
      const el = document.getElementById('rsStats');
      if (el) el.innerHTML = `<b>${s.rows}</b> Personen · <b>${s.cells}</b> Einträge · <span class="${s.chg ? 'rs-s-chg' : ''}"><b>${s.chg}</b> anders als bisher</span> · <span class="${s.unsure ? 'rs-s-unsure' : ''}"><b>${s.unsure}</b> unsicher</span> · <span class="${s.bad ? 'rs-s-bad' : ''}"><b>${s.bad}</b> ungültig</span>` + (s.unknown ? ` · <span class="rs-s-bad"><b>${s.unknown}</b> neu/unklar</span>` : '');
      const btn = document.getElementById('rsSaveBtn');
      if (btn) { btn.disabled = !(rs.chk && s.bad === 0 && s.unknown === 0 && s.cells > 0); btn.title = s.bad ? 'Zuerst die roten Zellen korrigieren' : (s.unknown ? 'Zuerst neue Personen klären (zuordnen, Konto anlegen oder nur im Dienstplan)' : (rs.chk ? '' : 'Bitte zuerst bestätigen, dass du alles verglichen hast')); }
    }

    function rsCell(i, j, el) {
      const r = rs.rows[i]; r.cells[j] = el.value;
      el.className = rsCellClass(r, j);
      rsUpdateStats();
    }
    function rsCellDone(i, j, el) {   // beim Verlassen: Schreibweise vereinheitlichen
      const r = rs.rows[i];
      const f = rsFormatCell(el.value);
      if (f !== el.value) { el.value = f; r.cells[j] = f; }
      r.flags[j] = false;   // von Hand bestätigt
      el.className = rsCellClass(r, j);
      rsUpdateStats();
    }
    function rsName(i, el) {
      const r = rs.rows[i]; r.name = el.value.trim();
      const mt = tpMatchName(r.name);
      r.matched = mt.matched; r.planOnly = false; r.suggest = mt.suggest || '';
      if (mt.matched) r.name = mt.name;
      rsRenderReview();
    }
    function rsDelRow(i) { rs.rows[i].keep = false; rsRenderReview(); }
    function rsAddRow() { rs.rows.push({ name: '', printed: '', matched: false, planOnly: false, suggest: '', position: '', group: '', cells: ['', '', '', '', '', '', ''], flags: [false, false, false, false, false, false, false], keep: true }); rsRenderReview(); const el = document.querySelector('#rsModal tr:last-child .rs-name'); if (el) el.focus(); }
    function rsToggleExcl(i) { if (rs.exclusive.has(i)) rs.exclusive.delete(i); else rs.exclusive.add(i); rs.exclTouched = true; rsRenderReview(); }

    // ---------- Neue / unklare Personen ----------
    function rsNewPeopleHtml() {
      const list = rs.rows.map((r, i) => ({ r, i })).filter(x => x.r.keep && !x.r.matched && !x.r.planOnly && String(x.r.name).trim());
      if (!list.length) return '';
      const opts = sel => '<option value="">– vorhandene Person wählen –</option>' + (staffDatabaseRecords || []).map(s => `<option value="${escapeHtml(s.name)}"${s.name === sel ? ' selected' : ''}>${escapeHtml(s.name)}</option>`).join('');
      return `<div class="rs-box rs-warn"><h4>🆕 Neue oder unklare Personen</h4>
        <p class="rs-small">Das System kannte diese Namen nicht sicher. Es verlässt sich nur auf den <b>Namen</b>, nicht auf die Zeilen. Bitte pro Person entscheiden:</p>
        ${list.map(x => `<div class="rs-newp"><div><b>${escapeHtml(x.r.printed || x.r.name)}</b>${x.r.position ? ' · ' + escapeHtml(x.r.position) : ''}${x.r.group ? ' · ' + escapeHtml(x.r.group) : ''}</div>
          <div class="rs-newp-act"><select id="rsMap${x.i}" class="ui-field">${opts(x.r.suggest)}</select>
          <button type="button" class="fm-btn" onclick="rsMapTo(${x.i})">✔ Zuordnen</button></div>
          <div class="rs-newp-act"><button type="button" class="fm-btn" onclick="rsCreate(${x.i})">👤 Konto anlegen (PIN 1234)</button>
          <button type="button" class="fm-btn" onclick="rsPlanOnly(${x.i})">📄 Nur im Dienstplan</button></div></div>`).join('')}</div>`;
    }
    function rsMapTo(i) {
      const v = (document.getElementById('rsMap' + i) || {}).value;
      if (!v) return alert('Bitte zuerst eine vorhandene Person wählen.');
      const r = rs.rows[i]; r.name = v; r.matched = true; r.planOnly = false;
      rsRenderReview();
    }
    function rsPlanOnly(i) { const r = rs.rows[i]; r.planOnly = true; rsRenderReview(); }
    async function rsCreate(i) {
      const r = rs.rows[i];
      const name = String(r.name || r.printed).trim();
      if (!name) return;
      if (!confirm('Konto für „' + name + '“ anlegen?\nStart-PIN 1234 (muss beim ersten Login geändert werden).' + (r.position ? '\nPosition: ' + r.position : ''))) return;
      const res = await tpCreateAccounts([{ name, job: r.position, team: r.group }]);
      if (res.errs.length) return alert('Nicht angelegt: ' + res.errs.join('\n'));
      r.name = name; r.matched = true; r.planOnly = false;
      showAppToast({ initial: '👤', title: 'Konto angelegt', text: name + ' · Start-PIN 1234' });
      rsRenderReview();
    }

    // ---------- Speichern ----------
    function rsBuildRows() {
      const out = [];
      rs.rows.forEach(r => {
        if (!r.keep || !String(r.name).trim()) return;
        r.cells.forEach((c, j) => {
          if (rsCellStatus(c) !== 'ok') return;
          const p = tpParseCell(c), d = tpAddDays(rs.week, j);
          const base = { employee_name: r.name.trim(), year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
          if (p.code) out.push(Object.assign(base, { station: null, shift_1_start: p.code, shift_1_end: null, shift_2_start: null, shift_2_end: null }));
          else out.push(Object.assign(base, { station: p.station || null, shift_1_start: p.s1[0], shift_1_end: p.s1[1], shift_2_start: p.s2 ? p.s2[0] : null, shift_2_end: p.s2 ? p.s2[1] : null }));
        });
      });
      return out;
    }

    async function rsSave() {
      if (!rs || !rs.chk) return;
      const s = rsStats();
      if (s.bad) return alert('Bitte zuerst die roten Zellen korrigieren oder leeren.');
      if (rs.rows.some(r => r.keep && !String(r.name).trim() && r.cells.some(c => rsCellStatus(c) === 'ok'))) return alert('Eine Zeile mit Schichten hat keinen Namen. Bitte Namen eintragen oder die Zeile entfernen.');
      const out = rsBuildRows();
      if (!out.length) return alert('Es gibt nichts zu speichern.');
      if (s.unknown) return alert('Bitte zuerst die neuen Personen klären (zuordnen, Konto anlegen oder nur im Dienstplan).');
      const unknown = rs.rows.filter(r => r.keep && !r.matched && r.planOnly && String(r.name).trim()).map(r => r.name);
      const exList = Array.from(rs.exclusive).sort().map(i => RS_DAYS[i]).join(', ');
      const msg = `KW ${tpIsoKw(rs.week)} (${tpWeekRange(rs.week)}): ${out.length} Einträge von ${s.rows} Personen in den Entwurf übernehmen?\n${s.chg} davon sind anders als bisher im Plan.`
        + (unknown.length ? `\n\nNur im Dienstplan (ohne Konto): ${unknown.join(', ')}` : '')
        + (rs.exclusive.size ? `\nExklusiv-Tage: ${exList}` : '')
        + '\n\nVorhandene Einträge dieser Personen an diesen Tagen werden überschrieben. Leere Felder ändern nichts.';
      if (!confirm(msg)) return;
      const btn = document.getElementById('rsSaveBtn'); if (btn) btn.disabled = true;
      if (!await tpEnsureWeekRow()) { if (btn) btn.disabled = false; return; }
      const res = await _supabase.from('work_schedules').upsert(out, { onConflict: 'employee_name,year,month,day' });
      if (res.error) { if (btn) btn.disabled = false; return alert('Speichern fehlgeschlagen: ' + res.error.message); }
      let exNote = '';
      if (rs.exclTouched || rs.exclusive.size) {
        const ex = await _supabase.from('plan_weeks').update({ exclusive_days: Array.from(rs.exclusive).sort() }).eq('week_start', tpIso(rs.week));
        if (ex.error) exNote = ' (Exklusiv-Tage nicht gespeichert: SQL 1.0.03 ausführen)';
      }
      const kw = tpIsoKw(rs.week);
      rsClose();
      await loadTeamPlan();
      showAppToast({ initial: '📷', title: 'Dienstplan aus Foto übernommen', text: `KW ${kw}: ${out.length} Einträge im Entwurf, noch nicht veröffentlicht${exNote}` });
    }

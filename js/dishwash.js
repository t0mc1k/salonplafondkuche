/* ============================================================
   js/dishwash.js  (v1.0.08)
   Abwasher: Reinigungs-Aufgaben (Orte mit Foto, täglich/wöchentlich/monatlich), „Erledigt“-Knopf
   (Name und Zeit setzt die Datenbank), Extra-Einträge, Übersicht und Monats-Rangliste für den Manager.
   Rechte (Datenbank, RLS): Abwasher = Hauptrolle ODER Zusatzrolle dishwasher; Manager/Developer sehen alles
   und pflegen die Orte; Köche haben keinen Zugriff.
   Zu zweit putzen: Kollegen eintragen (wash_logs.with_names), beide bekommen den Punkt. Rangliste und Monate sehen alle Abwasher.
   Übersicht (Leitung): Klick auf einen Eintrag zeigt das Foto des Ortes.
   Fotos: je Ort bis zu 5 (Orte-Editor), je Erledigt-Eintrag bis zu 3 als Nachweis. Kleine Vorschaubilder sparen Datenvolumen.
   Leitung: Speicher-Übersicht und Aufräumen alter Nachweisfotos (Orte-Reiter).
   Tabellen: wash_areas, wash_logs, wash_monthly (sql/1.0.05_dishwash.sql, 1.0.13_wash_helpers.sql, 1.0.15_wash_photos.sql)
   ============================================================ */

    const DW_FREQ = { daily: ['Täglich', 'Daily'], weekly: ['Wöchentlich', 'Weekly'], monthly: ['Monatlich', 'Monthly'] };
    const DW_FREQ_ORDER = ['daily', 'weekly', 'monthly'];
    let dw = { m: null, eds: {}, tab: 'tasks', areas: [], logs: [], stat: { year: 0, month: 0, logs: [] }, archive: [], edit: null, photo: '' };

    function dwCanWash() { return typeof staffHasRole === 'function' && staffHasRole('dishwasher'); }
    function dwWashers() {
      return (staffDatabaseRecords || []).filter(s => s.role === 'dishwasher' || (Array.isArray(s.extra_roles) && s.extra_roles.indexOf('dishwasher') !== -1)).map(s => s.name);
    }
    // Fotos eines Ortes (neu: photos[], alt: photo_url)
    const dwAreaPhotos = a => (a && Array.isArray(a.photos) && a.photos.length) ? a.photos : (a && a.photo_url ? [a.photo_url] : []);
    // <img> mit kleiner Vorschau; fehlt sie (ältere Fotos), wird das Original geladen
    const dwImg = (url, cls, extra) => `<img class="${cls}" src="${escapeHtml(fmThumbUrl(url))}" data-full="${escapeHtml(url)}" alt="" loading="lazy" onerror="this.onerror=null;this.src=this.dataset.full" ${extra || ''}>`;
    const DW_PH_AREA = { max: 5, prefix: 'washarea', opts: { maxSide: 1600, quality: 0.8, thumb: true } };
    const DW_PH_LOG = { max: 3, prefix: 'washlog', opts: { maxSide: 1280, quality: 0.72, thumb: true } };

    // ----- Foto-Editor (Orte: bis 5, Nachweis: bis 3) -----
    // id: Name des Editors; cfg: DW_PH_*; list: vorhandene Fotos. Neu hochgeladene Fotos werden gemerkt (newly), entfernte alte (removed):
    // sie werden erst nach erfolgreichem Speichern aus dem Speicher gelöscht.
    function dwPhNew(id, cfg, list) { dw.eds[id] = { id, cfg, list: (list || []).slice(), newly: [], removed: [], busy: false, status: '' }; return dw.eds[id]; }
    function dwPhHtml(id) {
      const ed = dw.eds[id], full = ed.list.length >= ed.cfg.max;
      return `<div class="dw-ph" id="dwph_${id}">
        <div class="dw-ph-grid">${ed.list.map((u, i) => `<div class="dw-ph-item">${dwImg(u, 'dw-ph-img', `onclick="dwGallery(dw.eds['${id}'].list, '', ${i})"`)}
          ${i === 0 && ed.cfg.max > 3 ? '<span class="dw-ph-main">⭐</span>' : ''}
          <div class="dw-ph-act">${i > 0 && ed.cfg.max > 3 ? `<button type="button" onclick="dwPhMain('${id}', ${i})" title="Als Hauptfoto">⭐</button>` : ''}<button type="button" class="danger" onclick="dwPhRemove('${id}', ${i})" title="Foto entfernen">✕</button></div></div>`).join('')}</div>
        <div class="fm-hint">${ed.list.length} / ${ed.cfg.max} Fotos${full ? ' (Maximum erreicht)' : ''}</div>
        ${full ? '' : `<input type="file" id="dwphCam_${id}" accept="image/*" capture="environment" class="hidden" onchange="dwPhAdd('${id}', this)">
          <input type="file" id="dwphGal_${id}" accept="image/*" multiple class="hidden" onchange="dwPhAdd('${id}', this)">
          <div class="fm-row-flex" style="gap:.4rem;flex-wrap:wrap"><button type="button" class="ui-btn-ghost" onclick="document.getElementById('dwphCam_${id}').click()" ${ed.busy ? 'disabled' : ''}>📷 Foto aufnehmen</button>
            <button type="button" class="ui-btn-ghost" onclick="document.getElementById('dwphGal_${id}').click()" ${ed.busy ? 'disabled' : ''}>🖼️ Datei / Galerie wählen</button></div>`}
        <div class="fm-hint">${escapeHtml(ed.status)}</div></div>`;
    }
    function dwPhRender(id) { const el = document.getElementById('dwph_' + id); if (el) el.outerHTML = dwPhHtml(id); }
    async function dwPhAdd(id, input) {
      const ed = dw.eds[id]; if (!ed) return;
      const files = Array.from(input.files || []).slice(0, ed.cfg.max - ed.list.length);
      input.value = '';
      if (!files.length) return;
      ed.busy = true;
      for (let i = 0; i < files.length; i++) {
        ed.status = '⏳ Foto ' + (i + 1) + ' von ' + files.length + ' wird hochgeladen ...'; dwPhRender(id);
        try { const url = await fmUploadPhoto(files[i], ed.cfg.prefix, ed.cfg.opts); ed.list.push(url); ed.newly.push(url); }
        catch (e) { ed.status = 'Fehler: ' + (e.message || e); dwPhRender(id); ed.busy = false; return; }
      }
      ed.busy = false; ed.status = '✔ Hochgeladen'; dwPhRender(id);
    }
    function dwPhRemove(id, i) {
      const ed = dw.eds[id]; if (!ed) return;
      const [u] = ed.list.splice(i, 1);
      const k = ed.newly.indexOf(u);
      if (k >= 0) { ed.newly.splice(k, 1); fmRemovePhotos([u]); }   // noch nie gespeichert: sofort aus dem Speicher
      else ed.removed.push(u);
      ed.status = ''; dwPhRender(id);
    }
    function dwPhMain(id, i) { const ed = dw.eds[id]; if (!ed) return; ed.list.unshift(ed.list.splice(i, 1)[0]); dwPhRender(id); }
    // Abbruch: neu hochgeladene, nicht gespeicherte Fotos wieder löschen
    function dwPhDiscard(id) { const ed = dw.eds[id]; if (!ed) return; if (ed.newly.length) fmRemovePhotos(ed.newly); delete dw.eds[id]; }

    // Galerie: großes Foto + Vorschau-Leiste
    function dwGallery(urls, title, start) {
      urls = (urls || []).filter(Boolean); if (!urls.length) return;
      let i = Math.max(0, Math.min(urls.length - 1, start || 0));
      const m = fmOpen('dwGal', { title: title ? '🖼️ ' + title : '🖼️ Fotos', layer: 2, wide: true });
      const draw = () => {
        m.setBody(`<div class="dw-gal"><img class="dw-gal-img" src="${escapeHtml(urls[i])}" alt="" onclick="openPhotoPreview(${jsArg(urls[i])})">
          <div class="dw-gal-nav">${urls.length > 1 ? `<button type="button" class="fm-btn" id="dwGalPrev">‹</button><span>${i + 1} / ${urls.length}</span><button type="button" class="fm-btn" id="dwGalNext">›</button>` : ''}</div>
          ${urls.length > 1 ? '<div class="dw-gal-thumbs">' + urls.map((u, k) => dwImg(u, 'dw-gal-th' + (k === i ? ' on' : ''), `data-k="${k}"`)).join('') + '</div>' : ''}</div>`);
        const p = document.getElementById('dwGalPrev'), n = document.getElementById('dwGalNext');
        if (p) p.onclick = () => { i = (i + urls.length - 1) % urls.length; draw(); };
        if (n) n.onclick = () => { i = (i + 1) % urls.length; draw(); };
        m.body.querySelectorAll('.dw-gal-th').forEach(el => { el.onclick = () => { i = Number(el.dataset.k); draw(); }; });
      };
      draw();
      m.setFoot('<button type="button" class="ui-btn-primary" onclick="fmClose(\'dwGal\')">Schließen</button>');
    }

    // Dialog „Fotos der Arbeit“ (bis 3). Ergebnis: { list, removed, newly } oder null bei Abbruch
    function dwPhotoDialog(title, initial) {
      return new Promise(resolve => {
        const ed = dwPhNew('log', DW_PH_LOG, initial);
        let done = false;
        const finish = ok => { if (done) return; done = true; fmClose('dwPhD'); if (ok) resolve({ list: ed.list.slice(), removed: ed.removed.slice(), newly: ed.newly.slice() }); else { dwPhDiscard('log'); resolve(null); } };
        window.dwPhdOk = () => finish(true); window.dwPhdCancel = () => finish(false);
        const m = fmOpen('dwPhD', { title, sub: 'Bis zu 3 Fotos deiner Arbeit (z. B. vorher / nachher).', layer: 2 });
        m.setBody(`<div class="fm-stack">${dwPhHtml('log')}</div>`);
        m.setFoot('<button type="button" class="ui-btn-ghost" onclick="dwPhdCancel()">Abbrechen</button><button type="button" class="ui-btn-primary" onclick="dwPhdOk()">💾 Übernehmen</button>');
        m.root.querySelector('[data-fm-close]').onclick = () => finish(false);
      });
    }

    function dwErr(err) {
      const msg = (err && err.message) || String(err);
      if (/does not exist|schema cache|could not find the (table|function)/i.test(msg) || (err && err.code === '42P01')) {
        return 'Die Datenbank ist für Abwasher noch nicht eingerichtet. Bitte zuerst sql/1.0.05_dishwash.sql im Supabase SQL Editor ausführen.';
      }
      return msg;
    }
    function dwErrHtml(err) { return '<p class="staff-empty" style="color:#ef4444">' + escapeHtml(dwErr(err)) + '</p>'; }

    // Beginn des aktuellen Zeitraums: heute / Montag dieser Woche / 1. des Monats (Ortszeit)
    function dwPeriodStart(freq) {
      const n = new Date();
      if (freq === 'daily') return new Date(n.getFullYear(), n.getMonth(), n.getDate());
      if (freq === 'weekly') return new Date(n.getFullYear(), n.getMonth(), n.getDate() - ((n.getDay() + 6) % 7));
      return new Date(n.getFullYear(), n.getMonth(), 1);
    }
    function dwPeriodText(freq) { return freq === 'daily' ? 'heute' : (freq === 'weekly' ? 'diese Woche' : 'diesen Monat'); }

    // ---------- Öffnen / Laden ----------
    async function openDishwashModal() {
      closeSettingsMenu();
      if (!userIsAdmin && !dwCanWash()) { alert('Dieser Bereich ist nur für Abwasher und die Leitung.'); return; }
      const now = new Date();
      dw.stat = { year: now.getFullYear(), month: now.getMonth() + 1, logs: [] };
      dw.tab = 'tasks';
      dw.m = fmOpen('dwModal', {
        title: '🧽 Abwasher',
        sub: dwCanWash() ? 'Hake erledigte Aufgaben ab (✓ Erledigt). Dein Name und die Zeit werden automatisch gespeichert.'
          : 'Aufgaben, Übersicht und Rangliste. Orte und Rhythmus pflegst du unter „Orte“.',
        wide: true
      });
      dw.m.setBody('<p class="staff-empty">Lade ...</p>');
      try { await _supabase.rpc('wash_close_due_months'); } catch (e) {}   // Monatswertung der Vormonate speichern
      await dwLoad();
    }

    async function dwLoad() {
      const since = new Date(); since.setDate(1); since.setDate(since.getDate() - 7);   // reicht für Woche/Monat/Tag
      const [a, l] = await Promise.all([
        _supabase.from('wash_areas').select('*').order('sort_order', { ascending: true }).order('name', { ascending: true }),
        _supabase.from('wash_logs').select('*').gte('done_at', since.toISOString()).order('done_at', { ascending: false }).limit(3000)
      ]);
      if (a.error) { dw.m.setBody(dwErrHtml(a.error)); return; }
      if (l.error) { dw.m.setBody(dwErrHtml(l.error)); return; }
      dw.areas = a.data || [];
      dw.logs = l.data || [];
      dwRender();
    }

    function dwTab(t) {
      dw.tab = t;
      if (t === 'overview' || t === 'rank') { dwLoadStat(); return; }
      if (t === 'archive') { dwLoadArchive(); return; }
      dwRender();
    }

    function dwTabsHtml() {
      const mine = [['tasks', dwCanWash() ? '✅ Meine Aufgaben' : '✅ Aufgaben']];
      if (dwCanWash()) mine.push(['extra', '➕ Extra'], ['rank', '🏆 Rangliste'], ['archive', '🗂️ Monate']);   // Rangliste sehen alle Abwasher
      const lead = userIsAdmin ? [['overview', '📋 Übersicht']].concat(dwCanWash() ? [] : [['rank', '🏆 Rangliste'], ['archive', '🗂️ Monate']], [['areas', '⚙️ Orte']]) : [];
      const btn = t => `<button type="button" class="fm-tab${dw.tab === t[0] ? ' active' : ''}" onclick="dwTab('${t[0]}')">${t[1]}</button>`;
      // Wer abwäscht UND Leitung ist (z. B. Developer + Abwasher): zwei klar getrennte Bereiche
      if (dwCanWash() && lead.length) {
        return `<div class="dw-modes"><div class="dw-mode"><small>🧽 Meine Arbeit</small><div class="fm-tabs">${mine.map(btn).join('')}</div></div>
          <div class="dw-mode"><small>🧑‍💼 Leitung</small><div class="fm-tabs">${lead.map(btn).join('')}</div></div></div>`;
      }
      return `<div class="fm-tabs">${mine.concat(lead).map(btn).join('')}</div>`;
    }

    function dwRender() {
      dw.m.setToolbar(dwTabsHtml());
      dw.m.setFoot('<button type="button" class="ui-btn-primary" onclick="fmClose(\'dwModal\')">Fertig</button>');
      if (dw.tab === 'tasks') return dwRenderTasks();
      if (dw.tab === 'extra') return dwRenderExtra();
      if (dw.tab === 'areas') return dwRenderAreas();
    }

    // ---------- Aufgaben ----------
    function dwLastDone(a) {
      const start = dwPeriodStart(a.frequency);
      return dw.logs.find(l => l.area_id === a.id && new Date(l.done_at) >= start) || null;   // logs sind nach Zeit absteigend sortiert
    }

    function dwRenderTasks() {
      const areas = dw.areas.filter(a => a.active);
      if (!areas.length) {
        dw.m.setBody(`<p class="staff-empty">${userIsAdmin ? 'Es gibt noch keine Aufgaben zum Abhaken. Lege zuerst unter „⚙️ Orte“ (Bereich Leitung) die Orte und Aufgaben an, danach erscheinen sie hier mit dem Knopf „✓ Erledigt“.' : 'Der Manager hat noch keine Aufgaben angelegt.'}</p>`);
        return;
      }
      const meLower = String(currentWaiterName || '').toLowerCase();
      let html = '';
      DW_FREQ_ORDER.forEach(freq => {
        const list = areas.filter(a => a.frequency === freq);
        if (!list.length) return;
        const doneCount = list.filter(a => dwLastDone(a)).length;
        html += `<h4 class="dw-group">${DW_FREQ[freq][0]} <small>${doneCount} / ${list.length} erledigt ${dwPeriodText(freq)}</small></h4><div class="dw-list">`;
        // Offene Aufgaben zuerst (auf dem Handy sofort sichtbar), erledigte darunter
        const sorted = list.slice().sort((x, y) => (dwLastDone(x) ? 1 : 0) - (dwLastDone(y) ? 1 : 0));
        html += sorted.map(a => {
          const last = dwLastDone(a);
          const aph = dwAreaPhotos(a);
          const thumb = aph.length
            ? `<div class="dw-thumbwrap">${dwImg(aph[0], 'dw-thumb', `onclick="dwGallery(dwAreaPhotos(dw.areas.find(x => x.id === ${jsArg(a.id)})), ${jsArg(a.name)}, 0)" title="Fotos ansehen"`)}${aph.length > 1 ? `<span class="dw-thumbcnt">+${aph.length - 1}</span>` : ''}</div>`
            : '<div class="dw-thumb dw-nophoto">🧽</div>';
          let info = '', action = '';
          if (last) {
            const mine = String(last.done_by || '').toLowerCase() === meLower;
            const undo = (mine || userIsAdmin) && (userIsAdmin || (Date.now() - new Date(last.done_at).getTime() < 3600000))
              ? `<button type="button" class="fm-btn dw-ico" onclick="dwUndo(${jsArg(last.id)})" title="Eintrag zurücknehmen" aria-label="Zurücknehmen">↩️</button>` : '';
            const team = [last.done_by].concat(last.with_names || []).join(' + ');
            const help = (mine || userIsAdmin) ? `<button type="button" class="fm-btn dw-ico" onclick="dwEditHelpers(${jsArg(last.id)})" title="Kollegen eintragen, die mitgeholfen haben" aria-label="Kollegen">👥</button>` : '';
            const proof = (last.photos || []).length ? `<div class="dw-proof">${last.photos.map((u, k) => dwImg(u, 'dw-proof-img', `onclick="dwGallery(dw.logs.find(x => x.id === ${jsArg(last.id)}).photos, ${jsArg('Arbeit: ' + a.name)}, ${k})"`)).join('')}</div>` : '';
            const cam = (mine && Date.now() - new Date(last.done_at).getTime() < 86400000) || userIsAdmin ? `<button type="button" class="fm-btn dw-ico" onclick="dwEditLogPhotos(${jsArg(last.id)})" title="Fotos der Arbeit (bis 3)" aria-label="Fotos">📷</button>` : '';
            info = `<div class="dw-done">✅ ${escapeHtml(team)} · ${escapeHtml(fmDateTime(last.done_at))}</div>${proof}`;
            action = cam + help + undo;
          } else if (dwCanWash() || userIsAdmin) {
            action = `<button type="button" class="ui-btn-primary dw-ok" onclick="dwMark(${jsArg(a.id)}, this)">✓ Erledigt</button>
              <button type="button" class="fm-btn dw-ico" onclick="dwMarkPhoto(${jsArg(a.id)})" title="Erledigt mit Foto (bis 3)" aria-label="Mit Foto">📷</button>
              <button type="button" class="fm-btn dw-ico" onclick="dwMarkWith(${jsArg(a.id)})" title="Zu zweit geputzt: Kollegen eintragen" aria-label="Zu zweit">👥</button>`;
          } else {
            info = '<div class="dw-open">⏳ Offen</div>';
          }
          return `<div class="dw-row${last ? ' dw-row-done' : ''}">${thumb}<div class="dw-rowmain">
              <div class="dw-name">${escapeHtml(a.name)}</div>
              ${a.description ? `<div class="dw-desc">${escapeHtml(a.description)}</div>` : ''}${info}</div>
            <div class="dw-rowact">${action}</div></div>`;
        }).join('');
        html += '</div>';
      });
      const mine = dw.logs.filter(l => (String(l.done_by || '').toLowerCase() === meLower || (l.with_names || []).some(n => String(n).toLowerCase() === meLower)) && dwInMonth(l.done_at, new Date().getFullYear(), new Date().getMonth() + 1)).length;
      if (dwCanWash()) html = `<div class="tp-summary" style="padding:.4rem 0 .6rem"><span><b>${mine}</b> Einträge von dir in diesem Monat</span></div>` + html;
      dw.m.setBody(html);
    }

    function dwInMonth(iso, y, m) { const d = new Date(iso); return d.getFullYear() === y && d.getMonth() + 1 === m; }

    // Zu zweit: erst Kollegen wählen, dann speichern
    async function dwMarkWith(areaId) {
      const names = await dwPickHelpers('👥 Wer hat mitgeholfen?', []);
      if (names === null) return;
      await dwMark(areaId, null, names);
    }

    async function dwEditHelpers(logId) {
      const l = dw.logs.find(x => x.id === logId) || dw.stat.logs.find(x => x.id === logId);
      if (!l) return;
      const names = await dwPickHelpers('👥 Kollegen bei „' + (l.area_name || 'Aufgabe') + '“', l.with_names || [], l.done_by);
      if (names === null) return;
      const { error } = await _supabase.rpc('wash_set_helpers', { p_log: logId, p_names: names });
      if (error) return fmToast(/Keine Berechtigung/i.test(error.message) ? 'Nur der Eintragende (bis 24 Std.) oder die Leitung darf das ändern.' : dwErr(error));
      fmToast('✓ Gespeichert');
      fmClose('dwLogView');
      if (dw.tab === 'overview') await dwLoadStat(); else await dwLoad();
    }

    // Auswahl der Kollegen (Abwasher, ohne sich selbst). Gibt Namen-Liste zurück, null bei Abbruch.
    function dwPickHelpers(title, selected, owner) {
      return new Promise(resolve => {
        const me = String(owner || currentWaiterName || '').toLowerCase();
        const others = dwWashers().filter(n => n.toLowerCase() !== me);
        const m = fmOpen('dwHelp', { title, sub: 'Wer hat dieselbe Aufgabe gleichzeitig erledigt? Alle bekommen den Punkt.', layer: 2 });
        let done = false;
        const finish = v => { if (done) return; done = true; fmClose('dwHelp'); resolve(v); };
        window.dwHelpOk = () => finish(Array.from(document.querySelectorAll('#dwHelp input[type=checkbox]:checked')).map(c => c.value));
        window.dwHelpCancel = () => finish(null);
        m.setBody(others.length ? '<div class="fm-stack">' + others.map(n => `<label class="switch-row"><span>${escapeHtml(n)}</span><span class="switch"><input type="checkbox" value="${escapeHtml(n)}" ${selected.indexOf(n) !== -1 ? 'checked' : ''}><span class="switch-track"></span></span></label>`).join('') + '</div>'
          : '<p class="staff-empty">Es gibt keine weiteren Abwasher im Personal.</p>');
        m.setFoot('<button type="button" class="ui-btn-ghost" onclick="dwHelpCancel()">Abbrechen</button><button type="button" class="ui-btn-primary" onclick="dwHelpOk()">💾 Speichern</button>');
        m.root.querySelector('[data-fm-close]').onclick = () => finish(null);
      });
    }

    async function dwMark(areaId, btn, withNames, photos) {
      if (btn) btn.disabled = true;
      const row = { area_id: areaId };
      if (withNames && withNames.length) row.with_names = withNames;
      if (photos && photos.length) row.photos = photos;
      const { error } = await _supabase.from('wash_logs').insert([row]);
      if (error) { if (btn) btn.disabled = false; fmToast(dwErr(error)); return false; }
      fmToast('✓ Gespeichert');
      await dwLoad();
      return true;
    }

    // Erledigt mit Foto(s) der Arbeit
    async function dwMarkPhoto(areaId) {
      const res = await dwPhotoDialog('📷 Foto der erledigten Arbeit', []);
      if (res === null) return;
      const ok = await dwMark(areaId, null, null, res.list);
      if (!ok && res.newly.length) fmRemovePhotos(res.newly);
    }

    // Fotos eines vorhandenen Eintrags ändern (Eintragender bis 24 Std., Leitung immer)
    async function dwEditLogPhotos(logId) {
      const l = dw.logs.find(x => x.id === logId) || dw.stat.logs.find(x => x.id === logId);
      if (!l) return;
      const res = await dwPhotoDialog('📷 Fotos bei „' + (l.area_name || 'Aufgabe') + '“', l.photos || []);
      if (res === null) return;
      const { error } = await _supabase.rpc('wash_set_log_photos', { p_log: logId, p_photos: res.list });
      if (error) { if (res.newly.length) fmRemovePhotos(res.newly); return fmToast(/Keine Berechtigung/i.test(error.message) ? 'Nur der Eintragende (bis 24 Std.) oder die Leitung darf das ändern.' : dwErr(error)); }
      if (res.removed.length) fmRemovePhotos(res.removed);
      fmToast('✓ Gespeichert');
      fmClose('dwLogView');
      if (dw.tab === 'overview') await dwLoadStat(); else await dwLoad();
    }

    async function dwUndo(logId) {
      if (!confirm('Diesen Eintrag zurücknehmen?')) return;
      const old = dw.logs.find(x => x.id === logId);
      const { error } = await _supabase.from('wash_logs').delete().eq('id', logId);
      if (error) return fmToast(dwErr(error));
      if (old && old.photos && old.photos.length) fmRemovePhotos(old.photos);
      await dwLoad();
    }

    // ---------- Extra (etwas, das über die Liste hinaus geputzt wurde) ----------
    function dwRenderExtra() {
      const now = new Date();
      const meLower = String(currentWaiterName || '').toLowerCase();
      const mine = dw.logs.filter(l => !l.area_id && String(l.done_by || '').toLowerCase() === meLower && dwInMonth(l.done_at, now.getFullYear(), now.getMonth() + 1));
      dw.m.setBody(`<div class="fm-stack">
        <div class="fm-field"><label class="form-label" for="dwExtraText">Was hast du zusätzlich geputzt?</label>
          <div class="fm-row-flex" style="gap:.4rem">
            <input type="text" id="dwExtraText" class="ui-field" maxlength="120" autocomplete="off" placeholder="z. B. Fettfilter Dunstabzug"
              onkeydown="if (event.key === 'Enter') { event.preventDefault(); dwAddExtra(); }" style="flex:1">
            <button type="button" class="ui-btn-primary" onclick="dwAddExtra()">➕ Hinzufügen</button>
          </div>
          <p class="fm-hint">Extra-Einträge zählen in der Monatswertung mit.</p></div>
        <h4 class="dw-group">Deine Extra-Einträge in diesem Monat <small>${mine.length}</small></h4>
        ${mine.length ? mine.map(l => `<div class="fm-item"><div class="fm-item-main">
            <div class="fm-item-title">${escapeHtml(l.extra_text)}</div>
            <div class="fm-item-sub">${escapeHtml(fmDateTime(l.done_at))}</div>
            ${Date.now() - new Date(l.done_at).getTime() < 3600000 ? `<div class="fm-item-actions"><button type="button" class="fm-btn" onclick="dwUndo(${jsArg(l.id)})">↩️ Zurücknehmen</button></div>` : ''}
          </div></div>`).join('') : '<p class="staff-empty">Noch nichts eingetragen.</p>'}
      </div>`);
    }

    async function dwAddExtra() {
      const inp = document.getElementById('dwExtraText');
      const text = (inp && inp.value || '').trim();
      if (!text) return fmToast('Bitte eintragen, was du geputzt hast.');
      const { error } = await _supabase.from('wash_logs').insert([{ area_id: null, extra_text: text }]);
      if (error) return fmToast(dwErr(error));
      fmToast('✓ Extra gespeichert');
      await dwLoad();
    }

    // ---------- Übersicht & Rangliste (Manager/Developer) ----------
    async function dwLoadStat() {
      dw.m.setToolbar(dwTabsHtml());
      dw.m.setBody('<p class="staff-empty">Lade ...</p>');
      const y = dw.stat.year, mo = dw.stat.month;
      const from = new Date(y, mo - 1, 1).toISOString(), to = new Date(y, mo, 1).toISOString();
      const { data, error } = await _supabase.from('wash_logs').select('*').gte('done_at', from).lt('done_at', to).order('done_at', { ascending: false }).limit(3000);
      if (error) { dw.m.setBody(dwErrHtml(error)); return; }
      dw.stat.logs = data || [];
      dw.tab === 'rank' ? dwRenderRank() : dwRenderOverview();
    }

    function dwShiftStatMonth(delta) {
      dw.stat.month += delta;
      if (dw.stat.month < 1) { dw.stat.month = 12; dw.stat.year--; }
      if (dw.stat.month > 12) { dw.stat.month = 1; dw.stat.year++; }
      dwLoadStat();
    }
    function dwMonthNavHtml() {
      return `<div class="tp-monthnav" style="margin-bottom:.7rem">
        <button type="button" class="ui-btn-ghost" onclick="dwShiftStatMonth(-1)" aria-label="Vorheriger Monat">‹</button>
        <b class="tp-month-label">${escapeHtml(FM_MONTHS[dw.stat.month - 1] + ' ' + dw.stat.year)}</b>
        <button type="button" class="ui-btn-ghost" onclick="dwShiftStatMonth(1)" aria-label="Nächster Monat">›</button></div>`;
    }

    // Wertung pro Person: Aufgaben + Extras, sortiert nach Gesamt, dann Aufgaben, dann Name
    function dwScores(logs) {
      const map = new Map();
      dwWashers().forEach(n => map.set(n, { name: n, tasks: 0, extras: 0 }));
      logs.forEach(l => {
        [l.done_by].concat(l.with_names || []).forEach(n => {   // wer es gemacht hat + Kollegen, die mitgeholfen haben
          if (!map.has(n)) map.set(n, { name: n, tasks: 0, extras: 0 });
          const s = map.get(n);
          if (l.area_id || !l.extra_text) s.tasks++; else s.extras++;
        });
      });
      const list = Array.from(map.values()).map(s => Object.assign(s, { total: s.tasks + s.extras }));
      list.sort((a, b) => b.total - a.total || b.tasks - a.tasks || a.name.localeCompare(b.name, 'de'));
      let rank = 0, prev = null;
      list.forEach((s, i) => { const key = s.total + '/' + s.tasks; if (key !== prev) { rank = i + 1; prev = key; } s.rank = rank; });
      return list;
    }
    const DW_MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' };

    function dwRenderRank() {
      const list = dwScores(dw.stat.logs);
      const any = list.some(s => s.total > 0);
      const best = any ? list.filter(s => s.rank === 1) : [];
      const isCurrent = dw.stat.year === new Date().getFullYear() && dw.stat.month === new Date().getMonth() + 1;
      let html = dwMonthNavHtml();
      if (best.length) html += `<div class="dw-best">🏆 ${isCurrent ? 'Aktuell vorne' : 'Bester im Monat'}: <b>${best.map(b => escapeHtml(b.name)).join(' & ')}</b> mit ${best[0].total} Einträgen</div>`;
      html += `<div class="dw-rank">${list.length ? list.map(s => `<div class="dw-rank-row${s.rank === 1 && s.total > 0 ? ' dw-rank-first' : ''}${String(s.name).toLowerCase() === String(currentWaiterName || '').toLowerCase() ? ' dw-rank-me' : ''}">
          <span class="dw-rank-pos">${s.total > 0 ? (DW_MEDAL[s.rank] || s.rank + '.') : '–'}</span>
          <span class="dw-rank-name">${escapeHtml(s.name)}${String(s.name).toLowerCase() === String(currentWaiterName || '').toLowerCase() ? ' <small>(du)</small>' : ''}</span>
          <span class="dw-rank-meta">${s.tasks} Aufgaben · ${s.extras} Extra</span>
          <b class="dw-rank-total">${s.total}</b></div>`).join('') : '<p class="staff-empty">Keine Abwasher im Personal.</p>'}</div>
        <p class="fm-hint" style="margin-top:.6rem">${isCurrent ? 'Zwischenstand. Am Monatsende wird die Wertung automatisch gespeichert (siehe „🗂️ Monate“).' : 'Berechnet aus allen Einträgen dieses Monats.'} Wer zu zweit putzt, trägt den Kollegen ein: beide bekommen den Punkt.</p>`;
      dw.m.setBody(html);
      dw.m.setFoot('<button type="button" class="ui-btn-primary" onclick="fmClose(\'dwModal\')">Fertig</button>');
    }

    function dwRenderOverview() {
      const logs = dw.stat.logs;
      const tasks = logs.filter(l => l.area_id || !l.extra_text).length, extras = logs.length - tasks;
      let html = dwMonthNavHtml() + `<div class="tp-summary" style="padding:0 0 .6rem"><span><b>${logs.length}</b> Einträge</span><span><b>${tasks}</b> Aufgaben</span><span><b>${extras}</b> Extra</span></div>`;
      if (!logs.length) html += '<p class="staff-empty">Keine Einträge in diesem Monat.</p>';
      else {
        html += '<p class="fm-hint" style="margin-bottom:.4rem">Tippe auf einen Eintrag, um das Foto des Ortes zu sehen.</p><div class="dw-log">' + logs.map(l => `<div class="dw-log-row dw-log-click" onclick="dwShowLog(${jsArg(l.id)})">
          <span class="dw-log-time">${escapeHtml(fmDateTime(l.done_at))}</span>
          <span class="dw-log-who">${escapeHtml([l.done_by].concat(l.with_names || []).join(' + '))}</span>
          <span class="dw-log-what">${l.area_id || !l.extra_text ? escapeHtml(l.area_name || 'Aufgabe') : '➕ ' + escapeHtml(l.extra_text)}</span>
          <button type="button" class="fm-btn fm-btn-danger" onclick="event.stopPropagation(); dwUndoStat(${jsArg(l.id)})" title="Eintrag löschen">🗑</button></div>`).join('') + '</div>';
      }
      dw.m.setBody(html);
      dw.m.setFoot('<button type="button" class="ui-btn-ghost" onclick="dwExportExcel()">📗 Excel</button><button type="button" class="ui-btn-primary" onclick="fmClose(\'dwModal\')">Fertig</button>');
    }

    // Eintrag ansehen: Foto des Ortes, Beschreibung, wer wann (mit Kollegen)
    function dwShowLog(id) {
      const l = dw.stat.logs.find(x => x.id === id); if (!l) return;
      const a = l.area_id ? dw.areas.find(x => x.id === l.area_id) : null;
      const isExtra = !l.area_id && l.extra_text;
      const team = [l.done_by].concat(l.with_names || []);
      const m = fmOpen('dwLogView', { title: isExtra ? '➕ ' + l.extra_text : '🧽 ' + (l.area_name || (a && a.name) || 'Aufgabe'), sub: fmDateTime(l.done_at) + ' · ' + team.join(' + '), layer: 2 });
      const aph = dwAreaPhotos(a), proof = l.photos || [];
      const grid = (urls, cap) => urls.length ? `<div class="dw-viewgrid">${urls.map((u, k) => dwImg(u, 'dw-viewthumb', `onclick="dwGallery(${jsArg(urls)}, ${jsArg(cap)}, ${k})"`)).join('')}</div>` : '';
      const photo = (proof.length ? `<h4 class="dw-group">📷 Foto${proof.length > 1 ? 's' : ''} der Arbeit</h4>${grid(proof, 'Arbeit: ' + (l.area_name || ''))}` : '')
        + (aph.length ? `<h4 class="dw-group">🧽 ${proof.length ? 'Ort (Soll-Zustand)' : 'Foto des Ortes'}</h4>${proof.length ? grid(aph, a.name) : `<img class="dw-viewphoto" src="${escapeHtml(aph[0])}" alt="${escapeHtml(a.name)}" onclick="dwGallery(${jsArg(aph)}, ${jsArg(a.name)}, 0)">${aph.length > 1 ? grid(aph.slice(1), a.name) : ''}`}` : '')
        || `<div class="dw-viewphoto dw-nophoto">${isExtra ? '➕' : '🧽'}<small>${isExtra ? 'Extra-Eintrag (kein Ort mit Foto)' : (a ? 'Für diesen Ort gibt es kein Foto' : 'Der Ort wurde inzwischen gelöscht')}</small></div>`;
      m.setBody(`<div class="fm-stack">${photo}
        ${a && a.description ? `<p>${escapeHtml(a.description)}</p>` : ''}
        <div class="tp-summary"><span>👤 <b>${escapeHtml(team.join(' + '))}</b></span><span>🕒 <b>${escapeHtml(fmDateTime(l.done_at))}</b></span>${a ? `<span>${escapeHtml(DW_FREQ[a.frequency][0])}</span>` : ''}</div></div>`);
      m.setFoot(`<button type="button" class="ui-btn-ghost" onclick="dwEditHelpers(${jsArg(l.id)})">👥 Kollegen</button><button type="button" class="ui-btn-ghost" onclick="dwEditLogPhotos(${jsArg(l.id)})">📷 Fotos</button><button type="button" class="ui-btn-primary" onclick="fmClose('dwLogView')">Schließen</button>`);
    }

    async function dwUndoStat(id) {
      if (!confirm('Eintrag endgültig löschen?')) return;
      const old = dw.stat.logs.find(x => x.id === id);
      const { error } = await _supabase.from('wash_logs').delete().eq('id', id);
      if (error) return fmToast(dwErr(error));
      if (old && old.photos && old.photos.length) fmRemovePhotos(old.photos);
      await dwLoadStat();
    }

    function dwExportExcel() {
      if (typeof XLSX === 'undefined') return alert('Excel-Bibliothek nicht geladen.');
      const logs = dw.stat.logs;
      const rank = dwScores(logs);
      const wb = XLSX.utils.book_new();
      const a1 = [['Rang', 'Name', 'Aufgaben', 'Extra', 'Gesamt']].concat(rank.map(s => [s.rank, s.name, s.tasks, s.extras, s.total]));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(a1), 'Rangliste');
      const a2 = [['Zeit', 'Name', 'Aufgabe / Extra']].concat(logs.map(l => [fmDateTime(l.done_at), [l.done_by].concat(l.with_names || []).join(' + '), l.area_id || !l.extra_text ? (l.area_name || 'Aufgabe') : 'Extra: ' + l.extra_text]));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(a2), 'Einträge');
      XLSX.writeFile(wb, 'Abwasher_' + dw.stat.year + '-' + String(dw.stat.month).padStart(2, '0') + '.xlsx');
    }

    // ---------- Archiv: gespeicherte Monatswertungen ----------
    async function dwLoadArchive() {
      dw.m.setToolbar(dwTabsHtml());
      dw.m.setBody('<p class="staff-empty">Lade ...</p>');
      const { data, error } = await _supabase.from('wash_monthly').select('*').order('month', { ascending: false }).order('rank', { ascending: true }).limit(600);
      if (error) { dw.m.setBody(dwErrHtml(error)); return; }
      const byMonth = {};
      (data || []).forEach(r => { (byMonth[r.month] = byMonth[r.month] || []).push(r); });
      const months = Object.keys(byMonth).sort().reverse();
      dw.m.setBody(months.length ? months.map(k => {
        const d = fmParseIso(k), rows = byMonth[k];
        const win = rows.filter(r => r.rank === 1 && r.total > 0);
        return `<div class="dw-arch"><h4 class="dw-group">${escapeHtml(FM_MONTHS[d.getMonth()] + ' ' + d.getFullYear())}
            <small>${win.length ? '🏆 ' + escapeHtml(win.map(w => w.staff_name).join(' & ')) : 'keine Einträge'}</small></h4>
          ${rows.map(r => `<div class="dw-rank-row"><span class="dw-rank-pos">${r.total > 0 ? (DW_MEDAL[r.rank] || r.rank + '.') : '–'}</span>
            <span class="dw-rank-name">${escapeHtml(r.staff_name)}</span>
            <span class="dw-rank-meta">${r.tasks} Aufgaben · ${r.extras} Extra</span><b class="dw-rank-total">${r.total}</b></div>`).join('')}</div>`;
      }).join('') : '<p class="staff-empty">Noch keine abgeschlossenen Monate. Die Wertung wird automatisch nach Monatsende gespeichert.</p>');
      dw.m.setFoot('<button type="button" class="ui-btn-primary" onclick="fmClose(\'dwModal\')">Fertig</button>');
    }

    // ---------- Orte verwalten (Manager/Developer) ----------
    function dwRenderAreas() {
      let html = '<div id="dwStorage" class="dw-storage"><span class="fm-hint">Foto-Speicher wird geprüft …</span></div>' + `<div class="fm-row-flex" style="justify-content:flex-end;margin-bottom:.6rem"><button type="button" class="ui-btn-primary" onclick="dwOpenAreaForm('')">➕ Neuer Ort / Aufgabe</button></div>`;
      html += dw.areas.length ? dw.areas.map(a => `<div class="fm-item${a.active ? '' : ' dw-inactive'}">
          ${dwAreaPhotos(a).length ? dwImg(dwAreaPhotos(a)[0], 'fm-thumb') : '<div class="fm-thumb dw-nophoto">🧽</div>'}
          <div class="fm-item-main">
            <div class="fm-item-title">${escapeHtml(a.name)} ${fmStatusChip(DW_FREQ[a.frequency][0], 'blue')}${dwAreaPhotos(a).length ? ' ' + fmStatusChip('📷 ' + dwAreaPhotos(a).length, 'gray') : ''}${a.active ? '' : ' ' + fmStatusChip('ausgeblendet', 'gray')}</div>
            ${a.description ? `<div class="fm-item-sub">${escapeHtml(a.description)}</div>` : ''}
            <div class="fm-item-actions">
              <button type="button" class="fm-btn" onclick="dwOpenAreaForm(${jsArg(a.id)})">✏️ Bearbeiten</button>
              <button type="button" class="fm-btn fm-btn-danger" onclick="dwDeleteArea(${jsArg(a.id)})">🗑</button>
            </div></div></div>`).join('') : '<p class="staff-empty">Noch keine Orte. Lege z. B. „Fettabscheider“, „Bodenabläufe“ oder „Spülküche Wände“ an.</p>';
      dw.m.setBody(html);
      dwLoadStorage();
    }

    // ---------- Foto-Speicher (Leitung) ----------
    const DW_PREFIX_NAMES = { washlog: 'Abwasher: Fotos der Arbeit', washarea: 'Abwasher: Orte', abwasher: 'Abwasher: Orte (ältere)', recipe: 'Rezepte', recipes: 'Rezepte', drink: 'Rezepte / Getränke', chat: 'Chat', profile: 'Profile', maint: 'Störungen', staff: 'Profile' };
    const dwFmtBytes = b => b >= 1073741824 ? (b / 1073741824).toFixed(2).replace('.', ',') + ' GB' : (b >= 1048576 ? (b / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.round(b / 1024) + ' KB');
    function dwStorageLimit() { try { return Number(localStorage.getItem('dw_storage_gb')) || 1; } catch (e) { return 1; } }
    function dwSetStorageLimit(gb) { try { localStorage.setItem('dw_storage_gb', String(gb)); } catch (e) {} dwLoadStorage(); }
    async function dwLoadStorage() {
      const el = document.getElementById('dwStorage'); if (!el) return;
      const { data, error } = await _supabase.rpc('photo_storage_stats');
      if (error) { el.innerHTML = '<span class="fm-hint">Foto-Speicher: ' + escapeHtml(/does not exist|schema cache|could not find/i.test(error.message) ? 'bitte sql/1.0.15_wash_photos.sql ausführen' : error.message) + '</span>'; return; }
      const rows = data || [], total = rows.length ? Number(rows[0].total_bytes) : 0, files = rows.length ? Number(rows[0].total_files) : 0;
      const gb = dwStorageLimit(), limit = gb * 1073741824, pct = Math.min(100, total / limit * 100);
      el.innerHTML = `<div class="dw-st-head"><b>📦 Foto-Speicher</b> <span>${dwFmtBytes(total)} von ${gb} GB belegt (${pct < 1 ? '< 1' : Math.round(pct)} %) · ${files} Dateien</span></div>
        <div class="dw-st-bar"><div class="dw-st-fill${pct > 80 ? ' hot' : ''}" style="width:${Math.max(1, pct)}%"></div></div>
        <div class="dw-st-rows">${rows.slice(0, 6).map(r => `<span>${escapeHtml(DW_PREFIX_NAMES[r.prefix] || r.prefix)}: <b>${dwFmtBytes(Number(r.bytes))}</b></span>`).join('')}</div>
        <div class="fm-row-flex" style="gap:.4rem;flex-wrap:wrap;margin-top:.4rem">
          <label class="fm-hint">Tarif: <select class="ui-field dw-st-sel" onchange="dwSetStorageLimit(this.value)"><option value="1"${gb === 1 ? ' selected' : ''}>Free (1 GB)</option><option value="100"${gb === 100 ? ' selected' : ''}>Pro (100 GB)</option></select></label>
          <button type="button" class="fm-btn" onclick="dwCleanupPhotos()">🧹 Alte Arbeitsfotos löschen</button></div>`;
    }
    async function dwCleanupPhotos() {
      const days = parseInt(prompt('Fotos der Arbeit löschen, die älter sind als wie viele Tage? (mindestens 7)\nDie Einträge bleiben erhalten, nur die Fotos werden gelöscht.', '90'), 10);
      if (!days || days < 7) return;
      const { data, error } = await _supabase.rpc('wash_old_photos', { p_days: days });
      if (error) return fmToast(dwErr(error));
      const rows = data || [], urls = [].concat(...rows.map(r => r.photos || []));
      if (!rows.length) return fmToast('Keine Fotos älter als ' + days + ' Tage.');
      if (!confirm(urls.length + ' Fotos von ' + rows.length + ' Einträgen (älter als ' + days + ' Tage) endgültig löschen?')) return;
      for (let i = 0; i < urls.length; i += 50) await fmRemovePhotos(urls.slice(i, i + 50));
      const c = await _supabase.rpc('wash_clear_log_photos', { p_ids: rows.map(r => r.log_id) });
      if (c.error) return fmToast(dwErr(c.error));
      fmToast('✓ ' + urls.length + ' Fotos gelöscht');
      dwLoadStorage();
    }

    function dwOpenAreaForm(id) {
      const a = id ? dw.areas.find(x => x.id === id) : null;
      dw.edit = a || { id: '', name: '', description: '', photo_url: '', frequency: 'weekly', active: true };
      dwPhNew('area', DW_PH_AREA, dwAreaPhotos(dw.edit));
      const m = fmOpen('dwForm', { title: a ? '✏️ Ort bearbeiten' : '➕ Neuer Ort / Aufgabe', layer: 2, onClose: () => dwPhDiscard('area') });
      m.setBody(`<div class="fm-stack">
        <div class="fm-field"><label class="form-label" for="dwfName">Name des Ortes / der Aufgabe *</label>
          <input type="text" id="dwfName" class="ui-field" maxlength="80" value="${escapeHtml(dw.edit.name)}" placeholder="z. B. Bodenablauf Spülküche"></div>
        <div class="fm-field"><label class="form-label" for="dwfDesc">Beschreibung (optional)</label>
          <textarea id="dwfDesc" class="ui-field" rows="3" maxlength="400" placeholder="Was genau muss gemacht werden?">${escapeHtml(dw.edit.description)}</textarea></div>
        <div class="fm-field"><label class="form-label" for="dwfFreq">Wie oft?</label>
          <select id="dwfFreq" class="ui-field">${DW_FREQ_ORDER.map(f => `<option value="${f}"${dw.edit.frequency === f ? ' selected' : ''}>${DW_FREQ[f][0]}</option>`).join('')}</select>
          <p class="fm-hint">Wöchentlich = einmal pro Woche (Mo–So), monatlich = einmal pro Kalendermonat.</p></div>
        <div class="fm-field"><label class="form-label">Fotos des Ortes (bis zu 5, das erste ist das Hauptfoto)</label>
          ${dwPhHtml('area')}</div>
        <label class="switch-row"><span>Aktiv (sichtbar für Abwasher)</span><span class="switch"><input type="checkbox" id="dwfActive" ${dw.edit.active ? 'checked' : ''}><span class="switch-track"></span></span></label>
      </div>`);
      m.setFoot(`<button type="button" class="ui-btn-ghost" onclick="dwPhDiscard('area'); fmClose('dwForm')">Abbrechen</button>
        <button type="button" class="ui-btn-primary" onclick="dwSaveArea()">💾 Speichern</button>`);
    }

    async function dwSaveArea() {
      const name = document.getElementById('dwfName').value.trim();
      if (!name) return fmToast('Bitte einen Namen eingeben.');
      const payload = {
        name, description: document.getElementById('dwfDesc').value.trim(), frequency: document.getElementById('dwfFreq').value,
        photos: (dw.eds.area ? dw.eds.area.list : []).slice(0, 5), photo_url: (dw.eds.area && dw.eds.area.list[0]) || '', active: document.getElementById('dwfActive').checked
      };
      const ed = dw.eds.area;
      const res = dw.edit && dw.edit.id
        ? await _supabase.from('wash_areas').update(payload).eq('id', dw.edit.id)
        : await _supabase.from('wash_areas').insert([Object.assign(payload, { sort_order: dw.areas.length + 1 })]);
      if (res.error) return fmToast(dwErr(res.error));
      if (ed && ed.removed.length) fmRemovePhotos(ed.removed);   // entfernte Fotos geben Speicher frei
      delete dw.eds.area;
      fmClose('dwForm');
      fmToast('Gespeichert');
      await dwLoad();
    }

    async function dwDeleteArea(id) {
      const a = dw.areas.find(x => x.id === id);
      if (!a || !confirm('„' + a.name + '“ löschen? Bisherige Einträge bleiben in der Übersicht erhalten. Tipp: „Aktiv“ abwählen blendet den Ort nur aus.')) return;
      const { error } = await _supabase.from('wash_areas').delete().eq('id', id);
      if (error) return fmToast(dwErr(error));
      fmRemovePhotos(dwAreaPhotos(a));
      await dwLoad();
    }

/* ============================================================
   js/order-list.js  (v1.0.16)
   Bestellliste Gemüse / Obst – für alle Mitarbeiter, live.
   - Jeder trägt Mengen ein (Handy-tauglich: Rubriken zum Aufklappen, +/−, Suche).
   - Live: Änderungen anderer erscheinen sofort (Broadcast-Kanal + Abfrage alle 6 s als Absicherung).
   - Unter der Liste steht, wer zuletzt etwas geändert hat (setzt die Datenbank, nicht der Browser).
   - Tägliche Meldung: pro Tag eine Liste mit Datum (Tabelle order_lists.order_date). Blättern zwischen den gespeicherten Tagen, Datum wählen.
   - „Ich bin fertig“ schließt die Liste (mit Name und Zeit); bei Bedarf wieder öffnen.
   - Excel-Export und Druck im Aussehen der Vorlage „Hye Bestelliste.xlsx“ (3 Spalten Produkt | Menge | Einheit).
   Tabellen: order_items, order_lists, order_lines (sql/1.0.12_order_list.sql, 1.0.14_order_daily.sql)
   ============================================================ */

    let ol = { m: null, items: [], list: null, date: '', lines: {}, latest: null, open: {}, q: '', only: false, cat: false, ch: null, timer: null, saving: {}, sig: '' };
    const OL_UNITS = ['kg', 'Stk', 'Bund', 'Pkg', 'Kiste', 'Sackerl', 'Be', 'liter'];

    function olErrorHtml(err) {
      const msg = (err && err.message) || String(err);
      if (/order_date/i.test(msg)) {
        return '<p class="staff-empty" style="color:#ef4444">' + escapeHtml(fmL('Die Datenbank braucht noch das Update. Bitte sql/1.0.14_order_daily.sql im Supabase SQL Editor ausführen.', 'The database needs the update. Please run sql/1.0.14_order_daily.sql in the Supabase SQL Editor.')) + '</p>';
      }
      if (/does not exist|schema cache|could not find the table/i.test(msg) || (err && err.code === '42P01')) {
        return '<p class="staff-empty" style="color:#ef4444">' + escapeHtml(fmL('Die Datenbank ist noch nicht eingerichtet. Bitte zuerst sql/1.0.12_order_list.sql im Supabase SQL Editor ausführen.', 'The database is not set up yet. Please run sql/1.0.12_order_list.sql in the Supabase SQL Editor first.')) + '</p>';
      }
      return '<p class="staff-empty" style="color:#ef4444">' + escapeHtml(msg) + '</p>';
    }
    function olIsDone() { return !!(ol.list && ol.list.status === 'done'); }
    function olFmtQty(v) { return String(v == null ? '' : v).trim(); }
    function olNum(v) { const t = olFmtQty(v).replace(',', '.'); return t !== '' && !isNaN(Number(t)) ? Number(t) : null; }
    function olShowNum(n) { return String(Math.round(n * 100) / 100).replace('.', ','); }
    function olDate(ts) { return ts ? new Date(ts).toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''; }
    const olToday = () => fmIso(new Date());
    // 'YYYY-MM-DD' -> „Fr 14.11.2026“
    function olDayLabel(iso) { const d = fmParseIso(iso); return FM_DAYS[d.getDay()] + ' ' + String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + d.getFullYear(); }
    function olSorted() {
      return ol.items.slice().sort((a, b) => (a.col - b.col) || (a.pos - b.pos) || (a.kind === 'head' ? -1 : 1) - (b.kind === 'head' ? -1 : 1) || String(a.created_at).localeCompare(String(b.created_at)));
    }
    // Rubriken: [{head, items:[...]}] in Reihenfolge Spalte 1, 2, 3
    function olSections() {
      const out = []; let cur = null;
      olSorted().forEach(it => {
        if (it.kind === 'head') { cur = { head: it, items: [] }; out.push(cur); }
        else { if (!cur || cur.head.col !== it.col) { cur = { head: { id: 'x' + it.col, col: it.col, name: '', kind: 'head' }, items: [] }; out.push(cur); } cur.items.push(it); }
      });
      return out;
    }

    // ---------- Öffnen / Laden ----------
    async function openOrderListModal() {
      if (typeof closeSettingsMenu === 'function') closeSettingsMenu();
      ol.q = ''; ol.only = false; ol.cat = false; ol.open = {}; ol.sig = ''; ol.date = olToday();
      ol.m = fmOpen('olModal', {
        title: '🥬 ' + fmL('Bestellliste Gemüse / Obst', 'Vegetable / fruit order list'),
        sub: fmL('Tägliche Meldung: alle tragen ein, was bestellt werden muss. Änderungen sieht jeder sofort.', 'Daily report: everyone adds what needs ordering. Everybody sees changes instantly.'),
        wide: true,
        onClose: olStopLive
      });
      ol.m.body.innerHTML = '<p class="staff-empty">' + escapeHtml(fmL('Lade ...', 'Loading ...')) + '</p>';
      const ok = await olLoad(true);
      if (ok) olStartLive();
    }

    // Lädt Katalog, die Liste des Tages ol.date (bei „heute“ wird sie bei Bedarf angelegt) und die Mengen.
    async function olLoad(create, dateIso) {
      if (dateIso) ol.date = dateIso;
      const it = await _supabase.from('order_items').select('*').eq('active', true);
      if (it.error) { ol.m.setBody(olErrorHtml(it.error)); return false; }
      ol.items = it.data || [];
      const o = await _supabase.from('order_lists').select('*').eq('order_date', ol.date).limit(1);
      if (o.error) { ol.m.setBody(olErrorHtml(o.error)); return false; }
      let list = (o.data || [])[0] || null;
      if (!list && create && ol.date === olToday()) list = await olCreateList(ol.date);
      ol.list = list;
      ol.lines = {};
      if (list) {
        const ln = await _supabase.from('order_lines').select('*').eq('list_id', list.id);
        if (ln.error) { ol.m.setBody(olErrorHtml(ln.error)); return false; }
        (ln.data || []).forEach(r => { ol.lines[r.item_id] = r; });
      }
      olRender();
      return true;
    }

    async function olCreateList(date) {
      const r = await _supabase.from('order_lists').insert({ order_date: date }).select().single();
      if (r.error) {   // gleichzeitig hat jemand anderes eine angelegt
        const o = await _supabase.from('order_lists').select('*').eq('order_date', date).limit(1);
        return (o.data || [])[0] || null;
      }
      return r.data;
    }

    // Für den angezeigten Tag eine Liste anlegen (leerer Tag)
    async function olCreateForDay() {
      const l = await olCreateList(ol.date);
      if (!l) { fmToast(fmL('Liste konnte nicht angelegt werden.', 'Could not create the list.')); return; }
      await olLoad(false); olPing();
    }

    // ---------- Blättern ----------
    // ‹ › springen zur vorherigen / nächsten GESPEICHERTEN Bestellung; ist keine spätere da, geht es zu „heute“
    async function olNav(dir) {
      let q = _supabase.from('order_lists').select('order_date');
      q = dir < 0 ? q.lt('order_date', ol.date).order('order_date', { ascending: false }) : q.gt('order_date', ol.date).order('order_date', { ascending: true });
      const r = await q.limit(1);
      if (r.error) { fmToast(fmDbError(r.error)); return; }
      const row = (r.data || [])[0];
      if (row) return olLoad(false, row.order_date);
      if (dir > 0 && ol.date < olToday()) return olLoad(true, olToday());
      fmToast(dir < 0 ? fmL('Keine frühere Bestellung gespeichert.', 'No earlier order saved.') : fmL('Das ist die neueste Bestellung.', 'This is the latest order.'));
    }
    function olGoToday() { olLoad(true, olToday()); }
    function olPickDate(v) { if (/^\d{4}-\d{2}-\d{2}$/.test(v)) olLoad(false, v); }
    // ---------- Live ----------
    function olStartLive() {
      olStopLive();
      try {
        ol.ch = _supabase.channel('order-list-live', { config: { broadcast: { self: false } } })
          .on('broadcast', { event: 'changed' }, () => olRefresh())
          .subscribe();
      } catch (e) { ol.ch = null; }
      ol.timer = setInterval(olRefresh, 6000);
    }
    function olStopLive() {
      if (ol.timer) { clearInterval(ol.timer); ol.timer = null; }
      if (ol.ch) { try { _supabase.removeChannel(ol.ch); } catch (e) {} ol.ch = null; }
    }
    function olPing() {
      try { if (ol.ch) ol.ch.send({ type: 'broadcast', event: 'changed', payload: { t: Date.now() } }); } catch (e) {}
    }

    // Holt den neuesten Stand und passt nur Geändertes an (Felder, in denen gerade getippt wird, bleiben unberührt)
    async function olRefresh() {
      if (!ol.m || !document.getElementById('olModal')) return;
      if (Object.keys(ol.saving).length) return;
      if (!ol.list) {   // leerer Tag: hat inzwischen jemand die Liste angelegt?
        const c = await _supabase.from('order_lists').select('id').eq('order_date', ol.date).limit(1);
        if (!c.error && (c.data || []).length) await olLoad(false);
        return;
      }
      const [o, ln, it] = await Promise.all([
        _supabase.from('order_lists').select('*').eq('id', ol.list.id).maybeSingle(),
        _supabase.from('order_lines').select('*').eq('list_id', ol.list.id),
        _supabase.from('order_items').select('*').eq('active', true)
      ]);
      if (o.error || ln.error || it.error) return;
      const lines = {}; (ln.data || []).forEach(r => { lines[r.item_id] = r; });
      let list = o.data;
      // Liste wurde von jemandem fertig gemeldet / wieder geöffnet / gelöscht: aktuellen Stand komplett laden
      if (!list || list.status !== ol.list.status) { await olLoad(false); return; }
      const catChanged = JSON.stringify((it.data || []).map(x => x.id + x.name + x.unit).sort()) !== JSON.stringify(ol.items.map(x => x.id + x.name + x.unit).sort());
      const sig = JSON.stringify(Object.keys(lines).sort().map(k => k + '=' + lines[k].qty));
      const old = JSON.stringify(Object.keys(ol.lines).sort().map(k => k + '=' + ol.lines[k].qty));
      ol.list = list; ol.lines = lines;
      if (catChanged) { ol.items = it.data || []; if (!olFocusInList()) olRender(); return; }
      if (sig !== old) olPatchQty();
      olRenderInfo();
    }
    function olFocusInList() { const a = document.activeElement; return !!(a && a.classList && a.classList.contains('ol-in') && ol.m.body.contains(a)); }

    // ---------- Anzeige ----------
    function olQtyOf(id) { const r = ol.lines[id]; return r ? olFmtQty(r.qty) : ''; }

    function olRowHtml(it) {
      const q = olQtyOf(it.id), done = olIsDone();
      if (ol.cat) {
        return `<div class="ol-row" data-id="${it.id}"><span class="ol-name">${escapeHtml(it.name)}</span><span class="ol-unit">${escapeHtml(it.unit)}</span>
          <button type="button" class="ui-btn-ghost ol-del" onclick="olDeleteItem('${it.id}')" aria-label="${escapeHtml(fmL('Entfernen', 'Remove'))}">✕</button></div>`;
      }
      return `<div class="ol-row${q ? ' ol-has' : ''}" data-id="${it.id}">
        <span class="ol-name">${escapeHtml(it.name)}</span>
        <span class="ol-ctl">
          <button type="button" class="ol-step" ${done ? 'disabled' : ''} onclick="olStep('${it.id}',-1)" aria-label="−">−</button>
          <input type="text" inputmode="decimal" autocomplete="off" maxlength="12" class="ol-in" ${done ? 'disabled' : ''} value="${escapeHtml(q)}" placeholder="0"
            data-id="${it.id}" onfocus="this.select()" onchange="olSetQty('${it.id}',this.value)">
          <button type="button" class="ol-step" ${done ? 'disabled' : ''} onclick="olStep('${it.id}',1)" aria-label="+">+</button>
        </span>
        <span class="ol-unit">${escapeHtml(it.unit)}</span></div>`;
    }

    function olRender() {
      const done = olIsDone();
      const today = olToday();
      ol.m.setToolbar(`<div class="ol-datebar">
        <button type="button" class="ui-btn-ghost" onclick="olNav(-1)" aria-label="${escapeHtml(fmL('Vorherige Bestellung', 'Previous order'))}">‹</button>
        <div class="ol-datebox"><b>${escapeHtml(olDayLabel(ol.date))}</b>${ol.date === today ? '<span class="ol-chip-today">' + escapeHtml(fmL('Heute', 'Today')) + '</span>' : ''}<small>${ol.list ? (olIsDone() ? '✅ ' + escapeHtml(fmL('erledigt', 'done')) : '✏️ ' + escapeHtml(fmL('offen', 'open'))) : escapeHtml(fmL('keine Bestellung', 'no order'))}</small></div>
        <button type="button" class="ui-btn-ghost" onclick="olNav(1)" aria-label="${escapeHtml(fmL('Nächste Bestellung', 'Next order'))}">›</button>
        <button type="button" class="ui-btn-ghost" onclick="olGoToday()">${escapeHtml(fmL('Heute', 'Today'))}</button>
        <input type="date" class="ol-datepick" value="${escapeHtml(ol.date)}" onchange="olPickDate(this.value)" aria-label="${escapeHtml(fmL('Datum wählen', 'Pick date'))}">
      </div>
      <div class="ol-tools">
        <input type="search" class="ol-search" id="olSearch" placeholder="${escapeHtml(fmL('Produkt suchen …', 'Search product …'))}" value="${escapeHtml(ol.q)}" oninput="olSearch(this.value)" autocomplete="off">
        <button type="button" class="ui-btn-ghost ol-chip${ol.only ? ' on' : ''}" id="olOnlyBtn" onclick="olToggleOnly()">${escapeHtml(fmL('Nur Bestellte', 'Ordered only'))}</button>
        ${done || !ol.list ? '' : `<button type="button" class="ui-btn-ghost" onclick="olAddDialog()">＋ ${escapeHtml(fmL('Produkt', 'Product'))}</button>`}
        <button type="button" class="ui-btn-ghost" onclick="olHistory()">📜</button>
        ${userIsAdmin && !done && ol.list ? `<button type="button" class="ui-btn-ghost ol-chip${ol.cat ? ' on' : ''}" onclick="olToggleCat()">✏️ ${escapeHtml(fmL('Katalog', 'Catalog'))}</button>` : ''}
      </div>`);
      olRenderList();
      olRenderInfo();
    }

    function olRenderList() {
      const q = ol.q.trim().toLowerCase();
      let html = '';
      if (!ol.list) {
        ol.m.setBody(`<div class="ol-empty"><p>${escapeHtml(fmL('Für diesen Tag gibt es keine Bestellung.', 'There is no order for this day.'))}</p>
          <button type="button" class="ui-btn-primary" onclick="olCreateForDay()">🆕 ${escapeHtml(fmL('Bestellung für diesen Tag anlegen', 'Create an order for this day'))}</button>
          <p class="fm-hint">${escapeHtml(fmL('Mit ‹ › blätterst du durch die gespeicherten Tage, 📜 zeigt die Liste aller Tage.', 'Use ‹ › to browse the saved days, 📜 lists all days.'))}</p></div>`);
        return;
      }
      if (olIsDone()) {
        const canReopen = userIsAdmin || ol.date === olToday();
        html += `<div class="ol-banner ol-banner-done">✅ ${escapeHtml(fmL('Erledigt von', 'Completed by'))} <b>${escapeHtml(ol.list.done_by || '?')}</b> · ${escapeHtml(olDate(ol.list.done_at) + ' ' + fmTime(ol.list.done_at))}
          <div class="ol-banner-act"><button type="button" class="ui-btn-primary" onclick="olPreview()">📤 ${escapeHtml(fmL('Vorschau & Teilen (WhatsApp, Bild, PDF)', 'Preview & share (WhatsApp, image, PDF)'))}</button>${canReopen ? ` <button type="button" class="ui-btn-ghost" onclick="olReopen()">↩️ ${escapeHtml(fmL('Wieder öffnen', 'Reopen'))}</button>` : ''}</div></div>`;
      } else if (ol.date < olToday()) {
        html += `<div class="ol-banner ol-banner-warn">⚠️ ${escapeHtml(fmL('Diese Bestellung von früher wurde nie als fertig gemeldet.', 'This earlier order was never marked as done.'))}</div>`;
      }
      olSections().forEach((s, si) => {
        const items = s.items.filter(it => (!q || it.name.toLowerCase().indexOf(q) !== -1) && (!ol.only || olQtyOf(it.id)));
        if ((q || ol.only) && !items.length) return;
        const n = s.items.filter(it => olQtyOf(it.id)).length;
        const key = s.head.id, isOpen = !!(q || ol.only || ol.open[key]);
        html += `<section class="ol-sec"><button type="button" class="ol-head" onclick="olToggleSec('${key}')" aria-expanded="${isOpen}">
          <span class="ol-caret">${isOpen ? '▾' : '▸'}</span><b>${escapeHtml(s.head.name || fmL('Weitere', 'More'))}</b>
          <span class="ol-count${n ? ' on' : ''}" data-cnt="${key}">${n ? n + ' ' + escapeHtml(fmL('bestellt', 'ordered')) : ''}</span></button>
          <div class="ol-items${isOpen ? '' : ' hidden'}">${items.map(olRowHtml).join('') || '<p class="staff-empty">–</p>'}</div></section>`;
      });
      ol.m.setBody(`<div class="ol-wrap">${html}</div>`);
    }

    function olRenderInfo() {
      const l = ol.list; if (!l) { ol.m.setFoot(''); return; }
      const total = Object.keys(ol.lines).filter(k => olQtyOf(k)).length;
      const last = l.updated_by ? `${escapeHtml(fmL('Zuletzt bearbeitet von', 'Last edited by'))} <b>${escapeHtml(l.updated_by)}</b> · ${escapeHtml(olDate(l.updated_at) + ' ' + fmTime(l.updated_at))}`
        : escapeHtml(fmL('Noch nichts eingetragen', 'Nothing entered yet'));
      const live = olIsDone() ? '' : `<span class="ol-live" title="${escapeHtml(fmL('Live', 'Live'))}"></span>`;
      ol.m.setFoot(`<div class="ol-foot"><div class="ol-last">${live}<span>${last}</span><span class="ol-total">${total} ${escapeHtml(fmL('Produkte', 'products'))}</span></div>
        <div class="ol-foot-btns">
          <button type="button" class="ui-btn-ghost" onclick="olPrint()" title="${escapeHtml(fmL('Drucken', 'Print'))}" aria-label="${escapeHtml(fmL('Drucken', 'Print'))}">🖨️</button>
          <button type="button" class="ui-btn-ghost" onclick="olExportExcel()" title="Excel" aria-label="Excel">📗</button>
          <button type="button" class="ui-btn-ghost" onclick="olPreview()">📤 ${escapeHtml(fmL('Teilen', 'Share'))}</button>
          ${olIsDone() ? '' : `<button type="button" class="ui-btn-primary" onclick="olFinish()">✅ ${escapeHtml(fmL('Ich bin fertig', 'I’m done'))}</button>`}
        </div></div>`);
    }

    // Nur die Mengenfelder aktualisieren (ohne die Eingabe zu stören)
    function olPatchQty() {
      const act = document.activeElement;
      ol.m.body.querySelectorAll('.ol-row[data-id]').forEach(row => {
        const id = row.getAttribute('data-id'), inp = row.querySelector('.ol-in'), q = olQtyOf(id);
        if (!inp || inp === act) return;
        if (inp.value !== q) { inp.value = q; row.classList.add('ol-flash'); setTimeout(() => row.classList.remove('ol-flash'), 1200); }
        row.classList.toggle('ol-has', !!q);
      });
      olUpdateCounts();
    }
    function olUpdateCounts() {
      olSections().forEach(s => {
        const el = ol.m.body.querySelector('[data-cnt="' + s.head.id + '"]'); if (!el) return;
        const n = s.items.filter(it => olQtyOf(it.id)).length;
        el.textContent = n ? n + ' ' + fmL('bestellt', 'ordered') : '';
        el.classList.toggle('on', !!n);
      });
    }

    // ---------- Bedienung ----------
    function olSearch(v) {
      ol.q = v; olRenderList();
      const s = document.getElementById('olSearch'); if (s) { s.focus(); const l = s.value.length; try { s.setSelectionRange(l, l); } catch (e) {} }
    }
    function olToggleOnly() { ol.only = !ol.only; olRender(); }
    function olToggleCat() { ol.cat = !ol.cat; olRender(); }
    function olToggleSec(key) { ol.open[key] = !ol.open[key]; olRenderList(); }

    function olStep(id, d) {
      if (olIsDone()) return;
      const cur = olNum(olQtyOf(id));
      let n = (cur == null ? 0 : cur) + d;
      if (n < 0) n = 0;
      olSetQty(id, n === 0 ? '' : olShowNum(n));
    }

    async function olSetQty(id, raw) {
      if (!ol.list || olIsDone()) return;
      const qty = olFmtQty(raw);
      const prev = ol.lines[id];
      if ((prev ? olFmtQty(prev.qty) : '') === qty) { olSyncInput(id, qty); return; }
      // sofort anzeigen
      if (qty) ol.lines[id] = Object.assign({}, prev || {}, { list_id: ol.list.id, item_id: id, qty, updated_by: currentWaiterName, updated_at: new Date().toISOString() });
      else delete ol.lines[id];
      olSyncInput(id, qty);
      olUpdateCounts();
      ol.saving[id] = true;
      let res;
      if (qty) res = await _supabase.from('order_lines').upsert({ list_id: ol.list.id, item_id: id, qty }, { onConflict: 'list_id,item_id' }).select().single();
      else res = await _supabase.from('order_lines').delete().eq('list_id', ol.list.id).eq('item_id', id);
      delete ol.saving[id];
      if (res.error) {
        fmToast(fmL('Speichern fehlgeschlagen: ', 'Saving failed: ') + fmDbError(res.error));
        if (prev) ol.lines[id] = prev; else delete ol.lines[id];
        olSyncInput(id, prev ? olFmtQty(prev.qty) : ''); olUpdateCounts();
        return;
      }
      if (qty && res.data) ol.lines[id] = res.data;
      // Absender/Zeit der Liste aus der Datenbank holen, andere benachrichtigen
      const l = await _supabase.from('order_lists').select('*').eq('id', ol.list.id).maybeSingle();
      if (l.data && ol.list && l.data.id === ol.list.id) { ol.list = l.data; olRenderInfo(); }
      olPing();
    }
    function olSyncInput(id, qty) {
      const row = ol.m.body.querySelector('.ol-row[data-id="' + id + '"]'); if (!row) return;
      const inp = row.querySelector('.ol-in'); if (inp && inp.value !== qty) inp.value = qty;
      row.classList.toggle('ol-has', !!qty);
    }

    async function olFinish() {
      if (!ol.list || olIsDone()) return;
      const n = Object.keys(ol.lines).filter(k => olQtyOf(k)).length;
      if (!n && !confirm(fmL('Die Liste ist leer. Trotzdem als fertig melden?', 'The list is empty. Mark as done anyway?'))) return;
      if (n && !confirm(fmL('Liste mit ' + n + ' Produkten als fertig melden? Danach ist sie gesperrt (kann wieder geöffnet werden).', 'Mark the list with ' + n + ' products as done? It is then locked (it can be reopened).'))) return;
      const r = await _supabase.from('order_lists').update({ status: 'done' }).eq('id', ol.list.id).eq('status', 'open').select().single();
      if (r.error) { fmToast(fmDbError(r.error)); return; }
      ol.list = r.data;
      fmToast(fmL('Bestellliste ist fertig ✅', 'Order list completed ✅'));
      olRender(); olPing();
    }

    async function olReopen() {
      if (!ol.list || !olIsDone()) return;
      const r = await _supabase.from('order_lists').update({ status: 'open' }).eq('id', ol.list.id).eq('status', 'done').select().single();
      if (r.error) { fmToast(fmDbError(r.error)); return; }
      ol.list = r.data;
      fmToast(fmL('Bestellung wieder geöffnet', 'Order reopened'));
      olRender(); olPing();
    }

    // ---------- Verlauf ----------
    async function olHistory() {
      const m = fmOpen('olHist', { title: '📜 ' + fmL('Gespeicherte Bestellungen', 'Saved orders'), sub: fmL('Tippe auf einen Tag, um ihn zu öffnen.', 'Tap a day to open it.'), layer: 2 });
      m.setBody('<p class="staff-empty">' + escapeHtml(fmL('Lade ...', 'Loading ...')) + '</p>');
      const r = await _supabase.from('order_lists').select('*').order('order_date', { ascending: false }).limit(90);
      if (r.error) { m.setBody(olErrorHtml(r.error)); return; }
      const rows = r.data || [];
      m.setBody(rows.length ? '<div class="fm-stack">' + rows.map(x => `<button type="button" class="ui-btn-ghost ol-hist" onclick="olViewDay('${x.order_date}')">
        <b>${escapeHtml(olDayLabel(x.order_date))}</b><small>${x.status === 'done' ? '✅ ' + escapeHtml((x.done_by || '?') + ' · ' + fmTime(x.done_at)) : '✏️ ' + escapeHtml(fmL('offen', 'open') + (x.updated_by ? ' · ' + x.updated_by : ''))}</small></button>`).join('') + '</div>'
        : '<p class="staff-empty">' + escapeHtml(fmL('Noch keine Bestellungen gespeichert.', 'No orders saved yet.')) + '</p>');
      m.setFoot(`<button type="button" class="ui-btn-ghost" onclick="fmClose('olHist')">${escapeHtml(fmL('Schließen', 'Close'))}</button>`);
    }
    async function olViewDay(iso) {
      fmClose('olHist');
      await olLoad(false, iso);
    }

    // ---------- Produkt hinzufügen / Katalog ----------
    function olAddDialog() {
      if (olIsDone()) return;
      const m = fmOpen('olAdd', { title: '＋ ' + fmL('Produkt hinzufügen', 'Add product'), layer: 2 });
      const heads = olSections().filter(s => s.head.name);
      m.setBody(`<div class="fm-stack">
        <label class="fm-lbl">${escapeHtml(fmL('Rubrik', 'Category'))}<select id="olAddSec" class="ui-input">${heads.map(s => `<option value="${s.head.id}">${escapeHtml(s.head.name)}</option>`).join('')}</select></label>
        <label class="fm-lbl">${escapeHtml(fmL('Produkt', 'Product'))}<input id="olAddName" class="ui-input" maxlength="60" autocomplete="off"></label>
        <label class="fm-lbl">${escapeHtml(fmL('Einheit', 'Unit'))}<input id="olAddUnit" class="ui-input" maxlength="12" value="kg" autocomplete="off"></label>
        <div class="ol-units">${OL_UNITS.map(u => `<button type="button" class="ui-btn-ghost ol-chip" onclick="document.getElementById('olAddUnit').value='${u}'">${u}</button>`).join('')}</div></div>`);
      m.setFoot(`<button type="button" class="ui-btn-ghost" onclick="fmClose('olAdd')">${escapeHtml(fmL('Abbrechen', 'Cancel'))}</button>
        <button type="button" class="ui-btn-primary" onclick="olAddSave()">${escapeHtml(fmL('Hinzufügen', 'Add'))}</button>`);
      setTimeout(() => { const e = document.getElementById('olAddName'); if (e) e.focus(); }, 50);
    }
    async function olAddSave() {
      const name = (document.getElementById('olAddName').value || '').trim();
      const unit = (document.getElementById('olAddUnit').value || '').trim();
      const secId = document.getElementById('olAddSec').value;
      if (!name) { fmToast(fmL('Bitte einen Namen eingeben.', 'Please enter a name.')); return; }
      const sec = olSections().find(s => s.head.id === secId); if (!sec) return;
      if (ol.items.some(i => i.kind === 'item' && i.name.toLowerCase() === name.toLowerCase())) { fmToast(fmL('Dieses Produkt gibt es schon.', 'This product already exists.')); return; }
      const last = sec.items.length ? sec.items[sec.items.length - 1].pos : sec.head.pos;
      const r = await _supabase.from('order_items').insert({ col: sec.head.col, pos: last + 1, kind: 'item', name, unit }).select().single();
      if (r.error) { fmToast(fmDbError(r.error)); return; }
      fmClose('olAdd');
      ol.items.push(r.data); ol.open[secId] = true;
      olRenderList(); olPing();
      fmToast(fmL('Produkt hinzugefügt', 'Product added'));
    }
    async function olDeleteItem(id) {
      const it = ol.items.find(x => x.id === id); if (!it) return;
      if (!confirm(fmL('„' + it.name + '“ aus dem Katalog entfernen?', 'Remove “' + it.name + '” from the catalog?'))) return;
      const r = await _supabase.from('order_items').update({ active: false }).eq('id', id);
      if (r.error) { fmToast(fmDbError(r.error)); return; }
      ol.items = ol.items.filter(x => x.id !== id);
      olRenderList(); olPing();
    }

    // ---------- Tabelle im Aussehen der Vorlage (3 Blöcke Produkt | Menge | Einheit) ----------
    // Liefert 3 Spalten mit Zeilen { head, name, qty, unit }
    function olGrid() {
      const cols = [[], [], []];
      olSorted().forEach(it => {
        const c = cols[Math.min(3, Math.max(1, it.col)) - 1];
        if (it.kind === 'head') c.push({ head: true, name: it.name });
        else c.push({ head: false, name: it.name, qty: olQtyOf(it.id), unit: it.unit });
      });
      return cols;
    }
    function olStampText() {
      const l = ol.list; if (!l) return [];
      const a = l.updated_by ? fmL('Zuletzt bearbeitet von ', 'Last edited by ') + l.updated_by + ' · ' + olDate(l.updated_at) + ' ' + fmTime(l.updated_at) : '';
      const b = l.status === 'done' ? fmL('Erledigt von ', 'Completed by ') + (l.done_by || '?') + ' · ' + olDate(l.done_at) + ' ' + fmTime(l.done_at) : '';
      return [a, b].filter(Boolean);
    }
    function olDateText() { const iso = (ol.list && ol.list.order_date) || ol.date || olToday(); return olDayLabel(iso); }

    function olBuildXlsx() {
      const cols = olGrid(), nrows = Math.max(cols[0].length, cols[1].length, cols[2].length);
      const cell = (c, r, style, v) => {
        const ref = exColLetter(c) + r;
        if (v === null || v === undefined || v === '') return `<c r="${ref}" s="${style}"/>`;
        if (typeof v === 'number') return `<c r="${ref}" s="${style}"><v>${v}</v></c>`;
        return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${exXml(v)}</t></is></c>`;
      };
      const rows = [];
      rows.push(`<row r="5" ht="18.2" customHeight="1">${cell(0, 5, 1, 'Bestellung Gemüse / Obst – Salonplafond')}${cell(8, 5, 6, 'Datum:')}${cell(9, 5, 7, olDateText())}</row>`);
      rows.push(`<row r="6" ht="8.45" customHeight="1">${cell(0, 6, 2, '')}</row>`);
      let h = '';
      [0, 4, 8].forEach(c => { h += cell(c, 7, 3, 'Produkt') + cell(c + 1, 7, 3, 'Menge') + cell(c + 2, 7, 3, 'Einheit'); });
      rows.push(`<row r="7" ht="18.2" customHeight="1">${h}</row>`);
      for (let i = 0; i < nrows; i++) {
        const r = 8 + i; let x = '';
        cols.forEach((col, ci) => {
          const e = col[i], c0 = ci * 4; if (!e) return;
          if (e.head) { x += cell(c0, r, 4, e.name); return; }
          const n = olNum(e.qty);
          x += cell(c0, r, 5, e.name) + cell(c0 + 1, r, 5, n != null && String(e.qty).trim().replace(',', '.') === String(n) ? n : e.qty) + cell(c0 + 2, r, 5, e.unit);
        });
        rows.push(`<row r="${r}" ht="18.2" customHeight="1">${x}</row>`);
      }
      let last = 8 + nrows;
      olStampText().forEach(t => { last++; rows.push(`<row r="${last}" ht="14" customHeight="1">${cell(0, last, 2, t)}</row>`); });
      const colsXml = [[1, 18], [2, 6], [3, 9], [4, 1], [5, 18], [6, 6], [7, 9], [8, 1], [9, 18], [10, 6], [11, 9]]
        .map(a => `<col min="${a[0]}" max="${a[0]}" width="${a[1]}" customWidth="1"/>`).join('');
      const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A5:K${last}"/><sheetViews><sheetView tabSelected="1" workbookViewId="0"/></sheetViews><sheetFormatPr baseColWidth="10" defaultColWidth="8.85546875" defaultRowHeight="15"/><cols>${colsXml}</cols><sheetData>${rows.join('')}</sheetData><pageMargins left="0.15" right="0.15" top="0.15" bottom="0.15" header="0" footer="0"/><pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="1"/></worksheet>`;
      const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="7"><font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font><font><b/><sz val="10"/><name val="Arial"/><family val="2"/></font><font><sz val="9"/><name val="Arial"/><family val="2"/></font><font><b/><sz val="13"/><name val="Arial"/><family val="2"/></font><font><i/><sz val="9"/><name val="Arial"/><family val="2"/></font><font><b/><sz val="11"/><name val="Arial"/><family val="2"/></font><font><sz val="10"/><name val="Arial"/><family val="2"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="3"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FF000000"/></left><right style="thin"><color rgb="FF000000"/></right><top style="thin"><color rgb="FF000000"/></top><bottom style="thin"><color rgb="FF000000"/></bottom><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FF000000"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="8"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/><xf numFmtId="0" fontId="5" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="right"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="2" xfId="0" applyBorder="1"/></cellXfs><cellStyles count="1"><cellStyle name="Standard" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
      const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Bestellung" sheetId="1" r:id="rId1"/></sheets></workbook>`;
      const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
      const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
      const ct = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;
      return exZip([
        { name: '[Content_Types].xml', data: ct }, { name: '_rels/.rels', data: rels },
        { name: 'xl/workbook.xml', data: workbook }, { name: 'xl/_rels/workbook.xml.rels', data: wbRels },
        { name: 'xl/styles.xml', data: styles }, { name: 'xl/worksheets/sheet1.xml', data: sheet }
      ]);
    }

    function olExportExcel() {
      if (!ol.list) return;
      try {
        const bytes = olBuildXlsx();
        const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'Bestellliste_' + ((ol.list && ol.list.order_date) || olToday()) + '.xlsx';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 10000);
        fmToast(fmL('Excel-Datei erstellt', 'Excel file created'));
      } catch (e) { fmToast(fmL('Excel-Export fehlgeschlagen', 'Excel export failed')); }
    }

    function olPrintHtml() {
      const cols = olGrid(), nrows = Math.max(cols[0].length, cols[1].length, cols[2].length);
      const rh = Math.max(4.6, Math.min(6.4, 262 / (nrows + 4)));
      let body = '';
      for (let i = 0; i < nrows; i++) {
        body += '<tr>';
        cols.forEach((col, ci) => {
          const e = col[i];
          if (!e) body += '<td class="e"></td><td class="e"></td><td class="e"></td>';
          else if (e.head) body += `<td class="h">${exHtml(e.name)}</td><td class="e"></td><td class="e"></td>`;
          else body += `<td class="b">${exHtml(e.name)}</td><td class="b q">${exHtml(e.qty)}</td><td class="b">${exHtml(e.unit)}</td>`;
          if (ci < 2) body += '<td class="sp"></td>';
        });
        body += '</tr>';
      }
      const th = '<th>Produkt</th><th>Menge</th><th>Einheit</th>';
      return `<!doctype html><html><head><meta charset="utf-8"><title>Bestellung Gemüse / Obst</title><style>
@page { size: A4 portrait; margin: 6mm; }
* { box-sizing: border-box; } body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #000; }
.top { display: flex; justify-content: space-between; align-items: baseline; margin: 0 0 1.5mm; }
.top h1 { font-size: 13pt; margin: 0; } .top span { font-size: 11pt; font-weight: bold; }
table { border-collapse: collapse; width: 100%; table-layout: fixed; }
th, td { height: ${rh.toFixed(2)}mm; padding: 0 1mm; font-size: 8.5pt; overflow: hidden; white-space: nowrap; }
th { border: .2mm solid #000; font-size: 9pt; text-align: center; }
td.b { border: .2mm solid #000; } td.h { font-weight: bold; font-size: 9.5pt; } td.q { text-align: center; font-weight: bold; }
td.sp, th.sp { width: 1.5mm; border: 0; padding: 0; } td.e { border: 0; }
.foot { margin-top: 2mm; font-size: 8pt; font-style: italic; }
</style></head><body>
<div class="top"><h1>Bestellung Gemüse / Obst – Salonplafond</h1><span>Datum: ${exHtml(olDateText())}</span></div>
<table><colgroup><col style="width:25%"><col style="width:7%"><col style="width:11%"><col style="width:1.5mm"><col style="width:25%"><col style="width:7%"><col style="width:11%"><col style="width:1.5mm"><col style="width:25%"><col style="width:7%"><col style="width:11%"></colgroup>
<thead><tr>${th}<th class="sp"></th>${th}<th class="sp"></th>${th}</tr></thead><tbody>${body}</tbody></table>
<div class="foot">${olStampText().map(exHtml).join('<br>')}</div></body></html>`;
    }

    // ---------- Vorschau, Bild, PDF, WhatsApp ----------
    // Die Seite wird selbst gezeichnet (A4, 150 dpi): keine Zusatzbibliothek, funktioniert auch offline.
    function olRenderCanvas() {
      const W = 1240, H = 1754, M = 34;
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const g = cv.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#000'; g.textBaseline = 'middle';
      const cols = olGrid(), nrows = Math.max(cols[0].length, cols[1].length, cols[2].length);
      const foot = olStampText();
      g.font = 'bold 36px Arial, Helvetica, sans-serif'; g.textAlign = 'left';
      g.fillText('Bestellung Gemüse / Obst – Salonplafond', M, M + 22);
      g.font = 'bold 30px Arial, Helvetica, sans-serif'; g.textAlign = 'right';
      g.fillText('Datum: ' + olDateText(), W - M, M + 22);
      const top = M + 62, bottom = H - M - (foot.length ? 34 * foot.length + 10 : 0);
      const rowH = Math.max(24, Math.min(44, (bottom - top) / (nrows + 1)));
      const gap = 16, bw = (W - 2 * M - 2 * gap) / 3;
      const cw = [bw * 0.56, bw * 0.17, bw * 0.27];
      const fs = Math.round(rowH * 0.5);
      const fit = (txt, maxW, bold) => {   // Text bei Bedarf verkleinern, damit er in die Zelle passt
        let size = fs; g.font = (bold ? 'bold ' : '') + size + 'px Arial, Helvetica, sans-serif';
        while (size > 10 && g.measureText(txt).width > maxW) { size--; g.font = (bold ? 'bold ' : '') + size + 'px Arial, Helvetica, sans-serif'; }
      };
      g.lineWidth = 1.5; g.strokeStyle = '#000';
      cols.forEach((col, ci) => {
        const x0 = M + ci * (bw + gap);
        ['Produkt', 'Menge', 'Einheit'].forEach((h, k) => {
          const x = x0 + cw.slice(0, k).reduce((a, b) => a + b, 0);
          g.strokeRect(x, top, cw[k], rowH);
          g.textAlign = 'center'; g.fillStyle = '#000'; fit(h, cw[k] - 8, true); g.fillText(h, x + cw[k] / 2, top + rowH / 2);
        });
        col.forEach((e, i) => {
          const y = top + rowH * (i + 1);
          if (e.head) { g.textAlign = 'left'; fit(e.name, bw - 10, true); g.fillText(e.name, x0 + 6, y + rowH / 2); return; }
          const vals = [e.name, e.qty, e.unit];
          vals.forEach((v, k) => {
            const x = x0 + cw.slice(0, k).reduce((a, b) => a + b, 0);
            g.strokeRect(x, y, cw[k], rowH);
            if (!v) return;
            g.textAlign = k === 1 ? 'center' : 'left';
            fit(String(v), cw[k] - 10, k === 1);
            g.fillText(String(v), k === 1 ? x + cw[k] / 2 : x + 6, y + rowH / 2);
          });
        });
      });
      g.textAlign = 'left'; g.fillStyle = '#222'; g.font = 'italic 24px Arial, Helvetica, sans-serif';
      foot.forEach((t, i) => g.fillText(t, M, H - M - 34 * (foot.length - i) + 12));
      return cv;
    }

    function olFileBase() { return 'Bestellliste_' + ((ol.list && ol.list.order_date) || olToday()); }

    // Text für WhatsApp: nur die bestellten Produkte, nach Rubrik
    function olTextSummary() {
      const lines = ['*Bestellung Gemüse / Obst – Salonplafond*', 'Datum: ' + olDateText(), ''];
      olSections().forEach(s => {
        const got = s.items.filter(it => olQtyOf(it.id));
        if (!got.length) return;
        if (s.head.name) lines.push('*' + s.head.name + '*');
        got.forEach(it => lines.push('• ' + it.name + ': ' + olQtyOf(it.id) + ' ' + it.unit));
        lines.push('');
      });
      const st = olStampText(); if (st.length) lines.push('_' + st.join(' · ') + '_');
      return lines.join('\n').trim();
    }

    // Vorschau, Teilen (WhatsApp), Bild, PDF: gemeinsames Modul js/share-doc.js
    function olPreview() {
      if (!ol.list) return;
      shPreview({ title: fmL('Vorschau Bestellliste', 'Order list preview'), canvas: olRenderCanvas(), base: olFileBase(), text: olTextSummary(), shareText: 'Bestellung Gemüse / Obst – ' + olDateText(), onPrint: olPrint });
    }

    function olPrint() {
      if (!ol.list) return;
      const old = document.getElementById('olPrintFrame'); if (old) old.remove();
      const f = document.createElement('iframe');
      f.id = 'olPrintFrame'; f.setAttribute('aria-hidden', 'true');
      f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
      document.body.appendChild(f);
      const doc = f.contentWindow.document;
      doc.open(); doc.write(olPrintHtml()); doc.close();
      setTimeout(() => {
        try { f.contentWindow.focus(); f.contentWindow.print(); }
        catch (e) { fmToast(fmL('Drucken wird auf diesem Gerät nicht unterstützt.', 'Printing is not supported on this device.')); }
        setTimeout(() => { const el = document.getElementById('olPrintFrame'); if (el) el.remove(); }, 60000);
      }, 400);
    }

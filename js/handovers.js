/* ============================================================
   js/handovers.js
   Schichtübergabe: Aufgaben und Vorbereitungen für die nächste Schicht
   Tabelle: kitchen_handovers   (Rechte: sql/1.1.00_handovers.sql)
   Benutzt: _supabase, currentWaiterName, userIsAdmin, escapeHtml, jsArg, showAppToast
   ============================================================ */
(function () {
  'use strict';

  const TABLE = 'kitchen_handovers';
  const DEFAULT_STATIONS = ['Entre', 'Garde/Pati', 'Saucier', 'Garde / Saucier', 'Breakfast / Lunch', 'Allgemein'];
  const POLL_LIST_MS = 20000;
  const POLL_BADGE_MS = 60000;
  const DONE_VISIBLE_DAYS = 2;

  // WhatsApp: universeller Link (Gruppe wird in WhatsApp gewählt). Zweite Wahl: feste Gruppe.
  const WA_FALLBACK_GROUP = 'https://chat.whatsapp.com/KHtZegqDJJhFjjlkEuQP52';
  const WA_MAX_ENCODED = 1800;   // längere Texte passen nicht sicher in einen wa.me-Link
  const WA_CLOSING = 'Danke, bis dann!';
  const OWN_CHANGE_IGNORE_MS = 120000;

  const state = {
    items: [],
    pane: 'list',          // 'list' | 'add'
    group: 'station',      // 'station' | 'author'
    station: '',            // gewählte Sektion im Formular
    filterStation: '',      // Filter in der Liste ('' = alle)
    hideOptional: false,
    extraStations: [],
    busy: new Set(),
    loadError: '',
    loaded: false,
    listTimer: null,
    badgeTimer: null,
    saving: false,
    snap: null,              // letzter bekannter Stand (id -> status), für Benachrichtigungen
    ownChange: new Map(),    // eigene Statusänderungen (nicht als "neu" melden)
    pendingShare: ''         // Text, falls WhatsApp nicht automatisch geöffnet werden konnte
  };

  const $ = (id) => document.getElementById(id);

  // ---------- Datum ----------
  function localISO(d) {
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function dayLabel(iso) {
    if (!iso) return '';
    const today = localISO(new Date());
    if (iso === today) return 'heute';
    if (iso === localISO(addDays(new Date(), -1))) return 'gestern';
    const [y, m, d] = iso.split('-');
    return d + '.' + m + '.';
  }

  // ---------- Hilfen ----------
  function toast(title, text, icon, onClick) {
    if (typeof showAppToast === 'function') showAppToast({ initial: icon || '📋', title: title, text: text || '', onClick: onClick });
    else alert(title + (text ? '\n' + text : ''));
  }
  function canDelete(it) {
    const me = (typeof currentWaiterName === 'string' ? currentWaiterName : '').toLowerCase();
    return (typeof userIsAdmin !== 'undefined' && userIsAdmin) || (me && String(it.author_name || '').toLowerCase() === me);
  }
  function allStations() {
    const list = DEFAULT_STATIONS.slice();
    state.extraStations.concat(state.items.map((i) => i.station)).forEach((s) => {
      const v = String(s || '').trim();
      if (v && !list.some((x) => x.toLowerCase() === v.toLowerCase())) list.push(v);
    });
    return list;
  }

  // ---------- Laden ----------
  async function fetchItems() {
    const since = localISO(addDays(new Date(), -DONE_VISIBLE_DAYS));
    return _supabase
      .from(TABLE)
      .select('*')
      .or('status.neq.done,shift_date.gte.' + since)
      .order('shift_date', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(500);
  }

  function meLower() { return (typeof currentWaiterName === 'string' ? currentWaiterName : '').toLowerCase(); }

  // Vergleicht mit dem letzten Stand und meldet Neues/Änderungen anderer (Toast + System-Benachrichtigung)
  function detectChanges(rows) {
    const prev = state.snap;
    state.snap = new Map(rows.map((r) => [r.id, r.status]));
    if (!prev) return;                                   // erster Abruf: nichts melden
    const me = meLower();
    const now = Date.now();
    const added = rows.filter((r) => !prev.has(r.id) && r.status !== 'done' && String(r.author_name || '').toLowerCase() !== me);
    const changed = rows.filter((r) => {
      if (!prev.has(r.id) || prev.get(r.id) === r.status) return false;
      const t = state.ownChange.get(r.id);
      return !(t && now - t < OWN_CHANGE_IGNORE_MS);
    });
    if (added.length || changed.length) announce(added, changed);
  }

  function announce(added, changed) {
    const listTxt = (arr, max) => arr.slice(0, max).map((r) => r.item_name).join(', ') + (arr.length > max ? ' +' + (arr.length - max) : '');
    let title, body;
    if (added.length) {
      const authors = Array.from(new Set(added.map((r) => r.author_name))).join(', ');
      const stations = Array.from(new Set(added.map((r) => r.station))).join(', ');
      title = '📋 Neue Übergabe' + (stations ? ' · ' + stations : '');
      body = authors + ': ' + listTxt(added, 3) + (changed.length ? ' · ' + changed.length + ' Änderung(en)' : '');
    } else {
      const lab = { done: 'erledigt', in_progress: 'in Arbeit', open: 'wieder offen' };
      title = '🔄 Übergabe aktualisiert';
      body = changed.slice(0, 3).map((r) => r.item_name + ' ' + (lab[r.status] || '')).join(' · ') + (changed.length > 3 ? ' +' + (changed.length - 3) : '');
    }
    if (document.hidden) {
      // App im Hintergrund: System-Benachrichtigung (der Push-Server meldet sonst selbst)
      if (typeof window.kuecheNotify === 'function' && !(typeof window.kuechePushActive === 'function' && window.kuechePushActive())) {
        window.kuecheNotify({ title: title, body: body, tag: 'ho-local', url: './?view=handover' });
      }
    } else {
      toast(title, body, '📋', function () { openModal('list'); });
    }
  }

  function applyRows(rows) {
    if (state.busy.size === 0) state.items = rows || [];
    updateBadge((rows || []).filter((i) => i.status !== 'done').length);
  }

  async function load(silent) {
    if (typeof currentWaiterName !== 'string' || !currentWaiterName) return;
    const { data, error } = await fetchItems();
    if (error) {
      state.loadError = error.message || 'Unbekannter Fehler';
      if (!silent || !state.loaded) renderList();
      return;
    }
    state.loadError = '';
    state.loaded = true;
    detectChanges(data || []);
    applyRows(data || []);
    renderList();
  }

  // ---------- Anzeige: Liste ----------
  function sortItems(a, b) {
    if (!!a.is_optional !== !!b.is_optional) return a.is_optional ? 1 : -1;      // Pflicht zuerst
    if (a.shift_date !== b.shift_date) return String(a.shift_date).localeCompare(String(b.shift_date));
    return String(a.created_at).localeCompare(String(b.created_at));
  }

  function actionBtn(label, cls, id, status) {
    return '<button type="button" onclick="hoSetStatus(' + jsArg(id) + ',' + jsArg(status) + ')" ' +
      'class="px-3 py-2 rounded-lg text-xs font-bold transition ' + cls + '">' + label + '</button>';
  }

  function itemHtml(it) {
    const done = it.status === 'done';
    const prog = it.status === 'in_progress';
    const stripe = done ? 'border-l-emerald-500' : (prog ? 'border-l-amber-500' : (it.is_optional ? 'border-l-sky-400' : 'border-l-slate-400 dark:border-l-slate-500'));
    const busy = state.busy.has(it.id) ? ' opacity-50 pointer-events-none' : '';
    const primary = 'bg-amber-500 hover:bg-amber-600 text-slate-950';
    const success = 'bg-emerald-500 hover:bg-emerald-600 text-white';
    const ghost = 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200';
    let actions;
    if (done) actions = actionBtn('↩ Wieder öffnen', ghost, it.id, 'open');
    else if (prog) actions = actionBtn('✔ Fertig', success, it.id, 'done') + actionBtn('↩ Offen', ghost, it.id, 'open');
    else actions = actionBtn('▶ Starten', primary, it.id, 'in_progress') + actionBtn('✔ Fertig', success, it.id, 'done');

    const rec = (typeof chatStaffByName === 'function') ? chatStaffByName(it.author_name || '') : null;
    const who = escapeHtml(it.author_name || '?') + (rec && rec.role === 'staff' && rec.job_title ? ' (' + escapeHtml(rec.job_title) + ')' : '');
    const meta = (state.group === 'author' ? escapeHtml(it.station || '') : who) + ' · ' + escapeHtml(dayLabel(it.shift_date));
    const badge =
      (prog ? '<span class="px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[10px] font-bold">In Arbeit</span>' : '') +
      (it.is_optional ? '<span class="px-1.5 py-0.5 rounded-md bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30 text-[10px] font-bold">Evtl.</span>' : '');

    return (
      '<div class="custom-box border border-l-4 ' + stripe + ' rounded-xl p-3 flex flex-col gap-2' + busy + '">' +
        '<div class="flex items-start gap-2">' +
          '<div class="min-w-0 flex-1">' +
            '<div class="flex flex-wrap items-center gap-1.5">' +
              '<span class="text-sm font-bold break-words ' + (done ? 'line-through opacity-60' : '') + '">' + escapeHtml(it.item_name) + '</span>' + badge +
            '</div>' +
            (it.notes ? '<div class="text-xs text-slate-600 dark:text-slate-400 mt-1 break-words">📝 ' + escapeHtml(it.notes) + '</div>' : '') +
            '<div class="text-[10px] text-slate-500 mt-1">' + meta + '</div>' +
          '</div>' +
          (canDelete(it)
            ? '<button type="button" onclick="hoDeleteItem(' + jsArg(it.id) + ')" title="Löschen" aria-label="Löschen" class="shrink-0 w-8 h-8 rounded-lg text-slate-500 hover:text-red-500 hover:bg-red-500/10 text-sm">🗑️</button>'
            : '') +
        '</div>' +
        '<div class="flex flex-wrap gap-2">' + actions + '</div>' +
      '</div>'
    );
  }

  function groupHtml(items) {
    const key = state.group === 'author' ? 'author_name' : 'station';
    const groups = new Map();
    items.slice().sort(sortItems).forEach((it) => {
      const k = String(it[key] || '–').trim() || '–';
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(it);
    });
    return Array.from(groups.entries())
      .sort((a, b) => a[0].localeCompare(b[0], 'de'))
      .map(([name, list]) => {
        const req = list.filter((i) => !i.is_optional);
        const opt = list.filter((i) => i.is_optional);
        // Pflicht und Evtl. getrennt: so sieht man sofort, was wirklich gemacht werden muss
        const inner =
          req.map(itemHtml).join('') +
          (opt.length ? '<div class="text-[10px] font-bold uppercase tracking-wide text-sky-700 dark:text-sky-300 mt-1">Evtl. – wenn Zeit bleibt</div>' + opt.map(itemHtml).join('') : '');
        return '<div class="flex flex-col gap-2">' +
          '<div class="flex items-center gap-2 pt-1">' +
            '<span class="text-sm font-black text-amber-700 dark:text-amber-400">' + escapeHtml(name) + '</span>' +
            '<span class="px-1.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px] font-bold">' + list.length + '</span>' +
            '<span class="flex-1 border-t border-slate-300 dark:border-slate-700"></span>' +
            '<button type="button" onclick="hoShareGroup(' + jsArg(name) + ')" class="px-2 py-1 rounded-lg text-[11px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25" title="Diese Aufgaben an WhatsApp senden">📲 WhatsApp</button>' +
          '</div>' + inner + '</div>';
      }).join('');
  }

  function renderFilters(active) {
    const box = $('hoStationFilter');
    if (!box) return;
    const counts = new Map();
    active.forEach((i) => { const k = String(i.station || '–').trim() || '–'; counts.set(k, (counts.get(k) || 0) + 1); });
    if (state.filterStation && !counts.has(state.filterStation)) state.filterStation = '';
    const chip = (label, val, n) =>
      '<button type="button" class="ui-chip' + (state.filterStation === val ? ' active' : '') + '" onclick="hoFilterStation(' + jsArg(val) + ')">' + escapeHtml(label) + ' <span class="opacity-70">' + n + '</span></button>';
    box.innerHTML = chip('Alle', '', active.length) +
      Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0], 'de')).map(([k, n]) => chip(k, k, n)).join('');
  }

  function setStat(id, n) { const el = $(id); if (el) el.textContent = String(n); }

  function visibleItem(i) {
    return (!state.filterStation || String(i.station || '–').trim() === state.filterStation) && !(state.hideOptional && i.is_optional);
  }

  function renderList() {
    const box = $('hoListContainer');
    if (!box) return;

    if (state.loadError) {
      box.innerHTML =
        '<div class="custom-box border border-red-500/40 rounded-xl p-4 text-xs text-red-600 dark:text-red-400">' +
        '⚠️ Die Übergaben konnten nicht geladen werden:<br><b>' + escapeHtml(state.loadError) + '</b><br>' +
        '<span class="text-slate-600 dark:text-slate-400">Wurde sql/1.1.00_handovers.sql in Supabase ausgeführt?</span></div>';
      return;
    }
    renderShareBanner();
    if (!state.loaded) { box.innerHTML = '<div class="text-xs text-slate-500 p-3">Lade ...</div>'; return; }

    const allActive = state.items.filter((i) => i.status !== 'done');
    const done = state.items.filter((i) => i.status === 'done');
    setStat('hoStatOpen', allActive.filter((i) => i.status === 'open').length);
    setStat('hoStatProg', allActive.filter((i) => i.status === 'in_progress').length);
    setStat('hoStatReq', allActive.filter((i) => !i.is_optional).length);
    setStat('hoStatDone', done.length);
    renderFilters(allActive);

    const visible = visibleItem;
    const active = allActive.filter(visible);
    const doneVisible = done.filter(visible);

    let html = '';
    if (active.length === 0) {
      html += '<div class="custom-box border rounded-xl p-6 text-center text-sm text-slate-600 dark:text-slate-400">' +
        (allActive.length === 0 ? '🎉 Alles erledigt – keine offenen Aufgaben.' : 'Keine Aufgaben für diesen Filter.') +
        '<br><span class="text-xs">Neue Aufgaben trägst du unter „Übergabe schreiben“ ein.</span></div>';
    } else {
      html += groupHtml(active);
    }
    if (doneVisible.length) {
      html += '<details class="mt-1"><summary class="cursor-pointer text-xs font-bold text-slate-600 dark:text-slate-400 select-none py-1">✔ Erledigt (' + doneVisible.length + ')</summary>' +
        '<div class="flex flex-col gap-2 mt-2">' + doneVisible.slice().sort((a, b) => sortItems(b, a)).map(itemHtml).join('') + '</div></details>';
    }
    box.innerHTML = html;
  }

  function updateBadge(n) {
    try { if (navigator.setAppBadge) { n > 0 ? navigator.setAppBadge(n) : navigator.clearAppBadge(); } } catch (e) {}
    ['hoBadgeMenu', 'hoBadgeMain'].forEach((id) => {
      const el = $(id);
      if (!el) return;
      el.textContent = n > 99 ? '99+' : String(n);
      el.classList.toggle('hidden', !(n > 0));
    });
  }

  // ---------- Status ändern ----------
  async function setStatus(id, next) {
    const it = state.items.find((x) => x.id === id);
    if (!it || state.busy.has(id) || it.status === next) return;
    const prev = it.status;
    state.busy.add(id);
    state.ownChange.set(id, Date.now());
    it.status = next;
    renderList();
    const { data, error } = await _supabase.from(TABLE).update({ status: next }).eq('id', id).select('id');
    state.busy.delete(id);
    if (!error && data && data.length > 0 && state.snap) state.snap.set(id, next);
    if (error || !data || data.length === 0) {
      it.status = prev;
      state.ownChange.delete(id);
      toast('Nicht gespeichert', error ? error.message : 'Keine Berechtigung oder Eintrag existiert nicht mehr.', '⚠️');
    }
    renderList();
    updateBadge(state.items.filter((i) => i.status !== 'done').length);
  }

  async function deleteItem(id) {
    const it = state.items.find((x) => x.id === id);
    if (!it || state.busy.has(id)) return;
    if (!confirm('„' + it.item_name + '“ wirklich löschen?')) return;
    state.busy.add(id);
    renderList();
    const { data, error } = await _supabase.from(TABLE).delete().eq('id', id).select('id');
    state.busy.delete(id);
    if (error || !data || data.length === 0) {
      toast('Nicht gelöscht', error ? error.message : 'Keine Berechtigung.', '⚠️');
    } else {
      state.items = state.items.filter((x) => x.id !== id);
    }
    renderList();
    updateBadge(state.items.filter((i) => i.status !== 'done').length);
  }

  // ---------- WhatsApp ----------
  // Format:  *Sektion*  /  • Aufgabe  /  • Evtl. Aufgabe (Notiz)  /  Danke, bis dann!
  function buildWhatsAppText(groups) {
    const blocks = groups
      .filter((g) => g.items && g.items.length)
      .map((g) => '*' + String(g.station || 'Allgemein').replace(/\*/g, '').trim() + '*\n' +
        g.items.map((i) => '• ' + (i.is_optional ? 'Evtl. ' : '') + i.item_name + (i.notes ? ' (' + i.notes + ')' : '')).join('\n'));
    if (!blocks.length) return '';
    return blocks.join('\n\n') + '\n\n' + WA_CLOSING;
  }

  function groupsFromItems(items) {
    const map = new Map();
    items.slice().sort(sortItems).forEach((it) => {
      const k = String(it.station || 'Allgemein').trim() || 'Allgemein';
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(it);
    });
    return Array.from(map.entries()).map(([station, list]) => ({ station: station, items: list }));
  }

  // Kopiert in die Zwischenablage (läuft auch ohne Clipboard-API über die alte Methode)
  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; }
    } catch (e) { /* weiter mit Ersatzweg */ }
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
      document.body.appendChild(ta);
      ta.select(); ta.setSelectionRange(0, text.length);
      const ok = document.execCommand('copy');
      ta.remove();
      return !!ok;
    } catch (e) { return false; }
  }

  // 1) Text kopieren  2) wa.me-Link mit vorausgefülltem Text öffnen (Gruppe wählt der Koch selbst)
  // 3) Falls das nicht geht (blockiert oder Text zu lang): Einladungslink der Gruppe öffnen
  // Wichtig: Muss direkt aus einem Klick heraus aufgerufen werden, sonst blockieren Browser das Öffnen.
  function shareWhatsApp(text) {
    if (!text) { toast('Nichts zu senden', 'Es gibt keine Aufgaben für die Nachricht.', '⚠️'); return false; }
    const copying = copyText(text);                      // startet sofort
    const encoded = encodeURIComponent(text);
    const tooLong = encoded.length > WA_MAX_ENCODED;

    let win = null;
    if (!tooLong) { try { win = window.open('https://wa.me/?text=' + encoded, '_blank'); } catch (e) { win = null; } }
    let usedFallback = false;
    if (!win) {
      usedFallback = true;
      try { win = window.open(WA_FALLBACK_GROUP, '_blank'); } catch (e) { win = null; }
    }

    copying.then((copied) => {
      if (!win) {
        state.pendingShare = text;
        renderShareBanner();
        toast('WhatsApp wurde blockiert', copied ? 'Text ist kopiert. Tippe auf „WhatsApp öffnen“.' : 'Tippe auf „WhatsApp öffnen“.', '⚠️');
        return;
      }
      state.pendingShare = '';
      renderShareBanner();
      if (usedFallback) {
        toast('Gruppe wird geöffnet', (copied ? 'Text kopiert – in der Gruppe einfügen.' : 'Bitte Text manuell kopieren.') + (tooLong ? ' (Nachricht ist lang)' : ''), '📲');
      } else {
        toast('An WhatsApp übergeben', (copied ? 'Text kopiert. ' : '') + 'Gruppe wählen und senden.', '📲');
      }
    });
    return !!win;
  }

  function renderShareBanner() {
    const box = $('hoShareBanner');
    if (!box) return;
    if (!state.pendingShare) { box.classList.add('hidden'); box.innerHTML = ''; return; }
    box.classList.remove('hidden');
    box.innerHTML =
      '<div class="custom-box border border-emerald-500/40 rounded-xl p-3 flex items-center gap-3">' +
        '<div class="text-xs flex-1"><b>Übergabe gespeichert.</b><br><span class="text-slate-600 dark:text-slate-400">WhatsApp konnte nicht automatisch geöffnet werden.</span></div>' +
        '<button type="button" onclick="hoSharePending()" class="px-3 py-2 rounded-lg text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white">📲 WhatsApp öffnen</button>' +
        '<button type="button" onclick="hoDismissPending()" class="w-8 h-8 text-slate-500 hover:text-slate-800 dark:hover:text-white" aria-label="Schließen">&times;</button>' +
      '</div>';
  }

  function shareItems(items) {
    const text = buildWhatsAppText(groupsFromItems(items));
    if (!text) { toast('Nichts zu senden', 'Keine offenen Aufgaben vorhanden.', '📋'); return; }
    shareWhatsApp(text);
  }

  function shareVisible() {
    shareItems(state.items.filter((i) => i.status !== 'done' && visibleItem(i)));
  }

  function shareGroup(name) {
    const key = state.group === 'author' ? 'author_name' : 'station';
    shareItems(state.items.filter((i) => i.status !== 'done' && visibleItem(i) && (String(i[key] || '–').trim() || '–') === name));
  }

  // Nur teilen, ohne zu speichern (aus dem Formular)
  function shareFromForm() {
    const err = $('hoAddError');
    err.textContent = '';
    if (!state.station) { err.textContent = 'Bitte eine Sektion wählen.'; return; }
    const rows = parseLines($('hoItemsText').value, $('hoOptional').checked, ($('hoNote').value || '').trim());
    if (rows.length === 0) { err.textContent = 'Bitte mindestens eine Aufgabe eintragen (eine pro Zeile).'; return; }
    shareWhatsApp(buildWhatsAppText([{ station: state.station, items: rows }]));
  }

  function saveWaPref() {
    try { localStorage.setItem('kueche_ho_wa', $('hoAutoWa').checked ? '1' : '0'); } catch (e) {}
  }
  function loadWaPref() {
    let v = '1';
    try { v = localStorage.getItem('kueche_ho_wa') || '1'; } catch (e) {}
    const el = $('hoAutoWa'); if (el) el.checked = (v !== '0');
  }

  // ---------- Formular: Übergabe schreiben ----------
  function renderStationChips() {
    const box = $('hoStationChips');
    if (!box) return;
    box.innerHTML = allStations().map((s) =>
      '<button type="button" class="ui-chip' + (s === state.station ? ' active' : '') + '" onclick="hoSelectStation(' + jsArg(s) + ')">' + escapeHtml(s) + '</button>'
    ).join('');
  }

  function selectStation(name) {
    state.station = name;
    try { sessionStorage.setItem('kueche_ho_station', name); } catch (e) {}
    renderStationChips();
    const err = $('hoAddError'); if (err) err.textContent = '';
  }

  function addCustomStation() {
    const inp = $('hoNewStation');
    const v = (inp.value || '').trim().slice(0, 30);
    if (!v) return;
    const existing = allStations().find((s) => s.toLowerCase() === v.toLowerCase());
    if (!existing) state.extraStations.push(v);
    inp.value = '';
    selectStation(existing || v);
  }

  // Zeilen -> Einträge. Unterstützt: "- Punkt", "1. Punkt", "Evtl. Punkt", "Punkt | Notiz"
  function parseLines(text, forceOptional, defaultNote) {
    const out = [];
    String(text || '').split(/\r?\n/).forEach((raw) => {
      let line = raw.trim().replace(/^(?:[-*•–·]|\d+[.)])\s+/, '').trim();
      if (!line) return;
      let optional = !!forceOptional;
      const m = line.match(/^(evtl\.?|eventuell|optional)\s*[:\-–]?\s+(.+)$/i);
      if (m) { optional = true; line = m[2].trim(); }
      let name = line, note = '';
      const bar = line.indexOf('|');
      if (bar !== -1) { name = line.slice(0, bar).trim(); note = line.slice(bar + 1).trim(); }
      if (!name) return;
      out.push({ item_name: name.slice(0, 120), is_optional: optional, notes: (note || defaultNote || '').slice(0, 300) || null });
    });
    return out.slice(0, 50);
  }

  async function submitHandover() {
    if (state.saving) return;
    const err = $('hoAddError');
    err.textContent = '';
    const author = typeof currentWaiterName === 'string' ? currentWaiterName : '';
    if (!author) { err.textContent = 'Bitte zuerst anmelden.'; return; }
    if (!state.station) { err.textContent = 'Bitte eine Sektion wählen.'; return; }

    const rows = parseLines($('hoItemsText').value, $('hoOptional').checked, ($('hoNote').value || '').trim());
    if (rows.length === 0) { err.textContent = 'Bitte mindestens eine Aufgabe eintragen (eine pro Zeile).'; return; }

    const today = localISO(new Date());
    const payload = rows.map((r) => ({
      shift_date: today,
      author_name: author,
      station: state.station,
      item_name: r.item_name,
      status: 'open',
      is_optional: r.is_optional,
      notes: r.notes
    }));

    state.saving = true;
    const btn = $('hoSubmitBtn');
    btn.disabled = true; btn.textContent = 'Speichere ...';
    const { error } = await _supabase.from(TABLE).insert(payload);
    state.saving = false;
    btn.disabled = false;

    if (error) { err.textContent = 'Fehler: ' + error.message; return; }

    const waText = buildWhatsAppText([{ station: state.station, items: rows }]);
    const sendWa = $('hoAutoWa') && $('hoAutoWa').checked;

    $('hoItemsText').value = '';
    $('hoNote').value = '';
    $('hoOptional').checked = false;
    updatePreview();
    toast('Übergabe gespeichert', payload.length + (payload.length === 1 ? ' Aufgabe' : ' Aufgaben') + ' · ' + state.station, '📋');
    setPane('list');
    // Kann der Browser WhatsApp hier nicht öffnen, erscheint oben in der Liste ein Button
    if (sendWa) shareWhatsApp(waText);
    load(false);
  }

  // ---------- Modal / Navigation ----------
  function setPane(p) {
    state.pane = p;
    $('hoPaneList').classList.toggle('hidden', p !== 'list');
    $('hoPaneList').classList.toggle('flex', p === 'list');
    $('hoPaneAdd').classList.toggle('hidden', p !== 'add');
    $('hoPaneAdd').classList.toggle('flex', p === 'add');
    $('hoTabList').classList.toggle('active', p === 'list');
    $('hoTabAdd').classList.toggle('active', p === 'add');
    if (p === 'add') {
      renderStationChips();
      updatePreview();
      setTimeout(() => { const t = $('hoItemsText'); if (t) t.focus(); }, 50);
    }
  }

  function filterStation(v) { state.filterStation = v || ''; renderList(); }
  function toggleHideOptional() {
    state.hideOptional = !state.hideOptional;
    const b = $('hoHideOpt');
    if (b) { b.classList.toggle('active', state.hideOptional); }
    renderList();
  }

  // Live-Vorschau: zeigt, wie die Zeilen erkannt werden
  function updatePreview() {
    const rows = parseLines($('hoItemsText').value, $('hoOptional').checked, ($('hoNote').value || '').trim());
    const box = $('hoPreview');
    const btn = $('hoSubmitBtn');
    if (!box || !btn) return;
    if (rows.length === 0) {
      box.innerHTML = '<span class="text-[11px] text-slate-500">Hier erscheint die Vorschau deiner Aufgaben.</span>';
    } else {
      const nOpt = rows.filter((r) => r.is_optional).length;
      box.innerHTML =
        '<div class="text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1.5">' + rows.length + (rows.length === 1 ? ' Aufgabe' : ' Aufgaben') + (nOpt ? ' · davon ' + nOpt + ' Evtl.' : '') + '</div>' +
        '<div class="flex flex-col gap-1">' + rows.map((r) =>
          '<div class="flex items-start gap-2 text-xs"><span class="mt-0.5">' + (r.is_optional ? '◌' : '●') + '</span><span class="min-w-0 break-words"><b>' + escapeHtml(r.item_name) + '</b>' +
          (r.is_optional ? ' <span class="px-1 rounded bg-sky-500/15 text-sky-700 dark:text-sky-300 text-[10px] font-bold">Evtl.</span>' : '') +
          (r.notes ? ' <span class="text-slate-500">· ' + escapeHtml(r.notes) + '</span>' : '') + '</span></div>'
        ).join('') + '</div>';
    }
    if (!state.saving) btn.textContent = rows.length ? '💾 ' + rows.length + (rows.length === 1 ? ' Aufgabe speichern' : ' Aufgaben speichern') : '💾 Übergabe speichern';
  }

  function setGroup(g) {
    state.group = g;
    $('hoGroupStation').classList.toggle('active', g === 'station');
    $('hoGroupAuthor').classList.toggle('active', g === 'author');
    renderList();
  }

  function stopListTimer() { if (state.listTimer) { clearInterval(state.listTimer); state.listTimer = null; } }

  function openModal(pane) {
    if (typeof closeSettingsMenu === 'function') closeSettingsMenu();
    if (!state.station) {
      try { state.station = sessionStorage.getItem('kueche_ho_station') || ''; } catch (e) {}
    }
    const m = $('handoverModal');
    m.classList.remove('hidden'); m.classList.add('flex');
    loadWaPref();
    setPane(pane || 'list');
    setGroup(state.group);
    load(false);
    stopListTimer();
    state.listTimer = setInterval(() => {
      if (!document.hidden && state.pane === 'list' && state.busy.size === 0) load(true);
    }, POLL_LIST_MS);
  }

  function closeModal() {
    stopListTimer();
    const m = $('handoverModal');
    m.classList.remove('flex'); m.classList.add('hidden');
  }

  // ---------- Hintergrund-Abfrage: Zähler + Benachrichtigungen ----------
  async function poll() {
    if (typeof currentWaiterName !== 'string' || !currentWaiterName) { updateBadge(0); state.snap = null; return; }
    // Bei offener Liste und gerade laufender Änderung nichts überschreiben
    const { data, error } = await fetchItems();
    if (error) return;
    state.loaded = true; state.loadError = '';
    detectChanges(data || []);
    applyRows(data || []);
    const m = $('handoverModal');
    if (m && !m.classList.contains('hidden') && state.pane === 'list') renderList();
  }

  // Öffnet die Übergabe, wenn die App über eine Benachrichtigung gestartet wurde (?view=handover)
  function consumeDeepLink() {
    try {
      const p = new URLSearchParams(location.search);
      if (p.get('view') === 'handover') {
        history.replaceState(null, '', location.pathname + location.hash);
        setTimeout(() => openModal('list'), 300);
      }
    } catch (e) {}
  }

  function startBadgePolling() {
    state.snap = null;
    poll();
    consumeDeepLink();
    if (state.badgeTimer) return;
    state.badgeTimer = setInterval(poll, POLL_BADGE_MS);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });
  }

  // Esc schließt das Fenster
  document.addEventListener('keydown', (e) => {
    const m = $('handoverModal');
    if (e.key === 'Escape' && m && !m.classList.contains('hidden')) closeModal();
  });

  // ---------- Öffentliche Funktionen (für onclick im HTML) ----------
  window.openHandoverModal = openModal;
  window.closeHandoverModal = closeModal;
  window.hoSetPane = setPane;
  window.hoSetGroup = setGroup;
  window.hoSelectStation = selectStation;
  window.hoAddCustomStation = addCustomStation;
  window.hoSubmit = submitHandover;
  window.hoSetStatus = setStatus;
  window.hoDeleteItem = deleteItem;
  window.hoFilterStation = filterStation;
  window.hoToggleOptional = toggleHideOptional;
  window.hoUpdatePreview = updatePreview;
  window.hoShareGroup = shareGroup;
  window.hoShareVisible = shareVisible;
  window.hoShareForm = shareFromForm;
  window.hoSaveWaPref = saveWaPref;
  window.hoSharePending = function () { if (state.pendingShare) shareWhatsApp(state.pendingShare); };
  window.hoDismissPending = function () { state.pendingShare = ''; renderShareBanner(); };
  window.hoBuildWhatsAppText = buildWhatsAppText;
  window.hoRefresh = function () { load(false); };
  window.startHandoverBadgePolling = startBadgePolling;
})();

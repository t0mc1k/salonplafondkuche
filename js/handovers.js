/* ============================================================
   js/handovers.js
   Schichtübergabe: Aufgaben und Vorbereitungen für die nächste Schicht
   Tabelle: kitchen_handovers   (Rechte: sql/1.1.00_handovers.sql)
   Benutzt: _supabase, currentWaiterName, userIsAdmin, escapeHtml, jsArg, showAppToast
   ============================================================ */
(function () {
  'use strict';

  const TABLE = 'kitchen_handovers';
  const DEFAULT_STATIONS = ['Entre', 'Garde/Pati', 'Warme Küche', 'Allgemein'];
  const NEXT_STATUS = { open: 'in_progress', in_progress: 'done', done: 'open' };
  const POLL_LIST_MS = 20000;
  const POLL_BADGE_MS = 60000;
  const DONE_VISIBLE_DAYS = 2;

  const state = {
    items: [],
    pane: 'list',          // 'list' | 'add'
    group: 'station',      // 'station' | 'author'
    station: '',
    extraStations: [],
    busy: new Set(),
    loadError: '',
    loaded: false,
    listTimer: null,
    badgeTimer: null,
    saving: false
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
  function toast(title, text, icon) {
    if (typeof showAppToast === 'function') showAppToast({ initial: icon || '📋', title: title, text: text || '' });
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
  async function load(silent) {
    if (typeof currentWaiterName !== 'string' || !currentWaiterName) return;
    const since = localISO(addDays(new Date(), -DONE_VISIBLE_DAYS));
    const { data, error } = await _supabase
      .from(TABLE)
      .select('*')
      .or('status.neq.done,shift_date.gte.' + since)
      .order('shift_date', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(500);
    if (error) {
      state.loadError = error.message || 'Unbekannter Fehler';
      if (!silent || !state.loaded) renderList();
      return;
    }
    state.loadError = '';
    state.loaded = true;
    // Während einer Änderung nicht überschreiben (verhindert Flackern)
    if (state.busy.size === 0) state.items = data || [];
    renderList();
    updateBadge(state.items.filter((i) => i.status !== 'done').length);
  }

  // ---------- Anzeige: Liste ----------
  function sortItems(a, b) {
    if (!!a.is_optional !== !!b.is_optional) return a.is_optional ? 1 : -1;      // Pflicht zuerst
    if (a.shift_date !== b.shift_date) return String(a.shift_date).localeCompare(String(b.shift_date));
    return String(a.created_at).localeCompare(String(b.created_at));
  }

  function itemHtml(it) {
    const done = it.status === 'done';
    const prog = it.status === 'in_progress';
    const icon = done ? '✔' : (prog ? '◐' : '');
    const circle = done
      ? 'bg-emerald-500 border-emerald-500 text-white'
      : (prog ? 'bg-amber-500/20 border-amber-500 text-amber-600 dark:text-amber-400'
              : 'bg-transparent border-slate-400 dark:border-slate-500 text-transparent');
    const title = done ? 'Wieder öffnen' : (prog ? 'Als erledigt markieren' : 'In Arbeit setzen');
    const busy = state.busy.has(it.id) ? ' opacity-50 pointer-events-none' : '';
    const author = state.group === 'author' ? escapeHtml(it.station || '') : escapeHtml(it.author_name || '?');
    const badges =
      (it.is_optional ? '<span class="px-1.5 py-0.5 rounded-md bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30 text-[10px] font-bold">Evtl.</span>' : '') +
      (prog ? '<span class="px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[10px] font-bold">In Arbeit</span>' : '');
    return (
      '<div class="custom-box border rounded-xl p-2.5 flex items-start gap-3' + busy + '">' +
        '<button type="button" onclick="hoCycleStatus(' + jsArg(it.id) + ')" title="' + title + '" aria-label="' + title + '" ' +
          'class="shrink-0 w-9 h-9 rounded-full border-2 flex items-center justify-center text-base font-black transition ' + circle + '">' + icon + '</button>' +
        '<div class="min-w-0 flex-1">' +
          '<div class="flex flex-wrap items-center gap-1.5">' +
            '<span class="text-sm font-bold break-words ' + (done ? 'line-through opacity-60' : '') + '">' + escapeHtml(it.item_name) + '</span>' + badges +
          '</div>' +
          (it.notes ? '<div class="text-xs text-slate-600 dark:text-slate-400 mt-0.5 break-words">📝 ' + escapeHtml(it.notes) + '</div>' : '') +
          '<div class="text-[10px] text-slate-500 mt-0.5">' + author + ' · ' + escapeHtml(dayLabel(it.shift_date)) + '</div>' +
        '</div>' +
        (canDelete(it)
          ? '<button type="button" onclick="hoDeleteItem(' + jsArg(it.id) + ')" title="Löschen" aria-label="Löschen" class="shrink-0 w-8 h-8 rounded-lg text-slate-500 hover:text-red-500 hover:bg-red-500/10 text-sm">🗑️</button>'
          : '') +
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
      .map(([name, list]) =>
        '<div class="flex flex-col gap-1.5">' +
          '<div class="flex items-center gap-2 mt-1">' +
            '<span class="text-xs font-black uppercase tracking-wide text-amber-700 dark:text-amber-400">' + escapeHtml(name) + '</span>' +
            '<span class="text-[10px] text-slate-500">' + list.length + '</span>' +
            '<span class="flex-1 border-t border-slate-300 dark:border-slate-700"></span>' +
          '</div>' +
          list.map(itemHtml).join('') +
        '</div>'
      ).join('');
  }

  function renderList() {
    const box = $('hoListContainer');
    if (!box) return;

    if (state.loadError) {
      box.innerHTML =
        '<div class="custom-box border border-red-500/40 rounded-xl p-4 text-xs text-red-600 dark:text-red-400">' +
        '⚠️ Die Übergaben konnten nicht geladen werden:<br><b>' + escapeHtml(state.loadError) + '</b><br>' +
        '<span class="text-slate-600 dark:text-slate-400">Wurde sql/1.1.00_handovers.sql in Supabase ausgeführt?</span></div>';
      $('hoSummary').textContent = '';
      return;
    }
    if (!state.loaded) { box.innerHTML = '<div class="text-xs text-slate-500 p-3">Lade ...</div>'; return; }

    const active = state.items.filter((i) => i.status !== 'done');
    const done = state.items.filter((i) => i.status === 'done');
    const nOpen = active.filter((i) => i.status === 'open').length;
    const nProg = active.filter((i) => i.status === 'in_progress').length;
    const nReq = active.filter((i) => !i.is_optional).length;
    $('hoSummary').textContent = nOpen + ' offen · ' + nProg + ' in Arbeit · ' + nReq + ' Pflicht · ' + done.length + ' erledigt';

    let html = '';
    if (active.length === 0) {
      html += '<div class="custom-box border rounded-xl p-5 text-center text-xs text-slate-600 dark:text-slate-400">🎉 Keine offenen Aufgaben.<br>Über „Übergabe schreiben“ kannst du Aufgaben für die nächste Schicht eintragen.</div>';
    } else {
      html += groupHtml(active);
    }
    if (done.length) {
      html += '<details class="mt-2"><summary class="cursor-pointer text-xs font-bold text-slate-600 dark:text-slate-400 select-none">✔ Erledigt (' + done.length + ')</summary>' +
        '<div class="flex flex-col gap-1.5 mt-2">' + done.slice().sort((a, b) => sortItems(b, a)).map(itemHtml).join('') + '</div></details>';
    }
    box.innerHTML = html;
  }

  function updateBadge(n) {
    ['hoBadgeMenu', 'hoBadgeMain'].forEach((id) => {
      const el = $(id);
      if (!el) return;
      el.textContent = n > 99 ? '99+' : String(n);
      el.classList.toggle('hidden', !(n > 0));
    });
  }

  // ---------- Status ändern ----------
  async function cycleStatus(id) {
    const it = state.items.find((x) => x.id === id);
    if (!it || state.busy.has(id)) return;
    const prev = it.status;
    const next = NEXT_STATUS[prev] || 'open';
    state.busy.add(id);
    it.status = next;
    renderList();
    const { data, error } = await _supabase.from(TABLE).update({ status: next }).eq('id', id).select('id');
    state.busy.delete(id);
    if (error || !data || data.length === 0) {
      it.status = prev;
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
    btn.disabled = false; btn.textContent = '💾 Übergabe speichern';

    if (error) { err.textContent = 'Fehler: ' + error.message; return; }

    $('hoItemsText').value = '';
    $('hoNote').value = '';
    $('hoOptional').checked = false;
    toast('Übergabe gespeichert', payload.length + (payload.length === 1 ? ' Aufgabe' : ' Aufgaben') + ' · ' + state.station, '📋');
    setPane('list');
    load(false);
  }

  // ---------- Modal / Navigation ----------
  function setPane(p) {
    state.pane = p;
    $('hoPaneList').classList.toggle('hidden', p !== 'list');
    $('hoPaneAdd').classList.toggle('hidden', p !== 'add');
    $('hoTabList').classList.toggle('active', p === 'list');
    $('hoTabAdd').classList.toggle('active', p === 'add');
    if (p === 'add') {
      renderStationChips();
      setTimeout(() => { const t = $('hoItemsText'); if (t) t.focus(); }, 50);
    }
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

  // ---------- Zähler (Menü + Hauptseite) ----------
  async function refreshBadge() {
    if (typeof currentWaiterName !== 'string' || !currentWaiterName) return;
    const { count, error } = await _supabase.from(TABLE).select('id', { count: 'exact', head: true }).neq('status', 'done');
    if (!error && typeof count === 'number') updateBadge(count);
  }

  function startBadgePolling() {
    refreshBadge();
    if (state.badgeTimer) return;
    state.badgeTimer = setInterval(() => {
      if (document.hidden) return;
      if (typeof currentWaiterName !== 'string' || !currentWaiterName) { updateBadge(0); return; }
      refreshBadge();
    }, POLL_BADGE_MS);
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
  window.hoCycleStatus = cycleStatus;
  window.hoDeleteItem = deleteItem;
  window.hoRefresh = function () { load(false); };
  window.startHandoverBadgePolling = startBadgePolling;
})();

/* ============================================================
   js/inbox.js  (v4.1.07)
   Mitteilungen: „🔔 3 neu“ unter dem Datum im Dashboard (blinkt, solange etwas ungelesen ist)

   - Neue App-Version: „🚀 Neu in v4.1.07“ – Tippen öffnet „Was ist neu?“, danach verschwindet es.
     (Gemerkt wird das pro Person auf diesem Gerät.)
   - Alles, was auch eine Push-Meldung auslöst (genehmigter Urlaub, Schichttausch, neuer Plan, ...),
     steht zusätzlich in der Datenbank (Tabelle inbox_items, SQL 4.1.07). So sieht man es auch, wenn Push
     auf dem Gerät nicht funktioniert. Chat ist ausgenommen (eigener Zähler).
   - Öffnen des Fensters = alles gelesen (Funktion inbox_mark_read).
   ============================================================ */

    let inboxCount = 0, inboxTimer = null;

    const inboxSeenKey = () => 'nexus_seen_version_' + String(currentWaiterName || '').toLowerCase();
    function inboxVersionUnseen() {
      try { return !!currentWaiterName && typeof APP_VERSION !== 'undefined' && localStorage.getItem(inboxSeenKey()) !== APP_VERSION; } catch (e) { return false; }
    }
    function inboxMarkVersionSeen() {
      try { localStorage.setItem(inboxSeenKey(), APP_VERSION); } catch (e) {}
    }

    // Zähler holen und das Symbol unter dem Datum aktualisieren
    async function inboxRefresh() {
      const el = document.getElementById('dashInbox');
      if (!el) return;
      let n = 0;
      if (currentWaiterName) {
        try {
          const { data, error } = await _supabase.rpc('inbox_unread_count');
          if (!error && typeof data === 'number') n = data;     // vor SQL 4.1.07 gibt es die Funktion noch nicht: dann 0
        } catch (e) {}
      }
      inboxCount = n;
      inboxRenderChip();
      if (!inboxTimer) {
        inboxTimer = setInterval(() => { if (!document.hidden && document.getElementById('dashboardView') && !document.getElementById('dashboardView').classList.contains('hidden')) inboxRefresh(); }, 60000);
        document.addEventListener('visibilitychange', () => { if (!document.hidden) inboxRefresh(); });
      }
    }

    function inboxRenderChip() {
      const el = document.getElementById('dashInbox');
      if (!el) return;
      const ver = inboxVersionUnseen();
      const total = inboxCount + (ver ? 1 : 0);
      if (!total || !currentWaiterName) { el.classList.add('hidden'); el.classList.remove('blink'); return; }
      el.classList.remove('hidden');
      el.classList.add('blink');
      el.textContent = (inboxCount === 0 && ver)
        ? '🚀 ' + fmL('Neu in v' + APP_VERSION, 'New in v' + APP_VERSION)
        : '🔔 ' + fmL(total + ' neu', total + ' new');
    }

    function inboxTimeText(iso) {
      const d = new Date(iso), diff = Date.now() - d.getTime();
      if (diff < 60000) return fmL('gerade eben', 'just now');
      if (diff < 3600000) { const m = Math.round(diff / 60000); return fmL('vor ' + m + ' Min.', m + ' min ago'); }
      if (diff < 86400000) { const h = Math.round(diff / 3600000); return fmL('vor ' + h + ' Std.', h + ' h ago'); }
      return d.toLocaleDateString(langLocale(), { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString(langLocale(), { hour: '2-digit', minute: '2-digit' });
    }

    async function openInboxModal() {
      closeSettingsMenu();
      const m = fmOpen('inboxModal', { title: '🔔 ' + fmL('Mitteilungen', 'Notifications'), sub: fmL('Neuigkeiten, die dich betreffen – auch wenn Push auf dem Gerät nicht ankommt.', 'News that concerns you – even if push does not arrive on your device.') });
      m.setBody('<p class="staff-empty">' + escapeHtml(fmL('Lade ...', 'Loading ...')) + '</p>');
      m.setFoot(`<button type="button" class="ui-btn-primary" onclick="fmClose('inboxModal')">${escapeHtml(fmL('Fertig', 'Done'))}</button>`);

      let items = [], failed = null;
      try {
        const { data, error } = await _supabase.rpc('inbox_list', { p_limit: 40 });
        if (error) failed = error; else items = (data && data.items) || [];
      } catch (e) { failed = e; }

      let html = '';
      if (inboxVersionUnseen()) {
        html += `<button type="button" class="ib-item unread ib-version" onclick="inboxOpenVersion()">
          <span class="ib-dot"></span><span class="ib-main"><b>🚀 ${escapeHtml(fmL('Neue Version v' + APP_VERSION, 'New version v' + APP_VERSION))}</b>
          <small>${escapeHtml(fmL('Tippen, um zu sehen, was neu ist.', 'Tap to see what is new.'))}</small></span></button>`;
      }
      if (failed) {
        const msg = String((failed && failed.message) || failed);
        html += /does not exist|schema cache|could not find/i.test(msg)
          ? `<p class="staff-empty">${escapeHtml(fmL('Die Mitteilungen sind noch nicht eingerichtet (sql/4.1.07_inbox.sql).', 'Notifications are not set up yet (sql/4.1.07_inbox.sql).'))}</p>`
          : fmErrorHtml(failed);
      } else if (!items.length && !html) {
        html = `<p class="staff-empty">${escapeHtml(fmL('Keine Mitteilungen in den letzten 30 Tagen.', 'No notifications in the last 30 days.'))}</p>`;
      } else {
        const lang = (typeof currentLang === 'string' && currentLang) || 'de';
        html += items.map(it => {
          const p = (it.payload && (it.payload[lang] || it.payload.de)) || {};
          const target = it.url ? ` onclick="inboxOpenItem(${jsArg(it.url)})"` : '';
          return `<button type="button" class="ib-item${it.unread ? ' unread' : ''}"${target}>
            <span class="ib-dot"></span><span class="ib-main"><b>${escapeHtml(p.title || '')}</b>
            ${p.body ? `<small>${escapeHtml(p.body)}</small>` : ''}<small class="ib-time">${escapeHtml(inboxTimeText(it.created_at))}</small></span></button>`;
        }).join('');
      }
      m.setBody(html || `<p class="staff-empty">${escapeHtml(fmL('Keine Mitteilungen in den letzten 30 Tagen.', 'No notifications in the last 30 days.'))}</p>`);

      // Fenster geöffnet = gelesen (die Markierungen bleiben in dieser Ansicht sichtbar)
      if (!failed) {
        try { await _supabase.rpc('inbox_mark_read'); } catch (e) {}
        inboxCount = 0;
        inboxRenderChip();
      }
    }

    function inboxOpenVersion() {
      inboxMarkVersionSeen();
      inboxRenderChip();
      fmClose('inboxModal');
      if (typeof openChangelogModal === 'function') openChangelogModal();
    }

    function inboxOpenItem(target) {
      fmClose('inboxModal');
      if (typeof pushOpenTarget === 'function') setTimeout(() => pushOpenTarget(target), 150);
    }

/* ============================================================
   js/changelog.js
   Version, Changelog ("Was ist neu?") und dessen Bedienung

   NEUE VERSION VERÖFFENTLICHEN (nur hier ändern):
   1. APP_VERSION unten auf die neue Nummer setzen.
   2. Oben in CHANGELOG einen neuen Eintrag einfügen (neueste Version zuerst).
      Die bisher aktuelle Version rutscht automatisch ins Archiv.
   3. In index.html alle "?v=..." auf die neue Nummer setzen (Cache).
   Änderungs-Typen: 'new' Neu, 'improved' Verbessert, 'fixed' Behoben,
                    'security' Sicherheit, 'info' Allgemein
   ============================================================ */
    const APP_VERSION = '1.0.00';

    const CHANGELOG = [
  { version: '1.0.00', range: '', date: 'Oktober 2026', title: 'Erste Version der Küchen-App',
    changes: [
      ['new', 'Neue App für die Küche, aufgebaut auf der Salonplafond-Bar-App: Rezeptkarte mit Fotos, Suche, Kategorien und Saisons.'],
      ['new', 'Gericht-Formular für die Küche: Geschirr, Garmethode, Garzeit / Temperatur, Garnitur, Zutaten mit Mengen, Zubereitung und Preise mit Live-Marge.'],
      ['new', 'Allergene nach EU-14 per Klick wählbar; Filter für Vegetarisch, Vegan, Glutenfrei und Laktosefrei.'],
      ['new', 'Einkaufsliste / Inventur aus allen Zutaten der aktiven Saison, Multi-View-Vergleich von bis zu 6 Gerichten und A3-Druck der Speisekarte.'],
      ['new', 'Excel-Import und Export im neuen Küchenformat (Zutaten als „Zutat: Menge; Zutat: Menge“).'],
      ['new', 'Team-Chat, PIN-Login mit Rollen, Profile, Support-Tickets und Team-News.'],
      ['security', 'Die Filter Glutenfrei, Vegan und Laktosefrei richten sich nur noch nach den gesetzten Eigenschaften, nicht mehr nach dem Allergen-Text.']
    ] }
    ];

    const CHANGELOG_TYPES = {
      new:      { icon: '✨', label: 'Neu' },
      improved: { icon: '🔧', label: 'Verbessert' },
      fixed:    { icon: '🐞', label: 'Behoben' },
      security: { icon: '🔒', label: 'Sicherheit' },
      info:     { icon: '📌', label: 'Allgemein' }
    };
    const CHANGELOG_TYPE_ORDER = ['new', 'improved', 'fixed', 'security', 'info'];

    let changelogTab = 'current';
    let changelogFilter = 'all';
    let changelogQuery = '';
    let changelogNews = [];

    function versionLabel(e) {
      return e.range ? e.range : 'v' + e.version;
    }

    function applyVersionLabels() {
      document.title = 'Salonplafond KÜCHE v' + APP_VERSION;
      document.querySelectorAll('[data-app-version]').forEach(el => { el.textContent = 'v' + APP_VERSION; });
      const badge = document.getElementById('changelogVersionBadge');
      if (badge) badge.textContent = 'v' + APP_VERSION;
      if (CHANGELOG[0] && CHANGELOG[0].version !== APP_VERSION) {
        console.warn('Changelog: Der oberste Eintrag (' + CHANGELOG[0].version + ') passt nicht zu APP_VERSION (' + APP_VERSION + ').');
      }
    }

    function openChangelogModal() {
      closeSettingsMenu();
      changelogFilter = 'all';
      changelogQuery = '';
      const search = document.getElementById('clSearch');
      if (search) search.value = '';
      applyVersionLabels();
      renderChangelogCurrent();
      renderChangelogAll();
      setChangelogTab('current');
      loadChangelogNews();
      const modal = document.getElementById('changelogModal');
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }

    function closeChangelogModal() {
      const modal = document.getElementById('changelogModal');
      modal.classList.remove('flex');
      modal.classList.add('hidden');
    }

    function setChangelogTab(tab) {
      changelogTab = tab;
      ['current', 'all', 'news'].forEach(t => {
        const panel = document.getElementById('clPanel_' + t);
        const btn = document.getElementById('clTab_' + t);
        if (panel) panel.classList.toggle('hidden', t !== tab);
        if (btn) {
          btn.classList.toggle('active', t === tab);
          btn.setAttribute('aria-selected', t === tab ? 'true' : 'false');
        }
      });
      const body = document.getElementById('clBody');
      if (body) body.scrollTop = 0;
    }

    function changelogGroupsHtml(changes, onlyType) {
      let html = '';
      CHANGELOG_TYPE_ORDER.forEach(type => {
        if (onlyType && onlyType !== 'all' && onlyType !== type) return;
        const items = (changes || []).filter(c => c[0] === type);
        if (!items.length) return;
        const meta = CHANGELOG_TYPES[type];
        html += `
          <div class="cl-group">
            <div class="cl-group-head cl-t-${type}"><span>${meta.icon}</span> ${escapeHtml(meta.label)}</div>
            <ul class="cl-list">
              ${items.map(c => `<li>${escapeHtml(c[1])}</li>`).join('')}
            </ul>
          </div>`;
      });
      return html;
    }

    function renderChangelogCurrent() {
      const box = document.getElementById('clCurrentContent');
      if (!box || !CHANGELOG.length) return;
      const cur = CHANGELOG[0];
      const prev = CHANGELOG[1];
      box.innerHTML = `
        <div class="cl-hero">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="cl-ver">${escapeHtml(versionLabel(cur))}</span>
            <span class="cl-date">${escapeHtml(cur.date || '')}</span>
          </div>
          <h4 class="cl-title">${escapeHtml(cur.title || 'Neu in dieser Version')}</h4>
        </div>
        ${changelogGroupsHtml(cur.changes, 'all')}
        ${prev ? `<button type="button" onclick="setChangelogTab('all')" class="cl-link">📜 Frühere Versionen ansehen (zuletzt ${escapeHtml(versionLabel(prev))})</button>` : ''}
      `;
    }

    function changelogMatches(entry, change, q) {
      if (!q) return true;
      const hay = (versionLabel(entry) + ' ' + (entry.title || '') + ' ' + (entry.date || '') + ' ' + change[1]).toLowerCase();
      return hay.indexOf(q) !== -1;
    }

    function renderChangelogAll() {
      const list = document.getElementById('clAllList');
      const info = document.getElementById('clResultInfo');
      const countEl = document.getElementById('clAllCount');
      if (!list) return;
      const q = (changelogQuery || '').trim().toLowerCase();
      const f = changelogFilter;
      const filtering = !!q || f !== 'all';

      let shown = 0;
      let html = '';
      CHANGELOG.forEach((e, idx) => {
        const metaHit = q && (versionLabel(e) + ' ' + (e.title || '') + ' ' + (e.date || '')).toLowerCase().indexOf(q) !== -1;
        const changes = (e.changes || []).filter(c => (f === 'all' || c[0] === f) && (metaHit || changelogMatches(e, c, q)));
        if (!changes.length) return;
        shown++;
        const open = filtering || idx === 0;
        html += `
          <details class="cl-item" ${open ? 'open' : ''}>
            <summary>
              <span class="cl-ver">${escapeHtml(versionLabel(e))}</span>
              <span class="cl-sum-title">${escapeHtml(e.title || '')}</span>
              <span class="cl-date">${escapeHtml(e.date || '')}</span>
              <span class="cl-count">${changes.length}</span>
              <span class="cl-arrow">▸</span>
            </summary>
            <div class="cl-item-body">${changelogGroupsHtml(changes, 'all')}</div>
          </details>`;
      });

      list.innerHTML = html || `<p class="cl-empty">Keine Einträge gefunden. Versuche einen anderen Suchbegriff oder Filter.</p>`;
      if (info) info.textContent = filtering ? `${shown} von ${CHANGELOG.length} Versionen` : `${CHANGELOG.length} Versionen`;
      if (countEl) countEl.textContent = String(CHANGELOG.length);

      CHANGELOG_TYPE_ORDER.concat(['all']).forEach(t => {
        const chip = document.getElementById('clChip_' + t);
        if (chip) chip.classList.toggle('active', t === f);
      });
    }

    function setChangelogFilter(type) {
      changelogFilter = type;
      renderChangelogAll();
    }

    function onChangelogSearch(value) {
      changelogQuery = value || '';
      renderChangelogAll();
    }

    function toggleAllChangelogItems(open) {
      document.querySelectorAll('#clAllList details.cl-item').forEach(d => { d.open = !!open; });
    }

    async function loadChangelogNews() {
      const list = document.getElementById('clNewsList');
      const countEl = document.getElementById('clNewsCount');
      if (list) list.innerHTML = `<p class="cl-empty">Lade Team-News...</p>`;
      const { data, error } = await _supabase.from('support_tickets').select('*').eq('is_changelog', true).order('created_at', { ascending: false }).limit(50);
      if (error) {
        if (list) list.innerHTML = `<p class="cl-empty">Fehler beim Laden: ${escapeHtml(error.message)}</p>`;
        return;
      }
      changelogNews = data || [];
      if (countEl) countEl.textContent = String(changelogNews.length);
      renderChangelogNews();
    }

    function renderChangelogNews() {
      const list = document.getElementById('clNewsList');
      if (!list) return;
      if (!changelogNews.length) {
        list.innerHTML = `<p class="cl-empty">Noch keine Team-News veröffentlicht.</p>`;
        return;
      }
      list.innerHTML = changelogNews.map(item => {
        const dateStr = new Date(item.created_at).toLocaleDateString('de-AT');
        return `
          <div class="cl-news">
            <div class="cl-news-head">
              <span>${escapeHtml(item.author_email || 'Team')}</span>
              <span class="cl-date">${escapeHtml(dateStr)}</span>
            </div>
            <p class="cl-news-text">${escapeHtml(item.message)}</p>
          </div>`;
      }).join('');
    }

    async function submitNewChangelog() {
      checkManagerAuth(async () => {
        const textInput = document.getElementById('newChangelogText');
        const text = textInput.value.trim();
        if (!text) return alert("Bitte Neuigkeit eingeben.");

        const { error } = await _supabase.from('support_tickets').insert([{
          author_email: `${currentWaiterName} (${currentStaffRole || 'staff'})`,
          message: text,
          status: 'resolved',
          is_changelog: true,
          admin_comment: 'Veröffentlicht von ' + currentWaiterName
        }]);

        if (error) {
          alert("Fehler: " + error.message);
        } else {
          textInput.value = '';
          showAppToast({ initial: '📣', title: 'Neuigkeit veröffentlicht', text: 'Die Team-News ist jetzt für alle sichtbar.' });
          loadChangelogNews();
        }
      });
    }

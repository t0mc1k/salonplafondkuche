/* ============================================================
   js/menu-allergens.js  (v3.2.03)
   Speisekarte & Allergene (Quick Specs für den Service)
   - Speisekarte pro Saison: Gerichte mit Kategorie, Preis, Beschreibung, Allergenen A–R.
     Manager/Developer pflegen sie (auch per Einfügen aus Excel).
   - Getränke: Allergene stehen bei jedem Getränk als Text; hier schnell durchsuchbar.
   Tabellen: food_menus, food_items (siehe sql/3.2.03_betrieb.sql)
   ============================================================ */

    // Österreichische Allergen-Codes (EU-Verordnung 1169/2011)
    const AL_CODES = {
      A: 'Glutenhaltiges Getreide', B: 'Krebstiere', C: 'Eier', D: 'Fisch', E: 'Erdnüsse', F: 'Soja', G: 'Milch / Laktose',
      H: 'Schalenfrüchte (Nüsse)', L: 'Sellerie', M: 'Senf', N: 'Sesam', O: 'Sulfite', P: 'Lupinen', R: 'Weichtiere'
    };
    const AL_EN = {
      A: 'Cereals containing gluten', B: 'Crustaceans', C: 'Eggs', D: 'Fish', E: 'Peanuts', F: 'Soy', G: 'Milk / lactose',
      H: 'Tree nuts', L: 'Celery', M: 'Mustard', N: 'Sesame', O: 'Sulphites', P: 'Lupin', R: 'Molluscs'
    };
    const AL_DE = Object.assign({}, AL_CODES);
    // Namen der Allergene in der gewählten Sprache (Buchstaben A–R bleiben gleich)
    function alApplyLocale() { Object.assign(AL_CODES, (typeof currentLang !== 'undefined' && currentLang === 'en') ? AL_EN : AL_DE); }
    const AL_ORDER = Object.keys(AL_CODES);
    // Schlagwörter, mit denen Allergene in den Textangaben der Getränke erkannt werden
    const AL_DRINK_WORDS = {
      A: ['gluten', 'weizen', 'gerste', 'hafer', 'roggen', 'malz', 'bier'], B: ['krebs'], C: [' ei ', 'eier', 'eiweiß', 'eiweiss', 'egg'], D: ['fisch'],
      E: ['erdnuss', 'erdnüsse'], F: ['soja'], G: ['milch', 'laktose', 'lactose', 'sahne', 'rahm', 'obers', 'butter'],
      H: ['nuss', 'nüsse', 'mandel', 'haselnuss', 'walnuss', 'cashew', 'pistazie'], L: ['sellerie'], M: ['senf'], N: ['sesam'],
      O: ['sulfit', 'sulphit', 'schwefel'], P: ['lupine'], R: ['weichtier', 'muschel', 'schnecke']
    };

    let fa = { m: null, tab: 'food', menus: [], items: [], menuId: null, q: '', exclude: [], manage: false, dq: '' };

    async function openAllergenModal() {
      closeSettingsMenu();
      fa.tab = 'food'; fa.q = ''; fa.dq = ''; fa.exclude = []; fa.manage = false;
      fa.m = fmOpen('faModal', { title: '🍽️ Speisekarte & Allergene', sub: 'Schnell nachschauen, was drin ist. Allergene nach A–R (Österreich).', wide: true });
      fa.m.setBody('<p class="staff-empty">Lade ...</p>');
      await faLoad();
    }

    async function faLoad() {
      let mq = _supabase.from('food_menus').select('*').order('created_at', { ascending: true });
      if (!userIsAdmin) mq = mq.eq('is_active', true);
      const [mm, ii] = await Promise.all([
        mq,
        _supabase.from('food_items').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: true })
      ]);
      // Ohne SQL funktionieren zumindest die Getränke weiterhin
      fa.sqlError = (mm.error || ii.error) || null;
      fa.menus = mm.error ? [] : (mm.data || []);
      fa.items = ii.error ? [] : (ii.data || []);
      if (!fa.menus.find(x => x.id === fa.menuId)) fa.menuId = fa.menus.length ? fa.menus[0].id : null;
      faRender();
    }

    function faSetTab(t) { fa.tab = t; fa.manage = false; faRender(); }
    function faToggleLetter(c) {
      const i = fa.exclude.indexOf(c);
      if (i === -1) fa.exclude.push(c); else fa.exclude.splice(i, 1);
      faRender(true);
    }
    function faSearch(v) { if (fa.tab === 'food') fa.q = v.trim().toLowerCase(); else fa.dq = v.trim().toLowerCase(); faRender(true); }
    function faSetMenu(id) { fa.menuId = id; faRender(); }

    function faLetterBadges(codes) {
      return (codes || []).map(c => `<span class="al-letter" title="${escapeHtml(AL_CODES[c] || '')}">${escapeHtml(c)}</span>`).join(' ');
    }

    function faFilterHtml() {
      return `<div class="al-filter">${AL_ORDER.map(c =>
        `<button type="button" class="${fa.exclude.indexOf(c) !== -1 ? 'on' : ''}" title="${escapeHtml(AL_CODES[c])}" onclick="faToggleLetter('${c}')">${c}</button>`).join('')}</div>
        <p class="fm-hint" style="margin-top:.3rem">${fa.exclude.length ? 'Ausgeblendet werden Einträge mit: ' + fa.exclude.map(c => c + ' (' + AL_CODES[c] + ')').join(', ') : 'Tippe auf Buchstaben, um Einträge mit diesem Allergen auszublenden (für Gäste mit Unverträglichkeit).'}</p>`;
    }

    // keepFocus: Suchfeld beim Tippen nicht neu aufbauen
    function faRender(keepSearch) {
      const isAdmin = !!userIsAdmin;
      const tabs = `<div class="fm-tabs">
          <button type="button" class="fm-tab${fa.tab === 'food' ? ' active' : ''}" onclick="faSetTab('food')">🍽️ Speisekarte</button>
          <button type="button" class="fm-tab${fa.tab === 'drinks' ? ' active' : ''}" onclick="faSetTab('drinks')">🍸 Getränke</button>
          <button type="button" class="fm-tab" onclick="faShowLegend()">ℹ️ A–R</button>
        </div>`;
      const searchVal = fa.tab === 'food' ? fa.q : fa.dq;
      if (!keepSearch || !document.getElementById('faSearch')) {
        fa.m.setToolbar(`${tabs}
          <input type="search" id="faSearch" class="ui-search" placeholder="🔍 ${fa.tab === 'food' ? 'Gericht suchen ...' : 'Getränk suchen ...'}" value="${escapeHtml(searchVal)}" oninput="faSearch(this.value)">
          <div id="faFilterBox">${faFilterHtml()}</div>`);
      } else {
        const box = document.getElementById('faFilterBox');
        if (box) { box.innerHTML = faFilterHtml(); trDom(box); }
      }
      fa.m.setBody(fa.tab === 'food' ? faFoodHtml() : faDrinksHtml());
      fa.m.setFoot(`${isAdmin && fa.tab === 'food' && !fa.manage ? '<button type="button" class="ui-btn-ghost" onclick="faSetManage(true)">✏️ Karte bearbeiten</button>' : ''}
        <button type="button" class="ui-btn-primary" onclick="fmClose('faModal')">Fertig</button>`);
    }

    function faShowLegend() {
      const m = fmOpen('faLegend', { title: 'Allergene A–R', layer: 2 });
      m.setBody(`<div class="fm-stack">${AL_ORDER.map(c => `<div class="fm-row-flex"><span class="al-letter">${c}</span><span style="font-size:.85rem;color:var(--ui-text)">${escapeHtml(AL_CODES[c])}</span></div>`).join('')}</div>`);
      m.setFoot('<button type="button" class="ui-btn-primary" onclick="fmClose(\'faLegend\')">Schließen</button>');
    }

    // ---------- Speisekarte ----------
    function faFoodHtml() {
      if (fa.sqlError) return fmErrorHtml(fa.sqlError);
      let html = '';
      if (fa.menus.length > 1 || (userIsAdmin && fa.menus.length)) {
        html += `<div class="fm-tabs" style="margin-bottom:.8rem">${fa.menus.map(mn =>
          `<button type="button" class="fm-tab${mn.id === fa.menuId ? ' active' : ''}" onclick="faSetMenu(${jsArg(mn.id)})">${escapeHtml(mn.name)}${mn.is_active ? '' : ' (inaktiv)'}</button>`).join('')}</div>`;
      }
      if (fa.manage) html += faManageBarHtml();

      if (!fa.menus.length) {
        return html + `<p class="staff-empty">Es gibt noch keine Speisekarte.${userIsAdmin ? '' : ' Der Manager legt sie an.'}</p>` +
          (userIsAdmin ? '<div style="text-align:center"><button type="button" class="ui-btn-primary" onclick="faNewMenu()">➕ Erste Speisekarte anlegen</button></div>' : '');
      }
      const items = fa.items.filter(i => i.menu_id === fa.menuId);
      const shown = items.filter(i => {
        if (!fa.manage && fa.q && (i.name + ' ' + (i.description || '') + ' ' + i.category).toLowerCase().indexOf(fa.q) === -1) return false;
        if (fa.q && fa.manage && (i.name + ' ' + i.category).toLowerCase().indexOf(fa.q) === -1) return false;
        if (fa.exclude.some(c => (i.allergens || []).indexOf(c) !== -1)) return false;
        return true;
      });
      if (!items.length) return html + '<p class="staff-empty">Diese Karte hat noch keine Gerichte.</p>';
      if (!shown.length) return html + '<p class="staff-empty">Nichts gefunden (Suche oder Allergen-Filter).</p>';

      const cats = [];
      shown.forEach(i => { if (cats.indexOf(i.category) === -1) cats.push(i.category); });
      cats.forEach(cat => {
        html += `<div class="fm-sec-title"><span>${escapeHtml(cat)}</span></div>`;
        html += shown.filter(i => i.category === cat).map(i => `
          <div class="fm-item" style="${i.available ? '' : 'opacity:.5'}">
            <div class="fm-item-main">
              <div class="fm-row-flex" style="justify-content:space-between;flex-wrap:nowrap">
                <div class="fm-item-title">${escapeHtml(i.name)}${i.available ? '' : ' <span class="fm-chip fm-chip-red">nicht verfügbar</span>'}</div>
                ${i.price != null ? `<b style="font-size:.82rem;color:var(--ui-text);white-space:nowrap">€ ${Number(i.price).toFixed(2).replace('.', ',')}</b>` : ''}
              </div>
              ${i.description ? `<div class="fm-item-sub">${escapeHtml(i.description)}</div>` : ''}
              <div style="margin-top:.35rem">${(i.allergens || []).length ? faLetterBadges(i.allergens) : '<span class="fm-hint">keine Allergene angegeben</span>'}</div>
              ${fa.manage ? `<div class="fm-item-actions">
                <button type="button" class="fm-btn" onclick="faEditItem(${jsArg(i.id)})">✎ Bearbeiten</button>
                <button type="button" class="fm-btn" onclick="faToggleAvail(${jsArg(i.id)}, ${!i.available})">${i.available ? '⏸ Nicht verfügbar' : '▶ Verfügbar'}</button>
                <button type="button" class="fm-btn fm-btn-danger" onclick="faDeleteItem(${jsArg(i.id)})">🗑</button></div>` : ''}
            </div>
          </div>`).join('');
      });
      return html;
    }

    // ---------- Drinks ----------
    function faDrinkLetters(text) {
      // „glutenfrei“, „laktosefrei“, „ohne Nüsse“ enthalten das Allergen NICHT
      const t = ' ' + String(text || '').toLowerCase().replace(/\S*(frei|free)\b/g, ' ').replace(/ohne\s+\S+/g, ' ') + ' ';
      return AL_ORDER.filter(c => AL_DRINK_WORDS[c].some(w => t.indexOf(w) !== -1));
    }

    function faDrinksHtml() {
      const all = (typeof allDrinks !== 'undefined' ? allDrinks : []) || [];
      const list = all.filter(d => {
        if (fa.dq && (d.name + ' ' + (d.category || '')).toLowerCase().indexOf(fa.dq) === -1) return false;
        if (fa.exclude.length) {
          const letters = faDrinkLetters(d.allergens);
          if (fa.exclude.some(c => letters.indexOf(c) !== -1)) return false;
        }
        return true;
      }).sort((a, b) => String(a.name).localeCompare(String(b.name), 'de', { sensitivity: 'base' }));
      let html = `<p class="fm-hint" style="margin-bottom:.6rem">Bei Getränken stehen die Allergene als Text in der Datenbank. Der Filter sucht darin nach Stichwörtern. Bei Unsicherheit immer das Getränk selbst öffnen.</p>`;
      if (!list.length) return html + '<p class="staff-empty">Kein Getränk gefunden.</p>';
      html += list.slice(0, 250).map(d => {
        const letters = faDrinkLetters(d.allergens);
        return `<div class="fm-item">
          <div class="fm-item-main">
            <div class="fm-item-title">${escapeHtml(d.name)} <span class="fm-hint">· ${escapeHtml(d.category || '')}</span></div>
            <div class="fm-item-sub">${d.allergens ? '⚠️ ' + escapeHtml(d.allergens) : 'Keine Allergene eingetragen'}</div>
            ${letters.length ? `<div style="margin-top:.3rem">${faLetterBadges(letters)}</div>` : ''}
          </div></div>`;
      }).join('');
      if (list.length > 250) html += `<p class="fm-hint" style="text-align:center;margin-top:.6rem">Es werden die ersten 250 Treffer angezeigt. Bitte Suche eingrenzen.</p>`;
      return html;
    }

    // ---------- Verwaltung ----------
    function faSetManage(on) { fa.manage = !!on; faRender(); }

    function faManageBarHtml() {
      const mn = fa.menus.find(x => x.id === fa.menuId);
      return `<div class="form-section" style="margin-bottom:.8rem">
        <div class="form-section-title">Karte bearbeiten</div>
        <div class="fm-row-flex">
          <button type="button" class="fm-btn" onclick="faNewMenu()">➕ Neue Karte</button>
          ${mn ? `<button type="button" class="fm-btn" onclick="faRenameMenu()">✎ Umbenennen</button>
          <button type="button" class="fm-btn" onclick="faToggleMenuActive()">${mn.is_active ? '⏸ Für Personal ausblenden' : '▶ Für Personal anzeigen'}</button>
          <button type="button" class="fm-btn fm-btn-danger" onclick="faDeleteMenu()">🗑 Karte löschen</button>
          <button type="button" class="ui-btn-primary" onclick="faEditItem()">➕ Gericht</button>
          <button type="button" class="fm-btn" onclick="faOpenBulk()">📋 Aus Excel einfügen</button>` : ''}
          <button type="button" class="fm-btn" onclick="faSetManage(false)">✔ Fertig</button>
        </div></div>`;
    }

    async function faNewMenu() {
      const name = prompt('Name der Speisekarte (z. B. „Winter 2026“):', '');
      if (!name || !name.trim()) return;
      const { data, error } = await _supabase.from('food_menus').insert([{ name: name.trim(), is_active: true }]).select();
      if (error) return fmToast(fmDbError(error));
      fa.manage = true;
      if (data && data[0]) fa.menuId = data[0].id;
      await faLoad();
    }
    async function faRenameMenu() {
      const mn = fa.menus.find(x => x.id === fa.menuId); if (!mn) return;
      const name = prompt('Neuer Name:', mn.name);
      if (!name || !name.trim()) return;
      const { error } = await _supabase.from('food_menus').update({ name: name.trim() }).eq('id', mn.id);
      if (error) return fmToast(fmDbError(error));
      await faLoad();
    }
    async function faToggleMenuActive() {
      const mn = fa.menus.find(x => x.id === fa.menuId); if (!mn) return;
      const { error } = await _supabase.from('food_menus').update({ is_active: !mn.is_active }).eq('id', mn.id);
      if (error) return fmToast(fmDbError(error));
      await faLoad();
    }
    async function faDeleteMenu() {
      const mn = fa.menus.find(x => x.id === fa.menuId); if (!mn) return;
      const n = fa.items.filter(i => i.menu_id === mn.id).length;
      if (!confirm(fmL(`Speisekarte „${mn.name}“ mit ${n} Gericht(en) endgültig löschen?`, `Delete food menu “${mn.name}” with ${n} dish(es) permanently?`))) return;
      const { error } = await _supabase.from('food_menus').delete().eq('id', mn.id);
      if (error) return fmToast(fmDbError(error));
      fa.menuId = null;
      await faLoad();
    }

    let faEdit = { allergens: [] };

    function faEditItem(id) {
      const it = id ? fa.items.find(x => x.id === id) : null;
      faEdit.allergens = it ? (it.allergens || []).slice() : [];
      const cats = Array.from(new Set(fa.items.filter(i => i.menu_id === fa.menuId).map(i => i.category)));
      const m = fmOpen('faItem', { title: it ? 'Gericht bearbeiten' : 'Neues Gericht', layer: 2 });
      m.setBody(`<div class="fm-stack">
          <div class="fm-field"><label class="form-label" for="faiName">Name</label>
            <input type="text" id="faiName" class="ui-field" maxlength="120" value="${escapeHtml(it ? it.name : '')}"></div>
          <div class="fm-grid2">
            <div class="fm-field"><label class="form-label" for="faiCat">Kategorie</label>
              <input type="text" id="faiCat" class="ui-field" list="faiCats" maxlength="60" placeholder="z. B. Vorspeisen" value="${escapeHtml(it ? it.category : (cats[0] || ''))}">
              <datalist id="faiCats">${cats.map(c => `<option value="${escapeHtml(c)}">`).join('')}</datalist></div>
            <div class="fm-field"><label class="form-label" for="faiPrice">Preis € (optional)</label>
              <input type="number" id="faiPrice" class="ui-field" min="0" step="0.10" value="${it && it.price != null ? it.price : ''}"></div>
          </div>
          <div class="fm-field"><label class="form-label" for="faiDesc">Beschreibung (optional)</label>
            <textarea id="faiDesc" class="ui-field" rows="2" maxlength="300">${escapeHtml(it ? it.description || '' : '')}</textarea></div>
          <div class="fm-field"><label class="form-label">Allergene</label>
            <div class="al-filter pick" id="faiAl">${AL_ORDER.map(c => `<button type="button" class="${faEdit.allergens.indexOf(c) !== -1 ? 'on' : ''}" title="${escapeHtml(AL_CODES[c])}" onclick="faiToggle('${c}', this)">${c}</button>`).join('')}</div>
            <p class="fm-hint" id="faiAlText"></p></div>
        </div>`);
      m.setFoot(`<button type="button" class="ui-btn-ghost" onclick="fmClose('faItem')">Abbrechen</button>
        <button type="button" class="ui-btn-primary" onclick="faSaveItem(${jsArg(id || '')})">💾 Speichern</button>`);
      faiUpdateText();
    }
    function faiToggle(c, btn) {
      const i = faEdit.allergens.indexOf(c);
      if (i === -1) faEdit.allergens.push(c); else faEdit.allergens.splice(i, 1);
      btn.classList.toggle('on');
      faiUpdateText();
    }
    function faiUpdateText() {
      const el = document.getElementById('faiAlText');
      if (el) el.textContent = faEdit.allergens.length ? faEdit.allergens.slice().sort().map(c => c + ' = ' + AL_CODES[c]).join(' · ') : fmTr('Keine Allergene ausgewählt.');
    }

    async function faSaveItem(id) {
      const name = document.getElementById('faiName').value.trim();
      if (!name) return fmToast('Bitte einen Namen eingeben.');
      const priceRaw = document.getElementById('faiPrice').value;
      const payload = {
        name, category: document.getElementById('faiCat').value.trim() || 'Sonstiges',
        description: document.getElementById('faiDesc').value.trim() || null,
        price: priceRaw === '' ? null : Math.round(parseFloat(priceRaw) * 100) / 100,
        allergens: faEdit.allergens.slice().sort((a, b) => AL_ORDER.indexOf(a) - AL_ORDER.indexOf(b))
      };
      let res;
      if (id) res = await _supabase.from('food_items').update(payload).eq('id', id);
      else {
        const max = fa.items.filter(i => i.menu_id === fa.menuId).reduce((a, i) => Math.max(a, i.sort_order || 0), 0);
        res = await _supabase.from('food_items').insert([Object.assign({ menu_id: fa.menuId, sort_order: max + 1 }, payload)]);
      }
      if (res.error) return fmToast(fmDbError(res.error));
      fmClose('faItem');
      await faLoad();
    }
    async function faToggleAvail(id, avail) {
      const { error } = await _supabase.from('food_items').update({ available: avail }).eq('id', id);
      if (error) return fmToast(fmDbError(error));
      await faLoad();
    }
    async function faDeleteItem(id) {
      const it = fa.items.find(x => x.id === id); if (!it) return;
      if (!confirm(fmL(`Gericht „${it.name}“ löschen?`, `Delete dish “${it.name}”?`))) return;
      const { error } = await _supabase.from('food_items').delete().eq('id', id);
      if (error) return fmToast(fmDbError(error));
      await faLoad();
    }

    // ---------- Mehrere Gerichte aus Excel/Text einfügen ----------
    function faOpenBulk() {
      const m = fmOpen('faBulk', { title: '📋 Gerichte einfügen', sub: 'Eine Zeile pro Gericht, Spalten mit Tab (aus Excel kopiert) oder Strichpunkt.', layer: 2 });
      m.setBody(`<div class="fm-stack">
        <p class="fm-hint">Spalten: <b>Kategorie ; Name ; Preis ; Allergene ; Beschreibung</b> (Preis, Allergene, Beschreibung dürfen leer sein). Allergene als Buchstaben, z. B. <i>A,G,O</i> oder <i>AGO</i>.</p>
        <textarea id="faBulkText" class="ui-field" rows="9" placeholder="Vorspeisen;Kürbissuppe;7,90;G,L;mit Kernöl&#10;Hauptspeisen;Wiener Schnitzel;18,50;A,C,G"></textarea>
        <div id="faBulkPreview" class="fm-hint"></div></div>`);
      m.setFoot(`<button type="button" class="ui-btn-ghost" onclick="fmClose('faBulk')">Abbrechen</button>
        <button type="button" class="ui-btn-primary" onclick="faBulkSave()">Einfügen</button>`);
      document.getElementById('faBulkText').oninput = () => {
        const r = faParseBulk(document.getElementById('faBulkText').value);
        document.getElementById('faBulkPreview').textContent = fmTr(r.rows.length + ' Gericht(e) erkannt' + (r.errors.length ? ' · ' + r.errors.length + ' Zeile(n) mit Problem' : ''));
      };
    }

    function faParseBulk(text) {
      const rows = [], errors = [];
      String(text || '').split(/\r?\n/).forEach((line, idx) => {
        if (!line.trim()) return;
        const p = line.split(line.indexOf('\t') !== -1 ? '\t' : ';').map(x => x.trim());
        if (p.length < 2 || !p[1]) { errors.push(idx + 1); return; }
        const letters = String(p[3] || '').toUpperCase().replace(/[^A-Z]/g, '').split('').filter((c, i, a) => AL_CODES[c] && a.indexOf(c) === i);
        const price = p[2] ? parseFloat(String(p[2]).replace('€', '').replace(',', '.')) : null;
        rows.push({ category: p[0] || 'Sonstiges', name: p[1], price: (price != null && !isNaN(price)) ? Math.round(price * 100) / 100 : null,
          allergens: letters.sort((a, b) => AL_ORDER.indexOf(a) - AL_ORDER.indexOf(b)), description: p[4] || null });
      });
      return { rows, errors };
    }

    async function faBulkSave() {
      const r = faParseBulk(document.getElementById('faBulkText').value);
      if (!r.rows.length) return fmToast('Keine gültigen Zeilen gefunden.');
      let max = fa.items.filter(i => i.menu_id === fa.menuId).reduce((a, i) => Math.max(a, i.sort_order || 0), 0);
      const payload = r.rows.map(x => Object.assign({ menu_id: fa.menuId, sort_order: ++max }, x));
      const { error } = await _supabase.from('food_items').insert(payload);
      if (error) return fmToast(fmDbError(error));
      fmClose('faBulk');
      fmToast(r.rows.length + ' Gerichte eingefügt');
      await faLoad();
    }

    alApplyLocale();

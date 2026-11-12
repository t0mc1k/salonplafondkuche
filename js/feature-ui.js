/* ============================================================
   js/feature-ui.js  (v3.2.03)
   Gemeinsame Hilfen für die neuen Betriebs-Module
   (Checklisten, Schichttausch, Stunden, Speisekarte, Störungen,
   Fundsachen, Verluste): Fenster, Datum/Zeit, Foto-Upload, Fehlertexte.
   ============================================================ */

    // Wochentage und Monate in der gewählten Sprache (Arrays werden beim Sprachwechsel direkt umgeschrieben)
    const FM_DAYS_BY_LANG = { de: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'], en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] };
    const FM_MONTHS_BY_LANG = {
      de: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
      en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    };
    const FM_DAYS = FM_DAYS_BY_LANG.de.slice();
    const FM_MONTHS = FM_MONTHS_BY_LANG.de.slice();

    function fmApplyLocale() {
      const lang = (typeof currentLang !== 'undefined' && currentLang === 'en') ? 'en' : 'de';
      FM_DAYS.splice(0, 7, ...FM_DAYS_BY_LANG[lang]);
      FM_MONTHS.splice(0, 12, ...FM_MONTHS_BY_LANG[lang]);
      if (typeof alApplyLocale === 'function') alApplyLocale();
    }
    // Zwei Texte nebeneinander (für Meldungen mit Namen/Zahlen): Deutsch zuerst, Englisch danach
    function fmL(de, en) { return (typeof currentLang !== 'undefined' && currentLang === 'en') ? en : de; }
    function fmTr(s) { return typeof trText === 'function' ? trText(s) : s; }

    // Fenster öffnen. layer 2 = liegt über einem anderen Fenster (z. B. Formular).
    function fmOpen(id, opts) {
      opts = opts || {};
      fmClose(id);
      const root = document.createElement('div');
      root.id = id;
      root.className = 'fm-root modal-bg backdrop-blur-sm';
      root.style.zIndex = opts.layer === 2 ? '345' : '335';
      root.innerHTML = `
        <div class="card fm-card${opts.wide ? ' fm-wide' : ''} border-amber-500/50 shadow-2xl">
          <div class="ui-head !items-center">
            <div class="min-w-0">
              <h3 class="ui-head-title">${escapeHtml(fmTr(opts.title || ''))}</h3>
              ${opts.sub ? `<p class="ui-head-sub">${escapeHtml(fmTr(opts.sub))}</p>` : ''}
            </div>
            <button type="button" class="ui-close" aria-label="${escapeHtml(fmTr('Schließen'))}" data-fm-close>&times;</button>
          </div>
          <div class="fm-toolbar ui-toolbar hidden"></div>
          <div class="fm-body"></div>
          <div class="fm-foot ui-foot hidden"></div>
        </div>`;
      document.body.appendChild(root);
      document.body.classList.add('fm-open');
      const api = {
        id, root,
        body: root.querySelector('.fm-body'),
        toolbar: root.querySelector('.fm-toolbar'),
        foot: root.querySelector('.fm-foot'),
        setBody(html) { api.body.innerHTML = html; if (typeof trDom === 'function') trDom(api.body); },
        setToolbar(html) { api.toolbar.innerHTML = html; api.toolbar.classList.toggle('hidden', !html); if (typeof trDom === 'function') trDom(api.toolbar); },
        setFoot(html) { api.foot.innerHTML = html; api.foot.classList.toggle('hidden', !html); if (typeof trDom === 'function') trDom(api.foot); },
        close() { fmClose(id); if (opts.onClose) opts.onClose(); }
      };
      root.querySelector('[data-fm-close]').onclick = () => api.close();
      return api;
    }

    function fmClose(id) {
      const el = document.getElementById(id);
      if (el) el.remove();
      if (!document.querySelector('.fm-root')) document.body.classList.remove('fm-open');
    }

    function fmToast(msg) {
      const t = document.createElement('div');
      t.className = 'fm-toast';
      t.textContent = fmTr(msg);
      document.body.appendChild(t);
      setTimeout(() => t.classList.add('fm-toast-out'), 2200);
      setTimeout(() => t.remove(), 2700);
    }

    // Verständlicher Fehlertext (z. B. wenn das SQL noch nicht ausgeführt wurde)
    function fmDbError(err) {
      const msg = (err && err.message) ? fmTr(err.message) : String(err || fmL('Unbekannter Fehler', 'Unknown error'));
      const code = (err && err.code) ? String(err.code) : '';
      if (/does not exist|schema cache|could not find the (function|table)/i.test(msg) || code === '42P01' || code === '42883' || /^PGRST20/.test(code)) {
        return fmTr('Die Datenbank ist für diese Funktion noch nicht eingerichtet. Bitte zuerst sql/3.2.03_betrieb.sql im Supabase SQL Editor ausführen.');
      }
      return msg;
    }

    function fmErrorHtml(err) {
      return `<p class="staff-empty" style="color:#ef4444">${escapeHtml(fmDbError(err))}</p>`;
    }

    // ---------- Datum & Zeit ----------
    function fmIso(d) {
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
    // „Betriebstag“: bis 5 Uhr früh zählt noch der Vortag (Bar schließt nach Mitternacht)
    function fmBizDate() {
      return fmIso(new Date(Date.now() - 5 * 3600 * 1000));
    }
    function fmParseIso(iso) {
      const p = String(iso).split('-').map(Number);
      return new Date(p[0], p[1] - 1, p[2]);
    }
    function fmDayLabel(iso) {
      const d = fmParseIso(iso);
      return FM_DAYS[d.getDay()] + ' ' + String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.';
    }
    function fmTime(ts) {
      if (!ts) return '';
      return new Date(ts).toLocaleTimeString(langLocale(), { hour: '2-digit', minute: '2-digit' });
    }
    function fmDateTime(ts) {
      if (!ts) return '';
      const d = new Date(ts);
      return d.toLocaleDateString(langLocale(), { day: '2-digit', month: '2-digit' }) + ' ' + fmTime(ts);
    }
    function fmDaysAgo(ts) {
      return Math.max(0, Math.floor((Date.now() - new Date(ts).getTime()) / 86400000));
    }
    function fmDatetimeLocalValue(d) {
      return fmIso(d) + 'T' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    }

    // ---------- Foto-Upload (Bucket „drinks“, wie Chat & Getränke) ----------
    async function fmUploadPhoto(file, prefix) {
      if (!file || !/^image\//.test(file.type)) throw new Error(fmL('Bitte ein Bild auswählen.', 'Please choose an image.'));
      const prepared = (typeof compressImageFile === 'function') ? await compressImageFile(file) : file;
      const isJpeg = prepared !== file;
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const name = `${prefix}_${Date.now()}_${isJpeg ? safe.replace(/\.[^.]+$/, '') + '.jpg' : safe}`;
      const { error } = await _supabase.storage.from('drinks').upload(name, prepared, isJpeg ? { contentType: 'image/jpeg' } : undefined);
      if (error) throw error;
      const { data } = _supabase.storage.from('drinks').getPublicUrl(name);
      return data.publicUrl;
    }

    // Mitarbeitername-Vergleich: Der Arbeitsplan nutzt manchmal längere Namen als die Personalliste.
    function fmNameMatches(rowName, staffName) {
      const a = String(rowName || '').trim().toLowerCase();
      const b = String(staffName || '').trim().toLowerCase();
      if (!a || !b) return false;
      return a === b || a.indexOf(b) !== -1;
    }
    function fmIsMe(rowName) { return fmNameMatches(rowName, currentWaiterName); }

    function fmStatusChip(text, kind) {
      return `<span class="fm-chip fm-chip-${kind || 'gray'}">${escapeHtml(text)}</span>`;
    }

    fmApplyLocale();

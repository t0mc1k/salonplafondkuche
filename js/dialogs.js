/* ============================================================
   js/dialogs.js  (v4.1.07)
   Fenster per Klick auf den abgedunkelten Hintergrund schließen

   - Gilt für alle Fenster (neue „fm“-Fenster und die festen Fenster in index.html).
   - Schließt nur das oberste Fenster und nur, wenn Drücken UND Loslassen auf dem Hintergrund waren
     (Text markieren und dabei neben das Fenster fahren schließt nichts).
   - Schutz vor Datenverlust: Hast du in einem Fenster etwas in ein Textfeld getippt, schließt der Klick
     daneben NICHT (das Fenster wackelt kurz). Dann ✕ oder „Abbrechen“ benutzen.
   - Ein/Aus: Einstellungen → Darstellung → „Fenster per Klick daneben schließen“ (appSettings.closeOutside, Standard: an).
   - Einzelnes Fenster ausnehmen: Attribut data-no-outside-close am Hintergrund-Element.
   ============================================================ */

    // Fenster, bei denen der Name der Schließen-Funktion nicht „close“ + Fenster-ID ist
    const DLG_CLOSE_FN = { drinkModal: 'closeModal', tpCellModal: 'closeTeamPlanCell', staffPinManagementModal: 'closeStaffPinModal' };
    const DLG_TEXT_TYPES = /^(text|search|number|email|tel|url|password|date|time|datetime-local|month|week)$/i;

    (function dialogsInit() {
      let downBg = null;

      function isTextField(el) {
        if (!el || !el.tagName) return false;
        const tag = el.tagName.toUpperCase();
        if (tag === 'TEXTAREA') return true;
        if (tag === 'INPUT') return DLG_TEXT_TYPES.test(el.type || 'text');
        return !!el.isContentEditable;
      }

      // Getippt = „ungespeichert“; wird zurückgesetzt, sobald das Fenster geschlossen/versteckt wird
      document.addEventListener('input', e => {
        const bg = e.target && e.target.closest ? e.target.closest('.modal-bg') : null;
        if (!bg || !isTextField(e.target)) return;
        bg._dirty = true;
        if (!bg._dlgObs && window.MutationObserver) {
          bg._dlgObs = new MutationObserver(() => { if (bg.classList.contains('hidden') || !bg.isConnected) bg._dirty = false; });
          bg._dlgObs.observe(bg, { attributes: true, attributeFilter: ['class', 'style'] });
        }
      }, true);

      document.addEventListener('pointerdown', e => {
        const t = e.target;
        downBg = (t && t.classList && t.classList.contains('modal-bg')) ? t : null;
      }, true);

      document.addEventListener('click', e => {
        const bg = e.target;
        const started = downBg;
        downBg = null;
        if (!bg || bg !== started || !bg.classList || !bg.classList.contains('modal-bg')) return;
        if (typeof appSettings !== 'undefined' && appSettings && appSettings.closeOutside === false) return;
        if (bg.hasAttribute('data-no-outside-close') || bg.classList.contains('hidden')) return;
        if (bg._dirty) {
          const card = bg.firstElementChild;
          if (card) { card.classList.remove('dlg-shake'); void card.offsetWidth; card.classList.add('dlg-shake'); }
          return;
        }
        dialogCloseEl(bg);
      }, true);
    })();

    function dialogCloseEl(bg) {
      const fmBtn = bg.classList.contains('fm-root') ? bg.querySelector('[data-fm-close]') : null;
      if (fmBtn) { fmBtn.click(); return; }
      const id = bg.id || '';
      const name = DLG_CLOSE_FN[id] || (id ? 'close' + id.charAt(0).toUpperCase() + id.slice(1) : '');
      if (name && typeof window[name] === 'function') { window[name](); return; }
      const btn = bg.querySelector('.ui-close, [data-fm-close]');
      if (btn) btn.click();
    }

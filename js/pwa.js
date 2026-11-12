/* ============================================================
   js/pwa.js
   App installieren (Startbildschirm), Offline-Unterstützung (Service Worker)
   ============================================================ */
    let deferredInstallPrompt = null;

    function isStandaloneApp() {
      return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
    }

    function detectPlatform() {
      const ua = navigator.userAgent || '';
      const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const android = /Android/i.test(ua);
      const firefox = /Firefox|FxiOS/.test(ua);
      const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|Chrome|Android|OPR/.test(ua);
      return { iOS, android, firefox, safari, desktop: !iOS && !android };
    }

    function installInstructions() {
      const p = detectPlatform();
      if (p.iOS) {
        return {
          title: 'Auf dem iPhone / iPad',
          steps: [
            'Öffne diese Seite in <b>Safari</b> (bei anderen Browsern: Teilen-Menü nutzen).',
            'Tippe unten auf <b>Teilen</b> (das Quadrat mit dem Pfeil nach oben ⬆︎).',
            'Wähle <b>„Zum Home-Bildschirm“</b> und bestätige mit <b>„Hinzufügen“</b>.'
          ]
        };
      }
      if (p.android) {
        return {
          title: p.firefox ? 'Auf Android (Firefox)' : 'Auf Android (Chrome / Edge)',
          steps: [
            'Tippe im Browser auf das <b>Menü</b> (⋮ oder ☰).',
            p.firefox ? 'Wähle <b>„Installieren“</b> oder <b>„Zum Startbildschirm hinzufügen“</b>.'
                      : 'Wähle <b>„App installieren“</b> oder <b>„Zum Startbildschirm hinzufügen“</b>.',
            'Bestätige mit <b>„Installieren“</b>. Das Symbol erscheint auf deinem Startbildschirm.'
          ]
        };
      }
      return {
        title: 'Am Computer (Chrome / Edge)',
        steps: [
          'Klicke rechts in der Adressleiste auf das <b>Installieren-Symbol</b> (⊕ oder Monitor mit Pfeil).',
          'Alternativ: Browser-Menü ⋮ → <b>„Salonplafond BAR installieren“</b>.',
          'Safari (Mac): <b>Teilen → „Zum Dock hinzufügen“</b>.'
        ]
      };
    }

    function canOfferInstall() {
      if (isStandaloneApp()) return false;
      const p = detectPlatform();
      return !!deferredInstallPrompt || p.iOS || p.android;
    }

    function updateInstallUI() {
      const status = document.getElementById('installStatus');
      const btn = document.getElementById('installBtn');
      const steps = document.getElementById('installSteps');
      const menuBtn = document.getElementById('menuInstallBtn');
      const standalone = isStandaloneApp();

      if (status) {
        status.textContent = standalone
          ? '✅ Die App ist auf diesem Gerät installiert.'
          : (deferredInstallPrompt
            ? 'Du kannst die App mit einem Tipp auf dem Startbildschirm installieren.'
            : 'Mit einem Symbol auf dem Startbildschirm startet die App wie eine normale App ohne Browser-Leiste.');
      }
      if (btn) {
        btn.classList.toggle('hidden', standalone);
        btn.textContent = deferredInstallPrompt ? '📲 Jetzt installieren' : '📲 So geht’s';
      }
      if (steps) {
        const info = installInstructions();
        steps.innerHTML = standalone ? '' :
          `<div class="install-title">${escapeHtml(info.title)}</div><ol>${info.steps.map(s => `<li>${s}</li>`).join('')}</ol>`;
        steps.classList.toggle('hidden', standalone || !!deferredInstallPrompt);
      }
      if (menuBtn) menuBtn.classList.toggle('hidden', !canOfferInstall());
    }

    async function installApp() {
      if (deferredInstallPrompt) {
        const promptEvent = deferredInstallPrompt;
        deferredInstallPrompt = null;
        try {
          promptEvent.prompt();
          await promptEvent.userChoice;
        } catch (e) {}
        updateInstallUI();
        return;
      }
      const steps = document.getElementById('installSteps');
      if (steps) steps.classList.remove('hidden');
    }

    function openInstallSettings() {
      openUnifiedSettingsModal();
      updateInstallUI();
      const el = document.getElementById('setInstall');
      if (el && el.scrollIntoView) setTimeout(() => el.scrollIntoView({ block: 'start', behavior: 'smooth' }), 50);
    }

    // App neu laden und dabei alte Zwischenspeicher dieser App leeren (hilft bei „alter Ansicht“)
    async function reloadApp() {
      try {
        if (window.caches && caches.keys) {
          const keys = await caches.keys();
          await Promise.all(keys.filter(k => k.indexOf('salon-') === 0).map(k => caches.delete(k)));
        }
      } catch (e) {}
      location.reload();
    }

    function initPwa() {
      window.addEventListener('beforeinstallprompt', e => {
        e.preventDefault();
        deferredInstallPrompt = e;
        updateInstallUI();
      });
      window.addEventListener('appinstalled', () => {
        deferredInstallPrompt = null;
        updateInstallUI();
        showAppToast({ initial: '📲', title: 'App installiert', text: 'Du findest sie jetzt auf deinem Startbildschirm.' });
      });
      updateInstallUI();

      const secure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
      if (secure && 'serviceWorker' in navigator) {
        const hadController = !!navigator.serviceWorker.controller;
        navigator.serviceWorker.register('sw.js?v=' + encodeURIComponent(APP_VERSION)).catch(() => {});
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (hadController) showAppToast({ initial: '✨', title: 'App aktualisiert', text: 'Die neue Version ist aktiv.' });
        });
      }
    }

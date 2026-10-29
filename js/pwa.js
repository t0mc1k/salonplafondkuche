/* ============================================================
   js/pwa.js  –  App installieren (Startbildschirm / Desktop)
   - registriert den Service Worker (sw.js)
   - zeigt in den Einstellungen den Button "App installieren"
   - Android/Chrome/Edge: echter Installations-Dialog
   - iPhone/iPad (Safari): Anleitung "Zum Home-Bildschirm"
   ============================================================ */
(function () {
  'use strict';
  let deferredPrompt = null;

  const $ = (id) => document.getElementById(id);
  const isStandalone = () =>
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  const isIOS = () =>
    /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = () => /android/i.test(navigator.userAgent);
  const isFirefox = () => /firefox|fxios/i.test(navigator.userAgent);

  function helpText() {
    if (isIOS()) {
      return '<b>iPhone / iPad (Safari):</b><br>1. Unten auf <b>Teilen</b> (Quadrat mit Pfeil) tippen.<br>2. <b>„Zum Home-Bildschirm“</b> wählen.<br>3. Mit <b>„Hinzufügen“</b> bestätigen.<br><span class="opacity-80">In Chrome oder Edge am iPhone geht das nicht – bitte Safari benutzen.</span>';
    }
    if (isAndroid() && isFirefox()) {
      return '<b>Android (Firefox):</b><br>Menü <b>⋮</b> öffnen und <b>„Installieren“</b> bzw. <b>„Zum Startbildschirm hinzufügen“</b> wählen.';
    }
    if (isAndroid()) {
      return '<b>Android (Chrome / Edge):</b><br>Menü <b>⋮</b> (oder ☰) öffnen und <b>„App installieren“</b> bzw. <b>„Zum Startbildschirm hinzufügen“</b> wählen.';
    }
    return '<b>Computer (Chrome / Edge):</b><br>Rechts in der Adressleiste auf das Symbol <b>„Installieren“</b> klicken oder Browser-Menü → <b>„App installieren“</b>.<br><span class="opacity-80">Firefox am Computer unterstützt das nicht.</span>';
  }

  function render() {
    const status = $('pwaInstallStatus');
    const btn = $('pwaInstallBtn');
    const menuBtn = $('menuInstallBtn');
    if (!status || !btn) return;

    if (isStandalone()) {
      status.textContent = '✔ Die App ist installiert und läuft im App-Modus.';
      btn.classList.add('hidden');
      if (menuBtn) menuBtn.classList.add('hidden');
      const help = $('pwaInstallHelp'); if (help) help.classList.add('hidden');
      return;
    }
    btn.classList.remove('hidden');
    if (menuBtn) menuBtn.classList.remove('hidden');
    status.textContent = deferredPrompt
      ? 'Als App auf dem Startbildschirm ablegen – startet ohne Browserleiste.'
      : 'Als App auf dem Startbildschirm ablegen. Tippe auf „Installieren“ für die Anleitung.';
  }

  async function installApp() {
    if (isStandalone()) { render(); return; }
    if (deferredPrompt) {
      const p = deferredPrompt;
      deferredPrompt = null;
      p.prompt();
      try { await p.userChoice; } catch (e) {}
      render();
      return;
    }
    // Kein automatischer Dialog möglich (iOS, Firefox, bereits abgelehnt ...): Anleitung zeigen
    const help = $('pwaInstallHelp');
    if (help) {
      help.innerHTML = helpText();
      help.classList.remove('hidden');
    }
  }

  // Aus dem Menü: Einstellungen öffnen und zum Bereich "App" springen
  function openInstallFromMenu() {
    if (deferredPrompt && !isStandalone()) { installApp(); if (typeof closeSettingsMenu === 'function') closeSettingsMenu(); return; }
    if (typeof openUnifiedSettingsModal === 'function') openUnifiedSettingsModal();
    setTimeout(() => {
      const row = $('pwaInstallRow');
      if (row && row.scrollIntoView) row.scrollIntoView({ block: 'center', behavior: 'smooth' });
      installApp();
    }, 60);
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();          // eigenen Button statt Browser-Leiste benutzen
    deferredPrompt = e;
    render();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    render();
    if (typeof showAppToast === 'function') showAppToast({ initial: '📲', title: 'App installiert', text: 'Du findest sie jetzt auf deinem Startbildschirm.' });
  });

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch((err) => console.warn('Service Worker:', err));
    });
  }

  document.addEventListener('DOMContentLoaded', render);
  window.installApp = installApp;
  window.openInstallFromMenu = openInstallFromMenu;
  window.renderInstallUI = render;
})();

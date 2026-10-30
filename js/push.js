/* ============================================================
   js/push.js  –  Benachrichtigungen (System-Mitteilungen auf dem Handy)
   Zwei Stufen:
   1) Lokal  : Die App zeigt selbst Mitteilungen, solange sie läuft (auch im Hintergrund).
               Funktioniert sofort, braucht keinen Server.
   2) Push   : Echte Web-Push-Nachrichten, auch wenn die App geschlossen ist.
               Braucht VAPID_PUBLIC_KEY (config.js) und die Edge Function send-push
               (siehe README, sql/1.2.00_push.sql).
   ============================================================ */
(function () {
  'use strict';

  const FLAG = 'kueche_notify_on';
  const $ = (id) => document.getElementById(id);
  let pushActive = false;      // Gerät ist für echten Push angemeldet

  const supported = () => ('Notification' in window) && ('serviceWorker' in navigator);
  const pushPossible = () => supported() && ('PushManager' in window) && typeof VAPID_PUBLIC_KEY === 'string' && VAPID_PUBLIC_KEY.length > 20;
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = () => (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  const enabled = () => { try { return localStorage.getItem(FLAG) === '1'; } catch (e) { return false; } };
  const setEnabled = (on) => { try { localStorage.setItem(FLAG, on ? '1' : '0'); } catch (e) {} };

  function urlBase64ToUint8Array(b64) {
    const pad = '='.repeat((4 - (b64.length % 4)) % 4);
    const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(Array.from(raw).map((c) => c.charCodeAt(0)));
  }
  const b64 = (buf) => btoa(String.fromCharCode.apply(null, new Uint8Array(buf)));

  async function getReg() {
    if (!('serviceWorker' in navigator)) return null;
    try { return await navigator.serviceWorker.ready; } catch (e) { return null; }
  }

  // ---- System-Mitteilung aus der App heraus (Stufe 1) ----
  async function notify(opts) {
    if (!supported() || Notification.permission !== 'granted' || !enabled()) return false;
    const o = opts || {};
    const options = {
      body: o.body || '',
      tag: o.tag || 'kueche',
      renotify: true,
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      vibrate: [120, 60, 120],
      data: { url: o.url || './?view=handover' }
    };
    try {
      const reg = await getReg();
      if (reg && reg.showNotification) { await reg.showNotification(o.title || 'Salonplafond KÜCHE', options); return true; }
      new Notification(o.title || 'Salonplafond KÜCHE', options);
      return true;
    } catch (e) { return false; }
  }

  // ---- Push-Anmeldung (Stufe 2) ----
  async function subscribeAndSave() {
    if (!pushPossible()) return false;
    const reg = await getReg();
    if (!reg) return false;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) });
    }
    const json = sub.toJSON();
    const { error } = await _supabase.rpc('save_push_subscription', {
      p_endpoint: sub.endpoint,
      p_p256dh: (json.keys && json.keys.p256dh) || b64(sub.getKey('p256dh')),
      p_auth: (json.keys && json.keys.auth) || b64(sub.getKey('auth')),
      p_user_agent: navigator.userAgent.slice(0, 200)
    });
    pushActive = !error;
    if (error) console.warn('Push-Anmeldung fehlgeschlagen:', error.message);
    return pushActive;
  }

  async function removeSubscription(unsubscribeBrowser) {
    const reg = await getReg();
    if (!reg) { pushActive = false; return; }
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      try { await _supabase.rpc('delete_push_subscription', { p_endpoint: sub.endpoint }); } catch (e) {}
      if (unsubscribeBrowser) { try { await sub.unsubscribe(); } catch (e) {} }
    }
    pushActive = false;
  }

  // Nach dem Login: Gerät dem eingeloggten Koch zuordnen
  async function syncAfterLogin() {
    if (!supported() || !enabled() || Notification.permission !== 'granted') { render(); return; }
    try { await subscribeAndSave(); } catch (e) { console.warn(e); }
    render();
  }
  // Vor dem Abmelden: Gerät lösen, damit der nächste Koch nicht fremde Mitteilungen bekommt
  async function detachBeforeLogout() {
    try { await removeSubscription(false); } catch (e) {}
  }

  // ---- Einstellungen: Knopf + Statustext ----
  function render() {
    const status = $('pushStatus'), btn = $('pushBtn'), test = $('pushTestBtn');
    if (!status || !btn) return;
    test && test.classList.add('hidden');
    btn.classList.remove('hidden');
    btn.disabled = false;

    if (!supported()) {
      status.textContent = isIOS() && !isStandalone()
        ? 'Auf dem iPhone zuerst die App installieren (Teilen → Zum Home-Bildschirm), dann hier aktivieren.'
        : 'Dieser Browser unterstützt keine Benachrichtigungen.';
      btn.classList.add('hidden');
      return;
    }
    if (Notification.permission === 'denied') {
      status.textContent = 'Blockiert. Erlaube Benachrichtigungen in den Browser- bzw. Handy-Einstellungen für diese Seite.';
      btn.classList.add('hidden');
      return;
    }
    if (Notification.permission === 'granted' && enabled()) {
      status.textContent = pushActive
        ? '✔ Aktiv, auch wenn die App geschlossen ist (Push).'
        : '✔ Aktiv, solange die App geöffnet ist.' + (pushPossible() ? '' : ' (Für Push bei geschlossener App fehlt noch die Server-Einrichtung.)');
      btn.textContent = '🔕 Ausschalten';
      btn.dataset.mode = 'off';
      test && test.classList.remove('hidden');
      return;
    }
    status.textContent = 'Melde neue Aufgaben und Änderungen der Schichtübergabe als Mitteilung auf dem Handy.';
    btn.textContent = '🔔 Aktivieren';
    btn.dataset.mode = 'on';
  }

  async function toggle() {
    const btn = $('pushBtn');
    if (!btn) return;
    if (btn.dataset.mode === 'off') {
      setEnabled(false);
      try { await removeSubscription(true); } catch (e) {}
      render();
      return;
    }
    if (!supported()) return;
    btn.disabled = true;
    let perm = Notification.permission;
    if (perm === 'default') { try { perm = await Notification.requestPermission(); } catch (e) { perm = 'denied'; } }
    if (perm === 'granted') {
      setEnabled(true);
      try { await subscribeAndSave(); } catch (e) { console.warn(e); }
      if (typeof showAppToast === 'function') showAppToast({ initial: '🔔', title: 'Benachrichtigungen aktiv', text: pushActive ? 'Du bekommst Mitteilungen auch bei geschlossener App.' : 'Du bekommst Mitteilungen, solange die App geöffnet ist.' });
    }
    render();
  }

  async function sendTest() {
    const ok = await notify({ title: '📋 Neue Übergabe · Entre (Test)', body: 'Anna:\n• Schupfnudeln\n• Evtl. Maissuppe vak (frisch?)\n• Rindsjus (2 Liter)', tag: 'ho-test', url: './?view=handover' });
    if (!ok && typeof showAppToast === 'function') showAppToast({ initial: '⚠️', title: 'Test nicht möglich', text: 'Bitte Benachrichtigungen erst aktivieren.' });
  }

  // Klick auf eine Mitteilung, während die App schon offen ist (vom Service Worker)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (e) => {
      const d = e.data || {};
      if (d.type === 'open-handover' && typeof openHandoverModal === 'function') openHandoverModal('list');
      if (d.type === 'open' && d.view === 'chat' && typeof openTeamChatModal === 'function') openTeamChatModal();
      if (d.type === 'open' && d.view === 'handover' && typeof openHandoverModal === 'function') openHandoverModal('list');
    });
  }

  document.addEventListener('DOMContentLoaded', render);
  window.kuecheNotify = notify;
  window.kuechePushActive = () => pushActive;
  window.pushToggle = toggle;
  window.pushSendTest = sendTest;
  window.pushSyncAfterLogin = syncAfterLogin;
  window.pushDetachBeforeLogout = detachBeforeLogout;
  window.renderPushUI = render;
})();

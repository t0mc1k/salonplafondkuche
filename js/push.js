/* ============================================================
   js/push.js  (v4.1.00)
   Push-Benachrichtigungen (Web Push): auch bei geschlossener App (Android; iPhone nur als App auf dem Home-Bildschirm).
   - Gerät wird im Konto gespeichert (Funktionen push_save_subscription / push_remove_subscription).
   - Kategorien pro Person abschaltbar (push_get_prefs / push_set_prefs).
   - Beim Abmelden wird das Gerät von der Person getrennt, damit die nächste Person keine fremden Meldungen bekommt.
   Einrichtung: docs/SETUP-4.1.00.md. Der öffentliche VAPID-Schlüssel steht in der Datenbank (push_config.vapid_public_key, SQL 4.1.02).
   ============================================================ */

    // Der öffentliche Schlüssel steht in der Datenbank (Tabelle push_config, SQL 4.1.02) und wird beim Start geladen.
    // Hier nur eintragen, falls er NICHT in der Datenbank steht (Notlösung).
    let PUSH_VAPID_PUBLIC_KEY = 'BHRZZSHbxLAwuc51N64hccSgCKhEBPKNO8-rrqEN5Q7-udhoCr43LP-geiSkvqwS3stmNqm6uWuixw1ZFwphSPU';
    let pushKeyLoaded = false;

    const PUSH_CATS = [
      ['chat', '💬', 'push.cChat', 'push.cChatSub'],
      ['mention', '@', 'push.cMention', 'push.cMentionSub'],
      ['plan', '🗓️', 'push.cPlan', 'push.cPlanSub'],
      ['swap', '🔄', 'push.cSwap', 'push.cSwapSub'],
      ['news', '📣', 'push.cNews', 'push.cNewsSub'],
      ['absence', '🏖️', 'push.cAbsence', '']
    ];
    const PUSH_CATS_ADMIN = [
      ['mgr_swap', '✅', 'push.cMgrSwap', ''],
      ['mgr_absence', '🏖️', 'push.cMgrAbsence', ''],
      ['fault_urgent', '🚨', 'push.cFaultUrgent', ''],
      ['fault', '🛠️', 'push.cFault', ''],
      ['ticket', '🛟', 'push.cTicket', '']
    ];

    let pushPrefs = {};
    let pushState = 'unknown';
    // Wohin soll die App nach dem Antippen einer Meldung? (aus ?open=… oder von der Meldung)
    let pushPendingOpen = (function () {
      try {
        const v = new URLSearchParams(location.search).get('open') || '';
        if (v) history.replaceState(history.state, '', location.pathname + location.hash);
        return v;
      } catch (e) { return ''; }
    })();

    function pushIsIos() {
      return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    }
    function pushIsStandalone() {
      try { return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch (e) { return false; }
    }
    function pushSupported() {
      return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    }
    function pushB64ToU8(b64) {
      const pad = '='.repeat((4 - b64.length % 4) % 4);
      const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
      const out = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
      return out;
    }
    function pushWithTimeout(promise, ms, fallback) {
      return Promise.race([promise, new Promise(resolve => setTimeout(() => resolve(fallback), ms))]);
    }
    async function pushSwReady() {
      if (!('serviceWorker' in navigator)) return null;
      return pushWithTimeout(navigator.serviceWorker.ready, 4000, null);
    }
    async function pushGetSub() {
      const reg = await pushSwReady();
      return reg ? reg.pushManager.getSubscription() : null;
    }

    async function pushLoadKey(force) {
      if (pushKeyLoaded && !force) return PUSH_VAPID_PUBLIC_KEY;
      try {
        const { data, error } = await _supabase.rpc('push_get_public_key');
        if (!error && typeof data === 'string' && data.trim()) PUSH_VAPID_PUBLIC_KEY = data.trim();
      } catch (e) {}
      pushKeyLoaded = true;
      return PUSH_VAPID_PUBLIC_KEY;
    }

    async function pushComputeState() {
      if (!PUSH_VAPID_PUBLIC_KEY) await pushLoadKey();
      if (!PUSH_VAPID_PUBLIC_KEY) return 'unconfigured';
      if (!pushSupported()) return (pushIsIos() && !pushIsStandalone()) ? 'ios-install' : 'unsupported';
      if (Notification.permission === 'denied') return 'denied';
      if (Notification.permission === 'granted') return (await pushGetSub()) ? 'on' : 'off';
      return 'off';
    }

    async function pushSaveSub(sub) {
      const j = sub.toJSON();
      const { error } = await _supabase.rpc('push_save_subscription', {
        p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth,
        p_lang: currentLang, p_ua: navigator.userAgent.slice(0, 200)
      });
      if (error) throw new Error(fmDbError(error));
    }

    async function pushLoadPrefs() {
      try {
        const { data, error } = await _supabase.rpc('push_get_prefs');
        return (!error && data && typeof data === 'object') ? data : {};
      } catch (e) { return {}; }
    }

    async function pushRefresh() {
      pushState = await pushComputeState();
      pushRenderBanner();
      pushRenderSettings();
    }

    // ---------- Aktivieren / Ausschalten ----------
    async function pushEnable() {
      try {
        const perm = await Notification.requestPermission();   // muss direkt nach einem Tipp passieren (iPhone)
        if (perm !== 'granted') { fmToast(t('push.denied')); await pushRefresh(); return; }
        const reg = await pushSwReady();
        if (!reg) throw new Error('Service Worker');
        let sub = await reg.pushManager.getSubscription();
        if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: pushB64ToU8(PUSH_VAPID_PUBLIC_KEY) });
        await pushSaveSub(sub);
        pushPrefs = await pushLoadPrefs();
        fmToast(t('push.enabled'));
      } catch (e) {
        fmToast(t('push.error', { msg: (e && e.message) || e }));
      }
      await pushRefresh();
    }

    async function pushDisable() {
      try {
        const sub = await pushGetSub();
        if (sub) {
          try { await _supabase.rpc('push_remove_subscription', { p_endpoint: sub.endpoint }); } catch (e) {}
          await sub.unsubscribe();
        }
        fmToast(t('push.disabled'));
      } catch (e) {
        fmToast(t('push.error', { msg: (e && e.message) || e }));
      }
      await pushRefresh();
    }

    async function pushSendTest() {
      const { error } = await _supabase.rpc('push_send_test');
      fmToast(error ? fmDbError(error) : t('push.testSent'));
    }

    async function pushTogglePref(key, on) {
      pushPrefs = Object.assign({}, pushPrefs);
      pushPrefs[key] = !!on;
      const { error } = await _supabase.rpc('push_set_prefs', { p_prefs: pushPrefs });
      if (error) fmToast(fmDbError(error));
    }

    // ---------- Anmeldung / Abmeldung ----------
    async function pushOnLogin() {
      try {
        await pushLoadKey(true);
        pushPrefs = await pushLoadPrefs();
        if (PUSH_VAPID_PUBLIC_KEY && pushSupported() && Notification.permission === 'granted') {
          const reg = await pushSwReady();
          if (reg) {
            let sub = await reg.pushManager.getSubscription();
            if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: pushB64ToU8(PUSH_VAPID_PUBLIC_KEY) });
            await pushSaveSub(sub);   // Gerät dieser Person zuordnen (auch wenn vorher jemand anderes angemeldet war)
          }
        }
      } catch (e) {}
      await pushRefresh();
      pushHandlePendingOpen();
    }

    async function pushOnLogout() {
      try {
        const sub = await pushWithTimeout(pushGetSub(), 1200, null);
        if (sub) await pushWithTimeout(_supabase.rpc('push_remove_subscription', { p_endpoint: sub.endpoint }), 1500, null);
      } catch (e) {}
    }

    async function pushOnLanguageChange() {
      try { if (pushState === 'on') { const sub = await pushGetSub(); if (sub) await pushSaveSub(sub); } } catch (e) {}
    }

    // ---------- Meldung angetippt -> richtiges Fenster öffnen ----------
    function pushOpenTarget(target) {
      const map = { chat: 'openTeamChatModal', swaps: 'openSwapModal', absence: 'openAbsenceModal', myplan: 'openMyPlanModal', faults: 'openMaintenanceModal', tickets: 'openSupportModal', news: 'openChangelogModal' };
      const fn = window[map[target]];
      if (typeof fn === 'function') fn();
    }
    function pushHandlePendingOpen() {
      if (!pushPendingOpen || !currentWaiterName) return;
      const target = pushPendingOpen;
      pushPendingOpen = '';
      setTimeout(() => pushOpenTarget(target), 400);
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', e => {
        if (!e.data || e.data.type !== 'open') return;
        if (currentWaiterName) pushOpenTarget(e.data.target); else pushPendingOpen = e.data.target || '';
      });
    }

    // ---------- Hinweis-Karte auf dem Dashboard ----------
    function pushDismissKey() { return 'nexus_push_later_' + String(currentWaiterName || '').toLowerCase(); }
    function pushBannerDismissed() {
      try { return Date.now() - Number(localStorage.getItem(pushDismissKey()) || 0) < 7 * 86400000; } catch (e) { return false; }
    }
    function pushDismissBanner() {
      try { localStorage.setItem(pushDismissKey(), String(Date.now())); } catch (e) {}
      pushRenderBanner();
    }
    function pushRenderBanner() {
      const el = document.getElementById('dashPushBanner');
      if (!el) return;
      if (!currentWaiterName || pushBannerDismissed() || (pushState !== 'off' && pushState !== 'ios-install')) { el.innerHTML = ''; return; }
      if (pushState === 'ios-install') {
        el.innerHTML = `<div class="dash-push"><b>${escapeHtml(t('push.bIosTitle'))}</b><p>${escapeHtml(t('push.bIosText'))}</p>
          <div class="dash-push-actions"><button type="button" class="fm-btn" onclick="pushDismissBanner()">${escapeHtml(t('push.bLater'))}</button></div></div>`;
        return;
      }
      el.innerHTML = `<div class="dash-push"><b>${escapeHtml(t('push.bTitle'))}</b><p>${escapeHtml(t('push.bText'))}</p>
        <div class="dash-push-actions"><button type="button" class="ui-btn-primary" onclick="pushEnable()">${escapeHtml(t('push.bEnable'))}</button>
        <button type="button" class="fm-btn" onclick="pushDismissBanner()">${escapeHtml(t('push.bLater'))}</button></div></div>`;
    }

    // ---------- Bereich in den Einstellungen ----------
    function pushSwitchRow(key, icon, labelKey, subKey) {
      const on = pushPrefs[key] !== false;
      return `<div class="set-row"><div class="set-text"><b>${icon} ${escapeHtml(t(labelKey).replace(/^\S+\s/, ''))}</b>${subKey ? `<small>${escapeHtml(t(subKey))}</small>` : ''}</div>
        <label class="switch"><input type="checkbox" ${on ? 'checked' : ''} onchange="pushTogglePref(${jsArg(key)}, this.checked)"><span class="switch-track"></span></label></div>`;
    }
    function pushRenderSettings() {
      const el = document.getElementById('pushSettings');
      if (!el) return;
      const msg = { unconfigured: 'push.stUnconfigured', unsupported: 'push.stUnsupported', 'ios-install': 'push.stIos', denied: 'push.stDenied', off: 'push.stOff', unknown: 'push.stOff' }[pushState];
      let html = '';
      if (pushState === 'on') {
        html += `<p class="fm-hint" style="margin-bottom:.5rem">${escapeHtml(t('push.on'))}</p>`;
        html += `<div class="fm-sec-title" style="margin-top:.4rem"><span>${escapeHtml(t('push.what'))}</span></div>`;
        html += PUSH_CATS.map(c => pushSwitchRow(c[0], c[1], c[2], c[3])).join('');
        if (userIsAdmin) {
          html += `<div class="fm-sec-title"><span>${escapeHtml(t('push.mgrWhat'))}</span></div>`;
          html += PUSH_CATS_ADMIN.map(c => pushSwitchRow(c[0], c[1], c[2], c[3])).join('');
        }
        html += `<div class="fm-row-flex" style="margin-top:.6rem"><button type="button" class="fm-btn" onclick="pushSendTest()">${escapeHtml(t('push.test'))}</button>
          <button type="button" class="fm-btn fm-btn-danger" onclick="pushDisable()">${escapeHtml(t('push.disable'))}</button></div>`;
      } else {
        html += `<p class="fm-hint" style="margin-bottom:.5rem">${escapeHtml(t(msg))}</p>`;
        if (pushState === 'off') html += `<button type="button" class="ui-btn-primary" onclick="pushEnable()">${escapeHtml(t('push.enable'))}</button>`;
      }
      el.innerHTML = html;
    }

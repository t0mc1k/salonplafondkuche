/* ============================================================
   js/intro.js  (v4.1.03)
   Begrüßungsanimation nach dem Anmelden (ca. 3 Sekunden, mit Tippen überspringbar).
   - Nur nach einer echten Anmeldung, nicht beim Neuladen der Seite.
   - Ausschalten: Einstellungen -> Allgemein -> Begrüßungsanimation (gilt im Konto, auf jedem Gerät).
   - Respektiert „Animationen reduzieren“ und die Geräte-Einstellung „Bewegung reduzieren“ (dann kurz und ohne Bewegung).
   - Das Logo ist das bekannte „O“ der App, ergänzt um einen KI-Funken und Knotenpunkte.
   ============================================================ */

    let userIntroEnabled = true;
    let introTimer = null;

    function introLocalKey() { return 'nexus_intro_' + String(currentWaiterName || '').toLowerCase(); }
    function readLocalIntro() {
      try { return localStorage.getItem(introLocalKey()) !== 'off'; } catch (e) { return true; }
    }

    async function setIntroEnabled(on) {
      userIntroEnabled = !!on;
      try { localStorage.setItem(introLocalKey(), userIntroEnabled ? 'on' : 'off'); } catch (e) {}
      updateIntroUI();
      const { error } = await _supabase.rpc('set_my_intro', { p_on: userIntroEnabled });
      fmToast(error ? t('set.startDeviceOnly') : t('set.introSaved'));
    }

    function updateIntroUI() {
      const el = document.getElementById('setIntroToggle');
      if (el) el.checked = !!userIntroEnabled;
    }

    // Knoten und Linien des KI-Rings als SVG (6 Punkte auf einem Kreis, verbunden wie ein Netz)
    function introRingSvg() {
      const cx = 100, cy = 100, r = 84, pts = [];
      for (let i = 0; i < 6; i++) {
        const a = (-90 + i * 60) * Math.PI / 180;
        pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
      }
      let lines = '', nodes = '';
      for (let i = 0; i < 6; i++) {
        const p = pts[i], q = pts[(i + 1) % 6], z = pts[(i + 2) % 6];
        lines += `<path class="intro-line" pathLength="100" d="M${p[0].toFixed(1)} ${p[1].toFixed(1)} L${q[0].toFixed(1)} ${q[1].toFixed(1)}" style="animation-delay:${(0.75 + i * 0.07).toFixed(2)}s"/>`;
        lines += `<path class="intro-line intro-line-thin" pathLength="100" d="M${p[0].toFixed(1)} ${p[1].toFixed(1)} L${z[0].toFixed(1)} ${z[1].toFixed(1)}" style="animation-delay:${(1.0 + i * 0.07).toFixed(2)}s"/>`;
        nodes += `<circle class="intro-node" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="4.2" style="animation-delay:${(0.8 + i * 0.1).toFixed(2)}s"/>`;
      }
      return `<svg class="intro-ring" viewBox="0 0 200 200" aria-hidden="true">
        <defs><linearGradient id="introGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fbbf24"/><stop offset="1" stop-color="#a78bfa"/></linearGradient></defs>
        <circle class="intro-orbit" cx="100" cy="100" r="92" pathLength="100"/>${lines}${nodes}</svg>`;
    }

    function introParticles() {
      let html = '';
      for (let i = 0; i < 16; i++) {
        const x = Math.round(Math.random() * 100), y = Math.round(Math.random() * 100);
        const s = (2 + Math.random() * 3).toFixed(1), d = (Math.random() * 2).toFixed(2), du = (3 + Math.random() * 3).toFixed(1);
        html += `<i style="left:${x}%;top:${y}%;width:${s}px;height:${s}px;animation-delay:${d}s;animation-duration:${du}s"></i>`;
      }
      return html;
    }

    function introMaybePlay() {
      if (!userIntroEnabled) return;
      introPlay();
    }

    function introPlay() {
      if (document.getElementById('introOverlay')) return;
      let reduce = false;
      try { reduce = !!getSetting('reduceMotion') || window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
      const el = document.createElement('div');
      el.id = 'introOverlay';
      el.className = 'intro-overlay' + (reduce ? ' intro-static' : '');
      el.innerHTML = `
        <div class="intro-particles" aria-hidden="true">${introParticles()}</div>
        <div class="intro-center">
          <div class="intro-logo-wrap">
            ${introRingSvg()}
            <div class="intro-logo"><i class="intro-logo-bar"></i><b>O</b><u>•</u></div>
            <svg class="intro-spark" viewBox="0 0 40 40" aria-hidden="true"><path d="M20 1 L24.5 15.5 L39 20 L24.5 24.5 L20 39 L15.5 24.5 L1 20 L15.5 15.5 Z"/></svg>
          </div>
          <p class="intro-hello">${escapeHtml(t('intro.welcome', { name: currentWaiterName || '' }))}</p>
          <p class="intro-system">${escapeHtml(t('intro.system'))}</p>
          <h2 class="intro-title">Salonplafond NeXuS</h2>
          <p class="intro-sub">KÜCHE</p>
          <p class="intro-tag">powered by TomiAI ✨</p>
          <p class="intro-skip">${escapeHtml(t('intro.skip'))}</p>
        </div>`;
      document.body.appendChild(el);
      const finish = () => {
        if (introTimer) { clearTimeout(introTimer); introTimer = null; }
        document.removeEventListener('keydown', finish);
        el.classList.add('intro-out');
        setTimeout(() => el.remove(), 550);
      };
      el.addEventListener('click', finish);
      document.addEventListener('keydown', finish, { once: true });
      introTimer = setTimeout(finish, reduce ? 1400 : 3600);
    }

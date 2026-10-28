/* ============================================================
   js/ui.js
   Allgemeine Oberfläche: Menü, Hinweise (Toast), Vollbild, Foto-Vorschau, Motivations-Sprüche
   ============================================================ */
    function startLogoIconCycler() {
      setInterval(() => {
        const box = document.querySelector('.header-logo-container');
        if (!box || !currentWaiterName || getSetting('reduceMotion')) return;   // nur wenn jemand angemeldet ist
        if (box.querySelector('.logo-avatar')) return;    // läuft gerade schon

        const ov = document.createElement('div');
        ov.className = 'logo-avatar';
        if (currentWaiterAvatar) {
          const img = document.createElement('img');
          img.src = currentWaiterAvatar;
          img.alt = currentWaiterName;
          ov.appendChild(img);
        } else {
          ov.classList.add('logo-avatar-initial');
          ov.textContent = currentWaiterName.charAt(0).toUpperCase();
        }
        box.appendChild(ov);
        setTimeout(() => ov.remove(), 2800);
      }, 9000);
    }

    // ---------- Hinweise (Toast), kurz sichtbar und dann automatisch weg ----------
    function showAppToast(opts) {
      const o = opts || {};
      let host = document.getElementById('appToastHost');
      if (!host) {
        host = document.createElement('div');
        host.id = 'appToastHost';
        host.className = 'app-toast-host';
        document.body.appendChild(host);
      }
      const toast = document.createElement('div');
      toast.className = 'app-toast glass-surface';

      const av = document.createElement('div');
      av.className = 'app-toast-avatar';
      if (o.avatarUrl) {
        const img = document.createElement('img');
        img.src = o.avatarUrl;
        img.alt = '';
        av.appendChild(img);
      } else {
        av.textContent = o.initial || '🔔';
      }

      const body = document.createElement('div');
      body.className = 'app-toast-body';
      const title = document.createElement('div');
      title.className = 'app-toast-title';
      title.textContent = o.title || '';
      const text = document.createElement('div');
      text.className = 'app-toast-text';
      text.textContent = o.text || '';
      body.appendChild(title);
      if (o.text) body.appendChild(text);

      toast.appendChild(av);
      toast.appendChild(body);
      host.appendChild(toast);
      requestAnimationFrame(() => toast.classList.add('show'));

      const close = () => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 350);
      };
      toast.addEventListener('click', close);
      setTimeout(close, o.ms || 5000);
    }

    // ---------- Zeit als „vor 5 Min.“ ----------
    function formatRelativeTime(iso) {
      if (!iso) return 'noch nie';
      const t = new Date(iso).getTime();
      if (isNaN(t)) return 'unbekannt';
      const min = Math.floor(Math.max(0, Date.now() - t) / 60000);
      if (min < 1) return 'gerade eben';
      if (min < 60) return `vor ${min} Min.`;
      const h = Math.floor(min / 60);
      if (h < 24) return `vor ${h} Std.`;
      const d = Math.floor(h / 24);
      if (d === 1) return 'gestern';
      if (d < 7) return `vor ${d} Tagen`;
      return new Date(t).toLocaleDateString('de-AT');
    }

    function handleScrollPosition() {
      const scrollBtn = document.getElementById('scrollToTopBtn');
      if (window.scrollY > 300) {
        scrollBtn.classList.remove('hidden');
      } else {
        scrollBtn.classList.add('hidden');
      }
    }

    function scrollToTop() {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    const motivationalQuotes = [
      "„Heiß und fettig! Ruhe bitte, Chef spricht!“ 🤫",
      "„Keine Zeit!“ ⏱️",
      "„Anrichten, abschmecken, lächeln! Ihr macht das großartig!“ 🍽️✨",
      "„Kein Stress am Pass – die Teller schmecken besser mit Gelassenheit!“ 🔪",
      "„Ein perfekter Teller ist wie Kunst. Und ihr seid die Künstler heute Abend!“ 🎨👨‍🍳",
      "„Fokus, Teamwork und gute Mise en place – das Erfolgsrezept für jeden Service!“ 🔥",
      "„Egal wie viele Bons hängen: Ein Teller nach dem anderen. Du schaffst das!“ 💪",
      "„Weißt du, wer der beste Spüler im Salonplafond ist? Natürlich Tomas Kardos, der auch diese App für euch programmiert hat! Er grüßt euch und freut sich, dass ihr diese App nutzt!“ 🧽✨"
    ];

    function showRandomMotivation(event) {
      if (event) event.stopPropagation();
      const randomIndex = Math.floor(Math.random() * motivationalQuotes.length);
      document.getElementById('motivationTextContainer').innerText = motivationalQuotes[randomIndex];
      const modal = document.getElementById('motivationModal');
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }

    function closeMotivationModal() {
      const modal = document.getElementById('motivationModal');
      modal.classList.remove('flex');
      modal.classList.add('hidden');
    }

    function setQuickVal(fieldId, value) {
      document.getElementById(fieldId).value = value;
    }

    function toggleFilterDrawer() {
      const drawer = document.getElementById('filterDrawer');
      const arrow = document.getElementById('filterArrow');
      if (drawer.classList.contains('hidden')) {
        drawer.classList.remove('hidden');
        drawer.classList.add('flex');
        arrow.innerText = '▲';
      } else {
        drawer.classList.remove('flex');
        drawer.classList.add('hidden');
        arrow.innerText = '▼';
      }
    }

    function closeSettingsMenu() {
      const dropdown = document.getElementById('settingsDropdown');
      const backdrop = document.getElementById('settingsMenuBackdrop');
      if (dropdown) dropdown.classList.add('hidden');
      if (backdrop) backdrop.classList.add('hidden');
    }

    function toggleSettingsMenu(event) {
      event.stopPropagation();
      const dropdown = document.getElementById('settingsDropdown');
      const backdrop = document.getElementById('settingsMenuBackdrop');
      const willOpen = dropdown.classList.contains('hidden');
      dropdown.classList.toggle('hidden');
      if (backdrop) {
        if (willOpen) backdrop.classList.remove('hidden');
        else backdrop.classList.add('hidden');
      }
    }

    function closeDropdowns(event) {
      const dropdown = document.getElementById('settingsDropdown');
      if (!dropdown || dropdown.classList.contains('hidden')) return;
      if (dropdown.contains(event.target)) return;
      if (event.target.closest && event.target.closest('button[onclick*="toggleSettingsMenu"]')) return;
      closeSettingsMenu();
    }

    function toggleFullscreen() {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen();
      else if (document.exitFullscreen) document.exitFullscreen();
    }

    function openPhotoPreview(url) {
      currentPhotoPreviewUrl = url;
      document.getElementById('previewImageSrc').src = url;
      const modal = document.getElementById('photoPreviewModal');
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }

    function closePhotoPreview() {
      const modal = document.getElementById('photoPreviewModal');
      modal.classList.remove('flex');
      modal.classList.add('hidden');
    }

    function openPhotoPreviewFromModal() {
      if (currentPhotoPreviewUrl) {
        openPhotoPreview(currentPhotoPreviewUrl);
      }
    }

    // ---------- kurzer Signalton (ohne Audio-Datei) ----------
    function playChatSound() {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ac = new AC();
        const now = ac.currentTime;
        [880, 1175].forEach((f, i) => {
          const o = ac.createOscillator();
          const g = ac.createGain();
          o.type = 'sine';
          o.frequency.value = f;
          g.gain.setValueAtTime(0.0001, now + i * 0.11);
          g.gain.exponentialRampToValueAtTime(0.18, now + i * 0.11 + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.11 + 0.18);
          o.connect(g); g.connect(ac.destination);
          o.start(now + i * 0.11);
          o.stop(now + i * 0.11 + 0.2);
        });
        setTimeout(() => { try { ac.close(); } catch (e) {} }, 700);
      } catch (e) {}
    }

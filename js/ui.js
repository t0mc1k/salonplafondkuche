/* ============================================================
   js/ui.js
   Allgemeine Oberfläche: Menü, Einstellungen, Theme, Vollbild, Foto-Vorschau, Motivations-Sprüche
   ============================================================ */
    function startLogoIconCycler() {
      setInterval(() => {
        const charEl = document.getElementById('headerLogoChar');
        if (!charEl) return;
        if (charEl.innerText === 'O') {
          charEl.innerText = '🍸';
          setTimeout(() => {
            if (document.getElementById('headerLogoChar')) {
              document.getElementById('headerLogoChar').innerText = 'O';
            }
          }, 2500);
        }
      }, 9000);
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
      "„Frau gut? Ruhe bitte!“ 🤫",
      "„Keine Zeit!“ ⏱️",
      "„Shaken, einschenken, lächeln! Ihr macht das großartig!“ 🍸✨",
      "„Kein Stress hinter der Bar – die Drinks schmecken besser mit Gelassenheit!“ 🧊",
      "„Ein perfekter Drink ist wie Kunst. Und ihr seid die Künstler heute Abend!“ 🎨🍾",
      "„Fokus, Teamwork und ein guter Cocktail – das Erfolgsrezept für jeden Abend!“ 🔥",
      "„Egal wie lang die Schlange ist: Einen Drink nach dem anderen. Du schaffst das!“ 💪",
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

    function toggleThemeMode() {
      const body = document.body;
      if (themeMode === 'dark') {
        themeMode = 'light';
        body.classList.remove('dark-mode');
        body.classList.add('light-mode');
      } else {
        themeMode = 'dark';
        body.classList.remove('light-mode');
        body.classList.add('dark-mode');
      }
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

    function openUnifiedSettingsModal() {
      closeSettingsMenu();
      renderUnifiedSeasonSelect();
      updateUnifiedSettingsUI();
      const modal = document.getElementById('unifiedSettingsModal');
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }

    function closeUnifiedSettingsModal() {
      const modal = document.getElementById('unifiedSettingsModal');
      modal.classList.remove('flex');
      modal.classList.add('hidden');
    }

    function updateUnifiedSettingsUI() {
      const themeBtn = document.getElementById('unifiedThemeBtn');
      if (themeBtn) themeBtn.innerText = themeMode === 'dark' ? "Dunkel" : "Hell";

      const gridBtn = document.getElementById('unifiedViewGrid');
      const listBtn = document.getElementById('unifiedViewList');
      if (gridBtn && listBtn) {
        gridBtn.className = viewMode === 'grid' ? 'px-2.5 py-1 text-xs font-bold rounded bg-amber-500 text-slate-950' : 'px-2.5 py-1 text-xs font-bold rounded bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-300';
        listBtn.className = viewMode === 'list' ? 'px-2.5 py-1 text-xs font-bold rounded bg-amber-500 text-slate-950' : 'px-2.5 py-1 text-xs font-bold rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300';
      }
    }

    function renderUnifiedSeasonSelect() {
      const seasons = getAllSeasons();
      const select = document.getElementById('unifiedSeasonSelect');
      let html = '';
      seasons.forEach(s => {
        html += `<option value="${escapeHtml(s)}" ${currentSeasonFilter === s ? 'selected' : ''}>📅 ${escapeHtml(s)}</option>`;
      });
      select.innerHTML = html;
    }

    function onUnifiedSeasonChange(selectEl) {
      selectSeason(selectEl.value);
    }

    function setViewMode(mode) {
      viewMode = mode;
      updateUnifiedSettingsUI();
      renderDrinks();
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

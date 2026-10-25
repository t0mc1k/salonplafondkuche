/* ============================================================
   js/schedule.js
   Arbeitsplan
   ============================================================ */
    async function openWorkScheduleModal() {
      closeSettingsMenu();
      const container = document.getElementById('workScheduleContentContainer');
      container.innerHTML = `<p class="text-slate-500 italic text-xs text-center py-4">Lade Arbeitsplan für ${escapeHtml(currentWaiterName)}...</p>`;

      const modal = document.getElementById('workScheduleModal');
      modal.classList.remove('hidden');
      modal.classList.add('flex');

      // Testovacie dáta na základe nahraného rozpisu z obrázka (KW 44 2026)
      const mockScheduleData = {
        "Dennis": [
          { day: "Montag (26.10.)", time: "10:00 – 17:30 / 16:00 – 00:30", station: "S" },
          { day: "Dienstag (27.10.)", time: "Frei (X)", station: "S" },
          { day: "Mittwoch (28.10.)", time: "15:00 – 00:30", station: "S" },
          { day: "Donnerstag (29.10.)", time: "Frei (X)", station: "S" },
          { day: "Freitag (30.10.)", time: "11:30 – 15:30", station: "S" },
          { day: "Samstag (31.10.)", time: "10:00 – 17:30 / 16:00 – 22:00", station: "S" },
          { day: "Sonntag (1.11.)", time: "09:30 – 17:00", station: "S" }
        ],
        "Hossain": [
          { day: "Montag (26.10.)", time: "09:30 – 17:00", station: "BAR" },
          { day: "Dienstag (27.10.)", time: "Frei (X)", station: "BAR" },
          { day: "Mittwoch (28.10.)", time: "Frei (X)", station: "BAR" },
          { day: "Donnerstag (29.10.)", time: "09:30 – 17:00", station: "BAR" },
          { day: "Freitag (30.10.)", time: "11:30 – 15:30", station: "BAR" },
          { day: "Samstag (31.10.)", time: "17:00 – 00:30", station: "BAR" },
          { day: "Sonntag (1.11.)", time: "16:00 – 00:30", station: "BAR" }
        ],
        "Hannah": [
          { day: "Montag (26.10.)", time: "Frei (X)", station: "BAR" },
          { day: "Dienstag (27.10.)", time: "16:00 – 23:30", station: "BAR" },
          { day: "Mittwoch (28.10.)", time: "11:30 – 15:30", station: "BAR" },
          { day: "Donnerstag (29.10.)", time: "17:00 – 00:30", station: "BAR" },
          { day: "Freitag (30.10.)", time: "16:00 – 00:30", station: "BAR" },
          { day: "Samstag (31.10.)", time: "Frei (X)", station: "BAR" },
          { day: "Sonntag (1.11.)", time: "15:00 – 00:30", station: "BAR" }
        ]
      };

      let userSchedule = mockScheduleData[currentWaiterName] || [
        { day: "Montag (26.10.)", time: "09:30 – 17:00", station: "S" },
        { day: "Dienstag (27.10.)", time: "16:00 – 00:30", station: "S" },
        { day: "Mittwoch (28.10.)", time: "Frei (X)", station: "S" },
        { day: "Donnerstag (29.10.)", time: "11:30 – 22:00", station: "S" },
        { day: "Freitag (30.10.)", time: "09:30 – 17:00", station: "S" },
        { day: "Samstag (31.10.)", time: "10:00 – 18:00", station: "S" },
        { day: "Sonntag (1.11.)", time: "Frei (X)", station: "S" }
      ];

      container.innerHTML = `
        <div class="font-bold text-amber-600 dark:text-amber-400 mb-2 flex justify-between items-center">
          <span>📅 Plan für KW 44 / 2026 (Mitarbeiter: ${escapeHtml(currentWaiterName)})</span>
          <span class="text-[10px] uppercase px-2 py-0.5 rounded bg-amber-500/20">Test-Mode</span>
        </div>
        <div class="flex flex-col gap-2">
          ${userSchedule.map(s => `
            <div class="custom-box p-2.5 rounded-lg border flex items-center justify-between text-xs">
              <div>
                <span class="font-bold text-white">${escapeHtml(s.day)}</span>
                <span class="text-[10px] text-slate-400 block">Station: ${escapeHtml(s.station)}</span>
              </div>
              <span class="font-bold text-amber-500">${escapeHtml(s.time)}</span>
            </div>
          `).join('')}
        </div>
      `;
    }

    function closeWorkScheduleModal() {
      const modal = document.getElementById('workScheduleModal');
      modal.classList.remove('flex');
      modal.classList.add('hidden');
    }

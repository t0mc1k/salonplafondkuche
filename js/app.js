/* ============================================================
   js/app.js
   Programmstart (wird als Letztes geladen)
   ============================================================ */
    window.addEventListener("DOMContentLoaded", async () => {
      window.addEventListener('scroll', handleScrollPosition);
      applyAllSettings();
      initChatComposer();
      applyVersionLabels();
      startLogoIconCycler();
      await loadStaffPresenceRecordsForLogin();

      if (currentWaiterName && getStaffToken()) {
        const staffRec = staffDatabaseRecords.find(s => s.name.toLowerCase() === currentWaiterName.toLowerCase());
        if (staffRec) {
          await finalizeAppStartForStaff(staffRec);
          return;
        }
      }
      clearStaffSession();
      sessionStorage.removeItem('kueche_waiter_name');
      currentWaiterName = "";
      document.getElementById('authContainer').classList.remove('hidden');
    });

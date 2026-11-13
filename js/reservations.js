/* ============================================================
   js/reservations.js  (v4.2.02)
   Kachel „Reservierungen“: zeigt die Gastronaut-Daten aus der Tabelle
   gastronaut_sync (Zeile id = 1), Frühschicht, Abendschicht und Tag gesamt.
   Die Daten werden alle 30 Minuten von einem externen Skript aktualisiert,
   sie sind also nicht garantiert aktuell. Nur Lesen. Rechte: sql/4.2.02_gastronaut.sql
   ============================================================ */

    // suhrnne_hodnoty = z. B. ["FRÜHSCHICHT","Fertig","Abgesagt","46","135","16"]: die reinen Zahlen der Reihe nach.
    // ANNAHME: 1. Zahl = Reservierungen, 2. Zahl = Gäste. Falls anders, hier die Positionen (0 = erste Zahl) ändern.
    const RSV_IDX_COUNT = 0, RSV_IDX_GUESTS = 1;

    function rsvShiftStats(shift) {
      const nums = ((shift && Array.isArray(shift.suhrnne_hodnoty)) ? shift.suhrnne_hodnoty : [])
        .map(v => String(v).trim()).filter(v => /^\d+$/.test(v)).map(Number);
      return { count: nums[RSV_IDX_COUNT] || 0, persons: nums[RSV_IDX_GUESTS] || 0 };
    }

    // Zeile unter der Begrüßung neben dem Datum: „Gesamt: 237 · Früh: 135 · Abend: 102“ (nur Gästezahlen, höchstens alle 60 s laden)
    let rsvHeroAt = 0;
    async function rsvLoadHero() {
      const el = document.getElementById('dashRsv');
      if (!el || Date.now() - rsvHeroAt < 60000) return;
      rsvHeroAt = Date.now();
      try {
        const { data: row, error } = await _barSupabase.from('gastronaut_sync').select('data').eq('id', 1).single();
        if (error || !row || !row.data) { el.classList.add('hidden'); return; }
        const f = rsvShiftStats(row.data.fruhschicht).persons, a = rsvShiftStats(row.data.abendschicht).persons;
        el.textContent = '📒 ' + fmL('Gesamt', 'Total') + ': ' + (f + a) + ' · ' + fmL('Früh', 'Early') + ': ' + f + ' · ' + fmL('Abend', 'Evening') + ': ' + a;
        el.classList.remove('hidden');
      } catch (e) { el.classList.add('hidden'); }
    }

    async function openReservationsModal() {
      closeSettingsMenu();
      const m = fmOpen('rsvModal', {
        title: '📒 ' + fmL('Reservierungen', 'Reservations'),
        sub: fmL('Heute, aus Gastronaut', 'Today, from Gastronaut')
      });
      m.setBody('<p class="staff-empty">' + escapeHtml(fmL('Lade ...', 'Loading ...')) + '</p>');
      m.setFoot('<button type="button" class="ui-btn-primary" onclick="fmClose(\'rsvModal\')">' + escapeHtml(fmL('Fertig', 'Done')) + '</button>');

      const { data: row, error } = await _barSupabase.from('gastronaut_sync').select('data, updated_at').eq('id', 1).single();
      if (error) { m.setBody(fmErrorHtml(error)); return; }
      const d = (row && row.data) || {};
      const f = rsvShiftStats(d.fruhschicht), a = rsvShiftStats(d.abendschicht);
      const ts = row.updated_at || d.aktualisiert;
      const when = ts ? new Date(ts).toLocaleString(langLocale(), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '–';

      const box = (label, st) => `<div style="flex:1;min-width:90px;padding:10px;border-radius:12px;background:rgba(245,158,11,.12);text-align:center">
          <div style="font-size:12px;opacity:.8">${escapeHtml(label)}</div>
          <div style="font-size:22px;font-weight:800">${st.persons}</div>
          <div style="font-size:12px;opacity:.8">${st.count} ${escapeHtml(fmL('Res.', 'res.'))}</div></div>`;

      m.setBody(`
        <p class="ui-head-sub" style="margin:0 0 10px">⚠️ ${escapeHtml(fmL(
          'Die Daten werden alle 30 Minuten aktualisiert und sind nicht garantiert aktuell. Stand: ',
          'Data is refreshed every 30 minutes and may not be up to date. Last update: '))}<b>${escapeHtml(when)}</b></p>
        <div class="fm-row-flex" style="gap:8px;flex-wrap:wrap">
          ${box(fmL('Früh', 'Early'), f)}
          ${box(fmL('Abend', 'Evening'), a)}
          ${box(fmL('Gesamt', 'Total'), { persons: f.persons + a.persons, count: f.count + a.count })}
        </div>`);
    }

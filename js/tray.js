/* ============================================================
   js/tray.js
   Multi-View-Korb inkl. Drag & Drop und Getränk tauschen
   ============================================================ */
    function toggleBarTrayItem(id, event) {
      if (event) event.stopPropagation();
      let idx = barTraySelection.indexOf(id);
      if (idx > -1) {
        barTraySelection.splice(idx, 1);
      } else {
        if (barTraySelection.length >= 6) {
          alert('Für den Schnellvergleich können maximal 6 Getränke gleichzeitig ausgewählt werden.');
          return;
        }
        barTraySelection.push(id);
      }
      localStorage.setItem('salon_bar_tray', JSON.stringify(barTraySelection));
      renderBarTrayUI();
      renderDrinks();
    }

    function clearBarTray() {
      barTraySelection = [];
      localStorage.setItem('salon_bar_tray', JSON.stringify(barTraySelection));
      renderBarTrayUI();
      renderDrinks();
    }

    function renderBarTrayUI() {
      const bar = document.getElementById('barTrayBar');
      const container = document.getElementById('barTrayItems');
      const countBadge = document.getElementById('trayCountBadge');
      
      if (countBadge) countBadge.innerText = barTraySelection.length;

      if (barTraySelection.length === 0) {
        bar.classList.add('hidden');
        bar.classList.remove('flex');
        return;
      }

      bar.classList.remove('hidden');
      bar.classList.add('flex');

      container.innerHTML = barTraySelection.map(id => {
        let d = allDrinks.find(item => item.id === id);
        if (!d) return '';
        return `
          <div onclick="openDrinkModal(${jsArg(d.id)})" class="cursor-pointer custom-box border hover:border-amber-500 rounded-xl p-1.5 px-3 flex items-center gap-2 shrink-0 transition shadow-sm">
            <span class="text-xs font-bold text-amber-600 dark:text-amber-300 truncate max-w-[120px]">${escapeHtml(d.name)}</span>
            <button onclick="toggleBarTrayItem(${jsArg(d.id)}, event)" class="text-slate-400 hover:text-red-500 font-bold text-xs p-0.5">&times;</button>
          </div>
        `;
      }).join('');
    }


    // ===== Drag & Drop: Getränk in den Multi-View-Korb ziehen =====
    function showTrayToast(msg) {
      let t = document.getElementById('trayToast');
      if (!t) {
        t = document.createElement('div');
        t.id = 'trayToast';
        t.style.cssText = 'position:fixed;left:50%;bottom:6.5rem;transform:translateX(-50%);z-index:320;padding:.6rem 1rem;border-radius:.75rem;background:#0f172a;color:#fbbf24;border:1px solid rgba(245,158,11,.5);font-size:.75rem;font-weight:700;box-shadow:0 10px 25px rgba(0,0,0,.4);transition:opacity .25s;pointer-events:none;max-width:90vw;text-align:center';
        document.body.appendChild(t);
      }
      t.textContent = msg;
      t.style.opacity = '1';
      clearTimeout(t._hide);
      t._hide = setTimeout(() => { t.style.opacity = '0'; }, 1800);
    }

    function addBarTrayItem(id) {
      const d = allDrinks.find(x => x.id === id);
      if (!d) return;
      if (barTraySelection.includes(id)) {
        showTrayToast('„' + d.name + '“ ist schon im Multi-View');
        return;
      }
      if (barTraySelection.length >= 6) {
        alert('Für den Schnellvergleich können maximal 6 Getränke gleichzeitig ausgewählt werden.');
        return;
      }
      barTraySelection.push(id);
      localStorage.setItem('salon_bar_tray', JSON.stringify(barTraySelection));
      renderBarTrayUI();
      renderDrinks();
      showTrayToast('„' + d.name + '“ zum Multi-View hinzugefügt (' + barTraySelection.length + '/6)');
    }

    const trayDrag = { pending: false, active: false, id: null, srcEl: null, startX: 0, startY: 0, x: 0, y: 0, type: 'mouse', timer: null, ghost: null, zone: null };
    let traySuppressClickUntil = 0;

    function trayDropTargetAt(x, y) {
      const el = document.elementFromPoint(x, y);
      return el && el.closest ? el.closest('#trayDropZone, #barTrayBar') : null;
    }

    function trayDropZoneRefresh(hover) {
      const z = trayDrag.zone;
      if (!z) return;
      const full = barTraySelection.length >= 6 && !barTraySelection.includes(trayDrag.id);
      z.textContent = full
        ? '⚡ Multi-View ist voll (6/6)'
        : '⚡ Hier loslassen für Multi-View (' + barTraySelection.length + '/6)';
      z.style.background = hover ? (full ? '#ef4444' : '#f59e0b') : (full ? 'rgba(239,68,68,.18)' : 'rgba(245,158,11,.18)');
      z.style.color = hover ? '#020617' : (full ? '#f87171' : '#f59e0b');
      z.style.borderColor = full ? '#ef4444' : '#f59e0b';
      z.style.transform = hover ? 'translateX(-50%) scale(1.06)' : 'translateX(-50%)';
    }

    function startTrayDrag() {
      const d = allDrinks.find(x => x.id === trayDrag.id);
      if (!d) { cancelTrayDrag(); return; }
      trayDrag.pending = false;
      trayDrag.active = true;
      clearTimeout(trayDrag.timer);
      document.body.classList.add('tray-dragging');
      if (trayDrag.srcEl) trayDrag.srcEl.classList.add('tray-source-dragging');

      const g = document.createElement('div');
      g.style.cssText = 'position:fixed;left:0;top:0;z-index:330;pointer-events:none;display:flex;align-items:center;gap:.5rem;padding:.4rem .75rem;border-radius:.75rem;background:#0f172a;color:#fbbf24;border:2px solid #f59e0b;font-size:.8rem;font-weight:800;box-shadow:0 12px 30px rgba(0,0,0,.5);max-width:220px;transform:translate(-50%,-120%)';
      if (d.photo_url) {
        const img = document.createElement('img');
        img.src = d.photo_url;
        img.style.cssText = 'width:2rem;height:2rem;object-fit:cover;border-radius:.4rem;flex-shrink:0';
        g.appendChild(img);
      }
      const label = document.createElement('span');
      label.textContent = d.name;
      label.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
      g.appendChild(label);
      document.body.appendChild(g);
      trayDrag.ghost = g;

      const z = document.createElement('div');
      z.id = 'trayDropZone';
      const barVisible = !document.getElementById('barTrayBar').classList.contains('hidden');
      z.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:' + (barVisible ? '6rem' : '1.5rem') + ';z-index:310;padding:1rem 1.5rem;border-radius:1rem;border:2px dashed #f59e0b;font-weight:900;font-size:.85rem;text-align:center;backdrop-filter:blur(6px);transition:transform .12s,background .12s;white-space:nowrap';
      document.body.appendChild(z);
      trayDrag.zone = z;
      trayDropZoneRefresh(false);
      moveTrayDrag();
    }

    function moveTrayDrag() {
      if (!trayDrag.active) return;
      trayDrag.ghost.style.left = trayDrag.x + 'px';
      trayDrag.ghost.style.top = trayDrag.y + 'px';
      trayDropZoneRefresh(!!trayDropTargetAt(trayDrag.x, trayDrag.y));
    }

    function cleanupTrayDrag() {
      clearTimeout(trayDrag.timer);
      if (trayDrag.ghost) trayDrag.ghost.remove();
      if (trayDrag.zone) trayDrag.zone.remove();
      if (trayDrag.srcEl) trayDrag.srcEl.classList.remove('tray-source-dragging');
      document.body.classList.remove('tray-dragging');
      trayDrag.pending = false;
      trayDrag.active = false;
      trayDrag.ghost = null;
      trayDrag.zone = null;
      trayDrag.srcEl = null;
      trayDrag.id = null;
    }

    function cancelTrayDrag() {
      if (trayDrag.active) traySuppressClickUntil = Date.now() + 400;
      cleanupTrayDrag();
    }

    function finishTrayDrag(drop) {
      const wasActive = trayDrag.active;
      const id = trayDrag.id;
      const onTarget = wasActive && drop && !!trayDropTargetAt(trayDrag.x, trayDrag.y);
      if (wasActive) traySuppressClickUntil = Date.now() + 400;
      cleanupTrayDrag();
      if (onTarget) addBarTrayItem(id);
    }

    document.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (trayDrag.active || trayDrag.pending) return;
      if (!e.target.closest) return;
      const card = e.target.closest('[data-drink-id]');
      if (!card) return;
      if (e.target.closest('button, a, input, select, textarea')) return;

      trayDrag.pending = true;
      trayDrag.id = card.getAttribute('data-drink-id');
      trayDrag.srcEl = card;
      trayDrag.startX = trayDrag.x = e.clientX;
      trayDrag.startY = trayDrag.y = e.clientY;
      trayDrag.type = e.pointerType || 'mouse';
      clearTimeout(trayDrag.timer);
      if (trayDrag.type !== 'mouse') {
        // Touch: erst nach langem Drücken ziehen, damit normales Scrollen weiter funktioniert
        trayDrag.timer = setTimeout(() => { if (trayDrag.pending) startTrayDrag(); }, 350);
      }
    });

    document.addEventListener('pointermove', (e) => {
      if (!trayDrag.pending && !trayDrag.active) return;
      trayDrag.x = e.clientX;
      trayDrag.y = e.clientY;
      if (trayDrag.pending) {
        const dist = Math.hypot(trayDrag.x - trayDrag.startX, trayDrag.y - trayDrag.startY);
        if (trayDrag.type === 'mouse') {
          if (dist > 6) startTrayDrag();
        } else if (dist > 10) {
          // Finger bewegt sich vor dem langen Drücken: normales Scrollen
          clearTimeout(trayDrag.timer);
          trayDrag.pending = false;
          trayDrag.id = null;
          trayDrag.srcEl = null;
        }
        return;
      }
      moveTrayDrag();
    });

    document.addEventListener('pointerup', () => {
      if (trayDrag.active) finishTrayDrag(true);
      else if (trayDrag.pending) {
        clearTimeout(trayDrag.timer);
        trayDrag.pending = false;
        trayDrag.id = null;
        trayDrag.srcEl = null;
      }
    });

    document.addEventListener('pointercancel', () => {
      if (trayDrag.active) cancelTrayDrag();
      else if (trayDrag.pending) {
        clearTimeout(trayDrag.timer);
        trayDrag.pending = false;
        trayDrag.id = null;
        trayDrag.srcEl = null;
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && trayDrag.active) cancelTrayDrag();
    });

    // Während des Ziehens kein Scrollen auf Touch-Geräten
    document.addEventListener('touchmove', (e) => {
      if (trayDrag.active) e.preventDefault();
    }, { passive: false });

    // Kein nativer Bild-Drag, kein Kontextmenü beim langen Drücken, kein Klick nach dem Loslassen
    document.addEventListener('dragstart', (e) => {
      if (e.target && e.target.closest && e.target.closest('[data-drink-id]')) e.preventDefault();
    });
    document.addEventListener('contextmenu', (e) => {
      if (trayDrag.active || trayDrag.pending) e.preventDefault();
    });
    document.addEventListener('click', (e) => {
      if (Date.now() < traySuppressClickUntil) {
        e.stopPropagation();
        e.preventDefault();
      }
    }, true);

    function openMultiViewModal() {
      if (barTraySelection.length === 0) return;
      const container = document.getElementById('multiViewContentContainer');
      container.innerHTML = barTraySelection.map((id, index) => {
        let d = allDrinks.find(item => item.id === id);
        if (!d) return '';
        let priceText = d.selling_price ? ` (€ ${parseFloat(d.selling_price).toFixed(2)})` : '';
        let photoHtml = d.photo_url ? `<img src="${escapeHtml(d.photo_url)}" class="w-full h-36 object-cover rounded-lg mb-2 shadow cursor-pointer hover:opacity-95 transition" onclick="openPhotoPreview(${jsArg(d.photo_url)})" alt="${escapeHtml(d.name)}">` : '';

        let ingredientsHtml = '';
        if (Array.isArray(d.ingredients_json) && d.ingredients_json.length > 0) {
          ingredientsHtml = d.ingredients_json.map(i => `<div class="grid grid-cols-2 py-0.5 border-b border-slate-200 dark:border-slate-800/55"><span class="font-medium">${escapeHtml(i.name)}</span><span class="text-amber-600 dark:text-amber-300 font-semibold">${escapeHtml(i.amount || '-')}</span></div>`).join('');
        } else {
          ingredientsHtml = `<div class="italic text-slate-500">Keine Zutaten</div>`;
        }

        return `
          <div class="card p-4 flex flex-col justify-between custom-box border rounded-xl shadow-sm">
            <div>
              <div class="flex items-center justify-between mb-2">
                <span class="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">${escapeHtml(d.category || '')}</span>
                <div class="flex items-center gap-1.5">
                  <button onclick="openReplaceDrinkModal(${index})" class="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold rounded text-[11px] border border-slate-700">🔄 Tauschen</button>
                  <button onclick="toggleBarTrayItem(${jsArg(d.id)}, event); openMultiViewModal();" class="text-red-500 hover:text-red-400 text-xs font-bold p-1">&times;</button>
                </div>
              </div>
              ${photoHtml}
              <h4 class="text-base font-bold mb-3">${escapeHtml(d.name)}${priceText}</h4>
              <div class="text-xs space-y-1 mb-3 custom-box p-2.5 rounded-lg border">
                <div><b>Glas:</b> ${escapeHtml(d.glass_type || '-')}</div>
                <div><b>Method:</b> ${escapeHtml(d.method || '-')}</div>
                <div><b>Ice:</b> ${escapeHtml(d.ice || '-')}</div>
                <div><b>Garnish:</b> ${escapeHtml(d.garnish || '-')}</div>
              </div>
              <div class="text-xs custom-box p-2.5 rounded-lg border mb-2">
                <div class="font-bold text-amber-600 dark:text-amber-400 mb-1 pb-1 border-b border-slate-200 dark:border-slate-800 grid grid-cols-2"><span>Zutaten:</span><span>Menge:</span></div>
                ${ingredientsHtml}
              </div>
              ${d.recipe ? `<div class="text-[11px] text-slate-600 dark:text-slate-400 custom-box p-2 rounded-lg border"><b>Zubereitung:</b> ${escapeHtml(d.recipe)}</div>` : ''}
            </div>
          </div>
        `;
      }).join('');

      const modal = document.getElementById('multiViewModal');
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }

    function closeMultiViewModal() {
      const modal = document.getElementById('multiViewModal');
      modal.classList.remove('flex');
      modal.classList.add('hidden');
    }

    function openReplaceDrinkModal(trayIndex) {
      document.getElementById('replaceIndexTarget').value = trayIndex;
      const seasonDrinks = allDrinks.filter(d => (d.season || '') === currentSeasonFilter);
      const container = document.getElementById('replaceDrinkListContainer');
      
      container.innerHTML = seasonDrinks.map(d => `
        <div onclick="executeReplaceDrink(${jsArg(d.id)})" class="p-2.5 rounded-lg custom-box border hover:border-amber-500 cursor-pointer flex items-center justify-between text-xs transition">
          <span class="font-bold">${escapeHtml(d.name)}</span>
          <span class="text-[10px] text-slate-400">${escapeHtml(d.category || '')}</span>
        </div>
      `).join('');

      const modal = document.getElementById('replaceDrinkModal');
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }

    function closeReplaceDrinkModal() {
      const modal = document.getElementById('replaceDrinkModal');
      modal.classList.remove('flex');
      modal.classList.add('hidden');
    }

    function executeReplaceDrink(newDrinkId) {
      let trayIndex = parseInt(document.getElementById('replaceIndexTarget').value);
      if (!isNaN(trayIndex) && trayIndex >= 0 && trayIndex < barTraySelection.length) {
        barTraySelection[trayIndex] = newDrinkId;
        localStorage.setItem('salon_bar_tray', JSON.stringify(barTraySelection));
        renderBarTrayUI();
        closeReplaceDrinkModal();
        openMultiViewModal();
      }
    }

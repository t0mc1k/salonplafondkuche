/* ============================================================
   js/tickets.js
   Support-Tickets (der Changelog liegt in js/changelog.js)
   ============================================================ */
    async function checkPendingTicketsBadge() {
      const { data, error } = await _supabase.from('support_tickets').select('*').eq('is_changelog', false);
      if (error) return;
      
      const menuDot = document.getElementById('menuNotificationDot');
      const dropdownDot = document.getElementById('menuDropdownTicketDot');
      
      const hasPending = (data || []).some(t => t.status === 'pending');
      
      if (hasPending) {
        if (menuDot) menuDot.classList.remove('hidden');
        if (dropdownDot) dropdownDot.classList.remove('hidden');
      } else {
        if (menuDot) menuDot.classList.add('hidden');
        if (dropdownDot) dropdownDot.classList.add('hidden');
      }
    }

    function openSupportModal() {
      closeSettingsMenu();
      document.getElementById('ticketAuthorDisplay').innerText = currentWaiterName;
      loadTicketsData();
      const modal = document.getElementById('supportModal');
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }

    function closeSupportModal() {
      const modal = document.getElementById('supportModal');
      modal.classList.remove('flex');
      modal.classList.add('hidden');
      checkPendingTicketsBadge();
    }

    async function submitNewTicket() {
      const msgInput = document.getElementById('newTicketMessage');
      const text = msgInput.value.trim();
      if (!text) return alert("Bitte geben Sie eine Nachricht ein.");

      const authorString = `${currentWaiterName} (Staff)`;

      const { error } = await _supabase.from('support_tickets').insert([{
        author_email: authorString,
        message: text,
        status: 'pending',
        is_changelog: false
      }]);

      if (error) {
        alert("Fehler beim Absenden: " + error.message);
      } else {
        msgInput.value = '';
        alert("Anfrage erfolgreich an das Team & Tomas gesendet!");
        loadTicketsData();
        checkPendingTicketsBadge();
      }
    }

    async function loadTicketsData() {
      const container = document.getElementById('ticketsListContainer');
      container.innerHTML = `<p class="text-slate-500 italic text-xs text-center py-4">Lade Anfragen...</p>`;

      const { data, error } = await _supabase.from('support_tickets').select('*').eq('is_changelog', false).order('created_at', { ascending: false });
      if (error) {
        container.innerHTML = `<p class="text-red-500 dark:text-red-400 text-xs text-center py-4">Fehler beim Laden: ${escapeHtml(error.message)}</p>`;
        return;
      }

      if (!data || data.length === 0) {
        container.innerHTML = `<p class="text-slate-500 italic text-xs text-center py-4">Keine Anfragen vorhanden.</p>`;
        return;
      }

      const isDevUser = (currentStaffRole === 'developer');

      container.innerHTML = data.map(t => {
        let isResolved = t.status === 'resolved';
        let statusBadge = isResolved 
          ? `<span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/30 text-[10px]">✓ Erledigt</span>` 
          : `<span class="px-2 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/30 text-[10px]">⏳ Offen</span>`;
        
        let dateStr = new Date(t.created_at).toLocaleString();
        let commentHtml = t.admin_comment ? `<div class="mt-2 text-[11px] custom-box p-2 rounded border text-amber-600 dark:text-amber-300"><b>Kommentar (Tomas Kardos - Developer):</b> ${escapeHtml(t.admin_comment)}</div>` : '';

        let adminActionHtml = '';
        if (userIsAdmin && isAdmin) {
          let deleteTicketBtnHtml = isDevUser ? `<button onclick="deleteTicket(${jsArg(t.id)})" class="px-3 py-1.5 rounded text-[11px] font-bold bg-red-100 hover:bg-red-200 dark:bg-red-600/20 dark:hover:bg-red-600/40 text-red-600 dark:text-red-400 border border-red-300 dark:border-red-500/30">🗑️ Löschen</button>` : '';

          adminActionHtml = `
            <div class="mt-3 pt-2 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-2">
              <input type="text" id="comment_${t.id}" placeholder="Kommentar als Tomas (Developer) hinzufügen..." value="${escapeHtml(t.admin_comment || '')}" class="p-2 rounded border text-[11px]">
              <div class="flex flex-wrap gap-2 items-center justify-between">
                <div class="flex gap-2">
                  <button onclick="updateTicketStatus(${jsArg(t.id)}, ${jsArg(isResolved ? 'pending' : 'resolved')})" class="px-3 py-1.5 rounded text-[11px] font-bold ${isResolved ? 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}">
                    ${isResolved ? '↩ Als offen markieren' : '✓ Als erledigt markieren'}
                  </button>
                  <button onclick="saveTicketComment(${jsArg(t.id)})" class="px-3 py-1.5 rounded text-[11px] font-bold bg-amber-500 hover:bg-amber-600 text-slate-950">
                    Als Tomas speichern
                  </button>
                </div>
                ${deleteTicketBtnHtml}
              </div>
            </div>
          `;
        }

        return `
          <div class="custom-box p-3.5 rounded-xl border flex flex-col gap-2">
            <div class="flex justify-between items-center">
              <span class="text-[11px] font-semibold text-slate-600 dark:text-slate-400">👤 ${escapeHtml(t.author_email)} • <span class="text-slate-500">${dateStr}</span></span>
              ${statusBadge}
            </div>
            <p class="text-xs font-medium">${escapeHtml(t.message)}</p>
            ${commentHtml}
            ${adminActionHtml}
          </div>
        `;
      }).join('');
    }

    async function updateTicketStatus(id, newStatus) {
      checkManagerAuth(async () => {
        const { error } = await _supabase.from('support_tickets').update({ status: newStatus }).eq('id', id);
        if (error) {
          alert("Fehler: " + error.message);
        } else {
          loadTicketsData();
          checkPendingTicketsBadge();
        }
      });
    }

    async function saveTicketComment(id) {
      checkManagerAuth(async () => {
        const commentInput = document.getElementById(`comment_${id}`);
        const commentVal = commentInput ? commentInput.value.trim() : '';

        const { error } = await _supabase.from('support_tickets').update({ admin_comment: commentVal, status: 'resolved' }).eq('id', id);
        if (error) {
          alert("Fehler: " + error.message);
        } else {
          alert("Kommentar gespeichert und als von Tomas Kardos (Developer) erledigt markiert!");
          loadTicketsData();
          checkPendingTicketsBadge();
        }
      });
    }

    async function deleteTicket(id) {
      const isDevUser = (currentStaffRole === 'developer');
      if (!isDevUser) {
        alert("Nur der Entwickler (Tomas) darf Tickets löschen!");
        return;
      }
      checkManagerAuth(async () => {
        if (!confirm("Möchten Sie dieses Ticket wirklich permanent löschen?")) return;
        const { error } = await _supabase.from('support_tickets').delete().eq('id', id);
        if (error) {
          alert("Fehler beim Löschen: " + error.message);
        } else {
          alert("Ticket erfolgreich gelöscht!");
          loadTicketsData();
          checkPendingTicketsBadge();
        }
      });
    }


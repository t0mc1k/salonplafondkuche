/* ============================================================
   js/chat.js
   Team-Chat (inkl. @Mention Autocomplete & Text Styling)
   ============================================================ */
    function openTeamChatModal() {
      closeSettingsMenu();
      loadChatMessages();
      loadChatSidebarUsers();
      loadOnlineUsersSummary();
      
      sessionStorage.setItem('salon_chat_last_seen_' + currentWaiterName, new Date().toISOString());
      updateChatEnvelopeBadge(false);

      const modal = document.getElementById('teamChatModal');
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }

    function closeTeamChatModal() {
      const modal = document.getElementById('teamChatModal');
      modal.classList.remove('flex');
      modal.classList.add('hidden');
      hideMentionDropdown();
    }

    function toggleChatSidebar() {
      const sidebar = document.getElementById('chatSidebar');
      const label = document.getElementById('chatSidebarToggleLabel');
      chatSidebarOpen = !chatSidebarOpen;
      if (chatSidebarOpen) {
        sidebar.classList.remove('hidden');
        sidebar.classList.add('flex');
        label.innerText = 'Team-Sidebar ausblenden';
      } else {
        sidebar.classList.remove('flex');
        sidebar.classList.add('hidden');
        label.innerText = 'Team-Sidebar einblenden';
      }
    }

    async function loadChatSidebarUsers() {
      const container = document.getElementById('chatSidebarUsersList');
      const { data, error } = await _supabase.rpc('list_staff');
      if (error || !data) {
        container.innerHTML = `<span class="text-xs text-red-400">Fehler beim Laden</span>`;
        return;
      }

      container.innerHTML = data.map(staff => {
        let avatarHtml = staff.avatar_url 
          ? `<img src="${escapeHtml(staff.avatar_url)}" class="w-9 h-9 rounded-full object-cover border border-amber-500/50 shrink-0 cursor-pointer" onclick="event.stopPropagation(); openUserDetailModal(${jsArg(staff.name)})" alt="${escapeHtml(staff.name)}">` 
          : `<div class="w-9 h-9 rounded-full bg-slate-800 text-amber-400 font-bold flex items-center justify-center border border-slate-700 text-xs shrink-0 cursor-pointer" onclick="event.stopPropagation(); openUserDetailModal(${jsArg(staff.name)})">${escapeHtml(staff.name.charAt(0).toUpperCase())}</div>`;

        return `
          <div onclick="appendChatMention(${jsArg(staff.name)})" class="p-2 rounded-lg custom-box border hover:border-amber-500 cursor-pointer flex items-center justify-between gap-2 transition group" title="Klicken, um @${escapeHtml(staff.name)} zu markieren">
            <div class="flex items-center gap-2 min-w-0">
              ${avatarHtml}
              <div class="min-w-0">
                <span class="text-xs font-bold text-white group-hover:text-amber-400 truncate block">${escapeHtml(staff.name)}</span>
                <span class="text-[9px] text-slate-400 uppercase tracking-wider block">${escapeHtml(staff.role || 'staff')}</span>
              </div>
            </div>
            <button onclick="event.stopPropagation(); openUserDetailModal(${jsArg(staff.name)})" class="px-2 py-1 bg-slate-800 hover:bg-amber-500/20 hover:border-amber-500/50 text-amber-400 font-bold rounded text-[10px] border border-slate-700 transition shrink-0">
              Profil
            </button>
          </div>
        `;
      }).join('');
    }

    function appendChatMention(name) {
      const input = document.getElementById('chatMessageInput');
      const val = input.value;
      const lastAt = val.lastIndexOf('@');
      if (lastAt !== -1) {
        input.value = val.substring(0, lastAt) + `@${name} `;
      } else {
        input.value += `@${name} `;
      }
      input.focus();
      hideMentionDropdown();
    }

    // --- @MENTION AUTOCOMPLETE & TEXT STYLING LOGIC ---
    document.addEventListener('DOMContentLoaded', () => {
      const input = document.getElementById('chatMessageInput');
      if (!input) return;

      // Vytvorenie kontajnera pre mention dropdown ak neexistuje
      let dropdown = document.getElementById('chatMentionDropdown');
      if (!dropdown) {
        dropdown = document.createElement('div');
        dropdown.id = 'chatMentionDropdown';
        dropdown.className = 'hidden absolute bottom-full left-0 mb-1 w-64 bg-slate-900 border border-amber-500/40 rounded-xl shadow-2xl p-1.5 z-50 max-h-40 overflow-y-auto text-xs';
        input.parentNode.style.position = 'relative';
        input.parentNode.appendChild(dropdown);
      }

      input.addEventListener('input', async function() {
        const val = this.value;
        const cursorPos = this.selectionStart;
        const textBeforeCursor = val.substring(0, cursorPos);
        
        // Hľadáme, či užívateľ píše @ niečo
        const match = textBeforeCursor.match(/@([\w]*)$/);
        if (match) {
          const query = match[1].toLowerCase();
          const { data } = await _supabase.rpc('list_staff');
          if (data && data.length > 0) {
            const filtered = data.filter(s => s.name.toLowerCase().includes(query));
            if (filtered.length > 0) {
              dropdown.innerHTML = filtered.map(staff => `
                <div onclick="appendChatMention('${escapeHtml(staff.name)}')" class="p-2 hover:bg-amber-500/20 text-slate-200 hover:text-amber-400 cursor-pointer rounded-lg font-bold flex items-center justify-between transition">
                  <span>@${escapeHtml(staff.name)}</span>
                  <span class="text-[9px] text-slate-400 uppercase">${escapeHtml(staff.role || 'staff')}</span>
                </div>
              `).join('');
              dropdown.classList.remove('hidden');
              dropdown.classList.add('flex', 'flex-col');
              return;
            }
          }
        }
        hideMentionDropdown();
      });

      input.addEventListener('blur', () => {
        setTimeout(hideMentionDropdown, 200); // zohľadní kliknutie na položku
      });
    });

    function hideMentionDropdown() {
      const dropdown = document.getElementById('chatMentionDropdown');
      if (dropdown) {
        dropdown.classList.remove('flex', 'flex-col');
        dropdown.classList.add('hidden');
      }
    }

    function applyTextStyling(syntaxOpen, syntaxClose = syntaxOpen) {
      const input = document.getElementById('chatMessageInput');
      const start = input.selectionStart;
      const end = input.selectionEnd;
      const val = input.value;
      
      const selectedText = val.substring(start, end);
      const replacement = syntaxOpen + (selectedText || 'Text') + syntaxClose;
      
      input.value = val.substring(0, start) + replacement + val.substring(end);
      input.focus();
      input.setSelectionRange(start + syntaxOpen.length, end + syntaxOpen.length);
    }
    // ------------------------------------------------

    function setupChatRealtimeListener() {
      if (chatRealtimeSubscription) return;
      chatRealtimeSubscription = _supabase
        .channel('public:team_chat')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'team_chat' }, payload => {
          let newMsg = payload.new;
          if (document.getElementById('teamChatModal').classList.contains('hidden') && newMsg.author_name.toLowerCase() !== currentWaiterName.toLowerCase()) {
            updateChatEnvelopeBadge(true);
          }
          if (!document.getElementById('teamChatModal').classList.contains('hidden')) {
            loadChatMessages();
          }
        })
        .subscribe();
      
      checkForUnreadChatMessages();
    }

    async function checkForUnreadChatMessages() {
      const { data, error } = await _supabase.from('team_chat').select('*').order('created_at', { ascending: false }).limit(1);
      if (error || !data || data.length === 0) return;

      let lastMsg = data[0];
      let lastSeenTime = sessionStorage.getItem('salon_chat_last_seen_' + currentWaiterName);
      
      if (lastMsg.author_name.toLowerCase() !== currentWaiterName.toLowerCase()) {
        if (!lastSeenTime || new Date(lastMsg.created_at) > new Date(lastSeenTime)) {
          updateChatEnvelopeBadge(true);
        }
      }
    }

    function updateChatEnvelopeBadge(hasUnread) {
      const badge = document.getElementById('headerChatBadgeDot');
      if (hasUnread) {
        if (badge) badge.classList.remove('hidden');
      } else {
        if (badge) badge.classList.add('hidden');
      }
    }

    async function loadChatMessages() {
      const container = document.getElementById('chatMessagesContainer');
      container.innerHTML = `<p class="text-slate-500 italic text-xs text-center py-4">Lade Nachrichten...</p>`;

      const { data, error } = await _supabase.from('team_chat').select('*').order('created_at', { ascending: true });
      if (error) {
        container.innerHTML = `<p class="text-red-400 text-xs text-center py-4">Fehler: ${escapeHtml(error.message)}</p>`;
        return;
      }

      if (!data || data.length === 0) {
        container.innerHTML = `<p class="text-slate-500 italic text-xs text-center py-4">Noch keine Nachrichten im Team-Chat. Starte die Unterhaltung! 💬</p>`;
        return;
      }

      let messagesMap = {};
      data.forEach(m => messagesMap[m.id] = m);

      const isUserDevOrManager = userIsAdmin;

      container.innerHTML = data.map(msg => {
        let isOwner = (msg.author_name.toLowerCase() === currentWaiterName.toLowerCase());
        let canDelete = isOwner || isUserDevOrManager;

        let staffRecord = staffDatabaseRecords.find(s => s.name.toLowerCase() === msg.author_name.toLowerCase());
        let avatarUrl = (staffRecord && staffRecord.avatar_url) ? staffRecord.avatar_url : "";
        let avatarHtml = avatarUrl 
          ? `<img src="${escapeHtml(avatarUrl)}" class="w-8 h-8 rounded-full object-cover border border-amber-500/50 shrink-0 cursor-pointer hover:scale-105 transition" onclick="openUserDetailModal(${jsArg(msg.author_name)})" alt="${escapeHtml(msg.author_name)}">` 
          : `<div class="w-8 h-8 rounded-full bg-slate-800 text-amber-400 font-bold flex items-center justify-center border border-slate-700 text-xs shrink-0 cursor-pointer hover:scale-105 transition" onclick="openUserDetailModal(${jsArg(msg.author_name)})">${escapeHtml(msg.author_name.charAt(0).toUpperCase())}</div>`;

        let timeStr = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        let replyQuoteHtml = '';
        if (msg.reply_to_id && messagesMap[msg.reply_to_id]) {
          let quoted = messagesMap[msg.reply_to_id];
          replyQuoteHtml = `
            <div class="mb-1.5 p-2 rounded bg-slate-900/60 border-l-2 border-amber-500 text-[11px] text-slate-300">
              <span class="font-bold text-amber-400">${escapeHtml(quoted.author_name)}:</span> ${escapeHtml(quoted.message)}
            </div>
          `;
        }

        // Formátovanie textu správy (zvýraznenie @mention a základný markdown)
        let formattedMessage = escapeHtml(msg.message)
          .replace(/(\B@[a-zA-ZÄÖÜäöüß]+)/g, '<span class="text-amber-400 font-bold bg-amber-500/10 px-1 rounded">$1</span>')
          .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-white">$1</strong>')
          .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>');

        return `
          <div class="flex items-start gap-2.5 p-2.5 rounded-xl custom-box border text-xs relative group">
            ${avatarHtml}
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between">
                <span class="font-bold text-amber-600 dark:text-amber-400 cursor-pointer hover:underline" onclick="openUserDetailModal(${jsArg(msg.author_name)})">${escapeHtml(msg.author_name)}</span>
                <div class="flex items-center gap-2">
                  <span class="text-[10px] text-slate-500">${timeStr}</span>
                  <button onclick="setReplyTarget(${jsArg(msg.id)}, ${jsArg(msg.author_name)}, ${jsArg(msg.message)})" class="text-[10px] text-amber-500 hover:underline font-semibold" title="Auf diese Nachricht antworten">Antworten</button>
                </div>
              </div>
              ${replyQuoteHtml}
              <p class="mt-1 text-slate-200 break-words">${formattedMessage}</p>
            </div>
            ${canDelete ? `<button onclick="deleteChatMessage(${jsArg(msg.id)})" class="text-slate-500 hover:text-red-400 font-bold p-1 transition" title="Nachricht löschen">&times;</button>` : ''}
          </div>
        `;
      }).join('');
      container.scrollTop = container.scrollHeight;
    }

    function setReplyTarget(msgId, authorName, messageText) {
      document.getElementById('replyingMessageId').value = msgId;
      document.getElementById('replyingAuthorName').innerText = authorName;
      document.getElementById('replyingSnippetText').innerText = messageText;
      document.getElementById('replyingIndicatorBox').classList.remove('hidden');
      document.getElementById('replyingIndicatorBox').classList.add('flex');
      document.getElementById('chatMessageInput').focus();
    }

    function cancelReply() {
      document.getElementById('replyingMessageId').value = '';
      document.getElementById('replyingIndicatorBox').classList.remove('flex');
      document.getElementById('replyingIndicatorBox').classList.add('hidden');
    }

    async function handleSendChatMessage(e) {
      e.preventDefault();
      const input = document.getElementById('chatMessageInput');
      const replyIdInput = document.getElementById('replyingMessageId');
      const text = input.value.trim();
      if (!text) return;

      let reply_to_id = replyIdInput.value ? replyIdInput.value : null;

      const { error } = await _supabase.from('team_chat').insert([{
        author_name: currentWaiterName,
        message: text,
        reply_to_id: reply_to_id
      }]);

      if (error) {
        alert("Fehler beim Senden: " + error.message);
      } else {
        input.value = '';
        cancelReply();
        loadChatMessages();
      }
    }

    async function deleteChatMessage(id) {
      if (!confirm("Möchtest du diese Nachricht löschen?")) return;
      const { error } = await _supabase.from('team_chat').delete().eq('id', id);
      if (error) {
        alert("Fehler beim Löschen: " + error.message);
      } else {
        loadChatMessages();
      }
    }

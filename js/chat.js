/* ============================================================
   js/chat.js
   Team-Chat: Nachrichten, Antworten, Reaktionen, Bearbeiten, Fotos,
   Anpinnen, Suche, „schreibt ...“, @-Vorschläge und Textformatierung
   Neue Datenbank-Felder siehe sql/1.0.00_setup.sql (der Chat läuft auch ohne sie
   mit den Grundfunktionen weiter).
   ============================================================ */
    const CHAT_REACTIONS = ['👍', '❤️', '😂', '🍽️', '🔥', '🙏'];
    const CHAT_EMOJIS = ['😀', '😂', '😅', '😍', '😎', '🤔', '😴', '🙌', '👏', '👍', '👎', '🙏', '🔥', '🎉', '🍽️', '👨‍🍳', '🥩', '🍋', '🔪', '☕', '✅', '❗', '❓', '💡'];

    let chatMessagesCache = [];
    let chatReactionsCache = [];
    let chatReactionsAvailable = true;
    let chatSearchQuery = '';
    let chatEditingId = null;
    let chatPendingImage = null;
    let chatTypingUsers = {};
    let chatTypingTimer = null;
    let chatLastTypingSent = 0;
    let chatSeenAtOpen = null;
    let chatUnreadCount = 0;
    let chatIsOpen = false;
    let chatMention = { open: false, items: [], index: 0, start: 0 };

    // ---------- Hilfsfunktionen ----------
    function chatEl(id) { return document.getElementById(id); }

    function chatSeenKey() { return 'kueche_chat_seen_' + String(currentWaiterName || '').toLowerCase(); }
    function chatGetSeen() { try { return localStorage.getItem(chatSeenKey()); } catch (e) { return null; } }
    function chatMarkSeen() { try { localStorage.setItem(chatSeenKey(), new Date().toISOString()); } catch (e) {} }

    function chatStaffByName(name) {
      return (staffDatabaseRecords || []).find(s => String(s.name).toLowerCase() === String(name).toLowerCase());
    }

    function chatAvatarHtml(name, size, extra) {
      const rec = chatStaffByName(name);
      const url = rec && rec.avatar_url ? rec.avatar_url : '';
      const cls = 'chat-avatar ' + (size || '') + ' ' + (extra || '');
      return url
        ? `<img src="${escapeHtml(url)}" class="${cls}" onclick="openUserDetailModal(${jsArg(name)})" alt="${escapeHtml(name)}">`
        : `<div class="${cls}" onclick="openUserDetailModal(${jsArg(name)})">${escapeHtml(String(name).charAt(0).toUpperCase())}</div>`;
    }

    function chatDayLabel(d) {
      const today = new Date();
      const y = new Date(); y.setDate(today.getDate() - 1);
      if (d.toDateString() === today.toDateString()) return 'Heute';
      if (d.toDateString() === y.toDateString()) return 'Gestern';
      return d.toLocaleDateString('de-AT', { weekday: 'short', day: 'numeric', month: 'long' });
    }

    function chatStripFormat(text) {
      return String(text || '').replace(/\*\*|~~|`|\*/g, '').replace(/\s+/g, ' ').trim();
    }

    function escapeRegExp(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

    function chatMentionsMe(text) {
      if (!currentWaiterName) return false;
      return new RegExp('(^|\\s)@' + escapeRegExp(currentWaiterName) + '(?=$|[\\s.,!?:;])', 'i').test(String(text || ''));
    }

    // ---------- Text-Formatierung (sicher: erst escapen, dann nur eigene Tags) ----------
    function formatChatText(raw) {
      let t = escapeHtml(String(raw == null ? '' : raw).replace(/\u0000/g, ''));
      const slots = [];
      const keep = html => { slots.push(html); return '\u0000' + (slots.length - 1) + '\u0000'; };

      t = t.replace(/`([^`\n]+)`/g, (m, c) => keep('<code class="chat-code">' + c + '</code>'));
      t = t.replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]])/g, (m, url) => keep('<a href="' + url + '" target="_blank" rel="noopener noreferrer" class="chat-link">' + url + '</a>'));
      t = t.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
      t = t.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
      t = t.replace(/~~([^~\n]+)~~/g, '<s>$1</s>');

      const names = (staffDatabaseRecords || []).map(s => s.name).filter(Boolean)
        .sort((a, b) => b.length - a.length).map(n => escapeRegExp(escapeHtml(n)));
      if (names.length) {
        const re = new RegExp('(^|[\\s(])@(' + names.join('|') + ')(?=$|[\\s).,!?:;])', 'gi');
        t = t.replace(re, (m, pre, nm) => {
          const me = currentWaiterName && nm.toLowerCase() === escapeHtml(currentWaiterName).toLowerCase();
          return pre + '<span class="chat-mention' + (me ? ' chat-mention-me' : '') + '">@' + nm + '</span>';
        });
      }
      return t.replace(/\u0000(\d+)\u0000/g, (m, i) => slots[Number(i)]);
    }

    // ---------- Liste der Nachrichten als HTML (reine Funktion, gut testbar) ----------
    function buildChatMessagesHtml(messages, reactions, ctx) {
      const me = String(ctx.me || '').toLowerCase();
      const q = (ctx.query || '').trim().toLowerCase();
      const seenAt = ctx.seenAt ? new Date(ctx.seenAt) : null;
      const byId = {};
      messages.forEach(m => { byId[m.id] = m; });

      let html = '', lastDay = '', prev = null, dividerShown = false, shown = 0;
      messages.forEach(m => {
        const hay = (String(m.message || '') + ' ' + String(m.author_name || '')).toLowerCase();
        if (q && hay.indexOf(q) === -1) return;
        shown++;

        const d = new Date(m.created_at);
        const dayKey = d.toDateString();
        if (dayKey !== lastDay) {
          html += `<div class="chat-day"><span>${escapeHtml(chatDayLabel(d))}</span></div>`;
          lastDay = dayKey;
          prev = null;
        }
        const mine = String(m.author_name || '').toLowerCase() === me;
        if (!dividerShown && !q && seenAt && !mine && d > seenAt) {
          html += `<div class="chat-newdivider" id="chatNewDivider"><span>Neue Nachrichten</span></div>`;
          dividerShown = true;
          prev = null;
        }

        const grouped = !!prev && !q && prev.author_name === m.author_name && (d - new Date(prev.created_at)) < 5 * 60000 && !m.reply_to_id;
        prev = m;

        const time = d.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
        const mentionsMe = !mine && chatMentionsMe(m.message);
        const canEdit = mine && !!m.message && !m.image_url;
        const canDelete = mine || ctx.admin;

        let quote = '';
        if (m.reply_to_id && byId[m.reply_to_id]) {
          const qm = byId[m.reply_to_id];
          quote = `<div class="chat-quote" onclick="scrollToChatMessage(${jsArg(qm.id)})"><b>${escapeHtml(qm.author_name)}</b><span>${escapeHtml(chatStripFormat(qm.message) || '📷 Foto').slice(0, 140)}</span></div>`;
        }
        const image = m.image_url ? `<img src="${escapeHtml(m.image_url)}" class="chat-image" alt="Foto" onclick="openPhotoPreview(${jsArg(m.image_url)})">` : '';
        const text = m.message ? `<div class="chat-text">${formatChatText(m.message)}</div>` : '';

        // Reaktionen
        let reactHtml = '';
        if (ctx.reactionsAvailable) {
          const groups = {};
          reactions.filter(r => r.message_id === m.id).forEach(r => {
            (groups[r.emoji] = groups[r.emoji] || []).push(r.user_name);
          });
          const chips = Object.keys(groups).map(e => {
            const users = groups[e];
            const on = users.some(u => String(u).toLowerCase() === me);
            return `<button type="button" class="chat-react ${on ? 'on' : ''}" onclick="toggleReaction(${jsArg(m.id)}, ${jsArg(e)})" title="${escapeHtml(users.join(', '))}">${escapeHtml(e)} <span>${users.length}</span></button>`;
          }).join('');
          if (chips) reactHtml = `<div class="chat-reacts">${chips}</div>`;
        }

        const pinBtn = (ctx.admin && ctx.pinAvailable) ? `<button type="button" onclick="togglePinMessage(${jsArg(m.id)})" title="${m.is_pinned ? 'Anheften lösen' : 'Anpinnen'}">${m.is_pinned ? '📍' : '📌'}</button>` : '';
        const actions = `
          <div class="chat-actions">
            <button type="button" onclick="setReplyTarget(${jsArg(m.id)}, ${jsArg(m.author_name)}, ${jsArg(m.message || '📷 Foto')})" title="Antworten">↩️</button>
            ${ctx.reactionsAvailable ? `<button type="button" onclick="toggleReactionPicker(${jsArg(m.id)})" title="Reagieren">😊</button>` : ''}
            ${canEdit ? `<button type="button" onclick="startEditMessage(${jsArg(m.id)})" title="Bearbeiten">✏️</button>` : ''}
            ${pinBtn}
            ${canDelete ? `<button type="button" onclick="deleteChatMessage(${jsArg(m.id)})" title="Löschen" class="danger">🗑️</button>` : ''}
          </div>`;
        const picker = ctx.reactionsAvailable
          ? `<div class="chat-picker hidden" id="picker_${escapeHtml(m.id)}">${CHAT_REACTIONS.map(e => `<button type="button" onclick="toggleReaction(${jsArg(m.id)}, ${jsArg(e)})">${e}</button>`).join('')}</div>`
          : '';

        html += `
          <div class="chat-row ${mine ? 'mine' : ''} ${grouped ? 'grouped' : ''}" id="msg_${escapeHtml(m.id)}">
            ${mine ? '' : (grouped ? '<span class="chat-avatar-space"></span>' : chatAvatarHtml(m.author_name))}
            <div class="chat-col">
              ${grouped ? '' : `<div class="chat-meta"><b class="chat-author" onclick="openUserDetailModal(${jsArg(m.author_name)})">${escapeHtml(mine ? 'Du' : m.author_name)}</b><span class="chat-time">${escapeHtml(time)}</span>${m.is_pinned ? '<span class="chat-pin-tag">📌</span>' : ''}</div>`}
              <div class="chat-bubble ${mentionsMe ? 'mention' : ''}" title="${escapeHtml(d.toLocaleString('de-AT'))}">
                ${quote}${image}${text}
                ${m.edited_at ? '<span class="chat-edited">bearbeitet</span>' : ''}
              </div>
              ${reactHtml}
              ${actions}
              ${picker}
            </div>
          </div>`;
        });
      return { html, shown, hasDivider: dividerShown };
    }

    // ---------- Öffnen / Schließen ----------
    function openTeamChatModal() {
      closeSettingsMenu();
      chatIsOpen = true;
      chatSeenAtOpen = chatGetSeen();
      chatSearchQuery = '';
      const si = chatEl('chatSearchInput'); if (si) si.value = '';
      chatEl('chatSearchBar').classList.add('hidden');
      renderChatEmojiPanel();
      loadChatSidebarUsers();
      loadOnlineUsersSummary();
      loadChatMessages({ initial: true });

      chatMarkSeen();
      chatUnreadCount = 0;
      updateChatEnvelopeBadge(0);

      const modal = chatEl('teamChatModal');
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      setTimeout(() => { const i = chatEl('chatMessageInput'); if (i) i.focus(); }, 60);
    }

    function closeTeamChatModal() {
      chatIsOpen = false;
      chatMarkSeen();
      const modal = chatEl('teamChatModal');
      modal.classList.remove('flex');
      modal.classList.add('hidden');
      hideMentionDropdown();
      cancelEdit();
      chatEl('chatEmojiPanel').classList.add('hidden');
      const sb = chatEl('chatSidebar'); if (sb) sb.classList.remove('open');
      chatSidebarOpen = false;
    }

    function toggleChatSidebar() {
      chatSidebarOpen = !chatSidebarOpen;
      chatEl('chatSidebar').classList.toggle('open', chatSidebarOpen);
    }

    function toggleChatSearch() {
      const bar = chatEl('chatSearchBar');
      const show = bar.classList.contains('hidden');
      bar.classList.toggle('hidden', !show);
      if (show) { chatEl('chatSearchInput').focus(); }
      else { chatEl('chatSearchInput').value = ''; onChatSearch(''); }
    }

    function onChatSearch(value) {
      chatSearchQuery = value || '';
      renderChat({ keepPosition: true });
    }

    // ---------- Mitglieder-Leiste ----------
    async function loadChatSidebarUsers() {
      const { data, error } = await _supabase.rpc('list_staff');
      if (!error && Array.isArray(data)) staffDatabaseRecords = data;
      renderChatSidebar();
    }

    function renderChatSidebar() {
      const box = chatEl('chatSidebarUsersList');
      if (!box) return;
      const nowMs = Date.now();
      const list = (staffDatabaseRecords || []).slice().sort((a, b) => {
        const oa = a.last_used_at && (nowMs - new Date(a.last_used_at).getTime()) <= 15 * 60000 ? 0 : 1;
        const ob = b.last_used_at && (nowMs - new Date(b.last_used_at).getTime()) <= 15 * 60000 ? 0 : 1;
        return oa - ob || String(a.name).localeCompare(String(b.name), 'de');
      });
      if (!list.length) { box.innerHTML = '<span class="form-hint">Keine Mitglieder gefunden.</span>'; return; }
      box.innerHTML = list.map(s => {
        const online = s.last_used_at && (nowMs - new Date(s.last_used_at).getTime()) <= 15 * 60000;
        const typing = chatTypingUsers[s.name] && chatTypingUsers[s.name] > nowMs;
        const avatar = s.avatar_url
          ? `<img src="${escapeHtml(s.avatar_url)}" alt="">`
          : escapeHtml(String(s.name).charAt(0).toUpperCase());
        const role = ({ developer: 'Developer', manager: 'Manager' }[s.role]) || 'Koch';
        return `
          <div class="chat-member" onclick="appendChatMention(${jsArg(s.name)})" title="Klicken, um @${escapeHtml(s.name)} zu erwähnen">
            <span class="chat-member-av">${avatar}<span class="chat-dot ${online ? 'on' : ''}"></span></span>
            <span class="min-w-0 flex-1">
              <span class="chat-member-name">${escapeHtml(s.name)}</span>
              <span class="chat-member-sub ${typing ? 'typing' : ''}">${typing ? 'schreibt ...' : (online ? 'online · ' + role : role)}</span>
            </span>
            <button type="button" class="chat-member-btn" onclick="event.stopPropagation(); openUserDetailModal(${jsArg(s.name)})" title="Profil ansehen">👤</button>
          </div>`;
      }).join('');
    }

    // ---------- Nachrichten laden und anzeigen ----------
    async function loadChatMessages(opts) {
      const o = opts || {};
      const container = chatEl('chatMessagesContainer');
      if (o.initial) container.innerHTML = `<p class="chat-empty">Lade Nachrichten ...</p>`;

      const { data, error } = await _supabase.from('team_chat').select('*').order('created_at', { ascending: true });
      if (error) {
        container.innerHTML = `<p class="chat-empty bad">Fehler: ${escapeHtml(error.message)}</p>`;
        return;
      }
      chatMessagesCache = data || [];

      const r = await _supabase.from('chat_reactions').select('*');
      if (r.error) { chatReactionsAvailable = false; chatReactionsCache = []; }
      else { chatReactionsAvailable = true; chatReactionsCache = r.data || []; }

      renderChat({ initial: !!o.initial, forceBottom: !!o.forceBottom });
    }

    function renderChat(opts) {
      const o = opts || {};
      const container = chatEl('chatMessagesContainer');
      if (!container) return;
      const nearBottom = (container.scrollHeight - container.scrollTop - container.clientHeight) < 90;
      const prevTop = container.scrollTop;
      const prevCount = container.getAttribute('data-count');

      renderChatPinned();

      if (!chatMessagesCache.length) {
        container.innerHTML = `<p class="chat-empty">Noch keine Nachrichten. Starte die Unterhaltung! 💬</p>`;
        chatEl('chatSearchInfo').textContent = '';
        return;
      }

      const res = buildChatMessagesHtml(chatMessagesCache, chatReactionsCache, {
        me: currentWaiterName,
        query: chatSearchQuery,
        seenAt: o.initial || chatSeenAtOpen ? chatSeenAtOpen : null,
        admin: userIsAdmin,
        reactionsAvailable: chatReactionsAvailable,
        pinAvailable: chatMessagesCache.some(m => Object.prototype.hasOwnProperty.call(m, 'is_pinned')) || chatMessagesCache.length === 0
      });
      container.innerHTML = res.html || `<p class="chat-empty">Keine Treffer für „${escapeHtml(chatSearchQuery)}“.</p>`;
      container.setAttribute('data-count', String(chatMessagesCache.length));
      const info = chatEl('chatSearchInfo');
      if (info) info.textContent = chatSearchQuery ? `${res.shown} Treffer` : '';

      const grew = prevCount !== null && Number(prevCount) < chatMessagesCache.length;
      if (o.initial) {
        const div = chatEl('chatNewDivider');
        if (div) container.scrollTop = Math.max(0, div.offsetTop - 60);
        else container.scrollTop = container.scrollHeight;
      } else if (o.forceBottom || (nearBottom && !o.keepPosition)) {
        container.scrollTop = container.scrollHeight;
      } else {
        container.scrollTop = prevTop;
        if (grew) chatEl('chatJumpBtn').classList.remove('hidden');
      }
    }

    function onChatScroll() {
      const c = chatEl('chatMessagesContainer');
      if ((c.scrollHeight - c.scrollTop - c.clientHeight) < 90) chatEl('chatJumpBtn').classList.add('hidden');
    }

    function scrollChatToBottom(smooth) {
      const c = chatEl('chatMessagesContainer');
      c.scrollTo ? c.scrollTo({ top: c.scrollHeight, behavior: smooth ? 'smooth' : 'auto' }) : (c.scrollTop = c.scrollHeight);
      chatEl('chatJumpBtn').classList.add('hidden');
    }

    function scrollToChatMessage(id) {
      const el = chatEl('msg_' + id);
      if (!el) return;
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el.classList.add('flash');
      setTimeout(() => el.classList.remove('flash'), 1600);
    }

    function renderChatPinned() {
      const box = chatEl('chatPinnedBanner');
      if (!box) return;
      const pinned = chatMessagesCache.filter(m => m.is_pinned).pop();
      if (!pinned) { box.classList.add('hidden'); box.innerHTML = ''; return; }
      const snippet = chatStripFormat(pinned.message) || '📷 Foto';
      box.innerHTML = `
        <span class="chat-pinned-ico">📌</span>
        <button type="button" class="chat-pinned-text" onclick="scrollToChatMessage(${jsArg(pinned.id)})">
          <b>${escapeHtml(pinned.author_name)}:</b> ${escapeHtml(snippet.slice(0, 160))}
        </button>
        ${userIsAdmin ? `<button type="button" class="ui-close" onclick="togglePinMessage(${jsArg(pinned.id)})" title="Anheften lösen">&times;</button>` : ''}`;
      box.classList.remove('hidden');
    }

    // ---------- Antworten, Bearbeiten ----------
    function setReplyTarget(msgId, authorName, messageText) {
      cancelEdit();
      chatEl('replyingMessageId').value = msgId;
      chatEl('replyingAuthorName').innerText = authorName;
      chatEl('replyingSnippetText').innerText = chatStripFormat(messageText).slice(0, 120);
      chatEl('replyingIndicatorBox').classList.remove('hidden');
      chatEl('replyingIndicatorBox').classList.add('flex');
      chatEl('chatMessageInput').focus();
    }

    function cancelReply() {
      chatEl('replyingMessageId').value = '';
      chatEl('replyingIndicatorBox').classList.remove('flex');
      chatEl('replyingIndicatorBox').classList.add('hidden');
    }

    function startEditMessage(id) {
      const m = chatMessagesCache.find(x => x.id === id);
      if (!m || String(m.author_name).toLowerCase() !== String(currentWaiterName).toLowerCase()) return;
      cancelReply();
      chatEditingId = id;
      const input = chatEl('chatMessageInput');
      input.value = m.message || '';
      autoGrowChatInput();
      chatEl('editingIndicatorBox').classList.remove('hidden');
      chatEl('editingIndicatorBox').classList.add('flex');
      input.focus();
    }

    function cancelEdit() {
      if (chatEditingId) { const i = chatEl('chatMessageInput'); if (i) { i.value = ''; autoGrowChatInput(); } }
      chatEditingId = null;
      const box = chatEl('editingIndicatorBox');
      if (box) { box.classList.remove('flex'); box.classList.add('hidden'); }
    }

    // ---------- Senden ----------
    async function handleSendChatMessage(e) {
      if (e && e.preventDefault) e.preventDefault();
      const input = chatEl('chatMessageInput');
      const text = input.value.trim();
      if (!text && !chatPendingImage) return;

      // vorhandene Nachricht bearbeiten
      if (chatEditingId) {
        if (!text) return;
        let res = await _supabase.from('team_chat').update({ message: text, edited_at: new Date().toISOString() }).eq('id', chatEditingId).select();
        if (res.error && /edited_at/.test(res.error.message || '')) {
          res = await _supabase.from('team_chat').update({ message: text }).eq('id', chatEditingId).select();
        }
        if (res.error || !res.data || !res.data.length) {
          alert("Die Nachricht konnte nicht geändert werden" + (res.error ? ": " + res.error.message : "."));
          return;
        }
        cancelEdit();
        await loadChatMessages();
        return;
      }

      const row = {
        author_name: currentWaiterName,
        message: text,
        reply_to_id: chatEl('replyingMessageId').value || null
      };
      if (chatPendingImage) row.image_url = chatPendingImage.url;

      const { error } = await _supabase.from('team_chat').insert([row]);
      if (error) {
        alert("Fehler beim Senden: " + error.message);
        return;
      }
      input.value = '';
      autoGrowChatInput();
      cancelReply();
      clearChatImage();
      chatMarkSeen();
      await loadChatMessages({ forceBottom: true });
    }

    async function deleteChatMessage(id) {
      if (!confirm("Möchtest du diese Nachricht löschen?")) return;
      const { error } = await _supabase.from('team_chat').delete().eq('id', id);
      if (error) {
        alert("Fehler beim Löschen: " + error.message);
      } else {
        await loadChatMessages();
      }
    }

    // ---------- Reaktionen, Anpinnen ----------
    function toggleReactionPicker(id) {
      document.querySelectorAll('.chat-picker').forEach(p => { if (p.id !== 'picker_' + id) p.classList.add('hidden'); });
      const p = chatEl('picker_' + id);
      if (p) p.classList.toggle('hidden');
    }

    async function toggleReaction(messageId, emoji) {
      if (!chatReactionsAvailable) return;
      const me = String(currentWaiterName).toLowerCase();
      const existing = chatReactionsCache.find(r => r.message_id === messageId && r.emoji === emoji && String(r.user_name).toLowerCase() === me);
      if (existing) chatReactionsCache = chatReactionsCache.filter(r => r !== existing);
      else chatReactionsCache.push({ message_id: messageId, user_name: currentWaiterName, emoji });
      renderChat({ keepPosition: true });

      let res;
      if (existing) res = await _supabase.from('chat_reactions').delete().eq('message_id', messageId).eq('user_name', currentWaiterName).eq('emoji', emoji);
      else res = await _supabase.from('chat_reactions').insert([{ message_id: messageId, user_name: currentWaiterName, emoji }]);
      if (res.error) {
        showAppToast({ initial: '⚠️', title: 'Reaktion nicht gespeichert', text: res.error.message });
        loadChatMessages();
      }
    }

    async function togglePinMessage(id) {
      if (!userIsAdmin) return;
      const m = chatMessagesCache.find(x => x.id === id);
      if (!m) return;
      const pin = !m.is_pinned;
      if (pin) await _supabase.from('team_chat').update({ is_pinned: false }).eq('is_pinned', true);
      const { error } = await _supabase.from('team_chat').update({ is_pinned: pin }).eq('id', id);
      if (error) {
        showAppToast({ initial: '⚠️', title: 'Anpinnen nicht möglich', text: error.message });
        return;
      }
      await loadChatMessages();
    }

    // ---------- Fotos ----------
    async function onChatImagePicked(event) {
      const file = event.target.files[0];
      event.target.value = '';
      if (!file) return;
      if (!/^image\//.test(file.type)) { alert("Bitte ein Foto auswählen."); return; }
      if (file.size > 8 * 1024 * 1024) { alert("Das Foto ist größer als 8 MB."); return; }
      chatEl('chatImageName').textContent = '⏳ Foto wird hochgeladen ...';
      chatEl('chatImageChip').classList.remove('hidden');
      chatEl('chatImageChip').classList.add('flex');

      const fileName = `chat_${Date.now()}_${safeFileName(file.name)}`;
      const { error } = await _supabase.storage.from('kitchen').upload(fileName, file);
      if (error) {
        clearChatImage();
        alert("Foto konnte nicht hochgeladen werden: " + error.message);
        return;
      }
      const { data } = _supabase.storage.from('kitchen').getPublicUrl(fileName);
      chatPendingImage = { url: data.publicUrl, name: file.name };
      chatEl('chatImageThumb').src = data.publicUrl;
      chatEl('chatImageName').textContent = file.name;
    }

    function clearChatImage() {
      chatPendingImage = null;
      const chip = chatEl('chatImageChip');
      if (chip) { chip.classList.remove('flex'); chip.classList.add('hidden'); }
    }

    // ---------- Eingabefeld: Formatierung, Emoji, @-Vorschläge ----------
    function autoGrowChatInput() {
      const i = chatEl('chatMessageInput');
      if (!i) return;
      i.style.height = 'auto';
      i.style.height = Math.min(i.scrollHeight, 130) + 'px';
    }

    function applyTextStyling(syntaxOpen, syntaxClose) {
      const close = syntaxClose === undefined ? syntaxOpen : syntaxClose;
      const input = chatEl('chatMessageInput');
      const start = input.selectionStart;
      const end = input.selectionEnd;
      const val = input.value;
      const selected = val.substring(start, end);
      const inner = selected || 'Text';
      input.value = val.substring(0, start) + syntaxOpen + inner + close + val.substring(end);
      input.focus();
      input.setSelectionRange(start + syntaxOpen.length, start + syntaxOpen.length + inner.length);
      autoGrowChatInput();
    }

    function insertChatAt() {
      const input = chatEl('chatMessageInput');
      const pos = input.selectionStart;
      const before = input.value.substring(0, pos);
      const needSpace = before.length > 0 && !/\s$/.test(before);
      input.value = before + (needSpace ? ' ' : '') + '@' + input.value.substring(input.selectionEnd);
      const caret = before.length + (needSpace ? 1 : 0) + 1;
      input.focus();
      input.setSelectionRange(caret, caret);
      updateMentionSuggestions();
    }

    function appendChatMention(name) {
      const input = chatEl('chatMessageInput');
      const pos = input.selectionStart == null ? input.value.length : input.selectionStart;
      const before = input.value.substring(0, pos);
      const after = input.value.substring(pos);
      const m = before.match(/(^|\s)@([^\s@]*)$/);
      let newBefore;
      if (m) newBefore = before.substring(0, before.length - m[2].length - 1) + '@' + name + ' ';
      else newBefore = before + (before && !/\s$/.test(before) ? ' ' : '') + '@' + name + ' ';
      input.value = newBefore + after;
      input.focus();
      input.setSelectionRange(newBefore.length, newBefore.length);
      hideMentionDropdown();
      autoGrowChatInput();
    }

    function renderChatEmojiPanel() {
      const p = chatEl('chatEmojiPanel');
      if (!p || p.getAttribute('data-ready')) return;
      p.innerHTML = CHAT_EMOJIS.map(e => `<button type="button" onclick="insertChatEmoji(${jsArg(e)})">${e}</button>`).join('');
      p.setAttribute('data-ready', '1');
    }

    function toggleChatEmojiPanel() { chatEl('chatEmojiPanel').classList.toggle('hidden'); }

    function insertChatEmoji(e) {
      const input = chatEl('chatMessageInput');
      const s = input.selectionStart, en = input.selectionEnd;
      input.value = input.value.substring(0, s) + e + input.value.substring(en);
      input.focus();
      input.setSelectionRange(s + e.length, s + e.length);
      autoGrowChatInput();
    }

    function hideMentionDropdown() {
      chatMention.open = false;
      const dd = chatEl('chatMentionDropdown');
      if (dd) dd.classList.add('hidden');
    }

    function updateMentionSuggestions() {
      const input = chatEl('chatMessageInput');
      if (!input) return;
      const pos = input.selectionStart == null ? input.value.length : input.selectionStart;
      const m = input.value.substring(0, pos).match(/(^|\s)@([^\s@]*)$/);
      if (!m) { hideMentionDropdown(); return; }
      const q = m[2].toLowerCase();
      const me = String(currentWaiterName || '').toLowerCase();
      const all = (staffDatabaseRecords || []).filter(s => s.name && s.name.toLowerCase() !== me);
      const starts = all.filter(s => s.name.toLowerCase().startsWith(q));
      const contains = all.filter(s => !s.name.toLowerCase().startsWith(q) && s.name.toLowerCase().includes(q));
      const items = starts.concat(contains).slice(0, 6);
      if (!items.length) { hideMentionDropdown(); return; }

      let dd = chatEl('chatMentionDropdown');
      if (!dd) {
        dd = document.createElement('div');
        dd.id = 'chatMentionDropdown';
        dd.className = 'chat-mention-dd hidden';
        chatEl('chatForm').appendChild(dd);
      }
      chatMention = { open: true, items, index: 0, start: pos - m[2].length - 1 };
      dd.innerHTML = '';
      items.forEach((s, i) => {
        const row = document.createElement('div');
        row.className = 'chat-mention-item' + (i === 0 ? ' active' : '');
        const av = document.createElement('span');
        av.className = 'chat-mention-av';
        if (s.avatar_url) { const im = document.createElement('img'); im.src = s.avatar_url; im.alt = ''; av.appendChild(im); }
        else av.textContent = s.name.charAt(0).toUpperCase();
        const nm = document.createElement('b');
        nm.textContent = '@' + s.name;
        const rl = document.createElement('small');
        rl.textContent = ({ developer: 'Developer', manager: 'Manager' }[s.role]) || 'Koch';
        row.appendChild(av); row.appendChild(nm); row.appendChild(rl);
        row.addEventListener('mousedown', ev => { ev.preventDefault(); appendChatMention(s.name); });
        dd.appendChild(row);
      });
      dd.classList.remove('hidden');
    }

    function moveMentionIndex(delta) {
      const dd = chatEl('chatMentionDropdown');
      if (!dd || !chatMention.open) return;
      chatMention.index = (chatMention.index + delta + chatMention.items.length) % chatMention.items.length;
      Array.prototype.forEach.call(dd.children, (c, i) => c.classList.toggle('active', i === chatMention.index));
    }

    function sendTypingSignal() {
      const now = Date.now();
      if (now - chatLastTypingSent < 2500 || !chatRealtimeSubscription) return;
      chatLastTypingSent = now;
      try { chatRealtimeSubscription.send({ type: 'broadcast', event: 'typing', payload: { name: currentWaiterName } }); } catch (e) {}
    }

    function handleTypingBroadcast(payload) {
      const name = payload && (payload.name || (payload.payload && payload.payload.name));
      if (!name || String(name).toLowerCase() === String(currentWaiterName).toLowerCase()) return;
      chatTypingUsers[name] = Date.now() + 4500;
      renderTypingIndicator();
      if (!chatTypingTimer) chatTypingTimer = setInterval(renderTypingIndicator, 1000);
    }

    function renderTypingIndicator() {
      const nowMs = Date.now();
      const names = Object.keys(chatTypingUsers).filter(n => chatTypingUsers[n] > nowMs);
      Object.keys(chatTypingUsers).forEach(n => { if (chatTypingUsers[n] <= nowMs) delete chatTypingUsers[n]; });
      const box = chatEl('chatTypingIndicator');
      if (box) {
        box.textContent = names.length === 0 ? '' : (names.length === 1 ? `${names[0]} schreibt ...` : `${names.slice(0, 2).join(' und ')} schreiben ...`);
      }
      renderChatSidebar();
      if (!names.length && chatTypingTimer) { clearInterval(chatTypingTimer); chatTypingTimer = null; }
    }

    function initChatComposer() {
      const input = chatEl('chatMessageInput');
      if (!input || input.getAttribute('data-ready')) return;
      input.setAttribute('data-ready', '1');

      // Touch-Geräte: Antippen einer Nachricht zeigt ihre Aktionen
      const list = chatEl('chatMessagesContainer');
      if (list) list.addEventListener('click', ev => {
        if (!(window.matchMedia && window.matchMedia('(hover: none)').matches)) return;
        const bubble = ev.target.closest && ev.target.closest('.chat-bubble');
        if (!bubble || ev.target.closest('a, img, .chat-quote')) return;
        const row = bubble.closest('.chat-row');
        const open = row.classList.contains('show-actions');
        list.querySelectorAll('.chat-row.show-actions').forEach(r => r.classList.remove('show-actions'));
        if (!open) row.classList.add('show-actions');
      });

      input.addEventListener('input', () => {
        autoGrowChatInput();
        updateMentionSuggestions();
        if (input.value.trim()) sendTypingSignal();
      });
      input.addEventListener('click', updateMentionSuggestions);
      input.addEventListener('blur', () => setTimeout(hideMentionDropdown, 150));
      input.addEventListener('keydown', ev => {
        if (chatMention.open) {
          if (ev.key === 'ArrowDown') { ev.preventDefault(); moveMentionIndex(1); return; }
          if (ev.key === 'ArrowUp') { ev.preventDefault(); moveMentionIndex(-1); return; }
          if (ev.key === 'Enter' || ev.key === 'Tab') { ev.preventDefault(); appendChatMention(chatMention.items[chatMention.index].name); return; }
          if (ev.key === 'Escape') { ev.preventDefault(); hideMentionDropdown(); return; }
        }
        if (ev.key === 'Escape' && (chatEditingId || chatEl('replyingMessageId').value)) { cancelEdit(); cancelReply(); return; }
        if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'b') { ev.preventDefault(); applyTextStyling('**'); return; }
        if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'i') { ev.preventDefault(); applyTextStyling('*'); return; }
        if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) {
          ev.preventDefault();
          handleSendChatMessage({ preventDefault() {} });
        }
      });
    }

    // ---------- Echtzeit, Hinweise, Zähler ----------
    function setupChatRealtimeListener() {
      if (chatRealtimeSubscription) return;
      chatRealtimeSubscription = _supabase
        .channel('team-chat-room')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'team_chat' }, payload => onChatTableChange(payload))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_reactions' }, () => { if (chatIsOpen) loadChatMessages(); })
        .on('broadcast', { event: 'typing' }, payload => handleTypingBroadcast(payload))
        .subscribe();

      checkForUnreadChatMessages();
    }

    function onChatTableChange(payload) {
      const ev = payload && payload.eventType;
      const msg = payload && payload.new;
      if (ev === 'INSERT' && msg) {
        const mine = String(msg.author_name || '').toLowerCase() === String(currentWaiterName).toLowerCase();
        if (!mine) {
          delete chatTypingUsers[msg.author_name];
          if (chatIsOpen) chatMarkSeen();
          else notifyIncomingChat(msg);
        }
      }
      if (chatIsOpen) loadChatMessages();
    }

    function notifyIncomingChat(msg) {
      chatUnreadCount++;
      updateChatEnvelopeBadge(chatUnreadCount);
      const mention = chatMentionsMe(msg.message);
      if (getSetting('chatToast') || mention) {
        const rec = chatStaffByName(msg.author_name);
        showAppToast({
          avatarUrl: rec && rec.avatar_url,
          initial: String(msg.author_name).charAt(0).toUpperCase(),
          title: mention ? msg.author_name + ' hat dich erwähnt' : msg.author_name,
          text: (chatStripFormat(msg.message) || '📷 Foto').slice(0, 90),
          ms: 6000
        });
      }
      if (getSetting('chatSound')) playChatSound();
    }

    async function checkForUnreadChatMessages() {
      const seen = chatGetSeen();
      if (!seen) { chatMarkSeen(); updateChatEnvelopeBadge(0); return; }
      const { data, error } = await _supabase.from('team_chat').select('id,author_name,created_at').gt('created_at', seen).order('created_at', { ascending: true });
      if (error || !Array.isArray(data)) return;
      const me = String(currentWaiterName).toLowerCase();
      chatUnreadCount = data.filter(m => String(m.author_name).toLowerCase() !== me && new Date(m.created_at) > new Date(seen)).length;
      updateChatEnvelopeBadge(chatUnreadCount);
    }

    function updateChatEnvelopeBadge(state) {
      const count = state === true ? 1 : (state === false || !state ? 0 : Number(state));
      const dot = chatEl('headerChatBadgeDot');
      if (dot) dot.classList.toggle('hidden', count <= 0);
      const mb = chatEl('menuChatBadge');
      if (mb) { mb.textContent = count > 99 ? '99+' : String(count); mb.classList.toggle('hidden', count <= 0); }
    }

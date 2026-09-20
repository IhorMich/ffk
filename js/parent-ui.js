/* Parent claim + academy-confirmed child stats (separate from personal Matchcard). */
(function(global){
  function esc(s){
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }
  function toast(msg){
    if(typeof showToast === 'function') showToast(msg);
  }
  function tt(key, fallback){
    try{
      if(typeof t === 'function'){
        const v = t(key);
        if(v && v !== key) return v;
      }
    }catch(e){}
    return fallback || key;
  }

  function playerName(p){
    if(!p) return '—';
    return [p.first_name, p.last_name].filter(Boolean).join(' ') || '—';
  }

  function inboxMessages(){
    const store = global.ParentStore;
    // Always scope to linked children — never dump the whole on-device inbox.
    if(store && typeof store.listInbox === 'function') return store.listInbox();
    if(store && typeof store.linkedPlayerIds === 'function' && global.InboxStore){
      return global.InboxStore.listForPlayers(store.linkedPlayerIds());
    }
    return [];
  }
  function inboxUnread(){
    const store = global.ParentStore;
    if(store && typeof store.unreadInboxCount === 'function') return store.unreadInboxCount();
    if(store && typeof store.linkedPlayerIds === 'function' && global.InboxStore){
      return global.InboxStore.unreadCountForPlayers(store.linkedPlayerIds());
    }
    return 0;
  }
  function inboxRowsHtml(msgs){
    if(!msgs.length){
      return `<div class="inbox-empty">${esc(tt('parentInboxEmpty', 'No messages'))}</div>`;
    }
    return msgs.map(m => {
      const unreadCls = m.status === 'read' ? '' : ' unread';
      const isResult = m.type === 'match_result';
      const head = [m.date, m.opponent].filter(Boolean).join(' · ');
      const meta = [
        m.player_name,
        isResult && m.score ? m.score : (m.address || ''),
        isResult && m.rating ? `★ ${Number(m.rating).toFixed(1)}` : '',
        m.team_name
      ].filter(Boolean).join(' · ');
      const title = isResult
        ? (head || tt('parentInboxResult', 'Match card'))
        : (head || tt('parentInboxMatch', 'Match invite'));
      const rsvpMark = !isResult && m.rsvp === 'accepted'
        ? ' ✓'
        : (!isResult && m.rsvp === 'declined' ? ' ✕' : '');
      return `<button type="button" class="parent-msg-row${unreadCls}${isResult ? ' result' : ''}${m.rsvp === 'accepted' ? ' rsvp-yes' : ''}${m.rsvp === 'declined' ? ' rsvp-no' : ''}" data-parent-msg="${esc(m.id)}">
        <span class="parent-link-main">
          <b>${esc(title)}${esc(rsvpMark)}</b>
          <span>${esc(meta || '—')}</span>
        </span>
        <span class="parent-msg-dot" aria-hidden="true"></span>
      </button>`;
    }).join('');
  }
  function syncInboxBellUi(){
    const btn = document.getElementById('inboxBtn');
    const badge = document.getElementById('inboxBadge');
    if(!btn) return;
    // Coach mode has its own workflow — parent inbox stays in Free / parent mode.
    if(typeof isCoachPlan === 'function' && isCoachPlan()){
      btn.hidden = true;
      btn.classList.remove('has-unread');
      if(badge) badge.hidden = true;
      return;
    }
    const pushOn = !!(global.CoachPush && global.CoachPush.isEnabled && global.CoachPush.isEnabled());
    const msgs = inboxMessages();
    const unread = inboxUnread();
    const links = global.ParentStore && global.ParentStore.listLinks
      ? global.ParentStore.listLinks().length
      : 0;
    const show = pushOn || unread > 0 || msgs.length > 0 || links > 0;
    btn.hidden = !show;
    btn.classList.toggle('has-unread', unread > 0);
    if(badge){
      if(unread > 0){
        badge.hidden = false;
        badge.textContent = unread > 99 ? '99+' : String(unread);
      }else{
        badge.hidden = true;
      }
    }
  }
  function openInboxSheet(){
    const sheet = document.getElementById('inboxSheet');
    const back = document.getElementById('inboxSheetBack');
    const list = document.getElementById('inboxSheetList');
    if(list) list.innerHTML = inboxRowsHtml(inboxMessages());
    if(sheet) sheet.hidden = false;
    // Full-screen inbox — no dimmed bottom-sheet backdrop.
    if(back) back.hidden = true;
    if(typeof pushAppState === 'function') pushAppState('layer');
    syncInboxBellUi();
  }
  function closeInboxSheet(){
    const sheet = document.getElementById('inboxSheet');
    const back = document.getElementById('inboxSheetBack');
    if(sheet) sheet.hidden = true;
    if(back) back.hidden = true;
  }

  function renderParentInbox(){
    // Messages live only in the top inbox — not on the Player profile.
    const card = document.getElementById('parentInboxCard');
    if(card){
      card.hidden = true;
      card.innerHTML = '';
    }
    const sheetList = document.getElementById('inboxSheetList');
    const sheet = document.getElementById('inboxSheet');
    if(sheetList && sheet && !sheet.hidden){
      sheetList.innerHTML = inboxRowsHtml(inboxMessages());
    }
    syncInboxBellUi();
  }

  function fillParentMessageBody(msg){
    const body = document.getElementById('parentMsgBody');
    if(!body || !msg) return;
    const venue = msg.venue === 'away'
      ? tt('venueAway', 'Away')
      : tt('venueHome', 'Home');
    const kindLab = ({
      league: tt('kindLeague', 'League'),
      friendly: tt('kindFriendly', 'Friendly'),
      cup: tt('kindCup', 'Cup'),
      tournament: tt('kindTournament', 'Tournament')
    })[msg.kind] || (msg.kind || '');
    const isResult = msg.type === 'match_result';

    const detailRow = (label, value) => {
      if(value == null || value === '') return '';
      return `<p class="parent-msg-detail"><b>${esc(label)}</b><span>${esc(value)}</span></p>`;
    };

    const resultBlock = isResult
      ? `<div class="parent-msg-result">
          <div class="coach-analytics-sum">
            <div><b>${esc(msg.score || '—')}</b><span>${esc(tt('labelScore', 'Score'))}</span></div>
            <div><b>${esc(msg.rating ? Number(msg.rating).toFixed(1) : '—')}</b><span>${esc(tt('coachQuickScore', 'Rating'))}</span></div>
          </div>
          ${msg.comment ? `<div class="parent-msg-comment">
            <span class="parent-msg-comment-kicker">${esc(tt('parentMsgCommentKicker', 'Coach comment'))}</span>
            <p class="parent-msg-comment-text">${esc(msg.comment)}</p>
          </div>` : ''}
        </div>`
      : '';

    const rsvp = msg.rsvp === 'accepted' || msg.rsvp === 'declined' ? msg.rsvp : '';
    const rsvpBlock = !isResult
      ? `<div class="parent-rsvp parent-rsvp-footer" data-msg-id="${esc(msg.id)}">
          <p class="parent-rsvp-lead">${esc(tt('parentRsvpLead', '{name} is called up for this match. Can they play?')
            .replace('{name}', msg.player_name || tt('parentInboxChild', 'Child')))}</p>
          <div class="parent-rsvp-actions">
            <button type="button" class="parent-rsvp-btn yes${rsvp === 'accepted' ? ' on' : ''}" data-rsvp="accepted" aria-label="${esc(tt('parentRsvpYes', 'Will play'))}">✓</button>
            <button type="button" class="parent-rsvp-btn no${rsvp === 'declined' ? ' on' : ''}" data-rsvp="declined" aria-label="${esc(tt('parentRsvpNo', 'Cannot play'))}">✕</button>
          </div>
          <p class="hint parent-rsvp-status" ${rsvp ? '' : 'hidden'}>${esc(
            rsvp === 'accepted'
              ? tt('parentRsvpYesDone', 'Confirmed — will play.')
              : rsvp === 'declined'
                ? tt('parentRsvpNoDone', 'Declined — cannot play.')
                : ''
          )}</p>
        </div>`
      : '';

    body.innerHTML = `
      <div class="parent-confirm-badge">${esc(isResult
        ? tt('parentInboxResultFromCoach', 'Match card from coach')
        : tt('parentInboxMatch', 'Match invite'))}</div>
      <h3 class="coach-rate-name">${esc(msg.opponent || '—')}</h3>
      <div class="parent-msg-details">
        ${detailRow(tt('labelDate', 'Date'), msg.date || '')}
        ${detailRow(tt('coachMatchMeetup', 'Meetup time'), msg.meetup || '')}
        ${detailRow(tt('coachMatchKickoff', 'Kick-off'), msg.kickoff || '')}
        ${detailRow(
          tt('coachMatchFee', 'Entry fee'),
          msg.fee_type === 'paid'
            ? (msg.fee
              ? msg.fee
              : tt('coachMatchFeePaid', 'Paid entry'))
            : tt('coachMatchFeeFree', 'Free')
        )}
        ${detailRow(tt('labelVenue', 'Venue'), venue)}
        ${detailRow(tt('coachMatchKind', 'Match type'), kindLab)}
        ${!isResult && msg.tournament
          ? detailRow(tt('labelCompTournament', 'Tournament'), msg.tournament)
          : ''}
        ${!isResult && msg.address
          ? detailRow(tt('coachMatchAddress', 'Match address'), msg.address)
          : ''}
        ${detailRow(tt('parentInboxChild', 'Child'), msg.player_name || '')}
        ${detailRow(tt('parentCoachLabel', 'Coach'), msg.coach_name || '')}
        ${detailRow(
          tt('parentInboxTeam', 'Team'),
          [msg.academy_name, msg.team_name].filter(Boolean).join(' · ')
        )}
      </div>
      ${resultBlock}
      ${rsvpBlock}
      <button type="button" class="ghost-btn" id="parentMsgCloseBtn">${esc(tt('btnClose', 'Close'))}</button>
    `;
  }

  function openParentMessage(id){
    const msg = global.InboxStore && global.InboxStore.get(id);
    if(!msg) return;
    const sheet = document.getElementById('parentMsgSheet');
    const back = document.getElementById('parentMsgBack');
    const body = document.getElementById('parentMsgBody');
    if(!sheet || !body) return;

    const alreadyOpen = !sheet.hidden;
    fillParentMessageBody(msg);

    if(!alreadyOpen){
      const card = document.getElementById('parentMsgCard');
      if(typeof presentSheetCard === 'function') presentSheetCard(card, back);
      else{
        sheet.hidden = false;
        if(back) back.hidden = false;
      }
      if(typeof pushAppState === 'function') pushAppState('layer');
    }

    // Mark read only after the sheet is actually shown (above the inbox page).
    if(global.InboxStore) global.InboxStore.markRead(id);
    try{
      const coach = global.CoachStore;
      const session = coach && coach.getSession && coach.getSession();
      if(session && msg.match_id && typeof coach.syncInviteReadStatuses === 'function'){
        coach.syncInviteReadStatuses(session, msg.match_id);
      }
    }catch(e){}

    renderParentInbox();
    syncInboxBellUi();
  }

  function onParentRsvp(btn){
    const body = document.getElementById('parentMsgBody');
    if(body && body.dataset.rsvpBusy === '1') return;
    const wrap = btn.closest('.parent-rsvp');
    const msgId = wrap && wrap.dataset.msgId;
    const response = btn.dataset.rsvp;
    if(!msgId || !response || !global.InboxStore) return;
    if(body) body.dataset.rsvpBusy = '1';
    try{
      const row = global.InboxStore.setMatchInviteRsvp(msgId, response);
      toast(response === 'accepted'
        ? tt('parentRsvpYesDone', 'Confirmed — will play.')
        : tt('parentRsvpNoDone', 'Declined — cannot play.'));
      // Update the open card in place — do not re-open / re-animate the sheet.
      fillParentMessageBody(row);
      renderParentInbox();
      syncInboxBellUi();
    }catch(e){
      toast(tt('coachErrGeneric', 'Something went wrong.'));
    }finally{
      // Keep a short lock so the same tap cannot re-fire on the rebuilt buttons.
      setTimeout(() => {
        const el = document.getElementById('parentMsgBody');
        if(el) el.dataset.rsvpBusy = '';
      }, 400);
    }
  }
  function closeParentMsgSheet(){
    const card = document.getElementById('parentMsgCard');
    const back = document.getElementById('parentMsgBack');
    if(typeof hideSheetCard === 'function') hideSheetCard(card, back);
    else{
      const sheet = document.getElementById('parentMsgSheet');
      if(sheet) sheet.hidden = true;
      if(back) back.hidden = true;
    }
    syncInboxBellUi();
  }

  function renderParentLinks(){
    const store = global.ParentStore;
    const box = document.getElementById('parentLinksList');
    const root = document.getElementById('parentLinksCard');
    if(!box || !root || !store) return;
    if(typeof isCoachPlan === 'function' && isCoachPlan()){
      root.hidden = true;
      return;
    }
    root.hidden = false;
    const links = store.listLinks();
    if(!links.length){
      box.innerHTML = `<p class="hint">${esc(tt('parentLinksEmpty', 'No academy link yet. Ask the coach for a QR or invite link.'))}</p>`;
      return;
    }
    box.innerHTML = links.map(l => {
      const name = playerName(l.player);
      const meta = [
        l.player && l.player.number ? `#${l.player.number}` : '',
        l.team && l.team.name ? l.team.name : '',
        l.academy && l.academy.name ? l.academy.name : ''
      ].filter(Boolean).join(' · ');
      const avg = l.avg != null ? Number(l.avg).toFixed(1) : '—';
      return `<button type="button" class="parent-link-row" data-parent-link="${esc(l.id)}">
        <span class="parent-link-main">
          <b>${esc(name)}</b>
          <span>${esc(meta)}</span>
        </span>
        <span class="parent-link-avg">${esc(avg)}</span>
      </button>`;
    }).join('');
  }

  function renderParentCoachStats(){
    const store = global.ParentStore;
    const panel = document.getElementById('parentCoachStatsPanel');
    const board = document.getElementById('parentCoachStatsBoard');
    if(!panel || !board || !store) return;
    if(typeof isCoachPlan === 'function' && isCoachPlan()){
      panel.hidden = true;
      return;
    }
    const links = store.listLinks();
    if(!links.length){
      panel.hidden = true;
      board.innerHTML = '';
      return;
    }
    panel.hidden = false;
    board.innerHTML = links.map(l => {
      const name = playerName(l.player);
      const confirmBits = [
        `<div class="parent-confirm-badge">${esc(tt('parentConfirmed', 'Confirmed by academy'))}</div>`,
        `<h3 class="coach-team-heading">${esc(name)}</h3>`,
        `<p class="hint">${esc([
          l.academy && l.academy.name,
          l.team && l.team.name,
          l.team && l.team.age_group,
          l.coach && l.coach.name ? `${tt('parentCoachLabel', 'Coach')}: ${l.coach.name}` : ''
        ].filter(Boolean).join(' · '))}</p>`
      ].join('');
      const sum = `<div class="coach-analytics-sum">
        <div><b>${esc(l.games || (l.ratings || []).length || 0)}</b><span>${esc(tt('coachStatRatings', 'Ratings'))}</span></div>
        <div><b>${esc(l.avg != null ? Number(l.avg).toFixed(1) : '—')}</b><span>${esc(tt('parentCoachAvg', 'Coach avg'))}</span></div>
        <div><b>${esc((l.ratings || []).length)}</b><span>${esc(tt('parentInInvite', 'In invite'))}</span></div>
      </div>`;
      const rows = (l.ratings || []).length
        ? `<div class="coach-player-list">${(l.ratings || []).map(r => {
            const head = [r.date, r.opponent, r.score].filter(Boolean).join(' · ');
            return `<div class="coach-player-row">
              <div class="coach-player-main">
                <b>${esc(head || '—')}</b>
                ${r.comment ? `<span>${esc(r.comment)}</span>` : ''}
              </div>
              <b class="parent-rate-num">${esc(Number(r.rating).toFixed(1))}</b>
            </div>`;
          }).join('')}</div>`
        : `<p class="hint">${esc(tt('parentNoCoachRatings', 'Coach has not shared ratings in this invite yet.'))}</p>`;
      return `<div class="parent-coach-block">${confirmBits}${sum}${rows}</div>`;
    }).join('');
  }

  function openParentClaimSheet(prefill){
    if(typeof isCoachPlan === 'function' && isCoachPlan()){
      toast(tt('parentNotInCoach', 'Switch off Coach plan to add a child as a parent.'));
      return;
    }
    const back = document.getElementById('parentClaimBack');
    const card = document.getElementById('parentClaimCard');
    const input = document.getElementById('parentClaimInput');
    const preview = document.getElementById('parentClaimPreview');
    if(input) input.value = prefill || '';
    if(preview) preview.innerHTML = '';
    if(typeof presentSheetCard === 'function') presentSheetCard(card, back);
    else{
      const sheet = document.getElementById('parentClaimSheet');
      if(sheet) sheet.hidden = false;
      if(back) back.hidden = false;
    }
    if(prefill) previewClaim();
    if(typeof pushAppState === 'function') pushAppState('layer');
  }
  function closeParentClaimSheet(){
    const card = document.getElementById('parentClaimCard');
    const back = document.getElementById('parentClaimBack');
    if(typeof hideSheetCard === 'function') hideSheetCard(card, back);
    else{
      const sheet = document.getElementById('parentClaimSheet');
      if(sheet) sheet.hidden = true;
      if(back) back.hidden = true;
    }
  }
  function previewClaim(){
    const store = global.ParentStore;
    const input = document.getElementById('parentClaimInput');
    const preview = document.getElementById('parentClaimPreview');
    if(!store || !preview) return null;
    try{
      const payload = store.parseInviteInput(input && input.value);
      store.setPending(payload);
      const name = playerName(payload.player);
      preview.innerHTML = `<div class="parent-confirm-card">
        <div class="parent-confirm-badge">${esc(tt('parentConfirmed', 'Confirmed by academy'))}</div>
        <b>${esc(name)}</b>
        <span>${esc([
          payload.player.number ? `#${payload.player.number}` : '',
          payload.player.position || ''
        ].filter(Boolean).join(' · '))}</span>
        <p class="hint">${esc([
          payload.academy.name,
          payload.team.name,
          payload.team.age_group,
          payload.coach.name ? `${tt('parentCoachLabel', 'Coach')}: ${payload.coach.name}` : ''
        ].filter(Boolean).join(' · '))}</p>
        <p class="hint">${esc(tt('parentClaimHint', 'Personal Matchcard stats stay yours. Coach ratings appear separately.'))}</p>
      </div>`;
      return payload;
    }catch(e){
      preview.innerHTML = `<p class="hint">${esc(tt('parentBadInvite', 'Could not read this invite. Paste the full link or MC-code.'))}</p>`;
      return null;
    }
  }
  function confirmClaim(){
    const store = global.ParentStore;
    if(!store) return;
    let payload = store.getPending();
    if(!payload) payload = previewClaim();
    if(!payload){
      toast(tt('parentBadInvite', 'Could not read this invite. Paste the full link or MC-code.'));
      return;
    }
    try{
      store.claim(payload);
      closeParentClaimSheet();
      renderParentUi();
      toast(tt('parentClaimed', 'Child linked. Academy info and coach stats are ready.'));
      if(typeof showView === 'function') showView('player');
    }catch(e){
      toast(tt('parentBadInvite', 'Could not read this invite. Paste the full link or MC-code.'));
    }
  }

  function openParentLinkDetail(id){
    const store = global.ParentStore;
    const link = store && store.getLink(id);
    if(!link) return;
    const sheet = document.getElementById('parentLinkSheet');
    const back = document.getElementById('parentLinkBack');
    const body = document.getElementById('parentLinkBody');
    const card = document.getElementById('parentLinkCard');
    if(!sheet || !body) return;
    const name = playerName(link.player);
    body.innerHTML = `
      <div class="parent-confirm-badge">${esc(tt('parentConfirmed', 'Confirmed by academy'))}</div>
      <h3 class="coach-rate-name">${esc(name)}</h3>
      <p class="hint">${esc([
        link.player.number ? `#${link.player.number}` : '',
        link.player.position || '',
        link.academy && link.academy.name,
        link.team && link.team.name,
        link.team && link.team.age_group
      ].filter(Boolean).join(' · '))}</p>
      <p class="hint"><b>${esc(tt('parentCoachLabel', 'Coach'))}:</b> ${esc(link.coach && link.coach.name ? link.coach.name : '—')}</p>
      <div class="coach-analytics-sum">
        <div><b>${esc(link.games || 0)}</b><span>${esc(tt('coachGames', 'games'))}</span></div>
        <div><b>${esc(link.avg != null ? Number(link.avg).toFixed(1) : '—')}</b><span>${esc(tt('parentCoachAvg', 'Coach avg'))}</span></div>
      </div>
      <p class="hint">${esc(tt('parentPersonalNote', 'Your sideline Matchcard ratings stay in History / Stats as before.'))}</p>
      <button type="button" class="ghost-btn" id="parentUnlinkBtn" data-unlink="${esc(link.id)}">${esc(tt('parentUnlink', 'Remove academy link'))}</button>
    `;
    if(typeof presentSheetCard === 'function') presentSheetCard(card, back);
    else{
      sheet.hidden = false;
      if(back) back.hidden = false;
    }
    if(typeof pushAppState === 'function') pushAppState('layer');
  }
  function closeParentLinkSheet(){
    const card = document.getElementById('parentLinkCard');
    const back = document.getElementById('parentLinkBack');
    if(typeof hideSheetCard === 'function') hideSheetCard(card, back);
    else{
      const sheet = document.getElementById('parentLinkSheet');
      if(sheet) sheet.hidden = true;
      if(back) back.hidden = true;
    }
  }

  function ingestDeepLink(url){
    const store = global.ParentStore;
    if(!store || !url) return false;
    try{
      const payload = store.parseInviteInput(String(url));
      store.setPending(payload);
      openParentClaimSheet(String(url));
      return true;
    }catch(e){
      return false;
    }
  }

  function checkLaunchParentInvite(){
    try{
      const q = location.search || '';
      const h = location.hash || '';
      const blob = q + h;
      if(/ffk_parent=|[#&?]d=/.test(blob) || /ffk:\/\/parent/.test(location.href)){
        ingestDeepLink(location.href);
      }
    }catch(e){}
    try{
      const C = global.Capacitor;
      const App = C && C.Plugins && C.Plugins.App;
      if(App && typeof App.getLaunchUrl === 'function'){
        App.getLaunchUrl().then(res => {
          if(res && res.url) ingestDeepLink(res.url);
        }).catch(() => {});
      }
      if(App && typeof App.addListener === 'function' && !global.__ffkParentUrlBound){
        global.__ffkParentUrlBound = true;
        App.addListener('appUrlOpen', ev => {
          if(ev && ev.url) ingestDeepLink(ev.url);
        });
      }
    }catch(e){}
  }

  function renderParentUi(){
    renderParentInbox();
    renderParentLinks();
    renderParentCoachStats();
    syncInboxBellUi();
  }

  function bindParentUi(){
    if(global.__ffkParentBound) return;
    global.__ffkParentBound = true;
    document.getElementById('parentAddLinkBtn')?.addEventListener('click', () => openParentClaimSheet(''));
    document.getElementById('parentClaimBack')?.addEventListener('click', () => closeParentClaimSheet());
    document.getElementById('parentClaimCancelBtn')?.addEventListener('click', () => closeParentClaimSheet());
    document.getElementById('parentClaimPreviewBtn')?.addEventListener('click', () => previewClaim());
    document.getElementById('parentClaimConfirmBtn')?.addEventListener('click', () => confirmClaim());
    document.getElementById('parentLinkBack')?.addEventListener('click', () => closeParentLinkSheet());
    document.getElementById('parentMsgBack')?.addEventListener('click', () => closeParentMsgSheet());
    document.getElementById('inboxBtn')?.addEventListener('click', () => openInboxSheet());
    document.getElementById('inboxSheetBack')?.addEventListener('click', () => closeInboxSheet());
    document.getElementById('inboxSheetCloseBtn')?.addEventListener('click', () => closeInboxSheet());
    document.getElementById('inboxSheetList')?.addEventListener('click', e => {
      const btn = e.target.closest('[data-parent-msg]');
      if(!btn) return;
      openParentMessage(btn.dataset.parentMsg);
    });
    document.getElementById('parentMsgBody')?.addEventListener('click', e => {
      if(e.target.closest('#parentMsgCloseBtn')){
        e.preventDefault();
        e.stopPropagation();
        closeParentMsgSheet();
        return;
      }
      const rsvpBtn = e.target.closest('[data-rsvp]');
      if(rsvpBtn){
        e.preventDefault();
        e.stopPropagation();
        onParentRsvp(rsvpBtn);
      }
    });
    document.getElementById('parentLinksList')?.addEventListener('click', e => {
      const btn = e.target.closest('[data-parent-link]');
      if(!btn) return;
      openParentLinkDetail(btn.dataset.parentLink);
    });
    document.getElementById('parentLinkBody')?.addEventListener('click', e => {
      const btn = e.target.closest('[data-unlink]');
      if(!btn) return;
      global.ParentStore.removeLink(btn.dataset.unlink);
      closeParentLinkSheet();
      renderParentUi();
      toast(tt('parentUnlinked', 'Academy link removed.'));
    });
    checkLaunchParentInvite();
    syncInboxBellUi();
  }

  global.renderParentUi = renderParentUi;
  global.bindParentUi = bindParentUi;
  global.syncInboxBellUi = syncInboxBellUi;
  global.openInboxSheet = openInboxSheet;
  global.closeInboxSheet = closeInboxSheet;
  global.openParentClaimSheet = openParentClaimSheet;
  global.closeParentClaimSheet = closeParentClaimSheet;
  global.closeParentLinkSheet = closeParentLinkSheet;
  global.ingestParentDeepLink = ingestDeepLink;
  global.closeParentMsgSheet = closeParentMsgSheet;
})(window);

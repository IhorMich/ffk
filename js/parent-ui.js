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
      return `<button type="button" class="parent-msg-row${unreadCls}${isResult ? ' result' : ''}" data-parent-msg="${esc(m.id)}">
        <span class="parent-link-main">
          <b>${esc(title)}</b>
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
    const pushOn = !!(global.CoachPush && global.CoachPush.isEnabled && global.CoachPush.isEnabled());
    const msgs = inboxMessages();
    const unread = inboxUnread();
    const links = global.ParentStore && global.ParentStore.listLinks
      ? global.ParentStore.listLinks().length
      : 0;
    // Top messages icon like other apps — independent of Coach / parent plan.
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
    const store = global.ParentStore;
    const card = document.getElementById('parentInboxCard');
    const list = document.getElementById('parentInboxList');
    if(!card || !list || !store){
      syncInboxBellUi();
      return;
    }
    if(typeof isCoachPlan === 'function' && isCoachPlan()){
      card.hidden = true;
      syncInboxBellUi();
      return;
    }
    const links = store.listLinks();
    if(!links.length){
      card.hidden = true;
      list.innerHTML = '';
      syncInboxBellUi();
      return;
    }
    card.hidden = false;
    const msgs = store.listInbox();
    const unread = store.unreadInboxCount();
    const title = card.querySelector('h3');
    if(title){
      const base = tt('parentInboxTitle', 'Messages');
      title.textContent = unread ? `${base} (${unread})` : base;
    }
    list.innerHTML = inboxRowsHtml(msgs);
    const sheetList = document.getElementById('inboxSheetList');
    const sheet = document.getElementById('inboxSheet');
    if(sheetList && sheet && !sheet.hidden) sheetList.innerHTML = inboxRowsHtml(msgs);
    syncInboxBellUi();
  }

  function openParentMessage(id){
    const msg = global.InboxStore && global.InboxStore.get(id);
    if(!msg) return;
    if(global.InboxStore) global.InboxStore.markRead(id);
    // Reflect read status back to coach invites on this device
    try{
      const coach = global.CoachStore;
      const session = coach && coach.getSession && coach.getSession();
      if(session && msg.match_id && typeof coach.syncInviteReadStatuses === 'function'){
        coach.syncInviteReadStatuses(session, msg.match_id);
      }
    }catch(e){}
    const sheet = document.getElementById('parentMsgSheet');
    const back = document.getElementById('parentMsgBack');
    const body = document.getElementById('parentMsgBody');
    if(!sheet || !body) return;
    const venue = msg.venue === 'away'
      ? tt('venueAway', 'Away')
      : tt('venueHome', 'Home');
    const isResult = msg.type === 'match_result';
    const resultBlock = isResult
      ? `<div class="parent-msg-result">
          <div class="coach-analytics-sum">
            <div><b>${esc(msg.score || '—')}</b><span>${esc(tt('labelScore', 'Score'))}</span></div>
            <div><b>${esc(msg.rating ? Number(msg.rating).toFixed(1) : '—')}</b><span>${esc(tt('coachQuickScore', 'Rating'))}</span></div>
          </div>
          ${msg.comment ? `<p class="hint"><b>${esc(tt('coachQuickComment', 'Comment'))}:</b> ${esc(msg.comment)}</p>` : ''}
        </div>`
      : '';
    body.innerHTML = `
      <div class="parent-confirm-badge">${esc(isResult
        ? tt('parentInboxResultFromCoach', 'Match card from coach')
        : tt('parentInboxFromCoach', 'From coach'))}</div>
      <h3 class="coach-rate-name">${esc(msg.opponent || '—')}</h3>
      <p class="hint">${esc([msg.date, venue, msg.kind].filter(Boolean).join(' · '))}</p>
      ${msg.address && !isResult ? `<p class="hint"><b>${esc(tt('coachMatchAddress', 'Match address'))}:</b> ${esc(msg.address)}</p>` : ''}
      <p class="hint"><b>${esc(tt('parentInboxChild', 'Child'))}:</b> ${esc(msg.player_name || '—')}</p>
      <p class="hint"><b>${esc(tt('parentCoachLabel', 'Coach'))}:</b> ${esc(msg.coach_name || '—')}</p>
      <p class="hint"><b>${esc(tt('parentInboxTeam', 'Team'))}:</b> ${esc([msg.academy_name, msg.team_name].filter(Boolean).join(' · ') || '—')}</p>
      ${resultBlock}
      <button type="button" class="ghost-btn" id="parentMsgCloseBtn">${esc(tt('previewCancel', 'Close'))}</button>
    `;
    const card = document.getElementById('parentMsgCard');
    if(typeof presentSheetCard === 'function') presentSheetCard(card, back);
    else{
      sheet.hidden = false;
      if(back) back.hidden = false;
    }
    if(typeof pushAppState === 'function') pushAppState('layer');
    renderParentInbox();
    if(typeof renderCoachUi === 'function') renderCoachUi();
    syncInboxBellUi();
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
    document.getElementById('parentInboxList')?.addEventListener('click', e => {
      const btn = e.target.closest('[data-parent-msg]');
      if(!btn) return;
      openParentMessage(btn.dataset.parentMsg);
    });
    document.getElementById('inboxSheetList')?.addEventListener('click', e => {
      const btn = e.target.closest('[data-parent-msg]');
      if(!btn) return;
      openParentMessage(btn.dataset.parentMsg);
    });
    document.getElementById('parentMsgBody')?.addEventListener('click', e => {
      if(e.target.closest('#parentMsgCloseBtn')) closeParentMsgSheet();
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

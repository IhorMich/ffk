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

  function verifiedBadgeHtml(){
    const label = tt('parentVerifiedByCoach', 'Verified by coach');
    return `<span class="verified-badge" title="${esc(label)}" aria-label="${esc(label)}"><svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="8" cy="8" r="8" fill="currentColor"/><path d="M4.6 8.15l2.15 2.15 4.7-4.85" fill="none" stroke="#fff" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;
  }
  function nameWithVerified(name, on){
    const text = esc(name || '—');
    if(!on) return text;
    return `<span class="name-with-verified"><span class="name-with-verified-text">${text}</span>${verifiedBadgeHtml()}</span>`;
  }
  function normNamePart(s){
    return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }
  function isCoachVerifiedPerson(first, last){
    const store = global.ParentStore;
    if(!store || typeof store.listLinks !== 'function') return false;
    const links = store.listLinks();
    if(!links.length) return false;
    const f = normNamePart(first);
    const l = normNamePart(last);
    if(!f && !l) return false;
    const full = [f, l].filter(Boolean).join(' ');
    return links.some(link => {
      const p = link && link.player;
      if(!p) return false;
      const pf = normNamePart(p.first_name);
      const pl = normNamePart(p.last_name);
      const pfull = [pf, pl].filter(Boolean).join(' ');
      if(full && pfull && full === pfull) return true;
      if(f && l && pf === f && pl === l) return true;
      // Soft match: same first name when last is empty on one side
      if(f && pf === f && (!l || !pl || pl === l)) return true;
      return false;
    });
  }
  function isCoachVerifiedPlayer(p){
    if(!p) return false;
    return isCoachVerifiedPerson(
      p.first_name || p.firstName,
      p.last_name || p.lastName
    );
  }
  /** Any academy/coach link on this phone → personal profile counts as verified. */
  function hasAnyCoachLink(){
    const store = global.ParentStore;
    if(!store || typeof store.listLinks !== 'function') return false;
    const personalId = typeof store.currentPersonalPlayerId === 'function'
      ? store.currentPersonalPlayerId()
      : '';
    if(personalId && typeof store.linksForPersonalPlayer === 'function'){
      return store.linksForPersonalPlayer(personalId).length > 0;
    }
    return store.listLinks().length > 0;
  }

  function inboxMessages(){
    if(typeof isCoachPlan === 'function' && isCoachPlan()){
      return global.InboxStore && typeof global.InboxStore.listForCoach === 'function'
        ? global.InboxStore.listForCoach()
        : [];
    }
    const store = global.ParentStore;
    const personalId = store && typeof store.currentPersonalPlayerId === 'function'
      ? store.currentPersonalPlayerId()
      : '';
    // Always scope to linked children — never dump the whole on-device inbox.
    if(store && typeof store.listInbox === 'function') return store.listInbox(personalId);
    if(store && typeof store.linkedPlayerIds === 'function' && global.InboxStore){
      return global.InboxStore.listForPlayers(store.linkedPlayerIds(personalId));
    }
    return [];
  }
  function inboxUnread(){
    if(typeof isCoachPlan === 'function' && isCoachPlan()){
      return global.InboxStore && typeof global.InboxStore.unreadCountForCoach === 'function'
        ? global.InboxStore.unreadCountForCoach()
        : 0;
    }
    const store = global.ParentStore;
    const personalId = store && typeof store.currentPersonalPlayerId === 'function'
      ? store.currentPersonalPlayerId()
      : '';
    if(store && typeof store.unreadInboxCount === 'function') return store.unreadInboxCount(personalId);
    if(store && typeof store.linkedPlayerIds === 'function' && global.InboxStore){
      return global.InboxStore.unreadCountForPlayers(store.linkedPlayerIds(personalId));
    }
    return 0;
  }
  function chatTargets(){
    const coachMode = typeof isCoachPlan === 'function' && isCoachPlan();
    if(coachMode){
      const coach = global.CoachStore;
      const session = coach && coach.getSession && coach.getSession();
      const academy = session && coach.myAcademy && coach.myAcademy(session);
      if(!session || !academy) return [];
      const teams = coach.listTeams ? coach.listTeams(session, academy.id) : [];
      const out = [];
      teams.forEach(team => {
        (coach.listPlayers ? coach.listPlayers(session, team.id) : []).forEach(player => {
          if(typeof coach.parentLinkedForPlayer === 'function' && !coach.parentLinkedForPlayer(player.id)) return;
          out.push({
            team_player_id: player.id,
            team_id: team.id,
            player_name: [player.first_name, player.last_name].filter(Boolean).join(' '),
            team_name: team.name || '',
            academy_name: academy.name || ''
          });
        });
      });
      return out;
    }
    const parent = global.ParentStore;
    const personalId = parent && parent.currentPersonalPlayerId ? parent.currentPersonalPlayerId() : '';
    const links = parent && parent.linksForPersonalPlayer
      ? parent.linksForPersonalPlayer(personalId)
      : [];
    return links.map(link => ({
      team_player_id: link.player && link.player.id,
      team_id: link.team && link.team.id,
      player_name: playerName(link.player),
      team_name: link.team && link.team.name || '',
      academy_name: link.academy && link.academy.name || '',
      coach_name: link.coach && link.coach.name || ''
    })).filter(x => x.team_player_id);
  }
  function renderInboxComposer(){
    const wrap = document.getElementById('inboxComposer');
    const select = document.getElementById('inboxChatPlayer');
    if(!wrap || !select) return;
    const targets = chatTargets();
    wrap.hidden = !targets.length;
    if(!targets.length){
      select.innerHTML = '';
      return;
    }
    const previous = select.value;
    select.innerHTML = targets.map(target =>
      `<option value="${esc(target.team_player_id)}">${esc([
        target.player_name,
        target.team_name
      ].filter(Boolean).join(' · '))}</option>`
    ).join('');
    if(targets.some(t => String(t.team_player_id) === previous)) select.value = previous;
    select.hidden = targets.length === 1;
  }
  function sendChatMessage(){
    const select = document.getElementById('inboxChatPlayer');
    const textEl = document.getElementById('inboxChatText');
    const text = String(textEl && textEl.value || '').trim();
    const target = chatTargets().find(t => String(t.team_player_id) === String(select && select.value));
    if(!target || !text || !global.InboxStore || typeof global.InboxStore.sendChatMessage !== 'function') return;
    const coachMode = typeof isCoachPlan === 'function' && isCoachPlan();
    try{
      global.InboxStore.sendChatMessage({
        ...target,
        sender_role: coachMode ? 'coach' : 'parent',
        text
      });
      if(textEl) textEl.value = '';
      renderParentInbox();
      toast(tt('chatSent', 'Message sent.'));
    }catch(e){
      toast(tt('coachErrGeneric', 'Something went wrong.'));
    }
  }
  function inboxRowsHtml(msgs){
    if(!msgs.length){
      return `<div class="inbox-empty">${esc(tt('parentInboxEmpty', 'No messages'))}</div>`;
    }
    return msgs.map(m => {
      const unreadCls = m.status === 'read' ? '' : ' unread';
      const isCoachLeave = m.type === 'coach_leave_request';
      if(isCoachLeave){
        const where = [m.new_club, m.new_team].filter(Boolean).join(' · ') || '—';
        const decision = m.decision === 'accepted'
          ? ` · ${tt('coachLeaveAcceptedShort', 'Accepted')}`
          : (m.decision === 'declined' ? ` · ${tt('coachLeaveDeclinedShort', 'Declined')}` : '');
        return `<button type="button" class="parent-msg-row${unreadCls}" data-parent-msg="${esc(m.id)}">
          <span class="parent-link-main">
            <b>${esc(tt('coachLeaveKicker', 'Leave request'))}${esc(decision)}</b>
            <span>${esc([m.player_name, where].filter(Boolean).join(' · '))}</span>
          </span>
          <span class="parent-msg-dot" aria-hidden="true"></span>
        </button>`;
      }
      if(m.type === 'player_leave_decision'){
        return `<button type="button" class="parent-msg-row${unreadCls}" data-parent-msg="${esc(m.id)}">
          <span class="parent-link-main">
            <b>${esc(tt('playerLeaveDeclinedShort', 'Leave declined'))}</b>
            <span>${esc([m.player_name, m.team_name, m.academy_name].filter(Boolean).join(' · '))}</span>
          </span>
          <span class="parent-msg-dot" aria-hidden="true"></span>
        </button>`;
      }
      if(m.type === 'chat_message'){
        const fromCoach = m.sender_role === 'coach';
        const title = fromCoach
          ? tt('chatFromCoach', 'Coach')
          : (m.player_name || tt('chatFromPlayer', 'Player / parent'));
        return `<button type="button" class="parent-msg-row${unreadCls}" data-parent-msg="${esc(m.id)}">
          <span class="parent-link-main">
            <b>${esc(title)}</b>
            <span>${esc(m.text || '')}</span>
          </span>
          <span class="parent-msg-dot" aria-hidden="true"></span>
        </button>`;
      }
      const isResult = m.type === 'match_result';
      const notice = !isResult ? (m.invite_notice || '') : '';
      const head = [m.date, m.opponent].filter(Boolean).join(' · ');
      const meta = [
        m.player_name,
        isResult && m.score ? m.score : (m.address || ''),
        isResult && m.rating ? `★ ${Number(m.rating).toFixed(1)}` : '',
        m.team_name
      ].filter(Boolean).join(' · ');
      const title = isResult
        ? (head || tt('parentInboxResult', 'Match card'))
        : (notice === 'cancelled'
          ? (head
            ? `${tt('parentInboxMatchCancelled', 'Match cancelled')} · ${head}`
            : tt('parentInboxMatchCancelled', 'Match cancelled'))
          : notice === 'recalled'
            ? (head
              ? `${tt('parentInboxMatchRecalled', 'Not called up')} · ${head}`
              : tt('parentInboxMatchRecalled', 'Not called up'))
            : notice === 'updated'
              ? (head
                ? `${tt('parentInboxMatchUpdated', 'Match updated')} · ${head}`
                : tt('parentInboxMatchUpdated', 'Match updated'))
              : (head || tt('parentInboxMatch', 'Match invite')));
      const rsvpMark = !isResult && !notice && m.rsvp === 'accepted'
        ? ' ✓'
        : (!isResult && !notice && m.rsvp === 'declined' ? ' ✕' : '');
      return `<button type="button" class="parent-msg-row${unreadCls}${isResult ? ' result' : ''}${notice ? ` notice-${notice}` : ''}${m.rsvp === 'accepted' ? ' rsvp-yes' : ''}${m.rsvp === 'declined' ? ' rsvp-no' : ''}" data-parent-msg="${esc(m.id)}">
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
    if(typeof isCoachPlan === 'function' && isCoachPlan()){
      const msgs = inboxMessages();
      const unread = inboxUnread();
      btn.hidden = msgs.length === 0;
      btn.classList.toggle('has-unread', unread > 0);
      if(badge){
        badge.hidden = unread === 0;
        if(unread > 0) badge.textContent = unread > 99 ? '99+' : String(unread);
      }
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
    renderInboxComposer();
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
      renderInboxComposer();
    }
    syncInboxBellUi();
  }

  function fillParentMessageBody(msg){
    const body = document.getElementById('parentMsgBody');
    if(!body || !msg) return;
    if(msg.type === 'chat_message'){
      const fromCoach = msg.sender_role === 'coach';
      body.innerHTML = `
        <div class="parent-confirm-badge">${esc(fromCoach
          ? tt('chatFromCoach', 'From coach')
          : tt('chatFromPlayer', 'From player / parent'))}</div>
        <h3 class="coach-rate-name">${esc(msg.player_name || '—')}</h3>
        <p class="parent-msg-comment-text">${esc(msg.text || '')}</p>
        <div class="parent-msg-details">
          <p class="parent-msg-detail"><b>${esc(tt('parentInboxTeam', 'Team'))}</b><span>${esc(msg.team_name || '—')}</span></p>
        </div>
        <button type="button" class="ghost-btn" id="parentMsgCloseBtn">${esc(tt('btnClose', 'Close'))}</button>
      `;
      return;
    }
    if(msg.type === 'player_leave_decision'){
      body.innerHTML = `
        <div class="parent-confirm-badge">${esc(tt('playerLeaveDeclinedShort', 'Leave declined'))}</div>
        <h3 class="coach-rate-name">${esc(msg.player_name || '—')}</h3>
        <p class="hint">${esc(tt('playerLeaveDeclinedHint', 'Coach declined the leave. Edit the card and request again if the club really changed.'))}</p>
        <div class="parent-msg-details">
          <p class="parent-msg-detail"><b>${esc(tt('parentInboxTeam', 'Team'))}</b><span>${esc(msg.team_name || '—')}</span></p>
          <p class="parent-msg-detail"><b>${esc(tt('parentLinksTitle', 'From coach'))}</b><span>${esc(msg.academy_name || '—')}</span></p>
        </div>
        <button type="button" class="ghost-btn" id="parentMsgCloseBtn">${esc(tt('btnClose', 'Close'))}</button>
      `;
      return;
    }
    if(msg.type === 'coach_leave_request'){
      const where = [msg.new_club, msg.new_team].filter(Boolean).join(' · ') || '—';
      const pending = !msg.decision;
      body.innerHTML = `
        <div class="parent-confirm-badge">${esc(tt('coachLeaveKicker', 'Leave request'))}</div>
        <h3 class="coach-rate-name">${esc(msg.player_name || '—')}</h3>
        <div class="parent-msg-details">
          <p class="parent-msg-detail"><b>${esc(tt('coachLeaveNewClub', 'New club'))}</b><span>${esc(where)}</span></p>
          <p class="parent-msg-detail"><b>${esc(tt('parentInboxTeam', 'Team'))}</b><span>${esc(msg.team_name || '—')}</span></p>
        </div>
        ${pending ? `<div class="parent-rsvp parent-rsvp-footer">
          <p class="parent-rsvp-lead">${esc(tt('coachLeaveLead', 'Player asks to leave after a club change. Confirm removes them from the roster.'))}</p>
          <div class="parent-rsvp-actions">
            <button type="button" class="parent-rsvp-btn yes" data-coach-leave-decision="accept" data-request-id="${esc(msg.request_id)}" aria-label="${esc(tt('coachLeaveAccept', 'Confirm leave'))}">✓</button>
            <button type="button" class="parent-rsvp-btn no" data-coach-leave-decision="decline" data-request-id="${esc(msg.request_id)}" aria-label="${esc(tt('coachLeaveDecline', 'Keep on team'))}">✕</button>
          </div>
        </div>` : `<p class="hint">${esc(msg.decision === 'accepted'
          ? tt('coachLeaveAccepted', 'Player removed from the team. Parent link cleared.')
          : tt('coachLeaveDeclined', 'Leave declined. Player stays on the team.'))}</p>`}
        <button type="button" class="ghost-btn" id="parentMsgCloseBtn">${esc(tt('btnClose', 'Close'))}</button>
      `;
      return;
    }
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

    let pitchLab = msg.pitchPos || '';
    try{
      if(msg.pitchPos && typeof pitchPosLabelShort === 'function'){
        pitchLab = pitchPosLabelShort(msg.pitchPos) || msg.pitchPos;
      }
    }catch(e){}
    const roleLab = msg.role === 'sub'
      ? tt('roleSub', 'Off the bench')
      : (msg.role === 'start' ? tt('roleStart', 'Started') : '');
    const minutesLab = Number(msg.minutes) > 0 ? String(Number(msg.minutes)) : '';

    const resultBlock = isResult
      ? `<div class="parent-msg-result${minutesLab ? ' has-mins' : ''}">
          <div class="coach-analytics-sum">
            <div><b>${esc(msg.score || '—')}</b><span>${esc(tt('labelScore', 'Score'))}</span></div>
            <div><b>${esc(msg.rating ? Number(msg.rating).toFixed(1) : '—')}</b><span>${esc(tt('coachQuickScore', 'Rating'))}</span></div>
            ${minutesLab ? `<div><b>${esc(minutesLab)}</b><span>${esc(tt('labelMin', 'Minutes'))}</span></div>` : ''}
          </div>
        </div>`
      : '';

    const commentsBlock = (() => {
      const matchNote = String(msg.match_comment || '').trim();
      const playerNote = String(msg.comment || '').trim();
      if(!matchNote && !playerNote) return '';
      const parts = [];
      if(matchNote){
        parts.push(`<div class="parent-msg-comment">
          <span class="parent-msg-comment-kicker">${esc(tt('coachMatchComment', 'Match comment'))}</span>
          <p class="parent-msg-comment-text">${esc(matchNote)}</p>
        </div>`);
      }
      if(playerNote){
        parts.push(`<div class="parent-msg-comment">
          <span class="parent-msg-comment-kicker">${esc(tt('parentMsgCommentKicker', 'Coach comment'))}</span>
          <p class="parent-msg-comment-text">${esc(playerNote)}</p>
        </div>`);
      }
      return `<div class="parent-msg-comments">${parts.join('')}</div>`;
    })();

    const notice = !isResult ? (msg.invite_notice || '') : '';
    const noticeBanner = !isResult && notice
      ? `<div class="parent-confirm-badge parent-invite-notice is-${esc(notice)}">${esc(
          notice === 'cancelled'
            ? tt('parentInboxMatchCancelledLead', 'This match was cancelled by the coach. No need to come.')
            : notice === 'recalled'
              ? tt('parentInboxMatchRecalledLead', 'The coach changed the squad — {name} is not called up for this match.')
                  .replace('{name}', msg.player_name || tt('parentInboxChild', 'Child'))
              : tt('parentInboxMatchUpdatedLead', 'Match details changed. Please confirm again if you can still play.')
        )}</div>`
      : '';
    const rsvp = msg.rsvp === 'accepted' || msg.rsvp === 'declined' ? msg.rsvp : '';
    const canRsvp = !isResult && notice !== 'cancelled' && notice !== 'recalled';
    const rsvpBlock = canRsvp
      ? `<div class="parent-rsvp parent-rsvp-footer" data-msg-id="${esc(msg.id)}">
          <p class="parent-rsvp-lead">${esc(
            (notice === 'updated'
              ? tt('parentRsvpLeadUpdated', '{name}: details changed. Can they still play?')
              : tt('parentRsvpLead', '{name} is called up for this match. Can they play?')
            ).replace('{name}', msg.player_name || tt('parentInboxChild', 'Child'))
          )}</p>
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
        : notice === 'cancelled'
          ? tt('parentInboxMatchCancelled', 'Match cancelled')
          : notice === 'recalled'
            ? tt('parentInboxMatchRecalled', 'Not called up')
            : notice === 'updated'
              ? tt('parentInboxMatchUpdated', 'Match updated')
              : tt('parentInboxMatch', 'Match invite'))}</div>
      ${noticeBanner}
      <h3 class="coach-rate-name">${esc(msg.opponent || '—')}</h3>
      <div class="parent-msg-details">
        ${detailRow(tt('labelDate', 'Date'), msg.date || '')}
        ${detailRow(tt('coachMatchMeetup', 'Meetup time'), msg.meetup || '')}
        ${detailRow(tt('coachMatchKickoff', 'Kick-off'), msg.kickoff || '')}
        ${!isResult ? detailRow(
          tt('coachMatchFee', 'Entry fee'),
          msg.fee_type === 'paid'
            ? (msg.fee
              ? msg.fee
              : tt('coachMatchFeePaid', 'Paid entry'))
            : tt('coachMatchFeeFree', 'Free')
        ) : ''}
        ${detailRow(tt('labelVenue', 'Venue'), venue)}
        ${detailRow(tt('coachMatchKind', 'Match type'), kindLab)}
        ${msg.tournament
          ? detailRow(tt('labelCompTournament', 'Tournament'), msg.tournament)
          : ''}
        ${msg.address
          ? detailRow(tt('coachMatchAddress', 'Match address'), msg.address)
          : ''}
        ${(() => {
          const child = msg.player_name || '';
          if(!child) return '';
          const parts = String(child).trim().split(/\s+/);
          const first = parts[0] || '';
          const last = parts.slice(1).join(' ');
          const verified = isCoachVerifiedPerson(first, last) || !!(msg.team_player_id);
          return `<p class="parent-msg-detail"><b>${esc(tt('parentInboxChild', 'Child'))}</b><span>${nameWithVerified(child, verified)}</span></p>`;
        })()}
        ${isResult && pitchLab ? detailRow(tt('labelPos', 'Position'), pitchLab) : ''}
        ${isResult && roleLab ? detailRow(tt('labelRole', 'Role'), roleLab) : ''}
        ${isResult && msg.format ? detailRow(tt('labelFormat', 'Format'), msg.format) : ''}
        ${detailRow(tt('parentCoachLabel', 'Coach'), msg.coach_name || '')}
        ${detailRow(
          tt('parentInboxTeam', 'Team'),
          msg.team_name || ''
        )}
      </div>
      ${resultBlock}
      ${rsvpBlock}
      ${isResult ? commentsBlock : ''}
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
    if(global.InboxStore){
      const readerRole = (typeof isCoachPlan === 'function' && isCoachPlan()) ? 'coach' : 'parent';
      global.InboxStore.markRead(id, readerRole);
    }
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
  function onCoachLeaveInboxDecision(btn){
    const requestId = btn && btn.dataset.requestId;
    const decision = btn && btn.dataset.coachLeaveDecision;
    const coach = global.CoachStore;
    const session = coach && coach.getSession && coach.getSession();
    if(!requestId || !session || !['accept','decline'].includes(decision)) return;
    try{
      coach.resolveLeaveRequest(session, requestId, decision);
      toast(decision === 'accept'
        ? tt('coachLeaveAccepted', 'Player removed from the team. Parent link cleared.')
        : tt('coachLeaveDeclined', 'Leave declined. Player stays on the team.'));
      const msg = global.InboxStore && global.InboxStore.listForCoach
        ? global.InboxStore.listForCoach().find(m => String(m.request_id) === String(requestId))
        : null;
      if(msg) fillParentMessageBody(msg);
      renderParentInbox();
      if(typeof renderCoachUi === 'function') renderCoachUi();
      if(typeof syncPlayerLeaveUi === 'function') syncPlayerLeaveUi();
    }catch(e){
      toast(tt('coachErrGeneric', 'Something went wrong.'));
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

  function syncLinkedCoachStatsFromDevice(){
    const parent = global.ParentStore;
    const coach = global.CoachStore;
    if(!parent || !coach || typeof coach.getSession !== 'function') return;
    const session = coach.getSession();
    if(!session || typeof parent.listLinks !== 'function') return;
    if(typeof parent.syncCoachRatings !== 'function') return;
    if(typeof coach.playerDetail !== 'function') return;
    parent.listLinks().forEach(link => {
      const pid = link && link.player && link.player.id;
      if(!pid) return;
      try{
        const detail = coach.playerDetail(session, pid);
        if(!detail) return;
        // Full coach stats for parents — numbers only, no private notes / personal comments.
        parent.syncCoachRatings(pid, {
          player: detail.player ? {
            first_name: detail.player.first_name,
            last_name: detail.player.last_name,
            number: detail.player.number,
            position: detail.player.position
          } : null,
          team: detail.team ? {
            id: detail.team.id,
            name: detail.team.name,
            age_group: detail.team.age_group
          } : null,
          ratings: (detail.ratings || []).slice(0, 40).map(r => ({
            date: r.date,
            opponent: r.opponent,
            score: r.score || '',
            rating: Number(r.rating) || 0,
            pitchPos: r.pitchPos || '',
            minutes: Number(r.minutes) || 0,
            role: r.role || ''
          })),
          avg: detail.avg,
          games: detail.games,
          last: detail.last,
          best: detail.best,
          worst: detail.worst,
          form: detail.form,
          trend: detail.trend,
          minutes: detail.minutes,
          topMoments: detail.topMoments
        });
      }catch(e){}
    });
  }

  function fmtParentScore(n){
    if(n == null || !Number.isFinite(Number(n))) return '—';
    return Number(n).toFixed(1);
  }
  function parentFormSpark(form){
    const arr = Array.isArray(form) ? form : [];
    if(!arr.length) return '';
    return arr.map(n => Number(n).toFixed(1)).join(' → ');
  }
  function parentTrendLabel(trend){
    if(trend == null || !Number.isFinite(Number(trend))) return '';
    const n = Number(trend);
    if(Math.abs(n) < 0.05) return tt('coachTrendFlat', 'stable');
    return `${n > 0 ? '+' : ''}${n.toFixed(1)}`;
  }
  function parentTrendClass(trend){
    if(trend == null || !Number.isFinite(Number(trend))) return '';
    const n = Number(trend);
    if(n >= 0.05) return 'up';
    if(n <= -0.05) return 'down';
    return '';
  }
  function parentMetricLab(key){
    try{
      if(typeof metricLabel === 'function') return metricLabel(key);
    }catch(e){}
    return key;
  }
  function parentPosLab(code){
    try{
      if(code && typeof pitchPosLabelShort === 'function') return pitchPosLabelShort(code) || code;
    }catch(e){}
    return code || '';
  }
  function parentTeamLine(l){
    const teamName = l && l.team && l.team.name ? String(l.team.name) : '';
    const age = l && l.team && l.team.age_group ? String(l.team.age_group) : '';
    if(!teamName && !age) return '';
    const teamBit = teamName
      ? `${tt('parentInboxTeam', 'Team')}: ${teamName}`
      : '';
    return [teamBit, age].filter(Boolean).join(' · ');
  }
  function parentPlayerMetaLine(l){
    const p = l && l.player;
    return [
      p && p.number ? `#${p.number}` : '',
      parentPosLab(p && p.position)
    ].filter(Boolean).join(' · ');
  }
  function parentScoreWithResultHtml(score){
    const raw = String(score || '').trim();
    if(!raw) return '';
    try{
      if(typeof scoreLineHtml === 'function') return scoreLineHtml({score: raw});
    }catch(e){}
    return esc(raw);
  }
  function parentRatingHeadHtml(r){
    const bits = [];
    if(r && r.date) bits.push(esc(r.date));
    if(r && r.opponent) bits.push(esc(r.opponent));
    const scoreHtml = parentScoreWithResultHtml(r && r.score);
    if(scoreHtml) bits.push(scoreHtml);
    return bits.join(' · ') || '—';
  }
  function parentCoachStatsBlockHtml(l){
    const ratings = Array.isArray(l.ratings) ? l.ratings : [];
    const games = l.games != null ? l.games : ratings.length;
    const form = parentFormSpark(l.form);
    const trend = parentTrendLabel(l.trend);
    const tc = parentTrendClass(l.trend);
    const moments = Array.isArray(l.topMoments) ? l.topMoments : [];
    const momentsHtml = moments.length
      ? `<div class="coach-stat-section"><div class="pro-kicker">${esc(tt('coachPlayerMomentsKicker', 'Key moments'))}</div>
          <div class="coach-moment-chips">${moments.map(m =>
            `<span class="coach-moment-chip"><b>${esc(parentMetricLab(m.key))}</b> ${esc(String(m.n))}</span>`
          ).join('')}</div></div>`
      : '';
    const sum = `<div class="coach-analytics-sum coach-analytics-sum-4">
      <div><b>${esc(games)}</b><span>${esc(tt('coachGames', 'games'))}</span></div>
      <div><b>${esc(fmtParentScore(l.avg))}</b><span>${esc(tt('coachStatAvgShort', 'avg'))}</span></div>
      <div><b>${esc(fmtParentScore(l.last))}</b><span>${esc(tt('coachStatLast', 'last'))}</span></div>
      <div><b class="${tc}">${esc(trend || '—')}</b><span>${esc(tt('coachStatTrend', 'trend'))}</span></div>
    </div>
    <div class="coach-analytics-sum">
      <div><b>${esc(fmtParentScore(l.best))}</b><span>${esc(tt('coachStatBest', 'Best'))}</span></div>
      <div><b>${esc(fmtParentScore(l.worst))}</b><span>${esc(tt('coachStatWorst', 'Worst'))}</span></div>
      <div><b>${esc(l.minutes != null ? l.minutes : 0)}</b><span>${esc(tt('coachStatMinutes', 'Minutes'))}</span></div>
    </div>
    ${form ? `<p class="hint coach-form-line"><b>${esc(tt('coachStatForm', 'Form'))}:</b> ${esc(form)}</p>` : ''}`;
    const rows = ratings.length
      ? `<div class="coach-player-list">${ratings.map(r => {
          const pos = parentPosLab(r.pitchPos);
          const mins = Number(r.minutes) > 0 ? `${Number(r.minutes)}′` : '';
          const role = r.role === 'sub'
            ? tt('roleSub', 'Off the bench')
            : (r.role === 'start' ? tt('roleStart', 'Started') : '');
          const meta = [pos, role, mins].filter(Boolean).join(' · ');
          return `<div class="coach-player-row">
            <div class="coach-player-main">
              <b>${parentRatingHeadHtml(r)}</b>
              ${meta ? `<span>${esc(meta)}</span>` : ''}
            </div>
            <b class="parent-rate-num">${esc(fmtParentScore(r.rating))}</b>
          </div>`;
        }).join('')}</div>`
      : `<p class="hint">${esc(tt('parentNoCoachRatings', 'Coach has not shared ratings yet.'))}</p>`;
    return `${sum}${momentsHtml}<div class="pro-kicker">${esc(tt('coachPlayerRatingsKicker', 'Recent ratings'))}</div>${rows}`;
  }

  function openParentCoachStats(){
    if(typeof isCoachPlan === 'function' && isCoachPlan()) return;
    syncLinkedCoachStatsFromDevice();
    const store = global.ParentStore;
    const links = store && store.listLinks ? store.listLinks() : [];
    if(!links.length){
      toast(tt('parentLinksEmpty', 'No academy link yet. Ask the coach for a QR or invite link.'));
      return;
    }
    renderParentCoachStats();
    if(typeof showView === 'function') showView('stats');
    requestAnimationFrame(() => {
      const panel = document.getElementById('parentCoachStatsPanel');
      if(!panel) return;
      try{
        panel.scrollIntoView({behavior: 'smooth', block: 'start'});
      }catch(e){}
      panel.classList.add('is-flash');
      setTimeout(() => panel.classList.remove('is-flash'), 1400);
    });
  }

  function renderParentLinks(){
    const store = global.ParentStore;
    const box = document.getElementById('parentLinksList');
    const root = document.getElementById('parentLinksCard');
    const statsBtn = document.getElementById('parentOpenCoachStatsBtn');
    const addBtn = document.getElementById('parentAddLinkBtn');
    const addBottom = document.getElementById('parentAddLinkBtnBottom');
    if(!box || !root || !store) return;
    if(typeof isCoachPlan === 'function' && isCoachPlan()){
      root.hidden = true;
      if(statsBtn) statsBtn.hidden = true;
      if(addBtn) addBtn.hidden = true;
      if(addBottom) addBottom.hidden = true;
      return;
    }
    root.hidden = false;
    const links = store.listLinks();
    if(statsBtn) statsBtn.hidden = !links.length;
    // Already linked → QR/add goes to the very bottom of the player screen.
    if(addBtn) addBtn.hidden = !!links.length;
    if(addBottom) addBottom.hidden = !links.length;
    if(!links.length){
      box.innerHTML = `<p class="hint">${esc(tt('parentLinksEmpty', 'No academy link yet. Ask the coach for a QR or invite link.'))}</p>`;
      return;
    }
    box.innerHTML = links.map(l => {
      const name = playerName(l.player);
      const meta = [
        parentTeamLine(l),
        parentPlayerMetaLine(l),
        l.leave_status === 'pending'
          ? tt('playerLeavePendingShort', 'Leave pending')
          : (l.leave_status === 'declined' ? tt('playerLeaveDeclinedShort', 'Leave declined') : '')
      ].filter(Boolean).join(' · ');
      const avg = l.avg != null ? Number(l.avg).toFixed(1) : '—';
      return `<button type="button" class="parent-link-row" data-parent-link="${esc(l.id)}">
        <span class="parent-link-main">
          <b>${nameWithVerified(name, true)}</b>
          <span>${esc(meta || tt('parentTeamMissing', 'Team not set'))}</span>
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
      const teamLine = parentTeamLine(l);
      const playerMeta = parentPlayerMetaLine(l);
      const confirmBits = [
        `<div class="parent-confirm-badge">${esc(tt('parentConfirmed', 'Player confirmed by coach'))}</div>`,
        `<h3 class="coach-team-heading">${nameWithVerified(name, true)}</h3>`,
        teamLine ? `<p class="hint parent-team-line"><b>${esc(teamLine)}</b></p>` : `<p class="hint">${esc(tt('parentTeamMissing', 'Team not set'))}</p>`,
        `<p class="hint">${esc([
          playerMeta,
          l.coach && l.coach.name ? `${tt('parentCoachLabel', 'Coach')}: ${l.coach.name}` : ''
        ].filter(Boolean).join(' · '))}</p>`
      ].join('');
      return `<div class="parent-coach-block">${confirmBits}${parentCoachStatsBlockHtml(l)}</div>`;
    }).join('');
  }

  function openParentClaimSheet(prefill){
    if(typeof isCoachPlan === 'function' && isCoachPlan()){
      toast(tt('parentNotInCoach', 'Switch off Coach plan to add a player as a parent / guardian.'));
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
        <div class="parent-confirm-badge">${esc(tt('parentConfirmed', 'Player confirmed by coach'))}</div>
        <b>${nameWithVerified(name, true)}</b>
        <span>${esc([
          payload.player.number ? `#${payload.player.number}` : '',
          parentPosLab(payload.player.position)
        ].filter(Boolean).join(' · '))}</span>
        <p class="hint"><b>${esc([
          payload.team && payload.team.name
            ? `${tt('parentInboxTeam', 'Team')}: ${payload.team.name}`
            : '',
          payload.team && payload.team.age_group
        ].filter(Boolean).join(' · ') || tt('parentTeamMissing', 'Team not set'))}</b></p>
        <p class="hint">${esc(
          payload.coach && payload.coach.name
            ? `${tt('parentCoachLabel', 'Coach')}: ${payload.coach.name}`
            : ''
        )}</p>
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
      if(typeof syncCoachPlayerPhotosFromPersonal === 'function'){
        try{ syncCoachPlayerPhotosFromPersonal(); }catch(e){}
      }
      if(global.ParentStatsStore && typeof global.ParentStatsStore.syncAllPersonalHistory === 'function'){
        try{ global.ParentStatsStore.syncAllPersonalHistory(); }catch(e){}
      }
      if(typeof renderCoachUi === 'function' && typeof isCoachPlan === 'function' && isCoachPlan()){
        try{ renderCoachUi(); }catch(e){}
      }
      if(typeof applyHeader === 'function'){
        try{ applyHeader(); }catch(e){}
      }
      renderParentUi();
      toast(tt('parentClaimed', 'Child linked. Academy info and coach stats are ready.'));
      if(typeof showView === 'function') showView('player');
    }catch(e){
      toast(tt('parentBadInvite', 'Could not read this invite. Paste the full link or MC-code.'));
    }
  }

  function openParentLinkDetail(id){
    const store = global.ParentStore;
    syncLinkedCoachStatsFromDevice();
    const link = store && store.getLink(id);
    if(!link) return;
    const sheet = document.getElementById('parentLinkSheet');
    const back = document.getElementById('parentLinkBack');
    const body = document.getElementById('parentLinkBody');
    const card = document.getElementById('parentLinkCard');
    if(!sheet || !body) return;
    const name = playerName(link.player);
    const teamLine = parentTeamLine(link);
    const playerMeta = parentPlayerMetaLine(link);
    body.innerHTML = `
      <div class="parent-confirm-badge">${esc(tt('parentConfirmed', 'Player confirmed by coach'))}</div>
      <h3 class="coach-rate-name">${nameWithVerified(name, true)}</h3>
      ${teamLine
        ? `<p class="hint parent-team-line"><b>${esc(teamLine)}</b></p>`
        : `<p class="hint">${esc(tt('parentTeamMissing', 'Team not set'))}</p>`}
      <p class="hint">${esc([
        playerMeta,
        link.coach && link.coach.name ? `${tt('parentCoachLabel', 'Coach')}: ${link.coach.name}` : ''
      ].filter(Boolean).join(' · '))}</p>
      <div class="pro-kicker">${esc(tt('parentCoachStatsKicker', 'Stats from coach'))}</div>
      ${parentCoachStatsBlockHtml(link)}
      <p class="hint">${esc(tt('parentPersonalNote', 'Your sideline Matchcard ratings stay in History / Stats as before.'))}</p>
      <button type="button" class="save-btn" id="parentLinkOpenStatsBtn">${esc(tt('parentCoachStatsBtn', 'Coach stats'))}</button>
      <p class="hint">${esc(
        link.leave_status === 'pending'
          ? tt('playerLeavePendingHint', 'Leave request sent. Waiting for the coach to confirm.')
          : link.leave_status === 'declined'
            ? tt('playerLeaveDeclinedHint', 'Coach declined the leave. Edit the card and request again if the club really changed.')
            : tt('playerLeaveOnlyViaEdit', 'To unlink, open Edit card and mark that the club changed. The coach must confirm.')
      )}</p>
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
    syncLinkedCoachStatsFromDevice();
    renderParentInbox();
    renderParentLinks();
    renderParentCoachStats();
    syncInboxBellUi();
  }

  function bindParentUi(){
    if(global.__ffkParentBound) return;
    global.__ffkParentBound = true;
    document.getElementById('parentAddLinkBtn')?.addEventListener('click', () => openParentClaimSheet(''));
    document.getElementById('parentAddLinkBtnBottom')?.addEventListener('click', () => openParentClaimSheet(''));
    document.getElementById('parentOpenCoachStatsBtn')?.addEventListener('click', () => openParentCoachStats());
    document.getElementById('parentClaimBack')?.addEventListener('click', () => closeParentClaimSheet());
    document.getElementById('parentClaimCancelBtn')?.addEventListener('click', () => closeParentClaimSheet());
    document.getElementById('parentClaimPreviewBtn')?.addEventListener('click', () => previewClaim());
    document.getElementById('parentClaimConfirmBtn')?.addEventListener('click', () => confirmClaim());
    document.getElementById('parentLinkBack')?.addEventListener('click', () => closeParentLinkSheet());
    document.getElementById('parentMsgBack')?.addEventListener('click', () => closeParentMsgSheet());
    document.getElementById('inboxBtn')?.addEventListener('click', () => openInboxSheet());
    document.getElementById('inboxSheetBack')?.addEventListener('click', () => closeInboxSheet());
    document.getElementById('inboxSheetCloseBtn')?.addEventListener('click', () => closeInboxSheet());
    document.getElementById('inboxChatSend')?.addEventListener('click', () => sendChatMessage());
    document.getElementById('inboxChatText')?.addEventListener('keydown', e => {
      if(e.key === 'Enter' && !e.shiftKey){
        e.preventDefault();
        sendChatMessage();
      }
    });
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
        return;
      }
      const leaveBtn = e.target.closest('[data-coach-leave-decision]');
      if(leaveBtn){
        e.preventDefault();
        e.stopPropagation();
        onCoachLeaveInboxDecision(leaveBtn);
      }
    });
    document.getElementById('parentLinksList')?.addEventListener('click', e => {
      const btn = e.target.closest('[data-parent-link]');
      if(!btn) return;
      openParentLinkDetail(btn.dataset.parentLink);
    });
    document.getElementById('parentLinkBody')?.addEventListener('click', e => {
      if(e.target.closest('#parentLinkOpenStatsBtn')){
        e.preventDefault();
        closeParentLinkSheet();
        openParentCoachStats();
      }
    });
    checkLaunchParentInvite();
    syncInboxBellUi();
  }

  function normClubPart(s){
    return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }
  function linksForCurrentPlayer(){
    const store = global.ParentStore;
    if(!store || typeof store.listLinks !== 'function') return [];
    const personalId = typeof store.currentPersonalPlayerId === 'function'
      ? store.currentPersonalPlayerId()
      : '';
    if(personalId && typeof store.linksForPersonalPlayer === 'function'){
      const linked = store.linksForPersonalPlayer(personalId);
      if(linked.length) return linked;
    }
    const links = store.listLinks();
    if(!links.length) return [];
    let first = '';
    let last = '';
    try{
      first = document.getElementById('p-first')?.value || '';
      last = document.getElementById('p-last')?.value || '';
    }catch(e){}
    if(!first && !last){
      try{
        const cur = JSON.parse(localStorage.getItem('ffk_player_v1') || 'null');
        if(cur){
          first = cur.firstName || '';
          last = cur.lastName || '';
        }
      }catch(e){}
    }
    if(!first && !last) return links;
    const soft = (aF, aL, bF, bL) => {
      const af = normClubPart(aF), al = normClubPart(aL);
      const bf = normClubPart(bF), bl = normClubPart(bL);
      if(!af && !al) return false;
      const aFull = [af, al].filter(Boolean).join(' ');
      const bFull = [bf, bl].filter(Boolean).join(' ');
      if(aFull && bFull && aFull === bFull) return true;
      if(af && bf && af === bf && (!al || !bl || al === bl)) return true;
      return false;
    };
    const matched = links.filter(l =>
      l && l.player && soft(first, last, l.player.first_name, l.player.last_name)
    );
    return matched.length ? matched : (links.length === 1 ? links : []);
  }
  function clubChangedEnough(link, clubVal, teamVal){
    if(!link) return false;
    const club = normClubPart(clubVal);
    const team = normClubPart(teamVal);
    const linkedClub = normClubPart(link.academy && link.academy.name);
    const linkedTeam = normClubPart(link.team && link.team.name);
    if(club && linkedClub && club !== linkedClub) return true;
    if(team && linkedTeam && team !== linkedTeam) return true;
    return false;
  }
  function syncPlayerLeaveUi(){
    const block = document.getElementById('playerLeaveBlock');
    const meta = document.getElementById('playerLeaveMeta');
    const statusEl = document.getElementById('playerLeaveStatus');
    const btn = document.getElementById('playerLeaveBtn');
    const check = document.getElementById('p-club-changed');
    if(!block) return;
    if(typeof isCoachPlan === 'function' && isCoachPlan()){
      block.hidden = true;
      return;
    }
    const links = linksForCurrentPlayer();
    if(!links.length){
      block.hidden = true;
      return;
    }
    block.hidden = false;
    const link = links[0];
    if(meta){
      meta.textContent = [
        link.team && link.team.name ? `${tt('parentInboxTeam', 'Team')}: ${link.team.name}` : '',
        link.coach && link.coach.name ? `${tt('parentCoachLabel', 'Coach')}: ${link.coach.name}` : '',
        link.academy && link.academy.name ? link.academy.name : ''
      ].filter(Boolean).join(' · ');
    }
    const pending = link.leave_status === 'pending';
    const declined = link.leave_status === 'declined';
    if(statusEl){
      if(pending){
        statusEl.hidden = false;
        statusEl.textContent = tt('playerLeavePendingHint', 'Leave request sent. Waiting for the coach to confirm.');
      }else if(declined){
        statusEl.hidden = false;
        statusEl.textContent = tt('playerLeaveDeclinedHint', 'Coach declined the leave. Edit the card and request again if the club really changed.');
      }else{
        statusEl.hidden = true;
        statusEl.textContent = '';
      }
    }
    const clubVal = document.getElementById('p-club')?.value || '';
    const teamVal = document.getElementById('p-team')?.value || '';
    const marked = !!(check && check.checked);
    const canAsk = !pending && (marked || clubChangedEnough(link, clubVal, teamVal));
    if(btn){
      btn.disabled = !canAsk;
      btn.dataset.linkId = link.id;
    }
  }
  function onPlayerLeaveRequest(){
    const btn = document.getElementById('playerLeaveBtn');
    const linkId = btn && btn.dataset.linkId;
    if(!linkId || (btn && btn.disabled)) return;
    const clubVal = document.getElementById('p-club')?.value.trim() || '';
    const teamVal = document.getElementById('p-team')?.value.trim() || '';
    const check = document.getElementById('p-club-changed');
    const link = global.ParentStore && global.ParentStore.getLink(linkId);
    if(!link) return;
    if(!(check && check.checked) && !clubChangedEnough(link, clubVal, teamVal)){
      toast(tt('playerLeaveNeedClubChange', 'Mark club change or update club/team first.'));
      return;
    }
    if(!confirm(tt('playerLeaveConfirm', 'Send a leave request to the coach? They must confirm before the link is removed.'))) return;
    try{
      global.ParentStore.requestLeave(linkId, {new_club: clubVal, new_team: teamVal});
      syncPlayerLeaveUi();
      renderParentUi();
      if(typeof renderCoachUi === 'function'){
        try{ renderCoachUi(); }catch(e){}
      }
    }catch(e){
      toast(tt('coachErrGeneric', 'Something went wrong.'));
    }
  }

  global.syncPlayerLeaveUi = syncPlayerLeaveUi;
  global.onPlayerLeaveRequest = onPlayerLeaveRequest;
  global.linksForCurrentPlayer = linksForCurrentPlayer;

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
  global.isCoachVerifiedPerson = isCoachVerifiedPerson;
  global.isCoachVerifiedPlayer = isCoachVerifiedPlayer;
  global.hasAnyCoachLink = hasAnyCoachLink;
  global.nameWithVerifiedHtml = nameWithVerified;
  global.coachVerifiedBadgeHtml = verifiedBadgeHtml;
})(window);

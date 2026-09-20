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
    const sheet = document.getElementById('parentClaimSheet');
    const back = document.getElementById('parentClaimBack');
    const input = document.getElementById('parentClaimInput');
    const preview = document.getElementById('parentClaimPreview');
    if(input) input.value = prefill || '';
    if(preview) preview.innerHTML = '';
    if(sheet) sheet.hidden = false;
    if(back) back.hidden = false;
    if(prefill) previewClaim();
    if(typeof pushAppState === 'function') pushAppState('layer');
  }
  function closeParentClaimSheet(){
    const sheet = document.getElementById('parentClaimSheet');
    const back = document.getElementById('parentClaimBack');
    if(sheet) sheet.hidden = true;
    if(back) back.hidden = true;
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
    sheet.hidden = false;
    if(back) back.hidden = false;
    if(typeof pushAppState === 'function') pushAppState('layer');
  }
  function closeParentLinkSheet(){
    const sheet = document.getElementById('parentLinkSheet');
    const back = document.getElementById('parentLinkBack');
    if(sheet) sheet.hidden = true;
    if(back) back.hidden = true;
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
    renderParentLinks();
    renderParentCoachStats();
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
  }

  global.renderParentUi = renderParentUi;
  global.bindParentUi = bindParentUi;
  global.openParentClaimSheet = openParentClaimSheet;
  global.ingestParentDeepLink = ingestDeepLink;
})(window);

/* Matchcard Coach UI — Phase 1+2: academy, teams, roster, matches, analytics.
   Separate from Personal Free/Pro. */
(function(global){
  // TEST MODE: email invitations only open a local mail composer; no server sends mail.
  const TEST_EMAIL_INVITES = true;

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
  function today(){
    try{ return todayStr(); }catch(e){ return new Date().toISOString().slice(0, 10); }
  }
  function metricLab(key){
    try{
      if(typeof metricLabel === 'function') return metricLabel(key);
    }catch(e){}
    return key;
  }
  function fmtScore(n){
    if(n == null || !Number.isFinite(Number(n))) return '—';
    return Number(n).toFixed(1);
  }
  function formSpark(form){
    const arr = Array.isArray(form) ? form : [];
    if(!arr.length) return '—';
    return arr.map(n => Number(n).toFixed(1)).join(' → ');
  }
  function trendLabel(trend){
    if(trend == null || !Number.isFinite(Number(trend))) return '';
    const n = Number(trend);
    if(Math.abs(n) < 0.05) return tt('coachTrendFlat', 'stable');
    const sign = n > 0 ? '+' : '';
    return `${sign}${n.toFixed(1)}`;
  }
  function trendClass(trend){
    if(trend == null || !Number.isFinite(Number(trend))) return '';
    const n = Number(trend);
    if(n >= 0.05) return 'up';
    if(n <= -0.05) return 'down';
    return '';
  }
  function momentsHtml(list, emptyHint){
    const rows = Array.isArray(list) ? list : [];
    if(!rows.length){
      return emptyHint
        ? `<p class="hint">${esc(emptyHint)}</p>`
        : '';
    }
    return `<div class="coach-moment-chips">${rows.map(m =>
      `<span class="coach-moment-chip"><b>${esc(metricLab(m.key))}</b> ${esc(String(m.n))}</span>`
    ).join('')}</div>`;
  }
  const ROSTER_FOLD_KEY = 'ffk_coach_roster_fold';
  function rosterFolded(){
    try{ return sessionStorage.getItem(ROSTER_FOLD_KEY) === '1'; }catch(e){ return false; }
  }
  function setRosterFolded(on){
    try{ sessionStorage.setItem(ROSTER_FOLD_KEY, on ? '1' : '0'); }catch(e){}
  }
  function syncRosterFoldUi(playerCount){
    const body = document.getElementById('coachRosterBody');
    const btn = document.getElementById('coachRosterToggle');
    const folded = rosterFolded();
    if(body) body.hidden = folded;
    if(btn){
      btn.setAttribute('aria-expanded', folded ? 'false' : 'true');
      const n = Number(playerCount) || 0;
      btn.textContent = folded
        ? tt('coachRosterExpand', 'Expand · {n}').replace('{n}', String(n))
        : '▴';
      btn.title = folded
        ? tt('coachRosterExpandHint', 'Show players')
        : tt('coachRosterCollapseHint', 'Hide players');
    }
  }

  function renderCoachUi(){
    const store = global.CoachStore;
    if(!store) return;
    const session = store.getSession();
    const marketing = document.getElementById('coachMarketing');
    const auth = document.getElementById('coachAuth');
    const work = document.getElementById('coachWorkspace');
    const back = document.getElementById('coachBackBtn');
    if(!marketing || !auth || !work) return;

    if(!session){
      const started = work.dataset.started === '1' || auth.dataset.open === '1';
      marketing.hidden = false;
      auth.hidden = !started;
      work.hidden = true;
      if(back) back.hidden = false;
      syncModeHint();
      renderCoachTabsEmpty();
      if(typeof syncCoachModeViews === 'function') syncCoachModeViews();
      syncPlanModeButtons();
      return;
    }

    marketing.hidden = true;
    auth.hidden = true;
    work.hidden = false;
    work.dataset.started = '1';
    if(back) back.hidden = true;
    if(typeof applyHeader === 'function') applyHeader();
    if(typeof refreshCoachMediaUi === 'function') refreshCoachMediaUi();
    syncCoachPlayerPhotosFromPersonal();
    if(global.ParentStatsStore && typeof global.ParentStatsStore.syncAllPersonalHistory === 'function'){
      try{ global.ParentStatsStore.syncAllPersonalHistory(); }catch(e){}
    }
    renderWorkspace(session);
    syncPlanModeButtons();
  }

  function enterCoachMode(){
    if(typeof setCoachPlan === 'function') setCoachPlan(true);
    if(typeof showView === 'function') showView('coach');
    renderCoachUi();
    syncPlanModeButtons();
  }

  function enterParentMode(){
    closeCoachSettings();
    if(typeof closeCoachQuickRate === 'function') closeCoachQuickRate();
    window.coachChildView = null;
    if(typeof syncCoachChildPlayerUi === 'function') syncCoachChildPlayerUi();
    if(typeof setCoachPlan === 'function') setCoachPlan(false);
    if(typeof showView === 'function') showView('player');
    if(typeof renderParentUi === 'function') renderParentUi();
    if(typeof applyHeader === 'function') applyHeader();
    syncPlanModeButtons();
    toast(tt('coachSwitchedParent', 'Режим родителя / Free'));
  }

  function syncPlanModeButtons(){
    const session = global.CoachStore && global.CoachStore.getSession && global.CoachStore.getSession();
    const hasCoach = !!session;
    const onCoach = typeof isCoachPlan === 'function' ? isCoachPlan() : false;
    const parentBtn = document.getElementById('enterParentModeBtn');
    const coachBtn = document.getElementById('enterCoachModeBtn');
    if(parentBtn) parentBtn.hidden = !(hasCoach && onCoach);
    if(coachBtn) coachBtn.hidden = !(hasCoach && !onCoach);
  }

  global.enterCoachMode = enterCoachMode;
  global.enterParentMode = enterParentMode;
  global.syncPlanModeButtons = syncPlanModeButtons;

  function syncModeHint(){
    const hint = document.getElementById('coachModeHint');
    if(!hint) return;
    const cloud = global.CoachStore && global.CoachStore.isCloudConfigured();
    hint.textContent = cloud
      ? tt('coachModeCloud', 'Cloud mode ready — Supabase keys found.')
      : tt('coachModeLocal', 'Local mode: academy data stays on this phone until Supabase is connected.');
  }

  function renderAssistantsBlock(session){
    const list = document.getElementById('coachAssistantList');
    if(!list || !session) return;
    const store = global.CoachStore;
    const rows = store.listAssistants(session);
    const owner = store.isAcademyOwner(session);
    if(!rows.length){
      list.innerHTML = `<p class="hint">${esc(tt('coachAssistantsEmpty', 'No assistants yet.'))}</p>`;
    }else{
      list.innerHTML = rows.map(m => {
        const st = m.status === 'pending'
          ? tt('coachAssistantPending', 'Pending')
          : tt('coachAssistantActive', 'Active');
        const meta = [m.email, m.name, m.invite_code ? `MC-${m.invite_code}` : '', st].filter(Boolean).join(' · ');
        const del = owner
          ? `<button type="button" class="ghost-btn" data-del-assistant="${esc(m.id)}">${esc(tt('coachAssistantRemove', 'Remove'))}</button>`
          : '';
        return `<div class="coach-team-item" style="display:flex;align-items:center;justify-content:space-between;gap:8px">
          <span class="coach-team-meta">${esc(meta)}</span>${del}
        </div>`;
      }).join('');
    }
    const inviteBtn = document.getElementById('coachInviteAssistantBtn');
    if(inviteBtn) inviteBtn.hidden = !owner;
  }

  function renderCloudPushStatus(){
    const cloudEl = document.getElementById('coachCloudStatus');
    if(cloudEl){
      const st = global.CoachCloud && global.CoachCloud.status ? global.CoachCloud.status() : {configured: false, mode: 'local'};
      cloudEl.textContent = st.configured
        ? tt('coachCloudReady', 'Supabase connected — sync available.')
        : tt('coachCloudOffline', 'Local mode. Add Supabase URL + key to enable cloud.');
    }
    if(typeof syncPushSettingsUi === 'function') syncPushSettingsUi();
  }

  function coachJumpStatsHtml(teamsN, playersN, matchesN, ratingsN){
    const cell = (jump, n, label) =>
      `<button type="button" class="coach-stat-jump" data-coach-jump="${esc(jump)}">
        <b>${esc(String(n))}</b><span>${esc(label)}</span>
      </button>`;
    return [
      cell('teams', teamsN, tt('coachStatTeams', 'Teams')),
      cell('players', playersN, tt('coachStatPlayers', 'Players')),
      cell('matches', matchesN, tt('coachStatMatches', 'Matches')),
      cell('ratings', ratingsN, tt('coachStatRatings', 'Ratings'))
    ].join('');
  }
  function scrollCoachEl(id){
    try{
      const el = document.getElementById(id);
      if(el) el.scrollIntoView({behavior: 'smooth', block: 'start'});
    }catch(e){}
  }
  function jumpCoachStat(kind){
    closeCoachSettings();
    if(typeof closeCoachPlayerSheet === 'function') closeCoachPlayerSheet();
    const go = (view) => {
      if(typeof showView === 'function') showView(view);
    };
    if(kind === 'teams'){
      go('coach');
      renderCoachUi();
      setTimeout(() => scrollCoachEl('coachTeamList'), 60);
      return;
    }
    if(kind === 'players'){
      go('coach');
      setRosterFolded(false);
      renderCoachUi();
      setTimeout(() => {
        syncRosterFoldUi(
          (global.CoachStore && global.CoachStore.getSession && global.CoachStore.getActiveTeamId)
            ? global.CoachStore.listPlayers(
                global.CoachStore.getSession(),
                global.CoachStore.getActiveTeamId()
              ).length
            : 0
        );
        scrollCoachEl('coachTeamPane');
      }, 60);
      return;
    }
    if(kind === 'matches'){
      // KPI is played matches — open Results, not upcoming Games.
      go('history');
      renderCoachUi();
      setTimeout(() => scrollCoachEl('coachHistoryTab'), 60);
      return;
    }
    if(kind === 'ratings'){
      go('stats');
      renderCoachUi();
      setTimeout(() => scrollCoachEl('coachStatsTab'), 60);
      return;
    }
  }

  function renderCoachLeaveRequests(session){
    const box = document.getElementById('coachLeaveRequests');
    const store = global.CoachStore;
    if(box){
      box.hidden = true;
      box.innerHTML = '';
    }
    if(!store || !session || typeof store.listLeaveRequests !== 'function') return;
    const list = store.listLeaveRequests(session, {status: 'pending'});
    if(global.InboxStore && typeof global.InboxStore.upsertCoachLeaveRequest === 'function'){
      list.forEach(r => {
        try{ global.InboxStore.upsertCoachLeaveRequest(r); }catch(e){}
      });
    }
    if(typeof syncInboxBellUi === 'function'){
      try{ syncInboxBellUi(); }catch(e){}
    }
  }
  function onCoachLeaveDecide(btn){
    const id = btn && btn.dataset.leaveId;
    const decision = btn && btn.dataset.leaveDecide;
    const store = global.CoachStore;
    const session = store && store.getSession && store.getSession();
    if(!id || !decision || !session || typeof store.resolveLeaveRequest !== 'function') return;
    try{
      const res = store.resolveLeaveRequest(session, id, decision);
      if(decision === 'accept'){
        toast(tt('coachLeaveAccepted', 'Player removed from the team. Parent link cleared.'));
      }else{
        toast(tt('coachLeaveDeclined', 'Leave declined. Player stays on the team.'));
      }
      if(typeof renderParentUi === 'function'){
        try{ renderParentUi(); }catch(e){}
      }
      if(typeof syncPlayerLeaveUi === 'function'){
        try{ syncPlayerLeaveUi(); }catch(e){}
      }
      renderCoachUi();
      return res;
    }catch(e){
      toast(tt('coachErrGeneric', 'Something went wrong.'));
    }
  }
  function renderWorkspace(session){
    const store = global.CoachStore;
    const academy = store.myAcademy(session);
    const createBox = document.getElementById('coachCreateAcademy');
    const home = document.getElementById('coachAcademyHome');
    const teamPane = document.getElementById('coachTeamPane');
    const emailEl = document.getElementById('coachSessionEmail');
    if(emailEl) emailEl.textContent = session.email;

    if(!academy){
      if(createBox) createBox.hidden = false;
      if(home) home.hidden = true;
      if(teamPane) teamPane.hidden = true;
      const homeStatsOff = document.getElementById('coachHomeStats');
      if(homeStatsOff) homeStatsOff.hidden = true;
      const leaveOff = document.getElementById('coachLeaveRequests');
      if(leaveOff){ leaveOff.hidden = true; leaveOff.innerHTML = ''; }
      closeCoachSettings();
      closeTeamMenu();
      return;
    }
    if(createBox) createBox.hidden = true;
    if(home) home.hidden = false;

    const nameEl = document.getElementById('coachAcademyName');
    if(nameEl) nameEl.textContent = academy.name;
    const academyInput = document.getElementById('coachAcademyRenameInput');
    if(academyInput && document.activeElement !== academyInput){
      academyInput.value = academy.name || '';
      academyInput.disabled = !(store.isAcademyOwner && store.isAcademyOwner(session));
    }
    const saveAcademyBtn = document.getElementById('coachSaveAcademyBtn');
    if(saveAcademyBtn){
      saveAcademyBtn.hidden = !(store.isAcademyOwner && store.isAcademyOwner(session));
    }

    const teams = store.listTeams(session, academy.id);
    const profileEmail = document.getElementById('coachProfileEmail');
    const profile = store.getProfile ? store.getProfile(session) : {email: session.email || '', first_name:'', last_name:''};
    const firstInput = document.getElementById('coachFirstName');
    const lastInput = document.getElementById('coachLastName');
    if(firstInput && document.activeElement !== firstInput) firstInput.value = profile.first_name || '';
    if(lastInput && document.activeElement !== lastInput) lastInput.value = profile.last_name || '';
    const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ');
    if(profileEmail) profileEmail.textContent = profile.email || session.email || '';

    let players = 0;
    let matches = 0;
    let ratings = 0;
    teams.forEach(t => {
      players += store.listPlayers(session, t.id).length;
      const ms = store.listMatches(session, t.id);
      matches += ms.filter(m => m.status === 'played' || String(m.score || '').trim()).length;
      ms.forEach(m => {
        ratings += store.listRatings(session, m.id).length;
      });
    });
    const homeStats = document.getElementById('coachHomeStats');
    if(homeStats){
      homeStats.hidden = false;
      homeStats.innerHTML = coachJumpStatsHtml(teams.length, players, matches, ratings);
    }
    renderCoachLeaveRequests(session);

    let activeId = store.getActiveTeamId();
    if(teams.length && !teams.some(t => t.id === activeId)) activeId = teams[0].id;
    if(activeId) store.setActiveTeamId(activeId);
    const active = store.getTeam(session, store.getActiveTeamId());

    const homeAcademy = document.getElementById('coachHomeAcademy');
    const homeTitle = document.getElementById('coachHomeTitle');
    const homeMeta = document.getElementById('coachHomeMeta');
    if(homeAcademy) homeAcademy.textContent = academy.name;
    if(homeTitle){
      if(active) homeTitle.textContent = active.name + (active.age_group ? ` · ${active.age_group}` : '');
      else if(fullName) homeTitle.textContent = fullName;
      else homeTitle.textContent = academy.name;
    }
    if(homeMeta){
      const bits = [
        fullName || '',
        teams.length ? `${teams.length} ${tt('coachStatTeams', 'Teams')}` : '',
        players ? `${players} ${tt('coachStatPlayers', 'Players')}` : ''
      ].filter(Boolean);
      homeMeta.textContent = bits.join(' · ');
    }

    const canAddTeam = !!(store.isAcademyOwner && store.isAcademyOwner(session));
    const teamListHtml = !teams.length
      ? `<div class="inbox-empty coach-tab-empty">${esc(tt('coachNoTeams', 'No teams'))}</div>`
      : teams.map(t => {
          const on = t.id === activeId;
          const n = store.listPlayers(session, t.id).length;
          const maxP = typeof COACH_MAX_PLAYERS_PER_TEAM === 'number' ? COACH_MAX_PLAYERS_PER_TEAM : 50;
          const activeLab = on ? `<span class="coach-team-active">${esc(tt('coachTeamActive', 'Active'))}</span>` : '';
          const menuBtn = canAddTeam
            ? `<button type="button" class="coach-team-more" data-team-menu="${esc(t.id)}" aria-label="${esc(tt('coachTeamMenuAria', 'Team menu'))}">⋯</button>`
            : '';
          return `<div class="coach-team-item${on ? ' on' : ''}">
            <button type="button" class="coach-team-main" data-team="${esc(t.id)}">
              <span class="coach-team-name">${esc(t.name)}${t.age_group ? ` · ${esc(t.age_group)}` : ''}</span>
              <span class="coach-team-meta">${n}/${maxP}${activeLab ? ` · ` : ''}${activeLab}</span>
            </button>
            ${menuBtn}
          </div>`;
        }).join('');
    const list = document.getElementById('coachTeamList');
    if(list) list.innerHTML = teamListHtml;

    const addBtn = document.getElementById('coachAddTeamBtn');
    if(addBtn){
      addBtn.hidden = !canAddTeam;
      const maxTeams = typeof COACH_MAX_TEAMS === 'number' ? COACH_MAX_TEAMS : 10;
      addBtn.disabled = teams.length >= maxTeams;
    }
    if(!canAddTeam) setHomeCreateTeamOpen(false);

    if(teamPane) teamPane.hidden = !active;
    if(active){
      renderTeamPane(session, active);
      renderMatchPane(session, active);
      renderAnalyticsPane(session, active);
      renderCoachHistoryTab(session, active);
    }else{
      renderCoachTabsEmpty();
    }
    if(typeof applyHeader === 'function') applyHeader();
    if(typeof syncCoachModeViews === 'function') syncCoachModeViews();
    renderAssistantsBlock(session);
    renderCloudPushStatus();
  }

  function openCoachSettings(){
    const sheet = document.getElementById('coachSettingsSheet');
    const back = document.getElementById('coachSettingsBack');
    const card = document.getElementById('coachSettingsCard');
    if(!sheet) return;
    const store = global.CoachStore;
    const session = store && store.getSession();
    if(session) renderWorkspace(session);
    if(typeof refreshCoachMediaUi === 'function') refreshCoachMediaUi();
    if(typeof presentSheetCard === 'function') presentSheetCard(card, back);
    else{
      sheet.hidden = false;
      if(back) back.hidden = false;
    }
    if(typeof pushAppState === 'function') pushAppState('layer');
  }
  function closeCoachSettings(){
    const back = document.getElementById('coachSettingsBack');
    const card = document.getElementById('coachSettingsCard');
    if(typeof hideSheetCard === 'function') hideSheetCard(card, back);
    else{
      const sheet = document.getElementById('coachSettingsSheet');
      if(sheet) sheet.hidden = true;
      if(back) back.hidden = true;
    }
  }

  function renderCoachTabsEmpty(){
    const teamEls = ['coachMatchTabTeam','coachHistoryTeam','coachStatsTeam'];
    teamEls.forEach(id => {
      const el = document.getElementById(id);
      if(el) el.textContent = '—';
    });
    document.querySelectorAll('.js-cm-squad').forEach(el => {
      el.innerHTML = `<p class="hint">${esc(tt('coachPickTeamFirst', 'Pick a team in the Coach tab first.'))}</p>`;
    });
    document.querySelectorAll('.js-cm-matches, .js-cm-rates').forEach(el => { el.innerHTML = ''; });
    const detail = document.getElementById('coachMatchDetail');
    if(detail) detail.hidden = true;
    setCoachMatchCreateOpen(false);
    const hist = document.getElementById('coachHistoryList');
    if(hist) hist.innerHTML = `<p class="hint">${esc(tt('coachPickTeamFirst', 'Pick a team in the Coach tab first.'))}</p>`;
    const stats = document.getElementById('coachStatsBoard');
    if(stats) stats.innerHTML = `<p class="hint">${esc(tt('coachPickTeamFirst', 'Pick a team in the Coach tab first.'))}</p>`;
  }

  function setPlayerFormOpen(on){
    const wrap = document.getElementById('coachPlayerFormWrap');
    const showBtn = document.getElementById('coachShowAddPlayerBtn');
    if(wrap) wrap.hidden = !on;
    if(showBtn) showBtn.hidden = !!on;
    if(on){
      try{ document.getElementById('coachPlayerFirst')?.focus(); }catch(e){}
    }
  }
  function renderTeamPane(session, team){
    const store = global.CoachStore;
    const title = document.getElementById('coachTeamTitle');
    if(title) title.textContent = team.name + (team.age_group ? ` · ${team.age_group}` : '');
    const posSel = document.getElementById('coachPlayerPos');
    if(posSel && typeof fillPitchSelect === 'function'){
      const keep = posSel.value;
      fillPitchSelect(posSel, keep || 'RW', true);
    }

    const players = store.listPlayers(session, team.id);
    syncRosterFoldUi(players.length);
    const formWrap = document.getElementById('coachPlayerFormWrap');
    // Keep form closed unless user opened it (and it's currently visible).
    if(formWrap && formWrap.hidden) setPlayerFormOpen(false);
    const el = document.getElementById('coachPlayerList');
    if(!el) return;
    if(!players.length){
      el.innerHTML = `<div class="inbox-empty coach-tab-empty">${esc(tt('coachNoPlayers', 'No players'))}</div>`;
      return;
    }
    el.innerHTML = players.map(p => {
      const label = [p.first_name, p.last_name].filter(Boolean).join(' ');
      const pos = p.position && typeof pitchPosLabelShort === 'function'
        ? pitchPosLabelShort(p.position)
        : (p.position || '');
      const meta = [
        p.number ? `#${p.number}` : '',
        pos,
        p.contact ? p.contact : ''
      ].filter(Boolean).join(' · ');
      const hasNotes = !!String(p.coach_notes || '').trim();
      const verified = isCoachPlayerVerified(p);
      const nameHtml = verified && typeof nameWithVerifiedHtml === 'function'
        ? nameWithVerifiedHtml(label, true)
        : esc(label);
      return `<div class="coach-player-row">
        <button type="button" class="coach-player-open" data-open-player="${esc(p.id)}">
          ${coachPlayerAvatarHtml(p)}
          <span class="coach-player-text">
            <b>${nameHtml}${hasNotes ? '<span class="coach-note-dot" title="'+esc(tt('coachPrivateNotesKicker', 'Private notes'))+'" aria-hidden="true"></span>' : ''}</b>
            ${meta ? `<span>${esc(meta)}</span>` : ''}
          </span>
        </button>
      </div>`;
    }).join('');
  }

  function playerLabel(p){
    return [p.first_name, p.last_name].filter(Boolean).join(' ');
  }
  function normNamePart(s){
    return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }
  function normPersonName(a, b){
    return [normNamePart(a), normNamePart(b)].filter(Boolean).join(' ');
  }
  function namesSoftMatch(aFirst, aLast, bFirst, bLast){
    const af = normNamePart(aFirst);
    const al = normNamePart(aLast);
    const bf = normNamePart(bFirst);
    const bl = normNamePart(bLast);
    if(!af && !al) return false;
    const aFull = [af, al].filter(Boolean).join(' ');
    const bFull = [bf, bl].filter(Boolean).join(' ');
    if(aFull && bFull && aFull === bFull) return true;
    if(af && bf && af === bf && (!al || !bl || al === bl)) return true;
    return false;
  }
  function personalPlayersWithMedia(){
    try{
      return typeof listPersonalPlayersWithMedia === 'function'
        ? listPersonalPlayersWithMedia()
        : [];
    }catch(e){
      return [];
    }
  }
  function personalPhotoById(id){
    const sid = String(id || '');
    if(!sid) return '';
    const player = personalPlayersWithMedia().find(p => p && String(p.id) === sid);
    return player && player.photo ? String(player.photo) : '';
  }
  function personalPhotoByName(first, last){
    const list = personalPlayersWithMedia();
    for(const p of list){
      if(!p || !p.photo) continue;
      if(namesSoftMatch(first, last, p.firstName, p.lastName)) return String(p.photo);
    }
    return '';
  }
  function bindLegacyPersonalPhotoLinks(){
    try{
      const parent = global.ParentStore;
      if(!parent || typeof parent.listLinks !== 'function' || typeof parent.bindPersonalPlayer !== 'function') return;
      const links = parent.listLinks();
      const profiles = personalPlayersWithMedia();
      const used = new Set(links.map(l => String(l && l.personal_player_id || '')).filter(Boolean));
      links.filter(l => l && l.player && !l.personal_player_id).forEach(link => {
        const matches = profiles.filter(p =>
          p && !used.has(String(p.id)) &&
          namesSoftMatch(link.player.first_name, link.player.last_name, p.firstName, p.lastName)
        );
        if(matches.length === 1){
          parent.bindPersonalPlayer(link.id, matches[0].id);
          used.add(String(matches[0].id));
        }
      });
      const freshLinks = parent.listLinks().filter(l => l && !l.personal_player_id);
      const freeProfiles = profiles.filter(p => p && !used.has(String(p.id)));
      if(freshLinks.length === 1 && freeProfiles.length === 1){
        parent.bindPersonalPlayer(freshLinks[0].id, freeProfiles[0].id);
      }
    }catch(e){}
  }
  /** Resolve the personal profile explicitly attached when the coach invite was claimed. */
  function linkedPersonalPhoto(tp){
    if(!tp || !tp.id) return '';
    try{
      const links = global.ParentStore && typeof global.ParentStore.listLinks === 'function'
        ? global.ParentStore.listLinks()
        : [];
      const link = links.find(l => l && l.player && String(l.player.id) === String(tp.id));
      if(!link) return '';
      const byId = personalPhotoById(link.personal_player_id);
      if(byId) return byId;
      const byLinkedName = personalPhotoByName(link.player.first_name, link.player.last_name);
      if(byLinkedName) return byLinkedName;
      // Links created before personal_player_id existed: with one coach link,
      // the active personal profile is the profile that the old UI marked verified.
      if(links.length === 1){
        try{
          const roster = JSON.parse(localStorage.getItem('ffk_roster_v1') || 'null');
          const active = roster && roster.currentId ? personalPhotoById(roster.currentId) : '';
          if(active) return active;
        }catch(e){}
        const withPhoto = personalPlayersWithMedia().filter(p => p && p.photo);
        if(withPhoto.length === 1) return String(withPhoto[0].photo);
      }
    }catch(e){}
    return '';
  }
  function usablePhoto(src){
    try{
      if(typeof isUsablePhoto === 'function') return isUsablePhoto(src);
    }catch(e){}
    const p = String(src || '');
    return p.startsWith('data:image/') && p.length > 64;
  }
  /** Photo for a coach roster player: IDB cache, stored field, else matching Free/Pro profile. */
  function resolveCoachPlayerPhoto(tp){
    if(!tp) return '';
    if(usablePhoto(tp.photo)) return String(tp.photo);
    try{
      if(tp.id && typeof getCoachMediaPhoto === 'function'){
        const cached = getCoachMediaPhoto(tp.id);
        if(cached) return cached;
      }
    }catch(e){}
    const fromLink = linkedPersonalPhoto(tp);
    if(fromLink) return fromLink;
    const fromPersonal = personalPhotoByName(tp.first_name, tp.last_name);
    if(fromPersonal) return fromPersonal;
    return '';
  }
  function coachPlayerAvatarHtml(tp){
    const photo = resolveCoachPlayerPhoto(tp);
    const label = playerLabel(tp) || '?';
    const letter = (label.trim().slice(0, 1) || '?').toUpperCase();
    if(photo){
      return `<span class="coach-player-av"><img alt="" src="${esc(photo)}"></span>`;
    }
    return `<span class="coach-player-av" aria-hidden="true">${esc(letter)}</span>`;
  }
  function isCoachPlayerVerified(tp){
    if(!tp) return false;
    try{
      const store = global.CoachStore;
      const session = store && store.getSession && store.getSession();
      if(session && typeof store.parentLinkedForPlayer === 'function'
        && store.parentLinkedForPlayer(tp.id)) return true;
    }catch(e){}
    if(typeof isCoachVerifiedPerson === 'function'){
      return isCoachVerifiedPerson(tp.first_name, tp.last_name);
    }
    return false;
  }
  /** Copy Free/Pro profile photos onto matching coach roster players (IndexedDB — not coach LS). */
  function syncCoachPlayerPhotosFromPersonal(){
    const store = global.CoachStore;
    const session = store && store.getSession && store.getSession();
    if(!store || !session) return 0;
    let n = 0;
    try{
      bindLegacyPersonalPhotoLinks();
      const academy = store.myAcademy && store.myAcademy(session);
      const teams = academy && store.listTeams
        ? store.listTeams(session, academy.id)
        : [];
      teams.forEach(team => {
        if(!team) return;
        store.listPlayers(session, team.id).forEach(tp => {
          if(!tp || !tp.id) return;
          let photo = linkedPersonalPhoto(tp);
          if(!photo) photo = personalPhotoByName(tp.first_name, tp.last_name);
          if(!photo && usablePhoto(tp.photo)) photo = String(tp.photo);
          if(!photo){
            try{
              if(typeof getCoachMediaPhoto === 'function') photo = getCoachMediaPhoto(tp.id) || '';
            }catch(e){}
          }
          if(!photo) return;
          let changed = false;
          try{
            if(typeof setCoachMediaPhoto === 'function'){
              const prev = typeof getCoachMediaPhoto === 'function' ? getCoachMediaPhoto(tp.id) : '';
              if(prev !== photo){
                setCoachMediaPhoto(tp.id, photo);
                changed = true;
              }
            }
          }catch(e){}
          // Drop bulky data URLs from coach localStorage — they blow the quota.
          if(String(tp.photo || '') && typeof store.updatePlayer === 'function'){
            try{
              store.updatePlayer(session, tp.id, {photo: ''});
              changed = true;
            }catch(e){}
          }
          if(changed) n += 1;
        });
      });
    }catch(e){}
    return n;
  }
  function selectedSquadFrom(scope){
    // Prefer an explicit squad picker node.
    if(scope && scope.classList && (scope.classList.contains('js-cm-squad') || scope.classList.contains('js-cm-squad-edit'))){
      return [...scope.querySelectorAll('input[type="checkbox"]:checked')]
        .map(el => el.value)
        .filter(Boolean);
    }
    // When scanning a page section, never pick a hidden edit picker over the create form.
    const root = scope && scope.querySelector ? scope : document;
    const createPicker = root.querySelector && root.querySelector('#coachMatchCreate .js-cm-squad');
    const createOpen = createPicker && !document.getElementById('coachMatchCreate')?.hidden;
    const editPicker = root.querySelector && root.querySelector('#coachMatchSquadEdit .js-cm-squad-edit');
    const editOpen = editPicker && !document.getElementById('coachMatchSquadEdit')?.hidden;
    const picker = (editOpen && editPicker)
      || (createOpen && createPicker)
      || createPicker
      || (root.querySelector && root.querySelector('.js-cm-squad'))
      || root;
    return [...picker.querySelectorAll('input[type="checkbox"]:checked')]
      .map(el => el.value)
      .filter(Boolean);
  }
  function setSquadChecks(root, ids){
    const want = new Set((ids || []).map(String));
    const scope = root || document;
    scope.querySelectorAll('.js-cm-squad input[type="checkbox"], .js-cm-squad-edit input[type="checkbox"]').forEach(el => {
      el.checked = want.has(el.value);
    });
  }
  function squadPickerHtml(players, selectedIds){
    if(!players.length){
      return `<p class="hint">${esc(tt('coachNoPlayers', 'Add players to this team.'))}</p>`;
    }
    const sel = new Set((selectedIds || players.map(p => p.id)).map(String));
    return players.map(p => {
      const label = playerLabel(p);
      const pos = p.position && typeof pitchPosLabelShort === 'function'
        ? pitchPosLabelShort(p.position)
        : (p.position || '');
      const meta = [p.number ? `#${p.number}` : '', pos].filter(Boolean).join(' · ');
      const on = sel.has(p.id) ? ' checked' : '';
      return `<label class="coach-squad-item">
        <input type="checkbox" value="${esc(p.id)}"${on}>
        <span class="coach-squad-main">
          <b>${esc(label)}</b>
          ${meta ? `<span>${esc(meta)}</span>` : ''}
        </span>
      </label>`;
    }).join('');
  }
  function matchIsPlayed(m){
    if(!m) return false;
    return m.status === 'played' || !!String(m.score || '').trim();
  }
  function scoreParts(score){
    const s = String(score || '').trim();
    if(!s) return {us: '', them: ''};
    const m = s.match(/^(\d+)\s*[:\-]\s*(\d+)$/);
    if(!m) return {us: '', them: ''};
    return {us: m[1], them: m[2]};
  }
  /** @returns {'win'|'draw'|'loss'|null} */
  function matchOutcome(m){
    if(!m || !matchIsPlayed(m)) return null;
    const p = scoreParts(m.score);
    if(p.us === '' || p.them === '') return null;
    const us = Number(p.us);
    const them = Number(p.them);
    if(!Number.isFinite(us) || !Number.isFinite(them)) return null;
    if(us > them) return 'win';
    if(us < them) return 'loss';
    return 'draw';
  }
  function matchOutcomeLabel(outcome){
    if(outcome === 'win') return tt('coachMatchWin', 'Win');
    if(outcome === 'draw') return tt('coachMatchDraw', 'Draw');
    if(outcome === 'loss') return tt('coachMatchLoss', 'Loss');
    return '';
  }
  function matchScoreWithResultHtml(score){
    const scoreTxt = String(score || '').trim();
    if(!scoreTxt) return '';
    try{
      if(typeof scoreLineHtml === 'function') return scoreLineHtml({score: scoreTxt});
    }catch(e){}
    const outcome = matchOutcome({score: scoreTxt, status: 'played'});
    const lab = matchOutcomeLabel(outcome);
    if(!lab || !outcome) return esc(scoreTxt);
    return `${esc(scoreTxt)} · <span class="match-result ${outcome}">${esc(lab)}</span>`;
  }
  function ratingRowHeadHtml(r){
    const bits = [];
    if(r && r.date) bits.push(esc(r.date));
    if(r && r.opponent) bits.push(esc(r.opponent));
    const scoreHtml = matchScoreWithResultHtml(r && r.score);
    if(scoreHtml) bits.push(scoreHtml);
    return bits.join(' · ') || '—';
  }
  function matchListRowHtml(m, opts){
    opts = opts || {};
    const store = global.CoachStore;
    const session = store.getSession();
    const on = opts.activeId && m.id === opts.activeId ? ' on' : '';
    const rated = session ? store.listRatings(session, m.id).length : 0;
    const squadN = session ? store.matchSquadIds(session, m).length : 0;
    const played = matchIsPlayed(m);
    const outcome = matchOutcome(m);
    const scoreTxt = String(m.score || '').trim();
    const phaseLab = played
      ? tt('coachMatchPlayed', 'played')
      : tt('coachMatchUpcoming', 'upcoming');
    const resultLab = outcome ? matchOutcomeLabel(outcome) : '';
    const badgeCls = played
      ? (outcome ? `is-${outcome}` : 'is-played')
      : 'is-upcoming';
    const badgeInner = played
      ? (scoreTxt
        ? `${esc(resultLab || phaseLab)} · ${esc(scoreTxt)}`
        : esc(phaseLab))
      : esc(phaseLab);
    const meta = played
      ? `${squadN} ${tt('coachSquadShort', 'played')} · ${rated}/${squadN} ${tt('coachRatedShort', 'rated')}`
      : [
          m.meetup ? m.meetup : '',
          m.kickoff ? m.kickoff : '',
          m.fee_type === 'paid'
            ? (m.fee ? m.fee : tt('coachMatchFeePaidShort', 'Entry'))
            : '',
          m.tournament || '',
          `${squadN} ${tt('coachSquadShort', 'played')}`,
          opts.showAddress && m.address ? m.address : ''
        ].filter(Boolean).join(' · ');
    const attr = opts.openAttr || 'data-match';
    const tourBit = m.tournament
      ? `<span class="coach-match-tour">${esc(m.tournament)}</span>`
      : '';
    const timeBits = [m.meetup, m.kickoff].filter(Boolean).join(' · ');
    return `<button type="button" class="coach-team-item coach-match-item ${badgeCls}${on}" ${attr}="${esc(m.id)}">
      <span class="coach-match-row-top">
        <span class="coach-team-name">${esc(m.date)}${timeBits ? ` · ${esc(timeBits)}` : ''} · ${esc(m.opponent)}</span>
        <span class="coach-match-badge ${badgeCls}">${badgeInner}</span>
      </span>
      ${tourBit}
      <span class="coach-team-meta">${esc(meta)}</span>
    </button>`;
  }
  function sortMatchesForList(matches){
    const list = (matches || []).slice();
    list.sort((a, b) => {
      const ap = matchIsPlayed(a) ? 1 : 0;
      const bp = matchIsPlayed(b) ? 1 : 0;
      if(ap !== bp) return ap - bp; // upcoming first
      const ad = String(a.date || '');
      const bd = String(b.date || '');
      if(ap === 0) return ad.localeCompare(bd); // upcoming: soonest first
      return bd.localeCompare(ad); // played: newest first
    });
    return list;
  }
  function scoreFromCoachFields(root){
    const scope = root || document;
    const us = String(scope.querySelector('.js-cm-score-us')?.value || '').trim();
    const them = String(scope.querySelector('.js-cm-score-them')?.value || '').trim();
    if(us === '' && them === '') return '';
    return `${us || '0'}:${them || '0'}`;
  }
  function fillCoachScoreFields(root, score){
    const p = scoreParts(score);
    const scope = root || document;
    const us = scope.querySelector('.js-cm-score-us');
    const them = scope.querySelector('.js-cm-score-them');
    if(us && document.activeElement !== us) us.value = p.us;
    if(them && document.activeElement !== them) them.value = p.them;
  }
  function setCoachMatchCreateOpen(on){
    const box = document.getElementById('coachMatchCreate');
    if(box) box.hidden = !on;
    if(on){
      syncCoachCompetitionField();
      fillCoachTourDatalist();
      ensureCoachKickoffSelects();
      ensureCoachMeetupSelects();
      syncCoachFeeAmountWrap();
    }
  }
  function fillHourMinuteSelects(hSel, mSel){
    if(!hSel || !mSel) return;
    if(!hSel.options.length){
      hSel.innerHTML = `<option value="">—</option>` + Array.from({length: 24}, (_, h) => {
        const v = String(h).padStart(2, '0');
        return `<option value="${v}">${v}</option>`;
      }).join('');
    }
    if(!mSel.options.length){
      // 5-minute steps, European 24h (no AM/PM)
      mSel.innerHTML = `<option value="">—</option>` + [0,5,10,15,20,25,30,35,40,45,50,55].map(m => {
        const v = String(m).padStart(2, '0');
        return `<option value="${v}">${v}</option>`;
      }).join('');
    }
  }
  function ensureCoachKickoffSelects(){
    const hSel = document.getElementById('coachKickoffH');
    const mSel = document.getElementById('coachKickoffM');
    fillHourMinuteSelects(hSel, mSel);
    syncCoachKickoffHidden();
  }
  function syncCoachKickoffHidden(){
    const h = document.getElementById('coachKickoffH')?.value || '';
    const m = document.getElementById('coachKickoffM')?.value || '';
    const hidden = document.getElementById('coachKickoffValue');
    if(hidden) hidden.value = (h !== '' && m !== '') ? `${h}:${m}` : '';
  }
  function readCoachKickoff(root){
    const scope = root || document;
    const hidden = scope.querySelector?.('.js-cm-kickoff') || document.getElementById('coachKickoffValue');
    if(hidden && hidden.value) return String(hidden.value);
    const h = scope.querySelector?.('.js-cm-kickoff-h')?.value
      || document.getElementById('coachKickoffH')?.value || '';
    const m = scope.querySelector?.('.js-cm-kickoff-m')?.value
      || document.getElementById('coachKickoffM')?.value || '';
    return (h !== '' && m !== '') ? `${h}:${m}` : '';
  }
  function clearCoachKickoff(){
    const h = document.getElementById('coachKickoffH');
    const m = document.getElementById('coachKickoffM');
    const hidden = document.getElementById('coachKickoffValue');
    if(h) h.value = '';
    if(m) m.value = '';
    if(hidden) hidden.value = '';
  }
  function ensureCoachMeetupSelects(){
    const hSel = document.getElementById('coachMeetupH');
    const mSel = document.getElementById('coachMeetupM');
    fillHourMinuteSelects(hSel, mSel);
    syncCoachMeetupHidden();
  }
  function syncCoachMeetupHidden(){
    const h = document.getElementById('coachMeetupH')?.value || '';
    const m = document.getElementById('coachMeetupM')?.value || '';
    const hidden = document.getElementById('coachMeetupValue');
    if(hidden) hidden.value = (h !== '' && m !== '') ? `${h}:${m}` : '';
  }
  function readCoachMeetup(root){
    const scope = root || document;
    const hidden = scope.querySelector?.('.js-cm-meetup') || document.getElementById('coachMeetupValue');
    if(hidden && hidden.value) return String(hidden.value);
    const h = scope.querySelector?.('.js-cm-meetup-h')?.value
      || document.getElementById('coachMeetupH')?.value || '';
    const m = scope.querySelector?.('.js-cm-meetup-m')?.value
      || document.getElementById('coachMeetupM')?.value || '';
    return (h !== '' && m !== '') ? `${h}:${m}` : '';
  }
  function clearCoachMeetup(){
    const h = document.getElementById('coachMeetupH');
    const m = document.getElementById('coachMeetupM');
    const hidden = document.getElementById('coachMeetupValue');
    if(h) h.value = '';
    if(m) m.value = '';
    if(hidden) hidden.value = '';
  }
  function syncCoachFeeAmountWrap(){
    const type = document.getElementById('coachFeeType')?.value || 'free';
    const wrap = document.getElementById('coachFeeAmountWrap');
    if(wrap) wrap.hidden = type !== 'paid';
    if(type !== 'paid'){
      const amount = document.getElementById('coachFeeAmount');
      if(amount) amount.value = '';
    }
  }
  function readCoachFee(root){
    const scope = root || document;
    const type = scope.querySelector?.('.js-cm-fee-type')?.value
      || document.getElementById('coachFeeType')?.value
      || 'free';
    if(type !== 'paid') return {fee_type: 'free', fee: ''};
    const fee = String(
      scope.querySelector?.('.js-cm-fee')?.value
      || document.getElementById('coachFeeAmount')?.value
      || ''
    ).trim().slice(0, 32);
    return {fee_type: 'paid', fee};
  }
  function clearCoachFee(){
    const typeEl = document.getElementById('coachFeeType');
    const amount = document.getElementById('coachFeeAmount');
    if(typeEl) typeEl.value = 'free';
    if(amount) amount.value = '';
    syncCoachFeeAmountWrap();
  }
  function formatMatchFee(match){
    if(!match || match.fee_type !== 'paid'){
      return tt('coachMatchFeeFree', 'Free');
    }
    const amount = String(match.fee || '').trim();
    return amount
      ? `${tt('coachMatchFeePaidShort', 'Entry')} ${amount}`
      : tt('coachMatchFeePaid', 'Paid entry');
  }
  function syncCoachCompetitionField(){
    const kind = document.getElementById('coachMatchKindSelect')?.value
      || document.querySelector('#coachMatchCreate .js-cm-kind')?.value
      || 'league';
    const wrap = document.getElementById('coachMatchCompWrap');
    const label = document.getElementById('coachMatchCompLabel');
    const input = document.getElementById('coachMatchTournament');
    if(!wrap) return;
    if(kind === 'friendly'){
      wrap.hidden = true;
      return;
    }
    wrap.hidden = false;
    if(!label || !input) return;
    if(kind === 'league'){
      label.textContent = tt('labelCompLeague', 'League');
      label.setAttribute('data-i18n', 'labelCompLeague');
      input.placeholder = tt('phCompLeague', 'League name');
      input.setAttribute('data-i18n-placeholder', 'phCompLeague');
    }else if(kind === 'cup'){
      label.textContent = tt('labelCompCup', 'Cup');
      label.setAttribute('data-i18n', 'labelCompCup');
      input.placeholder = tt('phCompCup', 'Cup name');
      input.setAttribute('data-i18n-placeholder', 'phCompCup');
    }else{
      label.textContent = tt('labelCompTournament', 'Tournament');
      label.setAttribute('data-i18n', 'labelCompTournament');
      input.placeholder = tt('phTournament', 'Tournament name');
      input.setAttribute('data-i18n-placeholder', 'phTournament');
    }
  }
  function fillCoachTourDatalist(){
    const store = global.CoachStore;
    const session = store && store.getSession();
    const teamId = store && store.getActiveTeamId();
    const list = document.getElementById('coachTourList');
    if(!list || !session || !teamId) return;
    const names = store.listCompetitionNames(session, teamId) || [];
    list.innerHTML = names.map(n => `<option value="${esc(n)}"></option>`).join('');
  }
  let squadEditOpen = false;
  let upcomingMetaOpen = false;
  function setSquadEditOpen(on){
    squadEditOpen = !!on;
    const edit = document.getElementById('coachMatchSquadEdit');
    const view = document.querySelector('#coachMatchUpcomingBox .js-cm-squad-view');
    if(edit) edit.hidden = !squadEditOpen;
    if(view) view.hidden = squadEditOpen ? true : view.hidden;
  }
  function setUpcomingMetaOpen(on){
    upcomingMetaOpen = !!on;
    const body = document.getElementById('coachUpcomingMetaBody');
    const btn = document.getElementById('coachUpcomingMetaToggle');
    if(body) body.hidden = !upcomingMetaOpen;
    if(btn){
      btn.setAttribute('aria-expanded', upcomingMetaOpen ? 'true' : 'false');
      btn.textContent = upcomingMetaOpen
        ? tt('coachUpcomingHideMeta', 'Hide match details')
        : tt('coachUpcomingEditMeta', 'Edit match details');
    }
  }
  function fillUpcomingKickoffSelects(){
    fillHourMinuteSelects(
      document.getElementById('coachUpcomingKickoffH'),
      document.getElementById('coachUpcomingKickoffM')
    );
  }
  function syncUpcomingKickoffHidden(){
    const h = document.getElementById('coachUpcomingKickoffH')?.value || '';
    const m = document.getElementById('coachUpcomingKickoffM')?.value || '';
    const hidden = document.getElementById('coachUpcomingKickoffValue');
    if(hidden) hidden.value = (h !== '' && m !== '') ? `${h}:${m}` : '';
  }
  function setUpcomingKickoff(kickoff){
    fillUpcomingKickoffSelects();
    const raw = String(kickoff || '').trim();
    const m = raw.match(/^(\d{1,2}):(\d{2})$/);
    const hEl = document.getElementById('coachUpcomingKickoffH');
    const mEl = document.getElementById('coachUpcomingKickoffM');
    if(hEl) hEl.value = m ? String(Number(m[1])).padStart(2, '0') : '';
    if(mEl){
      if(m){
        const mins = Number(m[2]);
        const stepped = [0,5,10,15,20,25,30,35,40,45,50,55].reduce((best, cur) =>
          Math.abs(cur - mins) < Math.abs(best - mins) ? cur : best, 0);
        mEl.value = String(stepped).padStart(2, '0');
      }else mEl.value = '';
    }
    syncUpcomingKickoffHidden();
  }
  function readUpcomingKickoff(){
    syncUpcomingKickoffHidden();
    return String(document.getElementById('coachUpcomingKickoffValue')?.value || '');
  }
  function fillUpcomingMeetupSelects(){
    fillHourMinuteSelects(
      document.getElementById('coachUpcomingMeetupH'),
      document.getElementById('coachUpcomingMeetupM')
    );
  }
  function syncUpcomingMeetupHidden(){
    const h = document.getElementById('coachUpcomingMeetupH')?.value || '';
    const m = document.getElementById('coachUpcomingMeetupM')?.value || '';
    const hidden = document.getElementById('coachUpcomingMeetupValue');
    if(hidden) hidden.value = (h !== '' && m !== '') ? `${h}:${m}` : '';
  }
  function setUpcomingMeetup(meetup){
    fillUpcomingMeetupSelects();
    const raw = String(meetup || '').trim();
    const m = raw.match(/^(\d{1,2}):(\d{2})$/);
    const hEl = document.getElementById('coachUpcomingMeetupH');
    const mEl = document.getElementById('coachUpcomingMeetupM');
    if(hEl) hEl.value = m ? String(Number(m[1])).padStart(2, '0') : '';
    if(mEl){
      if(m){
        const mins = Number(m[2]);
        const stepped = [0,5,10,15,20,25,30,35,40,45,50,55].reduce((best, cur) =>
          Math.abs(cur - mins) < Math.abs(best - mins) ? cur : best, 0);
        mEl.value = String(stepped).padStart(2, '0');
      }else mEl.value = '';
    }
    syncUpcomingMeetupHidden();
  }
  function readUpcomingMeetup(){
    syncUpcomingMeetupHidden();
    return String(document.getElementById('coachUpcomingMeetupValue')?.value || '');
  }
  function fillUpcomingMetaForm(match){
    if(!match) return;
    const active = document.activeElement;
    const root = document.getElementById('coachUpcomingMetaEdit');
    if(root && active && root.contains(active)) return;
    const oppEl = document.getElementById('coachUpcomingOpponent');
    const dateEl = document.getElementById('coachUpcomingDate');
    const venueEl = document.getElementById('coachUpcomingVenue');
    const addrEl = document.getElementById('coachUpcomingAddress');
    if(oppEl) oppEl.value = match.opponent || '';
    if(dateEl) dateEl.value = match.date || '';
    if(venueEl) venueEl.value = match.venue === 'away' ? 'away' : 'home';
    if(addrEl) addrEl.value = match.address || '';
    setUpcomingMeetup(match.meetup || '');
    setUpcomingKickoff(match.kickoff || '');
  }
  function renderMatchPane(session, team){
    const store = global.CoachStore;
    const players = store.listPlayers(session, team.id);
    const matches = store.listMatches(session, team.id);
    let activeMatchId = store.getActiveMatchId();
    if(activeMatchId && !matches.some(m => m.id === activeMatchId)) activeMatchId = '';
    // Don't auto-select first match — keeps list clean until coach taps one
    const activeMatch = activeMatchId ? store.getMatch(session, activeMatchId) : null;

    const tabTeam = document.getElementById('coachMatchTabTeam');
    if(tabTeam) tabTeam.textContent = team.name + (team.age_group ? ` · ${team.age_group}` : '');

    document.querySelectorAll('.js-cm-date').forEach(el => {
      if(!el.value) el.value = today();
    });

    // Squad picker only lives inside create form now
    document.querySelectorAll('#coachMatchCreate .js-cm-squad').forEach(el => {
      const hasDirty = el.dataset.dirty === '1';
      const prev = hasDirty ? selectedSquadFrom(el) : null;
      const ids = hasDirty ? (prev || []) : players.map(p => p.id);
      el.innerHTML = squadPickerHtml(players, ids);
      el.dataset.mode = 'manual';
      el.dataset.match = '';
      if(hasDirty) el.dataset.dirty = '1';
    });

    const matchListHtml = (() => {
      // Games tab = upcoming only. Played matches live in History.
      const upcoming = sortMatchesForList(matches).filter(m => !matchIsPlayed(m));
      if(!upcoming.length){
        return `<div class="inbox-empty coach-tab-empty">
          <div>${esc(tt('coachMatchEmptyUpcoming', 'No upcoming matches'))}</div>
          <p class="hint">${esc(tt('coachMatchEmptyHint', 'Create a match here. Finished games live in History.'))}</p>
        </div>`;
      }
      return renderGroupedMatchList(upcoming, activeMatchId, {showAddress: true});
    })();
    document.querySelectorAll('.js-cm-matches').forEach(el => { el.innerHTML = matchListHtml; });
    renderMatchGroupSuggestions(session, team.id, !!activeMatch);

    const listEl = document.querySelector('#coachMatchTab .js-cm-matches');
    const newBtn = document.getElementById('coachMatchNewBtn');
    const createBox = document.getElementById('coachMatchCreate');
    if(listEl) listEl.hidden = !!activeMatch;
    if(newBtn) newBtn.hidden = !!activeMatch;
    if(createBox && activeMatch) createBox.hidden = true;

    const detail = document.getElementById('coachMatchDetail');
    const upcomingBox = document.getElementById('coachMatchUpcomingBox');
    const playedBox = document.getElementById('coachMatchPlayedBox');
    const summary = document.getElementById('coachMatchSummary');
    if(!activeMatch){
      if(detail) detail.hidden = true;
      if(upcomingBox) upcomingBox.hidden = true;
      if(playedBox) playedBox.hidden = true;
      if(summary) summary.innerHTML = '';
      if(listEl) listEl.hidden = false;
      if(newBtn) newBtn.hidden = false;
      squadEditOpen = false;
      upcomingMetaOpen = false;
      setUpcomingMetaOpen(false);
      return;
    }

    if(detail) detail.hidden = false;
    const played = matchIsPlayed(activeMatch);
    if(upcomingBox) upcomingBox.hidden = played;
    if(playedBox) playedBox.hidden = !played;
    if(played){
      squadEditOpen = false;
      upcomingMetaOpen = false;
      setUpcomingMetaOpen(false);
    }

    if(summary){
      const outcome = matchOutcome(activeMatch);
      const outcomeLab = matchOutcomeLabel(outcome);
      const venueLab = activeMatch.venue === 'away'
        ? tt('venueAway', 'Away')
        : tt('venueHome', 'Home');
      const kindLab = ({
        league: tt('kindLeague', 'League'),
        friendly: tt('kindFriendly', 'Friendly'),
        cup: tt('kindCup', 'Cup'),
        tournament: tt('kindTournament', 'Tournament')
      })[activeMatch.kind] || '';
      const bits = [
        activeMatch.date,
        activeMatch.meetup
          ? `${tt('coachMatchMeetup', 'Meetup')} ${activeMatch.meetup}`
          : '',
        activeMatch.kickoff
          ? `${tt('coachMatchKickoff', 'Kick-off')} ${activeMatch.kickoff}`
          : '',
        formatMatchFee(activeMatch),
        venueLab,
        kindLab,
        activeMatch.tournament || '',
        activeMatch.address || '',
        played
          ? (activeMatch.score
            ? `${tt('labelScore', 'Score')} ${activeMatch.score}${outcomeLab ? ` · ${outcomeLab}` : ''}`
            : tt('coachMatchPlayed', 'played'))
          : tt('coachMatchUpcoming', 'upcoming')
      ].filter(Boolean);
      const badgeCls = played
        ? (outcome ? `is-${outcome}` : 'is-played')
        : 'is-upcoming';
      const badgeTxt = played
        ? (outcomeLab
          ? `${outcomeLab}${activeMatch.score ? ` · ${activeMatch.score}` : ''}`
          : (activeMatch.score || tt('coachMatchPlayed', 'played')))
        : tt('coachMatchUpcoming', 'upcoming');
      summary.innerHTML = `<div class="coach-match-row-top">
        <b>${esc(activeMatch.opponent)}</b>
        <span class="coach-match-badge ${badgeCls}">${esc(badgeTxt)}</span>
      </div><span class="hint">${esc(bits.join(' · '))}</span>`;
    }

    if(!played){
      fillUpcomingMetaForm(activeMatch);
      setUpcomingMetaOpen(upcomingMetaOpen);
      renderUpcomingSquad(session, activeMatch);
      const editBox = document.getElementById('coachMatchSquadEdit');
      if(squadEditOpen){
        const picker = document.querySelector('#coachMatchSquadEdit .js-cm-squad-edit');
        if(picker){
          const ids = store.matchSquadIds(session, activeMatch);
          picker.innerHTML = squadPickerHtml(players, ids);
          picker.dataset.dirty = '1';
          picker.dataset.match = activeMatch.id;
        }
        if(editBox) editBox.hidden = false;
        document.querySelectorAll('#coachMatchUpcomingBox .js-cm-squad-view').forEach(el => { el.hidden = true; });
      }else if(editBox){
        editBox.hidden = true;
      }
    }else{
      fillCoachScoreFields(document.getElementById('coachMatchPlayedBox'), activeMatch.score || '');
      const squadPlayers = store.listMatchPlayers(session, activeMatch);
      let rateHtml = '';
      if(!squadPlayers.length){
        rateHtml = `<p class="hint">${esc(tt('coachSquadEmpty', 'Select who plays in this match.'))}</p>`;
      }else{
        rateHtml = squadPlayers.map(p => {
          const label = playerLabel(p);
          const rating = store.getRatingForPlayer(session, activeMatch.id, p.id);
          const btnLabel = rating
            ? `${tt('coachEditRating', 'Edit')} ${Number(rating.rating).toFixed(1)}`
            : tt('coachRatePlayer', 'Rate');
          const note = rating
            ? (rating.comment
              ? esc(String(rating.comment).slice(0, 80))
              : esc(tt('coachRated', 'Rated')))
            : esc(tt('coachNotRated', 'Not rated'));
          return `<div class="coach-player-row">
            <button type="button" class="coach-player-main coach-player-open" data-open-player="${esc(p.id)}">
              <b>${esc(label)}</b>
              <span>${note}</span>
            </button>
            <button type="button" class="save-btn coach-rate-btn" data-rate-player="${esc(p.id)}" data-match="${esc(activeMatch.id)}">${esc(btnLabel)}</button>
          </div>`;
        }).join('');
      }
      document.querySelectorAll('.js-cm-rates').forEach(el => { el.innerHTML = rateHtml; });
      const sentInfo = resultsSentForMatch(session, activeMatch);
      const statusEl = document.getElementById('coachResultsStatus');
      if(statusEl){
        if(!sentInfo.total){
          statusEl.textContent = tt('coachResultsNoneYet', 'Rate players, then send cards to parents.');
        }else if(sentInfo.sent >= sentInfo.total){
          statusEl.textContent = tt('coachResultsAllSent', 'Cards sent for all rated players.')
            .replace('{n}', String(sentInfo.sent));
        }else{
          statusEl.textContent = tt('coachResultsPartialSent', '{s}/{t} cards sent — you can send again.')
            .replace('{s}', String(sentInfo.sent))
            .replace('{t}', String(sentInfo.total));
        }
      }
      document.querySelectorAll('.js-cm-send-results').forEach(btn => {
        btn.textContent = sentInfo.sent
          ? tt('coachSendResultsAgainBtn', 'Send / update cards to parents')
          : tt('coachSendResultsBtn', 'Send cards to parents');
      });
    }
  }

  function renderGroupedMatchList(list, activeMatchId, opts){
    opts = opts || {};
    const groups = new Map();
    const singles = [];
    (list || []).forEach(m => {
      const eid = String(m.event_id || '').trim();
      if(eid){
        if(!groups.has(eid)) groups.set(eid, []);
        groups.get(eid).push(m);
      }else singles.push(m);
    });
    const parts = [];
    groups.forEach((items) => {
      items.sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.kickoff||'').localeCompare(String(b.kickoff||'')));
      const title = items.find(x => x.tournament)?.tournament
        || tt('kindTournament', 'Tournament');
      const dates = [...new Set(items.map(x => x.date))].join(' · ');
      parts.push(`<div class="coach-match-event">
        <div class="coach-match-event-head">
          <b>${esc(title)}</b>
          <span>${esc(dates)} · ${items.length} ${esc(tt('coachGames', 'games'))}</span>
        </div>
        ${items.map(m => matchListRowHtml(m, {
          activeId: activeMatchId,
          showAddress: opts.showAddress,
          openAttr: opts.openAttr
        })).join('')}
      </div>`);
    });
    singles.forEach(m => {
      parts.push(matchListRowHtml(m, {
        activeId: activeMatchId,
        showAddress: opts.showAddress,
        openAttr: opts.openAttr
      }));
    });
    return parts.join('');
  }
  function renderMatchGroupSuggestions(session, teamId, hide){
    const box = document.getElementById('coachMatchSuggestions');
    if(!box) return;
    if(hide){
      box.hidden = true;
      box.innerHTML = '';
      return;
    }
    const store = global.CoachStore;
    const groups = store.suggestMatchGroups(session, teamId) || [];
    if(!groups.length){
      box.hidden = true;
      box.innerHTML = '';
      return;
    }
    box.hidden = false;
    box.innerHTML = groups.slice(0, 3).map((g, idx) => {
      const dates = (g.dates || []).join(' · ');
      const ops = g.matches.map(m => m.opponent).slice(0, 4).join(', ');
      const name = g.tournament
        || tt('coachMatchSuggestNamePh', 'Tournament name');
      return `<div class="coach-match-suggest" data-suggest-idx="${idx}">
        <div class="coach-match-suggest-text">
          <b>${esc(tt('coachMatchSuggestTitle', 'Group as one tournament?'))}</b>
          <span>${esc(dates)} · ${g.matches.length} ${esc(tt('coachGames', 'games'))}: ${esc(ops)}</span>
        </div>
        <input type="text" class="js-cm-suggest-name" maxlength="48" value="${esc(g.tournament || '')}" placeholder="${esc(name)}">
        <div class="coach-match-suggest-actions">
          <button type="button" class="save-btn js-cm-suggest-link" data-ids="${esc(g.matches.map(m => m.id).join(','))}">${esc(tt('coachMatchSuggestLink', 'Group'))}</button>
          <button type="button" class="ghost-btn js-cm-suggest-dismiss">${esc(tt('previewCancel', 'Cancel'))}</button>
        </div>
      </div>`;
    }).join('');
  }

  function renderUpcomingSquad(session, match){
    document.querySelectorAll('.js-cm-squad-view').forEach(box => {
      if(!match){
        box.hidden = true;
        box.innerHTML = '';
        return;
      }
      const store = global.CoachStore;
      const players = store.listMatchPlayers(session, match);
      if(!players.length){
        box.hidden = false;
        box.innerHTML = `<p class="hint">${esc(tt('coachSquadEmpty', 'Select who plays in this match.'))}</p>`;
        return;
      }
      // Pull latest RSVP answers from parent inbox on this device
      try{
        if(typeof store.syncInviteReadStatuses === 'function'){
          store.syncInviteReadStatuses(session, match.id);
        }
      }catch(e){}
      const invites = store.listInvites(session, match.id);
      const byPlayer = {};
      invites.forEach(inv => { byPlayer[String(inv.team_player_id)] = inv; });
      let accepted = 0, declined = 0, pending = 0;
      const rows = players.map(p => {
        const inv = byPlayer[String(p.id)];
        const rsvp = inv && (inv.rsvp === 'accepted' || inv.rsvp === 'declined') ? inv.rsvp : '';
        if(rsvp === 'accepted') accepted += 1;
        else if(rsvp === 'declined') declined += 1;
        else pending += 1;
        const mark = rsvp === 'accepted'
          ? `<span class="coach-rsvp-mark is-accepted" title="${esc(tt('coachRsvpAccepted', 'Confirmed'))}">✓</span>`
          : rsvp === 'declined'
            ? `<span class="coach-rsvp-mark is-declined" title="${esc(tt('coachRsvpDeclined', 'Declined'))}">✕</span>`
            : `<span class="coach-rsvp-mark is-pending" title="${esc(tt('coachRsvpPending', 'No reply'))}">☐</span>`;
        const bits = [
          p.number ? `#${p.number}` : '',
          playerLabel(p),
          p.position && typeof pitchPosLabelShort === 'function' ? pitchPosLabelShort(p.position) : (p.position || '')
        ].filter(Boolean);
        return `<button type="button" class="coach-invite-row coach-invite-player" data-open-player="${esc(p.id)}">
          ${mark}
          <span class="coach-invite-player-name">${esc(bits.join(' · '))}</span>
          <span class="coach-invite-open-hint" aria-hidden="true">›</span>
        </button>`;
      }).join('');
      const sum = [
        accepted ? `${accepted} ✓` : '',
        declined ? `${declined} ✕` : '',
        pending ? `${pending} ☐` : ''
      ].filter(Boolean).join(' · ');
      box.hidden = false;
      box.innerHTML = `<div class="coach-invite-card">
        <b>${esc(tt('coachSquadLabel', 'Who plays'))}</b>
        ${match.address ? `<p class="hint">${esc(match.address)}</p>` : ''}
        <p class="hint">${esc(tt('coachMatchParentsNotified', 'Parents of selected players get a match notice in the app.'))}</p>
        ${sum ? `<p class="hint coach-rsvp-sum">${esc(tt('coachRsvpSummary', 'Replies'))}: ${esc(sum)}</p>` : ''}
        <div class="coach-invite-rows">${rows}</div>
      </div>`;
    });
  }

  let coachHistoryMatchId = '';
  let coachHistFilter = 'all';
  let coachHistKindFilter = 'all';
  let coachHistSeason = 'all';

  function coachMatchSeason(m){
    try{
      if(typeof matchSeason === 'function') return matchSeason(m);
    }catch(e){}
    try{
      if(typeof seasonFromDate === 'function') return seasonFromDate(m && m.date);
    }catch(e){}
    const iso = String(m && m.date || '');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
    const y = Number(iso.slice(0, 4));
    const mo = Number(iso.slice(5, 7));
    const start = mo >= 7 ? y : y - 1;
    return start + '/' + String((start + 1) % 100).padStart(2, '0');
  }

  function fillHistoryKickoffSelects(){
    fillHourMinuteSelects(
      document.getElementById('coachHistoryKickoffH'),
      document.getElementById('coachHistoryKickoffM')
    );
  }
  function syncHistoryKickoffHidden(){
    const h = document.getElementById('coachHistoryKickoffH')?.value || '';
    const m = document.getElementById('coachHistoryKickoffM')?.value || '';
    const hidden = document.getElementById('coachHistoryKickoffValue');
    if(hidden) hidden.value = (h !== '' && m !== '') ? `${h}:${m}` : '';
  }
  function setHistoryKickoff(kickoff){
    fillHistoryKickoffSelects();
    const raw = String(kickoff || '').trim();
    const m = raw.match(/^(\d{1,2}):(\d{2})$/);
    const hEl = document.getElementById('coachHistoryKickoffH');
    const mEl = document.getElementById('coachHistoryKickoffM');
    if(hEl) hEl.value = m ? String(Number(m[1])).padStart(2, '0') : '';
    if(mEl){
      if(m){
        const mins = Number(m[2]);
        const stepped = [0,5,10,15,20,25,30,35,40,45,50,55].reduce((best, cur) =>
          Math.abs(cur - mins) < Math.abs(best - mins) ? cur : best, 0);
        mEl.value = String(stepped).padStart(2, '0');
      }else mEl.value = '';
    }
    syncHistoryKickoffHidden();
  }
  function readHistoryKickoff(){
    syncHistoryKickoffHidden();
    return String(document.getElementById('coachHistoryKickoffValue')?.value || '');
  }
  function fillHistoryMeetupSelects(){
    fillHourMinuteSelects(
      document.getElementById('coachHistoryMeetupH'),
      document.getElementById('coachHistoryMeetupM')
    );
  }
  function syncHistoryMeetupHidden(){
    const h = document.getElementById('coachHistoryMeetupH')?.value || '';
    const m = document.getElementById('coachHistoryMeetupM')?.value || '';
    const hidden = document.getElementById('coachHistoryMeetupValue');
    if(hidden) hidden.value = (h !== '' && m !== '') ? `${h}:${m}` : '';
  }
  function setHistoryMeetup(meetup){
    fillHistoryMeetupSelects();
    const raw = String(meetup || '').trim();
    const m = raw.match(/^(\d{1,2}):(\d{2})$/);
    const hEl = document.getElementById('coachHistoryMeetupH');
    const mEl = document.getElementById('coachHistoryMeetupM');
    if(hEl) hEl.value = m ? String(Number(m[1])).padStart(2, '0') : '';
    if(mEl){
      if(m){
        const mins = Number(m[2]);
        const stepped = [0,5,10,15,20,25,30,35,40,45,50,55].reduce((best, cur) =>
          Math.abs(cur - mins) < Math.abs(best - mins) ? cur : best, 0);
        mEl.value = String(stepped).padStart(2, '0');
      }else mEl.value = '';
    }
    syncHistoryMeetupHidden();
  }
  function readHistoryMeetup(){
    syncHistoryMeetupHidden();
    return String(document.getElementById('coachHistoryMeetupValue')?.value || '');
  }
  function syncHistoryFeeAmountWrap(){
    const type = document.getElementById('coachHistoryFeeType')?.value || 'free';
    const wrap = document.getElementById('coachHistoryFeeAmountWrap');
    if(wrap) wrap.hidden = type !== 'paid';
    if(type !== 'paid'){
      const amount = document.getElementById('coachHistoryFeeAmount');
      if(amount) amount.value = '';
    }
  }
  function setHistoryFee(match){
    const typeEl = document.getElementById('coachHistoryFeeType');
    const amount = document.getElementById('coachHistoryFeeAmount');
    const paid = match && match.fee_type === 'paid';
    if(typeEl) typeEl.value = paid ? 'paid' : 'free';
    if(amount) amount.value = paid ? String(match.fee || '') : '';
    syncHistoryFeeAmountWrap();
  }
  function readHistoryFee(){
    const type = document.getElementById('coachHistoryFeeType')?.value || 'free';
    if(type !== 'paid') return {fee_type: 'free', fee: ''};
    return {
      fee_type: 'paid',
      fee: String(document.getElementById('coachHistoryFeeAmount')?.value || '').trim().slice(0, 32)
    };
  }
  function syncHistoryCompetitionField(){
    const kind = document.getElementById('coachHistoryKind')?.value || 'league';
    const wrap = document.getElementById('coachHistoryCompWrap');
    const label = document.getElementById('coachHistoryCompLabel');
    const input = document.getElementById('coachHistoryTournament');
    if(!wrap) return;
    if(kind === 'friendly'){
      wrap.hidden = true;
      return;
    }
    wrap.hidden = false;
    if(!label || !input) return;
    if(kind === 'league'){
      label.textContent = tt('labelCompLeague', 'League');
      label.setAttribute('data-i18n', 'labelCompLeague');
      input.placeholder = tt('phCompLeague', 'League name');
      input.setAttribute('data-i18n-placeholder', 'phCompLeague');
    }else if(kind === 'cup'){
      label.textContent = tt('labelCompCup', 'Cup');
      label.setAttribute('data-i18n', 'labelCompCup');
      input.placeholder = tt('phCompCup', 'Cup name');
      input.setAttribute('data-i18n-placeholder', 'phCompCup');
    }else{
      label.textContent = tt('labelCompTournament', 'Tournament');
      label.setAttribute('data-i18n', 'labelCompTournament');
      input.placeholder = tt('phTournament', 'Tournament name');
      input.setAttribute('data-i18n-placeholder', 'phTournament');
    }
  }
  function fillCoachHistorySeasonSelect(matches){
    const sel = document.getElementById('coachHistorySeason');
    if(!sel) return;
    const seasons = [...new Set(matches.map(coachMatchSeason).filter(Boolean))].sort().reverse();
    if(coachHistSeason !== 'all' && !seasons.includes(coachHistSeason)){
      coachHistSeason = 'all';
    }
    const opts = [`<option value="all">${esc(tt('seasonAll', 'All seasons'))}</option>`]
      .concat(seasons.map(s => `<option value="${esc(s)}">${esc(s)}</option>`));
    sel.innerHTML = opts.join('');
    sel.value = coachHistSeason;
  }

  function openCoachMatch(matchId){
    if(!matchId || !global.CoachStore) return;
    global.CoachStore.setActiveMatchId(matchId);
    setCoachMatchCreateOpen(false);
    if(typeof showView === 'function') showView('new');
    renderCoachUi();
    try{
      document.getElementById('coachMatchDetail')?.scrollIntoView({behavior:'smooth', block:'start'});
    }catch(e){}
  }

  function setCoachHistoryMetaOpen(on){
    const body = document.getElementById('coachHistoryMetaBody');
    const btn = document.getElementById('coachHistoryMetaToggle');
    const open = !!on;
    if(body) body.hidden = !open;
    if(btn){
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.textContent = open
        ? tt('coachHistoryHideMeta', 'Hide match details')
        : tt('coachHistoryEditMeta', 'Edit match details');
    }
  }

  function closeCoachHistoryMatch(){
    coachHistoryMatchId = '';
    setCoachHistoryMetaOpen(false);
    syncCoachHistoryDetailUi();
  }

  function openCoachHistoryMatch(matchId){
    if(!matchId || !global.CoachStore) return;
    const switched = String(matchId) !== String(coachHistoryMatchId || '');
    coachHistoryMatchId = String(matchId);
    if(switched) setCoachHistoryMetaOpen(false);
    if(typeof showView === 'function') showView('history');
    renderCoachUi();
    try{
      document.getElementById('coachHistoryDetail')?.scrollIntoView({behavior:'smooth', block:'start'});
    }catch(e){}
  }

  function syncCoachHistoryDetailUi(){
    const listWrap = document.getElementById('coachHistoryListWrap');
    const detail = document.getElementById('coachHistoryDetail');
    const open = !!coachHistoryMatchId;
    if(listWrap) listWrap.hidden = open;
    if(detail) detail.hidden = !open;
  }

  function coachPlayerCardMatch(match, player, rating){
    const name = playerLabel(player);
    const photo = resolveCoachPlayerPhoto(player);
    return {
      date: match.date,
      opponent: match.opponent,
      score: match.score,
      venue: match.venue,
      kind: match.kind,
      cardName: name,
      player: name,
      photo,
      cardPhoto: photo,
      position: rating.position || player.position || 'fwd',
      pitchPos: rating.pitchPos || player.position || 'RW',
      rating: Number(rating.rating) || 6,
      actionRating: Number(rating.actionRating) || Number(rating.rating) || 6,
      effortRating: Number(rating.effortRating) || Number(rating.rating) || 6,
      counts: rating.counts && typeof rating.counts === 'object' ? rating.counts : {},
      behaviors: rating.behaviors && typeof rating.behaviors === 'object' ? rating.behaviors : {},
      minutes: Number(rating.minutes) || 60,
      matchLen: Number(rating.matchLen) || 60,
      comment: rating.comment || '',
      format: rating.format || '2x30',
      role: rating.role || 'start',
      kickoffClock: rating.kickoffClock || ''
    };
  }

  async function shareCoachPlayerCard(matchId, playerId){
    const store = global.CoachStore;
    const session = store.getSession();
    const match = store.getMatch(session, matchId);
    const player = store.listPlayers(session, match && match.team_id).find(p => p.id === playerId);
    const rating = store.getRatingForPlayer(session, matchId, playerId);
    if(!match || !player || !rating){
      toast(tt('coachErrRateFirst', 'Rate the player first.'));
      return;
    }
    const fake = coachPlayerCardMatch(match, player, rating);
    if(typeof openCardPreview === 'function' && typeof drawMatchCardCanvas === 'function'){
      await openCardPreview({
        filename: `matchcard_${String(player.first_name || 'player').slice(0, 16)}_${match.date || 'match'}.png`,
        build: mode => drawMatchCardCanvas(fake, mode)
      });
      return;
    }
    toast(tt('coachErrGeneric', 'Something went wrong.'));
  }

  async function shareCoachTeamMatchCard(matchId){
    const store = global.CoachStore;
    const session = store.getSession();
    const match = store.getMatch(session, matchId || coachHistoryMatchId);
    if(!match) return;
    const team = store.getTeam(session, match.team_id);
    const ratings = store.listRatings(session, match.id)
      .slice()
      .sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0));
    const outcome = matchOutcome(match);
    const outcomeLab = matchOutcomeLabel(outcome);
    if(typeof openCardPreview !== 'function' || typeof makeHiCanvas !== 'function'){
      toast(tt('coachErrGeneric', 'Something went wrong.'));
      return;
    }
    const build = async (mode) => {
      const theme = typeof futTheme === 'function'
        ? futTheme(Math.round(Math.min(99, Math.max(45, (ratings[0] ? Number(ratings[0].rating) : 6) * 10))), mode)
        : {paper:['#151a28','#0b0f1a'], foil:'#c9a227', muted:'#8D9AB5', ink: mode==='light'?'#12141C':'#EDF1F7', glow:'rgba(201,162,39,.25)'};
      const w = 1080;
      const rows = Math.min(8, ratings.length);
      const h = 520 + rows * 56 + (match.comment ? 90 : 0);
      const {canvas, ctx} = makeHiCanvas(w, h);
      ctx.fillStyle = mode === 'light' ? '#FFF8D6' : '#070B14';
      ctx.fillRect(0, 0, w, h);
      const bg = ctx.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, theme.paper[0]);
      bg.addColorStop(1, theme.paper[1] || theme.paper[0]);
      if(typeof pathRoundRect === 'function'){
        pathRoundRect(ctx, 24, 24, w - 48, h - 48, 28);
        ctx.fillStyle = bg;
        ctx.fill();
        ctx.strokeStyle = theme.foil || '#c9a227';
        ctx.lineWidth = 5;
        ctx.stroke();
      }else{
        ctx.fillStyle = bg;
        ctx.fillRect(24, 24, w - 48, h - 48);
      }
      const ink = theme.ink || (mode === 'light' ? '#12141C' : '#EDF1F7');
      const muted = theme.muted || '#8D9AB5';
      const fit = typeof fitText === 'function'
        ? fitText
        : (c, text, x, y) => { c.fillText(text, x, y); };
      const loadImg = typeof loadCanvasImage === 'function'
        ? loadCanvasImage
        : async () => null;
      ctx.fillStyle = muted;
      ctx.font = '700 22px sans-serif';
      fit(ctx, team && team.name ? team.name : 'Matchcard Coach', 64, 90, w - 128, '700', 22, 16);
      ctx.fillStyle = ink;
      ctx.font = '900 48px sans-serif';
      fit(ctx, match.opponent || '—', 64, 150, w - 128, '900', 48, 28);
      ctx.fillStyle = muted;
      ctx.font = '700 24px sans-serif';
      const meta = [match.date, match.score, outcomeLab, match.address].filter(Boolean).join(' · ');
      fit(ctx, meta, 64, 198, w - 128, '700', 24, 16);
      let y = 260;
      if(match.comment){
        ctx.fillStyle = ink;
        ctx.font = '600 26px sans-serif';
        const comment = String(match.comment).slice(0, 180);
        fit(ctx, comment, 64, y, w - 128, '600', 26, 18);
        y += 70;
      }
      ctx.fillStyle = muted;
      ctx.font = '800 20px sans-serif';
      fit(ctx, tt('coachMatchRatePhase', 'Player ratings'), 64, y, w - 128, '800', 20, 14);
      y += 40;
      const topRates = ratings.slice(0, rows);
      for(const r of topRates){
        const tp = store.getPlayer(session, r.team_player_id || r.player_id);
        const photoSrc = resolveCoachPlayerPhoto(tp);
        const img = photoSrc ? await loadImg(photoSrc) : null;
        const nameX = img ? 120 : 64;
        if(img){
          const ax = 64, ay = y - 28, as = 40;
          ctx.save();
          ctx.beginPath();
          ctx.arc(ax + as / 2, ay + as / 2, as / 2, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();
          if(typeof drawCovered === 'function') drawCovered(ctx, img, ax, ay, as, as, 0.2);
          else ctx.drawImage(img, ax, ay, as, as);
          ctx.restore();
          ctx.beginPath();
          ctx.arc(ax + as / 2, ay + as / 2, as / 2, 0, Math.PI * 2);
          ctx.strokeStyle = theme.foil || '#c9a227';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        ctx.fillStyle = ink;
        ctx.font = '800 28px sans-serif';
        fit(ctx, r.player_name || '—', nameX, y, w - 280 - (nameX - 64), '800', 28, 18);
        ctx.fillStyle = theme.foil || '#c9a227';
        fit(ctx, Number(r.rating).toFixed(1), w - 200, y, 120, '900', 32, 22);
        y += 52;
      }
      if(!ratings.length){
        ctx.fillStyle = muted;
        fit(ctx, tt('coachNoPlayers', 'No players'), 64, y, w - 128, '700', 24, 16);
      }
      return canvas;
    };
    await openCardPreview({
      filename: `team_match_${String(match.opponent || 'match').replace(/\s+/g,'_').slice(0,18)}_${match.date || ''}.png`,
      build
    });
    toast(tt('coachTeamCardPrivacy', 'Team card is for you/staff. Parents only get their own child’s card.'));
  }

  function matchNeedsAttention(session, m){
    if(!m || !matchIsPlayed(m)) return false;
    const store = global.CoachStore;
    const squadN = store.matchSquadIds(session, m).length;
    const rated = store.listRatings(session, m.id).length;
    const noScore = !String(m.score || '').trim();
    return noScore || (squadN > 0 && rated < squadN);
  }

  function renderCoachHistoryDetail(session, team){
    syncCoachHistoryDetailUi();
    if(!coachHistoryMatchId) return;
    const store = global.CoachStore;
    const match = store.getMatch(session, coachHistoryMatchId);
    if(!match || match.team_id !== team.id || !matchIsPlayed(match)){
      coachHistoryMatchId = '';
      syncCoachHistoryDetailUi();
      return;
    }
    const summary = document.getElementById('coachHistorySummary');
    const commentEl = document.getElementById('coachHistoryComment');
    const ratesEl = document.getElementById('coachHistoryRates');
    const outcome = matchOutcome(match);
    const outcomeLab = matchOutcomeLabel(outcome);
    const badgeCls = outcome ? `is-${outcome}` : 'is-played';
    const badgeTxt = outcomeLab
      ? `${outcomeLab}${match.score ? ` · ${match.score}` : ''}`
      : (match.score || tt('coachMatchPlayed', 'played'));
    const venueLab = match.venue === 'away'
      ? tt('venueAway', 'Away')
      : tt('venueHome', 'Home');
    const kindLab = ({
      league: tt('kindLeague', 'League'),
      friendly: tt('kindFriendly', 'Friendly'),
      cup: tt('kindCup', 'Cup'),
      tournament: tt('kindTournament', 'Tournament')
    })[match.kind] || '';
    if(summary){
      const bits = [
        match.date,
        match.meetup
          ? `${tt('coachMatchMeetup', 'Meetup')} ${match.meetup}`
          : '',
        match.kickoff
          ? `${tt('coachMatchKickoff', 'Kick-off')} ${match.kickoff}`
          : '',
        formatMatchFee(match),
        venueLab,
        kindLab,
        match.tournament || '',
        match.address || ''
      ].filter(Boolean);
      summary.innerHTML = `<div class="coach-match-row-top">
        <b>${esc(match.opponent)}</b>
        <span class="coach-match-badge ${badgeCls}">${esc(badgeTxt)}</span>
      </div><span class="hint">${esc(bits.join(' · '))}</span>`;
    }
    // Fill editable meta — skip fields the coach is typing in.
    const active = document.activeElement;
    const metaRoot = document.getElementById('coachHistoryMetaEdit');
    const metaBody = document.getElementById('coachHistoryMetaBody');
    const inMeta = metaRoot && active && metaRoot.contains(active);
    // Keep current open/closed state; only refresh the toggle label.
    setCoachHistoryMetaOpen(metaBody ? !metaBody.hidden : false);
    if(!inMeta){
      const oppEl = document.getElementById('coachHistoryOpponent');
      const dateEl = document.getElementById('coachHistoryDate');
      const venueEl = document.getElementById('coachHistoryVenue');
      const kindEl = document.getElementById('coachHistoryKind');
      const tourEl = document.getElementById('coachHistoryTournament');
      const addrEl = document.getElementById('coachHistoryAddress');
      if(oppEl) oppEl.value = match.opponent || '';
      if(dateEl) dateEl.value = match.date || '';
      if(venueEl) venueEl.value = match.venue === 'away' ? 'away' : 'home';
      if(kindEl) kindEl.value = ['league','friendly','cup','tournament'].includes(match.kind) ? match.kind : 'league';
      if(tourEl) tourEl.value = match.tournament || '';
      if(addrEl) addrEl.value = match.address || '';
      setHistoryMeetup(match.meetup || '');
      setHistoryKickoff(match.kickoff || '');
      setHistoryFee(match);
      syncHistoryCompetitionField();
    }
    fillCoachScoreFields(document.getElementById('coachHistoryScoreRow'), match.score || '');
    if(commentEl && document.activeElement !== commentEl){
      commentEl.value = match.comment || '';
    }
    const squadPlayers = store.listMatchPlayers(session, match);
    if(ratesEl){
      if(!squadPlayers.length){
        ratesEl.innerHTML = `<div class="inbox-empty coach-tab-empty">${esc(tt('coachNoPlayers', 'No players'))}</div>`;
      }else{
        ratesEl.innerHTML = squadPlayers.map(p => {
          const label = playerLabel(p);
          const rating = store.getRatingForPlayer(session, match.id, p.id);
          const rateBtn = rating
            ? `${tt('coachEditRating', 'Edit')} ${Number(rating.rating).toFixed(1)}`
            : tt('coachRatePlayer', 'Rate');
          const note = rating
            ? (rating.comment ? esc(String(rating.comment).slice(0, 80)) : esc(tt('coachRated', 'Rated')))
            : esc(tt('coachNotRated', 'Not rated'));
          const cardBtn = rating
            ? `<button type="button" class="ghost-btn coach-rate-btn" data-share-player-card="${esc(p.id)}" data-match="${esc(match.id)}">${esc(tt('coachSharePlayerCard', 'Card'))}</button>`
            : '';
          return `<div class="coach-player-row">
            <button type="button" class="coach-player-main coach-player-open" data-open-player="${esc(p.id)}">
              <b>${esc(label)}</b>
              <span>${note}</span>
            </button>
            <div class="coach-history-rate-actions">
              <button type="button" class="save-btn coach-rate-btn" data-rate-player="${esc(p.id)}" data-match="${esc(match.id)}">${esc(rateBtn)}</button>
              ${cardBtn}
            </div>
          </div>`;
        }).join('');
      }
    }
    const sentInfo = resultsSentForMatch(session, match);
    const statusEl = document.getElementById('coachHistoryResultsStatus');
    const sendBtn = document.getElementById('coachHistorySendResults');
    if(statusEl){
      if(!sentInfo.total){
        statusEl.textContent = tt('coachResultsNoneYet', 'Rate players, then send cards to parents.');
      }else if(sentInfo.sent >= sentInfo.total){
        statusEl.textContent = tt('coachResultsAllSent', 'Cards sent for all rated players.')
          .replace('{n}', String(sentInfo.sent));
      }else{
        statusEl.textContent = tt('coachResultsPartialSent', '{s}/{t} cards sent — you can send again.')
          .replace('{s}', String(sentInfo.sent))
          .replace('{t}', String(sentInfo.total));
      }
    }
    if(sendBtn){
      sendBtn.textContent = sentInfo.sent
        ? tt('coachSendResultsAgainBtn', 'Send / update cards to parents')
        : tt('coachSendResultsBtn', 'Send cards to parents');
    }
  }

  function resultsSentForMatch(session, match){
    const store = global.CoachStore;
    if(!match || !global.InboxStore || typeof global.InboxStore.findMatchResult !== 'function'){
      return {sent: 0, total: 0};
    }
    const players = store.listMatchPlayers(session, match);
    let sent = 0;
    players.forEach(p => {
      const rating = store.getRatingForPlayer(session, match.id, p.id);
      if(!rating) return;
      if(global.InboxStore.findMatchResult(match.id, p.id)) sent += 1;
    });
    const rated = players.filter(p => store.getRatingForPlayer(session, match.id, p.id)).length;
    return {sent, total: rated};
  }

  function renderCoachHistoryTab(session, team){
    const title = document.getElementById('coachHistoryTeam');
    if(title) title.textContent = team.name + (team.age_group ? ` · ${team.age_group}` : '');
    const el = document.getElementById('coachHistoryList');
    if(!el) return;
    const store = global.CoachStore;
    // History = played matches only (upcoming live on Match/Games tab).
    let matches = store.listMatches(session, team.id).filter(m => matchIsPlayed(m));
    fillCoachTourDatalist();
    fillCoachHistorySeasonSelect(matches);
    document.querySelectorAll('#coachHistoryFilter [data-coach-hist]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.coachHist === coachHistFilter);
    });
    document.querySelectorAll('#coachHistoryKindFilter [data-coach-hist-kind]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.coachHistKind === coachHistKindFilter);
    });
    if(coachHistSeason && coachHistSeason !== 'all'){
      matches = matches.filter(m => coachMatchSeason(m) === coachHistSeason);
    }
    if(coachHistKindFilter && coachHistKindFilter !== 'all'){
      matches = matches.filter(m => (m.kind || 'league') === coachHistKindFilter);
    }
    if(coachHistFilter === 'win' || coachHistFilter === 'draw' || coachHistFilter === 'loss'){
      matches = matches.filter(m => matchOutcome(m) === coachHistFilter);
    }else if(coachHistFilter === 'todo'){
      matches = matches.filter(m => matchNeedsAttention(session, m));
    }
    if(!matches.length){
      const emptyKey = coachHistFilter === 'todo'
        ? tt('coachHistoryTodoEmpty', 'Nothing left to finish — all played matches are rated.')
        : tt('coachHistoryEmpty', 'No played matches yet');
      el.innerHTML = `<div class="inbox-empty coach-tab-empty">${esc(emptyKey)}</div>`;
    }else{
      const sorted = sortMatchesForList(matches);
      el.innerHTML = renderGroupedMatchList(sorted, coachHistoryMatchId, {
        openAttr: 'data-open-match',
        showAddress: true
      });
    }
    renderCoachHistoryDetail(session, team);
  }

  let coachStatsSeason = 'all';
  let coachStatsPeriod = 'all';

  function fillCoachStatsSeasonSelect(matches){
    const sel = document.getElementById('coachStatsSeason');
    if(!sel) return;
    const seasons = [...new Set(matches.map(coachMatchSeason).filter(Boolean))].sort().reverse();
    if(coachStatsSeason !== 'all' && !seasons.includes(coachStatsSeason)){
      coachStatsSeason = 'all';
    }
    sel.innerHTML = [`<option value="all">${esc(tt('seasonAll', 'All seasons'))}</option>`]
      .concat(seasons.map(s => `<option value="${esc(s)}">${esc(s)}</option>`))
      .join('');
    sel.value = coachStatsSeason;
  }

  function coachDaysAgoStr(days){
    try{
      if(typeof daysAgoStr === 'function') return daysAgoStr(days);
    }catch(e){}
    const d = new Date();
    d.setDate(d.getDate() - Number(days || 0));
    return d.toISOString().slice(0, 10);
  }

  function coachFmtSigned(n, digits){
    try{
      if(typeof fmtSigned === 'function') return fmtSigned(n, digits);
    }catch(e){}
    const v = Number(n) || 0;
    const s = coachFmtChartNum(Math.abs(v), digits);
    return (v > 0 ? '+' : v < 0 ? '−' : '') + s;
  }

  function coachAvgNum(arr){
    if(!arr || !arr.length) return null;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  /** Season pool (played), newest-first for lists. */
  function coachStatsSeasonPool(session, team){
    const store = global.CoachStore;
    let matches = store.listMatches(session, team.id).filter(m => matchIsPlayed(m));
    fillCoachStatsSeasonSelect(matches);
    if(coachStatsSeason && coachStatsSeason !== 'all'){
      matches = matches.filter(m => coachMatchSeason(m) === coachStatsSeason);
    }
    return sortMatchesForList(matches);
  }

  /** Period slice of season pool — same ranges as personal stats. */
  function coachStatsPeriodSlice(seasonPool){
    const sortedAsc = (seasonPool || []).slice().sort((a, b) =>
      String(a.date || '').localeCompare(String(b.date || '')) ||
      String(a.id || '').localeCompare(String(b.id || ''))
    );
    const key = coachStatsPeriod || 'all';
    if(key === '10') return sortedAsc.slice(-10);
    if(key === '100') return sortedAsc.slice(-100);
    if(key === 'year'){
      const y = String(new Date().getFullYear());
      return sortedAsc.filter(m => String(m.date || '').startsWith(y));
    }
    if(key === '7d') return sortedAsc.filter(m => String(m.date || '') >= coachDaysAgoStr(7));
    if(key === '30d') return sortedAsc.filter(m => String(m.date || '') >= coachDaysAgoStr(30));
    return sortedAsc;
  }

  function coachStatsFilteredMatches(session, team){
    return coachStatsPeriodSlice(coachStatsSeasonPool(session, team));
  }

  function coachCollectRatings(session, matches){
    const store = global.CoachStore;
    const out = [];
    (matches || []).forEach(m => {
      store.listRatings(session, m.id).forEach(r => out.push(r));
    });
    return out;
  }

  function coachCountSum(ratings, key){
    return (ratings || []).reduce((a, r) => {
      const c = r.counts && typeof r.counts === 'object' ? r.counts : {};
      return a + (Number(c[key]) || 0);
    }, 0);
  }

  function coachRatingTrend(points){
    const list = Array.isArray(points) ? points : [];
    if(list.length < 2) return 0;
    if(list.length < 4) return (Number(list[list.length - 1].rating) || 0) - (Number(list[0].rating) || 0);
    const mid = Math.floor(list.length / 2);
    const a = coachAvgNum(list.slice(mid).map(p => Number(p.rating) || 0)) || 0;
    const b = coachAvgNum(list.slice(0, mid).map(p => Number(p.rating) || 0)) || 0;
    return a - b;
  }

  function coachDynCls(now, start, invert){
    const d = now - start;
    if(Math.abs(d) < 0.05) return '';
    const better = invert ? d < 0 : d > 0;
    return better ? 'up' : 'down';
  }

  function coachKindLabel(kind){
    return ({
      league: tt('kindLeague', 'League'),
      friendly: tt('kindFriendly', 'Friendly'),
      cup: tt('kindCup', 'Cup'),
      tournament: tt('kindTournament', 'Tournament')
    })[kind] || kind || '';
  }

  function coachTeamChartPoints(session, matches){
    const store = global.CoachStore;
    const list = (matches || []).slice().sort((a, b) =>
      String(a.date || '').localeCompare(String(b.date || '')) ||
      String(a.id || '').localeCompare(String(b.id || ''))
    );
    const points = [];
    list.forEach(m => {
      const ratings = store.listRatings(session, m.id);
      if(!ratings.length) return;
      const sum = ratings.reduce((s, r) => s + (Number(r.rating) || 0), 0);
      const avg = Math.round((sum / ratings.length) * 10) / 10;
      points.push({
        date: m.date || '',
        rating: avg,
        opponent: m.opponent || '',
        kind: m.kind || 'league',
        season: coachMatchSeason(m)
      });
    });
    return points;
  }

  function coachGroupPoints(points, keyFn){
    const map = new Map();
    (points || []).forEach(p => {
      const k = keyFn(p);
      if(!k) return;
      if(!map.has(k)) map.set(k, []);
      map.get(k).push(p);
    });
    return [...map.entries()].map(([key, arr]) => ({
      key,
      n: arr.length,
      avg: coachAvgNum(arr.map(p => Number(p.rating) || 0))
    })).filter(g => g.avg != null).sort((a, b) => b.n - a.n || b.avg - a.avg);
  }

  function coachCmpRowHtml(label, avg, n, vs){
    if(avg == null) return '';
    const cls = vs == null || n < 2 ? '' : coachDynCls(avg, vs, false);
    return `<tr><td><span class="cmp-name">${esc(label)}</span><span class="cmp-n">${esc(String(n))} ${esc(tt('coachGames', 'games'))}</span></td><td class="${cls}">${esc(coachFmtChartNum(avg, 2))}</td></tr>`;
  }

  function coachSeasonBoardHtml(session, team, seasonMatches, seasonName){
    const ratings = coachCollectRatings(session, seasonMatches);
    const points = coachTeamChartPoints(session, seasonMatches);
    const avg = points.length ? coachAvgNum(points.map(p => p.rating)) : null;
    const minutes = ratings.reduce((a, r) => a + Math.max(0, Number(r.minutes) || 0), 0);
    const starts = ratings.filter(r => r.role !== 'sub').length;
    const subs = ratings.length - starts;
    const goals = coachCountSum(ratings, 'goals');
    const assists = coachCountSum(ratings, 'assists');
    const kpis = [
      [seasonMatches.length, tt('coachStatMatches', 'Matches')],
      [ratings.length, tt('coachStatRatings', 'Ratings')],
      [starts, tt('coachStatStarts', 'Starts')],
      [subs, tt('coachStatSubs', 'Subs')],
      [Math.round(minutes), tt('stMins', 'Minutes')],
      [goals, tt('stGoals', 'Goals')],
      [assists, metricLab('assists')]
    ].map(([n, lab]) =>
      `<div class="kpi-cell"><div class="n">${esc(String(n))}</div><div class="l">${esc(lab)}</div></div>`
    ).join('');
    const acts = [
      ['goals', false],
      ['assists', false],
      ['dribbles', false],
      ['tackles', false],
      ['duelswon', false],
      ['passes', false],
      ['losses', true]
    ].map(([key, bad]) => {
      const n = coachCountSum(ratings, key);
      if(!n) return '';
      return `<div class="act-row${bad ? ' bad' : ''}"><span class="n">${esc(String(n))}</span><span>${esc(metricLab(key))}</span></div>`;
    }).filter(Boolean).join('');
    let dyn = '';
    if(points.length >= 4){
      const w = points.length >= 10 ? 5 : (points.length >= 6 ? Math.floor(points.length / 2) : 2);
      const start = points.slice(0, w);
      const now = points.slice(-w);
      const r0 = coachAvgNum(start.map(p => p.rating)) || 0;
      const r1 = coachAvgNum(now.map(p => p.rating)) || 0;
      const rateStart = coachCollectRatings(session, seasonMatches.slice().sort((a, b) =>
        String(a.date || '').localeCompare(String(b.date || ''))
      ).slice(0, w));
      const rateNow = coachCollectRatings(session, seasonMatches.slice().sort((a, b) =>
        String(a.date || '').localeCompare(String(b.date || ''))
      ).slice(-w));
      const perMatch = (list, key) => {
        const ids = new Set(list.map(r => r.match_id));
        const n = ids.size || 1;
        return coachCountSum(list, key) / n;
      };
      const rows = [
        [tt('dyn_rating', 'Rating'), coachFmtChartNum(r0, 2), coachFmtChartNum(r1, 2), coachDynCls(r1, r0, false)],
        [metricLab('goals'), coachFmtChartNum(perMatch(rateStart, 'goals'), 1), coachFmtChartNum(perMatch(rateNow, 'goals'), 1), coachDynCls(perMatch(rateNow, 'goals'), perMatch(rateStart, 'goals'), false)],
        [metricLab('assists'), coachFmtChartNum(perMatch(rateStart, 'assists'), 1), coachFmtChartNum(perMatch(rateNow, 'assists'), 1), coachDynCls(perMatch(rateNow, 'assists'), perMatch(rateStart, 'assists'), false)],
        [metricLab('losses'), coachFmtChartNum(perMatch(rateStart, 'losses'), 1), coachFmtChartNum(perMatch(rateNow, 'losses'), 1), coachDynCls(perMatch(rateNow, 'losses'), perMatch(rateStart, 'losses'), true)]
      ].map(r => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td class="${r[3]}">${esc(r[2])}</td></tr>`).join('');
      dyn = `<div class="board-block">
        <h3>${esc(tt('stDynamics', 'Dynamics'))}</h3>
        <table class="dyn-table">
          <thead><tr><th>${esc(tt('stDynMetric', 'Metric'))}</th><th>${esc(tt('stDynStart', 'Start'))}</th><th>${esc(tt('stDynNow', 'Now'))}</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <p class="dyn-hint">${esc(tt('stDynHint', 'First and last {n} matches').replace('{n}', String(w)))}</p>
      </div>`;
    }
    return `<article class="season-board coach-season-board">
      <div class="season-head">
        <div class="season-kicker">${esc(tt('stSeasonTitle', 'Season'))}</div>
        <div class="season-name">${esc(seasonName)}</div>
        <div class="season-avg">${esc(avg == null ? '—' : coachFmtChartNum(avg, 2))}<small>${esc(tt('stSeasonAvg', 'avg'))}</small></div>
      </div>
      <div class="kpi-grid">${kpis}</div>
      ${acts ? `<div class="board-block"><h3>${esc(tt('stActions', 'Actions'))}</h3>${acts}</div>` : ''}
      ${dyn}
    </article>`;
  }

  function coachCompareBoardHtml(session, team, seasonMatches){
    const allPlayed = global.CoachStore.listMatches(session, team.id).filter(m => matchIsPlayed(m));
    const careerPts = coachTeamChartPoints(session, allPlayed);
    const career = careerPts.length ? coachAvgNum(careerPts.map(p => p.rating)) : null;
    if(career == null) return '';
    const seasonPts = coachTeamChartPoints(session, seasonMatches);
    const last = careerPts.slice(-Math.min(10, careerPts.length));
    const lastLbl = last.length === 10
      ? tt('cmpLast10', 'Last 10')
      : tt('cmpLastN', 'Last {n}').replace('{n}', String(last.length));
    let main = coachCmpRowHtml(lastLbl, coachAvgNum(last.map(p => p.rating)), last.length, career);
    if(seasonPts.length && coachStatsSeason !== 'all'){
      main += coachCmpRowHtml(
        `${tt('cmpSeason', 'Season')} ${coachStatsSeason}`,
        coachAvgNum(seasonPts.map(p => p.rating)),
        seasonPts.length,
        career
      );
    }
    const kindGroups = coachGroupPoints(careerPts, p => p.kind || 'league');
    const kindRows = kindGroups.length > 1
      ? kindGroups.map(g => coachCmpRowHtml(coachKindLabel(g.key), g.avg, g.n, career)).join('')
      : '';
    const seasonGroups = coachGroupPoints(careerPts, p => p.season);
    const seasonRows = seasonGroups.length > 1
      ? seasonGroups.map(g => coachCmpRowHtml(g.key, g.avg, g.n, career)).join('')
      : '';
    const kindSection = kindRows
      ? `<div class="board-block"><h3>${esc(tt('coachCmpKind', 'By match type'))}</h3><table class="cmp-table"><tbody>${kindRows}</tbody></table></div>`
      : '';
    const seasonSection = seasonRows
      ? `<div class="board-block"><h3>${esc(tt('cmpSeasons', 'Seasons'))}</h3><table class="cmp-table"><tbody>${seasonRows}</tbody></table></div>`
      : '';
    return `<article class="season-board compare-board coach-compare-board">
      <div class="season-head">
        <div class="season-kicker">${esc(tt('cmpTitle', 'Compare'))}</div>
        <div class="season-name">${esc(team.name || '—')}</div>
        <div class="season-avg">${esc(coachFmtChartNum(career, 2))}<small>${esc(tt('cmpAll', 'all time'))}</small></div>
      </div>
      <table class="cmp-table"><tbody>${main}</tbody></table>
      ${kindSection}
      ${seasonSection}
    </article>`;
  }

  function coachChartDateLabel(iso){
    try{
      if(typeof chartDateLabel === 'function') return chartDateLabel(iso);
    }catch(e){}
    const parts = String(iso || '').split('-');
    if(parts.length < 3) return '';
    return `${parts[2]}.${parts[1]}`;
  }

  function coachCssVar(name, fallback){
    try{
      if(typeof cssVar === 'function') return cssVar(name, fallback);
    }catch(e){}
    try{
      const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      if(v) return v;
    }catch(e){}
    return fallback;
  }

  function coachFmtChartNum(n, digits){
    try{
      if(typeof fmtNum === 'function') return fmtNum(n, digits);
    }catch(e){}
    const d = Number.isFinite(digits) ? digits : 1;
    return Number(n).toFixed(d);
  }

  function drawCoachTeamChart(list){
    const svg = document.getElementById('coachTeamChartSvg');
    if(!svg) return;
    const points = Array.isArray(list) ? list : [];
    if(points.length < 2){
      const msg = points.length
        ? tt('chartNeed', 'Need {n} matches for the chart').replace('{n}', '2')
        : tt('chartEmpty', 'No data yet');
      svg.innerHTML = `<text x="160" y="100" text-anchor="middle" font-size="12" fill="${coachCssVar('--text-soft','#8D9AB5')}">${esc(msg)}</text>`;
      return;
    }
    const w = 320, h = 200, padL = 36, padR = 14, padT = 14, padB = 30;
    const ratings = points.map(p => Number(p.rating) || 0);
    let yMin = Math.min(...ratings);
    let yMax = Math.max(...ratings);
    if(yMax - yMin < 0.6){
      const mid = (yMax + yMin) / 2;
      yMin = mid - 0.4;
      yMax = mid + 0.4;
    }else{
      yMin -= 0.2;
      yMax += 0.2;
    }
    yMin = Math.max(0, yMin);
    yMax = Math.min(10, yMax);
    const innerW = w - padL - padR;
    const innerH = h - padT - padB;
    const xAt = i => padL + (points.length === 1 ? innerW / 2 : i * innerW / (points.length - 1));
    const yAt = r => padT + (1 - (r - yMin) / (yMax - yMin)) * innerH;
    const ticks = 4;
    let grid = '';
    for(let i = 0; i <= ticks; i++){
      const val = yMin + (yMax - yMin) * (i / ticks);
      const y = yAt(val);
      grid += `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${w - padR}" y2="${y.toFixed(1)}" stroke="rgba(255,255,255,.08)"/>
        <text x="${padL - 6}" y="${y + 3}" font-size="9" fill="${coachCssVar('--text-soft','#8D9AB5')}" text-anchor="end">${esc(coachFmtChartNum(val, 1))}</text>`;
    }
    const xs = points.map((_, i) => xAt(i));
    const ys = ratings.map(r => yAt(r));
    const path = `<path d="${xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ')}" fill="none" stroke="${coachCssVar('--accent','#E8C56A')}" stroke-width="2.5"/>`;
    const step = points.length > 10 ? Math.ceil(points.length / 8) : 1;
    const dots = xs.map((x, i) =>
      `<circle cx="${x.toFixed(1)}" cy="${ys[i].toFixed(1)}" r="${i === xs.length - 1 ? 5 : 3.2}" fill="${i === xs.length - 1 ? coachCssVar('--gold','#F5B942') : coachCssVar('--accent','#E8C56A')}"/>`
    ).join('');
    const labels = xs.map((x, i) => {
      if(i !== 0 && i !== xs.length - 1 && i % step) return '';
      return `<text x="${x.toFixed(1)}" y="${h - 8}" font-size="9" fill="${coachCssVar('--text-soft','#8D9AB5')}" text-anchor="middle">${esc(coachChartDateLabel(points[i].date))}</text>`;
    }).join('');
    svg.innerHTML = `${grid}${path}${dots}${labels}`;
  }

  function renderAnalyticsPane(session, team){
    const store = global.CoachStore;
    document.querySelectorAll('#coachStatsPeriod [data-coach-stats-period]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.coachStatsPeriod === coachStatsPeriod);
    });
    const seasonPool = coachStatsSeasonPool(session, team);
    const filtered = coachStatsPeriodSlice(seasonPool);
    const a = store.teamAnalytics(session, team.id, {matchIds: filtered.map(m => m.id)});
    const chartPoints = coachTeamChartPoints(session, filtered);
    const periodRatings = coachCollectRatings(session, filtered);
    const avg = fmtScore(a.avg);
    const rec = a.record || {win: 0, draw: 0, loss: 0};
    const recordHtml = (rec.win + rec.draw + rec.loss)
      ? `<div class="coach-stats-record">
          <span class="is-win"><b>${rec.win}</b> ${esc(tt('coachMatchWin', 'Win'))}</span>
          <span class="is-draw"><b>${rec.draw}</b> ${esc(tt('coachMatchDraw', 'Draw'))}</span>
          <span class="is-loss"><b>${rec.loss}</b> ${esc(tt('coachMatchLoss', 'Loss'))}</span>
        </div>`
      : '';
    const band = a.ratings
      ? `<div class="coach-stat-bands">
          <span class="band high"><b>${a.high}</b> ${esc(tt('coachBandHigh', '≥7.5'))}</span>
          <span class="band mid"><b>${a.mid}</b> ${esc(tt('coachBandMid', '6–7.4'))}</span>
          <span class="band low"><b>${a.low}</b> ${esc(tt('coachBandLow', '<6'))}</span>
        </div>`
      : '';
    const momentsBlock = a.topMoments && a.topMoments.length
      ? `<div class="coach-stat-section">
          <div class="pro-kicker">${esc(tt('coachTeamMomentsKicker', 'Team moments'))}</div>
          ${momentsHtml(a.topMoments)}
        </div>`
      : '';
    const ranked = (a.players || []).filter(p => (p.games || 0) > 0);
    const playersHtml = ranked.length
      ? `<div class="coach-player-list">${ranked.map(p => {
          const tr = trendLabel(p.trend);
          const tc = trendClass(p.trend);
          const pos = p.position && typeof pitchPosLabelShort === 'function'
            ? pitchPosLabelShort(p.position)
            : (p.position || '');
          const metaBits = [
            `${p.games} ${tt('coachGames', 'games')}`,
            p.last != null ? `${tt('coachStatLast', 'last')} ${fmtScore(p.last)}` : '',
            tr ? `${tt('coachStatTrend', 'trend')} ${tr}` : '',
            pos
          ].filter(Boolean).join(' · ');
          const form = p.form && p.form.length
            ? `<span class="coach-form-spark">${esc(formSpark(p.form))}</span>`
            : '';
          const mom = (p.topMoments || []).slice(0, 2).map(m => `${metricLab(m.key)} ${m.n}`).join(' · ');
          return `<button type="button" class="coach-player-row coach-player-open-row coach-stat-player" data-open-player="${esc(p.id)}">
            <div class="coach-player-main">
              <b>${esc(p.name)}${p.number ? ` · #${esc(p.number)}` : ''}</b>
              <span>${esc(metaBits)}</span>
              ${form}
              ${mom ? `<span class="coach-stat-mom">${esc(mom)}</span>` : ''}
            </div>
            <div class="coach-stat-side">
              <b class="${tc}">${fmtScore(p.avg)}</b>
              <span>${esc(tt('coachStatAvgShort', 'avg'))}</span>
              ${p.best != null ? `<span class="coach-stat-range">${esc(fmtScore(p.worst))}–${esc(fmtScore(p.best))}</span>` : ''}
            </div>
          </button>`;
        }).join('')}</div>`
      : `<p class="hint">${esc(tt('coachAnalyticsEmpty', 'Rate players in matches to see analytics.'))}</p>`;

    const trend = coachRatingTrend(chartPoints);
    const trendCls = trend > 0.05 ? 'up' : (trend < -0.05 ? 'down' : '');
    const trendMark = trend > 0.05 ? '↗ ' : (trend < -0.05 ? '↘ ' : '→ ');
    const minutes = periodRatings.reduce((s, r) => s + Math.max(0, Number(r.minutes) || 0), 0);
    const goals = coachCountSum(periodRatings, 'goals');
    const pointRatings = chartPoints.map(p => Number(p.rating) || 0);
    const gridCards = filtered.length ? [
      {num: coachFmtChartNum(coachAvgNum(pointRatings) || 0, 2), lbl: tt('stAvg', 'Average')},
      {num: trendMark + coachFmtSigned(trend, 2), lbl: tt('stTrend', 'Trend'), cls: trendCls},
      {num: pointRatings.length ? coachFmtChartNum(Math.max(...pointRatings), 2) : '—', lbl: tt('stBest', 'Best')},
      {num: pointRatings.length ? coachFmtChartNum(Math.min(...pointRatings), 2) : '—', lbl: tt('stWorst', 'Worst')},
      {num: String(filtered.length), lbl: tt('stMatches', 'Matches')},
      {num: String(Math.round(minutes)), lbl: tt('stMins', 'Minutes')},
      {num: String(goals), lbl: tt('stGoals', 'Goals')},
      {num: minutes ? coachFmtChartNum(goals * 90 / minutes, 1) : coachFmtChartNum(0, 1), lbl: tt('stG90', 'G/90')}
    ].map(c =>
      `<div class="stat-card"><div class="num ${c.cls || ''}">${esc(c.num)}</div><div class="lbl">${esc(c.lbl)}</div></div>`
    ).join('') : '';

    const seasonName = coachStatsSeason === 'all'
      ? tt('seasonAll', 'All seasons')
      : coachStatsSeason;
    const seasonBoard = seasonPool.length
      ? coachSeasonBoardHtml(session, team, seasonPool, seasonName)
      : '';
    const compareBoard = seasonPool.length
      ? coachCompareBoardHtml(session, team, seasonPool)
      : '';

    const chartHtml = `
      <div class="chart-wrap coach-team-chart">
        <h3>${esc(tt('coachTeamChartTitle', 'Team rating trend'))}</h3>
        <svg id="coachTeamChartSvg" viewBox="0 0 320 200" role="img" aria-label="${esc(tt('chartAria', 'Rating chart'))}"></svg>
      </div>`;

    let html;
    if(!seasonPool.length){
      html = `<div class="inbox-empty coach-tab-empty">${esc(tt('coachStatsEmpty', 'No played matches in this period.'))}</div>`;
    }else{
      html = `
      ${seasonBoard}
      ${compareBoard}
      <div class="coach-analytics-sum coach-analytics-sum-4">
        <button type="button" class="coach-stat-jump" data-coach-jump="matches">
          <b>${a.played || a.matches}</b><span>${esc(tt('coachStatMatches', 'Matches'))}</span>
        </button>
        <button type="button" class="coach-stat-jump" data-coach-jump="ratings">
          <b>${a.ratings}</b><span>${esc(tt('coachStatRatings', 'Ratings'))}</span>
        </button>
        <div><b>${esc(avg)}</b><span>${esc(tt('coachStatAvg', 'Team avg'))}</span></div>
        <div><b>${esc(fmtScore(a.best))}</b><span>${esc(tt('coachStatBest', 'Best'))}</span></div>
      </div>
      ${recordHtml}
      ${chartHtml}
      ${gridCards ? `<div class="stat-grid coach-stat-grid">${gridCards}</div>` : `<div class="inbox-empty coach-tab-empty">${esc(tt('noPeriod', 'No matches in this period.'))}</div>`}
      ${band}
      ${momentsBlock}
      <div class="coach-stat-section">
        <div class="pro-kicker">${esc(tt('coachPlayersStatsKicker', 'Players'))}</div>
        ${playersHtml}
      </div>`;
    }
    const statsBoard = document.getElementById('coachStatsBoard');
    if(statsBoard) statsBoard.innerHTML = html;
    if(seasonPool.length && filtered.length) drawCoachTeamChart(chartPoints);
    else if(seasonPool.length) drawCoachTeamChart([]);
    const statsTeam = document.getElementById('coachStatsTeam');
    if(statsTeam) statsTeam.textContent = team.name + (team.age_group ? ` · ${team.age_group}` : '');
  }

  function openAuth(){
    const auth = document.getElementById('coachAuth');
    if(auth) auth.dataset.open = '1';
    renderCoachUi();
    document.getElementById('coachEmail')?.focus();
  }

  async function onSignUp(){
    const email = document.getElementById('coachEmail')?.value || '';
    const pass = document.getElementById('coachPassword')?.value || '';
    try{
      await global.CoachStore.signUp(email, pass);
      if(typeof setCoachPlan === 'function') setCoachPlan(true);
      toast(tt('coachSignedUp', 'Coach account created on this phone.'));
      renderCoachUi();
    }catch(e){
      const map = {
        bad_email: tt('coachErrEmail', 'Enter a valid email.'),
        bad_password: tt('coachErrPass', 'Password: at least 6 characters.'),
        exists: tt('coachErrExists', 'This email is already registered on this phone.')
      };
      toast(map[e.message] || tt('coachErrGeneric', 'Could not create account.'));
    }
  }
  async function onSignIn(){
    const email = document.getElementById('coachEmail')?.value || '';
    const pass = document.getElementById('coachPassword')?.value || '';
    try{
      await global.CoachStore.signIn(email, pass);
      if(typeof setCoachPlan === 'function') setCoachPlan(true);
      toast(tt('coachSignedIn', 'Signed in.'));
      renderCoachUi();
    }catch(e){
      toast(tt('coachErrAuth', 'Wrong email or password.'));
    }
  }
  function onSignOut(){
    global.CoachStore.signOut();
    const auth = document.getElementById('coachAuth');
    if(auth) auth.dataset.open = '';
    const work = document.getElementById('coachWorkspace');
    if(work) work.dataset.started = '';
    closeCoachSettings();
    if(typeof closeCoachQuickRate === 'function') closeCoachQuickRate();
    if(typeof setCoachPlan === 'function') setCoachPlan(false);
    toast(tt('coachSignedOut', 'Signed out of Coach.'));
    renderCoachUi();
    if(typeof showView === 'function') showView('new');
  }
  function onCreateAcademy(){
    const name = document.getElementById('coachAcademyInput')?.value || '';
    try{
      global.CoachStore.createAcademy(global.CoachStore.getSession(), name);
      if(typeof setCoachPlan === 'function') setCoachPlan(true);
      toast(tt('coachAcademyCreated', 'Academy created.'));
      renderCoachUi();
      if(typeof showView === 'function') showView('coach');
    }catch(e){
      const map = {
        name: tt('coachErrAcademyName', 'Enter academy name.'),
        academy_limit: tt('coachErrAcademyLimit', 'One academy per coach on launch.')
      };
      toast(map[e.message] || tt('coachErrGeneric', 'Could not create academy.'));
    }
  }
  function onSaveAcademy(){
    const session = global.CoachStore.getSession();
    const name = document.getElementById('coachAcademyRenameInput')?.value || '';
    try{
      global.CoachStore.renameAcademy(session, name);
      toast(tt('coachAcademySaved', 'Academy saved.'));
      renderCoachUi();
    }catch(e){
      const map = {
        name: tt('coachErrAcademyName', 'Enter academy name.'),
        owner_only: tt('coachErrOwnerOnlyTeam', 'Only the academy owner can add teams.'),
        forbidden: tt('coachErrGeneric', 'Something went wrong.'),
        auth: tt('coachErrGeneric', 'Something went wrong.')
      };
      toast(map[e.message] || tt('coachErrGeneric', 'Something went wrong.'));
    }
  }
  function setHomeCreateTeamOpen(on){
    const box = document.getElementById('coachHomeCreateTeam');
    if(box) box.hidden = !on;
    if(on){
      const input = document.getElementById('coachHomeTeamInput');
      if(input){
        try{ input.focus(); }catch(e){}
      }
    }
  }
  function onCreateTeam(){
    const session = global.CoachStore.getSession();
    const academy = global.CoachStore.myAcademy(session);
    if(!academy) return;
    const nameEl = document.getElementById('coachHomeTeamInput');
    const ageEl = document.getElementById('coachHomeTeamAgeInput');
    const name = nameEl?.value || '';
    const age = ageEl?.value || '';
    try{
      const team = global.CoachStore.createTeam(session, academy.id, name, age);
      global.CoachStore.setActiveTeamId(team.id);
      if(nameEl) nameEl.value = '';
      if(ageEl) ageEl.value = '';
      setHomeCreateTeamOpen(false);
      toast(tt('coachTeamCreated', 'Team created.'));
      renderCoachUi();
    }catch(e){
      const map = {
        name: tt('coachErrTeamName', 'Enter team name.'),
        team_limit: tt('coachErrTeamLimit', 'Team limit reached for this academy.'),
        owner_only: tt('coachErrOwnerOnlyTeam', 'Only the academy owner can add teams.'),
        forbidden: tt('coachErrGeneric', 'Could not create team.'),
        auth: tt('coachErrGeneric', 'Could not create team.')
      };
      toast(map[e.message] || tt('coachErrGeneric', 'Could not create team.'));
    }
  }
  function onAddPlayer(){
    const session = global.CoachStore.getSession();
    const teamId = global.CoachStore.getActiveTeamId();
    if(!teamId) return;
    const first = document.getElementById('coachPlayerFirst')?.value || '';
    const last = document.getElementById('coachPlayerLast')?.value || '';
    const number = document.getElementById('coachPlayerNumber')?.value || '';
    const contact = document.getElementById('coachPlayerContact')?.value || '';
    const position = document.getElementById('coachPlayerPos')?.value || '';
    try{
      const photo = resolveCoachPlayerPhoto({first_name: first, last_name: last, photo: ''});
      const created = global.CoachStore.addPlayer(session, teamId, {
        first_name: first,
        last_name: last,
        number,
        contact,
        position,
        photo: ''
      });
      if(photo && created && created.id && typeof setCoachMediaPhoto === 'function'){
        try{ setCoachMediaPhoto(created.id, photo); }catch(e){}
      }
      ['coachPlayerFirst','coachPlayerLast','coachPlayerNumber','coachPlayerContact'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = '';
      });
      setPlayerFormOpen(false);
      toast(tt('coachPlayerAdded', 'Player added.'));
      renderCoachUi();
    }catch(e){
      const map = {
        name: tt('coachErrPlayerName', 'Enter first name.'),
        player_limit: tt('coachErrPlayerLimit', 'Player limit for this team.')
      };
      toast(map[e.message] || tt('coachErrGeneric', 'Could not add player.'));
    }
  }

  let teamMenuId = '';
  function openTeamMenu(teamId){
    const store = global.CoachStore;
    const session = store.getSession();
    const team = store.getTeam(session, teamId);
    if(!team) return;
    teamMenuId = team.id;
    const nameEl = document.getElementById('coachTeamRenameInput');
    const ageEl = document.getElementById('coachTeamRenameAgeInput');
    if(nameEl) nameEl.value = team.name || '';
    if(ageEl) ageEl.value = team.age_group || '';
    const card = document.getElementById('coachTeamMenuCard');
    const back = document.getElementById('coachTeamMenuBack');
    if(typeof presentSheetCard === 'function') presentSheetCard(card, back);
    else{
      const sheet = document.getElementById('coachTeamMenuSheet');
      if(sheet) sheet.hidden = false;
      if(back) back.hidden = false;
    }
    if(typeof pushAppState === 'function') pushAppState('layer');
  }
  function closeTeamMenu(){
    teamMenuId = '';
    const card = document.getElementById('coachTeamMenuCard');
    const back = document.getElementById('coachTeamMenuBack');
    if(typeof hideSheetCard === 'function') hideSheetCard(card, back);
    else{
      const sheet = document.getElementById('coachTeamMenuSheet');
      if(sheet) sheet.hidden = true;
      if(back) back.hidden = true;
    }
  }
  function onSaveTeamRename(){
    if(!teamMenuId) return;
    const session = global.CoachStore.getSession();
    try{
      global.CoachStore.updateTeam(session, teamMenuId, {
        name: document.getElementById('coachTeamRenameInput')?.value || '',
        age_group: document.getElementById('coachTeamRenameAgeInput')?.value || ''
      });
      toast(tt('coachTeamUpdated', 'Team updated.'));
      closeTeamMenu();
      renderCoachUi();
    }catch(e){
      const map = {
        name: tt('coachErrTeamName', 'Enter team name.'),
        owner_only: tt('coachErrOwnerOnlyTeam', 'Only the academy owner can add teams.')
      };
      toast(map[e.message] || tt('coachErrGeneric', 'Could not create team.'));
    }
  }
  function onDeleteTeam(){
    if(!teamMenuId) return;
    const ok = window.confirm(tt('coachTeamDeleteConfirm', 'Delete this team and all its players and matches?'));
    if(!ok) return;
    const session = global.CoachStore.getSession();
    try{
      global.CoachStore.removeTeam(session, teamMenuId);
      toast(tt('coachTeamDeleted', 'Team deleted.'));
      closeTeamMenu();
      renderCoachUi();
    }catch(e){
      const map = {
        owner_only: tt('coachErrOwnerOnlyTeam', 'Only the academy owner can add teams.')
      };
      toast(map[e.message] || tt('coachErrGeneric', 'Could not create team.'));
    }
  }

  function onSaveProfile(){
    const session = global.CoachStore.getSession();
    if(!session) return;
    try{
      global.CoachStore.updateProfile(session, {
        first_name: document.getElementById('coachFirstName')?.value || '',
        last_name: document.getElementById('coachLastName')?.value || ''
      });
      toast(tt('coachProfileSaved', 'Coach profile saved.'));
      if(typeof applyHeader === 'function') applyHeader();
      renderCoachUi();
    }catch(e){
      toast(tt('coachErrGeneric', 'Could not save profile.'));
    }
  }
  function onCancelMatch(){
    const store = global.CoachStore;
    const session = store.getSession();
    const matchId = store.getActiveMatchId();
    if(!session || !matchId) return;
    const ok = window.confirm(tt('coachMatchCancelConfirm', 'Cancel this upcoming match? Parents will get a calm notice that it is off.'));
    if(!ok) return;
    try{
      store.removeMatch(session, matchId);
      squadEditOpen = false;
      upcomingMetaOpen = false;
      toast(tt('coachMatchCancelled', 'Match cancelled. Parents were notified.'));
      if(typeof renderParentUi === 'function') renderParentUi();
      renderCoachUi();
    }catch(e){
      const map = {
        has_results: tt('coachMatchCancelBlocked', 'Cannot cancel — score or ratings already exist. Use History.')
      };
      toast(map[e.message] || tt('coachErrGeneric', 'Something went wrong.'));
    }
  }
  function onSaveMatchSquad(){
    const store = global.CoachStore;
    const session = store.getSession();
    const matchId = store.getActiveMatchId();
    if(!session || !matchId) return;
    const match = store.getMatch(session, matchId);
    const prev = new Set(store.matchSquadIds(session, match).map(String));
    const picker = document.querySelector('#coachMatchSquadEdit .js-cm-squad-edit');
    const squad = selectedSquadFrom(picker || document);
    if(!squad.length){
      toast(tt('coachErrSquad', 'Select at least one player who plays.'));
      return;
    }
    try{
      const res = store.setMatchSquad(session, matchId, squad);
      const added = (res && res.added) || squad.filter(id => !prev.has(String(id)));
      const removed = (res && res.removed) || [...prev].filter(id => !squad.map(String).includes(String(id)));
      squadEditOpen = false;
      if(removed.length && typeof store.recallMatchPlayers === 'function'){
        store.recallMatchPlayers(session, matchId, removed);
      }
      if(added.length){
        store.deliverMatchInvites(session, matchId, {
          playerIds: added,
          forceUnread: true
        });
      }
      const bits = [];
      if(added.length) bits.push(tt('coachSquadAddedN', '{n} invited').replace('{n}', String(added.length)));
      if(removed.length) bits.push(tt('coachSquadRemovedN', '{n} released').replace('{n}', String(removed.length)));
      toast(bits.length
        ? `${tt('coachSquadSaved', 'Squad updated.')} ${bits.join(' · ')}`
        : tt('coachSquadSaved', 'Squad updated.'));
      if(typeof renderParentUi === 'function') renderParentUi();
      renderCoachUi();
    }catch(e){
      toast(tt('coachErrGeneric', 'Something went wrong.'));
    }
  }
  function onSaveUpcomingMeta(){
    const store = global.CoachStore;
    const session = store.getSession();
    const matchId = store.getActiveMatchId();
    if(!session || !matchId) return;
    const match = store.getMatch(session, matchId);
    if(!match || matchIsPlayed(match)) return;
    const opponent = String(document.getElementById('coachUpcomingOpponent')?.value || '').trim();
    if(!opponent){
      toast(tt('coachErrOpponent', 'Enter opponent.'));
      return;
    }
    const date = String(document.getElementById('coachUpcomingDate')?.value || '').trim();
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)){
      toast(tt('coachErrGeneric', 'Something went wrong.'));
      return;
    }
    const next = {
      opponent,
      date,
      meetup: readUpcomingMeetup(),
      kickoff: readUpcomingKickoff(),
      venue: document.getElementById('coachUpcomingVenue')?.value === 'away' ? 'away' : 'home',
      address: document.getElementById('coachUpcomingAddress')?.value || ''
    };
    const changed = ['opponent','date','meetup','kickoff','venue','address'].some(k =>
      String(match[k] || '') !== String(next[k] || '')
    );
    try{
      store.updateMatch(session, matchId, next);
      if(changed){
        store.deliverMatchInvites(session, matchId, {
          forceUnread: true,
          resetRsvp: true,
          invite_notice: 'updated'
        });
        toast(tt('coachUpcomingMetaSavedNotify', 'Details saved. Parents were asked to confirm again.'));
      }else{
        toast(tt('coachUpcomingMetaSaved', 'Match details saved.'));
      }
      setUpcomingMetaOpen(false);
      if(typeof renderParentUi === 'function') renderParentUi();
      renderCoachUi();
    }catch(e){
      const map = {
        opponent: tt('coachErrOpponent', 'Enter opponent.')
      };
      toast(map[e.message] || tt('coachErrGeneric', 'Something went wrong.'));
    }
  }
  function onLinkSuggestedGroup(btn){
    const store = global.CoachStore;
    const session = store.getSession();
    if(!session || !btn) return;
    const ids = String(btn.dataset.ids || '').split(',').map(s => s.trim()).filter(Boolean);
    const card = btn.closest('.coach-match-suggest');
    const name = String(card?.querySelector('.js-cm-suggest-name')?.value || '').trim();
    if(!name){
      toast(tt('coachMatchSuggestNeedName', 'Enter a tournament name.'));
      return;
    }
    try{
      store.linkMatchesToEvent(session, ids, {tournament: name});
      toast(tt('coachMatchSuggestLinked', 'Matches grouped under one tournament.'));
      renderCoachUi();
    }catch(e){
      const map = {
        tournament: tt('coachMatchSuggestNeedName', 'Enter a tournament name.'),
        group_small: tt('coachErrGeneric', 'Something went wrong.')
      };
      toast(map[e.message] || tt('coachErrGeneric', 'Something went wrong.'));
    }
  }

  function onFinishMatch(){
    const store = global.CoachStore;
    const session = store.getSession();
    const matchId = store.getActiveMatchId();
    if(!session || !matchId) return;
    try{
      store.finishMatch(session, matchId, '');
      store.setActiveMatchId('');
      toast(tt('coachMatchFinished', 'Match marked as played. Set the score and rate players.'));
      // Played matches live in Results — open there right away.
      openCoachHistoryMatch(matchId);
    }catch(e){
      toast(tt('coachErrGeneric', 'Something went wrong.'));
    }
  }
  function onSaveHistoryScore(){
    const store = global.CoachStore;
    const session = store.getSession();
    if(!session || !coachHistoryMatchId) return;
    const root = document.getElementById('coachHistoryScoreRow') || document;
    const score = scoreFromCoachFields(root);
    if(!score){
      toast(tt('coachErrScore', 'Enter the match score.'));
      return;
    }
    try{
      store.updateMatch(session, coachHistoryMatchId, {score, status: 'played'});
      toast(tt('coachMatchScoreSaved', 'Score saved. Rate players below.'));
      renderCoachUi();
    }catch(e){
      toast(tt('coachErrGeneric', 'Something went wrong.'));
    }
  }
  function onSaveHistoryMeta(){
    const store = global.CoachStore;
    const session = store.getSession();
    if(!session || !coachHistoryMatchId) return;
    const opponent = String(document.getElementById('coachHistoryOpponent')?.value || '').trim();
    if(!opponent){
      toast(tt('coachErrOpponent', 'Enter opponent.'));
      return;
    }
    const date = String(document.getElementById('coachHistoryDate')?.value || '').trim();
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)){
      toast(tt('coachErrGeneric', 'Something went wrong.'));
      return;
    }
    const kindRaw = document.getElementById('coachHistoryKind')?.value || 'league';
    const kind = ['league','friendly','cup','tournament'].includes(kindRaw) ? kindRaw : 'league';
    const tournament = kind === 'friendly'
      ? ''
      : String(document.getElementById('coachHistoryTournament')?.value || '').trim();
    const feeInfo = readHistoryFee();
    if(feeInfo.fee_type === 'paid' && !feeInfo.fee){
      toast(tt('coachErrFeeAmount', 'Enter the entry fee amount.'));
      return;
    }
    try{
      store.updateMatch(session, coachHistoryMatchId, {
        opponent,
        date,
        meetup: readHistoryMeetup(),
        kickoff: readHistoryKickoff(),
        fee_type: feeInfo.fee_type,
        fee: feeInfo.fee,
        venue: document.getElementById('coachHistoryVenue')?.value === 'away' ? 'away' : 'home',
        kind,
        tournament,
        address: document.getElementById('coachHistoryAddress')?.value || ''
      });
      toast(tt('coachHistoryMetaSaved', 'Match details saved.'));
      setCoachHistoryMetaOpen(false);
      renderCoachUi();
    }catch(e){
      const map = {
        opponent: tt('coachErrOpponent', 'Enter opponent.')
      };
      toast(map[e.message] || tt('coachErrGeneric', 'Something went wrong.'));
    }
  }
  function onDeleteHistoryMatch(){
    const store = global.CoachStore;
    const session = store.getSession();
    if(!session || !coachHistoryMatchId) return;
    const match = store.getMatch(session, coachHistoryMatchId);
    const label = match
      ? `${match.date || ''} · ${match.opponent || ''}`.trim()
      : '';
    const ok = window.confirm(
      tt('coachHistoryDeleteConfirm', 'Delete this played match? Score, ratings and parent cards for it will be removed.')
        .replace('{m}', label)
    );
    if(!ok) return;
    try{
      store.removeMatch(session, coachHistoryMatchId, {force: true});
      coachHistoryMatchId = '';
      toast(tt('toastDeleted', 'Match deleted'));
      if(typeof renderParentUi === 'function') renderParentUi();
      renderCoachUi();
    }catch(e){
      toast(tt('coachErrGeneric', 'Something went wrong.'));
    }
  }
  function closeCoachMatchDetail(){
    const store = global.CoachStore;
    if(store && store.setActiveMatchId) store.setActiveMatchId('');
    setCoachMatchCreateOpen(false);
    squadEditOpen = false;
    upcomingMetaOpen = false;
    setUpcomingMetaOpen(false);
    renderCoachUi();
  }
  function onSaveMatchScore(fromEl){
    const store = global.CoachStore;
    const session = store.getSession();
    const matchId = store.getActiveMatchId();
    if(!session || !matchId) return;
    const root = fromEl?.closest('#coachMatchPlayedBox') || document.getElementById('coachMatchPlayedBox') || document;
    const score = scoreFromCoachFields(root);
    if(!score){
      toast(tt('coachErrScore', 'Enter the match score.'));
      return;
    }
    try{
      store.updateMatch(session, matchId, {score, status: 'played'});
      // Keep the match open so coach can rate and send cards right away.
      store.setActiveMatchId(matchId);
      toast(tt('coachMatchScoreSaved', 'Score saved. Rate players below.'));
      renderCoachUi();
      try{
        document.querySelector('#coachMatchPlayedBox .js-cm-rates')?.scrollIntoView({behavior:'smooth', block:'nearest'});
      }catch(e){}
    }catch(e){
      toast(tt('coachErrGeneric', 'Something went wrong.'));
    }
  }
  async function shareMatchResults(matchId){
    const store = global.CoachStore;
    const session = store.getSession();
    if(!session || !matchId) return false;
    const match = store.getMatch(session, matchId);
    if(!match) return false;
    if(!matchIsPlayed(match) || !String(match.score || '').trim()){
      toast(tt('coachErrScoreFirst', 'Save the match score first.'));
      return false;
    }
    const squad = store.listMatchPlayers(session, match);
    const rated = squad.filter(p => store.getRatingForPlayer(session, matchId, p.id));
    if(!rated.length){
      toast(tt('coachErrRateFirst', 'Rate at least one player before sending cards.'));
      return false;
    }
    if(rated.length < squad.length){
      const ok = window.confirm(
        tt('coachSendPartialConfirm', 'Not all players are rated. Send cards for rated players only?')
      );
      if(!ok) return false;
    }
    try{
      const result = store.deliverMatchResults(session, matchId, {
        playerIds: rated.map(p => p.id),
        forceUnread: true
      });
      const delivered = result.delivered || 0;
      const waiting = result.waiting || 0;
      if(delivered && waiting){
        toast(tt('coachResultsMixed', '{n} cards in app, {w} waiting for parent link')
          .replace('{n}', String(delivered))
          .replace('{w}', String(waiting)));
      }else if(delivered){
        toast(tt('coachResultsInApp', 'Match cards delivered to parents in the app.'));
      }else if(waiting){
        toast(tt('coachResultsWaiting', 'Cards queued. Link a parent to each player to deliver in-app.'));
      }else{
        toast(tt('coachResultsInApp', 'Match cards delivered to parents in the app.'));
      }
      renderCoachUi();
      if(typeof renderParentUi === 'function') renderParentUi();
      return true;
    }catch(e){
      const map = {
        not_finished: tt('coachErrScoreFirst', 'Save the match score first.')
      };
      toast(map[e.message] || tt('coachErrGeneric', 'Something went wrong.'));
      return false;
    }
  }
  async function notifyMatchParents(matchId, opts){
    const store = global.CoachStore;
    const session = store.getSession();
    if(!session || !matchId) return {delivered: 0, waiting: 0};
    opts = opts || {};
    try{
      const result = store.deliverMatchInvites(session, matchId, {forceUnread: true});
      if(!opts.silent){
        const delivered = result.delivered || 0;
        const waiting = result.waiting || 0;
        if(delivered && waiting){
          toast(tt('coachInvitesMixed', '{n} in app, {w} waiting for parent link')
            .replace('{n}', String(delivered))
            .replace('{w}', String(waiting)));
        }else if(delivered){
          toast(tt('coachMatchParentsNotifiedOk', 'Parents notified in the app.'));
        }else if(waiting){
          toast(tt('coachInvitesWaiting', 'Invites queued. Link a parent to each player to deliver in-app.'));
        }
      }
      if(typeof renderParentUi === 'function') renderParentUi();
      return result || {delivered: 0, waiting: 0};
    }catch(e){
      if(!opts.silent) toast(tt('coachErrGeneric', 'Something went wrong.'));
      return {delivered: 0, waiting: 0};
    }
  }
  async function onCreateMatch(fromEl){
    const session = global.CoachStore.getSession();
    const teamId = global.CoachStore.getActiveTeamId();
    if(!teamId){
      toast(tt('coachPickTeamFirst', 'Pick a team in the Coach tab first.'));
      return;
    }
    const root = fromEl?.closest('.coach-hero') || fromEl?.closest('#coachMatchTab') || document;
    const opponent = (root.querySelector('.js-cm-opponent')?.value
      || document.getElementById('coachMatchOpponent')?.value
      || '').trim();
    const address = (root.querySelector('.js-cm-address')?.value
      || document.getElementById('coachMatchAddress')?.value
      || '').trim();
    const date = root.querySelector('.js-cm-date')?.value || today();
    const venue = root.querySelector('.js-cm-venue')?.value === 'away' ? 'away' : 'home';
    const kindRaw = root.querySelector('.js-cm-kind')?.value || 'league';
    const kind = ['league','friendly','cup','tournament'].includes(kindRaw) ? kindRaw : 'league';
    const kickoff = readCoachKickoff(root);
    const meetup = readCoachMeetup(root);
    const feeInfo = readCoachFee(root);
    const tournament = kind === 'friendly'
      ? ''
      : String(root.querySelector('.js-cm-tournament')?.value || '').trim();
    const picker = root.querySelector('#coachMatchCreate .js-cm-squad')
      || document.querySelector('#coachMatchCreate .js-cm-squad');
    let squad = selectedSquadFrom(picker || root);
    if(!squad.length && picker?.dataset.dirty !== '1'){
      const players = global.CoachStore.listPlayers(session, teamId);
      squad = players.map(p => p.id);
    }
    if(!squad.length){
      toast(tt('coachErrSquad', 'Select at least one player who plays.'));
      return;
    }
    if(feeInfo.fee_type === 'paid' && !feeInfo.fee){
      toast(tt('coachErrFeeAmount', 'Enter the entry fee amount.'));
      return;
    }
    try{
      const match = global.CoachStore.createMatch(session, teamId, {
        opponent,
        address,
        date,
        venue,
        kind,
        meetup,
        kickoff,
        fee_type: feeInfo.fee_type,
        fee: feeInfo.fee,
        tournament,
        score: '',
        squad,
        status: 'upcoming'
      });
      root.querySelectorAll('.js-cm-opponent').forEach(el => { el.value = ''; });
      root.querySelectorAll('.js-cm-address').forEach(el => { el.value = ''; });
      clearCoachMeetup();
      clearCoachKickoff();
      clearCoachFee();
      root.querySelectorAll('.js-cm-tournament').forEach(el => { el.value = ''; });
      document.querySelectorAll('#coachMatchCreate .js-cm-squad').forEach(el => { el.dataset.dirty = ''; });
      setCoachMatchCreateOpen(false);
      const notify = await notifyMatchParents(match.id, {silent: true});
      const delivered = notify.delivered || 0;
      const waiting = notify.waiting || 0;
      if(delivered && waiting){
        toast(tt('coachMatchCreatedMixed', 'Match created. {n} parents notified, {w} need a parent link.')
          .replace('{n}', String(delivered))
          .replace('{w}', String(waiting)));
      }else if(delivered){
        toast(tt('coachMatchCreatedNotified', 'Match created. Parents notified.'));
      }else if(waiting){
        toast(tt('coachMatchCreatedWaiting', 'Match created. Link parents to deliver notices.'));
      }else{
        toast(tt('coachMatchCreated', 'Match created.'));
      }
      renderCoachUi();
      if(typeof showView === 'function') showView('new');
      try{
        document.getElementById('coachMatchDetail')?.scrollIntoView({behavior:'smooth', block:'start'});
      }catch(e){}
    }catch(e){
      const map = {
        opponent: tt('coachErrOpponent', 'Enter opponent.'),
        squad: tt('coachErrSquad', 'Select at least one player who plays.')
      };
      toast(map[e.message] || tt('coachErrGeneric', 'Could not create match.'));
    }
  }
  function markSquadDirty(picker){
    if(picker) picker.dataset.dirty = '1';
  }

  const COACH_QUICK_KEYS = {
    fwd: ['goals','assists','shots','dribbles','passes','losses'],
    mid: ['goals','assists','chances','tackles','passes','duelswon'],
    def: ['tackles','interceptions','clearances','blocks','duelswon','losses'],
    gk: ['saves','claims','conceded','interceptions','gkpass','buildpass']
  };
  let quickRate = null; // {matchId, teamPlayerId, pitchPos, position, playerName, opponent, date, score, rating, counts}

  function quickKeysForPos(pos){
    return COACH_QUICK_KEYS[pos] || COACH_QUICK_KEYS.fwd;
  }
  function clampQuickScore(n){
    n = Math.round(Number(n) * 10) / 10;
    if(!Number.isFinite(n)) n = 6;
    return Math.max(4, Math.min(10, n));
  }
  function renderQuickMoments(){
    const box = document.getElementById('coachRateMoments');
    if(!box || !quickRate) return;
    const keys = quickKeysForPos(quickRate.position);
    const short = {
      goals: tt('m_goals', 'Goal'),
      assists: tt('m_assists', 'Assist'),
      shots: tt('m_shots', 'Shot'),
      dribbles: tt('m_dribbles', 'Dribble'),
      passes: tt('m_passes', 'Pass'),
      losses: tt('m_losses', 'Loss'),
      chances: tt('m_chances', 'Chance'),
      tackles: tt('m_tackles', 'Tackle'),
      duelswon: tt('m_duelswon', 'Duel+'),
      interceptions: tt('m_interceptions', 'Intercept'),
      clearances: tt('m_clearances', 'Clear'),
      blocks: tt('m_blocks', 'Block'),
      saves: tt('m_saves', 'Save'),
      claims: tt('m_claims', 'Claim'),
      conceded: tt('m_conceded', 'Conceded'),
      gkpass: tt('m_gkpass', 'GK pass'),
      buildpass: tt('m_buildpass', 'Build')
    };
    box.innerHTML = keys.map(key => {
      const n = Number(quickRate.counts[key]) || 0;
      const lab = short[key] || (typeof metricLabel === 'function' ? metricLabel(key) : key);
      return `<div class="coach-moment" data-key="${esc(key)}">
        <b title="${esc(lab)}">${esc(lab)}</b>
        <div class="coach-moment-ctr">
          <button type="button" data-mom-delta="-1" aria-label="-">−</button>
          <span>${n}</span>
          <button type="button" data-mom-delta="1" aria-label="+">+</button>
        </div>
      </div>`;
    }).join('');
  }
  function syncQuickScoreUi(){
    const el = document.getElementById('coachRateScore');
    if(el && quickRate) el.textContent = clampQuickScore(quickRate.rating).toFixed(1);
  }
  function openCoachQuickRate(matchId, teamPlayerId){
    const store = global.CoachStore;
    const session = store && store.getSession();
    if(!store || !session) return;
    const match = store.getMatch(session, matchId);
    const players = match ? store.listPlayers(session, match.team_id) : [];
    const tp = players.find(p => p.id === teamPlayerId);
    if(!match || !tp){
      toast(tt('coachErrGeneric', 'Something went wrong.'));
      return;
    }
    const existing = store.getRatingForPlayer(session, matchId, teamPlayerId);
    const pitchPos = (typeof isPitchCode === 'function' && isPitchCode(tp.position) ? tp.position : null)
      || (existing && existing.pitchPos)
      || 'RW';
    const position = (typeof ratingPosOf === 'function' ? ratingPosOf(pitchPos) : 'fwd') || 'fwd';
    const emptyCounts = {};
    (typeof METRICS !== 'undefined' ? METRICS : []).forEach(m => { emptyCounts[m.key] = 0; });
    const counts = {...emptyCounts, ...(existing && existing.counts ? existing.counts : {})};
    quickRate = {
      matchId: match.id,
      teamId: match.team_id,
      teamPlayerId: tp.id,
      playerName: [tp.first_name, tp.last_name].filter(Boolean).join(' '),
      pitchPos,
      position,
      opponent: match.opponent,
      date: match.date,
      score: match.score || '',
      rating: existing ? clampQuickScore(existing.rating) : 6,
      counts,
      comment: existing ? String(existing.comment || '') : ''
    };
    const sheet = document.getElementById('coachRateSheet');
    const back = document.getElementById('coachRateBack');
    const card = document.getElementById('coachRateCard');
    const nameEl = document.getElementById('coachRateName');
    const metaEl = document.getElementById('coachRateMeta');
    const commentEl = document.getElementById('coachRateComment');
    if(nameEl) nameEl.textContent = quickRate.playerName;
    if(metaEl){
      const posLab = typeof pitchPosLabelShort === 'function' ? pitchPosLabelShort(pitchPos) : pitchPos;
      metaEl.textContent = `${quickRate.date} · ${quickRate.opponent}${quickRate.score ? ` · ${quickRate.score}` : ''} · ${posLab}`;
    }
    if(commentEl) commentEl.value = quickRate.comment;
    const saveBtn = document.getElementById('coachRateSaveBtn');
    if(saveBtn){
      saveBtn.setAttribute('data-i18n', 'coachQuickSaveSend');
      saveBtn.textContent = tt('coachQuickSaveSend', 'Save and send to parent');
    }
    syncQuickScoreUi();
    renderQuickMoments();
    if(typeof presentSheetCard === 'function') presentSheetCard(card, back);
    else{
      if(sheet) sheet.hidden = false;
      if(back) back.hidden = false;
    }
    // Full height so the 3×2 moment chips fit without inner scrolling.
    if(card) card.classList.add('sheet-full');
    if(typeof pushAppState === 'function') pushAppState('layer');
  }
  function closeCoachQuickRate(){
    quickRate = null;
    const card = document.getElementById('coachRateCard');
    const back = document.getElementById('coachRateBack');
    if(typeof hideSheetCard === 'function') hideSheetCard(card, back);
    else{
      const sheet = document.getElementById('coachRateSheet');
      if(sheet) sheet.hidden = true;
      if(back) back.hidden = true;
    }
  }

  let detailPlayerId = '';
  let detailEditOpen = false;
  let parentInviteRow = null;

  function closeCoachPlayerSheet(){
    detailPlayerId = '';
    detailEditOpen = false;
    const card = document.getElementById('coachPlayerCard');
    const back = document.getElementById('coachPlayerBack');
    if(typeof hideSheetCard === 'function') hideSheetCard(card, back);
    else{
      const sheet = document.getElementById('coachPlayerSheet');
      if(sheet) sheet.hidden = true;
      if(back) back.hidden = true;
    }
  }
  function closeAllCoachOverlays(){
    closeCoachPlayerSheet();
    closeCoachSettings();
    closeTeamMenu();
    if(typeof closeCoachQuickRate === 'function') closeCoachQuickRate();
    closeCoachParentInviteSheet();
    [
      'coachSettingsBack','coachRateBack','coachPlayerBack','coachParentInviteBack','coachTeamMenuBack',
      'parentClaimBack','parentLinkBack','parentMsgBack','inboxSheetBack'
    ].forEach(id => {
      const el = document.getElementById(id);
      if(el) el.hidden = true;
    });
    [
      'coachSettingsSheet','coachRateSheet','coachPlayerSheet','coachParentInviteSheet','coachTeamMenuSheet',
      'parentClaimSheet','parentLinkSheet','parentMsgSheet','inboxSheet'
    ].forEach(id => {
      const el = document.getElementById(id);
      if(el) el.hidden = true;
    });
  }
  function openCoachPlayerSheet(playerId, opts){
    const store = global.CoachStore;
    const session = store && store.getSession();
    const detail = session && store.playerDetail(session, playerId);
    if(!detail){
      toast(tt('coachErrGeneric', 'Something went wrong.'));
      return;
    }
    opts = opts || {};
    // From Stats — go straight to the ratings page (no edit form).
    if(opts.viewRatings){
      openCoachChildPlayerPage(playerId, {returnTo: opts.returnTo || 'stats'});
      return;
    }
    detailPlayerId = playerId;
    if(typeof opts.editOpen === 'boolean') detailEditOpen = opts.editOpen;
    const sheet = document.getElementById('coachPlayerSheet');
    const back = document.getElementById('coachPlayerBack');
    const body = document.getElementById('coachPlayerBody');
    if(!sheet || !body) return;
    const p = detail.player;
    const label = [p.first_name, p.last_name].filter(Boolean).join(' ');
    const verified = isCoachPlayerVerified(p);
    const nameHtml = verified && typeof nameWithVerifiedHtml === 'function'
      ? nameWithVerifiedHtml(label, true)
      : esc(label);
    const posLab = p.position && typeof pitchPosLabelShort === 'function'
      ? pitchPosLabelShort(p.position)
      : (p.position || '');
    const metaBits = [
      p.number ? `#${p.number}` : '',
      posLab,
      detail.team && detail.team.name
    ].filter(Boolean).join(' · ');
    const ratingsHtml = detail.ratings.length
      ? detail.ratings.slice(0, 12).map(r => {
          const head = ratingRowHeadHtml(r);
          const c = r.counts && typeof r.counts === 'object' ? r.counts : {};
          const mom = Object.keys(c)
            .filter(k => Number(c[k]) > 0)
            .sort((a, b) => Number(c[b]) - Number(c[a]))
            .slice(0, 3)
            .map(k => `${metricLab(k)} ${c[k]}`)
            .join(' · ');
          return `<div class="coach-player-row">
            <div class="coach-player-main">
              <b>${head}</b>
              ${r.comment ? `<span>${esc(r.comment)}</span>` : ''}
              ${mom ? `<span class="coach-stat-mom">${esc(mom)}</span>` : ''}
            </div>
            <b class="parent-rate-num">${esc(Number(r.rating).toFixed(1))}</b>
          </div>`;
        }).join('')
      : `<p class="hint">${esc(tt('coachPlayerNoRatings', 'No ratings for this player yet.'))}</p>`;
    const editBlock = detailEditOpen
      ? `<div class="coach-player-edit-block">
          <div class="coach-player-form coach-player-edit">
            <input id="coachEditFirst" type="text" maxlength="40" value="${esc(p.first_name || '')}" data-i18n-placeholder="coachFirstPh" placeholder="First name">
            <input id="coachEditLast" type="text" maxlength="40" value="${esc(p.last_name || '')}" data-i18n-placeholder="coachLastPh" placeholder="Last name">
            <input id="coachEditNumber" type="text" maxlength="4" inputmode="numeric" value="${esc(p.number || '')}" placeholder="#">
            <input id="coachEditContact" type="text" maxlength="80" value="${esc(p.contact || '')}" data-i18n-placeholder="coachContactPh" placeholder="Parent phone or email">
            <select id="coachEditPos" class="coach-pos-select" aria-label="position"></select>
          </div>
          <button type="button" class="save-btn" id="coachSavePlayerBtn">${esc(tt('coachSavePlayer', 'Save player'))}</button>
          <button type="button" class="ghost-btn" id="coachCancelEditPlayerBtn">${esc(tt('previewCancel', 'Cancel'))}</button>
        </div>`
      : '';
    const notesVal = String(p.coach_notes || '');
    const notesBlock = `<div class="coach-private-notes" id="coachPrivateNotesBlock">
      <div class="coach-private-notes-head">
        <div>
          <div class="pro-kicker coach-private-notes-kicker">
            <span class="coach-lock-ico" aria-hidden="true">🔒</span>
            ${esc(tt('coachPrivateNotesKicker', 'Private notes'))}
          </div>
          <p class="hint coach-private-notes-hint">${esc(tt('coachPrivateNotesHint', 'Only coach and assistants. Parents never see this.'))}</p>
        </div>
        ${notesVal.trim()
          ? `<span class="coach-private-notes-badge">${esc(tt('coachPrivateNotesSaved', 'Saved'))}</span>`
          : `<span class="coach-private-notes-badge coach-private-notes-badge-empty">${esc(tt('coachPrivateNotesEmpty', 'Empty'))}</span>`}
      </div>
      <textarea id="coachPrivateNotes" maxlength="2000" rows="4" data-i18n-placeholder="coachPrivateNotesPh" placeholder="${esc(tt('coachPrivateNotesPh', 'Strengths, focus for next match, injuries, character…'))}">${esc(notesVal)}</textarea>
      <div class="coach-private-notes-actions">
        <button type="button" class="save-btn" id="coachSavePrivateNotesBtn">${esc(tt('coachPrivateNotesSave', 'Save notes'))}</button>
        <span class="hint" id="coachPrivateNotesStatus" hidden></span>
      </div>
    </div>`;
    body.innerHTML = `
      <div class="pro-kicker">${esc(tt('coachPlayerDetailKicker', 'Player'))}</div>
      <div class="coach-player-sheet-head">
        ${coachPlayerAvatarHtml(p)}
        <div>
          <h3 class="coach-rate-name" id="coachPlayerSheetTitle">${nameHtml}</h3>
          <p class="hint">${esc(metaBits)}</p>
        </div>
      </div>
      <div class="coach-analytics-sum coach-analytics-sum-4">
        <div><b>${esc(detail.games)}</b><span>${esc(tt('coachGames', 'games'))}</span></div>
        <div><b>${esc(fmtScore(detail.avg))}</b><span>${esc(tt('coachStatAvgShort', 'avg'))}</span></div>
        <div><b>${esc(fmtScore(detail.last))}</b><span>${esc(tt('coachStatLast', 'last'))}</span></div>
        <div><b class="${trendClass(detail.trend)}">${esc(trendLabel(detail.trend) || '—')}</b><span>${esc(tt('coachStatTrend', 'trend'))}</span></div>
      </div>
      <div class="coach-analytics-sum">
        <div><b>${esc(fmtScore(detail.best))}</b><span>${esc(tt('coachStatBest', 'Best'))}</span></div>
        <div><b>${esc(fmtScore(detail.worst))}</b><span>${esc(tt('coachStatWorst', 'Worst'))}</span></div>
        <div><b>${esc(detail.minutes || 0)}</b><span>${esc(tt('coachStatMinutes', 'Minutes'))}</span></div>
      </div>
      ${detail.form && detail.form.length ? `<p class="hint coach-form-line"><b>${esc(tt('coachStatForm', 'Form'))}:</b> ${esc(formSpark(detail.form))}</p>` : ''}
      ${notesBlock}
      ${detail.topMoments && detail.topMoments.length ? `<div class="coach-stat-section"><div class="pro-kicker">${esc(tt('coachPlayerMomentsKicker', 'Key moments'))}</div>${momentsHtml(detail.topMoments)}</div>` : ''}
      <div class="pro-kicker">${esc(tt('coachPlayerRatingsKicker', 'Recent ratings'))}</div>
      <div class="coach-player-list">${ratingsHtml}</div>
      <div class="coach-player-sheet-actions">
        <button type="button" class="save-btn" id="coachOpenChildPageBtn">${esc(tt('coachOpenChildPage', 'Open player page'))}</button>
        <button type="button" class="ghost-btn" id="coachToggleEditPlayerBtn">${esc(detailEditOpen ? tt('coachHideEditPlayer', 'Hide edit') : tt('coachEditPlayerBtn', 'Edit player'))}</button>
        <button type="button" class="ghost-btn" id="coachMessagePlayerBtn" ${isCoachPlayerVerified(p) ? '' : 'hidden'}>${esc(tt('chatWritePlayer', 'Message player / parent'))}</button>
        <button type="button" class="ghost-btn" id="coachAddParentBtn">${esc(tt('coachAddParentBtn', 'Add parent / guardian'))}</button>
        <button type="button" class="ghost-btn coach-remove-player" id="coachRemovePlayerBtn">${esc(tt('coachRemovePlayer', 'Remove player'))}</button>
        <button type="button" class="ghost-btn" id="coachPlayerCloseBtn">${esc(tt('btnClose', 'Close'))}</button>
      </div>
      ${editBlock}
    `;
    if(detailEditOpen){
      const posSel = document.getElementById('coachEditPos');
      if(posSel && typeof fillPitchSelect === 'function'){
        fillPitchSelect(posSel, p.position || 'RW', true);
      }
    }
    const card = document.getElementById('coachPlayerCard');
    if(typeof presentSheetCard === 'function') presentSheetCard(card, back);
    else{
      sheet.hidden = false;
      if(back) back.hidden = false;
    }
    if(typeof pushAppState === 'function') pushAppState('layer');
  }

  function saveCoachPrivateNotes(){
    if(!detailPlayerId) return;
    const store = global.CoachStore;
    const session = store && store.getSession();
    if(!session) return;
    const ta = document.getElementById('coachPrivateNotes');
    const notes = ta ? String(ta.value || '') : '';
    try{
      store.updatePlayer(session, detailPlayerId, {coach_notes: notes});
      toast(tt('coachPrivateNotesToast', 'Private notes saved.'));
      openCoachPlayerSheet(detailPlayerId, {editOpen: detailEditOpen});
      renderCoachUi();
    }catch(e){
      toast(tt('coachErrGeneric', 'Something went wrong.'));
    }
  }

  function saveCoachPlayerFromSheet(){
    if(!detailPlayerId) return;
    const store = global.CoachStore;
    const session = store.getSession();
    if(!session) return;
    const firstEl = document.getElementById('coachEditFirst');
    if(!firstEl){
      detailEditOpen = true;
      openCoachPlayerSheet(detailPlayerId, {editOpen: true});
      toast(tt('coachEditPlayerFirst', 'Edit the player, then save.'));
      return;
    }
    const first = firstEl.value || '';
    const last = document.getElementById('coachEditLast')?.value || '';
    const number = document.getElementById('coachEditNumber')?.value || '';
    const contact = document.getElementById('coachEditContact')?.value || '';
    const position = document.getElementById('coachEditPos')?.value || '';
    try{
      store.updatePlayer(session, detailPlayerId, {
        first_name: first,
        last_name: last,
        number,
        contact,
        position
      });
      toast(tt('coachPlayerSaved', 'Player saved.'));
      detailEditOpen = false;
      const keepId = detailPlayerId;
      renderCoachUi();
      openCoachPlayerSheet(keepId, {editOpen: false});
    }catch(e){
      const map = {
        name: tt('coachErrPlayerName', 'Enter first name.'),
        forbidden: tt('coachErrGeneric', 'Something went wrong.')
      };
      toast(map[e.message] || tt('coachErrGeneric', 'Something went wrong.'));
    }
  }

  function openCoachChildPlayerPage(playerId, opts){
    const store = global.CoachStore;
    const session = store && store.getSession();
    try{
      if(typeof syncCoachPlayerPhotosFromPersonal === 'function') syncCoachPlayerPhotosFromPersonal();
    }catch(e){}
    const detail = session && store.playerDetail(session, playerId);
    if(!detail){
      toast(tt('coachErrGeneric', 'Something went wrong.'));
      return;
    }
    opts = opts || {};
    const returnTo = opts.returnTo === 'stats' ? 'stats' : 'coach';
    const parentStats = global.ParentStatsStore
      ? global.ParentStatsStore.listForPlayer(playerId)
      : [];
    const parentAvg = global.ParentStatsStore
      ? global.ParentStatsStore.avgForPlayer(playerId)
      : null;
    const parentSummary = global.ParentStatsStore && typeof global.ParentStatsStore.summaryForPlayer === 'function'
      ? global.ParentStatsStore.summaryForPlayer(playerId)
      : null;
    // Attach resolved photo so header / cards always see it.
    const player = {
      ...detail.player,
      photo: resolveCoachPlayerPhoto(detail.player) || detail.player.photo || ''
    };
    global.coachChildView = {
      playerId,
      player,
      team: detail.team,
      academy: detail.academy,
      coachRatings: detail.ratings || [],
      coachAvg: detail.avg,
      coachGames: detail.games,
      parentStats,
      parentAvg,
      parentSummary,
      returnTo
    };
    closeAllCoachOverlays();
    if(typeof showView === 'function') showView('coach-child');
    try{ window.scrollTo({top:0, behavior:'instant'}); }catch(e){ window.scrollTo(0, 0); }
  }

  function removeCoachPlayerFromSheet(){
    if(!detailPlayerId) return;
    const store = global.CoachStore;
    const session = store.getSession();
    const detail = session && store.playerDetail(session, detailPlayerId);
    const label = detail
      ? [detail.player.first_name, detail.player.last_name].filter(Boolean).join(' ')
      : '';
    const msg = tt('coachConfirmRemovePlayer', 'Remove {name} from the team?')
      .replace('{name}', label || tt('coachPlayerDetailKicker', 'Player'));
    if(!confirm(msg)) return;
    try{
      store.removePlayer(session, detailPlayerId);
      closeCoachPlayerSheet();
      toast(tt('coachPlayerRemoved', 'Player removed.'));
      renderCoachUi();
    }catch(e){
      toast(tt('coachErrGeneric', 'Something went wrong.'));
    }
  }

  function drawInviteQr(text){
    const box = document.getElementById('coachParentQr');
    if(!box) return;
    box.innerHTML = '';
    try{
      const make = typeof qrcode === 'function' ? qrcode : (global.qrcode);
      if(typeof make !== 'function'){
        box.innerHTML = `<p class="hint">${esc(tt('coachQrFallback', 'QR unavailable — use the link below.'))}</p>`;
        return;
      }
      const qr = make(0, 'L');
      qr.addData(String(text || ''), 'Byte');
      qr.make();
      const count = qr.getModuleCount();
      const size = 220;
      const cell = size / count;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      canvas.className = 'coach-parent-qr-canvas';
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = '#0b1220';
      for(let r = 0; r < count; r++){
        for(let c = 0; c < count; c++){
          if(qr.isDark(r, c)) ctx.fillRect(c * cell, r * cell, cell + 0.5, cell + 0.5);
        }
      }
      box.appendChild(canvas);
    }catch(e){
      box.innerHTML = `<p class="hint">${esc(tt('coachQrFallback', 'QR unavailable — use the link below.'))}</p>`;
    }
  }

  function closeCoachParentInviteSheet(){
    parentInviteRow = null;
    const card = document.getElementById('coachParentInviteCard');
    const back = document.getElementById('coachParentInviteBack');
    if(typeof hideSheetCard === 'function') hideSheetCard(card, back);
    else{
      const sheet = document.getElementById('coachParentInviteSheet');
      if(sheet) sheet.hidden = true;
      if(back) back.hidden = true;
    }
  }
  function openCoachParentInviteSheet(playerId){
    const store = global.CoachStore;
    const session = store.getSession();
    if(!session) return;
    let invite;
    try{
      invite = store.createParentInvite(session, playerId);
    }catch(e){
      toast(tt('coachErrGeneric', 'Something went wrong.'));
      return;
    }
    parentInviteRow = invite;
    const sheet = document.getElementById('coachParentInviteSheet');
    const back = document.getElementById('coachParentInviteBack');
    const nameEl = document.getElementById('coachParentInviteName');
    const metaEl = document.getElementById('coachParentInviteMeta');
    const linkEl = document.getElementById('coachParentInviteLink');
    const codeEl = document.getElementById('coachParentInviteCode');
    const emailEl = document.getElementById('coachParentInviteEmail');
    const p = invite.payload;
    const child = [p.player.fn, p.player.ln].filter(Boolean).join(' ');
    if(nameEl) nameEl.textContent = child;
    if(metaEl){
      metaEl.textContent = [
        p.tm && p.tm.name,
        p.tm && p.tm.age_group
      ].filter(Boolean).join(' · ');
    }
    const deep = global.ParentStore ? global.ParentStore.buildLink(p) : '';
    if(linkEl) linkEl.value = deep;
    if(codeEl) codeEl.textContent = `MC-${invite.code}`;
    if(emailEl){
      const player = store.getPlayer(session, playerId);
      const contact = String(player && player.contact || '').trim();
      emailEl.value = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact) ? contact : '';
    }
    // Smaller payload for QR capacity; full snapshot stays in the shareable link.
    let qrPayload = p;
    try{
      qrPayload = store.buildParentInvitePayload(session, playerId, {
        token: invite.token,
        code: invite.code,
        maxRatings: 6
      });
    }catch(e){}
    const qrLink = global.ParentStore ? global.ParentStore.buildLink(qrPayload) : deep;
    drawInviteQr(qrLink.length < 1800 ? qrLink : `FFKP1:${global.ParentStore.encodePayload(qrPayload)}`);
    const card = document.getElementById('coachParentInviteCard');
    if(typeof presentSheetCard === 'function') presentSheetCard(card, back);
    else{
      if(sheet) sheet.hidden = false;
      if(back) back.hidden = false;
    }
    if(typeof pushAppState === 'function') pushAppState('layer');
  }

  async function shareParentInvite(){
    if(!parentInviteRow) return;
    const store = global.CoachStore;
    const session = store.getSession();
    const text = store.parentInviteMessage(session, parentInviteRow);
    const title = tt('coachParentShareTitle', 'Parent invite');
    try{
      const C = global.Capacitor;
      const Share = C && C.Plugins && C.Plugins.Share;
      if(Share && typeof Share.share === 'function'){
        await Share.share({title, text, dialogTitle: title});
        toast(tt('coachParentShared', 'Invite shared.'));
        return;
      }
    }catch(e){}
    try{
      if(navigator.share){
        await navigator.share({title, text});
        toast(tt('coachParentShared', 'Invite shared.'));
        return;
      }
    }catch(e){}
    try{
      await navigator.clipboard.writeText(text);
      toast(tt('coachParentCopied', 'Invite copied.'));
    }catch(e){
      toast(tt('coachErrGeneric', 'Something went wrong.'));
    }
  }

  async function sendParentInviteEmailTest(){
    if(!TEST_EMAIL_INVITES || !parentInviteRow) return;
    const emailEl = document.getElementById('coachParentInviteEmail');
    const email = String(emailEl && emailEl.value || '').trim();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
      toast(tt('coachParentEmailInvalid', 'Enter a valid email.'));
      if(emailEl) emailEl.focus();
      return;
    }
    const store = global.CoachStore;
    const session = store && store.getSession && store.getSession();
    if(!store || !session) return;
    const full = parentInviteRow.payload || {};
    const child = full.player
      ? [full.player.fn, full.player.ln].filter(Boolean).join(' ')
      : '';
    const subject = `${tt('coachParentEmailSubject', 'Matchcard invitation')}${child ? ` — ${child}` : ''}`;
    let link = '';
    if(global.ParentCloud && global.ParentCloud.ready && global.ParentCloud.ready()){
      try{
        link = await global.ParentCloud.publishInvite(parentInviteRow);
      }catch(e){
        toast(tt('coachCloudSyncFail', 'Cloud sync failed. Check keys and schema.'));
        return;
      }
    }else if(global.ParentStore){
      link = global.ParentStore.buildCodeWebLink(parentInviteRow.code || full.code || '');
    }
    const body = tt(
      'coachParentEmailBody',
      '[TEST MODE] Confirm the player in Matchcard: {link}'
    ).replace('{name}', child).replace('{link}', link);
    const href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    const a = document.createElement('a');
    a.href = href;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function saveCoachQuickRate(){
    if(!quickRate) return;
    const store = global.CoachStore;
    const session = store.getSession();
    if(!session) return;
    const matchId = quickRate.matchId;
    const playerId = quickRate.teamPlayerId;
    const comment = document.getElementById('coachRateComment')?.value || '';
    const minutes = 60;
    const matchLen = 60;
    const format = '2x30';
    const behaviors = (typeof emptyForm === 'function') ? emptyForm().behaviors : {};
    const action = (typeof actionScore === 'function')
      ? actionScore(quickRate.counts, quickRate.position, minutes, matchLen)
      : quickRate.rating;
    store.upsertRating(session, {
      match_id: matchId,
      team_player_id: playerId,
      player_name: quickRate.playerName,
      pitchPos: quickRate.pitchPos,
      position: quickRate.position,
      minutes,
      format,
      matchLen,
      role: 'start',
      comment: String(comment).trim().slice(0, 400),
      counts: quickRate.counts,
      behaviors,
      timeline: [],
      kickoffAt: 0,
      kickoffClock: '',
      actionRating: action,
      effortRating: 6,
      rating: clampQuickScore(quickRate.rating),
      score: quickRate.score || store.getMatch(session, matchId)?.score || ''
    });
    // Ensure match is in played state once ratings start
    try{
      const m = store.getMatch(session, matchId);
      if(m && !matchIsPlayed(m)){
        store.finishMatch(session, matchId, m.score || '');
      }
    }catch(e){}
    closeCoachQuickRate();
    // Auto-send this player's card to their parent/guardian only.
    let delivered = 0;
    let waiting = 0;
    try{
      const result = store.deliverMatchResults(session, matchId, {
        playerIds: [playerId],
        forceUnread: true
      });
      delivered = result.delivered || 0;
      waiting = result.waiting || 0;
    }catch(e){
      if(e && e.message === 'not_finished'){
        toast(tt('coachRatingSavedNeedScore', 'Rating saved. Save the match score to send the card to the parent.'));
        renderCoachUi();
        if(typeof renderParentUi === 'function') renderParentUi();
        return;
      }
      toast(tt('coachRatingSaved', 'Player rating saved to Coach.'));
      renderCoachUi();
      return;
    }
    if(delivered){
      toast(tt('coachRatingSavedSent', 'Saved and sent to the parent.'));
    }else if(waiting){
      toast(tt('coachRatingSavedWaiting', 'Saved. Card queued — link a parent to deliver it.'));
    }else{
      toast(tt('coachRatingSaved', 'Player rating saved to Coach.'));
    }
    renderCoachUi();
    if(typeof renderParentUi === 'function') renderParentUi();
  }

  function bindCoachUi(){
    if(global.__ffkCoachBound) return;
    global.__ffkCoachBound = true;
    document.getElementById('coachStartBtn')?.addEventListener('click', () => {
      if(global.CoachStore.getSession()){
        document.getElementById('coachWorkspace').dataset.started = '1';
        if(typeof setCoachPlan === 'function') setCoachPlan(true);
        renderCoachUi();
        if(typeof showView === 'function') showView('coach');
      }else openAuth();
    });
    document.getElementById('coachSignUpBtn')?.addEventListener('click', () => { onSignUp(); });
    document.getElementById('coachSignInBtn')?.addEventListener('click', () => { onSignIn(); });
    document.getElementById('coachSignOutBtn')?.addEventListener('click', () => { onSignOut(); });
    document.getElementById('coachEnterParentBtn')?.addEventListener('click', () => { enterParentMode(); });
    document.getElementById('enterParentModeBtn')?.addEventListener('click', () => { enterParentMode(); });
    document.getElementById('enterCoachModeBtn')?.addEventListener('click', () => { enterCoachMode(); });
    document.getElementById('coachCreateAcademyBtn')?.addEventListener('click', () => { onCreateAcademy(); });
    document.getElementById('coachSaveAcademyBtn')?.addEventListener('click', () => { onSaveAcademy(); });
    document.getElementById('coachAddTeamBtn')?.addEventListener('click', () => {
      const box = document.getElementById('coachHomeCreateTeam');
      setHomeCreateTeamOpen(!!(box && box.hidden));
    });
    document.getElementById('coachHomeCreateTeamBtn')?.addEventListener('click', () => { onCreateTeam(); });
    document.getElementById('coachHomeCreateTeamCancel')?.addEventListener('click', () => { setHomeCreateTeamOpen(false); });
    document.getElementById('coachShowAddPlayerBtn')?.addEventListener('click', () => { setPlayerFormOpen(true); });
    document.getElementById('coachAddPlayerCancel')?.addEventListener('click', () => { setPlayerFormOpen(false); });
    document.getElementById('coachAddPlayerBtn')?.addEventListener('click', () => { onAddPlayer(); });
    document.getElementById('coachTeamMenuBack')?.addEventListener('click', () => closeTeamMenu());
    document.getElementById('coachTeamMenuCloseBtn')?.addEventListener('click', () => closeTeamMenu());
    document.getElementById('coachTeamRenameSaveBtn')?.addEventListener('click', () => onSaveTeamRename());
    document.getElementById('coachTeamDeleteBtn')?.addEventListener('click', () => onDeleteTeam());
    document.getElementById('coachRosterToggle')?.addEventListener('click', () => {
      setRosterFolded(!rosterFolded());
      const session = global.CoachStore && global.CoachStore.getSession();
      const teamId = global.CoachStore && global.CoachStore.getActiveTeamId && global.CoachStore.getActiveTeamId();
      let n = 0;
      try{
        if(session && teamId) n = global.CoachStore.listPlayers(session, teamId).length;
      }catch(e){}
      syncRosterFoldUi(n);
    });
    document.getElementById('coachSaveProfileBtn')?.addEventListener('click', () => { onSaveProfile(); });
    document.getElementById('coachSettingsBtn')?.addEventListener('click', () => openCoachSettings());
    document.getElementById('coachHomeStats')?.addEventListener('click', e => {
      const btn = e.target.closest('[data-coach-jump]');
      if(btn) jumpCoachStat(btn.dataset.coachJump);
    });
    document.getElementById('coachLeaveRequests')?.addEventListener('click', e => {
      const btn = e.target.closest('[data-leave-decide]');
      if(!btn) return;
      e.preventDefault();
      onCoachLeaveDecide(btn);
    });
    document.getElementById('coachSettingsBack')?.addEventListener('click', () => closeCoachSettings());
    document.getElementById('coachSettingsCloseBtn')?.addEventListener('click', () => closeCoachSettings());
    document.getElementById('coachHistoryBackBtn')?.addEventListener('click', () => {
      closeCoachHistoryMatch();
      renderCoachUi();
    });
    document.getElementById('coachHistoryBackBottom')?.addEventListener('click', () => {
      closeCoachHistoryMatch();
      renderCoachUi();
    });
    document.getElementById('coachHistorySaveScore')?.addEventListener('click', () => {
      onSaveHistoryScore();
    });
    document.getElementById('coachHistorySaveMeta')?.addEventListener('click', () => {
      onSaveHistoryMeta();
    });
    document.getElementById('coachHistoryMetaToggle')?.addEventListener('click', () => {
      const body = document.getElementById('coachHistoryMetaBody');
      setCoachHistoryMetaOpen(!!(body && body.hidden));
    });
    document.getElementById('coachHistoryDeleteBtn')?.addEventListener('click', () => {
      onDeleteHistoryMatch();
    });
    document.getElementById('coachHistoryKind')?.addEventListener('change', () => {
      syncHistoryCompetitionField();
    });
    document.getElementById('coachHistoryKickoffH')?.addEventListener('change', () => syncHistoryKickoffHidden());
    document.getElementById('coachHistoryKickoffM')?.addEventListener('change', () => syncHistoryKickoffHidden());
    document.getElementById('coachHistoryMeetupH')?.addEventListener('change', () => syncHistoryMeetupHidden());
    document.getElementById('coachHistoryMeetupM')?.addEventListener('change', () => syncHistoryMeetupHidden());
    document.getElementById('coachHistoryFeeType')?.addEventListener('change', () => syncHistoryFeeAmountWrap());
    document.getElementById('coachHistorySeason')?.addEventListener('change', e => {
      coachHistSeason = e.target.value || 'all';
      closeCoachHistoryMatch();
      renderCoachUi();
    });
    document.getElementById('coachStatsSeason')?.addEventListener('change', e => {
      coachStatsSeason = e.target.value || 'all';
      renderCoachUi();
    });
    document.getElementById('coachStatsPeriod')?.addEventListener('click', e => {
      const btn = e.target.closest('[data-coach-stats-period]');
      if(!btn) return;
      coachStatsPeriod = btn.dataset.coachStatsPeriod || 'all';
      renderCoachUi();
    });
    document.getElementById('coachStatsBoard')?.addEventListener('click', e => {
      const jump = e.target.closest('[data-coach-jump]');
      if(jump){
        jumpCoachStat(jump.dataset.coachJump);
        return;
      }
    });
    document.getElementById('coachHistorySendResults')?.addEventListener('click', () => {
      shareMatchResults(coachHistoryMatchId);
    });
    document.getElementById('coachHistoryCommentSave')?.addEventListener('click', () => {
      const store = global.CoachStore;
      const session = store.getSession();
      if(!session || !coachHistoryMatchId) return;
      try{
        store.updateMatch(session, coachHistoryMatchId, {
          comment: document.getElementById('coachHistoryComment')?.value || ''
        });
        toast(tt('coachMatchCommentSaved', 'Comment saved.'));
        renderCoachUi();
      }catch(e){
        toast(tt('coachErrGeneric', 'Something went wrong.'));
      }
    });
    document.getElementById('coachHistoryShareMatchBtn')?.addEventListener('click', () => {
      shareCoachTeamMatchCard(coachHistoryMatchId);
    });
    document.getElementById('coachMatchNewBtn')?.addEventListener('click', () => {
      document.querySelectorAll('#coachMatchCreate .js-cm-squad').forEach(el => { el.dataset.dirty = ''; });
      setCoachMatchCreateOpen(true);
      renderCoachUi();
    });
    document.getElementById('coachMatchCreateCancel')?.addEventListener('click', () => {
      setCoachMatchCreateOpen(false);
    });
    document.getElementById('coachMatchKindSelect')?.addEventListener('change', () => {
      syncCoachCompetitionField();
    });
    document.getElementById('coachKickoffH')?.addEventListener('change', () => syncCoachKickoffHidden());
    document.getElementById('coachKickoffM')?.addEventListener('change', () => syncCoachKickoffHidden());
    document.getElementById('coachMeetupH')?.addEventListener('change', () => syncCoachMeetupHidden());
    document.getElementById('coachMeetupM')?.addEventListener('change', () => syncCoachMeetupHidden());
    document.getElementById('coachFeeType')?.addEventListener('change', () => syncCoachFeeAmountWrap());
    document.getElementById('coachMatchBackBtn')?.addEventListener('click', () => {
      closeCoachMatchDetail();
    });
    document.getElementById('coachUpcomingMetaToggle')?.addEventListener('click', () => {
      const body = document.getElementById('coachUpcomingMetaBody');
      setUpcomingMetaOpen(!!(body && body.hidden));
    });
    document.getElementById('coachUpcomingSaveMeta')?.addEventListener('click', () => {
      onSaveUpcomingMeta();
    });
    document.getElementById('coachUpcomingKickoffH')?.addEventListener('change', () => syncUpcomingKickoffHidden());
    document.getElementById('coachUpcomingKickoffM')?.addEventListener('change', () => syncUpcomingKickoffHidden());
    document.getElementById('coachUpcomingMeetupH')?.addEventListener('change', () => syncUpcomingMeetupHidden());
    document.getElementById('coachUpcomingMeetupM')?.addEventListener('change', () => syncUpcomingMeetupHidden());
    document.getElementById('coachInviteAssistantBtn')?.addEventListener('click', () => {
      const session = global.CoachStore.getSession();
      if(!session) return;
      try{
        const row = global.CoachStore.inviteAssistant(
          session,
          document.getElementById('coachAssistantEmail')?.value || '',
          document.getElementById('coachAssistantName')?.value || ''
        );
        const emailEl = document.getElementById('coachAssistantEmail');
        const nameEl = document.getElementById('coachAssistantName');
        if(emailEl) emailEl.value = '';
        if(nameEl) nameEl.value = '';
        toast(tt('coachAssistantInvited', 'Assistant invited. Code: MC-{code}').replace('{code}', row.invite_code));
        renderCoachUi();
      }catch(e){
        const map = {
          bad_email: tt('coachErrEmail', 'Enter a valid email.'),
          owner_only: tt('coachErrOwnerOnly', 'Only the academy owner can manage assistants.'),
          assistant_limit: tt('coachErrAssistantLimit', 'Assistant limit is 2.'),
          exists: tt('coachErrAssistantExists', 'This assistant is already invited.')
        };
        toast(map[e.message] || tt('coachErrGeneric', 'Something went wrong.'));
      }
    });
    document.getElementById('coachClaimAssistantBtn')?.addEventListener('click', () => {
      const session = global.CoachStore.getSession();
      if(!session) return;
      try{
        global.CoachStore.claimAssistantInvite(session, document.getElementById('coachAssistantClaimCode')?.value || '');
        toast(tt('coachAssistantClaimed', 'Assistant access activated.'));
        renderCoachUi();
      }catch(e){
        const map = {
          bad_code: tt('coachErrAssistantCode', 'Invalid assistant code.'),
          email_mismatch: tt('coachErrAssistantEmail', 'Sign in with the invited email.'),
          assistant_limit: tt('coachErrAssistantLimit', 'Assistant limit is 2.')
        };
        toast(map[e.message] || tt('coachErrGeneric', 'Something went wrong.'));
      }
    });
    document.getElementById('coachCloudSyncBtn')?.addEventListener('click', async () => {
      if(!global.CoachCloud || !global.CoachCloud.ready || !global.CoachCloud.ready()){
        toast(tt('coachCloudOffline', 'Local mode. Add Supabase URL + key to enable cloud.'));
        return;
      }
      toast(tt('coachCloudSyncing', 'Syncing…'));
      const res = await global.CoachCloud.syncNow();
      toast(res && res.ok
        ? tt('coachCloudSynced', 'Cloud sync done.')
        : tt('coachCloudSyncFail', 'Cloud sync failed. Check keys and schema.'));
      renderCoachUi();
    });
    document.addEventListener('click', e => {
      const delAst = e.target.closest('[data-del-assistant]');
      if(delAst){
        const session = global.CoachStore.getSession();
        try{
          global.CoachStore.removeAssistant(session, delAst.dataset.delAssistant);
          toast(tt('coachAssistantRemoved', 'Assistant removed.'));
          renderCoachUi();
        }catch(err){
          toast(tt('coachErrGeneric', 'Something went wrong.'));
        }
        return;
      }
      const createBtn = e.target.closest('.js-cm-create');
      if(createBtn){
        onCreateMatch(createBtn);
        return;
      }
      const finishBtn = e.target.closest('.js-cm-finish');
      if(finishBtn){
        onFinishMatch();
        return;
      }
      const cancelMatchBtn = e.target.closest('.js-cm-cancel-match');
      if(cancelMatchBtn){
        onCancelMatch();
        return;
      }
      const closeMatchBtn = e.target.closest('.js-cm-close-match');
      if(closeMatchBtn){
        closeCoachMatchDetail();
        return;
      }
      const playedBackBtn = e.target.closest('.js-cm-played-back');
      if(playedBackBtn){
        closeCoachMatchDetail();
        return;
      }
      const editSquadBtn = e.target.closest('.js-cm-edit-squad');
      if(editSquadBtn){
        squadEditOpen = true;
        renderCoachUi();
        return;
      }
      const cancelSquadBtn = e.target.closest('.js-cm-cancel-squad');
      if(cancelSquadBtn){
        squadEditOpen = false;
        renderCoachUi();
        return;
      }
      const saveSquadBtn = e.target.closest('.js-cm-save-squad');
      if(saveSquadBtn){
        onSaveMatchSquad();
        return;
      }
      const suggestLink = e.target.closest('.js-cm-suggest-link');
      if(suggestLink){
        onLinkSuggestedGroup(suggestLink);
        return;
      }
      const suggestDismiss = e.target.closest('.js-cm-suggest-dismiss');
      if(suggestDismiss){
        const card = suggestDismiss.closest('.coach-match-suggest');
        if(card) card.remove();
        const box = document.getElementById('coachMatchSuggestions');
        if(box && !box.querySelector('.coach-match-suggest')) box.hidden = true;
        return;
      }
      const saveScoreBtn = e.target.closest('.js-cm-save-score');
      if(saveScoreBtn){
        onSaveMatchScore(saveScoreBtn);
        return;
      }
      const sendResultsBtn = e.target.closest('.js-cm-send-results');
      if(sendResultsBtn){
        shareMatchResults(global.CoachStore.getActiveMatchId());
        return;
      }
      const allBtn = e.target.closest('.js-cm-squad-all');
      if(allBtn){
        const editRoot = allBtn.closest('#coachMatchSquadEdit');
        const createRoot = allBtn.closest('#coachMatchCreate');
        const picker = editRoot?.querySelector('.js-cm-squad-edit')
          || createRoot?.querySelector('.js-cm-squad')
          || allBtn.closest('.coach-hero')?.querySelector('#coachMatchCreate .js-cm-squad');
        if(picker){
          picker.querySelectorAll('input[type="checkbox"]').forEach(el => { el.checked = true; });
          markSquadDirty(picker);
        }
        return;
      }
      const noneBtn = e.target.closest('.js-cm-squad-none');
      if(noneBtn){
        const editRoot = noneBtn.closest('#coachMatchSquadEdit');
        const createRoot = noneBtn.closest('#coachMatchCreate');
        const picker = editRoot?.querySelector('.js-cm-squad-edit')
          || createRoot?.querySelector('.js-cm-squad')
          || noneBtn.closest('.coach-hero')?.querySelector('#coachMatchCreate .js-cm-squad');
        if(picker){
          picker.querySelectorAll('input[type="checkbox"]').forEach(el => { el.checked = false; });
          markSquadDirty(picker);
        }
        return;
      }
      const matchBtn = e.target.closest('.js-cm-matches [data-match]');
      if(matchBtn){
        openCoachMatch(matchBtn.dataset.match);
        return;
      }
      const histMatch = e.target.closest('#coachHistoryList [data-open-match]');
      if(histMatch){
        openCoachHistoryMatch(histMatch.dataset.openMatch);
        return;
      }
      const histFilter = e.target.closest('#coachHistoryFilter [data-coach-hist]');
      if(histFilter){
        coachHistFilter = histFilter.dataset.coachHist || 'all';
        closeCoachHistoryMatch();
        renderCoachUi();
        return;
      }
      const histKind = e.target.closest('#coachHistoryKindFilter [data-coach-hist-kind]');
      if(histKind){
        coachHistKindFilter = histKind.dataset.coachHistKind || 'all';
        closeCoachHistoryMatch();
        renderCoachUi();
        return;
      }
      const sharePlayerCard = e.target.closest('[data-share-player-card]');
      if(sharePlayerCard){
        shareCoachPlayerCard(sharePlayerCard.dataset.match, sharePlayerCard.dataset.sharePlayerCard);
        return;
      }
      const statsPlayer = e.target.closest('#coachStatsBoard [data-open-player]');
      if(statsPlayer){
        openCoachPlayerSheet(statsPlayer.dataset.openPlayer, {viewRatings: true, returnTo: 'stats'});
        return;
      }
      const rateBtn = e.target.closest('[data-rate-player]');
      if(rateBtn){
        openCoachQuickRate(rateBtn.dataset.match, rateBtn.dataset.ratePlayer);
        return;
      }
    });
    document.addEventListener('change', e => {
      const box = e.target.closest('.js-cm-squad input[type="checkbox"], .js-cm-squad-edit input[type="checkbox"]');
      if(!box) return;
      markSquadDirty(box.closest('.js-cm-squad-edit') || box.closest('.js-cm-squad'));
    });
    const pickTeam = (root, closeAfter) => {
      root?.addEventListener('click', e => {
        const menu = e.target.closest('[data-team-menu]');
        if(menu){
          e.preventDefault();
          openTeamMenu(menu.dataset.teamMenu);
          return;
        }
        const btn = e.target.closest('[data-team]');
        if(!btn) return;
        global.CoachStore.setActiveTeamId(btn.dataset.team);
        setPlayerFormOpen(false);
        renderCoachUi();
        if(closeAfter) closeCoachSettings();
      });
    };
    pickTeam(document.getElementById('coachTeamList'), false);
    document.getElementById('coachPlayerList')?.addEventListener('click', e => {
      const open = e.target.closest('[data-open-player]');
      if(open){
        openCoachPlayerSheet(open.dataset.openPlayer);
      }
    });
    document.getElementById('coachMatchTab')?.addEventListener('click', e => {
      if(e.target.closest('[data-rate-player]')) return;
      const open = e.target.closest('[data-open-player]');
      if(open){
        openCoachPlayerSheet(open.dataset.openPlayer);
      }
    });
    document.getElementById('coachHistoryTab')?.addEventListener('click', e => {
      if(e.target.closest('[data-rate-player]') || e.target.closest('[data-share-player-card]')) return;
      const open = e.target.closest('[data-open-player]');
      if(open){
        openCoachPlayerSheet(open.dataset.openPlayer);
      }
    });
    document.getElementById('coachPlayerBack')?.addEventListener('click', () => closeCoachPlayerSheet());
    document.getElementById('coachPlayerBody')?.addEventListener('click', e => {
      if(e.target.closest('#coachPlayerCloseBtn')){
        closeCoachPlayerSheet();
        return;
      }
      if(e.target.closest('#coachToggleEditPlayerBtn') && detailPlayerId){
        detailEditOpen = !detailEditOpen;
        openCoachPlayerSheet(detailPlayerId, {editOpen: detailEditOpen});
        return;
      }
      if(e.target.closest('#coachCancelEditPlayerBtn') && detailPlayerId){
        detailEditOpen = false;
        openCoachPlayerSheet(detailPlayerId, {editOpen: false});
        return;
      }
      if(e.target.closest('#coachSavePlayerBtn') && detailPlayerId){
        saveCoachPlayerFromSheet();
        return;
      }
      if(e.target.closest('#coachSavePrivateNotesBtn') && detailPlayerId){
        saveCoachPrivateNotes();
        return;
      }
      if(e.target.closest('#coachOpenChildPageBtn') && detailPlayerId){
        openCoachChildPlayerPage(detailPlayerId);
        return;
      }
      if(e.target.closest('#coachMessagePlayerBtn') && detailPlayerId){
        if(typeof global.openPlayerCoachChat === 'function') global.openPlayerCoachChat(detailPlayerId);
        return;
      }
      if(e.target.closest('#coachRemovePlayerBtn') && detailPlayerId){
        removeCoachPlayerFromSheet();
        return;
      }
      if(e.target.closest('#coachAddParentBtn') && detailPlayerId){
        openCoachParentInviteSheet(detailPlayerId);
      }
    });
    document.getElementById('coachParentInviteBack')?.addEventListener('click', () => closeCoachParentInviteSheet());
    document.getElementById('coachParentInviteCloseBtn')?.addEventListener('click', () => closeCoachParentInviteSheet());
    document.getElementById('coachParentInviteEmailBtn')?.addEventListener('click', () => sendParentInviteEmailTest());
    document.getElementById('coachParentInviteShareBtn')?.addEventListener('click', () => { shareParentInvite(); });
    document.getElementById('coachParentInviteCopyBtn')?.addEventListener('click', async () => {
      const linkEl = document.getElementById('coachParentInviteLink');
      const val = linkEl && linkEl.value;
      if(!val) return;
      try{
        await navigator.clipboard.writeText(val);
        toast(tt('coachParentCopied', 'Invite copied.'));
      }catch(e){
        toast(tt('coachErrGeneric', 'Something went wrong.'));
      }
    });
    document.getElementById('coachRateMinus')?.addEventListener('click', () => {
      if(!quickRate) return;
      quickRate.rating = clampQuickScore(quickRate.rating - 0.1);
      syncQuickScoreUi();
    });
    document.getElementById('coachRatePlus')?.addEventListener('click', () => {
      if(!quickRate) return;
      quickRate.rating = clampQuickScore(quickRate.rating + 0.1);
      syncQuickScoreUi();
    });
    document.getElementById('coachRateMoments')?.addEventListener('click', e => {
      const btn = e.target.closest('[data-mom-delta]');
      const row = e.target.closest('[data-key]');
      if(!btn || !row || !quickRate) return;
      const key = row.dataset.key;
      const d = Number(btn.dataset.momDelta) || 0;
      const next = Math.max(0, Math.min(30, (Number(quickRate.counts[key]) || 0) + d));
      quickRate.counts[key] = next;
      renderQuickMoments();
    });
    document.getElementById('coachRateSaveBtn')?.addEventListener('click', () => { saveCoachQuickRate(); });
    document.getElementById('coachRateCancelBtn')?.addEventListener('click', () => { closeCoachQuickRate(); });
    document.getElementById('coachRateBack')?.addEventListener('click', () => { closeCoachQuickRate(); });
  }

  global.renderCoachUi = renderCoachUi;
  global.bindCoachUi = bindCoachUi;
  global.openCoachQuickRate = openCoachQuickRate;
  global.closeCoachQuickRate = closeCoachQuickRate;
  global.closeCoachPlayerSheet = closeCoachPlayerSheet;
  global.closeAllCoachOverlays = closeAllCoachOverlays;
  global.closeCoachParentInviteSheet = closeCoachParentInviteSheet;
  global.closeCoachSettings = closeCoachSettings;
  global.openCoachSettings = openCoachSettings;
  global.closeTeamMenu = closeTeamMenu;
  global.closeCoachHistoryMatch = closeCoachHistoryMatch;
  global.openCoachChildPlayerPage = openCoachChildPlayerPage;
  global.resolveCoachPlayerPhoto = resolveCoachPlayerPhoto;
  global.syncCoachPlayerPhotosFromPersonal = syncCoachPlayerPhotosFromPersonal;
})(window);

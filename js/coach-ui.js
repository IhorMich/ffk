/* Matchcard Coach UI — Phase 1+2: academy, teams, roster, matches, analytics.
   Separate from Personal Free/Pro. */
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
      go('new');
      renderCoachUi();
      setTimeout(() => scrollCoachEl('coachMatchTab'), 60);
      return;
    }
    if(kind === 'ratings'){
      go('stats');
      renderCoachUi();
      setTimeout(() => scrollCoachEl('coachStatsTab'), 60);
      return;
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
      closeCoachSettings();
      closeTeamMenu();
      return;
    }
    if(createBox) createBox.hidden = true;
    if(home) home.hidden = false;

    const nameEl = document.getElementById('coachAcademyName');
    if(nameEl) nameEl.textContent = academy.name;

    const teams = store.listTeams(session, academy.id);
    const profileEmail = document.getElementById('coachProfileEmail');
    const profileStats = document.getElementById('coachProfileStats');
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
      matches += ms.length;
      ms.forEach(m => {
        ratings += store.listRatings(session, m.id).length;
      });
    });
    if(profileStats){
      profileStats.innerHTML = coachJumpStatsHtml(teams.length, players, matches, ratings);
    }
    const homeStats = document.getElementById('coachHomeStats');
    if(homeStats){
      homeStats.hidden = false;
      homeStats.innerHTML = coachJumpStatsHtml(teams.length, players, matches, ratings);
    }

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
    const settingsList = document.getElementById('coachSettingsTeamList');
    if(settingsList) settingsList.innerHTML = teamListHtml;

    const addBtn = document.getElementById('coachAddTeamBtn');
    if(addBtn){
      addBtn.hidden = !canAddTeam;
      const maxTeams = typeof COACH_MAX_TEAMS === 'number' ? COACH_MAX_TEAMS : 10;
      addBtn.disabled = teams.length >= maxTeams;
    }
    if(!canAddTeam) setHomeCreateTeamOpen(false);
    const settingsCreateBtn = document.getElementById('coachCreateTeamBtn');
    if(settingsCreateBtn){
      settingsCreateBtn.hidden = !canAddTeam;
      const maxTeams = typeof COACH_MAX_TEAMS === 'number' ? COACH_MAX_TEAMS : 10;
      settingsCreateBtn.disabled = teams.length >= maxTeams;
    }

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
    if(!sheet) return;
    const store = global.CoachStore;
    const session = store && store.getSession();
    if(session) renderWorkspace(session);
    if(typeof refreshCoachMediaUi === 'function') refreshCoachMediaUi();
    sheet.hidden = false;
    if(back) back.hidden = false;
    if(typeof pushAppState === 'function') pushAppState('layer');
  }
  function closeCoachSettings(){
    const sheet = document.getElementById('coachSettingsSheet');
    const back = document.getElementById('coachSettingsBack');
    if(sheet) sheet.hidden = true;
    if(back) back.hidden = true;
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
    const code = document.getElementById('coachTeamCode');
    if(title) title.textContent = team.name + (team.age_group ? ` · ${team.age_group}` : '');
    if(code) code.textContent = team.invite_code || '—';
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
      return `<div class="coach-player-row">
        <button type="button" class="coach-player-main coach-player-open" data-open-player="${esc(p.id)}">
          <b>${esc(label)}</b>
          ${meta ? `<span>${esc(meta)}</span>` : ''}
        </button>
      </div>`;
    }).join('');
  }

  function playerLabel(p){
    return [p.first_name, p.last_name].filter(Boolean).join(' ');
  }
  function selectedSquadFrom(scope){
    const root = scope && scope.classList && scope.classList.contains('js-cm-squad')
      ? scope
      : (scope && scope.querySelector ? (scope.querySelector('.js-cm-squad') || scope) : document);
    return [...root.querySelectorAll('input[type="checkbox"]:checked')]
      .map(el => el.value)
      .filter(Boolean);
  }
  function setSquadChecks(root, ids){
    const want = new Set((ids || []).map(String));
    (root || document).querySelectorAll('.js-cm-squad input[type="checkbox"]').forEach(el => {
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
          `${squadN} ${tt('coachSquadShort', 'played')}`,
          opts.showAddress && m.address ? m.address : ''
        ].filter(Boolean).join(' · ');
    const attr = opts.openAttr || 'data-match';
    return `<button type="button" class="coach-team-item coach-match-item ${badgeCls}${on}" ${attr}="${esc(m.id)}">
      <span class="coach-match-row-top">
        <span class="coach-team-name">${esc(m.date)} · ${esc(m.opponent)}</span>
        <span class="coach-match-badge ${badgeCls}">${badgeInner}</span>
      </span>
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
      const upcoming = sortMatchesForList(matches).filter(m => !matchIsPlayed(m));
      if(!upcoming.length){
        return `<div class="inbox-empty coach-tab-empty">${esc(tt('coachMatchEmptyUpcoming', 'No upcoming matches'))}</div>`;
      }
      return upcoming.map(m => matchListRowHtml(m, {activeId: activeMatchId})).join('');
    })();
    document.querySelectorAll('.js-cm-matches').forEach(el => { el.innerHTML = matchListHtml; });

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
      return;
    }

    if(detail) detail.hidden = false;
    const played = matchIsPlayed(activeMatch);
    if(upcomingBox) upcomingBox.hidden = played;
    if(playedBox) playedBox.hidden = !played;

    if(summary){
      const outcome = matchOutcome(activeMatch);
      const outcomeLab = matchOutcomeLabel(outcome);
      const bits = [
        activeMatch.date,
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
      if(store.syncInviteReadStatuses) store.syncInviteReadStatuses(session, activeMatch.id);
      renderInviteBox(session, activeMatch);
      document.querySelectorAll('.js-cm-squad-save').forEach(btn => { btn.hidden = true; });
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
            <div class="coach-player-main">
              <b>${esc(label)}</b>
              <span>${note}</span>
            </div>
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

  function renderInviteBox(session, match){
    document.querySelectorAll('.js-cm-invite-box').forEach(box => {
      if(!match){
        box.hidden = true;
        box.innerHTML = '';
        return;
      }
      const store = global.CoachStore;
      const invites = store.listInvites(session, match.id);
      const players = store.listMatchPlayers(session, match);
      const delivered = invites.filter(i => i.status === 'delivered' || i.status === 'read' || i.status === 'sent').length;
      const waiting = invites.filter(i => i.status === 'waiting_parent').length;
      const read = invites.filter(i => i.status === 'read').length;
      const rows = players.map(p => {
        const inv = invites.find(i => i.team_player_id === p.id);
        let st = tt('coachInvitePending', 'Invite pending');
        let cls = 'pending';
        if(inv){
          if(inv.status === 'read'){ st = tt('coachInviteRead', 'Read in app'); cls = 'read'; }
          else if(inv.status === 'delivered' || inv.status === 'sent'){ st = tt('coachInviteInApp', 'In app'); cls = 'ok'; }
          else if(inv.status === 'waiting_parent'){ st = tt('coachInviteWaitingParent', 'Waiting for parent'); cls = 'wait'; }
        }
        return `<div class="coach-invite-row">
          <span>${esc(playerLabel(p))}</span>
          <b class="coach-invite-st ${cls}">${esc(st)}</b>
        </div>`;
      }).join('');
      box.hidden = false;
      box.innerHTML = `<div class="coach-invite-card">
        <b>${esc(tt('coachInviteTitle', 'Match invitations'))}</b>
        <p class="hint">${esc(tt('coachInviteStatusApp', '{inApp} in app · {waiting} waiting for parent · {read} read')
          .replace('{inApp}', String(delivered))
          .replace('{waiting}', String(waiting))
          .replace('{read}', String(read)))}</p>
        ${match.address ? `<p class="hint">${esc(match.address)}</p>` : ''}
        <div class="coach-invite-rows">${rows}</div>
      </div>`;
    });
  }

  let coachHistFilter = 'all';

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
    // History = played matches only (upcoming live on Match tab).
    let matches = store.listMatches(session, team.id).filter(m => matchIsPlayed(m));
    document.querySelectorAll('#coachHistoryFilter [data-coach-hist]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.coachHist === coachHistFilter);
    });
    if(coachHistFilter === 'win' || coachHistFilter === 'draw' || coachHistFilter === 'loss'){
      matches = matches.filter(m => matchOutcome(m) === coachHistFilter);
    }
    if(!matches.length){
      el.innerHTML = `<div class="inbox-empty coach-tab-empty">${esc(tt('coachHistoryEmpty', 'No played matches yet'))}</div>`;
      return;
    }
    const sorted = sortMatchesForList(matches);
    el.innerHTML = sorted.map(m => matchListRowHtml(m, {
      openAttr: 'data-open-match',
      showAddress: true
    })).join('');
  }

  function renderAnalyticsPane(session, team){
    const store = global.CoachStore;
    const a = store.teamAnalytics(session, team.id);
    const avg = fmtScore(a.avg);
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
    const playersHtml = a.players.length
      ? `<div class="coach-player-list">${a.players.map(p => {
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
    const html = `
      <div class="coach-analytics-sum coach-analytics-sum-4">
        <div><b>${a.played || a.matches}</b><span>${esc(tt('coachStatMatches', 'Matches'))}</span></div>
        <div><b>${a.ratings}</b><span>${esc(tt('coachStatRatings', 'Ratings'))}</span></div>
        <div><b>${esc(avg)}</b><span>${esc(tt('coachStatAvg', 'Team avg'))}</span></div>
        <div><b>${esc(fmtScore(a.best))}</b><span>${esc(tt('coachStatBest', 'Best'))}</span></div>
      </div>
      ${band}
      ${momentsBlock}
      <div class="coach-stat-section">
        <div class="pro-kicker">${esc(tt('coachPlayersStatsKicker', 'Players'))}</div>
        ${playersHtml}
      </div>
    `;
    const statsBoard = document.getElementById('coachStatsBoard');
    if(statsBoard) statsBoard.innerHTML = html;
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
  function onCreateTeam(fromHome){
    const session = global.CoachStore.getSession();
    const academy = global.CoachStore.myAcademy(session);
    if(!academy) return;
    const nameEl = document.getElementById(fromHome ? 'coachHomeTeamInput' : 'coachTeamInput');
    const ageEl = document.getElementById(fromHome ? 'coachHomeTeamAgeInput' : 'coachTeamAgeInput');
    const name = nameEl?.value || '';
    const age = ageEl?.value || '';
    try{
      const team = global.CoachStore.createTeam(session, academy.id, name, age);
      global.CoachStore.setActiveTeamId(team.id);
      if(nameEl) nameEl.value = '';
      if(ageEl) ageEl.value = '';
      // Keep settings form in sync when creating from home.
      const otherName = document.getElementById(fromHome ? 'coachTeamInput' : 'coachHomeTeamInput');
      const otherAge = document.getElementById(fromHome ? 'coachTeamAgeInput' : 'coachHomeTeamAgeInput');
      if(otherName) otherName.value = '';
      if(otherAge) otherAge.value = '';
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
      global.CoachStore.addPlayer(session, teamId, {
        first_name: first,
        last_name: last,
        number,
        contact,
        position
      });
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
    const sheet = document.getElementById('coachTeamMenuSheet');
    const back = document.getElementById('coachTeamMenuBack');
    if(sheet) sheet.hidden = false;
    if(back) back.hidden = false;
    if(typeof pushAppState === 'function') pushAppState('layer');
  }
  function closeTeamMenu(){
    teamMenuId = '';
    const sheet = document.getElementById('coachTeamMenuSheet');
    const back = document.getElementById('coachTeamMenuBack');
    if(sheet) sheet.hidden = true;
    if(back) back.hidden = true;
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

  async function copyTeamCode(){
    const code = document.getElementById('coachTeamCode')?.textContent?.trim() || '';
    if(!code || code === '—') return;
    try{
      await navigator.clipboard.writeText(code);
      toast(tt('coachCodeCopied', 'Code copied.'));
    }catch(e){
      toast(tt('coachErrGeneric', 'Something went wrong.'));
    }
  }
  async function shareTeamCode(){
    const store = global.CoachStore;
    const session = store.getSession();
    const team = store.getTeam(session, store.getActiveTeamId());
    if(!team || !team.invite_code) return;
    const title = tt('coachShareCodeTitle', 'Team code');
    const text = tt('coachShareCodeText', '{team}: {code}')
      .replace('{team}', team.name || '')
      .replace('{code}', team.invite_code);
    try{
      const C = global.Capacitor;
      const Share = C && C.Plugins && C.Plugins.Share;
      if(Share && typeof Share.share === 'function'){
        await Share.share({title, text, dialogTitle: title});
        return;
      }
    }catch(e){}
    try{
      if(navigator.share){
        await navigator.share({title, text});
        return;
      }
    }catch(e){}
    try{
      await navigator.clipboard.writeText(text);
      toast(tt('coachCodeCopied', 'Code copied.'));
    }catch(e){
      toast(tt('coachErrGeneric', 'Something went wrong.'));
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
  function onFinishMatch(){
    const store = global.CoachStore;
    const session = store.getSession();
    const matchId = store.getActiveMatchId();
    if(!session || !matchId) return;
    try{
      store.finishMatch(session, matchId, '');
      toast(tt('coachMatchFinished', 'Match marked as played. Set the score and rate players.'));
      renderCoachUi();
      try{
        document.getElementById('coachMatchPlayedBox')?.scrollIntoView({behavior:'smooth', block:'start'});
      }catch(e){}
    }catch(e){
      toast(tt('coachErrGeneric', 'Something went wrong.'));
    }
  }
  function closeCoachMatchDetail(){
    const store = global.CoachStore;
    if(store && store.setActiveMatchId) store.setActiveMatchId('');
    setCoachMatchCreateOpen(false);
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
      store.setActiveMatchId('');
      toast(tt('coachMatchScoreSaved', 'Score saved.'));
      renderCoachUi();
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
  async function shareMatchInvites(matchId){
    const store = global.CoachStore;
    const session = store.getSession();
    if(!session || !matchId) return false;
    try{
      const result = store.deliverMatchInvites(session, matchId, {forceUnread: true});
      const delivered = result.delivered || 0;
      const waiting = result.waiting || 0;
      if(delivered && waiting){
        toast(tt('coachInvitesMixed', '{n} in app, {w} waiting for parent link')
          .replace('{n}', String(delivered))
          .replace('{w}', String(waiting)));
      }else if(delivered){
        toast(tt('coachInvitesInApp', 'Invitations delivered in the app.'));
      }else if(waiting){
        toast(tt('coachInvitesWaiting', 'Invites queued. Link a parent to each player to deliver in-app.'));
      }else{
        toast(tt('coachInvitesInApp', 'Invitations delivered in the app.'));
      }
      renderCoachUi();
      if(typeof renderParentUi === 'function') renderParentUi();
      return true;
    }catch(e){
      toast(tt('coachErrGeneric', 'Something went wrong.'));
      return false;
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
    let squad = selectedSquadFrom(root);
    const picker = root.querySelector('.js-cm-squad');
    if(!squad.length && picker?.dataset.dirty !== '1'){
      const players = global.CoachStore.listPlayers(session, teamId);
      squad = players.map(p => p.id);
    }
    if(!squad.length){
      toast(tt('coachErrSquad', 'Select at least one player who plays.'));
      return;
    }
    try{
      const match = global.CoachStore.createMatch(session, teamId, {
        opponent,
        address,
        date,
        score: '',
        squad,
        status: 'upcoming'
      });
      root.querySelectorAll('.js-cm-opponent').forEach(el => { el.value = ''; });
      root.querySelectorAll('.js-cm-address').forEach(el => { el.value = ''; });
      document.querySelectorAll('.js-cm-squad').forEach(el => { el.dataset.dirty = ''; });
      toast(tt('coachMatchCreated', 'Match created.'));
      setCoachMatchCreateOpen(false);
      renderCoachUi();
      if(typeof showView === 'function') showView('new');
      await shareMatchInvites(match.id);
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
  function onSaveSquad(fromEl){
    const session = global.CoachStore.getSession();
    const root = fromEl?.closest('.coach-hero') || fromEl?.closest('#coachMatchTab') || document;
    const picker = root.querySelector('.js-cm-squad');
    const matchId = picker?.dataset.match || global.CoachStore.getActiveMatchId();
    if(!matchId){
      toast(tt('coachPickMatch', 'Create or pick a match, then rate players.'));
      return;
    }
    try{
      global.CoachStore.setMatchSquad(session, matchId, selectedSquadFrom(picker || root));
      if(picker) picker.dataset.dirty = '';
      toast(tt('coachSquadSaved', 'Squad saved.'));
      renderCoachUi();
    }catch(e){
      toast(e.message === 'squad'
        ? tt('coachErrSquad', 'Select at least one player who plays.')
        : tt('coachErrGeneric', 'Could not update squad.'));
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
    box.innerHTML = keys.map(key => {
      const n = Number(quickRate.counts[key]) || 0;
      const lab = typeof metricLabel === 'function' ? metricLabel(key) : key;
      return `<div class="coach-moment" data-key="${esc(key)}">
        <b>${esc(lab)}</b>
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
    if(sheet) sheet.hidden = false;
    if(back) back.hidden = false;
    const nameEl = document.getElementById('coachRateName');
    const metaEl = document.getElementById('coachRateMeta');
    const commentEl = document.getElementById('coachRateComment');
    if(nameEl) nameEl.textContent = quickRate.playerName;
    if(metaEl){
      const posLab = typeof pitchPosLabelShort === 'function' ? pitchPosLabelShort(pitchPos) : pitchPos;
      metaEl.textContent = `${quickRate.date} · ${quickRate.opponent}${quickRate.score ? ` · ${quickRate.score}` : ''} · ${posLab}`;
    }
    if(commentEl) commentEl.value = quickRate.comment;
    syncQuickScoreUi();
    renderQuickMoments();
    if(typeof pushAppState === 'function') pushAppState('layer');
  }
  function closeCoachQuickRate(){
    quickRate = null;
    const sheet = document.getElementById('coachRateSheet');
    const back = document.getElementById('coachRateBack');
    if(sheet) sheet.hidden = true;
    if(back) back.hidden = true;
  }

  let detailPlayerId = '';
  let detailEditOpen = false;
  let parentInviteRow = null;

  function closeCoachPlayerSheet(){
    detailPlayerId = '';
    detailEditOpen = false;
    const sheet = document.getElementById('coachPlayerSheet');
    const back = document.getElementById('coachPlayerBack');
    if(sheet) sheet.hidden = true;
    if(back) back.hidden = true;
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
      openCoachChildPlayerPage(playerId);
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
    const posLab = p.position && typeof pitchPosLabelShort === 'function'
      ? pitchPosLabelShort(p.position)
      : (p.position || '');
    const metaBits = [
      p.number ? `#${p.number}` : '',
      posLab,
      detail.team && detail.team.name,
      detail.academy && detail.academy.name
    ].filter(Boolean).join(' · ');
    const ratingsHtml = detail.ratings.length
      ? detail.ratings.slice(0, 12).map(r => {
          const head = [r.date, r.opponent, r.score].filter(Boolean).join(' · ');
          const c = r.counts && typeof r.counts === 'object' ? r.counts : {};
          const mom = Object.keys(c)
            .filter(k => Number(c[k]) > 0)
            .sort((a, b) => Number(c[b]) - Number(c[a]))
            .slice(0, 3)
            .map(k => `${metricLab(k)} ${c[k]}`)
            .join(' · ');
          return `<div class="coach-player-row">
            <div class="coach-player-main">
              <b>${esc(head)}</b>
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
    body.innerHTML = `
      <div class="sheet-grab" aria-hidden="true"><span></span></div>
      <div class="pro-kicker">${esc(tt('coachPlayerDetailKicker', 'Player'))}</div>
      <h3 class="coach-rate-name" id="coachPlayerSheetTitle">${esc(label)}</h3>
      <p class="hint">${esc(metaBits)}</p>
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
      ${detail.topMoments && detail.topMoments.length ? `<div class="coach-stat-section"><div class="pro-kicker">${esc(tt('coachPlayerMomentsKicker', 'Key moments'))}</div>${momentsHtml(detail.topMoments)}</div>` : ''}
      <div class="pro-kicker">${esc(tt('coachPlayerRatingsKicker', 'Recent ratings'))}</div>
      <div class="coach-player-list">${ratingsHtml}</div>
      <div class="coach-player-sheet-actions">
        <button type="button" class="save-btn" id="coachOpenChildPageBtn">${esc(tt('coachOpenChildPage', 'Open player page'))}</button>
        <button type="button" class="ghost-btn" id="coachToggleEditPlayerBtn">${esc(detailEditOpen ? tt('coachHideEditPlayer', 'Hide edit') : tt('coachEditPlayerBtn', 'Edit player'))}</button>
        <button type="button" class="ghost-btn" id="coachAddParentBtn">${esc(tt('coachAddParentBtn', 'Add parent / guardian'))}</button>
        <button type="button" class="ghost-btn coach-remove-player" id="coachRemovePlayerBtn">${esc(tt('coachRemovePlayer', 'Remove player'))}</button>
        <button type="button" class="ghost-btn" id="coachPlayerCloseBtn">${esc(tt('previewCancel', 'Close'))}</button>
      </div>
      ${editBlock}
    `;
    if(detailEditOpen){
      const posSel = document.getElementById('coachEditPos');
      if(posSel && typeof fillPitchSelect === 'function'){
        fillPitchSelect(posSel, p.position || 'RW', true);
      }
    }
    sheet.hidden = false;
    if(back) back.hidden = false;
    if(typeof pushAppState === 'function') pushAppState('layer');
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

  function openCoachChildPlayerPage(playerId){
    const store = global.CoachStore;
    const session = store && store.getSession();
    const detail = session && store.playerDetail(session, playerId);
    if(!detail){
      toast(tt('coachErrGeneric', 'Something went wrong.'));
      return;
    }
    const parentStats = global.ParentStatsStore
      ? global.ParentStatsStore.listForPlayer(playerId)
      : [];
    const parentAvg = global.ParentStatsStore
      ? global.ParentStatsStore.avgForPlayer(playerId)
      : null;
    global.coachChildView = {
      playerId,
      player: detail.player,
      team: detail.team,
      academy: detail.academy,
      coachRatings: detail.ratings || [],
      coachAvg: detail.avg,
      coachGames: detail.games,
      parentStats,
      parentAvg
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
    const sheet = document.getElementById('coachParentInviteSheet');
    const back = document.getElementById('coachParentInviteBack');
    if(sheet) sheet.hidden = true;
    if(back) back.hidden = true;
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
    const p = invite.payload;
    const child = [p.player.fn, p.player.ln].filter(Boolean).join(' ');
    if(nameEl) nameEl.textContent = child;
    if(metaEl){
      metaEl.textContent = [
        p.a && p.a.name,
        p.tm && p.tm.name,
        p.tm && p.tm.age_group
      ].filter(Boolean).join(' · ');
    }
    const deep = global.ParentStore ? global.ParentStore.buildLink(p) : '';
    if(linkEl) linkEl.value = deep;
    if(codeEl) codeEl.textContent = `MC-${invite.code}`;
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
    if(sheet) sheet.hidden = false;
    if(back) back.hidden = false;
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

  function saveCoachQuickRate(){
    if(!quickRate) return;
    const store = global.CoachStore;
    const session = store.getSession();
    if(!session) return;
    const comment = document.getElementById('coachRateComment')?.value || '';
    const minutes = 60;
    const matchLen = 60;
    const format = '2x30';
    const behaviors = (typeof emptyForm === 'function') ? emptyForm().behaviors : {};
    const action = (typeof actionScore === 'function')
      ? actionScore(quickRate.counts, quickRate.position, minutes, matchLen)
      : quickRate.rating;
    store.upsertRating(session, {
      match_id: quickRate.matchId,
      team_player_id: quickRate.teamPlayerId,
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
      score: quickRate.score || store.getMatch(session, quickRate.matchId)?.score || ''
    });
    // Ensure match is in played state once ratings start
    try{
      const m = store.getMatch(session, quickRate.matchId);
      if(m && !matchIsPlayed(m)){
        store.finishMatch(session, quickRate.matchId, m.score || '');
      }
    }catch(e){}
    closeCoachQuickRate();
    toast(tt('coachRatingSaved', 'Player rating saved to Coach.'));
    renderCoachUi();
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
    document.getElementById('coachCreateTeamBtn')?.addEventListener('click', () => { onCreateTeam(false); });
    document.getElementById('coachAddTeamBtn')?.addEventListener('click', () => {
      const box = document.getElementById('coachHomeCreateTeam');
      setHomeCreateTeamOpen(!!(box && box.hidden));
    });
    document.getElementById('coachHomeCreateTeamBtn')?.addEventListener('click', () => { onCreateTeam(true); });
    document.getElementById('coachHomeCreateTeamCancel')?.addEventListener('click', () => { setHomeCreateTeamOpen(false); });
    document.getElementById('coachShowAddPlayerBtn')?.addEventListener('click', () => { setPlayerFormOpen(true); });
    document.getElementById('coachAddPlayerCancel')?.addEventListener('click', () => { setPlayerFormOpen(false); });
    document.getElementById('coachAddPlayerBtn')?.addEventListener('click', () => { onAddPlayer(); });
    document.getElementById('coachCopyCodeBtn')?.addEventListener('click', () => { copyTeamCode(); });
    document.getElementById('coachShareCodeBtn')?.addEventListener('click', () => { shareTeamCode(); });
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
    document.getElementById('coachProfileStats')?.addEventListener('click', e => {
      const btn = e.target.closest('[data-coach-jump]');
      if(btn) jumpCoachStat(btn.dataset.coachJump);
    });
    document.getElementById('coachSettingsBack')?.addEventListener('click', () => closeCoachSettings());
    document.getElementById('coachSettingsCloseBtn')?.addEventListener('click', () => closeCoachSettings());
    document.getElementById('coachOpenAppSettingsBtn')?.addEventListener('click', () => {
      closeCoachSettings();
      document.getElementById('s-lang').value = settings.lang;
      if(typeof refreshBackupBanner === 'function') refreshBackupBanner();
      if(typeof showView === 'function') showView('settings');
    });
    document.getElementById('coachMatchNewBtn')?.addEventListener('click', () => {
      setCoachMatchCreateOpen(true);
      document.querySelectorAll('#coachMatchCreate .js-cm-squad').forEach(el => { el.dataset.dirty = ''; });
      renderCoachUi();
      setCoachMatchCreateOpen(true);
      document.querySelector('#coachMatchCreate .js-cm-opponent')?.focus();
    });
    document.getElementById('coachMatchCreateCancel')?.addEventListener('click', () => {
      setCoachMatchCreateOpen(false);
    });
    document.getElementById('coachMatchBackBtn')?.addEventListener('click', () => {
      closeCoachMatchDetail();
    });
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
      const saveSquadBtn = e.target.closest('.js-cm-squad-save');
      if(saveSquadBtn){
        onSaveSquad(saveSquadBtn);
        return;
      }
      const inviteAgain = e.target.closest('.js-cm-invite-again');
      if(inviteAgain){
        const matchId = global.CoachStore.getActiveMatchId();
        shareMatchInvites(matchId);
        return;
      }
      const finishBtn = e.target.closest('.js-cm-finish');
      if(finishBtn){
        onFinishMatch();
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
        const root = allBtn.closest('.coach-hero') || allBtn.closest('#coachMatchTab') || document;
        const picker = root.querySelector('.js-cm-squad');
        root.querySelectorAll('.js-cm-squad input[type="checkbox"]').forEach(el => { el.checked = true; });
        markSquadDirty(picker);
        return;
      }
      const noneBtn = e.target.closest('.js-cm-squad-none');
      if(noneBtn){
        const root = noneBtn.closest('.coach-hero') || noneBtn.closest('#coachMatchTab') || document;
        const picker = root.querySelector('.js-cm-squad');
        root.querySelectorAll('.js-cm-squad input[type="checkbox"]').forEach(el => { el.checked = false; });
        markSquadDirty(picker);
        return;
      }
      const matchBtn = e.target.closest('.js-cm-matches [data-match]');
      if(matchBtn){
        openCoachMatch(matchBtn.dataset.match);
        return;
      }
      const histMatch = e.target.closest('#coachHistoryList [data-open-match]');
      if(histMatch){
        openCoachMatch(histMatch.dataset.openMatch);
        return;
      }
      const histFilter = e.target.closest('#coachHistoryFilter [data-coach-hist]');
      if(histFilter){
        coachHistFilter = histFilter.dataset.coachHist || 'all';
        renderCoachUi();
        return;
      }
      const statsPlayer = e.target.closest('#coachStatsBoard [data-open-player]');
      if(statsPlayer){
        openCoachPlayerSheet(statsPlayer.dataset.openPlayer, {viewRatings: true});
        return;
      }
      const rateBtn = e.target.closest('.js-cm-rates [data-rate-player]');
      if(rateBtn){
        openCoachQuickRate(rateBtn.dataset.match, rateBtn.dataset.ratePlayer);
      }
    });
    document.addEventListener('change', e => {
      const box = e.target.closest('.js-cm-squad input[type="checkbox"]');
      if(!box) return;
      // Manual ticks only — no auto-save / no forced re-check.
      markSquadDirty(box.closest('.js-cm-squad'));
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
    pickTeam(document.getElementById('coachSettingsTeamList'), true);
    document.getElementById('coachPlayerList')?.addEventListener('click', e => {
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
      if(e.target.closest('#coachOpenChildPageBtn') && detailPlayerId){
        openCoachChildPlayerPage(detailPlayerId);
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
  global.openCoachChildPlayerPage = openCoachChildPlayerPage;
})(window);

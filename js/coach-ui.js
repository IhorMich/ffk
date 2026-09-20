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

  function renderWorkspace(session){
    const store = global.CoachStore;
    const academy = store.myAcademy(session);
    const createBox = document.getElementById('coachCreateAcademy');
    const home = document.getElementById('coachAcademyHome');
    const teamPane = document.getElementById('coachTeamPane');
    const homeNav = document.getElementById('coachHomeNav');
    const emailEl = document.getElementById('coachSessionEmail');
    if(emailEl) emailEl.textContent = session.email;

    if(!academy){
      if(createBox) createBox.hidden = false;
      if(home) home.hidden = true;
      if(teamPane) teamPane.hidden = true;
      if(homeNav) homeNav.hidden = true;
      closeCoachSettings();
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
      profileStats.innerHTML = `
        <div><b>${teams.length}</b><span>${esc(tt('coachStatTeams', 'Teams'))}</span></div>
        <div><b>${players}</b><span>${esc(tt('coachStatPlayers', 'Players'))}</span></div>
        <div><b>${matches}</b><span>${esc(tt('coachStatMatches', 'Matches'))}</span></div>
        <div><b>${ratings}</b><span>${esc(tt('coachStatRatings', 'Ratings'))}</span></div>`;
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

    const teamListHtml = !teams.length
      ? `<p class="hint">${esc(tt('coachNoTeams', 'No teams yet. Create the first one.'))}</p>`
      : teams.map(t => {
          const on = t.id === activeId ? ' on' : '';
          const n = store.listPlayers(session, t.id).length;
          const maxP = typeof COACH_MAX_PLAYERS_PER_TEAM === 'number' ? COACH_MAX_PLAYERS_PER_TEAM : 50;
          return `<button type="button" class="coach-team-item${on}" data-team="${esc(t.id)}">
            <span class="coach-team-name">${esc(t.name)}${t.age_group ? ` · ${esc(t.age_group)}` : ''}</span>
            <span class="coach-team-meta">${n}/${maxP} · ${esc(t.invite_code)}</span>
          </button>`;
        }).join('');
    const list = document.getElementById('coachTeamList');
    if(list) list.innerHTML = teamListHtml;
    const settingsList = document.getElementById('coachSettingsTeamList');
    if(settingsList) settingsList.innerHTML = teamListHtml;

    if(teamPane) teamPane.hidden = !active;
    if(homeNav) homeNav.hidden = !active;
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

  function renderTeamPane(session, team){
    const store = global.CoachStore;
    const title = document.getElementById('coachTeamTitle');
    const code = document.getElementById('coachTeamCode');
    if(title) title.textContent = team.name + (team.age_group ? ` · ${team.age_group}` : '');
    if(code) code.textContent = team.invite_code;
    const posSel = document.getElementById('coachPlayerPos');
    if(posSel && typeof fillPitchSelect === 'function'){
      const keep = posSel.value;
      fillPitchSelect(posSel, keep || 'RW', true);
    }

    const players = store.listPlayers(session, team.id);
    const el = document.getElementById('coachPlayerList');
    if(!el) return;
    if(!players.length){
      el.innerHTML = `<p class="hint">${esc(tt('coachNoPlayers', 'Add players to this team.'))}</p>`;
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

    fillCoachTabHeads(session, team);

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

    const matchListHtml = !matches.length
      ? `<p class="hint">${esc(tt('coachNoMatches', 'No team matches yet.'))}</p>`
      : matches.map(m => {
          const on = m.id === activeMatchId ? ' on' : '';
          const rated = store.listRatings(session, m.id).length;
          const squadN = store.matchSquadIds(session, m).length;
          const played = matchIsPlayed(m);
          const st = played
            ? (m.score ? m.score : tt('coachMatchPlayed', 'played'))
            : tt('coachMatchUpcoming', 'upcoming');
          const meta = played
            ? `${squadN} ${tt('coachSquadShort', 'played')} · ${rated}/${squadN} ${tt('coachRatedShort', 'rated')}`
            : `${squadN} ${tt('coachSquadShort', 'played')}`;
          return `<button type="button" class="coach-team-item${on}" data-match="${esc(m.id)}">
            <span class="coach-team-name">${esc(m.date)} · ${esc(m.opponent)}</span>
            <span class="coach-team-meta">${esc(st)} · ${esc(meta)}</span>
          </button>`;
        }).join('');
    document.querySelectorAll('.js-cm-matches').forEach(el => { el.innerHTML = matchListHtml; });

    const detail = document.getElementById('coachMatchDetail');
    const upcomingBox = document.getElementById('coachMatchUpcomingBox');
    const playedBox = document.getElementById('coachMatchPlayedBox');
    const summary = document.getElementById('coachMatchSummary');
    if(!activeMatch){
      if(detail) detail.hidden = true;
      if(upcomingBox) upcomingBox.hidden = true;
      if(playedBox) playedBox.hidden = true;
      if(summary) summary.innerHTML = '';
      return;
    }

    if(detail) detail.hidden = false;
    const played = matchIsPlayed(activeMatch);
    if(upcomingBox) upcomingBox.hidden = played;
    if(playedBox) playedBox.hidden = !played;

    if(summary){
      const bits = [
        activeMatch.date,
        activeMatch.address || '',
        played
          ? (activeMatch.score ? `${tt('labelScore', 'Score')} ${activeMatch.score}` : tt('coachMatchPlayed', 'played'))
          : tt('coachMatchUpcoming', 'upcoming')
      ].filter(Boolean);
      summary.innerHTML = `<b>${esc(activeMatch.opponent)}</b><span class="hint">${esc(bits.join(' · '))}</span>`;
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
        ${match.address ? `<p class="hint"><b>${esc(tt('coachMatchAddress', 'Match address'))}:</b> ${esc(match.address)}</p>` : ''}
        <p class="hint">${esc(tt('coachInviteExplainApp', 'Invites go to parents/guardians inside Matchcard — not WhatsApp or SMS. Link a parent to the player first.'))}</p>
        <div class="coach-invite-rows">${rows}</div>
      </div>`;
    });
  }

  function fillCoachTabHeads(session, team){
    const store = global.CoachStore;
    const profile = store.getProfile ? store.getProfile(session) : {photo:'', email: session.email || '', first_name:'', last_name:''};
    const coachName = [profile.first_name, profile.last_name].filter(Boolean).join(' ');
    const title = coachName
      || ((team && team.name) ? (team.name + (team.age_group ? ` · ${team.age_group}` : '')) : '')
      || (store.myAcademy(session)?.name || tt('tabCoach', 'Coach'));
    const meta = [
      team && team.name ? (team.name + (team.age_group ? ` · ${team.age_group}` : '')) : '',
      profile.email || session.email || ''
    ].filter(Boolean).join(' · ');
    const letter = (coachName || title || 'C').trim().slice(0, 1).toUpperCase() || 'C';
    const who = document.getElementById('coachMatchTabWho');
    const metaEl = document.getElementById('coachMatchTabMeta');
    if(who) who.textContent = title;
    if(metaEl) metaEl.textContent = meta;
    const av = document.getElementById('coachMatchTabAv');
    if(av && typeof setBadge === 'function') setBadge(av, profile.photo || '', letter);
  }

  function renderCoachHistoryTab(session, team){
    const title = document.getElementById('coachHistoryTeam');
    if(title) title.textContent = team.name + (team.age_group ? ` · ${team.age_group}` : '');
    const el = document.getElementById('coachHistoryList');
    if(!el) return;
    const store = global.CoachStore;
    const matches = store.listMatches(session, team.id);
    if(!matches.length){
      el.innerHTML = `<p class="hint">${esc(tt('coachNoMatches', 'No team matches yet.'))}</p>`;
      return;
    }
    el.innerHTML = matches.map(m => {
      const squad = store.listMatchPlayers(session, m);
      const ratings = store.listRatings(session, m.id);
      const byPlayer = Object.fromEntries(ratings.map(r => [r.team_player_id, r]));
      const rows = squad.length ? squad : store.listPlayers(session, team.id);
      const body = rows.map(p => {
        const r = byPlayer[p.id];
        return `<div class="coach-player-row">
          <div class="coach-player-main">
            <b>${esc(playerLabel(p))}${p.number ? ` · #${esc(p.number)}` : ''}</b>
            <span>${r ? esc(tt('coachRated', 'Rated')) : esc(tt('coachNotRated', 'Not rated'))}</span>
          </div>
          <b>${r ? Number(r.rating).toFixed(1) : '—'}</b>
        </div>`;
      }).join('');
      return `<div class="coach-hist-card">
        <div class="coach-hist-head">
          <b>${esc(m.date)} · ${esc(m.opponent)}</b>
          <span>${m.address ? esc(m.address) + ' · ' : ''}${m.score ? esc(m.score) : '—'} · ${squad.length} ${esc(tt('coachSquadShort', 'played'))}</span>
        </div>
        <div class="coach-player-list">${body || `<p class="hint">${esc(tt('coachSquadEmpty', 'No squad selected.'))}</p>`}</div>
      </div>`;
    }).join('');
  }

  function renderAnalyticsPane(session, team){
    const store = global.CoachStore;
    const a = store.teamAnalytics(session, team.id);
    const avg = a.avg == null ? '—' : Number(a.avg).toFixed(1);
    const html = `
      <div class="coach-analytics-sum">
        <div><b>${a.matches}</b><span>${esc(tt('coachStatMatches', 'Matches'))}</span></div>
        <div><b>${a.ratings}</b><span>${esc(tt('coachStatRatings', 'Ratings'))}</span></div>
        <div><b>${esc(avg)}</b><span>${esc(tt('coachStatAvg', 'Team avg'))}</span></div>
      </div>
      ${a.players.length ? `<div class="coach-player-list">${a.players.map(p => `
        <div class="coach-player-row">
          <div class="coach-player-main">
            <b>${esc(p.name)}${p.number ? ` · #${esc(p.number)}` : ''}</b>
            <span>${p.games} ${esc(tt('coachGames', 'games'))}</span>
          </div>
          <b>${p.avg == null ? '—' : Number(p.avg).toFixed(1)}</b>
        </div>`).join('')}</div>` : `<p class="hint">${esc(tt('coachAnalyticsEmpty', 'Rate players in matches to see analytics.'))}</p>`}
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
  function onCreateTeam(){
    const session = global.CoachStore.getSession();
    const academy = global.CoachStore.myAcademy(session);
    if(!academy) return;
    const name = document.getElementById('coachTeamInput')?.value || '';
    const age = document.getElementById('coachTeamAgeInput')?.value || '';
    try{
      const team = global.CoachStore.createTeam(session, academy.id, name, age);
      global.CoachStore.setActiveTeamId(team.id);
      const nameInput = document.getElementById('coachTeamInput');
      const ageInput = document.getElementById('coachTeamAgeInput');
      if(nameInput) nameInput.value = '';
      if(ageInput) ageInput.value = '';
      toast(tt('coachTeamCreated', 'Team created.'));
      renderCoachUi();
    }catch(e){
      const map = {
        name: tt('coachErrTeamName', 'Enter team name.'),
        team_limit: tt('coachErrTeamLimit', 'Team limit reached for this academy.')
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
      document.getElementById('coachPlayerFirst')?.focus();
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
  let parentInviteRow = null;

  function closeCoachPlayerSheet(){
    detailPlayerId = '';
    const sheet = document.getElementById('coachPlayerSheet');
    const back = document.getElementById('coachPlayerBack');
    if(sheet) sheet.hidden = true;
    if(back) back.hidden = true;
  }
  function closeAllCoachOverlays(){
    closeCoachPlayerSheet();
    closeCoachSettings();
    if(typeof closeCoachQuickRate === 'function') closeCoachQuickRate();
    closeCoachParentInviteSheet();
    [
      'coachSettingsBack','coachRateBack','coachPlayerBack','coachParentInviteBack',
      'parentClaimBack','parentLinkBack','parentMsgBack'
    ].forEach(id => {
      const el = document.getElementById(id);
      if(el) el.hidden = true;
    });
    [
      'coachSettingsSheet','coachRateSheet','coachPlayerSheet','coachParentInviteSheet',
      'parentClaimSheet','parentLinkSheet','parentMsgSheet'
    ].forEach(id => {
      const el = document.getElementById(id);
      if(el) el.hidden = true;
    });
  }
  function openCoachPlayerSheet(playerId){
    const store = global.CoachStore;
    const session = store && store.getSession();
    const detail = session && store.playerDetail(session, playerId);
    if(!detail){
      toast(tt('coachErrGeneric', 'Something went wrong.'));
      return;
    }
    detailPlayerId = playerId;
    const sheet = document.getElementById('coachPlayerSheet');
    const back = document.getElementById('coachPlayerBack');
    const body = document.getElementById('coachPlayerBody');
    if(!sheet || !body) return;
    const p = detail.player;
    const label = [p.first_name, p.last_name].filter(Boolean).join(' ');
    const ratingsHtml = detail.ratings.length
      ? detail.ratings.slice(0, 12).map(r => {
          const head = [r.date, r.opponent, r.score].filter(Boolean).join(' · ');
          return `<div class="coach-player-row">
            <div class="coach-player-main">
              <b>${esc(head)}</b>
              ${r.comment ? `<span>${esc(r.comment)}</span>` : ''}
            </div>
            <b class="parent-rate-num">${esc(Number(r.rating).toFixed(1))}</b>
          </div>`;
        }).join('')
      : `<p class="hint">${esc(tt('coachPlayerNoRatings', 'No ratings for this player yet.'))}</p>`;
    body.innerHTML = `
      <div class="sheet-grab" aria-hidden="true"><span></span></div>
      <div class="pro-kicker">${esc(tt('coachPlayerDetailKicker', 'Player'))}</div>
      <h3 class="coach-rate-name" id="coachPlayerSheetTitle">${esc(label)}</h3>
      <p class="hint">${esc([
        detail.team && detail.team.name,
        detail.academy && detail.academy.name
      ].filter(Boolean).join(' · '))}</p>
      <div class="pro-kicker">${esc(tt('coachEditPlayerKicker', 'Edit player'))}</div>
      <div class="coach-player-form coach-player-edit">
        <input id="coachEditFirst" type="text" maxlength="40" value="${esc(p.first_name || '')}" data-i18n-placeholder="coachFirstPh" placeholder="First name">
        <input id="coachEditLast" type="text" maxlength="40" value="${esc(p.last_name || '')}" data-i18n-placeholder="coachLastPh" placeholder="Last name">
        <input id="coachEditNumber" type="text" maxlength="4" inputmode="numeric" value="${esc(p.number || '')}" placeholder="#">
        <input id="coachEditContact" type="text" maxlength="80" value="${esc(p.contact || '')}" data-i18n-placeholder="coachContactPh" placeholder="Parent phone or email">
        <select id="coachEditPos" class="coach-pos-select" aria-label="position"></select>
      </div>
      <button type="button" class="save-btn" id="coachSavePlayerBtn">${esc(tt('coachSavePlayer', 'Save player'))}</button>
      <div class="coach-analytics-sum">
        <div><b>${esc(detail.games)}</b><span>${esc(tt('coachGames', 'games'))}</span></div>
        <div><b>${esc(detail.avg != null ? detail.avg.toFixed(1) : '—')}</b><span>${esc(tt('coachStatAvg', 'Team avg'))}</span></div>
      </div>
      <div class="pro-kicker">${esc(tt('coachPlayerRatingsKicker', 'Recent ratings'))}</div>
      <div class="coach-player-list">${ratingsHtml}</div>
      <button type="button" class="save-btn" id="coachOpenChildPageBtn">${esc(tt('coachOpenChildPage', 'Open player page'))}</button>
      <button type="button" class="save-btn" id="coachAddParentBtn">${esc(tt('coachAddParentBtn', 'Add parent / guardian'))}</button>
      <button type="button" class="ghost-btn coach-remove-player" id="coachRemovePlayerBtn">${esc(tt('coachRemovePlayer', 'Remove player'))}</button>
      <button type="button" class="ghost-btn" id="coachPlayerCloseBtn">${esc(tt('previewCancel', 'Cancel'))}</button>
    `;
    const posSel = document.getElementById('coachEditPos');
    if(posSel && typeof fillPitchSelect === 'function'){
      fillPitchSelect(posSel, p.position || 'RW', true);
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
    const first = document.getElementById('coachEditFirst')?.value || '';
    const last = document.getElementById('coachEditLast')?.value || '';
    const number = document.getElementById('coachEditNumber')?.value || '';
    const contact = document.getElementById('coachEditContact')?.value || '';
    const position = document.getElementById('coachEditPos')?.value || '';
    try{
      const player = store.updatePlayer(session, detailPlayerId, {
        first_name: first,
        last_name: last,
        number,
        contact,
        position
      });
      const title = document.getElementById('coachPlayerSheetTitle');
      if(title){
        title.textContent = [player.first_name, player.last_name].filter(Boolean).join(' ');
      }
      toast(tt('coachPlayerSaved', 'Player saved.'));
      renderCoachUi();
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
    document.getElementById('coachCreateTeamBtn')?.addEventListener('click', () => { onCreateTeam(); });
    document.getElementById('coachAddPlayerBtn')?.addEventListener('click', () => { onAddPlayer(); });
    document.getElementById('coachSaveProfileBtn')?.addEventListener('click', () => { onSaveProfile(); });
    document.getElementById('coachSettingsBtn')?.addEventListener('click', () => openCoachSettings());
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
    document.addEventListener('click', e => {
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
        global.CoachStore.setActiveMatchId(matchBtn.dataset.match);
        setCoachMatchCreateOpen(false);
        document.querySelectorAll('.js-cm-squad').forEach(el => { el.dataset.dirty = ''; });
        renderCoachUi();
        try{
          document.getElementById('coachMatchDetail')?.scrollIntoView({behavior:'smooth', block:'start'});
        }catch(err){}
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
        const btn = e.target.closest('[data-team]');
        if(!btn) return;
        global.CoachStore.setActiveTeamId(btn.dataset.team);
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
  global.openCoachChildPlayerPage = openCoachChildPlayerPage;
})(window);

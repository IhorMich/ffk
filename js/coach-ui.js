/* Matchcard Coach UI — Phase 1: auth, academy, teams, team_players.
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
  function panel(id, on){
    const el = document.getElementById(id);
    if(el) el.hidden = !on;
  }

  function renderCoachUi(){
    const store = global.CoachStore;
    if(!store) return;
    const session = store.getSession();
    const marketing = document.getElementById('coachMarketing');
    const auth = document.getElementById('coachAuth');
    const work = document.getElementById('coachWorkspace');
    if(!marketing || !auth || !work) return;

    if(!session){
      // Keep marketing visible with auth below when user pressed Start, else only marketing.
      const started = work.dataset.started === '1' || auth.dataset.open === '1';
      marketing.hidden = false;
      auth.hidden = !started;
      work.hidden = true;
      syncModeHint();
      return;
    }

    marketing.hidden = true;
    auth.hidden = true;
    work.hidden = false;
    work.dataset.started = '1';
    renderWorkspace(session);
  }

  function syncModeHint(){
    const hint = document.getElementById('coachModeHint');
    if(!hint) return;
    const cloud = global.CoachStore && global.CoachStore.isCloudConfigured();
    hint.textContent = cloud
      ? tt('coachModeCloud', 'Cloud mode ready — Supabase keys found.')
      : tt('coachModeLocal', 'Phase 1 local mode: academy data stays on this phone until Supabase is connected.');
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
      return;
    }
    if(createBox) createBox.hidden = true;
    if(home) home.hidden = false;

    const nameEl = document.getElementById('coachAcademyName');
    if(nameEl) nameEl.textContent = academy.name;

    const teams = store.listTeams(session, academy.id);
    const list = document.getElementById('coachTeamList');
    if(list){
      if(!teams.length){
        list.innerHTML = `<p class="hint">${esc(tt('coachNoTeams', 'No teams yet. Create the first one.'))}</p>`;
      }else{
        let activeId = store.getActiveTeamId();
        if(!teams.some(t => t.id === activeId)) activeId = teams[0].id;
        store.setActiveTeamId(activeId);
        list.innerHTML = teams.map(t => {
          const on = t.id === activeId ? ' on' : '';
          const n = store.listPlayers(session, t.id).length;
          return `<button type="button" class="coach-team-item${on}" data-team="${esc(t.id)}">
            <span class="coach-team-name">${esc(t.name)}${t.age_group ? ` · ${esc(t.age_group)}` : ''}</span>
            <span class="coach-team-meta">${n}/${typeof COACH_MAX_PLAYERS_PER_TEAM === 'number' ? COACH_MAX_PLAYERS_PER_TEAM : 50} · ${esc(t.invite_code)}</span>
          </button>`;
        }).join('');
      }
    }

    const active = store.getTeam(session, store.getActiveTeamId());
    if(teamPane) teamPane.hidden = !active;
    if(active) renderTeamPane(session, active);
  }

  function renderTeamPane(session, team){
    const store = global.CoachStore;
    const title = document.getElementById('coachTeamTitle');
    const code = document.getElementById('coachTeamCode');
    if(title) title.textContent = team.name + (team.age_group ? ` · ${team.age_group}` : '');
    if(code) code.textContent = team.invite_code;

    const players = store.listPlayers(session, team.id);
    const el = document.getElementById('coachPlayerList');
    if(!el) return;
    if(!players.length){
      el.innerHTML = `<p class="hint">${esc(tt('coachNoPlayers', 'Add players to this team.'))}</p>`;
      return;
    }
    el.innerHTML = players.map(p => {
      const label = [p.first_name, p.last_name].filter(Boolean).join(' ');
      const meta = [p.number ? `#${p.number}` : '', p.position].filter(Boolean).join(' · ');
      return `<div class="coach-player-row">
        <div class="coach-player-main">
          <b>${esc(label)}</b>
          ${meta ? `<span>${esc(meta)}</span>` : ''}
        </div>
        <button type="button" class="roster-x" data-del-player="${esc(p.id)}" aria-label="remove">×</button>
      </div>`;
    }).join('');
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
    toast(tt('coachSignedOut', 'Signed out of Coach.'));
    renderCoachUi();
  }
  function onCreateAcademy(){
    const name = document.getElementById('coachAcademyInput')?.value || '';
    try{
      global.CoachStore.createAcademy(global.CoachStore.getSession(), name);
      toast(tt('coachAcademyCreated', 'Academy created.'));
      renderCoachUi();
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
    const position = document.getElementById('coachPlayerPos')?.value || '';
    try{
      global.CoachStore.addPlayer(session, teamId, {
        first_name: first,
        last_name: last,
        number,
        position
      });
      ['coachPlayerFirst','coachPlayerLast','coachPlayerNumber','coachPlayerPos'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = '';
      });
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

  function bindCoachUi(){
    if(global.__ffkCoachBound) return;
    global.__ffkCoachBound = true;
    document.getElementById('coachStartBtn')?.addEventListener('click', () => {
      if(global.CoachStore.getSession()){
        document.getElementById('coachWorkspace').dataset.started = '1';
        renderCoachUi();
      }else openAuth();
    });
    document.getElementById('coachSignUpBtn')?.addEventListener('click', () => { onSignUp(); });
    document.getElementById('coachSignInBtn')?.addEventListener('click', () => { onSignIn(); });
    document.getElementById('coachSignOutBtn')?.addEventListener('click', () => { onSignOut(); });
    document.getElementById('coachCreateAcademyBtn')?.addEventListener('click', () => { onCreateAcademy(); });
    document.getElementById('coachCreateTeamBtn')?.addEventListener('click', () => { onCreateTeam(); });
    document.getElementById('coachAddPlayerBtn')?.addEventListener('click', () => { onAddPlayer(); });
    document.getElementById('coachTeamList')?.addEventListener('click', e => {
      const btn = e.target.closest('[data-team]');
      if(!btn) return;
      global.CoachStore.setActiveTeamId(btn.dataset.team);
      renderCoachUi();
    });
    document.getElementById('coachPlayerList')?.addEventListener('click', e => {
      const btn = e.target.closest('[data-del-player]');
      if(!btn) return;
      try{
        global.CoachStore.removePlayer(global.CoachStore.getSession(), btn.dataset.delPlayer);
        renderCoachUi();
      }catch(err){}
    });
  }

  global.renderCoachUi = renderCoachUi;
  global.bindCoachUi = bindCoachUi;
})(window);

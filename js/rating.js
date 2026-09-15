const ROLE_CODES = ['gk','def','mid','fwd'];
const POS_CODES = ['GK','CB','LB','RB','LWB','RWB','CDM','CM','CAM','LM','RM','LW','RW','ST','CF'];
const POS_GROUP = {
  GK:'gk', CB:'def', LB:'def', RB:'def', LWB:'def', RWB:'def',
  CDM:'mid', CM:'mid', CAM:'mid', LM:'mid', RM:'mid',
  LW:'fwd', RW:'fwd', ST:'fwd', CF:'fwd'
};
const GROUP_TO_POS = {gk:'GK', def:'CB', mid:'CM', fwd:'RW'};

const BASE_RATING = 6.0;

const METRICS = [
  {key:'goals', positions:['fwd','mid','def'], live:['fwd','mid'], w:{fwd:0.7, mid:0.55, def:0.45, gk:0}},
  {key:'shots', positions:['fwd','mid'], live:['fwd'], w:{fwd:0.2, mid:0.15, def:0, gk:0}},
  {key:'assists', positions:['fwd','mid','def'], live:['fwd','mid'], w:{fwd:0.5, mid:0.5, def:0.35, gk:0}},
  {key:'dribbles', positions:['fwd','mid'], live:['fwd'], w:{fwd:0.15, mid:0.1, def:0, gk:0}},
  {key:'openings', positions:['fwd'], live:['fwd'], w:{fwd:0.2, mid:0, def:0, gk:0}},
  {key:'chances', positions:['mid'], live:['mid'], w:{fwd:0, mid:0.32, def:0, gk:0}},
  {key:'passes', positions:['fwd','mid','def'], live:['fwd','mid'], w:{fwd:0.15, mid:0.25, def:0.15, gk:0}},
  {key:'buildpass', positions:['mid','def','gk'], live:['mid','def','gk'], w:{fwd:0, mid:0.07, def:0.1, gk:0.12}},
  {key:'tackles', positions:['fwd','mid','def'], live:['mid','def'], w:{fwd:0.1, mid:0.25, def:0.4, gk:0}},
  {key:'interceptions', positions:['mid','def','gk'], live:['def','gk'], w:{fwd:0, mid:0.18, def:0.35, gk:0.28}},
  {key:'clearances', positions:['def'], live:['def'], w:{fwd:0, mid:0, def:0.22, gk:0}},
  {key:'blocks', positions:['def'], live:['def'], w:{fwd:0, mid:0, def:0.28, gk:0}},
  {key:'duelswon', positions:['fwd','mid','def'], live:['mid','def'], w:{fwd:0.1, mid:0.2, def:0.3, gk:0}},
  {key:'support', positions:['fwd','mid','def'], live:[], w:{fwd:0.15, mid:0.2, def:0.25, gk:0}},
  {key:'saves', positions:['gk'], live:['gk'], w:{fwd:0, mid:0, def:0, gk:0.4}},
  {key:'claims', positions:['gk'], live:['gk'], w:{fwd:0, mid:0, def:0, gk:0.3}},
  {key:'gkpass', positions:['gk'], live:['gk'], w:{fwd:0, mid:0, def:0, gk:0.15}},
  {key:'conceded', positions:['gk'], live:['gk'], w:{fwd:0, mid:0, def:0, gk:-0.18}},
  {key:'losses', positions:['fwd','mid','def'], live:['fwd','mid','def'], w:{fwd:-0.2, mid:-0.15, def:-0.1, gk:0}},
  {key:'ledtogoal', positions:['fwd','mid','def','gk'], live:['def','gk'], w:{fwd:-0.8, mid:-0.8, def:-0.85, gk:-0.55}},
  {key:'badpass', positions:['fwd','mid','def','gk'], live:[], w:{fwd:-0.1, mid:-0.15, def:-0.1, gk:-0.15}},
  {key:'badtouch', positions:['fwd','mid','def'], live:[], w:{fwd:-0.1, mid:-0.1, def:-0.1, gk:0}},
  {key:'duelslost', positions:['fwd','mid','def'], live:[], w:{fwd:-0.1, mid:-0.15, def:-0.25, gk:0}},
  {key:'fouls', positions:['fwd','mid','def','gk'], live:[], w:{fwd:-0.25, mid:-0.25, def:-0.2, gk:-0.2}},
  {key:'owngoal', positions:['fwd','mid','def','gk'], live:[], w:{fwd:-1, mid:-1, def:-1, gk:-1}},
];
const BEHAVIOR = [
  {key:'effort', inRating:true},
  {key:'team', inRating:true},
  {key:'coach', inRating:true},
  {key:'discipline', inRating:true},
  {key:'mood', inRating:false},
];
const METRIC_GROUPS = [
  {id:'attack', keys:['goals','shots','assists','dribbles','openings','chances','passes','buildpass','support','gkpass']},
  {id:'defense', keys:['tackles','interceptions','clearances','blocks','duelswon','saves','claims']},
  {id:'discipline', keys:['losses','ledtogoal','badpass','badtouch','duelslost','fouls','owngoal','conceded']}
];

const GRADE_TYPICAL = {
  goals:0.6, assists:0.5, shots:1.2, dribbles:2.2, openings:2, chances:1.2,
  passes:1.5, buildpass:6, tackles:2.5, interceptions:2, clearances:2, blocks:1.2,
  duelswon:4, support:2, saves:3, claims:1.5, gkpass:4,
  losses:3.4, ledtogoal:0.35, badpass:2.4, badtouch:1.4, duelslost:3, fouls:1.2,
  owngoal:0.2, conceded:1.4
};
function metricGrade(avg, key, w){
  const typical = GRADE_TYPICAL[key] || 2;
  if(w >= 0) return clamp10(4 + 6 * (1 - Math.exp(-avg / typical)));
  return clamp10(10 - 6 * (1 - Math.exp(-avg / typical)));
}

function isRoleCode(code){ return ROLE_CODES.includes(code); }
function isPosCode(code){ return POS_CODES.includes(code); }
function isPitchCode(code){ return isRoleCode(code) || isPosCode(code); }

function guessPos(label){
  const s = String(label||'');
  const code = s.toUpperCase();
  if(POS_GROUP[code]) return POS_GROUP[code];
  if(/вратар|воротар|bramk|goalkeep|\bgk\b/i.test(s)) return 'gk';
  if(/защит|захис|obroń|obron|\bdef\b/i.test(s)) return 'def';
  if(/полузащ|півзахис|pomoc|\bmid\b/i.test(s)) return 'mid';
  return 'fwd';
}

function ratingPosOf(code){
  if(POS_GROUP[code]) return POS_GROUP[code];
  if(isRoleCode(code)) return code;
  return guessPos(code);
}

function emptyForm(){
  const counts = {}, behaviors = {};
  METRICS.forEach(m => counts[m.key] = 0);
  BEHAVIOR.forEach(b => behaviors[b.key] = 3);
  return {counts, behaviors};
}

function metricsFor(pos){ return METRICS.filter(m => m.positions.includes(pos)); }
function weightOf(m, pos){ return m.w[pos] ?? 0; }
function clamp10(n){ return Math.round(Math.max(0, Math.min(10, n)) * 10) / 10; }
// Scores keep every decimal the weights produce; rounding happens on display,
// so a 0.55 goal really adds 0.55 instead of jumping to 0.6.
function clampScore(n){ return Math.max(0, Math.min(10, Math.round(n * 1000) / 1000)); }

function behaviorAvg(behaviors){
  const rated = BEHAVIOR.filter(b => b.inRating).map(b => Number(behaviors[b.key]) || 3);
  return rated.reduce((a,b)=>a+b,0) / rated.length;
}
function stackedDecay(w){ return w < 0 ? 0.75 : 0.88; }
function nextStackedWeight(n, w){
  n = Math.max(0, Math.floor(Number(n)||0));
  if(!w) return 0;
  return w * Math.pow(stackedDecay(w), n);
}
function stackedWeight(n, w){
  n = Math.max(0, Math.floor(Number(n)||0));
  if(!n || !w) return 0;
  let sum = 0;
  for(let i=0;i<n;i++) sum += nextStackedWeight(i, w);
  return sum;
}
function actionSum(counts, pos){
  let sum = 0;
  metricsFor(pos).forEach(m => sum += stackedWeight(counts[m.key], weightOf(m, pos)));
  return sum;
}
function actionScore(counts, pos){
  return clampScore(BASE_RATING + actionSum(counts, pos));
}
function effortScore(behaviors){
  return clampScore(BASE_RATING + (behaviorAvg(behaviors) - 3) * 2);
}
function overallScore(counts, behaviors, pos){
  return clampScore(BASE_RATING + actionSum(counts, pos) + (behaviorAvg(behaviors) - 3) * 0.5);
}

function actionSplit(counts, pos){
  let plus = 0, minus = 0;
  metricsFor(pos).forEach(m => {
    const v = stackedWeight(counts[m.key], weightOf(m, pos));
    if(v > 0) plus += v;
    else if(v < 0) minus += v;
  });
  return {plus: Math.round(plus * 100) / 100, minus: Math.round(minus * 100) / 100};
}

function eventSign(key, pos){
  const met = METRICS.find(x => x.key === key);
  if(!met) return 0;
  const w = weightOf(met, pos);
  if(w > 0) return 1;
  if(w < 0) return -1;
  return 0;
}

function ratingClass(r){
  if(r < 5.5) return 'low';
  if(r < 7.5) return 'mid';
  return '';
}
function countOf(m, key){ return Math.max(0, Math.floor(Number(m?.counts?.[key]) || 0)); }
function behaviorOf(m, key){ return Number(m?.behaviors?.[key]) || 3; }
function matchIsBlank(m){
  const acted = METRICS.some(x => countOf(m, x.key) > 0);
  const shifted = BEHAVIOR.some(b => b.inRating && behaviorOf(m, b.key) !== 3);
  return !acted && !shifted;
}

const RATING_FIXTURES = [
  {name:'base', pos:'fwd', counts:{}, behaviors:{}, overall:6, action:6, effort:6},
  {name:'oneGoal', pos:'fwd', counts:{goals:1}, behaviors:{}, overall:6.7, action:6.7, effort:6},
  {name:'threeGoals', pos:'fwd', counts:{goals:3}, behaviors:{}, overall:7.9, action:7.9, effort:6},
  {name:'gkSaves', pos:'gk', counts:{saves:4, claims:1}, behaviors:{}, overall:7.6, action:7.6, effort:6},
  {name:'maxEffort', pos:'fwd', counts:{}, behaviors:{effort:5, team:5, coach:5, discipline:5}, overall:7, action:6, effort:10},
  {name:'minEffort', pos:'fwd', counts:{}, behaviors:{effort:1, team:1, coach:1, discipline:1}, overall:5, action:6, effort:2}
];
function ratingFixtureFail(){
  for(let i=0;i<RATING_FIXTURES.length;i++){
    const f = RATING_FIXTURES[i];
    const form = emptyForm();
    Object.keys(f.counts || {}).forEach(k => { form.counts[k] = f.counts[k]; });
    Object.keys(f.behaviors || {}).forEach(k => { form.behaviors[k] = f.behaviors[k]; });
    const overall = clamp10(overallScore(form.counts, form.behaviors, f.pos));
    const action = clamp10(actionScore(form.counts, f.pos));
    const effort = clamp10(effortScore(form.behaviors));
    if(overall !== f.overall || action !== f.action || effort !== f.effort){
      return f.name + ' got ' + overall + '/' + action + '/' + effort;
    }
  }
  const n0 = Math.round(nextStackedWeight(0, 0.2) * 100) / 100;
  const n1 = Math.round(nextStackedWeight(1, 0.2) * 100) / 100;
  if(n0 !== 0.2 || n1 !== 0.18) return 'nextDecay ' + n0 + '/' + n1;
  return '';
}

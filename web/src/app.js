// =====================================================================
// Strengthify Web — UI / Application logic
// =====================================================================

// ── Screen registry ───────────────────────────────────────────────

const SCREENS = ['home', 'workout', 'logging', 'results', 'progress', 'standards', 'profile', 'onboarding', 'session-detail', 'session-edit'];
let currentScreen = null;

function showScreen(id) {
  SCREENS.forEach(s => {
    const el = document.getElementById(s + '-screen');
    if (el) el.classList.toggle('hidden', s !== id);
  });
  document.getElementById('nav-bar').classList.toggle('hidden', id === 'onboarding');
  // Update nav active state
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.screen === id);
  });
  currentScreen = id;
}

// ── Toast notifications ───────────────────────────────────────────

function toast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

// ── Onboarding ────────────────────────────────────────────────────

function initOnboarding() {
  const form = document.getElementById('onboarding-form');
  form?.addEventListener('submit', e => {
    e.preventDefault();
    const name   = document.getElementById('ob-name').value.trim();
    const sex    = document.getElementById('ob-sex').value;
    const dob    = document.getElementById('ob-dob').value;
    const bw     = parseFloat(document.getElementById('ob-bw').value);
    const height = parseFloat(document.getElementById('ob-height').value);

    if (!name || !sex || !dob || isNaN(bw) || bw <= 0 || isNaN(height) || height <= 0) {
      toast('Please fill in all fields.', 'error'); return;
    }

    createProfile(name, sex, dob, bw, height);
    toast(`Welcome, ${name}!`);
    renderHome();
    showScreen('home');
  });
}

// ── Home screen ───────────────────────────────────────────────────

function renderHome() {
  const profile  = getProfile();
  if (!profile) return;
  const pbs      = getPBs();
  const sessions = getSessions();
  const progress = xpProgress(profile);

  // Level badge
  document.getElementById('home-level').textContent      = profile.level;
  document.getElementById('home-level-title').textContent = levelTitle(profile.level);
  document.getElementById('home-name').textContent        = profile.name;
  document.getElementById('home-sessions').textContent    = sessions.length;
  document.getElementById('xp-bar-fill').style.width      = (progress.pct * 100).toFixed(1) + '%';
  const nextTitle = levelTitle(profile.level + 1);
  const nextLabel = nextTitle !== levelTitle(profile.level) ? ` → ${nextTitle}` : '';
  document.getElementById('xp-nums').textContent          = `${progress.current} / ${progress.needed} XP${nextLabel}`;

  // Recent sessions
  const list = document.getElementById('recent-sessions');
  list.innerHTML = '';
  if (sessions.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24"><path stroke="currentColor" d="M12 3v18M3 12h18"/></svg>
        <p>No workouts yet — start your first one!</p>
      </div>`;
  } else {
    sessions.slice(0, 5).forEach(s => {
      const liftNames = [...new Set(s.sets.map(x => x.lift))].join(', ');
      const div = document.createElement('div');
      div.className = 'session-item session-item-link';
      div.innerHTML = `
        <div class="si-left">
          <div class="si-date">${formatDate(s.date)}</div>
          <div class="si-lifts">${liftNames}</div>
        </div>
        <div class="si-right">
          <div class="si-xp">+${s.xpEarned} XP</div>
          <div class="si-sets">${s.sets.length} sets</div>
          <div class="si-arrow">›</div>
        </div>`;
      div.addEventListener('click', () => renderSessionDetail(s.id));
      list.appendChild(div);
    });
  }

  // Benchmark cards — clickable to open progress for that lift
  const grid = document.getElementById('benchmark-grid');
  grid.innerHTML = '';
  LIFTS.forEach(lift => {
    const pb          = pbs[lift];
    const rankWeight  = (pb && typeof pb === 'object') ? (pb.oneRepKg || pb.orm || 0) : 0;
    const percentile  = rankWeight > 0 ? getPercentile(lift, rankWeight, profile) : 0;
    const tier        = tierFromPercentile(percentile);
    const barClass    = tierBarClass(tier);
    const div = document.createElement('div');
    div.className = 'bench-card bench-card-link';
    div.innerHTML = `
      <div class="bc-lift" title="${lift}">${lift}</div>
      <span class="bc-tier ${tierCssClass(tier)}">${rankWeight > 0 ? tier : '—'}</span>
      <div class="bc-bar-track"><div class="bc-bar-fill ${barClass}" style="width:${percentile}%"></div></div>
      <div class="bc-pct">${rankWeight > 0 ? ordinal(percentile) + ' percentile' : 'No data yet'}</div>`;
    div.addEventListener('click', () => {
      progressLift = lift;
      renderProgress();
      showScreen('progress');
    });
    grid.appendChild(div);
  });
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Workout selection ─────────────────────────────────────────────

let selectedLifts = [];

function initWorkoutScreen() {
  selectedLifts = [];
  const grid = document.getElementById('lift-selector-grid');
  grid.innerHTML = '';
  LIFTS.forEach(lift => {
    const btn = document.createElement('div');
    btn.className = 'lift-toggle';
    btn.textContent = lift;
    btn.addEventListener('click', () => {
      const idx = selectedLifts.indexOf(lift);
      if (idx >= 0) {
        selectedLifts.splice(idx, 1);
        btn.classList.remove('selected');
      } else if (selectedLifts.length < 4) {
        selectedLifts.push(lift);
        btn.classList.add('selected');
      } else {
        toast('Max 4 lifts per session.', 'error');
      }
    });
    grid.appendChild(btn);
  });

  document.getElementById('start-logging-btn').onclick = () => {
    if (selectedLifts.length === 0) { toast('Select at least one lift.', 'error'); return; }
    renderLoggingScreen();
    showScreen('logging');
  };
}

// ── Logging screen ────────────────────────────────────────────────

let sessionSets = {}; // lift -> [{ weightKg, reps }]

function renderLoggingScreen() {
  sessionSets = {};
  const container = document.getElementById('logging-lifts');
  container.innerHTML = '';

  const sessions = getSessions();

  selectedLifts.forEach(lift => {
    sessionSets[lift] = [];

    // Find last session that had this lift
    let prevSets = null;
    for (const s of sessions) {
      const match = s.sets.filter(x => x.lift === lift);
      if (match.length > 0) { prevSets = match; break; }
    }

    const section = document.createElement('div');
    section.className = 'logging-lift';
    section.id = 'logging-lift-' + lift.replace(/[^a-z]/gi, '_');

    const liftNote = lift === 'Pull-up / Chin-up'
      ? ' (enter total load: bodyweight + added weight)'
      : lift === 'Push-up'
      ? ' (enter 0 for bodyweight, or added weight e.g. weighted vest)'
      : (lift === 'Dumbbell Press' || lift === 'Dumbbell Curl')
      ? ' (weight per dumbbell)'
      : '';
    const prevHint = prevSets
      ? `Previous: ${prevSets[0].weightKg}kg × ${prevSets[0].reps}${liftNote}`
      : `No previous data${liftNote}`;

    section.innerHTML = `
      <h3>${lift}</h3>
      <p class="prev-hint">${prevHint}</p>
      <div class="set-row-header"><span>Weight (kg)</span><span>Reps</span><span></span></div>
      <div class="set-rows"></div>
      <button class="btn btn-ghost btn-sm add-set-btn" data-lift="${lift}">+ Add Set</button>
    `;
    container.appendChild(section);

    // Add one blank row to start
    addSetRow(lift, prevSets ? prevSets[0] : null);

    section.querySelector('.add-set-btn').addEventListener('click', () => addSetRow(lift, null));
  });
}

function addSetRow(lift, suggest) {
  const section  = document.getElementById('logging-lift-' + lift.replace(/[^a-z]/gi, '_'));
  const rowsDiv  = section.querySelector('.set-rows');
  const setIndex = rowsDiv.children.length;

  sessionSets[lift].push({ weightKg: 0, reps: 0 });

  const row = document.createElement('div');
  row.className = 'set-row';
  row.innerHTML = `
    <input type="number" min="0" step="0.5" placeholder="${suggest ? suggest.weightKg : '0'}" class="weight-input" data-lift="${lift}" data-idx="${setIndex}">
    <input type="number" min="1" max="100" step="1" placeholder="${suggest ? suggest.reps : '0'}" class="reps-input" data-lift="${lift}" data-idx="${setIndex}">
    <button class="del-set-btn" title="Remove set">✕</button>
  `;

  row.querySelector('.weight-input').addEventListener('input', e => {
    const v = parseFloat(e.target.value);
    sessionSets[lift][parseInt(e.target.dataset.idx)].weightKg = isNaN(v) ? 0 : v;
  });
  row.querySelector('.reps-input').addEventListener('input', e => {
    const v = parseInt(e.target.value);
    sessionSets[lift][parseInt(e.target.dataset.idx)].reps = isNaN(v) ? 0 : v;
  });
  row.querySelector('.del-set-btn').addEventListener('click', () => {
    if (rowsDiv.children.length > 1) {
      const idx = Array.from(rowsDiv.children).indexOf(row);
      sessionSets[lift].splice(idx, 1);
      row.remove();
      // Re-index data attributes
      rowsDiv.querySelectorAll('input').forEach(input => {
        const curIdx = parseInt(input.dataset.idx);
        if (curIdx > idx) input.dataset.idx = curIdx - 1;
      });
    }
  });

  rowsDiv.appendChild(row);
}

function finishWorkout() {
  const profile = getProfile();
  if (!profile) return;

  // Flatten sets
  const allSets = [];
  for (const lift of selectedLifts) {
    for (const s of sessionSets[lift]) {
      if (s.reps > 0) {
        allSets.push({ lift, weightKg: s.weightKg || 0, reps: s.reps });
      }
    }
  }

  if (allSets.length === 0) {
    toast('Log at least one valid set.', 'error');
    return;
  }

  // Calculate XP
  const { xp, newPBs } = calculateSessionXP(allSets, profile);
  const leveledUp = applyXP(profile, xp);
  saveProfile(profile);

  // Save session
  const session = {
    id: uuid(),
    date: today(),
    sets: allSets,
    xpEarned: xp,
  };
  saveSession(session);

  // Show results
  renderResults(xp, newPBs, leveledUp, profile);
  showScreen('results');
}

// ── Results screen ────────────────────────────────────────────────

function renderResults(xp, newPBs, leveledUp, profile) {
  document.getElementById('result-xp').textContent = '+' + xp;

  // Level up banner
  const banner = document.getElementById('level-up-banner');
  if (leveledUp) {
    banner.classList.remove('hidden');
    banner.querySelector('.new-level').textContent  = profile.level;
    banner.querySelector('.new-title').textContent  = levelTitle(profile.level);
  } else {
    banner.classList.add('hidden');
  }

  // PB list
  const pbList = document.getElementById('pb-list');
  pbList.innerHTML = '';
  if (newPBs.length > 0) {
    newPBs.forEach(pb => {
      const div = document.createElement('div');
      div.className = 'result-row';
      let label, val;
      if (pb.type === 'orm') {
        label = `🏆 ${pb.lift}`;
        val   = `${pb.value.toFixed(1)} kg est. 1RM`;
      } else if (pb.type === 'oneRep') {
        label = `🏆 ${pb.lift}`;
        val   = `${pb.value} kg × 1 rep`;
      } else {
        label = `🔥 ${pb.lift}`;
        val   = pb.weight > 0 ? `${pb.value} reps @ ${pb.weight} kg` : `${pb.value} reps (bodyweight)`;
      }
      div.innerHTML = `<span class="rr-label">${label}</span><span class="rr-val">${val}</span>`;
      pbList.appendChild(div);
    });
  } else {
    pbList.innerHTML = '<div class="result-row"><span class="rr-label" style="width:100%;text-align:center;color:var(--muted)">No new personal bests this session</span></div>';
  }
}

// ── Progress screen ───────────────────────────────────────────────

let progressLift = LIFTS[0];

function renderProgress() {
  // Guard: if a previously selected lift was removed from LIFTS, reset gracefully
  if (!LIFTS.includes(progressLift)) progressLift = LIFTS[0];

  // Build lift tab row
  const tabRow = document.getElementById('progress-lift-tabs');
  tabRow.innerHTML = '';
  LIFTS.forEach(lift => {
    const btn = document.createElement('button');
    btn.className = 'lift-tab' + (lift === progressLift ? ' active' : '');
    btn.textContent = lift;
    btn.addEventListener('click', () => {
      progressLift = lift;
      renderProgress();
    });
    tabRow.appendChild(btn);
  });

  // Gather data points for chosen lift
  const sessions = getSessions().slice().reverse(); // oldest first
  const points = [];
  sessions.forEach(s => {
    const liftSets = s.sets.filter(x => x.lift === progressLift);
    if (liftSets.length > 0) {
      const bestORM = Math.max(...liftSets.map(x => epley1RM(effectiveWeight(progressLift, x.weightKg, profile), x.reps)));
      points.push({ x: s.date, y: parseFloat(bestORM.toFixed(2)) });
    }
  });

  const canvas = document.getElementById('progress-chart');
  drawLineChart(canvas, points, { height: 200 });

  // Benchmark info
  const profile = getProfile();
  const pbs = getPBs();
  const benchmark = getBenchmark(progressLift, profile);
  const rawPB     = pbs[progressLift];
  const pb        = (rawPB && typeof rawPB === 'object') ? rawPB : { orm: rawPB || 0, oneRepKg: 0, maxReps: 0, maxRepsKg: 0, maxWeightKg: 0 };
  const orm        = pb.orm || 0;
  // For bodyweight lifts, use orm for ranking since maxWeightKg/oneRepKg store effective weight
  const rankWeight = pb.oneRepKg || pb.orm || 0;
  const isTrue1RM  = pb.oneRepKg > 0;
  const percentile = rankWeight > 0 ? getPercentile(progressLift, rankWeight, profile) : 0;
  const tier       = tierFromPercentile(percentile);

  const weightLabel = isTrue1RM ? `${rankWeight} kg (1-rep)` : (rankWeight > 0 ? `${rankWeight} kg (best weight)` : '—');
  const repPRStr  = pb.maxReps > 0
    ? (pb.maxRepsKg > 0 ? `${pb.maxReps} reps @ ${pb.maxRepsKg} kg` : `${pb.maxReps} reps (bodyweight)`)
    : '—';

  document.getElementById('progress-tier').innerHTML = `
    <div class="result-row"><span class="rr-label">Best est. 1RM</span><span class="rr-val">${orm > 0 ? orm.toFixed(1) + ' kg' : '—'}</span></div>
    <div class="result-row"><span class="rr-label">Ranking weight</span><span class="rr-val">${weightLabel}</span></div>
    <div class="result-row"><span class="rr-label">Best rep set</span><span class="rr-val">${repPRStr}</span></div>
    <div class="result-row"><span class="rr-label">50th pct reference</span><span class="rr-val">${benchmark ? benchmark.toFixed(1) + ' kg' : '—'}</span></div>
    <div class="result-row"><span class="rr-label">Percentile</span><span class="rr-val">${rankWeight > 0 ? ordinal(percentile) : '—'}</span></div>
    <div class="result-row"><span class="rr-label">Tier</span><span class="rr-val">${rankWeight > 0 ? `<span class="bc-tier ${tierCssClass(tier)}">${tier}</span>` : '—'}</span></div>
  `;
}

// ── Standards screen ─────────────────────────────────────────────

function renderStandards() {
  const profile = getProfile();
  if (!profile) return;
  const age = calcAge(profile.dob);
  const af  = ageFactor(age);
  const bw  = profile.bodyweightKg;
  const sex = profile.sex;

  const tiers = [
    { pct: 5,  label: 'Beginner' },
    { pct: 20, label: 'Novice' },
    { pct: 40, label: 'Intermediate' },
    { pct: 60, label: 'Advanced' },
    { pct: 80, label: 'Elite' },
    { pct: 95, label: 'World Class' },
  ];

  const pbs = getPBs();

  const container = document.getElementById('standards-content');
  container.innerHTML = '';

  LIFTS.forEach(lift => {
    const std = STRENGTH_STANDARDS[lift];
    if (!std) return;
    const bp  = sex === 'female' ? std.female : std.male;

    const rawPB       = pbs[lift];
    const myRankWeight = (rawPB && typeof rawPB === 'object') ? (rawPB.oneRepKg || rawPB.orm || 0) : 0;
    const myIsTrue1RM  = (rawPB && typeof rawPB === 'object') && rawPB.oneRepKg > 0;
    const myPct       = myRankWeight > 0 ? getPercentile(lift, myRankWeight, profile) : null;
    const myTier      = myPct !== null ? tierFromPercentile(myPct) : null;

    const card = document.createElement('div');
    card.className = 'card';
    card.style.marginBottom = '12px';

    const myRow = myRankWeight > 0
      ? `<div class="std-my-row">
           <span class="bc-tier ${tierCssClass(myTier)}">${myTier}</span>
           <span style="margin-left:8px;font-size:13px;color:var(--muted)">${myRankWeight.toFixed(1)} kg ${myIsTrue1RM ? '(1-rep)' : '(best weight)'} &mdash; ${ordinal(myPct)} percentile</span>
         </div>`
      : `<div style="font-size:12px;color:var(--muted);margin-bottom:10px">No weight logged yet</div>`;

    const rows = tiers.map(t => {
      const ratio = interpRatio(bp, t.pct);
      const kg    = (ratio * af * bw).toFixed(1);
      const active = myTier === t.label;
      return `<div class="std-row${active ? ' std-row-me' : ''}">
        <span class="bc-tier ${tierCssClass(t.label)}" style="min-width:108px">${t.label}</span>
        <span class="std-pct">${ordinal(t.pct)}+</span>
        <span class="std-kg">&ge;${kg} kg</span>
      </div>`;
    }).join('');

    card.innerHTML = `
      <div class="card-title">${lift}</div>
      ${myRow}
      <div class="std-table">${rows}</div>
    `;
    container.appendChild(card);
  });
}

// ── Profile screen ────────────────────────────────────────────────

function renderProfile() {
  const profile = getProfile();
  if (!profile) return;

  document.getElementById('prof-name').value     = profile.name;
  document.getElementById('prof-bw').value        = profile.bodyweightKg;
  document.getElementById('prof-height').value    = profile.heightCm || '';
  document.getElementById('prof-sex').value       = profile.sex;
  document.getElementById('prof-dob').value       = profile.dob;
  document.getElementById('prof-total-xp').textContent = profile.totalXP;
  document.getElementById('prof-level').textContent    = profile.level;
  document.getElementById('prof-title').textContent    = levelTitle(profile.level);
  document.getElementById('prof-sessions').textContent = getSessions().length;
}

function saveProfileForm() {
  const profile = getProfile();
  const name   = document.getElementById('prof-name').value.trim();
  const bw     = parseFloat(document.getElementById('prof-bw').value);
  const height = parseFloat(document.getElementById('prof-height').value);
  const sex    = document.getElementById('prof-sex').value;
  const dob    = document.getElementById('prof-dob').value;
  if (!name || isNaN(bw) || bw <= 0 || isNaN(height) || height <= 0 || !sex || !dob) {
    toast('Please fill in all fields.', 'error'); return;
  }
  profile.name = name;
  profile.bodyweightKg = bw;
  profile.heightCm = height;
  profile.sex = sex;
  profile.dob = dob;
  saveProfile(profile);
  toast('Profile saved!');
  renderHome();
}

// ── Data import / export ──────────────────────────────────────────

function handleExport() {
  const data = exportData();
  const blob = new Blob([data], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = 'strengthify-backup.json';
  a.click();
  URL.revokeObjectURL(url);
}

function handleImport(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      importData(e.target.result);
      toast('Data imported successfully!');
      renderHome();
      renderProfile();
    } catch (err) {
      toast('Import failed: invalid file.', 'error');
    }
  };
  reader.readAsText(file);
}

// ── Session detail & edit ─────────────────────────────────────────

let detailSessionId = null;

function renderSessionDetail(sessionId) {
  const sessions = getSessions();
  const session  = sessions.find(s => s.id === sessionId);
  if (!session) return;
  detailSessionId = sessionId;

  document.getElementById('sd-title').textContent = formatDate(session.date);
  document.getElementById('sd-meta').textContent  = `${session.sets.length} sets · +${session.xpEarned} XP`;

  // Group sets by lift
  const byLift = {};
  for (const set of session.sets) {
    if (!byLift[set.lift]) byLift[set.lift] = [];
    byLift[set.lift].push(set);
  }

  const container = document.getElementById('sd-sets-container');
  container.innerHTML = '';
  for (const [lift, sets] of Object.entries(byLift)) {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.marginBottom = '12px';
    const rows = sets.map((s, i) => {
      const isBodyweight = BODYWEIGHT_LIFTS.has(lift);
      const weightDisplay = isBodyweight && s.weightKg === 0
        ? 'Bodyweight'
        : `${s.weightKg} kg${isBodyweight ? ' + BW' : ''}`;
      return `<div class="result-row">
        <span class="rr-label">Set ${i + 1}</span>
        <span class="rr-val">${weightDisplay} × ${s.reps}</span>
      </div>`;
    }).join('');
    card.innerHTML = `<div class="card-title">${lift}</div>${rows}`;
    container.appendChild(card);
  }

  showScreen('session-detail');
}

let editSessionId  = null;
let editSessionSets = {};

function renderSessionEdit(sessionId) {
  const sessions = getSessions();
  const session  = sessions.find(s => s.id === sessionId);
  if (!session) return;
  editSessionId   = sessionId;
  editSessionSets = {};

  document.getElementById('se-meta').textContent = formatDate(session.date);

  // Group sets by lift
  const byLift = {};
  for (const set of session.sets) {
    if (!byLift[set.lift]) byLift[set.lift] = [];
    byLift[set.lift].push({ ...set });
  }

  const container = document.getElementById('se-lifts-container');
  container.innerHTML = '';

  for (const [lift, sets] of Object.entries(byLift)) {
    editSessionSets[lift] = sets.map(s => ({ ...s }));
    const isBodyweight = BODYWEIGHT_LIFTS.has(lift);
    const liftNote = isBodyweight ? ' (added weight; 0 = bodyweight only)' : '';

    const section = document.createElement('div');
    section.className = 'logging-lift';
    section.id = 'edit-lift-' + lift.replace(/[^a-z]/gi, '_');
    section.innerHTML = `
      <h3>${lift}</h3>
      <p class="prev-hint" style="margin-bottom:8px">${liftNote}</p>
      <div class="set-row-header"><span>Weight (kg)</span><span>Reps</span><span></span></div>
      <div class="set-rows"></div>
      <button class="btn btn-ghost btn-sm add-edit-set-btn" data-lift="${lift}">+ Add Set</button>
    `;
    container.appendChild(section);

    const rowsDiv = section.querySelector('.set-rows');
    sets.forEach((s, idx) => addEditSetRow(lift, s, idx, rowsDiv));

    section.querySelector('.add-edit-set-btn').addEventListener('click', () => {
      const newIdx = editSessionSets[lift].length;
      editSessionSets[lift].push({ lift, weightKg: 0, reps: 0 });
      addEditSetRow(lift, { lift, weightKg: 0, reps: 0 }, newIdx, rowsDiv);
    });
  }

  showScreen('session-edit');
}

function addEditSetRow(lift, setData, idx, rowsDiv) {
  const row = document.createElement('div');
  row.className = 'set-row';
  row.innerHTML = `
    <input type="number" min="0" step="0.5" value="${setData.weightKg}" class="weight-input">
    <input type="number" min="1" max="999" step="1" value="${setData.reps}" class="reps-input">
    <button class="del-set-btn" title="Remove set">✕</button>
  `;
  row.querySelector('.weight-input').addEventListener('input', e => {
    const v = parseFloat(e.target.value);
    editSessionSets[lift][Array.from(rowsDiv.children).indexOf(row)].weightKg = isNaN(v) ? 0 : v;
  });
  row.querySelector('.reps-input').addEventListener('input', e => {
    const v = parseInt(e.target.value);
    editSessionSets[lift][Array.from(rowsDiv.children).indexOf(row)].reps = isNaN(v) ? 0 : v;
  });
  row.querySelector('.del-set-btn').addEventListener('click', () => {
    const rowIdx = Array.from(rowsDiv.children).indexOf(row);
    editSessionSets[lift].splice(rowIdx, 1);
    row.remove();
  });
  rowsDiv.appendChild(row);
}

function saveEditSession() {
  if (!editSessionId) return;

  // Flatten sets, filter invalid
  const allSets = [];
  for (const [lift, sets] of Object.entries(editSessionSets)) {
    for (const s of sets) {
      if (s.reps > 0) allSets.push({ lift, weightKg: s.weightKg || 0, reps: s.reps });
    }
  }
  if (allSets.length === 0) { toast('At least one valid set is required.', 'error'); return; }

  // Update the session sets
  updateSession(editSessionId, allSets);

  // Recalculate everything from scratch
  const { profile } = recalculateAllPBsAndXP();
  toast('Workout saved! XP recalculated.');

  renderHome();
  renderSessionDetail(editSessionId);
}

function deleteSession(sessionId) {
  if (!confirm('Delete this workout? XP will be recalculated.')) return;
  const sessions = getSessions().filter(s => s.id !== sessionId);
  localStorage.setItem(KEYS.SESSIONS, JSON.stringify(sessions));
  recalculateAllPBsAndXP();
  toast('Workout deleted.');
  renderHome();
  showScreen('home');
}

// ── App init ──────────────────────────────────────────────────────

function init() {
  // Nav buttons
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const screen = btn.dataset.screen;
      if (screen === 'workout')   { initWorkoutScreen(); }
      if (screen === 'progress')   { renderProgress(); }
      if (screen === 'standards')  { renderStandards(); }
      if (screen === 'profile')    { renderProfile(); }
      showScreen(screen);
    });
  });

  // Back buttons
  document.querySelectorAll('.back-btn').forEach(btn => {
    btn.addEventListener('click', () => showScreen(btn.dataset.to));
  });

  // Finish workout
  document.getElementById('finish-workout-btn')?.addEventListener('click', finishWorkout);

  // Results done
  document.getElementById('results-done-btn')?.addEventListener('click', () => {
    renderHome();
    showScreen('home');
  });

  // Profile save
  document.getElementById('save-profile-btn')?.addEventListener('click', saveProfileForm);

  // Export / import
  document.getElementById('export-btn')?.addEventListener('click', handleExport);
  document.getElementById('import-btn')?.addEventListener('click', () => {
    document.getElementById('import-input').click();
  });
  document.getElementById('import-input')?.addEventListener('change', e => {
    if (e.target.files[0]) handleImport(e.target.files[0]);
    e.target.value = '';
  });

  // Reset
  document.getElementById('reset-btn')?.addEventListener('click', () => {
    if (confirm('Delete ALL data? This cannot be undone.')) {
      localStorage.clear();
      location.reload();
    }
  });

  // Session detail / edit buttons
  document.getElementById('sd-edit-btn')?.addEventListener('click', () => {
    if (detailSessionId) renderSessionEdit(detailSessionId);
  });
  document.getElementById('sd-delete-btn')?.addEventListener('click', () => {
    if (detailSessionId) deleteSession(detailSessionId);
  });
  document.getElementById('se-save-btn')?.addEventListener('click', saveEditSession);
  document.getElementById('se-cancel-btn')?.addEventListener('click', () => {
    if (detailSessionId) renderSessionDetail(detailSessionId);
  });

  // Onboarding
  initOnboarding();

  // Route to first screen
  const profile = getProfile();
  if (!profile) {
    showScreen('onboarding');
  } else {
    renderHome();
    showScreen('home');
  }
}

document.addEventListener('DOMContentLoaded', init);

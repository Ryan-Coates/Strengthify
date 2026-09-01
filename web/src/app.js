// =====================================================================
// Strengthify Web — UI / Application logic
// =====================================================================

// ── Screen registry ───────────────────────────────────────────────

const SCREENS = ['home', 'workout', 'logging', 'results', 'progress', 'standards', 'profile', 'onboarding', 'signin', 'session-detail', 'session-edit', 'plans', 'plan-builder', 'mobility'];
let currentScreen = null;
const KG_PER_LB = 0.45359237;
const LB_PER_KG = 1 / KG_PER_LB;

const THOUSAND_CLUB_LIFTS = ['Back Squat', 'Bench Press', 'Deadlift'];

function showScreen(id) {
  SCREENS.forEach(s => {
    const el = document.getElementById(s + '-screen');
    if (el) el.classList.toggle('hidden', s !== id);
  });
  document.getElementById('nav-bar').classList.toggle('hidden', id === 'onboarding' || id === 'signin' || id === 'plan-builder');
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

  renderThousandClubCard(pbs);

  // Plan next-workout card
  const plan = getActivePlan();
  const homePlanCard = document.getElementById('home-plan-card');
  if (plan) {
    let nextWeekNum = null, nextDayNum = null;
    outer:
    for (const week of plan.weeks) {
      for (const day of week.days) {
        if (!day.completedSessionId) { nextWeekNum = week.weekNum; nextDayNum = day.dayNum; break outer; }
      }
    }
    if (nextWeekNum !== null) {
      const nw = plan.weeks.find(w => w.weekNum === nextWeekNum);
      const nd = nw?.days.find(d => d.dayNum === nextDayNum);
      document.getElementById('home-plan-name').textContent = plan.name;
      document.getElementById('home-plan-next').textContent =
        `Week ${nextWeekNum} · ${nd ? nd.label : 'Next session'}`;
      document.getElementById('home-plan-start-btn').onclick =
        () => startPlanWorkout(plan.id, nextWeekNum, nextDayNum);
      homePlanCard.classList.remove('hidden');
    } else {
      homePlanCard.classList.add('hidden');
    }
  } else {
    homePlanCard.classList.add('hidden');
  }

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
    const pb = pbs[lift];
    let percentile = 0;
    let hasData = false;
    if (REP_BASED_LIFTS.has(lift)) {
      const maxReps = (pb && typeof pb === 'object') ? (pb.maxReps || 0) : 0;
      if (maxReps > 0) { percentile = getRepPercentile(lift, maxReps, profile); hasData = true; }
    } else {
      const rankWeight  = (pb && typeof pb === 'object') ? (pb.oneRepKg || pb.maxWeightKg || 0) : 0;
      if (rankWeight > 0) { percentile = getPercentile(lift, rankWeight, profile); hasData = true; }
    }
    const tier     = tierFromPercentile(percentile);
    const barClass = tierBarClass(tier);
    const div = document.createElement('div');
    div.className = 'bench-card bench-card-link';
    div.innerHTML = `
      <div class="bc-lift" title="${lift}">${lift}</div>
      <span class="bc-tier ${tierCssClass(tier)}">${hasData ? tier : '—'}</span>
      <div class="bc-bar-track"><div class="bc-bar-fill ${barClass}" style="width:${percentile}%"></div></div>
      <div class="bc-pct">${hasData ? ordinal(percentile) + ' percentile' : 'No data yet'}</div>`;
    div.addEventListener('click', () => {
      progressLift = lift;
      renderProgress();
      showScreen('progress');
    });
    grid.appendChild(div);
  });
}

function kgToLb(kg) {
  return kg * LB_PER_KG;
}

function formatWeightPair(kg) {
  const lb = kgToLb(kg);
  return `${Math.round(lb)} lb (${kg.toFixed(1)} kg)`;
}

function getLiftEstimatedMaxKg(pb) {
  if (!pb || typeof pb !== 'object') return 0;
  return pb.orm || 0;
}

function getLiftTrueMaxKg(pb) {
  if (!pb || typeof pb !== 'object') return 0;
  return Math.max(pb.oneRepKg || 0, pb.maxWeightKg || 0);
}

function renderThousandClubCard(pbs) {
  const profile = getProfile();
  const clubTargetLb = profile?.sex === 'female' ? 600 : 1000;
  const kickerEl = document.getElementById('club-kicker');
  if (kickerEl) kickerEl.textContent = `${clubTargetLb} lb club progress`;

  const liftValues = THOUSAND_CLUB_LIFTS.map(lift => ({
    lift,
    trueKg: getLiftTrueMaxKg(pbs[lift]),
    estKg: getLiftEstimatedMaxKg(pbs[lift]),
  }));

  const totalTrueKg = liftValues.reduce((sum, x) => sum + x.trueKg, 0);
  const totalEstKg = liftValues.reduce((sum, x) => sum + x.estKg, 0);
  const totalLb = kgToLb(totalTrueKg);
  const totalEstLb = kgToLb(totalEstKg);
  const pct = Math.min((totalLb / clubTargetLb) * 100, 100);
  const remainingLb = Math.max(0, clubTargetLb - totalLb);
  const remainingKg = remainingLb * KG_PER_LB;

  document.getElementById('club-total-lb').textContent = `${Math.round(totalLb)} lb (${totalTrueKg.toFixed(1)} kg)`;
  document.getElementById('club-total-kg').textContent = `Estimated total: ${Math.round(totalEstLb)} lb (${totalEstKg.toFixed(1)} kg)`;
  document.getElementById('club-progress-fill').style.width = `${pct.toFixed(1)}%`;
  document.getElementById('club-progress-pct').textContent = `${pct.toFixed(1)}%`;
  document.getElementById('club-remaining').textContent =
    remainingLb > 0
      ? `${Math.round(remainingLb)} lb (${remainingKg.toFixed(1)} kg) to go`
      : 'Goal unlocked';

  const achievementBadge = document.getElementById('club-achievement');
  if (achievementBadge) {
    achievementBadge.textContent = `${clubTargetLb} lb club achieved`;
    achievementBadge.classList.toggle('hidden', totalLb < clubTargetLb);
  }

  const byLift = {
    'Back Squat': 'club-squat',
    'Bench Press': 'club-bench',
    'Deadlift': 'club-deadlift',
  };
  liftValues.forEach(entry => {
    const el = document.getElementById(byLift[entry.lift]);
    if (!el) return;
    el.textContent = entry.trueKg > 0 ? formatWeightPair(entry.trueKg) : 'No data yet';
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

// ── Plan mode state ────────────────────────────────────────────────
let activePlanMode    = false;
let activePlanId      = null;
let activePlanWeekNum = null;
let activePlanDayNum  = null;
let planAccessoryLifts = [];   // non-benchmark exercise names for current plan session
let currentPlanViewWeek = null; // which week tab is selected on the plans screen

// Plan builder state
let planBuilderDays = [];

function renderLoggingScreen() {
  sessionSets = {};
  planAccessoryLifts = [];
  const container = document.getElementById('logging-lifts');
  container.innerHTML = '';

  const sessions = getSessions();

  // Collect plan exercise data if launching from a plan day
  const planBenchmarkMap = {}; // liftName -> exercise obj
  let planAccessoryExs = [];
  if (activePlanMode && activePlanId) {
    const plans = getPlans();
    const plan = plans.find(p => p.id === activePlanId);
    const week = plan?.weeks.find(w => w.weekNum === activePlanWeekNum);
    const day  = week?.days.find(d => d.dayNum  === activePlanDayNum);
    if (day) {
      day.exercises.forEach(ex => {
        if (ex.isBenchmark) {
          // Keep first occurrence if lift appears twice (shouldn't happen but guard it)
          if (!planBenchmarkMap[ex.name]) planBenchmarkMap[ex.name] = ex;
        } else {
          planAccessoryExs.push(ex);
        }
      });
    }
  }

  selectedLifts.forEach(lift => {
    sessionSets[lift] = [];

    // Find last session that had this lift
    let prevSets = null;
    for (const s of sessions) {
      const match = s.sets.filter(x => x.lift === lift);
      if (match.length > 0) { prevSets = match; break; }
    }

    const planEx = planBenchmarkMap[lift] || null;

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

    let hintText;
    if (planEx) {
      const wStr = planEx.targetWeightKg != null && planEx.targetWeightKg > 0
        ? ` @ ${planEx.targetWeightKg} kg` : '';
      const nStr = planEx.note ? ` — ${planEx.note}` : '';
      hintText = `Plan: ${planEx.sets} × ${planEx.reps}${wStr}${nStr}${liftNote}`;
    } else {
      hintText = prevSets
        ? `Previous: ${prevSets[0].weightKg}kg × ${prevSets[0].reps}${liftNote}`
        : `No previous data${liftNote}`;
    }

    section.innerHTML = `
      <h3>${lift}</h3>
      <p class="prev-hint">${hintText}</p>
      <div class="set-row-header"><span>Weight (kg)</span><span>Reps</span><span></span></div>
      <div class="set-rows"></div>
      <button class="btn btn-ghost btn-sm add-set-btn" data-lift="${lift}">+ Add Set</button>
    `;
    container.appendChild(section);

    if (planEx) {
      // Pre-create all planned sets with target weight / reps pre-filled
      for (let i = 0; i < planEx.sets; i++) {
        addSetRow(lift, { weightKg: planEx.targetWeightKg || 0, reps: planEx.reps }, true);
      }
    } else {
      addSetRow(lift, prevSets ? prevSets[0] : null);
    }

    section.querySelector('.add-set-btn').addEventListener('click', () => addSetRow(lift, null));
  });

  // Render accessory exercises for plan mode
  if (planAccessoryExs.length > 0) {
    const accHeader = document.createElement('div');
    accHeader.className = 'section-label';
    accHeader.style.cssText = 'margin-top:4px';
    accHeader.textContent = 'Accessories';
    container.appendChild(accHeader);

    planAccessoryExs.forEach(ex => {
      sessionSets[ex.name] = [];
      planAccessoryLifts.push(ex.name);

      const section = document.createElement('div');
      section.className = 'logging-lift';
      section.id = 'logging-lift-' + ex.name.replace(/[^a-z]/gi, '_');

      const wStr = ex.targetWeightKg != null && ex.targetWeightKg > 0
        ? ` @ ${ex.targetWeightKg} kg` : '';
      const nStr = ex.note ? ` — ${ex.note}` : '';

      section.innerHTML = `
        <h3>${ex.name}</h3>
        <p class="prev-hint">Plan: ${ex.sets} × ${ex.reps}${wStr}${nStr}</p>
        <div class="set-row-header"><span>Weight (kg)</span><span>Reps</span><span></span></div>
        <div class="set-rows"></div>
        <button class="btn btn-ghost btn-sm add-set-btn" data-lift="${ex.name}">+ Add Set</button>
      `;
      container.appendChild(section);

      for (let i = 0; i < ex.sets; i++) {
        addSetRow(ex.name, { weightKg: ex.targetWeightKg || 0, reps: ex.reps }, true);
      }

      section.querySelector('.add-set-btn').addEventListener('click', () => addSetRow(ex.name, null));
    });
  }
}

function addSetRow(lift, suggest, prefill = false) {
  const section  = document.getElementById('logging-lift-' + lift.replace(/[^a-z]/gi, '_'));
  const rowsDiv  = section.querySelector('.set-rows');
  const setIndex = rowsDiv.children.length;

  const initWeight = prefill && suggest ? (suggest.weightKg || 0) : 0;
  const initReps   = prefill && suggest ? (suggest.reps   || 0) : 0;
  sessionSets[lift].push({ weightKg: initWeight, reps: initReps });

  const weightAttr = prefill && suggest && suggest.weightKg != null
    ? `value="${suggest.weightKg}"`
    : `placeholder="${suggest ? suggest.weightKg : '0'}"`;
  const repsAttr = prefill && suggest
    ? `value="${suggest.reps}"`
    : `placeholder="${suggest ? suggest.reps : '0'}"`;

  const row = document.createElement('div');
  row.className = 'set-row';
  row.innerHTML = `
    <input type="number" min="0" step="0.5" ${weightAttr} class="weight-input" data-lift="${lift}" data-idx="${setIndex}">
    <input type="number" min="1" max="100" step="1" ${repsAttr} class="reps-input" data-lift="${lift}" data-idx="${setIndex}">
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

  // Flatten sets — benchmark lifts + plan accessories
  const allLifts = [...selectedLifts, ...planAccessoryLifts];
  const allSets = [];
  for (const lift of allLifts) {
    for (const s of (sessionSets[lift] || [])) {
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
  if (activePlanMode && activePlanId) {
    session.planRef = { planId: activePlanId, weekNum: activePlanWeekNum, dayNum: activePlanDayNum };
  }
  saveSession(session);

  // Mark plan day complete
  if (activePlanMode && activePlanId) {
    markPlanDayComplete(activePlanId, activePlanWeekNum, activePlanDayNum, session.id);
  }

  // Reset plan mode
  activePlanMode    = false;
  activePlanId      = null;
  activePlanWeekNum = null;
  activePlanDayNum  = null;
  planAccessoryLifts = [];

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

// ── Plans screen ──────────────────────────────────────────────────

function startPlanWorkout(planId, weekNum, dayNum) {
  const plans = getPlans();
  const plan = plans.find(p => p.id === planId);
  if (!plan) return;
  const week = plan.weeks.find(w => w.weekNum === weekNum);
  const day  = week?.days.find(d => d.dayNum  === dayNum);
  if (!day) return;

  activePlanMode    = true;
  activePlanId      = planId;
  activePlanWeekNum = weekNum;
  activePlanDayNum  = dayNum;

  // Build selectedLifts from benchmark exercises in this day (deduplicated, preserving order)
  const seen = new Set();
  selectedLifts = [];
  day.exercises.forEach(ex => {
    if (ex.isBenchmark && !seen.has(ex.name)) {
      seen.add(ex.name);
      selectedLifts.push(ex.name);
    }
  });

  renderLoggingScreen();
  showScreen('logging');
}

function renderPlans() {
  const plan = getActivePlan();
  const activeView = document.getElementById('plan-active-view');
  const emptyState = document.getElementById('plan-empty-state');

  if (!plan) {
    activeView.classList.add('hidden');
    emptyState.classList.remove('hidden');
    return;
  }
  activeView.classList.remove('hidden');
  emptyState.classList.add('hidden');

  // Find next incomplete day (global next, not filtered by week tab)
  let nextWeekNum = null, nextDayNum = null;
  outer:
  for (const week of plan.weeks) {
    for (const day of week.days) {
      if (!day.completedSessionId) {
        nextWeekNum = week.weekNum;
        nextDayNum  = day.dayNum;
        break outer;
      }
    }
  }

  // Progress counts
  const completedCount = plan.weeks.reduce((n, w) => n + w.days.filter(d => d.completedSessionId).length, 0);
  const totalCount     = plan.weeks.reduce((n, w) => n + w.days.length, 0);
  const pct = totalCount > 0 ? (completedCount / totalCount * 100).toFixed(1) : 0;

  document.getElementById('plan-name').textContent = plan.name;
  document.getElementById('plan-started').textContent = `Started ${formatDate(plan.startDate)}`;
  document.getElementById('plan-progress-bar-fill').style.width = pct + '%';
  document.getElementById('plan-progress-text').textContent =
    completedCount < totalCount
      ? `${completedCount} / ${totalCount} sessions complete`
      : '🏆 Plan complete!';

  // Default view week = the week containing the next session (or 1 if all done)
  if (currentPlanViewWeek === null) {
    currentPlanViewWeek = nextWeekNum || 1;
  }

  // Week tabs
  const weekTabsEl = document.getElementById('plan-week-tabs');
  weekTabsEl.innerHTML = '';
  plan.weeks.forEach(week => {
    const allDone = week.days.every(d => d.completedSessionId);
    const tab = document.createElement('button');
    tab.className = 'plan-week-tab' + (week.weekNum === currentPlanViewWeek ? ' active' : '') + (allDone ? ' done' : '');
    tab.textContent = `W${week.weekNum}`;
    tab.title = week.label;
    tab.addEventListener('click', () => {
      currentPlanViewWeek = week.weekNum;
      renderPlans();
    });
    weekTabsEl.appendChild(tab);
  });

  // Days list for selected week
  const selectedWeek = plan.weeks.find(w => w.weekNum === currentPlanViewWeek);
  const daysListEl = document.getElementById('plan-days-list');
  daysListEl.innerHTML = '';

  if (selectedWeek) {
    const weekLabelEl = document.createElement('div');
    weekLabelEl.className = 'section-label';
    weekLabelEl.textContent = selectedWeek.label;
    daysListEl.appendChild(weekLabelEl);

    selectedWeek.days.forEach(day => {
      const isCompleted = !!day.completedSessionId;
      const isNext      = day.dayNum === nextDayNum && selectedWeek.weekNum === nextWeekNum;

      const card = document.createElement('div');
      card.className = 'card plan-day-card' +
        (isCompleted ? ' plan-day-done' : '') +
        (isNext ? ' plan-day-next' : '');

      const benchCount = day.exercises.filter(ex => ex.isBenchmark).length;
      const totalEx    = day.exercises.length;

      const exercisesHTML = day.exercises.map(ex => {
        const wStr = ex.targetWeightKg != null && ex.targetWeightKg > 0 ? ` @ ${ex.targetWeightKg} kg` : '';
        const noteStr = ex.note ? `<span class="plan-ex-note"> · ${ex.note}</span>` : '';
        return `<div class="plan-exercise-row">
          <span class="plan-ex-name${ex.isBenchmark ? '' : ' plan-ex-acc'}">${ex.name}</span>
          <span class="plan-ex-prescription">${ex.sets}&thinsp;×&thinsp;${ex.reps}${wStr}</span>
          ${noteStr}
        </div>`;
      }).join('');

      const statusBadge = isCompleted
        ? '<span class="plan-status-badge done">Done</span>'
        : isNext
        ? '<span class="plan-status-badge next">Next</span>'
        : '';

      const statusIcon = isCompleted ? '✓' : isNext ? '▶' : '○';
      const metaStr = `${totalEx} exercises${benchCount < totalEx ? ` · ${totalEx - benchCount} accessory` : ''}`;

      card.innerHTML = `
        <div class="plan-day-header">
          <div class="plan-day-status-icon">${statusIcon}</div>
          <div class="plan-day-info">
            <div class="plan-day-name">${day.label}</div>
            <div class="plan-day-meta">${metaStr}</div>
          </div>
          ${statusBadge}
        </div>
        <div class="plan-day-exercises${isNext || isCompleted ? '' : ' hidden'}">
          ${exercisesHTML}
          ${isNext ? `<div style="margin-top:10px"><button class="btn btn-primary plan-day-start-btn" data-week="${selectedWeek.weekNum}" data-day="${day.dayNum}">Start this workout →</button></div>` : ''}
        </div>
      `;

      // Toggle expand/collapse on header click
      card.querySelector('.plan-day-header').addEventListener('click', () => {
        card.querySelector('.plan-day-exercises').classList.toggle('hidden');
      });

      // Start button inside card
      card.querySelector('.plan-day-start-btn')?.addEventListener('click', e => {
        e.stopPropagation();
        startPlanWorkout(plan.id, selectedWeek.weekNum, day.dayNum);
      });

      daysListEl.appendChild(card);
    });
  }

  // Global "Start next workout" button
  const startBtn = document.getElementById('start-next-plan-btn');
  if (nextDayNum !== null) {
    startBtn.disabled = false;
    const nw = plan.weeks.find(w => w.weekNum === nextWeekNum);
    const nd = nw?.days.find(d => d.dayNum === nextDayNum);
    startBtn.textContent = `Start ${nd ? nd.label : 'next workout'} (W${nextWeekNum}) →`;
    startBtn.onclick = () => startPlanWorkout(plan.id, nextWeekNum, nextDayNum);
  } else {
    startBtn.disabled = true;
    startBtn.textContent = 'Plan Complete! 🏆';
  }
}

// ── Plan builder ──────────────────────────────────────────────────

function initPlanBuilder() {
  planBuilderDays = [
    { name: '', exercises: [{ name: '', sets: 3, reps: 10, weightKg: null }] },
  ];
  document.getElementById('pb-plan-name').value = '';
  document.getElementById('pb-weeks').value     = '8';
  renderPlanBuilderDays();
}

// Flush current DOM input values → planBuilderDays (safety before any re-render)
function flushPlanBuilderInputs() {
  document.querySelectorAll('#pb-days-container .pb-day-card').forEach((card, di) => {
    if (!planBuilderDays[di]) return;
    const n = card.querySelector('.pb-day-name');
    if (n) planBuilderDays[di].name = n.value;
    card.querySelectorAll('.pb-ex-row').forEach((row, ei) => {
      const ex = planBuilderDays[di].exercises[ei];
      if (!ex) return;
      const nE = row.querySelector('.pb-ex-name');
      const sE = row.querySelector('.pb-ex-sets');
      const rE = row.querySelector('.pb-ex-reps');
      const wE = row.querySelector('.pb-ex-weight');
      if (nE) ex.name     = nE.value;
      if (sE) ex.sets     = parseInt(sE.value) || 0;
      if (rE) ex.reps     = parseInt(rE.value) || 0;
      if (wE) ex.weightKg = wE.value !== '' ? parseFloat(wE.value) : null;
    });
  });
}

function renderPlanBuilderDays() {
  const container = document.getElementById('pb-days-container');
  container.innerHTML = '';

  planBuilderDays.forEach((day, di) => {
    const card = document.createElement('div');
    card.className = 'card pb-day-card';
    card.style.marginBottom = '10px';

    const exRowsHTML = day.exercises.map((ex, ei) => `
      <div class="pb-ex-row" data-di="${di}" data-ei="${ei}">
        <input class="form-input pb-ex-name"   placeholder="Exercise name" value="${ex.name || ''}">
        <input class="form-input pb-ex-sets"   type="number" min="1" max="20"  placeholder="Sets"  value="${ex.sets  || ''}">
        <input class="form-input pb-ex-reps"   type="number" min="1" max="100" placeholder="Reps"  value="${ex.reps  || ''}">
        <input class="form-input pb-ex-weight" type="number" min="0" step="0.5" placeholder="kg"   value="${ex.weightKg != null ? ex.weightKg : ''}">
        <button class="del-set-btn pb-rm-ex" data-di="${di}" data-ei="${ei}" title="Remove">✕</button>
      </div>`).join('');

    card.innerHTML = `
      <div class="pb-day-header">
        <input class="form-input pb-day-name" placeholder="Day name e.g. Squat" value="${day.name || ''}">
        <button class="btn btn-ghost btn-sm pb-rm-day" data-di="${di}" style="color:var(--muted);flex-shrink:0">Remove</button>
      </div>
      <div class="pb-ex-header">
        <span>Exercise</span><span>Sets</span><span>Reps</span><span>kg</span><span></span>
      </div>
      <div class="pb-ex-list">
        ${exRowsHTML || '<p style="font-size:12px;color:var(--muted);margin:4px 0 4px">No exercises yet</p>'}
      </div>
      <button class="btn btn-ghost btn-sm pb-add-ex" data-di="${di}" style="margin-top:6px">+ Add exercise</button>
    `;

    // Day name — direct mutation
    card.querySelector('.pb-day-name').addEventListener('input', e => {
      planBuilderDays[di].name = e.target.value;
    });

    // Remove day
    card.querySelector('.pb-rm-day').addEventListener('click', () => {
      flushPlanBuilderInputs();
      planBuilderDays.splice(di, 1);
      renderPlanBuilderDays();
    });

    // Add exercise
    card.querySelector('.pb-add-ex').addEventListener('click', () => {
      flushPlanBuilderInputs();
      planBuilderDays[di].exercises.push({ name: '', sets: 3, reps: 10, weightKg: null });
      renderPlanBuilderDays();
      // Focus the new exercise name input
      const rows = container.querySelectorAll(`.pb-day-card:nth-child(${di + 1}) .pb-ex-name`);
      if (rows.length) rows[rows.length - 1].focus();
    });

    // Remove exercise
    card.querySelectorAll('.pb-rm-ex').forEach(btn => {
      btn.addEventListener('click', () => {
        flushPlanBuilderInputs();
        planBuilderDays[parseInt(btn.dataset.di)].exercises.splice(parseInt(btn.dataset.ei), 1);
        renderPlanBuilderDays();
      });
    });

    // Exercise field changes — direct mutation (no re-render)
    card.querySelectorAll('.pb-ex-row').forEach(row => {
      const d = parseInt(row.dataset.di), e = parseInt(row.dataset.ei);
      row.querySelector('.pb-ex-name').addEventListener('input',   ev => { planBuilderDays[d].exercises[e].name     = ev.target.value; });
      row.querySelector('.pb-ex-sets').addEventListener('input',   ev => { planBuilderDays[d].exercises[e].sets     = parseInt(ev.target.value) || 0; });
      row.querySelector('.pb-ex-reps').addEventListener('input',   ev => { planBuilderDays[d].exercises[e].reps     = parseInt(ev.target.value) || 0; });
      row.querySelector('.pb-ex-weight').addEventListener('input', ev => { planBuilderDays[d].exercises[e].weightKg = ev.target.value !== '' ? parseFloat(ev.target.value) : null; });
    });

    container.appendChild(card);
  });
}

function savePlanFromBuilder() {
  flushPlanBuilderInputs();

  const name     = document.getElementById('pb-plan-name').value.trim();
  const numWeeks = Math.max(1, Math.min(24, parseInt(document.getElementById('pb-weeks').value) || 8));

  if (!name) { toast('Please enter a plan name.', 'error'); return; }
  if (planBuilderDays.length === 0) { toast('Add at least one training day.', 'error'); return; }
  for (const d of planBuilderDays) {
    if (!d.name.trim())           { toast('All days need a name.', 'error'); return; }
    if (d.exercises.length === 0) { toast(`Day "${d.name}" has no exercises.`, 'error'); return; }
    for (const ex of d.exercises) {
      if (!ex.name.trim()) { toast('All exercises need a name.', 'error'); return; }
      if (!(ex.sets  > 0)) { toast(`Invalid sets for "${ex.name}".`, 'error'); return; }
      if (!(ex.reps  > 0)) { toast(`Invalid reps for "${ex.name}".`, 'error'); return; }
    }
  }

  const LIFTS_SET = new Set(LIFTS);
  const weeks = [];
  for (let w = 1; w <= numWeeks; w++) {
    weeks.push({
      weekNum: w, label: `Week ${w}`, type: 'volume',
      days: planBuilderDays.map((d, i) => ({
        dayNum: i + 1, label: d.name.trim(), completedSessionId: null,
        exercises: d.exercises.map(ex => ({
          name: ex.name.trim(), sets: ex.sets, reps: ex.reps,
          targetWeightKg: ex.weightKg,
          isBenchmark: LIFTS_SET.has(ex.name.trim()),
          note: '',
        })),
      })),
    });
  }

  const existing = getActivePlan();
  if (existing) {
    if (!confirm(`Replace current plan "${existing.name}"?\nYour completed sessions are kept.`)) return;
    deletePlan(existing.id);
  }

  const newPlan = { id: uuid(), name, startDate: today(), active: true, weeks };
  savePlan(newPlan);
  currentPlanViewWeek = 1;
  toast(`Plan "${name}" saved!`);
  renderHome();
  renderPlans();
  showScreen('plans');
}

// ── Progress screen ───────────────────────────────────────────────

let progressLift = LIFTS[0];

function renderProgress() {
  const profile = getProfile();
  if (!profile) return;

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

  const pbs = getPBs();
  const rawPB = pbs[progressLift];
  const pb = (rawPB && typeof rawPB === 'object') ? rawPB : { orm: rawPB || 0, oneRepKg: 0, maxReps: 0, maxRepsKg: 0, maxWeightKg: 0 };
  const sessions = getSessions().slice().reverse(); // oldest first
  const isRepBased = REP_BASED_LIFTS.has(progressLift);

  // Gather data points
  const points = [];
  sessions.forEach(s => {
    const liftSets = s.sets.filter(x => x.lift === progressLift);
    if (liftSets.length > 0) {
      if (isRepBased) {
        const bestReps = Math.max(...liftSets.map(x => x.reps));
        points.push({ x: s.date, y: bestReps });
      } else {
        const bestORM = Math.max(...liftSets.map(x => epley1RM(effectiveWeight(progressLift, x.weightKg, profile), x.reps)));
        points.push({ x: s.date, y: parseFloat(bestORM.toFixed(2)) });
      }
    }
  });

  const canvas = document.getElementById('progress-chart');
  canvas.closest('.chart-container').querySelector('h3').textContent =
    isRepBased ? 'Max reps over time' : 'Estimated 1RM over time';
  drawLineChart(canvas, points, { height: 200 });

  // Stats panel
  let statsHTML = '';
  if (isRepBased) {
    const repBenchmark = getRepBenchmark(progressLift, profile);
    const percentile   = pb.maxReps > 0 ? getRepPercentile(progressLift, pb.maxReps, profile) : 0;
    const tier         = tierFromPercentile(percentile);
    statsHTML = `
      <div class="result-row"><span class="rr-label">Best set</span><span class="rr-val">${pb.maxReps > 0 ? pb.maxReps + ' reps' : '—'}</span></div>
      <div class="result-row"><span class="rr-label">50th pct reference</span><span class="rr-val">${repBenchmark ? repBenchmark + ' reps' : '—'}</span></div>
      <div class="result-row"><span class="rr-label">Percentile</span><span class="rr-val">${pb.maxReps > 0 ? ordinal(percentile) : '—'}</span></div>
      <div class="result-row"><span class="rr-label">Tier</span><span class="rr-val">${pb.maxReps > 0 ? '<span class="bc-tier ' + tierCssClass(tier) + '">' + tier + '</span>' : '—'}</span></div>
    `;
  } else {
    const benchmark  = getBenchmark(progressLift, profile);
    const orm        = pb.orm || 0;
    const rankWeight = pb.oneRepKg || pb.maxWeightKg || 0;
    const isTrue1RM  = pb.oneRepKg > 0;
    const percentile = rankWeight > 0 ? getPercentile(progressLift, rankWeight, profile) : 0;
    const tier       = tierFromPercentile(percentile);
    const weightLabel = isTrue1RM ? `${rankWeight} kg (1-rep)` : (rankWeight > 0 ? `${rankWeight} kg (best weight)` : '—');
    const repPRStr = pb.maxReps > 0
      ? (pb.maxRepsKg > 0 ? `${pb.maxReps} reps @ ${pb.maxRepsKg} kg` : `${pb.maxReps} reps (bodyweight)`)
      : '—';
    statsHTML = `
      <div class="result-row"><span class="rr-label">Best est. 1RM</span><span class="rr-val">${orm > 0 ? orm.toFixed(1) + ' kg' : '—'}</span></div>
      <div class="result-row"><span class="rr-label">Ranking weight</span><span class="rr-val">${weightLabel}</span></div>
      <div class="result-row"><span class="rr-label">Best rep set</span><span class="rr-val">${repPRStr}</span></div>
      <div class="result-row"><span class="rr-label">50th pct reference</span><span class="rr-val">${benchmark ? benchmark.toFixed(1) + ' kg' : '—'}</span></div>
      <div class="result-row"><span class="rr-label">Percentile</span><span class="rr-val">${rankWeight > 0 ? ordinal(percentile) : '—'}</span></div>
      <div class="result-row"><span class="rr-label">Tier</span><span class="rr-val">${rankWeight > 0 ? '<span class="bc-tier ' + tierCssClass(tier) + '">' + tier + '</span>' : '—'}</span></div>
    `;
  }
  document.getElementById('progress-tier').innerHTML = statsHTML;
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
    const rawPB = pbs[lift];

    if (REP_BASED_LIFTS.has(lift)) {
      const repStd = REP_STANDARDS[lift];
      if (!repStd) return;
      const myReps = (rawPB && typeof rawPB === 'object') ? (rawPB.maxReps || 0) : 0;
      const myPct  = myReps > 0 ? getRepPercentile(lift, myReps, profile) : null;
      const myTier = myPct !== null ? tierFromPercentile(myPct) : null;

      const myRow = myReps > 0
        ? `<div class="std-my-row">
             <span class="bc-tier ${tierCssClass(myTier)}">${myTier}</span>
             <span style="margin-left:8px;font-size:13px;color:var(--muted)">${myReps} reps &mdash; ${ordinal(myPct)} percentile</span>
           </div>`
        : `<div style="font-size:12px;color:var(--muted);margin-bottom:10px">No sets logged yet</div>`;

      const rows = tiers.map(t => {
        const refReps    = interpRatio(repStd[sex], t.pct);
        const scaledReps = Math.round(refReps * Math.sqrt(repStd.refBW[sex] / bw) * af);
        const active     = myTier === t.label;
        return `<div class="std-row${active ? ' std-row-me' : ''}">
          <span class="bc-tier ${tierCssClass(t.label)}" style="min-width:108px">${t.label}</span>
          <span class="std-pct">${ordinal(t.pct)}+</span>
          <span class="std-kg">&ge;${scaledReps} reps</span>
        </div>`;
      }).join('');

      const card = document.createElement('div');
      card.className = 'card';
      card.style.marginBottom = '12px';
      card.innerHTML = `
        <div class="card-title">${lift}</div>
        ${myRow}
        <div class="std-table">${rows}</div>
      `;
      container.appendChild(card);
      return;
    }

    const std = STRENGTH_STANDARDS[lift];
    if (!std) return;
    const bp  = sex === 'female' ? std.female : std.male;

    const myRankWeight = (rawPB && typeof rawPB === 'object') ? (rawPB.oneRepKg || rawPB.maxWeightKg || 0) : 0;
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

  renderSyncCard(syncCurrentUser());
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
  syncDeleteSession(sessionId);
  const sessions = getSessions().filter(s => s.id !== sessionId);
  localStorage.setItem(KEYS.SESSIONS, JSON.stringify(sessions));
  recalculateAllPBsAndXP();
  toast('Workout deleted.');
  renderHome();
  showScreen('home');
}

// ── Share card ────────────────────────────────────────────────────

const TIER_COLORS = {
  'Untrained':    '#c04040',
  'Beginner':     '#e07840',
  'Novice':       '#f5a623',
  'Intermediate': '#4caf7d',
  'Advanced':     '#4a9fe0',
  'Elite':        '#7c6af7',
  'World Class':  '#ffd700',
};

function drawShareCard() {
  const profile  = getProfile();
  const pbs      = getPBs();
  const sessions = getSessions();
  if (!profile) return;

  // Collect only lifts with data
  const rows = [];
  LIFTS.forEach(lift => {
    const pb = pbs[lift];
    if (!pb || typeof pb !== 'object') return;
    if (REP_BASED_LIFTS.has(lift)) {
      if (!pb.maxReps) return;
      const pct  = getRepPercentile(lift, pb.maxReps, profile);
      const tier = tierFromPercentile(pct);
      rows.push({ lift, value: `${pb.maxReps} reps`, tier, pct });
    } else {
      const rw = pb.oneRepKg || pb.maxWeightKg || 0;
      if (!rw) return;
      const pct  = getPercentile(lift, rw, profile);
      const tier = tierFromPercentile(pct);
      rows.push({ lift, value: `${rw} kg`, tier, pct });
    }
  });

  // Card dimensions
  const W   = 600;
  const PAD = 28;
  const HEADER_H = 100;
  const META_H   = 64;
  const ROW_H    = 52;
  const FOOTER_H = 50;
  const H = HEADER_H + META_H + (rows.length || 1) * ROW_H + FOOTER_H + PAD;

  const canvas = document.getElementById('share-canvas');
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#0f0f12';
  ctx.fillRect(0, 0, W, H);

  // Accent gradient bar at top
  const grad = ctx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, '#7c6af7');
  grad.addColorStop(1, '#5b4ecf');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, 5);

  // ── Header (dumbbell icon + app name) ────────────────────────────
  let y = 28;
  // Dumbbell icon (simple canvas draw)
  const drawDumbbell = (cx, cy, sz) => {
    ctx.fillStyle = '#7c6af7';
    // bar
    ctx.beginPath(); ctx.roundRect(cx - sz * 0.7, cy - sz * 0.09, sz * 1.4, sz * 0.18, sz * 0.09); ctx.fill();
    // left plate
    ctx.beginPath(); ctx.roundRect(cx - sz * 0.9, cy - sz * 0.38, sz * 0.25, sz * 0.76, sz * 0.1); ctx.fill();
    // left collar
    ctx.beginPath(); ctx.roundRect(cx - sz * 0.7, cy - sz * 0.28, sz * 0.15, sz * 0.56, sz * 0.07); ctx.fill();
    // right plate
    ctx.beginPath(); ctx.roundRect(cx + sz * 0.65, cy - sz * 0.38, sz * 0.25, sz * 0.76, sz * 0.1); ctx.fill();
    // right collar
    ctx.beginPath(); ctx.roundRect(cx + sz * 0.55, cy - sz * 0.28, sz * 0.15, sz * 0.56, sz * 0.07); ctx.fill();
  };
  drawDumbbell(PAD + 22, y + 22, 26);

  ctx.fillStyle = '#e8e8f0';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('Strengthify', PAD + 58, y + 22);

  ctx.fillStyle = '#8888aa';
  ctx.font = '14px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('Benchmark Report', W - PAD, y + 22);
  ctx.textAlign = 'left';

  // Divider
  y = HEADER_H - 14;
  ctx.strokeStyle = '#2e2e40';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke();

  // ── Meta (name + level) ───────────────────────────────────────────
  y = HEADER_H + 2;
  ctx.fillStyle = '#e8e8f0';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(profile.name, PAD, y + 22);

  ctx.fillStyle = '#7c6af7';
  ctx.font = 'bold 14px system-ui, sans-serif';
  const lvlTitle = levelTitle(profile.level);
  ctx.fillText(`Lv${profile.level}  ${lvlTitle}`, PAD, y + 42);

  ctx.fillStyle = '#8888aa';
  ctx.font = '13px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`${sessions.length} workouts`, W - PAD, y + 32);
  ctx.textAlign = 'left';

  // Divider
  y = HEADER_H + META_H - 2;
  ctx.strokeStyle = '#2e2e40';
  ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke();

  // ── Lift rows ─────────────────────────────────────────────────────
  if (rows.length === 0) {
    y = HEADER_H + META_H + ROW_H / 2;
    ctx.fillStyle = '#8888aa';
    ctx.font = '15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('No benchmarks logged yet', W / 2, y + ROW_H / 2);
    ctx.textAlign = 'left';
  } else {
    rows.forEach((row, i) => {
      const ry = HEADER_H + META_H + i * ROW_H;
      const midY = ry + ROW_H / 2;

      // Lift name
      ctx.fillStyle = '#e8e8f0';
      ctx.font = '14px system-ui, sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillText(row.lift, PAD, midY);

      // Value (weight / reps)
      ctx.fillStyle = '#8888aa';
      ctx.font = '13px system-ui, sans-serif';
      ctx.fillText(row.value, PAD + 200, midY);

      // Tier pill
      const tierColor = TIER_COLORS[row.tier] || '#8888aa';
      const pillText = row.tier.toUpperCase();
      ctx.font = 'bold 10px system-ui, sans-serif';
      const pillW = ctx.measureText(pillText).width + 20;
      const pillX = W - PAD - pillW;
      const pillY = midY - 11;
      ctx.fillStyle = tierColor + '33'; // 20% opacity bg
      ctx.beginPath(); ctx.roundRect(pillX, pillY, pillW, 22, 11); ctx.fill();
      ctx.fillStyle = tierColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pillText, pillX + pillW / 2, midY);
      ctx.textAlign = 'left';

      // Progress bar (behind tier pill, to the right of value)
      const barX = PAD + 275;
      const barW = W - PAD - pillW - 16 - barX;
      const barH = 5;
      const barY = midY - barH / 2;
      ctx.fillStyle = '#22222e';
      ctx.beginPath(); ctx.roundRect(barX, barY, barW, barH, barH / 2); ctx.fill();
      ctx.fillStyle = tierColor;
      ctx.beginPath(); ctx.roundRect(barX, barY, barW * (row.pct / 100), barH, barH / 2); ctx.fill();

      // Row separator
      if (i < rows.length - 1) {
        ctx.strokeStyle = '#1e1e28';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(PAD, ry + ROW_H); ctx.lineTo(W - PAD, ry + ROW_H); ctx.stroke();
      }
    });
  }

  // ── Footer ────────────────────────────────────────────────────────
  const footerY = H - FOOTER_H;
  ctx.strokeStyle = '#2e2e40';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(PAD, footerY + 12); ctx.lineTo(W - PAD, footerY + 12); ctx.stroke();
  ctx.fillStyle = '#8888aa';
  ctx.font = '12px system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText(new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }), PAD, footerY + 32);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#7c6af7';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillText('strengthify', W - PAD, footerY + 32);
  ctx.textAlign = 'left';
}

function openShareModal() {
  const modal = document.getElementById('share-modal');
  modal.classList.remove('hidden');
  // Show native share button if available
  if (navigator.share) {
    document.getElementById('share-native-btn').style.display = '';
  }
  // Draw after a tick so canvas is visible and has layout
  requestAnimationFrame(() => drawShareCard());
}

function closeShareModal() {
  document.getElementById('share-modal').classList.add('hidden');
}

function shareDownload() {
  const canvas = document.getElementById('share-canvas');
  const a = document.createElement('a');
  a.download = 'strengthify-benchmarks.png';
  a.href = canvas.toDataURL('image/png');
  a.click();
}

async function shareNative() {
  const canvas = document.getElementById('share-canvas');
  canvas.toBlob(async blob => {
    try {
      const file = new File([blob], 'strengthify-benchmarks.png', { type: 'image/png' });
      await navigator.share({ files: [file], title: 'My Strengthify Benchmarks' });
    } catch {
      // User cancelled or share failed — silent
    }
  }, 'image/png');
}

function shareCopyText() {
  const profile = getProfile();
  const pbs     = getPBs();
  if (!profile) return;
  const lines = [
    `💪 ${profile.name} — Lv${profile.level} ${levelTitle(profile.level)}`,
    `Strengthify Benchmark Report`,
    '',
  ];
  LIFTS.forEach(lift => {
    const pb = pbs[lift];
    if (!pb || typeof pb !== 'object') return;
    if (REP_BASED_LIFTS.has(lift)) {
      if (!pb.maxReps) return;
      const tier = tierFromPercentile(getRepPercentile(lift, pb.maxReps, profile));
      lines.push(`${lift}: ${pb.maxReps} reps — ${tier}`);
    } else {
      const rw = pb.oneRepKg || pb.maxWeightKg || 0;
      if (!rw) return;
      const tier = tierFromPercentile(getPercentile(lift, rw, profile));
      lines.push(`${lift}: ${rw} kg — ${tier}`);
    }
  });
  navigator.clipboard.writeText(lines.join('\n'))
    .then(() => toast('Copied to clipboard!'))
    .catch(() => toast('Copy failed', 'error'));
}

// ── Cloud Sync UI ─────────────────────────────────────────────────

function renderSyncCard(user) {
  const elUnconfigured = document.getElementById('sync-state-unconfigured');
  const elSignedOut    = document.getElementById('sync-state-signedout');
  const elSignedIn     = document.getElementById('sync-state-signedin');
  if (!elUnconfigured) return;

  if (!syncIsConfigured()) {
    elUnconfigured.classList.remove('hidden');
    elSignedOut.classList.add('hidden');
    elSignedIn.classList.add('hidden');
    return;
  }
  if (!user) {
    elUnconfigured.classList.add('hidden');
    elSignedOut.classList.remove('hidden');
    elSignedIn.classList.add('hidden');
  } else {
    elUnconfigured.classList.add('hidden');
    elSignedOut.classList.add('hidden');
    elSignedIn.classList.remove('hidden');
    document.getElementById('sync-user-name').textContent  = user.displayName || '';
    document.getElementById('sync-user-email').textContent = user.email || '';
    const avatar = document.getElementById('sync-avatar');
    if (user.photoURL) {
      avatar.src = user.photoURL;
      avatar.style.display = '';
    } else {
      avatar.style.display = 'none';
    }
  }
}

function setSyncStatus(status) {
  const badge = document.getElementById('sync-status-badge');
  if (!badge) return;
  if (status === 'syncing') {
    badge.innerHTML = '<span style="font-size:11px;color:var(--muted)">Syncing…</span>';
  } else if (status === 'synced') {
    badge.innerHTML = '<span style="font-size:11px;color:#4caf7d">● Synced</span>';
  } else if (status === 'error') {
    badge.innerHTML = '<span style="font-size:11px;color:var(--red)">● Error</span>';
  }
}

function initSync() {
  syncInit();

  let isFirstAuth = true;

  syncOnAuthChange(async user => {
    renderSyncCard(user);
    if (user) {
      if (isFirstAuth) {
        isFirstAuth = false;
        setSyncStatus('syncing');
        let newSessions = 0;
        try {
          const result = await syncMergeOnSignIn();
          setSyncStatus('synced');
          newSessions = result.newSessions;
        } catch (e) {
          console.error('[Sync] Merge on sign-in failed:', e);
          setSyncStatus('error');
        }
        // Route after merge so a cloud profile is available before deciding
        const profile = getProfile();
        if (!profile) {
          showScreen('onboarding');
        } else {
          renderHome();
          showScreen('home');
          if (newSessions > 0) {
            toast(`Synced ${newSessions} new workout${newSessions > 1 ? 's' : ''} from cloud.`);
          }
        }
      }
    } else {
      isFirstAuth = true;
      if (syncIsConfigured()) showScreen('signin');
    }
  });

  // Welcome screen sign-in button
  document.getElementById('welcome-signin-btn')?.addEventListener('click', async () => {
    try {
      await syncSignIn();
    } catch (e) {
      if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
        toast('Sign-in failed. Check your Firebase config.', 'error');
      }
    }
  });

  // Continue without sync — use local storage only
  document.getElementById('continue-local-btn')?.addEventListener('click', () => {
    const profile = getProfile();
    if (!profile) {
      showScreen('onboarding');
    } else {
      renderHome();
      showScreen('home');
    }
  });

  // Profile screen sign-in button (same handler)
  document.getElementById('sync-signin-btn')?.addEventListener('click', async () => {
    try {
      await syncSignIn();
    } catch (e) {
      if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
        toast('Sign-in failed. Check your Firebase config.', 'error');
      }
    }
  });

  document.getElementById('sync-signout-btn')?.addEventListener('click', async () => {
    await syncSignOut();
    toast('Signed out from sync. Local data kept.');
  });

  document.getElementById('sync-now-btn')?.addEventListener('click', async () => {
    setSyncStatus('syncing');
    try {
      const result = await syncMergeOnSignIn();
      setSyncStatus('synced');
      if (result.newSessions > 0) {
        toast(`Synced ${result.newSessions} new workout${result.newSessions > 1 ? 's' : ''}.`);
        renderHome();
      } else {
        toast('Already up to date.');
      }
    } catch (e) {
      setSyncStatus('error');
      toast('Sync failed.', 'error');
    }
  });
}

// ── Mobility routine ──────────────────────────────────────────────

let mobilityBlockIdx = 0;
let mobilityExerciseIdx = 0;
const MOBILITY_DOT_COLORS = { orange: 'var(--mob-orange)', blue: 'var(--mob-blue)', green: 'var(--mob-green)', purple: 'var(--mob-purple)' };

// Random index into block.exercises, avoiding an immediate repeat when possible
function randomMobilityExerciseIdx(block, excludeIdx) {
  if (block.exercises.length === 1) return 0;
  let idx;
  do { idx = Math.floor(Math.random() * block.exercises.length); } while (idx === excludeIdx);
  return idx;
}

function startMobility() {
  mobilityBlockIdx = 0;
  mobilityExerciseIdx = randomMobilityExerciseIdx(MOBILITY_ROUTINE.blocks[0], -1);
  renderMobilityExercise();
  showScreen('mobility');
}

function renderMobilityExercise() {
  const block    = MOBILITY_ROUTINE.blocks[mobilityBlockIdx];
  const exercise = block.exercises[mobilityExerciseIdx];
  const dotColor = MOBILITY_DOT_COLORS[block.color] || 'var(--accent)';
  const isLastBlock = mobilityBlockIdx === MOBILITY_ROUTINE.blocks.length - 1;

  document.getElementById('mobility-card').style.borderTopColor = dotColor;
  document.getElementById('mobility-block-label').textContent = `Block ${mobilityBlockIdx + 1} of ${MOBILITY_ROUTINE.blocks.length} \u00b7 ${block.name}`;
  document.getElementById('mobility-exercise-name').textContent = exercise.name;
  document.getElementById('mobility-exercise-desc').textContent = exercise.description;

  document.getElementById('mobility-next-block-btn').classList.toggle('hidden', isLastBlock);

  const dotsWrap = document.getElementById('mobility-block-dots');
  dotsWrap.innerHTML = '';
  MOBILITY_ROUTINE.blocks.forEach((b, i) => {
    const dot = document.createElement('div');
    dot.className = 'mobility-dot';
    if (i <= mobilityBlockIdx) dot.style.background = MOBILITY_DOT_COLORS[b.color] || 'var(--accent)';
    dotsWrap.appendChild(dot);
  });
}

function nextMobilityExercise() {
  const block = MOBILITY_ROUTINE.blocks[mobilityBlockIdx];
  mobilityExerciseIdx = randomMobilityExerciseIdx(block, mobilityExerciseIdx);
  renderMobilityExercise();
}

function nextMobilityBlock() {
  if (mobilityBlockIdx >= MOBILITY_ROUTINE.blocks.length - 1) return;
  mobilityBlockIdx++;
  mobilityExerciseIdx = randomMobilityExerciseIdx(MOBILITY_ROUTINE.blocks[mobilityBlockIdx], -1);
  renderMobilityExercise();
}

function finishMobility() {
  toast('Mobility routine complete!');
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
      if (screen === 'plans')      { currentPlanViewWeek = null; renderPlans(); }
      showScreen(screen);
    });
  });

  // Back buttons — reset plan mode when leaving the logging screen
  document.querySelectorAll('.back-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.to === 'workout' && activePlanMode) {
        activePlanMode    = false;
        activePlanId      = null;
        activePlanWeekNum = null;
        activePlanDayNum  = null;
        planAccessoryLifts = [];
        currentPlanViewWeek = null;
        renderPlans();
        showScreen('plans');
        return;
      }
      showScreen(btn.dataset.to);
    });
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

  // Share modal
  document.getElementById('share-benchmarks-btn')?.addEventListener('click', openShareModal);
  document.getElementById('share-modal-close')?.addEventListener('click', closeShareModal);
  document.getElementById('share-modal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('share-modal')) closeShareModal();
  });
  document.getElementById('share-download-btn')?.addEventListener('click', shareDownload);
  document.getElementById('share-native-btn')?.addEventListener('click', shareNative);
  document.getElementById('share-copy-btn')?.addEventListener('click', shareCopyText);

  // Plans screen
  document.getElementById('load-gvt-plan-btn')?.addEventListener('click', () => {
    if (getActivePlan()) {
      if (!confirm('Replace your current plan with the GVT template?\nCompleted sessions are kept.')) return;
      deletePlan(getActivePlan().id);
    }
    const plan = createGVTPlan();
    savePlan(plan);
    toast('8-Week GVT plan loaded! Weights calculated from your PBs.');
    currentPlanViewWeek = 1;
    renderPlans();
    renderHome();
  });

  document.getElementById('delete-plan-btn')?.addEventListener('click', () => {
    if (!confirm('Remove this training plan? Your completed sessions are kept.')) return;
    const plan = getActivePlan();
    if (plan) { deletePlan(plan.id); }
    currentPlanViewWeek = null;
    renderPlans();
    renderHome();
    toast('Plan removed.');
  });

  // Plan builder
  document.getElementById('build-custom-plan-btn')?.addEventListener('click', () => {
    initPlanBuilder();
    showScreen('plan-builder');
  });
  document.getElementById('pb-cancel-btn')?.addEventListener('click', () => showScreen('plans'));
  document.getElementById('pb-add-day-btn')?.addEventListener('click', () => {
    flushPlanBuilderInputs();
    planBuilderDays.push({ name: '', exercises: [{ name: '', sets: 3, reps: 10, weightKg: null }] });
    renderPlanBuilderDays();
  });
  document.getElementById('pb-save-btn')?.addEventListener('click', savePlanFromBuilder);

  // Mobility
  document.getElementById('home-start-mobility-btn')?.addEventListener('click', startMobility);
  document.getElementById('mobility-exit-btn')?.addEventListener('click', () => showScreen('home'));
  document.getElementById('mobility-next-exercise-btn')?.addEventListener('click', nextMobilityExercise);
  document.getElementById('mobility-next-block-btn')?.addEventListener('click', nextMobilityBlock);
  document.getElementById('mobility-finish-btn')?.addEventListener('click', finishMobility);

  // Onboarding
  initOnboarding();

  // Cloud sync
  initSync();

  // Route to first screen
  if (syncIsConfigured()) {
    // Show signin gate — auth state callback will redirect once Firebase resolves
    showScreen('signin');
  } else {
    const profile = getProfile();
    if (!profile) {
      showScreen('onboarding');
    } else {
      renderHome();
      showScreen('home');
    }
  }
}

document.addEventListener('DOMContentLoaded', init);

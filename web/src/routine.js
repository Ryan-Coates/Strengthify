// Flexible weekly blocks are independent of set-by-set workout logging.
const ROUTINE_WORKOUTS = [
  { name: 'Pull - push - pull', moves: ['Lat pulldown', 'Bench press', 'Face pulls'], note: '5 rounds. Rest 1 minute after each superset.' },
  { name: 'Core - leg - core', moves: ['Crunches', 'Barbell squat', 'Hollow hold'], note: '5 rounds. Rest 1 minute after each superset.' },
  { name: 'Push - pull - push', moves: ['Tricep extensions', 'Pull-ups', 'Lateral raises'], note: 'Move through the three exercises as a superset.' },
  { name: 'Leg - deadlift - leg', moves: ['Goblet squat', 'Deadlift', 'Bulgarian split squat'], note: '5 rounds. Rest 1 minute after each superset.' },
  { name: 'Strength - mobility - strength', moves: ['Halos', 'Stretches', 'Forearm curls'], note: 'Combine strength and mobility in one block.' },
];
const ROUTINE_WEEKS = 8;
const ROUTINE_WEEK_TOTAL = ROUTINE_WORKOUTS.length * 2;
const ROUTINE_DAY_MS = 86400000;
const CHAOS_NAME = 'Composible Chaos';
const CHAOS_TAGLINE = 'Flexible workouts. Daily habits. Your rhythm.';
const CHAOS_DAILY = [
  { label: 'Cardio', note: 'Daily cardio done' },
  { label: 'Nutrition', note: '225g protein + calories tracked' },
];
let routineViewWeek = null;
let routineJustTicked = null;

function routineDateNumber(value) {
  if (typeof value !== 'string' || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('Choose a valid start date.');
  }
  const ms = Date.parse(value + 'T00:00:00Z');
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== value) {
    throw new Error('Choose a valid start date.');
  }
  return ms / ROUTINE_DAY_MS;
}

function routineLocalDate(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function routineDateAt(startDate, offset) {
  return new Date((routineDateNumber(startDate) + offset) * ROUTINE_DAY_MS).toISOString().slice(0, 10);
}

function routineDateLabel(date) {
  return new Date(routineDateNumber(date) * ROUTINE_DAY_MS).toLocaleDateString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
}

function routineCurrentWeek(routine, date = routineLocalDate()) {
  // Calendar-day arithmetic avoids DST and UTC/local midnight shifts.
  return Math.floor((routineDateNumber(date) - routineDateNumber(routine.startDate)) / 7);
}

// Explains why check-offs are locked. Returns '' when the week is open.
// Locked boxes are expected: a week can only be ticked once it has started.
function routineLockMessage(routine, week, date = routineLocalDate()) {
  const current = routineCurrentWeek(routine, date);
  if (week <= current) return '';
  const unlocks = routineDateAt(routine.startDate, week * 7);
  const days = routineDateNumber(unlocks) - routineDateNumber(date);
  const when = days === 1 ? 'tomorrow' : `in ${days} days`;
  return current < 0 ?
    `Not live yet. ${CHAOS_NAME} starts ${routineDateLabel(unlocks)} (${when}). Boxes are locked until then, nothing is broken.` :
    `Week ${week + 1} unlocks ${routineDateLabel(unlocks)} (${when}). Boxes are locked until the week starts.`;
}

function routineProgress(routine) {
  return {
    done: routine.completed.flat().filter(Boolean).length +
      (routine.days || []).reduce((sum, day) => sum + day.done.filter(Boolean).length, 0),
    total: ROUTINE_WEEKS * (ROUTINE_WEEK_TOTAL + 7 * CHAOS_DAILY.length),
  };
}

function routineWeekStats(routine, week) {
  const workouts = routine.completed[week].filter(Boolean).length;
  const habits = (routine.days || []).slice(week * 7, week * 7 + 7)
    .reduce((sum, day) => sum + day.done.filter(Boolean).length, 0);
  return { workouts, habits, complete: workouts === ROUTINE_WEEK_TOTAL && habits === 14 };
}

function routineEmptyDays() {
  return Array.from({ length: ROUTINE_WEEKS * 7 }, () => ({ done: CHAOS_DAILY.map(() => false) }));
}

function upgradeRoutine(routine) {
  validateRoutine(routine);
  // Older commitments retain workout history; new daily habits begin unchecked.
  if (routine.days === undefined) routine.days = routineEmptyDays();
  return routine;
}

function validateRoutine(routine) {
  if (!routine || typeof routine.id !== 'string' || !routine.id ||
      !Number.isFinite(routine.updatedAt) || routine.updatedAt <= 0 ||
      !Array.isArray(routine.completed) || routine.completed.length !== ROUTINE_WEEKS ||
      !routine.completed.every(week => Array.isArray(week) && week.length === ROUTINE_WEEK_TOTAL &&
        week.every(done => typeof done === 'boolean')) ||
      (routine.days !== undefined && (!Array.isArray(routine.days) || routine.days.length !== 56 ||
        !routine.days.every(day => day && Array.isArray(day.done) && day.done.length === CHAOS_DAILY.length &&
          day.done.every(done => typeof done === 'boolean')))) ||
      !Array.isArray(routine.celebratedWeeks) ||
      !routine.celebratedWeeks.every(week => Number.isInteger(week) && week >= 0 && week < ROUTINE_WEEKS)) {
    throw new Error('Invalid routine data. Restore a valid backup.');
  }
  routineDateNumber(routine.startDate);
  routineDateNumber(routineDateAt(routine.startDate, 55));
}

function getRoutine() {
  const raw = localStorage.getItem(KEYS.ROUTINE);
  const routine = raw ? JSON.parse(raw) : null;
  if (routine !== null) upgradeRoutine(routine);
  return routine;
}

function saveRoutine(routine) {
  if (routine !== null) {
    upgradeRoutine(routine);
    routine.updatedAt = Math.max(Date.now(), (routine.updatedAt || 0) + 1);
    validateRoutine(routine);
  }
  const updatedAt = routine ? routine.updatedAt : Date.now();
  localStorage.setItem(KEYS.ROUTINE, JSON.stringify(routine));
  localStorage.setItem(KEYS.ROUTINE_TS, String(updatedAt));
  if (typeof syncPushRoutine === 'function') {
    syncPushRoutine(routine, updatedAt)?.catch(error => {
      console.error('[Sync] pushRoutine failed:', error);
      setSyncStatus('error');
      toast('Routine saved on this device, but cloud sync failed. Try Sync now when online.', 'error');
    });
  }
}

function createRoutine(startDate) {
  routineDateNumber(startDate);
  const routine = {
    id: uuid(), startDate, updatedAt: Date.now(),
    completed: Array.from({ length: ROUTINE_WEEKS }, () => Array(ROUTINE_WEEK_TOTAL).fill(false)),
    celebratedWeeks: [],
    days: routineEmptyDays(),
  };
  saveRoutine(routine);
  return routine;
}

function setRoutineBlock(week, block, done, date = routineLocalDate()) {
  const routine = getRoutine();
  if (!routine || !Number.isInteger(week) || week < 0 || week >= ROUTINE_WEEKS ||
      !Number.isInteger(block) || block < 0 || block >= ROUTINE_WEEK_TOTAL || typeof done !== 'boolean') {
    throw new Error('That workout block could not be found.');
  }
  if (week > routineCurrentWeek(routine, date)) throw new Error('This week has not started yet.');
  routine.completed[week][block] = done;
  return finishRoutineCheckoff(routine, week);
}

function setRoutineDaily(day, goal, done, date = routineLocalDate()) {
  const routine = getRoutine();
  if (!routine || !Number.isInteger(day) || day < 0 || day >= 56 ||
      !Number.isInteger(goal) || goal < 0 || goal >= CHAOS_DAILY.length || typeof done !== 'boolean') {
    throw new Error('That daily habit could not be found.');
  }
  const today = routineDateNumber(date) - routineDateNumber(routine.startDate);
  if (day > today) throw new Error('This day has not started yet.');
  routine.days[day].done[goal] = done;
  return finishRoutineCheckoff(routine, Math.floor(day / 7));
}

function finishRoutineCheckoff(routine, week) {
  const celebrate = routineWeekStats(routine, week).complete && !routine.celebratedWeeks.includes(week);
  if (celebrate) routine.celebratedWeeks.push(week);
  saveRoutine(routine);
  return { routine, celebrate };
}

function renderRoutineHome() {
  const routine = getRoutine();
  const title = document.getElementById('home-routine-title');
  const detail = document.getElementById('home-routine-detail');
  const bar = document.getElementById('home-routine-progress');
  bar.max = routineProgress(routine || { completed: [] }).total;
  if (!routine) {
    title.textContent = CHAOS_TAGLINE;
    detail.textContent = '8 weeks of flexible workout blocks, daily cardio and nutrition.';
    bar.value = 0;
    return;
  }
  const current = routineCurrentWeek(routine);
  const week = Math.max(0, Math.min(7, current));
  const { done: total, total: target } = routineProgress(routine);
  bar.value = total;
  bar.textContent = `${total} of ${target} check-offs completed`;
  title.textContent = current < 0 ? 'You are in. Not live yet.' :
    current >= 8 ? 'Eight weeks, your way' : `Week ${week + 1}: keep showing up`;
  detail.textContent = current < 0 ? `Starts ${routineDateLabel(routine.startDate)}. Check-offs unlock then.` :
    current >= 8 ? `${total} / ${target} check-offs completed. Review your journey.` :
      `${routineWeekStats(routine, week).workouts} / 10 workouts · ${routineWeekStats(routine, week).habits} / 14 habits this week.`;
}

function openRoutine() {
  routineViewWeek = null;
  document.getElementById('routine-setup').classList.toggle('hidden', !!getRoutine());
  renderRoutine();
  showScreen('routine');
}

function renderRoutine() {
  const routine = getRoutine();
  document.getElementById('routine-dashboard').classList.toggle('hidden', !routine);
  document.getElementById('routine-cancel-setup').classList.toggle('hidden', !routine);
  const preview = document.getElementById('routine-preview');
  preview.replaceChildren();
  ROUTINE_WORKOUTS.forEach(workout => {
    const item = document.createElement('li');
    const heading = document.createElement('strong');
    heading.textContent = workout.name;
    const moves = document.createElement('span');
    moves.textContent = workout.moves.join(' / ');
    item.append(heading, moves);
    preview.appendChild(item);
  });
  if (!document.getElementById('routine-start-date').value) {
    const now = new Date();
    const untilMonday = 8 - (now.getDay() || 7);
    document.getElementById('routine-start-date').value = routineDateAt(routineLocalDate(now), untilMonday);
  }
  if (!routine) return;
  const current = routineCurrentWeek(routine);
  if (routineViewWeek === null) routineViewWeek = Math.max(0, Math.min(7, current));
  const week = routineViewWeek;
  const count = routine.completed[week].filter(Boolean).length;
  const { done: total, total: target } = routineProgress(routine);
  const completedWeeks = routine.completed.filter((_, index) => routineWeekStats(routine, index).complete).length;
  document.getElementById('routine-journey').textContent = `${total} / ${target} check-offs · ${completedWeeks} / 8 weeks complete`;
  const overall = document.getElementById('routine-overall-progress');
  overall.max = target;
  overall.value = total;
  overall.textContent = `${total} of ${target} check-offs completed`;
  document.getElementById('routine-dates').textContent =
    `${routineDateLabel(routine.startDate)} - ${routineDateLabel(routineDateAt(routine.startDate, 55))}`;
  document.getElementById('routine-week-title').textContent = `Week ${week + 1}`;
  document.getElementById('routine-week-dates').textContent =
    `${routineDateLabel(routineDateAt(routine.startDate, week * 7))} - ${routineDateLabel(routineDateAt(routine.startDate, week * 7 + 6))}`;
  document.getElementById('routine-week-count').textContent = `${count} / 10`;
  const progress = document.getElementById('routine-week-progress');
  progress.value = count;
  progress.textContent = `${count} of 10 blocks completed`;
  const lockMessage = routineLockMessage(routine, week);
  document.getElementById('routine-week-message').textContent = lockMessage ||
    (routineWeekStats(routine, week).complete ? 'Week complete! Workouts and daily habits nailed.' :
    count === 10 ? 'Workouts complete! Keep going with your daily habits to finish the week.' :
    week < current ? 'Review this week or catch up on check-offs you forgot to record.' :
    'No fixed days. Stack blocks together or spread them out.');
  const lockBanner = document.getElementById('routine-lock-banner');
  lockBanner.textContent = lockMessage;
  lockBanner.classList.toggle('hidden', !lockMessage);
  document.getElementById('routine-checklist').classList.toggle('is-locked', !!lockMessage);
  const tabs = document.getElementById('routine-week-tabs');
  tabs.replaceChildren();
  routine.completed.forEach((blocks, index) => {
    const done = blocks.filter(Boolean).length;
    const stats = routineWeekStats(routine, index);
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'routine-week-tab' + (index === week ? ' selected' : '') + (stats.complete ? ' complete' : '');
    tab.setAttribute('aria-pressed', String(index === week));
    tab.setAttribute('aria-label', `Week ${index + 1}, ${done} of 10 workouts, ${stats.habits} of 14 habits complete${index === current ? ', current week' : ''}`);
    tab.textContent = `${index + 1}${stats.complete ? ' ✓' : ''}`;
    tab.addEventListener('click', () => { routineViewWeek = index; renderRoutine(); });
    tabs.appendChild(tab);
  });
  const checklist = document.getElementById('routine-checklist');
  checklist.replaceChildren();
  ROUTINE_WORKOUTS.forEach((workout, index) => {
    const card = document.createElement('article');
    card.className = 'card routine-workout';
    const heading = document.createElement('h3');
    heading.textContent = workout.name;
    const meta = document.createElement('p');
    meta.className = 'routine-workout-meta';
    meta.textContent = '~25 min per block · Twice this week';
    const moves = document.createElement('ol');
    workout.moves.forEach(move => {
      const li = document.createElement('li');
      li.textContent = move;
      moves.appendChild(li);
    });
    const note = document.createElement('p');
    note.className = 'routine-workout-meta';
    note.textContent = workout.note;
    const checks = document.createElement('div');
    checks.className = 'routine-blocks';
    for (let repeat = 0; repeat < 2; repeat++) {
      const block = index * 2 + repeat;
      const label = document.createElement('label');
      label.className = 'routine-block';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.id = `routine-block-${block}`;
      input.checked = routine.completed[week][block];
      input.disabled = week > current;
      input.setAttribute('aria-label', `${workout.name}, block ${repeat + 1}${week > current ? ', locked until this week starts' : ''}`);
      if (routineJustTicked === block) { label.classList.add('just-ticked'); routineJustTicked = null; }
      input.addEventListener('change', () => {
        try {
          const result = setRoutineBlock(week, block, input.checked);
          routineJustTicked = input.checked ? block : null;
          renderRoutine();
          renderRoutineHome();
          document.getElementById(input.id).focus();
          if (result.celebrate) celebrateRoutineWeek(week, routineProgress(result.routine).done === routineProgress(result.routine).total);
        } catch (error) {
          input.checked = !input.checked;
          console.error('[Routine] Check-off failed:', error);
          toast(error.message, 'error');
        }
      });
      const text = document.createElement('span');
      text.textContent = `Block ${repeat + 1}`;
      label.append(input, text);
      checks.appendChild(label);
    }
    card.append(heading, meta, moves, note, checks);
    checklist.appendChild(card);
  });
  renderRoutineHabits(routine, week);
}

function renderRoutineHabits(routine, week) {
  const stats = routineWeekStats(routine, week);
  document.getElementById('routine-habit-count').textContent = `${stats.habits} / 14`;
  const progress = document.getElementById('routine-habit-progress');
  progress.value = stats.habits;
  progress.textContent = `${stats.habits} of 14 daily habits completed`;
  const list = document.getElementById('routine-habits');
  list.replaceChildren();
  const today = routineDateNumber(routineLocalDate());
  for (let day = week * 7; day < week * 7 + 7; day++) {
    const date = routineDateAt(routine.startDate, day);
    const locked = routineDateNumber(date) > today;
    const row = document.createElement('fieldset');
    row.className = 'chaos-habit-day';
    const legend = document.createElement('legend');
    legend.textContent = `${new Date(date + 'T00:00:00Z').toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' })} · ${routineDateLabel(date)}${routineDateNumber(date) === today ? ' · Today' : ''}${locked ? ' · Not started' : ''}`;
    const checks = document.createElement('div');
    checks.className = 'routine-blocks';
    CHAOS_DAILY.forEach((goal, index) => {
      const label = document.createElement('label');
      label.className = 'routine-block';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.id = `routine-habit-${day}-${index}`;
      input.checked = routine.days[day].done[index];
      input.disabled = locked;
      input.setAttribute('aria-label', `${goal.label}, ${routineDateLabel(date)}: ${goal.note}`);
      const text = document.createElement('span');
      text.textContent = goal.label;
      input.addEventListener('change', () => {
        try {
          const result = setRoutineDaily(day, index, input.checked);
          renderRoutine();
          renderRoutineHome();
          document.getElementById(input.id).focus();
          if (result.celebrate) celebrateRoutineWeek(week, routineProgress(result.routine).done === routineProgress(result.routine).total);
        } catch (error) {
          input.checked = !input.checked;
          console.error('[Routine] Daily habit failed:', error);
          toast(error.message, 'error');
        }
      });
      label.append(input, text);
      checks.appendChild(label);
    });
    row.append(legend, checks);
    list.appendChild(row);
  }
}

function celebrateRoutineWeek(week, allDone) {
  const dialog = document.getElementById('routine-celebration');
  document.getElementById('routine-celebration-title').textContent = allDone ? 'All 8 weeks. You did it!' : `Week ${week + 1}, in the bag!`;
  document.getElementById('routine-celebration-copy').textContent = allDone ?
    '80 workouts and 112 daily habits. One commitment kept. Take a bow.' :
    'Ten workouts, seven days of cardio and nutrition. You owned the chaos.';
  const confetti = document.getElementById('routine-confetti');
  confetti.replaceChildren();
  for (let i = 0; i < 36; i++) {
    const piece = document.createElement('i');
    piece.style.setProperty('--x', `${(i * 37) % 100}%`);
    piece.style.setProperty('--delay', `${(i % 7) * 0.07}s`);
    piece.style.setProperty('--color', ['#b8b0ff', '#61d5b5', '#ffd86b'][i % 3]);
    confetti.appendChild(piece);
  }
  dialog.showModal();
}

function initRoutine() {
  document.querySelectorAll('[data-open-routine]').forEach(button => button.addEventListener('click', openRoutine));
  document.getElementById('routine-form').addEventListener('submit', event => {
    event.preventDefault();
    try {
      const date = document.getElementById('routine-start-date').value;
      routineDateNumber(date);
      if (getRoutine() && !confirm('Start a new 8-week commitment? This replaces your existing routine checklist. Logged workouts are kept.')) return;
      createRoutine(date);
      routineViewWeek = null;
      document.getElementById('routine-setup').classList.add('hidden');
      renderRoutine();
      renderRoutineHome();
      toast('You are committed. Eight weeks, your way!');
    } catch (error) {
      console.error('[Routine] Commitment failed:', error);
      toast(error.message, 'error');
    }
  });
  document.getElementById('routine-new').addEventListener('click', () => {
    document.getElementById('routine-setup').classList.remove('hidden');
    document.getElementById('routine-start-date').focus();
  });
  document.getElementById('routine-cancel-setup').addEventListener('click', () => {
    document.getElementById('routine-setup').classList.add('hidden');
  });
  document.getElementById('routine-celebration-close').addEventListener('click', () => {
    document.getElementById('routine-celebration').close();
  });
  let lastDate = routineLocalDate();
  const refresh = () => {
    const date = routineLocalDate();
    if (date === lastDate) return;
    lastDate = date;
    routineViewWeek = null;
    if (getProfile()) renderRoutineHome();
    if (currentScreen === 'routine') renderRoutine();
  };
  window.addEventListener('focus', refresh);
  document.addEventListener('visibilitychange', refresh);
  setInterval(refresh, 60000);
}

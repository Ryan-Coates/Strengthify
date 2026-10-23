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
let routineViewWeek = null;

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

function validateRoutine(routine) {
  if (!routine || typeof routine.id !== 'string' || !routine.id ||
      !Number.isFinite(routine.updatedAt) || routine.updatedAt <= 0 ||
      !Array.isArray(routine.completed) || routine.completed.length !== ROUTINE_WEEKS ||
      !routine.completed.every(week => Array.isArray(week) && week.length === ROUTINE_WEEK_TOTAL &&
        week.every(done => typeof done === 'boolean')) ||
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
  if (routine !== null) validateRoutine(routine);
  return routine;
}

function saveRoutine(routine) {
  if (routine !== null) {
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
  const celebrate = routine.completed[week].every(Boolean) && !routine.celebratedWeeks.includes(week);
  if (celebrate) routine.celebratedWeeks.push(week);
  saveRoutine(routine);
  return { routine, celebrate };
}

function renderRoutineHome() {
  const routine = getRoutine();
  const title = document.getElementById('home-routine-title');
  const detail = document.getElementById('home-routine-detail');
  if (!routine) {
    title.textContent = 'Your week. Your rhythm.';
    detail.textContent = 'Commit to 8 weeks of flexible, 25-minute workout blocks.';
    return;
  }
  const current = routineCurrentWeek(routine);
  const week = Math.max(0, Math.min(7, current));
  const total = routine.completed.flat().filter(Boolean).length;
  title.textContent = current < 0 ? 'Your commitment is locked in' :
    current >= 8 ? 'Eight weeks, your way' : `Week ${week + 1}: keep showing up`;
  detail.textContent = current < 0 ? `Starts ${routineDateLabel(routine.startDate)}. No fixed workout days.` :
    current >= 8 ? `${total} / 80 blocks completed. Review your journey.` :
      `${routine.completed[week].filter(Boolean).length} / 10 blocks this week. Mix, match, make it yours.`;
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
  const total = routine.completed.flat().filter(Boolean).length;
  const completedWeeks = routine.completed.filter(w => w.every(Boolean)).length;
  document.getElementById('routine-journey').textContent = `${total} / 80 blocks · ${completedWeeks} / 8 weeks complete`;
  document.getElementById('routine-dates').textContent =
    `${routineDateLabel(routine.startDate)} - ${routineDateLabel(routineDateAt(routine.startDate, 55))}`;
  document.getElementById('routine-week-title').textContent = `Week ${week + 1}`;
  document.getElementById('routine-week-dates').textContent =
    `${routineDateLabel(routineDateAt(routine.startDate, week * 7))} - ${routineDateLabel(routineDateAt(routine.startDate, week * 7 + 6))}`;
  document.getElementById('routine-week-count').textContent = `${count} / 10`;
  const progress = document.getElementById('routine-week-progress');
  progress.value = count;
  progress.textContent = `${count} of 10 blocks completed`;
  document.getElementById('routine-week-message').textContent = week > current ?
    'A little preview. Check-offs unlock when this week starts.' :
    count === 10 ? 'Week complete! You made room for yourself.' :
    week < current ? 'Review this week or catch up on check-offs you forgot to record.' :
    'No fixed days. Stack blocks together or spread them out.';
  const tabs = document.getElementById('routine-week-tabs');
  tabs.replaceChildren();
  routine.completed.forEach((blocks, index) => {
    const done = blocks.filter(Boolean).length;
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'routine-week-tab' + (index === week ? ' selected' : '') + (done === 10 ? ' complete' : '');
    tab.setAttribute('aria-pressed', String(index === week));
    tab.setAttribute('aria-label', `Week ${index + 1}, ${done} of 10 complete${index === current ? ', current week' : ''}`);
    tab.textContent = `${index + 1}${done === 10 ? ' ✓' : ''}`;
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
      input.setAttribute('aria-label', `${workout.name}, block ${repeat + 1}`);
      input.addEventListener('change', () => {
        try {
          const result = setRoutineBlock(week, block, input.checked);
          renderRoutine();
          renderRoutineHome();
          document.getElementById(input.id).focus();
          if (result.celebrate) celebrateRoutineWeek(week, result.routine.completed.every(w => w.every(Boolean)));
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
}

function celebrateRoutineWeek(week, allDone) {
  const dialog = document.getElementById('routine-celebration');
  document.getElementById('routine-celebration-title').textContent = allDone ? 'All 8 weeks. You did it!' : `Week ${week + 1}, in the bag!`;
  document.getElementById('routine-celebration-copy').textContent = allDone ?
    '80 blocks. One commitment kept. Take a bow.' : 'Ten blocks complete. A busy week, a stronger you.';
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

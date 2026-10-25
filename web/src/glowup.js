// Glow-Up: an 8-week lifestyle commitment with daily non-negotiables,
// weekly movement goals and "little things that make life lovely".
const GLOWUP_NAME = 'Glow-Up';
const GLOWUP_TAGLINE = 'Soft life. Strong habits. Absolutely glowing.';
const GLOWUP_WEEKS = 8;
const GLOWUP_DAYS = GLOWUP_WEEKS * 7;

const GLOWUP_DAILY = [
  { id: 'wake', label: '5:30am wake up', note: 'Monday to Friday', weekdaysOnly: true, icon: '\u23F0' },
  { id: 'water', label: '2 litres of water', icon: '\uD83D\uDCA7' },
  { id: 'steps', label: '10,000 steps', icon: '\uD83D\uDC5F' },
  { id: 'protein', label: '100g+ protein', icon: '\uD83C\uDF73' },
  { id: 'homework', label: '30 minute homework', icon: '\uD83D\uDCDA' },
  { id: 'skin', label: 'Morning face care and teeth', icon: '\uD83E\uDDF4' },
  { id: 'meditate', label: 'Meditation', icon: '\uD83E\uDDD8\u200D\u2640\uFE0F' },
  { id: 'journal', label: 'Journaling', icon: '\uD83D\uDCD3' },
];
const GLOWUP_MOVEMENT = [
  { id: 'runs', label: 'Runs', count: 2, icon: '\uD83C\uDFC3\u200D\u2640\uFE0F' },
  { id: 'weights', label: 'Weight sessions', count: 3, icon: '\uD83C\uDFCB\uFE0F\u200D\u2640\uFE0F' },
  { id: 'abs', label: 'Abs sessions', count: 5, icon: '\uD83D\uDD25' },
];
const GLOWUP_LOVELY = [
  { id: 'date', label: 'Tuesday date night', icon: '\uD83C\uDF77' },
  { id: 'craft', label: 'Friday craft night', icon: '\uD83C\uDFA8' },
  { id: 'dylan', label: 'Me and Dylan time', icon: '\uD83D\uDC96' },
];
const GLOWUP_WEEKLY_GROUPS = [...GLOWUP_MOVEMENT.map(g => ({ id: g.id, count: g.count })),
  { id: 'lovely', count: GLOWUP_LOVELY.length }];
const GLOWUP_WEEKLY_TOTAL = GLOWUP_WEEKLY_GROUPS.reduce((sum, g) => sum + g.count, 0);

let glowupViewWeek = null;
let glowupViewDay = null;
let glowupJustTicked = null;

// Day of week for a YYYY-MM-DD date. 0 = Sunday. 1970-01-01 was a Thursday.
function glowupWeekday(date) {
  return (routineDateNumber(date) + 4) % 7;
}

function glowupGoalApplies(goal, date) {
  const dow = glowupWeekday(date);
  return !goal.weekdaysOnly || (dow >= 1 && dow <= 5);
}

// 0-based day index of `date` within the commitment (negative before the start).
function glowupDayIndex(glowup, date = routineLocalDate()) {
  return routineDateNumber(date) - routineDateNumber(glowup.startDate);
}

function glowupEmptyWeek() {
  const week = {};
  GLOWUP_WEEKLY_GROUPS.forEach(g => { week[g.id] = Array(g.count).fill(false); });
  return week;
}

function validateGlowup(glowup) {
  const boolArray = (value, length) => Array.isArray(value) && value.length === length &&
    value.every(v => typeof v === 'boolean');
  if (!glowup || typeof glowup.id !== 'string' || !glowup.id ||
      !Number.isFinite(glowup.updatedAt) || glowup.updatedAt <= 0 ||
      !Array.isArray(glowup.days) || glowup.days.length !== GLOWUP_DAYS ||
      !glowup.days.every(day => day && boolArray(day.done, GLOWUP_DAILY.length)) ||
      !Array.isArray(glowup.weeks) || glowup.weeks.length !== GLOWUP_WEEKS ||
      !glowup.weeks.every(week => week && GLOWUP_WEEKLY_GROUPS.every(g => boolArray(week[g.id], g.count)))) {
    throw new Error('Invalid Glow-Up data. Restore a valid backup.');
  }
  routineDateNumber(glowup.startDate);
  routineDateNumber(routineDateAt(glowup.startDate, GLOWUP_DAYS - 1));
}

function getGlowup() {
  const raw = localStorage.getItem(KEYS.GLOWUP);
  const glowup = raw ? JSON.parse(raw) : null;
  if (glowup !== null) validateGlowup(glowup);
  return glowup;
}

function saveGlowup(glowup) {
  if (glowup !== null) {
    glowup.updatedAt = Math.max(Date.now(), (glowup.updatedAt || 0) + 1);
    validateGlowup(glowup);
  }
  const updatedAt = glowup ? glowup.updatedAt : Date.now();
  localStorage.setItem(KEYS.GLOWUP, JSON.stringify(glowup));
  localStorage.setItem(KEYS.GLOWUP_TS, String(updatedAt));
  if (typeof syncPushGlowup === 'function') {
    syncPushGlowup(glowup, updatedAt)?.catch(error => {
      console.error('[Sync] pushGlowup failed:', error);
      setSyncStatus('error');
      toast('Glow-Up saved on this device, but cloud sync failed. Try Sync now when online.', 'error');
    });
  }
}

function createGlowup(startDate) {
  routineDateNumber(startDate);
  const glowup = {
    id: uuid(), startDate, updatedAt: Date.now(),
    days: Array.from({ length: GLOWUP_DAYS }, () => ({ done: Array(GLOWUP_DAILY.length).fill(false) })),
    weeks: Array.from({ length: GLOWUP_WEEKS }, glowupEmptyWeek),
  };
  saveGlowup(glowup);
  return glowup;
}

// Applicable daily goals for a day: done / total. Weekend wake-ups do not count.
function glowupDayStats(glowup, day) {
  const date = routineDateAt(glowup.startDate, day);
  let done = 0, total = 0;
  GLOWUP_DAILY.forEach((goal, i) => {
    if (!glowupGoalApplies(goal, date)) return;
    total++;
    if (glowup.days[day].done[i]) done++;
  });
  return { done, total };
}

function glowupWeeklyStats(glowup, week) {
  let done = 0;
  GLOWUP_WEEKLY_GROUPS.forEach(g => { done += glowup.weeks[week][g.id].filter(Boolean).length; });
  return { done, total: GLOWUP_WEEKLY_TOTAL };
}

function glowupWeekStats(glowup, week) {
  let done = 0, total = 0;
  for (let d = week * 7; d < week * 7 + 7; d++) {
    const stats = glowupDayStats(glowup, d);
    done += stats.done; total += stats.total;
  }
  const weekly = glowupWeeklyStats(glowup, week);
  return { done: done + weekly.done, total: total + weekly.total };
}

function glowupProgress(glowup) {
  let done = 0, total = 0;
  for (let w = 0; w < GLOWUP_WEEKS; w++) {
    const stats = glowupWeekStats(glowup, w);
    done += stats.done; total += stats.total;
  }
  return { done, total };
}

function glowupDayLockMessage(glowup, day, date = routineLocalDate()) {
  const today = glowupDayIndex(glowup, date);
  if (day <= today) return '';
  const unlocks = routineDateAt(glowup.startDate, day);
  const inDays = n => n === 1 ? 'tomorrow' : `in ${n} days`;
  return today < 0 ?
    `Not live yet. ${GLOWUP_NAME} starts ${routineDateLabel(glowup.startDate)} (${inDays(-today)}). Boxes are locked until then, nothing is broken.` :
    `${routineDateLabel(unlocks)} unlocks ${inDays(day - today)}. Future days stay locked so every tick is earned.`;
}

function glowupWeekLockMessage(glowup, week, date = routineLocalDate()) {
  const today = glowupDayIndex(glowup, date);
  if (week * 7 <= today) return '';
  return today < 0 ?
    `Not live yet. ${GLOWUP_NAME} starts ${routineDateLabel(glowup.startDate)}. Weekly goals are locked until then, nothing is broken.` :
    `Week ${week + 1} unlocks ${routineDateLabel(routineDateAt(glowup.startDate, week * 7))}.`;
}

function setGlowupDaily(day, goal, done, date = routineLocalDate()) {
  const glowup = getGlowup();
  if (!glowup || !Number.isInteger(day) || day < 0 || day >= GLOWUP_DAYS ||
      !Number.isInteger(goal) || goal < 0 || goal >= GLOWUP_DAILY.length || typeof done !== 'boolean') {
    throw new Error('That Glow-Up goal could not be found.');
  }
  if (day > glowupDayIndex(glowup, date)) throw new Error('This day has not started yet.');
  if (!glowupGoalApplies(GLOWUP_DAILY[goal], routineDateAt(glowup.startDate, day))) {
    throw new Error('That goal does not apply on this day.');
  }
  const before = glowupDayStats(glowup, day);
  glowup.days[day].done[goal] = done;
  const after = glowupDayStats(glowup, day);
  saveGlowup(glowup);
  return { glowup, perfectDay: done && after.done === after.total && before.done < before.total };
}

function setGlowupWeekly(week, group, index, done, date = routineLocalDate()) {
  const glowup = getGlowup();
  const spec = GLOWUP_WEEKLY_GROUPS.find(g => g.id === group);
  if (!glowup || !spec || !Number.isInteger(week) || week < 0 || week >= GLOWUP_WEEKS ||
      !Number.isInteger(index) || index < 0 || index >= spec.count || typeof done !== 'boolean') {
    throw new Error('That Glow-Up goal could not be found.');
  }
  if (week * 7 > glowupDayIndex(glowup, date)) throw new Error('This week has not started yet.');
  const before = glowupWeekStats(glowup, week);
  glowup.weeks[week][group][index] = done;
  const after = glowupWeekStats(glowup, week);
  saveGlowup(glowup);
  return { glowup, perfectWeek: done && after.done === after.total && before.done < before.total };
}

// ── Home card ─────────────────────────────────────────────────────

function renderGlowupHome() {
  const glowup = getGlowup();
  const title = document.getElementById('home-glowup-title');
  const detail = document.getElementById('home-glowup-detail');
  const bar = document.getElementById('home-glowup-progress');
  if (!glowup) {
    title.textContent = GLOWUP_TAGLINE;
    detail.textContent = '8 weeks of daily non-negotiables, movement goals and the little things that make life lovely.';
    bar.value = 0; bar.max = 1;
    return;
  }
  const progress = glowupProgress(glowup);
  bar.max = progress.total; bar.value = progress.done;
  bar.textContent = `${progress.done} of ${progress.total} goals completed`;
  const today = glowupDayIndex(glowup);
  if (today < 0) {
    title.textContent = 'You are in. Not live yet.';
    detail.textContent = `Starts ${routineDateLabel(glowup.startDate)}. Check-offs unlock then.`;
  } else if (today >= GLOWUP_DAYS) {
    title.textContent = 'Eight weeks. Glowed up.';
    detail.textContent = `${progress.done} / ${progress.total} goals completed. Review your journey.`;
  } else {
    const stats = glowupDayStats(glowup, today);
    title.textContent = `Day ${today + 1}: keep glowing`;
    detail.textContent = `${stats.done} / ${stats.total} daily goals today.`;
  }
}

// ── Glow-Up screen ────────────────────────────────────────────────

function openGlowup() {
  glowupViewWeek = null;
  glowupViewDay = null;
  document.getElementById('glowup-setup').classList.toggle('hidden', !!getGlowup());
  renderGlowup();
  showScreen('glowup');
}

function glowupTickRow(id, label, icon, checked, disabled, ariaLabel, onChange, justTicked) {
  const row = document.createElement('label');
  row.className = 'glowup-tick' + (justTicked ? ' just-ticked' : '');
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.id = id;
  input.checked = checked;
  input.disabled = disabled;
  input.setAttribute('aria-label', ariaLabel);
  input.addEventListener('change', () => onChange(input));
  const mark = document.createElement('span');
  mark.className = 'glowup-heart';
  mark.setAttribute('aria-hidden', 'true');
  const text = document.createElement('span');
  text.className = 'glowup-tick-label';
  text.textContent = `${icon} ${label}`;
  row.append(input, mark, text);
  return row;
}

function glowupHandleError(input, error) {
  input.checked = !input.checked;
  console.error('[Glow-Up] Check-off failed:', error);
  toast(error.message, 'error');
}

function renderGlowup() {
  const glowup = getGlowup();
  document.getElementById('glowup-dashboard').classList.toggle('hidden', !glowup);
  document.getElementById('glowup-cancel-setup').classList.toggle('hidden', !glowup);

  const preview = document.getElementById('glowup-preview');
  preview.replaceChildren();
  [['Daily non-negotiables', GLOWUP_DAILY.map(g => `${g.label}${g.note ? ` (${g.note})` : ''}`)],
   ['Weekly movement', GLOWUP_MOVEMENT.map(g => `${g.count}x ${g.label.toLowerCase()}`)],
   ['Little things that make life lovely', GLOWUP_LOVELY.map(g => g.label)]].forEach(([heading, items]) => {
    const li = document.createElement('li');
    const strong = document.createElement('strong');
    strong.textContent = heading;
    const span = document.createElement('span');
    span.textContent = items.join(' \u00b7 ');
    li.append(strong, span);
    preview.appendChild(li);
  });
  const startInput = document.getElementById('glowup-start-date');
  if (!startInput.value) {
    const now = new Date();
    startInput.value = routineDateAt(routineLocalDate(now), 8 - (now.getDay() || 7));
  }
  if (!glowup) return;

  const todayIdx = glowupDayIndex(glowup);
  const currentWeek = Math.floor(todayIdx / 7);
  if (glowupViewWeek === null) glowupViewWeek = Math.max(0, Math.min(GLOWUP_WEEKS - 1, currentWeek));
  const week = glowupViewWeek;
  if (glowupViewDay === null || Math.floor(glowupViewDay / 7) !== week) {
    glowupViewDay = week === currentWeek && todayIdx >= 0 && todayIdx < GLOWUP_DAYS ? todayIdx : week * 7;
  }
  const day = glowupViewDay;

  const overall = glowupProgress(glowup);
  const bar = document.getElementById('glowup-overall-progress');
  bar.max = overall.total; bar.value = overall.done;
  bar.textContent = `${overall.done} of ${overall.total} goals completed`;
  document.getElementById('glowup-journey').textContent =
    `${overall.done} / ${overall.total} goals \u00b7 ${Math.round(overall.total ? overall.done / overall.total * 100 : 0)}% glowing`;
  document.getElementById('glowup-dates').textContent =
    `${routineDateLabel(glowup.startDate)} - ${routineDateLabel(routineDateAt(glowup.startDate, GLOWUP_DAYS - 1))}`;

  const tabs = document.getElementById('glowup-week-tabs');
  tabs.replaceChildren();
  for (let w = 0; w < GLOWUP_WEEKS; w++) {
    const stats = glowupWeekStats(glowup, w);
    const complete = stats.total > 0 && stats.done === stats.total;
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'glowup-week-tab' + (w === week ? ' selected' : '') + (complete ? ' complete' : '');
    tab.setAttribute('aria-pressed', String(w === week));
    tab.setAttribute('aria-label', `Week ${w + 1}, ${stats.done} of ${stats.total} complete${w === currentWeek ? ', current week' : ''}`);
    tab.textContent = `${w + 1}${complete ? ' \u2728' : ''}`;
    tab.addEventListener('click', () => { glowupViewWeek = w; glowupViewDay = null; renderGlowup(); });
    tabs.appendChild(tab);
  }

  const weekStats = glowupWeekStats(glowup, week);
  document.getElementById('glowup-week-title').textContent = `Week ${week + 1}`;
  document.getElementById('glowup-week-count').textContent = `${weekStats.done} / ${weekStats.total}`;
  const weekBar = document.getElementById('glowup-week-progress');
  weekBar.max = weekStats.total; weekBar.value = weekStats.done;
  weekBar.textContent = `${weekStats.done} of ${weekStats.total} goals completed`;

  const strip = document.getElementById('glowup-day-strip');
  strip.replaceChildren();
  for (let d = week * 7; d < week * 7 + 7; d++) {
    const date = routineDateAt(glowup.startDate, d);
    const stats = glowupDayStats(glowup, d);
    const perfect = stats.total > 0 && stats.done === stats.total;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'glowup-day' + (d === day ? ' selected' : '') + (perfect ? ' perfect' : '') +
      (d === todayIdx ? ' today' : '') + (d > todayIdx ? ' future' : '');
    button.setAttribute('aria-pressed', String(d === day));
    button.setAttribute('aria-label', `${routineDateLabel(date)}, ${stats.done} of ${stats.total} daily goals${d === todayIdx ? ', today' : ''}`);
    const name = document.createElement('span');
    name.textContent = new Date(routineDateNumber(date) * ROUTINE_DAY_MS)
      .toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' });
    const dateNum = document.createElement('strong');
    dateNum.textContent = perfect ? '\u2728' : String(new Date(routineDateNumber(date) * ROUTINE_DAY_MS).getUTCDate());
    button.append(name, dateNum);
    button.addEventListener('click', () => { glowupViewDay = d; renderGlowup(); });
    strip.appendChild(button);
  }

  // Daily goals for the selected day.
  const dayDate = routineDateAt(glowup.startDate, day);
  const dayStats = glowupDayStats(glowup, day);
  document.getElementById('glowup-day-title').textContent = routineDateLabel(dayDate);
  document.getElementById('glowup-day-count').textContent = `${dayStats.done} / ${dayStats.total}`;
  const dayBar = document.getElementById('glowup-day-progress');
  dayBar.max = dayStats.total; dayBar.value = dayStats.done;
  dayBar.textContent = `${dayStats.done} of ${dayStats.total} daily goals completed`;
  const dayLock = glowupDayLockMessage(glowup, day);
  const dayBanner = document.getElementById('glowup-day-lock');
  dayBanner.textContent = dayLock;
  dayBanner.classList.toggle('hidden', !dayLock);
  const dailyList = document.getElementById('glowup-daily-list');
  dailyList.replaceChildren();
  GLOWUP_DAILY.forEach((goal, i) => {
    const applies = glowupGoalApplies(goal, dayDate);
    const id = `glowup-daily-${i}`;
    const row = glowupTickRow(id, goal.label + (goal.note ? ` (${goal.note})` : ''), goal.icon,
      glowup.days[day].done[i], !!dayLock || !applies,
      `${goal.label}${!applies ? ', not needed at weekends' : dayLock ? ', locked until this day starts' : ''}`,
      input => {
        try {
          const result = setGlowupDaily(day, i, input.checked);
          glowupJustTicked = input.checked ? id : null;
          renderGlowup(); renderGlowupHome();
          document.getElementById(id).focus();
          if (result.perfectDay) toast('Perfect day! You are glowing \u2728');
        } catch (error) { glowupHandleError(input, error); }
      }, glowupJustTicked === id);
    if (!applies) row.classList.add('rest');
    if (glowupJustTicked === id) glowupJustTicked = null;
    dailyList.appendChild(row);
  });

  // Weekly goals.
  const weekLock = glowupWeekLockMessage(glowup, week);
  const weekBanner = document.getElementById('glowup-week-lock');
  weekBanner.textContent = weekLock;
  weekBanner.classList.toggle('hidden', !weekLock);
  const weeklyList = document.getElementById('glowup-weekly-list');
  weeklyList.replaceChildren();
  const weeklySection = (heading, groups) => {
    const section = document.createElement('section');
    section.className = 'glowup-weekly-group';
    const h = document.createElement('h4');
    h.textContent = heading;
    section.appendChild(h);
    groups.forEach(spec => {
      const wrap = document.createElement('div');
      wrap.className = 'glowup-weekly-item';
      const items = glowup.weeks[week][spec.id];
      const label = document.createElement('div');
      label.className = 'glowup-weekly-label';
      label.textContent = spec.count > 1 && spec.id !== 'lovely' ?
        `${spec.icon} ${spec.label} \u00b7 ${items.filter(Boolean).length}/${spec.count}` : '';
      if (label.textContent) wrap.appendChild(label);
      const ticks = document.createElement('div');
      ticks.className = 'glowup-weekly-ticks';
      items.forEach((checked, i) => {
        const id = `glowup-${spec.id}-${i}`;
        const text = spec.id === 'lovely' ? GLOWUP_LOVELY[i].label : `${spec.label.replace(/s$/, '')} ${i + 1}`;
        const icon = spec.id === 'lovely' ? GLOWUP_LOVELY[i].icon : spec.icon;
        ticks.appendChild(glowupTickRow(id, text, icon, checked, !!weekLock,
          `${text}${weekLock ? ', locked until this week starts' : ''}`,
          input => {
            try {
              const result = setGlowupWeekly(week, spec.id, i, input.checked);
              glowupJustTicked = input.checked ? id : null;
              renderGlowup(); renderGlowupHome();
              document.getElementById(id).focus();
              if (result.perfectWeek) toast(`Week ${week + 1} complete. Absolutely glowing \u2728`);
            } catch (error) { glowupHandleError(input, error); }
          }, glowupJustTicked === id));
        if (glowupJustTicked === id) glowupJustTicked = null;
      });
      wrap.appendChild(ticks);
      section.appendChild(wrap);
    });
    return section;
  };
  weeklyList.append(
    weeklySection('Weekly movement', GLOWUP_MOVEMENT),
    weeklySection('Little things that make life lovely', [GLOWUP_WEEKLY_GROUPS.find(g => g.id === 'lovely')].map(g => ({ ...g, label: 'Lovely', icon: '' }))),
  );
}

function initGlowup() {
  document.querySelectorAll('[data-open-glowup]').forEach(button => button.addEventListener('click', openGlowup));
  document.getElementById('glowup-form').addEventListener('submit', event => {
    event.preventDefault();
    try {
      const date = document.getElementById('glowup-start-date').value;
      routineDateNumber(date);
      if (getGlowup() && !confirm('Start a new Glow-Up? This replaces your existing Glow-Up checklist.')) return;
      createGlowup(date);
      glowupViewWeek = null; glowupViewDay = null;
      document.getElementById('glowup-setup').classList.add('hidden');
      renderGlowup(); renderGlowupHome();
      toast('Glow-Up is on. Eight weeks of lovely!');
    } catch (error) {
      console.error('[Glow-Up] Commitment failed:', error);
      toast(error.message, 'error');
    }
  });
  document.getElementById('glowup-new').addEventListener('click', () => {
    document.getElementById('glowup-setup').classList.remove('hidden');
    document.getElementById('glowup-start-date').focus();
  });
  document.getElementById('glowup-cancel-setup').addEventListener('click', () => {
    document.getElementById('glowup-setup').classList.add('hidden');
  });
  let lastDate = routineLocalDate();
  const refresh = () => {
    const date = routineLocalDate();
    if (date === lastDate) return;
    lastDate = date;
    glowupViewWeek = null; glowupViewDay = null;
    if (getProfile()) renderGlowupHome();
    if (currentScreen === 'glowup') renderGlowup();
  };
  window.addEventListener('focus', refresh);
  document.addEventListener('visibilitychange', refresh);
  setInterval(refresh, 60000);
}

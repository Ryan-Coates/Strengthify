const CLEAN_SWEEP_TAGLINE = 'Little resets. Lovely rooms. A lighter home.';
const CLEAN_SWEEP_DAILY = ['15 minutes reset', 'Toilet Swish'];
const CLEAN_SWEEP_WEEKLY = [
  'Kitchen', 'Sitting Room', 'Hallway/Porch', 'Utility', 'Our bedroom',
  "Dylan's bedroom", 'Spare Room/Office', 'Bathrooms up & down', 'En-suite',
];
const CLEAN_SWEEP_SATURDAY = ['Towels', "Ralph's bedding"];
const CLEAN_SWEEP_SUNDAY = ['Bedding', 'Clean Fridge', 'Microwave'];
const CLEAN_SWEEP_MONTH_START = ['Banana', 'BMW', 'Blinds', 'Wardrobe refresh'];
const CLEAN_SWEEP_MONTH_END = ['Windows', 'Garden'];
let cleanSweepViewDate = null;

function cleanSweepMonday(date) {
  const weekday = glowupWeekday(date);
  return routineDateAt(date, -(weekday === 0 ? 6 : weekday - 1));
}

function cleanSweepQuarterly(date) {
  const month = Number(date.slice(5, 7));
  if ([2, 5, 8, 11].includes(month)) return ['Kitchen cupboards & utility organise'];
  if ([3, 6, 9, 12].includes(month)) return ["Dylan's toys & my drawers"];
  return [];
}

function cleanSweepPeriod(group, date) {
  routineDateNumber(date);
  if (group === 'daily') {
    const weekday = glowupWeekday(date);
    const weekend = weekday === 6 ? CLEAN_SWEEP_SATURDAY : weekday === 0 ? CLEAN_SWEEP_SUNDAY : [];
    return { key: `daily-${date}`, date, goals: [...CLEAN_SWEEP_DAILY, ...weekend] };
  }
  if (group === 'weekly') {
    const monday = cleanSweepMonday(date);
    return { key: `weekly-${monday}`, date: monday, goals: CLEAN_SWEEP_WEEKLY };
  }
  if (group === 'monthly') {
    const first = date.slice(0, 7) + '-01';
    return {
      key: `monthly-${date.slice(0, 7)}`, date: first,
      goals: [...CLEAN_SWEEP_MONTH_START, ...CLEAN_SWEEP_MONTH_END, ...cleanSweepQuarterly(date)],
    };
  }
  throw new Error('That Clean Sweep period could not be found.');
}

function cleanSweepPeriodFromKey(key) {
  if (typeof key !== 'string') throw new Error('Invalid Clean Sweep period.');
  const match = /^(daily|weekly|monthly)-(.+)$/.exec(key);
  if (!match) throw new Error('Invalid Clean Sweep period.');
  const date = match[1] === 'monthly' ? match[2] + '-01' : match[2];
  const period = cleanSweepPeriod(match[1], date);
  if (period.key !== key) throw new Error('Invalid Clean Sweep period.');
  return { ...period, group: match[1] };
}

function validateCleanSweepRecord(key, record, startDate) {
  const period = cleanSweepPeriodFromKey(key);
  const first = cleanSweepPeriod(period.group, startDate);
  if (!record || !Number.isFinite(record.updatedAt) || record.updatedAt <= 0 ||
      !Array.isArray(record.done) || record.done.length !== period.goals.length ||
      !record.done.every(value => typeof value === 'boolean') ||
      routineDateNumber(period.date) < routineDateNumber(first.date)) {
    throw new Error('Invalid Clean Sweep progress. Restore a valid backup.');
  }
}

function validateCleanSweep(cleanSweep) {
  if (!cleanSweep || typeof cleanSweep.id !== 'string' || !/^[\w-]+$/.test(cleanSweep.id) ||
      typeof cleanSweep.active !== 'boolean' ||
      !Number.isFinite(cleanSweep.updatedAt) || cleanSweep.updatedAt <= 0 ||
      !cleanSweep.records || typeof cleanSweep.records !== 'object' || Array.isArray(cleanSweep.records)) {
    throw new Error('Invalid Clean Sweep data. Restore a valid backup.');
  }
  routineDateNumber(cleanSweep.startDate);
  Object.entries(cleanSweep.records).forEach(([key, record]) =>
    validateCleanSweepRecord(key, record, cleanSweep.startDate));
}

function getCleanSweep() {
  const raw = localStorage.getItem(KEYS.CLEAN_SWEEP);
  const cleanSweep = raw ? JSON.parse(raw) : null;
  if (cleanSweep !== null) validateCleanSweep(cleanSweep);
  return cleanSweep;
}

function cleanSweepSyncError(error) {
  console.error('[Clean Sweep] Cloud sync failed:', error);
  setSyncStatus('error');
  toast('Clean Sweep saved on this device, but cloud sync failed. Try Sync now when online.', 'error');
}

function saveCleanSweep(cleanSweep, recordKey = null) {
  validateCleanSweep(cleanSweep);
  if (recordKey === null) {
    cleanSweep.updatedAt = Math.max(Date.now(), cleanSweep.updatedAt + 1,
      Number(localStorage.getItem(KEYS.CLEAN_SWEEP_TS) || 0) + 1);
  }
  localStorage.setItem(KEYS.CLEAN_SWEEP, JSON.stringify(cleanSweep));
  localStorage.setItem(KEYS.CLEAN_SWEEP_TS, String(cleanSweep.updatedAt));
  if (recordKey === null) {
    if (typeof syncPushCleanSweep === 'function') syncPushCleanSweep(cleanSweep)?.catch(cleanSweepSyncError);
  } else if (typeof syncPushCleanSweepRecord === 'function') {
    syncPushCleanSweepRecord(cleanSweep.id, recordKey, cleanSweep.records[recordKey])?.catch(cleanSweepSyncError);
  }
}

function createCleanSweep(startDate) {
  routineDateNumber(startDate);
  if (getCleanSweep()) throw new Error('Clean Sweep already exists. Resume it to keep your history.');
  const cleanSweep = { id: uuid(), startDate, active: true, updatedAt: Date.now(), records: {} };
  saveCleanSweep(cleanSweep);
  return cleanSweep;
}

function restoreCleanSweep(cleanSweep) {
  if (cleanSweep === null) {
    const updatedAt = Math.max(Date.now(), Number(localStorage.getItem(KEYS.CLEAN_SWEEP_TS) || 0) + 1);
    localStorage.setItem(KEYS.CLEAN_SWEEP, 'null');
    localStorage.setItem(KEYS.CLEAN_SWEEP_TS, String(updatedAt));
    if (typeof syncPushCleanSweep === 'function') syncPushCleanSweep(null, updatedAt)?.catch(cleanSweepSyncError);
    return;
  }
  validateCleanSweep(cleanSweep);
  const existing = getCleanSweep();
  Object.entries(cleanSweep.records).forEach(([key, record]) => {
    record.updatedAt = Math.max(Date.now(), record.updatedAt + 1,
      (existing?.id === cleanSweep.id ? existing.records[key]?.updatedAt || 0 : 0) + 1);
  });
  saveCleanSweep(cleanSweep);
  Object.entries(cleanSweep.records).forEach(([key, record]) => {
    if (typeof syncPushCleanSweepRecord === 'function') {
      syncPushCleanSweepRecord(cleanSweep.id, key, record)?.catch(cleanSweepSyncError);
    }
  });
}

function cleanSweepStats(cleanSweep, group, date) {
  const period = cleanSweepPeriod(group, date);
  const done = cleanSweep.records[period.key]?.done.filter(Boolean).length || 0;
  return { done, total: period.goals.length };
}

function setCleanSweepGoal(group, date, index, done, today = routineLocalDate()) {
  const cleanSweep = getCleanSweep();
  const period = cleanSweepPeriod(group, date);
  if (!cleanSweep || !cleanSweep.active) throw new Error('Opt in to Clean Sweep before ticking chores.');
  if (!Number.isInteger(index) || index < 0 || index >= period.goals.length || typeof done !== 'boolean') {
    throw new Error('That Clean Sweep chore could not be found.');
  }
  if (routineDateNumber(date) < routineDateNumber(cleanSweep.startDate)) {
    throw new Error('Clean Sweep had not started on this date.');
  }
  if (routineDateNumber(cleanSweep.startDate) > routineDateNumber(today) ||
      routineDateNumber(period.date) > routineDateNumber(today)) {
    throw new Error('This Clean Sweep period has not started yet.');
  }
  const before = cleanSweepStats(cleanSweep, group, date);
  const record = cleanSweep.records[period.key] || { done: Array(period.goals.length).fill(false), updatedAt: 0 };
  record.done[index] = done;
  record.updatedAt = Math.max(Date.now(), record.updatedAt + 1);
  cleanSweep.records[period.key] = record;
  saveCleanSweep(cleanSweep, period.key);
  const after = cleanSweepStats(cleanSweep, group, date);
  return { cleanSweep, complete: done && after.done === after.total && before.done < before.total };
}

function renderCleanSweepHome() {
  const cleanSweep = getCleanSweep();
  const title = document.getElementById('home-cleansweep-title');
  const detail = document.getElementById('home-cleansweep-detail');
  const bar = document.getElementById('home-cleansweep-progress');
  title.textContent = CLEAN_SWEEP_TAGLINE;
  bar.max = 1; bar.value = 0;
  if (!cleanSweep) {
    detail.textContent = 'An ongoing home-care commitment. Opt in alongside Glow-Up, with no finish date.';
    return;
  }
  const today = routineLocalDate();
  if (!cleanSweep.active) {
    detail.textContent = 'Opted out for now. Your history is kept; resume whenever you like.';
  } else if (today < cleanSweep.startDate) {
    detail.textContent = `Starts ${routineDateLabel(cleanSweep.startDate)}. Your fresh-home rhythm is ready.`;
  } else {
    const stats = cleanSweepStats(cleanSweep, 'daily', today);
    bar.max = stats.total; bar.value = stats.done;
    bar.textContent = `${stats.done} of ${stats.total} chores today`;
    detail.textContent = `${stats.done} / ${stats.total} today · ${cleanSweepStats(cleanSweep, 'weekly', today).done} / 9 weekly rooms.`;
  }
}

function openCleanSweep() {
  const cleanSweep = getCleanSweep();
  cleanSweepViewDate = cleanSweep && cleanSweep.startDate > routineLocalDate() ? cleanSweep.startDate : routineLocalDate();
  renderCleanSweep();
  showScreen('cleansweep');
}

function cleanSweepRenderGroup(cleanSweep, group, date, container, sections) {
  const period = cleanSweepPeriod(group, date);
  const stats = cleanSweepStats(cleanSweep, group, date);
  const bar = document.getElementById(`cleansweep-${group}-progress`);
  bar.max = stats.total; bar.value = stats.done;
  bar.textContent = `${stats.done} of ${stats.total} chores completed`;
  document.getElementById(`cleansweep-${group}-count`).textContent = `${stats.done} / ${stats.total}`;
  const locked = !cleanSweep.active || cleanSweep.startDate > routineLocalDate() || period.date > routineLocalDate();
  container.replaceChildren();
  sections.forEach(({ title, offset, goals }) => {
    const section = document.createElement('section');
    section.className = 'glowup-weekly-group';
    const heading = document.createElement('h3');
    heading.className = 'glowup-section-title';
    heading.textContent = title;
    section.appendChild(heading);
    if (goals.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'cleansweep-note';
      empty.textContent = 'No quarterly job scheduled this month. Enjoy the breathing room.';
      section.appendChild(empty);
    }
    goals.forEach((goal, index) => {
      const goalIndex = offset + index;
      const id = `cleansweep-${group}-${goalIndex}`;
      const row = glowupTickRow(id, goal, '\u2728', cleanSweep.records[period.key]?.done[goalIndex] || false,
        locked, `${goal}, ${routineDateLabel(period.date)}${locked ? ', locked' : ''}`, input => {
          try {
            const result = setCleanSweepGoal(group, date, goalIndex, input.checked);
            renderCleanSweep(); renderCleanSweepHome();
            const replacement = document.getElementById(id);
            if (input.checked) replacement.closest('label').classList.add('just-ticked');
            replacement.focus();
            if (result.complete) toast(`Clean Sweep ${group === 'daily' ? 'day' : group === 'weekly' ? 'week' : 'month'} complete! A little sparkle earned \u2728`);
          } catch (error) {
            input.checked = !input.checked;
            console.error('[Clean Sweep] Check-off failed:', error);
            toast(error.message, 'error');
          }
        }, false);
      section.appendChild(row);
    });
    container.appendChild(section);
  });
}

function renderCleanSweep() {
  const cleanSweep = getCleanSweep();
  document.getElementById('cleansweep-setup').classList.toggle('hidden', !!cleanSweep);
  document.getElementById('cleansweep-dashboard').classList.toggle('hidden', !cleanSweep);
  const start = document.getElementById('cleansweep-start-date');
  if (!start.value) start.value = routineLocalDate();
  const preview = document.getElementById('cleansweep-preview');
  preview.replaceChildren();
  [
    ['Daily', CLEAN_SWEEP_DAILY], ['Weekly rooms', CLEAN_SWEEP_WEEKLY],
    ['Saturday', CLEAN_SWEEP_SATURDAY], ['Sunday', CLEAN_SWEEP_SUNDAY],
    ['Start of the month', CLEAN_SWEEP_MONTH_START], ['End of the month', CLEAN_SWEEP_MONTH_END],
    ['Feb / May / Aug / Nov', cleanSweepQuarterly('2026-11-01')],
    ['Mar / Jun / Sep / Dec', cleanSweepQuarterly('2026-12-01')],
  ].forEach(([title, goals]) => {
    const item = document.createElement('li');
    const heading = document.createElement('strong');
    heading.textContent = title;
    const text = document.createElement('span');
    text.textContent = goals.join(' \u00b7 ');
    item.append(heading, text);
    preview.appendChild(item);
  });
  if (!cleanSweep) return;
  const date = cleanSweepViewDate || routineLocalDate();
  const dateInput = document.getElementById('cleansweep-view-date');
  dateInput.min = cleanSweep.startDate; dateInput.value = date;
  document.getElementById('cleansweep-status').textContent =
    `${cleanSweep.active ? 'Opted in' : 'Opted out'} since ${routineDateLabel(cleanSweep.startDate)} · No finish date`;
  document.getElementById('cleansweep-toggle').textContent = cleanSweep.active ? 'Opt out (keep history)' : 'Resume Clean Sweep';
  const banner = document.getElementById('cleansweep-lock');
  banner.textContent = !cleanSweep.active ? 'Opted out. Your history is safe; resume to tick chores again.' :
    cleanSweep.startDate > routineLocalDate() ? `Not live yet. Clean Sweep starts ${routineDateLabel(cleanSweep.startDate)}.` :
    date > routineLocalDate() ? 'Previewing a future day. Daily chores unlock on that date; weekly and monthly chores unlock when their period starts.' : '';
  banner.classList.toggle('hidden', !banner.textContent);
  document.getElementById('cleansweep-day-title').textContent = routineDateLabel(date);
  const monday = cleanSweepMonday(date);
  document.getElementById('cleansweep-week-dates').textContent =
    `${routineDateLabel(monday)} - ${routineDateLabel(routineDateAt(monday, 6))} · Resets Monday`;
  document.getElementById('cleansweep-month-title').textContent =
    new Date(date + 'T00:00:00Z').toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const weekday = glowupWeekday(date);
  const weekend = weekday === 6 ? CLEAN_SWEEP_SATURDAY : weekday === 0 ? CLEAN_SWEEP_SUNDAY : [];
  const dailySections = [{ title: 'Daily little resets', offset: 0, goals: CLEAN_SWEEP_DAILY }];
  if (weekend.length) dailySections.push({ title: weekday === 6 ? 'Saturday laundry' : 'Sunday fresh start', offset: 2, goals: weekend });
  cleanSweepRenderGroup(cleanSweep, 'daily', date, document.getElementById('cleansweep-daily-list'), dailySections);
  cleanSweepRenderGroup(cleanSweep, 'weekly', date, document.getElementById('cleansweep-weekly-list'),
    [{ title: 'Weekly room sweep · Any days you like', offset: 0, goals: CLEAN_SWEEP_WEEKLY }]);
  cleanSweepRenderGroup(cleanSweep, 'monthly', date, document.getElementById('cleansweep-monthly-list'), [
    { title: 'Start of the month', offset: 0, goals: CLEAN_SWEEP_MONTH_START },
    { title: 'End of the month', offset: 4, goals: CLEAN_SWEEP_MONTH_END },
    { title: 'Every three months · This month', offset: 6, goals: cleanSweepQuarterly(date) },
  ]);
}

function initCleanSweep() {
  document.querySelectorAll('[data-open-cleansweep]').forEach(button => button.addEventListener('click', openCleanSweep));
  document.getElementById('cleansweep-form').addEventListener('submit', event => {
    event.preventDefault();
    try {
      const startDate = document.getElementById('cleansweep-start-date').value;
      createCleanSweep(startDate);
      cleanSweepViewDate = startDate > routineLocalDate() ? startDate : routineLocalDate();
      renderCleanSweep(); renderCleanSweepHome();
      toast('Welcome to Clean Sweep. A lighter home, one little reset at a time \u2728');
    } catch (error) {
      console.error('[Clean Sweep] Opt-in failed:', error);
      toast(error.message, 'error');
    }
  });
  document.getElementById('cleansweep-view-date').addEventListener('change', event => {
    try {
      const date = event.target.value;
      routineDateNumber(date);
      if (date < getCleanSweep().startDate) throw new Error('Choose a date on or after your Clean Sweep start.');
      cleanSweepViewDate = date;
      renderCleanSweep();
    } catch (error) {
      event.target.value = cleanSweepViewDate;
      console.error('[Clean Sweep] Date selection failed:', error);
      toast(error.message, 'error');
    }
  });
  document.getElementById('cleansweep-today').addEventListener('click', openCleanSweep);
  document.getElementById('cleansweep-toggle').addEventListener('click', () => {
    try {
      const cleanSweep = getCleanSweep();
      if (cleanSweep.active && !confirm('Opt out of Clean Sweep? Your check-off history is kept, and Glow-Up is unchanged.')) return;
      cleanSweep.active = !cleanSweep.active;
      saveCleanSweep(cleanSweep);
      renderCleanSweep(); renderCleanSweepHome();
      toast(cleanSweep.active ? 'Clean Sweep resumed. Welcome back!' : 'Opted out. Your Clean Sweep history is kept.');
    } catch (error) {
      console.error('[Clean Sweep] Opt-in change failed:', error);
      toast(error.message, 'error');
    }
  });
  let lastDate = routineLocalDate();
  const refresh = () => {
    const date = routineLocalDate();
    if (date === lastDate) return;
    lastDate = date;
    cleanSweepViewDate = null;
    if (getProfile()) renderCleanSweepHome();
    if (currentScreen === 'cleansweep') openCleanSweep();
  };
  window.addEventListener('focus', refresh);
  document.addEventListener('visibilitychange', refresh);
  setInterval(refresh, 60000);
}

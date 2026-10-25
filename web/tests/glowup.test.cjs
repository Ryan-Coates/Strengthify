const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

function app() {
  const storage = new Map();
  const context = vm.createContext({
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value)),
      clear: () => storage.clear(),
    },
    crypto: webcrypto,
    console: { log() {}, error() {}, group() {}, groupEnd() {} },
    setSyncStatus() {},
    toast() {},
  });
  for (const name of ['data.js', 'routine.js', 'glowup.js', 'sync.js']) {
    vm.runInContext(readFileSync(join(__dirname, '..', 'src', name), 'utf8'), context);
  }
  return {
    context, storage,
    run: code => vm.runInContext(code, context),
    data: code => JSON.parse(vm.runInContext(`JSON.stringify(${code})`, context)),
  };
}

// 2026-10-26 is a Monday. Day 5 is Saturday, day 6 is Sunday.
const START = '2026-10-26';

test('weekday maths: Monday start, weekends have no wake-up goal', () => {
  const a = app();
  assert.equal(a.run("glowupWeekday('2026-10-26')"), 1);
  assert.equal(a.run("glowupWeekday('2026-10-31')"), 6);
  assert.equal(a.run("glowupWeekday('2026-11-01')"), 0);
  a.run(`createGlowup('${START}')`);
  assert.deepEqual(a.data('glowupDayStats(getGlowup(), 0)'), { done: 0, total: 8 });
  assert.deepEqual(a.data('glowupDayStats(getGlowup(), 5)'), { done: 0, total: 7 });
  assert.deepEqual(a.data('glowupDayStats(getGlowup(), 6)'), { done: 0, total: 7 });
  assert.deepEqual(a.data('glowupWeekStats(getGlowup(), 0)'), { done: 0, total: 5 * 8 + 2 * 7 + 13 });
  assert.equal(a.run('glowupProgress(getGlowup()).total'), 8 * 67);
});

test('goal list matches the plan exactly', () => {
  const a = app();
  assert.deepEqual(a.data('GLOWUP_DAILY.map(g => g.label)'), [
    '5:30am wake up', '2 litres of water', '10,000 steps', '100g+ protein',
    '30 minute homework', 'Morning face care and teeth', 'Meditation', 'Journaling',
  ]);
  assert.deepEqual(a.data('GLOWUP_MOVEMENT.map(g => [g.id, g.count])'), [['runs', 2], ['weights', 3], ['abs', 5]]);
  assert.deepEqual(a.data('GLOWUP_LOVELY.map(g => g.label)'),
    ['Tuesday date night', 'Friday craft night', 'Me and Dylan time']);
  assert.equal(a.run('GLOWUP_WEEKS'), 8);
});

test('daily ticks persist, unlock by day and can be undone', () => {
  const a = app();
  a.run(`createGlowup('${START}')`);
  a.run(`setGlowupDaily(0, 1, true, '${START}')`);
  assert.equal(a.run('getGlowup().days[0].done[1]'), true);
  assert.equal(a.run('getGlowup().days[1].done[1]'), false);
  assert.throws(() => a.run(`setGlowupDaily(1, 0, true, '${START}')`), /not started/);
  assert.throws(() => a.run("setGlowupDaily(0, 0, true, '2026-10-25')"), /not started/);
  a.run("setGlowupDaily(0, 1, false, '2026-12-30')");
  assert.equal(a.run('getGlowup().days[0].done[1]'), false);
  assert.equal(a.run('getSessions().length'), 0);
});

test('wake-up cannot be ticked on weekends', () => {
  const a = app();
  a.run(`createGlowup('${START}')`);
  assert.throws(() => a.run("setGlowupDaily(5, 0, true, '2026-12-30')"), /does not apply/);
  a.run("setGlowupDaily(5, 1, true, '2026-12-30')");
  assert.equal(a.run('getGlowup().days[5].done[1]'), true);
});

test('a perfect day is reported once, and weekend perfect days ignore wake-up', () => {
  const a = app();
  a.run(`createGlowup('${START}')`);
  for (let goal = 0; goal < 7; goal++) {
    assert.equal(a.run(`setGlowupDaily(0, ${goal}, true, '${START}').perfectDay`), false);
  }
  assert.equal(a.run(`setGlowupDaily(0, 7, true, '${START}').perfectDay`), true);
  a.run(`setGlowupDaily(0, 7, false, '${START}')`);
  assert.equal(a.run(`setGlowupDaily(0, 7, true, '${START}').perfectDay`), true);
  for (let goal = 1; goal < 7; goal++) a.run(`setGlowupDaily(5, ${goal}, true, '2026-12-30')`);
  assert.equal(a.run("setGlowupDaily(5, 7, true, '2026-12-30').perfectDay"), true);
});

test('weekly goals respect counts, week start and perfect-week reporting', () => {
  const a = app();
  a.run(`createGlowup('${START}')`);
  assert.throws(() => a.run(`setGlowupWeekly(1, 'runs', 0, true, '${START}')`), /not started/);
  assert.throws(() => a.run(`setGlowupWeekly(0, 'runs', 2, true, '${START}')`), /not be found/);
  assert.throws(() => a.run(`setGlowupWeekly(0, 'abs', 5, true, '${START}')`), /not be found/);
  assert.throws(() => a.run(`setGlowupWeekly(0, 'yoga', 0, true, '${START}')`), /not be found/);
  a.run(`setGlowupWeekly(0, 'abs', 4, true, '${START}')`);
  assert.equal(a.run('getGlowup().weeks[0].abs[4]'), true);
  assert.equal(a.run('getGlowup().weeks[1].abs[4]'), false);
  assert.equal(a.run("setGlowupWeekly(0, 'lovely', 2, true, '2026-12-30').perfectWeek"), false);
  assert.deepEqual(a.data('glowupWeeklyStats(getGlowup(), 0)'), { done: 2, total: 13 });
});

test('a fully completed week is a perfect week', () => {
  const a = app();
  a.run(`createGlowup('${START}')`);
  const result = a.data(`(() => {
    const date = '2026-12-30';
    for (let d = 0; d < 7; d++) for (let g = 0; g < 8; g++) {
      if (glowupGoalApplies(GLOWUP_DAILY[g], routineDateAt(getGlowup().startDate, d))) setGlowupDaily(d, g, true, date);
    }
    const reports = [];
    for (const spec of GLOWUP_WEEKLY_GROUPS) for (let i = 0; i < spec.count; i++) {
      reports.push(setGlowupWeekly(0, spec.id, i, true, date).perfectWeek);
    }
    return { reports, stats: glowupWeekStats(getGlowup(), 0) };
  })()`);
  assert.deepEqual(result.stats, { done: 67, total: 67 });
  assert.equal(result.reports.filter(Boolean).length, 1);
  assert.equal(result.reports.at(-1), true);
});

test('lock messages explain that a future start is expected, not a fault', () => {
  const a = app();
  a.run(`createGlowup('${START}')`);
  const before = a.run("glowupDayLockMessage(getGlowup(), 0, '2026-10-25')");
  assert.match(before, /Not live yet/);
  assert.match(before, /tomorrow/);
  assert.match(before, /nothing is broken/);
  assert.match(a.run("glowupWeekLockMessage(getGlowup(), 0, '2026-10-25')"), /Not live yet/);
  assert.equal(a.run(`glowupDayLockMessage(getGlowup(), 0, '${START}')`), '');
  assert.match(a.run(`glowupDayLockMessage(getGlowup(), 1, '${START}')`), /unlocks tomorrow/);
  assert.equal(a.run(`glowupWeekLockMessage(getGlowup(), 0, '${START}')`), '');
  assert.match(a.run(`glowupWeekLockMessage(getGlowup(), 1, '${START}')`), /Week 2 unlocks/);
});

test('invalid dates and malformed data are rejected without changing saved data', () => {
  const a = app();
  assert.throws(() => a.run("createGlowup('2026-02-30')"), /valid start date/);
  a.run(`createGlowup('${START}')`);
  const original = a.data('getGlowup()');
  assert.throws(() => a.run("setGlowupDaily(56, 0, true, '2027-12-30')"), /not be found/);
  assert.throws(() => a.run("setGlowupDaily(0, 8, true, '2027-12-30')"), /not be found/);
  assert.throws(() => a.run(`importData('{"glowup":{"days":[]}}')`), /Invalid Glow-Up/);
  assert.deepEqual(a.data('getGlowup()'), original);
});

test('backup round-trips Glow-Up and old backups leave it untouched', () => {
  const a = app();
  a.run(`createGlowup('${START}'); setGlowupDaily(0, 2, true, '${START}')`);
  a.run(`createRoutine('${START}')`);
  const backup = a.run('exportData()');
  a.run('localStorage.clear()');
  a.context.backup = backup;
  a.run('importData(backup)');
  assert.equal(a.run('getGlowup().days[0].done[2]'), true);
  assert.equal(a.run('getRoutine().startDate'), START);
  a.run(`importData('{"sessions":[],"pbs":{}}')`);
  assert.equal(a.run('getGlowup().days[0].done[2]'), true);
  a.run(`importData('{"glowup":null}')`);
  assert.equal(a.run('getGlowup()'), null);
  assert.equal(a.run('getRoutine().startDate'), START);
});

test('Glow-Up payload is Firestore-safe and cloud merge uses the newest copy', async () => {
  const a = app();
  a.context.writes = [];
  a.context.cloud = {};
  a.run(`
    _syncUser = { uid: 'test-user' };
    _syncDb = { collection: () => ({ doc: () => ({
      get: async () => ({ exists: true, data: () => cloud }),
      set: data => { writes.push(data); return Promise.resolve(); },
      collection: () => ({ get: async () => ({ docs: [] }) }),
    }) }) };
  `);
  a.run(`createGlowup('${START}'); setGlowupDaily(0, 0, true, '${START}')`);
  await Promise.resolve();
  const payload = a.context.writes.at(-1).glowup;
  const noNestedArrays = value => {
    if (Array.isArray(value)) value.forEach(v => { assert.ok(!Array.isArray(v), 'nested array'); noNestedArrays(v); });
    else if (value && typeof value === 'object') Object.values(value).forEach(noNestedArrays);
  };
  noNestedArrays(payload);
  assert.equal(payload.days[0].done[0], true);

  // Newer cloud copy wins.
  const remote = a.data('getGlowup()');
  remote.days[0].done[3] = true;
  remote.updatedAt += 1000;
  a.context.cloud = { glowup: remote, glowupUpdatedAt: remote.updatedAt };
  await a.run('syncMergeOnSignIn()');
  assert.equal(a.run('getGlowup().days[0].done[3]'), true);

  // Older cloud copy is overwritten by the newer local one.
  a.context.writes.length = 0;
  a.context.cloud = { glowup: remote, glowupUpdatedAt: 1 };
  await a.run('syncMergeOnSignIn()');
  assert.equal(a.context.writes.at(-1).glowup.id, remote.id);

  // Explicit clear on another device propagates.
  a.context.cloud = { glowup: null, glowupUpdatedAt: remote.updatedAt + 5000 };
  await a.run('syncMergeOnSignIn()');
  assert.equal(a.run('getGlowup()'), null);

  // A malformed cloud copy is rejected before it overwrites local data.
  a.run(`createGlowup('${START}')`);
  a.context.cloud = { glowup: { id: 'x', days: [] }, glowupUpdatedAt: Date.now() + 99999 };
  await assert.rejects(a.run('syncMergeOnSignIn()'), /Invalid Glow-Up/);
  assert.equal(a.run('getGlowup().startDate'), START);
});

test('starting Glow-Up again resets only Glow-Up', () => {
  const a = app();
  a.run(`createRoutine('${START}'); setRoutineBlock(0, 0, true, '${START}')`);
  a.run(`createGlowup('${START}'); setGlowupDaily(0, 1, true, '${START}')`);
  const oldId = a.run('getGlowup().id');
  a.run("createGlowup('2026-11-02')");
  assert.notEqual(a.run('getGlowup().id'), oldId);
  assert.equal(a.run('glowupProgress(getGlowup()).done'), 0);
  assert.equal(a.run('getRoutine().completed[0][0]'), true);
});

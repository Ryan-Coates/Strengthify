const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

function firestoreSafe(value) {
  if (Array.isArray(value)) {
    value.forEach(item => {
      if (Array.isArray(item)) throw new Error('Nested arrays are not supported');
      firestoreSafe(item);
    });
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach(firestoreSafe);
  }
}

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
  for (const name of ['data.js', 'routine.js', 'glowup.js', 'cleansweep.js', 'sync.js']) {
    vm.runInContext(readFileSync(join(__dirname, '..', 'src', name), 'utf8'), context);
  }
  return {
    context,
    run: code => vm.runInContext(code, context),
    data: code => JSON.parse(vm.runInContext(`JSON.stringify(${code})`, context)),
  };
}

function cloudApp() {
  const a = app();
  a.context.cloud = {};
  a.context.periods = [];
  a.context.writes = [];
  a.context.firestoreSafe = firestoreSafe;
  a.run(`
    _syncUser = { uid: 'clean-sweep-tester' };
    _syncDb = { collection: () => ({ doc: () => ({
      get: async () => ({ exists: true, data: () => cloud }),
      set: async data => { firestoreSafe(data); writes.push({ kind: 'metadata', data }); },
      collection: name => ({
        doc: id => ({ set: async data => { firestoreSafe(data); writes.push({ kind: 'period', id, data }); } }),
        where: (field, op, id) => ({
          get: async () => ({ docs: periods.filter(record => record.commitmentId === id).map(record => ({ data: () => record })) }),
        }),
        get: async () => ({ docs: [] }),
      }),
    }) }) };
  `);
  return a;
}

test('task lists match Clean Sweep, including grouped bathroom and monthly chores', () => {
  const a = app();
  assert.deepEqual(a.data('CLEAN_SWEEP_DAILY'), ['15 minutes reset', 'Toilet Swish']);
  assert.deepEqual(a.data('CLEAN_SWEEP_WEEKLY'), [
    'Kitchen', 'Sitting Room', 'Hallway/Porch', 'Utility', 'Our bedroom',
    "Dylan's bedroom", 'Spare Room/Office', 'Bathrooms up & down', 'En-suite',
  ]);
  assert.deepEqual(a.data('CLEAN_SWEEP_SATURDAY'), ['Towels', "Ralph's bedding"]);
  assert.deepEqual(a.data('CLEAN_SWEEP_SUNDAY'), ['Bedding', 'Clean Fridge', 'Microwave']);
  assert.deepEqual(a.data('CLEAN_SWEEP_MONTH_START'), ['Banana', 'BMW', 'Blinds', 'Wardrobe refresh']);
  assert.deepEqual(a.data('CLEAN_SWEEP_MONTH_END'), ['Windows', 'Garden']);
});

test('quarterly jobs repeat in the specified months every year, with four empty months', () => {
  const a = app();
  for (const year of [2026, 2027, 2035]) {
    for (let month = 1; month <= 12; month++) {
      const date = `${year}-${String(month).padStart(2, '0')}-01`;
      const expected = [2, 5, 8, 11].includes(month) ? ['Kitchen cupboards & utility organise'] :
        [3, 6, 9, 12].includes(month) ? ["Dylan's toys & my drawers"] : [];
      assert.deepEqual(a.data(`cleanSweepQuarterly('${date}')`), expected);
      assert.equal(a.run(`cleanSweepPeriod('monthly', '${date}').goals.length`), 6 + expected.length);
    }
  }
});

test('daily weekend chores apply only to their own dates', () => {
  const a = app();
  assert.equal(a.run("cleanSweepPeriod('daily', '2026-10-30').goals.length"), 2);
  assert.deepEqual(a.data("cleanSweepPeriod('daily', '2026-10-31').goals"), ['15 minutes reset', 'Toilet Swish', 'Towels', "Ralph's bedding"]);
  assert.deepEqual(a.data("cleanSweepPeriod('daily', '2026-11-01').goals"), ['15 minutes reset', 'Toilet Swish', 'Bedding', 'Clean Fridge', 'Microwave']);
  a.run("createCleanSweep('2026-10-30'); setCleanSweepGoal('daily', '2026-10-31', 2, true, '2026-10-31')");
  assert.equal(a.run("cleanSweepStats(getCleanSweep(), 'daily', '2026-11-01').done"), 0);
  assert.throws(() => a.run("setCleanSweepGoal('daily', '2026-11-02', 2, true, '2026-11-02')"), /not be found/);
});

test('Monday rollover preserves history across month, year and DST boundaries', () => {
  const a = app();
  assert.equal(a.run("cleanSweepMonday('2026-11-01')"), '2026-10-26');
  assert.equal(a.run("cleanSweepMonday('2027-01-01')"), '2026-12-28');
  assert.equal(a.run("cleanSweepMonday('2027-03-28')"), '2027-03-22');
  a.run("createCleanSweep('2026-10-28'); setCleanSweepGoal('weekly', '2026-10-28', 0, true, '2026-10-28')");
  assert.equal(a.run("cleanSweepStats(getCleanSweep(), 'weekly', '2026-11-01').done"), 1);
  assert.equal(a.run("cleanSweepStats(getCleanSweep(), 'weekly', '2026-11-02').done"), 0);
  assert.equal(a.run("getCleanSweep().records['weekly-2026-10-26'].done[0]"), true);
});

test('start and end monthly tasks are available all month and reset without losing old ticks', () => {
  const a = app();
  a.run("createCleanSweep('2026-11-01')");
  a.run("setCleanSweepGoal('monthly', '2026-11-01', 4, true, '2026-11-01')");
  a.run("setCleanSweepGoal('monthly', '2026-11-30', 0, true, '2026-11-30')");
  assert.deepEqual(a.data("cleanSweepStats(getCleanSweep(), 'monthly', '2026-11-20')"), { done: 2, total: 7 });
  assert.deepEqual(a.data("cleanSweepStats(getCleanSweep(), 'monthly', '2026-12-01')"), { done: 0, total: 7 });
  assert.equal(a.run("getCleanSweep().records['monthly-2026-11'].done[4]"), true);
});

test('commitment remains usable years later, separately from eight-week commitments', () => {
  const a = app();
  a.run("createGlowup('2026-11-01'); createRoutine('2026-11-01'); createCleanSweep('2026-11-01')");
  const glowup = a.data('getGlowup()');
  const routine = a.data('getRoutine()');
  a.run("setCleanSweepGoal('daily', '2036-11-01', 0, true, '2036-11-01')");
  assert.equal(a.run("cleanSweepStats(getCleanSweep(), 'daily', '2036-11-01').done"), 1);
  assert.deepEqual(a.data('getGlowup()'), glowup);
  assert.deepEqual(a.data('getRoutine()'), routine);
  assert.equal(a.run('getSessions().length'), 0);
  assert.equal(a.run('getCleanSweep().active'), true);
  assert.throws(() => a.run("createCleanSweep('2036-11-01')"), /already exists/);
});

test('opt-out and resume retain history; unticking persists explicit false', () => {
  const a = app();
  a.run("createCleanSweep('2026-11-01'); setCleanSweepGoal('daily', '2026-11-01', 0, true, '2026-11-01')");
  a.run('const clean = getCleanSweep(); clean.active = false; saveCleanSweep(clean)');
  assert.throws(() => a.run("setCleanSweepGoal('daily', '2026-11-01', 1, true, '2026-11-01')"), /Opt in/);
  assert.equal(a.run("getCleanSweep().records['daily-2026-11-01'].done[0]"), true);
  a.run('const resumed = getCleanSweep(); resumed.active = true; saveCleanSweep(resumed)');
  a.run("setCleanSweepGoal('daily', '2026-11-01', 0, false, '2026-11-01')");
  assert.equal(a.run("getCleanSweep().records['daily-2026-11-01'].done[0]"), false);
});

test('future periods and pre-opt-in dates are rejected but current partial weeks and months work', () => {
  const a = app();
  a.run("createCleanSweep('2026-11-04')");
  assert.throws(() => a.run("setCleanSweepGoal('monthly', '2026-11-04', 0, true, '2026-11-03')"), /not started/);
  assert.throws(() => a.run("setCleanSweepGoal('daily', '2026-11-03', 0, true, '2026-11-04')"), /had not started/);
  assert.throws(() => a.run("setCleanSweepGoal('daily', '2026-11-05', 0, true, '2026-11-04')"), /not started/);
  assert.throws(() => a.run("setCleanSweepGoal('weekly', '2026-11-09', 0, true, '2026-11-04')"), /not started/);
  assert.throws(() => a.run("setCleanSweepGoal('monthly', '2026-12-01', 0, true, '2026-11-04')"), /not started/);
  a.run("setCleanSweepGoal('weekly', '2026-11-04', 0, true, '2026-11-04')");
  a.run("setCleanSweepGoal('monthly', '2026-11-04', 0, true, '2026-11-04')");
  a.run("setCleanSweepGoal('daily', '2026-11-04', 0, true, '2027-01-01')");
});

test('completion reports only the transition from incomplete to a full period', () => {
  const a = app();
  a.run("createCleanSweep('2026-11-02')");
  assert.equal(a.run("setCleanSweepGoal('daily', '2026-11-02', 0, true, '2026-11-02').complete"), false);
  assert.equal(a.run("setCleanSweepGoal('daily', '2026-11-02', 1, true, '2026-11-02').complete"), true);
  assert.equal(a.run("setCleanSweepGoal('daily', '2026-11-02', 1, true, '2026-11-02').complete"), false);
});

test('invalid chores, dates and malformed backup data cannot change saved progress', () => {
  const a = app();
  assert.throws(() => a.run("createCleanSweep('2026-02-30')"), /valid start date/);
  a.run("createCleanSweep('2026-11-01')");
  const original = a.data('getCleanSweep()');
  for (const call of [
    "setCleanSweepGoal('other', '2026-11-01', 0, true)",
    "setCleanSweepGoal('daily', '2026-11-01', -1, true)",
    "setCleanSweepGoal('daily', '2026-11-01', 1.5, true)",
    "setCleanSweepGoal('daily', '2026-11-01', 0, 1)",
  ]) assert.throws(() => a.run(call), /not be found/);
  for (const records of [
    [], { 'daily-2026-11-01': { done: [true], updatedAt: 1 } },
    { 'weekly-2026-11-01': { done: Array(9).fill(false), updatedAt: 1 } },
    { 'monthly-2026-10': { done: Array(6).fill(false), updatedAt: 1 } },
  ]) {
    a.context.bad = { ...original, records };
    assert.throws(() => a.run('importData(JSON.stringify({profile:{name:"wrong"}, cleanSweep:bad}))'), /Clean Sweep/);
    assert.equal(a.run('getProfile()'), null);
    assert.deepEqual(a.data('getCleanSweep()'), original);
  }
});

test('backups round-trip permanent history; older backups keep it; null explicitly clears it', () => {
  const a = app();
  a.run("createCleanSweep('2026-11-01'); setCleanSweepGoal('daily', '2026-11-01', 0, true, '2026-11-01')");
  a.context.backup = a.run('exportData()');
  a.run('localStorage.clear(); importData(backup)');
  assert.equal(a.run("getCleanSweep().records['daily-2026-11-01'].done[0]"), true);
  a.run('importData("{}")');
  assert.equal(a.run('getCleanSweep().active'), true);
  const beforeTs = a.run('getCleanSweep().updatedAt');
  a.run('importData(\'{"cleanSweep":null}\')');
  assert.equal(a.run('getCleanSweep()'), null);
  assert.ok(a.run('Number(localStorage.getItem(KEYS.CLEAN_SWEEP_TS))') > beforeTs);
});

test('cloud metadata stays small and history writes are separate Firestore-safe period documents', async () => {
  const a = cloudApp();
  a.run("createCleanSweep('2026-11-01')");
  a.run("setCleanSweepGoal('daily', '2026-11-01', 0, true, '2026-11-01')");
  await Promise.resolve();
  const metadata = a.context.writes.find(write => write.kind === 'metadata').data.cleanSweep;
  assert.equal(Object.hasOwn(metadata, 'records'), false);
  const record = a.context.writes.find(write => write.kind === 'period');
  assert.equal(record.data.key, 'daily-2026-11-01');
  assert.equal(record.data.done[0], true);
  assert.match(record.id, /_daily-2026-11-01$/);
  firestoreSafe(record.data);
});

test('sign-in merges periods independently, newest ticks and unticks win without losing other days', async () => {
  const a = cloudApp();
  a.run("createCleanSweep('2026-11-01'); setCleanSweepGoal('daily', '2026-11-01', 0, true, '2026-11-01')");
  a.run("setCleanSweepGoal('weekly', '2026-11-02', 0, true, '2026-11-02')");
  await Promise.resolve();
  const local = a.data('getCleanSweep()');
  a.context.cloud = { cleanSweep: { ...local, records: undefined }, cleanSweepUpdatedAt: local.updatedAt };
  delete a.context.cloud.cleanSweep.records;
  a.context.periods = [
    { commitmentId: local.id, key: 'daily-2026-11-01', done: Array(5).fill(false), updatedAt: local.records['daily-2026-11-01'].updatedAt + 1000 },
    { commitmentId: local.id, key: 'monthly-2026-11', done: [true, false, false, false, false, false, false], updatedAt: local.updatedAt + 1000 },
    { commitmentId: 'other-commitment', key: 'daily-2026-11-02', done: [true, true], updatedAt: local.updatedAt + 1000 },
  ];
  a.context.writes.length = 0;
  await a.run('syncMergeOnSignIn()');
  assert.equal(a.run("getCleanSweep().records['daily-2026-11-01'].done[0]"), false);
  assert.equal(a.run("getCleanSweep().records['monthly-2026-11'].done[0]"), true);
  assert.equal(a.run("getCleanSweep().records['weekly-2026-11-02'].done[0]"), true);
  assert.equal(a.run("getCleanSweep().records['daily-2026-11-02']"), undefined);
  assert.equal(a.context.writes.filter(write => write.kind === 'period').length, 1);
});

test('cloud opt-out wins without losing local ticks, and a newer null never resurrects old history', async () => {
  const a = cloudApp();
  a.run("createCleanSweep('2026-11-01'); setCleanSweepGoal('daily', '2026-11-01', 0, true, '2026-11-01')");
  const local = a.data('getCleanSweep()');
  a.context.cloud = {
    cleanSweep: { id: local.id, startDate: local.startDate, active: false, updatedAt: local.updatedAt + 1000 },
    cleanSweepUpdatedAt: local.updatedAt + 1000,
  };
  await a.run('syncMergeOnSignIn()');
  assert.equal(a.run('getCleanSweep().active'), false);
  assert.equal(a.run("getCleanSweep().records['daily-2026-11-01'].done[0]"), true);
  a.context.cloud = { cleanSweep: null, cleanSweepUpdatedAt: local.updatedAt + 2000 };
  await a.run('syncMergeOnSignIn()');
  assert.equal(a.run('getCleanSweep()'), null);
});

test('cloud-only commitment restores on a fresh device, including quarterly progress', async () => {
  const a = cloudApp();
  a.context.cloud = {
    cleanSweep: { id: 'cloud-only', startDate: '2026-11-01', active: true, updatedAt: 100 },
    cleanSweepUpdatedAt: 100,
  };
  a.context.periods = [{ commitmentId: 'cloud-only', key: 'monthly-2026-11', done: [false, false, false, false, false, false, true], updatedAt: 200 }];
  await a.run('syncMergeOnSignIn()');
  assert.equal(a.run('getCleanSweep().id'), 'cloud-only');
  assert.equal(a.run("getCleanSweep().records['monthly-2026-11'].done[6]"), true);
  assert.equal(a.context.writes.length, 0);
});

test('sync failures preserve local progress and notify, while merge failures reject explicitly', async () => {
  const a = cloudApp();
  a.run("createCleanSweep('2026-11-01')");
  a.context.notifications = [];
  a.run(`
    toast = message => notifications.push(message);
    _syncDb.collection = () => ({ doc: () => ({
      collection: () => ({
        doc: () => ({ set: async () => { throw new Error('offline'); } }),
        where: () => ({ get: async () => { throw new Error('offline'); } }),
      }),
    }) });
    setCleanSweepGoal('daily', '2026-11-01', 0, true, '2026-11-01');
  `);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(a.run("getCleanSweep().records['daily-2026-11-01'].done[0]"), true);
  assert.match(a.context.notifications[0], /saved on this device.*cloud sync failed/);
  await assert.rejects(a.run('syncMergeCleanSweep({})'), /offline/);
});

test('malformed cloud history is rejected without overwriting local check-offs', async () => {
  const a = cloudApp();
  a.run("createCleanSweep('2026-11-01'); setCleanSweepGoal('daily', '2026-11-01', 0, true, '2026-11-01')");
  const original = a.data('getCleanSweep()');
  a.context.periods = [{ commitmentId: original.id, key: 'monthly-2026-11', done: [true], updatedAt: original.updatedAt + 1000 }];
  await assert.rejects(a.run('syncMergeCleanSweep({})'), /Invalid Clean Sweep progress/);
  assert.deepEqual(a.data('getCleanSweep()'), original);
});

test('restoring older tick values stamps them newer than local edits and sends every backed-up period', async () => {
  const a = cloudApp();
  a.run("createCleanSweep('2026-11-01'); setCleanSweepGoal('daily', '2026-11-01', 0, true, '2026-11-01')");
  a.context.backup = a.data('getCleanSweep()');
  a.run("setCleanSweepGoal('daily', '2026-11-01', 0, false, '2026-11-01')");
  const previous = a.run("getCleanSweep().records['daily-2026-11-01'].updatedAt");
  a.context.writes.length = 0;
  a.run('restoreCleanSweep(backup)');
  await Promise.resolve();
  assert.equal(a.run("getCleanSweep().records['daily-2026-11-01'].done[0]"), true);
  assert.ok(a.run("getCleanSweep().records['daily-2026-11-01'].updatedAt") > previous);
  assert.equal(a.context.writes.filter(write => write.kind === 'metadata').length, 1);
  assert.equal(a.context.writes.filter(write => write.kind === 'period').length, 1);
});

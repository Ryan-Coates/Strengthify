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
  for (const name of ['data.js', 'routine.js', 'sync.js']) {
    vm.runInContext(readFileSync(join(__dirname, '..', 'src', name), 'utf8'), context);
  }
  return {
    context, storage,
    run: code => vm.runInContext(code, context),
    data: code => JSON.parse(vm.runInContext(`JSON.stringify(${code})`, context)),
  };
}

test('a commitment persists eight independent weeks with exactly two blocks per workout', () => {
  const a = app();
  a.run("createRoutine('2026-10-26')");
  assert.equal(a.run('ROUTINE_WORKOUTS.length'), 5);
  const routine = a.data('getRoutine()');
  assert.equal(routine.completed.length, 8);
  assert.equal(routine.completed.flat().length, 80);
  assert.ok(routine.completed.flat().every(done => done === false));
  a.run("setRoutineBlock(0, 0, true, '2026-10-26')");
  assert.equal(a.run('getRoutine().completed[0][0]'), true);
  assert.equal(a.run('getRoutine().completed[1][0]'), false);
  assert.equal(a.run('getSessions().length'), 0);
});

test('week boundaries are seven calendar days, including DST, month and year changes', () => {
  const a = app();
  a.run("createRoutine('2026-10-26')");
  for (const [date, expected] of [
    ['2026-10-25', -1], ['2026-10-26', 0], ['2026-11-01', 0],
    ['2026-11-02', 1], ['2026-12-20', 7], ['2026-12-21', 8],
  ]) {
    assert.equal(a.run(`routineCurrentWeek(getRoutine(), '${date}')`), expected);
  }
  assert.equal(a.run("routineDateAt('2026-12-28', 7)"), '2027-01-04');
  assert.equal(a.run("routineDateAt('2028-02-28', 1)"), '2028-02-29');
  assert.equal(a.run("routineDateAt('2026-10-24', 2)"), '2026-10-26');
  assert.equal(a.run('routineLocalDate(new Date(2026, 9, 26, 0, 5))'), '2026-10-26');
  assert.equal(a.run('routineLocalDate(new Date(2026, 9, 26, 23, 55))'), '2026-10-26');
});

test('blocks cannot be checked before their week, but past weeks stay editable', () => {
  const a = app();
  a.run("createRoutine('2026-10-26')");
  assert.throws(() => a.run("setRoutineBlock(0, 0, true, '2026-10-25')"), /not started/);
  assert.throws(() => a.run("setRoutineBlock(1, 0, true, '2026-11-01')"), /not started/);
  a.run("setRoutineBlock(0, 0, true, '2027-01-01')");
  assert.equal(a.run('getRoutine().completed[0][0]'), true);
  a.run("setRoutineBlock(0, 0, false, '2027-01-01')");
  assert.equal(a.run('getRoutine().completed[0][0]'), false);
});

test('celebration occurs only when all ten blocks are complete and only once per week', () => {
  const a = app();
  a.run("createRoutine('2026-10-26')");
  for (let block = 0; block < 9; block++) {
    assert.equal(a.run(`setRoutineBlock(0, ${block}, true, '2026-10-26').celebrate`), false);
  }
  assert.equal(a.run("setRoutineBlock(0, 9, true, '2026-10-26').celebrate"), true);
  assert.deepEqual(a.data('getRoutine().celebratedWeeks'), [0]);
  a.run("setRoutineBlock(0, 9, false, '2026-10-26')");
  assert.equal(a.run("setRoutineBlock(0, 9, true, '2026-10-26').celebrate"), false);
  for (let week = 1; week < 8; week++) {
    a.run(`for (let block = 0; block < 10; block++) setRoutineBlock(${week}, block, true, '2026-12-20')`);
  }
  assert.equal(a.run('getRoutine().completed.flat().filter(Boolean).length'), 80);
  assert.equal(a.run('getRoutine().celebratedWeeks.length'), 8);
});

test('invalid dates, out-of-range blocks and malformed imports fail without changing saved data', () => {
  const a = app();
  for (const date of ['', '2026-02-30', '2026-13-01', '26-10-2026', '2026-1-01', '9999-12-31']) {
    assert.throws(() => a.run(`createRoutine('${date}')`), /valid start date/);
  }
  a.run("createRoutine('2026-10-26')");
  const original = a.data('getRoutine()');
  for (const [week, block] of [[-1, 0], [8, 0], [0, -1], [0, 10], [0.5, 0]]) {
    assert.throws(() => a.run(`setRoutineBlock(${week}, ${block}, true, '2026-12-20')`), /not be found/);
  }
  assert.throws(() => a.run(`importData('{"profile":{"name":"wrong"},"routine":{"completed":[]}}')`), /Invalid routine/);
  assert.equal(a.run('getProfile()'), null);
  assert.deepEqual(a.data('getRoutine()'), original);
});

test('backup round-trip retains progress and old backups do not overwrite the commitment', () => {
  const a = app();
  a.run("createRoutine('2026-10-26'); setRoutineBlock(0, 3, true, '2026-10-26')");
  const backup = a.run('exportData()');
  a.run('localStorage.clear()');
  a.context.backup = backup;
  a.run('importData(backup)');
  assert.equal(a.run('getRoutine().completed[0][3]'), true);
  a.run(`importData('{"sessions":[],"pbs":{}}')`);
  assert.equal(a.run('getRoutine().completed[0][3]'), true);
  a.run(`importData('{"routine":null}')`);
  assert.equal(a.run('getRoutine()'), null);
  assert.ok(a.run('Number(localStorage.getItem(KEYS.ROUTINE_TS))') > 0);
});

function cloudApp(cloud) {
  const a = app();
  a.context.cloud = cloud;
  a.context.writes = [];
  a.run(`
    _syncUser = { uid: 'test-user' };
    _syncDb = {
      collection: () => ({
        doc: () => ({
          get: async () => ({ exists: true, data: () => cloud }),
          set: async data => { writes.push(data); },
          collection: () => ({ get: async () => ({ docs: [] }) }),
        }),
      }),
    };
  `);
  return a;
}

test('cloud merge restores a newer routine and explicit clearing, not an older cloud copy', async () => {
  const a = cloudApp({});
  a.run("createRoutine('2026-10-26')");
  await Promise.resolve();
  a.context.writes.length = 0;
  const remote = a.data('getRoutine()');
  remote.completed[0][0] = true;
  remote.updatedAt += 1000;
  a.context.cloud.routine = remote;
  a.context.cloud.routineUpdatedAt = remote.updatedAt;
  await a.run('syncMergeOnSignIn()');
  assert.equal(a.run('getRoutine().completed[0][0]'), true);
  assert.equal(a.context.writes.length, 0);
  a.context.cloud.routine = null;
  a.context.cloud.routineUpdatedAt += 1000;
  await a.run('syncMergeOnSignIn()');
  assert.equal(a.run('getRoutine()'), null);
  assert.equal(a.context.writes.length, 0);
});

test('cloud merge awaits newer local routine writes and propagates write failures', async () => {
  const a = cloudApp({});
  a.run("createRoutine('2026-10-26')");
  await Promise.resolve();
  a.context.writes.length = 0;
  await a.run('syncMergeOnSignIn()');
  assert.equal(a.context.writes.length, 1);
  assert.equal(a.context.writes[0].routine.startDate, '2026-10-26');
  a.run("_syncDb.collection = () => ({ doc: () => ({ get: async () => ({ exists: false }), set: async () => { throw new Error('offline'); }, collection: () => ({ get: async () => ({ docs: [] }) }) }) })");
  await assert.rejects(a.run('syncMergeOnSignIn()'), /offline/);
});

test('starting again resets the checklist without touching logged workouts', () => {
  const a = app();
  a.run("saveSession({ id: 'existing-session', date: '2026-10-23', sets: [] })");
  a.run("createRoutine('2026-10-26'); setRoutineBlock(0, 0, true, '2026-10-26')");
  const oldId = a.run('getRoutine().id');
  a.run("createRoutine('2026-11-02')");
  assert.notEqual(a.run('getRoutine().id'), oldId);
  assert.equal(a.run('getRoutine().completed.flat().filter(Boolean).length'), 0);
  assert.equal(a.run('getSessions()[0].id'), 'existing-session');
});

test('offline cloud writes preserve local check-offs and notify the user', async () => {
  const a = cloudApp({});
  a.context.notifications = [];
  a.run(`
    toast = message => notifications.push(message);
    _syncDb.collection = () => ({ doc: () => ({ set: async () => { throw new Error('offline'); } }) });
    createRoutine('2026-10-26');
    setRoutineBlock(0, 0, true, '2026-10-26');
  `);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(a.run('getRoutine().completed[0][0]'), true);
  assert.equal(a.context.notifications.length, 2);
  assert.match(a.context.notifications[0], /saved on this device.*cloud sync failed/);
});

// =====================================================================
// Strengthify Web — Data Layer (localStorage)
// =====================================================================

const KEYS = {
  PROFILE:  'sf_profile',
  SESSIONS: 'sf_sessions',
  PBS:      'sf_pbs',
};

// ── Default / helpers ─────────────────────────────────────────────

function uuid() {
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g,c=>
    (c^crypto.getRandomValues(new Uint8Array(1))[0]&15>>c/4).toString(16));
}

function today() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

// ── Profile ───────────────────────────────────────────────────────

function getProfile() {
  const raw = localStorage.getItem(KEYS.PROFILE);
  return raw ? JSON.parse(raw) : null;
}

function saveProfile(profile) {
  localStorage.setItem(KEYS.PROFILE, JSON.stringify(profile));
}

function createProfile(name, sex, dob, bodyweightKg, heightCm) {
  const profile = {
    id: uuid(),
    name,
    sex,            // 'male' | 'female'
    dob,            // YYYY-MM-DD
    bodyweightKg: parseFloat(bodyweightKg),
    heightCm: parseFloat(heightCm),
    totalXP: 0,
    level: 0,
  };
  saveProfile(profile);
  return profile;
}

// ── Sessions ──────────────────────────────────────────────────────

function getSessions() {
  const raw = localStorage.getItem(KEYS.SESSIONS);
  return raw ? JSON.parse(raw) : [];
}

function saveSession(session) {
  const sessions = getSessions();
  sessions.unshift(session); // newest first
  localStorage.setItem(KEYS.SESSIONS, JSON.stringify(sessions));
}

// ── Personal Bests ────────────────────────────────────────────────

function getPBs() {
  const raw = localStorage.getItem(KEYS.PBS);
  return raw ? JSON.parse(raw) : {};
}

function savePBs(pbs) {
  localStorage.setItem(KEYS.PBS, JSON.stringify(pbs));
}

// ── Age calculation ───────────────────────────────────────────────

function calcAge(dob) {
  const birth = new Date(dob);
  const now   = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

// =====================================================================
// Strength Standards — derived from Strength Level / ExRx real data
// Each entry: [percentile, 1RM_ratio_to_bodyweight]
// Pull-up / Chin-up: weight field = total load (bodyweight + added weight)
// =====================================================================
const STRENGTH_STANDARDS = {
  'Back Squat': {
    male:   [[0,0.25],[5,0.50],[20,0.80],[40,1.10],[60,1.50],[80,1.90],[95,2.40],[100,3.00]],
    female: [[0,0.20],[5,0.35],[20,0.55],[40,0.75],[60,1.00],[80,1.30],[95,1.65],[100,2.10]],
  },
  'Deadlift': {
    male:   [[0,0.40],[5,0.65],[20,1.00],[40,1.35],[60,1.75],[80,2.20],[95,2.75],[100,3.40]],
    female: [[0,0.25],[5,0.45],[20,0.70],[40,0.95],[60,1.25],[80,1.60],[95,2.00],[100,2.50]],
  },
  'Bench Press': {
    male:   [[0,0.20],[5,0.40],[20,0.65],[40,0.90],[60,1.15],[80,1.45],[95,1.90],[100,2.40]],
    female: [[0,0.15],[5,0.25],[20,0.40],[40,0.55],[60,0.75],[80,0.95],[95,1.25],[100,1.55]],
  },
  'Overhead Press': {
    male:   [[0,0.12],[5,0.25],[20,0.40],[40,0.58],[60,0.75],[80,1.00],[95,1.30],[100,1.60]],
    female: [[0,0.08],[5,0.15],[20,0.27],[40,0.38],[60,0.50],[80,0.65],[95,0.85],[100,1.05]],
  },
  'Barbell Row': {
    male:   [[0,0.20],[5,0.35],[20,0.60],[40,0.80],[60,1.00],[80,1.25],[95,1.60],[100,2.00]],
    female: [[0,0.12],[5,0.22],[20,0.38],[40,0.52],[60,0.68],[80,0.88],[95,1.15],[100,1.40]],
  },
  'Pull-up / Chin-up': {
    // ratio of total load (BW + added) to bodyweight; 1.0 = bodyweight-only 1-rep max
    male:   [[0,0.50],[5,0.75],[20,0.90],[40,1.00],[60,1.15],[80,1.35],[95,1.65],[100,2.20]],
    female: [[0,0.30],[5,0.55],[20,0.72],[40,0.85],[60,1.00],[80,1.15],[95,1.40],[100,1.80]],
  },
  'Incline Bench Press': {
    male:   [[0,0.15],[5,0.30],[20,0.50],[40,0.72],[60,0.95],[80,1.20],[95,1.55],[100,1.90]],
    female: [[0,0.10],[5,0.20],[20,0.33],[40,0.47],[60,0.63],[80,0.80],[95,1.05],[100,1.30]],
  },
  'Romanian Deadlift': {
    male:   [[0,0.30],[5,0.50],[20,0.80],[40,1.10],[60,1.40],[80,1.75],[95,2.20],[100,2.70]],
    female: [[0,0.20],[5,0.35],[20,0.55],[40,0.78],[60,1.00],[80,1.28],[95,1.60],[100,2.00]],
  },
  'Dumbbell Press': {
    // Per-dumbbell weight ratio to bodyweight (dumbbell bench press)
    male:   [[0,0.09],[5,0.16],[20,0.27],[40,0.38],[60,0.50],[80,0.63],[95,0.80],[100,1.00]],
    female: [[0,0.06],[5,0.10],[20,0.18],[40,0.26],[60,0.34],[80,0.44],[95,0.56],[100,0.70]],
  },
  'Dumbbell Curl': {
    // Per-dumbbell weight ratio to bodyweight
    male:   [[0,0.05],[5,0.09],[20,0.16],[40,0.23],[60,0.30],[80,0.38],[95,0.49],[100,0.62]],
    female: [[0,0.03],[5,0.05],[20,0.09],[40,0.13],[60,0.18],[80,0.24],[95,0.31],[100,0.40]],
  },
};

// Lifts where the user enters *added* weight (0 = bodyweight only);
// kept for display purposes in session detail (shows "Bodyweight" instead of "0 kg").
const BODYWEIGHT_LIFTS = new Set(['Push-up']);

// Lifts ranked purely by rep count adjusted for bodyweight, NOT by estimated 1RM.
const REP_BASED_LIFTS = new Set(['Push-up']);

// Rep-based standards calibrated against strength-level.com bodyweight push-up data.
// refReps are at a reference bodyweight (men: 80 kg, women: 60 kg).
// Actual threshold for user = refReps × sqrt(refBW / userBW) × ageFactor(age).
const REP_STANDARDS = {
  'Push-up': {
    refBW: { male: 80, female: 60 },
    // [percentile, refReps at reference bodyweight]
    // At 108 kg male (scale=0.860): 5%≈10, 20%≈21, 40%≈31, 60%≈45, 80%≈58, 95%≈76
    male:   [[0,0],[5,12],[20,24],[40,36],[60,52],[80,68],[95,88],[100,110]],
    female: [[0,0],[5,5], [20,12],[40,20],[60,30],[80,42],[95,58],[100,75]],
  },
};

function ageFactor(age) {
  if (age < 18)  return 0.80;
  if (age <= 24) return 0.92;
  if (age <= 35) return 1.00;
  if (age <= 45) return 0.95;
  if (age <= 55) return 0.88;
  if (age <= 65) return 0.80;
  return 0.72;
}

// Linear interpolation between (percentile, ratio) breakpoints
function interpRatio(bp, targetPct) {
  if (targetPct <= bp[0][0]) return bp[0][1];
  if (targetPct >= bp[bp.length-1][0]) return bp[bp.length-1][1];
  for (let i = 1; i < bp.length; i++) {
    if (targetPct <= bp[i][0]) {
      const [p0, r0] = bp[i-1], [p1, r1] = bp[i];
      return r0 + (targetPct - p0) / (p1 - p0) * (r1 - r0);
    }
  }
  return bp[bp.length-1][1];
}

// Returns 0-100 percentile for a given lift / estimated 1RM / profile
function getPercentile(lift, oneRM, profile) {
  const std = STRENGTH_STANDARDS[lift];
  if (!std || !oneRM || oneRM <= 0) return 0;
  const age  = calcAge(profile.dob);
  // Normalise to peak-age so older athletes compare fairly
  const norm = (oneRM / ageFactor(age)) / profile.bodyweightKg;
  const bp   = profile.sex === 'female' ? std.female : std.male;
  if (norm <= bp[0][1])           return bp[0][0];
  if (norm >= bp[bp.length-1][1]) return 100;
  for (let i = 1; i < bp.length; i++) {
    if (norm <= bp[i][1]) {
      const [p0, r0] = bp[i-1], [p1, r1] = bp[i];
      return Math.round(p0 + (norm - r0) / (r1 - r0) * (p1 - p0));
    }
  }
  return 100;
}

// Returns the 50th-percentile reference weight for the progress bar
function getBenchmark(lift, profile) {
  const std = STRENGTH_STANDARDS[lift];
  if (!std) return null;
  const bp  = profile.sex === 'female' ? std.female : std.male;
  const age = calcAge(profile.dob);
  return interpRatio(bp, 50) * ageFactor(age) * profile.bodyweightKg;
}

// Returns percentile for a rep-based lift (e.g. Push-up)
function getRepPercentile(lift, reps, profile) {
  const std = REP_STANDARDS[lift];
  if (!std || !reps || reps <= 0) return 0;
  const sex   = profile.sex === 'female' ? 'female' : 'male';
  const refBW = std.refBW[sex];
  const bp    = std[sex];
  const age   = calcAge(profile.dob);
  const af    = ageFactor(age);
  // Normalize user's reps to reference bodyweight and peak age.
  // Heavier athletes need fewer reps to reach the same percentile.
  const normReps = reps * Math.sqrt(profile.bodyweightKg / refBW) / af;
  if (normReps <= bp[0][1]) return bp[0][0];
  if (normReps >= bp[bp.length-1][1]) return 100;
  for (let i = 1; i < bp.length; i++) {
    if (normReps <= bp[i][1]) {
      const [p0, r0] = bp[i-1], [p1, r1] = bp[i];
      return Math.round(p0 + (normReps - r0) / (r1 - r0) * (p1 - p0));
    }
  }
  return 100;
}

// Returns 50th-percentile rep count scaled to user's bodyweight and age
function getRepBenchmark(lift, profile) {
  const std = REP_STANDARDS[lift];
  if (!std) return null;
  const sex   = profile.sex === 'female' ? 'female' : 'male';
  const refBW = std.refBW[sex];
  const bp    = std[sex];
  const age   = calcAge(profile.dob);
  const af    = ageFactor(age);
  const refReps = interpRatio(bp, 50);
  return Math.round(refReps * Math.sqrt(refBW / profile.bodyweightKg) * af);
}

function tierFromPercentile(pct) {
  if (pct >= 95) return 'World Class';
  if (pct >= 80) return 'Elite';
  if (pct >= 60) return 'Advanced';
  if (pct >= 40) return 'Intermediate';
  if (pct >= 20) return 'Novice';
  if (pct >= 5)  return 'Beginner';
  return 'Untrained';
}

function tierCssClass(tier) {
  const map = {
    'Untrained':    'tier-untrained',
    'Beginner':     'tier-beginner',
    'Novice':       'tier-novice',
    'Intermediate': 'tier-intermediate',
    'Advanced':     'tier-advanced',
    'Elite':        'tier-elite',
    'World Class':  'tier-world-class',
  };
  return map[tier] || 'tier-untrained';
}

function tierBarClass(tier) {
  const map = {
    'Untrained':    'fill-red',
    'Beginner':     'fill-orange',
    'Novice':       'fill-amber',
    'Intermediate': 'fill-green',
    'Advanced':     'fill-blue',
    'Elite':        'fill-purple',
    'World Class':  'fill-gold',
  };
  return map[tier] || 'fill-red';
}

function ordinal(n) {
  const s = ['th','st','nd','rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// =====================================================================
// XP & Level system
// =====================================================================
const XP = {
  BASE_PER_SET:  10,
  PERSONAL_BEST: 50,
  TIER_BONUS:    { Untrained:0, Beginner:5, Novice:10, Intermediate:25, Advanced:50, Elite:75, 'World Class':100 },
};

// Exponential XP curve — each level requires significantly more XP than the last.
// Total XP to reach level n = floor(100 * n^2.3)
// Approx sessions to level: Lv5≈30, Lv10≈140, Lv20≈680, Lv30≈1700
function xpForLevel(level) {
  if (level <= 0) return 0;
  return Math.floor(100 * Math.pow(level, 2.3));
}

// Level title ranges: [minLevel, maxLevel, title]
const LEVEL_TITLES = [
  [0,  0,  'Uninitiated'],
  [1,  2,  'Iron Novice'],
  [3,  5,  'Steel Apprentice'],
  [6,  9,  'Bronze Athlete'],
  [10, 14, 'Silver Contender'],
  [15, 19, 'Gold Warrior'],
  [20, 24, 'Platinum Champion'],
  [25, 29, 'Diamond Elite'],
  [30, 39, 'Titanium Master'],
  [40, 49, 'Obsidian Legend'],
  [50, Infinity, 'Immortal'],
];

function levelTitle(level) {
  for (const [min, max, title] of LEVEL_TITLES) {
    if (level >= min && level <= max) return title;
  }
  return 'Immortal';
}

function epley1RM(weight, reps) {
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

// Effective weight including bodyweight for calisthenics lifts
function effectiveWeight(lift, weightKg, profile) {
  if (BODYWEIGHT_LIFTS.has(lift)) return weightKg + (profile ? profile.bodyweightKg : 0);
  return weightKg;
}

// Ensure pb entry is always the full object shape
function ensurePB(pbs, lift) {
  if (!pbs[lift] || typeof pbs[lift] !== 'object') {
    // Migrate old flat-number format
    const old = (typeof pbs[lift] === 'number') ? pbs[lift] : 0;
    pbs[lift] = { orm: old, oneRepKg: 0, maxReps: 0, maxRepsKg: 0, maxWeightKg: 0 };
  }
  // Migrate existing records missing the new field
  if (!('maxWeightKg' in pbs[lift])) pbs[lift].maxWeightKg = pbs[lift].oneRepKg || 0;
  return pbs[lift];
}

function calculateSessionXP(sets, profile) {
  const pbs = getPBs();
  let xp = 0;
  const newPBs = []; // { lift, type: 'orm'|'oneRep'|'reps', value, weight? }

  // Per-lift session bests
  const sessionORM      = {}; // best Epley 1RM this session
  const sessionOneRep   = {}; // best actual weight when reps === 1
  const sessionMaxReps  = {}; // { reps, weightKg } for highest rep set
  const sessionMaxWeight = {}; // highest weight used in any set

  for (const s of sets) {
    xp += XP.BASE_PER_SET;
    const effW = effectiveWeight(s.lift, s.weightKg, profile);
    const orm = epley1RM(effW, s.reps);

    if (!sessionORM[s.lift] || orm > sessionORM[s.lift])
      sessionORM[s.lift] = orm;

    if (s.reps === 1 && (!sessionOneRep[s.lift] || effW > sessionOneRep[s.lift]))
      sessionOneRep[s.lift] = effW;

    if (!sessionMaxReps[s.lift] || s.reps > sessionMaxReps[s.lift].reps ||
        (s.reps === sessionMaxReps[s.lift].reps && effW > sessionMaxReps[s.lift].weightKg))
      sessionMaxReps[s.lift] = { reps: s.reps, weightKg: effW };

    if (!sessionMaxWeight[s.lift] || effW > sessionMaxWeight[s.lift])
      sessionMaxWeight[s.lift] = effW;
  }

  // Check PRs per lift
  for (const lift of Object.keys(sessionORM)) {
    const pb = ensurePB(pbs, lift);

    if (REP_BASED_LIFTS.has(lift)) {
      // Rep-based lifts: only a new max rep count counts as a PR
      const mr = sessionMaxReps[lift];
      if (mr && mr.reps > pb.maxReps) {
        xp += XP.PERSONAL_BEST;
        newPBs.push({ lift, type: 'reps', value: mr.reps, weight: mr.weightKg });
        pb.maxReps   = mr.reps;
        pb.maxRepsKg = mr.weightKg;
      }
    } else {
      // Weight-based lifts: orm, 1-rep, and rep PRs
      if (sessionORM[lift] > pb.orm) {
        xp += XP.PERSONAL_BEST;
        newPBs.push({ lift, type: 'orm', value: sessionORM[lift] });
        pb.orm = sessionORM[lift];
      }

      if (sessionOneRep[lift] && sessionOneRep[lift] > pb.oneRepKg) {
        if (!newPBs.find(p => p.lift === lift && p.type === 'orm')) xp += XP.PERSONAL_BEST;
        newPBs.push({ lift, type: 'oneRep', value: sessionOneRep[lift] });
        pb.oneRepKg = sessionOneRep[lift];
      }

      const mr = sessionMaxReps[lift];
      if (mr && (mr.reps > pb.maxReps ||
          (mr.reps === pb.maxReps && mr.weightKg > pb.maxRepsKg))) {
        newPBs.push({ lift, type: 'reps', value: mr.reps, weight: mr.weightKg });
        pb.maxReps   = mr.reps;
        pb.maxRepsKg = mr.weightKg;
      }

      const mw = sessionMaxWeight[lift];
      if (mw && mw > pb.maxWeightKg) {
        pb.maxWeightKg = mw;
      }
    }
  }

  // Benchmark tier bonus — use best lift in session
  const primaryLift = sets[0]?.lift;
  if (primaryLift) {
    const pb = ensurePB(pbs, primaryLift);
    const percentile = REP_BASED_LIFTS.has(primaryLift)
      ? getRepPercentile(primaryLift, pb.maxReps, profile)
      : getPercentile(primaryLift, pb.orm, profile);
    const tier = tierFromPercentile(percentile);
    xp += XP.TIER_BONUS[tier] || 0;
  }

  savePBs(pbs);
  return { xp, newPBs, pbs };
}

function applyXP(profile, xpEarned) {
  profile.totalXP += xpEarned;
  let leveledUp = false;
  while (profile.totalXP >= xpForLevel(profile.level + 1)) {
    profile.level += 1;
    leveledUp = true;
  }
  return leveledUp;
}

// ── XP progress to next level ─────────────────────────────────────

function xpProgress(profile) {
  const currentLevelXP = xpForLevel(profile.level);
  const nextLevelXP    = xpForLevel(profile.level + 1);
  const progressXP     = profile.totalXP - currentLevelXP;
  const neededXP       = nextLevelXP - currentLevelXP;
  return {
    pct: Math.min(progressXP / neededXP, 1),
    current: progressXP,
    needed: neededXP,
  };
}

// ── Export for sharing ────────────────────────────────────────────

function exportData() {
  return JSON.stringify({
    profile:  getProfile(),
    sessions: getSessions(),
    pbs:      getPBs(),
    exportedAt: new Date().toISOString(),
  }, null, 2);
}

function importData(jsonStr) {
  const data = JSON.parse(jsonStr);
  if (data.profile)  saveProfile(data.profile);
  if (data.sessions) localStorage.setItem(KEYS.SESSIONS, JSON.stringify(data.sessions));
  if (data.pbs)      savePBs(data.pbs);
}

// ── Session update (for editing) ──────────────────────────────────

function updateSession(sessionId, newSets) {
  const sessions = getSessions();
  const idx = sessions.findIndex(s => s.id === sessionId);
  if (idx === -1) return null;
  sessions[idx].sets = newSets;
  localStorage.setItem(KEYS.SESSIONS, JSON.stringify(sessions));
  return sessions[idx];
}

// Rebuild all PBs and XP from scratch by replaying all sessions in order (oldest first)
function recalculateAllPBsAndXP() {
  const profile  = getProfile();
  if (!profile) return;
  const sessions = getSessions().slice().reverse(); // oldest first

  // Reset PBs and profile XP
  const freshPBs = {};
  profile.totalXP = 0;
  profile.level   = 0;

  for (const session of sessions) {
    // Build per-lift session bests for this session
    const sessionORM       = {};
    const sessionOneRep    = {};
    const sessionMaxReps   = {};
    const sessionMaxWeight = {};

    let xp = 0;
    for (const s of session.sets) {
      xp += XP.BASE_PER_SET;
      const effW = effectiveWeight(s.lift, s.weightKg, profile);
      const orm  = epley1RM(effW, s.reps);

      if (!sessionORM[s.lift] || orm > sessionORM[s.lift]) sessionORM[s.lift] = orm;
      if (s.reps === 1 && (!sessionOneRep[s.lift] || effW > sessionOneRep[s.lift])) sessionOneRep[s.lift] = effW;
      if (!sessionMaxReps[s.lift] || s.reps > sessionMaxReps[s.lift].reps ||
          (s.reps === sessionMaxReps[s.lift].reps && effW > sessionMaxReps[s.lift].weightKg))
        sessionMaxReps[s.lift] = { reps: s.reps, weightKg: effW };
      if (!sessionMaxWeight[s.lift] || effW > sessionMaxWeight[s.lift]) sessionMaxWeight[s.lift] = effW;
    }

    for (const lift of Object.keys(sessionORM)) {
      const pb = ensurePB(freshPBs, lift);

      if (REP_BASED_LIFTS.has(lift)) {
        const mr = sessionMaxReps[lift];
        if (mr && mr.reps > pb.maxReps) {
          xp += XP.PERSONAL_BEST;
          pb.maxReps   = mr.reps;
          pb.maxRepsKg = mr.weightKg;
        }
      } else {
        if (sessionORM[lift] > pb.orm) {
          xp += XP.PERSONAL_BEST;
          pb.orm = sessionORM[lift];
        }
        if (sessionOneRep[lift] && sessionOneRep[lift] > pb.oneRepKg) {
          if (sessionORM[lift] <= (freshPBs[lift]?.orm || 0) || xp === XP.BASE_PER_SET * session.sets.length)
            xp += XP.PERSONAL_BEST;
          pb.oneRepKg = sessionOneRep[lift];
        }
        const mr = sessionMaxReps[lift];
        if (mr && (mr.reps > pb.maxReps ||
            (mr.reps === pb.maxReps && mr.weightKg > pb.maxRepsKg))) {
          pb.maxReps   = mr.reps;
          pb.maxRepsKg = mr.weightKg;
        }
        const mw = sessionMaxWeight[lift];
        if (mw && mw > pb.maxWeightKg) pb.maxWeightKg = mw;
      }
    }

    const primaryLift = session.sets[0]?.lift;
    if (primaryLift) {
      const pb = ensurePB(freshPBs, primaryLift);
      const percentile = REP_BASED_LIFTS.has(primaryLift)
        ? getRepPercentile(primaryLift, pb.maxReps, profile)
        : getPercentile(primaryLift, pb.orm, profile);
      const tier = tierFromPercentile(percentile);
      xp += XP.TIER_BONUS[tier] || 0;
    }

    session.xpEarned = xp;
    profile.totalXP += xp;
    while (profile.totalXP >= xpForLevel(profile.level + 1)) profile.level++;
  }

  // Persist updated data (sessions back in newest-first order)
  localStorage.setItem(KEYS.SESSIONS, JSON.stringify(sessions.reverse()));
  savePBs(freshPBs);
  saveProfile(profile);
  return { profile, pbs: freshPBs };
}

// ── Lift registry ────────────────────────────────────────────
// To add a new exercise:
//   1. Add the name string to LIFTS below.
//   2. Add a matching entry to STRENGTH_STANDARDS above (male + female arrays).
//      If no standards data exists yet, simply omit it — the UI will show
//      "No data" gracefully for percentiles while still tracking PBs.
// Existing localStorage data (PBs, sessions) is never touched by these changes.

const LIFTS = [
  'Back Squat',
  'Deadlift',
  'Bench Press',
  'Overhead Press',
  'Barbell Row',
  'Pull-up / Chin-up',
  'Incline Bench Press',
  'Romanian Deadlift',
  'Dumbbell Press',
  'Dumbbell Curl',
  'Push-up',
];

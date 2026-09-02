// =====================================================================
// Strengthify Web — Data Layer (localStorage)
// =====================================================================

const KEYS = {
  PROFILE:  'sf_profile',
  SESSIONS: 'sf_sessions',
  PBS:      'sf_pbs',
  PBS_TS:   'sf_pbs_ts',
  PLANS:    'sf_plans',
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
  profile._updatedAt = Date.now();
  localStorage.setItem(KEYS.PROFILE, JSON.stringify(profile));
  if (typeof syncPushProfile === 'function') syncPushProfile(profile);
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
  if (typeof syncPushSession === 'function') syncPushSession(session);
}

// ── Personal Bests ────────────────────────────────────────────────

function getPBs() {
  const raw = localStorage.getItem(KEYS.PBS);
  return raw ? JSON.parse(raw) : {};
}

function savePBs(pbs) {
  localStorage.setItem(KEYS.PBS, JSON.stringify(pbs));
  localStorage.setItem(KEYS.PBS_TS, String(Date.now()));
  if (typeof syncPushPBs === 'function') syncPushPBs(pbs);
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
  'Front Squat': {
    // ~80% of Back Squat 1RM; data derived from Strength Level front squat standards
    male:   [[0,0.20],[5,0.40],[20,0.65],[40,0.90],[60,1.20],[80,1.50],[95,1.90],[100,2.40]],
    female: [[0,0.15],[5,0.28],[20,0.45],[40,0.63],[60,0.82],[80,1.05],[95,1.35],[100,1.70]],
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
      : getPercentile(primaryLift, pb.oneRepKg || pb.maxWeightKg, profile);
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
  if (data.sessions) {
    localStorage.setItem(KEYS.SESSIONS, JSON.stringify(data.sessions));
    if (typeof syncPushSession === 'function') {
      (data.sessions || []).forEach(s => syncPushSession(s));
    }
  }
  if (data.pbs)      savePBs(data.pbs);
}

// ── Session update (for editing) ──────────────────────────────────

function updateSession(sessionId, newSets) {
  const sessions = getSessions();
  const idx = sessions.findIndex(s => s.id === sessionId);
  if (idx === -1) return null;
  sessions[idx].sets = newSets;
  localStorage.setItem(KEYS.SESSIONS, JSON.stringify(sessions));
  if (typeof syncPushSession === 'function') syncPushSession(sessions[idx]);
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
        : getPercentile(primaryLift, pb.oneRepKg || pb.maxWeightKg, profile);
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
  'Front Squat',
  'Dumbbell Press',
  'Dumbbell Curl',
  'Push-up',
];

// ── Mobility Routine ─────────────────────────────────────────────────
// 4 blocks worked through in order; each ~5 minutes. Colors used for
// the block progress dots/card accent in the mobility runner UI.

const MOBILITY_ROUTINE = {
  title: '20-Minute Mobility Routine',
  footer: 'Rotate these routines throughout the week! Focus on mobility, stability, and recovery.',
  blocks: [
    {
      name: 'Warm-Up Mobility Flow',
      color: 'orange',
      exercises: [
        { name: 'Cat-Cow', description: 'Arch and round your back slowly, breathing through each movement.' },
        { name: 'Thread the Needle', description: 'From all-fours, slide one arm under your body and rotate to stretch upper back.' },
        { name: 'Hip Circles', description: 'Rotate hips in large circles while keeping torso stable.' },
        { name: 'Deep Squat Hold', description: 'Sit into a deep squat, chest up, gently rock side to side.' },
        { name: 'Banded Shoulder Dislocates', description: 'Hold a band wide with both hands, raise it overhead and back behind you, keeping arms straight throughout.' },
      ],
    },
    {
      name: 'Auxiliary Strength',
      color: 'blue',
      exercises: [
        { name: 'Scapular Push-Ups', description: 'In plank, protract and retract shoulder blades without bending arms.' },
        { name: 'Push-Ups', description: 'Perform 8-15 controlled reps, keeping your body in a straight line from head to heels.' },
        { name: 'Y-T-W Raises', description: 'Lift arms into Y, T, and W shapes slowly to activate upper back.' },
        { name: 'B-Stance Glute Bridge', description: 'One foot forward, lift hips using mainly the back leg\u2019s glute.' },
        { name: 'Banded Glute Bridge', description: 'Loop a band above your knees, drive hips up while pressing knees outward against the band.' },
        { name: 'Band Pull-Aparts', description: 'Hold a resistance band at shoulder width and pull it apart, squeezing shoulder blades together for 12-15 reps.' },
        { name: 'Banded Y-Raises', description: 'Anchor a band low, raise both arms overhead into a Y shape against the resistance.' },
        { name: 'Banded Face Pulls', description: 'Anchor a band at chest height, pull toward your face with elbows high, squeezing shoulder blades together.' },
        { name: 'Banded Rows', description: 'Anchor a band in front of you, row both hands to your ribs, squeezing shoulder blades together.' },
        { name: 'Banded External Rotations', description: 'Elbow pinned to your side, rotate your forearm outward against band resistance to strengthen the rotator cuff.' },
        { name: 'Plank Hold', description: 'Hold a forearm plank for 30-45 seconds, keeping hips level and core braced.' },
        { name: 'Dead Bugs', description: 'Lower opposite arm and leg while keeping lower back pressed down.' },
      ],
    },
    {
      name: 'Mobility Strength',
      color: 'green',
      exercises: [
        { name: 'Knee-Over-Toe Split Squat', description: 'Front knee travels forward over toes while keeping heel down.' },
        { name: '90/90 Transitions', description: 'Rotate knees side to side while keeping feet grounded.' },
        { name: 'Russian Twists', description: 'Rotate torso side to side, tapping the floor each side for 12-16 total reps.' },
        { name: 'Halos', description: 'Circle a light weight or band around your head, reversing direction halfway through.' },
        { name: 'Banded Lateral Walks', description: 'Loop a band above your knees and take side steps, keeping tension on the band and hips level.' },
        { name: 'Banded Clamshells', description: 'Loop a band above your knees, lie on your side and open your top knee against the resistance.' },
        { name: 'Banded Good Mornings', description: 'Stand on a band, hinge at the hips keeping a flat back, feeling tension build through your hamstrings.' },
        { name: 'Hamstring Sweep', description: 'Hinge forward and reach toward foot to stretch hamstrings.' },
        { name: 'Lat Stretch', description: 'Hold onto a surface, sink hips back, lightly pull against the stretch.' },
      ],
    },
    {
      name: 'Recovery & Reset',
      color: 'purple',
      exercises: [
        { name: 'Box Breathing', description: 'Inhale 4 sec, hold 4 sec, exhale 4 sec, hold 4 sec.' },
        { name: 'Pec Stretch', description: 'Forearm on doorway, step forward until chest opens.' },
        { name: 'Banded Hamstring Stretch', description: 'Loop a band around one foot and gently pull the leg straight toward you to deepen the hamstring stretch.' },
        { name: 'Banded Hip Flexor Stretch', description: 'Loop a band low around your hip, step forward and gently shift your weight to deepen the hip flexor stretch.' },
        { name: 'Child\u2019s Pose Reach', description: 'Sit back on heels, reach arms to one side to stretch lats and ribs.' },
        { name: 'Neck CARs', description: 'Slow, controlled circles with your head exploring full range.' },
      ],
    },
  ],
};

// ── Training Plans ─────────────────────────────────────────────────

function getPlans() {
  const raw = localStorage.getItem(KEYS.PLANS);
  return raw ? JSON.parse(raw) : [];
}

function savePlan(plan) {
  plan.updatedAt = Date.now();
  const plans = getPlans();
  const idx = plans.findIndex(p => p.id === plan.id);
  if (idx >= 0) plans[idx] = plan;
  else plans.push(plan);
  localStorage.setItem(KEYS.PLANS, JSON.stringify(plans));
  if (typeof syncPushPlan === 'function') syncPushPlan(plan);
}

function deletePlan(planId) {
  const plans = getPlans().filter(p => p.id !== planId);
  localStorage.setItem(KEYS.PLANS, JSON.stringify(plans));
  if (typeof syncDeletePlan === 'function') syncDeletePlan(planId);
}

function getActivePlan() {
  return getPlans().find(p => p.active) || null;
}

function markPlanDayComplete(planId, weekNum, dayNum, sessionId) {
  const plans = getPlans();
  const plan = plans.find(p => p.id === planId);
  if (!plan) return;
  const week = plan.weeks.find(w => w.weekNum === weekNum);
  if (!week) return;
  const day = week.days.find(d => d.dayNum === dayNum);
  if (!day) return;
  day.completedSessionId = sessionId;
  plan.updatedAt = Date.now();
  localStorage.setItem(KEYS.PLANS, JSON.stringify(plans));
  if (typeof syncPushPlan === 'function') syncPushPlan(plan);
}

// Creates the pre-built 8-week GVT plan.
// Weights are derived from the user's current PBs (estimated 1RM) so they
// are personalised on load.  Falls back to sensible defaults when no PBs exist.
function createGVTPlan() {
  const pbs = getPBs();
  const LIFTS_SET = new Set(LIFTS);

  // Round to nearest 2.5 kg, minimum 2.5
  function r25(v) { return Math.max(Math.round(v / 2.5) * 2.5, 2.5); }

  // Best estimated 1RM for a lift (0 if no data)
  function orm(lift) {
    const pb = pbs[lift];
    return (pb && typeof pb === 'object') ? (pb.orm || 0) : 0;
  }

  // Target weight = factor × 1RM, or fallback if no PB
  function wt(lift, factor, fallback) {
    const o = orm(lift);
    return o > 0 ? r25(o * factor) : fallback;
  }

  function ex(name, sets, reps, targetWeightKg, note) {
    return { name, sets, reps, targetWeightKg: targetWeightKg ?? null,
             isBenchmark: LIFTS_SET.has(name), note: note || '' };
  }

  // ── Volume-week weights ──────────────────────────────────────────
  const sqGVT  = wt('Back Squat',           0.60, 60);   // 10×10 @ 60% 1RM
  const bpGVT  = wt('Bench Press',          0.60, 50);
  const dlGVT  = wt('Deadlift',             0.60, 70);

  // Secondary 8×5 @ 70% 1RM
  const rdlSec = orm('Romanian Deadlift') > 0
    ? wt('Romanian Deadlift', 0.70, 60)
    : wt('Deadlift', 0.595, 60);        // 70% × 85% of DL if no RDL PB

  const puSec = (() => {                // pull-up added weight secondary
    const pb = pbs['Pull-up / Chin-up'];
    if (pb && typeof pb === 'object' && pb.maxWeightKg > 0) return r25(pb.maxWeightKg * 0.70);
    return 0;                           // bodyweight
  })();

  // Front Squat: use own PB if available, else ~80% of back squat at same %
  const fsSec  = orm('Front Squat') > 0
    ? wt('Front Squat', 0.70, 50)
    : wt('Back Squat', 0.56, 50);       // 80% BS × 70% = 56% BS

  // Accessories day — medium volume @ 65% 1RM (4×10)
  const brAcc  = wt('Barbell Row',          0.65, 55);
  const ibAcc  = wt('Incline Bench Press',  0.65, 45);

  // ── Deload weights (60% of volume weights) ───────────────────────
  const sqD  = r25(sqGVT  * 0.60);
  const bpD  = r25(bpGVT  * 0.60);
  const dlD  = r25(dlGVT  * 0.60);
  const rdlD = r25(rdlSec * 0.60);
  const fsD  = r25(fsSec  * 0.60);
  const brD  = r25(brAcc  * 0.60);
  const ibD  = r25(ibAcc  * 0.60);

  // ── PR-week weights (85-90% 1RM) ────────────────────────────────
  const sqPR  = wt('Back Squat',           0.85, r25(sqGVT  * 1.42));
  const bpPR  = wt('Bench Press',          0.85, r25(bpGVT  * 1.42));
  const dlPR  = wt('Deadlift',             0.90, r25(dlGVT  * 1.50));
  const rdlPR = orm('Romanian Deadlift') > 0
    ? wt('Romanian Deadlift', 0.85, r25(rdlSec * 1.21))
    : r25(rdlSec * 1.21);
  const puPR  = puSec > 0 ? r25(puSec * 1.15) : 10;
  const fsPR  = orm('Front Squat') > 0
    ? wt('Front Squat', 0.85, r25(fsSec * 1.21))
    : r25(fsSec * 1.21);
  const brPR  = wt('Barbell Row',          0.80, r25(brAcc  * 1.23));
  const ibPR  = wt('Incline Bench Press',  0.80, r25(ibAcc  * 1.23));

  // ── Day factories ─────────────────────────────────────────────────
  function day(num, label, exList) {
    return { dayNum: num, label, completedSessionId: null, exercises: exList };
  }

  function volumeDays() { return [
    day(1, 'Squat', [
      ex('Back Squat',        10, 10, sqGVT,  'GVT · 60 s rest'),
      ex('Romanian Deadlift',  8,  5, rdlSec, '8×5 @ 70%'),
    ]),
    day(2, 'Bench', [
      ex('Bench Press',       10, 10, bpGVT, 'GVT · 60 s rest'),
      ex('Pull-up / Chin-up',  8,  5, puSec, '8×5 · BW or added weight'),
    ]),
    day(3, 'Deadlift', [
      ex('Deadlift',    10, 10, dlGVT, 'GVT · 90 s rest'),
      ex('Front Squat',  8,  5, fsSec, '8×5 @ 70%'),
    ]),
    day(4, 'Accessories', [
      ex('Barbell Row',          4, 10, brAcc, 'medium volume · 65%'),
      ex('Incline Bench Press',  4,  8, ibAcc, '65% 1RM'),
    ]),
  ]; }

  function deloadDays() { return [
    day(1, 'Squat (Deload)', [
      ex('Back Squat',        5, 5, sqD,  'Deload · 60%'),
      ex('Romanian Deadlift', 5, 5, rdlD, 'Deload'),
    ]),
    day(2, 'Bench (Deload)', [
      ex('Bench Press',       5, 5, bpD, 'Deload · 60%'),
      ex('Pull-up / Chin-up', 5, 5,  0,  'Deload · BW'),
    ]),
    day(3, 'Deadlift (Deload)', [
      ex('Deadlift',    5, 5, dlD, 'Deload · 60%'),
      ex('Front Squat', 5, 5, fsD, 'Deload'),
    ]),
    day(4, 'Accessories (Deload)', [
      ex('Barbell Row',          3, 12, brD, 'Deload · light'),
      ex('Incline Bench Press',  3,  8, ibD, 'Deload'),
    ]),
  ]; }

  function prDays() { return [
    day(1, 'Squat (PR)', [
      ex('Back Squat',        5, 5, sqPR,  'PR week · 85%'),
      ex('Romanian Deadlift', 5, 3, rdlPR, 'PR week · heavy'),
    ]),
    day(2, 'Bench (PR)', [
      ex('Bench Press',       5, 5, bpPR, 'PR week · 85%'),
      ex('Pull-up / Chin-up', 5, 5, puPR, 'PR week · added weight'),
    ]),
    day(3, 'Deadlift (PR)', [
      ex('Deadlift',    5, 3, dlPR, 'PR week · 90% · work to max'),
      ex('Front Squat', 3, 5, fsPR, 'PR week'),
    ]),
    day(4, 'Accessories (PR)', [
      ex('Barbell Row',          4,  8, brPR, 'PR week · heavier'),
      ex('Incline Bench Press',  4,  5, ibPR, 'PR week'),
    ]),
  ]; }

  const weeks = [];
  for (let w = 1; w <= 8; w++) {
    const isDeload = w === 7;
    const isPR     = w === 8;
    weeks.push({
      weekNum: w,
      label: isDeload ? 'Week 7 — Deload' : isPR ? 'Week 8 — PR Week' : `Week ${w} — Volume`,
      type:   isDeload ? 'deload' : isPR ? 'pr' : 'volume',
      days:   isDeload ? deloadDays() : isPR ? prDays() : volumeDays(),
    });
  }

  return { id: uuid(), name: '8-Week GVT', startDate: today(), active: true, weeks };
}

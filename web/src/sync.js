// =====================================================================
// Strengthify Web — Cloud Sync (Firebase + Google Sign-In)
// =====================================================================
// SETUP (one-time, ~5 minutes):
//
//   1. Go to https://console.firebase.google.com
//   2. Create a project → Add a Web App → copy the firebaseConfig below
//   3. Authentication → Sign-in providers → Google → Enable
//   4. Firestore Database → Create database → Production mode
//   5. Firestore Rules → Edit rules → paste:
//
//        rules_version = '2';
//        service cloud.firestore {
//          match /databases/{database}/documents {
//            match /users/{uid}/{document=**} {
//              allow read, write: if request.auth != null
//                                 && request.auth.uid == uid;
//            }
//          }
//        }
//
//   6. Authentication → Settings → Authorized domains → add your
//      deployed domain (e.g. yourapp.netlify.app)
//
// Then paste your project config into FIREBASE_CONFIG below.
// =====================================================================

const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyBOYpoz9UuNTnB0W8xTleCXZI0nsx8An5o",
  authDomain:        "stregthify.firebaseapp.com",
  projectId:         "stregthify",
  storageBucket:     "stregthify.firebasestorage.app",
  messagingSenderId: "301168890462",
  appId:             "1:301168890462:web:ca2c3e587bd8ffcea61acf",
};

// ── Internal state ────────────────────────────────────────────────

const SYNC_READY = FIREBASE_CONFIG.apiKey !== "";

let _syncDb   = null;
let _syncAuth = null;
let _syncUser = null;

// ── Initialise ────────────────────────────────────────────────────

function syncInit() {
  if (!SYNC_READY) {
    console.log('[Sync] Not configured — cloud sync disabled.');
    return;
  }
  if (typeof firebase === 'undefined') {
    console.error('[Sync] Firebase SDK not loaded — check CDN scripts in index.html.');
    return;
  }
  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    _syncAuth = firebase.auth();
    _syncDb   = firebase.firestore();
    console.log('[Sync] Firebase initialised. Project:', FIREBASE_CONFIG.projectId);
  } catch (e) {
    console.error('[Sync] Firebase init failed:', e);
  }
}

function syncIsConfigured() { return SYNC_READY; }
function syncCurrentUser()  { return _syncUser; }
function syncIsSignedIn()   { return !!_syncUser; }

// ── Auth ──────────────────────────────────────────────────────────

function syncOnAuthChange(callback) {
  if (!_syncAuth) { callback(null); return; }
  _syncAuth.onAuthStateChanged(user => {
    _syncUser = user;
    if (user) {
      console.log('[Sync] Signed in:', user.email, '| uid:', user.uid);
    } else {
      console.log('[Sync] Signed out.');
    }
    callback(user);
  });
}

async function syncSignIn() {
  if (!_syncAuth) return;
  console.log('[Sync] Opening Google sign-in popup…');
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return _syncAuth.signInWithPopup(provider);
}

async function syncSignOut() {
  if (!_syncAuth) return;
  console.log('[Sync] Signing out…');
  return _syncAuth.signOut();
}

// ── Firestore path helpers ────────────────────────────────────────

function _userDoc()       { return _syncDb.collection('users').doc(_syncUser.uid); }
function _sessionDoc(id)  { return _userDoc().collection('sessions').doc(id); }

// ── Fire-and-forget push (called after every local write) ─────────

function syncPushProfile(profile) {
  if (!_syncDb || !_syncUser) return;
  console.log('[Sync] Pushing profile…');
  _userDoc()
    .set({ profile, profileUpdatedAt: profile._updatedAt }, { merge: true })
    .then(() => console.log('[Sync] Profile pushed OK.'))
    .catch(e => console.error('[Sync] pushProfile failed:', e));
}

function syncPushPBs(pbs) {
  if (!_syncDb || !_syncUser) return;
  const ts = parseInt(localStorage.getItem(KEYS.PBS_TS) || '0', 10);
  console.log('[Sync] Pushing PBs…');
  _userDoc()
    .set({ pbs, pbsUpdatedAt: ts }, { merge: true })
    .then(() => console.log('[Sync] PBs pushed OK.'))
    .catch(e => console.error('[Sync] pushPBs failed:', e));
}

function syncPushSession(session) {
  if (!_syncDb || !_syncUser) return;
  console.log('[Sync] Pushing session:', session.id, session.date);
  _sessionDoc(session.id)
    .set(session)
    .then(() => console.log('[Sync] Session pushed OK:', session.id))
    .catch(e => console.error('[Sync] pushSession failed:', e));
}

function syncDeleteSession(sessionId) {
  if (!_syncDb || !_syncUser) return;
  console.log('[Sync] Deleting session from cloud:', sessionId);
  _sessionDoc(sessionId)
    .delete()
    .then(() => console.log('[Sync] Session deleted OK:', sessionId))
    .catch(e => console.error('[Sync] deleteSession failed:', e));
}

// ── Merge on sign-in ──────────────────────────────────────────────
// Pull cloud data, merge with local (last write wins for profile/PBs,
// union merge for sessions), then push any local-only sessions up.

async function syncMergeOnSignIn() {
  if (!_syncDb || !_syncUser) return { newSessions: 0 };

  console.group('[Sync] Merge on sign-in');
  console.log('Pulling cloud data…');

  // Pull cloud root doc + sessions subcollection in parallel
  const [mainSnap, sessSnap] = await Promise.all([
    _userDoc().get(),
    _userDoc().collection('sessions').get(),
  ]);

  const cloud       = mainSnap.exists ? mainSnap.data() : {};
  const cloudSess   = sessSnap.docs.map(d => d.data());
  const cloudProf   = cloud.profile  || null;
  const cloudPbs    = cloud.pbs      || null;
  const cloudProfTs = cloud.profileUpdatedAt || 0;
  const cloudPbsTs  = cloud.pbsUpdatedAt     || 0;

  const localProf   = getProfile();
  const localPbs    = getPBs();
  const localSess   = getSessions();
  const localIds    = new Set(localSess.map(s => s.id));
  const cloudIds    = new Set(cloudSess.map(s => s.id));

  console.log(`Cloud: ${cloudSess.length} sessions | Local: ${localSess.length} sessions`);

  // ── Profile: last write wins ──────────────────────────────────
  if (cloudProf && cloudProfTs > (localProf?._updatedAt || 0)) {
    console.log('Profile: using cloud version (newer). ts:', cloudProfTs);
    localStorage.setItem(KEYS.PROFILE, JSON.stringify(cloudProf));
  } else if (localProf) {
    console.log('Profile: using local version (newer or no cloud). Pushing up…');
    _userDoc().set(
      { profile: localProf, profileUpdatedAt: localProf._updatedAt || Date.now() },
      { merge: true }
    ).catch(e => console.error('[Sync] pushProfile (merge):', e));
  }

  // ── PBs: last write wins ──────────────────────────────────────
  const localPbsTs = parseInt(localStorage.getItem(KEYS.PBS_TS) || '0', 10);
  if (cloudPbs && cloudPbsTs > localPbsTs) {
    console.log('PBs: using cloud version (newer). ts:', cloudPbsTs);
    localStorage.setItem(KEYS.PBS, JSON.stringify(cloudPbs));
    localStorage.setItem(KEYS.PBS_TS, String(cloudPbsTs));
  } else if (Object.keys(localPbs).length > 0) {
    console.log('PBs: using local version (newer or no cloud). Pushing up…');
    _userDoc().set(
      { pbs: localPbs, pbsUpdatedAt: localPbsTs || Date.now() },
      { merge: true }
    ).catch(e => console.error('[Sync] pushPBs (merge):', e));
  }

  // ── Sessions: union merge ─────────────────────────────────────
  const newFromCloud = cloudSess.filter(s => !localIds.has(s.id));
  const newFromLocal = localSess.filter(s => !cloudIds.has(s.id));

  console.log(`Sessions: ${newFromCloud.length} new from cloud, ${newFromLocal.length} to push to cloud`);

  if (newFromCloud.length > 0) {
    const merged = [...localSess, ...newFromCloud];
    merged.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));
    localStorage.setItem(KEYS.SESSIONS, JSON.stringify(merged));
    console.log('Sessions merged into localStorage.');
  }

  // Push any local-only sessions to cloud (batched, max 400 per batch)
  if (newFromLocal.length > 0) {
    const batchSize = 400;
    for (let i = 0; i < newFromLocal.length; i += batchSize) {
      const batch = _syncDb.batch();
      newFromLocal.slice(i, i + batchSize).forEach(s => batch.set(_sessionDoc(s.id), s));
      batch.commit()
        .then(() => console.log(`[Sync] Batch pushed ${Math.min(batchSize, newFromLocal.length - i)} sessions OK.`))
        .catch(e => console.error('[Sync] Batch push failed:', e));
    }
  }

  console.log('Merge complete.');
  console.groupEnd();
  return { newSessions: newFromCloud.length };
}

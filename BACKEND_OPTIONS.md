# Strengthify — Cloud Sync Options

> Goal: optional sign-in that syncs `localStorage` data to the cloud.
> Local-first; sign-in is never required. Conflict strategy: last write wins.
> Must be free, zero-hosted infrastructure, static-site compatible.

---

## Constraints Summary

| Requirement | Detail |
|---|---|
| Hosting | None — client talks directly to the service |
| Auth | Google preferred (or best recommendation) |
| Sync | Optional; local data kept on sign-out |
| Conflicts | Last write wins (simplest) |
| Deployment | Static host (GitHub Pages / Netlify / Vercel etc.) |
| Cost | Free tier must cover personal use indefinitely |

---

## Option 1 — Firebase + Firestore ⭐ Recommended

### What it is
Google's own backend-as-a-service. Firestore is a NoSQL document store; Firebase Auth handles Google Sign-In. The JS SDK talks directly from the browser — no server code at all.

### Free tier (Spark plan — permanent, not a trial)
| Resource | Limit |
|---|---|
| Storage | 1 GB |
| Reads | 50 000 / day |
| Writes | 20 000 / day |
| Auth | Unlimited users |
| Bandwidth | 10 GB / month |

For a personal workout tracker this is essentially unlimited.

### Why it fits best
- Google Sign-In is first-class — one `signInWithPopup` call
- **Offline-first by design** — Firestore caches locally and syncs when online, matching the existing `localStorage` model perfectly
- SDK is mature, well documented, small (tree-shakeable)
- No CORS issues — designed for browser clients
- Data lives in your Google account's Firebase project

### Data model
```
users/{uid}/
  profile          (document)
  sessions/{id}    (collection — one doc per session)
  pbs              (document — map of exercise → PB object)
```

### Sync strategy
```
Sign in
  └─ Pull cloud data
       ├─ If local data exists: compare updatedAt timestamps → keep newer (last write wins)
       └─ Merge sessions by uuid (local + cloud, deduplicated)

Local write (saveSession, saveProfile, savePBs)
  └─ Write to localStorage (as today)
  └─ If signed in: also write to Firestore (async, fire-and-forget)

Sign out
  └─ Unsubscribe Firestore listener
  └─ Keep localStorage intact
```

### High-level code changes
1. Load Firebase SDK from CDN or bundle into the build
2. New `sync.js` module — wraps `signIn`, `signOut`, `push`, `pull`, `merge`
3. `data.js` — `saveProfile`, `saveSession`, `savePBs` call sync layer if authed
4. Profile screen — add "Sign in with Google" / "Sign out" button + sync status badge

### Complexity: Low
### Vendor lock-in: Medium (Google, but data is portable JSON)

---

## Option 2 — Supabase

### What it is
Open-source Firebase alternative backed by PostgreSQL. Has Auth (supports Google OAuth), a REST + realtime API, and a JS client that works from the browser.

### Free tier (permanent "Free" plan)
| Resource | Limit |
|---|---|
| Database | 500 MB |
| Bandwidth | 5 GB / month |
| Auth | Unlimited users |
| API requests | Unlimited |
| Realtime connections | 200 concurrent |

### Why it could fit
- True relational schema (great if you later want queries/analytics)
- Open source — can self-host if you outgrow the free tier
- Google OAuth is supported via Auth providers settings

### Why it's a step harder than Firebase
- Google OAuth in Supabase requires setting up a Google Cloud Console OAuth app and pasting credentials into the Supabase dashboard (extra ~10 min setup)
- No built-in offline cache — you manage optimistic updates yourself
- Row-level security (RLS) policies must be written to secure user data

### Data model (relational)
```sql
profiles (id uuid PK, uid text, name, sex, dob, bodyweight_kg, height_cm, total_xp, level, updated_at)
sessions (id uuid PK, uid text, date, exercises jsonb, xp_earned, updated_at)
pbs      (id uuid PK, uid text, data jsonb, updated_at)
```

### Complexity: Medium
### Vendor lock-in: Low (PostgreSQL — fully portable)

---

## Option 3 — Cloudflare Workers + D1 (SQLite)

### What it is
Write a small Cloudflare Worker (serverless function, ~50 lines) that exposes a REST API. D1 is Cloudflare's serverless SQLite database. Workers run at the edge globally with zero cold starts.

### Free tier
| Resource | Limit |
|---|---|
| Worker requests | 100 000 / day |
| D1 reads | 5 000 000 / day |
| D1 writes | 100 000 / day |
| D1 storage | 5 GB |

### Why it could fit
- Very generous limits, zero infra to manage
- SQLite schema is simple and portable
- Cloudflare handles global distribution

### Why it's more work
- You must write a Worker API (~100 lines of JS/TS)
- Auth: no built-in Google Sign-In — you'd use a third-party JWT service (Clerk free tier, or Auth0 free tier) to validate tokens in the Worker
- More moving parts than Option 1 or 2
- Adds a deploy step (wrangler CLI) whenever the API changes

### Complexity: High (for a static-site-only app)
### Vendor lock-in: Low

---

## Option 4 — Google Drive (gapi / GDRM)

### What it is
Store the entire data payload as a single JSON file in the user's own Google Drive using the Drive REST API with `appDataFolder` scope (hidden from the user's Drive UI).

### Free tier
- Completely free — uses the user's own 15 GB Drive quota
- No Firebase project or database needed

### Why it's interesting
- Zero third-party service — data lives in the user's Drive
- Simple: one file read on sign-in, one file write on each save
- Google Sign-In via `gapi` or the newer Google Identity Services library

### Why it's not ideal
- `appDataFolder` API has quirks in file:// contexts (not an issue here since you're on a static host, but worth noting)
- No real-time or multi-device conflict handling — full overwrite only (fine with last-write-wins)
- API client is heavier/more verbose than Firebase SDK
- If Google deprecates or changes the API surface you have to adapt

### Complexity: Medium
### Vendor lock-in: Low (data is a plain JSON file in Drive)

---

## Recommendation

**Use Firebase + Firestore (Option 1).**

It is the only option that was purpose-built for exactly this pattern — a local-first single-page app with optional Google-authenticated cloud sync. The Spark free tier will never be exceeded for personal use. The offline cache means the app continues to work seamlessly offline, and syncs automatically when back online. The implementation is the smallest change to the existing codebase.

---

## Recommended Implementation Design

### Architecture
```
┌──────────────────────────────────────────────────┐
│  Browser                                         │
│                                                  │
│  ┌─────────┐   reads/writes   ┌──────────────┐  │
│  │  app.js │ ──────────────►  │   data.js    │  │
│  └─────────┘                  │ (localStorage│  │
│                               │  + sync hook)│  │
│                               └──────┬───────┘  │
│                                      │ if authed │
│                               ┌──────▼───────┐  │
│                               │   sync.js    │  │
│                               │  (Firebase   │  │
│                               │   SDK)       │  │
│                               └──────┬───────┘  │
└──────────────────────────────────────┼───────────┘
                                       │ HTTPS
                              ┌────────▼────────┐
                              │   Firestore     │
                              │  (Google cloud) │
                              └─────────────────┘
```

### New files
| File | Purpose |
|---|---|
| `web/src/sync.js` | Firebase init, sign-in/out, push/pull/merge logic |

### Changes to existing files
| File | Change |
|---|---|
| `web/src/data.js` | After each `localStorage.setItem`, call `sync.push(key, data)` if signed in |
| `web/src/app.js` | Auth state listener; render sign-in button on Profile screen |
| `web/src/index.html` | Firebase SDK script tags (or bundled via build) |

### Sign-in / sign-out flow
```
User taps "Sign in with Google"
  → Firebase popup auth
  → On success: pull Firestore data
      → For each key (profile, sessions, pbs):
          → If cloud updatedAt > local updatedAt: overwrite local
          → If local updatedAt > cloud updatedAt: push local to cloud
          → Sessions: merge by uuid, keep all unique entries
  → Show "Synced" badge

User taps "Sign out"
  → Firebase signOut()
  → localStorage untouched
  → Sync badge hidden
```

### Firestore security rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```
This ensures users can only read/write their own data.

### Setup steps (one-time)
1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com) (free Spark plan)
2. Enable **Firestore** and **Authentication → Google provider**
3. Copy the project config snippet into `sync.js`
4. Deploy the updated `strengthify.html` to your static host
5. Add your static host's domain to Firebase Auth → Authorized Domains

---

## What stays the same
- The app works exactly as today if the user never signs in
- `localStorage` remains the primary store — cloud is a mirror
- No server to deploy, maintain, or pay for
- Build process (`build.ps1`) is unchanged except bundling `sync.js`

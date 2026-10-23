# Strengthify

A local-first web app to track workouts, earn XP, compare strength benchmarks,
and commit to flexible training. The native Android project has been retired.

## Build and run

Requires PowerShell 5.1 or later. No package installation is needed.

```powershell
.\web\build.ps1
Start-Process .\web\dist\index.html
```

The build bundles the HTML, CSS, and JavaScript into [web/dist/index.html](web/dist/index.html).
It also updates the original [web/dist/strengthify.html](web/dist/strengthify.html)
entry point with the same app for existing bookmarks.
GitHub Actions builds and deploys this page to GitHub Pages on pushes to `main`.
Google sign-in and cloud sync require internet access; local-only mode does not.

## Eight-week commitment

Open **My weekly blocks** on Home, or access it from Plans. Choose a start date
(defaults to next Monday) and select **I'm in for 8 weeks**.

- Eight seven-day weeks begin on your chosen date, with no assigned workout days.
- Each week has two blocks of each of the five workout types: **10 blocks per week,
  80 in total**, at roughly 25 minutes per block.
- Combine blocks in one visit or spread them throughout the week.
- Each workout card shows the example movements and supplied superset instructions.
- Check off a block after doing it; untick it to undo. Past weeks remain editable,
  while future weeks can be previewed but not checked off.
- Completing all ten blocks unlocks a trophy and confetti celebration once per week.
  Reduced-motion preferences disable the animation.
- Progress is saved locally, included in JSON backups, and synced when signed in.
  Cloud conflicts use the most recently saved whole commitment, like training plans;
  simultaneous offline edits on different devices are not combined.
  Cloud storage wraps each week's check-offs in an object for Firestore compatibility;
  local data and JSON backups retain the original week-by-week arrays.
- **Start a new commitment** allows another date after confirmation. It replaces
  the previous checklist, so export a backup first if you want to keep it.

Checklist blocks are separate from workout logs: they do not create sets, personal
bests, or XP. Use **Workout** separately for those. Existing GVT/custom plans and
the mobility routine remain available.

## Backups and sync

Use **Profile > Export backup (JSON)** to download your data, and **Import backup**
to restore it. Older backups without a commitment leave the current commitment
untouched. A new backup with a `null` commitment explicitly clears it on restore.
Signing out keeps local data. **Reset all data** clears this browser only, not
existing cloud records.

Firebase setup and access-rule instructions are in [web/src/sync.js](web/src/sync.js).

## Tests

Requires Node.js 18 or later.

```powershell
.\scripts\test.ps1
```

The tests use Node's built-in test runner, with no dependencies. They cover week
boundaries, local dates, check-off limits, persistence, celebrations, backup
compatibility, and cloud merging. Rebuild after changing sources; do not edit
the generated distribution page manually.

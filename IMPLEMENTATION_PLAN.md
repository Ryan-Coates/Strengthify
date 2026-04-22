# Strengthify — Implementation Plan

## Overview

A focused Android strength-training app that records workouts, awards XP, and compares lifts against age/weight benchmarks. Deliberately minimal: a small fixed set of compound lifts, a clear levelling system, and zero fluff.

---

## Core Principles

- **One screen to log a workout** — no deep navigation
- **Fixed lift library** — 8 movements maximum (see below)
- **Benchmarks are personal** — based on user age, bodyweight, and sex
- **XP is transparent** — the user always knows why they earned points

---

## Lift Library (fixed set)

| # | Lift | Primary Muscles |
|---|------|-----------------|
| 1 | Back Squat | Quads, Glutes |
| 2 | Deadlift | Posterior chain |
| 3 | Bench Press | Chest, Triceps |
| 4 | Overhead Press | Shoulders |
| 5 | Barbell Row | Upper back |
| 6 | Pull-up / Chin-up | Lats, Biceps |
| 7 | Dip | Chest, Triceps |
| 8 | Romanian Deadlift | Hamstrings |

---

## Benchmark System (Pseudocode)

Benchmarks are based on the Strength Level / ExRx coefficient tables, normalised per bodyweight ratio.

```
FUNCTION getBenchmark(lift, age, bodyweightKg, sex):
    // Base ratio = expected 1-rep-max as a multiple of bodyweight
    baseRatio = LOOKUP benchmarkTable[lift][sex]["intermediate"]

    // Age correction: strength peaks ~25-35, decays after
    IF age < 18:
        ageFactor = 0.80
    ELSE IF age <= 24:
        ageFactor = 0.92
    ELSE IF age <= 35:
        ageFactor = 1.00       // peak
    ELSE IF age <= 45:
        ageFactor = 0.95
    ELSE IF age <= 55:
        ageFactor = 0.88
    ELSE IF age <= 65:
        ageFactor = 0.80
    ELSE:
        ageFactor = 0.72

    RETURN baseRatio * ageFactor * bodyweightKg  // in kg
END FUNCTION

FUNCTION getBenchmarkTier(actualKg, benchmarkKg):
    ratio = actualKg / benchmarkKg
    IF ratio < 0.50:   RETURN "Beginner"
    IF ratio < 0.75:   RETURN "Novice"
    IF ratio < 1.00:   RETURN "Intermediate"
    IF ratio < 1.25:   RETURN "Advanced"
    RETURN "Elite"
END FUNCTION
```

---

## XP System (Pseudocode)

```
CONSTANTS:
    BASE_XP_PER_SET  = 10
    PERSONAL_BEST_BONUS = 50
    BENCHMARK_TIER_BONUS = { Novice: 10, Intermediate: 25, Advanced: 50, Elite: 100 }
    STREAK_MULTIPLIER_PER_DAY = 0.05   // up to 2x at 20-day streak

FUNCTION calculateSessionXP(session, userProfile, history):
    xp = 0

    FOR EACH set IN session.sets:
        xp += BASE_XP_PER_SET

        estimatedOneRM = set.weightKg * (1 + set.reps / 30)  // Epley formula

        IF estimatedOneRM > history.personalBest[set.lift]:
            xp += PERSONAL_BEST_BONUS
            history.personalBest[set.lift] = estimatedOneRM

    benchmark = getBenchmark(session.primaryLift, userProfile.age,
                             userProfile.bodyweightKg, userProfile.sex)
    tier = getBenchmarkTier(history.personalBest[session.primaryLift], benchmark)
    xp += BENCHMARK_TIER_BONUS[tier]

    streakMultiplier = MIN(1.0 + userProfile.currentStreakDays * STREAK_MULTIPLIER_PER_DAY, 2.0)
    xp = ROUND(xp * streakMultiplier)

    RETURN xp
END FUNCTION
```

---

## Level System (Pseudocode)

```
// XP required grows quadratically so early levels feel fast
FUNCTION xpForLevel(level):
    RETURN 100 * (level ^ 2)

// e.g. Level 1→2 = 100 XP, Level 5→6 = 2500 XP, Level 10→11 = 10000 XP

FUNCTION applyXP(userProfile, xpEarned):
    userProfile.totalXP += xpEarned
    WHILE userProfile.totalXP >= xpForLevel(userProfile.level + 1):
        userProfile.level += 1
        TRIGGER levelUpAnimation(userProfile.level)
    SAVE userProfile
END FUNCTION
```

---

## Data Models (Pseudocode)

```
UserProfile:
    id            : UUID
    name          : String
    sex           : Enum { MALE, FEMALE }
    dateOfBirth   : Date
    bodyweightKg  : Float
    totalXP       : Int
    level         : Int
    currentStreak : Int
    lastWorkoutDate: Date

WorkoutSession:
    id            : UUID
    userId        : UUID
    date          : Date
    sets          : List<SetEntry>
    totalXPEarned : Int
    durationMins  : Int

SetEntry:
    lift          : Enum (one of the 8 lifts)
    weightKg      : Float
    reps          : Int
    rpe           : Int?   // optional perceived effort 1-10

PersonalBest:
    userId        : UUID
    lift          : Enum
    estimatedOneRM: Float
    achievedDate  : Date

BenchmarkSnapshot:
    userId        : UUID
    lift          : Enum
    tier          : Enum { Beginner, Novice, Intermediate, Advanced, Elite }
    percentOfBenchmark: Float
    calculatedAt  : Date
```

---

## Screen Flow (Pseudocode)

```
APP LAUNCH:
    IF firstRun:
        SHOW onboarding → collect name, sex, dob, bodyweightKg
    ELSE:
        SHOW HomeScreen

HomeScreen:
    DISPLAY level badge + XP bar
    DISPLAY streak count
    DISPLAY "Start Workout" button
    DISPLAY last 3 sessions summary
    DISPLAY benchmark progress cards (one per lift)

StartWorkout:
    user selects 1-4 lifts for today
    NAVIGATE to LoggingScreen(selectedLifts)

LoggingScreen:
    FOR EACH lift IN selectedLifts:
        SHOW lift name + previous session weight/reps as suggestion
        user enters sets (weight + reps) — one row per set
        ADD SET button appends a new row
    FINISH WORKOUT button:
        CALCULATE xpEarned = calculateSessionXP(...)
        SAVE session + personal bests
        CALL applyXP(userProfile, xpEarned)
        NAVIGATE to ResultsScreen

ResultsScreen:
    SHOW total XP earned breakdown
    IF level up: SHOW level up animation
    SHOW personal bests achieved this session
    SHOW benchmark tier changes
    SHOW "done" → HomeScreen

ProgressScreen (tab):
    per-lift chart of estimated 1RM over time
    benchmark tier badge per lift
    % of benchmark with colour coding:
        < 75%  → red
        75-99% → amber
        >= 100%→ green

ProfileScreen (tab):
    update bodyweight (recalculates all benchmarks)
    view all-time stats
    level + total XP
    streak history calendar
```

---

## Streak Logic (Pseudocode)

```
FUNCTION updateStreak(userProfile):
    today = currentDate()
    IF userProfile.lastWorkoutDate == today:
        RETURN   // already logged today
    IF userProfile.lastWorkoutDate == today - 1 day:
        userProfile.currentStreak += 1
    ELSE:
        userProfile.currentStreak = 1   // reset
    userProfile.lastWorkoutDate = today
    SAVE userProfile
END FUNCTION
```

---

## Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Language | Kotlin | Android native, modern |
| UI | Jetpack Compose | Declarative, less boilerplate |
| Local DB | Room (SQLite) | Offline-first, no backend needed |
| Architecture | MVVM + Repository | Testable, clean separation |
| Charts | Vico or MPAndroidChart | Lightweight |
| DI | Hilt | Standard Android DI |
| Min SDK | API 26 (Android 8) | ~95% device coverage |

No backend / cloud required for v1 — everything is stored locally on device.

---

## Docker-Based Development Environment

**Goal:** zero host installations — only Docker Desktop for Windows is required.

### What runs in Docker

| Task | Docker? | Notes |
|------|---------|-------|
| Build APK / AAB | Yes | `./gradlew assembleDebug` |
| Unit tests (JVM) | Yes | `./gradlew test` |
| Lint | Yes | `./gradlew lint` |
| Code generation (Room, Hilt) | Yes | via `ksp` Gradle plugin |
| Android Emulator | **No** | KVM not available in Docker on Windows |
| Deploy to device | Bridged | ADB connects to physical device over TCP |

### Device workflow (physical phone)

```
1. On your Android phone:
   Settings → Developer Options → Wireless debugging → Enable
   Note the IP:port shown (e.g. 192.168.1.50:5555)

2. From PowerShell on the host (one-time per session):
   .\scripts\connect-device.ps1 -ip 192.168.1.50 -port 5555

3. The script forwards local port 5037 into the build container,
   then runs:  adb connect 192.168.1.50:5555
   The device appears inside the container as a normal ADB target.

4. Deploy:  docker compose run --rm build ./gradlew installDebug
```

### Project file layout

```
Strengthify/
├── app/                        # Android app module
│   ├── src/
│   │   ├── main/
│   │   │   ├── kotlin/         # Kotlin source
│   │   │   ├── res/            # Layouts, drawables
│   │   │   └── AndroidManifest.xml
│   │   └── test/               # Unit tests (JVM)
│   └── build.gradle.kts
├── Dockerfile                  # Android SDK build image
├── docker-compose.yml          # Service definitions
├── scripts/
│   ├── build.ps1               # Build APK
│   ├── test.ps1                # Run unit tests
│   ├── lint.ps1                # Run lint
│   └── connect-device.ps1      # ADB TCP bridge
├── gradle/
│   └── wrapper/
│       ├── gradle-wrapper.jar
│       └── gradle-wrapper.properties
├── gradlew                     # Unix Gradle wrapper (used inside container)
├── gradlew.bat                 # Windows Gradle wrapper (not used in Docker)
└── settings.gradle.kts
```

### Gradle cache strategy

The `gradle-cache` Docker volume persists the Gradle dependency cache between container runs so dependencies are not re-downloaded on every build.

### Dockerfile overview (see Dockerfile)

```
Base image   : ubuntu:22.04
JDK          : OpenJDK 17
Android SDK  : command-line tools → sdkmanager installs
               - build-tools;34.0.0
               - platforms;android-34
               - platform-tools
Gradle       : run via the project's Gradle wrapper (gradlew)
User          : non-root 'builder' user
Working dir  : /workspace (project mounted as volume)
```

---

## Phased Delivery

### Phase 1 — Core Loop (MVP)
- [ ] Onboarding flow (profile setup)
- [ ] Logging screen (select lifts, enter sets)
- [ ] Local Room DB with all data models
- [ ] XP calculation & level system
- [ ] Home screen with level badge & XP bar
- [ ] Personal best tracking

### Phase 2 — Benchmarks & Progress
- [ ] Benchmark table (all 8 lifts × 2 sexes)
- [ ] Benchmark tier display on home screen
- [ ] Progress chart per lift (estimated 1RM over time)
- [ ] Profile screen with bodyweight update

### Phase 3 — Gamification Polish
- [ ] Streak system with visual calendar
- [ ] Streak multiplier applied to XP
- [ ] Level-up animation / celebration screen
- [ ] Achievement badges (e.g. "First Bodyweight Squat", "30-day Streak")

### Phase 4 — Quality of Life
- [ ] Rest timer between sets (optional toggle)
- [ ] Plate calculator (given target weight, show plates to load)
- [ ] Backup / export workout history as CSV
- [ ] Widget showing streak & next level progress

---

## Out of Scope (deliberately excluded)

- Social / sharing features
- Cloud sync (Phase 1)
- Custom exercise creation (keep the fixed 8)
- Video demos
- Nutrition tracking
- Paid tiers / subscriptions

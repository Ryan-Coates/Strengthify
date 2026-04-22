# Strengthify
Track workouts, earn XP, and compare against strength benchmarks.

## Requirements
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) — the only tool you need to build an APK
- [Android Studio](https://developer.android.com/studio) — optional, for IDE-based development

---

## Build an APK (no Android Studio needed)

```powershell
.\scripts\apk.ps1
```

This builds the project inside Docker and opens the output folder in Explorer.  
Copy `app-debug.apk` to your phone and sideload it.

**First run takes ~10 minutes** to download Gradle dependencies. Subsequent builds are fast.

### Sideload to phone
1. Connect phone via USB → choose **File Transfer** mode
2. Copy `app-debug.apk` to your phone's Downloads folder
3. On phone: **Settings → Apps → Special App Access → Install Unknown Apps**
   Allow your Files app, then open it and tap the APK

---

## Open in Android Studio

The Gradle wrapper files (`gradlew`, `gradlew.bat`, `gradle/wrapper/gradle-wrapper.jar`) are
already generated in this repo. Simply:

1. Install [Android Studio](https://developer.android.com/studio)
2. **File → Open** → select this folder
3. Wait for Gradle sync (downloads ~500 MB on first open)
4. Run on a connected device or emulator with the **▶ Run** button

---

## One-time Docker setup (if wrapper files are missing)

```powershell
.\scripts\setup.ps1
```

---

## All scripts

| Script | What it does |
|---|---|
| `.\scripts\apk.ps1` | Build debug APK + open folder in Explorer |
| `.\scripts\apk.ps1 -Release` | Build unsigned release APK |
| `.\scripts\install-adb.ps1` | Install APK directly to phone via ADB over USB |
| `.\scripts\install-adb.ps1 -WiFi 192.168.x.x` | Install wirelessly via ADB |
| `.\scripts\setup.ps1` | Re-generate Gradle wrapper files via Docker |

---

## Docker commands (advanced)

```powershell
docker compose run --rm build    # assemble debug APK
docker compose run --rm test     # run unit tests
docker compose run --rm lint     # Android lint
docker compose run --rm shell    # interactive bash shell in build container
```

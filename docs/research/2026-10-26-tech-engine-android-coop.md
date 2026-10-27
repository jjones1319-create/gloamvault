# Dungeon Crawler — Technology Research Report

*Prepared 2026-10-26. Versions and prices were checked on that date; everything here is a starting point for `docs/05-TECH-PLAN.md`, not a commitment. Numbers marked "budget" are tuning starting points.*

## 0. The one-paragraph answer

Use **Godot 4.7.2 (stable, 18 Aug 2026) with GDScript**, the **Mobile renderer on Vulkan**, and a **deterministic turn-based simulation that runs identically on every client**, with co-op driven by small command messages from a host (Phase A offline → Phase B LAN over ENet → Phase C internet over a self-hosted **Nakama** relay, with Epic Online Services P2P as the zero-ops fallback). Build APKs headlessly with `godot --headless --export-release Android`, in GitHub Actions on Linux runners, attach them to GitHub Releases, sideload with `adb install`. Keep characters on the shared humanoid rig exported from Blender 5.2 LTS as `.glb`, retargeted through Godot's `SkeletonProfileHumanoid`. Everything in that sentence can be driven and verified from a Windows command line by an AI agent without an account, a GUI wizard or a licence server — which is the deciding constraint.

---

## 1. Engine choice for an AI-agent-driven solo dev on Windows → Android

### 1.1 The deciding constraint

The builder is Claude Code on James's Windows PC. That makes four things matter more than raw engine capability: (1) the engine must be installable and runnable with no account or licence step; (2) every build, test and export must be a command with an exit code; (3) the agent must be able to *see* what it made (PNG screenshots it can read); (4) project files must be text so the agent can write, diff and review them. Everything below is weighed against that.

### 1.2 Godot 4.7.2 — the current state

**Versions.** Godot 4.7 went stable on 18 June 2026; 4.7.2 (18 Aug 2026) is the latest stable, and 4.8 beta 1 shipped on 15 Oct 2026 ([archive](https://godotengine.org/download/archive/)). Godot ships roughly two minor releases a year, so expect 4.8 stable around the turn of the year; pin to 4.7.x for the first build and move only on a milestone.

**Install.** `winget install GodotEngine.GodotEngine` (or `GodotEngine.GodotEngine.Mono` for the .NET build) — a single ~150 MB executable, no account, no Hub, no licence. Export templates are a second zip fetched from the same release page (`godotengine/godot-builds` on GitHub) and can be installed by copying them into `%APPDATA%\Godot\export_templates\4.7.2.stable\` — no GUI needed. The Windows download page lists the hardware floor: Vulkan 1.0 recommended, OpenGL 3.3 / ES 3.0 minimum ([download](https://godotengine.org/download/windows/)).

**GDScript vs C# on Android.** C# has worked on Android since 4.2 but the docs still say, in 4.7, "Android support is currently experimental", and C# cannot export to the web at all ([C# docs, 4.7 branch](https://raw.githubusercontent.com/godotengine/godot-docs/4.7/tutorials/scripting/c_sharp/index.rst)). Godot's own platform-state article explains why: the Android .NET export uses the linux-bionic Mono runtime with no JNI, so Android bindings are unavailable and some .NET APIs (SSL was the example) can crash the app ([platform state](https://godotengine.org/article/platform-state-in-csharp-for-godot-4-2/)). Third-party Android plugins and GDExtensions (Nakama, Photon, EOS) all ship GDScript-first. For this project **GDScript is the lower-risk choice**: it is the engine's native path on Android, hot-reloads, and is compact for an LLM to write. The one thing C# would buy — sharing the deterministic sim with a .NET server — can be had another way (run a headless Godot as the server; §3.4 and §7.3). If the sim ever needs to be shared with a non-Godot server, write it in GDScript with no engine dependencies and port it, or move just the sim to C#.

**Mobile vs Forward+ renderer.** Forward+ is "suited for desktop platforms only" and on mobile is "supported, but poorly optimized". **Mobile** is the default on mobile; it needs Vulkan/D3D12/Metal, supports compute shaders and CompositorEffects, but drops VoxelGI, SDFGI, SSIL, SSAO, SSR, volumetric fog, subsurface scattering and contact shadows, and caps lights at 8 OmniLights + 8 SpotLights per mesh (256 per view), 8 reflection probes per mesh and 8 decals per surface. Compatibility (OpenGL ES 3.0) is the only option without a RenderingDevice; since 4.4 the engine falls back Vulkan→D3D12→Compatibility automatically ([renderers](https://raw.githubusercontent.com/godotengine/godot-docs/master/tutorials/rendering/renderers.rst)). In 4.7 Mobile "matches or outperforms Compatibility in some benchmarks" ([4.7 release page](https://godotengine.org/releases/4.7/)), and a joint Google / The Forge / Godot Foundation Vulkan pass (lazy render targets, immutable samplers, UMA buffers, ASTC decode mode, pre-rotation) cut Android GPU frame time 10–20 % ([Android developers case study](https://developer.android.com/stories/games/godot-vulkan)). One caveat: FSR 1.0/2.2 are Forward+ only; on Mobile the 3D scale mode is **bilinear** with an automatic mipmap bias ([resolution scaling](https://raw.githubusercontent.com/godotengine/godot-docs/4.7/tutorials/3d/resolution_scaling.rst)) — fine for a stylised game at 0.6–0.75 scale.

**glTF import with skeletons and animations.** `.glb` is Godot's first-class 3D format. The import dock exposes animation FPS ("there is usually not much benefit in going above 30 FPS"), trimming, "Remove Immutable Tracks", and an **Animation Library** import mode that turns an animation-only `.glb` into a shared `AnimationLibrary`; an `EditorScenePostImport` script can rename, strip or re-parent anything ([import configuration](https://raw.githubusercontent.com/godotengine/godot-docs/master/tutorials/assets_pipeline/importing_3d_scenes/import_configuration.rst)). Import options live in text `.import` sidecars, so the agent sets them without the GUI.

**SkeletonProfileHumanoid / BoneMap retargeting.** Godot stores animation as transform tracks on bone paths, and bone *rests* must match for sharing. The importer's Retarget section handles it: a `BoneMap` against `SkeletonProfileHumanoid` (auto-mapped by English bone names), "Remove Tracks" (unimportant positions, unmapped bones), "Bone Renamer" + "Unique Node", and the "Rest Fixer" with **Overwrite Axis** ("the most important option for sharing animations in Godot 4"), **Fix Silhouette** for A-pose models and **Normalize Position Tracks** (a `motion_scale` from hip height that stops foot sliding across differently sized characters) ([retargeting](https://raw.githubusercontent.com/godotengine/godot-docs/master/tutorials/assets_pipeline/retargeting_3d_skeletons.rst)). The sister project's Unity-Humanoid-style rig maps onto this profile directly.

**Headless CLI.** `--headless` (dummy display and audio); `--import` "starts the editor, waits for any resources to be imported, and then quits"; `--export-release <preset> <path>` / `--export-debug` / `--export-pack`; `-s <script>` runs a `SceneTree` script; `--quit-after N`, `--fixed-fps`, `--write-movie <file.png>` (PNG sequence), `--resolution WxH`, `--check-only`. The docs' own example: `godot --headless --export-release Android /var/builds/project.apk` ([command line tutorial](https://raw.githubusercontent.com/godotengine/godot-docs/master/tutorials/editor/command_line_tutorial.rst)).

**Screenshots from a script.** `--headless` renders nothing, so captures need a windowed run — fine on James's GPU-equipped PC. The 4.3+ pattern is `await RenderingServer.frame_post_draw; get_viewport().get_texture().get_image().save_png("user://shot.png")` ([forum, Calinou](https://forum.godotengine.org/t/screenshot-procedure-changed-broken-in-4-3/52570)). The deterministic alternative is Movie Maker mode, `--write-movie shots/frame.png --fixed-fps 30 --quit-after 90`, which writes numbered PNGs with frame-locked timing.

**Text project files.** `project.godot`, `.tscn`, `.tres`, `.import` and `export_presets.cfg` are INI/TSCN text, diffable and writable by a script; `.godot/` is the import cache — gitignore it and regenerate with `--import`.

**Testing.** gdUnit4 v6.2.0 (Godot 4.5–4.7.x) runs from the command line with JUnit XML, supports GDScript and C#, has a `SceneRunner` that simulates input and waits on signals, and ships a GitHub Action ([gdUnit4](https://store.godotengine.org/asset/mikeschulze/gdunit4-unit-testing-framework/)); GUT is the older alternative. For the pure sim a plain `SceneTree` script with asserts under `--headless -s` has zero dependencies.

### 1.3 Unity 6.3 LTS — capable, but the friction is in exactly the wrong place

**Versions.** 6.3 LTS (released 4 Dec 2025) is at 6000.3.27f1 (20 Oct 2026) and supported to Dec 2027; 6.0 LTS support ends this month; the Update stream is at 6.6 (6000.6.7f1) and the next LTS is 6.7 ([endoflife.date](https://endoflife.date/unity), [Unity support page](https://unity.com/releases/unity-6/support)). The Update releases brought Android ThinLTO builds and on-tile post-processing on Vulkan ([6.5 notes](https://discussions.unity.com/t/unity-6-5-is-now-available/1723176)).

**Account/licence friction.** Unity now ships a standalone **Unity CLI** (`winget install Unity.CLI`; `unity install lts -m android`; service-account env vars for CI) that deprecates the Hub CLI ([Unity CLI](https://docs.unity.com/en-us/unity-cli/use-unity-cli.md), [Hub CLI](https://docs.unity.com/en-us/hub/use-hub-cli.md)). But `unity auth login` "opens a browser-based sign-in flow"; a Unity ID and Personal licence entitlement remain mandatory; the editor is a multi-GB install plus a ~3 GB Android module; and manual activation is a three-step `.ulf` dance ([editor CLI args](https://docs.unity3d.com/6000.3/Documentation/Manual/EditorCommandLineArguments.html)). One-time setup for James, but every re-activation or licence hiccup lands on the agent.

**Batchmode builds and tests** work: `Unity.exe -batchmode -nographics -quit -projectPath . -buildTarget android -executeMethod Build.Android -logFile -`, and `-runTests -testPlatform PlayMode -testResults r.xml`. Unity 6.3 wants JDK 17, NDK r27c, build-tools 36.0.0, cmdline-tools 16 ([supported dependency versions](https://docs.unity3d.com/6000.3/Documentation/Manual/android-supported-dependency-versions.html)), installed by the CLI modules.

**YAML scenes** are text but full of GUIDs and fileIDs; the agent would generate them through editor scripts — one more layer of indirection than Godot's `.tscn`, which it can simply write.

**Verdict.** Unity would win if the project needed Photon Quantum, DOTS or a console port. It does not; the account/licence surface and opaque scenes are a standing tax with no offsetting benefit here.

### 1.4 Unreal — no

Unreal's Android pipeline (Android Studio install via `SetupAndroid.bat`, 10+ GB engine, Blueprints as binary `.uasset`, C++ compile times, Epic account for the launcher) fails every one of the four constraints. Its strengths (Nanite, Lumen, Metahuman) are not usable on mobile for this art style anyway.

### 1.5 Defold and Bevy, briefly

**Defold** is genuinely CLI-friendly — `bob.jar` builds and signs APK/AAB bundles with no GUI, though it now needs OpenJDK 25 ([Bob manual](https://defold.com/manuals/bob)) — but it is 2D-first: thin 3D skinning, lighting and glTF animation support, no humanoid retargeting, small 3D ecosystem. **Bevy** (0.18) is a scriptable Rust ECS engine with glTF skeletal animation and an Android target, but no editor, no retargeting, immature mobile rendering and breaking changes every release. Neither fits a 3D game that needs to ship.

### 1.6 Recommendation

**Godot 4.7.2, GDScript, Mobile renderer.** Reasons specific to the agent: zero-account install by `winget`; one command each for import, test, export and screenshot capture; all project files are text; the Android toolchain is the plain Android SDK + JDK 17 with paths in a text settings file; the testing frameworks run headless; and the Blender `.glb` path with humanoid retargeting is first-class. The main things given up are Unity's bigger asset store and Photon Quantum; neither matters for a 1–4-player deterministic turn-based game.

---

## 2. Android build pipeline

### 2.1 Exact requirements (Godot 4.7.x)

| Item | Requirement | Note |
|---|---|---|
| JDK | **OpenJDK 17** (higher works) | `winget install EclipseAdoptium.Temurin.17.JDK` |
| Android SDK | `cmdline-tools/latest`, `platform-tools`, `build-tools 36.1.0`, `platforms;android-36` | Godot's docs also list `ndk/29.0.14206865` and `cmake 3.22.1`; they are only exercised by Gradle/native builds, but install them so Gradle never complains ([exporting for Android](https://raw.githubusercontent.com/godotengine/godot-docs/master/tutorials/export/exporting_for_android.rst)) |
| Export templates | `Godot_v4.7.2-stable_export_templates.tpz` matching the editor exactly | unzip into `%APPDATA%\Godot\export_templates\4.7.2.stable\` |
| Editor settings | `export/android/java_sdk_path`, `export/android/android_sdk_path` in `%APPDATA%\Godot\editor_settings-4.7.tres` | text; the agent writes it |
| Debug keystore | Godot generates one; overridable with `GODOT_ANDROID_KEYSTORE_DEBUG_PATH/USER/PASSWORD` | user `androiddebugkey` |
| Release keystore | `keytool -v -genkey -keystore dc-release.keystore -alias dungeoncrawler -keyalg RSA -keysize 2048 -validity 10000` | store and key passwords must be the same, alphanumeric only |
| Min / target SDK | template default **minSdk 24**, **targetSdk/compileSdk 36** in 4.7 ([forum](https://forum.godotengine.org/t/how-to-target-latest-android-sdk/142631)) | set `gradle_build/min_sdk` / `target_sdk` in the preset |
| Architectures | `arm64-v8a` only | drop armeabi-v7a/x86 to halve the APK |
| 16 KB pages | supported from Godot 4.5 (PR #106358, NDK r28b) ([forum](https://forum.godotengine.org/t/godot-and-google-play-policy-warning-about-16-kb-memory-page-size/120934)) | a Play requirement since 1 Nov 2025 for apps targeting Android 15+ |
| APK vs AAB | APK = prebuilt template, no Gradle; **AAB requires Gradle build** and is what Play wants | Gradle build also needed for third-party Android plugins |

Godot 4.8 adds **Project → Setup Android Build**, which downloads a private JDK + SDK for the editor; useful later, not needed now.

### 2.2 Scripting it on Windows

```powershell
# tools/android-setup.ps1  (run once)
winget install -e --id EclipseAdoptium.Temurin.17.JDK
$sdk = "$env:LOCALAPPDATA\Android\Sdk"
# download commandlinetools-win-*.zip from developer.android.com, unzip to $sdk\cmdline-tools\latest
& "$sdk\cmdline-tools\latest\bin\sdkmanager.bat" --sdk_root=$sdk `
  "platform-tools" "build-tools;36.1.0" "platforms;android-36" "ndk;29.0.14206865" "cmake;3.22.1"
# accept licences non-interactively
(1..10 | % { "y" }) | & "$sdk\cmdline-tools\latest\bin\sdkmanager.bat" --sdk_root=$sdk --licenses

# tools/build-android.ps1  (every build)
$env:GODOT_ANDROID_KEYSTORE_RELEASE_PATH = "C:\keys\dc-release.keystore"
$env:GODOT_ANDROID_KEYSTORE_RELEASE_USER = "dungeoncrawler"
$env:GODOT_ANDROID_KEYSTORE_RELEASE_PASSWORD = $env:DC_KEYSTORE_PW
godot --headless --path . --import
godot --headless --path . --export-release "Android" build/dungeoncrawler.apk
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
adb install -r -d build/dungeoncrawler.apk
```

`export_presets.cfg` holds the preset named "Android" (package name, architectures, `gradle_build/use_gradle_build`, `gradle_build/export_format` 0 = APK / 1 = AAB, `permissions/internet=true`); keystore paths and passwords stay out of it via the env vars above.

### 2.3 GitHub Actions: build the APK and attach it to a Release

GitHub Free gives private repos 2,000 minutes/month, 500 MB artifact storage and 10 GB cache per repo; Linux 2-core minutes cost $0.006 vs $0.010 for Windows, and public repos are free ([GitHub billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)). A Godot Android export is 2–5 minutes on Linux, so ~100 CI builds a month fit the free tier; use Linux runners, and keep the Windows machine for local builds.

```yaml
# .github/workflows/android.yml
name: android
on:
  push: { tags: ['v*'] }
  workflow_dispatch:
env:
  GODOT_VERSION: 4.7.2
jobs:
  apk:
    runs-on: ubuntu-24.04
    permissions: { contents: write }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with: { distribution: temurin, java-version: '17' }
      - uses: android-actions/setup-android@v3
        with: { packages: 'platform-tools build-tools;36.1.0 platforms;android-36 ndk;29.0.14206865 cmake;3.22.1' }
      - name: Cache Godot + templates
        uses: actions/cache@v4
        with:
          path: ~/godot
          key: godot-${{ env.GODOT_VERSION }}
      - name: Install Godot and export templates
        run: |
          mkdir -p ~/godot ~/.local/share/godot/export_templates/${GODOT_VERSION}.stable
          cd ~/godot
          [ -f godot ] || { curl -sSLO https://github.com/godotengine/godot-builds/releases/download/${GODOT_VERSION}-stable/Godot_v${GODOT_VERSION}-stable_linux.x86_64.zip; unzip -q Godot_v*_linux.x86_64.zip; mv Godot_v*_linux.x86_64 godot; }
          [ -f templates.tpz ] || curl -sSL -o templates.tpz https://github.com/godotengine/godot-builds/releases/download/${GODOT_VERSION}-stable/Godot_v${GODOT_VERSION}-stable_export_templates.tpz
          unzip -q -o templates.tpz -d /tmp/t && mv /tmp/t/templates/* ~/.local/share/godot/export_templates/${GODOT_VERSION}.stable/
      - name: Editor settings (SDK paths)
        run: |
          mkdir -p ~/.config/godot
          cat > ~/.config/godot/editor_settings-4.7.tres <<EOF
          [gd_resource type="EditorSettings" format=3]
          [resource]
          export/android/java_sdk_path = "$JAVA_HOME"
          export/android/android_sdk_path = "$ANDROID_SDK_ROOT"
          EOF
      - name: Keystore from secret
        run: echo "${{ secrets.RELEASE_KEYSTORE_B64 }}" | base64 -d > /tmp/release.keystore
      - name: Export
        env:
          GODOT_ANDROID_KEYSTORE_RELEASE_PATH: /tmp/release.keystore
          GODOT_ANDROID_KEYSTORE_RELEASE_USER: ${{ secrets.RELEASE_KEYSTORE_USER }}
          GODOT_ANDROID_KEYSTORE_RELEASE_PASSWORD: ${{ secrets.RELEASE_KEYSTORE_PASSWORD }}
        run: |
          ~/godot/godot --headless --path . --import
          mkdir -p build && ~/godot/godot --headless --path . --export-release Android build/dungeoncrawler-${GITHUB_REF_NAME}.apk
      - uses: actions/upload-artifact@v4
        with: { name: apk, path: build/*.apk }
      - uses: softprops/action-gh-release@v2
        if: startsWith(github.ref, 'refs/tags/')
        with: { files: build/*.apk, generate_release_notes: true }
```

Store the keystore as a base64 secret; never commit it. If minutes ever run short, register James's PC as a self-hosted runner (free, unlimited) and reuse the same PowerShell script.

### 2.4 Sideloading onto a Galaxy S25 Ultra

Two Samsung-specific gates sit in front of the normal Android one:

1. **Auto Blocker** is on by default on Galaxy phones since One UI 6.1.1 and blocks unknown-source installs; turn it off at *Settings → Security and privacy → Auto Blocker* (biometric confirmation) ([TechRadar](https://www.techradar.com/phones/samsung-galaxy-phones/samsung-galaxy-phones-just-removed-one-of-androids-best-features-but-you-can-fix-it)).
2. **Install unknown apps** is a per-app permission: *Settings → Apps → (Chrome / My Files) → Install unknown apps*; then open the APK from the GitHub Release page.
3. For the agent, **USB debugging** is better: *About phone → Software information → tap Build number 7×*, *Developer options → USB debugging*, then `adb install -r -d build/dungeoncrawler.apk` installs or updates in one step; wireless debugging (`adb pair`/`adb connect`) removes the cable.

Forward-looking: Google's **Android developer verification** starts gating installs on certified devices in Brazil, Indonesia, Singapore and Thailand on 30 Sept 2026 and expands globally in 2027; unverified apps will need an "advanced flow" with a 24-hour lock, or ADB; a free hobbyist account (no ID, no fee, up to 20 devices) launched in Aug 2026 ([Android Authority timeline](https://www.androidauthority.com/android-sideloading-changes-timeline-3679204/), [Android Developers blog](https://android-developers.googleblog.com/2026/03/android-developer-verification-rolling-out-to-all-developers.html)). The hobbyist account or `adb` covers friends-and-family; register the package name under a verified account before 2027 regardless.

### 2.5 Signing and updates

Android only updates an app in place when the new APK is signed by the **same key** (otherwise uninstall first; "Could not install to device" is Godot's symptom). Generate `dc-release.keystore` once, back it up twice plus a GitHub secret, sign every build with it — including testers' builds — and bump `version/code` each release. Keep the debug keystore for the agent's own `adb` loop only; never hand a tester a debug-signed APK they will later need to update with a release-signed one.

### 2.6 What changes if the game goes to Google Play

- **AAB, not APK**: enable the Gradle build in the preset (1–3 minutes more per export, an `android/build` folder in the repo); Play App Signing signs with its own key and the keystore above becomes the upload key.
- **Target API level.** New apps and updates must target **API 35 by 31 Aug 2025** and **API 36 by 31 Aug 2026** (extension to 1 Nov 2026 on request) ([Play Console help](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en)). Godot 4.7's template already targets 36.
- **16 KB page size** (required since 1 Nov 2025 for Android 15+ targets) — covered by Godot ≥ 4.5.
- **Loot-box odds.** Play's Monetization policy requires apps "offering mechanisms to receive randomized virtual items from a purchase" to "clearly disclose the odds of receiving those items in advance of purchase" ([Fenwick summary](https://www.fenwick.com/insights/publications/google-play-now-requires-disclosure-of-loot-box-odds)). The wording is "a purchase", not "real money", so any chest opened with a currency that can itself be bought needs an odds table on the chest UI. The sister project's D-062 line ("chance and money never meet on anything that trades") is the cleaner design answer.
- Play Console account ($25 once), privacy-policy URL, Data Safety form, and the 12-tester / 14-day closed test for new personal accounts.

---

## 3. Multiplayer for 1–4 players

### 3.1 The model: deterministic simulation + host-authoritative commands

A turn-based game with a speed-driven timeline is the ideal case for the cheapest reliable co-op design on mobile:

- The **simulation is a pure function** `step(state, command, rng) → state'`, integer/fixed-point only, with a seeded PRNG (PCG32 or xoshiro, written in the sim, not borrowed from the engine). No floats, no `Node` access, no `Time`. Every client runs the same code and gets bit-identical state.
- A **host** (one of the four phones) owns the match. Clients send *intent* ("hero 2 casts Fireball at tile 7,3"); the host validates legality against its own state, assigns it a sequence number, and broadcasts the **command** `{seq, turn, actor, action}`. Everyone — including the host — applies commands only when received, in order. That is deterministic lockstep with a single serializer, which removes the classic lockstep stall (waiting on the slowest peer every tick) because a turn-based game only needs a command when someone acts.
- Messages are tiny (tens of bytes) and infrequent (one per action), so bandwidth is irrelevant, latency is hidden by UI, and a 3G connection works. A relay adds ~50 ms; nobody notices in a turn-based game.
- The dungeon is generated from the **match seed** (§6), so the host sends one integer instead of a level.
- Because the entire match is `seed + command log`, you get replays, desync detection (hash the state every N commands and compare; on mismatch the host's state wins and the client re-syncs), save-and-resume, and spectators for free.

Host-trust is the one weakness: a hacked host can cheat. In a friends-only co-op PvE game that is acceptable (§7.3 covers the upgrade path).

### 3.2 Transport and service options

**(a) Godot high-level multiplayer.** `MultiplayerAPI` + `@rpc` annotations over three built-in peers: `ENetMultiplayerPeer` (UDP, with IPv6), `WebSocketMultiplayerPeer`, and `WebRTCMultiplayerPeer`; `MultiplayerSpawner`/`MultiplayerSynchronizer` replicate nodes, though the command model above needs only RPCs. The docs are explicit that internet play over ENet "needs the server's UDP port forwarded on the router", and that Android exports must enable the `INTERNET` permission or "network communication of any kind will be blocked" ([high-level multiplayer](https://raw.githubusercontent.com/godotengine/godot-docs/master/tutorials/networking/high_level_multiplayer.rst)). WebRTC needs the `webrtc-native` GDExtension on non-web platforms (v1.2.2 for Godot 4.3+ ([releases](https://github.com/godotengine/webrtc-native/releases))) plus your own signaling server and STUN/TURN; it works on Android but it is the most DIY route ([WebRTC docs](https://raw.githubusercontent.com/godotengine/godot-docs/master/tutorials/networking/webrtc.rst)).

**(b) Nakama (Heroic Labs).** Open source (Apache 2.0), server in Go with Postgres, runs from one `docker compose up`. The **Godot 4 SDK is a GDScript addon** (autoload `Nakama.gd`) and includes a `NakamaMultiplayerBridge` that routes Godot's high-level multiplayer RPCs over a Nakama realtime match — so the Phase B ENet code is reused unchanged. Matches are **relayed** (server forwards messages, no simulation; "suited to co-op games, prototypes, and trusted-client games") or **authoritative** (a match handler in Go, TypeScript or Lua ticking at 1–60 Hz) ([Heroic Labs Godot guide](https://heroiclabs.com/blog/godot-multiplayer-backend/)). It also gives auth (device ID, email, Google), storage for cloud saves, leaderboards, friends and chat. Heroic Cloud's managed plans do not meter CCU, but support plans start at **$2,000/month** ([Crux pricing summary](https://crux.supercraft.host/blog/nakama-open-source-vs-managed-backend/)) — irrelevant for this project; **self-host** on a $5–10/month VPS (Hetzner CX22 / DigitalOcean basic) with Docker Compose (nakama + postgres + Caddy for TLS). Cost of running it: one VPS, one domain, backups.

**(c) Unity stack / Photon.** Unity Relay: first 50 average CCU and 3 GiB/CCU free, then $0.16/CCU; Lobby 10 GiB/month free; Cloud Save 5 GiB free ([UGS pricing](https://unity.com/products/gaming-services/pricing)) — Unity-only, moot here. **Photon Fusion** ships as a **Godot GDExtension** (GDScript primary, C# via .NET) with shared-authority and client-server modes, documented against Godot 4.6 ([Fusion for Godot](https://doc.photonengine.com/fusion-godot/v3-client-server/fusion-intro)); a 20 CCU dev-only free tier, and a **100 CCU free tier allowing commercial use for one Fusion/Quantum app**, 3 GB traffic per CCU/month ([Photon pricing](https://doc.photonengine.com/photon/current/pricing)). **Quantum** (deterministic) is Unity-only. Fusion-on-Godot caveats: closed SDK, tick-based netcode heavier than needed, and a version lag behind Godot stable (4.6 vs 4.7.2).

**(d) Other services.** **Epic Online Services**: free lobbies and NAT-punched P2P with Epic relays as fallback, no Epic account needed for players (Device-ID auth); the community **EOSG** GDExtension v2.3.1 (15 Sep 2026, MIT) lists **Android** among its platforms and "Lobby, Sessions and Multiplayer" ([EOSG](https://store.godotengine.org/asset/delano-lourenco/epic-online-services-godot-eosg/)). Free at any scale; the price is a one-time Epic developer-portal setup (GUI, account, product/sandbox/deployment IDs). **PlayFab** cut its free tier from 100,000 to **1,000 MAU** on 11 Mar 2026 ([AccelByte analysis](https://accelbyte.io/blog/playfab-just-cut-its-free-tier-by-99.-heres-what-that-means-for-your-game)) — skip. **Colyseus** is open source (self-host free; Cloud from $15/month ([pricing](https://www.colyseus.io/pricing))) but its rooms are TypeScript, so the sim would need porting. **Hathora** hosts dedicated servers per vCPU-hour; relevant only once there is a server binary (§7.3).

**(e) Local play.** Same-Wi-Fi play is ENet on the LAN: the host listens on a port, clients discover it by UDP broadcast (`PacketPeerUDP.set_broadcast_enabled(true)`), and connect by `192.168.x.x`. Google's **Nearby Connections** (Wi-Fi Direct/Bluetooth) has no Godot plugin and would need a custom Kotlin Android plugin — not worth it while shared Wi-Fi or a phone hotspot works.

### 3.3 Host disconnect, reconnect, invite codes

- **Reconnect.** Each player holds a `player_token` (random 128-bit, stored in `user://`). On reconnect the client sends the token and its last applied `seq`; the host (or relay match) replies with all commands after that `seq`, and the deterministic sim catches up. For long gaps, the host sends a state snapshot + hash instead. Nakama keeps the match alive and marks the presence as left; a 90-second grace window before the party is told "X dropped" is a reasonable default.
- **Host disconnect.** Everyone already has `seed + full command log`, so **host migration is cheap**: the lowest remaining peer id becomes host, re-registers the match (same invite code, new match id in the relay), and the others rejoin and resume from their logs. The old host rejoins as a client. Pending-but-unsequenced intents are simply re-sent.
- **Invite codes.** A six-character Crockford-base32 code (`K7X-4QD`) maps to the match: in Nakama the host calls an RPC `create_party` that stores `{code → match_id}` in server storage with a TTL; joiners call `join_party(code)`. On LAN the code is unnecessary (broadcast discovery), on EOS it is the lobby's join code. Codes should be short enough to read out loud over a call.

### 3.4 Recommended path

- **Phase A — offline solo.** The sim, the command log, and a `LocalTransport` that just loops commands back. All four party members are controlled from one phone. Build the replay/desync-hash tooling here, because it is also the test harness.
- **Phase B — LAN.** Swap in `ENetMultiplayerPeer` behind the same transport interface; UDP broadcast discovery; host-authoritative commands over `@rpc("any_peer", "reliable")` for intents and `@rpc("authority", "call_local", "reliable")` for sequenced commands. Enable the `INTERNET` permission. This is where host migration and reconnect get tested with two phones and airplane mode.
- **Phase C — internet.** **Nakama, self-hosted in Docker on a small VPS**, relayed matches through `NakamaMultiplayerBridge`, device-ID auth, invite-code RPC, and Nakama storage for cloud saves. The agent can run the same Docker Compose locally on Windows for integration tests. If James would rather run nothing: **EOS P2P via EOSG** is the zero-cost alternative (one portal setup), and **Photon Fusion for Godot** the paid-later alternative. Only if cheating becomes a problem does the sim move server-side — as a headless Godot instance (same GDScript, `--headless`, ENet) on the same VPS, or as a Nakama authoritative match handler if the sim is ported to TypeScript.

---

## 4. The Samsung Galaxy S25 Ultra as a target

**Hardware** ([GSMArena](https://www.gsmarena.com/samsung_galaxy_s25_ultra-13322.php), [Android Authority](https://www.androidauthority.com/snapdragon-8-elite-for-galaxy-benchmarks-3520872/)): Snapdragon 8 Elite for Galaxy (SM8750-AC, 3 nm) — 2× Oryon V2 Phoenix L at 4.47 GHz + 6× at 3.53 GHz; **Adreno 830 at 1,200 MHz**; 12 GB RAM (16 GB in the 1 TB SKU); UFS 4.0; **6.9" 1440×3120 LTPO AMOLED at 1–120 Hz**, 2,600 nits peak; 5,000 mAh; shipped on Android 15 and is on One UI 9 / Android 17 as of Oct 2026. 3DMark Wild Life Extreme ≈ 6,687, Geekbench 6 multi ≈ 9,846. The Adreno 830 driver exposes Vulkan 1.3; Google's VPA16 profile for new Android 16 chipsets is "largely a subset" of Vulkan 1.4 and full 1.4 is mandatory for Android 17 chipsets ([Android Authority on Vulkan as the official API](https://www.androidauthority.com/porting-pc-games-to-android-3534575)). Godot's Mobile renderer needs only Vulkan 1.0.

**Thermals are the real constraint.** In the 20-minute Wild Life Extreme stress test the S25 Ultra starts near 6,200 and levels off near **3,000 — roughly half** — within 3–4 minutes, worse than the OnePlus 13 on the same chip (≈4,500 sustained); Android Authority measured a ~20 % drop after a single one-minute loop ([PhoneArena](https://www.phonearena.com/news/galaxy-s25-ultra-cooling-vapor-chamber-tested_id166991)). Translation: design for the **sustained** GPU budget (≈45–50 % of peak), not the launch benchmark, or the game will look great for three minutes and stutter for the next thirty.

**Recommended targets (budget, tuning starting points):**

- **Frame rate: 60, not 120.** Set `application/run/max_fps = 60` (the LTPO panel drops its refresh to match; Godot has no API to force it). A turn-based game gains nothing from 120 and would halve its thermal headroom. Offer a 30-fps "battery" mode for long sessions.
- **Render resolution: 0.6–0.75 of native.** `rendering/scaling_3d/scale = 0.67` renders ~965×2090 and cuts fill-rate by ~55 % with an automatic mipmap bias; UI stays at native. The 498-ppi panel hides it.
- **Per-character:** 8–15 k triangles for a hero *with* gear, 3–8 k for enemies; 40–70 deform bones; 4 bone influences per vertex (the exporter default — 8 "may display incorrectly in many viewers"); animation baked at 30 fps.
- **On screen:** ≤ 8 skinned characters, ≤ 150 k skinned triangles, ≤ 400 k triangles total, **100–250 draw calls** (there is no automatic instancing in the Mobile renderer — batch with `MultiMesh`), ≤ 6 transparent/particle materials visible.
- **Textures:** 1024² ASTC 6×6 atlases per character (2048² at most for the player's hero), 2048² for a room tileset, ETC2 fallback on; mipmaps everywhere; total VRAM ≤ 600 MB.
- **Lights/shadows:** baked `LightmapGI` for static room geometry, **1 directional (optional) + ≤ 4 shadow-casting omni/spot lights visible** (8 per mesh is the hard cap), shadow atlas 2048 with 16-bit depth, `shadow_filter_quality` soft-low, no SSAO (unsupported on Mobile anyway), MSAA 2× or none, FXAA off.
- **Memory:** keep resident set under 1.5 GB; Android kills background apps aggressively and the relay reconnect path (§3.3) should assume it.

---

## 5. Blender → engine character pipeline

**Blender version.** 5.2 LTS (14 Jul 2026, supported to July 2028) is current and is what the sister project already drives ([Blender 5.2](https://www.blender.org/releases/5-2/)). Relevant 5.x changes for scripted builds: **slotted actions** (since 4.4) and the **removal of the legacy action API in 5.0** (`action.fcurves`, `action.groups`, `id_root` — scripts must use channelbags per slot and must assign a slot when assigning an action), the FBX C++ importer, Python 3.13 in 5.1 (user site-packages no longer auto-loaded), and `EXT_meshopt_compression` in the 5.2 glTF exporter ([Cinevva's Blender 5 guide](https://app.cinevva.com/guides/blender-5-for-game-artists)).

**glTF exporter notes.** Animation modes: **Actions** (default — exports an action if it is the object's active action *or stashed in an NLA track*; unassociated actions are skipped), Active Actions Merged, NLA Tracks (one glTF animation per track), Scene. Only Actions/Active-merged handle non-sampled curves; everything else is sampled at `Sampling Rate`. "Export all Armature Actions" exports every action bound to one armature but "does not support exports with multiple armatures"; "Reset pose bones between actions" matters when clips don't key every bone. Skinning: "Export Deformation Bones only" (drops control/IK bones and bakes), "Flatten Bone Hierarchy", "Bone Influences" 4 ([Blender manual, glTF](https://docs.blender.org/manual/en/latest/addons/import_export/scene_gltf2.html)). The Python call the build scripts already use:

```python
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_apply=True,
    use_selection=True, export_yup=True, export_skins=True, export_def_bones=True,
    export_animations=True, export_animation_mode='ACTIONS', export_frame_range=False,
    export_optimize_animation_size=True, export_morph=True, export_morph_normal=False,
    export_image_format='AUTO', export_texcoords=True, export_normals=True)
```

**"Shared rig with multiple meshes".** Export the rig **once** as `rig_base.glb` (armature + the naked body mesh + all 13+ clips stashed on NLA tracks), and each gear piece or species variant as its own `.glb` that contains the *same armature object* (same bone names and rests) plus only that mesh. In Godot, import `rig_base.glb` with the Retarget → Humanoid options and an Animation Library; import the gear `.glb`s with "Remove Tracks: all" and no animations, and at runtime re-parent their `MeshInstance3D` under the character's `Skeleton3D` (`mesh_instance.skeleton = skeleton.get_path()`; the skin's inverse bind matrices line up because the rests are identical). This is exactly the sister project's rig and is why the shared-rig decision (D-065–D-067 there) carries across.

**Modular equipment visible on the character.**
- **Skinned gear** (chest, legs, gloves, boots, robes): separate meshes weighted to the shared skeleton, swapped by adding/removing `MeshInstance3D` children. Hide body polygons under armour with per-slot body-mask meshes (body split into segments) or a vertex-colour cutout in the body shader.
- **Rigid props** (weapons, helmets, shields, back items): `BoneAttachment3D` on `hand.R`, `head`, `spine.03`; a static mesh with a socket offset. Cheaper than skinning and ideal for the 11-slot loadout.
- Keep the budget: 11 slots × separate draw calls per character is fine for ≤ 8 characters; if it ever hurts, merge visible slots into one `ArrayMesh` surface list at equip time (`SurfaceTool.append_from`).

**Species / body variants.** Three tools, in order of cost: (1) **shape keys** on the shared body topology for proportions (broad, lean, aged) — exported as glTF morph targets and driven by `MeshInstance3D.set_blend_shape_value`; cheap, but gear meshes need the same keys or they clip; (2) **bone scaling** via `Skeleton3D.set_bone_pose_scale` (or `SkeletonModifier3D`) for height/limb length — affects gear automatically and animations still retarget, but non-uniform scale breaks at joints, so limit to ±15 %; (3) **separate meshes** for genuinely different silhouettes (a four-armed or quadruped species) on a *variant* rig that still maps to the humanoid profile where possible — the only one that costs an artist. Start with (1)+(2).

**Tinting.** Use one `ShaderMaterial` per family with a tint mask texture (R = primary, G = secondary, B = metal) and `instance_shader_parameters` (per-instance uniforms, no material duplication): `mesh_instance.set_instance_shader_parameter("tint_primary", color)`. Element glows are an emissive channel multiplied by the same scheme.

**Retargeting in the engine.** Covered in §1.2: `SkeletonProfileHumanoid` + `BoneMap`, Overwrite Axis, Normalize Position Tracks. Share one `AnimationLibrary` across every character; per-species overrides go in a second library layered in the `AnimationTree`.

**Driving Blender headless from Windows.**

```powershell
$blender = "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe"
& $blender -b -P prototype/blender/hero/build_hero.py -- --out prototype/blender/hero/export/hero.glb --render prototype/blender/hero/renders
```

Inside the script, `bpy.context.scene.render.engine = 'BLENDER_EEVEE'` (works in background mode on Windows with a GPU; `BLENDER_WORKBENCH` for sub-second silhouette checks), set `filepath` and call `bpy.ops.render.render(write_still=True)` for a turntable of 4 PNGs plus one frame per animation clip at its midpoint — then the agent **reads the PNGs** before calling the build done (the rule the sister project already follows). Argument parsing: everything after `--` is in `sys.argv[sys.argv.index('--')+1:]`.

**Starting points and their licences.** **Mixamo**: free auto-rigging and ~2,000 clips, unlimited commercial use, no attribution, but no redistribution of the raw files ([Adobe Mixamo FAQ](https://community.adobe.com/questions-696/mixamo-faq-licensing-royalties-ownership-eula-and-tos-589400)); its rig retargets cleanly to the humanoid profile. **Rigify** (bundled) or **Auto-Rig Pro** (paid) for in-Blender rigs — but the sister project's scripted rig exists, so reuse it. **Generative 3D**: Meshy's free tier (100 credits/month) licenses output **CC BY 4.0**, paid plans give a private licence, rigging costs 0 credits ([Meshy pricing](https://docs.meshy.ai/en/webapp/pricing)); Tripo's free plan is likewise CC BY 4.0, Pro (~$14/month) removes attribution ([Tripo](https://www.tripo3d.ai/blog/commercial-use-ai-3d-models)). Treat both as *block-out and reference only* (the sister project's D-066): the topology does not fit the shared rig, AI output has doubtful copyright protection, and attribution clauses are a nuisance in a shipped game.

---

## 6. Procedural dungeon generation for a 3D room-graph dungeon on mobile

**Approach: room templates + a layout graph.** Author rooms as `PackedScene` templates (Blender kit pieces → `.glb` → one `.tscn` per room type with door sockets as `Marker3D` children). Generate a **mission graph** first (start → fights → key → locked door → boss; a small **graph grammar** with rewrite rules gives variety and guaranteed solvability), then **lay it out**. Edgar's algorithm — a template per graph node, rooms placed chain by chain with simulated annealing so doors meet and rooms don't overlap — is MIT-licensed .NET with a Godot port (`Edgar.Godot`) and is recommended for layouts under ~30 rooms ([Edgar](https://github.com/ondrejnepozitek/edgar-dotnet)). For an 8–15-room session a simpler step suffices: greedy DFS over the graph on a coarse 3D grid, trying template/door rotations and backtracking on collision — deterministic, fast on a phone, a day's work in GDScript. **BSP** is fast but makes door alignment with hand-made templates awkward; **Wave Function Collapse** is the right tool for *decorating* rooms (wall/floor/prop variation inside a template), not for the macro layout.

**Seeded determinism across four clients.** The host chooses a 64-bit `seed`; the generator uses only the sim's integer PRNG, iterates dictionaries in sorted order, never touches `randi()`/`Time`, and keeps positions as integer grid cells (floats only when instantiating scenes). Hash the room graph and compare across clients at match start; on mismatch the host sends its graph verbatim (a few KB).

**Navigation.** Turn-based movement should path on the room's tile grid with A* (`AStarGrid2D` per room, stitched across doors) inside the sim — deterministic and cheap. Use `NavigationServer3D` (one `NavigationRegion3D` per template, baked in the editor via an `EditorScript`, merged at runtime by edge margin) only for the camera and cosmetic followers.

**Culling.** Frustum culling is automatic. Enable **occlusion culling** with an `OccluderInstance3D` per room (Godot's occlusion is a CPU software rasteriser and works on Android), and simply set rooms more than one door away to `visible = false` — the cheapest culling there is in a dungeon. **Visibility ranges** for props, `VisibleOnScreenEnabler3D` to pause off-screen animation ([3D optimisation](https://raw.githubusercontent.com/godotengine/godot-docs/4.7/tutorials/performance/optimizing_3d_performance.rst)).

**Instancing.** The Mobile renderer has no automatic instancing, so torches, chains, rubble and repeated wall modules go in a `MultiMeshInstance3D` per room (one draw call each). Characters and unique props stay `MeshInstance3D`.

**Lighting for torch-lit dungeons.** Bake `LightmapGI` per room template in the editor (static geometry, lights *Static*), then add 1–2 *Dynamic* shadow-casting `OmniLight3D` torches near the party, flickered in script, with emissive torch heads and a sprite flame. `Environment` depth fog (supported on Mobile; volumetric is not) and a low ambient give the darkness; no SSAO (unsupported), no SDFGI/VoxelGI, reflection probes only in the hub. That keeps the per-mesh light count far under the cap of 8.

---

## 7. Data and persistence

**Content as JSON validated by JSON Schema.** Keep the sister project's pattern: `content/` JSON against `content/schemas/*.schema.json`, validated by a Node linter (`ajv`) in `npm run lint` and CI — not at runtime. Godot loads it with `JSON.parse_string` into typed `RefCounted` records and refuses to start on a `schema_version` mismatch. Put *engine* data (scenes, materials) in text `.tres`/`.tscn` and *game* data (abilities, enemies, loot tables, dungeon grammars) in JSON so a non-Godot server can read it too.

**Save files.** `user://` is the only writable, persistent location; on Android it is the app's private internal storage, "unique to the project and not accessible by other applications" ([data paths](https://raw.githubusercontent.com/godotengine/godot-docs/4.7/tutorials/io/data_paths.rst)); on Windows `%APPDATA%\Godot\app_userdata\<project>`, where the agent reads saves during tests. Write JSON via `FileAccess` to `.tmp` then rename (atomic), one file per slot plus `profile.json`, each carrying `save_version`, `content_version`, `app_version` and a CRC. **Versioning**: a chain of pure migrations `v1→v2→…` applied on load, each tested against a fixture from the previous version. Because a match is `seed + command log` (§3.1), a mid-dungeon save is tiny and replayable — store it that way; snapshot only the persistent profile.

**Cloud save later.** Nakama storage (per-user collections, versioned writes for optimistic concurrency) is already in the Phase C stack and works on sideloaded builds; Google Play Games Saved Games is the Play-only alternative. Local file stays authoritative, sync in the background, resolve conflicts by `updated_at` plus a one-time prompt.

**Cheating in co-op.** Under host-trust a modified phone can forge commands and loot. Cheap mitigations: validate every intent on the host against `legal_actions(state)`; hash state periodically and kick on desync; derive loot from seed + command log so it can be audited; sign saves with a per-install key. Server-authoritative play means running the sim on a machine you control — a headless Godot instance (same GDScript) behind the Nakama relay, or a Nakama match handler if the sim is ported to TypeScript — and is only worth it if the game ever has persistent, tradeable or competitive stakes.

---

## 8. Testing and verification an AI agent can run

Each of these is one command with an exit code, and each produces a text or PNG artefact the agent can read.

1. **Syntax and static checks.** `godot --headless --path . --check-only -s res://src/sim/sim.gd` per file, or `godot --headless --path . --import --quit`, which parses every script and fails on errors; `gdlint`/`gdformat` (`pip install gdtoolkit`) for style.
2. **Headless sim tests.** gdUnit4's CLI runner (`godot --headless --path . -s res://addons/gdUnit4/bin/GdUnitCmdTool.gd --add res://test/sim --ignoreHeadlessMode`) emits JUnit XML; or a dependency-free `SceneTree` script that asserts and `quit(1)` on failure. Determinism test: replay the same seed + command log twice and compare state hashes — on Windows and on the phone (a debug menu prints the hash to logcat).
3. **Balance batch runs.** The same runner over N seeds × party compositions with scripted policies, writing `tools/balance/out/*.json` and a dated markdown report — the sister project's `npm run balance`, reimplemented in GDScript so there is one sim.
4. **Scene-load smoke test.** Instantiate every `.tscn` under `res://scenes`, wait two frames, fail on any error output; run windowed with `--quit-after 3` so rendering initialises.
5. **Screenshots on Windows.** `godot --path . --resolution 1080x2400 --write-movie shots/<test>.png --fixed-fps 30 --quit-after 60 res://test/screens/<test>.tscn` for frame-exact captures, or `get_image().save_png()` inside a test scene for named ones (dungeon overview, combat UI, each character in each gear set). The agent reads the PNGs; a pixel-diff against a blessed set catches regressions.
6. **Real device via adb** (skip the emulator: its Vulkan path is unreliable for the Mobile renderer and says nothing about Adreno thermals): `adb install -r -d build/dc.apk`; `adb shell am start -n com.<org>.dungeoncrawler/com.godot.game.GodotApp`; `adb logcat -s godot:V GodotApp:V` (`print`, `push_error` and asserts all land under the `godot` tag); `adb exec-out screencap -p > shots/device.png`; `adb shell dumpsys gfxinfo <pkg>` for frame-time histograms; `cat /sys/class/thermal/thermal_zone*/temp` during a 30-minute soak driven by an autoplay flag (set in the export preset's `command_line/extra_args`, read with `OS.get_cmdline_user_args()`).
7. **Profiling.** Godot's profiler attaches over USB (`adb reverse tcp:6007 tcp:6007`, debug export with `--remote-debug`); in debug builds dump `Performance.get_monitor()` values (draw calls, primitives, video memory, process time) to logcat every second so the agent can parse them. Godot 4.7 made **Perfetto** the default Android tracer; Snapdragon Profiler and Android GPU Inspector give per-draw GPU timing.
8. **CI.** The workflow in §2.3 plus a `test` job running steps 1–4 on every push; the device loop stays on the Windows machine.

---

## 9. Recommendations for Dungeon Crawler

| Decision | Choice | One-line reason |
|---|---|---|
| **Engine + language** | Godot 4.7.2 stable, GDScript | Zero-account `winget` install, text project files, one-command import/test/export/screenshot; C# on Android is still flagged experimental |
| **Renderer** | Mobile (Vulkan), Compatibility fallback on | Default for Android, tile-GPU optimised with Google/The Forge; Forward+ is "poorly optimized" on mobile |
| **Sim architecture** | Pure, integer, seeded, engine-free `src/sim/` with `legal_actions / step / replay` | Makes co-op a command log, tests headless, replays free, and keeps a server port open |
| **Networking Phase A** | Offline, `LocalTransport` loopback | Ship the whole game on one phone first |
| **Networking Phase B** | ENet over LAN with UDP broadcast discovery, host-authoritative commands | Built-in, no servers, tests host migration and reconnect with two phones |
| **Networking Phase C** | Self-hosted Nakama (Docker, $5–10/mo VPS), relayed matches via `NakamaMultiplayerBridge`, device auth, invite-code RPC | Reuses the Phase B RPC code unchanged, open source, runs locally for tests; EOS P2P (EOSG) is the no-server fallback, Photon Fusion the paid one |
| **Build** | `godot --headless --export-release Android` from PowerShell; APK, arm64-v8a only, minSdk 24 / target 36 | One command, prebuilt template, no Gradle until Play |
| **CI** | GitHub Actions on `ubuntu-24.04`, keystore as base64 secret, APK attached to Release on `v*` tags | Linux minutes are cheapest; ~100 builds/month inside the free 2,000 minutes |
| **Distribution** | GitHub Releases + `adb install` for the agent; Auto Blocker off + "Install unknown apps" for friends; register a hobbyist/verified developer account before 2027 | Sideloading rules tighten in 2027 |
| **Play later** | Flip Gradle build on → AAB; already targets API 36 and 16 KB pages; show chest odds | Only the export format changes |
| **Frame/res targets** | 60 fps cap, `scaling_3d_scale` 0.67, 30-fps battery mode | S25 Ultra sustains ~50 % of peak GPU; design for sustained |
| **Asset budgets** | Hero ≤ 15 k tris with gear, enemies 3–8 k, ≤ 70 bones, 4 weights, 1024² ASTC atlases, ≤ 250 draw calls, ≤ 4 shadowed lights, lightmaps for rooms | Fits the Mobile renderer's 8-light cap and the thermal budget |
| **Character pipeline** | Blender 5.2 LTS scripted builds → `.glb` (Actions mode, def bones only, 4 influences) → Godot humanoid retarget + shared `AnimationLibrary`; skinned gear shares the skeleton, rigid gear on `BoneAttachment3D`; species via shape keys + bone scale; tint via instance shader params | Same rig and scripts as the sister project; every slot visible on the body |
| **Dungeon generation** | Mission graph (grammar) → grid layout of room templates (Edgar-style, ≤ 15 rooms) → WFC for decoration; seeded by the host; A* on tiles for the sim, navmesh for cosmetics; occluders + per-room visibility + MultiMesh | Deterministic, small, mobile-friendly |
| **Data** | JSON + JSON Schema linted in CI; saves as versioned JSON in `user://` with migrations; cloud save via Nakama storage later | Text, testable, server-readable |
| **Verification** | gdUnit4/SceneTree tests headless, balance batch, scene smoke test, `--write-movie` screenshots, `adb` install/logcat/screencap/gfxinfo soak runs | Every step is a CLI command with an artefact the agent can read |

---

## Sources

- Godot download archive (4.7.2 stable 18 Aug 2026; 4.8 beta 1 15 Oct 2026): https://godotengine.org/download/archive/
- Godot 4.7 release page: https://godotengine.org/releases/4.7/
- Godot 4.7.2 maintenance release: https://godotengine.org/article/maintenance-release-godot-4-7-2/
- Godot 4.6.2 maintenance release: https://godotengine.org/article/maintenance-release-godot-4-6-2/
- Godot Windows download / requirements: https://godotengine.org/download/windows/
- Godot docs — Exporting for Android (master): https://raw.githubusercontent.com/godotengine/godot-docs/master/tutorials/export/exporting_for_android.rst
- Godot docs — Gradle builds for Android (4.7): https://raw.githubusercontent.com/godotengine/godot-docs/4.7/tutorials/export/android_gradle_build.rst
- Godot docs — Command line tutorial: https://raw.githubusercontent.com/godotengine/godot-docs/master/tutorials/editor/command_line_tutorial.rst
- Godot docs — C# (4.7): https://raw.githubusercontent.com/godotengine/godot-docs/4.7/tutorials/scripting/c_sharp/index.rst
- Godot — Platform state in C# for 4.2: https://godotengine.org/article/platform-state-in-csharp-for-godot-4-2/
- Godot docs — Renderers: https://raw.githubusercontent.com/godotengine/godot-docs/master/tutorials/rendering/renderers.rst
- Godot docs — Resolution scaling (4.7): https://raw.githubusercontent.com/godotengine/godot-docs/4.7/tutorials/3d/resolution_scaling.rst
- Godot docs — Retargeting 3D skeletons: https://raw.githubusercontent.com/godotengine/godot-docs/master/tutorials/assets_pipeline/retargeting_3d_skeletons.rst
- Godot docs — Import configuration (glTF): https://raw.githubusercontent.com/godotengine/godot-docs/master/tutorials/assets_pipeline/importing_3d_scenes/import_configuration.rst
- Godot docs — Optimizing 3D performance (4.7): https://raw.githubusercontent.com/godotengine/godot-docs/4.7/tutorials/performance/optimizing_3d_performance.rst
- Godot docs — High-level multiplayer: https://raw.githubusercontent.com/godotengine/godot-docs/master/tutorials/networking/high_level_multiplayer.rst
- Godot docs — WebRTC: https://raw.githubusercontent.com/godotengine/godot-docs/master/tutorials/networking/webrtc.rst
- Godot docs — File paths / user:// (4.7): https://raw.githubusercontent.com/godotengine/godot-docs/4.7/tutorials/io/data_paths.rst
- Godot forum — screenshot in 4.3+: https://forum.godotengine.org/t/screenshot-procedure-changed-broken-in-4-3/52570
- Godot forum — target SDK 36 / config.gradle: https://forum.godotengine.org/t/how-to-target-latest-android-sdk/142631
- Godot forum — 16 KB page size support: https://forum.godotengine.org/t/godot-and-google-play-policy-warning-about-16-kb-memory-page-size/120934
- webrtc-native releases: https://github.com/godotengine/webrtc-native/releases
- gdUnit4 on the Godot Asset Store: https://store.godotengine.org/asset/mikeschulze/gdunit4-unit-testing-framework/
- Android Developers — Godot Vulkan optimisation case study: https://developer.android.com/stories/games/godot-vulkan
- Unity 6 releases & support: https://unity.com/releases/unity-6/support
- endoflife.date — Unity versions: https://endoflife.date/unity
- Unity 6.5 announcement: https://discussions.unity.com/t/unity-6-5-is-now-available/1723176
- Unity editor command-line arguments (6.3): https://docs.unity3d.com/6000.3/Documentation/Manual/EditorCommandLineArguments.html
- Unity Android supported dependency versions (6.3): https://docs.unity3d.com/6000.3/Documentation/Manual/android-supported-dependency-versions.html
- Unity Android requirements and compatibility (6.3): https://docs.unity3d.com/6000.3/Documentation/Manual/android-requirements-and-compatibility.html
- Unity CLI: https://docs.unity.com/en-us/unity-cli/use-unity-cli.md
- Unity Hub CLI (deprecated): https://docs.unity.com/en-us/hub/use-hub-cli.md and https://docs.unity.com/en-us/hub/hub-cli.md
- Unity Gaming Services pricing (Relay, Lobby, Cloud Save): https://unity.com/products/gaming-services/pricing
- Photon pricing & CCU plans: https://doc.photonengine.com/photon/current/pricing
- Photon Fusion for Godot: https://doc.photonengine.com/fusion-godot/v3-client-server/fusion-intro
- Heroic Labs — Godot multiplayer backend (Nakama): https://heroiclabs.com/blog/godot-multiplayer-backend/
- Nakama pricing overview (Crux): https://crux.supercraft.host/blog/nakama-open-source-vs-managed-backend/
- Epic Online Services Godot (EOSG): https://store.godotengine.org/asset/delano-lourenco/epic-online-services-godot-eosg/
- PlayFab free-tier cut (AccelByte): https://accelbyte.io/blog/playfab-just-cut-its-free-tier-by-99.-heres-what-that-means-for-your-game
- Colyseus pricing: https://www.colyseus.io/pricing
- Defold — Bob the builder: https://defold.com/manuals/bob
- Bevy 0.18 on docs.rs: https://docs.rs/bevy/0.18.1
- Google Play — target API level requirements: https://support.google.com/googleplay/android-developer/answer/11926878?hl=en
- Google Play loot-box odds policy (Fenwick): https://www.fenwick.com/insights/publications/google-play-now-requires-disclosure-of-loot-box-odds
- Android developer verification timeline (Android Authority): https://www.androidauthority.com/android-sideloading-changes-timeline-3679204/
- Android Developers blog — developer verification rollout: https://android-developers.googleblog.com/2026/03/android-developer-verification-rolling-out-to-all-developers.html
- Samsung Auto Blocker (TechRadar): https://www.techradar.com/phones/samsung-galaxy-phones/samsung-galaxy-phones-just-removed-one-of-androids-best-features-but-you-can-fix-it
- GitHub Actions billing: https://docs.github.com/en/billing/concepts/product-billing/github-actions
- Galaxy S25 Ultra specs (GSMArena): https://www.gsmarena.com/samsung_galaxy_s25_ultra-13322.php
- Snapdragon 8 Elite for Galaxy benchmarks (Android Authority): https://www.androidauthority.com/snapdragon-8-elite-for-galaxy-benchmarks-3520872/
- S25 Ultra thermal stress test (PhoneArena): https://www.phonearena.com/news/galaxy-s25-ultra-cooling-vapor-chamber-tested_id166991
- Vulkan as Android's official graphics API / VPA16 (Android Authority): https://www.androidauthority.com/porting-pc-games-to-android-3534575
- Blender 5.2 LTS release notes: https://www.blender.org/releases/5-2/
- Blender manual — glTF 2.0 import/export: https://docs.blender.org/manual/en/latest/addons/import_export/scene_gltf2.html
- Blender 5 for game artists (Cinevva): https://app.cinevva.com/guides/blender-5-for-game-artists
- Mixamo licensing FAQ (Adobe community): https://community.adobe.com/questions-696/mixamo-faq-licensing-royalties-ownership-eula-and-tos-589400
- Meshy pricing & licence: https://docs.meshy.ai/en/webapp/pricing
- Tripo — commercial use of AI 3D models: https://www.tripo3d.ai/blog/commercial-use-ai-3d-models
- Edgar (graph-based level generator): https://github.com/ondrejnepozitek/edgar-dotnet

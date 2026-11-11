# Details

## Start a new app

```sh
npx create-expo-app@latest my-gemma-app --template expo-template-litert-gemma
```

This takes the template from npm. `--template` also takes this repository's URL
(`https://github.com/john-rocky/expo-template-litert-gemma`).

Then make a release build and install it on a phone connected over USB:

```sh
cd my-gemma-app
npx expo run:android --variant release      # Android
npx expo run:ios --configuration Release --device   # iPhone: first set your App ID, see below
```

- With more than one Android device connected, add `--device <serial>` (from `adb devices`); without it the command
  installs on the first device in that list.
- The command also starts the Metro dev server and keeps running after the app opens. A release build carries its
  JavaScript and does not use Metro: stop it with Ctrl-C, or add `--no-bundler`.

In the app, tap **Download** (once: 2.0 or 2.6 GB depending on the phone, best on Wi-Fi), then a suggested prompt or
your own message.

## What the app does

- **Download** with progress. The file is checked against its SHA-256 before it is kept, and a download that stopped
  partway (no connection, the app closed) continues where it stopped the next time you tap Download or Retry. The
  file stays on the phone; later launches load it directly.
- **Load** the model on the backend chosen for the phone, then **stream** each reply as it is generated. Replies are
  Markdown (headings, bold, lists); [markdown-to-jsx](https://github.com/quantizor/markdown-to-jsx) draws them with
  React Native views.
- **Reset** clears the conversation (the context holds 2,048 tokens: prompts and replies).
- When a step fails, the screen says what happened and what to do next:
  - the download fails (no connection, not enough storage, a server error): **Retry**;
  - the downloaded file does not match its SHA-256: the file is deleted, and **Retry** downloads it again;
  - the library refuses to load because the phone lacks free memory (`MEMORY_ESTIMATE_EXCEEDED`): close other apps
    and **Retry**, or **Load on the CPU** when the file can run there;
  - the GPU cannot load the model: the app switches to the CPU, or offers to download the CPU version of the file
    (the library also tries the CPU on its own before reporting a failure).

## Which model file each phone gets

[`src/gemma/forms.ts`](../src/gemma/forms.ts) holds the table; each row has its measurement in a comment. All rows load
text only, with a 2,048-token context, greedy decoding and thinking off, from
[`litert-community/gemma-4-E2B-it-litert-lm`](https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm)
pinned to one commit.

| Phone | File | Backend | Decode speed measured (short chat) |
| --- | --- | --- | --- |
| Pixel 8a (Tensor G3) | `gemma-4-E2B-it-gpu.litertlm`, 2.0 GB | GPU | 21 tokens/s |
| Galaxy S26 (Snapdragon SM8850) | `gemma-4-E2B-it.litertlm`, 2.6 GB | GPU, speculative decoding | 64 tokens/s |
| iPhone 18 Pro | `gemma-4-E2B-it-gpu.litertlm`, 2.0 GB | GPU | 93 tokens/s |
| Other phones with a GPU driver | `gemma-4-E2B-it-gpu.litertlm`, 2.0 GB | GPU | not measured |
| Phones without a GPU driver | `gemma-4-E2B-it.litertlm`, 2.6 GB | CPU | not measured |

The table's speeds were measured on 2026-10-20 with a benchmark app on react-native-litert-lm 0.8.1 (LiteRT-LM
0.18.0), with the load settings above. Release builds of this template (versions 0.1.1 to 0.1.5) on the same phones
decoded replies of about 200 to 590 tokens at 18 (Pixel 8a), 60–67 (Galaxy S26) and 90–92 (iPhone 18 Pro)
tokens/s. Version 0.1.6 uses react-native-litert-lm 0.8.2 (LiteRT-LM 0.18.1); the table was not measured again.

Android rows match the phone's SoC (`getDeviceInfo().socModel`, Android's `Build.SOC_MODEL`). That field exists on
Android 12 and newer, so older phones get one of the last two rows. iOS rows match the hardware model
(`getDeviceInfo().model`). To add your phones, measure them with the settings above and add rows to `MEASURED`.

## What was checked

All on release builds. Below, "template 0.1.x" means a new app made from a tarball of that version of this template
(`npm pack` in a clone; `--template` takes the tarball as an absolute path or a path that starts with `./`).

Template 0.1.6 (react-native-litert-lm 0.8.2):

- 2026-11-10, iPhone 18 Pro (Expo 58.0.23, React Native 0.88.1): the download, stopped at 30% by ending the app's
  process, continued from there when Download was tapped again on the next launch (from byte 605,791,646 of
  2,008,432,640), and its SHA-256 matched; the load on the form in the table; three streamed replies with Reset before
  the third; a later launch that loads from the phone without downloading, with the end of the reply and the timing
  line under it above the composer (in 0.1.5 the composer hid that line); replies drawn from their Markdown; the
  screen for a downloaded file whose SHA-256 does not match (a small file from the same Hugging Face repository in
  place of the model; the library deleted it) and the screen after a failed download (HTTP 404), each with Retry on
  it. The app was driven by launch arguments through a small test harness in place of `index.ts`, not by taps.
- 2026-11-10, Pixel 8a: only the start of the release build. It opened on the download screen with the form in the
  table; nothing was downloaded (the phone was not on Wi-Fi).

Earlier versions, with react-native-litert-lm 0.8.1:

- 2026-10-22 and 2026-10-23, the npm command (`--template expo-template-litert-gemma`, version 0.1.5), Galaxy S26:
  the app it made holds the package's files (`app.json` and `package.json` carry the new app's name and ids). Its
  release build downloaded the model and loaded it; then, with the phone in airplane mode, it answered a typed
  prompt.
- 2026-10-21, the GitHub URL command (commit 98c7576), Pixel 8a: the app it made holds this
  repository's files (`skills/` included, `.npmignore` left out; `app.json` and `package.json` carry the new app's
  name and ids, as create-expo writes them) and the same app code as template 0.1.5. Its release build was made with
  `npx expo prebuild --platform android` and Gradle's `assembleRelease`, and installed with `adb install`. The app
  downloaded the model, loaded it on the form in the table, answered a suggested prompt with a reply drawn from its
  Markdown, and on a later launch loaded the model from the phone without downloading it.
- 2026-10-21, template 0.1.5, iPhone 18 Pro: the download, the load on the form in the table, three streamed
  replies with Reset before the third, a later launch that loads from the phone without downloading, replies drawn
  from their Markdown, and the screen after a failed download (HTTP 404, with Retry on it). The app was driven by
  launch arguments through a small test harness in place of `index.ts`, not by taps.
- 2026-10-21, template 0.1.3 (its app code is byte for byte the same as 0.1.5's), Galaxy S26: the download, the load
  on the form in the table, a suggested prompt, a typed question, Reset, then one tap on a suggested prompt with the
  keyboard still open, a later launch that loads from the phone, and replies drawn from their Markdown.
- 2026-10-21, template 0.1.3, Pixel 8a: `npx expo run:android --variant release` built the release build (the
  command's install step talked to a stand-in for `adb`, not to a phone), and the same command with
  `--device <serial> --binary <that APK> --no-bundler` installed and opened it on the Pixel. The app downloaded the
  model, loaded it and drew a reply from its Markdown.
- 2026-10-21, the chat that a coding agent added to a new blank Expo app by following an earlier draft of
  `skills/add-on-device-gemma-chat/SKILL.md` (before the edits in 0.1.5), Pixel 8a: the download, the load on the GPU
  file, and a reply drawn from its Markdown.
- 2026-10-20, template 0.1.2, Pixel 8a: Reset, then one tap on a suggested prompt with the keyboard open, and the
  screen after a failed download (HTTP 404, with Retry on it; that screen's code is the same in 0.1.5).
- 2026-10-20, template 0.1.1 (before Markdown rendering and the keyboard fix), Galaxy S26: the screen after a failed
  download (HTTP 404, with Retry on it).

Not checked:

- `npx expo run:ios` itself, and signing with an App ID of your own (see below).
- The npm command with version 0.1.6: 0.1.6 was not on npm yet, so this check used a tarball made with `npm pack`
  from the same app files.
- On Android with 0.1.6: the download, the SHA-256 check, a continued download, the replies, and whether the timing
  line under a finished reply shows above the composer (only the start of the app ran, on the Pixel 8a).
- A download that stopped because the connection dropped (the one checked was stopped by ending the app).
- An iPhone build of an app made by the npm or GitHub URL command: only their Android builds were run.
- `npx expo run:android --variant release` on an app made by the npm or GitHub URL command: it was run on template
  0.1.3, whose app code is the same as 0.1.5's; those apps were built with `npx expo prebuild` and Gradle and
  installed with `adb install`.
- The memory refusal (`MEMORY_ESTIMATE_EXCEEDED`) and a GPU that fails to load: every phone loaded on the GPU, so the
  CPU fallback screens have not run on a phone.
- The keyboard fix on the iPhone.
- Phones not in the table.

## Requirements

- Expo SDK 58 (React Native 0.88), react-native-litert-lm 0.8.2. After upgrading `expo`, run
  `npx expo install --fix`: it installs the `react-native` version the new `expo` expects (`npx expo install --check`
  lists the packages that differ). With Expo 58.0.23 and react-native 0.88.0, the iPhone app stopped at launch
  (`Symbol not found: _OBJC_CLASS_$_RCTStatusBarAppearance`, a class added in react-native 0.88.1).
- Android 8.0 (API 26) or newer, arm64. A GPU backend needs the vendor's OpenCL driver
  (`getDeviceInfo().gpuAvailable`); without it the app uses the CPU.
- iPhone: iOS 16.4 or newer (Expo SDK 58's deployment target), and a paid Apple Developer account (see below).
- Free storage for the model file (2.0 or 2.6 GB) and free memory to load it; the library checks memory before it
  loads and refuses rather than letting the system kill the app.
- When `npx create-expo-app` installs the packages on a Mac, react-native-litert-lm's postinstall downloads the
  LiteRT-LM iOS framework (about 124 MB) from GitHub, and the install fails if that download fails;
  `SKIP_IOS_FRAMEWORK_DOWNLOAD=1` skips it for Android-only work.

## iPhone: your own App ID

A model over about 2 GB needs the Extended Virtual Addressing entitlement; the template also turns on Increased
Memory Limit, which raises the app's memory limit where the device allows. `app.json` turns both on through the
react-native-litert-lm config plugin (`extendedVirtualAddressing`, `increasedMemoryLimit`).
react-native-litert-lm's documentation says only a paid Apple Developer account can sign an app that declares them.

1. In `app.json`, set `expo.ios.bundleIdentifier` to an identifier of yours (the template's is `com.example.<app>`)
   and add `"appleTeamId": "<your team ID>"` next to it.
2. Run `npx expo run:ios --configuration Release --device`, which signs with your team automatically. If the build
   reports that the provisioning profile lacks a capability, turn on the two entitlements
   (`com.apple.developer.kernel.extended-virtual-addressing`, `com.apple.developer.kernel.increased-memory-limit`)
   for the App ID on developer.apple.com and build again. (How the site names them was not checked.)

Not verified: `npx expo run:ios` itself and these two steps with an App ID of your own. The iPhone build we checked
was made with xcodebuild from the Xcode project that `npx expo prebuild` generates for this app, signed with an App
ID and team borrowed from another project, with that project's AppDelegate/SceneDelegate (a workaround for the
borrowed identifier), and driven by launch arguments rather than taps.

Android needs no signing setup for a local release build: `npx expo run:android --variant release` signs with the
debug key. Before publishing, set up your own upload key ([Expo docs](https://docs.expo.dev/app-signing/app-credentials/)).

# Gemma 4 E2B chat on the phone (Expo template)

Not an official Google, Expo or react-native-litert-lm template.

An Expo app that downloads Google's Gemma 4 E2B once and chats with it on the phone: no server, no API key; your
messages never leave the phone (the only network use is the one-time model download). It runs the model with
[LiteRT-LM](https://github.com/google-ai-edge/LiteRT-LM) through
[react-native-litert-lm](https://github.com/hung-yueh/react-native-litert-lm). On the three phones we measured, it
picks the model file, backend and decoding setting that was fastest while still answering both a short chat and a
1,106-token prompt.

## Start a new app

```sh
npx create-expo-app@latest my-gemma-app --template https://github.com/john-rocky/expo-template-litert-gemma
```

This GitHub URL form has not been run yet; the runs listed under "What was checked" used a tarball of this template
instead. `--template` also takes such a tarball, made with `npm pack` in a clone of this repository (an absolute
path, or a path that starts with `./`).

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

## Existing app

To add the same chat to an existing Expo or React Native app, a coding agent can follow
[`skills/add-on-device-gemma-chat/SKILL.md`](skills/add-on-device-gemma-chat/SKILL.md); it holds everything the steps
need.

## What the app does

- **Download** with progress. The file stays on the phone; later launches load it directly.
- **Load** the model on the backend chosen for the phone, then **stream** each reply as it is generated. Replies are
  Markdown (headings, bold, lists); [markdown-to-jsx](https://github.com/quantizor/markdown-to-jsx) draws them with
  React Native views.
- **Reset** clears the conversation (the context holds 2,048 tokens: prompts and replies).
- When a step fails, the screen says what happened and what to do next:
  - the download fails (no connection, not enough storage, a server error): **Retry**;
  - the library refuses to load because the phone lacks free memory (`MEMORY_ESTIMATE_EXCEEDED`): close other apps
    and **Retry**, or **Load on the CPU** when the file can run there;
  - the GPU cannot load the model: the app switches to the CPU, or offers to download the CPU version of the file
    (the library also tries the CPU on its own before reporting a failure).

## Which model file each phone gets

[`src/gemma/forms.ts`](src/gemma/forms.ts) holds the table; each row has its measurement in a comment. All rows load
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
tokens/s.

Android rows match the phone's SoC (`getDeviceInfo().socModel`, Android's `Build.SOC_MODEL`). That field exists on
Android 12 and newer, so older phones get one of the last two rows. iOS rows match the hardware model
(`getDeviceInfo().model`). To add your phones, measure them with the settings above and add rows to `MEASURED`.

## What was checked

All on release builds with react-native-litert-lm 0.8.1. Below, "template 0.1.x" means a new app made from a tarball
of that version of this template.

- 2026-10-21, template 0.1.5, iPhone 18 Pro: the download, the load on the form in the table, three streamed
  replies with Reset before the third, a later launch that loads from the phone without downloading, replies drawn
  from their Markdown, and the screen after a failed download (HTTP 404, with Retry on it). The app was driven by
  launch arguments, not taps.
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
- The GitHub URL form of the command at the top.
- The memory refusal (`MEMORY_ESTIMATE_EXCEEDED`) and a GPU that fails to load: every phone loaded on the GPU, so the
  CPU fallback screens have not run on a phone.
- The keyboard fix on the iPhone.
- Phones not in the table.

## Requirements

- Expo SDK 58 (React Native 0.88), react-native-litert-lm 0.8.1.
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

## Temporary workaround

react-native-litert-lm 0.8.1 on npm lacks `android/consumer-rules.pro`, so an Android release build stops in
`:react-native-litert-lm:mergeReleaseConsumerProguardFiles`. Until a release includes the file
([hung-yueh/react-native-litert-lm#31](https://github.com/hung-yueh/react-native-litert-lm/pull/31)),
`scripts/add-consumer-rules.js` writes it into `node_modules` after every `npm install`.
**After upgrading to a release that ships the file, delete `scripts/add-consumer-rules.js` and the `postinstall`
line in `package.json`.**

## Files

| File | What it does |
| --- | --- |
| `App.tsx` | Wires the chat hook to the screen |
| `src/ChatScreen.tsx` | Download, progress, errors, the conversation (replies drawn from Markdown), the composer |
| `src/gemma/useGemmaChat.ts` | Picks the form, downloads, loads, streams replies, resets, falls back |
| `src/gemma/forms.ts` | The model files and the per-phone table |
| `scripts/add-consumer-rules.js` | The temporary Android release-build workaround |
| `skills/add-on-device-gemma-chat/SKILL.md` | Instructions for coding agents adding the same chat to an existing app; an app created from the GitHub URL contains it too (delete it if you don't want it) |

## License

The template: MIT ([LICENSE](LICENSE)). An app created from it starts with the same `LICENSE` file and `license`
field in `package.json`; change them for your app, keeping the copyright notice with the template's code.

Gemma 4 E2B: Apache 2.0 ([model card](https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm)).

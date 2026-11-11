# Gemma 4 E2B chat on the phone (Expo template)

An Expo app that downloads Google's Gemma 4 E2B once and chats with it on the phone. It needs no server or API key, and the model download is its only network use. It runs the model with [LiteRT-LM](https://github.com/google-ai-edge/LiteRT-LM) through [react-native-litert-lm](https://github.com/hung-yueh/react-native-litert-lm).

Use it as the starting point for your own app. This is not an official Google, Expo or react-native-litert-lm template.

## Start a new app

```sh
npx create-expo-app@latest my-gemma-app --template expo-template-litert-gemma
cd my-gemma-app
npx expo run:android --variant release
```

That builds the app and installs it on an Android phone connected over USB. It needs the [Android SDK](https://docs.expo.dev/get-started/set-up-your-environment/?platform=android&device=physical&mode=development-build&buildEnv=local#set-up-an-android-device-with-a-development-build), and Expo Go can't run it because the app has native code. The command keeps running after the app opens, so stop it with Ctrl-C. On a Mac, `npx create-expo-app` also downloads the LiteRT-LM iOS framework (about 124 MB) from GitHub. Set `SKIP_IOS_FRAMEWORK_DOWNLOAD=1` to skip it for Android-only work.

In the app, tap **Download** (once, from Hugging Face: 2.0 or 2.6 GB depending on the phone, best on Wi-Fi), then a suggested prompt or your own message.

For an iPhone, see [your own App ID](#iphone-your-own-app-id). To add the same chat to an existing Expo or React Native app, give [`skills/add-on-device-gemma-chat/SKILL.md`](https://github.com/john-rocky/expo-template-litert-gemma/blob/main/skills/add-on-device-gemma-chat/SKILL.md) to a coding agent.

## What the app does

The app checks the download against its SHA-256, and an interrupted download picks up where it stopped. Replies stream in and render as Markdown. A conversation holds 2,048 tokens, and **Reset** clears it. [The details](https://github.com/john-rocky/expo-template-litert-gemma/blob/main/docs/details.md) cover what the app does when a step fails, the device runs, what I have not checked and the iPhone entitlements.

## Which model file each phone gets

The app picks the model file and backend by phone. [`src/gemma/forms.ts`](src/gemma/forms.ts) holds the table, and you can add your own phones to `MEASURED`.

| Phone | File | Backend | Decode speed (short chat) |
| --- | --- | --- | --- |
| Pixel 8a (Tensor G3) | `gemma-4-E2B-it-gpu.litertlm`, 2.0 GB | GPU | 21 tokens/s |
| Galaxy S26 (Snapdragon SM8850) | `gemma-4-E2B-it.litertlm`, 2.6 GB | GPU, speculative decoding | 64 tokens/s |
| iPhone 18 Pro | `gemma-4-E2B-it-gpu.litertlm`, 2.0 GB | GPU | 93 tokens/s |
| Other phones with a GPU driver | `gemma-4-E2B-it-gpu.litertlm`, 2.0 GB | GPU | not measured |
| Phones without a GPU driver | `gemma-4-E2B-it.litertlm`, 2.6 GB | CPU | not measured |

The `-gpu` file only runs on the GPU. The other also runs on the CPU and has the drafter that speculative decoding needs. For each phone I measured, I picked the fastest setup that could also answer a long prompt of 1,106 tokens. I measured them on 2026-10-20 with a benchmark app on react-native-litert-lm 0.8.1 (LiteRT-LM 0.18.0). The template now uses 0.8.2 (LiteRT-LM 0.18.1), and this table was not measured again.

The app downloads these files at a fixed Hub revision, so a later change on the Hub does not reach it.

## Requirements

- Expo SDK 58 (React Native 0.88) and react-native-litert-lm 0.8.2. After upgrading `expo`, run `npx expo install --fix`.
- Android 8.0 (API 26) or newer, arm64. A GPU backend needs the vendor's OpenCL driver, and without it the app uses the CPU.
- iPhone: iOS 16.4 or newer and a paid Apple Developer account.
- Free storage for the model file and free memory to load it. The library checks memory first and refuses to load if there isn't enough.
- Publishing on Android: a local build signs with the debug key, so set up your own upload key first ([Expo docs](https://docs.expo.dev/app-signing/app-credentials/)).

## iPhone: your own App ID

react-native-litert-lm's documentation says a model over about 2 GB needs the Extended Virtual Addressing entitlement, so `app.json` turns it on, along with Increased Memory Limit. It also says only a paid Apple Developer account can sign an app with them.

In `app.json`, set `expo.ios.bundleIdentifier` to an identifier of yours and add `"appleTeamId": "<your team ID>"` next to it. Then run `npx expo prebuild` and build the Xcode project it generates. My iPhone build came from that generated project, but it was signed with an App ID borrowed from another project, so I have not verified these two `app.json` settings. [The details](https://github.com/john-rocky/expo-template-litert-gemma/blob/main/docs/details.md#iphone-your-own-app-id) name the entitlements.

## Files

| File | What it does |
| --- | --- |
| `App.tsx` | Wires the chat hook to the screen |
| `src/ChatScreen.tsx` | Download, progress, errors, the conversation and the composer |
| `src/gemma/useGemmaChat.ts` | The chat logic: which file to use, the download, loading and replies |
| `src/gemma/forms.ts` | The model files (with their SHA-256) and the per-phone table |
| `skills/add-on-device-gemma-chat/SKILL.md` | Steps for a coding agent adding the same chat to an existing app. It is in this repository but not in the npm package. |

## License

The template: MIT ([LICENSE](LICENSE)). An app you create from it starts with that license. Change it for your app, keeping the copyright notice with the template's code.

Gemma 4 E2B: Apache 2.0 ([model card](https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm)).

---
name: add-on-device-gemma-chat
description: Add a chat with Google's Gemma 4 E2B that runs on the phone (no server, no API key, works offline) to an existing Expo or React Native app, using react-native-litert-lm (LiteRT-LM). Use when the user asks for an on-device, offline or private LLM chat, "Gemma on the phone", running Gemma 4 in React Native or Expo, or a local AI assistant in a mobile app. Covers the packages and versions, the Expo config plugin and the iOS memory entitlements, which model file and backend each phone gets, download with progress and a SHA-256 check, load, streaming replies drawn from Markdown, reset, and the error codes the screen must explain.
---

# On-device Gemma 4 E2B chat (react-native-litert-lm)

Checked with Expo 58.0.23 (React Native 0.88.1), react-native-litert-lm 0.8.2 (LiteRT-LM 0.18.1),
react-native-nitro-modules 0.37.1 and markdown-to-jsx 9.10.3, in a release build of the template
[expo-template-litert-gemma](https://github.com/john-rocky/expo-template-litert-gemma) 0.1.6 on an iPhone 18 Pro
(2026-11-10; its docs/details.md lists the runs): a download stopped partway and continued, the SHA-256 check, load, streamed
replies drawn from their Markdown, Reset, a later launch that loads from the phone, and the screens for a file whose
SHA-256 does not match and for a download URL that answers HTTP 404. On Android, only the start of the release build
ran (Pixel 8a). With react-native-litert-lm 0.8.1, the template was checked on a Pixel 8a, a Galaxy S26 and an
iPhone 18 Pro (2026-10-20 to 2026-10-23), and a chat that a coding agent added to a new blank Expo app by following an earlier
draft of this file downloaded the model, loaded it and drew a reply from its Markdown on a Pixel 8a (2026-10-21).
Everything the steps need is in this file.

## Steps

1. **Check the project.** In `package.json`: Expo SDK 55 or newer (the library's peer range; checked with 58) and
   `react-native` 0.76 or newer. Android needs API 26+ on arm64. An iPhone build needs a paid Apple Developer account
   (step 3). Run `npx expo install --check`; if it lists `react-native`, run `npx expo install --fix` before step 2
   (with Expo 58.0.23 and react-native 0.88.0, an iPhone build stopped at launch: `RCTStatusBarAppearance` not found).
2. **Add the packages** at the versions checked together:
   ```bash
   npx expo install react-native-litert-lm@0.8.2 react-native-nitro-modules@0.37.1 markdown-to-jsx@9.10.3
   ```
   On macOS the library's postinstall downloads the LiteRT-LM iOS framework (about 124 MB) from GitHub. It has native
   code: the app needs a development or release build (`npx expo run:android|ios`), not Expo Go.
3. **Config plugin** in `app.json`. It sets Android minSdk 26 and the Kotlin version; the two iOS entitlements are
   opt-in: a model over about 2 GB needs Extended Virtual Addressing, and `increasedMemoryLimit` also raises the app's
   memory limit where the device allows:
   ```json
   { "expo": { "plugins": [["react-native-litert-lm", { "ios": { "extendedVirtualAddressing": true, "increasedMemoryLimit": true } }]] } }
   ```
   react-native-litert-lm's documentation says only a paid Apple Developer account can sign an app that declares them:
   set `ios.bundleIdentifier` to an App ID of the user's team and `ios.appleTeamId`.
4. **Model files and the form for each phone**, for example `src/gemma/forms.ts`. The files come from
   `litert-community/gemma-4-E2B-it-litert-lm` pinned to one commit; each measured row was the fastest form on that
   phone that answered both a short chat and a 1,106-token prompt (decode speeds in the comments):
   ```ts
   import type { DeviceInfo } from 'react-native-litert-lm';

   const BASE =
     'https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/41c5569623a7c189d6eec3e5225260c58cedbce7';
   export const FILES = {
     // text decoder for the GPU only: no CPU section, no image or audio encoder, no drafter
     gpu: {
       name: 'gemma-4-E2B-it-gpu.litertlm',
       url: `${BASE}/gemma-4-E2B-it-gpu.litertlm`,
       bytes: 2_008_432_640,
       sha256: 'a53a59001894c58e6bdb5b9b227709f91a2e3e556baa7d85acf9c55402ba5cf5', // the Hugging Face LFS oid
       runsOnCpu: false,
     },
     // the full bundle: CPU and GPU, image and audio encoders (not loaded for a text chat), the drafter
     full: {
       name: 'gemma-4-E2B-it.litertlm',
       url: `${BASE}/gemma-4-E2B-it.litertlm`,
       bytes: 2_588_147_712,
       sha256: '181938105e0eefd105961417e8da75903eacda102c4fce9ce90f50b97139a63c',
       runsOnCpu: true,
     },
   } as const;
   export type GemmaFile = (typeof FILES)[keyof typeof FILES];
   export type GemmaForm = { file: GemmaFile; backend: 'cpu' | 'gpu'; speculative: boolean };

   export const CPU_FORM: GemmaForm = { file: FILES.full, backend: 'cpu', speculative: false };

   export function pickForm(d: DeviceInfo | undefined): GemmaForm {
     if (!d || !d.gpuAvailable) return CPU_FORM; // no GPU driver on this phone
     // Pixel 8a (Tensor G3): 21.06 tok/s short chat, 20.42 tok/s long prompt
     if (d.platform === 'android' && d.socModel === 'Tensor G3') return { file: FILES.gpu, backend: 'gpu', speculative: false };
     // Galaxy S26 (SM8850): 64.42 / 60.34 tok/s with the bundle's drafter
     if (d.platform === 'android' && d.socModel === 'SM8850') return { file: FILES.full, backend: 'gpu', speculative: true };
     // iPhone 18 Pro (iPhone19,2): 93.41 / 92.57 tok/s
     if (d.platform === 'ios' && d.model === 'iPhone19,2') return { file: FILES.gpu, backend: 'gpu', speculative: false };
     // phones not measured, with a GPU driver: the GPU file answered both prompts on every phone above
     return { file: FILES.gpu, backend: 'gpu', speculative: false };
   }
   ```
5. **The chat's life cycle** (one engine per screen; wire these calls into a hook or component state):
   ```ts
   import { createLLM, getDeviceInfo, isMemoryError, LiteRTLMError, ModelRegistry } from 'react-native-litert-lm';

   const llm = createLLM(); // on mount; llm.close() on unmount
   const form = pickForm(getDeviceInfo()); // getDeviceInfo() can throw: treat a throw as undefined

   // Download once (progress 0..1); later launches find the file on the phone. The library keeps the file only when
   // its SHA-256 matches, and a download that stopped partway (no connection, the app closed) continues where it
   // stopped on the next call for the same URL.
   if (!ModelRegistry.isCached(form.file.url)) {
     await ModelRegistry.resolveModel(form.file.url, { sha256: form.file.sha256, onProgress: (p) => setProgress(p) });
   }
   // Load from the local path, so a load never starts a hidden download. These are the settings the table was
   // measured with.
   await llm.loadModel(ModelRegistry.getFilePath(form.file.url), {
     backend: form.backend,
     multimodal: false, // a text chat: no image or audio encoder
     maxContextTokens: 2048, // the conversation's limit (prompts + replies)
     enableSpeculativeDecoding: form.speculative,
     thinking: { enabled: false },
     temperature: 0,
     topK: 1,
   });
   // Stream a reply; the promise resolves with the whole text.
   const reply = await llm.execute([{ type: 'text', text: prompt }], (token) => appendToReply(token), {
     thinking: { enabled: false },
   });
   llm.resetConversation(); // the Reset button
   ```
6. **Explain every failure on the screen with the next step**, from `(e as LiteRTLMError).code`:
   - `DOWNLOAD_FAILED`: the message, then "check the connection (Wi-Fi for 2-2.6 GB) and free storage", and Retry
     (it continues a download that stopped partway). When the message contains `sha256 mismatch`, the library has
     deleted the file: say so, and Retry downloads it again.
   - `MEMORY_ESTIMATE_EXCEEDED` (`isMemoryError(e) && e.code === 'MEMORY_ESTIMATE_EXCEEDED'`): the library refused
     before loading; show `e.estimate.totalEstimatedBytes` against `e.estimate.availableBytes`, "close other apps",
     Retry, and "Load on the CPU" only when `form.file.runsOnCpu` (the CPU estimate is lower).
   - another load failure on the GPU (`ENGINE_INIT_FAILED` and others; the library also tries the CPU on its own
     before reporting a failure): the same file on the CPU when it `runsOnCpu`; otherwise offer the full bundle for the
     CPU (2.6 GB more): ask before downloading it.
   - a failed reply (`INFERENCE_FAILED`): keep the partial text and suggest Reset when the conversation is long.
7. **Build a release build on a phone** and read the log (`adb logcat -s ReactNativeJS` on Android) and the reply:
   ```bash
   npx expo run:android --variant release   # with more than one device connected: --device <serial>
   npx expo run:ios --configuration Release --device
   ```
   The reply must answer the prompt. x86_64 Android emulators are not supported by the library; a debug build does
   not show the speed users get.

## Rules

- **Pick the file and backend per phone; do not rely on the library's default.** With `backend` omitted, the library
  loads the full bundle with every encoder on the CPU (the bundle declares no backend, so the library's default
  applies), which decoded slower than the forms in step 4 on all three phones.
- **Pin the model URL to a commit** (`…/resolve/<commit>/<file>`), never `resolve/main`: the speeds and answers were
  checked on those bytes.
- **Text only for a text chat**: `multimodal: false`, and the other settings in step 5.
- **`gemma-4-E2B-it-gpu.litertlm` runs on the GPU only** (no CPU section, no drafter). Speculative decoding only with
  the full bundle, which carries the drafter, and only where it was the fastest form that also answered the long
  prompt (the Galaxy S26 row).
- **Draw the replies from Markdown.** Gemma answers with `**bold**`, `###` headings, lists and `---` rules; shown as
  plain text the symbols stay on screen. `markdown-to-jsx/native` (no native code) draws them with React Native views:
  ```tsx
  import Markdown from 'markdown-to-jsx/native';
  // optimizeForStreaming holds back syntax that is not closed yet while tokens arrive; drop it once the reply is done
  <Markdown options={{ optimizeForStreaming: !done }}>{replyText}</Markdown>
  ```
- **Show the first line of `LiteRTLMError.message`, never the whole text.** On Android the message carries the Java
  stack trace after the first line; shown whole, it fills the screen and pushes the next step and its buttons off it.
  Log the whole message, and keep the error screen scrollable.
- **Scroll the conversation with a `ScrollView`** (`onContentSizeChange` -> `scrollToEnd`). In the template, a
  `FlatList`'s `scrollToEnd` stopped short, and the composer hid the timing line under a finished reply
  ("first token … s · … s"); a chat that fits in a 2,048-token context holds few messages, so it needs no virtualized
  list.
- **Give the message list `keyboardShouldPersistTaps="handled"`.** After the user types and sends, the keyboard stays
  open; with the default, the next tap on a suggested prompt only closes the keyboard and sends nothing.
- **One engine per screen**: `createLLM()` on mount, `close()` on unmount; `resetConversation()` for Reset. Ignore a
  second Download tap while a download runs, and a Send while a reply is streaming.
- **Test on a phone with a release build.** The model needs 2.0–2.6 GB of storage and the memory to load it.

#!/usr/bin/env node
/**
 * Temporary workaround, run by `npm install` (package.json "postinstall").
 *
 * react-native-litert-lm 0.8.1 on npm lacks android/consumer-rules.pro, which
 * its android/build.gradle names, so an Android release build stops in
 * :react-native-litert-lm:mergeReleaseConsumerProguardFiles with "Supplied
 * consumer proguard configuration does not exist". The fix is
 * hung-yueh/react-native-litert-lm#31. Until a release ships the file, this
 * script writes the repository's copy into node_modules; once the installed
 * version has the file, it does nothing.
 *
 * Remove it after upgrading to a react-native-litert-lm release that includes
 * android/consumer-rules.pro: delete this file and the "postinstall" line in
 * package.json.
 */
const fs = require('fs');
const path = require('path');

// The repository's android/consumer-rules.pro, byte for byte
// (sha256 f65194fde4f6e9887f0f66e14175877cbcd5daa50e1cfe3fa94613601ba5bb6e).
// Source: https://github.com/hung-yueh/react-native-litert-lm/blob/main/android/consumer-rules.pro
// (MIT License, Copyright (c) 2026 hung-yueh).
const RULES = `# Proguard rules for react-native-litert-lm

# Keep our Nitro JSI wrappers and HybridObjects
-keep class com.margelo.nitro.dev.litert.litertlm.** { *; }

# Keep Google's LiteRT-LM SDK classes and JNI hooks
-keep class com.google.ai.edge.litertlm.** { *; }
-keep class dev.litert.litertlm.** { *; }
`;

let libraryDir;
try {
  libraryDir = path.dirname(require.resolve('react-native-litert-lm/package.json', { paths: [process.cwd()] }));
} catch {
  process.exit(0); // not installed (yet): nothing to patch
}
const target = path.join(libraryDir, 'android', 'consumer-rules.pro');
if (fs.existsSync(target)) process.exit(0);
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, RULES);
console.log(`[add-consumer-rules] wrote ${path.relative(process.cwd(), target)} (react-native-litert-lm#31)`);

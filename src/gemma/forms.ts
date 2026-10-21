import type { DeviceInfo } from 'react-native-litert-lm';

/**
 * Which Gemma 4 E2B file, backend and decoding to use on this phone.
 *
 * Every row below is the fastest form measured on that phone with
 * react-native-litert-lm 0.8.1 (LiteRT-LM 0.18.0) and the settings this app
 * loads with (text only, 2,048-token context, greedy decoding, thinking off),
 * answering a short chat prompt and a 1,106-token prompt correctly. Change the
 * settings, the library or the file and measure again on your phones.
 */

// Hugging Face repository and commit the files are pinned to (an immutable URL).
const REPO = 'litert-community/gemma-4-E2B-it-litert-lm';
const REVISION = '41c5569623a7c189d6eec3e5225260c58cedbce7';

export type GemmaFile = {
  name: string;
  url: string;
  bytes: number;
  /** false: the file holds a GPU-only text decoder */
  runsOnCpu: boolean;
  /** true: the file carries a multi-token-prediction drafter (speculative decoding) */
  hasDrafter: boolean;
};

const file = (name: string, bytes: number, runsOnCpu: boolean, hasDrafter: boolean): GemmaFile => ({
  name,
  url: `https://huggingface.co/${REPO}/resolve/${REVISION}/${name}`,
  bytes,
  runsOnCpu,
  hasDrafter,
});

export const FILES = {
  /** Text decoder for the GPU only: no image or audio encoder, no drafter. */
  gpu: file('gemma-4-E2B-it-gpu.litertlm', 2_008_432_640, false, false),
  /** The full bundle: CPU and GPU, image and audio encoders (not loaded here), the drafter. */
  full: file('gemma-4-E2B-it.litertlm', 2_588_147_712, true, true),
} as const;

export type GemmaForm = {
  id: string;
  /** Where the choice comes from, shown under the download button */
  label: string;
  file: GemmaFile;
  backend: 'cpu' | 'gpu';
  speculative: boolean;
  maxContextTokens: number;
};

/** The conversation's length limit in tokens (prompt + replies), for every form. */
export const CONTEXT_TOKENS = 2048;

const form = (id: string, label: string, f: GemmaFile, backend: 'cpu' | 'gpu', speculative: boolean): GemmaForm => ({
  id,
  label,
  file: f,
  backend,
  speculative,
  maxContextTokens: CONTEXT_TOKENS,
});

/** The form for phones without a GPU driver, and the fallback after a GPU load fails. */
export const CPU_FORM = form('cpu', 'CPU', FILES.full, 'cpu', false);

type Row = { match: (d: DeviceInfo) => boolean; form: GemmaForm };

/** Phones we measured. Android rows match the SoC, iOS rows the hardware model. */
const MEASURED: Row[] = [
  {
    // Pixel 8a, Android 16, 2026-10-20: short chat 21.06 tok/s, 1,106-token prompt 20.42 tok/s (decode).
    match: (d) => d.platform === 'android' && d.socModel === 'Tensor G3',
    form: form('tensor-g3', 'measured on a Pixel 8a (Tensor G3)', FILES.gpu, 'gpu', false),
  },
  {
    // Galaxy S26 (SM-S942Q), Android 16, 2026-10-20: short chat 64.42 tok/s, 1,106-token prompt 60.34 tok/s
    // (decode, with the bundle's drafter; the phone's heat moves the long-prompt rate between ~45 and ~60).
    match: (d) => d.platform === 'android' && d.socModel === 'SM8850',
    form: form('sm8850', 'measured on a Galaxy S26 (Snapdragon SM8850)', FILES.full, 'gpu', true),
  },
  {
    // iPhone 18 Pro (iPhone19,2), iOS 27.2, 2026-10-20: short chat 93.41 tok/s, 1,106-token prompt 92.57 tok/s
    // (decode). The full bundle on the GPU with the drafter was faster on the short chat (110.51 tok/s), but on
    // the GPU that bundle declined the 1,106-token prompt's task on every run (the CPU and the GPU file did it),
    // and a chat's context grows: this app uses the GPU file.
    match: (d) => d.platform === 'ios' && d.model === 'iPhone19,2',
    form: form('iphone19-2', 'measured on an iPhone 18 Pro', FILES.gpu, 'gpu', false),
  },
];

/** Phones we did not measure: the GPU file answered both prompts on every phone above. */
const UNMEASURED_GPU = form('gpu', 'not measured on this phone: the GPU file', FILES.gpu, 'gpu', false);

export function pickForm(device: DeviceInfo | undefined): GemmaForm {
  if (!device) return { ...CPU_FORM, label: 'CPU (this device could not be read)' };
  if (!device.gpuAvailable) return { ...CPU_FORM, label: 'CPU (no GPU driver on this phone)' };
  return MEASURED.find((row) => row.match(device))?.form ?? UNMEASURED_GPU;
}

export const formatBytes = (bytes: number) => `${(bytes / 1e9).toFixed(1)} GB`;

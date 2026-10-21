import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createLLM,
  getDeviceInfo,
  isMemoryError,
  LiteRTLMError,
  ModelRegistry,
  type DeviceInfo,
  type LiteRTLMInstance,
} from 'react-native-litert-lm';
import { CPU_FORM, formatBytes, pickForm, type GemmaForm } from './forms';

export type ChatMessage = { id: number; role: 'user' | 'model'; text: string; note?: string };

/** What the user can do after a failure */
export type Action = 'retry' | 'use-cpu' | 'download-cpu';

export type Problem = { title: string; detail: string; code: string | null; actions: Action[] };

export type GemmaStatus =
  | { kind: 'starting' }
  | { kind: 'needs-download' }
  | { kind: 'downloading'; progress: number }
  | { kind: 'loading' }
  | { kind: 'ready' }
  | { kind: 'generating' }
  | { kind: 'failed'; problem: Problem };

export type GemmaChatOptions = {
  /** Use this form instead of the one picked for the phone (testing, or your own device list). */
  form?: GemmaForm;
  /** Describe the device differently (testing). */
  device?: DeviceInfo;
};

export type GemmaChat = {
  device: DeviceInfo | undefined;
  form: GemmaForm;
  status: GemmaStatus;
  messages: ChatMessage[];
  /** Shown above the chat, e.g. after falling back to the CPU */
  notice: string | null;
  download: () => void;
  send: (text: string) => void;
  reset: () => void;
  act: (action: Action) => void;
};

// One line per step, so `adb logcat -s ReactNativeJS` (or the Xcode console) shows what this phone does.
const log = (line: string) => console.log(`[gemma] ${line}`);

const describe = (f: GemmaForm) =>
  `${f.file.name} on the ${f.backend.toUpperCase()}, speculative ${f.speculative ? 'on' : 'off'}, ` +
  `context ${f.maxContextTokens} (${f.label})`;

const mb = (bytes: number) => `${Math.round(bytes / 1e6).toLocaleString('en-US')} MB`;

function readDevice(): DeviceInfo | undefined {
  try {
    return getDeviceInfo();
  } catch {
    return undefined;
  }
}

// `message` goes to the log in full; the screen gets `brief`: its first line (on Android the library's message carries
// the Java stack trace after it, which would push the next step and the buttons off the screen).
function errorOf(e: unknown): { code: string | null; message: string; brief: string } {
  const message = e instanceof Error ? e.message : String(e);
  const first = message.split('\n')[0].trim();
  return {
    code: e instanceof LiteRTLMError ? e.code : null,
    message,
    brief: first.length > 300 ? `${first.slice(0, 300)}…` : first,
  };
}

/**
 * The chat's whole life cycle: pick the form for this phone, download its file
 * once, load it, stream replies, reset the conversation, and say what to do
 * when a step fails.
 */
export function useGemmaChat(options: GemmaChatOptions = {}): GemmaChat {
  const [device] = useState(() => options.device ?? readDevice());
  const [form, setForm] = useState<GemmaForm>(() => options.form ?? pickForm(device));
  const [status, setStatus] = useState<GemmaStatus>({ kind: 'starting' });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const llm = useRef<LiteRTLMInstance | null>(null);
  const lastStep = useRef<'download' | 'load'>('download');
  const busy = useRef(false);
  const downloading = useRef(false);
  const nextId = useRef(1);

  const fail = (problem: Problem) => setStatus({ kind: 'failed', problem });

  const load = useCallback(async (start: GemmaForm): Promise<void> => {
    lastStep.current = 'load';
    let f = start;
    for (;;) {
      const engine = llm.current;
      if (!engine) return;
      setStatus({ kind: 'loading' });
      const t0 = Date.now();
      try {
        await engine.loadModel(ModelRegistry.getFilePath(f.file.url), {
          backend: f.backend,
          multimodal: false,
          maxContextTokens: f.maxContextTokens,
          enableSpeculativeDecoding: f.speculative,
          thinking: { enabled: false },
          temperature: 0,
          topK: 1,
        });
        log(`load done in ${Date.now() - t0} ms: ${describe(f)}`);
        setStatus({ kind: 'ready' });
        return;
      } catch (e) {
        const { code, message, brief } = errorOf(e);
        log(`load failed after ${Date.now() - t0} ms: ${describe(f)}: ${code ?? 'no code'}: ${message}`);
        const cpuCanTakeOver = f.backend === 'gpu' && f.file.runsOnCpu;
        if (isMemoryError(e) && e.code === 'MEMORY_ESTIMATE_EXCEEDED') {
          // The library's pre-flight check refused the load before it could run out of memory.
          fail({
            title: 'Not enough free memory',
            detail:
              `Loading the model needs about ${mb(e.estimate.totalEstimatedBytes)}, and ` +
              `${mb(e.estimate.availableBytes)} is free right now. Close other apps, then tap Retry.` +
              (cpuCanTakeOver ? ' Or load it on the CPU: slower, but it needs less memory.' : ''),
            code,
            actions: cpuCanTakeOver ? ['retry', 'use-cpu'] : ['retry'],
          });
        } else if (cpuCanTakeOver) {
          // The same file runs on the CPU: no second download.
          f = { ...CPU_FORM, file: f.file, label: 'CPU, after the GPU failed' };
          setNotice(`The GPU could not load the model (${code ?? brief}). Running on the CPU instead.`);
          setForm(f);
          continue;
        } else if (f.backend === 'gpu') {
          fail({
            title: 'The GPU could not load the model',
            detail: `${brief}\n\nThe CPU needs another file (${formatBytes(CPU_FORM.file.bytes)}).`,
            code,
            actions: ['retry', 'download-cpu'],
          });
        } else {
          fail({ title: 'The model could not be loaded', detail: brief, code, actions: ['retry'] });
        }
        return;
      }
    }
  }, []);

  const fetchAndLoad = useCallback(
    async (f: GemmaForm): Promise<void> => {
      if (downloading.current) return; // a second tap while the first download runs
      downloading.current = true;
      lastStep.current = 'download';
      setStatus({ kind: 'downloading', progress: 0 });
      const t0 = Date.now();
      let shown = -1;
      log(`download start: ${f.file.url}`);
      try {
        const path = await ModelRegistry.resolveModel(f.file.url, {
          onProgress: (p) => {
            if (!Number.isFinite(p)) return;
            const percent = Math.floor(Math.min(Math.max(p, 0), 1) * 100);
            if (percent === shown) return;
            shown = percent;
            setStatus({ kind: 'downloading', progress: percent / 100 });
            if (percent % 10 === 0) log(`download ${percent}% at ${Date.now() - t0} ms`);
          },
        });
        log(`download done: ${ModelRegistry.getFileSizeBytes(path)} bytes in ${Date.now() - t0} ms`);
      } catch (e) {
        const { code, message, brief } = errorOf(e);
        log(`download failed after ${Date.now() - t0} ms: ${code ?? 'no code'}: ${message}`);
        fail({
          title: 'The download failed',
          detail:
            `${brief}\n\nCheck the connection (Wi-Fi is best for ${formatBytes(f.file.bytes)}) and that the ` +
            'phone has that much free storage, then tap Retry.',
          code,
          actions: ['retry'],
        });
        return;
      } finally {
        downloading.current = false;
      }
      await load(f);
    },
    [load],
  );

  // Start: one engine for the screen's life; load at once when the file is already on the phone.
  useEffect(() => {
    const instance = createLLM();
    llm.current = instance;
    log(
      `device ${device ? `${device.platform} ${device.model} SoC ${device.socModel ?? '-'} GPU ${device.gpuAvailable}` : 'unknown'}` +
        ` -> ${describe(form)}`,
    );
    if (ModelRegistry.isCached(form.file.url)) {
      log(`cached: ${form.file.name}`);
      void load(form);
    } else {
      setStatus({ kind: 'needs-download' });
    }
    return () => {
      llm.current = null;
      try {
        instance.close();
      } catch (e) {
        console.warn('[gemma] close failed', e);
      }
    };
    // Runs once: a form change after a failure goes through load() / fetchAndLoad() directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = useCallback(async (text: string) => {
    const prompt = text.trim();
    const engine = llm.current;
    if (!prompt || !engine || busy.current) return;
    busy.current = true;
    const userId = nextId.current++;
    const modelId = nextId.current++;
    const update = (reply: string, note?: string) =>
      setMessages((all) => all.map((m) => (m.id === modelId ? { ...m, text: reply, note } : m)));
    setMessages((all) => [...all, { id: userId, role: 'user', text: prompt }, { id: modelId, role: 'model', text: '' }]);
    setStatus({ kind: 'generating' });
    const t0 = Date.now();
    let first = 0;
    let chunks = 0;
    let streamed = '';
    try {
      const reply = await engine.execute(
        [{ type: 'text', text: prompt }],
        (token) => {
          if (!token) return;
          if (!first) first = Date.now();
          chunks += 1;
          streamed += token;
          update(streamed);
        },
        { thinking: { enabled: false } },
      );
      const end = Date.now();
      const final = reply || streamed;
      let stats = '';
      try {
        stats = JSON.stringify(engine.getStats());
      } catch {
        stats = 'unavailable';
      }
      const ttft = first ? first - t0 : end - t0;
      log(
        `reply: first token ${ttft} ms, ${chunks} chunks, ${final.length} chars, ` +
          `${first ? end - first : 0} ms after the first token; engine stats ${stats}`,
      );
      update(final, `first token ${(ttft / 1000).toFixed(2)} s · ${((end - t0) / 1000).toFixed(1)} s`);
    } catch (e) {
      const { code, message, brief } = errorOf(e);
      log(`reply failed after ${Date.now() - t0} ms: ${code ?? 'no code'}: ${message}`);
      update(streamed, `Stopped (${code ?? brief}). If the conversation is long, tap Reset and ask again.`);
    } finally {
      busy.current = false;
      setStatus({ kind: 'ready' });
    }
  }, []);

  const reset = useCallback(() => {
    if (busy.current) return;
    try {
      llm.current?.resetConversation();
    } catch (e) {
      console.warn('[gemma] reset failed', e);
    }
    setMessages([]);
    log('conversation reset');
  }, []);

  const act = useCallback(
    (action: Action) => {
      if (action === 'retry') {
        void (lastStep.current === 'download' ? fetchAndLoad(form) : load(form));
      } else if (action === 'use-cpu' && form.file.runsOnCpu) {
        const cpu: GemmaForm = { ...CPU_FORM, file: form.file, label: 'CPU, chosen after a memory refusal' };
        setNotice('Running on the CPU: slower, but it needs less memory.');
        setForm(cpu);
        void load(cpu);
      } else if (action === 'download-cpu') {
        setNotice('Running on the CPU: the GPU could not load the model.');
        setForm(CPU_FORM);
        void (ModelRegistry.isCached(CPU_FORM.file.url) ? load(CPU_FORM) : fetchAndLoad(CPU_FORM));
      }
    },
    [form, load, fetchAndLoad],
  );

  const download = useCallback(() => void fetchAndLoad(form), [fetchAndLoad, form]);

  return { device, form, status, messages, notice, download, send, reset, act };
}

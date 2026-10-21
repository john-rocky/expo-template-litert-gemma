import Markdown, { type NativeOptions } from 'markdown-to-jsx/native';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatBytes } from './gemma/forms';
import type { Action, ChatMessage, GemmaChat } from './gemma/useGemmaChat';

const EXAMPLES = [
  'Explain what on-device AI means in simple terms.',
  'Write a haiku about the sea.',
  'Give me three tips for a long flight.',
];

const ACTION_LABELS: Record<Action, string> = {
  retry: 'Retry',
  'use-cpu': 'Load on the CPU',
  'download-cpu': 'Download the CPU version',
};

// Gemma writes its replies in Markdown (bold, headings, lists, rules). markdown-to-jsx draws them with React Native
// views; while a reply streams in, it holds back syntax that is not closed yet (an open `**`), and once the reply is
// done (it has a note) everything is shown.
const MARKDOWN_STYLES: NativeOptions['styles'] = {
  text: { color: '#111111' },
  paragraph: { fontSize: 15, lineHeight: 21, marginBottom: 8 },
  heading1: { fontSize: 20, lineHeight: 26, marginTop: 4, marginBottom: 8 },
  heading2: { fontSize: 18, lineHeight: 24, marginTop: 4, marginBottom: 8 },
  heading3: { fontSize: 16, lineHeight: 22, marginTop: 4, marginBottom: 6 },
  thematicBreak: { marginVertical: 10 },
};
const STREAMING: NativeOptions = { optimizeForStreaming: true, styles: MARKDOWN_STYLES };
const FINISHED: NativeOptions = { styles: MARKDOWN_STYLES };

export function ChatScreen({ chat }: { chat: GemmaChat }) {
  const { form, status, messages, notice } = chat;
  const generating = status.kind === 'generating';
  const chatting = status.kind === 'ready' || generating;
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Gemma 4 E2B</Text>
          <Text style={styles.subtitle}>
            On this phone · {form.backend.toUpperCase()}
            {form.speculative ? ' + drafter' : ''} · {formatBytes(form.file.bytes)}
          </Text>
        </View>
        {chatting && messages.length > 0 ? (
          <Button title="Reset" onPress={chat.reset} disabled={generating} quiet />
        ) : null}
      </View>
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      <KeyboardAvoidingView style={styles.body} behavior="padding">
        {chatting ? (
          <Conversation chat={chat} />
        ) : (
          // scrolls, so a long message never hides the next step and its buttons
          <ScrollView contentContainerStyle={styles.setup} keyboardShouldPersistTaps="handled">
            <Setup chat={chat} />
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Setup({ chat }: { chat: GemmaChat }) {
  const { status, form } = chat;
  switch (status.kind) {
    case 'needs-download':
      return (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Run Gemma 4 E2B on this phone</Text>
          <Text style={styles.text}>
            The model is downloaded once ({formatBytes(form.file.bytes)}) and stays on the phone. Your chats never
            leave it.
          </Text>
          <Button title={`Download ${formatBytes(form.file.bytes)}`} onPress={chat.download} />
          <Text style={styles.caption}>Picked for this phone: {form.label}</Text>
        </View>
      );
    case 'downloading': {
      const percent = Math.floor(status.progress * 100);
      return (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Downloading the model… {percent}%</Text>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${percent}%` }]} />
          </View>
          <Text style={styles.caption}>
            {formatBytes(status.progress * form.file.bytes)} of {formatBytes(form.file.bytes)}. Keep the app open.
          </Text>
        </View>
      );
    }
    case 'failed':
      return (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{status.problem.title}</Text>
          <Text style={styles.text}>{status.problem.detail}</Text>
          {status.problem.code ? <Text style={styles.caption}>Error code: {status.problem.code}</Text> : null}
          {status.problem.actions.map((action) => (
            <Button key={action} title={ACTION_LABELS[action]} onPress={() => chat.act(action)} />
          ))}
        </View>
      );
    default:
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
          <Text style={styles.caption}>{status.kind === 'loading' ? 'Loading the model…' : 'Starting…'}</Text>
        </View>
      );
  }
}

function Conversation({ chat }: { chat: GemmaChat }) {
  const [draft, setDraft] = useState('');
  const list = useRef<FlatList<ChatMessage>>(null);
  const ready = chat.status.kind === 'ready';
  const submit = (text: string) => {
    if (!ready || !text.trim()) return;
    chat.send(text);
    setDraft('');
  };
  return (
    <>
      <FlatList
        ref={list}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        // a suggested prompt answers the first tap even while the keyboard is open (the default spends it on
        // closing the keyboard)
        keyboardShouldPersistTaps="handled"
        data={chat.messages}
        keyExtractor={(m) => String(m.id)}
        renderItem={({ item }) => <Bubble message={item} />}
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <View style={styles.examples}>
            <Text style={styles.caption}>Try one:</Text>
            {EXAMPLES.map((example) => (
              <Pressable
                key={example}
                accessibilityRole="button"
                onPress={() => submit(example)}
                style={styles.example}
              >
                <Text style={styles.text}>{example}</Text>
              </Pressable>
            ))}
          </View>
        }
      />
      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Message Gemma"
          multiline
        />
        <Button title="Send" onPress={() => submit(draft)} disabled={!ready || !draft.trim()} />
      </View>
    </>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  const mine = message.role === 'user';
  return (
    <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
      {mine || !message.text ? (
        <Text style={[styles.text, mine && styles.mineText]}>{message.text || '…'}</Text>
      ) : (
        <Markdown options={message.note ? FINISHED : STREAMING}>{message.text}</Markdown>
      )}
      {message.note ? <Text style={styles.note}>{message.note}</Text> : null}
    </View>
  );
}

function Button({
  title,
  onPress,
  disabled,
  quiet,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  quiet?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={[styles.button, quiet && styles.quietButton, disabled && styles.disabled]}
    >
      <Text style={[styles.buttonText, quiet && styles.quietButtonText]}>{title}</Text>
    </Pressable>
  );
}

// Fixed colors: the app reads the same in light and dark mode
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#ffffff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#d0d0d0',
  },
  headerText: { flex: 1 },
  title: { fontSize: 20, fontWeight: '600', color: '#111111' },
  subtitle: { fontSize: 13, color: '#666666', marginTop: 2 },
  notice: { backgroundColor: '#fff4d6', color: '#5c4400', padding: 12, fontSize: 13 },
  body: { flex: 1 },
  setup: { flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  card: { margin: 16, padding: 16, borderRadius: 12, backgroundColor: '#f4f6f8', gap: 12 },
  cardTitle: { fontSize: 17, fontWeight: '600', color: '#111111' },
  text: { fontSize: 15, lineHeight: 21, color: '#111111' },
  caption: { fontSize: 13, color: '#666666' },
  track: { height: 8, borderRadius: 4, backgroundColor: '#dde3ea', overflow: 'hidden' },
  fill: { height: 8, backgroundColor: '#1a73e8' },
  list: { flex: 1 },
  listContent: { padding: 16, gap: 12 },
  examples: { gap: 8 },
  example: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#d0d7de' },
  bubble: { maxWidth: '88%', padding: 12, borderRadius: 14 },
  mine: { alignSelf: 'flex-end', backgroundColor: '#1a73e8' },
  theirs: { alignSelf: 'flex-start', backgroundColor: '#f1f3f4' },
  mineText: { color: '#ffffff' },
  note: { fontSize: 12, color: '#666666', marginTop: 6 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#d0d0d0',
  },
  input: {
    flex: 1,
    maxHeight: 120,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#d0d7de',
    fontSize: 15,
    color: '#111111',
  },
  button: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 18, backgroundColor: '#1a73e8', alignItems: 'center' },
  buttonText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  quietButton: { backgroundColor: 'transparent' },
  quietButtonText: { color: '#1a73e8' },
  disabled: { opacity: 0.4 },
});

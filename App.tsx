import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ChatScreen } from './src/ChatScreen';
import { useGemmaChat } from './src/gemma/useGemmaChat';

export default function App() {
  const chat = useGemmaChat();
  return (
    <SafeAreaProvider>
      <ChatScreen chat={chat} />
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}

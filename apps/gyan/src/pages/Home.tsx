/**
 * Home — VOLT shell: 56px rail + fluid main. Chat state lives here so
 * switching surfaces never loses the conversation.
 */
import { useState } from 'react';
import { Rail, type Surface } from '@/components/volt/Rail';
import { ChatView } from '@/components/volt/ChatView';
import {
  MarketplaceView,
  BlueprintView,
  StudioView,
  WorkspaceView,
  ControlView,
} from '@/components/volt/views';
import { useVoltChat } from '@/hooks/useVoltChat';

export default function Home() {
  const [surface, setSurface] = useState<Surface>('chat');
  const { messages, busy, send, stop, reset, load } = useVoltChat();

  const engage = (prompt: string) => {
    setSurface('chat');
    // let the surface switch paint before the stream starts
    setTimeout(() => send(prompt), 30);
  };

  return (
    <div className="flex h-full overflow-hidden">
      <Rail
        surface={surface}
        onSurface={setSurface}
        onReset={() => {
          reset();
          setSurface('chat');
        }}
      />
      <main className="flex min-w-0 flex-1">
        {surface === 'chat' && (
          <ChatView
            messages={messages}
            busy={busy}
            onSend={send}
            onStop={stop}
            onLoad={load}
          />
        )}
        {surface === 'marketplace' && <MarketplaceView onEngage={engage} />}
        {surface === 'blueprint' && <BlueprintView />}
        {surface === 'studio' && <StudioView />}
        {surface === 'workspace' && <WorkspaceView />}
        {surface === 'control' && <ControlView />}
      </main>
    </div>
  );
}

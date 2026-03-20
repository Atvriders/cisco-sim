import { useEffect, useRef } from 'react';
import type { SessionState } from '../sim/types';
import type { SimAction } from '../sim/reducer';
import { buildPrompt } from '../sim/reducer';
import TerminalLineComponent from './TerminalLine';
import TerminalInput from './TerminalInput';

interface Props {
  sessionState: SessionState;
  onDispatch: (action: SimAction) => void;
  currentInput: string;
}

export default function Terminal({ sessionState, onDispatch, currentInput }: Props) {
  const outputRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when lines change
  useEffect(() => {
    const el = outputRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [sessionState.lines]);

  const prompt = buildPrompt(sessionState.deviceState);

  const handleSubmit = (v: string) => {
    onDispatch({ type: 'EXECUTE', input: v });
  };

  const handleTab = (v: string): string => {
    onDispatch({ type: 'TAB_COMPLETE' });
    return v;
  };


  const handleUp = (v: string): string => {
    const hist = sessionState.commandHistory;
    if (hist.length === 0) return v;
    const nextIdx = sessionState.historyIndex === -1 ? 0 : Math.min(sessionState.historyIndex + 1, hist.length - 1);
    onDispatch({ type: 'HISTORY_UP' });
    return hist[nextIdx] || v;
  };

  const handleDown = (): string => {
    const hist = sessionState.commandHistory;
    if (sessionState.historyIndex <= 0) {
      onDispatch({ type: 'HISTORY_DOWN' });
      return '';
    }
    const nextIdx = sessionState.historyIndex - 1;
    onDispatch({ type: 'HISTORY_DOWN' });
    return hist[nextIdx] || '';
  };

  return (
    <div className="terminal">
      <div className="terminal-output" ref={outputRef}>
        {sessionState.lines.map(line => (
          <TerminalLineComponent key={line.id} type={line.type} text={line.text} />
        ))}
      </div>
      <TerminalInput
        prompt={sessionState.pendingInput ? '' : prompt}
        value={currentInput}
        onChange={v => onDispatch({ type: 'SET_INPUT', input: v })}
        onSubmit={handleSubmit}
        onTab={handleTab}
        onUp={handleUp}
        onDown={handleDown}
      />
    </div>
  );
}

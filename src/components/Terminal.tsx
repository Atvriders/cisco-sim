import { useEffect, useRef, useState, useCallback } from 'react';
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const inputFocusTriggerRef = useRef<(() => void) | null>(null);

  const checkAtBottom = useCallback(() => {
    const el = outputRef.current;
    if (!el) return;
    const threshold = 40;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    setIsAtBottom(atBottom);
  }, []);

  const scrollToBottom = useCallback(() => {
    const el = outputRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
      setIsAtBottom(true);
    }
  }, []);

  // Auto-scroll to bottom when lines change, only if already at bottom
  useEffect(() => {
    if (isAtBottom) {
      scrollToBottom();
    }
  }, [sessionState.lines, isAtBottom, scrollToBottom]);

  // When a new session loads, scroll to bottom
  useEffect(() => {
    scrollToBottom();
  }, [sessionState.id, scrollToBottom]);

  const handleScroll = useCallback(() => {
    checkAtBottom();
  }, [checkAtBottom]);

  const prompt = buildPrompt(sessionState.deviceState);

  const handleSubmit = (v: string) => {
    onDispatch({ type: 'EXECUTE', input: v });
    // After submitting, scroll to bottom
    setTimeout(() => scrollToBottom(), 50);
  };

  const handleTab = (v: string): string => {
    onDispatch({ type: 'TAB_COMPLETE' });
    return v;
  };

  const handleHelp = (v: string) => {
    onDispatch({ type: 'HELP_QUERY', input: v });
    setTimeout(() => scrollToBottom(), 50);
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

  // Click anywhere on terminal container to focus input
  const handleContainerClick = () => {
    if (inputFocusTriggerRef.current) {
      inputFocusTriggerRef.current();
    }
  };

  return (
    <div className="terminal" ref={containerRef} onClick={handleContainerClick}>
      <div
        className="terminal-output"
        ref={outputRef}
        onScroll={handleScroll}
      >
        {sessionState.lines.map(line => (
          <TerminalLineComponent key={line.id} type={line.type} text={line.text} />
        ))}
      </div>
      {!isAtBottom && (
        <button
          className="scroll-to-bottom-btn"
          onClick={e => { e.stopPropagation(); scrollToBottom(); }}
          title="Scroll to bottom"
        >
          ⬇ scroll to bottom
        </button>
      )}
      <TerminalInput
        prompt={sessionState.pendingInput ? '' : prompt}
        value={currentInput}
        onChange={v => onDispatch({ type: 'SET_INPUT', input: v })}
        onSubmit={handleSubmit}
        onTab={handleTab}
        onHelp={handleHelp}
        onUp={handleUp}
        onDown={handleDown}
        onFocusRef={inputFocusTriggerRef}
        mode={sessionState.deviceState.mode}
        commandHistory={sessionState.commandHistory}
      />
    </div>
  );
}

import { useReducer, useEffect, useRef } from 'react';
import { reducer, createInitialSimState, type SimAction } from './sim/reducer';
import { BOOT_LINES, BOOT_LINE_DELAYS } from './sim/boot';
import BootScreen from './components/BootScreen';
import Terminal from './components/Terminal';
import StatusPanel from './components/StatusPanel';
import TabBar from './components/TabBar';
import './App.css';

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialSimState);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bootIndexRef = useRef(0);

  // Boot sequence
  useEffect(() => {
    if (!state.booting) return;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const showNextLine = (index: number) => {
      if (cancelled) return;
      if (index >= BOOT_LINES.length) return;
      const delay = BOOT_LINE_DELAYS[index] ?? 20;
      timeoutId = setTimeout(() => {
        if (cancelled) return;
        dispatch({ type: 'BOOT_LINE', index });
        bootIndexRef.current = index + 1;
        showNextLine(index + 1);
      }, delay);
    };

    showNextLine(bootIndexRef.current);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [state.booting]);

  // Tick loop
  useEffect(() => {
    tickRef.current = setInterval(() => {
      dispatch({ type: 'TICK', now: Date.now() });
    }, 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  // Ctrl+Z global handler
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        dispatch({ type: 'EXECUTE', input: 'end' });
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const handleDispatch = (action: SimAction) => dispatch(action);

  const activeSession = state.sessions.find(s => s.id === state.activeSessionId)!;

  if (state.booting) {
    return (
      <BootScreen
        onComplete={() => dispatch({ type: 'BOOT_COMPLETE' })}
      />
    );
  }

  return (
    <div className="app">
      <div className="app-tabs">
        <TabBar
          sessions={state.sessions}
          activeId={state.activeSessionId}
          onSwitch={id => dispatch({ type: 'SWITCH_SESSION', id })}
          onNew={() => dispatch({ type: 'NEW_SESSION' })}
          onClose={id => dispatch({ type: 'CLOSE_SESSION', id })}
        />
      </div>
      <div className="app-terminal">
        {activeSession && (
          <Terminal
            sessionState={activeSession}
            onDispatch={handleDispatch}
            currentInput={state.currentInput}
          />
        )}
      </div>
      <div className="app-panel">
        {activeSession && (
          <StatusPanel deviceState={activeSession.deviceState} />
        )}
      </div>
    </div>
  );
}

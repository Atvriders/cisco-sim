import { useReducer, useEffect, useRef, useState } from 'react';
import { reducer, createInitialSimState, type SimAction } from './sim/reducer';
import { BOOT_LINES, BOOT_LINE_DELAYS } from './sim/boot';
import BootScreen from './components/BootScreen';
import Terminal from './components/Terminal';
import StatusPanel from './components/StatusPanel';
import TabBar from './components/TabBar';
import Topology from './components/Topology';
import './App.css';

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialSimState);
  const [showTopology, setShowTopology] = useState(false);
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

  // Ctrl+Z global handler + Escape to close topology
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        dispatch({ type: 'EXECUTE', input: 'end' });
      }
      if (e.key === 'Escape') {
        setShowTopology(false);
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
      <div className="app-title-bar">
        CISCO IOS SIMULATOR&nbsp;&nbsp;|&nbsp;&nbsp;WS-C2960X-48TS-L&nbsp;&nbsp;|&nbsp;&nbsp;IOS 15.7(3)M3
      </div>
      <div className="app-tabs">
        <TabBar
          sessions={state.sessions}
          activeId={state.activeSessionId}
          onSwitch={id => { dispatch({ type: 'SWITCH_SESSION', id }); setShowTopology(false); }}
          onNew={() => dispatch({ type: 'NEW_SESSION' })}
          onClose={id => dispatch({ type: 'CLOSE_SESSION', id })}
        />
        <button
          className={`tab topo-tab ${showTopology ? 'active' : ''}`}
          onClick={() => setShowTopology(v => !v)}
          title="Toggle Network Topology"
        >
          ⬡ TOPO
        </button>
      </div>
      <div className="app-terminal">
        {activeSession && !showTopology && (
          <Terminal
            sessionState={activeSession}
            onDispatch={handleDispatch}
            currentInput={state.currentInput}
          />
        )}
        {activeSession && showTopology && (
          <Topology deviceState={activeSession.deviceState} />
        )}
      </div>
      <div className="app-panel">
        {activeSession && (
          <StatusPanel deviceState={activeSession.deviceState} />
        )}
      </div>
      {/* CRT vignette overlay */}
      <div className="crt-vignette" />
    </div>
  );
}

import type { DeviceState, SessionState, TerminalLine } from './types';
import { dispatch } from './commands/dispatcher';
import { createInitialState } from './initialState';
import { loadSavedConfig, saveConfig, clearSavedConfig } from './persist';
import { BOOT_LINES, BOOT_LINE_DELAYS } from './boot';
import { tabComplete } from './completion';

export type SimAction =
  | { type: 'EXECUTE'; input: string }
  | { type: 'HISTORY_UP' }
  | { type: 'HISTORY_DOWN' }
  | { type: 'SET_INPUT'; input: string }
  | { type: 'BOOT_LINE'; index: number }
  | { type: 'BOOT_COMPLETE' }
  | { type: 'SWITCH_SESSION'; id: number }
  | { type: 'NEW_SESSION' }
  | { type: 'CLOSE_SESSION'; id: number }
  | { type: 'TICK'; now: number }
  | { type: 'PENDING_CONFIRM'; answer: string }
  | { type: 'TAB_COMPLETE' };

export interface SimState {
  sessions: SessionState[];
  activeSessionId: number;
  booting: boolean;
  bootLineIndex: number;
  currentInput: string;
}

let _lineId = 10000;
function lid(): string { return String(_lineId++); }
function out(text: string, type: TerminalLine['type'] = 'output'): TerminalLine {
  return { id: lid(), type, text };
}

function buildPrompt(state: DeviceState): string {
  const h = state.hostname;
  const ctx = state.modeContext;
  switch (state.mode) {
    case 'user-exec':     return `${h}>`;
    case 'priv-exec':     return `${h}#`;
    case 'global-config': return `${h}(config)#`;
    case 'if-config':
      return ctx.type === 'interface' ? `${h}(config-if)#` : `${h}(config-if)#`;
    case 'vlan-config':   return `${h}(config-vlan)#`;
    case 'line-config':   return `${h}(config-line)#`;
    case 'router-ospf':
    case 'router-eigrp':
    case 'router-bgp':    return `${h}(config-router)#`;
    default:              return `${h}>`;
  }
}

function mergeDeviceState(current: DeviceState, partial: Partial<DeviceState>): DeviceState {
  const merged = { ...current, ...partial };
  // Deep merge interfaces
  if (partial.interfaces) {
    merged.interfaces = { ...current.interfaces, ...partial.interfaces };
  }
  if (partial.vlans) {
    merged.vlans = { ...current.vlans, ...partial.vlans };
  }
  return merged;
}

function updateSession(session: SessionState, result: ReturnType<typeof dispatch>): SessionState {
  let deviceState = session.deviceState;

  if (result.newState) {
    deviceState = mergeDeviceState(deviceState, result.newState);
  }
  if (result.newMode) {
    deviceState = { ...deviceState, mode: result.newMode };
  }
  if (result.newContext) {
    deviceState = { ...deviceState, modeContext: result.newContext };
  }

  return {
    ...session,
    deviceState,
    lines: [...session.lines, ...result.output],
    pendingInput: result.pendingInput,
    pendingCommand: result.pendingCommand,
  };
}

function createSession(id: number, isVty: boolean, savedConfig?: Partial<DeviceState> | null): SessionState {
  const label = isVty ? `VTY ${id - 1}` : 'CON 0';
  const deviceState = createInitialState(savedConfig);
  return {
    id,
    label,
    lines: [],
    commandHistory: [],
    historyIndex: -1,
    deviceState,
    booted: false,
  };
}

const _savedConfigOnLoad = loadSavedConfig();
const initialDeviceState = createInitialState(_savedConfigOnLoad);

export function createInitialSimState(): SimState {
  return {
    sessions: [createSession(0, false, _savedConfigOnLoad)],
    activeSessionId: 0,
    booting: true,
    bootLineIndex: 0,
    currentInput: '',
  };
}

export function reducer(state: SimState, action: SimAction): SimState {
  const activeSession = state.sessions.find(s => s.id === state.activeSessionId)!;

  switch (action.type) {

    case 'BOOT_LINE': {
      const line = BOOT_LINES[action.index] ?? '';
      const newLine: TerminalLine = { id: lid(), type: 'system', text: line };
      const updatedSessions = state.sessions.map(s =>
        s.id === 0 ? { ...s, lines: [...s.lines, newLine] } : s
      );
      return { ...state, sessions: updatedSessions, bootLineIndex: action.index + 1 };
    }

    case 'BOOT_COMPLETE': {
      const session0 = state.sessions.find(s => s.id === 0);
      const bannerText = session0?.deviceState?.banner || initialDeviceState.banner;
      const bannerLines: TerminalLine[] = [
        out('', 'system'),
        out('', 'system'),
        ...bannerText.trim().split('\n').map(line => out(line, 'info')),
        out('', 'system'),
      ];
      const updatedSessions = state.sessions.map(s =>
        s.id === 0
          ? { ...s, booted: true, lines: [...s.lines, ...bannerLines], deviceState: { ...s.deviceState, mode: 'user-exec' as const } }
          : s
      );
      return { ...state, booting: false, sessions: updatedSessions };
    }

    case 'EXECUTE': {
      const { input } = action;
      const session = activeSession;

      // Handle pending input (e.g., copy running-config startup-config confirmation)
      if (session.pendingInput && session.pendingCommand) {
        const pendingType = session.pendingInput;
        let resultLines: TerminalLine[] = [out(input, 'input')];
        let newDeviceState = session.deviceState;

        if (pendingType === 'enable-password') {
          const enteredPassword = input.trim();
          const correct = session.deviceState.enableSecret === enteredPassword ||
            session.deviceState.enablePassword === enteredPassword;
          if (correct) {
            newDeviceState = { ...newDeviceState, mode: 'priv-exec' as const };
            resultLines = [out('', 'output')];
          } else {
            resultLines = [out('', 'output'), out('% Access denied', 'error'), out('', 'output')];
          }
        } else if (pendingType === 'copy-run-start') {
          const newStartup = { ...session.deviceState };
          newDeviceState = { ...newDeviceState, startupConfig: newStartup, unsavedChanges: false };
          saveConfig(newDeviceState);
          resultLines = resultLines.concat([
            out('Building configuration...'),
            out('[OK]', 'success'),
          ]);
        } else if (pendingType === 'copy-start-run') {
          if (session.deviceState.startupConfig) {
            newDeviceState = { ...session.deviceState.startupConfig as DeviceState, startupConfig: session.deviceState.startupConfig };
          }
          resultLines = resultLines.concat([out('[OK]', 'success')]);
        } else if (pendingType === 'reload-confirm') {
          // Trigger reload: go back to booting state, respecting saved config
          const reloadSavedConfig = loadSavedConfig();
          const newSessions2 = state.sessions.map(s => s.id === state.activeSessionId ? {
            ...s,
            lines: [...s.lines, out(input, 'input'), out('', 'system')],
            pendingInput: undefined,
            pendingCommand: undefined,
            booted: false,
            deviceState: createInitialState(reloadSavedConfig),
          } : s);
          return { ...state, sessions: newSessions2, booting: true, bootLineIndex: 0, currentInput: '' };
        }

        const prompt = buildPrompt(newDeviceState);
        const updatedSession: SessionState = {
          ...session,
          deviceState: newDeviceState,
          lines: [...session.lines, ...resultLines],
          pendingInput: undefined,
          pendingCommand: undefined,
        };
        const promptLine = out(prompt, 'system');
        void promptLine;

        const newSessions = state.sessions.map(s => s.id === state.activeSessionId ? updatedSession : s);
        return { ...state, sessions: newSessions, currentInput: '' };
      }

      // Echo the input with prompt
      const prompt = buildPrompt(session.deviceState);
      const echoLine: TerminalLine = out(`${prompt}${input}`, 'input');

      // Dispatch command
      const result = dispatch(input, session.deviceState);

      // Push to history if non-empty
      let newHistory = session.commandHistory;
      let newHistoryIndex = -1;
      if (input.trim()) {
        newHistory = [input, ...session.commandHistory.slice(0, 99)];
      }

      let updatedSession: SessionState = {
        ...session,
        lines: [...session.lines, echoLine, ...result.output],
        commandHistory: newHistory,
        historyIndex: newHistoryIndex,
        pendingInput: result.pendingInput,
        pendingCommand: result.pendingCommand,
      };

      // Apply state changes
      if (result.newState || result.newMode || result.newContext) {
        let ds = session.deviceState;
        if (result.newState) ds = mergeDeviceState(ds, result.newState);
        if (result.newMode) ds = { ...ds, mode: result.newMode };
        if (result.newContext) ds = { ...ds, modeContext: result.newContext };
        updatedSession = { ...updatedSession, deviceState: ds };

        // Persist to localStorage when write memory saves config
        if (result.newState && result.newState.unsavedChanges === false && result.newState.startupConfig !== undefined) {
          saveConfig(updatedSession.deviceState);
        }
        // Clear localStorage when erase startup-config runs
        if (result.newState && 'startupConfig' in result.newState && result.newState.startupConfig === undefined) {
          clearSavedConfig();
        }
      }

      const newSessions = state.sessions.map(s => s.id === state.activeSessionId ? updatedSession : s);
      return { ...state, sessions: newSessions, currentInput: '' };
    }

    case 'HISTORY_UP': {
      const hist = activeSession.commandHistory;
      if (hist.length === 0) return state;
      const nextIdx = activeSession.historyIndex === -1 ? 0 : Math.min(activeSession.historyIndex + 1, hist.length - 1);
      const newInput = hist[nextIdx] || '';
      const newSessions = state.sessions.map(s =>
        s.id === state.activeSessionId ? { ...s, historyIndex: nextIdx } : s
      );
      return { ...state, sessions: newSessions, currentInput: newInput };
    }

    case 'HISTORY_DOWN': {
      const hist = activeSession.commandHistory;
      if (activeSession.historyIndex <= 0) {
        const newSessions = state.sessions.map(s =>
          s.id === state.activeSessionId ? { ...s, historyIndex: -1 } : s
        );
        return { ...state, sessions: newSessions, currentInput: '' };
      }
      const nextIdx = activeSession.historyIndex - 1;
      const newInput = hist[nextIdx] || '';
      const newSessions = state.sessions.map(s =>
        s.id === state.activeSessionId ? { ...s, historyIndex: nextIdx } : s
      );
      return { ...state, sessions: newSessions, currentInput: newInput };
    }

    case 'SET_INPUT': {
      return { ...state, currentInput: action.input };
    }

    case 'TAB_COMPLETE': {
      const { newInput, displayLines } = tabComplete(state.currentInput, activeSession.deviceState);
      if (displayLines.length > 0) {
        const prompt = buildPrompt(activeSession.deviceState);
        const helpLines: TerminalLine[] = [
          out(`${prompt}${state.currentInput}`, 'input'),
          ...displayLines.map(l => out('  ' + l, 'info'))
        ];
        const newSessions = state.sessions.map(s =>
          s.id === state.activeSessionId ? { ...s, lines: [...s.lines, ...helpLines] } : s
        );
        return { ...state, sessions: newSessions, currentInput: newInput };
      }
      return { ...state, currentInput: newInput };
    }

    case 'SWITCH_SESSION': {
      return { ...state, activeSessionId: action.id };
    }

    case 'NEW_SESSION': {
      if (state.sessions.length >= 5) return state;
      const newId = Math.max(...state.sessions.map(s => s.id)) + 1;
      const refSession = state.sessions.find(s => s.id === state.activeSessionId) || state.sessions[0];
      const refBanner = refSession?.deviceState?.banner || initialDeviceState.banner;
      const newSession = createSession(newId, true, _savedConfigOnLoad);
      // New sessions start in booted state with banner
      const bootedSession: SessionState = {
        ...newSession,
        booted: true,
        lines: [
          out('', 'system'),
          ...refBanner.trim().split('\n').map(line => out(line, 'info')),
          out('', 'system'),
        ],
      };
      return {
        ...state,
        sessions: [...state.sessions, bootedSession],
        activeSessionId: newId
      };
    }

    case 'CLOSE_SESSION': {
      if (state.sessions.length <= 1) return state;
      const remaining = state.sessions.filter(s => s.id !== action.id);
      const newActive = remaining.find(s => s.id === state.activeSessionId)
        ? state.activeSessionId
        : remaining[remaining.length - 1].id;
      return { ...state, sessions: remaining, activeSessionId: newActive };
    }

    case 'TICK': {
      const newSessions = state.sessions.map(s => {
        const ds = s.deviceState;
        // Increment uptime
        const updatedIfaces = { ...ds.interfaces };
        for (const id of Object.keys(updatedIfaces)) {
          const iface = updatedIfaces[id];
          if (iface.lineState === 'up') {
            // Small random packet increment
            const pktInc = Math.random() < 0.3 ? Math.floor(Math.random() * 3) : 0;
            const pktOut = Math.random() < 0.3 ? Math.floor(Math.random() * 3) : 0;
            if (pktInc > 0 || pktOut > 0) {
              updatedIfaces[id] = {
                ...iface,
                inputPackets: iface.inputPackets + pktInc,
                outputPackets: iface.outputPackets + pktOut,
                inputBytes: iface.inputBytes + pktInc * 128,
                outputBytes: iface.outputBytes + pktOut * 128,
              };
            }
          }
        }
        return { ...s, deviceState: { ...ds, currentTime: action.now, interfaces: updatedIfaces } };
      });
      return { ...state, sessions: newSessions };
    }

    case 'PENDING_CONFIRM': {
      return reducer(state, { type: 'EXECUTE', input: action.answer });
    }

    default:
      return state;
  }
}

export { buildPrompt, BOOT_LINES, BOOT_LINE_DELAYS };

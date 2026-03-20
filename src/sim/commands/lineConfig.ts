import type { CommandHandler, TerminalLine, LineConfig } from '../types';

let _lineId = 6000;
function lid(): string { return String(_lineId++); }
function out(text: string, type: TerminalLine['type'] = 'output'): TerminalLine {
  return { id: lid(), type, text };
}

export const lineConfigHandler: CommandHandler = (args, state, _raw, negated) => {
  const cmd = (args[0] || '').toLowerCase();

  if (cmd === 'end') {
    return { output: [], newMode: 'priv-exec', newContext: { type: 'none' } };
  }
  if (cmd === 'exit') {
    return { output: [], newMode: 'global-config', newContext: { type: 'none' } };
  }

  const ctx = state.modeContext;
  if (ctx.type !== 'line') {
    return { output: [out('% No line context', 'error')] };
  }

  const { lineType, start, end } = ctx;

  const updateLines = (updates: Partial<LineConfig>): ReturnType<typeof lineConfigHandler> => {
    const newLines = state.lines.map(l => {
      if (l.line === lineType && l.start === start && l.end === end) {
        return { ...l, ...updates };
      }
      return l;
    });
    // If line config doesn't exist, create it
    const exists = state.lines.some(l => l.line === lineType && l.start === start && l.end === end);
    if (!exists) {
      const newLine: LineConfig = {
        line: lineType,
        start, end,
        login: 'none',
        execTimeout: 600,
        transportInput: ['all'],
        loggingSynchronous: false,
        privilegeLevel: 1,
        ...updates
      };
      return {
        output: [],
        newState: { lines: [...state.lines, newLine], unsavedChanges: true }
      };
    }
    return {
      output: [],
      newState: { lines: newLines, unsavedChanges: true }
    };
  };

  if (cmd === 'login') {
    const sub = (args[1] || '').toLowerCase();
    if (negated) return updateLines({ login: 'none' });
    if (sub === 'local') return updateLines({ login: 'local' });
    return updateLines({ login: 'password' });
  }

  if (cmd === 'password') {
    if (negated) return updateLines({ password: undefined });
    const pwd = args[1];
    if (!pwd) return { output: [out('% Incomplete command.', 'error')] };
    return updateLines({ password: pwd });
  }

  if (cmd === 'exec-timeout') {
    if (negated) return updateLines({ execTimeout: 600 });
    const min = parseInt(args[1] || '10');
    const sec = parseInt(args[2] || '0');
    return updateLines({ execTimeout: min * 60 + sec });
  }

  if (cmd === 'transport') {
    const sub = (args[1] || '').toLowerCase();
    if (sub === 'input') {
      if (negated) return updateLines({ transportInput: [] });
      const inputs = args.slice(2).map(s => s.toLowerCase());
      return updateLines({ transportInput: inputs });
    }
    return { output: [out('% Unknown transport command', 'error')] };
  }

  if (cmd === 'logging') {
    const sub = (args[1] || '').toLowerCase();
    if (sub === 'synchronous') {
      return updateLines({ loggingSynchronous: !negated });
    }
    return { output: [out('% Unknown logging command', 'error')] };
  }

  if (cmd === 'privilege') {
    const sub = (args[1] || '').toLowerCase();
    if (sub === 'level') {
      if (negated) return updateLines({ privilegeLevel: 1 });
      const level = parseInt(args[2] || '1');
      return updateLines({ privilegeLevel: level });
    }
    return { output: [out('% Unknown privilege command', 'error')] };
  }

  return { output: [out(`% Unknown line config command: ${args[0] || ''}`, 'error')] };
};

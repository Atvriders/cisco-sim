import type { CommandHandler, TerminalLine } from '../types';

let _lineId = 5000;
function lid(): string { return String(_lineId++); }
function out(text: string, type: TerminalLine['type'] = 'output'): TerminalLine {
  return { id: lid(), type, text };
}

export const vlanConfigHandler: CommandHandler = (args, state, _raw, negated) => {
  const cmd = (args[0] || '').toLowerCase();

  if (cmd === 'end') {
    return { output: [], newMode: 'priv-exec', newContext: { type: 'none' } };
  }
  if (cmd === 'exit') {
    return { output: [], newMode: 'global-config', newContext: { type: 'none' } };
  }

  const ctx = state.modeContext;
  if (ctx.type !== 'vlan') {
    return { output: [out('% No VLAN context', 'error')] };
  }

  const vlanId = ctx.vlanId;
  const vlan = state.vlans[vlanId];
  if (!vlan) {
    return { output: [out(`% VLAN ${vlanId} not found`, 'error')] };
  }

  if (cmd === 'name') {
    if (negated) {
      const defaultName = vlanId === 1 ? 'default' : `VLAN${String(vlanId).padStart(4, '0')}`;
      return {
        output: [],
        newState: {
          vlans: { ...state.vlans, [vlanId]: { ...vlan, name: defaultName } },
          unsavedChanges: true
        }
      };
    }
    const name = args.slice(1).join(' ');
    if (!name) return { output: [out('% Incomplete command.', 'error')] };
    return {
      output: [],
      newState: {
        vlans: { ...state.vlans, [vlanId]: { ...vlan, name } },
        unsavedChanges: true
      }
    };
  }

  if (cmd === 'state') {
    if (negated) {
      return {
        output: [],
        newState: {
          vlans: { ...state.vlans, [vlanId]: { ...vlan, state: 'active' } },
          unsavedChanges: true
        }
      };
    }
    const newState = (args[1] || 'active').toLowerCase() as 'active' | 'suspend';
    return {
      output: [],
      newState: {
        vlans: { ...state.vlans, [vlanId]: { ...vlan, state: newState } },
        unsavedChanges: true
      }
    };
  }

  return { output: [out(`% Unknown VLAN config command: ${args[0] || ''}`, 'error')] };
};

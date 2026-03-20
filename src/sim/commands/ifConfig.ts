import type { CommandHandler, TerminalLine, Interface } from '../types';
import { showHandler } from './show';

let _lineId = 4000;
function lid(): string { return String(_lineId++); }
function out(text: string, type: TerminalLine['type'] = 'output'): TerminalLine {
  return { id: lid(), type, text };
}

function parseVlanList(existing: string, cmd: string, list: string): string {
  if (!cmd || cmd === 'none') return '';
  if (cmd === 'all') return '1-4094';

  const parseRangeToSet = (s: string): Set<number> => {
    const result = new Set<number>();
    for (const part of s.split(',')) {
      const range = part.trim().split('-');
      const start = parseInt(range[0]);
      const end = parseInt(range[1] || range[0]);
      if (!isNaN(start) && !isNaN(end)) {
        for (let v = start; v <= end; v++) result.add(v);
      }
    }
    return result;
  };

  const setToRangeStr = (s: Set<number>): string => {
    const sorted = Array.from(s).sort((a, b) => a - b);
    if (sorted.length === 0) return '';
    const ranges: string[] = [];
    let start = sorted[0];
    let prev = sorted[0];
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === prev + 1) {
        prev = sorted[i];
      } else {
        ranges.push(start === prev ? String(start) : `${start}-${prev}`);
        start = sorted[i];
        prev = sorted[i];
      }
    }
    ranges.push(start === prev ? String(start) : `${start}-${prev}`);
    return ranges.join(',');
  };

  const existingSet = parseRangeToSet(existing);
  const newSet = parseRangeToSet(list);

  if (!cmd || cmd === 'replace') return list;
  if (cmd === 'add') {
    for (const v of newSet) existingSet.add(v);
    return setToRangeStr(existingSet);
  }
  if (cmd === 'remove') {
    for (const v of newSet) existingSet.delete(v);
    return setToRangeStr(existingSet);
  }
  if (cmd === 'except') {
    const all = parseRangeToSet('1-4094');
    for (const v of newSet) all.delete(v);
    return setToRangeStr(all);
  }
  return list;
}

export const ifConfigHandler: CommandHandler = (args, state, _raw, negated) => {
  const cmd = (args[0] || '').toLowerCase();

  if (cmd === 'end') {
    return { output: [], newMode: 'priv-exec', newContext: { type: 'none' } };
  }
  if (cmd === 'exit') {
    return { output: [], newMode: 'global-config', newContext: { type: 'none' } };
  }
  if (cmd === 'do') {
    return showHandler(args.slice(1), state, args.slice(1).join(' '), false);
  }

  const ctx = state.modeContext;
  if (ctx.type !== 'interface') {
    return { output: [out('% No interface context', 'error')] };
  }

  const ifId = ctx.interfaceId;
  const iface: Interface | undefined = state.interfaces[ifId];
  if (!iface) {
    return { output: [out(`% Interface ${ifId} not found`, 'error')] };
  }

  const updateIface = (updates: Partial<Interface>): ReturnType<typeof ifConfigHandler> => ({
    output: [],
    newState: {
      interfaces: { ...state.interfaces, [ifId]: { ...iface, ...updates } },
      unsavedChanges: true
    }
  });

  if (cmd === 'description') {
    if (negated) return updateIface({ description: '' });
    return updateIface({ description: args.slice(1).join(' ') });
  }

  if (cmd === 'ip') {
    const sub = (args[1] || '').toLowerCase();

    if (sub === 'address') {
      if (negated) {
        return updateIface({ ipAddresses: [] });
      }
      const ip = args[2];
      const mask = args[3];
      const secondary = args[4]?.toLowerCase() === 'secondary';
      if (!ip || !mask) return { output: [out('% Incomplete command.', 'error')] };
      const newAddrs = secondary
        ? [...iface.ipAddresses.filter(a => !a.secondary), { address: ip, mask, secondary: true }]
        : [{ address: ip, mask }, ...iface.ipAddresses.filter(a => a.secondary)];
      return updateIface({ ipAddresses: newAddrs });
    }

    if (sub === 'helper-address') {
      const helperIp = args[2];
      if (!helperIp) return { output: [out('% Incomplete command.', 'error')] };
      if (negated) {
        return updateIface({ ipHelperAddresses: iface.ipHelperAddresses.filter(h => h !== helperIp) });
      }
      return updateIface({ ipHelperAddresses: [...iface.ipHelperAddresses, helperIp] });
    }

    if (sub === 'access-group') {
      const acl = args[2];
      const dir = (args[3] || '').toLowerCase() as 'in' | 'out';
      if (!acl || !dir) return { output: [out('% Incomplete command.', 'error')] };
      if (negated) {
        return updateIface({ ipAccessGroups: iface.ipAccessGroups.filter(a => !(a.acl === acl && a.direction === dir)) });
      }
      const newGroups = iface.ipAccessGroups.filter(a => a.direction !== dir);
      newGroups.push({ acl, direction: dir });
      return updateIface({ ipAccessGroups: newGroups });
    }

    if (sub === 'ospf') {
      const sub2 = (args[2] || '').toLowerCase();
      if (sub2 === 'cost') {
        if (negated) return updateIface({ ospfCost: undefined });
        return updateIface({ ospfCost: parseInt(args[3] || '1') });
      }
      if (sub2 === 'priority') {
        if (negated) return updateIface({ ospfPriority: undefined });
        return updateIface({ ospfPriority: parseInt(args[3] || '1') });
      }
    }

    return { output: [out(`% Unknown ip subcommand: ${sub}`, 'error')] };
  }

  if (cmd === 'shutdown') {
    return updateIface({
      adminState: 'down',
      lineState: 'down'
    });
  }

  if (cmd === 'no' && (args[1] || '').toLowerCase() === 'shutdown') {
    // Ports Fa0/1, Fa0/3, Fa0/5 are "connected" (cable plugged in)
    const connectedPorts = new Set(['Fa0/1', 'Fa0/3', 'Fa0/5', 'Gi0/1', 'Gi0/2']);
    let newLineState: typeof iface.lineState;
    if (iface.id.startsWith('Vlan') || iface.id.startsWith('Loopback')) {
      newLineState = 'up';
    } else if (connectedPorts.has(iface.id)) {
      newLineState = 'up';
    } else {
      newLineState = 'notconnect';
    }
    return updateIface({
      adminState: 'up',
      lineState: newLineState
    });
  }

  if (cmd === 'duplex') {
    if (negated) return updateIface({ duplex: 'auto' });
    const val = args[1]?.toLowerCase();
    if (!val) return { output: [out('% Incomplete command.', 'error')] };
    if (!['auto', 'full', 'half'].includes(val)) return { output: [out('% Invalid duplex value', 'error')] };
    return updateIface({ duplex: val as 'auto' | 'full' | 'half' });
  }

  if (cmd === 'speed') {
    if (negated) return updateIface({ speed: 'auto' });
    const val = args[1]?.toLowerCase();
    if (!val) return { output: [out('% Incomplete command.', 'error')] };
    return updateIface({ speed: val as '10' | '100' | '1000' | 'auto' });
  }

  if (cmd === 'mtu') {
    if (negated) return updateIface({ mtu: 1500 });
    const val = parseInt(args[1] || '1500');
    if (isNaN(val)) return { output: [out('% Invalid MTU', 'error')] };
    return updateIface({ mtu: val });
  }

  if (cmd === 'switchport') {
    const sub = (args[1] || '').toLowerCase();

    if (sub === 'mode') {
      const mode = (args[2] || '').toLowerCase();
      if (!mode) return { output: [out('% Incomplete command.', 'error')] };
      const validModes = ['access', 'trunk', 'dynamic-auto', 'dynamic-desirable'];
      if (!validModes.includes(mode)) {
        const partial = validModes.find(m => m.startsWith(mode));
        if (!partial) return { output: [out('% Invalid switchport mode', 'error')] };
        return updateIface({ switchportMode: partial as Interface['switchportMode'] });
      }
      return updateIface({ switchportMode: mode as Interface['switchportMode'] });
    }

    if (sub === 'access') {
      const sub2 = (args[2] || '').toLowerCase();
      if (sub2 === 'vlan') {
        if (negated) return updateIface({ accessVlan: 1 });
        const vid = parseInt(args[3] || '1');
        return updateIface({ accessVlan: vid });
      }
    }

    if (sub === 'trunk') {
      const sub2 = (args[2] || '').toLowerCase();
      if (sub2 === 'allowed') {
        const sub3 = (args[3] || '').toLowerCase();
        if (sub3 === 'vlan') {
          const modifierOrList = (args[4] || '').toLowerCase();
          const modifiers = ['add', 'remove', 'except', 'all', 'none'];
          let modifier = '';
          let vlanList = modifierOrList;
          if (modifiers.includes(modifierOrList)) {
            modifier = modifierOrList;
            vlanList = args[5] || '';
          }
          if (negated || modifier === 'none') return updateIface({ trunkAllowedVlans: '' });
          if (modifier === 'all') return updateIface({ trunkAllowedVlans: '1-4094' });
          const newList = parseVlanList(iface.trunkAllowedVlans, modifier, vlanList);
          return updateIface({ trunkAllowedVlans: newList });
        }
      }
      if (sub2 === 'native') {
        const sub3 = (args[3] || '').toLowerCase();
        if (sub3 === 'vlan') {
          if (negated) return updateIface({ trunkNativeVlan: 1 });
          const vid = parseInt(args[4] || '1');
          return updateIface({ trunkNativeVlan: vid });
        }
      }
    }

    if (sub === 'nonegotiate') {
      return updateIface({});
    }

    if (sub === 'port-security') {
      const sub2 = (args[2] || '').toLowerCase();
      if (!sub2) {
        if (negated) return updateIface({ portSecurity: { ...iface.portSecurity, enabled: false } });
        return updateIface({ portSecurity: { ...iface.portSecurity, enabled: true } });
      }
      if (sub2 === 'maximum') {
        if (negated) return updateIface({ portSecurity: { ...iface.portSecurity, maxMacAddresses: 1 } });
        const maxVal = parseInt(args[3] || '1');
        return updateIface({ portSecurity: { ...iface.portSecurity, maxMacAddresses: maxVal } });
      }
      if (sub2 === 'violation') {
        if (negated) return updateIface({ portSecurity: { ...iface.portSecurity, violation: 'shutdown' } });
        const viol = (args[3] || 'shutdown').toLowerCase() as 'protect' | 'restrict' | 'shutdown';
        return updateIface({ portSecurity: { ...iface.portSecurity, violation: viol } });
      }
      if (sub2 === 'sticky') {
        return updateIface({ portSecurity: { ...iface.portSecurity, stickyLearning: !negated } });
      }
    }

    return { output: [out(`% Unknown switchport subcommand: ${sub}`, 'error')] };
  }

  if (cmd === 'spanning-tree') {
    const sub = (args[1] || '').toLowerCase();
    if (sub === 'portfast') {
      return updateIface({ spanningTree: { ...iface.spanningTree, portfast: !negated } });
    }
    if (sub === 'bpduguard') {
      const val = (args[2] || '').toLowerCase();
      const enabled = negated ? false : val === 'enable' || val === '';
      return updateIface({ spanningTree: { ...iface.spanningTree, bpduguard: enabled } });
    }
    if (sub === 'bpdufilter') {
      return updateIface({ spanningTree: { ...iface.spanningTree, bpdufilter: !negated } });
    }
    if (sub === 'cost') {
      if (negated) return updateIface({ spanningTree: { ...iface.spanningTree, cost: undefined } });
      const cost = parseInt(args[2] || '19');
      return updateIface({ spanningTree: { ...iface.spanningTree, cost } });
    }
    if (sub === 'port-priority') {
      if (negated) return updateIface({ spanningTree: { ...iface.spanningTree, priority: undefined } });
      const pri = parseInt(args[2] || '128');
      return updateIface({ spanningTree: { ...iface.spanningTree, priority: pri } });
    }
    return { output: [out('% Unknown spanning-tree command', 'error')] };
  }

  if (cmd === 'channel-group') {
    if (negated) return updateIface({ channelGroup: undefined });
    const num = parseInt(args[1] || '1');
    const mode = (args[3] || 'on').toLowerCase() as 'active' | 'passive' | 'on';
    const result = updateIface({ channelGroup: { number: num, mode } });
    // Emit message only if this is a new port-channel group
    const alreadyExists = Object.values(state.interfaces).some(
      i => i.id !== ifId && i.channelGroup?.number === num
    );
    if (!alreadyExists && !iface.channelGroup) {
      result.output = [out(`Creating a port-channel interface Port-channel ${num}`)];
    }
    return result;
  }

  if (cmd === 'storm-control') {
    const sub = (args[1] || '').toLowerCase();
    if (sub === 'broadcast') {
      const sub2 = (args[2] || '').toLowerCase();
      if (sub2 === 'level') {
        if (negated) return updateIface({ broadcastLevel: undefined });
        const level = parseFloat(args[3] || '100');
        return updateIface({ broadcastLevel: level });
      }
    }
    return { output: [] };
  }

  return { output: [out(`% Unknown interface command: ${args[0] || ''}`, 'error')] };
};

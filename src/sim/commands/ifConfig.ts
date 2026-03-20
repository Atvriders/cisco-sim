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

  const updateIface = (updates: Partial<Interface>): ReturnType<typeof ifConfigHandler> => {
    const rangeIds = ctx.type === 'interface' && ctx.interfaceIds ? ctx.interfaceIds : [ifId];
    const updatedInterfaces = { ...state.interfaces };
    for (const id of rangeIds) {
      const target = updatedInterfaces[id];
      if (target) {
        updatedInterfaces[id] = { ...target, ...updates };
      }
    }
    return {
      output: [],
      newState: { interfaces: updatedInterfaces, unsavedChanges: true }
    };
  };

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
        ? [...iface.ipAddresses.filter(a => a.address !== ip), { address: ip, mask, secondary: true }]
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

    if (sub === 'dhcp') {
      const sub2 = (args[2] || '').toLowerCase();
      if (sub2 === 'snooping') {
        const sub3 = (args[3] || '').toLowerCase();
        if (sub3 === 'trust') {
          // ip dhcp snooping trust  /  no ip dhcp snooping trust
          const trusted = state.dhcpSnooping.trustedPorts;
          if (negated) {
            return {
              output: [],
              newState: {
                dhcpSnooping: { ...state.dhcpSnooping, trustedPorts: trusted.filter(p => p !== ifId) },
                unsavedChanges: true
              }
            };
          }
          if (!trusted.includes(ifId)) {
            return {
              output: [],
              newState: {
                dhcpSnooping: { ...state.dhcpSnooping, trustedPorts: [...trusted, ifId] },
                unsavedChanges: true
              }
            };
          }
          return { output: [], newState: { unsavedChanges: true } };
        }
        if (sub3 === 'rate') {
          const sub4 = (args[4] || '').toLowerCase();
          if (sub4 === 'limit') {
            if (negated) {
              return {
                output: [],
                newState: {
                  dhcpSnooping: { ...state.dhcpSnooping, rateLimits: state.dhcpSnooping.rateLimits.filter(r => r.port !== ifId) },
                  unsavedChanges: true
                }
              };
            }
            const pps = parseInt(args[5] || '100');
            const newRateLimits = state.dhcpSnooping.rateLimits.filter(r => r.port !== ifId);
            newRateLimits.push({ port: ifId, pps });
            return {
              output: [],
              newState: { dhcpSnooping: { ...state.dhcpSnooping, rateLimits: newRateLimits }, unsavedChanges: true }
            };
          }
        }
      }
      return { output: [], newState: { unsavedChanges: true } };
    }

    if (sub === 'arp') {
      const sub2 = (args[2] || '').toLowerCase();
      if (sub2 === 'inspection') {
        const sub3 = (args[3] || '').toLowerCase();
        if (sub3 === 'trust') {
          const trusted = state.dai.trustedPorts;
          if (negated) {
            return {
              output: [],
              newState: {
                dai: { ...state.dai, trustedPorts: trusted.filter(p => p !== ifId) },
                unsavedChanges: true
              }
            };
          }
          if (!trusted.includes(ifId)) {
            return {
              output: [],
              newState: {
                dai: { ...state.dai, trustedPorts: [...trusted, ifId] },
                unsavedChanges: true
              }
            };
          }
          return { output: [], newState: { unsavedChanges: true } };
        }
      }
      return { output: [], newState: { unsavedChanges: true } };
    }

    if (sub === 'verify') {
      // ip verify source  /  ip verify source port-security  /  no ip verify source
      // Just acknowledge — IP Source Guard binding state is managed globally
      return { output: [], newState: { unsavedChanges: true } };
    }

    if (sub === 'pim') {
      // ip pim sparse-mode / ip pim sparse-dense-mode / ip pim dense-mode
      return { output: [], newState: { unsavedChanges: true } };
    }

    if (sub === 'igmp') {
      const sub2 = (args[2] || '').toLowerCase();
      if (sub2 === 'version' || sub2 === 'query-interval') {
        return { output: [], newState: { unsavedChanges: true } };
      }
      return { output: [], newState: { unsavedChanges: true } };
    }

    return { output: [out(`% Unknown ip subcommand: ${sub}`, 'error')] };
  }

  if (cmd === 'shutdown') {
    if (negated) {
      // no shutdown — bring interface up
      const connectedPorts = new Set(['Fa0/1', 'Fa0/3', 'Fa0/5', 'Gi0/1', 'Gi0/2']);
      let newLineState: typeof iface.lineState;
      if (iface.id.startsWith('Vlan') || iface.id.startsWith('Loopback')) {
        newLineState = 'up';
      } else if (connectedPorts.has(iface.id)) {
        newLineState = 'up';
      } else {
        newLineState = 'notconnect';
      }
      const result = updateIface({ adminState: 'up', lineState: newLineState });
      if (newLineState === 'up') {
        result.output = [
          out(`%LINK-3-UPDOWN: Interface ${iface.id}, changed state to up`, 'system'),
          out(`%LINEPROTO-5-UPDOWN: Line protocol on Interface ${iface.id}, changed state to up`, 'system'),
        ];
      }
      return result;
    }
    const result = updateIface({ adminState: 'down', lineState: 'down' });
    result.output = [
      out(`%LINK-5-CHANGED: Interface ${iface.id}, changed state to administratively down`, 'system'),
      out(`%LINEPROTO-5-UPDOWN: Line protocol on Interface ${iface.id}, changed state to down`, 'system'),
    ];
    return result;
  }

  // Legacy path: explicit "no shutdown" if args[0]==='no' (shouldn't occur with current dispatcher but kept for safety)
  if (cmd === 'no' && (args[1] || '').toLowerCase() === 'shutdown') {
    const connectedPorts = new Set(['Fa0/1', 'Fa0/3', 'Fa0/5', 'Gi0/1', 'Gi0/2']);
    let newLineState: typeof iface.lineState;
    if (iface.id.startsWith('Vlan') || iface.id.startsWith('Loopback')) {
      newLineState = 'up';
    } else if (connectedPorts.has(iface.id)) {
      newLineState = 'up';
    } else {
      newLineState = 'notconnect';
    }
    const result = updateIface({ adminState: 'up', lineState: newLineState });
    if (newLineState === 'up') {
      result.output = [
        out(`%LINK-3-UPDOWN: Interface ${iface.id}, changed state to up`, 'system'),
        out(`%LINEPROTO-5-UPDOWN: Line protocol on Interface ${iface.id}, changed state to up`, 'system'),
      ];
    }
    return result;
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

    if (sub === 'voice') {
      const sub2 = (args[2] || '').toLowerCase();
      if (sub2 === 'vlan') {
        // Voice VLAN - acknowledge without storing (no voiceVlan field in Interface type)
        return { output: [], newState: { unsavedChanges: true } };
      }
      return { output: [out('% Unknown switchport voice subcommand', 'error')] };
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
    if (sub === 'guard') {
      // spanning-tree guard root / spanning-tree guard loop
      return { output: [], newState: { unsavedChanges: true } };
    }
    if (sub === 'link-type') {
      // spanning-tree link-type point-to-point | shared
      return { output: [], newState: { unsavedChanges: true } };
    }
    return { output: [out('% Unknown spanning-tree command', 'error')] };
  }

  if (cmd === 'channel-group') {
    if (negated) {
      // Remove from portChannels if present
      const oldNum = iface.channelGroup?.number;
      if (oldNum !== undefined) {
        const newPCs = state.portChannels.map(pc => {
          if (pc.id === `Port-channel${oldNum}`) {
            return { ...pc, members: pc.members.filter(m => m !== ifId) };
          }
          return pc;
        }).filter(pc => pc.members.length > 0);
        return {
          output: [],
          newState: {
            interfaces: { ...state.interfaces, [ifId]: { ...iface, channelGroup: undefined } },
            portChannels: newPCs,
            unsavedChanges: true
          }
        };
      }
      return updateIface({ channelGroup: undefined });
    }
    const num = parseInt(args[1] || '1');
    const rawMode = (args[3] || 'on').toLowerCase();
    const mode = (['active','passive','on','desirable','auto'].includes(rawMode) ? rawMode : 'on') as 'active' | 'passive' | 'on' | 'desirable' | 'auto';
    // Determine if this is a new group
    const alreadyExists = Object.values(state.interfaces).some(
      i => i.id !== ifId && i.channelGroup?.number === num
    );
    const isNew = !alreadyExists && !iface.channelGroup;
    const cgMode: 'active' | 'passive' | 'on' = (mode === 'active' || mode === 'passive') ? mode : 'on';
    const result = updateIface({ channelGroup: { number: num, mode: cgMode } });
    if (isNew) {
      result.output = [out(`Creating a port-channel interface Port-channel${num}`)];
    }
    // Update portChannels in state
    const pcId = `Port-channel${num}`;
    const proto: 'lacp' | 'pagp' | 'none' = (mode === 'active' || mode === 'passive') ? 'lacp' : (mode === 'desirable' || mode === 'auto') ? 'pagp' : 'none';
    const existingPC = state.portChannels.find(pc => pc.id === pcId);
    const updatedPC = existingPC
      ? { ...existingPC, members: existingPC.members.includes(ifId) ? existingPC.members : [...existingPC.members, ifId], mode: mode as 'active' | 'passive' | 'on' | 'desirable' | 'auto' }
      : { id: pcId, members: [ifId], protocol: proto as 'lacp' | 'pagp' | 'none', mode: mode as 'active' | 'passive' | 'on' | 'desirable' | 'auto', adminState: 'up' as const, lineState: 'up' as const };
    result.newState = {
      ...result.newState,
      portChannels: [...state.portChannels.filter(pc => pc.id !== pcId), updatedPC]
    };
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

  if (cmd === 'ipv6') {
    const sub = (args[1] || '').toLowerCase();
    if (sub === 'address') {
      if (negated) {
        return updateIface({ ipv6Addresses: [], ipv6Enabled: false });
      }
      const addrArg = args[2]; // e.g. "2001:db8::1/64"
      if (!addrArg) return { output: [out('% Incomplete command.', 'error')] };
      const isEui64 = (args[3] || '').toLowerCase() === 'eui-64';
      const slashIdx = addrArg.lastIndexOf('/');
      const address = slashIdx >= 0 ? addrArg.slice(0, slashIdx) : addrArg;
      const prefixLength = slashIdx >= 0 ? parseInt(addrArg.slice(slashIdx + 1)) : 64;
      const type = isEui64 ? 'eui-64' as const : 'manual' as const;
      const newAddr = { address, prefixLength, type };
      const existing = (iface.ipv6Addresses || []).filter(a => a.type !== 'link-local');
      return updateIface({ ipv6Addresses: [...existing, newAddr], ipv6Enabled: true });
    }
    if (sub === 'enable') {
      if (negated) {
        return updateIface({ ipv6Enabled: false });
      }
      return updateIface({ ipv6Enabled: true });
    }
    return { output: [out(`% Unknown ipv6 subcommand: ${sub}`, 'error')] };
  }

  if (cmd === 'lldp') {
    const sub = (args[1] || '').toLowerCase();
    if (sub === 'transmit') {
      return updateIface({ lldpTransmit: !negated });
    }
    if (sub === 'receive') {
      return updateIface({ lldpReceive: !negated });
    }
    return { output: [out('% Unknown lldp command', 'error')] };
  }

  if (cmd === 'cdp') {
    const sub = (args[1] || '').toLowerCase();
    if (sub === 'enable' || sub === '') {
      return updateIface({ cdpEnabled: !negated });
    }
    return { output: [out('% Unknown cdp interface command', 'error')] };
  }

  if (cmd === 'ip' && (args[1] || '').toLowerCase() === 'nat') {
    const natSub = (args[2] || '').toLowerCase();
    if (natSub === 'inside') {
      if (negated) {
        return {
          output: [],
          newState: {
            natConfig: { ...state.natConfig, insideInterfaces: state.natConfig.insideInterfaces.filter(i => i !== ifId) },
            unsavedChanges: true
          }
        };
      }
      return {
        output: [],
        newState: {
          natConfig: { ...state.natConfig, insideInterfaces: [...state.natConfig.insideInterfaces.filter(i => i !== ifId), ifId] },
          unsavedChanges: true
        }
      };
    }
    if (natSub === 'outside') {
      if (negated) {
        return {
          output: [],
          newState: {
            natConfig: { ...state.natConfig, outsideInterfaces: state.natConfig.outsideInterfaces.filter(i => i !== ifId) },
            unsavedChanges: true
          }
        };
      }
      return {
        output: [],
        newState: {
          natConfig: { ...state.natConfig, outsideInterfaces: [...state.natConfig.outsideInterfaces.filter(i => i !== ifId), ifId] },
          unsavedChanges: true
        }
      };
    }
  }

  if (cmd === 'standby') {
    const groupNum = parseInt(args[1] || '0');
    const sub = (args[2] || '').toLowerCase();

    if (negated && !args[2]) {
      return {
        output: [],
        newState: { hsrpGroups: state.hsrpGroups.filter(g => !(g.interfaceId === ifId && g.groupNumber === groupNum)), unsavedChanges: true }
      };
    }

    const existingGroup = state.hsrpGroups.find(g => g.interfaceId === ifId && g.groupNumber === groupNum);
    const baseGroup = existingGroup || {
      interfaceId: ifId,
      groupNumber: groupNum,
      virtualIp: '',
      priority: 100,
      preempt: false,
      state: 'Init' as const,
      activeRouter: 'unknown',
      standbyRouter: 'unknown',
      helloTime: 3,
      holdTime: 10,
    };

    if (sub === 'ip') {
      const vip = args[3];
      if (!vip) return { output: [out('% Incomplete command.', 'error')] };
      const updatedGroup = { ...baseGroup, virtualIp: vip, state: 'Active' as const, activeRouter: iface.ipAddresses[0]?.address || 'local' };
      const newGroups = [...state.hsrpGroups.filter(g => !(g.interfaceId === ifId && g.groupNumber === groupNum)), updatedGroup];
      return { output: [], newState: { hsrpGroups: newGroups, unsavedChanges: true } };
    }

    if (sub === 'priority') {
      const pri = parseInt(args[3] || '100');
      const updatedGroup = { ...baseGroup, priority: pri };
      const newGroups = [...state.hsrpGroups.filter(g => !(g.interfaceId === ifId && g.groupNumber === groupNum)), updatedGroup];
      return { output: [], newState: { hsrpGroups: newGroups, unsavedChanges: true } };
    }

    if (sub === 'preempt') {
      const updatedGroup = { ...baseGroup, preempt: !negated };
      const newGroups = [...state.hsrpGroups.filter(g => !(g.interfaceId === ifId && g.groupNumber === groupNum)), updatedGroup];
      return { output: [], newState: { hsrpGroups: newGroups, unsavedChanges: true } };
    }

    if (sub === 'timers') {
      const hello = parseInt(args[3] || '3');
      const hold = parseInt(args[4] || '10');
      const updatedGroup = { ...baseGroup, helloTime: hello, holdTime: hold };
      const newGroups = [...state.hsrpGroups.filter(g => !(g.interfaceId === ifId && g.groupNumber === groupNum)), updatedGroup];
      return { output: [], newState: { hsrpGroups: newGroups, unsavedChanges: true } };
    }

    if (sub === 'authentication') {
      const auth = args[3];
      const updatedGroup = { ...baseGroup, authentication: negated ? undefined : auth };
      const newGroups = [...state.hsrpGroups.filter(g => !(g.interfaceId === ifId && g.groupNumber === groupNum)), updatedGroup];
      return { output: [], newState: { hsrpGroups: newGroups, unsavedChanges: true } };
    }

    return { output: [out(`% Unknown standby subcommand: ${sub}`, 'error')] };
  }

  // dot1x per-interface commands
  if (cmd === 'dot1x') {
    const sub = (args[1] || '').toLowerCase();
    if (sub === 'port-control') {
      return { output: [], newState: { unsavedChanges: true } };
    }
    if (sub === 'timeout') {
      return { output: [], newState: { unsavedChanges: true } };
    }
    if (sub === 'max-reauth-req') {
      return { output: [], newState: { unsavedChanges: true } };
    }
    return { output: [], newState: { unsavedChanges: true } };
  }

  // authentication per-interface commands
  if (cmd === 'authentication') {
    const sub = (args[1] || '').toLowerCase();
    if (sub === 'port-control' || sub === 'host-mode' || sub === 'order' || sub === 'priority') {
      return { output: [], newState: { unsavedChanges: true } };
    }
    return { output: [], newState: { unsavedChanges: true } };
  }

  // mab (MAC Authentication Bypass)
  if (cmd === 'mab') {
    return { output: [], newState: { unsavedChanges: true } };
  }

  // vrrp per-interface commands
  if (cmd === 'vrrp') {
    // vrrp <group> <sub> [args...]
    // no vrrp <group>
    return { output: [], newState: { unsavedChanges: true } };
  }

  // power inline (PoE)
  if (cmd === 'power') {
    const sub = (args[1] || '').toLowerCase();
    if (sub === 'inline') {
      return { output: [], newState: { unsavedChanges: true } };
    }
    return { output: [out('% Unknown power command', 'error')] };
  }

  // service-policy input|output <policymap>
  if (cmd === 'service-policy') {
    const spDir = (args[1] || '').toLowerCase();
    const spName = args[2];
    if (spDir === 'input') {
      if (negated) return updateIface({ servicePolicy: { ...iface.servicePolicy, in: undefined } });
      if (!spName) return { output: [out('% Incomplete command.', 'error')] };
      return updateIface({ servicePolicy: { ...iface.servicePolicy, in: spName } });
    }
    if (spDir === 'output') {
      if (negated) return updateIface({ servicePolicy: { ...iface.servicePolicy, out: undefined } });
      if (!spName) return { output: [out('% Incomplete command.', 'error')] };
      return updateIface({ servicePolicy: { ...iface.servicePolicy, out: spName } });
    }
    return { output: [out('% Unknown service-policy direction', 'error')] };
  }

  // mls qos trust cos|dscp|ip-precedence
  if (cmd === 'mls') {
    const mlsSub = (args[1] || '').toLowerCase();
    if (mlsSub === 'qos') {
      const mlsSub2 = (args[2] || '').toLowerCase();
      if (mlsSub2 === 'trust') {
        if (negated) return updateIface({ mlsQosTrust: undefined });
        const trustVal = (args[3] || 'cos').toLowerCase() as 'cos' | 'dscp' | 'ip-precedence';
        return updateIface({ mlsQosTrust: trustVal });
      }
      if (mlsSub2 === 'cos') {
        if (negated) return updateIface({ mlsQosCos: undefined });
        return updateIface({ mlsQosCos: parseInt(args[3] || '0') });
      }
    }
    return { output: [out('% Unknown mls command', 'error')] };
  }

  // cdp enable (per-interface)
  if (cmd === 'cdp') {
    const cdpSub = (args[1] || '').toLowerCase();
    if (cdpSub === 'enable') {
      return updateIface({ cdpEnabled: !negated });
    }
    return { output: [out('% Unknown cdp command', 'error')] };
  }

    return { output: [out(`% Unknown interface command: ${args[0] || ''}`, 'error')] };
};

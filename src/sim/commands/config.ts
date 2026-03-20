import type { CommandHandler, TerminalLine, DeviceState, Vlan, OspfConfig, EigrpConfig, BgpConfig, DhcpPool, QosClassMap, QosPolicyMap, SpanSession, StpMode } from '../types';
import { showHandler } from './show';

let _lineId = 3000;
function lid(): string { return String(_lineId++); }
function out(text: string, type: TerminalLine['type'] = 'output'): TerminalLine {
  return { id: lid(), type, text };
}

function normalizeIfId(raw: string): string {
  const lower = raw.toLowerCase().trim();
  const faMatch = lower.match(/^(?:fa(?:stethernet)?)\s*(\d+\/\d+)$/);
  if (faMatch) return `Fa${faMatch[1]}`;
  const giMatch = lower.match(/^(?:gi(?:gabitethernet)?)\s*(\d+\/\d+)$/);
  if (giMatch) return `Gi${giMatch[1]}`;
  const vlanMatch = lower.match(/^(?:vl(?:an)?)\s*(\d+)$/);
  if (vlanMatch) return `Vlan${vlanMatch[1]}`;
  const loMatch = lower.match(/^(?:lo(?:opback)?)\s*(\d+)$/);
  if (loMatch) return `Loopback${loMatch[1]}`;
  return raw;
}

function resolveIfFull(raw: string): string {
  const lower = raw.toLowerCase().trim();
  const faMatch = lower.match(/^(?:fa(?:st(?:ethernet)?)?)\s*(\d+\/\d+)$/);
  if (faMatch) return `FastEthernet${faMatch[1]}`;
  const giMatch = lower.match(/^(?:gi(?:ga(?:bit(?:ethernet)?)?)?)\s*(\d+\/\d+)$/);
  if (giMatch) return `GigabitEthernet${giMatch[1]}`;
  const vlanMatch = lower.match(/^(?:vl(?:an)?)\s*(\d+)$/);
  if (vlanMatch) return `Vlan${vlanMatch[1]}`;
  const loMatch = lower.match(/^(?:lo(?:opback)?)\s*(\d*)$/);
  if (loMatch) return `Loopback${loMatch[1] || '0'}`;
  return normalizeIfId(raw);
}

export const configHandler: CommandHandler = (args, state, raw, negated) => {
  const cmd = (args[0] || '').toLowerCase();

  if (cmd === 'end') {
    return { output: [], newMode: 'priv-exec', newContext: { type: 'none' } };
  }

  if (cmd === 'exit') {
    return { output: [], newMode: 'priv-exec', newContext: { type: 'none' } };
  }

  if (cmd === 'do') {
    const subArgs = args.slice(1);
    return showHandler(subArgs, state, subArgs.join(' '), false);
  }

  if (cmd === 'hostname') {
    if (negated) {
      return { output: [], newState: { hostname: 'Router', unsavedChanges: true } };
    }
    const name = args[1];
    if (!name) return { output: [out('% Incomplete command.', 'error')] };
    return { output: [], newState: { hostname: name, unsavedChanges: true } };
  }

  if (cmd === 'enable') {
    const sub = (args[1] || '').toLowerCase();
    if (sub === 'secret') {
      if (negated) return { output: [], newState: { enableSecret: undefined, unsavedChanges: true } };
      const secret = args[2];
      if (!secret) return { output: [out('% Incomplete command.', 'error')] };
      return { output: [], newState: { enableSecret: secret, unsavedChanges: true } };
    }
    if (sub === 'password') {
      if (negated) return { output: [], newState: { enablePassword: undefined, unsavedChanges: true } };
      const pwd = args[2];
      if (!pwd) return { output: [out('% Incomplete command.', 'error')] };
      return { output: [], newState: { enablePassword: pwd, unsavedChanges: true } };
    }
    return { output: [out('% Incomplete command.', 'error')] };
  }

  if (cmd === 'service') {
    const sub = (args[1] || '').toLowerCase();
    if (sub === 'password-encryption') {
      return { output: [], newState: { servicePasswordEncryption: !negated, unsavedChanges: true } };
    }
    return { output: [out('% Unknown service command', 'error')] };
  }

  if (cmd === 'banner') {
    const sub = (args[1] || '').toLowerCase();
    if (sub === 'motd') {
      const rest = args.slice(2).join(' ');
      const delim = rest[0] || '^';
      const text = rest.slice(1).replace(new RegExp(`\\${delim}.*`), '').trim();
      return { output: [], newState: { banner: text, unsavedChanges: true } };
    }
    return { output: [out('% Unknown banner type', 'error')] };
  }

  if (cmd === 'ip') {
    const sub = (args[1] || '').toLowerCase();

    if (sub === 'domain-name' || sub === 'domain') {
      if (negated) return { output: [], newState: { domainName: '', unsavedChanges: true } };
      const domain = args[2];
      if (!domain) return { output: [out('% Incomplete command.', 'error')] };
      return { output: [], newState: { domainName: domain, unsavedChanges: true } };
    }

    if (sub === 'routing') {
      return { output: [], newState: { ipRoutingEnabled: !negated, unsavedChanges: true } };
    }

    if (sub === 'default-gateway') {
      if (negated) return { output: [], newState: { defaultGateway: undefined, unsavedChanges: true } };
      const gw = args[2];
      if (!gw) return { output: [out('% Incomplete command.', 'error')] };
      return { output: [], newState: { defaultGateway: gw, unsavedChanges: true } };
    }

    if (sub === 'route') {
      const network = args[2];
      const mask = args[3];
      const nextHop = args[4];
      if (!network || !mask) return { output: [out('% Incomplete command.', 'error')] };

      if (negated) {
        const newRoutes = state.routes.filter(r =>
          !(r.network === network && r.mask === mask && r.source === 'S')
        );
        return { output: [], newState: { routes: newRoutes, unsavedChanges: true } };
      }

      const newRoute = {
        source: 'S' as const,
        network, mask,
        adminDistance: 1, metric: 0,
        nextHop: nextHop || undefined,
        age: '00:00:00'
      };
      return {
        output: [],
        newState: { routes: [...state.routes, newRoute], unsavedChanges: true }
      };
    }

    if (sub === 'name-server') {
      return { output: [], newState: { unsavedChanges: true } };
    }

    if (sub === 'access-list') {
      const aclType = (args[2] || '').toLowerCase();
      const name = args[3];
      if (!name) return { output: [out('% Incomplete command.', 'error')] };
      if (negated) {
        const newAcls = { ...state.acls };
        delete newAcls[name];
        return { output: [], newState: { acls: newAcls, unsavedChanges: true } };
      }
      const type = aclType === 'extended' ? 'extended' : 'standard';
      const newAcl = state.acls[name] || { name, type, entries: [] };
      // Return to global-config (no dedicated ACL sub-mode in the type system)
      return {
        output: [out(`ip access-list ${type} ${name}`)],
        newState: { acls: { ...state.acls, [name]: { ...newAcl, type } }, unsavedChanges: true },
      };
    }

    return { output: [out(`% Unknown ip subcommand: ${sub}`, 'error')] };
  }

  if (cmd === 'ntp') {
    const sub = (args[1] || '').toLowerCase();
    if (sub === 'server') {
      const server = args[2];
      if (!server) return { output: [out('% Incomplete command.', 'error')] };
      if (negated) {
        return { output: [], newState: { ntp: { ...state.ntp, servers: state.ntp.servers.filter(s => s !== server) }, unsavedChanges: true } };
      }
      return { output: [], newState: { ntp: { ...state.ntp, servers: [...state.ntp.servers, server], synchronized: true, referenceServer: server }, unsavedChanges: true } };
    }
    return { output: [out('% Unknown ntp command', 'error')] };
  }

  if (cmd === 'logging') {
    const sub = (args[1] || '').toLowerCase();
    if (sub === 'buffered') {
      return { output: [], newState: { syslogLevel: parseInt(args[2] || '6'), unsavedChanges: true } };
    }
    if (negated) {
      return { output: [], newState: { loggingEnabled: false, loggingServer: undefined, unsavedChanges: true } };
    }
    if (sub && sub !== 'on') {
      return { output: [], newState: { loggingServer: sub, loggingEnabled: true, unsavedChanges: true } };
    }
    return { output: [], newState: { loggingEnabled: true, unsavedChanges: true } };
  }

  if (cmd === 'username') {
    const username = args[1];
    if (!username) return { output: [out('% Incomplete command.', 'error')] };
    if (negated) {
      return { output: [], newState: { users: state.users.filter(u => u.username !== username), unsavedChanges: true } };
    }
    const privIdx = args.indexOf('privilege');
    const secretIdx = args.indexOf('secret');
    const passIdx = args.indexOf('password');
    const privilege = privIdx >= 0 ? parseInt(args[privIdx + 1] || '1') : 1;
    const secret = secretIdx >= 0 ? args[secretIdx + 1] : undefined;
    const password = passIdx >= 0 ? args[passIdx + 1] : undefined;
    const newUser = { username, privilege, secret, password };
    const newUsers = state.users.filter(u => u.username !== username);
    newUsers.push(newUser);
    return { output: [], newState: { users: newUsers, unsavedChanges: true } };
  }

  if (cmd === 'vlan') {
    const vlanId = parseInt(args[1] || '');
    if (isNaN(vlanId) || vlanId < 1 || vlanId > 4094) {
      return { output: [out('% Invalid VLAN ID', 'error')] };
    }
    if (negated) {
      const newVlans = { ...state.vlans };
      delete newVlans[vlanId];
      return { output: [], newState: { vlans: newVlans, unsavedChanges: true } };
    }
    const existingVlan = state.vlans[vlanId];
    const newVlan: Vlan = existingVlan || {
      id: vlanId,
      name: `VLAN${String(vlanId).padStart(4, '0')}`,
      state: 'active',
      ports: []
    };
    return {
      output: [],
      newState: { vlans: { ...state.vlans, [vlanId]: newVlan }, unsavedChanges: true },
      newMode: 'vlan-config',
      newContext: { type: 'vlan', vlanId }
    };
  }

  if (cmd === 'interface') {
    if (negated) {
      // no interface Loopback0 removes it; physical interfaces cannot be removed
      const ifStr = args.slice(1).join('');
      const ifId = resolveIfFull(ifStr);
      if (ifId.startsWith('Loopback') || ifId.startsWith('Vlan')) {
        const newIfaces = { ...state.interfaces };
        delete newIfaces[ifId];
        return { output: [], newState: { interfaces: newIfaces, unsavedChanges: true } };
      }
      return { output: [out('% Physical interfaces cannot be removed', 'error')] };
    }
    const rangePart = (args[1] || '').toLowerCase();
    if (rangePart === 'range') {
      const rangeStr = args.slice(2).join('');
      const ifId = resolveIfFull(rangeStr.split(',')[0]);
      return {
        output: [],
        newMode: 'if-config',
        newContext: { type: 'interface', interfaceId: ifId }
      };
    }
    const ifStr = args.slice(1).join('');
    const ifId = resolveIfFull(ifStr);
    // Create SVI if needed
    if (ifId.startsWith('Vlan') && !state.interfaces[ifId]) {
      const vid = parseInt(ifId.replace('Vlan', ''));
      const newIface = {
        id: ifId, slot: 0, port: 0,
        description: '',
        adminState: 'up' as const, lineState: 'down' as const,
        ipAddresses: [],
        ipv6Addresses: [], ipv6Enabled: false,
        macAddress: `0019.e8a2.${(0x3c0e + vid).toString(16).padStart(4,'0')}`,
        duplex: 'full' as const, speed: 'auto' as const, mtu: 1500,
        switchportMode: 'access' as const,
        accessVlan: vid, trunkAllowedVlans: '1-4094', trunkNativeVlan: 1,
        spanningTree: { portfast: false, bpduguard: false, bpdufilter: false, state: 'disabled' as const, role: 'disabled' as const },
        portSecurity: { enabled: false, maxMacAddresses: 1, violation: 'shutdown' as const, stickyLearning: false, learnedAddresses: [] },
        ipHelperAddresses: [], ipAccessGroups: [],
        inputPackets: 0, outputPackets: 0, inputErrors: 0, outputErrors: 0,
        inputBytes: 0, outputBytes: 0, lastClear: Date.now(),
        cdpEnabled: true,
      };
      return {
        output: [],
        newState: { interfaces: { ...state.interfaces, [ifId]: newIface }, unsavedChanges: true },
        newMode: 'if-config',
        newContext: { type: 'interface', interfaceId: ifId }
      };
    }
    // Create Loopback if needed
    if (ifId.startsWith('Loopback') && !state.interfaces[ifId]) {
      const newLoopback = {
        id: ifId, slot: 0, port: 0,
        description: '',
        adminState: 'up' as const, lineState: 'up' as const,
        ipAddresses: [],
        ipv6Addresses: [], ipv6Enabled: false,
        macAddress: '0000.0000.0000',
        duplex: 'full' as const, speed: 'auto' as const, mtu: 1514,
        switchportMode: 'access' as const,
        accessVlan: 1, trunkAllowedVlans: '1-4094', trunkNativeVlan: 1,
        spanningTree: { portfast: false, bpduguard: false, bpdufilter: false, state: 'disabled' as const, role: 'disabled' as const },
        portSecurity: { enabled: false, maxMacAddresses: 1, violation: 'shutdown' as const, stickyLearning: false, learnedAddresses: [] },
        ipHelperAddresses: [], ipAccessGroups: [],
        inputPackets: 0, outputPackets: 0, inputErrors: 0, outputErrors: 0,
        inputBytes: 0, outputBytes: 0, lastClear: Date.now(),
        cdpEnabled: true,
      };
      return {
        output: [],
        newState: { interfaces: { ...state.interfaces, [ifId]: newLoopback }, unsavedChanges: true },
        newMode: 'if-config',
        newContext: { type: 'interface', interfaceId: ifId }
      };
    }
    return {
      output: [],
      newMode: 'if-config',
      newContext: { type: 'interface', interfaceId: ifId }
    };
  }

  if (cmd === 'line') {
    const lineType = (args[1] || '').toLowerCase();
    const start = parseInt(args[2] || '0');
    const end = parseInt(args[3] || args[2] || '0');

    let lt: 'console' | 'vty' | 'aux' = 'console';
    if (lineType.startsWith('vty')) lt = 'vty';
    else if (lineType.startsWith('aux')) lt = 'aux';

    return {
      output: [],
      newMode: 'line-config',
      newContext: { type: 'line', lineType: lt, start, end }
    };
  }

  if (cmd === 'router') {
    const proto = (args[1] || '').toLowerCase();
    if (proto.startsWith('ospf')) {
      const pid = parseInt(args[2] || '1');
      if (negated) {
        return { output: [], newState: { ospf: undefined, unsavedChanges: true } };
      }
      const existing: OspfConfig = state.ospf || {
        processId: pid, networks: [], redistributeConnected: false,
        redistributeStatic: false, defaultInformationOriginate: false,
        passiveInterfaces: [], neighbors: []
      };
      return {
        output: [],
        newState: { ospf: existing, unsavedChanges: true },
        newMode: 'router-ospf',
        newContext: { type: 'router-ospf', processId: pid }
      };
    }
    if (proto.startsWith('eigrp')) {
      const asNum = parseInt(args[2] || '1');
      if (negated) {
        return { output: [], newState: { eigrp: undefined, unsavedChanges: true } };
      }
      const existing: EigrpConfig = state.eigrp || {
        asNumber: asNum, networks: [],
        passiveInterfaces: [], redistributeConnected: false,
        redistributeStatic: false, neighbors: []
      };
      return {
        output: [],
        newState: { eigrp: existing, unsavedChanges: true },
        newMode: 'router-eigrp',
        newContext: { type: 'router-eigrp', asNumber: asNum }
      };
    }
    if (proto.startsWith('bgp')) {
      const asNum = parseInt(args[2] || '65000');
      if (negated) {
        return { output: [], newState: { bgp: undefined, unsavedChanges: true } };
      }
      const existing: BgpConfig = state.bgp || {
        asNumber: asNum, networks: [], neighbors: []
      };
      return {
        output: [],
        newState: { bgp: existing, unsavedChanges: true },
        newMode: 'router-bgp',
        newContext: { type: 'router-bgp', asNumber: asNum }
      };
    }
    return { output: [out(`% Unknown routing protocol: ${proto}`, 'error')] };
  }

  if (cmd === 'access-list') {
    const numOrName = args[1];
    if (!numOrName) return { output: [out('% Incomplete command.', 'error')] };
    if (negated) {
      const newAcls = { ...state.acls };
      delete newAcls[numOrName];
      return { output: [], newState: { acls: newAcls, unsavedChanges: true } };
    }
    const action = (args[2] || '').toLowerCase();
    if (action !== 'permit' && action !== 'deny') {
      return { output: [out('% Incomplete command.', 'error')] };
    }
    const aclNum = parseInt(numOrName);
    const aclType = (aclNum >= 1 && aclNum <= 99) || (aclNum >= 1300 && aclNum <= 1999) ? 'standard' : 'extended';
    const aclName = numOrName;
    const existing = state.acls[aclName] || { name: aclName, type: aclType, entries: [] };
    const seq = existing.entries.length * 10 + 10;

    // Parse the entry based on ACL type
    let argIdx = 3; // start after: access-list <num> permit|deny
    let protocol: string | undefined;
    let source = 'any';
    let sourceMask: string | undefined;
    let destination: string | undefined;
    let destinationMask: string | undefined;
    let logFlag = false;

    if (aclType === 'extended') {
      // Extended: access-list <num> permit|deny <protocol> <src> <srcwc> <dst> <dstwc> [eq <port>] [log]
      protocol = (args[argIdx] || 'ip').toLowerCase();
      argIdx++;
    }

    // Parse source
    const srcToken = (args[argIdx] || 'any').toLowerCase();
    if (srcToken === 'any') {
      source = 'any';
      sourceMask = '255.255.255.255';
      argIdx++;
    } else if (srcToken === 'host') {
      source = args[argIdx + 1] || '0.0.0.0';
      sourceMask = '0.0.0.0';
      argIdx += 2;
    } else {
      source = args[argIdx] || '0.0.0.0';
      argIdx++;
      // Next token: wildcard mask or keyword
      const nextTok = (args[argIdx] || '').toLowerCase();
      if (nextTok && nextTok !== 'any' && nextTok !== 'host' && nextTok !== 'log' && nextTok !== 'eq' && nextTok.includes('.')) {
        sourceMask = args[argIdx];
        argIdx++;
      } else {
        sourceMask = '0.0.0.0';
      }
    }

    // Parse destination (extended only)
    if (aclType === 'extended' && argIdx < args.length) {
      const dstToken = (args[argIdx] || 'any').toLowerCase();
      if (dstToken === 'any') {
        destination = 'any';
        destinationMask = '255.255.255.255';
        argIdx++;
      } else if (dstToken === 'host') {
        destination = args[argIdx + 1] || '0.0.0.0';
        destinationMask = '0.0.0.0';
        argIdx += 2;
      } else if (dstToken && dstToken !== 'log' && dstToken !== 'eq') {
        destination = args[argIdx];
        argIdx++;
        const nextTok = (args[argIdx] || '').toLowerCase();
        if (nextTok && nextTok !== 'log' && nextTok !== 'eq' && nextTok.includes('.')) {
          destinationMask = args[argIdx];
          argIdx++;
        } else {
          destinationMask = '0.0.0.0';
        }
      }
    }

    // Check for 'log' keyword anywhere remaining
    for (let i = argIdx; i < args.length; i++) {
      if (args[i].toLowerCase() === 'log') { logFlag = true; break; }
    }

    const newEntry = {
      sequence: seq,
      action: action as 'permit' | 'deny',
      protocol,
      source,
      sourceMask,
      destination,
      destinationMask,
      log: logFlag,
      matches: 0
    };

    return {
      output: [],
      newState: {
        acls: { ...state.acls, [aclName]: { ...existing, entries: [...existing.entries, newEntry] } },
        unsavedChanges: true
      }
    };
  }

  if (cmd === 'spanning-tree') {
    const sub = (args[1] || '').toLowerCase();
    if (sub === 'vlan') {
      const vid = parseInt(args[2] || '');
      const sub2 = (args[3] || '').toLowerCase();
      if (isNaN(vid)) return { output: [out('% Invalid VLAN ID', 'error')] };
      if (sub2 === 'priority') {
        if (negated) {
          const newStp = { ...state.spanningTree };
          if (newStp[vid]) newStp[vid] = { ...newStp[vid], localBridgePriority: 32768 + vid };
          return { output: [], newState: { spanningTree: newStp, unsavedChanges: true } };
        }
        const pri = parseInt(args[4] || '32768');
        const newStp = { ...state.spanningTree };
        if (newStp[vid]) newStp[vid] = { ...newStp[vid], localBridgePriority: pri + vid };
        return { output: [], newState: { spanningTree: newStp, unsavedChanges: true } };
      }
    }
    if (sub === 'mode') {
      return { output: [], newState: { unsavedChanges: true } };
    }
    return { output: [out('% Unknown spanning-tree command', 'error')] };
  }

  if (cmd === 'crypto') {
    const sub = (args[1] || '').toLowerCase();
    if (sub === 'key') {
      const sub2 = (args[2] || '').toLowerCase();
      if (sub2 === 'generate') {
        const sub3 = (args[3] || '').toLowerCase();
        if (sub3 === 'rsa') {
          const modIdx = args.indexOf('modulus');
          const modulus = modIdx >= 0 ? parseInt(args[modIdx + 1] || '1024') : 1024;
          return {
            output: [
              out('The name for the keys will be: SW1.corp.local'),
              out(`Choose the size of the key modulus in the range of 360 to 4096 for your`),
              out(`  General Purpose Keys. Choosing a key modulus greater than 512 may take`),
              out(`  a few minutes.`),
              out(''),
              out(`% Generating ${modulus} bit RSA keys, keys will be non-exportable...`),
              out('[OK] (elapsed time was 1 seconds)', 'success'),
            ],
            newState: { cryptoKeyRsa: { modulus, generated: new Date().toISOString() }, unsavedChanges: true }
          };
        }
      }
    }
    return { output: [out('% Unknown crypto command', 'error')] };
  }

  if (cmd === 'cdp') {
    const sub = (args[1] || '').toLowerCase();
    if (sub === 'run' || sub === '') {
      return { output: [], newState: { cdpEnabled: !negated, unsavedChanges: true } };
    }
    return { output: [out('% Unknown cdp command', 'error')] };
  }

  if (cmd === 'lldp') {
    const sub = (args[1] || '').toLowerCase();
    if (sub === 'run' || sub === '') {
      return { output: [], newState: { lldpEnabled: !negated, unsavedChanges: true } };
    }
    if (sub === 'timer' || sub === 'holdtime' || sub === 'reinit') {
      // Accept but just store as unsaved change (timer values not tracked in state)
      return { output: [], newState: { unsavedChanges: true } };
    }
    return { output: [out('% Unknown lldp command', 'error')] };
  }

  if (cmd === 'ipv6') {
    const sub = (args[1] || '').toLowerCase();
    if (sub === 'unicast-routing') {
      return { output: [], newState: { ipv6RoutingEnabled: !negated, unsavedChanges: true } };
    }
    if (sub === 'route') {
      const prefixArg = args[2]; // e.g. "2001:db8::/64"
      const nextHop = args[3];
      if (!prefixArg) return { output: [out('% Incomplete command.', 'error')] };
      const slashIdx = prefixArg.lastIndexOf('/');
      const network = slashIdx >= 0 ? prefixArg.slice(0, slashIdx) : prefixArg;
      const prefixLength = slashIdx >= 0 ? parseInt(prefixArg.slice(slashIdx + 1)) : 128;
      if (negated) {
        const newRoutes = state.ipv6Routes.filter(r =>
          !(r.network === network && r.prefixLength === prefixLength && r.source === 'S')
        );
        return { output: [], newState: { ipv6Routes: newRoutes, unsavedChanges: true } };
      }
      const newRoute = {
        source: 'S',
        network,
        prefixLength,
        nextHop: nextHop || undefined,
        age: '00:00:00'
      };
      return {
        output: [],
        newState: { ipv6Routes: [...state.ipv6Routes, newRoute], unsavedChanges: true }
      };
    }
    return { output: [out(`% Unknown ipv6 subcommand: ${sub}`, 'error')] };
  }

  if (cmd === 'no') {
    const sub = (args[1] || '').toLowerCase();
    if (sub === 'cdp') {
      const sub2 = (args[2] || '').toLowerCase();
      if (sub2 === 'run') {
        return { output: [], newState: { cdpEnabled: false, unsavedChanges: true } };
      }
    }
    return { output: [out(`% Unknown no command: ${raw}`, 'error')] };
  }

  void raw;
  return { output: [out(`% Unknown configuration command: ${args[0] || ''}`, 'error')] };
};

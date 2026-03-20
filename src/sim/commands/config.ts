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

function parseVlanRange(rangeStr: string): number[] {
  const result: number[] = [];
  for (const part of rangeStr.split(',')) {
    const dash = part.trim().split('-');
    const start = parseInt(dash[0]);
    const end = parseInt(dash[1] || dash[0]);
    if (!isNaN(start) && !isNaN(end)) {
      for (let v = start; v <= end; v++) result.push(v);
    }
  }
  return result;
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
    if (sub === 'dhcp') {
      return { output: [], newState: { dhcpEnabled: !negated, unsavedChanges: true } };
    }
    if (sub === 'tcp-small-servers' || sub === 'nagle') {
      return { output: [], newState: { unsavedChanges: true } };
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

    if (sub === 'http') {
      // ip http server / ip http secure-server / ip http authentication local
      return { output: [], newState: { unsavedChanges: true } };
    }

    if (sub === 'source-route') {
      return { output: [], newState: { unsavedChanges: true } };
    }

    if (sub === 'classless') {
      return { output: [], newState: { unsavedChanges: true } };
    }

    if (sub === 'domain-lookup') {
      return { output: [], newState: { unsavedChanges: true } };
    }

    if (sub === 'forward-protocol') {
      return { output: [], newState: { unsavedChanges: true } };
    }

    if (sub === 'finger') {
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

    if (sub === 'dhcp') {
      const sub2 = (args[2] || '').toLowerCase();
      if (sub2 === 'snooping') {
        const sub3 = (args[3] || '').toLowerCase();
        if (!sub3) {
          // ip dhcp snooping  /  no ip dhcp snooping
          return { output: [], newState: { dhcpSnooping: { ...state.dhcpSnooping, enabled: !negated }, unsavedChanges: true } };
        }
        if (sub3 === 'vlan') {
          const rangeStr = args[4] || '';
          const vlans = parseVlanRange(rangeStr);
          if (negated) {
            const newVlans = state.dhcpSnooping.vlans.filter(v => !vlans.includes(v));
            return { output: [], newState: { dhcpSnooping: { ...state.dhcpSnooping, vlans: newVlans }, unsavedChanges: true } };
          }
          const newVlans = Array.from(new Set([...state.dhcpSnooping.vlans, ...vlans])).sort((a,b)=>a-b);
          return { output: [], newState: { dhcpSnooping: { ...state.dhcpSnooping, vlans: newVlans }, unsavedChanges: true } };
        }
        if (sub3 === 'information') {
          const sub4 = (args[4] || '').toLowerCase();
          if (sub4 === 'option') {
            // ip dhcp snooping information option  /  no ip dhcp snooping information option
            return { output: [], newState: { dhcpSnooping: { ...state.dhcpSnooping, option82: !negated }, unsavedChanges: true } };
          }
        }
        return { output: [], newState: { unsavedChanges: true } };
      }

      if (sub2 === 'pool') {
        const poolName = args[3];
        if (!poolName) return { output: [out('% Incomplete command.', 'error')] };
        if (negated) {
          return { output: [], newState: { dhcpPools: state.dhcpPools.filter(p => p.name !== poolName), unsavedChanges: true } };
        }
        const existingPool = state.dhcpPools.find(p => p.name === poolName);
        if (!existingPool) {
          const newPool: DhcpPool = { name: poolName, network: '', mask: '', leaseTime: 1, excludedAddresses: [] };
          return { output: [], newState: { dhcpPools: [...state.dhcpPools, newPool], unsavedChanges: true } };
        }
        return { output: [] };
      }

      if (sub2 === 'excluded-address') {
        const start = args[3];
        const end = args[4];
        if (!start) return { output: [out('% Incomplete command.', 'error')] };
        if (negated) {
          return { output: [], newState: { dhcpExcludedAddresses: state.dhcpExcludedAddresses.filter(e => !(e.start === start && (end ? e.end === end : !e.end))), unsavedChanges: true } };
        }
        return { output: [], newState: { dhcpExcludedAddresses: [...state.dhcpExcludedAddresses, { start, ...(end ? { end } : {}) }], unsavedChanges: true } };
      }

      return { output: [out(`% Unknown ip dhcp subcommand: ${sub2}`, 'error')] };
    }

    if (sub === 'nat') {
      const sub2 = (args[2] || '').toLowerCase();

      if (sub2 === 'pool') {
        const name = args[3];
        const startIp = args[4];
        const endIp = args[5];
        const prefixIdx = args.indexOf('prefix-length');
        const prefix = prefixIdx >= 0 ? parseInt(args[prefixIdx + 1] || '24') : 24;
        if (!name || !startIp || !endIp) return { output: [out('% Incomplete command.', 'error')] };
        if (negated) {
          return { output: [], newState: { natConfig: { ...state.natConfig, pools: state.natConfig.pools.filter(p => p.name !== name) }, unsavedChanges: true } };
        }
        const newNatPools = [...state.natConfig.pools.filter(p => p.name !== name), { name, startIp, endIp, prefix }];
        return { output: [], newState: { natConfig: { ...state.natConfig, pools: newNatPools }, unsavedChanges: true } };
      }

      if (sub2 === 'inside') {
        const sub3 = (args[3] || '').toLowerCase();
        if (sub3 === 'source') {
          const sub4 = (args[4] || '').toLowerCase();
          if (sub4 === 'static') {
            const localIp = args[5];
            const globalIp = args[6];
            if (!localIp || !globalIp) return { output: [out('% Incomplete command.', 'error')] };
            if (negated) {
              return { output: [], newState: { natConfig: { ...state.natConfig, staticMappings: state.natConfig.staticMappings.filter(m => m.localIp !== localIp) }, unsavedChanges: true } };
            }
            const newMappings = [...state.natConfig.staticMappings.filter(m => m.localIp !== localIp), { localIp, globalIp }];
            return { output: [], newState: { natConfig: { ...state.natConfig, staticMappings: newMappings }, unsavedChanges: true } };
          }
          if (sub4 === 'list') {
            const acl = args[5];
            const overload = args.includes('overload');
            if (!acl) return { output: [out('% Incomplete command.', 'error')] };
            return { output: [], newState: { natConfig: { ...state.natConfig, accessList: acl, overload }, unsavedChanges: true } };
          }
        }
      }

      return { output: [out(`% Unknown ip nat subcommand: ${sub2}`, 'error')] };
    }

    if (sub === 'arp') {
      const sub2 = (args[2] || '').toLowerCase();
      if (sub2 === 'inspection') {
        const sub3 = (args[3] || '').toLowerCase();
        if (sub3 === 'vlan') {
          const rangeStr = args[4] || '';
          const vlans = parseVlanRange(rangeStr);
          if (negated) {
            const newVlans = state.dai.vlans.filter(v => !vlans.includes(v));
            return { output: [], newState: { dai: { ...state.dai, vlans: newVlans, enabled: newVlans.length > 0 }, unsavedChanges: true } };
          }
          const newVlans = Array.from(new Set([...state.dai.vlans, ...vlans])).sort((a,b)=>a-b);
          return { output: [], newState: { dai: { ...state.dai, vlans: newVlans, enabled: newVlans.length > 0 }, unsavedChanges: true } };
        }
        if (sub3 === 'validate') {
          // ip arp inspection validate src-mac dst-mac ip  -- just accept
          return { output: [], newState: { unsavedChanges: true } };
        }
        if (sub3 === 'log-buffer') {
          return { output: [], newState: { unsavedChanges: true } };
        }
        return { output: [], newState: { unsavedChanges: true } };
      }
      return { output: [out(`% Unknown ip arp subcommand: ${sub2}`, 'error')] };
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
    if (sub === 'master') {
      if (negated) return { output: [], newState: { ntp: { ...state.ntp, master: false, masterStratum: undefined }, unsavedChanges: true } };
      const stratum = args[2] ? parseInt(args[2]) : 8;
      return { output: [], newState: { ntp: { ...state.ntp, master: true, masterStratum: stratum }, unsavedChanges: true } };
    }
    if (sub === 'authenticate') {
      return { output: [], newState: { ntp: { ...state.ntp, authenticate: !negated }, unsavedChanges: true } };
    }
    if (sub === 'authentication-key') {
      const keyId = parseInt(args[2] || '');
      const keyType = (args[3] || '').toLowerCase();
      const keyVal = args[4];
      if (isNaN(keyId) || !keyVal) return { output: [out('% Incomplete command.', 'error')] };
      if (negated) {
        const newKeys = (state.ntp.authKeys || []).filter(k => k.id !== keyId);
        return { output: [], newState: { ntp: { ...state.ntp, authKeys: newKeys }, unsavedChanges: true } };
      }
      const newKeys = [...(state.ntp.authKeys || []).filter(k => k.id !== keyId), { id: keyId, type: 'md5' as const, key: keyVal }];
      return { output: [], newState: { ntp: { ...state.ntp, authKeys: newKeys }, unsavedChanges: true } };
    }
    if (sub === 'trusted-key') {
      const keyId = parseInt(args[2] || '');
      if (isNaN(keyId)) return { output: [out('% Incomplete command.', 'error')] };
      if (negated) {
        const newKeys = (state.ntp.trustedKeys || []).filter(k => k !== keyId);
        return { output: [], newState: { ntp: { ...state.ntp, trustedKeys: newKeys }, unsavedChanges: true } };
      }
      const newKeys = [...(state.ntp.trustedKeys || []).filter(k => k !== keyId), keyId];
      return { output: [], newState: { ntp: { ...state.ntp, trustedKeys: newKeys }, unsavedChanges: true } };
    }
    if (sub === 'source') {
      const ifArg = args.slice(2).join('');
      if (negated) return { output: [], newState: { ntp: { ...state.ntp, source: undefined }, unsavedChanges: true } };
      if (!ifArg) return { output: [out('% Incomplete command.', 'error')] };
      return { output: [], newState: { ntp: { ...state.ntp, source: ifArg }, unsavedChanges: true } };
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

    // spanning-tree mode pvst|rapid-pvst|mst
    if (sub === 'mode') {
      const mode = (args[2] || '').toLowerCase() as StpMode;
      if (mode !== 'pvst' && mode !== 'rapid-pvst' && mode !== 'mst') {
        return { output: [out('% Invalid STP mode. Use pvst, rapid-pvst, or mst', 'error')] };
      }
      const modeOutput = mode === 'mst'
        ? [out("% MST requires 'spanning-tree mst configuration' to be configured")]
        : [];
      return { output: modeOutput, newState: { stpMode: mode, unsavedChanges: true } };
    }

    // spanning-tree mst configuration / spanning-tree mst <id> priority|root
    if (sub === 'mst') {
      const sub2 = (args[2] || '').toLowerCase();

      if (sub2 === 'configuration') {
        return {
          output: [out('% Enter MST config sub-mode commands: name, revision, instance', 'info')],
          newState: { unsavedChanges: true }
        };
      }

      const mstId = parseInt(args[2] || '');
      if (!isNaN(mstId)) {
        const sub3 = (args[3] || '').toLowerCase();
        const instances = state.mstConfig.instances.map(i => ({ ...i }));
        const instIdx = instances.findIndex(i => i.id === mstId);
        if (instIdx < 0) return { output: [out(`% MST instance ${mstId} not found`, 'error')] };

        if (sub3 === 'priority') {
          const pri = parseInt(args[4] || '32768');
          instances[instIdx] = { ...instances[instIdx], localBridgePriority: pri };
          return { output: [], newState: { mstConfig: { ...state.mstConfig, instances }, unsavedChanges: true } };
        }
        if (sub3 === 'root') {
          const sub4 = (args[4] || '').toLowerCase();
          const newPri = sub4 === 'primary' ? 24576 : 28672;
          instances[instIdx] = { ...instances[instIdx], localBridgePriority: newPri };
          return { output: [], newState: { mstConfig: { ...state.mstConfig, instances }, unsavedChanges: true } };
        }
        return { output: [out('% Unknown spanning-tree mst command', 'error')] };
      }
      return { output: [out('% Unknown spanning-tree mst command', 'error')] };
    }

    // MST sub-mode inline commands: name, revision, instance
    if (sub === 'name' && args[2]) {
      return { output: [], newState: { mstConfig: { ...state.mstConfig, name: args[2] }, unsavedChanges: true } };
    }
    if (sub === 'revision') {
      const rev = parseInt(args[2] || '0');
      return { output: [], newState: { mstConfig: { ...state.mstConfig, revision: rev }, unsavedChanges: true } };
    }
    if (sub === 'instance') {
      const instId = parseInt(args[2] || '');
      if (isNaN(instId)) return { output: [out('% Invalid instance ID', 'error')] };
      if (negated) {
        const instances = state.mstConfig.instances.filter(i => i.id !== instId);
        return { output: [], newState: { mstConfig: { ...state.mstConfig, instances }, unsavedChanges: true } };
      }
      const sub3 = (args[3] || '').toLowerCase();
      if (sub3 === 'vlan') {
        const vlanRange = args[4] || '';
        const vlans: number[] = [];
        for (const part of vlanRange.split(',')) {
          const rangeParts = part.split('-');
          if (rangeParts.length === 2) {
            const start = parseInt(rangeParts[0]);
            const end = parseInt(rangeParts[1]);
            for (let v = start; v <= end; v++) vlans.push(v);
          } else {
            const v = parseInt(part);
            if (!isNaN(v)) vlans.push(v);
          }
        }
        const existing = state.mstConfig.instances.find(i => i.id === instId);
        const newInst = existing
          ? { ...existing, vlans }
          : { id: instId, vlans, rootBridgeMac: '0019.e8a2.3c00', rootBridgePriority: 32768, localBridgePriority: 32768, rootCost: 0 };
        const instances = state.mstConfig.instances.filter(i => i.id !== instId);
        instances.push(newInst);
        instances.sort((a, b) => a.id - b.id);
        return { output: [], newState: { mstConfig: { ...state.mstConfig, instances }, unsavedChanges: true } };
      }
      return { output: [out('% Incomplete command.', 'error')] };
    }

    // spanning-tree vlan <id> priority|root|max-age|hello-time|forward-time
    if (sub === 'vlan') {
      const vid = parseInt(args[2] || '');
      const sub2 = (args[3] || '').toLowerCase();
      if (isNaN(vid)) return { output: [out('% Invalid VLAN ID', 'error')] };
      const newStp = { ...state.spanningTree };
      if (sub2 === 'priority') {
        if (negated) {
          if (newStp[vid]) newStp[vid] = { ...newStp[vid], localBridgePriority: 32768 + vid };
          return { output: [], newState: { spanningTree: newStp, unsavedChanges: true } };
        }
        const pri = parseInt(args[4] || '32768');
        if (newStp[vid]) newStp[vid] = { ...newStp[vid], localBridgePriority: pri + vid };
        return { output: [], newState: { spanningTree: newStp, unsavedChanges: true } };
      }
      if (sub2 === 'root') {
        const sub3 = (args[4] || '').toLowerCase();
        if (sub3 === 'primary') {
          if (newStp[vid]) {
            const cur = newStp[vid].localBridgePriority - vid;
            const newPri = Math.max(24576, cur - 4096);
            newStp[vid] = { ...newStp[vid], localBridgePriority: newPri + vid };
          }
          return { output: [], newState: { spanningTree: newStp, unsavedChanges: true } };
        }
        if (sub3 === 'secondary') {
          if (newStp[vid]) newStp[vid] = { ...newStp[vid], localBridgePriority: 28672 + vid };
          return { output: [], newState: { spanningTree: newStp, unsavedChanges: true } };
        }
        return { output: [out('% Incomplete command.', 'error')] };
      }
      if (sub2 === 'max-age') {
        const val = parseInt(args[4] || '20');
        if (newStp[vid]) newStp[vid] = { ...newStp[vid], maxAge: val };
        return { output: [], newState: { spanningTree: newStp, unsavedChanges: true } };
      }
      if (sub2 === 'hello-time') {
        const val = parseInt(args[4] || '2');
        if (newStp[vid]) newStp[vid] = { ...newStp[vid], helloTime: val };
        return { output: [], newState: { spanningTree: newStp, unsavedChanges: true } };
      }
      if (sub2 === 'forward-time') {
        const val = parseInt(args[4] || '15');
        if (newStp[vid]) newStp[vid] = { ...newStp[vid], forwardDelay: val };
        return { output: [], newState: { spanningTree: newStp, unsavedChanges: true } };
      }
      return { output: [out('% Unknown spanning-tree vlan command', 'error')] };
    }

    // spanning-tree portfast default / spanning-tree portfast bpduguard default
    if (sub === 'portfast') {
      const sub2 = (args[2] || '').toLowerCase();
      if (sub2 === 'bpduguard') {
        const sub3 = (args[3] || '').toLowerCase();
        if (sub3 === 'default') {
          return { output: [], newState: { stpBpduguardDefault: !negated, unsavedChanges: true } };
        }
      }
      if (sub2 === 'default') {
        return { output: [], newState: { stpPortfastDefault: !negated, unsavedChanges: true } };
      }
      return { output: [], newState: { unsavedChanges: true } };
    }

    // spanning-tree loopguard default
    if (sub === 'loopguard') {
      return { output: [], newState: { stpLoopguardDefault: !negated, unsavedChanges: true } };
    }

    // spanning-tree backbonefast
    if (sub === 'backbonefast') {
      return { output: [], newState: { stpBackbonefast: !negated, unsavedChanges: true } };
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
    if (sub === 'timer') {
      if (negated) return { output: [], newState: { cdpTimer: 60, unsavedChanges: true } };
      const secs = parseInt(args[2] || '60');
      if (isNaN(secs) || secs < 5 || secs > 254) return { output: [out('% CDP timer must be between 5 and 254 seconds', 'error')] };
      return { output: [], newState: { cdpTimer: secs, unsavedChanges: true } };
    }
    if (sub === 'holdtime') {
      if (negated) return { output: [], newState: { cdpHoldtime: 180, unsavedChanges: true } };
      const secs = parseInt(args[2] || '180');
      if (isNaN(secs) || secs < 10 || secs > 255) return { output: [out('% CDP holdtime must be between 10 and 255 seconds', 'error')] };
      return { output: [], newState: { cdpHoldtime: secs, unsavedChanges: true } };
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

  if (cmd === 'vtp') {
    const sub = (args[1] || '').toLowerCase();
    if (sub === 'domain') {
      if (negated) return { output: [], newState: { vtp: { ...state.vtp, domain: '' }, unsavedChanges: true } };
      const name = args[2];
      if (!name) return { output: [out('% Incomplete command.', 'error')] };
      return { output: [], newState: { vtp: { ...state.vtp, domain: name }, unsavedChanges: true } };
    }
    if (sub === 'mode') {
      const mode = (args[2] || '').toLowerCase();
      const validModes = ['server', 'client', 'transparent', 'off'];
      if (!validModes.includes(mode)) return { output: [out('% Invalid VTP mode. Valid modes: server, client, transparent, off', 'error')] };
      return { output: [], newState: { vtp: { ...state.vtp, mode: mode as 'server' | 'client' | 'transparent' | 'off' }, unsavedChanges: true } };
    }
    if (sub === 'version') {
      const ver = parseInt(args[2] || '');
      if (ver !== 1 && ver !== 2 && ver !== 3) return { output: [out('% Invalid VTP version. Valid versions: 1, 2, 3', 'error')] };
      return { output: [], newState: { vtp: { ...state.vtp, version: ver as 1 | 2 | 3 }, unsavedChanges: true } };
    }
    if (sub === 'password') {
      if (negated) return { output: [], newState: { vtp: { ...state.vtp, password: undefined }, unsavedChanges: true } };
      const pwd = args[2];
      if (!pwd) return { output: [out('% Incomplete command.', 'error')] };
      return { output: [], newState: { vtp: { ...state.vtp, password: pwd }, unsavedChanges: true } };
    }
    if (sub === 'pruning') {
      return { output: [], newState: { vtp: { ...state.vtp, pruningEnabled: !negated }, unsavedChanges: true } };
    }
    return { output: [out('% Unknown vtp command', 'error')] };
  }

  if (cmd === 'snmp-server') {
    const sub = (args[1] || '').toLowerCase();
    if (sub === 'community') {
      const commName = args[2];
      if (!commName) return { output: [out('% Incomplete command.', 'error')] };
      if (negated) {
        const newComms = state.snmp.communities.filter(c => c.name !== commName);
        return { output: [], newState: { snmp: { ...state.snmp, communities: newComms }, unsavedChanges: true } };
      }
      const accessStr = (args[3] || 'ro').toLowerCase();
      const access: 'ro' | 'rw' = accessStr === 'rw' ? 'rw' : 'ro';
      const acl = args[4];
      const newComm = acl ? { name: commName, access, acl } : { name: commName, access };
      const newComms = [...state.snmp.communities.filter(c => c.name !== commName), newComm];
      return { output: [], newState: { snmp: { ...state.snmp, communities: newComms }, unsavedChanges: true } };
    }
    if (sub === 'location') {
      if (negated) return { output: [], newState: { snmp: { ...state.snmp, location: undefined }, unsavedChanges: true } };
      const loc = args.slice(2).join(' ');
      if (!loc) return { output: [out('% Incomplete command.', 'error')] };
      return { output: [], newState: { snmp: { ...state.snmp, location: loc }, unsavedChanges: true } };
    }
    if (sub === 'contact') {
      if (negated) return { output: [], newState: { snmp: { ...state.snmp, contact: undefined }, unsavedChanges: true } };
      const contact = args.slice(2).join(' ');
      if (!contact) return { output: [out('% Incomplete command.', 'error')] };
      return { output: [], newState: { snmp: { ...state.snmp, contact }, unsavedChanges: true } };
    }
    if (sub === 'host') {
      const ip = args[2];
      if (!ip) return { output: [out('% Incomplete command.', 'error')] };
      if (negated) {
        const newHosts = state.snmp.trapHosts.filter(h => h.ip !== ip);
        return { output: [], newState: { snmp: { ...state.snmp, trapHosts: newHosts }, unsavedChanges: true } };
      }
      // snmp-server host <ip> version 1|2c|3 <community>
      const versionIdx = args.indexOf('version');
      const ver = versionIdx >= 0 ? (args[versionIdx + 1] as '1' | '2c' | '3') : '2c';
      const community = versionIdx >= 0 ? args[versionIdx + 2] : args[3];
      if (!community) return { output: [out('% Incomplete command.', 'error')] };
      const newHosts = [...state.snmp.trapHosts.filter(h => h.ip !== ip), { ip, community, version: ver }];
      return { output: [], newState: { snmp: { ...state.snmp, trapHosts: newHosts }, unsavedChanges: true } };
    }
    if (sub === 'enable') {
      const sub2 = (args[2] || '').toLowerCase();
      if (sub2 === 'traps') {
        return { output: [], newState: { snmp: { ...state.snmp, enabled: !negated }, unsavedChanges: true } };
      }
    }
    return { output: [], newState: { unsavedChanges: true } };
  }

  void raw;
  return { output: [out(`% Unknown configuration command: ${args[0] || ''}`, 'error')] };
};

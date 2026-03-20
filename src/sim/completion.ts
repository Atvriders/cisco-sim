import type { DeviceState } from './types';
import { matchPrefix } from './abbreviation';

// ── Command trees ────────────────────────────────────────────────────────────

const MODE_CMDS: Record<string, string[]> = {
  'user-exec': [
    'enable', 'exit', 'logout', 'ping', 'traceroute', 'show', 'ssh', 'telnet', 'help',
  ],
  'priv-exec': [
    'enable', 'disable', 'exit', 'logout', 'ping', 'traceroute', 'show',
    'configure', 'copy', 'write', 'reload', 'erase', 'debug', 'undebug',
    'clear', 'clock', 'ssh', 'telnet', 'terminal', 'do',
  ],
  'global-config': [
    'hostname', 'enable', 'service', 'banner', 'ip', 'no', 'interface', 'vlan',
    'line', 'router', 'username', 'access-list', 'spanning-tree', 'crypto',
    'ntp', 'logging', 'cdp', 'do', 'exit', 'end',
  ],
  'if-config': [
    'description', 'ip', 'no', 'shutdown', 'duplex', 'speed', 'mtu',
    'switchport', 'spanning-tree', 'channel-group', 'port-security',
    'storm-control', 'exit', 'end', 'do',
  ],
  'vlan-config': ['name', 'state', 'exit', 'end'],
  'line-config': [
    'login', 'password', 'exec-timeout', 'transport', 'logging',
    'privilege', 'exit', 'end',
  ],
  'router-ospf': [
    'network', 'router-id', 'passive-interface', 'redistribute', 'neighbor',
    'exit', 'end', 'no', 'do',
  ],
  'router-eigrp': [
    'network', 'passive-interface', 'redistribute', 'neighbor',
    'exit', 'end', 'no', 'do',
  ],
  'router-bgp': [
    'network', 'router-id', 'passive-interface', 'redistribute', 'neighbor',
    'exit', 'end', 'no', 'do',
  ],
};

const SHOW_SUBCMDS = [
  'arp', 'cdp', 'clock', 'environment', 'etherchannel', 'flash', 'history',
  'interfaces', 'ip', 'logging', 'mac', 'memory', 'ntp', 'port-security',
  'privilege', 'processes', 'running-config', 'sessions', 'spanning-tree',
  'startup-config', 'terminal', 'users', 'version', 'vlan',
];

const SHOW_IP_SUBCMDS = [
  'access-lists', 'bgp', 'dhcp', 'eigrp', 'interface', 'ospf', 'route', 'ssh',
];

const SHOW_IP_INTERFACE_SUBCMDS = ['brief'];
const SHOW_IP_OSPF_SUBCMDS = ['neighbor', 'database', 'interface'];
const SHOW_IP_BGP_SUBCMDS = ['summary', 'neighbors'];
const SHOW_IP_DHCP_SUBCMDS = ['binding', 'conflict', 'pool'];

const SHOW_INTERFACES_SUBCMDS = ['brief', 'status', 'trunk'];

const DEBUG_SUBCMDS = ['ip', 'spanning-tree'];
const DEBUG_IP_SUBCMDS = ['ospf', 'rip', 'packet'];
const DEBUG_IP_OSPF_SUBCMDS = ['adj', 'events', 'flood', 'lsa-generation'];
const UNDEBUG_SUBCMDS = ['all', 'ip', 'spanning-tree'];

const CLEAR_SUBCMDS = [
  'arp', 'arp-cache', 'counters', 'ip', 'line', 'logging', 'mac', 'spanning-tree',
];
const CLEAR_MAC_SUBCMDS = ['address-table'];
const CLEAR_MAC_TABLE_SUBCMDS = ['dynamic'];
const CLEAR_IP_SUBCMDS = ['ospf'];
const CLEAR_IP_OSPF_SUBCMDS = ['process'];
const CLEAR_STP_SUBCMDS = ['detected-protocols'];

const COPY_SUBCMDS = ['flash:', 'running-config', 'startup-config', 'tftp:'];

const CONFIGURE_SUBCMDS = ['terminal'];

const TERMINAL_SUBCMDS = ['length', 'monitor', 'width'];

const INTERFACE_TYPES = ['FastEthernet', 'GigabitEthernet', 'Vlan', 'Loopback'];

// ── Helpers ──────────────────────────────────────────────────────────────────

function longestCommonPrefix(strs: string[]): string {
  if (strs.length === 0) return '';
  let common = strs[0];
  for (const s of strs) {
    let i = 0;
    while (i < common.length && i < s.length && common[i].toLowerCase() === s[i].toLowerCase()) i++;
    common = common.slice(0, i);
  }
  return common;
}

function completeInList(
  partial: string,
  candidates: string[],
  prefix: string
): { newInput: string; displayLines: string[] } {
  const matches = matchPrefix(partial, candidates);
  if (matches.length === 0) return { newInput: prefix + partial, displayLines: [] };
  if (matches.length === 1) return { newInput: prefix + matches[0] + ' ', displayLines: [] };
  const lcp = longestCommonPrefix(matches);
  if (lcp.length > partial.length) return { newInput: prefix + lcp, displayLines: matches };
  return { newInput: prefix + partial, displayLines: matches };
}

function getInterfaceIds(state: DeviceState): string[] {
  return Object.keys(state.interfaces);
}

// Complete an interface name from partial input like "fa", "fa0/", "fa0/1"
function completeInterface(
  partial: string,
  state: DeviceState,
  inputPrefix: string
): { newInput: string; displayLines: string[] } {
  const lower = partial.toLowerCase();

  // Check if it looks like an abbreviated interface already (fa, gi, vlan, lo)
  const faMatch = lower.match(/^fa(?:st(?:ethernet)?)?(\d+\/\d*)?$/);
  const giMatch = lower.match(/^gi(?:ga(?:bit(?:ethernet)?)?)?(\d+\/\d*)?$/);
  const vlanMatch = lower.match(/^vl(?:an)?(\d*)$/);
  const loMatch = lower.match(/^lo(?:opback)?(\d*)$/);

  // Get all interface IDs
  const ifIds = getInterfaceIds(state);

  // Expand short prefix to normalized form for matching
  let expandedPartial = partial;
  if (faMatch) expandedPartial = 'Fa' + (faMatch[1] || '');
  else if (giMatch) expandedPartial = 'Gi' + (giMatch[1] || '');
  else if (vlanMatch) expandedPartial = 'Vlan' + (vlanMatch[1] || '');
  else if (loMatch) expandedPartial = 'Loopback' + (loMatch[1] || '');

  // Match against known interface IDs
  const matches = ifIds.filter(id => id.toLowerCase().startsWith(expandedPartial.toLowerCase()));

  if (matches.length === 0) {
    // Try full interface type names
    const typeMatches = INTERFACE_TYPES.filter(t => t.toLowerCase().startsWith(lower));
    if (typeMatches.length === 1) {
      return { newInput: inputPrefix + typeMatches[0], displayLines: [] };
    }
    if (typeMatches.length > 1) {
      return { newInput: inputPrefix + partial, displayLines: typeMatches };
    }
    return { newInput: inputPrefix + partial, displayLines: [] };
  }

  if (matches.length === 1) {
    return { newInput: inputPrefix + matches[0] + ' ', displayLines: [] };
  }

  const lcp = longestCommonPrefix(matches);
  if (lcp.length > expandedPartial.length) {
    return { newInput: inputPrefix + lcp, displayLines: matches };
  }
  return { newInput: inputPrefix + partial, displayLines: matches };
}

// ── Main tabComplete function ─────────────────────────────────────────────────

export function tabComplete(
  input: string,
  state: DeviceState
): { newInput: string; displayLines: string[] } {
  const trimmed = input.trimStart();
  const endsWithSpace = input.endsWith(' ');

  const tokens = trimmed.split(/\s+/).filter(Boolean);

  const modeCmds = MODE_CMDS[state.mode] || [];

  // Empty input — show all commands for mode
  if (tokens.length === 0) {
    return { newInput: input, displayLines: modeCmds };
  }

  // ── First token completion (no trailing space) ────────────────────────────
  if (tokens.length === 1 && !endsWithSpace) {
    const partial = tokens[0];
    const matches = matchPrefix(partial, modeCmds);
    if (matches.length === 0) return { newInput: input, displayLines: [] };
    if (matches.length === 1) return { newInput: matches[0] + ' ', displayLines: [] };
    const lcp = longestCommonPrefix(matches);
    if (lcp.length > partial.length) return { newInput: lcp, displayLines: matches };
    return { newInput: input, displayLines: matches };
  }

  const firstToken = tokens[0].toLowerCase();

  // Resolve first token to full command
  const firstMatches = matchPrefix(firstToken, modeCmds);
  const resolvedFirst = firstMatches.length === 1 ? firstMatches[0].toLowerCase() : firstToken;

  // ── 'show' subcommand tree ────────────────────────────────────────────────
  if (resolvedFirst === 'show' || firstToken === 'show') {
    if (tokens.length === 1 && endsWithSpace) {
      return { newInput: input, displayLines: SHOW_SUBCMDS };
    }

    if (tokens.length === 2 && !endsWithSpace) {
      return completeInList(tokens[1], SHOW_SUBCMDS, 'show ');
    }

    const sub = tokens[1]?.toLowerCase() || '';
    const subMatches = matchPrefix(sub, SHOW_SUBCMDS);
    const resolvedSub = subMatches.length === 1 ? subMatches[0].toLowerCase() : sub;

    // show interfaces [...]
    if (resolvedSub === 'interfaces' || sub.startsWith('int')) {
      if (tokens.length === 2 && endsWithSpace) {
        const ifIds = getInterfaceIds(state);
        return { newInput: input, displayLines: [...SHOW_INTERFACES_SUBCMDS, ...ifIds] };
      }
      if (tokens.length === 3 && !endsWithSpace) {
        const partial3 = tokens[2];
        const combined = [...SHOW_INTERFACES_SUBCMDS, ...getInterfaceIds(state)];
        return completeInList(partial3, combined, 'show interfaces ');
      }
    }

    // show running-config [section|interface]
    if (resolvedSub === 'running-config' || sub.startsWith('run')) {
      const rcSubcmds = ['section', 'interface', '|'];
      if (tokens.length === 2 && endsWithSpace) {
        return { newInput: input, displayLines: rcSubcmds };
      }
      if (tokens.length === 3 && !endsWithSpace) {
        return completeInList(tokens[2], rcSubcmds, 'show running-config ');
      }
      if (tokens.length === 3 && endsWithSpace && tokens[2] === 'interface') {
        const ifIds = getInterfaceIds(state);
        return { newInput: input, displayLines: ifIds };
      }
      if (tokens.length === 4 && !endsWithSpace && tokens[2] === 'interface') {
        return completeInterface(tokens[3], state, 'show running-config interface ');
      }
    }

    // show ip [...]
    if (resolvedSub === 'ip' || sub === 'ip') {
      if (tokens.length === 2 && endsWithSpace) {
        return { newInput: input, displayLines: SHOW_IP_SUBCMDS };
      }
      if (tokens.length === 3 && !endsWithSpace) {
        return completeInList(tokens[2], SHOW_IP_SUBCMDS, 'show ip ');
      }

      const ipSub = tokens[2]?.toLowerCase() || '';
      const ipSubMatches = matchPrefix(ipSub, SHOW_IP_SUBCMDS);
      const resolvedIpSub = ipSubMatches.length === 1 ? ipSubMatches[0].toLowerCase() : ipSub;

      if (resolvedIpSub === 'interface' || ipSub.startsWith('int')) {
        if (tokens.length === 3 && endsWithSpace) {
          return { newInput: input, displayLines: SHOW_IP_INTERFACE_SUBCMDS };
        }
        if (tokens.length === 4 && !endsWithSpace) {
          return completeInList(tokens[3], SHOW_IP_INTERFACE_SUBCMDS, 'show ip interface ');
        }
      }

      if (resolvedIpSub === 'ospf' || ipSub.startsWith('os')) {
        if (tokens.length === 3 && endsWithSpace) {
          return { newInput: input, displayLines: SHOW_IP_OSPF_SUBCMDS };
        }
        if (tokens.length === 4 && !endsWithSpace) {
          return completeInList(tokens[3], SHOW_IP_OSPF_SUBCMDS, 'show ip ospf ');
        }
      }

      if (resolvedIpSub === 'bgp' || ipSub.startsWith('bg')) {
        if (tokens.length === 3 && endsWithSpace) {
          return { newInput: input, displayLines: SHOW_IP_BGP_SUBCMDS };
        }
        if (tokens.length === 4 && !endsWithSpace) {
          return completeInList(tokens[3], SHOW_IP_BGP_SUBCMDS, 'show ip bgp ');
        }
      }

      if (resolvedIpSub === 'dhcp' || ipSub === 'dhcp') {
        if (tokens.length === 3 && endsWithSpace) {
          return { newInput: input, displayLines: SHOW_IP_DHCP_SUBCMDS };
        }
        if (tokens.length === 4 && !endsWithSpace) {
          return completeInList(tokens[3], SHOW_IP_DHCP_SUBCMDS, 'show ip dhcp ');
        }
      }
    }

    // show spanning-tree [vlan <id>]
    if (resolvedSub === 'spanning-tree' || sub.startsWith('span')) {
      if (tokens.length === 2 && endsWithSpace) {
        return { newInput: input, displayLines: ['vlan'] };
      }
    }

    // show vlan [brief]
    if (resolvedSub === 'vlan' || sub.startsWith('vlan')) {
      if (tokens.length === 2 && endsWithSpace) {
        return { newInput: input, displayLines: ['brief'] };
      }
    }

    // show cdp [neighbors [detail]]
    if (resolvedSub === 'cdp' || sub === 'cdp') {
      if (tokens.length === 2 && endsWithSpace) {
        return { newInput: input, displayLines: ['neighbors'] };
      }
      if (tokens.length === 3 && endsWithSpace && tokens[2] === 'neighbors') {
        return { newInput: input, displayLines: ['detail'] };
      }
    }

    return { newInput: input, displayLines: [] };
  }

  // ── 'interface' subcommand ─────────────────────────────────────────────────
  if (resolvedFirst === 'interface' || firstToken.startsWith('int')) {
    if (tokens.length === 1 && endsWithSpace) {
      const ifIds = getInterfaceIds(state);
      return { newInput: input, displayLines: [...INTERFACE_TYPES, ...ifIds] };
    }
    if (tokens.length >= 2) {
      const partialIf = tokens.slice(1).join('');
      return completeInterface(partialIf, state, 'interface ');
    }
  }

  // ── 'vlan' subcommand ──────────────────────────────────────────────────────
  if (resolvedFirst === 'vlan' || firstToken === 'vlan') {
    if (tokens.length === 1 && endsWithSpace) {
      return { newInput: input, displayLines: ['<1-4094>  VLAN ID'] };
    }
  }

  // ── 'configure' subcommand ─────────────────────────────────────────────────
  if (resolvedFirst === 'configure' || firstToken.startsWith('conf')) {
    if (tokens.length === 1 && endsWithSpace) {
      return { newInput: input, displayLines: CONFIGURE_SUBCMDS };
    }
    if (tokens.length === 2 && !endsWithSpace) {
      return completeInList(tokens[1], CONFIGURE_SUBCMDS, 'configure ');
    }
  }

  // ── 'debug' subcommand ─────────────────────────────────────────────────────
  if (resolvedFirst === 'debug') {
    if (tokens.length === 1 && endsWithSpace) {
      return { newInput: input, displayLines: DEBUG_SUBCMDS };
    }
    if (tokens.length === 2 && !endsWithSpace) {
      return completeInList(tokens[1], DEBUG_SUBCMDS, 'debug ');
    }

    const dbgSub = tokens[1]?.toLowerCase() || '';
    if (dbgSub === 'ip' || matchPrefix(dbgSub, ['ip']).length === 1) {
      if (tokens.length === 2 && endsWithSpace) {
        return { newInput: input, displayLines: DEBUG_IP_SUBCMDS };
      }
      if (tokens.length === 3 && !endsWithSpace) {
        return completeInList(tokens[2], DEBUG_IP_SUBCMDS, 'debug ip ');
      }
      const dbgIpSub = tokens[2]?.toLowerCase() || '';
      if (dbgIpSub === 'ospf' || dbgIpSub.startsWith('os')) {
        if (tokens.length === 3 && endsWithSpace) {
          return { newInput: input, displayLines: DEBUG_IP_OSPF_SUBCMDS };
        }
        if (tokens.length === 4 && !endsWithSpace) {
          return completeInList(tokens[3], DEBUG_IP_OSPF_SUBCMDS, 'debug ip ospf ');
        }
      }
    }

    if (dbgSub === 'spanning-tree' || dbgSub.startsWith('span')) {
      if (tokens.length === 2 && endsWithSpace) {
        return { newInput: input, displayLines: ['events'] };
      }
    }
  }

  // ── 'undebug' subcommand ──────────────────────────────────────────────────
  if (resolvedFirst === 'undebug' || firstToken === 'undebug' || firstToken === 'un') {
    if (tokens.length === 1 && endsWithSpace) {
      return { newInput: input, displayLines: UNDEBUG_SUBCMDS };
    }
    if (tokens.length === 2 && !endsWithSpace) {
      return completeInList(tokens[1], UNDEBUG_SUBCMDS, 'undebug ');
    }
  }

  // ── 'clear' subcommand ────────────────────────────────────────────────────
  if (resolvedFirst === 'clear') {
    if (tokens.length === 1 && endsWithSpace) {
      return { newInput: input, displayLines: CLEAR_SUBCMDS };
    }
    if (tokens.length === 2 && !endsWithSpace) {
      return completeInList(tokens[1], CLEAR_SUBCMDS, 'clear ');
    }

    const clrSub = tokens[1]?.toLowerCase() || '';

    if (clrSub === 'mac') {
      if (tokens.length === 2 && endsWithSpace) {
        return { newInput: input, displayLines: CLEAR_MAC_SUBCMDS };
      }
      if (tokens.length === 3 && !endsWithSpace) {
        return completeInList(tokens[2], CLEAR_MAC_SUBCMDS, 'clear mac ');
      }
      if (tokens.length === 3 && endsWithSpace) {
        return { newInput: input, displayLines: CLEAR_MAC_TABLE_SUBCMDS };
      }
      if (tokens.length === 4 && !endsWithSpace) {
        return completeInList(tokens[3], CLEAR_MAC_TABLE_SUBCMDS, 'clear mac address-table ');
      }
    }

    if (clrSub === 'ip') {
      if (tokens.length === 2 && endsWithSpace) {
        return { newInput: input, displayLines: CLEAR_IP_SUBCMDS };
      }
      if (tokens.length === 3 && !endsWithSpace) {
        return completeInList(tokens[2], CLEAR_IP_SUBCMDS, 'clear ip ');
      }
      if (clrSub === 'ip' && tokens[2] === 'ospf') {
        if (tokens.length === 3 && endsWithSpace) {
          return { newInput: input, displayLines: CLEAR_IP_OSPF_SUBCMDS };
        }
        if (tokens.length === 4 && !endsWithSpace) {
          return completeInList(tokens[3], CLEAR_IP_OSPF_SUBCMDS, 'clear ip ospf ');
        }
      }
    }

    if (clrSub.startsWith('span')) {
      if (tokens.length === 2 && endsWithSpace) {
        return { newInput: input, displayLines: CLEAR_STP_SUBCMDS };
      }
      if (tokens.length === 3 && !endsWithSpace) {
        return completeInList(tokens[2], CLEAR_STP_SUBCMDS, 'clear spanning-tree ');
      }
    }

    if (clrSub === 'counters') {
      if (tokens.length === 2 && endsWithSpace) {
        const ifIds = getInterfaceIds(state);
        return { newInput: input, displayLines: ['<cr>', ...ifIds] };
      }
      if (tokens.length === 3 && !endsWithSpace) {
        return completeInterface(tokens[2], state, 'clear counters ');
      }
    }
  }

  // ── 'copy' subcommand ─────────────────────────────────────────────────────
  if (resolvedFirst === 'copy') {
    if (tokens.length === 1 && endsWithSpace) {
      return { newInput: input, displayLines: COPY_SUBCMDS };
    }
    if (tokens.length === 2 && !endsWithSpace) {
      return completeInList(tokens[1], COPY_SUBCMDS, 'copy ');
    }
    if (tokens.length === 2 && endsWithSpace) {
      return { newInput: input, displayLines: COPY_SUBCMDS };
    }
    if (tokens.length === 3 && !endsWithSpace) {
      return completeInList(tokens[2], COPY_SUBCMDS, `copy ${tokens[1]} `);
    }
  }

  // ── 'terminal' subcommand ─────────────────────────────────────────────────
  if (resolvedFirst === 'terminal') {
    if (tokens.length === 1 && endsWithSpace) {
      return { newInput: input, displayLines: TERMINAL_SUBCMDS };
    }
    if (tokens.length === 2 && !endsWithSpace) {
      return completeInList(tokens[1], TERMINAL_SUBCMDS, 'terminal ');
    }
  }

  // ── 'write' subcommand ────────────────────────────────────────────────────
  if (resolvedFirst === 'write') {
    if (tokens.length === 1 && endsWithSpace) {
      return { newInput: input, displayLines: ['memory', 'erase', 'terminal'] };
    }
    if (tokens.length === 2 && !endsWithSpace) {
      return completeInList(tokens[1], ['memory', 'erase', 'terminal'], 'write ');
    }
  }

  // ── Global-config mode specific completions ───────────────────────────────
  if (state.mode === 'global-config') {

    // hostname <name>
    if (resolvedFirst === 'hostname') {
      if (tokens.length === 1 && endsWithSpace) {
        return { newInput: input, displayLines: ['<hostname>'] };
      }
    }

    // ip <subcommand>
    if (resolvedFirst === 'ip') {
      const ipGlobalSubs = ['access-list', 'default-gateway', 'domain-name', 'name-server', 'route', 'routing'];
      if (tokens.length === 1 && endsWithSpace) {
        return { newInput: input, displayLines: ipGlobalSubs };
      }
      if (tokens.length === 2 && !endsWithSpace) {
        return completeInList(tokens[1], ipGlobalSubs, 'ip ');
      }
    }

    // router <ospf|eigrp|bgp>
    if (resolvedFirst === 'router') {
      const routerProtos = ['bgp', 'eigrp', 'ospf'];
      if (tokens.length === 1 && endsWithSpace) {
        return { newInput: input, displayLines: routerProtos };
      }
      if (tokens.length === 2 && !endsWithSpace) {
        return completeInList(tokens[1], routerProtos, 'router ');
      }
    }

    // line <console|vty|aux>
    if (resolvedFirst === 'line') {
      const lineTypes = ['aux', 'console', 'vty'];
      if (tokens.length === 1 && endsWithSpace) {
        return { newInput: input, displayLines: lineTypes };
      }
      if (tokens.length === 2 && !endsWithSpace) {
        return completeInList(tokens[1], lineTypes, 'line ');
      }
    }

    // spanning-tree <subcommand>
    if (resolvedFirst === 'spanning-tree') {
      const stpSubs = ['mode', 'vlan'];
      if (tokens.length === 1 && endsWithSpace) {
        return { newInput: input, displayLines: stpSubs };
      }
      if (tokens.length === 2 && !endsWithSpace) {
        return completeInList(tokens[1], stpSubs, 'spanning-tree ');
      }
    }
  }

  // ── if-config mode specific completions ───────────────────────────────────
  if (state.mode === 'if-config') {
    if (resolvedFirst === 'switchport') {
      const swSubs = ['access', 'mode', 'nonegotiate', 'port-security', 'trunk', 'voice'];
      if (tokens.length === 1 && endsWithSpace) {
        return { newInput: input, displayLines: swSubs };
      }
      if (tokens.length === 2 && !endsWithSpace) {
        return completeInList(tokens[1], swSubs, 'switchport ');
      }
      if (tokens[1] === 'mode') {
        const modeSubs = ['access', 'dynamic', 'trunk'];
        if (tokens.length === 2 && endsWithSpace) {
          return { newInput: input, displayLines: modeSubs };
        }
        if (tokens.length === 3 && !endsWithSpace) {
          return completeInList(tokens[2], modeSubs, 'switchport mode ');
        }
      }
      if (tokens[1] === 'access') {
        if (tokens.length === 2 && endsWithSpace) {
          return { newInput: input, displayLines: ['vlan'] };
        }
      }
      if (tokens[1] === 'trunk') {
        const trunkSubs = ['allowed', 'encapsulation', 'native', 'pruning'];
        if (tokens.length === 2 && endsWithSpace) {
          return { newInput: input, displayLines: trunkSubs };
        }
        if (tokens.length === 3 && !endsWithSpace) {
          return completeInList(tokens[2], trunkSubs, 'switchport trunk ');
        }
      }
    }

    if (resolvedFirst === 'ip') {
      const ipIfSubs = ['access-group', 'address', 'helper-address', 'ospf'];
      if (tokens.length === 1 && endsWithSpace) {
        return { newInput: input, displayLines: ipIfSubs };
      }
      if (tokens.length === 2 && !endsWithSpace) {
        return completeInList(tokens[1], ipIfSubs, 'ip ');
      }
    }

    if (resolvedFirst === 'spanning-tree') {
      const stpIfSubs = ['bpdufilter', 'bpduguard', 'cost', 'guard', 'portfast', 'priority'];
      if (tokens.length === 1 && endsWithSpace) {
        return { newInput: input, displayLines: stpIfSubs };
      }
      if (tokens.length === 2 && !endsWithSpace) {
        return completeInList(tokens[1], stpIfSubs, 'spanning-tree ');
      }
    }

    if (resolvedFirst === 'duplex') {
      const duplexOpts = ['auto', 'full', 'half'];
      if (tokens.length === 1 && endsWithSpace) {
        return { newInput: input, displayLines: duplexOpts };
      }
      if (tokens.length === 2 && !endsWithSpace) {
        return completeInList(tokens[1], duplexOpts, 'duplex ');
      }
    }

    if (resolvedFirst === 'speed') {
      const speedOpts = ['10', '100', '1000', 'auto'];
      if (tokens.length === 1 && endsWithSpace) {
        return { newInput: input, displayLines: speedOpts };
      }
      if (tokens.length === 2 && !endsWithSpace) {
        return completeInList(tokens[1], speedOpts, 'speed ');
      }
    }
  }

  // ── vlan-config mode ───────────────────────────────────────────────────────
  if (state.mode === 'vlan-config') {
    if (resolvedFirst === 'state') {
      const stateOpts = ['active', 'suspend'];
      if (tokens.length === 1 && endsWithSpace) {
        return { newInput: input, displayLines: stateOpts };
      }
      if (tokens.length === 2 && !endsWithSpace) {
        return completeInList(tokens[1], stateOpts, 'state ');
      }
    }
  }

  // ── line-config mode ───────────────────────────────────────────────────────
  if (state.mode === 'line-config') {
    if (resolvedFirst === 'login') {
      const loginOpts = ['local', 'password', 'tacacs'];
      if (tokens.length === 1 && endsWithSpace) {
        return { newInput: input, displayLines: loginOpts };
      }
      if (tokens.length === 2 && !endsWithSpace) {
        return completeInList(tokens[1], loginOpts, 'login ');
      }
    }
    if (resolvedFirst === 'transport') {
      const transportSubs = ['input', 'output'];
      if (tokens.length === 1 && endsWithSpace) {
        return { newInput: input, displayLines: transportSubs };
      }
      if (tokens.length === 2 && !endsWithSpace) {
        return completeInList(tokens[1], transportSubs, 'transport ');
      }
      if (tokens[1] === 'input') {
        const inputProtos = ['all', 'none', 'ssh', 'telnet'];
        if (tokens.length === 2 && endsWithSpace) {
          return { newInput: input, displayLines: inputProtos };
        }
        if (tokens.length === 3 && !endsWithSpace) {
          return completeInList(tokens[2], inputProtos, 'transport input ');
        }
      }
    }
  }

  // ── router-config modes ────────────────────────────────────────────────────
  if (state.mode === 'router-ospf' || state.mode === 'router-eigrp' || state.mode === 'router-bgp') {
    if (resolvedFirst === 'redistribute') {
      const redistSubs = ['bgp', 'connected', 'eigrp', 'ospf', 'rip', 'static'];
      if (tokens.length === 1 && endsWithSpace) {
        return { newInput: input, displayLines: redistSubs };
      }
      if (tokens.length === 2 && !endsWithSpace) {
        return completeInList(tokens[1], redistSubs, 'redistribute ');
      }
    }
    if (resolvedFirst === 'passive-interface') {
      if (tokens.length === 1 && endsWithSpace) {
        const ifIds = getInterfaceIds(state);
        return { newInput: input, displayLines: ['default', ...ifIds] };
      }
      if (tokens.length === 2 && !endsWithSpace) {
        const ifIds = getInterfaceIds(state);
        return completeInterface(tokens[1], state, 'passive-interface ') ||
          completeInList(tokens[1], ['default', ...ifIds], 'passive-interface ');
      }
    }
  }

  return { newInput: input, displayLines: [] };
}

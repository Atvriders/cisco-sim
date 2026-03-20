import type { DeviceState } from './types';
import { matchPrefix } from './abbreviation';

const MODE_CMDS: Record<string, string[]> = {
  'user-exec': ['enable', 'disable', 'exit', 'logout', 'ping', 'traceroute', 'show', 'ssh', 'telnet', 'clock', 'more'],
  'priv-exec': ['enable', 'disable', 'exit', 'logout', 'ping', 'traceroute', 'show', 'configure', 'copy', 'write', 'reload', 'erase', 'debug', 'undebug', 'clear', 'clock', 'ssh', 'telnet'],
  'global-config': ['hostname', 'enable', 'service', 'banner', 'ip', 'ntp', 'logging', 'username', 'vlan', 'interface', 'line', 'router', 'access-list', 'spanning-tree', 'crypto', 'cdp', 'end', 'exit', 'do', 'no'],
  'if-config': ['description', 'ip', 'shutdown', 'no', 'duplex', 'speed', 'mtu', 'switchport', 'spanning-tree', 'channel-group', 'storm-control', 'end', 'exit', 'do'],
  'vlan-config': ['name', 'state', 'no', 'end', 'exit'],
  'line-config': ['login', 'password', 'exec-timeout', 'transport', 'logging', 'privilege', 'no', 'end', 'exit'],
  'router-ospf': ['network', 'router-id', 'passive-interface', 'redistribute', 'default-information', 'no', 'end', 'exit', 'do'],
  'router-eigrp': ['network', 'passive-interface', 'redistribute', 'no', 'end', 'exit', 'do'],
  'router-bgp': ['network', 'neighbor', 'bgp', 'no', 'end', 'exit', 'do'],
};

const SHOW_SUBCMDS = [
  'version', 'running-config', 'startup-config', 'interfaces', 'ip', 'vlan',
  'mac', 'arp', 'spanning-tree', 'cdp', 'processes', 'memory', 'flash',
  'clock', 'logging', 'ntp', 'etherchannel', 'port-security', 'privilege', 'users', 'history', 'environment'
];

const SHOW_IP_SUBCMDS = ['interface', 'route', 'ospf', 'eigrp', 'bgp', 'access-lists', 'dhcp'];

function getInterfaceIds(state: DeviceState): string[] {
  return Object.keys(state.interfaces);
}

export function tabComplete(
  input: string,
  state: DeviceState
): { newInput: string; displayLines: string[] } {
  const trimmed = input.trimStart();
  const endsWithSpace = input.endsWith(' ') || input !== trimmed;

  const tokens = trimmed.split(/\s+/).filter(Boolean);

  if (tokens.length === 0) {
    const cmds = MODE_CMDS[state.mode] || [];
    return { newInput: input, displayLines: cmds };
  }

  const modeCmds = MODE_CMDS[state.mode] || [];

  // First token completion
  if (tokens.length === 1 && !endsWithSpace) {
    const partial = tokens[0];
    const matches = matchPrefix(partial, modeCmds);
    if (matches.length === 1) {
      return { newInput: matches[0] + ' ', displayLines: [] };
    }
    if (matches.length > 1) {
      // Find longest common prefix
      let common = matches[0];
      for (const m of matches) {
        let i = 0;
        while (i < common.length && i < m.length && common[i].toLowerCase() === m[i].toLowerCase()) i++;
        common = common.slice(0, i);
      }
      if (common.length > partial.length) {
        return { newInput: common, displayLines: matches };
      }
      return { newInput: input, displayLines: matches };
    }
    return { newInput: input, displayLines: [] };
  }

  const firstToken = tokens[0].toLowerCase();

  // 'show' subcommand completion
  if (firstToken === 'show' || firstToken.startsWith('sh')) {
    if (tokens.length === 1 && endsWithSpace) {
      return { newInput: input, displayLines: SHOW_SUBCMDS };
    }
    if (tokens.length === 2 && !endsWithSpace) {
      const partial = tokens[1];
      const matches = matchPrefix(partial, SHOW_SUBCMDS);
      if (matches.length === 1) return { newInput: 'show ' + matches[0] + ' ', displayLines: [] };
      return { newInput: input, displayLines: matches };
    }
    if (tokens.length === 2 && endsWithSpace && tokens[1].toLowerCase() === 'ip') {
      return { newInput: input, displayLines: SHOW_IP_SUBCMDS };
    }
    if (tokens.length === 2 && endsWithSpace) {
      const sub = tokens[1].toLowerCase();
      if (sub.startsWith('int')) {
        const ifIds = getInterfaceIds(state);
        return { newInput: input, displayLines: ifIds };
      }
    }
    if (tokens.length === 3 && !endsWithSpace && tokens[1].toLowerCase() === 'ip') {
      const partial = tokens[2];
      const matches = matchPrefix(partial, SHOW_IP_SUBCMDS);
      if (matches.length === 1) return { newInput: 'show ip ' + matches[0] + ' ', displayLines: [] };
      return { newInput: input, displayLines: matches };
    }
  }

  // 'interface' subcommand completion
  if (firstToken === 'interface' || firstToken.startsWith('int')) {
    if (tokens.length >= 2) {
      const partial = tokens.slice(1).join('');
      const ifIds = getInterfaceIds(state);
      const matches = matchPrefix(partial, ifIds);
      if (matches.length === 1) return { newInput: 'interface ' + matches[0] + ' ', displayLines: [] };
      if (matches.length > 1) return { newInput: input, displayLines: matches };
    }
  }

  return { newInput: input, displayLines: [] };
}

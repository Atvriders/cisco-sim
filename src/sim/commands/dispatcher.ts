import type { DeviceState, CommandResult, TerminalLine, CliMode } from '../types';
import { resolveAbbreviation } from '../abbreviation';
import { showHandler } from './show';
import { execHandler } from './exec';
import { configHandler } from './config';
import { ifConfigHandler } from './ifConfig';
import { vlanConfigHandler } from './vlanConfig';
import { lineConfigHandler } from './lineConfig';
import { routerConfigHandler } from './routerConfig';

let _lineId = 9000;
function lid(): string { return String(_lineId++); }
function out(text: string, type: TerminalLine['type'] = 'output'): TerminalLine {
  return { id: lid(), type, text };
}

const USER_EXEC_CMDS = [
  'enable', 'disable', 'exit', 'logout', 'ping', 'traceroute', 'show',
  'ssh', 'telnet', 'clock', 'more', 'help', 'terminal'
];
const PRIV_EXEC_CMDS = [
  'enable', 'disable', 'exit', 'logout', 'ping', 'traceroute', 'show',
  'configure', 'copy', 'write', 'reload', 'erase', 'debug', 'undebug',
  'clear', 'clock', 'ssh', 'telnet', 'more', 'terminal', 'do', 'dir'
];
const GLOBAL_CONFIG_CMDS = [
  'hostname', 'enable', 'service', 'banner', 'ip', 'ipv6', 'ntp', 'logging',
  'username', 'vlan', 'interface', 'line', 'router', 'access-list',
  'spanning-tree', 'crypto', 'cdp', 'lldp', 'end', 'exit', 'do', 'no',
  'snmp-server', 'clock', 'default'
];
const IF_CONFIG_CMDS = [
  'description', 'ip', 'ipv6', 'shutdown', 'no', 'duplex', 'speed', 'mtu',
  'switchport', 'spanning-tree', 'channel-group', 'storm-control', 'lldp',
  'end', 'exit', 'do'
];
const VLAN_CONFIG_CMDS = ['name', 'state', 'no', 'end', 'exit'];
const LINE_CONFIG_CMDS = ['login', 'password', 'exec-timeout', 'transport', 'logging', 'privilege', 'no', 'end', 'exit'];
const ROUTER_CONFIG_CMDS = ['network', 'router-id', 'passive-interface', 'redistribute', 'default-information', 'neighbor', 'bgp', 'no', 'end', 'exit', 'do'];

function getCmdsForMode(mode: CliMode): string[] {
  switch (mode) {
    case 'user-exec': return USER_EXEC_CMDS;
    case 'priv-exec': return PRIV_EXEC_CMDS;
    case 'global-config': return GLOBAL_CONFIG_CMDS;
    case 'if-config': return IF_CONFIG_CMDS;
    case 'vlan-config': return VLAN_CONFIG_CMDS;
    case 'line-config': return LINE_CONFIG_CMDS;
    case 'router-ospf':
    case 'router-eigrp':
    case 'router-bgp': return ROUTER_CONFIG_CMDS;
    default: return [];
  }
}

function tokenize(input: string): string[] {
  return input.trim().split(/\s+/).filter(Boolean);
}

function caretLine(input: string, position: number): string {
  return ' '.repeat(position) + '^';
}

const SHOW_SUBCMDS_HELP = [
  'arp', 'cdp', 'clock', 'environment', 'etherchannel', 'flash', 'history',
  'interfaces', 'ip', 'logging', 'mac', 'memory', 'ntp', 'port-security',
  'privilege', 'processes', 'running-config', 'sessions', 'spanning-tree',
  'startup-config', 'terminal', 'users', 'version', 'vlan',
];
const SHOW_IP_SUBCMDS_HELP = [
  'access-lists', 'bgp', 'dhcp', 'eigrp', 'interface', 'nat', 'ospf',
  'protocols', 'route', 'ssh',
];
const SHOW_IP_INTERFACE_SUBCMDS_HELP = ['brief'];
const SHOW_IP_OSPF_SUBCMDS_HELP = ['neighbor', 'database', 'interface'];
const SHOW_IP_BGP_SUBCMDS_HELP = ['summary', 'neighbors'];
const SHOW_IP_DHCP_SUBCMDS_HELP = ['binding', 'conflict', 'pool'];

function matchPrefixLocal(input: string, candidates: string[]): string[] {
  const lower = input.toLowerCase();
  return candidates.filter(c => c.toLowerCase().startsWith(lower));
}

function getHelp(input: string, state: DeviceState): CommandResult {
  const trimmed = input.replace(/\?$/, '').trimStart();
  const cmds = getCmdsForMode(state.mode);
  const lines: TerminalLine[] = [];

  if (!trimmed) {
    lines.push(out(''));
    for (const cmd of cmds) {
      lines.push(out(`  ${cmd}`, 'info'));
    }
    lines.push(out(''));
    return { output: lines };
  }

  const tokens = tokenize(trimmed);
  const endsWithSpace = trimmed.endsWith(' ');

  // Helper to render a list of candidates as help output
  function renderList(candidates: string[]): CommandResult {
    lines.push(out(''));
    for (const c of candidates) lines.push(out(`  ${c}`, 'info'));
    if (candidates.length === 0) lines.push(out('  % No commands found', 'error'));
    lines.push(out(''));
    return { output: lines };
  }

  // Resolve the first token to a full command name
  const first = tokens[0] || '';
  const firstResolved = (() => {
    const m = cmds.filter(c => c.toLowerCase().startsWith(first.toLowerCase()));
    if (m.length === 1) return m[0].toLowerCase();
    if (m.find(c => c.toLowerCase() === first.toLowerCase())) return first.toLowerCase();
    return first.toLowerCase();
  })();

  // ── show ? / show <sub> ? ────────────────────────────────────────────────
  if (firstResolved === 'show') {
    if (tokens.length === 1 && endsWithSpace) {
      // "show " -> list show subcommands
      return renderList(SHOW_SUBCMDS_HELP);
    }

    const sub = (tokens[1] || '').toLowerCase();

    if (tokens.length === 2 && !endsWithSpace) {
      // "show ip" -> show completions for 'ip' prefix
      return renderList(matchPrefixLocal(sub, SHOW_SUBCMDS_HELP));
    }

    // Resolve sub
    const subResolved = (() => {
      const m = matchPrefixLocal(sub, SHOW_SUBCMDS_HELP);
      if (m.length === 1) return m[0];
      if (m.find(c => c === sub)) return sub;
      return sub;
    })();

    if (subResolved === 'ip') {
      if (tokens.length === 2 && endsWithSpace) {
        return renderList(SHOW_IP_SUBCMDS_HELP);
      }
      const ipSub = (tokens[2] || '').toLowerCase();
      if (tokens.length === 3 && !endsWithSpace) {
        return renderList(matchPrefixLocal(ipSub, SHOW_IP_SUBCMDS_HELP));
      }
      const ipSubResolved = (() => {
        const m = matchPrefixLocal(ipSub, SHOW_IP_SUBCMDS_HELP);
        if (m.length === 1) return m[0];
        return ipSub;
      })();
      if (ipSubResolved === 'interface') {
        if (tokens.length === 3 && endsWithSpace) return renderList(SHOW_IP_INTERFACE_SUBCMDS_HELP);
        if (tokens.length === 4 && !endsWithSpace) return renderList(matchPrefixLocal(tokens[3], SHOW_IP_INTERFACE_SUBCMDS_HELP));
      }
      if (ipSubResolved === 'ospf') {
        if (tokens.length === 3 && endsWithSpace) return renderList(SHOW_IP_OSPF_SUBCMDS_HELP);
        if (tokens.length === 4 && !endsWithSpace) return renderList(matchPrefixLocal(tokens[3], SHOW_IP_OSPF_SUBCMDS_HELP));
      }
      if (ipSubResolved === 'bgp') {
        if (tokens.length === 3 && endsWithSpace) return renderList(SHOW_IP_BGP_SUBCMDS_HELP);
        if (tokens.length === 4 && !endsWithSpace) return renderList(matchPrefixLocal(tokens[3], SHOW_IP_BGP_SUBCMDS_HELP));
      }
      if (ipSubResolved === 'dhcp') {
        if (tokens.length === 3 && endsWithSpace) return renderList(SHOW_IP_DHCP_SUBCMDS_HELP);
        if (tokens.length === 4 && !endsWithSpace) return renderList(matchPrefixLocal(tokens[3], SHOW_IP_DHCP_SUBCMDS_HELP));
      }
      if (tokens.length >= 3 && endsWithSpace) return renderList(['<cr>']);
    }

    if (tokens.length >= 2 && endsWithSpace) {
      return renderList(['<cr>']);
    }
  }

  // ── general: partial first token ─────────────────────────────────────────
  if (tokens.length === 1 && !endsWithSpace) {
    const matches = cmds.filter(c => c.toLowerCase().startsWith(first.toLowerCase()));
    return renderList(matches);
  }

  // ── trailing space on any other command ───────────────────────────────────
  if (endsWithSpace) {
    lines.push(out('  <cr>', 'info'));
    lines.push(out(''));
    return { output: lines };
  }

  // ── partial last token ────────────────────────────────────────────────────
  const last = tokens[tokens.length - 1] || '';
  const matches = cmds.filter(c => c.toLowerCase().startsWith(last.toLowerCase()));
  return renderList(matches);
}

export function dispatch(input: string, state: DeviceState): CommandResult {
  const trimmed = input.trim();

  if (!trimmed) {
    return { output: [] };
  }

  // Help via ?
  if (trimmed.endsWith('?')) {
    return getHelp(trimmed, state);
  }

  // Detect 'no' prefix
  let negated = false;
  let working = trimmed;
  if (/^no\s+/i.test(working)) {
    negated = true;
    working = working.replace(/^no\s+/i, '');
  }

  const tokens = tokenize(working);
  const firstToken = tokens[0] || '';
  const restArgs = tokens.slice(1);
  const allArgs = tokens;

  // Get valid commands for mode
  const validCmds = getCmdsForMode(state.mode);

  // Handle 'do' in config modes — execute inner command in priv-exec context
  if (firstToken.toLowerCase() === 'do' && state.mode !== 'user-exec' && state.mode !== 'priv-exec') {
    const inner = restArgs.join(' ');
    if (!inner) return { output: [out('% Incomplete command.', 'error')] };
    const innerState = { ...state, mode: 'priv-exec' as CliMode };
    return dispatch(inner, innerState);
  }

  // Resolve abbreviation for first token
  const resolution = resolveAbbreviation(firstToken, validCmds);

  if (!resolution) {
    const errPos = trimmed.indexOf(firstToken);
    const caret = ' '.repeat(errPos) + '^';
    return {
      output: [
        out(caret, 'error'),
        out(`% Invalid input detected at '^' marker.`, 'error'),
      ]
    };
  }

  if (resolution.ambiguous) {
    return {
      output: [out(`% Ambiguous command:  "${firstToken}"`, 'error')]
    };
  }

  const cmd = resolution.resolved.toLowerCase();
  const cmdArgs = [cmd, ...restArgs];

  // Route to handlers
  switch (state.mode) {
    case 'user-exec': {
      if (cmd === 'show') {
        return showHandler(restArgs, state, restArgs.join(' '), negated);
      }
      return execHandler(cmdArgs, state, trimmed, negated);
    }

    case 'priv-exec': {
      if (cmd === 'show') {
        return showHandler(restArgs, state, restArgs.join(' '), negated);
      }
      if (cmd === 'configure') {
        return execHandler(cmdArgs, state, trimmed, negated);
      }
      return execHandler(cmdArgs, state, trimmed, negated);
    }

    case 'global-config': {
      if (cmd === 'no') {
        const inner = restArgs.join(' ');
        if (!inner) return { output: [out('% Incomplete command.', 'error')] };
        const innerTokens = tokenize(inner);
        const innerFirst = innerTokens[0] || '';
        const validCmdsGlobal = getCmdsForMode('global-config');
        const innerResolution = resolveAbbreviation(innerFirst, validCmdsGlobal);
        if (!innerResolution || innerResolution.ambiguous) {
          return { output: [out('% Invalid input detected at \'^\' marker.', 'error')] };
        }
        const innerCmd = innerResolution.resolved.toLowerCase();
        return configHandler([innerCmd, ...innerTokens.slice(1)], state, inner, true);
      }
      return configHandler(cmdArgs, state, trimmed, negated);
    }

    case 'if-config': {
      if (cmd === 'no') {
        const inner = restArgs.join(' ');
        if (!inner) return { output: [out('% Incomplete command.', 'error')] };
        return ifConfigHandler(tokenize(inner), state, inner, true);
      }
      return ifConfigHandler(cmdArgs, state, trimmed, negated);
    }

    case 'vlan-config': {
      if (cmd === 'no') {
        const inner = restArgs.join(' ');
        return vlanConfigHandler(tokenize(inner), state, inner, true);
      }
      return vlanConfigHandler(cmdArgs, state, trimmed, negated);
    }

    case 'line-config': {
      if (cmd === 'no') {
        const inner = restArgs.join(' ');
        return lineConfigHandler(tokenize(inner), state, inner, true);
      }
      return lineConfigHandler(cmdArgs, state, trimmed, negated);
    }

    case 'router-ospf':
    case 'router-eigrp':
    case 'router-bgp': {
      if (cmd === 'no') {
        const inner = restArgs.join(' ');
        return routerConfigHandler(tokenize(inner), state, inner, true);
      }
      return routerConfigHandler(cmdArgs, state, trimmed, negated);
    }

    default:
      return { output: [out(`% Unknown mode: ${state.mode}`, 'error')] };
  }

  void allArgs;
  void caretLine;
}

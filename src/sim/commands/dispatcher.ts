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
  'clear', 'clock', 'ssh', 'telnet', 'more', 'terminal', 'do'
];
const GLOBAL_CONFIG_CMDS = [
  'hostname', 'enable', 'service', 'banner', 'ip', 'ntp', 'logging',
  'username', 'vlan', 'interface', 'line', 'router', 'access-list',
  'spanning-tree', 'crypto', 'cdp', 'end', 'exit', 'do', 'no',
  'snmp-server', 'clock', 'default'
];
const IF_CONFIG_CMDS = [
  'description', 'ip', 'shutdown', 'no', 'duplex', 'speed', 'mtu',
  'switchport', 'spanning-tree', 'channel-group', 'storm-control',
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
  const last = tokens[tokens.length - 1] || '';
  const endsWithSpace = trimmed.endsWith(' ');

  if (!endsWithSpace) {
    const matches = cmds.filter(c => c.toLowerCase().startsWith(last.toLowerCase()));
    lines.push(out(''));
    for (const m of matches) {
      lines.push(out(`  ${m}`, 'info'));
    }
    if (matches.length === 0) lines.push(out('  % No commands found', 'error'));
    lines.push(out(''));
  } else {
    lines.push(out('  <cr>', 'info'));
  }

  return { output: lines };
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
    // Check if it might be a show abbreviated
    const allResolution = resolveAbbreviation(firstToken, [...new Set([...USER_EXEC_CMDS, ...PRIV_EXEC_CMDS, ...GLOBAL_CONFIG_CMDS])]);
    if (allResolution && state.mode === 'user-exec') {
      return {
        output: [
          out(`% Invalid input detected at '^' marker.`, 'error'),
          out(`          ^`, 'error'),
          out(`% This command is not available in user-exec mode. Try 'enable' first.`, 'error'),
        ]
      };
    }
    const errPos = trimmed.indexOf(firstToken);
    return {
      output: [
        out(`         ^`, 'error'),
        out(`% Invalid input detected at '^' marker.`, 'error'),
      ]
    };
  }

  if (resolution.ambiguous) {
    return {
      output: [out(`% Ambiguous command: "${firstToken}"`, 'error')]
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
        // Re-dispatch with negated flag, stripping 'no'
        const inner = restArgs.join(' ');
        if (!inner) return { output: [out('% Incomplete command.', 'error')] };
        return dispatch(inner, { ...state });
        // Actually re-dispatch with negated=true
      }
      return configHandler(cmdArgs, state, trimmed, negated);
    }

    case 'if-config': {
      if (cmd === 'no') {
        const inner = restArgs.join(' ');
        if (!inner) return { output: [out('% Incomplete command.', 'error')] };
        return ifConfigHandler(tokenize(inner), state, inner, true);
      }
      if (cmd === 'do') {
        return showHandler(restArgs, state, restArgs.join(' '), false);
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
      if (cmd === 'do') {
        return showHandler(restArgs, state, restArgs.join(' '), false);
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
      if (cmd === 'do') {
        return showHandler(restArgs, state, restArgs.join(' '), false);
      }
      return routerConfigHandler(cmdArgs, state, trimmed, negated);
    }

    default:
      return { output: [out(`% Unknown mode: ${state.mode}`, 'error')] };
  }

  void allArgs;
  void caretLine;
}

import type { CommandHandler, TerminalLine, DeviceState } from '../types';
import { showHandler } from './show';

let _lineId = 2000;
function lid(): string { return String(_lineId++); }
function out(text: string, type: TerminalLine['type'] = 'output'): TerminalLine {
  return { id: lid(), type, text };
}

function isReachable(ip: string, state: DeviceState): boolean {
  if (ip.startsWith('127.')) return true;
  if (state.arpTable.some(e => e.address === ip)) return true;
  // Check if same subnet as any SVI
  for (const iface of Object.values(state.interfaces)) {
    if (iface.ipAddresses.length > 0 && iface.lineState === 'up') {
      const ifIp = iface.ipAddresses[0];
      if (sameSubnet(ip, ifIp.address, ifIp.mask)) return true;
    }
  }
  if (state.routes.some(r => r.network !== '0.0.0.0' && inNetwork(ip, r.network, r.mask))) return true;
  const defRoute = state.routes.find(r => r.network === '0.0.0.0');
  return !!defRoute;
}

function ipToNum(ip: string): number {
  return ip.split('.').reduce((acc, o) => (acc << 8) + parseInt(o), 0) >>> 0;
}

function sameSubnet(ip1: string, ip2: string, mask: string): boolean {
  const m = ipToNum(mask);
  return (ipToNum(ip1) & m) === (ipToNum(ip2) & m);
}

function inNetwork(ip: string, network: string, mask: string): boolean {
  return sameSubnet(ip, network, mask);
}

function pingOutput(ip: string, reachable: boolean, state: DeviceState): TerminalLine[] {
  const lines: TerminalLine[] = [];
  lines.push(out(''));
  lines.push(out(`Type escape sequence to abort.`));
  lines.push(out(`Sending 5, 100-byte ICMP Echos to ${ip}, timeout is 2 seconds:`));

  const srcIp = Object.values(state.interfaces)
    .filter(i => i.ipAddresses.length > 0 && i.lineState === 'up')
    .map(i => i.ipAddresses[0].address)[0] || '0.0.0.0';

  if (reachable) {
    lines.push(out('!!!!!'));
    lines.push(out(`Success rate is 100 percent (5/5), round-trip min/avg/max = 1/2/4 ms`));
  } else {
    lines.push(out('.....'));
    lines.push(out(`Success rate is 0 percent (0/5)`));
  }
  lines.push(out(''));
  void srcIp;
  return lines;
}

function tracerouteOutput(ip: string, reachable: boolean, state: DeviceState): TerminalLine[] {
  const lines: TerminalLine[] = [];
  lines.push(out(''));
  lines.push(out(`Type escape sequence to abort.`));
  lines.push(out(`Tracing the route to ${ip}`));
  lines.push(out(`VRF info: (vrf in name/id, vrf out name/id)`));

  if (reachable) {
    const gw = state.defaultGateway || '192.168.1.254';
    lines.push(out(`  1 ${gw} 2 msec 1 msec 1 msec`));
    lines.push(out(`  2 ${ip} 3 msec 3 msec 2 msec`));
  } else {
    lines.push(out(`  1 * * *`));
    lines.push(out(`  2 * * *`));
    lines.push(out(`  3 * * *`));
  }
  lines.push(out(''));
  return lines;
}

export const execHandler: CommandHandler = (args, state, raw, _negated) => {
  const cmd = (args[0] || '').toLowerCase();

  if (cmd === 'enable') {
    if (state.mode === 'priv-exec') {
      return { output: [out('Already in privileged EXEC mode', 'system')] };
    }
    return {
      output: [],
      newMode: 'priv-exec',
      newState: {}
    };
  }

  if (cmd === 'disable') {
    return {
      output: [],
      newMode: 'user-exec',
      newState: {}
    };
  }

  if (cmd === 'logout' || (cmd === 'exit' && state.mode === 'user-exec')) {
    return {
      output: [
        out(''),
        out(`${state.hostname} con0 is now available`, 'system'),
        out(''),
        out('Press RETURN to get started.', 'system'),
        out(''),
      ],
      newMode: 'user-exec'
    };
  }

  if (cmd === 'exit') {
    if (state.mode === 'priv-exec') {
      return {
        output: [],
        newMode: 'user-exec'
      };
    }
    return { output: [] };
  }

  if (cmd === 'configure') {
    if (state.mode !== 'priv-exec') {
      return { output: [out('% Command not available in this mode', 'error')] };
    }
    const sub = (args[1] || '').toLowerCase();
    if (sub && !sub.startsWith('t') && !sub.startsWith('term')) {
      return { output: [out('% Invalid input detected at \'^\' marker.', 'error')] };
    }
    return {
      output: [out('Enter configuration commands, one per line.  End with CNTL/Z.')],
      newMode: 'global-config',
      newContext: { type: 'none' }
    };
  }

  if (cmd === 'end') {
    return {
      output: [],
      newMode: 'priv-exec',
      newContext: { type: 'none' }
    };
  }

  if (cmd === 'ping') {
    const ip = args[1];
    if (!ip) return { output: [out('% Incomplete command.', 'error')] };
    const reachable = isReachable(ip, state);
    return { output: pingOutput(ip, reachable, state) };
  }

  if (cmd === 'traceroute' || cmd === 'tracert') {
    const ip = args[1];
    if (!ip) return { output: [out('% Incomplete command.', 'error')] };
    const reachable = isReachable(ip, state);
    return { output: tracerouteOutput(ip, reachable, state) };
  }

  if (cmd === 'clock') {
    const sub = (args[1] || '').toLowerCase();
    if (sub === 'set') {
      const timeStr = args[2];
      const dayStr = args[3];
      const monStr = args[4];
      const yearStr = args[5];
      if (!timeStr || !dayStr || !monStr || !yearStr) {
        return { output: [out('% Incomplete command. Usage: clock set HH:MM:SS DD Month YYYY', 'error')] };
      }
      const months: Record<string, number> = {
        jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
        jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
      };
      const [hh, mm, ss] = timeStr.split(':').map(Number);
      const mon = months[monStr.toLowerCase().slice(0, 3)];
      const day = parseInt(dayStr);
      const year = parseInt(yearStr);
      if (isNaN(hh) || isNaN(mm) || isNaN(ss) || mon === undefined || isNaN(day) || isNaN(year)) {
        return { output: [out('% Invalid clock value', 'error')] };
      }
      const newTime = new Date(year, mon, day, hh, mm, ss).getTime();
      return {
        output: [],
        newState: { currentTime: newTime }
      };
    }
    return { output: [out('% Incomplete command.', 'error')] };
  }

  if (cmd === 'write') {
    const sub = (args[1] || '').toLowerCase();
    if (!sub || sub.startsWith('mem')) {
      const newState: Partial<DeviceState> = {
        unsavedChanges: false,
        startupConfig: { ...state }
      };
      return {
        output: [out('Building configuration...'), out('[OK]', 'success')],
        newState
      };
    }
    if (sub === 'erase') {
      return {
        output: [out('Erasing the nvram filesystem will remove all configuration files! Continue? [confirm]'), out(''), out('[OK]', 'success')],
        newState: { startupConfig: undefined }
      };
    }
    return { output: [out('% Unknown write command', 'error')] };
  }

  if (cmd === 'copy') {
    const src = (args[1] || '').toLowerCase();
    const dst = (args[2] || '').toLowerCase();
    if (src.startsWith('run') && dst.startsWith('start')) {
      return {
        output: [out('Destination filename [startup-config]? ')],
        pendingInput: 'copy-run-start',
        pendingCommand: 'copy running-config startup-config'
      };
    }
    if (src.startsWith('start') && dst.startsWith('run')) {
      if (!state.startupConfig) {
        return { output: [out('% Error: No startup config present', 'error')] };
      }
      return {
        output: [out('Destination filename [running-config]? ')],
        pendingInput: 'copy-start-run',
        pendingCommand: 'copy startup-config running-config'
      };
    }
    return { output: [out(`% Unrecognized copy command: ${raw}`, 'error')] };
  }

  if (cmd === 'erase') {
    const sub = (args[1] || '').toLowerCase();
    if (sub.startsWith('start') || sub === 'nvram:') {
      return {
        output: [out('Erasing the nvram filesystem will remove all configuration files! Continue? [confirm]'), out(''), out('[OK]', 'success')],
        newState: { startupConfig: undefined }
      };
    }
    return { output: [out('% Invalid erase command', 'error')] };
  }

  if (cmd === 'reload') {
    return {
      output: [
        out('Proceed with reload? [confirm]'),
      ],
      pendingInput: 'reload-confirm',
      pendingCommand: 'reload'
    };
  }

  if (cmd === 'show') {
    return showHandler(args.slice(1), state, args.slice(1).join(' '), false);
  }

  if (cmd === 'do') {
    return showHandler(args.slice(1), state, args.slice(1).join(' '), false);
  }

  if (cmd === 'debug') {
    const sub1 = (args[1] || '').toLowerCase();
    const sub2 = (args[2] || '').toLowerCase();
    const sub3 = (args[3] || '').toLowerCase();
    if (!sub1) return { output: [out('% Incomplete command.', 'error')] };
    if (sub1 === 'ip') {
      if (sub2 === 'ospf') {
        if (sub3 === 'adj' || sub3 === 'adjacency') {
          const key = 'ip ospf adj';
          return { output: [out('OSPF adjacency debugging is on', 'system')], newState: { activeDebugs: [...(state.activeDebugs||[]).filter(d=>d!==key), key] } };
        }
        if (sub3 === 'events' || sub3 === '') {
          const key = 'ip ospf events';
          return { output: [out('OSPF events debugging is on', 'system')], newState: { activeDebugs: [...(state.activeDebugs||[]).filter(d=>d!==key), key] } };
        }
        const key = 'ip ospf events';
        return { output: [out('OSPF events debugging is on', 'system')], newState: { activeDebugs: [...(state.activeDebugs||[]).filter(d=>d!==key), key] } };
      }
      if (sub2 === 'rip') {
        const key = 'ip rip';
        return { output: [out('RIP protocol debugging is on', 'system')], newState: { activeDebugs: [...(state.activeDebugs||[]).filter(d=>d!==key), key] } };
      }
      if (sub2 === 'packet') {
        const key = 'ip packet';
        return { output: [out('IP packet debugging is on (filter list is not set)', 'system')], newState: { activeDebugs: [...(state.activeDebugs||[]).filter(d=>d!==key), key] } };
      }
    }
    if (sub1 === 'spanning-tree') {
      if (sub2 === 'events') {
        const key = 'spanning-tree events';
        return { output: [out('Spanning tree events debugging is on', 'system')], newState: { activeDebugs: [...(state.activeDebugs||[]).filter(d=>d!==key), key] } };
      }
    }
    return { output: [out(`*Mar  1 00:00:00.001: %SYS-5-DEBUG_ON: Debugging ON (${args.slice(1).join(' ')})`, 'system')] };
  }

  if (cmd === 'undebug' || cmd === 'un') {
    const sub1 = (args[1] || '').toLowerCase();
    if (sub1 === 'all' || !sub1) {
      return { output: [out('All possible debugging has been turned off', 'system')], newState: { activeDebugs: [] } };
    }
    return { output: [out('All possible debugging has been turned off', 'system')], newState: { activeDebugs: [] } };
  }

  if (cmd === 'clear') {
    const sub = (args[1] || '').toLowerCase();
    if (sub === 'counters') {
      const ifId = args[2];
      const now = Date.now();
      if (ifId) {
        const updatedIfaces = { ...state.interfaces };
        const id = Object.keys(state.interfaces).find(k => k.toLowerCase() === ifId.toLowerCase()) || ifId;
        if (updatedIfaces[id]) {
          updatedIfaces[id] = { ...updatedIfaces[id], inputPackets: 0, outputPackets: 0, inputBytes: 0, outputBytes: 0, inputErrors: 0, outputErrors: 0, lastClear: now };
        }
        return { output: [out(`Clear "show interface" counters on this interface [confirm]`), out('')], newState: { interfaces: updatedIfaces } };
      }
      const updatedIfaces: typeof state.interfaces = {};
      for (const [k, v] of Object.entries(state.interfaces)) {
        updatedIfaces[k] = { ...v, inputPackets: 0, outputPackets: 0, inputBytes: 0, outputBytes: 0, inputErrors: 0, outputErrors: 0, lastClear: now };
      }
      return { output: [out(`Clear "show interface" counters on all interfaces [confirm]`), out('')], newState: { interfaces: updatedIfaces } };
    }
    if (sub === 'mac') {
      const sub2 = (args[2] || '').toLowerCase();
      const sub3 = (args[3] || '').toLowerCase();
      // clear mac address-table dynamic
      if (sub2.startsWith('addr') || sub2 === 'address-table') {
        if (sub3 === 'dynamic' || !sub3) {
          return { output: [], newState: { macTable: state.macTable.filter(e => e.type === 'static' || e.type === 'secure-static') } };
        }
      }
      return { output: [], newState: { macTable: [] } };
    }
    if (sub === 'arp' || sub === 'arp-cache') return { output: [], newState: { arpTable: [] } };
    if (sub === 'line') {
      return {
        output: [out('[confirm]'), out('')],
        pendingInput: 'clear-line-confirm',
        pendingCommand: `clear line ${args[2] || ''}`
      };
    }
    if (sub === 'ip') {
      const sub2 = (args[2] || '').toLowerCase();
      if (sub2 === 'ospf') {
        const sub3 = (args[3] || '').toLowerCase();
        if (sub3 === 'process' || !sub3) {
          return {
            output: [out('Reset OSPF process? [no]: '), out('  -- OSPF process reset --', 'system')],
            newState: state.ospf ? { ospf: { ...state.ospf, neighbors: [] } } : {}
          };
        }
      }
    }
    if (sub.startsWith('span') || sub === 'spanning-tree') {
      const sub2 = (args[2] || '').toLowerCase();
      if (sub2 === 'detected-protocols') {
        return { output: [] };
      }
    }
    if (sub === 'logging') {
      return { output: [], newState: { loggingBuffer: [] } };
    }
    return { output: [out('% Unknown clear command', 'error')] };
  }

  if (cmd === 'terminal') {
    const sub = (args[1] || '').toLowerCase();
    if (sub === 'length') {
      const len = parseInt(args[2] || '24');
      return { output: [], newState: { terminalLength: isNaN(len) ? 24 : len } };
    }
    if (sub === 'width') {
      const w = parseInt(args[2] || '80');
      return { output: [], newState: { terminalWidth: isNaN(w) ? 80 : w } };
    }
    if (sub === 'monitor') {
      return { output: [out('Console already monitors', 'system')] };
    }
    return { output: [] };
  }

  if (cmd === 'ssh' || cmd === 'telnet') {
    const host = args[1];
    if (!host) return { output: [out('% Incomplete command.', 'error')] };
    return {
      output: [
        out(`Trying ${host} ...`),
        out(`% Connection refused by remote host`, 'error'),
      ]
    };
  }

  if (cmd === 'more') {
    return { output: [out('% Feature not supported in simulator', 'system')] };
  }

  return {
    output: [out(`% Unknown command: ${raw}`, 'error')]
  };
};

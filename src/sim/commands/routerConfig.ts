import type { CommandHandler, TerminalLine, OspfConfig, EigrpConfig, BgpConfig } from '../types';
import { showHandler } from './show';

let _lineId = 7000;
function lid(): string { return String(_lineId++); }
function out(text: string, type: TerminalLine['type'] = 'output'): TerminalLine {
  return { id: lid(), type, text };
}

export const routerConfigHandler: CommandHandler = (args, state, _raw, negated) => {
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

  const mode = state.mode;

  // OSPF commands
  if (mode === 'router-ospf') {
    const ospf: OspfConfig = state.ospf || {
      processId: 1, networks: [], redistributeConnected: false,
      redistributeStatic: false, defaultInformationOriginate: false,
      passiveInterfaces: [], neighbors: []
    };

    if (cmd === 'network') {
      const network = args[1];
      const wildcard = args[2];
      const area = parseInt(args[4] || '0');
      if (!network || !wildcard) return { output: [out('% Incomplete command.', 'error')] };
      if (negated) {
        return {
          output: [],
          newState: {
            ospf: { ...ospf, networks: ospf.networks.filter(n => !(n.network === network && n.wildcard === wildcard)) },
            unsavedChanges: true
          }
        };
      }
      return {
        output: [],
        newState: {
          ospf: { ...ospf, networks: [...ospf.networks, { network, wildcard, area }] },
          unsavedChanges: true
        }
      };
    }

    if (cmd === 'router-id') {
      if (negated) return { output: [], newState: { ospf: { ...ospf, routerId: undefined }, unsavedChanges: true } };
      const rid = args[1];
      return { output: [], newState: { ospf: { ...ospf, routerId: rid }, unsavedChanges: true } };
    }

    if (cmd === 'passive-interface') {
      const iface = args[1];
      if (!iface) return { output: [out('% Incomplete command.', 'error')] };
      if (negated) {
        return { output: [], newState: { ospf: { ...ospf, passiveInterfaces: ospf.passiveInterfaces.filter(p => p !== iface) }, unsavedChanges: true } };
      }
      return { output: [], newState: { ospf: { ...ospf, passiveInterfaces: [...ospf.passiveInterfaces, iface] }, unsavedChanges: true } };
    }

    if (cmd === 'redistribute') {
      const sub = (args[1] || '').toLowerCase();
      if (sub === 'connected') {
        return { output: [], newState: { ospf: { ...ospf, redistributeConnected: !negated }, unsavedChanges: true } };
      }
      if (sub === 'static') {
        return { output: [], newState: { ospf: { ...ospf, redistributeStatic: !negated }, unsavedChanges: true } };
      }
    }

    if (cmd === 'default-information') {
      const sub = (args[1] || '').toLowerCase();
      if (sub === 'originate') {
        return { output: [], newState: { ospf: { ...ospf, defaultInformationOriginate: !negated }, unsavedChanges: true } };
      }
    }

    return { output: [out(`% Unknown OSPF command: ${cmd}`, 'error')] };
  }

  // EIGRP commands
  if (mode === 'router-eigrp') {
    const eigrp: EigrpConfig = state.eigrp || {
      asNumber: 1, networks: [],
      passiveInterfaces: [], redistributeConnected: false,
      redistributeStatic: false, neighbors: []
    };

    if (cmd === 'network') {
      const network = args[1];
      const wildcard = args[2];
      if (!network) return { output: [out('% Incomplete command.', 'error')] };
      if (negated) {
        return {
          output: [],
          newState: { eigrp: { ...eigrp, networks: eigrp.networks.filter(n => n.network !== network) }, unsavedChanges: true }
        };
      }
      return {
        output: [],
        newState: { eigrp: { ...eigrp, networks: [...eigrp.networks, { network, wildcard }] }, unsavedChanges: true }
      };
    }

    if (cmd === 'passive-interface') {
      const iface = args[1];
      if (!iface) return { output: [out('% Incomplete command.', 'error')] };
      if (negated) {
        return { output: [], newState: { eigrp: { ...eigrp, passiveInterfaces: eigrp.passiveInterfaces.filter(p => p !== iface) }, unsavedChanges: true } };
      }
      return { output: [], newState: { eigrp: { ...eigrp, passiveInterfaces: [...eigrp.passiveInterfaces, iface] }, unsavedChanges: true } };
    }

    if (cmd === 'redistribute') {
      const sub = (args[1] || '').toLowerCase();
      if (sub === 'connected') {
        return { output: [], newState: { eigrp: { ...eigrp, redistributeConnected: !negated }, unsavedChanges: true } };
      }
      if (sub === 'static') {
        return { output: [], newState: { eigrp: { ...eigrp, redistributeStatic: !negated }, unsavedChanges: true } };
      }
    }

    return { output: [out(`% Unknown EIGRP command: ${cmd}`, 'error')] };
  }

  // BGP commands
  if (mode === 'router-bgp') {
    const bgp: BgpConfig = state.bgp || {
      asNumber: 65000, networks: [], neighbors: []
    };

    if (cmd === 'network') {
      const network = args[1];
      const maskIdx = args.indexOf('mask');
      const mask = maskIdx >= 0 ? args[maskIdx + 1] : undefined;
      if (!network) return { output: [out('% Incomplete command.', 'error')] };
      if (negated) {
        return { output: [], newState: { bgp: { ...bgp, networks: bgp.networks.filter(n => n.network !== network) }, unsavedChanges: true } };
      }
      return { output: [], newState: { bgp: { ...bgp, networks: [...bgp.networks, { network, mask }] }, unsavedChanges: true } };
    }

    if (cmd === 'neighbor') {
      const address = args[1];
      const sub = (args[2] || '').toLowerCase();
      if (!address) return { output: [out('% Incomplete command.', 'error')] };
      if (sub === 'remote-as') {
        const remoteAs = parseInt(args[3] || '0');
        if (negated) {
          return { output: [], newState: { bgp: { ...bgp, neighbors: bgp.neighbors.filter(n => n.address !== address) }, unsavedChanges: true } };
        }
        return {
          output: [],
          newState: {
            bgp: {
              ...bgp,
              neighbors: [
                ...bgp.neighbors.filter(n => n.address !== address),
                { address, remoteAs, state: 'Active', uptime: '00:00:00', prefixesReceived: 0 }
              ]
            },
            unsavedChanges: true
          }
        };
      }
    }

    if (cmd === 'bgp') {
      const sub = (args[1] || '').toLowerCase();
      if (sub === 'router-id') {
        return { output: [], newState: { bgp: { ...bgp, routerId: args[2] }, unsavedChanges: true } };
      }
    }

    return { output: [out(`% Unknown BGP command: ${cmd}`, 'error')] };
  }

  return { output: [out(`% Unknown router config command: ${cmd}`, 'error')] };
};

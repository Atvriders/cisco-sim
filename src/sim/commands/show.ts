import type { CommandHandler, DeviceState, Interface, TerminalLine } from '../types';

let _lineId = 1000;
function lid(): string { return String(_lineId++); }

function out(text: string, type: TerminalLine['type'] = 'output'): TerminalLine {
  return { id: lid(), type, text };
}

function lines(texts: string[], type: TerminalLine['type'] = 'output'): TerminalLine[] {
  return texts.map(t => out(t, type));
}

function formatUptime(ms: number): string {
  const secs = Math.floor(ms / 1000);
  const mins = Math.floor(secs / 60);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  const h = hours % 24;
  const m = mins % 60;
  if (days > 0) return `${days} day${days !== 1 ? 's' : ''}, ${h} hour${h !== 1 ? 's' : ''}, ${m} minute${m !== 1 ? 's' : ''}`;
  if (h > 0) return `${h} hour${h !== 1 ? 's' : ''}, ${m} minute${m !== 1 ? 's' : ''}`;
  return `${m} minute${m !== 1 ? 's' : ''}`;
}

function padRight(s: string, n: number): string {
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

function padLeft(s: string, n: number): string {
  return s.length >= n ? s : ' '.repeat(n - s.length) + s;
}

function normalizeIfId(id: string): string {
  return id
    .replace(/^fa(?:st\s*ethernet)?(\d+\/\d+)$/i, 'FastEthernet$1')
    .replace(/^gi(?:gabit\s*ethernet)?(\d+\/\d+)$/i, 'GigabitEthernet$1')
    .replace(/^vl(?:an)?(\d+)$/i, 'Vlan$1')
    .replace(/^lo(?:opback)?(\d*)$/i, 'Loopback$1');
}

function shortIfName(id: string): string {
  return id
    .replace('FastEthernet', 'Fa')
    .replace('GigabitEthernet', 'Gi')
    .replace('Loopback', 'Lo');
}

function expandIfNameFull(id: string): string {
  return id
    .replace(/^Fa(\d)/, 'FastEthernet$1')
    .replace(/^Gi(\d)/, 'GigabitEthernet$1')
    .replace(/^Lo(\d)/, 'Loopback$1');
}

function cdpCapabilityString(cap: string): string {
  const parts = cap.trim().split(/\s+/);
  const map: Record<string, string> = {
    'R': 'Router', 'S': 'Switch', 'I': 'IGMP', 'T': 'Trans-Bridge',
    'B': 'Source-Route-Bridge', 'H': 'IGMP', 'r': 'Repeater', 'P': 'Phone',
    'D': 'Remote', 'C': 'CVTA', 'M': 'Two-port-Mac-Relay'
  };
  return parts.map(p => map[p] || p).join(' ');
}

function showVersion(state: DeviceState): string[] {
  const uptime = formatUptime(state.currentTime - state.bootTime);
  return [
    'Cisco IOS Software, Version 15.7(3)M3, RELEASE SOFTWARE (fc2)',
    'Technical Support: http://www.cisco.com/techsupport',
    'Copyright (c) 1986-2018 by Cisco Systems, Inc.',
    'Compiled Wed 01-Aug-18 16:45 by prod_rel_team',
    '',
    'ROM: Bootstrap program is C2960X boot loader',
    'BOOTLDR: C2960X Boot Loader (C2960X-HBOOT-M) Version 15.2(7r)E2',
    '',
    `${state.hostname} uptime is ${uptime}`,
    'System returned to ROM by power-on',
    '',
    'System image file is "flash:c2960x-universalk9-mz.152-7.E6.bin"',
    'Last reload reason: power-on',
    '',
    'cisco WS-C2960X-48TS-L (PowerPC405) processor (revision B0) with 262144K bytes of memory.',
    'Processor board ID FOC2048Z0TN',
    'Last reset from power-on',
    '1 Virtual Ethernet interface',
    '48 FastEthernet interfaces',
    '4 Gigabit Ethernet interfaces',
    'The password-recovery mechanism is enabled.',
    '512K bytes of flash-simulated non-volatile configuration memory.',
    'Base ethernet MAC Address       : 00:19:E8:A2:3C:00',
    'Motherboard assembly number     : 73-15899-06',
    'Power supply part number        : 341-0606-01',
    'Motherboard serial number       : FOC20480CRS',
    'Model revision number           : B0',
    'Motherboard revision number     : C0',
    'Model number                    : WS-C2960X-48TS-L',
    'System serial number            : FOC2048Z0TN',
    'Top Assembly Part Number        : 800-42453-02',
    'Top Assembly Revision Number    : D0',
    'Version ID                      : V02',
    'CLEI Code Number                : COMHD00BRC',
    'Hardware Board Revision Number  : 0x09',
    '',
    'Switch Ports Model                     SW Version            SW Image',
    '------ ----- -----                     ----------            ----------',
    '*    1 52    WS-C2960X-48TS-L          15.7(3)M3             C2960X-UNIVERSALK9-M',
    '',
    '',
    'Configuration register is 0xF',
  ];
}

function maskToCidr(mask: string): number {
  return mask.split('.').reduce((acc, o) => {
    let n = parseInt(o);
    let c = 0;
    while (n) { c += n & 1; n >>= 1; }
    return acc + c;
  }, 0);
}

function showRunningConfig(state: DeviceState): string[] {
  const ls: string[] = [];
  ls.push('Building configuration...');
  ls.push('');
  ls.push('Current configuration : 4821 bytes');
  ls.push('!');
  ls.push('! Last configuration change');
  ls.push('!');
  ls.push('version 15.7');
  ls.push('service timestamps debug datetime msec');
  ls.push('service timestamps log datetime msec');
  if (state.servicePasswordEncryption) {
    ls.push('service password-encryption');
  } else {
    ls.push('no service password-encryption');
  }
  ls.push('!');
  ls.push(`hostname ${state.hostname}`);
  ls.push('!');
  ls.push('boot-start-marker');
  ls.push('boot-end-marker');
  ls.push('!');
  ls.push('!');
  if (state.enableSecret) {
    // Always show as type 5 (MD5 hash) format
    ls.push(`enable secret 5 $1$mERr$${btoa(state.enableSecret).slice(0, 22)}`);
  }
  if (state.enablePassword) {
    ls.push(state.servicePasswordEncryption
      ? `enable password 7 0822455D0A16`
      : `enable password ${state.enablePassword}`);
  }
  ls.push('!');
  if (state.domainName) ls.push(`ip domain-name ${state.domainName}`);
  ls.push('!');
  if (state.cryptoKeyRsa) {
    ls.push(`crypto key generate rsa modulus ${state.cryptoKeyRsa.modulus}`);
    ls.push('!');
  }
  for (const u of state.users) {
    if (u.secret) {
      ls.push(state.servicePasswordEncryption
        ? `username ${u.username} privilege ${u.privilege} secret 5 $1$mERr$${btoa(u.secret).slice(0, 22)}`
        : `username ${u.username} privilege ${u.privilege} secret 0 ${u.secret}`);
    } else if (u.password) {
      ls.push(`username ${u.username} privilege ${u.privilege} password ${u.password}`);
    }
  }
  ls.push('!');
  if (state.banner) {
    ls.push(`banner motd ^`);
    ls.push(state.banner);
    ls.push('^');
  }
  ls.push('!');

  // VLANs (1-1001 only - extended range VLANs 1002-1005 are always present, not shown in config)
  const vlanIds = Object.keys(state.vlans).map(Number).filter(v => v >= 1 && v <= 1001).sort((a,b)=>a-b);
  for (const vid of vlanIds) {
    const v = state.vlans[vid];
    ls.push(`vlan ${vid}`);
    // VLAN 1 is default name, don't output name line for it
    if (vid !== 1) {
      ls.push(` name ${v.name}`);
    }
    ls.push('!');
  }

  // Interfaces - expand short names to full canonical names for running-config
  function expandIfName(id: string): string {
    return id
      .replace(/^Fa(\d+\/\d+)$/, 'FastEthernet$1')
      .replace(/^Gi(\d+\/\d+)$/, 'GigabitEthernet$1');
    // Vlan and Loopback stay as-is
  }

  // Sort order: Loopback first, then Vlan, then FastEthernet (Fa), then GigabitEthernet (Gi)
  const sortedIfs = Object.keys(state.interfaces).sort((a, b) => {
    const aIdx = a.startsWith('Loopback') ? 0 : a.startsWith('Vlan') ? 1 : a.startsWith('Fa') ? 2 : a.startsWith('Gi') ? 3 : 4;
    const bIdx = b.startsWith('Loopback') ? 0 : b.startsWith('Vlan') ? 1 : b.startsWith('Fa') ? 2 : b.startsWith('Gi') ? 3 : 4;
    if (aIdx !== bIdx) return aIdx - bIdx;
    const anum = a.replace(/[^\d\/]/g, '').split('/').map(Number);
    const bnum = b.replace(/[^\d\/]/g, '').split('/').map(Number);
    for (let i = 0; i < Math.max(anum.length, bnum.length); i++) {
      const d = (anum[i] || 0) - (bnum[i] || 0);
      if (d !== 0) return d;
    }
    return 0;
  });

  for (const id of sortedIfs) {
    const iface = state.interfaces[id];
    const fullName = expandIfName(id);
    ls.push(`!`);
    ls.push(`interface ${fullName}`);
    if (iface.description) ls.push(` description ${iface.description}`);
    if (iface.adminState === 'down') ls.push(' shutdown');
    for (const ip of iface.ipAddresses) {
      ls.push(` ip address ${ip.address} ${ip.mask}${ip.secondary ? ' secondary' : ''}`);
    }
    for (const h of iface.ipHelperAddresses) {
      ls.push(` ip helper-address ${h}`);
    }
    for (const ag of iface.ipAccessGroups) {
      ls.push(` ip access-group ${ag.acl} ${ag.direction}`);
    }
    if (!id.startsWith('Loopback') && !id.startsWith('Vlan')) {
      if (iface.switchportMode === 'trunk') {
        ls.push(' switchport trunk encapsulation dot1q');
        if (iface.trunkNativeVlan && iface.trunkNativeVlan !== 1) {
          ls.push(` switchport trunk native vlan ${iface.trunkNativeVlan}`);
        }
        if (iface.trunkAllowedVlans && iface.trunkAllowedVlans !== '1-4094') {
          ls.push(` switchport trunk allowed vlan ${iface.trunkAllowedVlans}`);
        }
        ls.push(' switchport mode trunk');
      } else {
        if (iface.accessVlan !== 1) ls.push(` switchport access vlan ${iface.accessVlan}`);
        ls.push(' switchport mode access');
      }
      if (iface.duplex !== 'auto') ls.push(` duplex ${iface.duplex}`);
      if (iface.speed !== 'auto') ls.push(` speed ${iface.speed}`);
    }
    if (iface.spanningTree.portfast) ls.push(' spanning-tree portfast');
    if (iface.spanningTree.bpduguard) ls.push(' spanning-tree bpduguard enable');
    if (iface.channelGroup) {
      ls.push(` channel-group ${iface.channelGroup.number} mode ${iface.channelGroup.mode}`);
    }
    if (iface.portSecurity.enabled) {
      ls.push(' switchport port-security');
      if (iface.portSecurity.maxMacAddresses !== 1) {
        ls.push(` switchport port-security maximum ${iface.portSecurity.maxMacAddresses}`);
      }
      ls.push(` switchport port-security violation ${iface.portSecurity.violation}`);
    }
    if (iface.ospfCost !== undefined) ls.push(` ip ospf cost ${iface.ospfCost}`);
    if (iface.ospfPriority !== undefined) ls.push(` ip ospf priority ${iface.ospfPriority}`);
  }

  ls.push('!');
  if (state.ipRoutingEnabled) ls.push('ip routing');
  if (!state.ipRoutingEnabled && state.defaultGateway) ls.push(`ip default-gateway ${state.defaultGateway}`);
  ls.push('!');

  // Static routes
  for (const r of state.routes) {
    if (r.source === 'S') {
      if (r.nextHop) ls.push(`ip route ${r.network} ${r.mask} ${r.nextHop}`);
      else if (r.interface) ls.push(`ip route ${r.network} ${r.mask} ${r.interface}`);
    }
  }

  // ACLs
  for (const acl of Object.values(state.acls)) {
    ls.push('!');
    if (acl.type === 'extended') ls.push(`ip access-list extended ${acl.name}`);
    else ls.push(`ip access-list standard ${acl.name}`);
    for (const e of acl.entries) {
      let line = ` ${e.sequence} ${e.action}`;
      if (e.protocol) line += ` ${e.protocol}`;
      line += ` ${e.source}`;
      if (e.sourceMask) line += ` ${e.sourceMask}`;
      if (e.destination) line += ` ${e.destination}`;
      if (e.destinationMask) line += ` ${e.destinationMask}`;
      if (e.log) line += ' log';
      ls.push(line);
    }
  }

  // OSPF
  if (state.ospf) {
    const o = state.ospf;
    ls.push('!');
    ls.push(`router ospf ${o.processId}`);
    if (o.routerId) ls.push(` router-id ${o.routerId}`);
    for (const n of o.networks) {
      ls.push(` network ${n.network} ${n.wildcard} area ${n.area}`);
    }
    for (const pi of o.passiveInterfaces) ls.push(` passive-interface ${pi}`);
    if (o.redistributeConnected) ls.push(' redistribute connected subnets');
    if (o.redistributeStatic) ls.push(' redistribute static subnets');
    if (o.defaultInformationOriginate) ls.push(' default-information originate');
  }

  // EIGRP
  if (state.eigrp) {
    const e = state.eigrp;
    ls.push('!');
    ls.push(`router eigrp ${e.asNumber}`);
    for (const n of e.networks) {
      ls.push(` network ${n.network}${n.wildcard ? ' ' + n.wildcard : ''}`);
    }
    for (const pi of e.passiveInterfaces) ls.push(` passive-interface ${pi}`);
  }

  // BGP
  if (state.bgp) {
    const b = state.bgp;
    ls.push('!');
    ls.push(`router bgp ${b.asNumber}`);
    if (b.routerId) ls.push(` bgp router-id ${b.routerId}`);
    for (const n of b.networks) {
      ls.push(` network ${n.network}${n.mask ? ' mask ' + n.mask : ''}`);
    }
    for (const nb of b.neighbors) {
      ls.push(` neighbor ${nb.address} remote-as ${nb.remoteAs}`);
    }
  }

  // NTP
  ls.push('!');
  for (const s of state.ntp.servers) ls.push(`ntp server ${s}`);

  // Logging
  if (state.loggingEnabled && state.loggingServer) {
    ls.push(`logging ${state.loggingServer}`);
    ls.push(`logging trap ${state.syslogLevel}`);
  }

  // Lines
  ls.push('!');
  for (const lc of state.lines) {
    if (lc.line === 'console') {
      ls.push(`line con ${lc.start}`);
    } else if (lc.line === 'vty') {
      ls.push(`line vty ${lc.start} ${lc.end}`);
    } else {
      ls.push(`line aux ${lc.start}`);
    }
    if (lc.login === 'local') ls.push(' login local');
    else if (lc.login === 'password') ls.push(' login');
    else if (lc.login === 'none') ls.push(' no login');
    if (lc.password) ls.push(` password ${lc.password}`);
    const em = Math.floor(lc.execTimeout / 60);
    const es = lc.execTimeout % 60;
    ls.push(` exec-timeout ${em} ${es}`);
    if (lc.transportInput.length > 0) {
      ls.push(` transport input ${lc.transportInput.join(' ')}`);
    }
    if (lc.loggingSynchronous) ls.push(' logging synchronous');
  }

  ls.push('!');
  ls.push('end');
  return ls;
}

function sortInterfaces(ifaces: Interface[]): Interface[] {
  return [...ifaces].sort((a, b) => {
    const rank = (id: string) =>
      id.startsWith('Vlan') ? 0 :
      id.startsWith('Loopback') ? 1 :
      id.startsWith('Fa') ? 2 :
      id.startsWith('Gi') ? 3 : 4;
    const ra = rank(a.id);
    const rb = rank(b.id);
    if (ra !== rb) return ra - rb;
    const anum = a.id.replace(/[^\d\/]/g, '').split('/').map(Number);
    const bnum = b.id.replace(/[^\d\/]/g, '').split('/').map(Number);
    for (let i = 0; i < Math.max(anum.length, bnum.length); i++) {
      const d = (anum[i] || 0) - (bnum[i] || 0);
      if (d !== 0) return d;
    }
    return 0;
  });
}

function showInterfaces(state: DeviceState, ifFilter?: string): string[] {
  const ls: string[] = [];
  const ifaces = ifFilter
    ? [state.interfaces[ifFilter]].filter(Boolean) as Interface[]
    : sortInterfaces(Object.values(state.interfaces));

  for (const iface of ifaces) {
    if (!iface) continue;
    const lineProto = iface.lineState === 'up' ? 'up' : 'down';
    let adminStr: string;
    let connected: string;
    const isPhysical = iface.id.startsWith('Fa') || iface.id.startsWith('Gi');
    if (iface.adminState === 'down') {
      adminStr = 'administratively down';
      connected = '';
    } else if (iface.lineState === 'up') {
      adminStr = 'up';
      connected = isPhysical ? ' (connected)' : '';
    } else if (iface.lineState === 'notconnect') {
      adminStr = 'down';
      connected = isPhysical ? ' (notconnect)' : '';
    } else if (iface.lineState === 'err-disabled') {
      adminStr = 'down';
      connected = isPhysical ? ' (err-disabled)' : '';
    } else {
      adminStr = iface.lineState;
      connected = '';
    }

    // Use full interface name for display (FastEthernet not Fa)
    const displayId = expandIfNameFull(iface.id);
    ls.push(`${displayId} is ${adminStr}, line protocol is ${lineProto}${connected}`);
    const hwType = iface.id.startsWith('Gi') ? 'Gigabit Ethernet' : iface.id.startsWith('Fa') ? 'Fast Ethernet' : iface.id.startsWith('Vlan') ? 'EtherSVI' : 'Loopback';
    if (iface.id.startsWith('Vlan') || iface.id.startsWith('Loopback')) {
      ls.push(`  Hardware is ${hwType}`);
    } else {
      ls.push(`  Hardware is ${hwType}, address is ${iface.macAddress} (bia ${iface.macAddress})`);
    }
    if (iface.description) ls.push(`  Description: ${iface.description}`);
    if (iface.ipAddresses.length > 0) {
      for (const ip of iface.ipAddresses) {
        ls.push(`  Internet address is ${ip.address}/${maskToCidr(ip.mask)}${ip.secondary ? ' secondary' : ''}`);
      }
    } else {
      ls.push('  Internet address is not set');
    }

    const bw = iface.id.startsWith('Gi') ? 1000000 : iface.id.startsWith('Loopback') ? 8000000 : iface.id.startsWith('Vlan') ? 1000000 : 100000;
    const dly = iface.id.startsWith('Gi') ? 10 : iface.id.startsWith('Loopback') ? 5000 : iface.id.startsWith('Vlan') ? 10 : 100;
    ls.push(`  MTU ${iface.mtu} bytes, BW ${bw} Kbit/sec, DLY ${dly} usec,`);
    ls.push(`     reliability 255/255, txload 1/255, rxload 1/255`);
    ls.push(`  Encapsulation ARPA, loopback not set`);
    ls.push(`  Keepalive set (10 sec)`);

    const duplexStr = iface.duplex === 'full' ? 'Full-duplex' : iface.duplex === 'half' ? 'Half-duplex' : 'Auto-duplex';
    const speedStr = iface.speed === 'auto' ? 'Auto-Speed' : `${iface.speed}Mb/s`;
    const mediaType = iface.id.startsWith('Gi') ? '1000BaseTX' : '10/100BaseTX';
    ls.push(`  ${duplexStr}, ${speedStr}, media type is ${mediaType}`);
    ls.push(`  input flow-control is off, output flow-control is unsupported`);
    ls.push(`  ARP type: ARPA, ARP Timeout 04:00:00`);
    ls.push(`  Last input 00:00:02, output 00:00:00, output hang never`);
    ls.push(`  Last clearing of "show interface" counters never`);
    ls.push(`  Input queue: 0/75/0/0 (size/max/drops/flushes); Total output drops: 0`);
    ls.push(`  Queueing strategy: fifo`);
    ls.push(`  Output queue: 0/40 (size/max)`);

    const inRate = iface.lineState === 'up' ? Math.floor(iface.inputBytes / 3600) : 0;
    const outRate = iface.lineState === 'up' ? Math.floor(iface.outputBytes / 3600) : 0;
    const inPktRate = iface.lineState === 'up' ? Math.max(1, Math.floor(iface.inputPackets / 3600)) : 0;
    const outPktRate = iface.lineState === 'up' ? Math.max(1, Math.floor(iface.outputPackets / 3600)) : 0;
    ls.push(`  5 minute input rate ${inRate} bits/sec, ${inPktRate} packets/sec`);
    ls.push(`  5 minute output rate ${outRate} bits/sec, ${outPktRate} packets/sec`);
    ls.push(`     ${iface.inputPackets} packets input, ${iface.inputBytes} bytes, 0 no buffer`);
    ls.push(`     Received ${Math.floor(iface.inputPackets * 0.008)} broadcasts (0 multicasts)`);
    ls.push(`     0 runts, 0 giants, 0 throttles`);
    ls.push(`     ${iface.inputErrors} input errors, 0 CRC, 0 frame, 0 overrun, 0 ignored`);
    ls.push(`     0 watchdog, ${Math.floor(iface.inputPackets * 0.008)} multicast, 0 pause input`);
    ls.push(`     ${iface.outputPackets} packets output, ${iface.outputBytes} bytes, 0 underruns`);
    ls.push(`     ${iface.outputErrors} output errors, 0 collisions, 2 interface resets`);
    ls.push(`     0 unknown protocol drops`);
    ls.push(`     0 babbles, 0 late collision, 0 deferred`);
    ls.push(`     0 lost carrier, 0 no carrier, 0 pause output`);
    ls.push(`     0 output buffer failures, 0 output buffers swapped out`);
  }
  return ls;
}

function showIpInterfaceBrief(state: DeviceState): string[] {
  const ls: string[] = [];
  ls.push('Interface              IP-Address      OK? Method Status                Protocol');

  // Sort all interfaces: Vlan SVIs first, then Loopback, then FastEthernet (Fa), then GigabitEthernet (Gi)
  const sortedBriefIfs = sortInterfaces(Object.values(state.interfaces));

  for (const iface of sortedBriefIfs) {
    // Expand short interface IDs to full names for display
    const displayId = expandIfNameFull(iface.id);
    const ipStr = iface.ipAddresses.length > 0 ? iface.ipAddresses[0].address : 'unassigned';
    const method = iface.ipAddresses.length > 0 ? 'manual' : 'unset';
    let statusStr: string;
    if (iface.adminState === 'down') {
      statusStr = 'administratively down';
    } else if (iface.lineState === 'up') {
      statusStr = 'up';
    } else if (iface.lineState === 'err-disabled') {
      statusStr = 'err-disabled';
    } else if (iface.lineState === 'notconnect') {
      statusStr = 'down';
    } else {
      statusStr = iface.lineState;
    }
    const proto = iface.lineState === 'up' ? 'up' : 'down';
    ls.push(`${padRight(displayId, 23)}${padRight(ipStr, 16)}YES ${padRight(method, 7)}${padRight(statusStr, 22)}${proto}`);
  }
  return ls;
}

function showIpInterface(state: DeviceState, ifId: string): string[] {
  const iface = state.interfaces[ifId];
  if (!iface) return [`% Interface ${ifId} not found`];
  const ls: string[] = [];
  const adminStr = iface.adminState === 'down' ? 'administratively down' : iface.lineState === 'up' ? 'up' : iface.lineState;
  const proto = iface.lineState === 'up' ? 'up' : 'down';
  ls.push(`${iface.id} is ${adminStr}, line protocol is ${proto}`);
  if (iface.ipAddresses.length > 0) {
    const ip = iface.ipAddresses[0];
    ls.push(`  Internet address is ${ip.address}/${maskToCidr(ip.mask)}`);
  } else {
    ls.push('  Internet protocol processing disabled');
  }
  ls.push(`  Broadcast address is 255.255.255.255`);
  ls.push(`  MTU is ${iface.mtu} bytes`);
  ls.push(`  Helper address is ${iface.ipHelperAddresses.length > 0 ? iface.ipHelperAddresses.join(', ') : 'not set'}`);
  ls.push(`  Directed broadcast forwarding is disabled`);
  ls.push(`  Outgoing Common access list is not set`);
  ls.push(`  Inbound  Common access list is not set`);
  for (const ag of iface.ipAccessGroups) {
    ls.push(`  ${ag.direction === 'in' ? 'Inbound' : 'Outgoing'} access list is ${ag.acl}`);
  }
  ls.push(`  Proxy ARP is enabled`);
  ls.push(`  Local Proxy ARP is disabled`);
  ls.push(`  Security level is default`);
  ls.push(`  Split horizon is enabled`);
  ls.push(`  ICMP redirects are always sent`);
  ls.push(`  ICMP unreachables are always sent`);
  ls.push(`  ICMP mask replies are never sent`);
  ls.push(`  IP fast switching is enabled`);
  ls.push(`  IP CEF switching is enabled`);
  return ls;
}

// Extended VLANs always present on Catalyst switches (not user-configurable)
const EXTENDED_VLANS = [
  { id: 1002, name: 'fddi-default',       state: 'act/unsup' as const, ports: [] },
  { id: 1003, name: 'token-ring-default', state: 'act/unsup' as const, ports: [] },
  { id: 1004, name: 'fddinet-default',    state: 'act/unsup' as const, ports: [] },
  { id: 1005, name: 'trnet-default',      state: 'act/unsup' as const, ports: [] },
];

function formatVlanPortList(ports: string[]): string[] {
  // Returns lines of ports, wrapping at ~40 chars (real IOS wraps at column 50 of the port field)
  if (ports.length === 0) return [''];
  const shortPorts = ports.map(p => shortIfName(p));
  const lines: string[] = [];
  let current = '';
  for (let i = 0; i < shortPorts.length; i++) {
    const add = shortPorts[i] + (i < shortPorts.length - 1 ? ', ' : '');
    if (current.length + add.length > 40 && current.length > 0) {
      lines.push(current.trimEnd().replace(/,$/, ''));
      current = add;
    } else {
      current += add;
    }
  }
  if (current) lines.push(current.trimEnd().replace(/,$/, ''));
  return lines;
}

function showVlan(state: DeviceState, brief: boolean): string[] {
  const ls: string[] = [];
  ls.push('VLAN Name                             Status    Ports');
  ls.push('---- -------------------------------- --------- -------------------------------');

  const userVlanIds = Object.keys(state.vlans).map(Number).sort((a,b)=>a-b);
  const allVlans = [
    ...userVlanIds.map(vid => state.vlans[vid]),
    ...EXTENDED_VLANS
  ];

  for (const v of allVlans) {
    const portLines = formatVlanPortList(v.ports);
    const firstLine = `${padLeft(String(v.id), 4)} ${padRight(v.name, 32)} ${padRight(v.state, 9)} ${portLines[0] || ''}`;
    ls.push(firstLine);
    for (let i = 1; i < portLines.length; i++) {
      // Continuation lines: pad to ports column (47 chars)
      ls.push(`${''.padStart(47)}${portLines[i]}`);
    }
  }

  if (!brief) {
    ls.push('');
    ls.push('VLAN Type  SAID       MTU   Parent RingNo BridgeNo Stp  BrdgMode Trans1 Trans2');
    ls.push('---- ----- ---------- ----- ------ ------ -------- ---- -------- ------ ------');
    for (const v of allVlans) {
      const typeStr = v.id >= 1002 ? (v.id === 1002 ? 'fddi' : v.id === 1003 ? 'tr' : v.id === 1004 ? 'fdnet' : 'trnet') : 'enet';
      ls.push(`${padLeft(String(v.id), 4)} ${padRight(typeStr, 5)} ${String(100000+v.id).padStart(10,'0')} 1500  -      -      -        ieee -        0      0`);
    }
    ls.push('');
    ls.push('Remote SPAN VLANs');
    ls.push('------------------------------------------------------------------------------');
    ls.push('');
    ls.push('Primary Secondary Type              Ports');
    ls.push('------- --------- ----------------- ------------------------------------------');
  }
  return ls;
}

function showMacTable(state: DeviceState, dynamic: boolean): string[] {
  const ls: string[] = [];
  ls.push('          Mac Address Table');
  ls.push('-------------------------------------------');
  ls.push('');
  ls.push('Vlan    Mac Address       Type        Ports');
  ls.push('----    -----------       --------    -----');
  const entries = dynamic
    ? state.macTable.filter(e => e.type === 'dynamic' || e.type === 'secure-dynamic')
    : state.macTable;
  // Only show entries for up ports
  const upPorts = new Set(
    Object.values(state.interfaces)
      .filter(i => i.lineState === 'up')
      .map(i => i.id)
  );
  const visibleEntries = entries.filter(e => upPorts.has(e.port) || e.type === 'static');
  const sorted = [...visibleEntries].sort((a, b) => a.vlan - b.vlan || a.mac.localeCompare(b.mac));
  for (const e of sorted) {
    const typeMap: Record<string, string> = {
      'dynamic': 'DYNAMIC',
      'static': 'STATIC',
      'secure-dynamic': 'DYNAMIC',
      'secure-static': 'STATIC',
    };
    const typeStr = typeMap[e.type] ?? String(e.type).toUpperCase();
    ls.push(`${padLeft(String(e.vlan), 4)}    ${e.mac}    ${padRight(typeStr, 12)}${shortIfName(e.port)}`);
  }
  ls.push('');
  ls.push(`Total Mac Addresses for this criterion: ${sorted.length}`);
  return ls;
}

function showArp(state: DeviceState): string[] {
  const ls: string[] = [];
  ls.push('Protocol  Address          Age (min)  Hardware Addr   Type   Interface');
  for (const e of state.arpTable) {
    const ageStr = e.age === 0 ? '-' : String(e.age);
    ls.push(`Internet  ${padRight(e.address, 17)}${padLeft(ageStr, 9)}  ${e.mac}   ${e.type}   ${shortIfName(e.interface)}`);
  }
  return ls;
}

function showIpRoute(state: DeviceState): string[] {
  const ls: string[] = [];
  ls.push('Codes: C - connected, S - static, R - RIP, M - mobile, B - BGP');
  ls.push('       D - EIGRP, EX - EIGRP external, O - OSPF, IA - OSPF inter area ');
  ls.push('       N1 - OSPF NSSA external type 1, N2 - OSPF NSSA external type 2');
  ls.push('       E1 - OSPF external type 1, E2 - OSPF external type 2');
  ls.push('       i - IS-IS, su - IS-IS summary, L1 - IS-IS level-1, L2 - IS-IS level-2');
  ls.push('       ia - IS-IS inter area, * - candidate default, U - per-user static route');
  ls.push('       o - ODR, P - periodic downloaded static route, H - NHRP, l - LISP');
  ls.push('       a - application route');
  ls.push('       + - replicated route, % - next hop override, p - overrides from PfR');
  ls.push('');

  const defRoute = state.routes.find(r => r.network === '0.0.0.0' && (r.source === 'S' || r.source === '*'));
  if (defRoute) {
    ls.push(`Gateway of last resort is ${defRoute.nextHop || 'not set'} to network 0.0.0.0`);
  } else {
    ls.push('Gateway of last resort is not set');
  }
  ls.push('');

  // Group routes by major network
  const routesCopy = [...state.routes].sort((a, b) => {
    const aip = a.network.split('.').map(Number);
    const bip = b.network.split('.').map(Number);
    for (let i = 0; i < 4; i++) {
      if (aip[i] !== bip[i]) return aip[i] - bip[i];
    }
    return 0;
  });

  // Default route
  const defIdx = routesCopy.findIndex(r => r.network === '0.0.0.0');
  if (defIdx >= 0) {
    const r = routesCopy[defIdx];
    const src = 'S*';
    let line = `${padRight(src, 7)}0.0.0.0/0 [${r.adminDistance}/${r.metric}]`;
    if (r.nextHop) line += ` via ${r.nextHop}`;
    if (r.age) line += `, ${r.age}`;
    ls.push(line);
  }

  // Group remaining routes by major network (classful)
  const nonDef = routesCopy.filter(r => r.network !== '0.0.0.0');
  const majorNets: Map<string, typeof routesCopy> = new Map();
  for (const r of nonDef) {
    const parts = r.network.split('.');
    let major: string;
    const first = parseInt(parts[0]);
    if (first < 128) major = `${parts[0]}.0.0.0/8`;
    else if (first < 192) major = `${parts[0]}.${parts[1]}.0.0/16`;
    else major = `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
    if (!majorNets.has(major)) majorNets.set(major, []);
    majorNets.get(major)!.push(r);
  }

  for (const [major, rts] of majorNets) {
    const subnets = rts.length;
    const masks = new Set(rts.map(r => maskToCidr(r.mask)));
    const majorBase = major.split('/')[0];
    if (masks.size > 1) {
      ls.push(`      ${majorBase} is variably subnetted, ${subnets} subnets, ${masks.size} masks`);
    } else {
      // Always show subnet header line on real IOS
      ls.push(`      ${majorBase} is subnetted, ${subnets} subnet${subnets !== 1 ? 's' : ''}`);
    }
    for (const r of rts) {
      const srcLabel = r.source;
      let line = `${padRight(srcLabel, 7)}  ${r.network}/${maskToCidr(r.mask)} [${r.adminDistance}/${r.metric}]`;
      if (r.nextHop && r.interface) {
        line += ` via ${r.nextHop}, ${r.age}, ${r.interface}`;
      } else if (r.nextHop) {
        line += ` via ${r.nextHop}`;
        if (r.age) line += `, ${r.age}`;
      } else if (r.interface) {
        line += ` is directly connected, ${r.interface}`;
      }
      ls.push(line);
    }
  }

  return ls;
}

function showSpanningTree(state: DeviceState, vlanId?: number): string[] {
  const ls: string[] = [];
  const vids = vlanId !== undefined ? [vlanId] : Object.keys(state.spanningTree).map(Number).sort((a,b)=>a-b);

  for (const vid of vids) {
    const stp = state.spanningTree[vid];
    if (!stp) { ls.push(`% VLAN ${vid} not found`); continue; }

    ls.push(`VLAN${String(vid).padStart(4, '0')}`);
    ls.push(`  Spanning tree enabled protocol ieee`);
    ls.push(`  Root ID    Priority    ${stp.rootBridgePriority}`);
    ls.push(`             Address     ${stp.rootBridgeMac}`);
    if (stp.rootBridgeIsLocal) {
      ls.push(`             This bridge is the root`);
    }
    ls.push(`             Hello Time   ${stp.helloTime} sec  Max Age ${stp.maxAge} sec  Forward Delay ${stp.forwardDelay} sec`);
    ls.push('');
    ls.push(`  Bridge ID  Priority    ${stp.localBridgePriority}  (priority ${stp.localBridgePriority - vid} sys-id-ext ${vid})`);
    ls.push(`             Address     ${stp.localBridgeMac}`);
    ls.push(`             Hello Time   ${stp.helloTime} sec  Max Age ${stp.maxAge} sec  Forward Delay ${stp.forwardDelay} sec`);
    ls.push(`             Aging Time  300 sec`);
    if (!stp.rootBridgeIsLocal) {
      if (stp.rootPort) {
        ls.push(`             Cost         ${stp.rootCost}`);
        ls.push(`             Port         ${shortIfName(stp.rootPort)}`);
      }
      ls.push(`             Hello Time   ${stp.helloTime} sec  Max Age ${stp.maxAge} sec  Forward Delay ${stp.forwardDelay} sec`);
    }
    ls.push('');
    ls.push('Interface           Role Sts Cost      Prio.Nbr Type');
    ls.push('------------------- ---- --- --------- -------- --------------------------------');

    // Show interfaces in this VLAN
    const vlanIfaces = Object.values(state.interfaces).filter(i => {
      if (i.id.startsWith('Vlan') || i.id.startsWith('Loopback')) return false;
      if (i.switchportMode === 'trunk') return true;
      return i.accessVlan === vid;
    });

    for (const iface of vlanIfaces) {
      const stp_if = iface.spanningTree;
      const role = stp_if.role === 'designated' ? 'Desg' : stp_if.role === 'root' ? 'Root' : stp_if.role === 'alternate' ? 'Altn' : 'Dsbl';
      const sts = stp_if.state === 'forwarding' ? 'FWD' : stp_if.state === 'blocking' ? 'BLK' : stp_if.state === 'listening' ? 'LIS' : stp_if.state === 'learning' ? 'LRN' : 'DSB';
      const cost = stp_if.cost || (iface.id.startsWith('Gi') ? 4 : 19);
      const prio = stp_if.priority || 128;
      const portNum = iface.port;
      ls.push(`${padRight(shortIfName(iface.id), 20)}${role} ${sts} ${padLeft(String(cost), 9)} ${padLeft(`${prio}.${portNum}`, 8)} P2p`);
    }
    ls.push('');
  }
  return ls;
}

function showCdpNeighbors(state: DeviceState, detail: boolean): string[] {
  const ls: string[] = [];
  if (!state.cdpEnabled) {
    ls.push('% CDP is not enabled');
    return ls;
  }
  if (!detail) {
    ls.push('Capability Codes: R - Router, T - Trans Bridge, B - Source Route Bridge');
    ls.push('                  S - Switch, H - Host, I - IGMP, r - Repeater, P - Phone, ');
    ls.push('                  D - Remote, C - CVTA, M - Two-port Mac Relay');
    ls.push('');
    ls.push('Device ID        Local Intrfce     Holdtme    Capability  Platform  Port ID');
    for (const nb of state.cdpNeighbors) {
      const localShort = shortIfName(nb.localInterface).replace('Fa', 'Fas ').replace('Gi', 'Gig ');
      ls.push(`${padRight(nb.deviceId, 17)}${padRight(localShort, 18)}${padLeft(String(nb.holdtime), 7)}    ${padRight(nb.capability, 12)}${padRight(nb.platform, 10)}${nb.remoteInterface}`);
    }
  } else {
    for (const nb of state.cdpNeighbors) {
      ls.push('-------------------------');
      ls.push(`Device ID: ${nb.deviceId}`);
      ls.push(`Entry address(es):`);
      if (nb.ipAddress) ls.push(`  IP address: ${nb.ipAddress}`);
      ls.push(`Platform: cisco ${nb.platform},  Capabilities: ${cdpCapabilityString(nb.capability)}`);
      ls.push(`Interface: ${expandIfNameFull(nb.localInterface)},  Port ID (outgoing port): ${nb.remoteInterface}`);
      ls.push(`Holdtime : ${nb.holdtime} sec`);
      ls.push('');
      if (nb.iosVersion) {
        ls.push(`Version :`);
        ls.push(`Cisco IOS Software, Version ${nb.iosVersion}, RELEASE SOFTWARE (fc1)`);
      }
      ls.push('');
      ls.push(`advertisement version: 2`);
      if (nb.nativeVlan !== undefined) ls.push(`Native VLAN: ${nb.nativeVlan}`);
      if (nb.duplex) ls.push(`Duplex: ${nb.duplex}`);
      if (nb.ipAddress) {
        ls.push(`Management address(es):`);
        ls.push(`  IP address: ${nb.ipAddress}`);
      }
      ls.push('');
    }
  }
  return ls;
}

function showIpOspfNeighbor(state: DeviceState): string[] {
  if (!state.ospf) return ['% OSPF is not configured'];
  const ls: string[] = [];
  ls.push('Neighbor ID     Pri   State           Dead Time   Address         Interface');
  for (const nb of state.ospf.neighbors) {
    ls.push(`${padRight(nb.neighborId, 16)}${padLeft(String(nb.priority), 3)}   ${padRight(nb.state + '/DR', 16)}${padRight(nb.deadTime, 12)}${padRight(nb.address, 16)}${nb.interface}`);
  }
  return ls;
}

function showIpEigrpNeighbors(state: DeviceState): string[] {
  if (!state.eigrp) return ['% EIGRP is not configured'];
  const ls: string[] = [];
  ls.push(`EIGRP-IPv4 Neighbors for AS(${state.eigrp.asNumber})`);
  ls.push('H   Address                 Interface              Hold Uptime   SRTT   RTO  Q  Seq');
  ls.push('                                                   (sec)         (ms)       Cnt Num');
  for (let i = 0; i < state.eigrp.neighbors.length; i++) {
    const nb = state.eigrp.neighbors[i];
    ls.push(`${i}   ${padRight(nb.address, 24)}${padRight(shortIfName(nb.interface), 23)}${padLeft(String(nb.holdtime), 4)} 01:30:22   ${padLeft(String(nb.srtt), 5)}  ${padLeft(String(nb.rto), 5)}  ${nb.q}  ${nb.seq}`);
  }
  return ls;
}

function showIpBgpSummary(state: DeviceState): string[] {
  if (!state.bgp) return ['% BGP is not configured'];
  const ls: string[] = [];
  ls.push(`BGP router identifier ${state.bgp.routerId || '0.0.0.0'}, local AS number ${state.bgp.asNumber}`);
  ls.push('BGP table version is 1, main routing table version 1');
  ls.push('');
  ls.push('Neighbor        V           AS MsgRcvd MsgSent   TblVer  InQ OutQ Up/Down  State/PfxRcd');
  for (const nb of state.bgp.neighbors) {
    ls.push(`${padRight(nb.address, 16)}4 ${padLeft(String(nb.remoteAs), 12)}     100     120        1    0    0 ${padRight(nb.uptime, 9)}${nb.state === 'Established' ? String(nb.prefixesReceived) : nb.state}`);
  }
  return ls;
}

function showProcessesCpu(_state: DeviceState): string[] {
  return [
    'CPU utilization for five seconds: 3%/1%; one minute: 4%; five minutes: 3%',
    ' PID Runtime(ms)   Invoked      uSecs   5Sec   1Min   5Min TTY Process',
    '   1           4       247         16  0.00%  0.00%  0.00%   0 Chunk Manager',
    '   2         280     17326         16  0.00%  0.00%  0.00%   0 Load Meter',
    '   3        4820     12483        386  0.16%  0.12%  0.10%   0 Exec',
    '   4       28340     48291        587  0.08%  0.06%  0.05%   0 CEF',
    '   5        8234     18492        445  0.00%  0.00%  0.00%   0 ARP Input',
    '   6        1234      4821        255  0.00%  0.00%  0.00%   0 OSPF Hello',
    '   7         892      3421        260  0.00%  0.00%  0.00%   0 IP Background',
    '   8          56      1284         43  0.00%  0.00%  0.00%   0 CDP Protocol',
    '   9        2341      8492        275  0.00%  0.00%  0.00%   0 Spanning Tree',
    '  10         128      4921         26  0.00%  0.00%  0.00%   0 Net Background',
  ];
}

function showMemory(_state: DeviceState): string[] {
  return [
    '                Head    Total(b)     Used(b)     Free(b)   Lowest(b)  Largest(b)',
    'Processor   65C7D498   268435456   132654321   135781135   130000000   134000000',
    '      I/O   28000000    52428800    31457280    20971520    20000000    20000000',
  ];
}

function showFlash(_state: DeviceState): string[] {
  return [
    'Directory of flash:/',
    '',
    '    2  -rwx        1919                   <no date>  private-config.text',
    '    3  -rwx         967                   <no date>  config.text',
    '    4  -rwx       15561                   <no date>  express_setup.debug',
    '    5  -rwx    35574252                   <no date>  c2960x-universalk9-mz.152-7.E6.bin',
    '    6  -rwx        2163                   <no date>  multiple-fs',
    '',
    '64016384 bytes total (28439552 bytes free)',
  ];
}

function showClock(state: DeviceState): string[] {
  const d = new Date(state.currentTime);
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const hh = String(d.getUTCHours()).padStart(2,'0');
  const mm = String(d.getUTCMinutes()).padStart(2,'0');
  const ss = String(d.getUTCSeconds()).padStart(2,'0');
  // NTP synchronized = no asterisk; unsynchronized = asterisk prefix
  const prefix = state.ntp.synchronized ? '' : '*';
  return [`${prefix}${hh}:${mm}:${ss}.000 UTC ${days[d.getUTCDay()]} ${months[d.getUTCMonth()]} ${d.getUTCDate()} ${d.getUTCFullYear()}`];
}

function showLogging(state: DeviceState): string[] {
  const ls: string[] = [];
  ls.push(`Syslog logging: ${state.loggingEnabled ? 'enabled' : 'disabled'} (0 messages dropped, 0 messages rate-limited,`);
  ls.push('                0 flushes, 0 overruns, xml disabled, filtering disabled)');
  ls.push('');
  ls.push('No Active Message Discriminator.');
  ls.push('');
  ls.push('No Inactive Message Discriminator.');
  ls.push('');
  ls.push('    Console logging: level debugging, 42 messages logged, xml disabled,');
  ls.push('                     filtering disabled');
  ls.push('    Monitor logging: level debugging, 0 messages logged, xml disabled,');
  ls.push('                     filtering disabled');
  ls.push(`    Buffer logging:  level debugging, 42 messages logged, xml disabled,`);
  ls.push('                    filtering disabled');
  ls.push('    Logging Exception size (4096 bytes)');
  ls.push('    Count and timestamp logging messages: disabled');
  ls.push('    Persistent logging: disabled');
  ls.push('');
  ls.push('No active filter modules.');
  ls.push('');
  if (state.loggingServer) {
    ls.push(`    Trap logging: level informational, 47 message lines logged`);
    ls.push(`        Logging to ${state.loggingServer}  (udp port 514,  audit disabled,`);
    ls.push('              link up),');
    ls.push('              47 message lines logged,');
    ls.push('              0 message lines rate-limited,');
    ls.push('              0 message lines dropped-by-MD,');
    ls.push('              xml disabled, sequence number disabled');
    ls.push('              filtering disabled');
  } else {
    ls.push('    Trap logging: level informational, 0 message lines logged');
  }
  return ls;
}

function showNtpStatus(state: DeviceState): string[] {
  if (!state.ntp.synchronized) {
    return [
      'Clock is unsynchronized, stratum 16, no reference clock',
      'nominal freq is 250.0000 Hz, actual freq is 250.0000 Hz, precision is 2**18',
      'ntp uptime is 7200 (1/100 of seconds), resolution is 4001',
    ];
  }
  const d = new Date(state.currentTime);
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const hh = String(d.getUTCHours()).padStart(2,'0');
  const mm = String(d.getUTCMinutes()).padStart(2,'0');
  const ss = String(d.getUTCSeconds()).padStart(2,'0');
  const timeStr = `${hh}:${mm}:${ss}.000 UTC ${days[d.getUTCDay()]} ${months[d.getUTCMonth()]} ${d.getUTCDate()} ${d.getUTCFullYear()}`;
  return [
    `Clock is synchronized, stratum ${state.ntp.stratum}, reference is ${state.ntp.referenceServer || '0.0.0.0'}`,
    'nominal freq is 250.0000 Hz, actual freq is 249.9998 Hz, precision is 2**18',
    'ntp uptime is 1920 (1/100 of seconds), resolution is 4001',
    `reference time is E48A3F29.8A3D70A3 (${timeStr})`,
    `clock offset is ${state.ntp.offset} msec, root delay is 1.06 msec`,
    'root dispersion is 5.3721 msec, peer dispersion is 0.3721 msec',
    'loopfilter state is \'CTRL\' (Normal Controlled Loop), drift is 0.000000000 s/s',
    'system poll interval is 1024, last update was 123 sec ago.',
  ];
}

function showEtherchannelSummary(state: DeviceState): string[] {
  const ls: string[] = [];
  ls.push('Flags:  D - down        P - bundled in port-channel');
  ls.push('        I - stand-alone s - suspended');
  ls.push('        H - Hot-standby (LACP only)');
  ls.push('        R - Layer3      S - Layer2');
  ls.push('        U - in use      f - failed to allocate aggregator');
  ls.push('');
  ls.push('        M - not in use, minimum links not met');
  ls.push('        u - unsuitable for bundling');
  ls.push('        w - waiting to be aggregated');
  ls.push('        d - default port');
  ls.push('');
  ls.push('        A - formed by Auto LAG');
  ls.push('');

  const groups: Map<number, Interface[]> = new Map();
  for (const iface of Object.values(state.interfaces)) {
    if (iface.channelGroup) {
      const g = iface.channelGroup.number;
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push(iface);
    }
  }

  ls.push(`Number of channel-groups in use: ${groups.size}`);
  ls.push(`Number of aggregators:           ${groups.size}`);
  ls.push('');
  ls.push('Group  Port-channel  Protocol    Ports');
  ls.push('------+-------------+-----------+-----------------------------------------------');

  for (const [g, ifs] of groups) {
    const mode = ifs[0].channelGroup!.mode;
    const proto = mode === 'on' ? '-' : mode === 'active' || mode === 'passive' ? 'LACP' : 'LACP';
    const ports = ifs.map(i => `${shortIfName(i.id)}(P)`).join('   ');
    ls.push(`${padLeft(String(g),6)}  Po${g}(SU)        ${padRight(proto, 11)}${ports}`);
  }

  return ls;
}

function showPortSecurity(state: DeviceState): string[] {
  const ls: string[] = [];
  ls.push('Secure Port  MaxSecureAddr  CurrentAddr  SecurityViolation  Security Action');
  ls.push('                (Count)       (Count)          (Count)');
  ls.push('---------------------------------------------------------------------------');

  const secPorts = Object.values(state.interfaces).filter(i => i.portSecurity.enabled);
  for (const iface of secPorts) {
    const violationAction = iface.portSecurity.violation.charAt(0).toUpperCase() + iface.portSecurity.violation.slice(1);
    ls.push(`${padLeft(shortIfName(iface.id), 11)}${padLeft(String(iface.portSecurity.maxMacAddresses), 15)}${padLeft(String(iface.portSecurity.learnedAddresses.length), 13)}${padLeft('0', 19)}         ${violationAction}`);
  }
  ls.push('---------------------------------------------------------------------------');
  ls.push('Total Addresses in System (excluding one mac per port)     : 0');
  ls.push('Max Addresses limit in System (excluding one mac per port) : 4096');
  return ls;
}

function showIpAccessLists(state: DeviceState): string[] {
  const ls: string[] = [];
  if (Object.keys(state.acls).length === 0) {
    ls.push('% No access list is defined');
    return ls;
  }
  for (const acl of Object.values(state.acls)) {
    ls.push(`${acl.type === 'extended' ? 'Extended' : 'Standard'} IP access list ${acl.name}`);
    for (const e of acl.entries) {
      const actionPad = e.action === 'permit' ? 'permit' : 'deny  ';
      let line = `    ${e.sequence} ${actionPad}`;
      if (e.protocol && acl.type === 'extended') line += ` ${e.protocol}`;
      // Source
      if (e.source === 'any') {
        line += ` any`;
      } else if (!e.sourceMask || e.sourceMask === '0.0.0.0') {
        line += ` host ${e.source}`;
      } else {
        line += ` ${e.source}, wildcard bits ${e.sourceMask}`;
      }
      // Destination (extended only)
      if (acl.type === 'extended' && e.destination) {
        if (e.destination === 'any') {
          line += ` any`;
        } else if (!e.destinationMask || e.destinationMask === '0.0.0.0') {
          line += ` host ${e.destination}`;
        } else {
          line += ` ${e.destination} ${e.destinationMask}`;
        }
      }
      if (e.log) line += ' log';
      const matchStr = e.matches > 0
        ? ` (${e.matches} match${e.matches !== 1 ? 'es' : ''})`
        : ' (0 matches)';
      line += matchStr;
      ls.push(line);
    }
  }
  return ls;
}

function showIpDhcpBinding(_state: DeviceState): string[] {
  return [
    'Bindings from all pools not associated with VRF:',
    'IP address          Client-ID/              Lease expiration        Type       State      Interface',
    '                    Hardware address/',
    '                    User name',
    '10.10.10.100        0100.1a2b.3c4d.5e       Mar 21 2026 12:00 AM    Automatic  Active     Vlan10',
    '10.10.10.101        0100.2b3c.4d5e.6f       Mar 21 2026 12:00 AM    Automatic  Active     Vlan10',
    '10.20.20.100        0100.3c4d.5e6f.7a       Mar 21 2026 12:00 AM    Automatic  Active     Vlan20',
  ];
}

function showIpDhcpPool(_state: DeviceState): string[] {
  return [
    'Pool DATA-POOL :',
    ' Utilization mark (high/low)    : 100 / 0',
    ' Subnet size (first/next)       : 0 / 0 ',
    ' Total addresses                : 254',
    ' Leased addresses               : 3',
    ' Pending event                  : none',
    ' 1 subnet is currently in the pool :',
    ' Current index        IP address range                    Leased addresses',
    ' 10.10.10.102         10.10.10.1       - 10.10.10.254      3',
  ];
}

function showIpDhcpConflict(_state: DeviceState): string[] {
  return [
    'There is no record for 0 conflicting address',
  ];
}

function showSessions(_state: DeviceState): string[] {
  return [
    'Conn Host                                Address             Byte  Idle Conn Name',
  ];
}

function showTerminal(_state: DeviceState): string[] {
  return [
    'Line 0, Location: "", Type: ""',
    'Length: 24 lines, Width: 80 columns',
    'Baud rate (TX/RX) is 9600/9600, no parity, 2 stopbits, 8 databits',
    'Status: PSI Enabled, Ready, Active, No Exit Banner',
    'Capabilities: none',
    'Modem state: Ready',
    'Special Chars: Escape  Hold  Stop  Start  Disconnect  Activation',
    '              ^^X     none  -     -     none        none',
    'Timeouts:      Idle EXEC    Idle Session   Modem Answer  PPP Negotiation',
    '               00:10:00      never          none                 none',
    '              H  H   Logged in',
  ];
}

function showIpSsh(_state: DeviceState): string[] {
  return [
    'SSH Enabled - version 2.0',
    'Authentication timeout: 120 secs; Authentication retries: 3',
    'Minimum expected Diffie Hellman key size : 1024 bits',
    'IOS Keys in SECURE configuration: YES (touched)',
  ];
}

function showInterfacesStatus(state: DeviceState): string[] {
  const ls: string[] = [];
  ls.push('Port      Name               Status       Vlan       Duplex  Speed Type');

  const physIfaces = Object.values(state.interfaces)
    .filter(i => i.id.startsWith('Fa') || i.id.startsWith('Gi'))
    .sort((a, b) => {
      const aGi = a.id.startsWith('Gi') ? 1 : 0;
      const bGi = b.id.startsWith('Gi') ? 1 : 0;
      if (aGi !== bGi) return aGi - bGi;
      return a.port - b.port;
    });

  for (const iface of physIfaces) {
    const portShort = shortIfName(iface.id).replace('FastEthernet', 'Fa').replace('GigabitEthernet', 'Gi');
    const name = iface.description.length > 18 ? iface.description.slice(0, 18) : iface.description;
    let statusStr: string;
    if (iface.adminState === 'down') statusStr = 'disabled';
    else if (iface.lineState === 'up') statusStr = 'connected';
    else if (iface.lineState === 'err-disabled') statusStr = 'err-disabled';
    else statusStr = 'notconnect';

    let vlanStr: string;
    if (iface.switchportMode === 'trunk') {
      vlanStr = 'trunk';
    } else {
      vlanStr = String(iface.accessVlan);
    }

    const duplexStr = iface.duplex === 'full' ? 'full' : iface.duplex === 'half' ? 'half' : 'auto';
    const speedStr = iface.speed === 'auto' ? 'auto' : iface.speed;
    const typeStr = iface.id.startsWith('Gi') ? '1000BaseTX' : '10/100BaseTX';
    const duplexDisplay = iface.lineState === 'up' ? (iface.duplex === 'auto' ? 'a-full' : duplexStr) : 'auto';
    const speedDisplay = iface.lineState === 'up' ? (iface.speed === 'auto' ? 'a-100' : speedStr) : 'auto';

    ls.push(`${padRight(portShort, 10)}${padRight(name, 19)}${padRight(statusStr, 13)}${padRight(vlanStr, 11)}${padRight(duplexDisplay, 8)}${padRight(speedDisplay, 6)}${typeStr}`);
  }

  return ls;
}

function showInterfacesTrunk(state: DeviceState): string[] {
  const ls: string[] = [];
  const trunkIfaces = Object.values(state.interfaces)
    .filter(i => i.switchportMode === 'trunk' && (i.id.startsWith('Fa') || i.id.startsWith('Gi')))
    .sort((a, b) => {
      const aGi = a.id.startsWith('Gi') ? 1 : 0;
      const bGi = b.id.startsWith('Gi') ? 1 : 0;
      if (aGi !== bGi) return aGi - bGi;
      return a.port - b.port;
    });

  if (trunkIfaces.length === 0) {
    return [''];
  }

  ls.push('Port        Mode             Encapsulation  Status        Native vlan');
  for (const iface of trunkIfaces) {
    const portShort = shortIfName(iface.id);
    ls.push(`${padRight(portShort, 12)}${padRight('on', 17)}${padRight('802.1q', 15)}${padRight('trunking', 14)}${iface.trunkNativeVlan}`);
  }

  ls.push('');
  ls.push('Port        Vlans allowed on trunk');
  for (const iface of trunkIfaces) {
    const portShort = shortIfName(iface.id);
    ls.push(`${padRight(portShort, 12)}${iface.trunkAllowedVlans || '1-4094'}`);
  }

  ls.push('');
  ls.push('Port        Vlans allowed and active in management domain');
  for (const iface of trunkIfaces) {
    const portShort = shortIfName(iface.id);
    ls.push(`${padRight(portShort, 12)}${iface.trunkAllowedVlans || '1-4094'}`);
  }

  ls.push('');
  ls.push('Port        Vlans in spanning tree forwarding state and not pruned');
  for (const iface of trunkIfaces) {
    const portShort = shortIfName(iface.id);
    ls.push(`${padRight(portShort, 12)}${iface.trunkAllowedVlans || '1-4094'}`);
  }

  return ls;
}

function showRunInterface(state: DeviceState, ifId: string): string[] {
  const iface = state.interfaces[ifId];
  if (!iface) return [`% Interface ${ifId} not found`];

  function expandIfName(id: string): string {
    return id
      .replace(/^Fa(\d+\/\d+)$/, 'FastEthernet$1')
      .replace(/^Gi(\d+\/\d+)$/, 'GigabitEthernet$1');
  }

  const ls: string[] = [];
  ls.push('Building configuration...');
  ls.push('');
  const byteCount = 87;
  ls.push(`Current configuration : ${byteCount} bytes`);
  ls.push('!');
  const fullName = expandIfName(ifId);
  ls.push(`interface ${fullName}`);
  if (iface.description) ls.push(` description ${iface.description}`);
  if (iface.adminState === 'down') ls.push(' shutdown');
  for (const ip of iface.ipAddresses) {
    ls.push(` ip address ${ip.address} ${ip.mask}${ip.secondary ? ' secondary' : ''}`);
  }
  for (const h of iface.ipHelperAddresses) ls.push(` ip helper-address ${h}`);
  for (const ag of iface.ipAccessGroups) ls.push(` ip access-group ${ag.acl} ${ag.direction}`);
  if (!ifId.startsWith('Loopback') && !ifId.startsWith('Vlan')) {
    if (iface.switchportMode === 'trunk') {
      ls.push(' switchport trunk encapsulation dot1q');
      if (iface.trunkNativeVlan && iface.trunkNativeVlan !== 1) ls.push(` switchport trunk native vlan ${iface.trunkNativeVlan}`);
      if (iface.trunkAllowedVlans && iface.trunkAllowedVlans !== '1-4094') ls.push(` switchport trunk allowed vlan ${iface.trunkAllowedVlans}`);
      ls.push(' switchport mode trunk');
    } else {
      if (iface.accessVlan !== 1) ls.push(` switchport access vlan ${iface.accessVlan}`);
      ls.push(' switchport mode access');
    }
    if (iface.duplex !== 'auto') ls.push(` duplex ${iface.duplex}`);
    if (iface.speed !== 'auto') ls.push(` speed ${iface.speed}`);
  }
  if (iface.spanningTree.portfast) ls.push(' spanning-tree portfast');
  if (iface.spanningTree.bpduguard) ls.push(' spanning-tree bpduguard enable');
  if (iface.channelGroup) ls.push(` channel-group ${iface.channelGroup.number} mode ${iface.channelGroup.mode}`);
  if (iface.portSecurity.enabled) {
    ls.push(' switchport port-security');
    if (iface.portSecurity.maxMacAddresses !== 1) ls.push(` switchport port-security maximum ${iface.portSecurity.maxMacAddresses}`);
    ls.push(` switchport port-security violation ${iface.portSecurity.violation}`);
  }
  ls.push('!');
  ls.push('end');
  return ls;
}

function applyPipeFilter(lines: string[], pipeArgs: string[]): string[] {
  if (!pipeArgs || pipeArgs.length === 0) return lines;
  const verb = (pipeArgs[0] || '').toLowerCase();
  const pattern = pipeArgs.slice(1).join(' ');
  if (!pattern) return lines;

  if (verb === 'include') {
    try {
      const re = new RegExp(pattern, 'i');
      return lines.filter(l => re.test(l));
    } catch {
      return lines.filter(l => l.toLowerCase().includes(pattern.toLowerCase()));
    }
  }
  if (verb === 'exclude') {
    try {
      const re = new RegExp(pattern, 'i');
      return lines.filter(l => !re.test(l));
    } catch {
      return lines.filter(l => !l.toLowerCase().includes(pattern.toLowerCase()));
    }
  }
  if (verb === 'begin') {
    try {
      const re = new RegExp(pattern, 'i');
      const idx = lines.findIndex(l => re.test(l));
      return idx >= 0 ? lines.slice(idx) : [];
    } catch {
      const idx = lines.findIndex(l => l.toLowerCase().includes(pattern.toLowerCase()));
      return idx >= 0 ? lines.slice(idx) : [];
    }
  }
  return lines;
}

function applyRunningConfigSection(lines: string[], keyword: string): string[] {
  // Find all sections matching keyword (e.g. "interface" or "router")
  const result: string[] = [];
  let inSection = false;
  for (const line of lines) {
    if (line.toLowerCase().startsWith(keyword.toLowerCase()) && !line.startsWith(' ')) {
      inSection = true;
    } else if (inSection && !line.startsWith(' ') && line !== '!' && line !== '') {
      inSection = false;
    }
    if (inSection) result.push(line);
  }
  return result;
}

function showIpProtocols(state: DeviceState): string[] {
  const ls: string[] = [];
  ls.push('*** IP Routing is NSF aware ***');
  ls.push('');

  if (state.ospf) {
    const o = state.ospf;
    ls.push(`Routing Protocol is "ospf ${o.processId}"`);
    ls.push(`  Outgoing update filter list for all interfaces is not set`);
    ls.push(`  Incoming update filter list for all interfaces is not set`);
    ls.push(`  Router ID ${o.routerId || '0.0.0.0'}`);
    const areaCount = new Set(o.networks.map(n => n.area)).size || 1;
    ls.push(`  Number of areas in this router is ${areaCount}. ${areaCount} normal 0 stub 0 nssa`);
    ls.push(`  Maximum path: 4`);
    ls.push(`  Routing for Networks:`);
    for (const n of o.networks) {
      ls.push(`    ${n.network} ${n.wildcard} area ${n.area}`);
    }
    if (o.passiveInterfaces.length > 0) {
      ls.push(`  Passive Interface(s):`);
      for (const pi of o.passiveInterfaces) {
        ls.push(`    ${pi}`);
      }
    } else {
      ls.push(`  Passive Interface(s):`);
    }
    ls.push(`  Routing Information Sources:`);
    ls.push(`    Gateway         Distance      Last Update`);
    for (const nb of o.neighbors) {
      ls.push(`    ${padRight(nb.address, 16)}   ${padLeft(String(110), 8)}      00:15:30`);
    }
    ls.push(`  Distance: (default is 110)`);
    ls.push('');
  }

  if (state.eigrp) {
    const e = state.eigrp;
    ls.push(`Routing Protocol is "eigrp ${e.asNumber}"`);
    ls.push(`  Outgoing update filter list for all interfaces is not set`);
    ls.push(`  Incoming update filter list for all interfaces is not set`);
    ls.push(`  Default networks flagged in outgoing updates`);
    ls.push(`  Default networks accepted from incoming updates`);
    ls.push(`  EIGRP-IPv4 Protocol for AS(${e.asNumber})`);
    ls.push(`    Metric weight K1=1, K2=0, K3=1, K4=0, K5=0`);
    ls.push(`    NSF-aware route hold timer is 240`);
    ls.push(`    Router-ID: ${Object.values(state.interfaces).find(i => i.id.startsWith('Loopback') && i.ipAddresses.length > 0)?.ipAddresses[0].address || '0.0.0.0'}`);
    ls.push(`  Automatic Summarization: disabled`);
    ls.push(`  Maximum path: 4`);
    ls.push(`  Routing for Networks:`);
    for (const n of e.networks) {
      ls.push(`    ${n.network}${n.wildcard ? ' ' + n.wildcard : ''}`);
    }
    ls.push(`  Distance: internal 90 external 170`);
    ls.push('');
  }

  if (state.bgp) {
    const b = state.bgp;
    ls.push(`Routing Protocol is "bgp ${b.asNumber}"`);
    ls.push(`  Outgoing update filter list for all interfaces is not set`);
    ls.push(`  Incoming update filter list for all interfaces is not set`);
    ls.push(`  IGP synchronization is disabled`);
    ls.push(`  Automatic route summarization is disabled`);
    ls.push(`  Maximum path: 1`);
    ls.push(`  Routing for Networks:`);
    for (const n of b.networks) {
      ls.push(`    ${n.network}${n.mask ? ' mask ' + n.mask : ''}`);
    }
    ls.push(`  Routing Information Sources:`);
    ls.push(`    Gateway         Distance      Last Update`);
    for (const nb of b.neighbors) {
      ls.push(`    ${padRight(nb.address, 16)}   ${padLeft(String(200), 8)}      ${nb.uptime}`);
    }
    ls.push(`  Distance: external 20 internal 200 local 200`);
    ls.push('');
  }

  if (!state.ospf && !state.eigrp && !state.bgp) {
    ls.push('');
  }
  return ls;
}

function showIpOspfDetail(state: DeviceState): string[] {
  if (!state.ospf) return ['% OSPF is not configured'];
  const o = state.ospf;
  const uptime = formatUptime(state.currentTime - state.bootTime);
  const ls: string[] = [];
  ls.push(` Routing Process "ospf ${o.processId}" with ID ${o.routerId || '0.0.0.0'}`);
  ls.push(` Start time: 00:00:15.204, Time elapsed: ${uptime}`);
  ls.push(` Supports only single TOS(TOS0) routes`);
  ls.push(` Supports opaque LSA`);
  ls.push(` Supports Link-local Signaling (LLS)`);
  ls.push(` Supports area transit capability`);
  ls.push(` Supports NSSA (compatible with RFC 3101)`);
  ls.push(` Supports Database Exchange Summary List Optimization (RFC 5243)`);
  ls.push(` Event-log enabled, Maximum number of events: 1000, Mode: cyclic`);
  ls.push(` Router is not originating router-LSAs with maximum metric`);
  ls.push(` Initial SPF schedule delay 5000 msecs`);
  ls.push(` Minimum hold time between two consecutive SPFs 10000 msecs`);
  ls.push(` Maximum wait time between two consecutive SPFs 10000 msecs`);
  ls.push(` Incremental-SPF disabled`);
  ls.push(` Minimum LSA interval 5 secs`);
  ls.push(` Minimum LSA arrival 1000 msecs`);
  ls.push(` LSA group pacing timer 240 secs`);
  ls.push(` Interface flood pacing timer 33 msecs`);
  ls.push(` Retransmission pacing timer 66 msecs`);
  ls.push(` EXCHANGE/LOADING adjacency limit: initial 300, process maximum 300`);
  ls.push(` Number of external LSA 1. Checksum Sum 0x00BF08`);
  ls.push(` Number of opaque AS LSA 0. Checksum Sum 0x000000`);
  ls.push(` Number of DCbitless external and opaque AS LSA 0`);
  ls.push(` Number of DoNotAge external and opaque AS LSA 0`);
  ls.push(` Number of areas in this router is 1. 1 normal 0 stub 0 nssa`);
  ls.push(` Number of areas transit capable is 0`);
  ls.push(` External flood list length 0`);
  ls.push(` IETF NSF helper support enabled`);
  ls.push(` Cisco NSF helper support enabled`);
  ls.push(` Reference bandwidth unit is 100 mbps`);
  const ifaceCount = Object.values(state.interfaces).filter(i => {
    if (!i.ipAddresses.length) return false;
    if (o.networks.some(n => {
      // simple check
      return i.ipAddresses.some(a => a.address.startsWith(n.network.split('.').slice(0, 3).join('.')));
    })) return true;
    return false;
  }).length;
  const loopbackCount = Object.values(state.interfaces).filter(i => i.id.startsWith('Loopback') && i.ipAddresses.length > 0).length;
  ls.push(`    Area BACKBONE(0)`);
  ls.push(`        Number of interfaces in this area is ${Math.max(ifaceCount, 4)} (${loopbackCount} loopback)`);
  ls.push(`        Area has no authentication`);
  ls.push(`        SPF algorithm last executed 00:01:12.553 ago`);
  ls.push(`        SPF algorithm executed 8 times`);
  ls.push(`        Area ranges are`);
  ls.push(`        Number of LSA 5. Checksum Sum 0x02418A`);
  ls.push(`        Number of opaque link LSA 0. Checksum Sum 0x000000`);
  ls.push(`        Number of DCbitless LSA 0`);
  ls.push(`        Number of indication LSA 0`);
  ls.push(`        Number of DoNotAge LSA 0`);
  ls.push(`        Flood list length 0`);
  return ls;
}

function showEnvironment(state: DeviceState): string[] {
  return [
    `${state.hostname} SYSTEM ENVIRONMENT`,
    '',
    'FAN:',
    'Fan 1 is OK',
    'Fan 2 is OK',
    '',
    'POWER:',
    'Power supply 1 is present and operating',
    'Power supply 2 is absent',
    '',
    'TEMPERATURE:',
    'System temperature is 38 Celsius',
    'Temperature Warning threshold is 60 Celsius',
    'Temperature Critical threshold is 70 Celsius',
  ];
}

function showPrivilege(state: DeviceState): string[] {
  const level = state.mode === 'user-exec' ? 1 : 15;
  return [`Current privilege level is ${level}`];
}

function resolveInterface(partial: string, state: DeviceState): string | null {
  const lower = partial.toLowerCase().trim();
  // Try direct match first (case-insensitive)
  for (const id of Object.keys(state.interfaces)) {
    if (id.toLowerCase() === lower) return id;
  }
  // Try prefix match
  for (const id of Object.keys(state.interfaces)) {
    if (id.toLowerCase().startsWith(lower)) return id;
  }
  // Expand short names to canonical internal form (Fa0/1, Gi0/1, Vlan10, Loopback0)
  const faMatch = lower.match(/^fa(?:st(?:ethernet)?)?\s*(\d+\/\d+)$/);
  if (faMatch) {
    const key = `Fa${faMatch[1]}`;
    if (state.interfaces[key]) return key;
  }
  const giMatch = lower.match(/^gi(?:ga(?:bit(?:ethernet)?)?)?\s*(\d+\/\d+)$/);
  if (giMatch) {
    const key = `Gi${giMatch[1]}`;
    if (state.interfaces[key]) return key;
  }
  const vlanMatch = lower.match(/^vl(?:an)?\s*(\d+)$/);
  if (vlanMatch) {
    const key = `Vlan${vlanMatch[1]}`;
    if (state.interfaces[key]) return key;
  }
  const loMatch = lower.match(/^lo(?:opback)?\s*(\d*)$/);
  if (loMatch) {
    const key = `Loopback${loMatch[1] || '0'}`;
    if (state.interfaces[key]) return key;
  }
  return null;
}

export const showHandler: CommandHandler = (args, state, _raw, _negated) => {
  // Parse pipe operator: args may contain '|' as a token
  let mainArgs = args;
  let pipeArgs: string[] = [];
  const pipeIdx = args.indexOf('|');
  if (pipeIdx >= 0) {
    mainArgs = args.slice(0, pipeIdx);
    pipeArgs = args.slice(pipeIdx + 1);
  }

  const sub = (mainArgs[0] || '').toLowerCase();
  const sub2 = (mainArgs[1] || '').toLowerCase();

  const makeResult = (textLines: string[]): ReturnType<CommandHandler> => {
    const filtered = pipeArgs.length > 0 ? applyPipeFilter(textLines, pipeArgs) : textLines;
    return { output: filtered.map(t => out(t)) };
  };

  if (!sub || sub === '?') {
    return makeResult([
      'arp            Show ARP table',
      'cdp            CDP information',
      'clock          Display the system clock',
      'etherchannel   EtherChannel information',
      'file           File system information',
      'flash          Display information about flash',
      'history        Display the session command history',
      'interfaces     Interface status and configuration',
      'ip             IP information',
      'logging        Show the contents of logging buffers',
      'mac            MAC forwarding table',
      'memory         Memory statistics',
      'ntp            Network time protocol',
      'port-security  Show secure port information',
      'privilege      Show current privilege level',
      'processes      Active process statistics',
      'running-config Current operating configuration',
      'spanning-tree  Spanning tree topology',
      'startup-config Contents of startup configuration',
      'users          Display information about terminal lines',
      'version        System hardware and software status',
      'vlan           VTP VLAN status',
    ]);
  }

  if (sub.startsWith('ver')) return makeResult(showVersion(state));

  if (sub.startsWith('run') || sub === 'running-config') {
    // show running-config section <keyword> OR show running-config interface <id>
    if (sub2 === 'section' && mainArgs[2]) {
      const keyword = mainArgs[2];
      const configLines = showRunningConfig(state);
      return makeResult(applyRunningConfigSection(configLines, keyword));
    }
    if (sub2.startsWith('int') && mainArgs[2]) {
      const rest = mainArgs.slice(2).join('');
      const ifId = resolveInterface(rest, state);
      if (!ifId) return { output: [out(`% Invalid interface specified`, 'error')] };
      return makeResult(showRunInterface(state, ifId));
    }
    return makeResult(showRunningConfig(state));
  }

  if (sub.startsWith('start') || sub === 'startup-config') {
    if (!state.startupConfig) return { output: [out('startup-config is not present', 'error')] };
    return makeResult(showRunningConfig(state.startupConfig as DeviceState));
  }

  if (sub.startsWith('int') || sub === 'int') {
    const sub2lower = sub2.toLowerCase();
    // show interfaces status
    if (sub2lower === 'status') {
      return makeResult(showInterfacesStatus(state));
    }
    // show interfaces trunk
    if (sub2lower === 'trunk') {
      return makeResult(showInterfacesTrunk(state));
    }
    const rest = mainArgs.slice(1).join('');
    if (!rest) return makeResult(showInterfaces(state));
    const ifId = resolveInterface(rest, state);
    if (!ifId) return { output: [out(`% Invalid interface specified`, 'error')] };
    return makeResult(showInterfaces(state, ifId));
  }

  if (sub === 'ip') {
    if (sub2.startsWith('int') || sub2 === 'interface') {
      const sub3 = (mainArgs[2] || '').toLowerCase();
      if (sub3.startsWith('bri') || sub3 === 'brief') return makeResult(showIpInterfaceBrief(state));
      const rest = mainArgs.slice(2).join('');
      if (!rest) return makeResult(showIpInterfaceBrief(state));
      const ifId = resolveInterface(rest, state);
      if (!ifId) return { output: [out(`% Invalid interface`, 'error')] };
      return makeResult(showIpInterface(state, ifId));
    }
    if (sub2.startsWith('ro') || sub2 === 'route') return makeResult(showIpRoute(state));
    if (sub2.startsWith('pr') || sub2 === 'protocols') return makeResult(showIpProtocols(state));
    if (sub2.startsWith('os') || sub2 === 'ospf') {
      const sub3 = (mainArgs[2] || '').toLowerCase();
      if (sub3.startsWith('nei') || sub3 === 'neighbor') return makeResult(showIpOspfNeighbor(state));
      if (sub3.startsWith('dat') || sub3 === 'database') return makeResult(showIpOspfNeighbor(state));
      if (sub3.startsWith('int') || sub3 === 'interface') return makeResult(showIpOspfNeighbor(state));
      // no sub3 = show ip ospf (full detail)
      if (!sub3) return makeResult(showIpOspfDetail(state));
      return makeResult(showIpOspfDetail(state));
    }
    if (sub2.startsWith('ei') || sub2 === 'eigrp') return makeResult(showIpEigrpNeighbors(state));
    if (sub2.startsWith('bg') || sub2 === 'bgp') {
      const sub3 = (mainArgs[2] || '').toLowerCase();
      if (sub3.startsWith('sum') || sub3 === 'summary') return makeResult(showIpBgpSummary(state));
      return makeResult(showIpBgpSummary(state));
    }
    if (sub2.startsWith('acc') || sub2 === 'access-lists') return makeResult(showIpAccessLists(state));
    if (sub2 === 'dhcp') {
      const sub3 = (mainArgs[2] || '').toLowerCase();
      if (sub3.startsWith('bin') || sub3 === 'binding') return makeResult(showIpDhcpBinding(state));
      if (sub3.startsWith('pool') || sub3 === 'pool') return makeResult(showIpDhcpPool(state));
      if (sub3.startsWith('con') || sub3 === 'conflict') return makeResult(showIpDhcpConflict(state));
      return makeResult(showIpDhcpBinding(state));
    }
    if (sub2 === 'ssh') return makeResult(showIpSsh(state));
    return { output: [out(`% Unrecognized show ip subcommand: ${sub2}`, 'error')] };
  }

  if (sub.startsWith('vlan')) {
    const brief = sub2.startsWith('bri');
    return makeResult(showVlan(state, brief));
  }

  if (sub === 'mac' || sub.startsWith('mac')) {
    const dynamic = mainArgs.some(a => a.toLowerCase().startsWith('dyn'));
    return makeResult(showMacTable(state, dynamic));
  }

  if (sub === 'arp') return makeResult(showArp(state));

  if (sub.startsWith('span') || sub === 'spanning-tree') {
    if (sub2 === 'vlan') {
      const vid = parseInt(mainArgs[2] || '');
      return makeResult(showSpanningTree(state, isNaN(vid) ? undefined : vid));
    }
    if (sub2 === '') return makeResult(showSpanningTree(state));
    return makeResult(showSpanningTree(state));
  }

  if (sub === 'cdp') {
    const sub3 = (mainArgs[2] || '').toLowerCase();
    const detail = sub3.startsWith('det') || sub2.startsWith('det');
    if (sub2.startsWith('nei') || sub2 === 'neighbors') {
      return makeResult(showCdpNeighbors(state, detail));
    }
    return makeResult(showCdpNeighbors(state, false));
  }

  if (sub.startsWith('proc') || sub === 'processes') return makeResult(showProcessesCpu(state));
  if (sub.startsWith('mem') || sub === 'memory') return makeResult(showMemory(state));
  if (sub.startsWith('fla') || sub === 'flash') return makeResult(showFlash(state));
  if (sub.startsWith('clo') || sub === 'clock') return makeResult(showClock(state));

  if (sub.startsWith('log') || sub === 'logging') return makeResult(showLogging(state));

  if (sub === 'ntp') {
    const sub3 = (mainArgs[1] || '').toLowerCase();
    if (sub3.startsWith('sta') || sub3 === 'status') return makeResult(showNtpStatus(state));
    return makeResult(showNtpStatus(state));
  }

  if (sub.startsWith('ether') || sub === 'etherchannel') return makeResult(showEtherchannelSummary(state));

  if (sub.startsWith('port') || sub === 'port-security') return makeResult(showPortSecurity(state));

  if (sub.startsWith('priv') || sub === 'privilege') return makeResult(showPrivilege(state));

  if (sub === 'history') {
    return { output: [out('(Command history is shown in terminal)', 'system')] };
  }

  if (sub === 'users') {
    return makeResult([
      '    Line       User       Host(s)              Idle       Location',
      '*  0 con 0     admin      idle                 00:00:00',
      '   1 vty 0                idle                 00:00:05',
    ]);
  }

  if (sub.startsWith('env') || sub === 'environment') return makeResult(showEnvironment(state));

  if (sub === 'sessions') return makeResult(showSessions(state));

  if (sub.startsWith('term') || sub === 'terminal') return makeResult(showTerminal(state));

  if (sub === 'file' && sub2 === 'systems') {
    return makeResult([
      'File Systems:',
      '',
      '     Size(b)     Free(b)      Type  Flags  Prefixes',
      '*  64016384    28439552      flash     rw  flash: flash0:',
      '     262144      231934       nvram     rw  nvram:',
      '                            opaque     rw  null:',
      '                            opaque     ro  system:',
      '                            network     rw  tftp:',
      '                            network     rw  ftp:',
      '                            network     rw  rcp:',
    ]);
  }

  return {
    output: [out(`% Unknown 'show ${args.join(' ')}' command`, 'error')]
  };
};

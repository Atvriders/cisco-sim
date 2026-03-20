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

function vlansToString(vlans: number[]): string {
  if (vlans.length === 0) return '';
  const sorted = [...vlans].sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === prev + 1) { prev = sorted[i]; }
    else {
      ranges.push(start === prev ? String(start) : `${start}-${prev}`);
      start = sorted[i]; prev = sorted[i];
    }
  }
  ranges.push(start === prev ? String(start) : `${start}-${prev}`);
  return ranges.join(',');
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
    // IPv6 config
    for (const a of (iface.ipv6Addresses || [])) {
      if (a.type === 'eui-64') {
        ls.push(` ipv6 address ${a.address}/${a.prefixLength} eui-64`);
      } else if (a.type !== 'link-local') {
        ls.push(` ipv6 address ${a.address}/${a.prefixLength}`);
      }
    }
    if (iface.ipv6Enabled && (iface.ipv6Addresses || []).length === 0) {
      ls.push(' ipv6 enable');
    }
    if (iface.lldpTransmit === false) ls.push(' no lldp transmit');
    if (iface.lldpReceive === false) ls.push(' no lldp receive');
    // NAT inside/outside
    if (state.natConfig.insideInterfaces.includes(id)) ls.push(' ip nat inside');
    if (state.natConfig.outsideInterfaces.includes(id)) ls.push(' ip nat outside');
    // HSRP standby config
    for (const hsrp of state.hsrpGroups.filter(g => g.interfaceId === id)) {
      ls.push(` standby ${hsrp.groupNumber} ip ${hsrp.virtualIp}`);
      if (hsrp.priority !== 100) ls.push(` standby ${hsrp.groupNumber} priority ${hsrp.priority}`);
      if (hsrp.preempt) ls.push(` standby ${hsrp.groupNumber} preempt`);
      if (hsrp.helloTime !== 3 || hsrp.holdTime !== 10) {
        ls.push(` standby ${hsrp.groupNumber} timers ${hsrp.helloTime} ${hsrp.holdTime}`);
      }
      if (hsrp.authentication) ls.push(` standby ${hsrp.groupNumber} authentication ${hsrp.authentication}`);
    }
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

  // IPv6 global config
  if (state.ipv6RoutingEnabled) ls.push('ipv6 unicast-routing');
  for (const r of (state.ipv6Routes || [])) {
    ls.push(`ipv6 route ${r.network}/${r.prefixLength} ${r.nextHop || r.interface || ''}`);
  }

  // LLDP global config
  if (state.lldpEnabled) ls.push('lldp run');

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

  // DHCP Snooping
  if (state.dhcpSnooping.enabled || state.dhcpSnooping.vlans.length > 0) {
    ls.push('!');
    if (state.dhcpSnooping.vlans.length > 0) {
      ls.push(`ip dhcp snooping vlan ${vlansToString(state.dhcpSnooping.vlans)}`);
    }
    if (state.dhcpSnooping.enabled) ls.push('ip dhcp snooping');
    if (!state.dhcpSnooping.option82) ls.push('no ip dhcp snooping information option');
  }

  // DAI
  if (state.dai.vlans.length > 0) {
    ls.push('!');
    ls.push(`ip arp inspection vlan ${vlansToString(state.dai.vlans)}`);
  }

  // DHCP Server config
  if (state.dhcpEnabled && (state.dhcpPools.length > 0 || state.dhcpExcludedAddresses.length > 0)) {
    ls.push('!');
    if (!state.dhcpEnabled) ls.push('no service dhcp');
    for (const ex of state.dhcpExcludedAddresses) {
      if (ex.end) {
        ls.push(`ip dhcp excluded-address ${ex.start} ${ex.end}`);
      } else {
        ls.push(`ip dhcp excluded-address ${ex.start}`);
      }
    }
    for (const pool of state.dhcpPools) {
      ls.push('!');
      ls.push(`ip dhcp pool ${pool.name}`);
      ls.push(` network ${pool.network} ${pool.mask}`);
      if (pool.defaultRouter) ls.push(` default-router ${pool.defaultRouter}`);
      if (pool.dnsServer) ls.push(` dns-server ${pool.dnsServer}`);
      if (pool.domainName) ls.push(` domain-name ${pool.domainName}`);
      const leaseHours = pool.leaseTime;
      const leaseDays = Math.floor(leaseHours / 24);
      const leaseRem = leaseHours % 24;
      if (leaseDays > 0) {
        ls.push(` lease ${leaseDays}${leaseRem > 0 ? ' ' + leaseRem : ''}`);
      } else {
        ls.push(` lease 0 ${leaseHours}`);
      }
    }
  }

  // NAT config
  if (state.natConfig.pools.length > 0 || state.natConfig.staticMappings.length > 0) {
    ls.push('!');
    for (const pool of state.natConfig.pools) {
      ls.push(`ip nat pool ${pool.name} ${pool.startIp} ${pool.endIp} prefix-length ${pool.prefix}`);
    }
    for (const sm of state.natConfig.staticMappings) {
      if (sm.protocol && sm.localPort && sm.globalPort) {
        ls.push(`ip nat inside source static ${sm.protocol} ${sm.localIp} ${sm.localPort} ${sm.globalIp} ${sm.globalPort}`);
      } else {
        ls.push(`ip nat inside source static ${sm.localIp} ${sm.globalIp}`);
      }
    }
    if (state.natConfig.accessList) {
      const poolName = state.natConfig.pools[0]?.name || '';
      const overload = state.natConfig.overload ? ' overload' : '';
      ls.push(`ip nat inside source list ${state.natConfig.accessList} pool ${poolName}${overload}`);
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
  const displayId = expandIfNameFull(iface.id);
  ls.push(`${displayId} is ${adminStr}, line protocol is ${proto}`);
  if (iface.ipAddresses.length > 0) {
    const ip = iface.ipAddresses[0];
    ls.push(`  Internet address is ${ip.address}/${maskToCidr(ip.mask)}`);
  } else {
    ls.push(`  Internet address is unassigned`);
  }
  ls.push(`  Broadcast address is 255.255.255.255`);
  ls.push(`  Address determined by non-volatile memory`);
  ls.push(`  MTU is ${iface.mtu} bytes`);
  ls.push(`  Helper address is ${iface.ipHelperAddresses.length > 0 ? iface.ipHelperAddresses.join(', ') : 'not set'}`);
  ls.push(`  Directed broadcast forwarding is disabled`);
  ls.push(`  Outgoing Common access list is not set`);
  ls.push(`  Outgoing access list is not set`);
  ls.push(`  Inbound Common access list is not set`);
  ls.push(`  Inbound  access list is not set`);
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
  ls.push(`  IP fast switching is disabled`);
  ls.push(`  IP Flow switching is disabled`);
  ls.push(`  IP CEF switching is enabled`);
  ls.push(`  IP CEF switching turbo vector`);
  ls.push(`  IP Null turbo vector`);
  ls.push(`  VPN Routing/Forwarding "default"`);
  ls.push(`  IP multicast fast switching is disabled`);
  ls.push(`  IP multicast distributed fast switching is disabled`);
  ls.push(`  IP route-cache flags are Fast, CEF`);
  ls.push(`  Router Discovery is disabled`);
  ls.push(`  IP output packet accounting is disabled`);
  ls.push(`  IP access violation accounting is disabled`);
  ls.push(`  TCP/IP header compression is disabled`);
  ls.push(`  RTP/IP header compression is disabled`);
  ls.push(`  Probe proxy name replies are disabled`);
  ls.push(`  Policy routing is disabled`);
  ls.push(`  Network address translation is disabled`);
  ls.push(`  BGP Policy Mapping is disabled`);
  ls.push(`  Input features: MCI Check`);
  ls.push(`  IPv4 WCCP Redirect outbound is disabled`);
  ls.push(`  IPv4 WCCP Redirect inbound is disabled`);
  ls.push(`  IPv4 WCCP Redirect exclude is disabled`);
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

function showSpanningTreeSummary(state: DeviceState): string[] {
  const ls: string[] = [];
  const mode = (state as any).stpMode || 'rapid-pvst';
  ls.push(`Switch is in ${mode} mode`);

  // Determine which VLANs we are root for
  const rootVlans = Object.values(state.spanningTree)
    .filter(s => s.rootBridgeIsLocal)
    .map(s => `VLAN${String(s.vlanId).padStart(4, '0')}`)
    .join(', ');
  if (rootVlans) ls.push(`Root bridge for: ${rootVlans}`);

  ls.push('EtherChannel misconfig guard           is enabled');
  ls.push('Extended system ID                     is enabled');
  const portfastDefault = (state as any).stpPortfastDefault || false;
  const bpduguardDefault = (state as any).stpBpduguardDefault || false;
  const loopguardDefault = (state as any).stpLoopguardDefault || false;
  const backbonefast = (state as any).stpBackbonefast || false;
  ls.push(`Portfast Default                       is ${portfastDefault ? 'enabled' : 'disabled'}`);
  ls.push(`PortFast BPDU Guard Default            is ${bpduguardDefault ? 'enabled' : 'disabled'}`);
  ls.push('Portfast BPDU Filter Default           is disabled');
  ls.push(`Loopguard Default                      is ${loopguardDefault ? 'enabled' : 'disabled'}`);
  ls.push('UplinkFast                             is disabled');
  ls.push(`BackboneFast                           is ${backbonefast ? 'enabled' : 'disabled'}`);
  ls.push('Configured Pathcost method used is short');
  ls.push('');

  const header = `${padRight('Name', 23)}${padLeft('Blocking', 8)} ${padLeft('Listening', 9)} ${padLeft('Learning', 8)} ${padLeft('Forwarding', 10)} ${padLeft('STP Active', 10)}`;
  const divider = `${'-'.repeat(22)} ${'-'.repeat(8)} ${'-'.repeat(9)} ${'-'.repeat(8)} ${'-'.repeat(10)} ${'-'.repeat(10)}`;
  ls.push(header);
  ls.push(divider);

  const vids = Object.keys(state.spanningTree).map(Number).sort((a, b) => a - b);
  let totBlocking = 0, totListening = 0, totLearning = 0, totForwarding = 0;

  for (const vid of vids) {
    const vlanIfaces = Object.values(state.interfaces).filter(i => {
      if (i.id.startsWith('Vlan') || i.id.startsWith('Loopback')) return false;
      if (i.switchportMode === 'trunk') return true;
      return i.accessVlan === vid;
    });
    let blocking = 0, listening = 0, learning = 0, forwarding = 0;
    for (const iface of vlanIfaces) {
      const st = iface.spanningTree.state;
      if (st === 'blocking') blocking++;
      else if (st === 'listening') listening++;
      else if (st === 'learning') learning++;
      else if (st === 'forwarding') forwarding++;
    }
    const active = blocking + listening + learning + forwarding;
    totBlocking += blocking; totListening += listening; totLearning += learning; totForwarding += forwarding;
    const name = `VLAN${String(vid).padStart(4, '0')}`;
    ls.push(`${padRight(name, 23)}${padLeft(String(blocking), 8)} ${padLeft(String(listening), 9)} ${padLeft(String(learning), 8)} ${padLeft(String(forwarding), 10)} ${padLeft(String(active), 10)}`);
  }

  ls.push(divider);
  const totActive = totBlocking + totListening + totLearning + totForwarding;
  ls.push(`${padRight(`${vids.length} vlans`, 23)}${padLeft(String(totBlocking), 8)} ${padLeft(String(totListening), 9)} ${padLeft(String(totLearning), 8)} ${padLeft(String(totForwarding), 10)} ${padLeft(String(totActive), 10)}`);
  return ls;
}

function showSpanningTreeDetail(state: DeviceState): string[] {
  const ls: string[] = [];
  const mode = (state as any).stpMode || 'rapid-pvst';
  const protocol = mode === 'pvst' ? 'ieee' : 'rstp compatible';
  const vids = Object.keys(state.spanningTree).map(Number).sort((a, b) => a - b);

  for (const vid of vids) {
    const stp = state.spanningTree[vid];
    if (!stp) continue;
    const vlanName = `VLAN${String(vid).padStart(4, '0')}`;
    ls.push(` ${vlanName} is executing the ${protocol} Spanning Tree protocol`);
    ls.push(`  Bridge Identifier has priority ${stp.localBridgePriority - vid}, sysid ${vid}, address ${stp.localBridgeMac}`);
    ls.push(`  Configured hello time ${stp.helloTime}, max age ${stp.maxAge}, forward delay ${stp.forwardDelay}, transmit hold-count 6`);
    if (stp.rootBridgeIsLocal) {
      ls.push(`  We are the root of the spanning tree`);
    } else {
      ls.push(`  Current root has priority ${stp.rootBridgePriority}, address ${stp.rootBridgeMac}`);
      if (stp.rootPort) ls.push(`  Root port is ${shortIfName(stp.rootPort)}, cost of root path is ${stp.rootCost}`);
    }
    ls.push(`  Topology change flag not set, detected flag not set`);
    ls.push(`  Number of topology changes 2 last change occurred 00:45:12 ago`);
    ls.push(`          from GigabitEthernet0/1`);
    ls.push(`  Times:  hold 1, topology change 35, notification 2`);
    ls.push(`          hello ${stp.helloTime}, max age ${stp.maxAge}, forward delay ${stp.forwardDelay}`);
    ls.push(`  Timers: hello 0, topology change 0, notification 0, aging 300`);
    ls.push('');

    const vlanIfaces = Object.values(state.interfaces).filter(i => {
      if (i.id.startsWith('Vlan') || i.id.startsWith('Loopback')) return false;
      if (i.switchportMode === 'trunk') return true;
      return i.accessVlan === vid;
    });
    for (const iface of vlanIfaces) {
      const stp_if = iface.spanningTree;
      const role = stp_if.role === 'designated' ? 'designated' : stp_if.role === 'root' ? 'root' : stp_if.role === 'alternate' ? 'alternate' : 'disabled';
      const sts = stp_if.state === 'forwarding' ? 'forwarding' : stp_if.state === 'blocking' ? 'blocking' : stp_if.state === 'learning' ? 'learning' : stp_if.state === 'listening' ? 'listening' : 'disabled';
      const cost = stp_if.cost || (iface.id.startsWith('Gi') ? 4 : 19);
      const prio = stp_if.priority || 128;
      const portNum = iface.port;
      const ifFullName = iface.id.replace(/^Fa(\d)/, 'FastEthernet$1').replace(/^Gi(\d)/, 'GigabitEthernet$1');
      ls.push(` Port ${portNum} (${ifFullName}) of ${vlanName} is ${role} ${sts}`);
      ls.push(`   Port path cost ${cost}, Port priority ${prio}, Port Identifier ${prio}.${portNum}.`);
      ls.push(`   Designated root has priority ${stp.rootBridgePriority}, address ${stp.rootBridgeMac}`);
      ls.push(`   Designated bridge has priority ${stp.rootBridgePriority}, address ${stp.rootBridgeMac}`);
      ls.push(`   Designated port id is ${prio}.${portNum}, designated path cost 0`);
      ls.push(`   Timers: message age 0, forward delay 0, hold 0`);
      ls.push(`   Number of transitions to forwarding state: 1`);
      ls.push(`   Link type is point-to-point by default`);
      ls.push(`   RSTP role is ${role.charAt(0).toUpperCase() + role.slice(1)}`);
      ls.push(`   BPDU: sent 1356, received 0`);
      ls.push('');
    }
  }
  return ls;
}

function showSpanningTreeMst(state: DeviceState): string[] {
  const ls: string[] = [];
  const mst = (state as any).mstConfig as { name: string; revision: number; instances: { id: number; vlans: number[]; rootBridgeMac: string; rootBridgePriority: number; localBridgePriority: number; rootPort?: string; rootCost: number }[] };
  if (!mst || !mst.instances) {
    ls.push('% No MST configuration found');
    return ls;
  }

  const physicalIfaces = Object.values(state.interfaces).filter(i =>
    !i.id.startsWith('Vlan') && !i.id.startsWith('Loopback') && i.switchportMode === 'trunk'
  );

  for (const inst of mst.instances) {
    const vlanStr = inst.vlans.sort((a: number, b: number) => a - b).join(',');
    const instLabel = `MST${inst.id}`;
    ls.push(`##### ${padRight(instLabel, 9)}   vlans mapped:   ${vlanStr}`);
    const sysId = inst.id;
    ls.push(`Bridge         address ${inst.rootBridgeMac}  priority      ${inst.localBridgePriority} (${inst.localBridgePriority} sysid ${sysId})`);
    ls.push(`Root           this switch for the ${inst.id === 0 ? 'CIST' : instLabel}`);
    ls.push(`Operational    hello time 2 , forward delay 15, max age 20, txholdcount 6`);
    ls.push(`Configured     hello time 2 , forward delay 15, max age 20, max hops    20`);
    ls.push('');
    ls.push(`${padRight('Interface', 17)}${padRight('Role', 5)}${padRight('Sts', 4)}${padRight('Cost', 10)}${padRight('Prio.Nbr', 9)}Type`);
    ls.push(`${'-'.repeat(16)} ${'-'.repeat(4)} ${'-'.repeat(3)} ${'-'.repeat(9)} ${'-'.repeat(8)} ${'-'.repeat(32)}`);

    for (const iface of physicalIfaces) {
      const stp_if = iface.spanningTree;
      const role = stp_if.role === 'designated' ? 'Desg' : stp_if.role === 'root' ? 'Root' : stp_if.role === 'alternate' ? 'Altn' : 'Dsbl';
      const sts = stp_if.state === 'forwarding' ? 'FWD' : stp_if.state === 'blocking' ? 'BLK' : 'DSB';
      const cost = iface.id.startsWith('Gi') ? 20000 : 200000;
      const prio = stp_if.priority || 128;
      const portNum = iface.port + (iface.id.startsWith('Gi') ? 24 : 0);
      ls.push(`${padRight(shortIfName(iface.id), 17)}${padRight(role, 5)}${padRight(sts, 4)}${padRight(String(cost), 10)}${padRight(`${prio}.${portNum}`, 9)}P2p`);
    }
    ls.push('');
  }
  return ls;
}

function showSpanningTreeMstConfig(state: DeviceState): string[] {
  const ls: string[] = [];
  const mst = (state as any).mstConfig as { name: string; revision: number; instances: { id: number; vlans: number[] }[] };
  if (!mst) {
    ls.push('% No MST configuration found');
    return ls;
  }
  ls.push(`Name      [${mst.name}]`);
  ls.push(`Revision  ${mst.revision}     Instances configured ${mst.instances.length}`);
  ls.push('');
  ls.push('Instance  Vlans mapped');
  ls.push(`${'--------'}  ${'---------------------------------------------------------------------'}`);
  for (const inst of mst.instances) {
    const vlanStr = inst.vlans.sort((a: number, b: number) => a - b).join(',');
    ls.push(`${padLeft(String(inst.id), 8)}  ${vlanStr}`);
  }
  ls.push('-------------------------------------------------------------------------------');
  return ls;
}

function showSpanningTreeInconsistentPorts(_state: DeviceState): string[] {
  return [
    'Name                 Interface                Inconsistency',
    '-------------------- ------------------------ ------------------',
    'Number of inconsistent ports (segments) in the system : 0',
  ];
}

function showSpanningTreeBlockedPorts(_state: DeviceState): string[] {
  return [
    'Name                 Blocked Interfaces List',
    '-------------------- ------------------------------------',
    'Number of blocked ports (segments) in the system : 0',
  ];
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

function showNtpAssociations(_state: DeviceState): string[] {
  return [
    '  address         ref clock       st   when   poll reach  delay  offset   disp',
    '*~192.168.1.254   .GPS.            2     45     64   377   1.062   2.548   0.372',
    ' * sys.peer, # selected, + candidate, - outlyer, x falseticker, ~ configured',
  ];
}

function showNtpAssociationsDetail(_state: DeviceState): string[] {
  return [
    '192.168.1.254 configured, our_master, sane, valid, stratum 2',
    'ref ID .GPS., time E48A3F29.8A3D70A3 (15:30:01.540 UTC Fri Mar 20 2026)',
    'our mode client, peer mode server, our poll intvl 64, peer poll intvl 64',
    'root delay 1.0619 msec, root disp 5.3721, reach 377, sync dist 5.831',
    'delay 1.0620 msec, offset 2.5481 msec, dispersion 0.3721',
    'precision 2**18, version 4',
    'assoc ID 1, assoc name 192.168.1.254',
    'assoc in packets 348, assoc out packets 348, assoc error packets 0',
    'org time E48A3F29.8A3D70A3 (15:30:01.540 UTC Fri Mar 20 2026)',
    'rcv time E48A3F29.8A3D70A3 (15:30:01.540 UTC Fri Mar 20 2026)',
    'xmt time E48A3F29.8A3D70A3 (15:30:01.540 UTC Fri Mar 20 2026)',
    'filtdelay =   1.06   1.07   1.05   1.08   1.06   1.07   1.06   1.07',
    'filtoffset=   2.55   2.54   2.55   2.54   2.55   2.54   2.55   2.54',
    'filterror =   0.37   0.62   0.87   1.12   1.37   1.62   1.87   2.12',
  ];
}

function showVtpStatus(state: DeviceState): string[] {
  const vtp = state.vtp;
  const modeStr = vtp.mode.charAt(0).toUpperCase() + vtp.mode.slice(1);
  const vlanCount = Object.keys(state.vlans).length;
  const updaterIp = vtp.updatedBy.includes('@') ? vtp.updatedBy.split('@')[1] : vtp.updatedBy;
  return [
    `VTP Version capable             : 1 to 3`,
    `VTP version running             : ${vtp.version}`,
    `VTP Domain Name                 : ${vtp.domain}`,
    `VTP Pruning Mode                : ${vtp.pruningEnabled ? 'Enabled' : 'Disabled'}`,
    `VTP Traps Generation            : Disabled`,
    `Device ID                       : 0019.e8a2.3c00`,
    `Configuration last modified by ${updaterIp} at ${vtp.updatedAt}`,
    `Local updater ID is ${updaterIp} on interface Vl1 (first interface found)`,
    ``,
    `Feature VLAN:`,
    `--------------`,
    `VTP Operating Mode                : ${modeStr}`,
    `Maximum VLANs supported locally   : 1005`,
    `Number of existing VLANs          : ${vlanCount}`,
    `Configuration Revision            : ${vtp.configRevision}`,
    `MD5 digest                        : 0x3A 0x1B 0x2C 0x4D 0x5E 0x6F 0x7A 0x8B`,
    `                                    0x9C 0xAD 0xBE 0xCF 0xD0 0xE1 0xF2 0x03`,
  ];
}

function showVtpCounters(_state: DeviceState): string[] {
  return [
    'VTP statistics:',
    'Summary advertisements received    : 142',
    'Subset advertisements received     : 8',
    'Request advertisements received    : 0',
    'Summary advertisements transmitted : 348',
    'Subset advertisements transmitted  : 12',
    'Request advertisements transmitted : 0',
    'Number of config revision errors    : 0',
    'Number of config digest errors      : 0',
    'Number of V1 summary errors         : 0',
  ];
}

function showVtpPassword(state: DeviceState): string[] {
  const pwd = state.vtp.password;
  return [`VTP Password: ${pwd ? pwd : '(not configured)'}`];
}

function showSnmp(state: DeviceState): string[] {
  const snmp = state.snmp;
  const ls: string[] = [];
  ls.push('Chassis: FOC2048Z0TN');
  if (snmp.contact) ls.push(`Contact: ${snmp.contact}`);
  if (snmp.location) ls.push(`Location: ${snmp.location}`);
  ls.push('0 SNMP packets input');
  ls.push('    0 Bad SNMP version errors');
  ls.push('    0 Unknown community name');
  ls.push('    0 Illegal operation for community name supplied');
  ls.push('    0 Encoding errors');
  ls.push('    0 Number of requested variables');
  ls.push('    0 Number of altered variables');
  ls.push('    0 Get-request PDUs');
  ls.push('    0 Get-next PDUs');
  ls.push('    0 Set-request PDUs');
  ls.push('    0 Input queue packet drops (Maximum queue size 1000)');
  ls.push('0 SNMP packets output');
  ls.push('    0 Too big errors (Maximum packet size 1500)');
  ls.push('    0 No such name errors');
  ls.push('    0 Bad values errors');
  ls.push('    0 General errors');
  ls.push('    0 Get-response PDUs');
  ls.push('    0 SNMP trap PDUs');
  ls.push(`SNMP global trap: ${snmp.enabled ? 'enabled' : 'disabled'}`);
  ls.push('SNMP logging: disabled');
  for (const host of snmp.trapHosts) {
    ls.push(`    Logging to ${host.ip}.162, 0/10, 0 sent, 0 dropped.`);
  }
  return ls;
}

function showSnmpCommunity(state: DeviceState): string[] {
  const ls: string[] = [];
  state.snmp.communities.forEach((c, i) => {
    ls.push(`Community name: ${c.name}`);
    ls.push(`Community Index: cisco${i}`);
    ls.push(`Community SecurityName: ${c.name}`);
    ls.push(`storage-type: nonvolatile        active`);
    ls.push('');
  });
  return ls;
}

function showCdpGlobal(state: DeviceState): string[] {
  return [
    'Global CDP information:',
    `        Sending CDP packets every ${state.cdpTimer} seconds`,
    `        Sending a holdtime value of ${state.cdpHoldtime} seconds`,
    `        Sending CDPv2 advertisements is enabled`,
  ];
}

function showCdpInterface(state: DeviceState, ifFilter?: string): string[] {
  const ls: string[] = [];
  const physIfaces = Object.values(state.interfaces).filter(i => {
    if (!i.cdpEnabled) return false;
    if (ifFilter) {
      const norm = ifFilter.toLowerCase();
      return i.id.toLowerCase() === norm || i.id.toLowerCase().startsWith(norm);
    }
    return i.id.startsWith('Fa') || i.id.startsWith('Gi');
  });
  for (const iface of physIfaces) {
    const adminStr = iface.adminState === 'down' ? 'administratively down' : iface.lineState === 'up' ? 'up' : 'down';
    const proto = iface.lineState === 'up' ? 'up' : 'down';
    const fullName = expandIfNameFull(iface.id);
    ls.push(`${fullName} is ${adminStr}, line protocol is ${proto}`);
    ls.push(`  Encapsulation ARPA`);
    ls.push(`  Sending CDP packets every ${state.cdpTimer} seconds`);
    ls.push(`  Holdtime is ${state.cdpHoldtime} seconds`);
  }
  return ls;
}

function showCdpTraffic(_state: DeviceState): string[] {
  return [
    'CDP counters :',
    '        Total packets output: 347, Input: 289',
    '        Hdr syntax: 0, Chksum error: 0, Encaps failed: 0',
    '        No memory: 0, Invalid packet: 0, ',
    '        CDP version 1 advertisements output: 0, Input: 0',
    '        CDP version 2 advertisements output: 347, Input: 289',
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

function showMlsQos(state: DeviceState): string[] {
  const ls: string[] = [];
  if (state.qosEnabled) {
    ls.push('QoS is enabled');
  } else {
    ls.push('QoS is disabled');
  }
  ls.push('QoS ip packet dscp rewrite is disabled');
  return ls;
}

function showMlsQosInterface(state: DeviceState, ifId?: string): string[] {
  const ls: string[] = [];
  const ifaces = ifId
    ? [state.interfaces[ifId]].filter(Boolean) as Interface[]
    : Object.values(state.interfaces).filter(i => i.id.startsWith('Fa') || i.id.startsWith('Gi'));
  for (const iface of ifaces) {
    const trust = iface.mlsQosTrust || 'not trusted';
    const cos = iface.mlsQosCos !== undefined ? String(iface.mlsQosCos) : '0';
    ls.push(expandIfNameFull(iface.id));
    ls.push(`  trust state: ${trust}`);
    ls.push(`  trust mode: ${trust}`);
    ls.push(`  trust enabled flag: ena`);
    ls.push(`  COS override: dis`);
    ls.push(`  default COS: ${cos}`);
    ls.push(`  DSCP Mutation Map: Default DSCP Mutation Map`);
    ls.push(`  Trust device: none`);
    ls.push(`  qos mode: port-based`);
  }
  return ls;
}

function showClassMap(state: DeviceState, name?: string): string[] {
  const ls: string[] = [];
  const maps = name ? state.classMaps.filter(c => c.name === name) : state.classMaps;
  if (maps.length === 0) {
    ls.push(name ? `% Class Map ${name} not found` : '');
    return ls;
  }
  for (let i = 0; i < maps.length; i++) {
    const cm = maps[i];
    const matchStr = cm.matchType === 'any' ? 'match-any' : 'match-all';
    ls.push(` Class Map ${matchStr} ${cm.name} (id ${i + 1})`);
    if (cm.matchType === 'any') {
      ls.push(`   Match any`);
    } else if (cm.matchType === 'cos') {
      ls.push(`   Match cos ${cm.matchValue || ''}`);
    } else if (cm.matchType === 'dscp') {
      ls.push(`   Match dscp ${cm.matchValue || ''}`);
    } else if (cm.matchType === 'access-group') {
      ls.push(`   Match access-group name ${cm.matchValue || ''}`);
    } else if (cm.matchType === 'ip-precedence') {
      ls.push(`   Match ip precedence ${cm.matchValue || ''}`);
    }
  }
  return ls;
}

function showPolicyMap(state: DeviceState, name?: string): string[] {
  const ls: string[] = [];
  const maps = name ? state.policyMaps.filter(p => p.name === name) : state.policyMaps;
  if (maps.length === 0) {
    ls.push(name ? `% Policy Map ${name} not found` : '');
    return ls;
  }
  for (const pm of maps) {
    ls.push(`  Policy Map ${pm.name}`);
    for (const cls of pm.classes) {
      ls.push(`    Class ${cls.classMapName}`);
      if (cls.priority !== undefined) ls.push(`      priority ${cls.priority} (kbps)`);
      if (cls.bandwidth !== undefined) ls.push(`      bandwidth ${cls.bandwidth} (kbps)`);
      if (cls.police) ls.push(`      police rate ${cls.police.rate} bps burst ${cls.police.burstNormal}`);
      if (cls.set) ls.push(`      set ${cls.set.field} ${cls.set.value}`);
    }
  }
  return ls;
}

function showPolicyMapInterface(state: DeviceState, ifId: string): string[] {
  const iface = state.interfaces[ifId];
  if (!iface) return [`% Interface ${ifId} not found`];
  const ls: string[] = [];
  ls.push(` ${expandIfNameFull(iface.id)}`);
  ls.push('');

  const renderPolicy = (policyName: string, dir: string) => {
    const pm = state.policyMaps.find(p => p.name === policyName);
    if (!pm) return;
    ls.push(`  Service-policy ${dir}: ${policyName}`);
    ls.push('');
    for (const cls of pm.classes) {
      const cm = state.classMaps.find(c => c.name === cls.classMapName);
      const matchType = cm ? (cm.matchType === 'any' ? 'match-any' : 'match-all') : 'match-any';
      ls.push(`    Class-map: ${cls.classMapName} (${matchType})`);
      ls.push(`      0 packets, 0 bytes`);
      ls.push(`      5 minute offered rate 0000 bps, drop rate 0000 bps`);
      if (cm) {
        if (cm.matchType === 'any') ls.push(`      Match: any`);
        else if (cm.matchType === 'cos') ls.push(`      Match: cos ${cm.matchValue || ''}`);
        else if (cm.matchType === 'dscp') ls.push(`      Match: dscp ${cm.matchValue || ''}`);
      }
      if (cls.priority !== undefined) {
        const burst = Math.floor(cls.priority * 1000 / 8 / 100);
        ls.push(`      Priority: ${cls.priority} kbps, burst bytes ${burst}, b/w exceed drops: 0`);
      }
      if (cls.bandwidth !== undefined) ls.push(`      bandwidth ${cls.bandwidth} kbps`);
      ls.push('');
    }
  };

  if (iface.servicePolicy?.in) renderPolicy(iface.servicePolicy.in, 'input');
  if (iface.servicePolicy?.out) renderPolicy(iface.servicePolicy.out, 'output');
  if (!iface.servicePolicy?.in && !iface.servicePolicy?.out) {
    ls.push('  No service-policy applied');
  }
  return ls;
}

function showMonitorSession(state: DeviceState, sessionId?: number): string[] {
  const ls: string[] = [];
  const sessions = sessionId !== undefined
    ? state.spanSessions.filter(s => s.id === sessionId)
    : state.spanSessions;
  if (sessions.length === 0) {
    ls.push('No SPAN configuration is present');
    return ls;
  }
  for (const s of sessions) {
    ls.push(`Session ${s.id}`);
    ls.push('---------');
    ls.push(`Type                   : ${s.type === 'local' ? 'Local Session' : 'RSPAN Session'}`);
    if (s.sourcePorts.length > 0) {
      ls.push('Source Ports           :');
      const rx = s.sourcePorts.filter(p => p.direction === 'rx').map(p => shortIfName(p.port));
      const tx = s.sourcePorts.filter(p => p.direction === 'tx').map(p => shortIfName(p.port));
      const both = s.sourcePorts.filter(p => p.direction === 'both').map(p => shortIfName(p.port));
      if (rx.length) ls.push(`    RX                 : ${rx.join(', ')}`);
      if (tx.length) ls.push(`    TX                 : ${tx.join(', ')}`);
      if (both.length) ls.push(`    Both               : ${both.join(', ')}`);
    }
    if (s.sourceVlans && s.sourceVlans.length > 0) {
      ls.push(`Source VLANs           :`);
      ls.push(`    Both               : ${s.sourceVlans.join(', ')}`);
    }
    if (s.destination) {
      ls.push(`Destination Ports      : ${shortIfName(s.destination)}`);
      ls.push('    Encapsulation      : Native');
      ls.push('          Ingress      : Disabled');
    }
    ls.push('');
  }
  return ls;
}

function showEtherchannelDetail(state: DeviceState, groupNum: number): string[] {
  const ls: string[] = [];
  const pc = state.portChannels.find(p => p.id === `Port-channel${groupNum}`);
  const members = Object.values(state.interfaces).filter(i => i.channelGroup?.number === groupNum);
  if (members.length === 0 && !pc) {
    ls.push(`% No such channel-group ${groupNum}`);
    return ls;
  }
  const proto = pc ? pc.protocol.toUpperCase() : (members[0]?.channelGroup?.mode === 'on' ? 'None' : 'LACP');
  ls.push(`Group state = L2`);
  ls.push(`Ports: ${members.length}   Maxports = 8`);
  ls.push(`Port-channels: 1 Max Port-channels = 1`);
  ls.push(`Protocol:   ${proto}`);
  ls.push(`Minimum Links: 0`);
  ls.push('');
  ls.push('                Ports in the group:');
  ls.push('                -------------------');
  for (const m of members) {
    ls.push(` Port: ${shortIfName(m.id)}`);
    ls.push(`------------`);
    ls.push(` GC   				Port Number = ${m.port}`);
    ls.push(` HotStandBy port = null`);
    ls.push(` Port state    = Port-channel Ag-Inuse`);
    ls.push(` Channel group = ${groupNum}  Mode = ${m.channelGroup?.mode || 'on'}    Gcchange = -`);
    ls.push(` Port-channel  = Po${groupNum}  GC = -  Pseudo port-channel = Po${groupNum}`);
    ls.push(` Port index    = 0   Load = 0x00`);
    ls.push('');
  }
  return ls;
}

function showInterfacesPortChannel(state: DeviceState, num: number): string[] {
  const pc = state.portChannels.find(p => p.id === `Port-channel${num}`);
  const members = Object.values(state.interfaces).filter(i => i.channelGroup?.number === num);
  if (!pc && members.length === 0) {
    return [`% Port-channel${num} not found`];
  }
  const ls: string[] = [];
  const lineState = pc ? pc.lineState : (members.some(m => m.lineState === 'up') ? 'up' : 'down');
  ls.push(`Port-channel${num} is up, line protocol is ${lineState}`);
  ls.push(`  Hardware is EtherChannel, address is ${members[0]?.macAddress || '0000.0000.0000'}`);
  ls.push(`  Description: Port-channel${num}`);
  ls.push(`  MTU 1500 bytes, BW 200000 Kbit/sec, DLY 10 usec,`);
  ls.push(`     reliability 255/255, txload 1/255, rxload 1/255`);
  ls.push(`  Encapsulation ARPA, loopback not set`);
  ls.push(`  Keepalive set (10 sec)`);
  ls.push(`  Full-duplex, 100Mb/s, link type is auto, media type is unknown`);
  ls.push(`  Members in this channel: ${members.map(m => shortIfName(m.id)).join(' ')}`);
  ls.push(`  Last clearing of "show interface" counters never`);
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

function showIpDhcpBinding(state: DeviceState): string[] {
  const ls: string[] = [];
  ls.push('Bindings from all pools not associated with VRF:');
  ls.push('IP address          Client-ID/              Lease expiration        Type       State      Interface');
  ls.push('                    Hardware address/');
  ls.push('                    User name');
  for (const b of state.dhcpBindings) {
    const rawMac = b.mac.replace(/\./g, '');
    const clientId = ('0100' + rawMac).slice(0, 22);
    ls.push(
      `${padRight(b.ip, 20)}${padRight(clientId, 24)}${padRight(b.leaseExpiry, 24)}${padRight(b.type, 11)}${padRight(b.state, 11)}${b.interface}`
    );
  }
  return ls;
}

function showIpDhcpPool(state: DeviceState): string[] {
  const ls: string[] = [];
  function dhcpIpToNum(ip: string): number {
    return ip.split('.').reduce((acc: number, o: string) => (acc << 8) + parseInt(o), 0) >>> 0;
  }
  function dhcpNumToIp(n: number): string {
    return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff].join('.');
  }
  for (const pool of state.dhcpPools) {
    const maskNum = dhcpIpToNum(pool.mask);
    const networkNum = dhcpIpToNum(pool.network);
    const cidr = maskToCidr(pool.mask);
    const hostBits = 32 - cidr;
    const totalAddresses = hostBits > 0 ? (1 << hostBits) - 2 : 0;
    const leasedCount = state.dhcpBindings.filter(b => {
      const bNum = dhcpIpToNum(b.ip);
      return (bNum & maskNum) >>> 0 === networkNum;
    }).length;
    const firstHost = dhcpNumToIp(networkNum + 1);
    const broadcastNum = (networkNum | (~maskNum >>> 0)) >>> 0;
    const lastHost = dhcpNumToIp(broadcastNum - 1);
    const nextIndex = leasedCount > 0 ? dhcpNumToIp(networkNum + leasedCount + 1) : firstHost;
    ls.push(`Pool ${pool.name} :`);
    ls.push(` Utilization mark (high/low)    : 100 / 0`);
    ls.push(` Subnet size (first/next)       : 0 / 0 `);
    ls.push(` Total addresses                : ${totalAddresses}`);
    ls.push(` Leased addresses               : ${leasedCount}`);
    ls.push(` Pending event                  : none`);
    ls.push(` 1 subnet is currently in the pool :`);
    ls.push(` Current index        IP address range                    Leased addresses`);
    ls.push(` ${padRight(nextIndex, 22)}${padRight(firstHost, 18)} - ${padRight(lastHost, 18)} ${leasedCount}`);
  }
  return ls;
}

function showIpDhcpConflict(_state: DeviceState): string[] {
  return [
    'There is no record for 0 conflicting address',
  ];
}

function showIpDhcpServerStatistics(state: DeviceState): string[] {
  const totalBindings = state.dhcpBindings.filter(b => b.state === 'Active').length;
  const expiredBindings = state.dhcpBindings.filter(b => b.state === 'Expired').length;
  return [
    'Memory usage         : 42310',
    `Address pools        : ${state.dhcpPools.length}`,
    `Database agents      : 0`,
    `Automatic bindings   : ${totalBindings}`,
    `Manual bindings      : 0`,
    `Expired bindings     : ${expiredBindings}`,
    `Malformed messages   : 0`,
    '',
    'Message              Received',
    'BOOTREQUEST          0',
    `DHCPDISCOVER         ${totalBindings}`,
    `DHCPREQUEST          ${totalBindings}`,
    'DHCPDECLINE          0',
    'DHCPRELEASE          0',
    'DHCPINFORM           0',
    '',
    'Message              Sent',
    'BOOTREPLY            0',
    `DHCPOFFER            ${totalBindings}`,
    `DHCPACK              ${totalBindings}`,
    'DHCPNAK              0',
  ];
}

function showIpNatTranslations(state: DeviceState): string[] {
  const ls: string[] = [];
  ls.push('Pro Inside global      Inside local       Outside local      Outside global');
  for (const t of state.natTranslations) {
    const proto = t.protocol ? t.protocol.toLowerCase() : '---';
    const ig = t.outsidePort ? `${t.insideGlobal}:${t.outsidePort}` : t.insideGlobal;
    const il = t.insidePort ? `${t.inside}:${t.insidePort}` : t.inside;
    const ol = t.outside || '---';
    const og = t.outsideGlobal || '---';
    ls.push(`${padRight(proto, 4)} ${padRight(ig, 22)} ${padRight(il, 18)} ${padRight(ol, 18)} ${og}`);
  }
  for (const sm of state.natConfig.staticMappings) {
    const already = state.natTranslations.some(t => t.inside === sm.localIp);
    if (!already) {
      ls.push(`--- ${padRight(sm.globalIp, 22)} ${padRight(sm.localIp, 18)} ---                ---`);
    }
  }
  return ls;
}

function showIpNatStatistics(state: DeviceState): string[] {
  const totalActive = state.natTranslations.length + state.natConfig.staticMappings.length;
  const dynamicCount = state.natTranslations.filter(t => t.type === 'dynamic').length;
  const patCount = state.natTranslations.filter(t => t.type === 'pat').length;
  return [
    `Total active translations: ${totalActive} (${state.natConfig.staticMappings.length} static, ${dynamicCount} dynamic; ${patCount} extended)`,
    `Peak translations: ${totalActive}, occurred 00:00:00 ago`,
    `Outside interfaces:`,
    ...state.natConfig.outsideInterfaces.map(i => `  ${i}`),
    `Inside interfaces:`,
    ...state.natConfig.insideInterfaces.map(i => `  ${i}`),
    `Hits: 0  Misses: 0`,
    `CEF Translated packets: 0, CEF Punted packets: 0`,
    `Expired translations: 0`,
    `Dynamic mappings:`,
    ...(state.natConfig.accessList && state.natConfig.pools.length > 0
      ? [
          ` -- Inside Source`,
          `[Id: 1] access-list ${state.natConfig.accessList} pool ${state.natConfig.pools[0].name} refcount ${dynamicCount + patCount}`,
        ]
      : []),
    `Total doors: 0`,
    `Appl doors: 0`,
    `Normal doors: 0`,
    `Queued Packets: 0`,
  ];
}

function showStandbyDetail(state: DeviceState): string[] {
  const ls: string[] = [];
  if (state.hsrpGroups.length === 0) {
    ls.push('There are no HSRP groups configured.');
    return ls;
  }
  for (const g of state.hsrpGroups) {
    const macSuffix = g.groupNumber.toString(16).padStart(2, '0');
    ls.push(`${g.interfaceId} - Group ${g.groupNumber}`);
    ls.push(`  State is ${g.state}`);
    ls.push(`    1 state change, last state change 00:01:34`);
    ls.push(`  Virtual IP address is ${g.virtualIp}`);
    ls.push(`  Active virtual MAC address is 0000.0c07.ac${macSuffix}`);
    ls.push(`    Local virtual MAC address is 0000.0c07.ac${macSuffix} (v1 default)`);
    ls.push(`  Hello time ${g.helloTime} sec, hold time ${g.holdTime} sec`);
    ls.push(`    Next hello sent in 1.200 secs`);
    if (g.authentication) ls.push(`  Authentication text, string "${g.authentication}"`);
    ls.push(`  Preemption ${g.preempt ? 'enabled' : 'disabled'}`);
    if (g.preempt) ls.push(`    min delay 0 sec, reload delay 0 sec`);
    ls.push(`  Active router is ${g.activeRouter}, priority ${g.priority} expires in ${g.holdTime - 1}.400 sec`);
    ls.push(`  Standby router is ${g.standbyRouter}, priority ${g.priority - 10} expires in ${g.holdTime - 2}.800 sec`);
    ls.push(`  Priority ${g.priority} (configured ${g.priority})`);
    ls.push(`  Group name is "hsrp-${g.interfaceId}-${g.groupNumber}" (default)`);
  }
  return ls;
}

function showStandbyBrief(state: DeviceState): string[] {
  const ls: string[] = [];
  ls.push('                     P indicates configured to preempt.');
  ls.push('                     |');
  ls.push('Interface   Grp  Pri P State    Active          Standby         Virtual IP');
  for (const g of state.hsrpGroups) {
    const preemptFlag = g.preempt ? 'P' : ' ';
    const ifShort = g.interfaceId.replace('FastEthernet', 'Fa').replace('GigabitEthernet', 'Gi');
    ls.push(
      `${padRight(ifShort, 12)}${padRight(String(g.groupNumber), 5)}${padRight(String(g.priority), 4)}${preemptFlag} ${padRight(g.state, 9)}${padRight(g.activeRouter, 16)}${padRight(g.standbyRouter, 16)}${g.virtualIp}`
    );
  }
  return ls;
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

function showIpv6InterfaceBrief(state: DeviceState): string[] {
  const ls: string[] = [];
  ls.push('Interface                 IPv6 Address/Prefix               State   MTU');
  const sortedIfs = sortInterfaces(Object.values(state.interfaces));
  for (const iface of sortedIfs) {
    const displayId = expandIfNameFull(iface.id);
    const adminStr = iface.adminState === 'down' ? 'admin down' : iface.lineState === 'up' ? 'up/up' : 'down/down';
    const addrs = iface.ipv6Addresses || [];
    const macHex = iface.macAddress.replace(/\./g, '').toUpperCase();
    const linkLocal = `FE80::${macHex.slice(0,4)}:${macHex.slice(4,8)}:${macHex.slice(8)}/10`;
    if (addrs.length === 0) {
      ls.push(`${padRight(displayId, 26)}${padRight('unassigned', 34)}${padRight(adminStr, 8)}${iface.mtu}`);
    } else {
      const firstAddr = addrs[0];
      const addrStr = `${firstAddr.address.toUpperCase()}/${firstAddr.prefixLength} [TEN]`;
      ls.push(`${padRight(displayId, 26)}${padRight(addrStr, 34)}${padRight(adminStr, 8)}${iface.mtu}`);
      for (let i = 1; i < addrs.length; i++) {
        const a = addrs[i];
        ls.push(`${' '.repeat(26)}${a.address.toUpperCase()}/${a.prefixLength}`);
      }
      if (iface.ipv6Enabled) {
        ls.push(`${' '.repeat(26)}${linkLocal}`);
      }
    }
  }
  return ls;
}

function showIpv6Interface(state: DeviceState, ifId: string): string[] {
  const iface = state.interfaces[ifId];
  if (!iface) return [`% Interface ${ifId} not found`];
  const ls: string[] = [];
  const adminStr = iface.adminState === 'down' ? 'administratively down' : iface.lineState === 'up' ? 'up' : iface.lineState;
  const proto = iface.lineState === 'up' ? 'up' : 'down';
  ls.push(`${iface.id} is ${adminStr}, line protocol is ${proto}`);
  const addrs = iface.ipv6Addresses || [];
  if (addrs.length === 0 && !iface.ipv6Enabled) {
    ls.push('  IPv6 is disabled');
    return ls;
  }
  ls.push('  IPv6 is enabled, link-local address is FE80::219:E8FF:FEA2:3C00');
  ls.push('  No Virtual link-local address(es):');
  for (const a of addrs) {
    const typeStr = a.type === 'manual' ? '' : ` [${a.type.toUpperCase()}]`;
    ls.push(`  Global unicast address(es):`);
    ls.push(`    ${a.address}, subnet is ${a.address}/${a.prefixLength}${typeStr}`);
  }
  ls.push('  Joined group address(es):');
  ls.push('    FF02::1');
  ls.push('    FF02::2');
  ls.push('    FF02::1:FF00:1');
  ls.push(`  MTU is ${iface.mtu} bytes`);
  ls.push('  ICMP error messages limited to one every 100 milliseconds');
  ls.push('  ICMP redirects are enabled');
  ls.push('  ICMP unreachables are sent');
  ls.push('  ND DAD is enabled, number of DAD attempts: 1');
  ls.push('  ND reachable time is 30000 milliseconds (using 30000)');
  ls.push('  ND advertised reachable time is 0 (unspecified)');
  ls.push('  ND advertised retransmit interval is 0 (unspecified)');
  ls.push('  ND router advertisements are sent every 200 seconds');
  ls.push('  ND router advertisements live for 1800 seconds');
  ls.push('  ND advertised default router preference is Medium');
  ls.push('  Hosts use stateless autoconfig for addresses.');
  return ls;
}

function showIpv6Route(state: DeviceState): string[] {
  const ls: string[] = [];
  const ipv6Routes = state.ipv6Routes || [];
  ls.push(`IPv6 Routing Table - default - ${ipv6Routes.length + 2} entries`);
  ls.push('Codes: C - Connected, L - Local, S - Static, U - Per-user Static route');
  ls.push('       B - BGP, R - RIP, I1 - ISIS L1, I2 - ISIS L2, IA - ISIS interarea');
  ls.push('       IS - ISIS summary, D - EIGRP, EX - EIGRP external, ND - ND Default');
  ls.push('       NDp - ND Prefix, DCE - Destination, NDr - Redirect, RL - RPL');
  ls.push('       O - OSPF Intra, OI - OSPF Inter, OE1 - OSPF ext 1, OE2 - OSPF ext 2');
  ls.push('       ON1 - OSPF NSSA ext 1, ON2 - OSPF NSSA ext 2, la - LISP site');
  ls.push('       lA - LISP DLE prefix');
  ls.push('');
  for (const iface of Object.values(state.interfaces)) {
    for (const addr of (iface.ipv6Addresses || [])) {
      ls.push(`L   ${addr.address.toUpperCase()}/${addr.prefixLength} [0/0]`);
      ls.push(`     via ${iface.id}, receive`);
    }
  }
  for (const r of ipv6Routes) {
    ls.push(`${r.source}   ${r.network.toUpperCase()}/${r.prefixLength} [1/0]`);
    if (r.nextHop) ls.push(`     via ${r.nextHop}`);
    else if (r.interface) ls.push(`     via ${r.interface}`);
  }
  ls.push('L   FF00::/8 [0/0]');
  ls.push('     via Null0, receive');
  return ls;
}

function showIpv6Neighbors(state: DeviceState): string[] {
  const ls: string[] = [];
  ls.push('IPv6 Address                              Age Link-layer Addr State Interface');
  for (const arp of state.arpTable.slice(0, 4)) {
    const macHex = arp.mac.replace(/\./g, '').slice(0, 4).toUpperCase();
    const fakeIpv6 = `FE80::${macHex}`;
    ls.push(`${padRight(fakeIpv6, 42)}${padLeft(String(arp.age), 3)} ${arp.mac}  REACH ${shortIfName(arp.interface)}`);
  }
  return ls;
}

function showLldp(state: DeviceState): string[] {
  const ls: string[] = [];
  ls.push('Global LLDP Information:');
  ls.push(`    Status: ${state.lldpEnabled ? 'ACTIVE' : 'NOT ACTIVE'}`);
  ls.push('    LLDP advertisements are sent every 30 seconds');
  ls.push('    LLDP hold time advertised is 120 seconds');
  ls.push('    LLDP interface reinitialisation delay is 2 seconds');
  return ls;
}

function showLldpNeighbors(state: DeviceState, detail: boolean): string[] {
  const ls: string[] = [];
  if (!state.lldpEnabled) {
    ls.push('% LLDP is not enabled');
    return ls;
  }
  const neighbors = state.lldpNeighbors || [];
  if (!detail) {
    ls.push('Capability codes:');
    ls.push('    (R) Router, (B) Bridge, (T) Telephone, (C) DOCSIS Cable Device');
    ls.push('    (W) WLAN Access Point, (P) Repeater, (S) Station, (O) Other');
    ls.push('');
    ls.push('Device ID           Local Intf     Hold-time  Capability      Port ID');
    for (const nb of neighbors) {
      const localShort = shortIfName(nb.localInterface);
      ls.push(`${padRight(nb.deviceId, 20)}${padRight(localShort, 15)}${padLeft(String(nb.holdtime), 9)}  ${padRight(nb.capability, 16)}${nb.portId}`);
    }
    ls.push('');
    ls.push(`Total entries displayed: ${neighbors.length}`);
  } else {
    for (const nb of neighbors) {
      ls.push('------------------------------------------------');
      ls.push(`Local Intf: ${shortIfName(nb.localInterface)}`);
      ls.push(`Chassis id: ${nb.deviceId}`);
      ls.push(`Port id: ${nb.portId}`);
      ls.push(`Port Description: ${nb.portDescription || ''}`);
      ls.push(`System Name: ${nb.systemName}`);
      ls.push('');
      if (nb.systemDescription) ls.push(`System Description: ${nb.systemDescription}`);
      ls.push('');
      ls.push(`Time remaining: ${nb.holdtime} seconds`);
      ls.push(`System Capabilities: ${nb.capability}`);
      ls.push(`Enabled Capabilities: ${nb.capability}`);
      if (nb.managementAddress) {
        ls.push('Management Addresses:');
        ls.push(`    IP: ${nb.managementAddress}`);
      }
      ls.push('');
    }
  }
  return ls;
}

function showLldpInterface(state: DeviceState, ifId?: string): string[] {
  const ls: string[] = [];
  if (!state.lldpEnabled) {
    ls.push('% LLDP is not enabled');
    return ls;
  }
  const ifaces = ifId
    ? ([state.interfaces[ifId]].filter(Boolean) as import('../types').Interface[])
    : Object.values(state.interfaces).filter(i => i.id.startsWith('Fa') || i.id.startsWith('Gi'));

  for (const iface of ifaces) {
    if (!iface) continue;
    const txEnabled = iface.lldpTransmit !== false;
    const rxEnabled = iface.lldpReceive !== false;
    ls.push(`${expandIfNameFull(iface.id)}:`);
    ls.push(`    Tx: ${txEnabled ? 'enabled' : 'disabled'}`);
    ls.push(`    Rx: ${rxEnabled ? 'enabled' : 'disabled'}`);
    ls.push('    Tx state: IDLE');
    ls.push('    Rx state: WAIT FOR FRAME');
    ls.push('');
  }
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



function showIpDhcpSnooping(state: DeviceState): string[] {
  const s = state.dhcpSnooping;
  const ls: string[] = [];
  ls.push(`Switch DHCP snooping is ${s.enabled ? 'enabled' : 'disabled'}`);
  ls.push('Switch DHCP gleaning is disabled');
  ls.push('DHCP snooping is configured on following VLANs:');
  ls.push(s.vlans.length > 0 ? vlansToString(s.vlans) : 'none');
  ls.push('DHCP snooping is operational on following VLANs:');
  ls.push(s.enabled && s.vlans.length > 0 ? vlansToString(s.vlans) : 'none');
  ls.push('Smartlog is disabled globally');
  ls.push('Option 82 on untrusted port is not allowed');
  ls.push(` Insertion of option 82 is ${s.option82 ? 'enabled' : 'disabled'}`);
  ls.push(' circuit-id default format: vlan-mod-port');
  ls.push(' remote-id: 0019.e8a2.3c00 (MAC)');
  ls.push('Verification of hwaddr field is enabled');
  ls.push('Verification of giaddr field is enabled');
  ls.push('DHCP snooping trust/rate is configured on the following Interfaces:');
  ls.push('');
  ls.push('Interface                  Trusted    Allow untrusted reply    Rate limit (pps)');
  ls.push('-----------------------    -------    ---------------------    ----------------');
  const allTrusted = new Set(s.trustedPorts);
  const rateLimitMap = new Map(s.rateLimits.map(r => [r.port, r.pps]));
  const physIfaces = Object.values(state.interfaces)
    .filter(i => i.id.startsWith('Fa') || i.id.startsWith('Gi'))
    .filter(i => allTrusted.has(i.id) || rateLimitMap.has(i.id));
  const sortedIfaces = [...physIfaces].sort((a, b) => {
    if (a.id.startsWith('Gi') && b.id.startsWith('Fa')) return 1;
    if (a.id.startsWith('Fa') && b.id.startsWith('Gi')) return -1;
    return a.port - b.port;
  });
  for (const iface of sortedIfaces) {
    const fullName = expandIfNameFull(iface.id);
    const trusted = allTrusted.has(iface.id) ? 'yes' : 'no';
    const rateLimit = rateLimitMap.has(iface.id) ? String(rateLimitMap.get(iface.id)) : 'unlimited';
    ls.push(`${padRight(fullName, 27)}${padRight(trusted, 11)}${padRight('yes', 25)}${rateLimit}`);
  }
  return ls;
}

function showIpDhcpSnoopingStatistics(_state: DeviceState): string[] {
  return [
    ' Packets Forwarded                                     = 245',
    ' Packets Dropped                                       = 0',
    ' Packets Dropped From untrusted ports                  = 0',
  ];
}

function showIpDhcpSnoopingBinding(state: DeviceState): string[] {
  const ls: string[] = [];
  ls.push('MacAddress          IpAddress        Lease(sec)  Type           VLAN  Interface');
  ls.push('------------------  ---------------  ----------  -------------  ----  -----------------');
  for (const b of state.dhcpBindings) {
    const vlanNum = b.interface.startsWith('Vlan') ? b.interface.replace('Vlan', '') : '?';
    ls.push(`${padRight(b.mac, 20)}${padRight(b.ip, 17)}${padRight('86400', 12)}${padRight('dhcp-snooping', 15)}${padRight(vlanNum, 6)}${b.interface}`);
  }
  ls.push(`Total number of bindings: ${state.dhcpBindings.length}`);
  return ls;
}

function showIpArpInspection(state: DeviceState): string[] {
  const d = state.dai;
  const ls: string[] = [];
  ls.push(' Source Mac Validation      : Disabled');
  ls.push(' Destination Mac Validation : Disabled');
  ls.push(' IP-MAC Validation          : Disabled');
  ls.push('');
  ls.push(' Vlan     Configuration    Operation   ACL Match          Static ACL');
  ls.push(' ----     -------------    ---------   ---------          ----------');
  for (const vid of d.vlans) {
    ls.push(`   ${padLeft(String(vid), 2)}     ${padRight('Enabled', 17)}${padRight('Active', 12)}`);
  }
  if (d.vlans.length === 0) ls.push('');
  ls.push('');
  ls.push(' Vlan     Forwarded        Dropped      DHCP Drops      ACL Drops');
  ls.push(' ----     ---------        -------      ----------      ---------');
  const fwdMap: Record<number, number> = { 10: 245, 20: 123 };
  for (const vid of d.vlans) {
    const fwd = fwdMap[vid] ?? 0;
    ls.push(`   ${padLeft(String(vid), 2)}           ${padLeft(String(fwd), 3)}              0               0              0`);
  }
  return ls;
}

function showIpArpInspectionInterfaces(state: DeviceState): string[] {
  const ls: string[] = [];
  ls.push(' Interface        Trust State     Rate (pps)    Burst Interval');
  ls.push(' ---------------  -----------     ----------    --------------');
  const trustedSet = new Set(state.dai.trustedPorts);
  const physIfaces = Object.values(state.interfaces)
    .filter(i => i.id.startsWith('Fa') || i.id.startsWith('Gi'))
    .sort((a, b) => {
      if (a.id.startsWith('Gi') && b.id.startsWith('Fa')) return 1;
      if (a.id.startsWith('Fa') && b.id.startsWith('Gi')) return -1;
      return a.port - b.port;
    });
  for (const iface of physIfaces) {
    const trusted = trustedSet.has(iface.id) ? 'Trusted' : 'Untrusted';
    ls.push(` ${padRight(shortIfName(iface.id), 17)}${padRight(trusted, 16)}${padRight('None', 14)}N/A`);
  }
  return ls;
}

function showIpVerifySource(state: DeviceState): string[] {
  const ls: string[] = [];
  ls.push('Interface  Filter-type  Filter-mode  IP-address       Mac-address        Vlan');
  ls.push('---------  -----------  -----------  ---------------  -----------------  ----');
  for (const binding of state.ipSourceGuardBindings) {
    ls.push(`${padRight(shortIfName(binding.interface), 11)}${padRight('ip', 13)}${padRight('active', 13)}${padRight(binding.ip, 17)}${padRight(binding.mac, 19)}${binding.vlan}`);
  }
  for (const b of state.dhcpBindings) {
    const vlanNum = parseInt(b.interface.replace('Vlan', '') || '0');
    const portsForVlan = Object.values(state.interfaces)
      .filter(i => i.accessVlan === vlanNum && i.lineState === 'up' && (i.id.startsWith('Fa') || i.id.startsWith('Gi')));
    for (const iface of portsForVlan) {
      ls.push(`${padRight(shortIfName(iface.id), 11)}${padRight('ip', 13)}${padRight('active', 13)}${padRight(b.ip, 17)}${padRight(b.mac, 19)}${vlanNum}`);
    }
  }
  return ls;
}

function showPortSecurityInterface(state: DeviceState, ifId: string): string[] {
  const iface = state.interfaces[ifId];
  if (!iface) return [`% Interface ${ifId} not found`];
  const ps = iface.portSecurity;
  const ls: string[] = [];
  ls.push(`Port Security              : ${ps.enabled ? 'Enabled' : 'Disabled'}`);
  let portStatus = 'Secure-up';
  if (iface.lineState === 'err-disabled') portStatus = 'Secure-shutdown';
  else if (!ps.enabled) portStatus = 'Secure-down';
  ls.push(`Port Status                : ${portStatus}`);
  ls.push(`Violation Mode             : ${ps.violation.charAt(0).toUpperCase() + ps.violation.slice(1)}`);
  ls.push(`Aging Time                 : 0 mins`);
  ls.push(`Aging Type                 : Absolute`);
  ls.push(`SecureStatic Address Aging : Disabled`);
  ls.push(`Maximum MAC Addresses      : ${ps.maxMacAddresses}`);
  ls.push(`Total MAC Addresses        : ${ps.learnedAddresses.length}`);
  ls.push(`Configured MAC Addresses   : 0`);
  ls.push(`Sticky MAC Addresses       : ${ps.stickyLearning ? ps.learnedAddresses.length : 0}`);
  const lastMac = ps.learnedAddresses.length > 0 ? `${ps.learnedAddresses[ps.learnedAddresses.length - 1]}:${iface.accessVlan}` : '0000.0000.0000:0';
  ls.push(`Last Source Address:Vlan   : ${lastMac}`);
  ls.push(`Security Violation Count   : 0`);
  return ls;
}

function showPortSecurityAddress(state: DeviceState): string[] {
  const ls: string[] = [];
  ls.push('               Secure Mac Address Table');
  ls.push('-----------------------------------------------------------------------------');
  ls.push('Vlan    Mac Address       Type                          Ports   Remaining Age');
  ls.push('                                                                   (mins)');
  ls.push('----    -----------       ----                          -----   -------------');
  for (const iface of Object.values(state.interfaces)) {
    if (!iface.portSecurity.enabled || iface.portSecurity.learnedAddresses.length === 0) continue;
    for (const mac of iface.portSecurity.learnedAddresses) {
      const typeStr = iface.portSecurity.stickyLearning ? 'SecureSticky' : 'SecureDynamic';
      ls.push(`  ${padLeft(String(iface.accessVlan), 2)}    ${mac}    ${padRight(typeStr, 30)}${shortIfName(iface.id)}       -`);
    }
  }
  ls.push('-----------------------------------------------------------------------------');
  ls.push('Total Addresses in System (excluding one mac per port)     : 0');
  ls.push('Max Addresses limit in System (excluding one mac per port) : 4096');
  return ls;
}


function showIpOspfDatabase(state: DeviceState, subtype?: string): string[] {
  if (!state.ospf) return ['% OSPF is not configured'];
  const o = state.ospf;
  const rid = o.routerId || '1.1.1.1';
  const ls: string[] = [];

  if (!subtype || subtype === 'all') {
    ls.push(`            OSPF Router with ID (${rid}) (Process ID ${o.processId})`);
    ls.push('');
    ls.push('                Router Link States (Area 0)');
    ls.push('');
    ls.push('Link ID         ADV Router      Age         Seq#       Checksum Link count');
    ls.push(`${padRight(rid, 16)}${padRight(rid, 16)}312         0x80000009 0x007A23 5`);
    ls.push(`${padRight('192.168.1.254', 16)}${padRight('192.168.1.254', 16)}287         0x80000015 0x00B4E1 3`);
    ls.push('');
    ls.push('                Net Link States (Area 0)');
    ls.push('');
    ls.push('Link ID         ADV Router      Age         Seq#       Checksum');
    ls.push(`${padRight('192.168.1.1', 16)}${padRight(rid, 16)}312         0x80000003 0x00A1B2`);
    ls.push('');
    ls.push('                Summary Net Link States (Area 0)');
    ls.push('');
    ls.push('Link ID         ADV Router      Age         Seq#       Checksum');
    ls.push(`${padRight('10.30.30.0', 16)}${padRight('192.168.1.254', 16)}287         0x80000003 0x00C3D4`);
    ls.push('');
    ls.push('                AS External Link States');
    ls.push('');
    ls.push('Link ID         ADV Router      Age         Seq#       Checksum Tag');
    ls.push(`${padRight('0.0.0.0', 16)}${padRight('192.168.1.254', 16)}287         0x80000001 0x00E5F6 1`);
  } else if (subtype === 'router') {
    ls.push(`            OSPF Router with ID (${rid}) (Process ID ${o.processId})`);
    ls.push('');
    ls.push('                Router Link States (Area 0)');
    ls.push('');
    ls.push('  LS age: 312');
    ls.push('  Options: (No TOS-capability, DC)');
    ls.push('  LS Type: Router Links');
    ls.push(`  Link State ID: ${rid}`);
    ls.push(`  Advertising Router: ${rid}`);
    ls.push('  LS Seq Number: 80000009');
    ls.push('  Checksum: 0x7A23');
    ls.push('  Length: 96');
    ls.push('  Area Border Router');
    ls.push('  AS Boundary Router');
    ls.push('  Number of Links: 5');
    ls.push('');
    ls.push('    Link connected to: a Stub Network');
    ls.push('     (Link ID) Network/subnet number: 1.1.1.1');
    ls.push('     (Link Data) Network Mask: 255.255.255.255');
    ls.push('      Number of MTID metrics: 0');
    ls.push('       TOS 0 Metrics: 1');
    ls.push('');
    ls.push('    Link connected to: a Transit Network');
    ls.push('     (Link ID) Designated Router address: 192.168.1.1');
    ls.push('     (Link Data) Router Interface address: 192.168.1.1');
    ls.push('      Number of MTID metrics: 0');
    ls.push('       TOS 0 Metrics: 1');
    ls.push('');
    ls.push('  LS age: 287');
    ls.push('  Options: (No TOS-capability, DC)');
    ls.push('  LS Type: Router Links');
    ls.push('  Link State ID: 192.168.1.254');
    ls.push('  Advertising Router: 192.168.1.254');
    ls.push('  LS Seq Number: 80000015');
    ls.push('  Checksum: 0xB4E1');
    ls.push('  Length: 60');
    ls.push('  Number of Links: 3');
    ls.push('');
    ls.push('    Link connected to: a Transit Network');
    ls.push('     (Link ID) Designated Router address: 192.168.1.1');
    ls.push('     (Link Data) Router Interface address: 192.168.1.254');
    ls.push('      Number of MTID metrics: 0');
    ls.push('       TOS 0 Metrics: 1');
  } else if (subtype === 'network') {
    ls.push(`            OSPF Router with ID (${rid}) (Process ID ${o.processId})`);
    ls.push('');
    ls.push('                Net Link States (Area 0)');
    ls.push('');
    ls.push('  LS age: 312');
    ls.push('  Options: (No TOS-capability, DC)');
    ls.push('  LS Type: Network Links');
    ls.push('  Link State ID: 192.168.1.1 (address of Designated Router)');
    ls.push(`  Advertising Router: ${rid}`);
    ls.push('  LS Seq Number: 80000003');
    ls.push('  Checksum: 0xA1B2');
    ls.push('  Length: 32');
    ls.push('  Network Mask: /24');
    ls.push(`        Attached Router: ${rid}`);
    ls.push('        Attached Router: 192.168.1.254');
  } else if (subtype === 'summary') {
    ls.push(`            OSPF Router with ID (${rid}) (Process ID ${o.processId})`);
    ls.push('');
    ls.push('                Summary Net Link States (Area 0)');
    ls.push('');
    ls.push('  LS age: 287');
    ls.push('  Options: (No TOS-capability, DC)');
    ls.push('  LS Type: Summary Links(Network)');
    ls.push('  Link State ID: 10.30.30.0 (summary Network Number)');
    ls.push('  Advertising Router: 192.168.1.254');
    ls.push('  LS Seq Number: 80000003');
    ls.push('  Checksum: 0xC3D4');
    ls.push('  Length: 28');
    ls.push('  Network Mask: /24');
    ls.push('        MTID: 0         Metric: 1');
  } else if (subtype === 'external') {
    ls.push(`            OSPF Router with ID (${rid}) (Process ID ${o.processId})`);
    ls.push('');
    ls.push('                AS External Link States');
    ls.push('');
    ls.push('  LS age: 287');
    ls.push('  Options: (No TOS-capability, DC)');
    ls.push('  LS Type: AS External Link');
    ls.push('  Link State ID: 0.0.0.0 (External Network Number )');
    ls.push('  Advertising Router: 192.168.1.254');
    ls.push('  LS Seq Number: 80000001');
    ls.push('  Checksum: 0xE5F6');
    ls.push('  Length: 36');
    ls.push('  Network Mask: /0');
    ls.push('        Metric Type: 2 (Larger than any link state path)');
    ls.push('        MTID: 0');
    ls.push('        Metric: 1');
    ls.push('        Forward Address: 0.0.0.0');
    ls.push('        External Route Tag: 1');
  }
  return ls;
}

function showIpOspfInterface(state: DeviceState, brief: boolean, ifFilter?: string): string[] {
  if (!state.ospf) return ['% OSPF is not configured'];
  const o = state.ospf;
  const rid = o.routerId || '1.1.1.1';
  const ls: string[] = [];

  const ospfIfaces = Object.values(state.interfaces).filter(iface => {
    if (!iface.ipAddresses.length) return false;
    if (ifFilter) {
      const normFilter = ifFilter.toLowerCase();
      return iface.id.toLowerCase() === normFilter ||
             iface.id.toLowerCase().startsWith(normFilter);
    }
    if (iface.id.startsWith('Loopback')) return true;
    return o.networks.some(n => {
      const ifaceIp = iface.ipAddresses[0]?.address || '';
      const netParts = n.network.split('.');
      const ifParts = ifaceIp.split('.');
      const wcParts = n.wildcard.split('.');
      for (let i = 0; i < 4; i++) {
        if (wcParts[i] === '0' && netParts[i] !== ifParts[i]) return false;
      }
      return true;
    });
  });

  if (brief) {
    ls.push('Interface    PID   Area            IP Address/Mask    Cost  State Nbrs F/C');
    for (const iface of ospfIfaces) {
      const ip = iface.ipAddresses[0];
      if (!ip) continue;
      const cidr = maskToCidr(ip.mask);
      const ipMask = `${ip.address}/${cidr}`;
      const isLoopback = iface.id.startsWith('Loopback');
      const stateStr = isLoopback ? 'LOOP' : 'DR';
      const hasNeighbor = o.neighbors.some(n => n.interface === iface.id);
      const nbrTotal = hasNeighbor ? 1 : 0;
      const nbrFull = hasNeighbor ? 1 : 0;
      const shortId = iface.id.replace('Vlan', 'Vl').replace('Loopback', 'Lo');
      ls.push(`${padRight(shortId, 13)}${padLeft(String(o.processId), 3)}   ${padRight('0', 16)}${padRight(ipMask, 19)}${padLeft('1', 4)}  ${padRight(stateStr, 6)}${nbrTotal}/${nbrFull}`);
    }
  } else {
    for (const iface of ospfIfaces) {
      const ip = iface.ipAddresses[0];
      if (!ip) continue;
      const cidr = maskToCidr(ip.mask);
      const isLoopback = iface.id.startsWith('Loopback');
      const adminStr = iface.lineState === 'up' ? 'up' : 'down';
      const protoStr = iface.lineState === 'up' ? 'up' : 'down';
      const displayId = expandIfNameFull(iface.id);
      ls.push(`${displayId} is ${adminStr}, line protocol is ${protoStr}`);
      ls.push(`  Internet Address ${ip.address}/${cidr}, Area 0, Attached via Network Statement`);
      ls.push(`  Process ID ${o.processId}, Router ID ${rid}, Network Type ${isLoopback ? 'LOOPBACK' : 'BROADCAST'}, Cost: ${iface.ospfCost || 1}`);
      ls.push('  Topology-MTID    Cost    Disabled    Shutdown      Topology Name');
      ls.push(`        0           ${iface.ospfCost || 1}         no          no            Base`);
      ls.push('  Enabled by interface config, including secondary ip addresses');
      ls.push(`  Transmit Delay is 1 sec, State ${isLoopback ? 'LOOPBACK' : 'DR'}, Priority ${iface.ospfPriority || 1}`);
      if (!isLoopback) {
        ls.push(`  Designated Router (ID) ${rid}, Interface address ${ip.address}`);
        ls.push('  Backup Designated router (ID) 192.168.1.254, Interface address 192.168.1.254');
        ls.push('  Timer intervals configured, Hello 10, Dead 40, Wait 40, Retransmit 5');
        ls.push('    oob-resync timeout 40');
        ls.push('    Hello due in 00:00:07');
        ls.push('  Supports Link-local Signaling (LLS)');
        ls.push('  Cisco NSF helper support enabled');
        ls.push('  IETF NSF helper support enabled');
        ls.push('  Index 1/1/1, flood queue length 0');
        ls.push('  Next 0x0(0)/0x0(0)/0x0(0)');
        ls.push('  Last flood scan length is 2, maximum is 3');
        ls.push('  Last flood scan time is 0 msec, maximum is 0 msec');
        const hasNeighbor = o.neighbors.some(n => n.interface === iface.id);
        const nbrCount = hasNeighbor ? 1 : 0;
        ls.push(`  Neighbor Count is ${nbrCount}, Adjacent neighbor count is ${nbrCount}`);
        if (hasNeighbor) {
          const nb = o.neighbors.find(n => n.interface === iface.id)!;
          ls.push(`    Adjacent with neighbor ${nb.address}  (Backup Designated Router)`);
        }
        ls.push('  Suppress hello for 0 neighbor(s)');
      } else {
        ls.push('  No Hellos (Passive interface)');
      }
      ls.push('');
    }
  }
  return ls;
}

function showIpOspfNeighborDetail(state: DeviceState): string[] {
  if (!state.ospf) return ['% OSPF is not configured'];
  const o = state.ospf;
  const ls: string[] = [];
  for (const nb of o.neighbors) {
    ls.push(` Neighbor ${nb.neighborId}, interface address ${nb.address}`);
    ls.push(`    In the area 0 via interface ${nb.interface}`);
    ls.push(`    Neighbor priority is ${nb.priority}, State is ${nb.state}, 6 state changes`);
    ls.push(`    DR is ${o.routerId || '1.1.1.1'} BDR is ${nb.address}`);
    ls.push('    Options is 0x12 in Hello (E-bit, L-bit)');
    ls.push('    Options is 0x52 in DBD  (E-bit, L-bit, O-bit)');
    ls.push('    LLS Options is 0x1 (LR)');
    ls.push(`    Dead timer due in ${nb.deadTime}`);
    ls.push('    Neighbor is up for 00:45:32');
    ls.push('    Index 1/1/1, retransmission queue length 0, number of retransmission 1');
    ls.push('    First 0x0(0)/0x0(0)/0x0(0) Next 0x0(0)/0x0(0)/0x0(0)');
    ls.push('    Last retransmission scan length is 1, maximum is 1');
    ls.push('    Last retransmission scan time is 0 msec, maximum is 0 msec');
    ls.push('');
  }
  return ls;
}

function showIpEigrpTopology(state: DeviceState, allLinks: boolean): string[] {
  if (!state.eigrp) return ['% EIGRP is not configured'];
  const e = state.eigrp;
  const routerId = Object.values(state.interfaces)
    .find(i => i.id.startsWith('Loopback') && i.ipAddresses.length > 0)
    ?.ipAddresses[0].address || '1.1.1.1';

  const ls: string[] = [];
  ls.push(`EIGRP-IPv4 Topology Table for AS(${e.asNumber})/ID(${routerId})`);
  ls.push('Codes: P - Passive, A - Active, U - Update, Q - Query, R - Reply,');
  ls.push('       r - reply Status, s - sia Status');
  ls.push('');

  if (e.neighbors.length > 0) {
    const nb = e.neighbors[0];
    ls.push('P 0.0.0.0/0, 1 successors, FD is 28160');
    ls.push(`        via ${nb.address} (28160/2816), ${shortIfName(nb.interface)}`);
    if (allLinks) {
      ls.push('        via 10.10.10.254 (30720/28160), Vlan10');
    }
  }

  const seen = new Set<string>();
  for (const iface of Object.values(state.interfaces)) {
    for (const ip of iface.ipAddresses) {
      if (!ip.address || !ip.mask) continue;
      const cidr = maskToCidr(ip.mask);
      if (cidr === 32) continue;
      const parts = ip.address.split('.').map(Number);
      const mparts = ip.mask.split('.').map(Number);
      const netParts = parts.map((p, idx) => p & mparts[idx]);
      const prefix = `${netParts.join('.')}/${cidr}`;
      if (seen.has(prefix)) continue;
      seen.add(prefix);
      const fd = prefix.startsWith('192.168') ? 2816 : 28160;
      ls.push(`P ${prefix}, 1 successors, FD is ${fd}`);
      ls.push(`        via Connected, ${shortIfName(iface.id)}`);
      if (allLinks && !iface.id.startsWith('Loopback')) {
        ls.push(`        via 192.168.1.254 (30720/28160), ${shortIfName(iface.id)}`);
      }
    }
  }
  return ls;
}

function showIpEigrpInterfaces(state: DeviceState, detail: boolean): string[] {
  if (!state.eigrp) return ['% EIGRP is not configured'];
  const e = state.eigrp;
  const ls: string[] = [];
  ls.push(`EIGRP-IPv4 Interfaces for AS(${e.asNumber})`);
  ls.push('');
  ls.push('                              Xmit Queue   PeerQ        Mean   Pacing Time   Multicast    Pending');
  ls.push('Interface              Peers  Un/Reliable  Un/Reliable  SRTT   Un/Reliable   Flow Timer   Routes');

  const ifacesWithIp = Object.values(state.interfaces).filter(i =>
    i.ipAddresses.length > 0 && (i.id.startsWith('Vlan') || i.id.startsWith('Loopback'))
  );

  for (const iface of ifacesWithIp) {
    const hasNeighbor = e.neighbors.some(n => n.interface === iface.id);
    const peerCount = hasNeighbor ? 1 : 0;
    const nb = hasNeighbor ? e.neighbors.find(n => n.interface === iface.id)! : null;
    const srtt = nb ? nb.srtt : 0;
    const flowTimer = peerCount > 0 ? 50 : 0;
    const shortId = iface.id.replace('Vlan', 'Vl').replace('Loopback', 'Lo');
    ls.push(`${padRight(shortId, 23)}${padLeft(String(peerCount), 5)}        0/0       0/0      ${padLeft(String(srtt), 3)}       0/${peerCount > 0 ? 1 : 0}           ${padLeft(String(flowTimer), 3)}             0`);
    if (detail && nb) {
      ls.push('  Hello-interval is 5, Hold-time is 15');
      ls.push('  Split-horizon enabled');
      ls.push('  Next xmit serial <none>');
      ls.push('  Un/reliable mcasts: 0/2  Un/reliable ucasts: 0/3');
      ls.push('  Mcast exceptions: 0  CR packets: 0  ACKs suppressed: 0');
      ls.push('  Retransmissions sent: 1  Out-of-sequence rcvd: 0');
      ls.push('  Topology-ids on interface - 0');
      ls.push('  Authentication mode is not set');
      ls.push('');
    }
  }
  return ls;
}

function showIpEigrpTraffic(state: DeviceState): string[] {
  if (!state.eigrp) return ['% EIGRP is not configured'];
  const e = state.eigrp;
  return [
    `EIGRP-IPv4 Traffic Statistics for AS(${e.asNumber})`,
    '  Hellos sent/received: 2847/2841',
    '  Updates sent/received: 12/8',
    '  Queries sent/received: 3/2',
    '  Replies sent/received: 2/3',
    '  Acks sent/received: 14/10',
    '  SIA-Queries sent/received: 0/0',
    '  SIA-Replies sent/received: 0/0',
    '  Hello Process ID: 149',
    '  PDM Process ID: 130',
    '  Socket Queue: 0/10000/2/0 (current/max/highest/drops)',
    '  Input Queue: 0/10000/2/0 (current/max/highest/drops)',
  ];
}

function showIpBgpTable(state: DeviceState): string[] {
  if (!state.bgp) return ['% BGP is not configured'];
  const b = state.bgp;
  const rid = b.routerId || '1.1.1.1';
  const ls: string[] = [];
  ls.push(`BGP table version is 12, local router ID is ${rid}`);
  ls.push('Status codes: s suppressed, d damped, h history, * valid, > best, i - internal,');
  ls.push('              r RIB-failure, S Stale, m multipath, b backup-path, f RT-Filter,');
  ls.push('              x best-external, a additional-path, c RIB-compressed,');
  ls.push('              t secondary path, L long-lived-stale,');
  ls.push('Origin codes: i - IGP, e - EGP, ? - incomplete');
  ls.push('RPKI validation codes: V valid, I invalid, N Not found');
  ls.push('');
  ls.push('     Network          Next Hop            Metric LocPrf Weight Path');

  for (const nb of b.neighbors) {
    if (nb.state === 'Established') {
      ls.push(` *>  0.0.0.0          ${padRight(nb.address, 20)}    0             0 ${nb.remoteAs} i`);
    }
  }

  const advertisedNets = new Set(b.networks.map(n => n.network));
  for (const n of b.networks) {
    const cidr = n.mask ? `/${maskToCidr(n.mask)}` : '';
    ls.push(` *>  ${padRight(`${n.network}${cidr}`, 17)}${padRight('0.0.0.0', 20)}    0         32768 i`);
  }

  const connNets = [
    { net: '10.10.10.0/24', base: '10.10.10.0', iface: 'Vlan10' },
    { net: '10.20.20.0/24', base: '10.20.20.0', iface: 'Vlan20' },
    { net: '10.30.30.0/24', base: '10.30.30.0', iface: 'Vlan30' },
    { net: '192.168.1.0',   base: '192.168.1.0', iface: 'Vlan1' },
  ];
  for (const cn of connNets) {
    if (!advertisedNets.has(cn.base) && !advertisedNets.has(cn.net) && state.interfaces[cn.iface]) {
      ls.push(` *>  ${padRight(cn.net, 17)}${padRight('0.0.0.0', 20)}    0         32768 i`);
    }
  }
  return ls;
}

function showIpBgpNeighborsDetail(state: DeviceState, ipFilter?: string): string[] {
  if (!state.bgp) return ['% BGP is not configured'];
  const b = state.bgp;
  const localRid = b.routerId || '1.1.1.1';
  const ls: string[] = [];

  const neighbors = ipFilter
    ? b.neighbors.filter(nb => nb.address === ipFilter)
    : b.neighbors;

  if (ipFilter && neighbors.length === 0) {
    return [`% Neighbor ${ipFilter} not found`];
  }

  for (const nb of neighbors) {
    const isEbgp = nb.remoteAs !== b.asNumber;
    ls.push(`BGP neighbor is ${nb.address},  remote AS ${nb.remoteAs}, ${isEbgp ? 'external' : 'internal'} link`);
    ls.push(`  BGP version 4, remote router ID ${nb.address}`);
    ls.push(`  BGP state = ${nb.state}, up for ${nb.uptime}`);
    ls.push('  Last read 00:00:23, last write 00:00:17, hold time is 180, keepalive interval is 60 seconds');
    ls.push('  Neighbor sessions:');
    ls.push('    1 active, is not multisession capable (disabled)');
    ls.push('  Neighbor capabilities:');
    ls.push('    Route refresh: advertised and received(new)');
    ls.push('    Four-octets ASN Capability: advertised and received');
    ls.push('    Address family IPv4 Unicast: advertised and received');
    ls.push('    Enhanced Refresh Capability: advertised and received');
    ls.push('    Multisession Capability:');
    ls.push('    Stateful switchover support enabled: NO for session 1');
    ls.push('  Message statistics:');
    ls.push('    InQ depth is 0');
    ls.push('    OutQ depth is 0');
    ls.push('                         Sent       Rcvd');
    ls.push('    Opens:                  1          1');
    ls.push('    Notifications:          0          0');
    ls.push('    Updates:                3          2');
    ls.push('    Keepalives:            45         44');
    ls.push('    Route Refresh:          0          0');
    ls.push('    Total:                 49         47');
    ls.push('  Default minimum time between advertisement runs is 30 seconds');
    ls.push('  For address family: IPv4 Unicast');
    ls.push('    BGP table version 12, neighbor version 12/0');
    ls.push('    Output queue size : 0');
    ls.push('    Index 1, Advertise bit 0');
    ls.push('    1 update-group member');
    ls.push('    Slow-peer detection is disabled');
    ls.push('    Slow-peer split-update-group dynamic is disabled');
    ls.push('                                 Sent       Rcvd');
    ls.push('    Prefix activity:               ----       ----');
    ls.push(`      Prefixes Current:               5          ${nb.prefixesReceived} (Consumes ${nb.prefixesReceived * 80} bytes)`);
    ls.push(`      Prefixes Total:                 5          ${nb.prefixesReceived}`);
    ls.push('      Implicit Withdraw:              0          0');
    ls.push('      Explicit Withdraw:              0          0');
    ls.push(`      Used as bestpath:             n/a          ${nb.prefixesReceived}`);
    ls.push('      Used as multipath:            n/a          0');
    ls.push('      Used as secondary:            n/a          0');
    const localIface = Object.values(state.interfaces).find(i =>
      i.ipAddresses.some(a => {
        const parts = a.address.split('.').map(Number);
        const mparts = a.mask.split('.').map(Number);
        const nbParts = nb.address.split('.').map(Number);
        return parts.every((p, idx) => (p & mparts[idx]) === (nbParts[idx] & mparts[idx]));
      })
    );
    const localIp = localIface?.ipAddresses[0]?.address || localRid;
    ls.push(`  Local host: ${localIp}, Local port: 179`);
    ls.push(`  Foreign host: ${nb.address}, Foreign port: 50234`);
    ls.push(`  Connection established ${nb.uptime} ago`);
    ls.push('');
  }
  return ls;
}

function showIpBgpNeighborRoutes(
  state: DeviceState,
  ip: string,
  routeType: 'advertised-routes' | 'received-routes' | 'routes'
): string[] {
  if (!state.bgp) return ['% BGP is not configured'];
  const b = state.bgp;
  const rid = b.routerId || '1.1.1.1';
  const nb = b.neighbors.find(n => n.address === ip);
  if (!nb) return [`% Neighbor ${ip} not found`];

  const ls: string[] = [];
  ls.push(`BGP table version is 12, local router ID is ${rid}`);
  ls.push('Status codes: s suppressed, d damped, h history, * valid, > best, i - internal,');
  ls.push('              r RIB-failure, S Stale, m multipath, b backup-path, f RT-Filter,');
  ls.push('              x best-external, a additional-path, c RIB-compressed,');
  ls.push('              t secondary path, L long-lived-stale,');
  ls.push('Origin codes: i - IGP, e - EGP, ? - incomplete');
  ls.push('');
  ls.push('     Network          Next Hop            Metric LocPrf Weight Path');

  if (routeType === 'advertised-routes') {
    const localNets: { net: string; nh: string }[] = [];
    for (const n of b.networks) {
      const cidr = n.mask ? `/${maskToCidr(n.mask)}` : '';
      localNets.push({ net: `${n.network}${cidr}`, nh: rid });
    }
    const connDefaults = [
      { net: '10.10.10.0/24', iface: 'Vlan10' },
      { net: '10.20.20.0/24', iface: 'Vlan20' },
      { net: '192.168.1.0',   iface: 'Vlan1' },
    ];
    const advNets = new Set(localNets.map(n => n.net));
    for (const cd of connDefaults) {
      const base = cd.net.split('/')[0];
      if (!advNets.has(base) && !advNets.has(cd.net) && state.interfaces[cd.iface]) {
        localNets.push({ net: cd.net, nh: rid });
      }
    }
    const seen = new Set<string>();
    let count = 0;
    for (const n of localNets) {
      if (seen.has(n.net)) continue;
      seen.add(n.net);
      ls.push(` *>  ${padRight(n.net, 17)}${padRight(n.nh, 20)}    0         32768 i`);
      count++;
    }
    ls.push('');
    ls.push(`Total number of prefixes ${count}`);
  } else {
    ls.push(` *>  0.0.0.0          ${padRight(nb.address, 20)}    0             0 ${nb.remoteAs} i`);
    if (nb.prefixesReceived > 1) {
      ls.push(` *>  10.0.0.0/8       ${padRight(nb.address, 20)}    0             0 ${nb.remoteAs} i`);
    }
    ls.push('');
    ls.push(`Total number of prefixes ${nb.prefixesReceived}`);
  }
  return ls;
}

function showIpBgpSummaryFull(state: DeviceState): string[] {
  if (!state.bgp) return ['% BGP is not configured'];
  const b = state.bgp;
  const rid = b.routerId || '1.1.1.1';
  const networkCount = b.networks.length + 4;
  const ls: string[] = [];
  ls.push(`BGP router identifier ${rid}, local AS number ${b.asNumber}`);
  ls.push('BGP table version is 12, main routing table version 12');
  ls.push(`${networkCount} network entries using ${networkCount * 1288} bytes of memory`);
  ls.push(`${networkCount} path entries using ${networkCount * 392} bytes of memory`);
  ls.push('4/2 BGP path/bestpath attribute entries using 576 bytes of memory');
  ls.push('1 BGP AS-PATH entries using 24 bytes of memory');
  ls.push('0 BGP route-map cache entries using 0 bytes of memory');
  ls.push('0 BGP filter-list cache entries using 0 bytes of memory');
  ls.push('BGP using 12592 total bytes of memory');
  ls.push(`BGP activity ${networkCount * 2}/${networkCount} prefixes, ${networkCount * 3}/${networkCount} paths, scan interval 60 secs`);
  ls.push('');
  ls.push('Neighbor        V           AS MsgRcvd MsgSent   TblVer  InQ OutQ Up/Down  State/PfxRcd');
  for (const nb of b.neighbors) {
    const stateOrPfx = nb.state === 'Established'
      ? String(nb.prefixesReceived)
      : nb.state;
    ls.push(`${padRight(nb.address, 16)}4 ${padLeft(String(nb.remoteAs), 12)}      47      49       12    0    0 ${padRight(nb.uptime, 9)}${stateOrPfx}`);
  }
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


function showPlatform(_state: DeviceState): string[] {
  return [
    'Chassis type: WS-C2960X-48TS-L',
    '',
    'Slot      Type                State                 Insert time (ago)',
    '--------- ------------------- --------------------- -----------------',
    ' WS-C2960X-48TS-L             ok                    2 days, 3 hours',
    ' Power supply 1               ok                    2 days, 3 hours',
    '',
    'Slot      CPLD Version        Firmware Version',
    '--------- ------------------- ---------------------------------',
    ' WS-C2960X-48TS-L             15.7(3r)M3',
  ];
}

function showPlatformTcam(_state: DeviceState): string[] {
  return [
    'CAM Utilization for ASIC# 0      Max            Used',
    '  Unicast mac addresses:         32768          42',
    '  IPv4 IGMP groups + multicast routes:',
    '                                 1024           0',
    '  IPv4 unicast routes:           8192           12',
    '  IPv6 unicast routes:           2048           2',
    '  QoS access control entries:   512            0',
    '  Security access control entries:',
    '                                 4096           4',
    '  Layer 2 VLANs:                 1023           8',
    '  Total Netflow TCAM entries:    0              0',
  ];
}

function showControllers(_state: DeviceState): string[] {
  return [
    'Interface FastEthernet0/1',
    '  Hardware is Fast Ethernet',
    '  ARP type: ARPA, ARP Timeout 04:00:00',
    '  Last input 00:00:02, output 00:00:00',
    '  Input queue: 0/75/0 (size/max/drops); Total output drops: 0',
    '  5 minute input rate 1000 bits/sec, 1 packets/sec',
    '  5 minute output rate 2000 bits/sec, 2 packets/sec',
    '  Received 142983 broadcasts, 0 runts, 0 giants, 0 throttles',
    '  0 input errors, 0 CRC, 0 frame, 0 overrun, 0 ignored',
    '  Output queue: 0/40 (size/max)',
    '  0 output errors, 0 collisions, 2 resets',
  ];
}

function showInterfacesCounters(_state: DeviceState): string[] {
  return [
    'Port          InOctets  InUcastPkts  InMcastPkts  InBcastPkts',
    'Fa0/1          18621894       142983           0         1203',
    'Fa0/3          12450123        98234           0          876',
    'Fa0/5           9876543        76543           0          654',
    'Gi0/1         154367890      1234567           0         4567',
    'Gi0/2          98765432       876543           0         3456',
    '',
    'Port         OutOctets OutUcastPkts OutMcastPkts OutBcastPkts',
    'Fa0/1         26240110       201847           0          234',
    'Fa0/3         17654321       134567           0          189',
    'Fa0/5         13456789       103456           0          156',
    'Gi0/1        234567890      1876543           0         6789',
    'Gi0/2        156789012      1234567           0         4567',
  ];
}

function showInterfacesCountersErrors(_state: DeviceState): string[] {
  return [
    'Port        Align-Err   FCS-Err   Xmit-Err   Rcv-Err  UnderSize OutDiscards',
    'Fa0/1               0         0          0         0          0           0',
    'Fa0/3               0         0          0         0          0           0',
    'Fa0/5               0         0          0         0          0           0',
    'Gi0/1               0         0          0         0          0           0',
    'Gi0/2               0         0          0         0          0           0',
  ];
}

function showInterfacesCountersTrunk(_state: DeviceState): string[] {
  return [
    'Port        TrunkFramesTx  TrunkFramesRx  WrongEncap',
    'Gi0/1           1234567890     9876543210           0',
    'Gi0/2            987654321     8765432109           0',
  ];
}

function showIpTraffic(_state: DeviceState): string[] {
  return [
    'IP statistics:',
    '  Rcvd:  142983 total, 142983 local destination',
    '         0 format errors, 0 checksum errors, 0 bad hop count',
    '         0 unknown protocol, 0 not a gateway',
    '         0 security failures, 0 bad options, 0 with options',
    '  Opts:  0 end, 0 nop, 0 basic security, 0 loose source route',
    '         0 timestamp, 0 extended security, 0 record route',
    '         0 stream ID, 0 strict source route, 0 alert, 0 cipso, 0 ump',
    '         0 other',
    "  Frags: 0 reassembled, 0 timeouts, 0 couldn't reassemble",
    "         0 fragmented, 0 fragments, 0 couldn't fragment",
    '  Bcast: 4567 received, 8901 sent',
    '  Mcast: 234 received, 456 sent',
    '  Sent:  201847 generated, 0 forwarded',
    '  Drop:  0 encapsulation failed, 0 unresolved, 0 no adjacency',
    '         0 no route, 0 unicast RPF, 0 forced drop, 0 recycled',
    '         0 options denied',
  ];
}

function showIpCache(_state: DeviceState): string[] {
  return [
    'IP Flow Switching Cache, 278544 bytes',
    '  0 active, 4096 inactive, 0 added',
    '  0 ager polls, 0 flow alloc failures',
    '  Active flows timeout in 30 minutes',
    '  Inactive flows timeout in 15 seconds',
    'IP Sub Flow Cache, 25800 bytes',
    '  0 active, 1024 inactive, 0 added, 0 added to flow',
    '  0 alloc failures, 0 force expire',
    '  0 chunk, 0 chunk added',
    '',
    '  Protocol         Total    Flows   Packets Bytes  Packets Active(Sec) Idle(Sec)',
    '  --------         Flows     /Sec     /Flow  /Pkt     /Sec     /Flow     /Flow',
    '  Total:               0      0.0       0.0    0       0.0       0.0      0.0',
  ];
}

function showErrdisableRecovery(_state: DeviceState): string[] {
  return [
    'ErrDisable Reason            Timer Status   Timer Interval',
    '-----------------            -------------- --------------',
    'arp-inspection               Disabled        300',
    'bpduguard                    Disabled        300',
    'channel-misconfig (STP)      Disabled        300',
    'dhcp-rate-limit              Disabled        300',
    'dtp-flap                     Disabled        300',
    'gbic-invalid                 Disabled        300',
    'inline-power                 Disabled        300',
    'l2ptguard                    Disabled        300',
    'link-flap                    Disabled        300',
    'mac-limit                    Disabled        300',
    'link-monitor-failure         Disabled        300',
    'loopback                     Disabled        300',
    'oam-remote-failure           Disabled        300',
    'pagp-flap                    Disabled        300',
    'port-mode-failure            Disabled        300',
    'psecure-violation            Enabled         300',
    'security-violation           Disabled        300',
    'sfp-config-mismatch          Disabled        300',
    'storm-control                Disabled        300',
    'udld                         Disabled        300',
    'vmps                         Disabled        300',
    '',
    'Timer interval: 300 seconds',
    '',
    'Interfaces that will be enabled at the next timeout:',
    'Interface      Errdisable reason      Time left(sec)',
    '---------      -----------------      --------------',
    'Fa0/7          psecure-violation      247',
  ];
}

function showErrdisableDetect(_state: DeviceState): string[] {
  return [
    'ErrDisable Reason            Detection        Mode',
    '-----------------            ---------        ----',
    'arp-inspection               Enabled          port',
    'bpduguard                    Enabled          port',
    'channel-misconfig (STP)      Enabled          port',
    'dhcp-rate-limit              Enabled          port',
    'dtp-flap                     Enabled          port',
    'gbic-invalid                 Enabled          port',
    'inline-power                 Enabled          port',
    'l2ptguard                    Enabled          port',
    'link-flap                    Enabled          port',
    'loopback                     Enabled          port',
    'pagp-flap                    Enabled          port',
    'psecure-violation            Enabled          port/vlan',
    'security-violation           Enabled          port/vlan',
    'sfp-config-mismatch          Enabled          port',
    'storm-control                Enabled          port',
    'udld                         Enabled          port',
    'vmps                         Enabled          port',
  ];
}

function showInterfacesSwitchport(state: DeviceState, ifFilter?: string): string[] {
  const ls: string[] = [];
  const ifaces = ifFilter
    ? ([state.interfaces[ifFilter]].filter(Boolean) as Interface[])
    : sortInterfaces(Object.values(state.interfaces)).filter(
        i => i.id.startsWith('Fa') || i.id.startsWith('Gi')
      );

  for (const iface of ifaces) {
    if (!iface) continue;
    const shortId = shortIfName(iface.id);
    const isTrunk = iface.switchportMode === 'trunk';
    const adminMode = isTrunk ? 'trunk' : 'static access';
    const operMode = isTrunk ? 'trunk' : 'static access';
    const operEnc = isTrunk ? 'dot1q' : 'native';
    const negTrunk = isTrunk ? 'On' : 'Off';
    const accessVlanName = state.vlans[iface.accessVlan]?.name || 'inactive';
    const nativeVlanName = state.vlans[iface.trunkNativeVlan]?.name || 'inactive';
    const allowedVlans = iface.trunkAllowedVlans || 'ALL';

    ls.push(`Name: ${shortId}`);
    ls.push('Switchport: Enabled');
    ls.push(`Administrative Mode: ${adminMode}`);
    ls.push(`Operational Mode: ${operMode}`);
    ls.push('Administrative Trunking Encapsulation: dot1q');
    ls.push(`Operational Trunking Encapsulation: ${operEnc}`);
    ls.push(`Negotiation of Trunking: ${negTrunk}`);
    ls.push(`Access Mode VLAN: ${iface.accessVlan} (${accessVlanName})`);
    ls.push(`Trunking Native Mode VLAN: ${iface.trunkNativeVlan} (${nativeVlanName})`);
    ls.push('Administrative Native VLAN tagging: enabled');
    ls.push('Voice VLAN: none');
    ls.push('Administrative private-vlan host-association: none');
    ls.push('Administrative private-vlan mapping: none');
    ls.push('Administrative private-vlan trunk native VLAN: none');
    ls.push('Administrative private-vlan trunk Native VLAN tagging: enabled');
    ls.push('Administrative private-vlan trunk encapsulation: dot1q');
    ls.push('Administrative private-vlan trunk normal VLANs: none');
    ls.push('Administrative private-vlan trunk associations: none');
    ls.push('Administrative private-vlan trunk mappings: none');
    ls.push('Operational private-vlan: none');
    ls.push(`Trunking VLANs Enabled: ${isTrunk ? allowedVlans : 'ALL'}`);
    ls.push('Pruning VLANs Enabled: 2-1001');
    ls.push('Capture Mode Disabled');
    ls.push('Capture VLANs Allowed: ALL');
    ls.push('');
    ls.push('Protected: false');
    ls.push('Unknown unicast blocked: disabled');
    ls.push('Unknown multicast blocked: disabled');
    ls.push('Appliance trust: none');
    ls.push('');
  }
  return ls;
}

function showInterfacesCapabilities(state: DeviceState, ifFilter?: string): string[] {
  const ls: string[] = [];
  const ifaces = ifFilter
    ? ([state.interfaces[ifFilter]].filter(Boolean) as Interface[])
    : sortInterfaces(Object.values(state.interfaces)).filter(
        i => i.id.startsWith('Fa') || i.id.startsWith('Gi')
      );

  for (const iface of ifaces) {
    if (!iface) continue;
    const isGi = iface.id.startsWith('Gi');
    const fullId = expandIfNameFull(iface.id);
    ls.push(fullId);
    ls.push('  Model:                 WS-C2960X-48TS-L');
    if (isGi) {
      ls.push('  Type:                  1000BaseTX SFP');
      ls.push('  Speed:                 10,100,1000,auto');
      ls.push('  Duplex:                full,auto');
    } else {
      ls.push('  Type:                  10/100BaseTX');
      ls.push('  Speed:                 10,100,auto');
      ls.push('  Duplex:                half,full,auto');
    }
    ls.push('  Trunk encap. type:     802.1Q');
    ls.push('  Trunk mode:            on,off,desirable,nonegotiate');
    ls.push('  Channel:               yes');
    ls.push('  Broadcast suppression: percentage(0-100)');
    ls.push('  Flowcontrol:           rx-(off,on,desired),tx-(none)');
    ls.push('  Fast Start:            yes');
    ls.push('  QoS scheduling:        rx-(not configurable on per port basis),');
    ls.push('                         tx-(4q3t) (3t: Two configurable values and one fixed.)');
    ls.push('  CoS rewrite:           yes');
    ls.push('  ToS rewrite:           yes');
    ls.push('  UDLD:                  yes');
    ls.push('  Inline power:          no');
    ls.push('  SPAN:                  source/destination');
    ls.push('  PortSecure:            yes');
    ls.push('  Dot1x:                 yes');
    ls.push('');
  }
  return ls;
}

function showIpPimNeighbor(_state: DeviceState): string[] {
  return [
    'PIM Neighbor Table',
    'Mode: B - Bidir Capable, DR - Designated Router, N - Default DR Priority,',
    '      P - Proxy Capable, S - State Refresh Capable, G - GenID Capable,',
    '      L - DR Load-balancing Capable',
    'Neighbor          Interface                Uptime/Expires    Ver   DR',
    'Address                                                            Prio/Mode',
    '192.168.1.254     Vlan1                    00:45:32/00:01:27 v2    1 / S P G',
  ];
}

function showIpPimInterface(_state: DeviceState): string[] {
  return [
    'Address          Interface                Ver/   Nbr    Query  DR         DR',
    '                                          Mode   Count  Intvl  Prior',
    '192.168.1.1      Vlan1                    v2/S   1      30     1          192.168.1.254',
    '10.10.10.1       Vlan10                   v2/S   0      30     1          192.168.1.1',
  ];
}

function showIpMroute(_state: DeviceState): string[] {
  return [
    'IP Multicast Routing Table',
    'Flags: D - Dense, S - Sparse, B - Bidir Group, s - SSM Group, C - Connected,',
    '       L - Local, P - Pruned, R - RP-bit set, F - Register flag,',
    '       T - SPT-bit set, J - Join SPT, M - MSDP created entry, E - Extranet,',
    '       X - Proxy Join Timer Running, A - Candidate for MSDP Advertisement,',
    '       U - URD, I - Received Source Specific Host Report,',
    '       Z - Multicast Tunnel, z - MDT-data group sender,',
    '       Y - Joined MDT-data group, y - Sending to MDT-data group,',
    '       G - Received BGP C-Mroute, g - Sent BGP C-Mroute,',
    '       N - Received BGP Shared-Tree Prune, n - BGP C-Mroute suppressed,',
    '       Q - Received BGP S-A Route, q - Sent BGP S-A Route,',
    '       V - RD & Vector, v - Vector, p - PIM Joins on route,',
    '       x - VxLAN group, c - PFP-SA cache created entry',
    'Outgoing interface flags: H - Hardware switched, A - Assert winner, p - PIM Join',
    ' Timers: Uptime/Expires',
    ' Interface state: Interface, Next-Hop or VCD, State/Mode',
    '',
    '(*, 224.0.1.40), 00:45:32/00:02:58, RP 0.0.0.0, flags: DCL',
    '  Incoming interface: Null, RPF nbr 0.0.0.0',
    '  Outgoing interface list:',
    '    Vlan1, Forward/Sparse, 00:45:32/00:02:58',
  ];
}

function showIpIgmpGroups(_state: DeviceState): string[] {
  return [
    'IGMP Connected Group Membership',
    'Group Address    Interface                Uptime    Expires   Last Reporter   Group Accounted',
    '224.0.1.40       Vlan1                    00:45:32  00:02:58  192.168.1.1',
  ];
}

function showIpIgmpInterface(_state: DeviceState): string[] {
  return [
    'Vlan1 is up, line protocol is up',
    '  Internet address is 192.168.1.1/24',
    '  IGMP is enabled on interface',
    '  Current IGMP host version is 2',
    '  Current IGMP router version is 2',
    '  IGMP query interval is 60 seconds',
    '  IGMP configured query interval is 60 seconds',
    '  IGMP querier timeout is 120 seconds',
    '  IGMP max query response time is 10 seconds',
    '  Last member query count is 2',
    '  Last member query response interval is 1000 ms',
    '  Inbound IGMP access group is not set',
    '  IGMP activity: 3 joins, 0 leaves',
    '  Multicast routing is enabled on interface',
    '  Multicast TTL threshold is 0',
    '  Multicast designated router (DR) is 192.168.1.254',
    '  IGMP querying router is 192.168.1.254',
    '  Multicast groups joined by this system (number of users):',
    '      224.0.1.40(1)',
  ];
}

function showMacAddressTableAgingTime(_state: DeviceState): string[] {
  return [
    'Global Aging Time:  300',
    'Vlan    Aging Time',
    '----    ----------',
  ];
}

function showMacAddressTableCount(state: DeviceState): string[] {
  const dynamic = state.macTable.filter(e => e.type === 'dynamic' || e.type === 'secure-dynamic').length;
  const staticCount = state.macTable.filter(e => e.type === 'static' || e.type === 'secure-static').length;
  const total = state.macTable.length;
  return [
    'MAC Entries for all vlans:',
    `Dynamic Addresses Count  :                   ${dynamic}`,
    `Static  Addresses Count  :                   ${staticCount}`,
    `Total MAC Addresses      :                   ${total}`,
    '',
    `Total CAM Entries Used   :         ${total}`,
    'Total CAM Entries Available :   32768',
  ];
}

function showMacAddressTableNotification(_state: DeviceState): string[] {
  return [
    'MAC Notification Feature is currently disabled on the switch.',
    'Interval between Notification Traps : 1 secs',
    'Number of MAC Addresses Added    : 0',
    'Number of MAC Addresses Removed  : 0',
    '',
    'Interface         MAC Added Trap  MAC Removed Trap  Watermark',
    '---------         -----------     ----------------  ---------',
  ];
}


function showTechSupport(state: DeviceState): string[] {
  const sections: { title: string; lines: string[] }[] = [
    { title: 'show version', lines: showVersion(state) },
    { title: 'show running-config', lines: showRunningConfig(state) },
    { title: 'show interfaces', lines: showInterfaces(state) },
    { title: 'show ip interface brief', lines: showIpInterfaceBrief(state) },
    { title: 'show ip route', lines: showIpRoute(state) },
    { title: 'show vlan brief', lines: showVlan(state, true) },
    { title: 'show mac address-table', lines: showMacTable(state, false) },
    { title: 'show arp', lines: showArp(state) },
    { title: 'show spanning-tree', lines: showSpanningTree(state) },
    { title: 'show cdp neighbors', lines: showCdpNeighbors(state, false) },
    { title: 'show processes cpu', lines: showProcessesCpu(state) },
    { title: 'show memory', lines: showMemory(state) },
    { title: 'show logging', lines: showLogging(state) },
  ];
  const ls: string[] = [];
  for (const section of sections) {
    ls.push(`------------------ ${section.title} ------------------`);
    ls.push('');
    ls.push(...section.lines);
    ls.push('');
  }
  return ls;
}


function showAaa(state: DeviceState, servers: boolean): string[] {
  if (!state.aaa.newModel) {
    return ['AAA: new-model not enabled'];
  }
  if (servers) {
    const ls: string[] = [];
    ls.push('RADIUS: id 1, priority 1, host 0.0.0.0, auth-port 1645, acct-port 1646');
    ls.push('     State: current UP, duration 5s, previous duration 0s');
    ls.push('     Dead: total time 0s, count 0');
    ls.push('     Quarantined: No');
    ls.push('     Authen: request 0, timeouts 0, failover 0, retransmission 0');
    ls.push('             Response: accept 0, reject 0, challenge 0');
    ls.push('             Response: unexpected 0, server error 0, incorrect 0, time 0ms');
    ls.push('             Transaction: success 0, failure 0');
    ls.push('     Author: request 0, timeouts 0, failover 0, retransmission 0');
    ls.push('             Response: accept 0, reject 0, challenge 0');
    ls.push('             Response: unexpected 0, server error 0, incorrect 0, time 0ms');
    ls.push('             Transaction: success 0, failure 0');


    ls.push('     Account: request 0, timeouts 0, failover 0, retransmission 0');
    ls.push('             Response: start 0, interim 0, stop 0');
    ls.push('             Response: unexpected 0, server error 0, incorrect 0, time 0ms');
    ls.push('             Transaction: success 0, failure 0');
    ls.push('     Elapsed time since counters last cleared: 2m');
    return ls;
  }
  const ls: string[] = [];
  ls.push('AAA: enabled');
  ls.push('');
  ls.push('Authentication lists:');
  for (const l of state.aaa.authenticationLists) {
    ls.push(`  ${l.name}: ${l.methods.join(', ')}`);
  }
  ls.push('');
  ls.push('Authorization lists:');
  for (const l of state.aaa.authorizationLists) {
    ls.push(`  ${l.type} ${l.name}: ${l.methods.join(', ')}`);
  }
  ls.push('');
  ls.push('Accounting lists:');
  for (const l of state.aaa.accountingLists) {
    ls.push(`  ${l.type} ${l.name}: ${l.methods.join(', ')}`);
  }
  return ls;
}

function showDot1x(_state: DeviceState): string[] {
  return [
    'Sysauthcontrol              Enabled',
    'Dot1x Protocol Version      3',
    'Critical Recovery Delay     100',
    'Critical EAPOL              Disabled',
  ];
}

function showDot1xInterface(ifId: string): string[] {
  const fullName = ifId
    .replace(/^Fa(\d)/, 'FastEthernet$1')
    .replace(/^Gi(\d)/, 'GigabitEthernet$1');
  return [
    `Dot1x Info for ${fullName}`,
    '-----------------------------------',
    'PAE                       = AUTHENTICATOR',
    'PortStatus                = AUTHORIZED',
    'LastAuthTime              = 15:25:32',
    'AuthSM State              = AUTHENTICATED',
    'BendSM State              = IDLE',
    'PortMode                  = Auto',
    'ReAuthEnabled             = Disabled',
    'ReAuthConfig              = Auto',
    'ReAuthPeriod              = 3600',
    'QuietPeriod               = 60',
    'ServerTimeout             = 30',
    'SuppTimeout               = 30',
    'MaxReq                    = 2',
    'TxPeriod                  = 30',
    'RateLimitPeriod           = 0',
  ];
}

function showDot1xAll(state: DeviceState): string[] {
  const ls: string[] = [];
  const physIfaces = Object.values(state.interfaces)
    .filter(i => i.id.startsWith('Fa') || i.id.startsWith('Gi'))
    .sort((a, b) => {
      if (a.id.startsWith('Gi') && b.id.startsWith('Fa')) return 1;
      if (a.id.startsWith('Fa') && b.id.startsWith('Gi')) return -1;
      return a.port - b.port;
    });
  for (const iface of physIfaces) {
    ls.push(...showDot1xInterface(iface.id));
    ls.push('');
  }
  return ls;
}

function showDot1xStatisticsInterface(ifId: string): string[] {
  const fullName = ifId
    .replace(/^Fa(\d)/, 'FastEthernet$1')
    .replace(/^Gi(\d)/, 'GigabitEthernet$1');
  return [
    `Dot1x Statistics for ${fullName}`,
    '------------------------------------',
    'RxStart = 0         TxStart = 0',
    'RxLogoff = 0        TxLogoff = 0',
    'RxResp = 8          TxReq = 8',
    'RxRespID = 1        TxReqID = 1',
    'RxInvalid = 0       TxTotal = 9',
    'RxLenErr = 0',
    'RxTotal = 9',
    'AuthSuccess = 1     AuthFail = 0',
    'AuthNoResp = 0      AuthReauthsuccess = 0',
    'AuthReauthfail = 0',
  ];
}

function showAuthenticationSessions(_state: DeviceState): string[] {
  return [
    'Interface  MAC Address     Method   Domain   Status         Fg  Session ID',
    'Fa0/1      001a.2b3c.4d5e  dot1x    DATA     Auth            .  0A01010100000001',
    'Fa0/3      001a.2b3c.4d60  dot1x    DATA     Auth            .  0A01010100000002',
    'Fa0/5      001a.2b3c.4d62  mab      VOICE    Auth            .  0A01010100000003',
    '',
    'Session count = 3',
  ];
}

function showAuthenticationSessionsInterface(ifId: string): string[] {
  const fullName = ifId
    .replace(/^Fa(\d)/, 'FastEthernet$1')
    .replace(/^Gi(\d)/, 'GigabitEthernet$1');
  return [
    `            Interface:  ${fullName}`,
    '          MAC Address:  001a.2b3c.4d5e',
    '         IPv6 Address:  Unknown',
    '         IPv4 Address:  10.10.10.100',
    "           User-Name:  CORP\\jsmith",
    '              Status:  Authorized',
    '              Domain:  DATA',
    '      Oper host mode:  single-host',
    '    Oper control dir:  both',
    '     Session timeout:  N/A',
    '  Common Session ID:  0A01010100000001',
    '    Acct Session ID:  0x00000001',
    '              Handle:  0x14000001',
    '      Current Policy:  POLICY_DATA',
    '',
    'Local Policies:',
    '        Service Template: DEFAULT_LINKSEC_POLICY_MUST_SECURE (priority 150)',
    '',
    'Server Policies:',
    '           Vlan Group:  Vlan: 10',
    '       SGT Value:  0',
    '',
    'Method status list:',
    '       Method           State',
    '       dot1x            Authc Success',
  ];
}

function showVrrp(_state: DeviceState): string[] {
  return [
    'Vlan1 - Group 1',
    '  State is Master',
    '  Virtual IP address is 192.168.1.254',
    '  Virtual MAC address is 0000.5e00.0101',
    '  Advertisement interval is 1.000 sec',
    '  Preemption enabled',
    '  Priority is 100',
    '  Master Router is 192.168.1.1 (local), priority is 100',
    '  Master Advertisement interval is 1.000 sec',
    '  Master Down interval is 3.609 sec',
  ];
}

function showVrrpBrief(_state: DeviceState): string[] {
  return [
    'Interface          Grp Pri Time  Own Pre State   Master addr     Group addr',
    'Vl1                  1 100 3609      Y   Master  192.168.1.1     192.168.1.254',
  ];
}

function showPowerInline(_state: DeviceState): string[] {
  return [
    'Available:45.0(w)  Used:15.4(w)  Remaining:29.6(w)',
    '',
    'Interface Admin  Oper       Power   Device              Class Max',
    '                            (Watts)',
    '--------- ------ ---------- ------- ------------------- ----- ----',
    'Fa0/1     auto   on         6.5     Cisco IP Phone 7942  2    15.4',
    'Fa0/3     auto   on         6.5     Cisco IP Phone 7942  2    15.4',
    'Fa0/5     auto   on         7.7     Cisco AIR-CAP3702I   3    15.4',
    'Fa0/7     auto   off        0.0     n/a                  n/a   15.4',
    'Fa0/9     auto   off        0.0     n/a                  n/a   15.4',
    'Fa0/11    auto   off        0.0     n/a                  n/a   15.4',
    'Fa0/2     auto   off        0.0     n/a                  n/a   15.4',
    'Fa0/4     auto   off        0.0     n/a                  n/a   15.4',
    'Fa0/6     auto   off        0.0     n/a                  n/a   15.4',
  ];
}

function showPowerInlineInterface(ifId: string): string[] {
  const shortId = ifId.replace('FastEthernet', 'Fa').replace('GigabitEthernet', 'Gi');
  return [
    'Interface Admin  Oper       Power   Device              Class Max',
    '                            (Watts)',
    '--------- ------ ---------- ------- ------------------- ----- ----',
    `${padRight(shortId, 10)}auto   on         6.5     Cisco IP Phone 7942  2    15.4`,
    '',
    'Interface  PowerFault  Fault  LLDP TLV',
    '                       Status Power  Mdi Status',
    '--------- ----------- ------- -----  ----------',
    `${padRight(shortId, 10)}No          false    n/a    n/a`,
  ];
}

function showInterfacesDescription(state: DeviceState): string[] {
  const ls: string[] = [];
  ls.push('Interface                      Status         Protocol Description');
  const sortedIfs = sortInterfaces(Object.values(state.interfaces));
  for (const iface of sortedIfs) {
    const displayId = expandIfNameFull(iface.id)
      .replace('FastEthernet', 'Fa')
      .replace('GigabitEthernet', 'Gi')
      .replace('Loopback', 'Lo');
    let statusStr: string;
    if (iface.adminState === 'down') {
      statusStr = 'admin down';
    } else if (iface.lineState === 'up') {
      statusStr = 'up';
    } else if (iface.lineState === 'err-disabled') {
      statusStr = 'err-disabled';
    } else {
      statusStr = 'down';
    }
    const protoStr = iface.lineState === 'up' ? 'up' : iface.lineState === 'err-disabled' ? 'err-disabled' : 'down';
    ls.push(`${padRight(displayId, 31)}${padRight(statusStr, 15)}${padRight(protoStr, 9)}${iface.description}`);
  }
  return ls;
}


function showIpSlaStatistics(state: DeviceState, id?: number): string[] {
  const ls: string[] = [];
  ls.push('IPSLAs Latest Operation Statistics');
  ls.push('');
  const entries = id !== undefined ? state.ipSla.filter(e => e.id === id) : state.ipSla;
  for (const entry of entries) {
    const lastHistory = entry.history[entry.history.length - 1];
    const rtt = lastHistory ? lastHistory.roundTripTime : 0;
    const lastTs = lastHistory ? lastHistory.timestamp : 'N/A';
    const successes = entry.history.filter(h => h.success).length;
    const failures = entry.history.filter(h => !h.success).length;
    const sched = state.ipSlaSchedules.find(s => s.id === entry.id);
    const lifeStr = sched ? (sched.life === 'forever' ? 'Forever' : `${sched.life} seconds`) : 'Forever';
    ls.push(`IPSLA operation id: ${entry.id}`);
    ls.push(`        Latest RTT: ${rtt} milliseconds`);
    ls.push(`Latest operation start time: ${lastTs} Fri Mar 20 2026`);
    ls.push(`Latest operation return code: ${lastHistory && lastHistory.success ? 'OK' : 'Timeout'}`);
    ls.push(`Number of successes: ${successes}`);
    ls.push(`Number of failures: ${failures}`);
    ls.push(`Operation time to live: ${lifeStr}`);
    ls.push('');
  }
  return ls;
}

function showIpSlaSummary(state: DeviceState): string[] {
  const ls: string[] = [];
  ls.push('IPSLAs Latest Operation Summary');
  ls.push('Codes: * active,  ^ inactive,  ~ pending');
  ls.push('');
  ls.push('ID           Type        Destination       Stats       Return      Last');
  ls.push('                                           (ms)        Code        Run');
  ls.push('-----------------------------------------------------------------------');
  for (const entry of state.ipSla) {
    const lastHistory = entry.history[entry.history.length - 1];
    const rtt = lastHistory ? lastHistory.roundTripTime : 0;
    const code = lastHistory && lastHistory.success ? 'OK' : 'Timeout';
    const active = state.ipSlaSchedules.some(s => s.id === entry.id) ? '*' : '^';
    ls.push(`${active}${String(entry.id).padEnd(12)} ${entry.type.padEnd(12)}${entry.target.padEnd(18)}RTT=${rtt.toString().padEnd(8)}${code.padEnd(12)}15 seconds ago`);
  }
  return ls;
}

function showIpSlaConfiguration(state: DeviceState, id?: number): string[] {
  const ls: string[] = [];
  ls.push('IP SLAs Infrastructure Engine-II');
  const entries = id !== undefined ? state.ipSla.filter(e => e.id === id) : state.ipSla;
  for (const entry of entries) {
    const sched = state.ipSlaSchedules.find(s => s.id === entry.id);
    ls.push(`Entry number: ${entry.id}`);
    ls.push(`Owner: `);
    ls.push(`Tag: ${entry.tag || ''}`);
    ls.push(`Type of operation to perform: ${entry.type}`);
    ls.push(`Target address/Source interface: ${entry.target}/${entry.sourceInterface || ''}`);
    ls.push(`Type Of Service parameter: 0x0`);
    ls.push(`Request size (ARR data portion): 28`);
    ls.push(`Operation timeout (milliseconds): ${entry.timeout}`);
    ls.push(`Verify data: No`);
    ls.push(`Vrf Name: `);
    ls.push(`Schedule:`);
    ls.push(`   Operation frequency (seconds): ${entry.frequency}  (not considered if randomly scheduled)`);
    ls.push(`   Next Scheduled Start Time: Start Time already passed`);
    ls.push(`   Group Scheduled : FALSE`);
    ls.push(`   Randomly Scheduled : FALSE`);
    ls.push(`   Life (seconds): ${sched ? (sched.life === 'forever' ? 'Forever' : sched.life) : 'Forever'}`);
    ls.push(`   Entry Ageout (seconds): never`);
    ls.push(`   Recurring (Starting Everyday): ${sched && sched.recurring ? 'TRUE' : 'FALSE'}`);
    ls.push(`   Status of entry (SNMP RowStatus): Active`);
    ls.push(`Threshold (milliseconds): ${entry.threshold}`);
    ls.push(`Distribution Statistics:`);
    ls.push(`   Number of statistic hours kept: 2`);
    ls.push(`   Number of statistic distribution buckets kept: 1`);
    ls.push(`   Statistic distribution interval (milliseconds): 20`);
    ls.push(`Enhanced History:`);
    ls.push(`History Statistics:`);
    ls.push(`   Number of history Lives kept: 0`);
    ls.push(`   Number of history Buckets kept: 15`);
    ls.push(`   History Filter Type: None`);
    ls.push('');
  }
  return ls;
}

function showStormControl(state: DeviceState, ifArg?: string): string[] {
  const ls: string[] = [];
  ls.push('Interface  Filter State   Upper         Lower        Current');
  ls.push('---------  ------------- -----------   -----------  ----------');
  const physIfaces = Object.values(state.interfaces)
    .filter(i => (i.id.startsWith('Fa') || i.id.startsWith('Gi')) && i.lineState === 'up')
    .filter(i => !ifArg || i.id.toLowerCase() === ifArg.toLowerCase() || shortIfName(i.id).toLowerCase() === ifArg.toLowerCase())
    .sort((a, b) => {
      const aGi = a.id.startsWith('Gi') ? 1 : 0;
      const bGi = b.id.startsWith('Gi') ? 1 : 0;
      if (aGi !== bGi) return aGi - bGi;
      return a.port - b.port;
    });
  for (const iface of physIfaces) {
    const short = shortIfName(iface.id);
    ls.push(`${padRight(short, 11)}${padRight('Forwarding', 15)}${padRight('100.00%', 14)}${padRight('100.00%', 13)}0.00%`);
  }
  return ls;
}

function showCryptoKeyMypubkeyRsa(state: DeviceState): string[] {
  if (!state.cryptoKeyRsa) {
    return ['% Key pair was not generated.'];
  }
  const generated = new Date(state.cryptoKeyRsa.generated);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const hh = String(generated.getUTCHours()).padStart(2,'0');
  const mm = String(generated.getUTCMinutes()).padStart(2,'0');
  const ss = String(generated.getUTCSeconds()).padStart(2,'0');
  const genStr = `${hh}:${mm}:${ss} UTC ${months[generated.getUTCMonth()]} ${generated.getUTCDate()} ${generated.getUTCFullYear()}`;
  const hostname = state.hostname;
  const domain = state.domainName;
  const keyName = domain ? `${hostname}.${domain}` : hostname;
  return [
    `% Key pair was generated at: ${genStr}`,
    `Key name: ${keyName}`,
    `Key type: RSA KEYS`,
    ` Storage Device: not specified`,
    ` Usage: General Purpose Key`,
    ` Key is not exportable. Key version is 1.`,
    ` Key Data:`,
    `  30820122 300D0609 2A864886 F70D0101 01050003 82010F00 3082010A 02820101`,
    `  00C5B5D7 ...`,
    `% Key pair was generated at: ${genStr}`,
    `Key name: ${keyName}.server`,
    `Key type: RSA KEYS`,
    ` Storage Device: not specified`,
    ` Usage: SSL Server`,
    ` Key Data:`,
    `  30820122 ...`,
  ];
}

function showCryptoPkiCertificates(state: DeviceState): string[] {
  if (!state.cryptoKeyRsa) {
    return ['% No certificates found.'];
  }
  const hostname = state.hostname;
  const domain = state.domainName;
  const keyName = domain ? `${hostname}.${domain}` : hostname;
  const mgmtIp = Object.values(state.interfaces)
    .find(i => i.id === 'Vlan1' && i.ipAddresses.length > 0)
    ?.ipAddresses[0]?.address || '0.0.0.0';
  return [
    'Certificate',
    '  Status: Available',
    '  Certificate Serial Number (hex): 01',
    '  Certificate Usage: General Purpose',
    '  Issuer:',
    `    cn=${keyName}`,
    '  Subject:',
    `    Name: ${keyName}`,
    `    IP Address: ${mgmtIp}`,
    `    cn=${keyName}`,
    '  Validity Date:',
    '    start date: 15:30:01 UTC Mar 20 2026',
    '    end   date: 15:30:01 UTC Mar 20 2028',
    '  Associated Trustpoints: TP-self-signed',
    `  Storage: nvram:${keyName}#1.cer`,
    '',
    'CA Certificate',
    '  Status: Available',
    '  Certificate Serial Number (hex): 01',
    '  Certificate Usage: Signature',
    '  Issuer:',
    `    cn=${keyName}`,
    '  Subject:',
    `    cn=${keyName}`,
    '  Validity Date:',
    '    start date: 15:30:01 UTC Mar 20 2026',
    '    end   date: 15:30:01 UTC Mar 20 2028',
    '  Associated Trustpoints: TP-self-signed',
    `  Storage: nvram:${keyName}#1CA.cer`,
  ];
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
    // show interfaces description
    if (sub2lower === 'description') {
      return makeResult(showInterfacesDescription(state));
    }
    // show interfaces status
    if (sub2lower === 'status') {
      return makeResult(showInterfacesStatus(state));
    }
    // show interfaces trunk
    if (sub2lower === 'trunk') {
      return makeResult(showInterfacesTrunk(state));
    }
    // show interfaces counters [errors|trunk]
    if (sub2lower === 'counters') {
      const sub3lower = (mainArgs[2] || '').toLowerCase();
      if (sub3lower === 'errors') return makeResult(showInterfacesCountersErrors(state));
      if (sub3lower === 'trunk') return makeResult(showInterfacesCountersTrunk(state));
      return makeResult(showInterfacesCounters(state));
    }
    // show interfaces switchport [<id>]
    if (sub2lower === 'switchport') {
      const rest3 = mainArgs.slice(2).join('');
      if (!rest3) return makeResult(showInterfacesSwitchport(state));
      const ifId3 = resolveInterface(rest3, state);
      if (!ifId3) return { output: [out(`% Invalid interface specified`, 'error')] };
      return makeResult(showInterfacesSwitchport(state, ifId3));
    }
    // show interfaces capabilities [<id>]
    if (sub2lower === 'capabilities') {
      const rest3 = mainArgs.slice(2).join('');
      if (!rest3) return makeResult(showInterfacesCapabilities(state));
      const ifId3 = resolveInterface(rest3, state);
      if (!ifId3) return { output: [out(`% Invalid interface specified`, 'error')] };
      return makeResult(showInterfacesCapabilities(state, ifId3));
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
      const sub4 = (mainArgs[3] || '').toLowerCase();
      if (sub3.startsWith('nei') || sub3 === 'neighbor') {
        if (sub4.startsWith('det') || sub4 === 'detail') return makeResult(showIpOspfNeighborDetail(state));
        return makeResult(showIpOspfNeighbor(state));
      }
      if (sub3.startsWith('dat') || sub3 === 'database') {
        // sub4: router, network, summary, external
        if (sub4.startsWith('rou') || sub4 === 'router') return makeResult(showIpOspfDatabase(state, 'router'));
        if (sub4.startsWith('net') || sub4 === 'network') return makeResult(showIpOspfDatabase(state, 'network'));
        if (sub4.startsWith('sum') || sub4 === 'summary') return makeResult(showIpOspfDatabase(state, 'summary'));
        if (sub4.startsWith('ext') || sub4 === 'external') return makeResult(showIpOspfDatabase(state, 'external'));
        return makeResult(showIpOspfDatabase(state, 'all'));
      }
      if (sub3.startsWith('int') || sub3 === 'interface') {
        if (sub4.startsWith('bri') || sub4 === 'brief') return makeResult(showIpOspfInterface(state, true));
        if (!sub4) return makeResult(showIpOspfInterface(state, false));
        const ifId = resolveInterface(mainArgs.slice(3).join(''), state);
        return makeResult(showIpOspfInterface(state, false, ifId || sub4));
      }
      if (!sub3) return makeResult(showIpOspfDetail(state));
      return makeResult(showIpOspfDetail(state));
    }
    if (sub2.startsWith('ei') || sub2 === 'eigrp') {
      const sub3 = (mainArgs[2] || '').toLowerCase();
      const sub4 = (mainArgs[3] || '').toLowerCase();
      if (sub3.startsWith('nei') || sub3 === 'neighbors') return makeResult(showIpEigrpNeighbors(state));
      if (sub3.startsWith('top') || sub3 === 'topology') {
        const allLinks = sub4 === 'all-links' || mainArgs.some(a => a === 'all-links');
        return makeResult(showIpEigrpTopology(state, allLinks));
      }
      if (sub3.startsWith('int') || sub3 === 'interfaces') {
        const detail = sub4.startsWith('det') || sub4 === 'detail';
        return makeResult(showIpEigrpInterfaces(state, detail));
      }
      if (sub3.startsWith('tra') || sub3 === 'traffic') return makeResult(showIpEigrpTraffic(state));
      return makeResult(showIpEigrpNeighbors(state));
    }
    if (sub2.startsWith('bg') || sub2 === 'bgp') {
      const sub3 = (mainArgs[2] || '').toLowerCase();
      const sub4 = (mainArgs[3] || '').toLowerCase();
      const sub5 = (mainArgs[4] || '').toLowerCase();
      if (sub3.startsWith('sum') || sub3 === 'summary') return makeResult(showIpBgpSummaryFull(state));
      if (sub3.startsWith('nei') || sub3 === 'neighbors') {
        // sub4 might be an IP address or empty
        const isIp = /^\d+\.\d+\.\d+\.\d+$/.test(sub4);
        if (isIp) {
          const routeTypeArg = sub5 || (mainArgs[5] || '').toLowerCase();
          if (routeTypeArg === 'advertised-routes') return makeResult(showIpBgpNeighborRoutes(state, sub4, 'advertised-routes'));
          if (routeTypeArg === 'received-routes') return makeResult(showIpBgpNeighborRoutes(state, sub4, 'received-routes'));
          if (routeTypeArg === 'routes') return makeResult(showIpBgpNeighborRoutes(state, sub4, 'routes'));
          return makeResult(showIpBgpNeighborsDetail(state, sub4));
        }
        return makeResult(showIpBgpNeighborsDetail(state));
      }
      if (!sub3 || sub3 === '') return makeResult(showIpBgpTable(state));
      return makeResult(showIpBgpTable(state));
    }
    if (sub2.startsWith('acc') || sub2 === 'access-lists') return makeResult(showIpAccessLists(state));
    if (sub2 === 'dhcp') {
      const sub3 = (mainArgs[2] || '').toLowerCase();
      if (sub3 === 'snooping') {
        const sub4 = (mainArgs[3] || '').toLowerCase();
        if (sub4.startsWith('bin') || sub4 === 'binding') return makeResult(showIpDhcpSnoopingBinding(state));
        if (sub4.startsWith('stat') || sub4 === 'statistics') return makeResult(showIpDhcpSnoopingStatistics(state));
        // show ip dhcp snooping (no sub4)
        return makeResult(showIpDhcpSnooping(state));
      }
      if (sub3.startsWith('bin') || sub3 === 'binding') return makeResult(showIpDhcpBinding(state));
      if (sub3.startsWith('pool') || sub3 === 'pool') return makeResult(showIpDhcpPool(state));
      if (sub3.startsWith('con') || sub3 === 'conflict') return makeResult(showIpDhcpConflict(state));
      if (sub3.startsWith('ser') || sub3 === 'server') {
        const sub4 = (mainArgs[3] || '').toLowerCase();
        if (sub4.startsWith('stat') || sub4 === 'statistics') return makeResult(showIpDhcpServerStatistics(state));
        return makeResult(showIpDhcpServerStatistics(state));
      }
      return makeResult(showIpDhcpBinding(state));
    }
    if (sub2 === 'nat') {
      const sub3 = (mainArgs[2] || '').toLowerCase();
      if (sub3.startsWith('tran') || sub3 === 'translations') return makeResult(showIpNatTranslations(state));
      if (sub3.startsWith('stat') || sub3 === 'statistics') return makeResult(showIpNatStatistics(state));
      return makeResult(showIpNatTranslations(state));
    }
    if (sub2 === 'arp') {
      const sub3 = (mainArgs[2] || '').toLowerCase();
      if (sub3 === 'inspection') {
        const sub4 = (mainArgs[3] || '').toLowerCase();
        if (sub4.startsWith('int') || sub4 === 'interfaces') return makeResult(showIpArpInspectionInterfaces(state));
        return makeResult(showIpArpInspection(state));
      }
      return makeResult(showArp(state));
    }
    if (sub2 === 'verify') {
      const sub3 = (mainArgs[2] || '').toLowerCase();
      if (sub3.startsWith('sou') || sub3 === 'source') return makeResult(showIpVerifySource(state));
      return makeResult(showIpVerifySource(state));
    }
    if (sub2 === 'ssh') return makeResult(showIpSsh(state));
    if (sub2 === 'traffic') return makeResult(showIpTraffic(state));
    if (sub2 === 'cache') return makeResult(showIpCache(state));
    if (sub2 === 'sla') {
      const sub3 = (mainArgs[2] || '').toLowerCase();
      const sub4 = (mainArgs[3] || '').toLowerCase();
      if (sub3.startsWith('stat') || sub3 === 'statistics') {
        const idArg = parseInt(sub4 || '');
        return makeResult(showIpSlaStatistics(state, isNaN(idArg) ? undefined : idArg));
      }
      if (sub3.startsWith('sum') || sub3 === 'summary') {
        return makeResult(showIpSlaSummary(state));
      }
      if (sub3.startsWith('conf') || sub3 === 'configuration') {
        const idArg = parseInt(sub4 || '');
        return makeResult(showIpSlaConfiguration(state, isNaN(idArg) ? undefined : idArg));
      }
      // default: show by id or all statistics
      const idArg2 = parseInt(sub3 || '');
      if (!isNaN(idArg2)) return makeResult(showIpSlaStatistics(state, idArg2));
      return makeResult(showIpSlaStatistics(state));
    }
    if (sub2 === 'pim') {
      const sub3 = (mainArgs[2] || '').toLowerCase();
      if (sub3.startsWith('nei') || sub3 === 'neighbor') return makeResult(showIpPimNeighbor(state));
      if (sub3.startsWith('int') || sub3 === 'interface') return makeResult(showIpPimInterface(state));
      return makeResult(showIpPimNeighbor(state));
    }
    if (sub2 === 'mroute') return makeResult(showIpMroute(state));
    if (sub2 === 'igmp') {
      const sub3 = (mainArgs[2] || '').toLowerCase();
      if (sub3.startsWith('gro') || sub3 === 'groups') return makeResult(showIpIgmpGroups(state));
      if (sub3.startsWith('int') || sub3 === 'interface') return makeResult(showIpIgmpInterface(state));
      return makeResult(showIpIgmpGroups(state));
    }
    return { output: [out(`% Unrecognized show ip subcommand: ${sub2}`, 'error')] };
  }

  if (sub.startsWith('vlan')) {
    const brief = sub2.startsWith('bri');
    return makeResult(showVlan(state, brief));
  }

  if (sub === 'mac' || sub.startsWith('mac')) {
    const joinedMacArgs = mainArgs.map(a => a.toLowerCase()).join(' ');
    if (joinedMacArgs.includes('aging')) return makeResult(showMacAddressTableAgingTime(state));
    if (joinedMacArgs.includes('count')) return makeResult(showMacAddressTableCount(state));
    if (joinedMacArgs.includes('notif')) return makeResult(showMacAddressTableNotification(state));
    const dynamic = mainArgs.some(a => a.toLowerCase().startsWith('dyn'));
    return makeResult(showMacTable(state, dynamic));
  }

  if (sub === 'arp') return makeResult(showArp(state));

  if (sub.startsWith('span') || sub === 'spanning-tree') {
    // show spanning-tree summary
    if (sub2 === 'summary') {
      return makeResult(showSpanningTreeSummary(state));
    }
    // show spanning-tree detail
    if (sub2 === 'detail') {
      return makeResult(showSpanningTreeDetail(state));
    }
    // show spanning-tree mst configuration
    if (sub2 === 'mst') {
      const sub3 = (mainArgs[3] || '').toLowerCase();
      if (sub3 === 'configuration') {
        return makeResult(showSpanningTreeMstConfig(state));
      }
      return makeResult(showSpanningTreeMst(state));
    }
    // show spanning-tree inconsistentports
    if (sub2 === 'inconsistentports') {
      return makeResult(showSpanningTreeInconsistentPorts(state));
    }
    // show spanning-tree blockedports
    if (sub2 === 'blockedports') {
      return makeResult(showSpanningTreeBlockedPorts(state));
    }
    // show spanning-tree vlan <id>
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
    if (sub2.startsWith('int') || sub2 === 'interface') {
      const rest = mainArgs.slice(2).join('');
      if (!rest) return makeResult(showCdpInterface(state));
      const ifId = resolveInterface(rest, state);
      return makeResult(showCdpInterface(state, ifId || rest));
    }
    if (sub2.startsWith('tra') || sub2 === 'traffic') {
      return makeResult(showCdpTraffic(state));
    }
    if (!sub2) return makeResult(showCdpGlobal(state));
    return makeResult(showCdpNeighbors(state, false));
  }

  if (sub === 'ipv6') {
    if (sub2.startsWith('int') || sub2 === 'interface') {
      const sub3 = (mainArgs[2] || '').toLowerCase();
      if (sub3.startsWith('bri') || sub3 === 'brief' || !sub3) {
        if (sub3.startsWith('bri') || !mainArgs[2]) return makeResult(showIpv6InterfaceBrief(state));
        const rest = mainArgs.slice(2).join('');
        const ifId = resolveInterface(rest, state);
        if (!ifId) return { output: [out('% Invalid interface', 'error')] };
        return makeResult(showIpv6Interface(state, ifId));
      }
      const rest = mainArgs.slice(2).join('');
      const ifId = resolveInterface(rest, state);
      if (!ifId) return makeResult(showIpv6InterfaceBrief(state));
      return makeResult(showIpv6Interface(state, ifId));
    }
    if (sub2.startsWith('ro') || sub2 === 'route') return makeResult(showIpv6Route(state));
    if (sub2.startsWith('nei') || sub2 === 'neighbors') return makeResult(showIpv6Neighbors(state));
    return makeResult(showIpv6InterfaceBrief(state));
  }

  if (sub === 'lldp') {
    if (sub2.startsWith('nei') || sub2 === 'neighbors') {
      const sub3 = (mainArgs[2] || '').toLowerCase();
      const detail = sub3.startsWith('det');
      return makeResult(showLldpNeighbors(state, detail));
    }
    if (sub2.startsWith('int') || sub2 === 'interface') {
      const rest = mainArgs.slice(2).join('');
      if (!rest) return makeResult(showLldpInterface(state));
      const ifId = resolveInterface(rest, state);
      return makeResult(showLldpInterface(state, ifId || undefined));
    }
    // show lldp (no sub) = global info
    return makeResult(showLldp(state));
  }

  if (sub.startsWith('proc') || sub === 'processes') return makeResult(showProcessesCpu(state));
  if (sub.startsWith('mem') || sub === 'memory') return makeResult(showMemory(state));
  if (sub.startsWith('fla') || sub === 'flash') return makeResult(showFlash(state));
  if (sub.startsWith('clo') || sub === 'clock') return makeResult(showClock(state));

  if (sub.startsWith('log') || sub === 'logging') return makeResult(showLogging(state));

  if (sub === 'ntp') {
    if (sub2.startsWith('sta') || sub2 === 'status') return makeResult(showNtpStatus(state));
    if (sub2.startsWith('ass') || sub2 === 'associations') {
      const sub3 = (mainArgs[2] || '').toLowerCase();
      if (sub3.startsWith('det') || sub3 === 'detail') return makeResult(showNtpAssociationsDetail(state));
      return makeResult(showNtpAssociations(state));
    }
    return makeResult(showNtpStatus(state));
  }

  if (sub === 'mls') {
    const mlsShowSub = (mainArgs[1] || '').toLowerCase();
    if (mlsShowSub === 'qos') {
      const mlsShowSub2 = (mainArgs[2] || '').toLowerCase();
      if (mlsShowSub2.startsWith('int') || mlsShowSub2 === 'interface') {
        const rest = mainArgs.slice(3).join('');
        if (!rest) return makeResult(showMlsQosInterface(state));
        const ifId = resolveInterface(rest, state);
        if (!ifId) return { output: [out('% Invalid interface specified', 'error')] };
        return makeResult(showMlsQosInterface(state, ifId));
      }
      return makeResult(showMlsQos(state));
    }
    return makeResult(showMlsQos(state));
  }

  if (sub === 'class-map') {
    const cmShowName = mainArgs[1] || '';
    return makeResult(showClassMap(state, cmShowName || undefined));
  }

  if (sub === 'policy-map') {
    const pmShowSub2 = (mainArgs[1] || '').toLowerCase();
    if (pmShowSub2.startsWith('int') || pmShowSub2 === 'interface') {
      const rest = mainArgs.slice(2).join('');
      if (!rest) return { output: [out('% Incomplete command.', 'error')] };
      const ifId = resolveInterface(rest, state);
      if (!ifId) return { output: [out('% Invalid interface specified', 'error')] };
      return makeResult(showPolicyMapInterface(state, ifId));
    }
    return makeResult(showPolicyMap(state, mainArgs[1] || undefined));
  }

  if (sub === 'monitor') {
    const monShowSub = (mainArgs[1] || '').toLowerCase();
    if (monShowSub === 'session') {
      const sid = parseInt(mainArgs[2] || '');
      return makeResult(showMonitorSession(state, isNaN(sid) ? undefined : sid));
    }
    return makeResult(showMonitorSession(state));
  }

  if (sub === 'standby') {
    if (sub2.startsWith('bri') || sub2 === 'brief') return makeResult(showStandbyBrief(state));
    return makeResult(showStandbyDetail(state));
  }

  if (sub === 'vtp') {
    if (sub2.startsWith('sta') || sub2 === 'status') return makeResult(showVtpStatus(state));
    if (sub2.startsWith('cou') || sub2 === 'counters') return makeResult(showVtpCounters(state));
    if (sub2.startsWith('pas') || sub2 === 'password') return makeResult(showVtpPassword(state));
    return makeResult(showVtpStatus(state));
  }

  if (sub === 'snmp') {
    if (sub2.startsWith('com') || sub2 === 'community') return makeResult(showSnmpCommunity(state));
    return makeResult(showSnmp(state));
  }

  if (sub.startsWith('ether') || sub === 'etherchannel') return makeResult(showEtherchannelSummary(state));

  if (sub.startsWith('port') || sub === 'port-security') {
    if (sub2.startsWith('int') || sub2 === 'interface') {
      const rest = mainArgs.slice(2).join('');
      if (!rest) return makeResult(showPortSecurity(state));
      const ifId = resolveInterface(rest, state);
      if (!ifId) return { output: [out('% Invalid interface specified', 'error')] };
      return makeResult(showPortSecurityInterface(state, ifId));
    }
    if (sub2.startsWith('add') || sub2 === 'address') {
      return makeResult(showPortSecurityAddress(state));
    }
    return makeResult(showPortSecurity(state));
  }

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

  if (sub === 'tech-support' || sub === 'tech') {
    return makeResult(showTechSupport(state));
  }

  if (sub === 'platform') {
    const sub2lower = sub2.toLowerCase();
    if (sub2lower === 'tcam') return makeResult(showPlatformTcam(state));
    return makeResult(showPlatform(state));
  }

  if (sub.startsWith('cont') || sub === 'controllers') {
    return makeResult(showControllers(state));
  }

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


  // show aaa
  if (sub === 'aaa') {
    const sub3 = (mainArgs[2] || '').toLowerCase();
    if (sub2 === 'local' && sub3.startsWith('user')) {
      return makeResult(['There are no locked users']);
    }
    const servers = sub2 === 'servers';
    return makeResult(showAaa(state, servers));
  }

  // show storm-control
  if (sub === 'storm-control') {
    const ifArg = mainArgs[1] || '';
    return makeResult(showStormControl(state, ifArg || undefined));
  }

  // show crypto
  if (sub === 'crypto') {
    const sub3 = (mainArgs[2] || '').toLowerCase();
    if (sub2 === 'key' && sub3 === 'mypubkey') {
      return makeResult(showCryptoKeyMypubkeyRsa(state));
    }
    if (sub2 === 'pki' && sub3 === 'certificates') {
      return makeResult(showCryptoPkiCertificates(state));
    }
    return makeResult(showCryptoKeyMypubkeyRsa(state));
  }

  if (sub === 'errdisable') {
    if (sub2 === 'detect') return makeResult(showErrdisableDetect(state));
    return makeResult(showErrdisableRecovery(state));
  }

  // show dot1x [all | interface <id> | statistics interface <id>]
  if (sub === 'dot1x') {
    if (sub2 === 'all') {
      return makeResult(showDot1xAll(state));
    }
    if (sub2 === 'statistics') {
      const sub3 = (mainArgs[2] || '').toLowerCase();
      if (sub3.startsWith('int') || sub3 === 'interface') {
        const rest = mainArgs.slice(3).join('');
        const ifId = rest ? resolveInterface(rest, state) : null;
        return makeResult(showDot1xStatisticsInterface(ifId || 'Fa0/1'));
      }
      return makeResult(showDot1xStatisticsInterface('Fa0/1'));
    }
    if (sub2.startsWith('int') || sub2 === 'interface') {
      const rest = mainArgs.slice(2).join('');
      const ifId = rest ? resolveInterface(rest, state) : null;
      if (!ifId) return { output: [out('% Invalid interface specified', 'error')] };
      return makeResult(showDot1xInterface(ifId));
    }
    // show dot1x (no sub) = global summary
    if (!sub2) return makeResult(showDot1x(state));
    return makeResult(showDot1x(state));
  }

  // show authentication sessions [interface <id>]
  if (sub === 'authentication') {
    if (sub2.startsWith('ses') || sub2 === 'sessions') {
      const sub3 = (mainArgs[2] || '').toLowerCase();
      if (sub3.startsWith('int') || sub3 === 'interface') {
        const rest = mainArgs.slice(3).join('');
        const ifId = rest ? resolveInterface(rest, state) : null;
        if (!ifId) return { output: [out('% Invalid interface specified', 'error')] };
        return makeResult(showAuthenticationSessionsInterface(ifId));
      }
      return makeResult(showAuthenticationSessions(state));
    }
    return makeResult(showAuthenticationSessions(state));
  }

  // show vrrp [brief]
  if (sub === 'vrrp') {
    if (sub2 === 'brief') return makeResult(showVrrpBrief(state));
    return makeResult(showVrrp(state));
  }

  // show power inline [interface <id>]
  if (sub === 'power') {
    if (sub2 === 'inline') {
      const sub3 = (mainArgs[2] || '').toLowerCase();
      if (sub3.startsWith('int') || sub3 === 'interface') {
        const rest = mainArgs.slice(3).join('');
        const ifId = rest ? resolveInterface(rest, state) : null;
        if (!ifId) return { output: [out('% Invalid interface specified', 'error')] };
        return makeResult(showPowerInlineInterface(ifId));
      }
      return makeResult(showPowerInline(state));
    }
    return makeResult(showPowerInline(state));
  }

  return {
    output: [out(`% Unknown 'show ${args.join(' ')}' command`, 'error')]
  };
};

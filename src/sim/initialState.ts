import type {
  DeviceState, Interface, Vlan, MacEntry, ArpEntry, Route,
  SpanningTreeVlan, CdpNeighbor, LldpNeighbor, LineConfig, NtpConfig,
  SpanningTreePortConfig, PortSecurity, DhcpPool, DhcpBinding,
  NatConfig, HsrpGroup, VtpConfig, SnmpConfig, AaaConfig, IpSlaEntry, IpSlaSchedule,
  DhcpSnoopingConfig, DaiConfig, IpSourceGuardBinding
} from './types';

function defaultStp(role: SpanningTreePortConfig['role'] = 'designated', state: SpanningTreePortConfig['state'] = 'forwarding'): SpanningTreePortConfig {
  return {
    portfast: false, bpduguard: false, bpdufilter: false,
    state, role
  };
}

function defaultPortSec(): PortSecurity {
  return {
    enabled: false, maxMacAddresses: 1,
    violation: 'shutdown', stickyLearning: false, learnedAddresses: []
  };
}

function makeFa(port: number, opts: Partial<Interface> = {}): Interface {
  const mac = `0019.e8a2.${(0x3c00 + port).toString(16).padStart(4, '0')}`;
  return {
    id: `Fa0/${port}`,
    slot: 0, port,
    description: '',
    adminState: 'up',
    lineState: 'notconnect',
    ipAddresses: [],
    ipv6Addresses: [],
    ipv6Enabled: false,
    macAddress: mac,
    duplex: 'auto', speed: 'auto', mtu: 1500,
    switchportMode: 'access',
    accessVlan: 1, trunkAllowedVlans: '1-4094', trunkNativeVlan: 1,
    spanningTree: defaultStp(),
    portSecurity: defaultPortSec(),
    ipHelperAddresses: [],
    ipAccessGroups: [],
    inputPackets: 0, outputPackets: 0,
    inputErrors: 0, outputErrors: 0,
    inputBytes: 0, outputBytes: 0,
    lastClear: Date.now(),
    cdpEnabled: true,
    ...opts
  };
}

function makeGi(port: number, opts: Partial<Interface> = {}): Interface {
  const mac = `0019.e8a2.${(0x3c18 + port).toString(16).padStart(4, '0')}`;
  return {
    id: `Gi0/${port}`,
    slot: 0, port,
    description: '',
    adminState: 'up',
    lineState: 'notconnect',
    ipAddresses: [],
    ipv6Addresses: [],
    ipv6Enabled: false,
    macAddress: mac,
    duplex: 'full', speed: '1000', mtu: 1500,
    switchportMode: 'access',
    accessVlan: 1, trunkAllowedVlans: '1-4094', trunkNativeVlan: 1,
    spanningTree: defaultStp(),
    portSecurity: defaultPortSec(),
    ipHelperAddresses: [],
    ipAccessGroups: [],
    inputPackets: 0, outputPackets: 0,
    inputErrors: 0, outputErrors: 0,
    inputBytes: 0, outputBytes: 0,
    lastClear: Date.now(),
    cdpEnabled: true,
    ...opts
  };
}

export function createInitialState(savedConfig?: Partial<DeviceState> | null): DeviceState {
  const now = Date.now();
  const bootTime = now - 3600000 * 2; // 2 hours ago

  const interfaces: Record<string, Interface> = {};

  // FastEthernet 0/1-24
  for (let p = 1; p <= 24; p++) {
    let vlan = 1;
    if (p >= 1 && p <= 8) vlan = 10;
    if (p >= 9 && p <= 16) vlan = 20;
    if (p >= 17 && p <= 24) vlan = 99;

    let lineState: Interface['lineState'] = 'notconnect';
    let desc = '';
    let inputPackets = 0, outputPackets = 0, inputBytes = 0, outputBytes = 0;

    if (p === 1) { lineState = 'up'; desc = 'Office-PC-01'; inputPackets = 142983; outputPackets = 201847; inputBytes = 18621894; outputBytes = 26240110; }
    if (p === 3) { lineState = 'up'; desc = 'Office-PC-03'; inputPackets = 98234; outputPackets = 134521; inputBytes = 12762420; outputBytes = 17488230; }
    if (p === 5) { lineState = 'up'; desc = 'AP-FLOOR2'; inputPackets = 534921; outputPackets = 712384; inputBytes = 69540730; outputBytes = 92609920; }
    if (p === 7) { lineState = 'err-disabled'; desc = 'Port-Security-Violation'; }

    interfaces[`Fa0/${p}`] = makeFa(p, {
      lineState,
      description: desc,
      accessVlan: vlan,
      inputPackets, outputPackets, inputBytes, outputBytes,
      spanningTree: {
        portfast: vlan === 10 || vlan === 20,
        bpduguard: vlan === 10 || vlan === 20,
        bpdufilter: false,
        state: lineState === 'up' ? 'forwarding' : lineState === 'err-disabled' ? 'disabled' : 'disabled',
        role: lineState === 'up' ? 'designated' : 'disabled'
      },
      portSecurity: p === 7 ? {
        enabled: true, maxMacAddresses: 1,
        violation: 'shutdown', stickyLearning: true,
        learnedAddresses: ['0050.56a2.1234']
      } : defaultPortSec()
    });
  }

  // GigabitEthernet uplinks
  interfaces['Gi0/1'] = makeGi(1, {
    description: 'Uplink-to-CORE-SW1',
    lineState: 'up',
    switchportMode: 'trunk',
    trunkAllowedVlans: '1,10,20,30,99',
    trunkNativeVlan: 99,
    inputPackets: 2841923, outputPackets: 3102847, inputBytes: 369450000, outputBytes: 403370110,
    spanningTree: { portfast: false, bpduguard: false, bpdufilter: false, state: 'forwarding', role: 'designated' }
  });
  interfaces['Gi0/2'] = makeGi(2, {
    description: 'Uplink-to-CORE-SW2',
    lineState: 'up',
    switchportMode: 'trunk',
    trunkAllowedVlans: '1,10,20,30,99',
    trunkNativeVlan: 99,
    inputPackets: 1923841, outputPackets: 2018293, inputBytes: 250099320, outputBytes: 262075810,
    spanningTree: { portfast: false, bpduguard: false, bpdufilter: false, state: 'forwarding', role: 'root' }
  });

  // Loopback0
  interfaces['Loopback0'] = {
    id: 'Loopback0', slot: 0, port: 0,
    description: 'Router-ID-Loopback',
    adminState: 'up', lineState: 'up',
    ipAddresses: [{ address: '1.1.1.1', mask: '255.255.255.255' }],
    ipv6Addresses: [{ address: '2001:db8::1', prefixLength: 128, type: 'manual' as const }],
    ipv6Enabled: true,
    macAddress: '0019.e8a2.3c00',
    duplex: 'full', speed: 'auto', mtu: 1514,
    switchportMode: 'access',
    accessVlan: 1, trunkAllowedVlans: '1-4094', trunkNativeVlan: 1,
    spanningTree: defaultStp(),
    portSecurity: defaultPortSec(),
    ipHelperAddresses: [], ipAccessGroups: [],
    inputPackets: 5234, outputPackets: 5234, inputErrors: 0, outputErrors: 0,
    inputBytes: 418720, outputBytes: 418720, lastClear: bootTime,
    cdpEnabled: true,
  };

  // VLAN SVIs
  interfaces['Vlan1'] = {
    id: 'Vlan1', slot: 0, port: 0,
    description: 'Management-VLAN',
    adminState: 'up', lineState: 'up',
    ipAddresses: [{ address: '192.168.1.1', mask: '255.255.255.0' }],
    ipv6Addresses: [], ipv6Enabled: false,
    macAddress: '0019.e8a2.3c0a',
    duplex: 'full', speed: 'auto', mtu: 1500,
    switchportMode: 'access',
    accessVlan: 1, trunkAllowedVlans: '1-4094', trunkNativeVlan: 1,
    spanningTree: defaultStp(),
    portSecurity: defaultPortSec(),
    ipHelperAddresses: [], ipAccessGroups: [],
    inputPackets: 48291, outputPackets: 52104, inputErrors: 0, outputErrors: 0,
    inputBytes: 6278830, outputBytes: 6773520, lastClear: bootTime,
    cdpEnabled: true,
  };
  interfaces['Vlan10'] = {
    id: 'Vlan10', slot: 0, port: 0,
    description: 'DATA-VLAN-SVI',
    adminState: 'up', lineState: 'up',
    ipAddresses: [{ address: '10.10.10.1', mask: '255.255.255.0' }],
    ipv6Addresses: [], ipv6Enabled: false,
    macAddress: '0019.e8a2.3c0b',
    duplex: 'full', speed: 'auto', mtu: 1500,
    switchportMode: 'access',
    accessVlan: 10, trunkAllowedVlans: '1-4094', trunkNativeVlan: 1,
    spanningTree: defaultStp(),
    portSecurity: defaultPortSec(),
    ipHelperAddresses: ['192.168.1.254'], ipAccessGroups: [],
    inputPackets: 234891, outputPackets: 287432, inputErrors: 0, outputErrors: 0,
    inputBytes: 30535830, outputBytes: 37366160, lastClear: bootTime,
    cdpEnabled: true,
  };
  interfaces['Vlan20'] = {
    id: 'Vlan20', slot: 0, port: 0,
    description: 'VOICE-VLAN-SVI',
    adminState: 'up', lineState: 'up',
    ipAddresses: [{ address: '10.20.20.1', mask: '255.255.255.0' }],
    ipv6Addresses: [], ipv6Enabled: false,
    macAddress: '0019.e8a2.3c0c',
    duplex: 'full', speed: 'auto', mtu: 1500,
    switchportMode: 'access',
    accessVlan: 20, trunkAllowedVlans: '1-4094', trunkNativeVlan: 1,
    spanningTree: defaultStp(),
    portSecurity: defaultPortSec(),
    ipHelperAddresses: ['192.168.1.254'], ipAccessGroups: [],
    inputPackets: 128492, outputPackets: 143821, inputErrors: 0, outputErrors: 0,
    inputBytes: 16703960, outputBytes: 18696730, lastClear: bootTime,
    cdpEnabled: true,
  };
  interfaces['Vlan30'] = {
    id: 'Vlan30', slot: 0, port: 0,
    description: 'MGMT-VLAN-SVI',
    adminState: 'up', lineState: 'up',
    ipAddresses: [{ address: '10.30.30.1', mask: '255.255.255.0' }],
    ipv6Addresses: [], ipv6Enabled: false,
    macAddress: '0019.e8a2.3c0d',
    duplex: 'full', speed: 'auto', mtu: 1500,
    switchportMode: 'access',
    accessVlan: 30, trunkAllowedVlans: '1-4094', trunkNativeVlan: 1,
    spanningTree: defaultStp(),
    portSecurity: defaultPortSec(),
    ipHelperAddresses: [], ipAccessGroups: [],
    inputPackets: 34821, outputPackets: 38294, inputErrors: 0, outputErrors: 0,
    inputBytes: 4526730, outputBytes: 4978220, lastClear: bootTime,
    cdpEnabled: true,
  };

  const vlans: Record<number, Vlan> = {
    1: {
      id: 1, name: 'default', state: 'active',
      ports: []
    },
    10: {
      id: 10, name: 'DATA', state: 'active',
      ports: ['Fa0/1','Fa0/2','Fa0/3','Fa0/4','Fa0/5','Fa0/6','Fa0/7','Fa0/8']
    },
    20: {
      id: 20, name: 'VOICE', state: 'active',
      ports: ['Fa0/9','Fa0/10','Fa0/11','Fa0/12','Fa0/13','Fa0/14','Fa0/15','Fa0/16']
    },
    30: {
      id: 30, name: 'MGMT', state: 'active',
      ports: []
    },
    99: {
      id: 99, name: 'NATIVE', state: 'active',
      ports: ['Fa0/17','Fa0/18','Fa0/19','Fa0/20','Fa0/21','Fa0/22','Fa0/23','Fa0/24']
    }
  };

  const macTable: MacEntry[] = [
    { vlan: 10, mac: '0050.56a2.1001', type: 'dynamic', port: 'Fa0/1', age: 120 },
    { vlan: 10, mac: '0050.56a2.1002', type: 'dynamic', port: 'Fa0/1', age: 95 },
    { vlan: 10, mac: '0050.56a2.1003', type: 'dynamic', port: 'Fa0/3', age: 200 },
    { vlan: 10, mac: '0050.56a2.1004', type: 'dynamic', port: 'Fa0/3', age: 45 },
    { vlan: 10, mac: '0050.56a2.2001', type: 'dynamic', port: 'Gi0/1', age: 30 },
    { vlan: 10, mac: '0050.56a2.2002', type: 'dynamic', port: 'Gi0/1', age: 60 },
    { vlan: 20, mac: '0050.56a2.3001', type: 'dynamic', port: 'Fa0/5', age: 15 },
    { vlan: 20, mac: '0050.56a2.3002', type: 'dynamic', port: 'Fa0/5', age: 180 },
    { vlan: 20, mac: '0050.56a2.3003', type: 'dynamic', port: 'Fa0/5', age: 240 },
    { vlan: 20, mac: '0050.56a2.3004', type: 'dynamic', port: 'Gi0/1', age: 75 },
    { vlan: 30, mac: '0050.56a2.4001', type: 'dynamic', port: 'Gi0/1', age: 300 },
    { vlan: 30, mac: '0050.56a2.4002', type: 'dynamic', port: 'Gi0/2', age: 150 },
    { vlan: 1,  mac: '0019.e8a2.3c0a', type: 'static',  port: 'Vlan1', age: 0 },
    { vlan: 10, mac: '0019.e8a2.3c0b', type: 'static',  port: 'Vlan10', age: 0 },
    { vlan: 20, mac: '0019.e8a2.3c0c', type: 'static',  port: 'Vlan20', age: 0 },
    { vlan: 30, mac: '0019.e8a2.3c0d', type: 'static',  port: 'Vlan30', age: 0 },
    { vlan: 10, mac: '001b.d4a2.5501', type: 'dynamic', port: 'Gi0/2', age: 210 },
    { vlan: 20, mac: '001b.d4a2.5502', type: 'dynamic', port: 'Gi0/2', age: 90 },
    { vlan: 10, mac: '0050.56a2.1005', type: 'dynamic', port: 'Gi0/1', age: 130 },
    { vlan: 10, mac: '0050.56a2.1234', type: 'secure-static', port: 'Fa0/7', age: 0 },
  ];

  const arpTable: ArpEntry[] = [
    { address: '192.168.1.254', age: 0,   mac: '001b.d4a2.ff01', type: 'ARPA', interface: 'Vlan1' },
    { address: '192.168.1.100', age: 45,  mac: '0050.56a2.1001', type: 'ARPA', interface: 'Vlan1' },
    { address: '192.168.1.101', age: 120, mac: '0050.56a2.1002', type: 'ARPA', interface: 'Vlan1' },
    { address: '10.10.10.10',   age: 30,  mac: '0050.56a2.1003', type: 'ARPA', interface: 'Vlan10' },
    { address: '10.10.10.11',   age: 200, mac: '0050.56a2.1004', type: 'ARPA', interface: 'Vlan10' },
    { address: '10.10.10.20',   age: 75,  mac: '0050.56a2.2001', type: 'ARPA', interface: 'Vlan10' },
    { address: '10.20.20.10',   age: 15,  mac: '0050.56a2.3001', type: 'ARPA', interface: 'Vlan20' },
    { address: '10.20.20.11',   age: 60,  mac: '0050.56a2.3002', type: 'ARPA', interface: 'Vlan20' },
  ];

  const routes: Route[] = [
    { source: 'S', network: '0.0.0.0',    mask: '0.0.0.0',         adminDistance: 1,  metric: 0,   nextHop: '192.168.1.254', age: '2d03h' },
    { source: 'C', network: '1.1.1.1',    mask: '255.255.255.255',  adminDistance: 0,  metric: 0,   interface: 'Loopback0', age: '2d03h' },
    { source: 'L', network: '1.1.1.1',    mask: '255.255.255.255',  adminDistance: 0,  metric: 0,   interface: 'Loopback0', age: '2d03h' },
    { source: 'C', network: '10.10.10.0', mask: '255.255.255.0',    adminDistance: 0,  metric: 0,   interface: 'Vlan10', age: '2d03h' },
    { source: 'L', network: '10.10.10.1', mask: '255.255.255.255',  adminDistance: 0,  metric: 0,   interface: 'Vlan10', age: '2d03h' },
    { source: 'C', network: '10.20.20.0', mask: '255.255.255.0',    adminDistance: 0,  metric: 0,   interface: 'Vlan20', age: '2d03h' },
    { source: 'L', network: '10.20.20.1', mask: '255.255.255.255',  adminDistance: 0,  metric: 0,   interface: 'Vlan20', age: '2d03h' },
    { source: 'O', network: '10.30.30.0', mask: '255.255.255.0',    adminDistance: 110, metric: 2,  nextHop: '192.168.1.254', interface: 'Vlan1', age: '1d12h' },
    { source: 'C', network: '192.168.1.0', mask: '255.255.255.0',   adminDistance: 0,  metric: 0,   interface: 'Vlan1', age: '2d03h' },
    { source: 'L', network: '192.168.1.1', mask: '255.255.255.255', adminDistance: 0,  metric: 0,   interface: 'Vlan1', age: '2d03h' },
  ];

  const spanningTree: Record<number, SpanningTreeVlan> = {
    1: {
      vlanId: 1, rootBridgePriority: 32769, rootBridgeMac: '0019.e8a2.3c00',
      rootBridgeIsLocal: true, localBridgePriority: 32769, localBridgeMac: '0019.e8a2.3c00',
      rootCost: 0, helloTime: 2, forwardDelay: 15, maxAge: 20
    },
    10: {
      vlanId: 10, rootBridgePriority: 24586, rootBridgeMac: '0019.e8a2.3c00',
      rootBridgeIsLocal: true, localBridgePriority: 24586, localBridgeMac: '0019.e8a2.3c00',
      rootCost: 0, helloTime: 2, forwardDelay: 15, maxAge: 20
    },
    20: {
      vlanId: 20, rootBridgePriority: 28692, rootBridgeMac: '0019.e8a2.3c00',
      rootBridgeIsLocal: true, localBridgePriority: 28692, localBridgeMac: '0019.e8a2.3c00',
      rootCost: 0, helloTime: 2, forwardDelay: 15, maxAge: 20
    },
    30: {
      vlanId: 30, rootBridgePriority: 24606, rootBridgeMac: '001b.d4a2.ff01',
      rootBridgeIsLocal: false, localBridgePriority: 28702, localBridgeMac: '0019.e8a2.3c00',
      rootPort: 'Gi0/1', rootCost: 4, helloTime: 2, forwardDelay: 15, maxAge: 20
    }
  };

  const cdpNeighbors: CdpNeighbor[] = [
    {
      deviceId: 'CORE-SW1', localInterface: 'Gi0/1', holdtime: 158,
      capability: 'R S I', platform: 'WS-C3850', remoteInterface: 'Gig 1/0/24',
      ipAddress: '192.168.1.254', iosVersion: '16.9.5', nativeVlan: 99, duplex: 'full'
    },
    {
      deviceId: 'CORE-SW2', localInterface: 'Gi0/2', holdtime: 145,
      capability: 'R S I', platform: 'WS-C3850', remoteInterface: 'Gig 1/0/24',
      ipAddress: '192.168.1.253', iosVersion: '16.9.5', nativeVlan: 99, duplex: 'full'
    },
    {
      deviceId: 'AP-FLOOR2', localInterface: 'Fa0/5', holdtime: 124,
      capability: 'T', platform: 'AIR-CAP3702I', remoteInterface: 'Fas 0',
      ipAddress: '10.20.20.50', iosVersion: '8.8.125.0', nativeVlan: 20, duplex: 'full'
    }
  ];

  const lldpNeighbors: LldpNeighbor[] = [
    {
      deviceId: 'CORE-SW1', localInterface: 'Gi0/1', holdtime: 120,
      capability: 'R, B', systemName: 'CORE-SW1', portId: 'Gi1/0/24',
      portDescription: 'GigabitEthernet1/0/24',
      systemDescription: 'Cisco IOS Software, Catalyst 3850',
      managementAddress: '192.168.1.254'
    },
    {
      deviceId: 'CORE-SW2', localInterface: 'Gi0/2', holdtime: 120,
      capability: 'R, B', systemName: 'CORE-SW2', portId: 'Gi1/0/24',
      portDescription: 'GigabitEthernet1/0/24',
      systemDescription: 'Cisco IOS Software, Catalyst 3850',
      managementAddress: '192.168.1.253'
    },
    {
      deviceId: 'AP-FLOOR2', localInterface: 'Fa0/5', holdtime: 120,
      capability: 'W', systemName: 'AP-FLOOR2', portId: 'Fa0',
      portDescription: 'FastEthernet0',
      systemDescription: 'Cisco Aironet Access Point',
      managementAddress: '10.20.20.50'
    }
  ];

  const lines: LineConfig[] = [
    {
      line: 'console', start: 0, end: 0,
      login: 'local', execTimeout: 600,
      transportInput: ['all'], loggingSynchronous: true, privilegeLevel: 15
    },
    {
      line: 'vty', start: 0, end: 4,
      login: 'local', execTimeout: 600,
      transportInput: ['ssh', 'telnet'], loggingSynchronous: false, privilegeLevel: 15
    },
    {
      line: 'vty', start: 5, end: 15,
      login: 'local', execTimeout: 300,
      transportInput: ['ssh'], loggingSynchronous: false, privilegeLevel: 15
    }
  ];

  const ntp: NtpConfig = {
    servers: ['192.168.1.254'],
    synchronized: true,
    referenceServer: '192.168.1.254',
    stratum: 3, offset: 0.5
  };

  const dhcpPools: DhcpPool[] = [
    { name: 'DATA_POOL', network: '10.10.10.0', mask: '255.255.255.0', defaultRouter: '10.10.10.1', dnsServer: '8.8.8.8', domainName: 'corp.local', leaseTime: 24, excludedAddresses: [] },
    { name: 'VOICE_POOL', network: '10.20.20.0', mask: '255.255.255.0', defaultRouter: '10.20.20.1', dnsServer: '8.8.8.8', domainName: 'corp.local', leaseTime: 24, excludedAddresses: [] },
  ];

  const dhcpBindings: DhcpBinding[] = [
    { ip: '10.10.10.100', mac: '001a.2b3c.4d5e', leaseExpiry: 'Mar 21 2026 12:00 AM', type: 'Automatic', state: 'Active', interface: 'Vlan10' },
    { ip: '10.10.10.101', mac: '001a.2b3c.4d5f', leaseExpiry: 'Mar 21 2026 12:00 AM', type: 'Automatic', state: 'Active', interface: 'Vlan10' },
    { ip: '10.20.20.100', mac: '001a.2b3c.4d60', leaseExpiry: 'Mar 21 2026 12:00 AM', type: 'Automatic', state: 'Active', interface: 'Vlan20' },
  ];

  const natConfig: NatConfig = {
    insideInterfaces: ['Vlan10', 'Vlan20'],
    outsideInterfaces: ['GigabitEthernet0/1'],
    pools: [
      { name: 'NAT_POOL', startIp: '203.0.113.10', endIp: '203.0.113.20', prefix: 24 },
    ],
    staticMappings: [
      { localIp: '10.10.10.100', globalIp: '203.0.113.10' },
      { localIp: '10.10.10.101', globalIp: '203.0.113.11' },
    ],
    overload: true,
    accessList: '10',
  };

  const hsrpGroups: HsrpGroup[] = [
    { interfaceId: 'Vlan1', groupNumber: 1, virtualIp: '192.168.1.254', priority: 110, preempt: true, state: 'Active', activeRouter: '192.168.1.1', standbyRouter: '192.168.1.2', helloTime: 3, holdTime: 10 },
  ];

  const base: DeviceState = {
    hostname: 'SW1',
    domainName: 'corp.local',
    banner: 'Authorized access only. All access is logged and monitored.',
    mode: 'user-exec',
    modeContext: { type: 'none' },
    interfaces,
    vlans,
    macTable,
    spanningTree,
    arpTable,
    routes,
    ipRoutingEnabled: true,
    defaultGateway: '192.168.1.254',
    ospf: {
      processId: 1, routerId: '1.1.1.1',
      networks: [
        { network: '10.10.10.0', wildcard: '0.0.0.255', area: 0 },
        { network: '10.20.20.0', wildcard: '0.0.0.255', area: 0 },
        { network: '192.168.1.0', wildcard: '0.0.0.255', area: 0 },
      ],
      redistributeConnected: false, redistributeStatic: false,
      defaultInformationOriginate: false,
      passiveInterfaces: ['Vlan10', 'Vlan20'],
      neighbors: [
        {
          neighborId: '2.2.2.2', priority: 1, state: 'FULL',
          deadTime: '00:00:38', address: '192.168.1.254', interface: 'Vlan1'
        }
      ]
    },
    enableSecret: 'cisco123',
    servicePasswordEncryption: false,
    users: [
      { username: 'admin', privilege: 15, secret: 'admin123' },
      { username: 'readonly', privilege: 1, password: 'view' }
    ],
    acls: {},
    lines,
    cdpEnabled: true,
    cdpNeighbors,
    lldpEnabled: true,
    lldpNeighbors,
    ipv6RoutingEnabled: false,
    ipv6Routes: [],
    ntp,
    loggingEnabled: true,
    loggingServer: '192.168.1.200',
    loggingBuffer: [],
    syslogLevel: 6,
    unsavedChanges: false,
    bootTime,
    currentTime: now,
    activeDebugs: [],
    terminalLength: 24,
    terminalWidth: 80,
    dhcpPools,
    dhcpBindings,
    dhcpExcludedAddresses: [
      { start: '10.10.10.1', end: '10.10.10.10' },
      { start: '10.20.20.1', end: '10.20.20.10' },
    ],
    dhcpEnabled: true,
    natConfig,
    natTranslations: [
      { inside: '10.10.10.100', outside: '---', insideGlobal: '203.0.113.10', outsideGlobal: '---', type: 'static', age: '' },
      { inside: '10.10.10.101', outside: '---', insideGlobal: '203.0.113.11', outsideGlobal: '---', type: 'static', age: '' },
      { inside: '10.10.10.100', outside: '8.8.8.8', insideGlobal: '203.0.113.10:1024', outsideGlobal: '8.8.8.8:1024', type: 'pat', protocol: 'icmp', insidePort: 1024, outsidePort: 1024, age: '00:01:00' },
    ],
    hsrpGroups,
    vtp: {
      domain: 'CORP',
      mode: 'server',
      version: 2,
      pruningEnabled: false,
      configRevision: 14,
      updatedBy: 'admin@192.168.1.1',
      updatedAt: '12:35:01 UTC Fri Mar 20 2026',
    },
    snmp: {
      communities: [
        { name: 'public', access: 'ro' },
        { name: 'private', access: 'rw' },
      ],
      location: 'Server Room A, Rack 3',
      contact: 'netadmin@corp.local',
      trapHosts: [{ ip: '192.168.1.200', community: 'public', version: '2c' as const }],
      enabled: true,
    },
    cdpTimer: 60,
    cdpHoldtime: 180,
    qosEnabled: false,
    classMaps: [],
    policyMaps: [],
    spanSessions: [],
    portChannels: [],
    aaa: {
      newModel: false,
      authenticationLists: [],
      authorizationLists: [],
      accountingLists: [],
      radiusServers: [],
      tacacsServers: [],
    },
    ipSla: [
      { id: 1, type: 'icmp-echo' as const, target: '192.168.1.254', frequency: 60, timeout: 5000, threshold: 3000, tag: 'UPLINK-CHECK',
        history: [
          { roundTripTime: 2, success: true, timestamp: '15:29:01.123 UTC' },
          { roundTripTime: 3, success: true, timestamp: '15:30:01.123 UTC' },
          { roundTripTime: 2, success: true, timestamp: '15:31:01.123 UTC' },
        ]
      },
      { id: 2, type: 'icmp-echo' as const, target: '8.8.8.8', frequency: 60, timeout: 5000, threshold: 5000, tag: 'INTERNET-CHECK',
        history: [
          { roundTripTime: 12, success: true, timestamp: '15:29:01.456 UTC' },
          { roundTripTime: 11, success: true, timestamp: '15:30:01.456 UTC' },
          { roundTripTime: 14, success: true, timestamp: '15:31:01.456 UTC' },
        ]
      },
    ] satisfies IpSlaEntry[],
    ipSlaSchedules: [
      { id: 1, startTime: 'now', life: 'forever' as const, recurring: true },
      { id: 2, startTime: 'now', life: 'forever' as const, recurring: true },
    ] satisfies IpSlaSchedule[],
    dhcpSnooping: { enabled: false, vlans: [], option82: true, trustedPorts: ['Gi0/1', 'Gi0/2'], rateLimits: [] },
    dai: { enabled: false, vlans: [], trustedPorts: ['Gi0/1', 'Gi0/2'], logging: true },
    ipSourceGuardBindings: [],
    stpMode: 'rapid-pvst' as const,
    mstConfig: {
      name: 'CORP-MST',
      revision: 1,
      instances: [
        { id: 0, vlans: [1, 30, 99], rootBridgeMac: '0019.e8a2.3c00', rootBridgePriority: 32768, localBridgePriority: 32768, rootCost: 0 },
        { id: 1, vlans: [10, 20], rootBridgeMac: '0019.e8a2.3c00', rootBridgePriority: 24576, localBridgePriority: 24576, rootCost: 0 },
      ],
    },
    stpPortfastDefault: false,
    stpBpduguardDefault: false,
    stpLoopguardDefault: false,
    stpBackbonefast: false,
  };

  if (savedConfig) {
    return {
      ...base,
      ...savedConfig,
      mode: 'user-exec',
      modeContext: { type: 'none' },
      bootTime: now,
      currentTime: now,
    };
  }

  return base;
}

export const INITIAL_STATE: DeviceState = createInitialState();

import type {
  DeviceState, Interface, Vlan, MacEntry, ArpEntry, Route,
  SpanningTreeVlan, CdpNeighbor, LineConfig, NtpConfig,
  SpanningTreePortConfig, PortSecurity
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
    ...opts
  };
}

export function createInitialState(): DeviceState {
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
    macAddress: '0019.e8a2.3c00',
    duplex: 'full', speed: 'auto', mtu: 1514,
    switchportMode: 'access',
    accessVlan: 1, trunkAllowedVlans: '1-4094', trunkNativeVlan: 1,
    spanningTree: defaultStp(),
    portSecurity: defaultPortSec(),
    ipHelperAddresses: [], ipAccessGroups: [],
    inputPackets: 5234, outputPackets: 5234, inputErrors: 0, outputErrors: 0,
    inputBytes: 418720, outputBytes: 418720, lastClear: bootTime
  };

  // VLAN SVIs
  interfaces['Vlan1'] = {
    id: 'Vlan1', slot: 0, port: 0,
    description: 'Management-VLAN',
    adminState: 'up', lineState: 'up',
    ipAddresses: [{ address: '192.168.1.1', mask: '255.255.255.0' }],
    macAddress: '0019.e8a2.3c0a',
    duplex: 'full', speed: 'auto', mtu: 1500,
    switchportMode: 'access',
    accessVlan: 1, trunkAllowedVlans: '1-4094', trunkNativeVlan: 1,
    spanningTree: defaultStp(),
    portSecurity: defaultPortSec(),
    ipHelperAddresses: [], ipAccessGroups: [],
    inputPackets: 48291, outputPackets: 52104, inputErrors: 0, outputErrors: 0,
    inputBytes: 6278830, outputBytes: 6773520, lastClear: bootTime
  };
  interfaces['Vlan10'] = {
    id: 'Vlan10', slot: 0, port: 0,
    description: 'DATA-VLAN-SVI',
    adminState: 'up', lineState: 'up',
    ipAddresses: [{ address: '10.10.10.1', mask: '255.255.255.0' }],
    macAddress: '0019.e8a2.3c0b',
    duplex: 'full', speed: 'auto', mtu: 1500,
    switchportMode: 'access',
    accessVlan: 10, trunkAllowedVlans: '1-4094', trunkNativeVlan: 1,
    spanningTree: defaultStp(),
    portSecurity: defaultPortSec(),
    ipHelperAddresses: ['192.168.1.254'], ipAccessGroups: [],
    inputPackets: 234891, outputPackets: 287432, inputErrors: 0, outputErrors: 0,
    inputBytes: 30535830, outputBytes: 37366160, lastClear: bootTime
  };
  interfaces['Vlan20'] = {
    id: 'Vlan20', slot: 0, port: 0,
    description: 'VOICE-VLAN-SVI',
    adminState: 'up', lineState: 'up',
    ipAddresses: [{ address: '10.20.20.1', mask: '255.255.255.0' }],
    macAddress: '0019.e8a2.3c0c',
    duplex: 'full', speed: 'auto', mtu: 1500,
    switchportMode: 'access',
    accessVlan: 20, trunkAllowedVlans: '1-4094', trunkNativeVlan: 1,
    spanningTree: defaultStp(),
    portSecurity: defaultPortSec(),
    ipHelperAddresses: ['192.168.1.254'], ipAccessGroups: [],
    inputPackets: 128492, outputPackets: 143821, inputErrors: 0, outputErrors: 0,
    inputBytes: 16703960, outputBytes: 18696730, lastClear: bootTime
  };
  interfaces['Vlan30'] = {
    id: 'Vlan30', slot: 0, port: 0,
    description: 'MGMT-VLAN-SVI',
    adminState: 'up', lineState: 'up',
    ipAddresses: [{ address: '10.30.30.1', mask: '255.255.255.0' }],
    macAddress: '0019.e8a2.3c0d',
    duplex: 'full', speed: 'auto', mtu: 1500,
    switchportMode: 'access',
    accessVlan: 30, trunkAllowedVlans: '1-4094', trunkNativeVlan: 1,
    spanningTree: defaultStp(),
    portSecurity: defaultPortSec(),
    ipHelperAddresses: [], ipAccessGroups: [],
    inputPackets: 34821, outputPackets: 38294, inputErrors: 0, outputErrors: 0,
    inputBytes: 4526730, outputBytes: 4978220, lastClear: bootTime
  };

  const vlans: Record<number, Vlan> = {
    1: {
      id: 1, name: 'default', state: 'active',
      ports: ['Fa0/17','Fa0/18','Fa0/19','Fa0/20','Fa0/21','Fa0/22','Fa0/23','Fa0/24']
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

  return {
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
    ntp,
    loggingEnabled: true,
    loggingServer: '192.168.1.200',
    loggingBuffer: [],
    syslogLevel: 6,
    unsavedChanges: false,
    bootTime,
    currentTime: now
  };
}

export const INITIAL_STATE: DeviceState = createInitialState();

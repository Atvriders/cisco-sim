export type StpMode = 'pvst' | 'rapid-pvst' | 'mst';

export interface MstInstance {
  id: number;           // 0-4094
  name?: string;
  vlans: number[];      // VLANs mapped to this instance
  rootBridgeMac: string;
  rootBridgePriority: number;
  localBridgePriority: number;
  rootPort?: string;
  rootCost: number;
}

export interface MstConfig {
  name: string;
  revision: number;
  instances: MstInstance[];
}

export type CliMode =
  | 'user-exec'
  | 'priv-exec'
  | 'global-config'
  | 'if-config'
  | 'vlan-config'
  | 'line-config'
  | 'router-ospf'
  | 'router-eigrp'
  | 'router-bgp';

export type ModeContext =
  | { type: 'none' }
  | { type: 'interface'; interfaceId: string }
  | { type: 'vlan'; vlanId: number }
  | { type: 'line'; lineType: 'console' | 'vty' | 'aux'; start: number; end: number }
  | { type: 'router-ospf'; processId: number }
  | { type: 'router-eigrp'; asNumber: number }
  | { type: 'router-bgp'; asNumber: number };

export type InterfaceLineState = 'up' | 'down' | 'notconnect' | 'notpresent' | 'err-disabled';
export type SwitchportMode = 'access' | 'trunk' | 'dynamic-auto' | 'dynamic-desirable';
export type DuplexMode = 'auto' | 'full' | 'half';
export type SpeedSetting = 'auto' | '10' | '100' | '1000';

export interface IpAddress { address: string; mask: string; secondary?: boolean; }

export interface IPv6Address {
  address: string;       // "2001:db8::1"
  prefixLength: number;  // 64
  type: 'manual' | 'eui-64' | 'link-local' | 'anycast';
}

export interface LldpNeighbor {
  deviceId: string;
  localInterface: string;
  holdtime: number;
  capability: string;
  systemName: string;
  portId: string;
  portDescription?: string;
  systemDescription?: string;
  managementAddress?: string;
}

export interface SpanningTreePortConfig {
  portfast: boolean; bpduguard: boolean; bpdufilter: boolean;
  cost?: number; priority?: number;
  state: 'blocking' | 'listening' | 'learning' | 'forwarding' | 'disabled';
  role: 'root' | 'designated' | 'alternate' | 'backup' | 'disabled';
}

export interface PortSecurity {
  enabled: boolean; maxMacAddresses: number;
  violation: 'protect' | 'restrict' | 'shutdown';
  stickyLearning: boolean; learnedAddresses: string[];
}

export interface Interface {
  id: string; slot: number; port: number;
  description: string;
  adminState: 'up' | 'down';
  lineState: InterfaceLineState;
  ipAddresses: IpAddress[];
  macAddress: string;
  duplex: DuplexMode; speed: SpeedSetting; mtu: number;
  switchportMode: SwitchportMode;
  accessVlan: number; trunkAllowedVlans: string; trunkNativeVlan: number;
  spanningTree: SpanningTreePortConfig;
  portSecurity: PortSecurity;
  ipHelperAddresses: string[];
  ipAccessGroups: { acl: string; direction: 'in' | 'out' }[];
  channelGroup?: { number: number; mode: 'active' | 'passive' | 'on' };
  ospfCost?: number; ospfPriority?: number;
  inputPackets: number; outputPackets: number;
  inputErrors: number; outputErrors: number;
  inputBytes: number; outputBytes: number;
  lastClear: number;
  broadcastLevel?: number;
  ipv6Addresses: IPv6Address[];
  ipv6Enabled: boolean;
  lldpTransmit?: boolean;
  lldpReceive?: boolean;
  servicePolicy?: { in?: string; out?: string };
  cdpEnabled: boolean;
  mlsQosTrust?: 'cos' | 'dscp' | 'ip-precedence';
  mlsQosCos?: number;
}

export interface Vlan {
  id: number; name: string;
  state: 'active' | 'suspend' | 'act/unsup';
  ports: string[];
}

export interface MacEntry {
  vlan: number; mac: string;
  type: 'dynamic' | 'static' | 'secure-dynamic' | 'secure-static';
  port: string; age: number;
}

export interface ArpEntry {
  address: string; age: number; mac: string;
  type: 'ARPA'; interface: string;
}

export interface Route {
  source: 'C' | 'L' | 'S' | 'O' | 'D' | 'B' | 'R' | '*' | 'I';
  network: string; mask: string;
  adminDistance: number; metric: number;
  nextHop?: string; interface?: string; age: string;
}

export interface SpanningTreeVlan {
  vlanId: number;
  rootBridgePriority: number; rootBridgeMac: string; rootBridgeIsLocal: boolean;
  localBridgePriority: number; localBridgeMac: string;
  rootPort?: string; rootCost: number;
  helloTime: number; forwardDelay: number; maxAge: number;
}

export interface CdpNeighbor {
  deviceId: string; localInterface: string; holdtime: number;
  capability: string; platform: string; remoteInterface: string;
  ipAddress?: string; iosVersion?: string; nativeVlan?: number; duplex?: string;
}

export interface OspfNeighbor {
  neighborId: string; priority: number;
  state: 'FULL' | 'EXSTART' | 'EXCHANGE' | '2WAY' | 'DOWN' | 'INIT';
  deadTime: string; address: string; interface: string;
}

export interface OspfConfig {
  processId: number; routerId?: string;
  networks: { network: string; wildcard: string; area: number }[];
  redistributeConnected: boolean; redistributeStatic: boolean;
  defaultInformationOriginate: boolean; passiveInterfaces: string[];
  neighbors: OspfNeighbor[];
}

export interface EigrpNeighbor {
  address: string; interface: string; holdtime: number;
  srtt: number; rto: number; q: number; seq: number;
}

export interface EigrpConfig {
  asNumber: number; networks: { network: string; wildcard?: string }[];
  passiveInterfaces: string[]; redistributeConnected: boolean; redistributeStatic: boolean;
  neighbors: EigrpNeighbor[];
}

export interface BgpNeighbor {
  address: string; remoteAs: number;
  state: 'Established' | 'Active' | 'Idle' | 'Connect' | 'OpenSent' | 'OpenConfirm';
  uptime: string; prefixesReceived: number;
}

export interface BgpConfig {
  asNumber: number; routerId?: string;
  networks: { network: string; mask?: string }[];
  neighbors: BgpNeighbor[];
}

export interface AclEntry {
  sequence: number; action: 'permit' | 'deny';
  protocol?: string; source: string; sourceMask?: string;
  destination?: string; destinationMask?: string; log?: boolean; matches: number;
}

export interface Acl { name: string; type: 'standard' | 'extended'; entries: AclEntry[]; }

export interface LocalUser { username: string; privilege: number; secret?: string; password?: string; }

export interface LineConfig {
  line: 'console' | 'vty' | 'aux'; start: number; end: number;
  login: 'none' | 'password' | 'local' | 'tacacs'; password?: string;
  execTimeout: number; transportInput: string[];
  loggingSynchronous: boolean; privilegeLevel: number;
}

export interface NtpConfig {
  servers: string[]; synchronized: boolean;
  referenceServer?: string; stratum: number; offset: number;
  master?: boolean; masterStratum?: number;
  authenticate?: boolean;
  authKeys?: { id: number; type: 'md5'; key: string }[];
  trustedKeys?: number[];
  source?: string;
}

export interface VtpConfig {
  domain: string;
  mode: 'server' | 'client' | 'transparent' | 'off';
  version: 1 | 2 | 3;
  password?: string;
  pruningEnabled: boolean;
  configRevision: number;
  updatedBy: string;
  updatedAt: string;
}

export interface SnmpConfig {
  communities: { name: string; access: 'ro' | 'rw'; acl?: string }[];
  location?: string;
  contact?: string;
  trapHosts: { ip: string; community: string; version: '1' | '2c' | '3' }[];
  enabled: boolean;
}

export interface DhcpPool {
  name: string;
  network: string;
  mask: string;
  defaultRouter?: string;
  dnsServer?: string;
  domainName?: string;
  leaseTime: number;
  excludedAddresses: string[];
}

export interface DhcpBinding {
  ip: string;
  mac: string;
  hostname?: string;
  leaseExpiry: string;
  type: 'Automatic' | 'Manual';
  state: 'Active' | 'Expired';
  interface: string;
}

export interface NatEntry {
  inside: string;
  outside: string;
  insideGlobal: string;
  outsideGlobal: string;
  type: 'static' | 'dynamic' | 'pat';
  protocol?: string;
  insidePort?: number;
  outsidePort?: number;
  age: string;
}

export interface NatConfig {
  insideInterfaces: string[];
  outsideInterfaces: string[];
  pools: { name: string; startIp: string; endIp: string; prefix: number }[];
  staticMappings: { localIp: string; globalIp: string; protocol?: string; localPort?: number; globalPort?: number }[];
  overload: boolean;
  accessList?: string;
}

export interface HsrpGroup {
  interfaceId: string;
  groupNumber: number;
  virtualIp: string;
  priority: number;
  preempt: boolean;
  state: 'Active' | 'Standby' | 'Listen' | 'Init';
  activeRouter: string;
  standbyRouter: string;
  helloTime: number;
  holdTime: number;
  authentication?: string;
}

export interface QosClassMap {
  name: string;
  matchType: 'access-group' | 'dscp' | 'cos' | 'ip-precedence' | 'any';
  matchValue?: string;
}

export interface QosPolicyClass {
  classMapName: string;
  police?: { rate: number; burstNormal: number; burstExcess: number; exceedAction: string };
  priority?: number;
  bandwidth?: number;
  set?: { field: string; value: string };
}

export interface QosPolicyMap {
  name: string;
  classes: QosPolicyClass[];
}

export interface SpanSession {
  id: number;
  type: 'local' | 'rspan';
  sourcePorts: { port: string; direction: 'rx' | 'tx' | 'both' }[];
  sourceVlans?: number[];
  destination?: string;
  filter?: string;
}

export interface PortChannelInterface {
  id: string;           // "Port-channel1"
  members: string[];    // ["Fa0/1", "Fa0/2"]
  protocol: 'lacp' | 'pagp' | 'none';
  mode: 'active' | 'passive' | 'on' | 'desirable' | 'auto';
  adminState: 'up' | 'down';
  lineState: 'up' | 'down';
}

export interface AaaConfig {
  newModel: boolean;
  authenticationLists: { name: string; methods: string[] }[];
  authorizationLists: { name: string; type: string; methods: string[] }[];
  accountingLists: { name: string; type: string; methods: string[] }[];
  radiusServers: { ip: string; authPort: number; acctPort: number; key: string }[];
  tacacsServers: { ip: string; key: string }[];
}

export interface IpSlaEntry {
  id: number;
  type: 'icmp-echo' | 'udp-jitter' | 'http' | 'dns';
  target: string;
  sourceInterface?: string;
  frequency: number;    // seconds
  timeout: number;
  threshold: number;
  tag?: string;
  history: { roundTripTime: number; success: boolean; timestamp: string }[];
}

export interface IpSlaSchedule {
  id: number;
  startTime: 'now' | string;
  life: 'forever' | number;
  recurring: boolean;
}

export interface DhcpSnoopingConfig {
  enabled: boolean;
  vlans: number[];
  option82: boolean;
  trustedPorts: string[];  // interface IDs
  rateLimits: { port: string; pps: number }[];
}

export interface DaiConfig {
  enabled: boolean;
  vlans: number[];
  trustedPorts: string[];
  logging: boolean;
}

export interface IpSourceGuardBinding {
  ip: string;
  mac: string;
  vlan: number;
  interface: string;
  type: 'dhcp-snooping' | 'static';
}

export interface DeviceState {
  hostname: string; domainName: string; banner: string;
  mode: CliMode; modeContext: ModeContext;
  interfaces: Record<string, Interface>;
  vlans: Record<number, Vlan>;
  macTable: MacEntry[];
  spanningTree: Record<number, SpanningTreeVlan>;
  arpTable: ArpEntry[];
  routes: Route[];
  ipRoutingEnabled: boolean; defaultGateway?: string;
  ospf?: OspfConfig; eigrp?: EigrpConfig; bgp?: BgpConfig;
  enableSecret?: string; enablePassword?: string;
  servicePasswordEncryption: boolean;
  users: LocalUser[];
  acls: Record<string, Acl>;
  cryptoKeyRsa?: { modulus: number; generated: string };
  lines: LineConfig[];
  cdpEnabled: boolean; cdpNeighbors: CdpNeighbor[];
  lldpEnabled: boolean; lldpNeighbors: LldpNeighbor[];
  ipv6RoutingEnabled: boolean;
  ipv6Routes: { source: string; network: string; prefixLength: number; nextHop?: string; interface?: string; age: string }[];
  ntp: NtpConfig;
  loggingEnabled: boolean; loggingServer?: string;
  loggingBuffer: string[]; syslogLevel: number;
  startupConfig?: Omit<DeviceState, 'startupConfig'>;
  unsavedChanges: boolean;
  bootTime: number; currentTime: number;
  activeDebugs: string[];
  terminalLength: number;
  terminalWidth: number;
  dhcpPools: DhcpPool[];
  dhcpBindings: DhcpBinding[];
  dhcpExcludedAddresses: { start: string; end?: string }[];
  dhcpEnabled: boolean;
  natConfig: NatConfig;
  natTranslations: NatEntry[];
  hsrpGroups: HsrpGroup[];
  vtp: VtpConfig;
  snmp: SnmpConfig;
  cdpTimer: number;
  cdpHoldtime: number;
  qosEnabled: boolean;
  classMaps: QosClassMap[];
  policyMaps: QosPolicyMap[];
  spanSessions: SpanSession[];
  portChannels: PortChannelInterface[];
  aaa: AaaConfig;
  ipSla: IpSlaEntry[];
  ipSlaSchedules: IpSlaSchedule[];
  dhcpSnooping: DhcpSnoopingConfig;
  dai: DaiConfig;
  ipSourceGuardBindings: IpSourceGuardBinding[];
  stpMode: StpMode;
  mstConfig: MstConfig;
  stpPortfastDefault: boolean;
  stpBpduguardDefault: boolean;
  stpLoopguardDefault: boolean;
  stpBackbonefast: boolean;
}

export interface TerminalLine {
  id: string;
  type: 'input' | 'output' | 'error' | 'info' | 'system' | 'success';
  text: string;
}

export interface SessionState {
  id: number; label: string;
  lines: TerminalLine[];
  commandHistory: string[];
  historyIndex: number;
  deviceState: DeviceState;
  booted: boolean;
  pendingInput?: string;
  pendingCommand?: string;
}

export type CommandHandler = (
  args: string[], state: DeviceState, raw: string, negated: boolean
) => CommandResult;

export interface CommandResult {
  output: TerminalLine[];
  newState?: Partial<DeviceState>;
  newMode?: CliMode;
  newContext?: ModeContext;
  bell?: boolean;
  asyncLines?: { text: string; delay: number; type: TerminalLine['type'] }[];
  pendingInput?: string;
  pendingCommand?: string;
}

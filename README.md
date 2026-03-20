# Cisco IOS Switch Simulator

**Browser-based Cisco IOS 15.2(7)E6 CLI simulator — authentic output, zero hardware required.**

Simulates a Cisco Catalyst WS-C2960X-48TS-L (enterprise-LAN train) with full CLI mode hierarchy, accurate command output matching real 2960X hardware, real-time interface stats, a live network topology diagram, and a phosphor-green CRT terminal aesthetic. Runs entirely in the browser; no backend, no network access.

---

## Features

- **Cisco IOS 15.2(7)E6** — output matches real Catalyst 2960X hardware character-for-character (enterprise-LAN train, not the router M-train)
- **All CLI modes** — User EXEC, Privileged EXEC, Global Config, Interface Config, VLAN Config, Line Config, Router Config (OSPF / EIGRP / BGP), MST Config
- **IOS abbreviation engine** — `sh ip int bri`, `conf t`, `int fa0/1`, `no sh`, etc.
- **`no` prefix support** — negates any supported command (`no shutdown`, `no ip address`, etc.)
- **Tab completion** — context-aware across all modes and subcommands including `no <cmd>` TAB completion and interface names
- **`?` help system** — inline help at any point in a command, including full sub-trees such as `show ip ?`, `show ip ospf ?`, `debug ip ?`
- **Command history** — Up/Down arrow navigation; `show history`; Ctrl+R reverse-history search
- **Pipe filters** — `| include`, `| exclude`, `| begin`, `| section` on any output
- **Multi-session tabs** — Console (CON 0) plus up to 4 VTY sessions, each with independent state
- **Topology diagram** — canvas-based live diagram of SW1, CDP neighbors, link states, animated traffic packets
- **Animated boot sequence** — full Cisco ROM / POST boot with per-line timing and POWER LED
- **Live status panel** — interface up/down grid, VLAN and MAC counts, CPU/memory bars, live uptime, SAVED/UNSAVED indicator
- **Unsaved-changes tracking** — amber dot on session tab; `write memory` clears it
- **CRT aesthetic** — phosphor-green text, scanlines, vignette, amber prompt in config modes
- **F1 help overlay** — keyboard shortcut reference panel toggled from title bar or F1 key
- **Simulated protocols** — OSPF, EIGRP, BGP, STP/RSTP/MST, HSRP, VRRP, LACP/PAgP, CDP, LLDP, VTP, SNMP, NTP, DHCP, NAT, AAA, 802.1X/MAB, IP SLA, QoS, SPAN, Multicast (PIM/IGMP), PoE
- **Security features** — Port Security, DHCP Snooping, Dynamic ARP Inspection, IP Source Guard, ACLs, AAA/RADIUS/TACACS+, 802.1X/MAB, Err-disable/recovery
- **Pre-populated device** — SW1 fully configured with 5 VLANs, 3 CDP neighbors, OSPF adjacency, DHCP pools, HSRP, static routes, local users
- **Accurate 2960X output** — `show version`, routing table, VLAN table (including reserved VLANs 1002–1005), interface counters, and CDP neighbor detail all match real hardware format

---

## Quick Start

**Docker (recommended):**

```bash
docker pull ghcr.io/atvriders/cisco-sim:latest
docker run -p 8080:80 ghcr.io/atvriders/cisco-sim:latest
```

Open **http://localhost:8080**. No configuration needed.

Or with Docker Compose:

```bash
docker compose up -d
```

To update to the latest build:

```bash
docker compose pull && docker compose up -d
```

**Local development:**

```bash
npm install
npm run dev   # Vite dev server on :5173
```

---

## CLI Modes

| Mode | Prompt | Enter | Exit |
|------|--------|-------|------|
| User EXEC | `SW1>` | (default) | `logout` / `exit` |
| Privileged EXEC | `SW1#` | `enable` | `disable` / `exit` |
| Global Config | `SW1(config)#` | `configure terminal` | `end` / `exit` |
| Interface Config | `SW1(config-if)#` | `interface <id>` | `exit` → Global Config |
| VLAN Config | `SW1(config-vlan)#` | `vlan <id>` | `exit` → Global Config |
| Line Config | `SW1(config-line)#` | `line console 0` / `line vty 0 4` | `exit` → Global Config |
| Router OSPF | `SW1(config-router)#` | `router ospf <pid>` | `exit` → Global Config |
| Router EIGRP | `SW1(config-router)#` | `router eigrp <asn>` | `exit` → Global Config |
| Router BGP | `SW1(config-router)#` | `router bgp <asn>` | `exit` → Global Config |
| MST Config | `SW1(config-mst)#` | `spanning-tree mst configuration` | `exit` → Global Config |

`do <command>` works in any config mode to run exec-level commands without leaving config context.
`Ctrl+Z` returns to privileged EXEC from any config mode (equivalent to `end`).

---

## Command Reference

### User EXEC (`SW1>`)

| Command | Description |
|---------|-------------|
| `enable` | Enter privileged EXEC (prompts for secret if configured) |
| `ping <ip>` | Send 5 ICMP echoes; route-aware (direct / OSPF / static) |
| `traceroute <ip>` | Trace route; shows next-hop and remaining hops |
| `show ...` | All show commands available (see below) |
| `ssh -l <user> <ip>` | Simulated SSH connection attempt |
| `telnet <ip>` | Simulated Telnet connection attempt |
| `logout` / `exit` | End session |
| `disable` | Return to user EXEC from privileged |

### Privileged EXEC (`SW1#`)

| Command | Description |
|---------|-------------|
| `configure terminal` | Enter global configuration mode |
| `copy running-config startup-config` | Save running config to NVRAM |
| `copy startup-config running-config` | Restore startup config to running |
| `copy running-config tftp` | Copy config to TFTP server (simulated prompt) |
| `write memory` | Save configuration (alias for `copy run start`) |
| `write erase` | Erase startup configuration |
| `erase startup-config` | Erase NVRAM startup config |
| `reload` | Reload the device (confirmation prompt) |
| `clock set HH:MM:SS DD Mon YYYY` | Set system clock |
| `dir [flash:\|nvram:]` | List flash or NVRAM filesystem |
| `debug ip ospf adj` | OSPF adjacency debugging |
| `debug ip ospf events` | OSPF events debugging |
| `debug ip rip` | RIP protocol debugging |
| `debug ip packet` | IP packet debugging |
| `debug spanning-tree events` | STP event debugging |
| `undebug all` | Disable all active debugs |
| `terminal length <n>` | Set terminal page length |
| `terminal width <n>` | Set terminal width |
| `terminal monitor` | Enable debug to terminal |
| `test cable-diagnostics tdr interface <id>` | Run TDR cable test |
| `clear ...` | See Clear Commands below |
| `end` | Return to privileged EXEC from any config mode |

### Show Commands (`SW1#` or `do show ...` from config modes)

All show commands support IOS-style abbreviation (e.g. `sh ver`, `sh ip int bri`).

**Version / System:**

| Command | Description |
|---------|-------------|
| `show version` | IOS 15.2(7)E6 version string, uptime, hardware, serial numbers, flash |
| `show clock` | System clock |
| `show processes cpu` | CPU utilization with per-process breakdown |
| `show memory` | Processor and I/O memory usage |
| `show flash` | Flash filesystem with IOS image `c2960x-universalk9-mz.152-7.E6.bin` |
| `show environment` | Hardware fans, PSU, temperature sensors |
| `show platform` | Platform hardware summary |
| `show platform tcam` | TCAM utilization |
| `show controllers` | Hardware controller summary |
| `show file systems` | Flash, NVRAM, and virtual filesystem list |
| `show privilege` | Current privilege level |
| `show terminal` | Terminal settings (length, width, baud rate) |
| `show history` | Command recall buffer |
| `show users` | Active console and VTY sessions |
| `show sessions` | Outbound session list |
| `show tech-support` | Concatenated output of key show commands |

**Configuration:**

| Command | Description |
|---------|-------------|
| `show running-config` | Full active configuration |
| `show running-config interface <id>` | Single interface config block |
| `show running-config section <keyword>` | Show matching config section |
| `show startup-config` | Saved NVRAM configuration |

**Interfaces:**

| Command | Description |
|---------|-------------|
| `show interfaces` | All interfaces — full counters and status |
| `show interfaces <id>` | Single interface detail |
| `show interfaces status` | One-line port status table (speed, duplex, VLAN) |
| `show interfaces trunk` | Trunk ports with allowed/native/active VLANs |
| `show interfaces counters` | Input/output packet counters |
| `show interfaces counters errors` | Error counters per interface |
| `show interfaces counters trunk` | Trunk-specific counters |
| `show interfaces switchport [<id>]` | Switchport detail (mode, VLANs, DTP) |
| `show interfaces capabilities [<id>]` | Interface hardware capabilities |
| `show interfaces Port-channel<n>` | Port-channel interface detail |
| `show ip interface brief` | IP summary: address, OK?, method, status, protocol |
| `show ip interface <id>` | Full L3 interface info, ACLs, helper addresses |

**Layer 2 / VLANs:**

| Command | Description |
|---------|-------------|
| `show vlan` | Full VLAN table including reserved VLANs 1002–1005 |
| `show vlan brief` | Condensed VLAN table |
| `show mac address-table` | Layer 2 MAC address table |
| `show mac address-table dynamic` | Dynamic MAC entries only |
| `show mac address-table aging-time` | MAC aging timer |
| `show mac address-table count` | MAC entry counts by VLAN |
| `show mac address-table notification` | MAC notification configuration |

**Routing:**

| Command | Description |
|---------|-------------|
| `show ip route` | IP routing table with codes legend (real 2960X format) |
| `show ip protocols` | Routing protocol summary (OSPF, EIGRP, BGP, RIP) |
| `show arp` | ARP cache |
| `show ip arp` | ARP cache (alias) |
| `show ip traffic` | IP traffic statistics |
| `show ip cache` | IP fast-switching cache |

**Spanning Tree:**

| Command | Description |
|---------|-------------|
| `show spanning-tree` | STP detail for all VLANs |
| `show spanning-tree vlan <id>` | STP detail for specific VLAN |
| `show spanning-tree summary` | STP mode and per-VLAN root summary |
| `show spanning-tree detail` | Full STP per-port detail |
| `show spanning-tree mst` | MST instance summary |
| `show spanning-tree mst configuration` | MST region name, revision, instance-to-VLAN map |
| `show spanning-tree inconsistentports` | STP inconsistent ports |
| `show spanning-tree blockedports` | Ports in blocking state |

**CDP / LLDP:**

| Command | Description |
|---------|-------------|
| `show cdp` | CDP global timers and version |
| `show cdp neighbors` | CDP neighbor table |
| `show cdp neighbors detail` | Full CDP neighbor detail (IOS version, IP, platform) |
| `show cdp interface [<id>]` | CDP status per interface |
| `show cdp traffic` | CDP packet counters |
| `show lldp` | LLDP global status |
| `show lldp neighbors` | LLDP neighbor table |
| `show lldp neighbors detail` | Full LLDP neighbor detail |
| `show lldp interface [<id>]` | LLDP per-interface transmit/receive status |

**Routing Protocols:**

| Command | Description |
|---------|-------------|
| `show ip ospf` | OSPF process detail (router-id, areas, SPF counts) |
| `show ip ospf neighbor` | OSPF adjacency table |
| `show ip ospf database` | OSPF LSDB |
| `show ip ospf interface` | OSPF interface detail |
| `show ip eigrp neighbors` | EIGRP neighbor table |
| `show ip bgp` | BGP table |
| `show ip bgp summary` | BGP peer summary table |

**Security / ACL:**

| Command | Description |
|---------|-------------|
| `show ip access-lists` | ACL entries with hit counts |
| `show port-security` | Port security summary table |
| `show port-security interface <id>` | Per-interface port security detail |
| `show port-security address` | All secure MAC addresses |
| `show ip dhcp snooping` | DHCP snooping global status |
| `show ip dhcp snooping binding` | DHCP snooping binding table |
| `show ip dhcp snooping statistics` | DHCP snooping counters |
| `show ip arp inspection` | Dynamic ARP inspection status |
| `show ip arp inspection interfaces` | DAI per-interface trust/rate config |
| `show ip verify source` | IP Source Guard bindings |
| `show aaa` | AAA configuration summary |
| `show aaa servers` | RADIUS / TACACS+ server list |
| `show errdisable recovery` | Err-disable auto-recovery timers |
| `show errdisable detect` | Err-disable cause detection settings |
| `show dot1x` | 802.1X global summary |
| `show dot1x all` | 802.1X detail for all interfaces |
| `show dot1x interface <id>` | Per-interface 802.1X status |
| `show dot1x statistics interface <id>` | 802.1X counters per interface |
| `show authentication sessions` | Active authentication sessions |
| `show authentication sessions interface <id>` | Auth sessions for specific interface |
| `show crypto key mypubkey rsa` | RSA public key data |
| `show crypto pki certificates` | PKI certificate detail |

**DHCP / HSRP / VRRP:**

| Command | Description |
|---------|-------------|
| `show ip dhcp binding` | DHCP address bindings |
| `show ip dhcp pool` | DHCP pool configuration |
| `show ip dhcp conflict` | DHCP address conflicts |
| `show standby` | HSRP group detail |
| `show standby brief` | HSRP one-line summary table |
| `show vrrp` | VRRP group detail |
| `show vrrp brief` | VRRP one-line summary table |

**QoS / Policies:**

| Command | Description |
|---------|-------------|
| `show mls qos` | MLS QoS global status |
| `show mls qos interface [<id>]` | MLS QoS per-interface trust and CoS |
| `show class-map [<name>]` | QoS class-map definitions |
| `show policy-map [<name>]` | QoS policy-map definitions |
| `show policy-map interface <id>` | Applied policy-map and per-class statistics |

**EtherChannel / SPAN / Storm:**

| Command | Description |
|---------|-------------|
| `show etherchannel summary` | Port-channel bundle summary (LACP/PAgP) |
| `show etherchannel <n> detail` | Per-group EtherChannel detail |
| `show monitor session [<id>]` | SPAN session configuration |
| `show storm-control [<interface>]` | Storm control levels per port |

**Management Protocols:**

| Command | Description |
|---------|-------------|
| `show ntp status` | NTP synchronization detail and stratum |
| `show ntp associations` | NTP peer associations |
| `show ntp associations detail` | Detailed NTP peer information |
| `show vtp status` | VTP domain, mode, version, revision |
| `show vtp counters` | VTP message counters |
| `show vtp password` | VTP password (if configured) |
| `show snmp` | SNMP configuration and trap hosts |
| `show snmp community` | SNMP community strings |
| `show logging` | Syslog buffer and configuration |
| `show ip ssh` | SSH server status and version |

**IPv6:**

| Command | Description |
|---------|-------------|
| `show ipv6 interface brief` | IPv6 interface summary |
| `show ipv6 interface <id>` | Full IPv6 interface detail |
| `show ipv6 route` | IPv6 routing table |
| `show ipv6 neighbors` | IPv6 neighbor (NDP) table |

**IP SLA:**

| Command | Description |
|---------|-------------|
| `show ip sla statistics [<id>]` | IP SLA round-trip statistics |
| `show ip sla summary` | IP SLA entry summary |
| `show ip sla configuration [<id>]` | IP SLA probe configuration |

**Multicast:**

| Command | Description |
|---------|-------------|
| `show ip pim neighbor` | PIM neighbor table |
| `show ip pim interface` | PIM interface summary |
| `show ip mroute` | Multicast routing table |
| `show ip igmp groups` | IGMP group membership |
| `show ip igmp interface` | IGMP per-interface detail |

**PoE:**

| Command | Description |
|---------|-------------|
| `show power inline` | PoE summary for all ports |
| `show power inline interface <id>` | Per-interface PoE detail |

**Cable / Diagnostics:**

| Command | Description |
|---------|-------------|
| `show cable-diagnostics tdr` | TDR cable test results |

**Pipe Filters** (append to any show command):

```
show running-config | include <pattern>
show running-config | exclude <pattern>
show running-config | begin <pattern>
show running-config section <keyword>
show interfaces | include <pattern>
```

### Clear Commands (`SW1#`)

| Command | Description |
|---------|-------------|
| `clear mac address-table dynamic` | Flush dynamic MAC entries |
| `clear arp-cache` | Clear ARP table |
| `clear counters [<interface>]` | Reset interface packet/byte/error counters |
| `clear ip ospf process` | Reset OSPF adjacencies (confirmation prompt) |
| `clear spanning-tree detected-protocols` | Re-detect STP protocol versions |
| `clear logging` | Clear syslog buffer |
| `clear line <n>` | Clear a terminal line session |

### Global Config (`SW1(config)#`)

**System:**

| Command | Description |
|---------|-------------|
| `hostname <name>` | Set device hostname |
| `enable secret <password>` | Set MD5-hashed privileged password |
| `enable password <password>` | Set plaintext privileged password |
| `service password-encryption` | Encrypt all plaintext passwords |
| `service dhcp` / `no service dhcp` | Enable or disable DHCP service |
| `banner motd <text>` | Set message-of-the-day banner |
| `username <name> privilege <lvl> secret <pw>` | Create local user with hashed password |
| `username <name> privilege <lvl> password <pw>` | Create local user with plaintext password |
| `crypto key generate rsa modulus <bits>` | Generate RSA key pair for SSH |

**IP / Routing:**

| Command | Description |
|---------|-------------|
| `ip routing` | Enable Layer 3 IP routing |
| `ip default-gateway <ip>` | Set default gateway (L2 mode) |
| `ip route <net> <mask> <next-hop> [<ad>]` | Add static route |
| `ip domain-name <domain>` | Set DNS domain name |
| `ip name-server <ip>` | Configure DNS server |
| `ip classless` / `no ip classless` | Enable/disable classless routing |
| `ip source-route` / `no ip source-route` | Enable/disable IP source routing |
| `no ip domain-lookup` | Disable DNS lookup |
| `ip http server` / `no ip http server` | Enable/disable HTTP server |
| `ip forward-protocol udp` | Configure UDP broadcast forwarding |

**IPv6:**

| Command | Description |
|---------|-------------|
| `ipv6 unicast-routing` | Enable IPv6 routing |
| `ipv6 route <prefix> <next-hop>` | Add IPv6 static route |

**Access Lists:**

| Command | Description |
|---------|-------------|
| `access-list <num> permit\|deny <src> [<wildcard>]` | Standard numbered ACL |
| `ip access-list extended <name>` | Named extended ACL (enters ACL config sub-mode) |
| `ip access-list standard <name>` | Named standard ACL |

**DHCP:**

| Command | Description |
|---------|-------------|
| `ip dhcp pool <name>` | Create DHCP pool (enters pool config) |
| `ip dhcp excluded-address <start> [<end>]` | Exclude addresses from DHCP |
| `ip dhcp snooping` | Enable DHCP snooping globally |
| `ip dhcp snooping vlan <range>` | Enable snooping on VLANs |
| `ip dhcp snooping information option` | Enable Option 82 |

**NAT:**

| Command | Description |
|---------|-------------|
| `ip nat pool <name> <start> <end> prefix-length <len>` | Create NAT pool |
| `ip nat inside source list <acl> pool <name> [overload]` | Dynamic NAT / PAT |
| `ip nat inside source static <local> <global>` | Static NAT mapping |

**Security:**

| Command | Description |
|---------|-------------|
| `ip arp inspection vlan <range>` | Enable DAI on VLANs |
| `ip arp inspection validate` | Configure ARP validation checks |
| `aaa new-model` | Enable AAA |
| `aaa authentication login <list> <methods>` | Configure authentication method list |
| `aaa authorization <type> <list> <methods>` | Configure authorization |
| `aaa accounting <type> <list> <methods>` | Configure accounting |
| `radius-server host <ip> auth-port <p> acct-port <p> key <key>` | Configure RADIUS server |
| `tacacs-server host <ip> key <key>` | Configure TACACS+ server |
| `dot1x system-auth-control` | Enable 802.1X globally |
| `authentication mac-move permit` | Allow MAC to move between ports |
| `errdisable recovery cause <cause>` | Enable err-disable auto-recovery |
| `errdisable recovery interval <sec>` | Set recovery interval |
| `udld aggressive` / `udld enable` | Enable UDLD |

**Spanning Tree:**

| Command | Description |
|---------|-------------|
| `spanning-tree mode pvst\|rapid-pvst\|mst` | Set STP mode |
| `spanning-tree vlan <id> priority <val>` | Set bridge priority |
| `spanning-tree vlan <id> root primary\|secondary` | Set root bridge macro |
| `spanning-tree vlan <id> max-age <sec>` | Set max age |
| `spanning-tree vlan <id> hello-time <sec>` | Set hello time |
| `spanning-tree vlan <id> forward-time <sec>` | Set forward delay |
| `spanning-tree portfast default` | Enable PortFast globally |
| `spanning-tree portfast bpduguard default` | Enable BPDU Guard globally |
| `spanning-tree loopguard default` | Enable Loop Guard globally |
| `spanning-tree backbonefast` | Enable BackboneFast |
| `spanning-tree mst configuration` | Enter MST config sub-mode |
| `spanning-tree mst <instance> priority <val>` | Set MST instance priority |

**MST Config Sub-mode** (`SW1(config-mst)#`):

| Command | Description |
|---------|-------------|
| `name <name>` | Set MST region name |
| `revision <n>` | Set MST revision number |
| `instance <n> vlan <range>` | Map VLANs to MST instance |

**Management:**

| Command | Description |
|---------|-------------|
| `ntp server <ip>` | Configure NTP server |
| `ntp master [<stratum>]` | Configure device as NTP master |
| `ntp authenticate` | Enable NTP authentication |
| `ntp authentication-key <id> md5 <key>` | Configure NTP auth key |
| `ntp trusted-key <id>` | Mark NTP key as trusted |
| `ntp source <interface>` | Set NTP source interface |
| `logging <ip>` | Configure remote syslog server |
| `logging buffered <level>` | Set local syslog buffer level |
| `cdp run` / `no cdp run` | Enable or disable CDP globally |
| `cdp timer <sec>` | Set CDP advertisement interval |
| `cdp holdtime <sec>` | Set CDP hold time |
| `lldp run` / `no lldp run` | Enable or disable LLDP globally |
| `vtp domain <name>` | Set VTP domain |
| `vtp mode server\|client\|transparent\|off` | Set VTP mode |
| `vtp version 1\|2\|3` | Set VTP version |
| `vtp password <pw>` | Set VTP password |
| `vtp pruning` | Enable VTP pruning |
| `snmp-server community <name> ro\|rw [<acl>]` | Configure SNMP community |
| `snmp-server location <text>` | Set SNMP system location |
| `snmp-server contact <text>` | Set SNMP system contact |
| `snmp-server host <ip> <community> version <ver>` | Configure SNMP trap host |
| `snmp-server enable traps` | Enable SNMP traps |

**QoS:**

| Command | Description |
|---------|-------------|
| `mls qos` | Enable MLS QoS globally |
| `class-map [match-all\|match-any] <name>` | Create QoS class-map |
| `match access-group\|dscp\|cos\|ip-precedence\|any` | Class-map match criteria (in class-map mode) |
| `policy-map <name>` | Create QoS policy-map |
| `class <class-map>` | Add class to policy-map (in policy-map mode) |
| `police <rate> <burst> <excess> exceed-action <action>` | Traffic policing |
| `priority <kbps>` | LLQ priority queue |
| `bandwidth <kbps>` | Minimum bandwidth guarantee |
| `set dscp\|cos\|ip-precedence <val>` | Mark traffic |

**SPAN:**

| Command | Description |
|---------|-------------|
| `monitor session <id> source interface <id> [rx\|tx\|both]` | Configure SPAN source |
| `monitor session <id> source vlan <id>` | Configure VLAN SPAN source |
| `monitor session <id> destination interface <id>` | Configure SPAN destination |
| `no monitor session <id>` | Remove SPAN session |

**IP SLA:**

| Command | Description |
|---------|-------------|
| `ip sla <id>` | Create IP SLA entry |
| `ip sla schedule <id> life <forever\|sec> start-time now [recurring]` | Schedule IP SLA probe |
| `no ip sla <id>` | Remove IP SLA entry |

**Navigation:**

| Command | Description |
|---------|-------------|
| `interface <id>` | Enter interface config (Fa, Gi, Vlan, Loopback) |
| `interface range <range>` | Enter config for multiple interfaces |
| `vlan <id>` | Create / configure VLAN |
| `line console 0` | Enter console line config |
| `line vty 0 4` | Enter VTY line config |
| `router ospf <pid>` | Enter OSPF router config |
| `router eigrp <asn>` | Enter EIGRP router config |
| `router bgp <asn>` | Enter BGP router config |
| `do <cmd>` | Run exec command without leaving config mode |

### Interface Config (`SW1(config-if)#`)

| Command | Description |
|---------|-------------|
| `description <text>` | Set interface description |
| `ip address <ip> <mask>` | Assign primary IP address |
| `ip address <ip> <mask> secondary` | Add secondary IP |
| `no ip address` | Remove all IP addresses |
| `shutdown` / `no shutdown` | Administratively disable / enable |
| `duplex auto\|full\|half` | Set duplex |
| `speed auto\|10\|100\|1000` | Set speed |
| `mtu <bytes>` | Set MTU |
| `switchport mode access\|trunk\|dynamic-auto\|dynamic-desirable` | Set switchport mode |
| `switchport access vlan <id>` | Assign access VLAN |
| `switchport trunk encapsulation dot1q` | Set trunk encapsulation |
| `switchport trunk allowed vlan <list>` | Set allowed VLANs (supports `add`, `remove`, `except`, `all`, `none`) |
| `switchport trunk native vlan <id>` | Set native VLAN on trunk |
| `switchport nonegotiate` | Disable DTP negotiation |
| `switchport voice vlan <id>` | Assign voice VLAN |
| `switchport port-security` | Enable port security |
| `switchport port-security maximum <n>` | Set max secure MACs |
| `switchport port-security violation protect\|restrict\|shutdown` | Set violation action |
| `switchport port-security sticky` | Enable sticky MAC learning |
| `spanning-tree portfast` | Enable PortFast |
| `spanning-tree bpduguard enable` | Enable BPDU Guard |
| `spanning-tree bpdufilter enable` | Enable BPDU Filter |
| `spanning-tree guard root\|loop` | Enable Root Guard or Loop Guard |
| `spanning-tree link-type point-to-point\|shared` | Set link type |
| `spanning-tree cost <n>` | Set STP port cost |
| `spanning-tree port-priority <n>` | Set STP port priority |
| `channel-group <n> mode active\|passive\|on\|desirable\|auto` | Assign to EtherChannel |
| `storm-control broadcast level <pct>` | Set broadcast storm threshold |
| `ip helper-address <ip>` | Configure DHCP relay agent |
| `ip access-group <acl> in\|out` | Apply ACL to interface |
| `ip ospf cost <n>` | Override OSPF interface cost |
| `ip ospf priority <n>` | Set OSPF DR/BDR priority |
| `ip dhcp snooping trust` | Mark port as DHCP snooping trusted |
| `ip dhcp snooping rate limit <pps>` | Set DHCP rate limit |
| `ip arp inspection trust` | Mark port as DAI trusted |
| `ip verify source` | Enable IP Source Guard |
| `ip nat inside\|outside` | Mark interface for NAT |
| `ip pim sparse-mode\|dense-mode\|sparse-dense-mode` | Enable PIM multicast |
| `ip igmp version <n>` | Set IGMP version |
| `ipv6 address <prefix/len> [eui-64]` | Assign IPv6 address |
| `ipv6 enable` | Enable IPv6 link-local |
| `standby <group> ip <vip>` | Configure HSRP virtual IP |
| `standby <group> priority <n>` | Set HSRP priority |
| `standby <group> preempt` | Enable HSRP preemption |
| `standby <group> timers <hello> <hold>` | Set HSRP timers |
| `standby <group> authentication <text>` | Set HSRP authentication |
| `vrrp <group> ip <vip>` | Configure VRRP virtual IP |
| `dot1x port-control auto\|force-authorized\|force-unauthorized` | Set 802.1X port control |
| `authentication port-control auto` | Enable 802.1X authentication |
| `mab` | Enable MAC Authentication Bypass |
| `service-policy input\|output <policy-map>` | Apply QoS policy-map |
| `mls qos trust cos\|dscp\|ip-precedence` | Set MLS QoS trust mode |
| `mls qos cos <val>` | Set default CoS value |
| `cdp enable` / `no cdp enable` | Enable / disable CDP per interface |
| `lldp transmit` / `no lldp transmit` | Enable / disable LLDP transmit |
| `lldp receive` / `no lldp receive` | Enable / disable LLDP receive |
| `power inline auto\|never\|static` | Set PoE mode |

### VLAN Config (`SW1(config-vlan)#`)

| Command | Description |
|---------|-------------|
| `name <name>` | Set VLAN name |
| `state active\|suspend` | Set VLAN state |
| `exit` | Return to global config |
| `end` | Return to privileged EXEC |

### Line Config (`SW1(config-line)#`)

| Command | Description |
|---------|-------------|
| `login` | Require line password for authentication |
| `login local` | Use local username database |
| `password <pw>` | Set line password |
| `exec-timeout <min> [<sec>]` | Set idle timeout (0 0 = disabled) |
| `transport input ssh\|telnet\|all\|none` | Set allowed protocols |
| `logging synchronous` | Prevent syslog from interrupting input |
| `privilege level <n>` | Set default privilege level |

### Router Config (`SW1(config-router)#`)

**OSPF:**

| Command | Description |
|---------|-------------|
| `network <ip> <wildcard> area <n>` | Advertise network into OSPF area |
| `router-id <ip>` | Set OSPF router ID |
| `passive-interface <iface>` | Suppress OSPF hellos on interface |
| `redistribute connected [subnets]` | Redistribute connected routes |
| `redistribute static [subnets]` | Redistribute static routes |
| `default-information originate [always]` | Originate default route into OSPF |

**EIGRP:**

| Command | Description |
|---------|-------------|
| `network <ip> [<wildcard>]` | Advertise network into EIGRP |
| `passive-interface <iface>` | Suppress EIGRP updates on interface |
| `redistribute connected` | Redistribute connected routes |
| `redistribute static` | Redistribute static routes |

**BGP:**

| Command | Description |
|---------|-------------|
| `network <ip> mask <mask>` | Advertise network into BGP |
| `neighbor <ip> remote-as <asn>` | Define BGP peer |

---

## Simulated Protocols

| Protocol | What is simulated |
|----------|-------------------|
| **OSPF** | Process, router-id, area networks, neighbors (FULL state), redistribute, passive-interface, default-information originate |
| **EIGRP** | AS number, networks, neighbors, redistribute |
| **BGP** | AS number, networks, neighbor peering (Established state), `show ip bgp summary` |
| **STP / RSTP** | Per-VLAN root bridge, port roles (root/designated/alternate), port states, priority, PortFast, BPDU Guard/Filter, Root Guard, Loop Guard, BackboneFast |
| **MST** | Region name/revision, instance-to-VLAN mapping, per-instance bridge priority |
| **HSRP** | Group number, virtual IP, priority, preemption, timers, authentication, Active/Standby state; `show standby` / `show standby brief` |
| **VRRP** | Group configuration, state; `show vrrp` / `show vrrp brief` |
| **LACP / PAgP** | Port-channel creation, member tracking, protocol mode (active/passive/on/desirable/auto), `show etherchannel summary` |
| **CDP** | Neighbor table (device ID, platform, IOS version, IP, native VLAN, duplex), per-interface enable/disable, global timer/holdtime |
| **LLDP** | Neighbor table, per-interface transmit/receive control |
| **VTP** | Domain, mode, version, password, pruning, config revision, `show vtp status` |
| **SNMP** | Communities (ro/rw), location, contact, trap hosts, `show snmp` |
| **NTP** | Server synchronization, stratum, master mode, authentication keys, trusted keys, source interface |
| **DHCP** | Pools (network, router, DNS, lease), excluded addresses, bindings, conflict detection |
| **NAT** | Static mappings, dynamic pools, PAT/overload, inside/outside interface marking |
| **AAA** | `aaa new-model`, authentication/authorization/accounting lists, RADIUS and TACACS+ server config |
| **802.1X / MAB** | `dot1x system-auth-control`, per-interface port-control, MAB, authentication sessions |
| **IP SLA** | ICMP-echo probes, schedule (life/start-time/recurring), statistics and history |
| **QoS** | MLS QoS trust (CoS/DSCP/IP precedence), class-maps, policy-maps with police/priority/bandwidth/set, service-policy application |
| **SPAN** | Local SPAN sessions, source ports (rx/tx/both), source VLANs, destination port |
| **DHCP Snooping** | Per-VLAN enable, trusted ports, rate limiting, binding table, Option 82 |
| **Dynamic ARP Inspection** | Per-VLAN enable, trusted ports, logging |
| **IP Source Guard** | Per-interface enable, binding table |
| **Multicast** | PIM (sparse/dense), IGMP groups, multicast routing table (`show ip mroute`) |
| **Port Security** | Max MACs, sticky learning, violation actions (protect/restrict/shutdown), err-disabled state |
| **PoE** | Per-interface inline power mode (auto/never/static), `show power inline` |
| **Storm Control** | Per-interface broadcast level threshold |
| **Err-disable** | Recovery cause and interval configuration; `show errdisable recovery` / `show errdisable detect` |

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Tab` | Context-aware command completion (works for `no <cmd>` too) |
| `?` | Context-sensitive help at cursor — full sub-trees supported (e.g. `show ip ?`, `debug ip ospf ?`) |
| `Up` / `Down` | Navigate command history |
| `Ctrl+R` | Reverse-search through history |
| `Ctrl+A` | Jump to beginning of line |
| `Ctrl+E` | Jump to end of line |
| `Ctrl+C` | Interrupt / return to exec prompt |
| `Ctrl+Z` | End — return to privileged EXEC from any config mode |
| `F1` | Toggle keyboard shortcuts / CLI modes help overlay |
| `!` | Comment line (ignored, as on real IOS) |

---

## Default Device Configuration

The simulator loads with a fully pre-configured switch. No setup required.

| Property | Value |
|----------|-------|
| Hostname | SW1 |
| Model | Cisco Catalyst WS-C2960X-48TS-L |
| IOS Version | 15.2(7)E6 (enterprise-LAN train) |
| IOS Image | `c2960x-universalk9-mz.152-7.E6.bin` |
| Boot Loader | C2960X-HBOOT-M Version 15.2(7r)E2 |
| Serial Number | FOC2048Z0TN |
| Enable Secret | `cisco123` |
| Domain Name | `corp.local` |
| NTP Server | 192.168.1.254 (synchronized, stratum 3) |
| IP Routing | Enabled |

**Interfaces:**

| Interface | State | Mode | VLAN / IP | Description |
|-----------|-------|------|-----------|-------------|
| Fa0/1 | up/up | access | VLAN 10 | Office-PC-01 |
| Fa0/2 | notconnect | access | VLAN 10 | — |
| Fa0/3 | up/up | access | VLAN 10 | Office-PC-03 |
| Fa0/4 | notconnect | access | VLAN 10 | — |
| Fa0/5 | up/up | access | VLAN 20 | AP-FLOOR2 |
| Fa0/6–8 | notconnect | access | VLAN 10 | — |
| Fa0/7 | err-disabled | access | VLAN 10 | port-security violation |
| Fa0/9–16 | notconnect | access | VLAN 20 | — |
| Fa0/17–24 | notconnect | access | VLAN 99 | — |
| Gi0/1 | up/up | trunk | 1,10,20,30,99 | Uplink-to-CORE-SW1 |
| Gi0/2 | up/up | trunk | 1,10,20,30,99 | Uplink-to-CORE-SW2 |
| Loopback0 | up/up | routed | 1.1.1.1/32 | Router-ID |
| Vlan1 | up/up | SVI | 192.168.1.1/24 | — |
| Vlan10 | up/up | SVI | 10.10.10.1/24 | DATA |
| Vlan20 | up/up | SVI | 10.20.20.1/24 | VOICE |
| Vlan30 | up/up | SVI | 10.30.30.1/24 | MGMT |

**VLANs:**

| VLAN | Name | Ports |
|------|------|-------|
| 1 | default | — |
| 10 | DATA | Fa0/1–8 |
| 20 | VOICE | Fa0/9–16 |
| 30 | MGMT | — |
| 99 | NATIVE | Fa0/17–24 |
| 1002–1005 | (reserved) | — |

**Routing:**

- Default route: `S* 0.0.0.0/0` via 192.168.1.254
- OSPF process 1, router-id 1.1.1.1, FULL adjacency with CORE-SW1 (192.168.1.254)
- Connected and local routes for all SVIs

**CDP Neighbors:**

| Device ID | Local Port | Remote Port | Platform | IP |
|-----------|------------|-------------|----------|----|
| CORE-SW1 | Gi0/1 | Gi1/0/24 | WS-C3850 | 192.168.1.254 |
| CORE-SW2 | Gi0/2 | Gi1/0/24 | WS-C3850 | 192.168.1.253 |
| AP-FLOOR2 | Fa0/5 | Fa0 | AIR-CAP3702I | 10.20.20.50 |

**Local Users:**

| Username | Privilege | Auth |
|----------|-----------|------|
| admin | 15 | secret: `admin123` |
| readonly | 1 | password: `view` |

---

## Architecture

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript, bundled with Vite 6 |
| CLI Engine | Pure TypeScript dispatcher — IOS abbreviation matching, `no` prefix, pipe filters |
| State | React `useReducer` — device state plus per-session terminal history |
| Topology | HTML5 Canvas — RAF animation loop, ResizeObserver, packet-dot simulation |
| Serving | Nginx (static SPA, gzip, long-cache headers for hashed assets) |
| Container | Docker multi-stage build (Node 20 build stage → Nginx Alpine serve stage) |
| CI/CD | GitHub Actions → `ghcr.io/atvriders/cisco-sim` |

---

## CI/CD

Pushes to `master` build and publish Docker images via GitHub Actions:

```
ghcr.io/atvriders/cisco-sim:latest
ghcr.io/atvriders/cisco-sim:<sha>
```

The SHA tag enables rollback to any previous build.

---

## Development

```bash
npm install
npm run dev       # Vite dev server on :5173
npm run build     # Production build to dist/
npm run preview   # Preview production build locally
```

TypeScript check:

```bash
npx tsc --noEmit
```

Docker build:

```bash
docker build -t cisco-sim .
docker run -p 8080:80 cisco-sim
```

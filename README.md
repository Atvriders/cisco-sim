# Cisco IOS Switch Simulator

**A full Cisco IOS 15.7 CLI simulator running entirely in the browser.**

Simulates a Cisco Catalyst WS-C2960X-48TS-L with authentic command output, real-time interface stats, a live network topology diagram, and a phosphor-green CRT terminal aesthetic.

---

## Quickstart (Docker)

```bash
docker compose up -d
```

Open **http://localhost:8080**. No configuration needed.

To update to the latest build:

```bash
docker compose pull && docker compose up -d
```

---

## Local Development

```bash
npm install
npm run dev   # Vite dev server on :5173
```

Production build:

```bash
npm run build   # outputs to dist/
```

---

## Features

- **Full Cisco IOS 15.7 CLI** — output matches real hardware character-for-character
- **All CLI modes** — User EXEC `>`, Privileged EXEC `#`, Global Config, Interface Config, VLAN Config, Line Config, Router Config (OSPF/EIGRP/BGP)
- **IOS-style abbreviation** — `sh ip int bri`, `conf t`, `int fa0/1`, `no sh`, etc.
- **Tab completion** — context-aware, works across all modes and subcommands including interface names
- **`?` help system** — shows available commands and descriptions at any point in input
- **Command history** — ArrowUp/ArrowDown to navigate previous commands
- **Pipe filters** — `show run | include`, `show run | exclude`, `show run | begin`, `show run section`
- **Multi-session tabs** — Console + up to 4 VTY sessions, each with independent state
- **Network topology diagram** — canvas-based diagram showing SW1, CDP neighbors, link states, and animated traffic packets (toggle with ⬡ TOPO button)
- **Animated boot sequence** — full Cisco IOS ROM/POST boot with per-line timing
- **Live status panel** — interface up/down indicators, VLAN count, MAC table count, CPU/memory bars, live uptime, unsaved-changes indicator
- **Amber config-mode prompt** — prompt color shifts amber when in any config sub-mode
- **CRT aesthetic** — phosphor glow, scanlines, vignette overlay, POWER LED on boot screen
- **Pre-populated device** — SW1 (Catalyst 2960X), 24x FastEthernet, 2x GigabitEthernet, 5 VLANs, 3 CDP neighbors, ARP/MAC tables, OSPF adjacency, static routes

---

## Commands Reference

### User EXEC (`SW1>`)

| Command | Description |
|---------|-------------|
| `enable` | Enter privileged EXEC mode |
| `ping <ip>` | Send 5 ICMP echoes, report success rate |
| `traceroute <ip>` | Trace route to destination |
| `show ...` | Display system information |
| `ssh -l <user> <ip>` | Simulated SSH connection |
| `logout` / `exit` | End session |

### Privileged EXEC (`SW1#`)

| Command | Description |
|---------|-------------|
| `configure terminal` | Enter global configuration mode |
| `copy running-config startup-config` | Save configuration |
| `write memory` | Save configuration (alias for copy run start) |
| `erase startup-config` | Erase saved configuration |
| `reload` | Reload the device (with confirmation) |
| `clock set HH:MM:SS DD Mon YYYY` | Set system clock |
| `clear ...` | Clear counters, ARP, MAC table, logging, etc. |
| `debug ...` | Enable debug output for protocols |
| `undebug all` | Disable all debugging |
| `terminal length <n>` | Set terminal page length |
| `terminal width <n>` | Set terminal width |
| `disable` | Return to user EXEC mode |

### Show Commands (`SW1#` or with `do` from config modes)

| Command | Description |
|---------|-------------|
| `show version` | IOS version, uptime, hardware info, serial numbers |
| `show running-config` | Full active configuration |
| `show running-config section <kw>` | Show only matching config section |
| `show running-config interface <id>` | Show single interface config block |
| `show startup-config` | Saved (NVRAM) configuration |
| `show interfaces [<id>]` | Detailed interface counters and status |
| `show interfaces status` | One-line port status table with speed/duplex/VLAN |
| `show interfaces trunk` | Trunk port detail with allowed/active VLANs |
| `show ip interface brief` | Interface summary: IP, OK?, method, status, protocol |
| `show ip interface <id>` | Detailed Layer 3 interface info |
| `show vlan [brief]` | VLAN table including 1002-1005 reserved VLANs |
| `show mac address-table [dynamic]` | Layer 2 MAC address table |
| `show arp` | ARP cache |
| `show ip route` | IP routing table with codes legend |
| `show spanning-tree [vlan <id>]` | STP root/bridge/port state per VLAN |
| `show cdp neighbors [detail]` | CDP neighbor table or full detail |
| `show ip ospf neighbor` | OSPF adjacency table |
| `show ip eigrp neighbors` | EIGRP neighbor table |
| `show ip bgp summary` | BGP peer summary |
| `show processes cpu` | CPU utilization with per-process breakdown |
| `show memory` | Processor and I/O memory usage |
| `show flash` | Flash filesystem with IOS image filename |
| `show clock` | System clock |
| `show logging` | Syslog buffer and configuration |
| `show ntp status` | NTP synchronization detail |
| `show etherchannel summary` | Port-channel summary |
| `show port-security` | Port security summary |
| `show ip access-lists` | Access control list entries with hit counts |
| `show ip dhcp binding` | DHCP address bindings |
| `show ip dhcp pool` | DHCP pool configuration |
| `show ip dhcp conflict` | DHCP address conflicts |
| `show ip ssh` | SSH server status and version |
| `show users` | Active console and VTY sessions |
| `show sessions` | Outbound session list |
| `show terminal` | Terminal settings (length, width, baud) |
| `show history` | Command recall buffer |
| `show privilege` | Current privilege level |
| `show environment` | Hardware environment (fans, PSU, temperature) |

**Pipe filters** (works with `show running-config` and `show interfaces`):

```
show run | include <pattern>
show run | exclude <pattern>
show run | begin <pattern>
show run section interface
show interfaces | include <pattern>
```

### Clear Commands (`SW1#`)

| Command | Description |
|---------|-------------|
| `clear mac address-table dynamic` | Flush dynamic MAC entries |
| `clear arp-cache` | Clear ARP table |
| `clear counters [<interface>]` | Reset interface packet/byte counters |
| `clear ip ospf process` | Reset OSPF adjacencies (with confirmation) |
| `clear spanning-tree detected-protocols` | Re-detect STP protocol versions |
| `clear logging` | Clear syslog buffer |
| `clear line <n>` | Clear a terminal line session |

### Debug Commands (`SW1#`)

| Command | Description |
|---------|-------------|
| `debug ip ospf adj` | OSPF adjacency events |
| `debug ip ospf events` | OSPF general events |
| `debug ip rip` | RIP protocol updates |
| `debug ip packet` | IP packet processing |
| `debug spanning-tree events` | STP topology events |
| `undebug all` | Disable all active debugs |

### Global Config (`SW1(config)#`)

| Command | Description |
|---------|-------------|
| `hostname <name>` | Set device hostname |
| `enable secret <password>` | Set MD5-hashed privileged password |
| `enable password <password>` | Set plaintext privileged password |
| `service password-encryption` | Encrypt plaintext passwords in config |
| `banner motd <text>` | Set message-of-the-day banner |
| `ip routing` | Enable Layer 3 IP routing |
| `ip default-gateway <ip>` | Set default gateway (L2 mode) |
| `ip route <net> <mask> <next-hop>` | Add static route |
| `ip domain-name <domain>` | Set DNS domain name |
| `ip name-server <ip>` | Configure DNS server |
| `interface <id>` | Enter interface configuration |
| `interface range <range>` | Enter config for multiple interfaces |
| `vlan <id>` | Create/configure a VLAN |
| `line console 0` | Enter console line configuration |
| `line vty 0 4` | Enter VTY line configuration |
| `router ospf <pid>` | Enter OSPF router configuration |
| `router eigrp <asn>` | Enter EIGRP router configuration |
| `router bgp <asn>` | Enter BGP router configuration |
| `username <name> privilege <lvl> secret <pw>` | Create local user |
| `access-list <num> permit\|deny <src>` | Define standard ACL |
| `ip access-list extended <name>` | Define named extended ACL |
| `spanning-tree vlan <id> priority <val>` | Set STP bridge priority |
| `spanning-tree mode rapid-pvst\|pvst` | Set STP mode |
| `crypto key generate rsa modulus <bits>` | Generate RSA keys for SSH |
| `ntp server <ip>` | Configure NTP server |
| `logging <ip>` | Configure syslog server |
| `logging buffered <level>` | Set local log buffer level |
| `cdp run` / `no cdp run` | Enable or disable CDP globally |
| `do <cmd>` | Run exec command from config mode |

### Interface Config (`SW1(config-if)#`)

| Command | Description |
|---------|-------------|
| `description <text>` | Set interface description |
| `ip address <ip> <mask>` | Assign IP address |
| `ip address <ip> <mask> secondary` | Add secondary IP |
| `no ip address` | Remove IP address |
| `shutdown` / `no shutdown` | Administratively disable/enable |
| `duplex auto\|full\|half` | Set duplex |
| `speed auto\|10\|100\|1000` | Set speed |
| `mtu <bytes>` | Set MTU |
| `switchport mode access\|trunk\|dynamic-auto` | Set switchport mode |
| `switchport access vlan <id>` | Assign access VLAN |
| `switchport trunk encapsulation dot1q` | Set trunk encapsulation |
| `switchport trunk allowed vlan <list>` | Set allowed VLANs (supports `add`, `remove`, `all`, `none`, `except`) |
| `switchport trunk native vlan <id>` | Set native VLAN on trunk |
| `switchport nonegotiate` | Disable DTP negotiation |
| `spanning-tree portfast` | Enable PortFast (access ports) |
| `spanning-tree bpduguard enable` | Enable BPDU Guard |
| `spanning-tree bpdufilter enable` | Enable BPDU Filter |
| `spanning-tree cost <n>` | Set STP port cost |
| `spanning-tree port-priority <n>` | Set STP port priority |
| `channel-group <n> mode active\|passive\|on` | Assign to EtherChannel (LACP/PAgP) |
| `port-security` | Enable port security |
| `port-security maximum <n>` | Set max secure MAC addresses |
| `port-security violation protect\|restrict\|shutdown` | Set violation action |
| `storm-control broadcast level <pct>` | Set broadcast storm threshold |
| `ip helper-address <ip>` | Configure DHCP relay agent |
| `ip access-group <acl> in\|out` | Apply ACL to interface |
| `ip ospf cost <n>` | Override OSPF interface cost |
| `ip ospf priority <n>` | Set OSPF DR/BDR priority |
| `do <cmd>` | Run exec command from interface config |

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
| `login` | Enable password authentication |
| `login local` | Enable local username/password auth |
| `password <pw>` | Set line password |
| `exec-timeout <min> [<sec>]` | Set idle timeout (0 0 = never) |
| `transport input ssh\|telnet\|all\|none` | Set allowed protocols |
| `logging synchronous` | Prevent log messages from interrupting input |
| `privilege level <n>` | Set default privilege level for this line |

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
| `redistribute connected` / `redistribute static` | Redistribute routes |

**BGP:**

| Command | Description |
|---------|-------------|
| `network <ip> mask <mask>` | Advertise network into BGP |
| `neighbor <ip> remote-as <asn>` | Define BGP peer |

---

## Default Device Configuration

The simulator loads with a fully pre-configured Cisco switch:

| Property | Value |
|----------|-------|
| Hostname | SW1 |
| Model | Cisco Catalyst WS-C2960X-48TS-L |
| IOS Version | 15.7(3)M3 |
| Serial | FOC2048Z0TN |
| Enable Secret | `cisco123` |
| Domain Name | `corp.local` |
| NTP Server | 192.168.1.254 (synchronized, stratum 3) |

**Interfaces:**

| Interface | State | Mode | VLAN/IP | Description |
|-----------|-------|------|---------|-------------|
| Fa0/1 | up/up | access | VLAN 10 | Office-PC-01 |
| Fa0/2–8 | notconnect | access | VLAN 10 | — |
| Fa0/3 | up/up | access | VLAN 10 | Office-PC-03 |
| Fa0/5 | up/up | access | VLAN 20 | AP-FLOOR2 |
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

**Routing:**
- IP routing enabled
- Default route: `S* 0.0.0.0/0` via 192.168.1.254
- OSPF process 1, router-id 1.1.1.1 — FULL adjacency with CORE-SW1 (192.168.1.254)
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

## UI

| Element | Description |
|---------|-------------|
| Title bar | "CISCO IOS SIMULATOR \| WS-C2960X-48TS-L \| IOS 15.7(3)M3" |
| Session tabs | CON 0 + up to VTY 0–3; amber dot when unsaved changes |
| ⬡ TOPO button | Toggle network topology diagram view |
| Terminal | Phosphor-green text, scanline overlay, CRT vignette, amber prompt in config modes |
| Status panel | Interface status grid, VLAN/MAC counts, CPU/memory bars, live uptime, SAVED/UNSAVED indicator |
| Boot screen | Black background, near-white ROM text, amber POWER LED, fade-to-black transition |
| Scroll button | Floating ⬇ button appears when scrolled up; click to jump to latest output |

---

## Architecture

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript, bundled with Vite 6 |
| CLI Engine | Pure TypeScript dispatcher — IOS abbreviation matching, `no` prefix, pipe filters |
| State | `useReducer` — device state + per-session terminal history |
| Topology | HTML5 Canvas — RAF animation, ResizeObserver, packet-dot simulation |
| Serving | Nginx (static SPA, gzip, long-cache headers for assets) |
| Container | Docker multi-stage (Node 20 build → Nginx Alpine serve) |
| CI/CD | GitHub Actions → `ghcr.io/atvriders/cisco-sim` |

---

## CI/CD

Pushes to `master` build and publish Docker images via GitHub Actions:

```
ghcr.io/atvriders/cisco-sim:latest
ghcr.io/atvriders/cisco-sim:<sha>
```

The SHA tag enables rollback to any previous build.

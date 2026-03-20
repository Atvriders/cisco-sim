# Cisco IOS Switch Simulator

**A full Cisco IOS 15.7 CLI simulator running entirely in the browser.**

---

## Quickstart (Docker)

```bash
docker compose up -d
```

Open http://localhost:8080. No configuration needed.

To update:

```bash
docker compose pull && docker compose up -d
```

---

## Local Development

```bash
npm install
npm run dev   # Vite dev server on :5173
```

---

## Features

- Full Cisco IOS CLI with all major commands
- All CLI modes: User EXEC, Privileged EXEC, Global Config, Interface Config, VLAN Config, Line Config, Router (OSPF/EIGRP/BGP) Config
- IOS-style abbreviation: `sh ip int bri`, `conf t`, `int fa0/1` etc.
- Tab completion and `?` context-sensitive help
- Command history (ArrowUp/ArrowDown)
- Multi-session tabs (Console + up to 4 VTY sessions)
- Animated Cisco IOS boot sequence
- Real-time interface status panel
- Pre-populated device: SW1 (Catalyst 2960X), 24x FastEthernet, 2x GigabitEthernet, VLANs, CDP neighbors, routes

---

## Commands Reference

### User EXEC (`SW1>`)

| Command | Description |
|---------|-------------|
| `enable` | Enter privileged EXEC mode |
| `ping <ip>` | Send ICMP echo |
| `traceroute <ip>` | Trace route to destination |
| `show ...` | Display system information |
| `logout` / `exit` | End session |

### Privileged EXEC (`SW1#`)

| Command | Description |
|---------|-------------|
| `configure terminal` | Enter global configuration mode |
| `copy running-config startup-config` | Save configuration |
| `write memory` | Save configuration (alias) |
| `erase startup-config` | Erase saved configuration |
| `reload` | Reload the device |
| `show ...` | (all show commands) |
| `clock set HH:MM:SS DD Mon YYYY` | Set system clock |

### Show Commands (`SW1#`)

| Command | Description |
|---------|-------------|
| `show version` | IOS version, uptime, hardware info |
| `show running-config` | Active configuration |
| `show startup-config` | Saved configuration |
| `show interfaces` | Detailed interface statistics |
| `show ip interface brief` | Interface summary with IP and status |
| `show vlan brief` | VLAN table |
| `show mac address-table` | Layer 2 MAC address table |
| `show arp` | ARP table |
| `show ip route` | IP routing table |
| `show spanning-tree` | Spanning tree state per VLAN |
| `show cdp neighbors` | CDP neighbor summary |
| `show cdp neighbors detail` | Detailed CDP neighbor info |
| `show ip ospf neighbor` | OSPF neighbor adjacencies |
| `show ip eigrp neighbors` | EIGRP neighbor table |
| `show ip bgp summary` | BGP peer summary |
| `show processes cpu` | CPU utilization |
| `show memory` | Memory utilization |
| `show flash` | Flash filesystem |
| `show clock` | System clock |
| `show logging` | Syslog buffer |
| `show ntp status` | NTP synchronization status |
| `show etherchannel summary` | EtherChannel port-channel summary |
| `show port-security` | Port security summary |
| `show ip access-lists` | Access control lists |
| `show users` | Active sessions |
| `show history` | Command history |
| `show privilege` | Current privilege level |
| `show environment` | Hardware environment (power, temp) |

### Global Config (`SW1(config)#`)

| Command | Description |
|---------|-------------|
| `hostname <name>` | Set device hostname |
| `enable secret <password>` | Set privileged EXEC password |
| `service password-encryption` | Encrypt plaintext passwords |
| `banner motd <text>` | Set message-of-the-day banner |
| `ip routing` | Enable Layer 3 routing |
| `ip default-gateway <ip>` | Set default gateway |
| `ip route <net> <mask> <next-hop>` | Add static route |
| `interface <id>` | Enter interface configuration |
| `vlan <id>` | Create/configure a VLAN |
| `line console 0` / `line vty 0 4` | Enter line configuration |
| `router ospf <pid>` | Enter OSPF router configuration |
| `router eigrp <asn>` | Enter EIGRP router configuration |
| `router bgp <asn>` | Enter BGP router configuration |
| `username <name> privilege <lvl> secret <pw>` | Create local user |
| `access-list <acl> permit/deny ...` | Define access list |
| `spanning-tree vlan <id> priority <val>` | Set STP bridge priority |
| `crypto key generate rsa` | Generate RSA keys for SSH |
| `ntp server <ip>` | Configure NTP server |
| `logging <ip>` | Configure syslog server |
| `ip domain-name <domain>` | Set DNS domain name |
| `cdp run` / `no cdp run` | Enable or disable CDP globally |

### Interface Config (`SW1(config-if)#`)

| Command | Description |
|---------|-------------|
| `description <text>` | Set interface description |
| `ip address <ip> <mask>` | Assign IP address |
| `shutdown` / `no shutdown` | Disable or enable interface |
| `switchport mode access\|trunk` | Set switchport mode |
| `switchport access vlan <id>` | Assign access VLAN |
| `switchport trunk allowed vlan <list>` | Set trunk allowed VLANs |
| `spanning-tree portfast` | Enable PortFast |
| `spanning-tree bpduguard enable` | Enable BPDU Guard |
| `channel-group <n> mode active\|passive\|on` | Assign to EtherChannel |
| `port-security` | Enable port security |
| `port-security maximum <n>` | Set max secure MAC addresses |
| `port-security violation protect\|restrict\|shutdown` | Set violation action |
| `port-security mac-address sticky` | Enable sticky MAC learning |
| `duplex auto\|full\|half` | Set duplex mode |
| `speed auto\|10\|100\|1000` | Set interface speed |
| `mtu <bytes>` | Set MTU |
| `ip helper-address <ip>` | Configure DHCP relay |
| `ip access-group <acl> in\|out` | Apply access list |

### VLAN Config (`SW1(config-vlan)#`)

| Command | Description |
|---------|-------------|
| `name <name>` | Set VLAN name |
| `state active\|suspend` | Set VLAN state |
| `exit` | Return to global config |

### Line Config (`SW1(config-line)#`)

| Command | Description |
|---------|-------------|
| `login local` | Require local authentication |
| `password <pw>` | Set line password |
| `exec-timeout <min> <sec>` | Set idle timeout |
| `transport input ssh\|telnet\|all` | Set allowed transport protocols |
| `logging synchronous` | Synchronize log messages with prompts |
| `privilege level <n>` | Set default privilege level |

### Router Config (`SW1(config-router)#`)

| Command | Description |
|---------|-------------|
| `network <ip> <wildcard> area <n>` | Advertise network (OSPF) |
| `network <ip> <wildcard>` | Advertise network (EIGRP) |
| `neighbor <ip> remote-as <asn>` | Define BGP neighbor |
| `router-id <ip>` | Set router ID |
| `passive-interface <iface>` | Suppress routing updates on interface |
| `redistribute connected\|static` | Redistribute routes |
| `default-information originate` | Advertise default route (OSPF) |

---

## Default Device Configuration

The simulator loads with a fully pre-configured device:

| Property | Value |
|----------|-------|
| Hostname | SW1 |
| Model | Cisco Catalyst WS-C2960X-48TS-L |
| IOS Version | 15.7(3)M3 |
| Enable Secret | `cisco123` |
| Domain Name | `corp.local` |

**Interfaces:**
- 24x FastEthernet (Fa0/1-24)
- 2x GigabitEthernet (Gi0/1-2) — trunk uplinks to CORE-SW1 and CORE-SW2
- Loopback0 — 1.1.1.1/32 (Router-ID)

**VLANs:**

| VLAN | Name | Ports |
|------|------|-------|
| 1 | default | Fa0/17-24 |
| 10 | DATA | Fa0/1-8 |
| 20 | VOICE | Fa0/9-16 |
| 30 | MGMT | (none) |
| 99 | NATIVE | Fa0/17-24 |

**VLAN SVIs:**

| Interface | IP Address | Description |
|-----------|------------|-------------|
| Vlan1 | 192.168.1.1/24 | Management VLAN |
| Vlan10 | 10.10.10.1/24 | DATA VLAN SVI |
| Vlan20 | 10.20.20.1/24 | VOICE VLAN SVI |
| Vlan30 | 10.30.30.1/24 | MGMT VLAN SVI |

**Routing:**
- IP routing enabled
- Default route: `0.0.0.0/0` via 192.168.1.254
- OSPF process 1, router-id 1.1.1.1, area 0 — neighbor FULL with 192.168.1.254

**CDP Neighbors:**

| Device | Local Port | Remote Port | Platform |
|--------|------------|-------------|----------|
| CORE-SW1 | Gi0/1 | Gig 1/0/24 | WS-C3850 |
| CORE-SW2 | Gi0/2 | Gig 1/0/24 | WS-C3850 |
| AP-FLOOR2 | Fa0/5 | Fas 0 | AIR-CAP3702I |

**Notable interface states:**
- Fa0/1 — up, `Office-PC-01` (VLAN 10)
- Fa0/3 — up, `Office-PC-03` (VLAN 10)
- Fa0/5 — up, `AP-FLOOR2` (VLAN 20)
- Fa0/7 — err-disabled (port-security violation)
- Gi0/1, Gi0/2 — up, trunk mode

---

## Architecture

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript, bundled with Vite |
| CLI Engine | Pure TypeScript command dispatcher with IOS abbreviation matching |
| State | `useReducer` state machine (device state + terminal sessions) |
| Serving | Nginx (static SPA) |
| Container | Docker, image published to GHCR |

---

## CI/CD

Pushes to `master` build and publish a Docker image via GitHub Actions:

```
ghcr.io/atvriders/cisco-sim:latest
```

Also tagged with the commit SHA for rollback:

```
ghcr.io/atvriders/cisco-sim:<sha>
```

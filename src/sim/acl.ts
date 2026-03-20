import type { DeviceState } from './types';

// Convert wildcard mask to bitmask for matching
function wildcardMatch(ip: string, network: string, wildcard: string): boolean {
  // Handle "any" and "host x.x.x.x"
  if (network === 'any') return true;
  if (network === '0.0.0.0' && wildcard === '255.255.255.255') return true;

  const ipParts = ip.split('.').map(Number);
  const netParts = network.split('.').map(Number);
  const wcParts = (wildcard || '0.0.0.0').split('.').map(Number);

  for (let i = 0; i < 4; i++) {
    if ((ipParts[i] & ~wcParts[i]) !== (netParts[i] & ~wcParts[i])) return false;
  }
  return true;
}

export type AclResult = 'permit' | 'deny' | 'implicit-deny';

export function matchAcl(
  aclName: string,
  srcIp: string,
  dstIp: string | undefined,
  protocol: string | undefined,
  state: DeviceState
): AclResult {
  const acl = state.acls[aclName];
  if (!acl) return 'permit'; // No ACL = permit all

  for (const entry of acl.entries) {
    const srcMatch = wildcardMatch(srcIp, entry.source, entry.sourceMask || '0.0.0.0');
    const dstMatch = !dstIp || !entry.destination || wildcardMatch(dstIp, entry.destination, entry.destinationMask || '0.0.0.0');
    const protoMatch = !protocol || !entry.protocol || entry.protocol === 'ip' || entry.protocol === protocol;

    if (srcMatch && dstMatch && protoMatch) {
      entry.matches++; // Increment hit counter
      return entry.action;
    }
  }
  return 'implicit-deny';
}

// Check if a ping from this device to targetIp would be permitted
// by any ACLs applied to the egress/ingress interfaces
export function pingPermitted(targetIp: string, state: DeviceState): boolean {
  // Find the outgoing interface for this destination
  const route = findRoute(targetIp, state);
  if (!route) return false;

  const ifId = route.interface;
  if (!ifId) return false;

  const iface = state.interfaces[ifId];
  if (!iface) return true;

  // Check outbound ACL
  const outAcl = iface.ipAccessGroups.find(g => g.direction === 'out');
  if (outAcl) {
    const result = matchAcl(outAcl.acl, '127.0.0.1', targetIp, 'icmp', state);
    if (result === 'deny') return false;
  }

  return true;
}

export function findRoute(targetIp: string, state: DeviceState): { interface?: string; nextHop?: string } | null {
  // Check if IP is in any directly connected subnet
  for (const iface of Object.values(state.interfaces)) {
    if (iface.adminState !== 'up' || iface.lineState !== 'up') continue;
    for (const addr of iface.ipAddresses) {
      if (sameSubnet(targetIp, addr.address, addr.mask)) {
        return { interface: iface.id };
      }
    }
  }

  // Check static/dynamic routes (longest prefix match)
  let bestMatch: { route: (typeof state.routes)[0]; prefixLen: number } | null = null;
  for (const route of state.routes) {
    if (route.source === 'L') continue; // Skip local host routes for routing
    if (matchPrefix(targetIp, route.network, route.mask)) {
      const prefixLen = maskToPrefix(route.mask);
      if (!bestMatch || prefixLen > bestMatch.prefixLen) {
        bestMatch = { route, prefixLen };
      }
    }
  }

  if (bestMatch) {
    return { interface: bestMatch.route.interface, nextHop: bestMatch.route.nextHop };
  }

  return null;
}

function sameSubnet(ip: string, network: string, mask: string): boolean {
  const ipParts = ip.split('.').map(Number);
  const netParts = network.split('.').map(Number);
  const maskParts = mask.split('.').map(Number);

  for (let i = 0; i < 4; i++) {
    if ((ipParts[i] & maskParts[i]) !== (netParts[i] & maskParts[i])) return false;
  }
  return true;
}

function matchPrefix(ip: string, network: string, mask: string): boolean {
  if (network === '0.0.0.0' && mask === '0.0.0.0') return true; // default route
  return sameSubnet(ip, network, mask);
}

function maskToPrefix(mask: string): number {
  return mask.split('.').reduce((acc, octet) => {
    let n = parseInt(octet);
    let bits = 0;
    while (n) { bits += n & 1; n >>= 1; }
    return acc + bits;
  }, 0);
}

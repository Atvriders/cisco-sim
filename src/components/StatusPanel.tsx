import { useMemo, useEffect, useState, useRef } from 'react';
import type { DeviceState } from '../sim/types';

interface Props {
  deviceState: DeviceState;
}

function formatUptime(ms: number): string {
  const secs = Math.floor(ms / 1000);
  const mins = Math.floor(secs / 60) % 60;
  const hours = Math.floor(secs / 3600) % 24;
  const days = Math.floor(secs / 86400);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m ${secs % 60}s`;
}

function shortIfName(id: string): string {
  return id
    .replace('FastEthernet', 'Fa')
    .replace('GigabitEthernet', 'Gi')
    .replace('Loopback', 'Lo')
    .replace('Vlan', 'Vl');
}

function modeLabel(mode: string): string {
  switch (mode) {
    case 'user-exec':    return 'USER EXEC';
    case 'priv-exec':    return 'PRIV EXEC';
    case 'global-config': return 'GLOBAL CFG';
    case 'if-config':    return 'IF CONFIG';
    case 'vlan-config':  return 'VLAN CFG';
    case 'line-config':  return 'LINE CFG';
    case 'router-ospf':  return 'ROUTER OSPF';
    case 'router-eigrp': return 'ROUTER EIGRP';
    case 'router-bgp':   return 'ROUTER BGP';
    default:             return mode.toUpperCase();
  }
}

export default function StatusPanel({ deviceState }: Props) {
  // Live uptime counter — tick wall-clock independently so uptime advances smoothly
  // between TICK dispatches. We do NOT add (currentTime - bootTime) here because
  // deviceState.currentTime is already updated by the TICK action every second;
  // combining both would double-count the elapsed seconds since mount.
  const [liveTime, setLiveTime] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setLiveTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Compute uptime purely from the device's own bootTime vs the live wall clock.
  // bootTime is set to Date.now() at device boot/reload so this is always accurate.
  const elapsed = liveTime - deviceState.bootTime;
  const uptime = formatUptime(elapsed);

  // Stable CPU value using useMemo seeded once - won't change on re-renders
  const cpuPct = useMemo(() => 2 + Math.floor(Math.random() * 6), []);
  const memUsed = 131072;
  const memTotal = 262144;
  const memPct = Math.round((memUsed / memTotal) * 100);

  // Physical interfaces only (Fa and Gi, no Loopback/Vlan SVIs)
  const physicalIfaces = Object.values(deviceState.interfaces)
    .filter(i => i.id.startsWith('Fa') || i.id.startsWith('Gi'))
    .sort((a, b) => {
      const ap = a.id.startsWith('Gi') ? 1 : 0;
      const bp = b.id.startsWith('Gi') ? 1 : 0;
      if (ap !== bp) return ap - bp;
      return a.port - b.port;
    });

  const vlans = Object.values(deviceState.vlans).sort((a, b) => a.id - b.id);
  const macCount = deviceState.macTable.length;
  const enableSecretSet = !!(deviceState.enableSecret);

  return (
    <div className="status-panel">
      <div>
        <div className="status-section-title">◈ DEVICE STATUS</div>
        <div className="status-hostname">{deviceState.hostname}</div>
        <div className="status-mode">{modeLabel(deviceState.mode)}</div>
      </div>

      <div>
        <div className="status-section-title">UPTIME</div>
        <div style={{ color: '#33ff33', fontSize: 12 }}>{uptime}</div>
      </div>

      {/* Save status */}
      <div>
        {deviceState.unsavedChanges ? (
          <div className="status-unsaved">⚠ UNSAVED CHANGES</div>
        ) : (
          <div className="status-saved">✓ SAVED</div>
        )}
      </div>

      {/* Security status */}
      <div>
        <div className="status-section-title">SECURITY</div>
        {enableSecretSet ? (
          <div style={{ color: '#33ff33', fontSize: 10 }}>✓ Enable secret set</div>
        ) : (
          <div style={{ color: '#ff4444', fontSize: 10 }}>✗ No enable secret</div>
        )}
      </div>

      {/* VLANs and MAC table counts */}
      <div>
        <div className="status-section-title">TABLE COUNTS</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
          <span style={{ color: '#555', fontSize: 10 }}>VLANs</span>
          <span style={{ color: '#33aa33', fontSize: 10 }}>{vlans.length}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#555', fontSize: 10 }}>MAC entries</span>
          <span style={{ color: '#33aa33', fontSize: 10 }}>{macCount}</span>
        </div>
      </div>

      <div>
        <div className="status-section-title">INTERFACES</div>
        <div className="if-grid">
          {physicalIfaces.map(iface => {
            const dotClass = iface.lineState === 'up' ? 'up'
              : iface.lineState === 'err-disabled' ? 'err-disabled'
              : iface.lineState === 'notconnect' ? 'notconnect'
              : 'down';
            return (
              <div key={iface.id} className="if-item">
                <div className={`if-dot ${dotClass}`} />
                <span className="if-label">{shortIfName(iface.id)}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <div className="status-section-title">VLANS</div>
        {vlans.map(v => (
          <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
            <span style={{ color: '#555', fontSize: 10 }}>VLAN{v.id}</span>
            <span style={{ color: '#33aa33', fontSize: 10 }}>{v.name}</span>
          </div>
        ))}
      </div>

      <div>
        <div className="bar-label">
          <span>CPU</span>
          <span>{cpuPct}%</span>
        </div>
        <div className="bar-container">
          <div className="bar-fill cpu" style={{ width: `${cpuPct}%` }} />
        </div>
      </div>

      <div>
        <div className="bar-label">
          <span>MEM</span>
          <span>{memPct}%</span>
        </div>
        <div className="bar-container">
          <div className="bar-fill mem" style={{ width: `${memPct}%` }} />
        </div>
        <div style={{ color: '#333', fontSize: 9, marginTop: 2 }}>
          {(memUsed / 1024).toFixed(0)}MB / {(memTotal / 1024).toFixed(0)}MB
        </div>
      </div>

      <div>
        <div className="status-section-title">PLATFORM</div>
        <div style={{ color: '#333', fontSize: 9 }}>WS-C2960X-48TS-L</div>
        <div style={{ color: '#333', fontSize: 9 }}>IOS 15.7(3)M3</div>
      </div>

      {/* Tooltip hint at the bottom */}
      <div className="status-hint">
        Type ? for help&nbsp;&nbsp;|&nbsp;&nbsp;Tab to complete
      </div>
    </div>
  );
}

import { useEffect } from 'react';

interface Props {
  onClose: () => void;
}

export default function KeyboardHelp({ onClose }: Props) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="help-overlay" onClick={onClose}>
      <div className="help-card" onClick={e => e.stopPropagation()}>
        <button className="help-close" onClick={onClose}>ESC to close</button>
        <h2>KEYBOARD SHORTCUTS</h2>

        <h3>Navigation</h3>
        <table className="help-table">
          <tbody>
            <tr><td>↑ / ↓</td><td>Previous / next command in history</td></tr>
            <tr><td>Tab</td><td>Auto-complete command or interface name</td></tr>
            <tr><td>Ctrl+C</td><td>Cancel current input / interrupt</td></tr>
            <tr><td>Ctrl+Z</td><td>End — return to privileged EXEC from any config mode</td></tr>
            <tr><td>Ctrl+A</td><td>Jump to start of line</td></tr>
            <tr><td>Ctrl+E</td><td>Jump to end of line</td></tr>
            <tr><td>Ctrl+R</td><td>Reverse search through history</td></tr>
            <tr><td>F1</td><td>Toggle this help overlay</td></tr>
          </tbody>
        </table>

        <h3>IOS Shortcuts</h3>
        <table className="help-table">
          <tbody>
            <tr><td>?</td><td>Context-sensitive help at any point</td></tr>
            <tr><td>Tab</td><td>Complete partial command</td></tr>
            <tr><td>!</td><td>Comment line (ignored)</td></tr>
            <tr><td>do &lt;cmd&gt;</td><td>Run exec command from config mode</td></tr>
          </tbody>
        </table>

        <h3>CLI Modes</h3>
        <table className="help-table">
          <thead>
            <tr>
              <td style={{ color: 'var(--text-dim)', fontWeight: 'bold' }}>Mode</td>
              <td style={{ color: 'var(--text-dim)', fontWeight: 'bold' }}>Prompt</td>
              <td style={{ color: 'var(--text-dim)', fontWeight: 'bold' }}>Enter with</td>
            </tr>
          </thead>
          <tbody>
            <tr><td>User EXEC</td><td>SW1&gt;</td><td>(default)</td></tr>
            <tr><td>Privileged EXEC</td><td>SW1#</td><td>enable</td></tr>
            <tr><td>Global Config</td><td>SW1(config)#</td><td>configure terminal</td></tr>
            <tr><td>Interface Config</td><td>SW1(config-if)#</td><td>interface &lt;id&gt;</td></tr>
            <tr><td>VLAN Config</td><td>SW1(config-vlan)#</td><td>vlan &lt;id&gt;</td></tr>
            <tr><td>Line Config</td><td>SW1(config-line)#</td><td>line vty 0 4</td></tr>
            <tr><td>Router Config</td><td>SW1(config-router)#</td><td>router ospf 1</td></tr>
          </tbody>
        </table>

        <h3>Useful Commands</h3>
        <table className="help-table">
          <tbody>
            <tr><td>show run | include &lt;pat&gt;</td><td>Grep the config</td></tr>
            <tr><td>show ip int bri</td><td>Quick interface overview</td></tr>
            <tr><td>show mac address-table</td><td>L2 forwarding table</td></tr>
            <tr><td>do show run</td><td>Show config from any config mode</td></tr>
            <tr><td>write memory</td><td>Save config</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

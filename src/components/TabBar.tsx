import type { SessionState } from '../sim/types';

interface Props {
  sessions: SessionState[];
  activeId: number;
  onSwitch: (id: number) => void;
  onNew: () => void;
  onClose: (id: number) => void;
}

export default function TabBar({ sessions, activeId, onSwitch, onNew, onClose }: Props) {
  return (
    <div className="tab-bar">
      {sessions.map(session => (
        <button
          key={session.id}
          className={`tab ${session.id === activeId ? 'active' : ''}`}
          onClick={() => onSwitch(session.id)}
        >
          {session.label}
          {sessions.length > 1 && (
            <button
              className="tab-close"
              onClick={e => { e.stopPropagation(); onClose(session.id); }}
              title="Close"
            >×</button>
          )}
        </button>
      ))}
      {sessions.length < 5 && (
        <button className="tab-new" onClick={onNew} title="New Session">+</button>
      )}
    </div>
  );
}

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
      {sessions.map((session) => {
        const isActive = session.id === activeId;
        const hasUnsaved = session.deviceState.unsavedChanges;
        // Use the label stored on the session itself (set by createSession in reducer)
        // rather than re-deriving from array index, which breaks if sessions are
        // ever reordered or the array contains gaps after a close.
        const label = session.label;
        return (
          <button
            key={session.id}
            className={`tab ${isActive ? 'active' : ''}`}
            onClick={() => onSwitch(session.id)}
          >
            <span className={`tab-indicator-dot ${isActive ? 'active' : ''}`} />
            {label}
            {hasUnsaved && <span className="tab-unsaved-dot" title="Unsaved changes">•</span>}
            {sessions.length > 1 && (
              <button
                className="tab-close"
                onClick={e => { e.stopPropagation(); onClose(session.id); }}
                title="Close"
              >×</button>
            )}
          </button>
        );
      })}
      {sessions.length < 5 && (
        <button className="tab-new" onClick={onNew} title="New Session">+</button>
      )}
    </div>
  );
}

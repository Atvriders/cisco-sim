import { useEffect, useState, useCallback } from 'react';
import { BOOT_LINES, BOOT_LINE_DELAYS } from '../sim/boot';

interface Props {
  onComplete: () => void;
}

export default function BootScreen({ onComplete }: Props) {
  const [displayedLines, setDisplayedLines] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [showCursor, setShowCursor] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const showLine = (index: number) => {
      if (cancelled) return;
      if (index >= BOOT_LINES.length) {
        setDone(true);
        setShowCursor(true);
        return;
      }
      const delay = BOOT_LINE_DELAYS[index] ?? 20;
      timeoutId = setTimeout(() => {
        if (cancelled) return;
        setDisplayedLines(prev => [...prev, BOOT_LINES[index]]);
        showLine(index + 1);
      }, delay);
    };

    showLine(0);
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, []);

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (done && (e.key === 'Enter' || e.key === ' ')) {
      onComplete();
    }
  }, [done, onComplete]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  return (
    <div className="boot-screen" onClick={() => done && onComplete()}>
      {displayedLines.map((line, i) => (
        <div key={i} className="boot-line">{line || '\u00a0'}</div>
      ))}
      {showCursor && <span className="boot-cursor" />}
    </div>
  );
}

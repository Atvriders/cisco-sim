import { useState } from 'react';

export function useCommandHistory() {
  const [history, setHistory] = useState<string[]>([]);
  const [index, setIndex] = useState(-1);
  const [saved, setSaved] = useState('');

  function push(cmd: string) {
    if (cmd.trim()) setHistory(prev => [cmd, ...prev.slice(0, 99)]);
    setIndex(-1);
    setSaved('');
  }

  function up(current: string): string {
    if (history.length === 0) return current;
    const next = index === -1 ? 0 : Math.min(index + 1, history.length - 1);
    if (index === -1) setSaved(current);
    setIndex(next);
    return history[next];
  }

  function down(): string {
    if (index <= 0) { setIndex(-1); return saved; }
    const next = index - 1;
    setIndex(next);
    return history[next];
  }

  return { push, up, down };
}

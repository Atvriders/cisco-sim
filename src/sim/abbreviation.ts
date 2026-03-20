export function matchPrefix(input: string, candidates: string[]): string[] {
  const lower = input.toLowerCase();
  return candidates.filter(c => c.toLowerCase().startsWith(lower));
}

export function resolveAbbreviation(
  input: string, candidates: string[]
): { resolved: string; ambiguous: boolean } | null {
  if (!input) return null;
  const matches = matchPrefix(input, candidates);
  if (matches.length === 0) return null;
  // Exact match wins over prefix ambiguity
  const exact = matches.find(m => m.toLowerCase() === input.toLowerCase());
  if (exact) return { resolved: exact, ambiguous: false };
  if (matches.length === 1) return { resolved: matches[0], ambiguous: false };
  return { resolved: matches[0], ambiguous: true };
}

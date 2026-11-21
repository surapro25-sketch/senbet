/**
 * Lightweight Unicode-aware fuzzy search for Amharic (Ge'ez) and Latin text.
 * Uses normalized substring matching first, then token/ngram Levenshtein distance.
 */
export interface FuzzySearchResult<T> {
  matches: T[];
  suggestion: string | null;
  exactMatch: boolean;
}

export function normalizeSearchText(value: string): string {
  return String(value || '').normalize('NFKC').toLocaleLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ').trim();
}

function levenshtein(left: string, right: string): number {
  const a = Array.from(left), b = Array.from(right);
  if (a.length > b.length) return levenshtein(right, left);
  if (!a.length) return b.length;
  let previous = Array.from({ length: a.length + 1 }, (_, i) => i);
  for (let row = 1; row <= b.length; row += 1) {
    const current = [row];
    for (let col = 1; col <= a.length; col += 1) {
      current[col] = Math.min(current[col - 1] + 1, previous[col] + 1, previous[col - 1] + (a[col - 1] === b[row - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[a.length];
}

function distanceLimit(length: number): number {
  if (length <= 3) return 1;
  if (length <= 7) return 2;
  return 3;
}

function candidateTerms(text: string): string[] {
  const words = normalizeSearchText(text).split(' ').filter(Boolean);
  const terms = [...words];
  for (let size = 2; size <= Math.min(4, words.length); size += 1) {
    for (let start = 0; start <= words.length - size; start += 1) terms.push(words.slice(start, start + size).join(' '));
  }
  return terms;
}

export function fuzzySearch<T>(query: string, items: T[], getSearchText: (item: T) => string, getLabel: (item: T) => string): FuzzySearchResult<T> {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return { matches: items, suggestion: null, exactMatch: true };
  const exact = items.filter((item) => normalizeSearchText(getSearchText(item)).includes(normalizedQuery));
  if (exact.length) return { matches: exact, suggestion: null, exactMatch: true };

  const queryParts = normalizedQuery.split(' ').filter(Boolean);
  const scored = items.map((item) => {
    const terms = candidateTerms(getSearchText(item));
    let total = 0;
    for (const part of queryParts) {
      let best = Number.POSITIVE_INFINITY;
      const limit = distanceLimit(Array.from(part).length);
      for (const term of terms) {
        if (term.includes(part) || part.includes(term)) { best = 0; break; }
        const distance = levenshtein(part, term);
        if (distance < best) best = distance;
        if (best === 0) break;
      }
      if (best > limit) return null;
      total += best / Math.max(1, Array.from(part).length);
    }
    return { item, score: total / queryParts.length };
  }).filter((entry): entry is { item: T; score: number } => entry !== null);
  scored.sort((a, b) => a.score - b.score);
  const matches = scored.slice(0, 30).map((entry) => entry.item);
  return { matches, suggestion: matches.length ? getLabel(matches[0]) : null, exactMatch: false };
}

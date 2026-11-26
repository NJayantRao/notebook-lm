const INTERNAL_SOURCE_PREFIX =
  /^\s*(?:\[(?:S\d+|Source\s+\d+)\]|S\d+)\s*(?::|-)?\s*/i;

export function cleanTitle(title: string): string {
  let cleaned = title.trim();
  let previous: string;

  do {
    previous = cleaned;
    cleaned = cleaned.replace(INTERNAL_SOURCE_PREFIX, "");
  } while (cleaned !== previous);

  return cleaned.replace(/\.pdf$/i, "").trim();
}

export function shortTitle(title: string, max = 22): string {
  const cleaned = cleanTitle(title);
  if (cleaned.length <= max) return cleaned;
  if (max <= 1) return "…".slice(0, Math.max(0, max));
  return `${cleaned.slice(0, max - 1).trimEnd()}…`;
}

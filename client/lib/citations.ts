export type CitationMarker = {
  number: number;
};

export type PreparedCitationMarkdown = {
  markdown: string;
  citedNumbers: Set<number>;
};

type MarkdownSegment = {
  code: boolean;
  text: string;
};

const CITATION_MARKER =
  /\[(?:source\s+)?(\d+(?:\s*,\s*\d+)*)\]|【\s*(\d+)\s*】/gi;

function appendSegment(
  segments: MarkdownSegment[],
  code: boolean,
  text: string
) {
  if (!text) return;
  const previous = segments[segments.length - 1];
  if (previous?.code === code) {
    previous.text += text;
  } else {
    segments.push({ code, text });
  }
}

function findClosingBackticks(
  line: string,
  start: number,
  length: number
): number {
  let index = start;
  while (index < line.length) {
    const opening = line.indexOf("`", index);
    if (opening === -1) return -1;
    let end = opening + 1;
    while (line[end] === "`") end += 1;
    if (end - opening === length) return opening;
    index = end;
  }
  return -1;
}

function splitMarkdownCode(text: string): MarkdownSegment[] {
  const segments: MarkdownSegment[] = [];
  let fence: { character: "`" | "~"; length: number } | null = null;
  let offset = 0;

  while (offset < text.length) {
    const newline = text.indexOf("\n", offset);
    const lineEnd = newline === -1 ? text.length : newline + 1;
    const line = text.slice(offset, lineEnd);
    const content = line.replace(/\r?\n$/, "");

    if (fence) {
      appendSegment(segments, true, line);
      const closingFence = new RegExp(
        `^ {0,3}${fence.character}{${fence.length},}[ \\t]*$`
      );
      if (closingFence.test(content)) fence = null;
      offset = lineEnd;
      continue;
    }

    const openingFence = content.match(/^ {0,3}(`{3,}|~{3,})/);
    if (openingFence) {
      const delimiter = openingFence[1];
      fence = {
        character: delimiter[0] as "`" | "~",
        length: delimiter.length,
      };
      appendSegment(segments, true, line);
      offset = lineEnd;
      continue;
    }

    let cursor = 0;
    while (cursor < content.length) {
      const opening = content.indexOf("`", cursor);
      if (opening === -1) {
        appendSegment(segments, false, content.slice(cursor));
        cursor = content.length;
        break;
      }

      appendSegment(segments, false, content.slice(cursor, opening));
      let runEnd = opening + 1;
      while (content[runEnd] === "`") runEnd += 1;
      const closing = findClosingBackticks(
        content,
        runEnd,
        runEnd - opening
      );

      if (closing === -1) {
        appendSegment(segments, true, content.slice(opening));
        cursor = content.length;
        break;
      }

      const codeEnd = closing + runEnd - opening;
      appendSegment(segments, true, content.slice(opening, codeEnd));
      cursor = codeEnd;
    }

    appendSegment(segments, false, line.slice(content.length));
    offset = lineEnd;
  }

  return segments;
}

function transformCitationMarkers(
  text: string,
  availableNumbers: ReadonlySet<number>,
  citedNumbers: Set<number>,
  toLinks: boolean
): string {
  const markerPattern = new RegExp(CITATION_MARKER.source, "gi");
  let result = "";
  let cursor = 0;
  const adjacentNumbers = new Set<number>();
  let lastWasCitationLink = false;

  for (const match of text.matchAll(markerPattern)) {
    const index = match.index ?? 0;
    const gap = text.slice(cursor, index);
    result += gap;
    if (/\S/.test(gap)) {
      adjacentNumbers.clear();
      lastWasCitationLink = false;
    }

    const numbers = (match[1] ?? match[2] ?? "")
      .split(",")
      .map((value) => Number(value.trim()))
      .filter((number) => Number.isInteger(number) && number > 0);

    const links: number[] = [];
    for (const number of numbers) {
      if (!availableNumbers.has(number)) continue;
      citedNumbers.add(number);
      if (!adjacentNumbers.has(number)) links.push(number);
      adjacentNumbers.add(number);
    }

    if (toLinks) {
      if (links.length > 0) {
        if (!gap && lastWasCitationLink) result += " ";
        result += links
          .map((number) => `[${number}](#cite-${number})`)
          .join(" ");
        lastWasCitationLink = true;
      }
    }
    cursor = index + match[0].length;
  }

  return result + text.slice(cursor);
}

function hideIncompleteTrailingMarker(text: string): string {
  return text.replace(
    /(?:\[(?:source\s*)?(?:\d+(?:\s*,\s*\d*)*)?|\【\d*)[ \t]*(?=\r?\n*$)/i,
    ""
  );
}

export function prepareCitationMarkdown(
  text: string,
  citations: readonly CitationMarker[],
  isStreaming = false
): PreparedCitationMarkdown {
  const availableNumbers = new Set(
    citations
      .map(({ number }) => number)
      .filter((number) => Number.isInteger(number) && number > 0)
  );
  const citedNumbers = new Set<number>();
  const segments = splitMarkdownCode(text);
  const lastSegment = segments.length - 1;
  const markdown = segments
    .map((segment, index) => {
      if (segment.code) return segment.text;
      const content =
        isStreaming && index === lastSegment
          ? hideIncompleteTrailingMarker(segment.text)
          : segment.text;
      return transformCitationMarkers(
        content,
        availableNumbers,
        citedNumbers,
        true
      ).replace(/[ \t]+([,.;!?])/g, (_, punctuation: string) => punctuation);
    })
    .join("");

  return { markdown, citedNumbers };
}

export function stripCitationMarkers(
  text: string,
  citations: readonly CitationMarker[]
): string {
  const availableNumbers = new Set(
    citations
      .map(({ number }) => number)
      .filter((number) => Number.isInteger(number) && number > 0)
  );
  const stripped = splitMarkdownCode(text)
    .map((segment) => {
      if (segment.code) return segment.text;
      return transformCitationMarkers(
        segment.text,
        availableNumbers,
        new Set<number>(),
        false
      )
        .replace(/[ \t]+([,.;!?])/g, (_, punctuation: string) => punctuation)
        .replace(/[ \t]{2,}/g, " ");
    })
    .join("");
  return stripped;
}

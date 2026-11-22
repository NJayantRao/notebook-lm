import { extractText } from "unpdf";

import { ValidationError } from "../utils/api-error.js";

export type ExtractedPdfText = {
  text: string;
  pageCount: number;
};

const PAGE_NUMBER_ONLY = /^[-–—[(]?\s*(?:page\s*)?\d+(?:\s*(?:of|\/)\s*\d+)?\s*[)\]–—-]?$/i;

const normalizedLine = (line: string): string => line.trim();

const isPageNumber = (line: string): boolean =>
  PAGE_NUMBER_ONLY.test(line.trim()) && line.trim().length > 0;

// Running headers/footers appear on many pages. Never drop a line from a
// single-page document, and require at least two occurrences so short content
// is not accidentally treated as a header.
const repeatedLines = (pages: string[]): Set<string> => {
  const counts = new Map<string, number>();
  for (const page of pages) {
    const seen = new Set<string>();
    for (const line of page.split(/\r?\n/)) {
      const normalized = normalizedLine(line);
      if (normalized) {
        seen.add(normalized);
      }
    }
    for (const line of seen) {
      counts.set(line, (counts.get(line) ?? 0) + 1);
    }
  }

  const threshold = Math.max(2, Math.ceil(pages.length / 2));
  return new Set(
    [...counts.entries()]
      .filter(([, count]) => count >= threshold)
      .map(([line]) => line)
  );
};

const cleanPage = (page: string, repeated: Set<string>): string =>
  page
    .split(/\r?\n/)
    .filter((line) => {
      const normalized = normalizedLine(line);
      return Boolean(normalized) && !isPageNumber(normalized) && !repeated.has(normalized);
    })
    .join("\n");

export const extractPdfText = async (
  data: Uint8Array | ArrayBuffer
): Promise<ExtractedPdfText> => {
  let extracted: Awaited<ReturnType<typeof extractText>>;

  try {
    extracted = await extractText(data, { mergePages: false });
  } catch (error) {
    console.error(
      "PDF text extraction failed:",
      error instanceof Error ? error.message : "Unknown parser error"
    );
    throw new ValidationError(
      "Unable to extract text from this PDF. It may be encrypted or damaged.",
      "PDF_EXTRACTION_FAILED"
    );
  }

  const pages = Array.isArray(extracted.text) ? extracted.text : [extracted.text];
  if (pages.length === 0 || pages.every((page) => !page.trim())) {
    throw new ValidationError(
      "No selectable text was found in the PDF. Scanned PDFs are not supported yet.",
      "PDF_TEXT_NOT_FOUND"
    );
  }

  const repeated = repeatedLines(pages);
  const cleanedPages = pages.map((page) => cleanPage(page, repeated));

  if (cleanedPages.every((page) => !page.trim())) {
    throw new ValidationError(
      "No selectable text was found in the PDF. Scanned PDFs are not supported yet.",
      "PDF_TEXT_NOT_FOUND"
    );
  }

  // Keep the array aligned with the PDF pages. Empty pages stay empty so that
  // chunk indexes can be mapped back to their original page number.
  return {
    text: cleanedPages.join("\f"),
    pageCount: pages.length,
  };
};

import { readFile } from "node:fs/promises";
import { extractText } from "unpdf";

import { ValidationError } from "../utils/api-error.js";

export type ExtractedPdfText = {
  text: string;
  pageCount: number;
};

export const extractPdfText = async (
  filePath: string
): Promise<ExtractedPdfText> => {
  const file = await readFile(filePath);
  let extracted: Awaited<ReturnType<typeof extractText>>;

  try {
    extracted = await extractText(file, { mergePages: true });
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

  const text = (
    Array.isArray(extracted.text) ? extracted.text.join("\n\n") : extracted.text
  ).trim();
  if (!text) {
    throw new ValidationError(
      "No selectable text was found in the PDF. Scanned PDFs are not supported yet.",
      "PDF_TEXT_NOT_FOUND"
    );
  }

  return {
    text,
    pageCount: extracted.totalPages,
  };
};

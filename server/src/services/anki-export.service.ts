import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import AnkiExport from "anki-apkg-export";

import logger from "../config/logger.js";
import type { ArtifactCitation } from "../types/artifact.js";

export type AnkiCardSource = {
  id: string;
  front: string;
  back: string;
  citation?: ArtifactCitation | null;
};

const WASM_PATH = fileURLToPath(
  new URL(
    "../../node_modules/anki-apkg-export/dist/sql-wasm.wasm",
    import.meta.url
  )
);

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/gu, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });

const citationSuffix = (citation?: ArtifactCitation | null): string => {
  if (!citation) {
    return "";
  }
  const location =
    citation.page !== undefined
      ? ` p.${citation.page}`
      : citation.startSeconds !== undefined
        ? ` @${citation.startSeconds}s`
        : "";
  return ` <small>[${citation.label}${location}]</small>`;
};

/** Builds an Anki .apkg package entirely in memory. */
export const buildAnkiPackage = async (
  deckName: string,
  cards: AnkiCardSource[]
): Promise<Buffer> => {
  const exporter = await AnkiExport.create(deckName, {
    ...(existsSync(WASM_PATH) ? { locateFile: () => WASM_PATH } : {}),
  });

  try {
    exporter.addCards(
      cards.map((card) => ({
        front: escapeHtml(card.front),
        back: `${escapeHtml(card.back)}${citationSuffix(card.citation)}`,
        noteId: card.id,
        tags: ["notebook-lm", "study-studio"],
      }))
    );
    const buffer = await exporter.save({ type: "nodebuffer" });
    logger.info("artifact.flashcards.export_built", {
      deckNameLength: deckName.length,
      cardCount: cards.length,
      size: buffer.byteLength,
    });
    return buffer;
  } finally {
    exporter.close();
  }
};

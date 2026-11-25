import { NonRetriableError } from "inngest";

import { ENV } from "../config/env.js";
import type { PodcastTurn } from "../types/artifact.js";

/** Configured cap; env validation rejects anything above this. */
export const PODCAST_MAX_SECONDS = ENV.PODCAST_MAX_SECONDS;

/** 92% of a 125 wpm reading rate keeps the spoken episode inside the cap. */
export const PODCAST_MAX_WORDS = Math.floor(
  (PODCAST_MAX_SECONDS / 60) * ENV.PODCAST_WORDS_PER_MINUTE * 0.92
);

/** The generation target is another 8% below the hard word limit. */
export const PODCAST_TARGET_WORDS = Math.floor(PODCAST_MAX_WORDS * 0.92);

/** Counts spoken words only; speaker labels are not part of turn.text. */
export const countPodcastWords = (
  turns: ReadonlyArray<Pick<PodcastTurn, "text">>
): number =>
  turns.reduce(
    (total, turn) =>
      total + turn.text.trim().split(/\s+/u).filter(Boolean).length,
    0
  );

/** Deterministic length failures must not be retried by Inngest. */
export class PodcastTooLongError extends NonRetriableError {
  readonly code = "PODCAST_TOO_LONG";

  constructor(detail: string) {
    super(`The podcast came out too long. Try again. (${detail})`);
    this.name = "PodcastTooLongError";
  }
}

/** A shortening attempt that cannot produce a valid script is also terminal. */
export class PodcastRepairError extends NonRetriableError {
  readonly code = "PODCAST_REPAIR_FAILED";

  constructor(detail: string, cause?: unknown) {
    super(`The podcast could not be shortened. (${detail})`, { cause });
    this.name = "PodcastRepairError";
  }
}

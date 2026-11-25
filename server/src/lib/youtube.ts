import { NonRetriableError } from "inngest";
import { fetchTranscript } from "youtube-transcript";

import logger from "../config/logger.js";
import { BadGatewayError } from "../utils/api-error.js";

const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
]);

const TARGET_GROUP_SECONDS = 75;
const MIN_GROUP_SECONDS = 60;
const MAX_GROUP_SECONDS = 90;
const MILLISECOND_DURATION_THRESHOLD = 200;

type TranscriptFailureReason =
  | "ip_blocked"
  | "disabled"
  | "unavailable"
  | "no_transcript"
  | "unknown";

export type YouTubeTranscript = {
  content: string;
  startSeconds: number[];
};

export const getYouTubeVideoId = (value: string): string | null => {
  let url: URL;

  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }

  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.username ||
    url.password ||
    url.port ||
    !YOUTUBE_HOSTS.has(url.hostname.toLowerCase())
  ) {
    return null;
  }

  let videoId: string | undefined;
  if (url.hostname.toLowerCase() === "youtu.be") {
    videoId = url.pathname.split("/").filter(Boolean)[0];
  } else if (url.pathname === "/watch") {
    videoId = url.searchParams.get("v") ?? undefined;
  } else {
    const [, route, id] = url.pathname.split("/");
    if (route === "shorts" || route === "embed" || route === "live") {
      videoId = id;
    }
  }

  return videoId && YOUTUBE_VIDEO_ID_PATTERN.test(videoId) ? videoId : null;
};

const classifyFailure = (error: unknown): TranscriptFailureReason => {
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  if (
    name === "YoutubeTranscriptTooManyRequestError" ||
    message.includes("captcha") ||
    message.includes("too many requests")
  ) {
    return "ip_blocked";
  }
  if (
    name === "YoutubeTranscriptDisabledError" ||
    message.includes("transcript is disabled")
  ) {
    return "disabled";
  }
  if (
    name === "YoutubeTranscriptVideoUnavailableError" ||
    message.includes("no longer available")
  ) {
    return "unavailable";
  }
  if (
    name === "YoutubeTranscriptNotAvailableError" ||
    name === "YoutubeTranscriptNotAvailableLanguageError" ||
    message.includes("no transcripts are available")
  ) {
    return "no_transcript";
  }

  return "unknown";
};

const PERMANENT_FAILURE_REASONS = new Set<TranscriptFailureReason>([
  "ip_blocked",
  "disabled",
  "unavailable",
  "no_transcript",
]);

export const getYouTubeTranscript = async (
  videoId: string
): Promise<YouTubeTranscript> => {
  const startedAt = performance.now();
  logger.info("youtube.transcript.fetch.started", { videoId });

  let transcript: Awaited<ReturnType<typeof fetchTranscript>>;
  try {
    transcript = await fetchTranscript(videoId);
  } catch (error) {
    const reason = classifyFailure(error);
    const durationMs = Math.round(performance.now() - startedAt);
    logger.error("youtube.transcript.fetch.failed", {
      videoId,
      reason,
      durationMs,
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : String(error),
      error,
    });

    if (PERMANENT_FAILURE_REASONS.has(reason)) {
      throw new NonRetriableError(
        `YouTube transcript unavailable (${reason}): ${error instanceof Error ? error.message : "unknown error"}`,
        { cause: error }
      );
    }

    throw new BadGatewayError(
      "A transcript could not be retrieved for this YouTube video.",
      "YOUTUBE_TRANSCRIPT_FAILED"
    );
  }

  // The caption library mixes millisecond offsets (srv3) with second offsets
  // (classic). Pick the unit once for the whole transcript instead of guessing
  // per value: any cue lasting >= 200 units must be milliseconds.
  const usesMilliseconds = transcript.some(
    (segment) => segment.duration >= MILLISECOND_DURATION_THRESHOLD
  );
  const toSeconds = (value: number): number => {
    if (!Number.isFinite(value) || value < 0) {
      return 0;
    }
    return usesMilliseconds ? value / 1000 : value;
  };

  const segments = transcript
    .map((segment) => ({
      text: segment.text.trim(),
      start: toSeconds(segment.offset),
      duration: toSeconds(segment.duration),
    }))
    .filter((segment) => segment.text)
    .sort((left, right) => left.start - right.start);

  if (segments.length === 0) {
    const durationMs = Math.round(performance.now() - startedAt);
    logger.warn("youtube.transcript.fetch.failed", {
      videoId,
      reason: "no_transcript",
      segmentCount: 0,
      durationMs,
    });
    throw new NonRetriableError("YouTube transcript is empty or unreadable.");
  }

  logger.info("youtube.transcript.fetch.succeeded", {
    videoId,
    segmentCount: segments.length,
    unit: usesMilliseconds ? "milliseconds" : "seconds",
    durationMs: Math.round(performance.now() - startedAt),
  });

  const groups: Array<{ start: number; texts: string[] }> = [];
  let current: { start: number; texts: string[] } | undefined;

  for (const segment of segments) {
    if (!current) {
      current = { start: segment.start, texts: [segment.text] };
      continue;
    }

    const elapsed = segment.start - current.start;
    const nextEnd = segment.start + segment.duration;
    if (
      elapsed >= TARGET_GROUP_SECONDS ||
      (elapsed >= MIN_GROUP_SECONDS &&
        nextEnd - current.start > MAX_GROUP_SECONDS)
    ) {
      groups.push(current);
      current = { start: segment.start, texts: [segment.text] };
    } else {
      current.texts.push(segment.text);
    }
  }
  if (current) {
    groups.push(current);
  }

  return {
    content: groups.map((group) => group.texts.join(" ")).join("\f"),
    startSeconds: groups.map((group) => group.start),
  };
};

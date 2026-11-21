import { fetchTranscript } from "youtube-transcript";

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

const toSeconds = (value: number): number => {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }
  return value > 10_000 ? value / 1000 : value;
};

export const getYouTubeTranscript = async (
  videoId: string
): Promise<YouTubeTranscript> => {
  let transcript: Awaited<ReturnType<typeof fetchTranscript>>;
  try {
    transcript = await fetchTranscript(videoId);
  } catch (error) {
    console.error("YouTube transcript retrieval failed:", error);
    throw new BadGatewayError(
      "A transcript could not be retrieved for this YouTube video.",
      "YOUTUBE_TRANSCRIPT_FAILED"
    );
  }

  const segments = transcript
    .map((segment) => ({
      text: segment.text.trim(),
      start: toSeconds(segment.offset),
      duration: toSeconds(segment.duration),
    }))
    .filter((segment) => segment.text)
    .sort((left, right) => left.start - right.start);

  if (segments.length === 0) {
    throw new BadGatewayError(
      "This YouTube video does not have a readable transcript.",
      "YOUTUBE_TRANSCRIPT_EMPTY"
    );
  }

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

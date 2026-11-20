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

export const getYouTubeTranscript = async (
  videoId: string
): Promise<string> => {
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

  const content = transcript
    .map((segment) => segment.text.trim())
    .filter(Boolean)
    .join(" ");

  if (!content) {
    throw new BadGatewayError(
      "This YouTube video does not have a readable transcript.",
      "YOUTUBE_TRANSCRIPT_EMPTY"
    );
  }

  return content;
};

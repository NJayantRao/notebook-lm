import { GoogleGenAI } from "@google/genai";
import { Mp3Encoder } from "@breezystack/lamejs";

import { ENV } from "../config/env.js";
import logger, { timed } from "../config/logger.js";
import {
  deleteArtifactObject,
  getArtifactObject,
  putArtifactObject,
} from "../lib/s3.js";
import artifactsRepository from "../repository/artifacts.repository.js";
import {
  BadGatewayError,
  ServiceUnavailableError,
} from "../utils/api-error.js";
import type {
  ArtifactAudioMeta,
  PodcastSpeaker,
  PodcastTurn,
} from "../types/artifact.js";

const SAMPLE_RATE = 24_000;
const BYTES_PER_SAMPLE = 2;
const BYTES_PER_SECOND = SAMPLE_RATE * BYTES_PER_SAMPLE;
const MAX_SEGMENT_CHARS = 2_400;
const TTS_ATTEMPTS = 3;
const INTER_SEGMENT_SILENCE_MS = 150;
const MP3_BITRATE_KBPS = 96;

export type PodcastSegmentTurn = {
  turnIndex: number;
  speaker: PodcastSpeaker;
  text: string;
};

export type PodcastSegment = {
  turns: PodcastSegmentTurn[];
  charCount: number;
};

export type PodcastPartResult = {
  partKey: string;
  byteLength: number;
  durationSec: number;
  sampleRate: number;
};

export type PodcastFinalizeResult = {
  audioKey: string;
  audioMeta: ArtifactAudioMeta;
  durationSec: number;
  turns: PodcastTurn[];
};

let ttsClient: GoogleGenAI | undefined;

const getTtsClient = (): GoogleGenAI => {
  const apiKey = ENV.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
  if (!apiKey) {
    throw new ServiceUnavailableError(
      "Google text-to-speech is not configured.",
      "GOOGLE_NOT_CONFIGURED"
    );
  }

  if (!ttsClient) {
    ttsClient = new GoogleGenAI({
      apiKey,
      httpOptions: { apiVersion: "v1beta" },
    });
  }
  return ttsClient;
};

const splitLongText = (text: string, maxChars: number): string[] => {
  const value = text.trim();
  if (!value) {
    return [];
  }
  if (value.length <= maxChars) {
    return [value];
  }

  const sentences = value.match(/[^.!?]+[.!?]*\s*/gu) ?? [value];
  const pieces: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) {
      continue;
    }
    if (trimmed.length > maxChars) {
      if (current) {
        pieces.push(current.trim());
        current = "";
      }
      for (let offset = 0; offset < trimmed.length; offset += maxChars) {
        pieces.push(trimmed.slice(offset, offset + maxChars));
      }
      continue;
    }
    if (current && current.length + trimmed.length + 1 > maxChars) {
      pieces.push(current.trim());
      current = trimmed;
    } else {
      current = current ? `${current} ${trimmed}` : trimmed;
    }
  }
  if (current) {
    pieces.push(current.trim());
  }

  return pieces;
};

/** Groups turns into TTS requests under the character cap, at turn boundaries. */
export const planPodcastSegments = (turns: PodcastTurn[]): PodcastSegment[] => {
  const segments: PodcastSegment[] = [];
  let current: PodcastSegmentTurn[] = [];
  let charCount = 0;

  turns.forEach((turn, turnIndex) => {
    for (const text of splitLongText(turn.text, MAX_SEGMENT_CHARS)) {
      if (current.length > 0 && charCount + text.length > MAX_SEGMENT_CHARS) {
        segments.push({ turns: current, charCount });
        current = [];
        charCount = 0;
      }
      current.push({ turnIndex, speaker: turn.speaker, text });
      charCount += text.length;
    }
  });

  if (current.length > 0) {
    segments.push({ turns: current, charCount });
  }
  return segments;
};

const loadPodcastTurns = async (
  artifactId: string
): Promise<{ workspaceId: string; turns: PodcastTurn[] }> => {
  const record = await artifactsRepository.findArtifactById(artifactId);
  if (!record) {
    throw new BadGatewayError("Artifact not found.", "ARTIFACT_NOT_FOUND");
  }
  if (record.content.kind !== "podcast") {
    throw new BadGatewayError(
      "This artifact does not contain a podcast.",
      "ARTIFACT_NOT_PODCAST"
    );
  }

  return { workspaceId: record.workspaceId, turns: record.content.turns };
};

/** Installed @google/genai SpeechMetadata.style supports pace instructions. */
const SPEECH_PACE = "Read at a lively, natural, slightly brisk pace";

const speakerStyle = (speaker: PodcastSpeaker): string =>
  `${speaker === "Alex" ? "curious, friendly, conversational" : "calm, analytical, explanatory"}; ${SPEECH_PACE}`;

const synthesizePcm = async (
  segment: PodcastSegment,
  meta: { workspaceId: string; artifactId: string; partIndex: number }
): Promise<Buffer> => {
  const model = ENV.TTS_MODEL?.trim() || "gemini-3.8-flash-lite-tts";
  const voiceA = ENV.TTS_VOICE_HOST_A?.trim() || "Charon";
  const voiceB = ENV.TTS_VOICE_HOST_B?.trim() || "Aoede";
  for (let attempt = 1; attempt <= TTS_ATTEMPTS; attempt += 1) {
    try {
      const interaction = await timed(
        "podcast.tts.segment",
        { ...meta, model, attempt, turnCount: segment.turns.length },
        () =>
          getTtsClient().interactions.create({
            model,
            input: [
              {
                type: "user_input",
                content: segment.turns.map((turn) => ({
                  type: "text",
                  text: turn.text,
                  annotations: [
                    {
                      type: "speech_metadata",
                      speaker: turn.speaker,
                      style: speakerStyle(turn.speaker),
                    },
                  ],
                })),
              },
            ],
            response_format: {
              type: "audio",
              mime_type: "audio/l16",
              sample_rate: SAMPLE_RATE,
            },
            generation_config: {
              speech_config: {
                speakers: [
                  { speaker: "Alex", voice: voiceA },
                  { speaker: "Sam", voice: voiceB },
                ],
              },
            },
          })
      );

      const audioData = interaction.output_audio?.data;
      if (!audioData) {
        throw new Error("TTS returned no audio data.");
      }
      const pcm = Buffer.from(audioData, "base64");
      if (pcm.byteLength < BYTES_PER_SAMPLE) {
        throw new Error("TTS returned an empty audio buffer.");
      }
      return pcm.byteLength % 2 === 0 ? pcm : pcm.subarray(0, pcm.byteLength - 1);
    } catch (error) {
      if (attempt < TTS_ATTEMPTS) {
        logger.warn("podcast.tts.retry", { ...meta, model, attempt, error });
        await new Promise((resolve) =>
          setTimeout(resolve, 250 * 2 ** (attempt - 1))
        );
        continue;
      }
      logger.error("podcast.tts.failed", { ...meta, model, attempt, error });
    }
  }

  throw new BadGatewayError(
    "Podcast audio could not be generated.",
    "PODCAST_TTS_FAILED"
  );
};

/** Generates one TTS request and stores only its raw PCM part in S3. */
export const generatePodcastPart = async (
  workspaceId: string,
  artifactId: string,
  partIndex: number
): Promise<PodcastPartResult> => {
  const loaded = await loadPodcastTurns(artifactId);
  if (loaded.workspaceId !== workspaceId) {
    throw new BadGatewayError(
      "Artifact workspace mismatch.",
      "ARTIFACT_WORKSPACE_MISMATCH"
    );
  }

  const segments = planPodcastSegments(loaded.turns);
  const segment = segments[partIndex];
  if (!segment) {
    throw new BadGatewayError(
      "Podcast audio segment is missing.",
      "PODCAST_SEGMENT_MISSING"
    );
  }

  const pcm = await synthesizePcm(segment, {
    workspaceId,
    artifactId,
    partIndex,
  });
  const partKey = await putArtifactObject(
    workspaceId,
    artifactId,
    `part-${partIndex}.pcm`,
    pcm,
    "audio/l16"
  );

  // Inngest step outputs must not contain audio bytes.
  return {
    partKey,
    byteLength: pcm.byteLength,
    durationSec: Math.round((pcm.byteLength / BYTES_PER_SECOND) * 100) / 100,
    sampleRate: SAMPLE_RATE,
  };
};

const encodeMp3 = (pcm: Buffer): Buffer => {
  const encoder = new Mp3Encoder(1, SAMPLE_RATE, MP3_BITRATE_KBPS);
  const samples = new Int16Array(
    pcm.buffer,
    pcm.byteOffset,
    Math.floor(pcm.byteLength / BYTES_PER_SAMPLE)
  );
  const chunks: Buffer[] = [];
  const blockSize = 1152 * 8;

  for (let offset = 0; offset < samples.length; offset += blockSize) {
    const encoded = encoder.encodeBuffer(samples.subarray(offset, offset + blockSize));
    if (encoded.byteLength > 0) {
      chunks.push(Buffer.from(encoded));
    }
  }
  const flushed = encoder.flush();
  if (flushed.byteLength > 0) {
    chunks.push(Buffer.from(flushed));
  }

  const mp3 = Buffer.concat(chunks);
  if (mp3.byteLength === 0) {
    throw new Error("MP3 encoder produced no data.");
  }
  return mp3;
};

const encodeWav = (pcm: Buffer): Buffer => {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + pcm.byteLength, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(BYTES_PER_SECOND, 28);
  header.writeUInt16LE(BYTES_PER_SAMPLE, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(pcm.byteLength, 40);
  return Buffer.concat([header, pcm]);
};

const deleteParts = async (partKeys: string[]): Promise<void> => {
  for (const partKey of partKeys) {
    try {
      await deleteArtifactObject(partKey);
    } catch (error) {
      logger.error("podcast.audio.part_cleanup_failed", {
        partKeyLength: partKey.length,
        error,
      });
      throw error;
    }
  }
};

/** Removes uploaded parts and/or a joined audio object before a rescue run. */
export const deletePodcastAudioObjects = async (
  keys: Array<string | null | undefined>
): Promise<void> => {
  const unique = [...new Set(keys.filter((key): key is string => Boolean(key)))];
  if (unique.length > 0) {
    await deleteParts(unique);
  }
};

/** Concatenates PCM parts, encodes the final file, and recomputes turn timings. */
export const finalizePodcastAudio = async (
  workspaceId: string,
  artifactId: string,
  parts: PodcastPartResult[]
): Promise<PodcastFinalizeResult> => {
  const loaded = await loadPodcastTurns(artifactId);
  if (loaded.workspaceId !== workspaceId) {
    throw new BadGatewayError(
      "Artifact workspace mismatch.",
      "ARTIFACT_WORKSPACE_MISMATCH"
    );
  }

  const segments = planPodcastSegments(loaded.turns);
  if (parts.length !== segments.length) {
    throw new BadGatewayError(
      "Podcast audio parts are incomplete.",
      "PODCAST_PARTS_INCOMPLETE"
    );
  }

  const silence = Buffer.alloc(
    Math.floor((INTER_SEGMENT_SILENCE_MS / 1000) * BYTES_PER_SECOND)
  );
  // Download sequentially so a large podcast never holds every part twice.
  const downloaded: Buffer[] = [];
  for (const part of parts) {
    if (part.byteLength % BYTES_PER_SAMPLE !== 0 || part.byteLength === 0) {
      throw new BadGatewayError(
        "A podcast audio part is malformed.",
        "PODCAST_PART_INVALID"
      );
    }
    const pcm = await getArtifactObject(part.partKey);
    if (pcm.byteLength !== part.byteLength) {
      throw new BadGatewayError(
        "A podcast audio part changed size.",
        "PODCAST_PART_INVALID"
      );
    }
    downloaded.push(pcm);
  }

  const fullPcm = Buffer.concat(
    downloaded.flatMap((pcm, index) =>
      index < downloaded.length - 1 ? [pcm, silence] : [pcm]
    )
  );

  let finalBuffer: Buffer;
  let mimeType: string;
  let name: string;
  try {
    finalBuffer = encodeMp3(fullPcm);
    mimeType = "audio/mpeg";
    name = "audio.mp3";
  } catch (error) {
    logger.warn("podcast.audio.mp3_fallback", { workspaceId, artifactId, error });
    finalBuffer = encodeWav(fullPcm);
    mimeType = "audio/wav";
    name = "audio.wav";
  }

  let audioKey: string;
  try {
    audioKey = await putArtifactObject(
      workspaceId,
      artifactId,
      name,
      finalBuffer,
      mimeType
    );
  } catch (error) {
    await deleteParts(parts.map((part) => part.partKey));
    throw error;
  }
  await deleteParts(parts.map((part) => part.partKey));

  const turnStarts = new Map<number, number>();
  let segmentOffset = 0;
  segments.forEach((segment, index) => {
    const partBytes = parts[index]!.byteLength;
    const segmentDuration = partBytes / BYTES_PER_SECOND;
    const totalChars = segment.turns.reduce(
      (sum, turn) => sum + Math.max(1, turn.text.length),
      0
    );
    let charOffset = 0;

    for (const turn of segment.turns) {
      if (!turnStarts.has(turn.turnIndex)) {
        const withinSegment = (charOffset / totalChars) * segmentDuration;
        turnStarts.set(
          turn.turnIndex,
          Math.floor(segmentOffset + withinSegment)
        );
      }
      charOffset += Math.max(1, turn.text.length);
    }
    segmentOffset +=
      segmentDuration +
      (index < segments.length - 1 ? silence.byteLength / BYTES_PER_SECOND : 0);
  });

  const turns = loaded.turns.map((turn, index) => ({
    ...turn,
    startSec: turnStarts.get(index) ?? 0,
  }));
  const durationSec = Math.round(fullPcm.byteLength / BYTES_PER_SECOND);
  const audioMeta: ArtifactAudioMeta = {
    key: audioKey,
    mimeType,
    size: finalBuffer.byteLength,
    partKeys: [],
    sampleRate: SAMPLE_RATE,
  };

  logger.info("podcast.audio.finalized", {
    workspaceId,
    artifactId,
    partCount: parts.length,
    turnCount: turns.length,
    mimeType,
    size: finalBuffer.byteLength,
    durationSec,
  });

  return { audioKey, audioMeta, durationSec, turns };
};

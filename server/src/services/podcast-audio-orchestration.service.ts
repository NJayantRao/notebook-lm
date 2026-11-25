import { NonRetriableError } from "inngest";

import logger from "../config/logger.js";
import artifactsRepository from "../repository/artifacts.repository.js";
import type {
  ArtifactAudioMeta,
  ArtifactContent,
  PodcastContent,
} from "../types/artifact.js";
import type { ArtifactContext } from "./artifact-context.service.js";
import {
  deletePodcastAudioObjects,
  finalizePodcastAudio,
  generatePodcastPart,
  planPodcastSegments,
  type PodcastFinalizeResult,
} from "./podcast-audio.service.js";
import {
  countPodcastWords,
  PODCAST_MAX_SECONDS,
  PodcastTooLongError,
} from "./podcast-limits.js";
import {
  podcastContentToRaw,
  shortenPodcastScript,
} from "./podcast-script.service.js";

export type PodcastStepRunner = <T>(
  id: string,
  fn: () => Promise<T> | T
) => Promise<T>;

type AudioRunResult =
  | {
      status: "ok";
      finalized: PodcastFinalizeResult;
      estimatedSeconds: number;
      secondsPerWord: number;
    }
  | {
      status: "rescue_needed";
      estimatedSeconds: number;
      secondsPerWord: number;
      partKeys: string[];
    };

type OrchestrationArgs = {
  workspaceId: string;
  artifactId: string;
  context: ArtifactContext;
  runStep: PodcastStepRunner;
};

export type PodcastAudioResult = {
  content: PodcastContent;
  audioKey: string;
  audioMeta: ArtifactAudioMeta;
  durationSec: number;
  words: number;
  wordsPerMinute: number;
  estimatedSeconds: number;
  rescueUsed: boolean;
};

export const generateAndFinalizePodcastAudio = async ({
  workspaceId,
  artifactId,
  context,
  runStep,
}: OrchestrationArgs): Promise<PodcastAudioResult> => {
  const readPodcast = async (): Promise<PodcastContent> => {
    const record = await artifactsRepository.findArtifactById(artifactId);
    if (!record || record.workspaceId !== workspaceId) {
      throw new NonRetriableError("The podcast artifact is unavailable.");
    }
    if (record.content.kind !== "podcast") {
      throw new NonRetriableError("The artifact does not contain a podcast.");
    }
    return record.content;
  };

  const rescue = async (
    prefix: string,
    reason: string,
    secondsPerWord: number,
    keysToDelete: Array<string | null>
  ): Promise<void> => {
    const content = await readPodcast();
    if (content.audioRescueUsed) {
      throw new PodcastTooLongError("the one allowed rescue was already used");
    }

    const targetWords = Math.max(
      1,
      Math.floor((PODCAST_MAX_SECONDS / secondsPerWord) * 0.92)
    );
    const shortened = await runStep(`${prefix}-rescue-script`, () =>
      shortenPodcastScript({
        script: podcastContentToRaw(content),
        context,
        targetWords,
        maxWords: targetWords,
        reason,
      })
    );
    const rescuedContent: PodcastContent = {
      ...(shortened.content as PodcastContent),
      audioRescueUsed: true,
    };

    await runStep(`${prefix}-rescue-cleanup`, () =>
      deletePodcastAudioObjects(keysToDelete)
    );
    await runStep(`${prefix}-rescue-save`, () =>
      artifactsRepository.updateArtifact(artifactId, {
        status: "generating",
        errorMessage: null,
        content: rescuedContent,
        audioKey: null,
        audioMeta: null,
        durationSec: null,
      })
    );

    logger.warn("podcast.audio.rescue", {
      workspaceId,
      artifactId,
      reason,
      targetWords,
      secondsPerWord,
    });
  };

  const runAudio = async (
    prefix: string,
    rescueUsed: boolean
  ): Promise<AudioRunResult> => {
    const content = await readPodcast();
    const segments = planPodcastSegments(content.turns);
    if (segments.length === 0) {
      throw new NonRetriableError("The podcast has no audio segments.");
    }

    const totalWords = content.words ?? countPodcastWords(content.turns);
    const first = await runStep(`${prefix}-tts-part-0`, () =>
      generatePodcastPart(workspaceId, artifactId, 0)
    );
    const firstWords = Math.max(
      1,
      countPodcastWords(segments[0]!.turns.map((turn) => ({ text: turn.text })))
    );
    const secondsPerWord = first.durationSec / firstWords;
    const estimatedSeconds = totalWords * secondsPerWord;

    logger.info("podcast.audio.calibrated", {
      workspaceId,
      artifactId,
      secondsPerWord,
      estimatedSeconds,
      limit: PODCAST_MAX_SECONDS,
      words: totalWords,
      turns: content.turns.length,
    });

    if (estimatedSeconds > PODCAST_MAX_SECONDS) {
      if (rescueUsed) {
        throw new PodcastTooLongError(
          `estimated ${Math.round(estimatedSeconds)}s exceeds ${PODCAST_MAX_SECONDS}s after rescue`
        );
      }
      return {
        status: "rescue_needed",
        estimatedSeconds,
        secondsPerWord,
        partKeys: [first.partKey],
      };
    }

    const parts = [first];
    for (let index = 1; index < segments.length; index += 1) {
      parts.push(
        await runStep(`${prefix}-tts-part-${index}`, () =>
          generatePodcastPart(workspaceId, artifactId, index)
        )
      );
    }

    const finalized = await runStep(`${prefix}-finalize`, () =>
      finalizePodcastAudio(workspaceId, artifactId, parts)
    );

    if (finalized.durationSec > PODCAST_MAX_SECONDS + 3) {
      if (rescueUsed) {
        throw new PodcastTooLongError(
          `final ${finalized.durationSec}s exceeds ${PODCAST_MAX_SECONDS}s after rescue`
        );
      }
      return {
        status: "rescue_needed",
        estimatedSeconds,
        secondsPerWord,
        partKeys: [finalized.audioKey],
      };
    }

    return { status: "ok", finalized, estimatedSeconds, secondsPerWord };
  };

  let rescueUsed = Boolean((await readPodcast()).audioRescueUsed);
  // Retries after a saved rescue must not reuse step IDs from the pre-rescue run.
  let result = await runAudio(rescueUsed ? "podcast-rescue" : "podcast", rescueUsed);

  if (result.status === "rescue_needed") {
    await rescue(
      "podcast",
      `estimated ${Math.round(result.estimatedSeconds)}s exceeds ${PODCAST_MAX_SECONDS}s`,
      result.secondsPerWord,
      result.partKeys
    );
    rescueUsed = true;
    result = await runAudio("podcast-rescue", true);
  }

  if (result.status !== "ok") {
    throw new PodcastTooLongError("rescued audio still exceeds the limit");
  }

  const finalized = result.finalized;
  const finalContent = await readPodcast();
  const words = countPodcastWords(finalized.turns);
  const wordsPerMinute = Math.round((words / (finalized.durationSec / 60)) * 10) / 10;

  const savedContent: PodcastContent = {
    kind: "podcast",
    title: finalContent.title,
    turns: finalized.turns,
    words,
    durationSec: finalized.durationSec,
    wordsPerMinute,
    ...(rescueUsed ? { audioRescueUsed: true } : {}),
  };

  await runStep("podcast-save-metadata", () =>
    artifactsRepository.updateArtifact(artifactId, {
      content: savedContent as ArtifactContent,
      audioKey: finalized.audioKey,
      audioMeta: finalized.audioMeta,
      durationSec: finalized.durationSec,
    })
  );

  logger.info("podcast.audio.completed", {
    workspaceId,
    artifactId,
    words,
    durationSec: finalized.durationSec,
    wordsPerMinute,
  });

  return {
    content: savedContent,
    audioKey: finalized.audioKey,
    audioMeta: finalized.audioMeta,
    durationSec: finalized.durationSec,
    words,
    wordsPerMinute,
    estimatedSeconds: result.estimatedSeconds,
    rescueUsed,
  };
};

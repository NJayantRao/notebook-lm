import type { Request, Response } from "express";

import ApiResponse from "../utils/api-response.js";
import validate from "../utils/validate.js";
import service from "../services/artifacts.service.js";
import {
  artifactParamsSchema,
  createArtifactSchema,
  flashcardExportQuerySchema,
  flashcardReviewSchema,
  listArtifactsQuerySchema,
  quizAttemptSchema,
  workspaceIdParamsSchema,
} from "../validators/artifacts.validator.js";

const createArtifact = async (req: Request, res: Response) => {
  const { workspaceId } = validate(workspaceIdParamsSchema, req.params);
  const input = validate(createArtifactSchema, req.body);
  const result = await service.createArtifact(req.user.id, workspaceId, input);
  res
    .status(201)
    .json(new ApiResponse(201, "Artifact generation started", result));
};

const listArtifacts = async (req: Request, res: Response) => {
  const { workspaceId } = validate(workspaceIdParamsSchema, req.params);
  const filters = validate(listArtifactsQuerySchema, req.query);
  const result = await service.listArtifacts(req.user.id, workspaceId, filters);
  res
    .status(200)
    .json(new ApiResponse(200, "Artifacts fetched successfully", result));
};

const getArtifact = async (req: Request, res: Response) => {
  const { workspaceId, artifactId } = validate(artifactParamsSchema, req.params);
  const result = await service.getArtifact(req.user.id, workspaceId, artifactId);
  res
    .status(200)
    .json(new ApiResponse(200, "Artifact fetched successfully", result));
};

const getPodcastAudioDownloadUrl = async (req: Request, res: Response) => {
  const { workspaceId, artifactId } = validate(artifactParamsSchema, req.params);
  const result = await service.getPodcastAudioDownloadUrl(
    req.user.id,
    workspaceId,
    artifactId
  );
  res
    .status(200)
    .json(new ApiResponse(200, "Podcast audio download URL created", result));
};

const deleteArtifact = async (req: Request, res: Response) => {
  const { workspaceId, artifactId } = validate(artifactParamsSchema, req.params);
  const result = await service.deleteArtifact(
    req.user.id,
    workspaceId,
    artifactId
  );
  res
    .status(200)
    .json(new ApiResponse(200, "Artifact deleted successfully", result));
};

const retryArtifact = async (req: Request, res: Response) => {
  const { workspaceId, artifactId } = validate(artifactParamsSchema, req.params);
  const result = await service.retryArtifact(
    req.user.id,
    workspaceId,
    artifactId
  );
  res
    .status(202)
    .json(new ApiResponse(202, "Artifact regeneration started", result));
};

const submitQuizAttempt = async (req: Request, res: Response) => {
  const { workspaceId, artifactId } = validate(artifactParamsSchema, req.params);
  const input = validate(quizAttemptSchema, req.body);
  const result = await service.submitQuizAttempt(
    req.user.id,
    workspaceId,
    artifactId,
    input.answers
  );
  res
    .status(201)
    .json(new ApiResponse(201, "Quiz attempt saved", result));
};

const listQuizAttempts = async (req: Request, res: Response) => {
  const { workspaceId, artifactId } = validate(artifactParamsSchema, req.params);
  const result = await service.listQuizAttempts(
    req.user.id,
    workspaceId,
    artifactId
  );
  res
    .status(200)
    .json(new ApiResponse(200, "Quiz attempts fetched successfully", result));
};

const listFlashcards = async (req: Request, res: Response) => {
  const { workspaceId, artifactId } = validate(artifactParamsSchema, req.params);
  const result = await service.listFlashcards(
    req.user.id,
    workspaceId,
    artifactId
  );
  res
    .status(200)
    .json(new ApiResponse(200, "Flashcards fetched successfully", result));
};

const getDueFlashcards = async (req: Request, res: Response) => {
  const { workspaceId, artifactId } = validate(artifactParamsSchema, req.params);
  const result = await service.getDueFlashcards(
    req.user.id,
    workspaceId,
    artifactId
  );
  res
    .status(200)
    .json(new ApiResponse(200, "Due flashcards fetched successfully", result));
};

const reviewFlashcard = async (req: Request, res: Response) => {
  const { workspaceId, artifactId } = validate(artifactParamsSchema, req.params);
  const input = validate(flashcardReviewSchema, req.body);
  const result = await service.reviewFlashcard(
    req.user.id,
    workspaceId,
    artifactId,
    input.cardId,
    input.rating
  );
  res
    .status(200)
    .json(new ApiResponse(200, "Flashcard review saved", result));
};

const exportFlashcards = async (req: Request, res: Response) => {
  const { workspaceId, artifactId } = validate(artifactParamsSchema, req.params);
  const { format } = validate(flashcardExportQuerySchema, req.query);
  const result = await service.exportFlashcards(
    req.user.id,
    workspaceId,
    artifactId,
    format
  );

  if (result.kind === "binary") {
    res.setHeader("Content-Type", result.contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${result.filename}"`
    );
    res.status(200).send(result.buffer);
    return;
  }

  res
    .status(200)
    .json(new ApiResponse(200, "Anki deck JSON generated", result));
};

export default {
  createArtifact,
  listArtifacts,
  getArtifact,
  getPodcastAudioDownloadUrl,
  deleteArtifact,
  retryArtifact,
  submitQuizAttempt,
  listQuizAttempts,
  listFlashcards,
  getDueFlashcards,
  reviewFlashcard,
  exportFlashcards,
};

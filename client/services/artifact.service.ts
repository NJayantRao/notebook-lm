import { api, type ApiEnvelope } from "@/lib/api";
import type {
  Artifact,
  CreateArtifactInput,
  Flashcard,
  ListArtifactsFilters,
  QuizAttempt,
  QuizAttemptAnswer,
} from "@/lib/artifact-types";

const base = (workspaceId: string) => `/api/workspace/${workspaceId}/artifacts`;

const unwrap = <T>(data: T | undefined, fallbackMessage: string): T => {
  if (data === undefined) {
    throw new Error(fallbackMessage);
  }
  return data;
};

export async function createArtifact(
  workspaceId: string,
  input: CreateArtifactInput
): Promise<Artifact> {
  const res = await api.post<ApiEnvelope<Artifact>>(base(workspaceId), input);
  return unwrap(res.data.data, "Failed to start artifact generation");
}

export async function listArtifacts(
  workspaceId: string,
  filters: ListArtifactsFilters = {}
): Promise<Artifact[]> {
  const res = await api.get<ApiEnvelope<Artifact[]>>(base(workspaceId), {
    params: filters,
  });
  return res.data.data ?? [];
}

export async function getArtifact(
  workspaceId: string,
  artifactId: string
): Promise<Artifact> {
  const res = await api.get<ApiEnvelope<Artifact>>(
    `${base(workspaceId)}/${artifactId}`
  );
  return unwrap(res.data.data, "Failed to load artifact");
}

export async function deleteArtifact(
  workspaceId: string,
  artifactId: string
): Promise<void> {
  await api.delete(`${base(workspaceId)}/${artifactId}`);
}

export async function retryArtifact(
  workspaceId: string,
  artifactId: string
): Promise<Artifact> {
  const res = await api.post<ApiEnvelope<Artifact>>(
    `${base(workspaceId)}/${artifactId}/retry`
  );
  return unwrap(res.data.data, "Failed to retry artifact");
}

export async function submitQuizAttempt(
  workspaceId: string,
  artifactId: string,
  answers: Array<{ questionId: string; userAnswer: string }>
): Promise<QuizAttempt> {
  const res = await api.post<ApiEnvelope<QuizAttempt>>(
    `${base(workspaceId)}/${artifactId}/attempts`,
    { answers }
  );
  return unwrap(res.data.data, "Failed to save quiz attempt");
}

export async function listQuizAttempts(
  workspaceId: string,
  artifactId: string
): Promise<QuizAttempt[]> {
  const res = await api.get<ApiEnvelope<QuizAttempt[]>>(
    `${base(workspaceId)}/${artifactId}/attempts`
  );
  return res.data.data ?? [];
}

export async function listFlashcards(
  workspaceId: string,
  artifactId: string
): Promise<Flashcard[]> {
  const res = await api.get<ApiEnvelope<Flashcard[]>>(
    `${base(workspaceId)}/${artifactId}/flashcards`
  );
  return res.data.data ?? [];
}

export async function listDueFlashcards(
  workspaceId: string,
  artifactId: string
): Promise<Flashcard[]> {
  const res = await api.get<ApiEnvelope<Flashcard[]>>(
    `${base(workspaceId)}/${artifactId}/flashcards/due`
  );
  return res.data.data ?? [];
}

export async function reviewFlashcard(
  workspaceId: string,
  artifactId: string,
  cardId: string,
  rating: number
): Promise<Flashcard> {
  const res = await api.post<ApiEnvelope<Flashcard>>(
    `${base(workspaceId)}/${artifactId}/flashcards/review`,
    { cardId, rating }
  );
  return unwrap(res.data.data, "Failed to save flashcard review");
}

export async function exportFlashcardsJson(
  workspaceId: string,
  artifactId: string
): Promise<{ deckName: string; cards: Flashcard[] }> {
  const res = await api.get<
    ApiEnvelope<{ deckName: string; cards: Flashcard[] }>
  >(`${base(workspaceId)}/${artifactId}/flashcards/export`, {
    params: { format: "json" },
  });
  return unwrap(res.data.data, "Failed to export flashcards");
}

const saveBlobAsFile = (blob: Blob, filename: string): void => {
  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(blobUrl);
};

export async function downloadFlashcardsJson(
  workspaceId: string,
  artifactId: string,
  filename: string
): Promise<void> {
  const deck = await exportFlashcardsJson(workspaceId, artifactId);
  saveBlobAsFile(
    new Blob([JSON.stringify(deck, null, 2)], { type: "application/json" }),
    filename
  );
}

/** Requests a server-built .apkg and saves it without exposing storage keys. */
export async function downloadAnkiDeck(
  workspaceId: string,
  artifactId: string,
  filename: string
): Promise<void> {
  const res = await api.get<Blob>(
    `${base(workspaceId)}/${artifactId}/flashcards/export`,
    { params: { format: "apkg" }, responseType: "blob" }
  );

  saveBlobAsFile(res.data, filename);
}

export type { QuizAttemptAnswer };

/**
 * Client mirror of `server/src/types/artifact.ts`.
 * Keep field names in sync with the server envelope; dates arrive as ISO strings.
 */
export const ARTIFACT_TYPES = [
  "roadmap",
  "mindmap",
  "podcast",
  "quiz",
  "flashcards",
] as const;
export type ArtifactType = (typeof ARTIFACT_TYPES)[number];

export const ARTIFACT_STATUSES = [
  "pending",
  "generating",
  "ready",
  "failed",
] as const;
export type ArtifactStatus = (typeof ARTIFACT_STATUSES)[number];

export type ArtifactInput = {
  type: ArtifactType;
  params: {
    sourceIds: string[];
    focus?: string;
    cardCount?: number;
    questionCount?: number;
  };
};

export type ArtifactCitation = {
  label: string;
  sourceId: string;
  title: string;
  sourceType: "text" | "markdown" | "pdf" | "website" | "yt_url";
  url: string | null;
  chunkIndex: number;
  page?: number;
  startSeconds?: number;
};

export type RoadmapStep = {
  id: string;
  order: number;
  title: string;
  description: string;
  reason: string;
  citation: ArtifactCitation;
};

export type MindMapNode = {
  id: string;
  label: string;
  summary: string;
  description: string;
  keyPoints: string[];
  whyItMatters: string;
  difficulty: "intro" | "intermediate" | "advanced";
  example?: string;
  relatedQuestions: string[];
  citation: ArtifactCitation;
};

export type MindMapEdge = {
  id: string;
  source: string;
  target: string;
  label: string;
  type:
    | "prerequisite"
    | "related_to"
    | "part_of"
    | "example_of"
    | "contrasts_with";
};

export type PodcastTurn = {
  speaker: "Alex" | "Sam";
  text: string;
  startSec: number;
  citationLabels: string[];
};

export type QuizQuestion = {
  id: string;
  type: "mcq" | "true_false" | "short_answer";
  questionText: string;
  options: string[];
  /** Hidden until the learner has submitted at least one attempt. */
  correctAnswer?: string;
  explanation?: string;
  citations: ArtifactCitation[];
};

export type ArtifactAudioMeta = {
  key: string;
  mimeType: string;
  size: number;
  partKeys: string[];
  sampleRate: number;
};

export type PodcastContent = {
  kind: "podcast";
  title: string;
  turns: PodcastTurn[];
  words?: number;
  durationSec?: number;
  wordsPerMinute?: number;
  audioRescueUsed?: boolean;
};

export type ArtifactContent =
  | { kind: "empty" }
  | {
      kind: "roadmap";
      title: string;
      description: string;
      steps: RoadmapStep[];
    }
  | {
      kind: "mindmap";
      title: string;
      nodes: MindMapNode[];
      edges: MindMapEdge[];
    }
  | PodcastContent
  | {
      kind: "quiz";
      title: string;
      questions: QuizQuestion[];
    }
  | {
      kind: "flashcards";
      title: string;
      cards: Array<{
        front: string;
        back: string;
        citation: ArtifactCitation;
      }>;
    };

export type Artifact = {
  id: string;
  workspaceId: string;
  type: ArtifactType;
  status: ArtifactStatus;
  title: string;
  input: ArtifactInput;
  content: ArtifactContent;
  sourceIndex: ArtifactCitation[];
  isStale: boolean;
  audioUrl: string | null;
  audioMeta: ArtifactAudioMeta | null;
  durationSec: number | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Flashcard = {
  id: string;
  artifactId: string;
  workspaceId: string;
  front: string;
  back: string;
  citation: ArtifactCitation | null;
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReviewAt: string;
  lastReviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type QuizAttemptAnswer = {
  questionId: string;
  userAnswer: string;
  isCorrect: boolean;
  correctAnswer: string;
  explanation: string;
  feedback?: string;
};

export type QuizAttempt = {
  id: string;
  score: number;
  totalQuestions: number;
  answers: QuizAttemptAnswer[];
  createdAt: string;
};

export type CreateArtifactInput = {
  type: ArtifactType;
  sourceIds: string[];
  focus?: string;
  cardCount?: number;
  questionCount?: number;
  /** Legacy clients may send this; the server ignores it. */
  length?: string;
};

export type ListArtifactsFilters = {
  type?: ArtifactType;
  status?: ArtifactStatus;
};

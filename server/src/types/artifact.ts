export type SourceType = "text" | "markdown" | "pdf" | "website" | "yt_url";

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

export type ArtifactTier = "fast" | "strong";

export type ArtifactParams = {
  sourceIds: string[];
  focus?: string;
  cardCount?: number;
  questionCount?: number;
};

export type ArtifactInput = {
  type: ArtifactType;
  params: ArtifactParams;
};

/** A normalized source entry passed to prompts and used to validate citations. */
export type ArtifactSourceIndexEntry = {
  label: string;
  sourceId: string;
  title: string;
  sourceType: SourceType;
  url: string | null;
  chunkIndex: number;
  page?: number;
  startSeconds?: number;
  excerpt: string;
};

export type ArtifactCitation = Pick<
  ArtifactSourceIndexEntry,
  | "label"
  | "sourceId"
  | "title"
  | "sourceType"
  | "url"
  | "chunkIndex"
  | "page"
  | "startSeconds"
>;

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

export type MindMapEdgeType =
  | "prerequisite"
  | "related_to"
  | "part_of"
  | "example_of"
  | "contrasts_with";

export type MindMapEdge = {
  id: string;
  source: string;
  target: string;
  label: string;
  type: MindMapEdgeType;
};

export type PodcastSpeaker = "Alex" | "Sam";

export type PodcastTurn = {
  speaker: PodcastSpeaker;
  text: string;
  /** Absolute offset in seconds, filled after audio generation. */
  startSec: number;
  citationLabels: string[];
};

export type QuizQuestionType = "mcq" | "true_false" | "short_answer";

export type QuizQuestion = {
  id: string;
  type: QuizQuestionType;
  questionText: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  citations: ArtifactCitation[];
};

/** Quiz questions returned before the learner submits an attempt. */
export type PublicQuizQuestion = Omit<QuizQuestion, "correctAnswer" | "explanation">;

export type PublicArtifactContent =
  | Exclude<ArtifactContent, { kind: "quiz" }>
  | { kind: "quiz"; title: string; questions: PublicQuizQuestion[] };

export type FlashcardDraft = {
  front: string;
  back: string;
  citation: ArtifactCitation;
};

export type PodcastContent = {
  kind: "podcast";
  title: string;
  turns: PodcastTurn[];
  /** Filled after audio is finalized; optional for older artifacts. */
  words?: number;
  durationSec?: number;
  wordsPerMinute?: number;
  /** A length rescue may run only once per artifact. */
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
      cards: FlashcardDraft[];
    };

export type ArtifactAudioMeta = {
  key: string;
  mimeType: string;
  size: number;
  partKeys: string[];
  sampleRate: number;
};

export type QuizAnswerInput = {
  questionId: string;
  userAnswer: string;
};

export type QuizAttemptAnswer = QuizAnswerInput & {
  isCorrect: boolean;
  correctAnswer: string;
  explanation: string;
  feedback?: string;
};

export type StaleArtifact<T> = T & { isStale: boolean };

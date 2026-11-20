type WorkspaceCitation = {
  number: number;
  sourceId: string;
  title: string;
  sourceType: "text" | "markdown" | "pdf" | "website" | "yt_url";
  url: string | null;
  chunkIndex: number;
  excerpt: string;
  score?: number;
};

type WebCitation = {
  number: number;
  title: string;
  sourceType: "web";
  url: string;
  excerpt: string;
  score?: number;
};

export type ConversationCitation = WorkspaceCitation | WebCitation;

export type ConversationCitation = {
  number: number;
  sourceId: string;
  title: string;
  sourceType: "text" | "markdown" | "pdf" | "website" | "yt_url";
  url: string | null;
  chunkIndex: number;
  excerpt: string;
  score?: number;
};

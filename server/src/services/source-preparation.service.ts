import { scrapeWebsiteByUrl } from "../lib/firecrawl.js";
import { verifyPdfFile } from "../lib/multer.js";
import { extractPdfText } from "../lib/pdf.js";
import { getPdf } from "../lib/s3.js";
import { getYouTubeTranscript } from "../lib/youtube.js";

const scrapeWebsite = (url: string) => scrapeWebsiteByUrl(url);
const fetchYouTubeTranscript = (videoId: string) =>
  getYouTubeTranscript(videoId);
const verifyPdf = (buffer: Uint8Array) => verifyPdfFile(buffer);
const extractPdf = (buffer: Uint8Array | ArrayBuffer) =>
  extractPdfText(buffer);
const downloadPdf = (key: string) => getPdf(key);

export default {
  scrapeWebsite,
  fetchYouTubeTranscript,
  verifyPdf,
  extractPdf,
  downloadPdf,
};

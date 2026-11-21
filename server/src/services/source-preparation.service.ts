import { scrapeWebsiteByUrl } from "../lib/firecrawl.js";
import {
  getUploadedPdfPathByName,
  verifyPdfFile,
} from "../lib/multer.js";
import { extractPdfText } from "../lib/pdf.js";
import { getYouTubeTranscript } from "../lib/youtube.js";

const scrapeWebsite = (url: string) => scrapeWebsiteByUrl(url);
const fetchYouTubeTranscript = (videoId: string) =>
  getYouTubeTranscript(videoId);
const verifyPdf = (filePath: string) => verifyPdfFile(filePath);
const extractPdf = (filePath: string) => extractPdfText(filePath);
const resolveStoredPdfPath = (fileName: string) =>
  getUploadedPdfPathByName(fileName);

export default {
  scrapeWebsite,
  fetchYouTubeTranscript,
  verifyPdf,
  extractPdf,
  resolveStoredPdfPath,
};

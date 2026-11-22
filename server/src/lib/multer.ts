import { extname } from "node:path";
import type { RequestHandler } from "express";
import multer from "multer";

import {
  BadRequestError,
  PayloadTooLargeError,
  UnsupportedMediaTypeError,
} from "../utils/api-error.js";

const MAX_PDF_SIZE_BYTES = 25 * 1024 * 1024;

const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_PDF_SIZE_BYTES,
    files: 1,
    fields: 0,
    parts: 1,
  },
  fileFilter: (_req, file, callback) => {
    const extensionIsPdf = extname(file.originalname).toLowerCase() === ".pdf";
    const mimeTypeIsPdf =
      file.mimetype === "application/pdf" ||
      file.mimetype === "application/octet-stream";

    if (!extensionIsPdf || !mimeTypeIsPdf) {
      callback(
        new UnsupportedMediaTypeError("Only PDF files are allowed.", "PDF_ONLY")
      );
      return;
    }

    callback(null, true);
  },
});

const parsePdfUpload = pdfUpload.single("file");

export const uploadPdfFile: RequestHandler = (req, res, next) => {
  parsePdfUpload(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        next(
          new PayloadTooLargeError(
            "PDF files must be 25 MB or smaller.",
            "PDF_TOO_LARGE"
          )
        );
        return;
      }

      next(new BadRequestError("Invalid PDF upload.", "INVALID_PDF_UPLOAD"));
      return;
    }

    next(error);
  });
};

export const verifyPdfFile = (buffer: Uint8Array): void => {
  const header = Buffer.from(buffer.subarray(0, 1024)).toString("latin1");
  if (!header.includes("%PDF-")) {
    throw new UnsupportedMediaTypeError(
      "The uploaded file is not a valid PDF.",
      "INVALID_PDF_SIGNATURE"
    );
  }
};

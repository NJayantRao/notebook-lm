import { randomUUID } from "node:crypto";
import { mkdir, open, unlink } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import multer from "multer";
import type { RequestHandler } from "express";

import {
  BadRequestError,
  PayloadTooLargeError,
  UnsupportedMediaTypeError,
} from "../utils/api-error.js";

const MAX_PDF_SIZE_BYTES = 25 * 1024 * 1024;
const uploadDirectory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../uploads",
);

const pdfUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => {
      mkdir(uploadDirectory, { recursive: true }).then(
        () => callback(null, uploadDirectory),
        (error: unknown) =>
          callback(
            error instanceof Error ? error : new Error("Unable to create upload directory"),
            uploadDirectory,
          ),
      );
    },
    filename: (_req, _file, callback) => {
      callback(null, `${randomUUID()}.pdf`);
    },
  }),
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
        new UnsupportedMediaTypeError("Only PDF files are allowed.", "PDF_ONLY"),
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
            "PDF_TOO_LARGE",
          ),
        );
        return;
      }

      next(new BadRequestError("Invalid PDF upload.", "INVALID_PDF_UPLOAD"));
      return;
    }

    next(error);
  });
};

export const verifyPdfFile = async (filePath: string): Promise<void> => {
  const file = await open(filePath, "r");

  try {
    const header = Buffer.alloc(1024);
    const { bytesRead } = await file.read(header, 0, header.length, 0);

    if (header.subarray(0, bytesRead).indexOf("%PDF-") === -1) {
      throw new UnsupportedMediaTypeError(
        "The uploaded file is not a valid PDF.",
        "INVALID_PDF_SIGNATURE",
      );
    }
  } finally {
    await file.close();
  }
};

export const removeUploadedPdf = (filePath: string): Promise<void> =>
  unlink(filePath);
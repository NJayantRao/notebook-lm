import { randomUUID } from "node:crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { ENV } from "../config/env.js";
import { BadGatewayError, ServiceUnavailableError } from "../utils/api-error.js";

export class S3ObjectNotFoundError extends Error {
  readonly code = "S3_OBJECT_NOT_FOUND";

  constructor(key: string) {
    super(`S3 object ${key} does not exist.`);
    this.name = "S3ObjectNotFoundError";
  }
}

let client: S3Client | undefined;

const getClient = (): S3Client => {
  if (!client) {
    const endpoint = ENV.AWS_ENDPOINT_URL_S3;
    const accessKeyId = ENV.AWS_ACCESS_KEY_ID;
    const secretAccessKey = ENV.AWS_SECRET_ACCESS_KEY;

    client = new S3Client({
      region: ENV.AWS_REGION,
      ...(endpoint ? { endpoint } : {}),
      ...(accessKeyId && secretAccessKey
        ? { credentials: { accessKeyId, secretAccessKey } }
        : {}),
      forcePathStyle: ENV.S3_FORCE_PATH_STYLE ?? Boolean(endpoint),
      requestChecksumCalculation: "WHEN_REQUIRED",
    });
  }

  return client;
};

const isMissingObjectError = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  if ("name" in error && error.name === "NoSuchKey") {
    return true;
  }

  if ("$metadata" in error && typeof error.$metadata === "object") {
    const metadata = error.$metadata as { httpStatusCode?: number };
    return metadata.httpStatusCode === 404;
  }

  return false;
};

const buildKey = (workspaceId: string): string => {
  const prefix = ENV.S3_KEY_PREFIX?.replace(/^\/+|\/+$/g, "");
  const segments = [prefix, "workspaces", workspaceId, "pdfs", `${randomUUID()}.pdf`];

  return segments.filter((segment): segment is string => Boolean(segment)).join("/");
};

export const getPdfUrl = (key: string): string => {
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  if (ENV.S3_PUBLIC_BASE_URL) {
    return `${ENV.S3_PUBLIC_BASE_URL.replace(/\/+$/, "")}/${encodedKey}`;
  }

  return `s3://${ENV.S3_BUCKET}/${key}`;
};

// Short-lived URL for on-demand viewing/downloading. Never persist this in DB.
export const getSignedPdfUrl = async (
  key: string,
  expiresIn = 900
): Promise<string> => {
  try {
    return await getSignedUrl(
      getClient(),
      new GetObjectCommand({ Bucket: ENV.S3_BUCKET, Key: key }),
      { expiresIn }
    );
  } catch (error) {
    console.error("Failed to create signed PDF URL:", error);
    throw new ServiceUnavailableError(
      "A download link could not be created.",
      "S3_PRESIGN_FAILED"
    );
  }
};

export const putPdf = async (
  workspaceId: string,
  buffer: Uint8Array
): Promise<{ key: string; url: string }> => {
  const key = buildKey(workspaceId);

  try {
    await getClient().send(
      new PutObjectCommand({
        Bucket: ENV.S3_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: "application/pdf",
      })
    );
  } catch (error) {
    console.error(`Failed to upload PDF to S3 (${key}):`, error);
    throw new ServiceUnavailableError(
      "The PDF could not be stored. Please try again.",
      "S3_UPLOAD_FAILED"
    );
  }

  return { key, url: getPdfUrl(key) };
};

export const getPdf = async (key: string): Promise<Buffer> => {
  try {
    const response = await getClient().send(
      new GetObjectCommand({ Bucket: ENV.S3_BUCKET, Key: key })
    );

    if (!response.Body) {
      throw new S3ObjectNotFoundError(key);
    }

    return Buffer.from(await response.Body.transformToByteArray());
  } catch (error) {
    if (error instanceof S3ObjectNotFoundError || isMissingObjectError(error)) {
      throw new S3ObjectNotFoundError(key);
    }

    if (error instanceof BadGatewayError || error instanceof ServiceUnavailableError) {
      throw error;
    }

    console.error(`Failed to download PDF from S3 (${key}):`, error);
    throw new BadGatewayError(
      "The stored PDF could not be read.",
      "S3_DOWNLOAD_FAILED"
    );
  }
};

export const deletePdf = async (key: string): Promise<void> => {
  try {
    await getClient().send(
      new DeleteObjectCommand({ Bucket: ENV.S3_BUCKET, Key: key })
    );
  } catch (error) {
    if (isMissingObjectError(error)) {
      return;
    }

    if (error instanceof ServiceUnavailableError) {
      throw error;
    }

    console.error(`Failed to delete PDF from S3 (${key}):`, error);
    throw new ServiceUnavailableError(
      "The stored PDF could not be deleted.",
      "S3_DELETE_FAILED"
    );
  }
};

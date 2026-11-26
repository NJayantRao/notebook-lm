import { randomUUID } from "node:crypto";
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { ENV } from "../config/env.js";
import logger, { markLogged, timed } from "../config/logger.js";
import {
  BadGatewayError,
  BadRequestError,
  ServiceUnavailableError,
} from "../utils/api-error.js";

const PROVIDER = "s3";

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

const SAFE_KEY_SEGMENT = /^[A-Za-z0-9_-]+$/u;
const SAFE_OBJECT_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;

const requireSafeSegment = (value: string, field: string): string => {
  if (!SAFE_KEY_SEGMENT.test(value)) {
    throw new BadRequestError(`Invalid ${field}.`, "ARTIFACT_KEY_INVALID");
  }
  return value;
};

const requireSafeObjectName = (name: string): string => {
  if (!SAFE_OBJECT_NAME.test(name) || name.includes("..")) {
    throw new BadRequestError("Invalid artifact object name.", "ARTIFACT_KEY_INVALID");
  }
  return name;
};

const artifactPrefix = (workspaceId: string, artifactId?: string): string => {
  const configuredPrefix = ENV.S3_KEY_PREFIX?.replace(/^\/+|\/+$/g, "");
  const segments = [
    ...(configuredPrefix ? [configuredPrefix] : []),
    "workspaces",
    requireSafeSegment(workspaceId, "workspace id"),
    "artifacts",
    ...(artifactId ? [requireSafeSegment(artifactId, "artifact id")] : []),
  ];

  return `${segments.join("/")}/`;
};

const artifactKey = (
  workspaceId: string,
  artifactId: string,
  name: string
): string => `${artifactPrefix(workspaceId, artifactId)}${requireSafeObjectName(name)}`;

// Never persist this URL: presigned URLs expire and are generated on demand.
export const getSignedArtifactUrl = async (
  key: string,
  expiresIn = ENV.AUDIO_URL_TTL_SECONDS,
  contentType = "audio/mpeg",
  responseContentDisposition?: string
): Promise<string> => {
  try {
    return await timed("storage.artifact.presign", { provider: PROVIDER }, () =>
      getSignedUrl(
        getClient(),
        new GetObjectCommand({
          Bucket: ENV.S3_BUCKET,
          Key: key,
          ResponseContentType: contentType,
          ...(responseContentDisposition
            ? { ResponseContentDisposition: responseContentDisposition }
            : {}),
        }),
        { expiresIn }
      )
    );
  } catch (error) {
    logger.error("storage.artifact.presign.failed", { provider: PROVIDER, error });
    const apiError = new ServiceUnavailableError(
      "An audio link could not be created.",
      "ARTIFACT_AUDIO_PRESIGN_FAILED"
    );
    markLogged(apiError);
    throw apiError;
  }
};

export const putArtifactObject = async (
  workspaceId: string,
  artifactId: string,
  name: string,
  buffer: Uint8Array,
  contentType: string
): Promise<string> => {
  const key = artifactKey(workspaceId, artifactId, name);

  try {
    await timed(
      "storage.artifact.upload",
      {
        provider: PROVIDER,
        workspaceId,
        artifactId,
        size: buffer.byteLength,
        contentType,
      },
      () =>
        getClient().send(
          new PutObjectCommand({
            Bucket: ENV.S3_BUCKET,
            Key: key,
            Body: buffer,
            ContentType: contentType,
          })
        )
    );
  } catch (error) {
    logger.error("storage.artifact.upload.failed", {
      provider: PROVIDER,
      workspaceId,
      artifactId,
      error,
    });
    const apiError = new ServiceUnavailableError(
      "The generated audio could not be stored.",
      "ARTIFACT_AUDIO_UPLOAD_FAILED"
    );
    markLogged(apiError);
    throw apiError;
  }

  return key;
};

export const getArtifactObject = async (key: string): Promise<Buffer> => {
  try {
    const response = await timed(
      "storage.artifact.download",
      { provider: PROVIDER, keyLength: key.length },
      () =>
        getClient().send(
          new GetObjectCommand({ Bucket: ENV.S3_BUCKET, Key: key })
        )
    );

    if (!response.Body) {
      throw new S3ObjectNotFoundError(key);
    }

    return Buffer.from(await response.Body.transformToByteArray());
  } catch (error) {
    if (error instanceof S3ObjectNotFoundError || isMissingObjectError(error)) {
      throw new S3ObjectNotFoundError(key);
    }
    if (error instanceof ServiceUnavailableError) {
      throw error;
    }

    logger.error("storage.artifact.download.failed", {
      provider: PROVIDER,
      keyLength: key.length,
      error,
    });
    const apiError = new BadGatewayError(
      "The generated audio could not be read.",
      "ARTIFACT_AUDIO_DOWNLOAD_FAILED"
    );
    markLogged(apiError);
    throw apiError;
  }
};

export const deleteArtifactObject = async (key: string): Promise<void> => {
  try {
    await timed(
      "storage.artifact.delete",
      { provider: PROVIDER, keyLength: key.length },
      () =>
        getClient().send(
          new DeleteObjectCommand({ Bucket: ENV.S3_BUCKET, Key: key })
        )
    );
  } catch (error) {
    if (isMissingObjectError(error)) {
      return;
    }
    if (error instanceof ServiceUnavailableError) {
      throw error;
    }

    logger.error("storage.artifact.delete.failed", {
      provider: PROVIDER,
      keyLength: key.length,
      error,
    });
    const apiError = new ServiceUnavailableError(
      "The generated audio could not be deleted.",
      "ARTIFACT_AUDIO_DELETE_FAILED"
    );
    markLogged(apiError);
    throw apiError;
  }
};

const listArtifactKeys = async (prefix: string): Promise<string[]> => {
  const keys: string[] = [];
  let continuationToken: string | undefined;

  try {
    do {
      const response = await timed(
        "storage.artifact.list",
        { provider: PROVIDER, prefixLength: prefix.length },
        () =>
          getClient().send(
            new ListObjectsV2Command({
              Bucket: ENV.S3_BUCKET,
              Prefix: prefix,
              ContinuationToken: continuationToken,
            })
          )
      );

      for (const object of response.Contents ?? []) {
        if (object.Key) {
          keys.push(object.Key);
        }
      }
      continuationToken = response.NextContinuationToken;
    } while (continuationToken);
  } catch (error) {
    logger.error("storage.artifact.list.failed", {
      provider: PROVIDER,
      prefixLength: prefix.length,
      error,
    });
    const apiError = new ServiceUnavailableError(
      "Generated audio objects could not be listed.",
      "ARTIFACT_AUDIO_LIST_FAILED"
    );
    markLogged(apiError);
    throw apiError;
  }

  return keys;
};

/** Deletes one artifact's objects, or every artifact object in a workspace. */
export const deleteArtifactPrefix = async (
  workspaceId: string,
  artifactId?: string
): Promise<number> => {
  const prefix = artifactPrefix(workspaceId, artifactId);
  const keys = await listArtifactKeys(prefix);
  if (keys.length === 0) {
    return 0;
  }

  try {
    for (let offset = 0; offset < keys.length; offset += 1000) {
      const batch = keys.slice(offset, offset + 1000);
      await timed(
        "storage.artifact.delete_batch",
        { provider: PROVIDER, count: batch.length, prefixLength: prefix.length },
        () =>
          getClient().send(
            new DeleteObjectsCommand({
              Bucket: ENV.S3_BUCKET,
              Delete: {
                Objects: batch.map((key) => ({ Key: key })),
                Quiet: true,
              },
            })
          )
      );
    }
  } catch (error) {
    logger.error("storage.artifact.delete_batch.failed", {
      provider: PROVIDER,
      count: keys.length,
      prefixLength: prefix.length,
      error,
    });
    const apiError = new ServiceUnavailableError(
      "Generated audio objects could not be deleted.",
      "ARTIFACT_AUDIO_DELETE_FAILED"
    );
    markLogged(apiError);
    throw apiError;
  }

  return keys.length;
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
    return await timed("storage.presign", { provider: PROVIDER }, () =>
      getSignedUrl(
        getClient(),
        new GetObjectCommand({ Bucket: ENV.S3_BUCKET, Key: key }),
        { expiresIn }
      )
    );
  } catch (error) {
    logger.error("storage.presign.failed", { provider: PROVIDER, error });
    const apiError = new ServiceUnavailableError(
      "A download link could not be created.",
      "S3_PRESIGN_FAILED"
    );
    markLogged(apiError);
    throw apiError;
  }
};

export const putPdf = async (
  workspaceId: string,
  buffer: Uint8Array
): Promise<{ key: string; url: string }> => {
  const key = buildKey(workspaceId);

  try {
    await timed(
      "storage.upload",
      { provider: PROVIDER, workspaceId, size: buffer.byteLength },
      () =>
        getClient().send(
          new PutObjectCommand({
            Bucket: ENV.S3_BUCKET,
            Key: key,
            Body: buffer,
            ContentType: "application/pdf",
          })
        )
    );
  } catch (error) {
    logger.error("storage.upload.failed", {
      provider: PROVIDER,
      workspaceId,
      error,
    });
    const apiError = new ServiceUnavailableError(
      "The PDF could not be stored. Please try again.",
      "S3_UPLOAD_FAILED"
    );
    markLogged(apiError);
    throw apiError;
  }

  return { key, url: getPdfUrl(key) };
};

export const getPdf = async (key: string): Promise<Buffer> => {
  try {
    const response = await timed(
      "storage.download",
      { provider: PROVIDER, keyLength: key.length },
      () =>
        getClient().send(
          new GetObjectCommand({ Bucket: ENV.S3_BUCKET, Key: key })
        )
    );

    if (!response.Body) {
      throw new S3ObjectNotFoundError(key);
    }

    return Buffer.from(await response.Body.transformToByteArray());
  } catch (error) {
    if (error instanceof S3ObjectNotFoundError || isMissingObjectError(error)) {
      // Expected on deleted or never-created objects; the caller handles it.
      throw new S3ObjectNotFoundError(key);
    }

    if (error instanceof BadGatewayError || error instanceof ServiceUnavailableError) {
      throw error;
    }

    logger.error("storage.download.failed", {
      provider: PROVIDER,
      keyLength: key.length,
      error,
    });
    const apiError = new BadGatewayError(
      "The stored PDF could not be read.",
      "S3_DOWNLOAD_FAILED"
    );
    markLogged(apiError);
    throw apiError;
  }
};

export const deletePdf = async (key: string): Promise<void> => {
  try {
    await timed(
      "storage.delete",
      { provider: PROVIDER, keyLength: key.length },
      () =>
        getClient().send(
          new DeleteObjectCommand({ Bucket: ENV.S3_BUCKET, Key: key })
        )
    );
  } catch (error) {
    if (isMissingObjectError(error)) {
      return;
    }

    if (error instanceof ServiceUnavailableError) {
      throw error;
    }

    logger.error("storage.delete.failed", {
      provider: PROVIDER,
      keyLength: key.length,
      error,
    });
    const apiError = new ServiceUnavailableError(
      "The stored PDF could not be deleted.",
      "S3_DELETE_FAILED"
    );
    markLogged(apiError);
    throw apiError;
  }
};

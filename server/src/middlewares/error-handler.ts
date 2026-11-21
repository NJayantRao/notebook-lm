import ApiError, {
  BadRequestError,
  InternalServerError,
  PayloadTooLargeError,
} from "../utils/api-error.js";

const errorMiddleware = (err: any, _req: any, res: any, _next: any) => {
  if (err instanceof ApiError) {
    console.error(err.stack);
    return res.status(err.statusCode).json(err);
  }

  let error: ApiError;

  if (err?.status >= 400 && err?.status < 500) {
    if (err.type === "entity.parse.failed") {
      error = new BadRequestError("Malformed JSON request body", "INVALID_JSON");
    } else if (err.status === 413 || err.type === "entity.too.large") {
      error = new PayloadTooLargeError("Request payload is too large");
    } else {
      error = new BadRequestError("Invalid request");
    }
  } else {
    console.error("[UNHANDLED_ERROR]: ", err?.stack ?? err);
    error = new InternalServerError("Internal Server Error");
  }

  console.error(error.stack);
  return res.status(error.statusCode).json(error);
};

export default errorMiddleware;

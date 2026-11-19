import ApiError, { InternalServerError } from "../utils/api-error.js";

const errorMiddleware = (err: any, _req: any, res: any, _next: any) => {
  if (err instanceof ApiError) {
    console.error(err.stack);
    return res.status(err.statusCode).json(err);
  }

  console.error("[UNHANDLED_ERROR]: ", err.stack);
  return res
    .status(500)
    .json(new InternalServerError(err?.message ?? "Internal Server Error"));
};

export default errorMiddleware;
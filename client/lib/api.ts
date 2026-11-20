import axios from "axios";

const baseURL =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== "undefined" ? window.location.origin : "http://localhost:5000");

export const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

export type ApiEnvelope<T> = {
  statusCode: number;
  success: boolean;
  message: string;
  data?: T;
};

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { message?: string; error?: string | { message?: string } }
      | undefined;
    const nestedError =
      typeof data?.error === "string" ? data.error : data?.error?.message;
    return (
      data?.message ||
      nestedError ||
      (typeof error.response?.statusText === "string"
        ? error.response.statusText
        : null) ||
      error.message ||
      "Something went wrong. Please try again."
    );
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

/**
 * API base URL for backend requests.
 * Set NEXT_PUBLIC_API_URL in production (e.g. Railway backend service URL).
 * Defaults to http://localhost:8000 for local development.
 */
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

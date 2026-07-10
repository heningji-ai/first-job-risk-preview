const viteEnv = (import.meta as unknown as { env?: { VITE_API_BASE_URL?: string } }).env;

export const API_BASE_URL = viteEnv?.VITE_API_BASE_URL || "";

export function buildApiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

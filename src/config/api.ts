const viteEnv = (
  import.meta as unknown as {
    env?: {
      DEV?: boolean;
      PROD?: boolean;
      VITE_API_BASE_URL?: string;
      VITE_PAYMENT_MODE?: "mock" | "native";
    };
  }
).env;

export const API_BASE_URL = viteEnv?.VITE_API_BASE_URL || "";

export const PAYMENT_MODE = viteEnv?.VITE_PAYMENT_MODE || (viteEnv?.PROD ? "native" : "mock");

export const IS_PRODUCTION = Boolean(viteEnv?.PROD);

export function buildApiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

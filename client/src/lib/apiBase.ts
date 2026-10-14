export function getApiBaseUrl(): string {
  const configured = (import.meta.env.VITE_API_BASE_URL ?? "").trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  if (typeof window === "undefined") {
    return "";
  }

  return window.location.origin;
}

export function buildApiUrl(pathname: string): string {
  const base = getApiBaseUrl();
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;

  if (!base) {
    return normalizedPath;
  }

  return `${base}${normalizedPath}`;
}

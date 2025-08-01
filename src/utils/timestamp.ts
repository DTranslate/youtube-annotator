export function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function parseTimestamp(href: string): number | null {
  if (!href.startsWith("#t=")) return null;
  const seconds = parseInt(href.slice(3), 10);
  return isNaN(seconds) ? null : seconds;
}
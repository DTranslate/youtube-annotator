// as part of a modular design - all annotation timestamp settings will live here
import{ YoutubeUrlModal } from "modals/promptmodal";


export function formatTimestamp(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}
export function parseTimestamp(timestamp: string): number | null {
  const parts = timestamp.split(":");
  if (parts.length === 2) {
    const minutes = parseInt(parts[0], 10);
    const seconds = parseInt(parts[1], 10);
    return minutes * 60 + seconds;
  } else if (parts.length === 1) {
    const seconds = parseInt(parts[0], 10);
    return seconds;
  }
  return null;
}
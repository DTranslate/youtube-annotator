// as part of a modular design - all annotation timestamp settings will live here
import { PromptModal } from "@modal/promptmodal";


export function formatTimestamp(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}




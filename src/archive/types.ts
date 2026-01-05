export type ArchiveMediaKind = "audio" | "video" | "text" | "other";

export interface ArchiveFile {
  name: string;           // e.g., "track01.mp3"
  format?: string;        // e.g., "VBR MP3", "MPEG4", "Ogg Vorbis"
  size?: number;          // bytes (string/number in API; we'll normalize)
  original?: string;      // sometimes present in metadata
  source?: string;        // "original", "derivative"
  // any other fields we don't care about are ignored
}

export interface ArchiveMetadata {
  dir: string;            // e.g., "/details/<identifier>"
  files: ArchiveFile[];
  metadata?: Record<string, unknown>;
}

export interface ArchiveResolution {
  provider: "archive";
  identifier: string;
  // best native file if available (prefer audio for audio items, video for video items)
  bestFileUrl?: string;
  bestFileKind?: ArchiveMediaKind;  // "audio" | "video"
  // When no native pick is found or you prefer iframe anyway:
  embedUrl: string;       // https://archive.org/embed/<identifier>?start=...
  // Full lists (optional, for debugging/UX)
  audioFiles: ArchiveFile[];
  videoFiles: ArchiveFile[];
  textFiles: ArchiveFile[];
  otherFiles: ArchiveFile[];
}

// ========== /src/archive/types.ts — APPEND/ADJUST ==========
export interface ArchiveTrackInfo {
  n: number;
  name: string;
  length: string;   // "hh:mm:ss" or "mm:ss" (may be empty when unknown)
  seconds: number;  // parsed length (0 if unknown)
  url: string;      // direct download URL for the track
}

export interface ArchiveInfo {
  title?: string;
  creator?: string;
  date?: string;
  language?: string;
  topics?: string[];
  collection?: string[];
  license_url?: string;
  track_count: number;
  duration_total: string; // "hh:mm:ss"
  tracks: ArchiveTrackInfo[];
}

// Extend your existing ArchiveResolution:
export interface ArchiveResolution {
  provider: "archive";
  identifier: string;
  bestFileUrl?: string;
  bestFileKind?: ArchiveMediaKind;
  embedUrl: string;
  audioFiles: ArchiveFile[];
  videoFiles: ArchiveFile[];
  textFiles: ArchiveFile[];
  otherFiles: ArchiveFile[];
  info: ArchiveInfo;              // <<<<<<<<<<<<<<<<<<<<<<<<<< added
}

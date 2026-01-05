import type { ArchiveMetadata } from "./types";

type ArchiveFile = ArchiveMetadata["files"][number];

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

function isArchiveApiResponse(x: unknown): x is {
  dir?: unknown;
  files: ArchiveFile[];
  metadata?: unknown;
} {
  if (!isRecord(x)) return false;
  if (!("files" in x) || !Array.isArray(x.files)) return false;
  return true;
}

// Minimal fetch wrapper with friendly errors + size normalization
export async function fetchArchiveMetadata(identifier: string): Promise<ArchiveMetadata> {
  const url = `https://archive.org/metadata/${encodeURIComponent(identifier)}`;

  let resp: Response;
  try {
    resp = await fetch(url, { method: "GET" });
  } catch {
    throw new Error(`Archive.org: network error while loading metadata for "${identifier}"`);
  }

  if (!resp.ok) {
    if (resp.status === 404) throw new Error(`Archive.org: item not found ("${identifier}")`);
    throw new Error(`Archive.org: ${resp.status} while loading "${identifier}"`);
  }

  const data: unknown = await resp.json();

  if (!isArchiveApiResponse(data)) {
    throw new Error(`Archive.org: unexpected metadata format for "${identifier}"`);
  }

  const dir = typeof data.dir === "string" ? data.dir : "";
  const metadata = isRecord(data.metadata) ? data.metadata : {};

  const files: ArchiveFile[] = data.files;

  // Normalize sizes to numbers (no any)
  for (const f of files) {
    // size may arrive as string from API; treat as unknown then normalize
    const sizeVal = (f as { size?: unknown }).size;

    if (typeof sizeVal === "string") {
      const n = Number(sizeVal);
      if (!Number.isNaN(n)) {
        (f as { size?: number }).size = n;
      }
    }
  }

  return { dir, files, metadata };
}

// Quick helper to extract identifier from common URLs
export function extractIdentifierFromUrl(urlOrId: string): string {
  // Allow passing raw identifier directly
  if (!/^https?:\/\//i.test(urlOrId)) return urlOrId;

  // Matches /details/<identifier>, /embed/<identifier>, /download/<identifier>/file
  const mDetails = /archive\.org\/details\/([^/?#]+)/i.exec(urlOrId);
  if (mDetails?.[1]) return mDetails[1];

  const mEmbed = /archive\.org\/embed\/([^/?#]+)/i.exec(urlOrId);
  if (mEmbed?.[1]) return mEmbed[1];

  const mDl = /archive\.org\/download\/([^/?#]+)/i.exec(urlOrId);
  if (mDl?.[1]) return mDl[1];

  // As a last resort, return what they gave; API may still accept it
  return urlOrId;
}

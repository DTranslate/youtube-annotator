import type { ArchiveMetadata } from "./types";

// Minimal fetch wrapper with friendly errors + size normalization
export async function fetchArchiveMetadata(identifier: string): Promise<ArchiveMetadata> {
  const url = `https://archive.org/metadata/${encodeURIComponent(identifier)}`;

  let resp: Response;
  try {
    resp = await fetch(url, { method: "GET" });
  } catch (e) {
    throw new Error(`Archive.org: network error while loading metadata for "${identifier}"`);
  }

  if (!resp.ok) {
    if (resp.status === 404) throw new Error(`Archive.org: item not found ("${identifier}")`);
    throw new Error(`Archive.org: ${resp.status} while loading "${identifier}"`);
  }

  const data = await resp.json();

  if (!data || !Array.isArray(data.files)) {
    throw new Error(`Archive.org: unexpected metadata format for "${identifier}"`);
  }

  // Normalize sizes to numbers
  for (const f of data.files) {
    if (typeof (f as any).size === "string") {
      const n = Number((f as any).size);
      if (!Number.isNaN(n)) (f as any).size = n;
    }
  }

  return {
    dir: data.dir ?? "",
    files: data.files,
    metadata: data.metadata ?? {},
  };
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

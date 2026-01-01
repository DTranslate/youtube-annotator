// main.ts starts here 
import { Plugin, WorkspaceLeaf, Notice, MarkdownView, TFile, addIcon } from "obsidian";
import {
  VIEW_TYPE_YOUTUBE_ANNOTATOR,
} from "./constants";
import {
  YoutubeAnnotatorSettingTab,
  DEFAULT_SETTINGS,
  YoutubeAnnotatorSettings,
} from "./settings";
import { YouTubeView } from "./views/YouTubeView";
import { registerCommands } from "./commands";
import { YoutubePromptModal } from "./modal/YoutubePromptModal";
import { createNoteFromTemplate } from "./utils/createNoteFromTemplate";
import { extractVideoIdFromFrontmatter } from "./utils/extractVideoId";
import { registerTimestampHandlers } from "./utils/timestamphandlers"
import { registerTypingPauseResume } from "./utils/typingPauseResume";
import { registerYouTubeLinkHandlers } from "./utils/youtubeLinkHandlers";
import { captureScreenshot } from "utils/captureScreenshot";
import { makeArchiveSeekPostProcessor } from "./utils/archiveRegisterSeekLinks";


type PinnedLeaf = WorkspaceLeaf & { pinned: boolean };
function isPinnedLeaf(leaf: WorkspaceLeaf): leaf is PinnedLeaf {
  return "pinned" in leaf;
}

export default class YoutubeAnnotatorPlugin extends Plugin {
  settings: YoutubeAnnotatorSettings = DEFAULT_SETTINGS;

public async activateView(videoId?: string, opts: { focus?: boolean } = {}) {
  const { focus = false } = opts;
  const leaf = this.getOrCreateYouTubeLeaf(true);
  if (!leaf) return;

  await leaf.setViewState({
    type: VIEW_TYPE_YOUTUBE_ANNOTATOR,
    state: { videoId },
    active: !!focus,
  });

  // Only reveal if you explicitly want to focus the player
  if (focus) this.app.workspace.revealLeaf(leaf);
}
// ⬇️ Track the last-focused Markdown editor
  lastMdLeaf: WorkspaceLeaf | null = null;

/** Reuse the existing YouTube leaf. Prefer a pinned one. Create on the right only if missing. */
private getOrCreateYouTubeLeaf(preferPinned = true): WorkspaceLeaf | null {
  const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_YOUTUBE_ANNOTATOR);
  if (leaves.length) {
    if (preferPinned) {
      const pinned = leaves.find((l) => isPinnedLeaf(l) && l.pinned);
      if (pinned) return pinned;
    }
    return leaves[0];
  }

  // None exists yet → create at the right, but don’t force focus
  return this.app.workspace.getRightLeaf(true);
}

/** Prefer the last-focused Markdown editor; else the active one; else any markdown leaf. */
getPreferredMarkdownLeaf(): WorkspaceLeaf | null {
  // Is our cached leaf still part of the workspace?
  const openMdLeaves = this.app.workspace.getLeavesOfType("markdown");
  const stillOpen = this.lastMdLeaf
    ? openMdLeaves.includes(this.lastMdLeaf)
    : false;

  if (this.lastMdLeaf && stillOpen) {
    return this.lastMdLeaf;
  }

  // Fallbacks
  const active = this.app.workspace.getActiveViewOfType(MarkdownView)?.leaf ?? null;
  if (active) return active;

  const any = openMdLeaves.first() ?? null;
  return any;
}

async onload() {

  //===================== ADD ICON TO RIBBON =======================
addIcon(
  "yt-annotator",
  // Simple, clean triangle-in-rounded-rect (uses currentColor for theme)
  `<svg viewBox="0 0 24 24" aria-hidden="true">
     <rect x="2" y="4" rx="4" ry="4" width="20" height="16" fill="none" stroke="currentColor" stroke-width="1.5"/>
     <path d="M10 9l5 3-5 3V9z" fill="currentColor"/>
   </svg>`
);    

  this.addRibbonIcon("yt-annotator", "Open YouTube Annotator", () => {
    this.openModal();
  });
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

  this.registerView(
    VIEW_TYPE_YOUTUBE_ANNOTATOR,
    (leaf) => new YouTubeView(leaf, this)
  );

  this.registerEvent(
    this.app.workspace.on("file-open", async (file) => {
    // Only care about markdown files
    if (!file || file.extension !== "md") return;

    // Get videoId from the note's frontmatter
    const videoId = extractVideoIdFromFrontmatter(file, this.app.metadataCache);
    if (!videoId) return;

    // If a YouTube view already exists…
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_YOUTUBE_ANNOTATOR).first();
    if (existing) {
      // …and it’s pinned, leave it alone (keep size/minimized state)
      if (isPinnedLeaf(existing) && existing.pinned) return;

      // Otherwise, reuse the leaf and just swap the videoId
      await existing.setViewState({
        type: VIEW_TYPE_YOUTUBE_ANNOTATOR,
        state: { videoId },
        active: true,
      });
      this.app.workspace.revealLeaf(existing);
      return;
    }

    // Track the last-focused Markdown editor so toolbar actions know where to insert
  this.registerEvent(
    this.app.workspace.on("active-leaf-change", (leaf) => {
      if (!leaf) return;
      const view = leaf.view;
      if (view instanceof MarkdownView) {
        this.lastMdLeaf = leaf;
      }
    })
  );


// ============ Unified file-open listener (YT  + Archive ) ============
this.registerEvent(
  this.app.workspace.on("file-open", async (file) => {
    if (!file || file.extension !== "md") return;

    // ---------- YOUTUBE BRANCH (kept as-is) ----------
    const videoId = extractVideoIdFromFrontmatter(file, this.app.metadataCache);
    if (videoId) {
      const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_YOUTUBE_ANNOTATOR).first();
      if (existing) {
        if ((existing as any).pinned) return;
        await existing.setViewState({
          type: VIEW_TYPE_YOUTUBE_ANNOTATOR,
          state: { videoId },
          active: true,
        });
        this.app.workspace.revealLeaf(existing);
      } else {
        const right = this.app.workspace.getRightLeaf(false) || this.app.workspace.getRightLeaf(true);
        if (!right) return;
        await right.setViewState({
          type: VIEW_TYPE_YOUTUBE_ANNOTATOR,
          state: { videoId },
          active: true,
        });
        this.app.workspace.revealLeaf(right);
      }
      // NOTE: Do not return here; continue so Archive notes can also be handled on other opens.
    }

    // ---------- ARCHIVE BRANCH (bootstrap if needed) ----------
    const cache = this.app.metadataCache.getFileCache(file);
    let fm: any = cache?.frontmatter ?? null;

    const renderArchive = async (url: string) => {
  // ✅ Reuse existing Annotator leaf (prefer pinned), else create one
  const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_YOUTUBE_ANNOTATOR);
  const leaf =
    leaves.find((l) => (l as any).pinned) ??
    leaves[0] ??
    this.app.workspace.getRightLeaf(true);

  if (!leaf) return;

  await leaf.setViewState({ type: VIEW_TYPE_YOUTUBE_ANNOTATOR, state: {} });
  this.app.workspace.revealLeaf(leaf);

  const view: any = leaf.view;
  if (typeof view?.renderArchiveFromUrl === "function") {
    await view.renderArchiveFromUrl(url);
  } else {
    new Notice("Archive renderer not available on this view.", 1000);
  }
};

    // Case A: already has archive front-matter → just render
    if (fm?.media?.provider === "archive" && typeof fm?.media?.url === "string") {
      await renderArchive(fm.media.url as string);
      return;
    }

    // Case B: per-track note just created via wiki-link → bootstrap it
    // Expect .../<notesFolder>/<Title>/<NN - Trackname.mp3>.md
    const parts = file.path.split("/");
    if (parts.length < 3) return; // not in a subfolder → nothing to do
    const titleFolder = parts.slice(0, -1).join("/");
    const titleName   = parts[parts.length - 2];
    const indexPath   = `${titleFolder}/${titleName}_Index.md`;
    const indexFile   = this.app.vault.getAbstractFileByPath(indexPath);

    if (!(indexFile instanceof TFile)) return;

    const indexFm: any = this.app.metadataCache.getFileCache(indexFile)?.frontmatter ?? {};
    const downloadBase: string | undefined = indexFm?.media?.download_base;
    const identifier: string | undefined   = indexFm?.media?.identifier;
    if (!downloadBase) return;

    // Derive media filename from the note filename: "... .mp3.md" -> "... .mp3"
const noteFileName = parts[parts.length - 1];
let mediaName = noteFileName.replace(/\.md$/i, "");

// If our note name has a cosmetic "NN - " prefix we added, strip just that.
// IMPORTANT: DO NOT strip if the original filename starts with "NN-" (no spaces), we want to keep that.
  mediaName = mediaName.replace(/^\d{1,3}\s*-\s+/, "");

  const trackUrl = `${downloadBase}${encodeURIComponent(mediaName)}`;

// Try to extract the numeric track index from the mediaName (e.g., "02-Track.mp3" -> 2, "2 Track.mp3" -> 2)
  const trackNoMatch = /^(\d{1,3})(?=[\s\-_\.])/.exec(mediaName);
  const track_no = trackNoMatch ? Number(trackNoMatch[1]) : undefined;

// Build or update frontmatter if missing
    const raw = await this.app.vault.read(file);
    const hasFrontmatter = raw.trimStart().startsWith("---");
    if (!hasFrontmatter) {
      const fmLines = [
        "---",
        "media:",
        "  provider: archive",
        `  url: ${JSON.stringify(trackUrl)}`,
        `  identifier: ${JSON.stringify(identifier ?? "")}`,
        // keep total count (from index FM), and also store this specific track's index
        ...(track_no != null ? [`  track_no: ${track_no}`] : []),
        `  track_count: ${JSON.stringify(indexFm?.media?.track_count ?? 1)}`,
        `  duration_total: ${JSON.stringify(indexFm?.media?.duration_total ?? "")}`,
        `  embed_url: ${JSON.stringify(indexFm?.media?.embed_url ?? `https://archive.org/embed/${identifier ?? ""}`)}`,
        `  download_base: ${JSON.stringify(downloadBase)}`,
        "archive:",
        `  title: ${JSON.stringify(titleName)}`,
        "---",
        `# ${mediaName}`,
        "",
        "> Notes:",
        "",
      ];
      await this.app.vault.modify(file, fmLines.join("\n"));
      // refresh cache post-modify
      fm = this.app.metadataCache.getFileCache(file)?.frontmatter ?? {};
    }


    if (fm?.media?.provider === "archive" && typeof fm?.media?.url === "string") {
      await renderArchive(fm.media.url as string);
    }

    // ---------- CLEANUP: close Annotator when opening non-media notes ----------
try {
  if (file) {
    const isYT = !!extractVideoIdFromFrontmatter(file, this.app.metadataCache);
    const fmAny: any = this.app.metadataCache.getFileCache(file)?.frontmatter ?? {};
    const isArchive = fmAny?.media?.provider === "archive";

    if (!isYT && !isArchive) {
      const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_YOUTUBE_ANNOTATOR);
      for (const leaf of leaves) {
        if (!(leaf as any).pinned) {
          const view: any = leaf.view;
          view?._disposeArchiveMedia?.();
          view?.playerWrapper?.pause?.();
        }
      }
    }
  }
} catch (e) {
  console.error("Annotator cleanup error:", e);
}



  })
);


  this.app.workspace.onLayoutReady(async () => {
    const file = this.app.workspace.getActiveFile();
    if (!(file instanceof TFile)) return;
    const vid = extractVideoIdFromFrontmatter(file, this.app.metadataCache);
    if (vid) await this.activateView(vid);
  });

 
 //===================== AUTO-PAUSE DURING NOTE TAKING  ======================= 

  
// Register Reading-mode and LP handlers
  const lpExtension = registerTimestampHandlers(this.app, (dispose) => this.register(dispose));
  this.registerEditorExtension(lpExtension);

  makeArchiveSeekPostProcessor(this.app);

  this.registerMarkdownPostProcessor(makeArchiveSeekPostProcessor(this.app));

  registerTypingPauseResume(this.app, this.settings, (cb) => this.register(cb))


  const ytExternalLink = registerYouTubeLinkHandlers(this.app, (cb) => this.register(cb));
  this.registerEditorExtension(ytExternalLink);

  // Also pause Archive native media while typing
this.registerEvent(
  this.app.workspace.on("editor-change", () => {
    const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_YOUTUBE_ANNOTATOR).first();
    const view: any = leaf?.view;
    const el = view?._archiveMediaEl as HTMLMediaElement | undefined;
    if (el) { try { el.pause(); } catch {} }
  })
);
// Debounced auto-resume for Archive native media after you stop typing
{
  let resumeTimer: number | null = null;
  const RESUME_DELAY_MS = (this.settings as any)?.typingResumeDelay ?? 1000; // fallback 1s

  const scheduleResume = () => {
    if (resumeTimer != null) window.clearTimeout(resumeTimer);
    resumeTimer = window.setTimeout(() => {
      const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_YOUTUBE_ANNOTATOR).first();
      const view: any = leaf?.view;
      const el = view?._archiveMediaEl as HTMLMediaElement | undefined;
      if (el && el.paused) {
        el.play?.().catch(() => {});
      }
    }, RESUME_DELAY_MS) as unknown as number;
  };

  // Reuse the same typing signal to schedule resume
  this.registerEvent(
    this.app.workspace.on("editor-change", () => {
      scheduleResume();
    })
  );
}


//===================== INITIALIZE PLUGIN =======================
  this.addSettingTab(new YoutubeAnnotatorSettingTab(this.app, this));
    registerCommands(this);
    //console.log(`[${PLUGIN_ID}] initialized`);
  }
//===================== LOAD PROMOT MODAL TO ACCEPT YOUTUBE LINKS =======================
  async openModal() {
  const modal = new YoutubePromptModal(
    this.app,
    async (
      videoId: string,
      originalUrl: string,
      videoAuthor: string,
      videoTitle: string
    ) => {
      //console.log("Video ID from modal:", videoId);

      // Step 1: Create note
      try {
        await createNoteFromTemplate(
          this.app,
          this.settings,
          videoAuthor,
          videoTitle,
          videoId,
          originalUrl
        );
        //console.log("Note created successfully");
      } catch (err) {
        console.error("Failed to create note:", err);
        new Notice("Note creation failed. Check template path or folder.");
      }

      // Step 2: Detach any existing views
      const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_YOUTUBE_ANNOTATOR);
      for (const leaf of leaves) {
        await leaf.detach();
      }

      await this.activateView(videoId);
    }
  );

  modal.open();
}

//===================== SAVE =======================
  async saveSettings() {
    await this.saveData(this.settings);
  }

//===================== THINGS TO OFFLOAD AT THE CLOSE =======================  
  onunload() {
    this.app.workspace
      .getLeavesOfType(VIEW_TYPE_YOUTUBE_ANNOTATOR)
      .forEach((leaf) => leaf.detach());

    //console.log(`[${PLUGIN_ID}] unloaded`);
  }
}

// main.ts ends here
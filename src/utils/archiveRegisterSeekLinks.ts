// src/utils/archiveRegisterSeekLinks.ts
// ----------------------------------------------------------------------------
// Intercepts [1:23](#seek-83) links in Reading/Preview and seeks the active
// Annotator view (YouTube or Archive). Registered via plugin.registerMarkdownPostProcessor.
// ----------------------------------------------------------------------------
import type { App, MarkdownPostProcessor, MarkdownPostProcessorContext } from "obsidian";
import { VIEW_TYPE_YOUTUBE_ANNOTATOR, SAVED_TIME_ANCHOR_PREFIX } from "../constants";

type SeekableView = {
  seekToSeconds?: (seconds: number) => void;
  playerWrapper?: {
    isPlayerReady?: () => boolean;
    setCurrentTime?: (seconds: number) => void;
    play?: () => void;
  };
  _archiveMediaEl?: HTMLMediaElement;
};

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

function asSeekableView(x: unknown): SeekableView | null {
  if (!isObject(x)) return null;
  return x as SeekableView;
}

export function makeArchiveSeekPostProcessor(app: App): MarkdownPostProcessor {
  return (el: HTMLElement, _ctx: MarkdownPostProcessorContext) => {
    el.querySelectorAll<HTMLAnchorElement>(
      `a[href^="#${SAVED_TIME_ANCHOR_PREFIX}"], a[href^="#seek-"]`
    ).forEach((anchor) => {
      anchor.addEventListener(
        "click",
        (evt) => {
          evt.preventDefault();
          evt.stopPropagation();

          const href = anchor.getAttribute("href") || "";
          const m = new RegExp(`^#(?:${SAVED_TIME_ANCHOR_PREFIX}|seek-)(\\d+)$`).exec(href);
          if (!m) return;

          const seconds = Number(m[1]);
          if (!Number.isFinite(seconds)) return;

          const leaf = app.workspace.getLeavesOfType(VIEW_TYPE_YOUTUBE_ANNOTATOR).first();
          const view = asSeekableView(leaf?.view);

          if (typeof view?.seekToSeconds === "function") {
            view.seekToSeconds(seconds);
            return;
          }

          try {
            if (view?.playerWrapper?.isPlayerReady?.()) {
              view.playerWrapper.setCurrentTime?.(seconds);
              view.playerWrapper.play?.();
              return;
            }

            const mediaEl = view?._archiveMediaEl;
            if (mediaEl) {
              mediaEl.currentTime = seconds;
              void mediaEl.play().catch(() => {
                // autoplay may be blocked; ignore
              });
            }
          } catch (e) {
            console.error("Seek link error:", e);
          }
        },
        { passive: false, capture: true }
      );
    });
  };
}

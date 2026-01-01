// src/utils/archiveRegisterSeekLinks.ts
// ----------------------------------------------------------------------------
// Intercepts [1:23](#seek-83) links in Reading/Preview and seeks the active
// Annotator view (YouTube or Archive). Registered via plugin.registerMarkdownPostProcessor.
// ----------------------------------------------------------------------------
import type { App, MarkdownPostProcessor, MarkdownPostProcessorContext } from "obsidian";
import { VIEW_TYPE_YOUTUBE_ANNOTATOR } from "../constants";
import { SAVED_TIME_ANCHOR_PREFIX } from "../constants";

export function makeArchiveSeekPostProcessor(app: App): MarkdownPostProcessor {
  return (el: HTMLElement, _ctx: MarkdownPostProcessorContext) => {
    el.querySelectorAll<HTMLAnchorElement>(`a[href^="#${SAVED_TIME_ANCHOR_PREFIX}"], a[href^="#seek-"]`).forEach((anchor) => {
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
          const view: any = leaf?.view;

          if (typeof view?.seekToSeconds === "function") {
            view.seekToSeconds(seconds);
            return;
          }
          try {
            if (view?.playerWrapper?.isPlayerReady?.()) {
              view.playerWrapper.setCurrentTime(seconds);
              view.playerWrapper.play?.();
              return;
            }
            const mediaEl = (view as any)?._archiveMediaEl as HTMLMediaElement | undefined;
            if (mediaEl) {
              mediaEl.currentTime = seconds;
              mediaEl.play().catch(() => {});
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

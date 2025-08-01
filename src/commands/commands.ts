import { App, MarkdownView, Notice,Plugin } from "obsidian";
import type YoutubeAnnotatorPlugin from "../main";
import { YoutubeUrlModal } from "modals/promptmodal"; 
import { getCurrentTimestamp } from "utils/video-timestamp";

export function registerCommands(plugin: YoutubeAnnotatorPlugin) {
  // Timestamp capture + pause/play toggle
  plugin.addCommand({
    id: "capture-timestamp-toggle-play",
    name: "Capture Timestamp and Pause/Resume",
    hotkeys: [{ modifiers: ["Mod", "Shift"], key: "T" }],
    callback: async () => {
      if (!plugin.player || typeof plugin.player.getPlayerState !== "function") {
        new Notice("YouTube player is not ready.");
        return;
      }

      try {
        const currentTime = plugin.player.getCurrentTime();
        const minutes = Math.floor(currentTime / 60);
        const seconds = Math.floor(currentTime % 60);
        const timestamp = `${minutes}:${seconds.toString().padStart(2, "0")}`;
        const playerState = plugin.player.getPlayerState();

        const leaf = plugin.app.workspace.getLeaf();
        const view = leaf?.view;
        if (!(view instanceof MarkdownView)) {
          new Notice("No markdown note is currently open.");
          return;
        }

        const editor = view.editor;
        editor.replaceRange(`[${timestamp}] `, editor.getCursor());

        if (playerState === window.YT.PlayerState.PLAYING) {
          plugin.player.pauseVideo();
          new Notice(`Paused at ${timestamp}`);
        } else {
          plugin.player.playVideo();
          new Notice(`Resumed at ${timestamp}`);
        }
      } catch (err) {
        console.error("Timestamp command error:", err);
        new Notice("Failed to capture timestamp.");
      }
    },
  });

  // New annotation note with YouTube URL
  plugin.addCommand({
    id: "open-youtube-annotator",
    name: "New YouTube Annotation",
    callback: async () => {
      const url = await plugin.promptForYoutubeUrl();
      if (!url) {
        new Notice("No URL entered.");
        return;
      }
      await plugin.createYoutubeAnnotationNote(url);
    },
  });

  // Insert timestamp only (non-interactive)
  plugin.addCommand({
    id: "insert-current-timestamp",
    name: "Insert Current YouTube Timestamp",
    editorCallback: (editor) => {
      const timestamp = getCurrentTimestamp(plugin.player); // <-- Make sure this uses plugin.player inside!
      editor.replaceSelection(`[${timestamp}](#${timestamp})`);
    },
  });
  plugin.addCommand({
  id: "open-youtube-modal",
  name: "Open YouTube Player Modal",
  callback: async () => {
    const url = await this.promptForYoutubeUrl(); // ask user for input
    if (!url) {
      new Notice("No YouTube URL provided.");
      return;
    }
    new YoutubeUrlModal(this.app, url).open();
  }
});
}

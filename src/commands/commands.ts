import { App, MarkdownView, Notice } from "obsidian";
import type YoutubeAnnotatorPlugin from "../main";
import { YoutubeUrlModal } from "modals/promptmodal"; 
import { getCurrentTimestamp } from "utils/video-timestamp"

export function registerCommands(plugin: YoutubeAnnotatorPlugin) {
  plugin.addCommand({
    id: "capture-timestamp-pause-play",
    name: "Capture Timestamp and Pause/Play",
    hotkeys: [
      { modifiers: ["Mod", "Shift"], key: "T" }
    ],
    callback: async () => {
      if (!plugin.player || typeof plugin.player.getPlayerState !== "function") {
        new Notice("YouTube player is not ready.");
        return;
      }

      try {
        const state = plugin.player.getPlayerState();
        const currentTime = plugin.player.getCurrentTime();
        const minutes = Math.floor(currentTime / 60);
        const seconds = Math.floor(currentTime % 60);
        const timestamp = `${minutes}:${seconds.toString().padStart(2, "0")}`;

        const leaf = plugin.app.workspace.getLeaf();
        const view = leaf.view;

        if (!(view instanceof MarkdownView)) {
          new Notice("No markdown note is currently open.");
          return;
        }

        const editor = view.editor;
        const cursor = editor.getCursor();
        editor.replaceRange(`[${timestamp}] `, cursor);

        if (state === window.YT.PlayerState.PLAYING) {
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
  plugin.addCommand({
    id: "open-youtube-annotator",
    name: "New YouTube Annotation",
    callback: async () => {
      const url = await plugin.promptForYoutubeUrl();
      if (!url) {
        new Notice("No URL entered");
        return;
      }
      await plugin.createYoutubeAnnotationNote(url);
    },
  });
  
  plugin.addCommand({
    id: "capture-timestamp-pause-play",
    name: "Capture Video Timestamp and Pause/Resume",
    hotkeys: [
      { modifiers: ["Mod", "Shift"], key: "T" },
    ],
    callback: async () => {
      if (!plugin.player) {
        new Notice("Video player is not active");
        return;
      }

      const playerState = plugin.player.getPlayerState();
      const currentTime = plugin.player.getCurrentTime();
      const minutes = Math.floor(currentTime / 60);
      const seconds = Math.floor(currentTime % 60);
      const timestampStr = `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;

      const leaf = plugin.app.workspace.getLeaf();
      if (!leaf) {
        new Notice("No active note open");
        return;
      }

      const view = leaf.view;
      if (!(view instanceof MarkdownView)) {
        new Notice("Active view is not a markdown note");
        return;
      }

      const editor = view.editor;
      const cursor = editor.getCursor();
      editor.replaceRange(`[${timestampStr}] `, cursor);

      if (playerState === window.YT.PlayerState.PLAYING) {
        plugin.player.pauseVideo();
        new Notice(`Paused at ${timestampStr}`);
      } else {
        plugin.player.playVideo();
        new Notice(`Resumed at ${timestampStr}`);
      }
    },
  });


plugin.addCommand({
  id: "insert-current-timestamp",
  name: "Insert Current YouTube Timestamp",
  editorCallback: (editor) => {
    const timestamp = getCurrentTimestamp();
    editor.replaceSelection(`[${timestamp}](#${timestamp})`);
  },
});

}

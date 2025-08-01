import { App, MarkdownView, Notice,Plugin } from "obsidian";
import type YoutubeAnnotatorPlugin from "../main";
import { YoutubeUrlModal } from "modals/promptmodal"; 
import { getCurrentTimestamp } from "utils/video-timestamp";
import { formatTimestamp } from "utils/timestamp";
import {extractYouTubeVideoId}  from "utils/youtube-utils"

export function registerCommands(plugin: YoutubeAnnotatorPlugin) {
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
    const player = plugin.player;
    if (!player || typeof player.getCurrentTime !== "function") {
      new Notice("YouTube player is not initialized.");
      return;
    }

    const videoId = extractYouTubeVideoId(player.getVideoUrl?.() || "") ?? "";
    if (!videoId) {
      new Notice("Unable to get video ID.");
      return;
    }

    const currentTime = Math.floor(player.getCurrentTime());
    const minutes = Math.floor(currentTime / 60);
    const seconds = currentTime % 60;

    // Format timestamp as [mm:ss]
    const timestampLabel = `[${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}]`;

    // Create YouTube watch URL with time param
    const youtubeUrl = `https://youtu.be/${videoId}?t=${currentTime}`;

    // Insert markdown link
    editor.replaceSelection(`${timestampLabel}(${youtubeUrl}) `);
  },
});

  // plugin.addCommand({
  //   id: "insert-current-timestamp",
  //   name: "Insert Current YouTube Timestamp",
  //   editorCallback: (editor) => {
  //     const timestamp = getCurrentTimestamp(plugin.player); // <-- Make sure this uses plugin.player inside!
  //     editor.replaceSelection(`[${timestamp}](#${timestamp})`);
  //   },
  // });
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

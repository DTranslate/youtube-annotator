// as part of a modular design - all modular settings will live here
import { App, Modal } from "obsidian";

export class TranscriptModal extends Modal {
  onOpen() {
    const { contentEl } = this;
    contentEl.setText("Transcript goes here.");
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

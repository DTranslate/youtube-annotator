// ========== ARCHIVE PROMPT MODAL — START ==========
import { App, Modal, Setting } from "obsidian";

export class ArchivePromptModal extends Modal {
  private resolve!: (v: string | null) => void;
  private inputEl!: HTMLInputElement;

  constructor(app: App) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    this.titleEl.setText("Open Archive.org URL");

    new Setting(contentEl)
      .setName("URL")
      .setDesc("Paste an Archive.org item or direct file link")
      .addText((t) => {
        this.inputEl = t.inputEl;
        t.setPlaceholder("https://archive.org/details/… or /download/…");
        t.inputEl.addClass("ya-url-input");
        this.modalEl.addClass("ya-archive-modal");
        t.onChange(() => {/* no-op */});
      });

    new Setting(contentEl)
      .addButton((b) =>
        b.setButtonText("Open")
          .setCta()
          .onClick(() => this.submit())
      )
      .addButton((b) =>
        b.setButtonText("Cancel")
          .onClick(() => this.closeWith(null))
      );

    // Enter submits
    this.inputEl.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") this.submit();
    });

    // Focus input
    window.setTimeout(() => this.inputEl.focus(), 10);
  }

  onClose() {
    this.contentEl.empty();
  }

  private submit() {
    const url = (this.inputEl?.value ?? "").trim();
    this.closeWith(url || null);
  }

  private closeWith(v: string | null) {
    this.close();
    if (this.resolve) this.resolve(v);
  }

  /** Open the modal and await the URL result (or null if canceled). */
  openAndGetUrl(): Promise<string | null> {
    return new Promise((res) => {
      this.resolve = res;
      this.open();
    });
  }
}
// ========== ARCHIVE PROMPT MODAL — END ==========

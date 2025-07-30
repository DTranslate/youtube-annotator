import { Modal, App, Setting } from "obsidian";
export{YoutubeUrlModal}
class YoutubeUrlModal extends Modal {
  onSubmit: (url: string) => void;

  constructor(app: App, onSubmit: (url: string) => void) {
    super(app);
    this.onSubmit = onSubmit;
  }

  onOpen() {
    let inputValue = "";
    const { contentEl } = this;

    contentEl.createEl("h2", { text: "Enter YouTube URL" });

    new Setting(contentEl)
      .setName("YouTube URL")
      .addText((text) =>
        text
          .setPlaceholder("https://www.youtube.com/watch?v=...")
          .onChange((value) => {
            inputValue = value;
          })
          .inputEl.setAttribute("style", "width: 400px;")
      );

    new Setting(contentEl)
      .addButton((btn) =>
        btn
          .setButtonText("Open")
          .setCta()
          .onClick(() => {
            this.close();
            this.onSubmit(inputValue);
          })
      );
  }

  onClose() {
    this.contentEl.empty();
  }
}

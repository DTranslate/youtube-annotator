import { App, Modal, Setting } from "obsidian";

export class PromptModal extends Modal {
	constructor(
		private placeholder: string,
		private onSubmit: (result: string | null) => void
	) {
		super(app);
	}

	onOpen() {
		let value = "";
		new Setting(this.contentEl)
			.setName(this.placeholder)
			.addText((text) =>
				text
					.setPlaceholder("https://youtube.com/...")
					.onChange((val) => (value = val))
			)
			.addButton((btn) =>
				btn
					.setButtonText("OK")
					.setCta()
					.onClick(() => {
						this.close();
						this.onSubmit(value || null);
					})
			);
	}

	onClose() {
		this.contentEl.empty();
	}
}

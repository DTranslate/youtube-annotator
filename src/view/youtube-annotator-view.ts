import { ItemView, WorkspaceLeaf } from "obsidian";

export const VIEW_TYPE_YOUTUBE_ANNOTATOR = "youtube-annotator-view";

export class YoutubeAnnotatorView extends ItemView {
	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_YOUTUBE_ANNOTATOR;
	}

	getDisplayText(): string {
		return "YouTube Annotator";
	}

	getIcon(): string {
		return "video"; // Or any other Obsidian icon name you like
	}

	async onOpen() {
		const container = this.containerEl.children[1];
		container.empty();

		const header = container.createEl("h2", { text: "YouTube Annotation Panel" });
		const placeholder = container.createEl("div", {
			text: "Annotations will appear here.",
			attr: { style: "margin-top: 1rem; color: var(--text-muted);" },
		});

		// Later, you can inject an annotation editor, transcript sync, etc.
	}

	async onClose() {
		// Optional cleanup
	}
}

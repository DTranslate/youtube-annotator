// as part of a modular design - all annotation timestamp settings will live here
export function formatTimestamp(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}
async function promptForYoutubeUrl(): Promise<string | null> {
	return new Promise((resolve) => {
		new PromptModal("Paste YouTube URL", (result: string | null) => {
			resolve(result);
		}).open();
	});
}

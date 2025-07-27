export function getYouTubeEmbedUrl(text: string): string | null {
	const regex =
		/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[^\s]*)/;
	const match = text.match(regex);

	if (match) {
		const videoId = match[1]; // ← actual YouTube ID
		const embedUrl = `${videoId}`;
		console.log("✅ Embed URL:", embedUrl);
		return embedUrl;
	} else {
		console.log("❌ No valid YouTube URL found.");
		return null;
	}
}

export function getYouTubeEmbedUrl(copiedUrl: string): string | null {
	
	const regex =
		/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[^\s]*)/;
	const match = copiedUrl.match(regex);
	
	if (match) {
		const videoId = match[1]; // ← actual YouTube ID
		const embedUrl = `https://www.youtube.com/embed/${videoId}?enablejsapi=1`;
		console.log("this is the youtube UID from youtube-utlis.ts", embedUrl);
		return embedUrl;
	} else {
		console.log("Not a valid YouTube URL found.");
		return null;
	}
}
export function getYouTubeVideoId(copiedUrl: string): string | null {
	const regex =
		/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[^\s]*)/;
	const match = copiedUrl.match(regex);

	if (match) {
		const videoId = match[1]; // ← actual YouTube ID
		console.log("this is the youtube UID", videoId);
		return videoId;
	} else {
		console.log("Not a valid YouTube URL found.");
		return null;
	}
}
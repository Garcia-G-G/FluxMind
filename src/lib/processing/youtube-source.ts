import { YoutubeTranscript } from "youtube-transcript";

export type YouTubeMetadata = {
  videoId: string;
  title: string;
  thumbnailUrl: string;
};

const YOUTUBE_REGEX =
  /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

export const parseYouTubeUrl = (url: string): string | null => {
  const match = url.match(YOUTUBE_REGEX);
  return match?.[1] ?? null;
};

export const getYouTubeMetadata = (videoId: string): YouTubeMetadata => {
  return {
    videoId,
    title: `YouTube Video: ${videoId}`,
    thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
  };
};

export const fetchYouTubeTranscript = async (
  videoId: string
): Promise<string> => {
  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    return transcript.map((item) => item.text).join(" ");
  } catch (error) {
    throw new Error(
      `Failed to fetch transcript: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
};

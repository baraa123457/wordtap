export type VideoDiscoverySource =
  | "youglish_rest"
  | "youtube_filmot"
  | "youtube_supadata"
  | "youtube_transcriptapi"
  | "user_subtitle"
  | "user_contributed";

export type CaptionCue = {
  start: number;
  end: number;
  text: string;
};

export type VerifiedVideoExample = {
  id: string;
  wordId: string | null;
  targetWord: string;
  youtubeVideoId: string;
  youtubeUrl: string;
  videoTitle: string;
  channelName: string;
  source: VideoDiscoverySource;
  timestampSeconds: number;
  verifiedTranscript: string;
  contextSentence: string;
  targetWordPosition: number;
  captionCues: CaptionCue[];
  transcriptVerified: boolean;
  captionAvailable: boolean;
  videoAvailable: boolean;
  discoveredAt: string;
};

export type FallbackContextExample = {
  sentence: string;
  sourceLabel: string;
  pronunciation?: string;
};

export type VideoDiscoveryDiagnostics = {
  status:
    | "verified"
    | "missing_credentials"
    | "missing_transcript_provider"
    | "no_matches"
    | "provider_error";
  message: string;
  providersAttempted: string[];
  missingEnvVars: string[];
  cacheStatus: "memory_hit" | "db_hit" | "fresh_discovery" | "empty";
};

export type VideoDiscoveryResponse = {
  word: string;
  videos: VerifiedVideoExample[];
  verifiedCount: number;
  fallbackContext: FallbackContextExample | null;
  fallbackContexts: FallbackContextExample[];
  diagnostics: VideoDiscoveryDiagnostics;
  providersConfigured: {
    youglishRest: boolean;
    filmot: boolean;
    youtubeData: boolean;
    supadata: boolean;
    transcriptApi: boolean;
  };
};

export type TranscriptMatchResult = {
  timestampSeconds: number;
  contextSentence: string;
  verifiedTranscript: string;
  targetWordPosition: number;
  captionCues: CaptionCue[];
  providerSource: "youtube_supadata" | "youtube_transcriptapi";
};

export interface ITranscriptProvider {
  readonly name: string;
  readonly source: "youtube_supadata" | "youtube_transcriptapi";
  isConfigured(): boolean;
  fetchTranscriptCues(videoId: string, lang: string): Promise<CaptionCue[] | null>;
}

export type DiscoveryQuery = {
  word: string;
  wordId?: string | null;
  lang: string;
  maxResults?: number;
  sourceUrl?: string;
  savedSentence?: string;
  sourceTitle?: string;
};

export interface IVideoDiscoveryProvider {
  readonly name: string;
  isConfigured(): boolean;
  discover(query: DiscoveryQuery): Promise<VerifiedVideoExample[]>;
}

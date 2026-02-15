
export interface VideoMetadata {
  name: string;
  size: number;
  type: string;
  lastModified: number;
}

export interface AIAnalysisResult {
  suggestedTitle: string;
  suggestedHashtags: string[];
  optimizationTips: string[];
}

export enum AppStatus {
  IDLE = 'IDLE',
  LOADING_FFMPEG = 'LOADING_FFMPEG',
  PROCESSING = 'PROCESSING',
  ANALYZING = 'ANALYZING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

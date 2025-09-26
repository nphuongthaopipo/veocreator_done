export enum AppView {
    CREATE_STORY,
    CREATE_PROMPTS,
    CREATE_THUMBNAIL,
    CREATE_VIDEO,
    AUTO_CREATE,
    AUTO_BROWSER,
    HISTORY,
    GET_YOUTUBE_SCRIPT,
    API_KEY,
    MANAGE_COOKIES,
    PROFILE,
    PACKAGES,
}

// --- CẤU TRÚC MỚI CHO CÀI ĐẶT TỰ ĐỘNG ---
export interface AutoCreateConfig {
    // Story settings
    storyStyle: string;
    storyLength: string;
    // Prompt settings
    promptStyle: string[];
    promptGenre: string;
    promptType: 'detailed' | 'all';
    // Video settings
    videoModel: string;
    videoAspectRatio: 'LANDSCAPE' | 'PORTRAIT';
    autoSave: boolean;
    savePath: string | null;
}
// --- KẾT THÚC CẤU TRÚC MỚI ---

export interface User {
    id: number;
    username: string;
    email: string;
    role: 'user' | 'admin';
    status: 'pending' | 'active' | 'inactive';
    created_at: string;
}

export interface Story {
    id: string;
    title: string;
    content: string;
    source: string;
}

export interface VideoPrompt {
    id:string;
    storyId: string;
    storyTitle: string;
    prompt: string;
}

export interface GeneratedImage {
    id: string;
    storyId: string;
    storyTitle: string;
    imageUrl: string;
}

export type VideoStatus = 'idle' | 'pending' | 'processing' | 'completed' | 'failed';

export interface GeneratedVideo {
    id: string;
    promptId: string;
    promptText: string;
    status: VideoStatus;
    videoUrl?: string;
    localPath?: string;
    progressMessage?: string;
    operationName?: string;
}

export interface YouTubeScript {
    id: string;
    sourceUrl: string;
    script: string;
    request: string;
}

export interface UserCookie {
  id: string;
  name: string;
  value: string;
  bearerToken?: string;
}

export interface ToastMessage {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

export interface LabsProject {
  id: string;
  name: string;
}

export interface AutoSaveConfig {
  enabled: boolean;
  path: string | null;
}

export type AutomationStatus = 'idle' | 'running' | 'success' | 'error' | 'queued' | 'downloading' | 'submitting' | 'processing';

export type AutomationPrompt = {
    id: string;
    text: string;
    status: AutomationStatus;
    message: string;
    videoUrl?: string;
    operationName?: string;
};

export type AutomationState = {
    prompts: AutomationPrompt[];
    isRunning: boolean;
    overallProgress: number;
    statusMessage: string;
    model: string;
    aspectRatio: 'LANDSCAPE' | 'PORTRAIT';
};

export interface Transaction {
    transaction_id: number;
    package_name: string;
    amount: string;
    currency: string;
    transaction_date: string;
    payment_status: 'pending' | 'completed' | 'failed' | 'refunded' | 'cancelled';
    description: string;
}
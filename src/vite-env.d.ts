import { UserCookie, AutomationState } from './types';

declare global {
  interface Window {
    electronAPI: {
      fetch: (url: string, cookie: UserCookie, options: RequestInit) => Promise<any>;
      startBrowserAutomation: (args: {
        prompts: { id: string; text: string; }[],
        authToken: string,
        model: string,
        aspectRatio: 'LANDSCAPE' | 'PORTRAIT'
      }) => void;
      stopBrowserAutomation: () => void;
      downloadVideo: (args: { url: string; promptText: string; savePath?: string | null; promptIndex?: number; }) => void;
      downloadImage: (args: { imageDataUrl: string; storyTitle: string; }) => void;
      selectDownloadDirectory: () => Promise<string | null>;
      onDownloadComplete: (callback: (result: {success: boolean, path?: string, error?: string}) => void) => () => void;
      onBrowserLog: (callback: (log: {promptId: string, message: string, status?: string, videoUrl?: string, operationName?: string, sceneId?: string}) => void) => () => void;
      onCookieUpdate: (callback: (cookie: UserCookie) => void) => () => void;
      // --- CÁC HÀM MỚI CHO VIỆC CẬP NHẬT ---
      checkForUpdates: () => void;
      onUpdateMessage: (callback: (message: string, data?: any) => void) => () => void;
      restartAndInstall: () => void;
    };
  }
}

export {};
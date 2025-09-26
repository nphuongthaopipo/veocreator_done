import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { Story, VideoPrompt, GeneratedImage, GeneratedVideo, YouTubeScript, UserCookie, LabsProject, AutomationState, AutoSaveConfig, User, AutomationPrompt,AutoCreateConfig } from '../types';

// Định nghĩa kiểu dữ liệu cho người dùng hiện tại, bao gồm thông tin user và token
interface CurrentUser {
    user: User;
    token: string;
}

// Hook tùy chỉnh để đồng bộ state với localStorage
function useLocalStorage<T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
    const [storedValue, setStoredValue] = useState<T>(() => {
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch (error) {
            console.error(`Lỗi khi đọc localStorage key “${key}”:`, error);
            return initialValue;
        }
    });

    useEffect(() => {
        try {
            const valueToStore = JSON.stringify(storedValue);
            window.localStorage.setItem(key, valueToStore);
        } catch (error) {
            console.error(`Lỗi khi lưu vào localStorage key “${key}”:`, error);
        }
    }, [key, storedValue]);

    return [storedValue, setStoredValue];
}

// Khai báo đầy đủ các thuộc tính sẽ được cung cấp bởi context
interface AppContextType {

    autoCreateConfig: AutoCreateConfig; 
    setAutoCreateConfig: React.Dispatch<React.SetStateAction<AutoCreateConfig>>;

    stories: Story[];
    addStory: (story: Story) => void;
    updateStory: (id: string, updates: Partial<Story>) => void;
    deleteStory: (id: string) => void;

    prompts: VideoPrompt[];
    addPrompts: (newPrompts: VideoPrompt[]) => void;
    deletePrompt: (id: string) => void;
    deletePrompts: (ids: string[]) => void; // <-- HÀM MỚI

    thumbnails: GeneratedImage[];
    addThumbnail: (thumbnail: GeneratedImage) => void;
    deleteThumbnail: (id: string) => void;

    videos: GeneratedVideo[];
    addVideo: (video: GeneratedVideo) => void;
    updateVideo: (id: string, updates: Partial<GeneratedVideo>) => void;
    deleteVideo: (id: string) => void;

    youtubeScripts: YouTubeScript[];
    addYouTubeScript: (script: YouTubeScript) => void;
    deleteYouTubeScript: (id: string) => void;

    labsProjects: LabsProject[];
    addLabsProject: (project: LabsProject) => void;

    cookies: UserCookie[];
    addCookie: (cookie: UserCookie) => void;
    updateCookie: (id: string, updates: Partial<UserCookie>) => void;
    deleteCookie: (id: string) => void;
    activeCookie: UserCookie | null;
    setActiveCookie: (cookie: UserCookie | null) => void;

    automationState: AutomationState;
    setAutomationState: React.Dispatch<React.SetStateAction<AutomationState>>;
    addAutomationPrompts: (prompts: AutomationPrompt[]) => void; // <-- HÀM MỚI

    autoSaveConfig: AutoSaveConfig;
    setAutoSaveConfig: React.Dispatch<React.SetStateAction<AutoSaveConfig>>;

    // Thêm các thuộc tính cho việc xác thực và quản lý người dùng
    isAuthenticated: boolean;
    currentUser: CurrentUser | null;
    login: (userData: CurrentUser) => void;
    logout: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{children: ReactNode}> = ({ children }) => {
    // State cho các chức năng đã có
    const [stories, setStories] = useLocalStorage<Story[]>('veo-suite-stories', []);
    const [prompts, setPrompts] = useLocalStorage<VideoPrompt[]>('veo-suite-prompts', []);
    const [thumbnails, setThumbnails] = useLocalStorage<GeneratedImage[]>('veo-suite-thumbnails', []);
    const [videos, setVideos] = useLocalStorage<GeneratedVideo[]>('veo-suite-videos', []);
    const [youtubeScripts, setYoutubeScripts] = useLocalStorage<YouTubeScript[]>('veo-suite-youtube-scripts', []);
    const [cookies, setCookies] = useLocalStorage<UserCookie[]>('veo-suite-cookies', []);
    const [activeCookie, setActiveCookie] = useLocalStorage<UserCookie | null>('veo-suite-active-cookie', null);
    const [labsProjects, setLabsProjects] = useLocalStorage<LabsProject[]>('veo-suite-labs-projects', []);

    const [automationState, setAutomationState] = useLocalStorage<AutomationState>('veo-suite-automation-state', {
        prompts: [],
        isRunning: false,
        overallProgress: 0,
        statusMessage: 'Sẵn sàng để bắt đầu.',
        model: 'veo_3_0_t2v_fast_ultra',
        aspectRatio: 'LANDSCAPE',
    });

    const [autoSaveConfig, setAutoSaveConfig] = useLocalStorage<AutoSaveConfig>('veo-suite-autosave-config', {
        enabled: false,
        path: null,
    });

    // State mới cho việc xác thực
    const [isAuthenticated, setIsAuthenticated] = useLocalStorage('isAuthenticated', false);
    const [currentUser, setCurrentUser] = useLocalStorage<CurrentUser | null>('currentUser', null);

// --- STATE MỚI CHO CÀI ĐẶT TỰ ĐỘNG ---
    const [autoCreateConfig, setAutoCreateConfig] = useLocalStorage<AutoCreateConfig>('veo-suite-auto-create-config', {
        storyStyle: 'Kể chuyện',
        storyLength: '1000',
        promptStyle: ['Phim hoạt hình 3D'],
        promptGenre: 'Hài hước/Vui nhộn',
        promptType: 'detailed',
        videoModel: 'veo_3_0_t2v_fast_ultra',
        videoAspectRatio: 'LANDSCAPE',
        autoSave: false,
        savePath: null,
    });
    // --- KẾT THÚC STATE MỚI ---


    // Các hàm quản lý state đã có
    const addStory = (story: Story) => setStories(prev => [story, ...prev]);
    const updateStory = (id: string, updates: Partial<Story>) => setStories(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    const deleteStory = (id: string) => setStories(prev => prev.filter(s => s.id !== id));

    const addPrompts = (newPrompts: VideoPrompt[]) => setPrompts(prev => [...newPrompts, ...prev]);
    const deletePrompt = (id: string) => setPrompts(prev => prev.filter(p => p.id !== id));
    // HÀM MỚI: Xóa nhiều prompts dựa trên mảng các id
    const deletePrompts = (ids: string[]) => {
        setPrompts(prev => prev.filter(p => !ids.includes(p.id)));
    };

    const addThumbnail = (thumbnail: GeneratedImage) => setThumbnails(prev => [thumbnail, ...prev]);
    const deleteThumbnail = (id: string) => setThumbnails(prev => prev.filter(t => t.id !== id));

    const addVideo = (video: GeneratedVideo) => setVideos(prev => [video, ...prev]);
    const updateVideo = (id: string, updates: Partial<GeneratedVideo>) => setVideos(prev => prev.map(v => v.id === id ? { ...v, ...updates } : v));
    const deleteVideo = (id: string) => setVideos(prev => prev.filter(v => v.id !== id));

    const addYouTubeScript = (script: YouTubeScript) => setYoutubeScripts(prev => [script, ...prev]);
    const deleteYouTubeScript = (id: string) => setYoutubeScripts(prev => prev.filter(s => s.id !== id));

    const addCookie = (cookie: UserCookie) => setCookies(prev => [cookie, ...prev]);
    const updateCookie = (id: string, updates: Partial<UserCookie>) => setCookies(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    const deleteCookie = (id: string) => setCookies(prev => prev.filter(c => c.id !== id));

    const addLabsProject = (project: LabsProject) => setLabsProjects(prev => [project, ...prev]);

    // HÀM MỚI: Thêm các prompts được chọn vào automationState
    const addAutomationPrompts = (newPrompts: AutomationPrompt[]) => {
        setAutomationState(prev => ({
            ...prev,
            // Thêm vào danh sách có sẵn, tránh ghi đè
            prompts: [...prev.prompts, ...newPrompts]
        }));
    };

    // Hàm mới cho việc đăng nhập và đăng xuất
    const login = (userData: CurrentUser) => {
        setCurrentUser(userData);
        setIsAuthenticated(true);
    };

    const logout = () => {
        setCurrentUser(null);
        setIsAuthenticated(false);
    };

    return (
        <AppContext.Provider value={{
            autoCreateConfig, setAutoCreateConfig,
            stories, addStory, updateStory, deleteStory,
            prompts, addPrompts, deletePrompt, deletePrompts, // <-- Cập nhật
            thumbnails, addThumbnail, deleteThumbnail,
            videos, addVideo, updateVideo, deleteVideo,
            youtubeScripts, addYouTubeScript, deleteYouTubeScript,
            labsProjects, addLabsProject,
            cookies, addCookie, updateCookie, deleteCookie,
            activeCookie, setActiveCookie,
            automationState, setAutomationState, addAutomationPrompts, // <-- Cập nhật
            autoSaveConfig, setAutoSaveConfig,
            isAuthenticated,
            currentUser,
            login,
            logout,
        }}>
            {children}
        </AppContext.Provider>
    );
};

export const useAppContext = () => {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error('useAppContext must be used within an AppProvider');
    }
    return context;
};
import React, { useState, useEffect } from 'react';
import { AppProvider, useAppContext } from './context/AppContext';
import { ToastProvider } from './context/ToastContext';
import Sidebar from './components/Sidebar';
import CreateStoryView from './components/views/CreateStoryView';
import CreatePromptsView from './components/views/CreatePromptsView';
import CreateThumbnailView from './components/views/CreateThumbnailView';
import AutoCreateView from './components/views/AutoCreateView';
import AutoBrowserView from './components/views/AutoBrowserView';
import HistoryView from './components/views/HistoryView';
import CreateScriptView from './components/views/CreateScriptView';
import ApiKeyView from './components/views/ApiKeyView';
import ManageCookiesView from './components/views/ManageCookiesView';
import LoginView from './components/views/LoginView';
import ProfileView from './components/views/ProfileView';
import PackagesView from './components/views/PackagesView';
import { AppView } from './types';
import { getApiKey } from './services/geminiService';
import UpdateManager from './components/common/UpdateManager'; // Import UpdateManager

// Component con để xử lý logic sau khi đã có context
const MainApp: React.FC = () => {
    const { isAuthenticated, currentUser } = useAppContext();
    const [activeView, setActiveView] = useState<AppView>(AppView.CREATE_STORY);
    const [isKeyRequired, setIsKeyRequired] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    useEffect(() => {
        if (currentUser?.user.status === 'pending') {
            setActiveView(AppView.PACKAGES);
        }
    }, [currentUser]);

    useEffect(() => {
        const checkApiKey = () => {
            if (!isAuthenticated) return;
            const apiKey = getApiKey();
            setIsKeyRequired(!apiKey);
        };
        checkApiKey();
    }, [isAuthenticated]);

    const handleKeySaved = () => {
        setIsKeyRequired(false);
        setActiveView(AppView.CREATE_STORY);
    };

    const renderView = () => {
        if (isKeyRequired) {
            return <ApiKeyView onKeySaved={handleKeySaved} />;
        }
        
        switch (activeView) {
            case AppView.CREATE_STORY: return <CreateStoryView />;
            // SỬA LỖI: Truyền prop setActiveView vào CreatePromptsView
            case AppView.CREATE_PROMPTS: return <CreatePromptsView setActiveView={setActiveView} />;
            case AppView.CREATE_THUMBNAIL: return <CreateThumbnailView />;
            case AppView.AUTO_CREATE: return <AutoCreateView />;
            case AppView.AUTO_BROWSER: return <AutoBrowserView />;
            case AppView.HISTORY: return <HistoryView />;
            case AppView.GET_YOUTUBE_SCRIPT: return <CreateScriptView />;
            case AppView.API_KEY: return <ApiKeyView onKeySaved={handleKeySaved} />;
            case AppView.MANAGE_COOKIES: return <ManageCookiesView />;
            case AppView.PROFILE: return <ProfileView />;
            case AppView.PACKAGES: return <PackagesView />;
            default: return <CreateStoryView />;
        }
    };

    if (!isAuthenticated) {
        return <LoginView />;
    }

    return (
        <div className="flex h-screen bg-primary font-sans">
            {!isKeyRequired && (
                <Sidebar 
                    activeView={activeView} 
                    setActiveView={setActiveView}
                    isCollapsed={isSidebarCollapsed}
                    setIsCollapsed={setIsSidebarCollapsed}
                />
            )}
            <main className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 p-6 lg:p-8 overflow-y-auto">
                    {renderView()}
                </div>
            </main>
        </div>
    );
}

// Component App chính chỉ bao gồm các providers
const App: React.FC = () => (
    <AppProvider>
        <ToastProvider>
            <MainApp />
            <UpdateManager />
        </ToastProvider>
    </AppProvider>
);

export default App;
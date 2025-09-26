import React, { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { createStoryFromText, createVideoPrompts } from '../../services/geminiService';
import { useToast } from '../../context/ToastContext';
import Spinner from '../common/Spinner';
import { AutoCreateConfig, AutomationPrompt, Story, VideoPrompt } from '../../types';

// Các hằng số cho form cài đặt
const storyGenres = [ 'Kể chuyện', 'Hành động/Chiến đấu', 'Tình cảm/Lãng mạn', 'Hài hước/Vui nhộn', 'Kinh dị/Horror', 'Bí ẩn/Trinh thám', 'Fantasy/Thần thoại', 'Khoa học viễn tưởng', 'Drama/Chính kịch', 'Giáo dục/Học tập', 'Phiêu lưu/Thám hiểm', 'Đời thường/Slice of Life', 'Trailer phim', 'Phát triển dựa trên nội dung gốc' ];
const storyWordCountOptions = [ { value: '500', label: '500 từ' }, { value: '1000', label: '1000 từ' }, { value: '2000', label: '2000 từ' } ];
const promptStylePills = [ 'chọn ngôn ngữ promt là tiếng anh','Siêu thực', 'Phim', 'Hoạt hình Disney', 'Anime', 'Pixar', 'Truyện tranh', 'Noir', 'Cyberpunk', 'Màu nước', 'Low-poly 3D', 'Cartoon 2D', 'Cartoon 3D', 'Disney', 'Pixel Art', 'Isometric', 'Paper Cutout', 'Claymation', 'Lịch sử' ];
const promptGenres = [ 'Hành động/Chiến đấu', 'Tình cảm/Lãng mạn', 'Hài hước/Vui nhộn', 'Kinh dị/Horror', 'Bí ẩn/Trinh thám', 'Fantasy/Thần thoại', 'Khoa học viễn tưởng', 'Drama/Chính kịch', 'Giáo dục/Học tập', 'Phiêu lưu/Thám hiểm', 'Đời thường/Slice of Life', 'Trailer phim' ];

// Kiểu dữ liệu cho mỗi ý tưởng
type IdeaStatus = 'idle' | 'running' | 'partial' | 'completed' | 'error';
interface Idea {
    id: number;
    text: string;
    status: IdeaStatus;
    message: string;
}

// === COMPONENT MODAL CÀI ĐẶT ===
interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    config: AutoCreateConfig;
    setConfig: React.Dispatch<React.SetStateAction<AutoCreateConfig>>;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, config, setConfig }) => {
    if (!isOpen) return null;

    const handleStyleToggle = (style: string) => {
        const newStyles = config.promptStyle.includes(style)
            ? config.promptStyle.filter(s => s !== style)
            : [...config.promptStyle, style];
        setConfig(prev => ({ ...prev, promptStyle: newStyles }));
    };

    const handleSelectSaveDir = async () => {
        const path = await window.electronAPI.selectDownloadDirectory();
        if (path) {
            setConfig(prev => ({ ...prev, savePath: path }));
        }
    };

    const handleAspectRatioChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newRatio = e.target.value as 'LANDSCAPE' | 'PORTRAIT';
        setConfig(prev => ({
            ...prev,
            videoAspectRatio: newRatio,
            // Tự động đổi model khi chọn tỷ lệ Dọc
            videoModel: newRatio === 'PORTRAIT' ? 'veo_3_0_t2v_fast_portrait_ultra' : 'veo_3_0_t2v_fast_ultra'
        }));
    };
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4">
            <div className="bg-secondary p-8 rounded-lg shadow-2xl w-full max-w-4xl relative animate-fade-in max-h-[90vh] overflow-y-auto">
                <h2 className="text-2xl font-bold text-light mb-6">Cài đặt quy trình tự động</h2>
                <div className="space-y-6">
                    {/* Cài đặt câu chuyện */}
                    <fieldset className="border p-4 rounded-lg border-border-color">
                        <legend className="text-lg font-semibold text-accent px-2">1. Cài đặt Câu chuyện</legend>
                        <div className="grid md:grid-cols-2 gap-4">
                           <div>
                                <label className="block text-sm font-medium text-dark-text mb-1">Phong cách</label>
                                <select value={config.storyStyle} onChange={e => setConfig(prev => ({...prev, storyStyle: e.target.value}))} className="w-full p-2 bg-primary rounded-md border border-border-color">
                                    {storyGenres.map(g => <option key={g} value={g}>{g}</option>)}
                                </select>
                           </div>
                            <div>
                                <label className="block text-sm font-medium text-dark-text mb-1">Độ dài (ước tính)</label>
                                <select value={config.storyLength} onChange={e => setConfig(prev => ({...prev, storyLength: e.target.value}))} className="w-full p-2 bg-primary rounded-md border border-border-color">
                                    {storyWordCountOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                            </div>
                        </div>
                    </fieldset>

                     {/* Cài đặt Prompt */}
                    <fieldset className="border p-4 rounded-lg border-border-color">
                        <legend className="text-lg font-semibold text-accent px-2">2. Cài đặt Prompt Video</legend>
                        <div>
                             <label className="block text-sm font-medium text-dark-text mb-2">Style (chọn nhiều)</label>
                             <div className="flex flex-wrap gap-2">
                                {promptStylePills.map(style => (
                                    <button type="button" key={style} onClick={() => handleStyleToggle(style)} className={`px-3 py-1.5 rounded-full text-xs ${config.promptStyle.includes(style) ? 'bg-accent text-white' : 'bg-primary hover:bg-hover-bg'}`}>
                                        {style}
                                    </button>
                                ))}
                            </div>
                        </div>
                         <div className="grid md:grid-cols-2 gap-4 mt-4">
                            <div>
                                <label className="block text-sm font-medium text-dark-text mb-1">Thể loại</label>
                                <select value={config.promptGenre} onChange={e => setConfig(prev => ({...prev, promptGenre: e.target.value}))} className="w-full p-2 bg-primary rounded-md border border-border-color">
                                    {promptGenres.map(g => <option key={g} value={g}>{g}</option>)}
                                </select>
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-dark-text mb-1">Loại Prompt</label>
                                 <select value={config.promptType} onChange={e => setConfig(prev => ({...prev, promptType: e.target.value as any}))} className="w-full p-2 bg-primary rounded-md border border-border-color">
                                    <option value="detailed">Chi tiết (8 giây / prompt)</option>
                                    <option value="all">Tổng quan (toàn bộ câu chuyện)</option>
                                </select>
                            </div>
                        </div>
                    </fieldset>
                    
                    {/* Cài đặt Video */}
                    <fieldset className="border p-4 rounded-lg border-border-color">
                        <legend className="text-lg font-semibold text-accent px-2">3. Cài đặt Tạo Video</legend>
                         <div className="grid md:grid-cols-2 gap-4">
                             <div>
                                <label className="block text-sm font-medium text-dark-text mb-1">Model</label>
                                <select value={config.videoModel} onChange={e => setConfig(prev => ({...prev, videoModel: e.target.value}))} className="w-full p-2 bg-primary rounded-md border border-border-color" disabled={config.videoAspectRatio === 'PORTRAIT'}>
                                    <option value="veo_3_0_t2v_fast_ultra">Veo 3 - Fast</option>
                                    <option value="veo_3_0_t2v">Veo 3 - Quality</option>
                                </select>
                                {config.videoAspectRatio === 'PORTRAIT' && <p className='text-xs text-yellow-500 mt-1'>Model được tự động chọn cho tỷ lệ dọc.</p>}
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-dark-text mb-1">Tỷ lệ</label>
                                <select value={config.videoAspectRatio} onChange={handleAspectRatioChange} className="w-full p-2 bg-primary rounded-md border border-border-color">
                                    <option value="LANDSCAPE">16:9 Ngang</option>
                                    <option value="PORTRAIT">9:16 Dọc</option>
                                </select>
                            </div>
                        </div>
                        <div className="mt-4 flex items-center gap-4">
                            <label htmlFor="auto-save-toggle" className="flex items-center cursor-pointer">
                                <div className="relative">
                                    <input type="checkbox" id="auto-save-toggle" className="sr-only peer" checked={config.autoSave} onChange={e => setConfig(prev => ({...prev, autoSave: e.target.checked}))} />
                                    <div className="block bg-gray-400 w-10 h-6 rounded-full peer-checked:bg-green-500 transition"></div>
                                    <div className="dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition peer-checked:translate-x-full"></div>
                                </div>
                                <div className="ml-2 text-dark-text text-sm font-medium whitespace-nowrap">Tự động lưu</div>
                            </label>
                            {config.autoSave && (
                                 <div className="flex flex-col items-start">
                                     <button onClick={handleSelectSaveDir} className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-3 rounded-lg text-sm">
                                         {config.savePath ? 'Đổi thư mục' : 'Chọn thư mục'}
                                     </button>
                                     {config.savePath && <p className='text-xs text-dark-text mt-1 truncate max-w-[200px]' title={config.savePath}>Lưu tại: {config.savePath}</p>}
                                </div>
                            )}
                        </div>
                    </fieldset>
                </div>
                <div className="mt-8 text-right">
                    <button onClick={onClose} className="bg-accent hover:bg-indigo-500 text-white font-bold py-2 px-6 rounded-lg">Đóng</button>
                </div>
            </div>
        </div>
    );
};

// === COMPONENT CHÍNH ===
const AutoCreateView: React.FC = () => {
    const { addStory, addPrompts, setAutomationState, currentUser, autoCreateConfig, setAutoCreateConfig, setAutoSaveConfig } = useAppContext();
    const { showToast } = useToast();
    
    const [ideas, setIdeas] = useState<Idea[]>([{ id: Date.now(), text: '', status: 'idle', message: 'Sẵn sàng' }]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    const addIdeaField = () => {
        setIdeas(prev => [...prev, { id: Date.now(), text: '', status: 'idle', message: 'Sẵn sàng' }]);
    };

    const updateIdeaText = (id: number, text: string) => {
        setIdeas(prev => prev.map(idea => idea.id === id ? { ...idea, text } : idea));
    };

    const removeIdea = (id: number) => {
        setIdeas(prev => prev.filter(idea => idea.id !== id));
    };
    
    const updateIdeaStatus = (id: number, status: IdeaStatus, message: string) => {
        setIdeas(prev => prev.map(idea => idea.id === id ? { ...idea, status, message } : idea));
    };

    const runFullAutomation = async () => {
        if (!currentUser) {
            showToast('Vui lòng đăng nhập để sử dụng tính năng này.', 'error');
            return;
        }
        setIsProcessing(true);
        
        for (const idea of ideas) {
            if (!idea.text.trim()) continue;

            updateIdeaStatus(idea.id, 'running', 'Bắt đầu xử lý ý tưởng...');
            let createdStory: Story | null = null;

            try {
                // Step 1: Create Story
                updateIdeaStatus(idea.id, 'running', 'Đang tạo câu chuyện...');
                const storyResponse = await createStoryFromText(idea.text, autoCreateConfig.storyLength, autoCreateConfig.storyStyle);
                createdStory = {
                    id: `auto-${Date.now()}`,
                    title: `Auto-Story: ${idea.text.substring(0, 30)}...`,
                    content: storyResponse.text ?? '',
                    source: idea.text
                };
                addStory(createdStory);
                showToast(`Đã tạo xong câu chuyện cho ý tưởng #${idea.id}`, 'success');

                // Step 2: Create Prompts
                updateIdeaStatus(idea.id, 'running', 'Đang tạo prompts video...');
                const combinedStyle = [...autoCreateConfig.promptStyle, autoCreateConfig.promptGenre].join(', ');
                const promptsResponse = await createVideoPrompts(createdStory.content, autoCreateConfig.promptType, combinedStyle);
                // Sửa lỗi any type ở đây
                const parsedJson = JSON.parse(promptsResponse.text ?? '{"prompts":[]}');
                const promptsArray: string[] = parsedJson.prompts.map((p: { prompt: string }) => p.prompt);
                
                if (promptsArray.length === 0) {
                    throw new Error("Không tạo được prompt nào từ câu chuyện.");
                }

                // Chuyển đổi thành AutomationPrompt
                const newPromptsForVideo: AutomationPrompt[] = promptsArray.map((p: string) => ({
                    id: `${createdStory!.id}-${Math.random()}`,
                    text: p,
                    status: 'queued',
                    message: 'Sẵn sàng'
                }));
                
                // Lưu vào lịch sử prompt
                const historyPrompts: VideoPrompt[] = newPromptsForVideo.map(p => ({
                    id: p.id,
                    prompt: p.text,
                    storyId: createdStory!.id,
                    storyTitle: createdStory!.title
                }));
                addPrompts(historyPrompts);
                showToast(`Đã tạo ${newPromptsForVideo.length} prompt cho ý tưởng #${idea.id}`, 'success');
                
                // Step 3: Start Video Generation in AutoBrowser
                updateIdeaStatus(idea.id, 'running', 'Đang gửi video đến hàng đợi...');
                
                // Cập nhật cấu hình tự động lưu trước khi chạy
                setAutoSaveConfig({
                    enabled: autoCreateConfig.autoSave,
                    path: autoCreateConfig.savePath,
                });

                setAutomationState(prev => ({
                    ...prev,
                    prompts: newPromptsForVideo,
                    model: autoCreateConfig.videoModel,
                    aspectRatio: autoCreateConfig.videoAspectRatio,
                    isRunning: true
                }));
                 window.electronAPI.startBrowserAutomation({
                    prompts: newPromptsForVideo,
                    authToken: currentUser.token,
                    model: autoCreateConfig.videoAspectRatio === 'PORTRAIT' ? 'veo_3_0_t2v_fast_portrait_ultra' : autoCreateConfig.videoModel,
                    aspectRatio: autoCreateConfig.videoAspectRatio
                });
                updateIdeaStatus(idea.id, 'completed', 'Hoàn thành! Video đang được tạo trong tab "Tạo Video".');

            } catch (err: any) {
                const errorMessage = err.message || 'Quy trình gặp lỗi.';
                showToast(errorMessage, 'error');
                updateIdeaStatus(idea.id, createdStory ? 'partial' : 'error', `Lỗi: ${errorMessage}. Đã lưu các phần hoàn thành.`);
                continue; // Chuyển sang ý tưởng tiếp theo
            }
        }
        setIsProcessing(false);
    };

    const getStatusClasses = (status: IdeaStatus) => {
        switch(status) {
            case 'running': return 'border-accent text-accent animate-pulse';
            case 'completed': return 'border-green-500 text-green-500';
            case 'partial': return 'border-yellow-500 text-yellow-500';
            case 'error': return 'border-red-500 text-red-500';
            default: return 'border-border-color text-dark-text';
        }
    }

    return (
        <div className="animate-fade-in">
            <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} config={autoCreateConfig} setConfig={setAutoCreateConfig} />
            
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-light mb-2">Tạo Tự Động</h1>
                    <p className="text-dark-text mb-6">Nhập một hoặc nhiều ý tưởng, cấu hình và để AI lo phần còn lại.</p>
                </div>
                 <div className="flex gap-4">
                    <button onClick={() => setIsSettingsOpen(true)} className="bg-primary hover:bg-hover-bg text-dark-text font-bold py-2 px-4 rounded-lg flex items-center gap-2">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01-.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" /></svg>
                        Cài đặt
                    </button>
                    <button onClick={runFullAutomation} disabled={isProcessing} className="bg-accent hover:bg-indigo-500 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 disabled:bg-gray-400">
                         {isProcessing ? <Spinner/> : <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>}
                        Chạy tất cả ý tưởng
                    </button>
                 </div>
            </div>
            
             <div className="mt-6 space-y-4">
                {ideas.map((idea, index) => (
                    <div key={idea.id} className={`bg-secondary p-4 rounded-lg shadow-md border-l-4 ${getStatusClasses(idea.status)}`}>
                        <div className="flex gap-4 items-start">
                            <div className="flex-1">
                                <label className="block text-dark-text font-bold mb-2">Ý tưởng #{index + 1}</label>
                                <textarea 
                                    value={idea.text} 
                                    onChange={e => updateIdeaText(idea.id, e.target.value)} 
                                    placeholder="Một con mèo và một con chó trở thành bạn thân và cùng nhau phiêu lưu..." 
                                    className="w-full h-20 p-2 bg-primary rounded-md border border-border-color focus:ring-2 focus:ring-accent"
                                    disabled={isProcessing}
                                />
                            </div>
                             <div className="flex flex-col items-start pt-8">
                                 <p className="text-sm font-semibold">{idea.message}</p>
                                {ideas.length > 1 && !isProcessing && (
                                     <button onClick={() => removeIdea(idea.id)} className="text-xs text-red-500 hover:underline mt-1">Xóa ý tưởng</button>
                                )}
                             </div>
                        </div>
                    </div>
                ))}
                <button onClick={addIdeaField} disabled={isProcessing} className="w-full bg-blue-100 hover:bg-blue-200 text-blue-800 font-bold py-2 px-4 rounded-lg border border-blue-200 disabled:opacity-50">
                    + Thêm ý tưởng
                </button>
            </div>
        </div>
    );
};

export default AutoCreateView;
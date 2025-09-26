import React, { useState, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import { createVideoPrompts } from '../../services/geminiService';
import { useToast } from '../../context/ToastContext';
import Spinner from '../common/Spinner';
import { AppView, AutomationPrompt } from '../../types'; // Import AppView và AutomationPrompt

type ViewTab = 'create' | 'history';

const stylePills = [
    'Siêu thực', 'Phim', 'Hoạt hình Disney', 'Anime', 'Pixar', 'Truyện tranh', 'Noir', 'Cyberpunk',
    'Màu nước', 'Low-poly 3D', 'Cartoon 2D', 'Cartoon 3D', 'Disney', 'Pixel Art', 'Isometric',
    'Paper Cutout', 'Claymation', 'Lịch sử', 'ngôn ngữ tiếng anh', 'đồng bộ các nhân vật','tạo promt chi tiết cho video dài 10 phút',
    'Viết Character Sheet mô tả tất cả các chi tiết cốt lõi và không thay đổi của nhân vật như tên tuổi tóc mắt quần áo phụ kiện',
    'Đặt tên cho nhân vật và luôn gọi bằng tên đó','Sao chép toàn bộ Character Sheet vào đầu mỗi prompt mới'
];

const genres = [
    'Hành động/Chiến đấu', 'Tình cảm/Lãng mạn', 'Hài hước/Vui nhộn', 'Kinh dị/Horror',
    'Bí ẩn/Trinh thám', 'Fantasy/Thần thoại', 'Khoa học viễn tưởng', 'Drama/Chính kịch',
    'Giáo dục/Học tập', 'Phiêu lưu/Thám hiểm', 'Đời thường/Slice of Life', 'Trailer phim'
];

// Cập nhật props để nhận setActiveView
interface CreatePromptsViewProps {
    setActiveView: (view: AppView) => void;
}

const CreatePromptsView: React.FC<CreatePromptsViewProps> = ({ setActiveView }) => {
    const { stories, prompts, addPrompts, deletePrompts, addAutomationPrompts } = useAppContext();
    const { showToast } = useToast();
    const [mainTab, setMainTab] = useState<ViewTab>('create');
    const [selectedStoryId, setSelectedStoryId] = useState('');
    const [granularity, setGranularity] = useState('detailed');
    const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
    const [selectedGenre, setSelectedGenre] = useState(genres[0]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [generatedPrompts, setGeneratedPrompts] = useState<string[]>([]);

    const [activeInputTab, setActiveInputTab] = useState<'select' | 'manual'>('select');
    const [manualStoryContent, setManualStoryContent] = useState('');

    const [showCustomStyleInput, setShowCustomStyleInput] = useState(false);
    const [customStyle, setCustomStyle] = useState('');

    // --- State mới cho tab Lịch sử ---
    const [historyFilterStoryId, setHistoryFilterStoryId] = useState<string>('');
    const [selectedPromptIds, setSelectedPromptIds] = useState<string[]>([]);

    const handleStyleToggle = (style: string) => {
        setSelectedStyles(prev =>
            prev.includes(style) ? prev.filter(s => s !== style) : [...prev, style]
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        let storyContent: string;
        let storyForPromptCreation: { id: string; title: string; content: string; };

        if (activeInputTab === 'select') {
            if (!selectedStoryId) {
                setError('Vui lòng chọn một câu chuyện.');
                return;
            }
            const story = stories.find(s => s.id === selectedStoryId);
            if (!story) {
                setError('Không tìm thấy câu chuyện.');
                setIsLoading(false);
                return;
            }
            storyContent = story.content;
            storyForPromptCreation = story;
        } else { // manual tab
            if (!manualStoryContent.trim()) {
                setError('Vui lòng nhập nội dung câu chuyện.');
                return;
            }
            storyContent = manualStoryContent;
            storyForPromptCreation = {
                id: `manual-${new Date().toISOString()}`,
                title: `Manual story: ${storyContent.substring(0, 30)}...`,
                content: storyContent
            };
        }

        setError('');
        setGeneratedPrompts([]);
        setIsLoading(true);

        const combinedStyle = [...selectedStyles, selectedGenre, customStyle.trim()].filter(Boolean).join(', ');

        try {
            const response = await createVideoPrompts(storyContent, granularity, combinedStyle);
            const parsedJson = JSON.parse(response.text ?? '{"prompts": []}');
            const promptsArray = parsedJson.prompts.map((p: { prompt: string }) => p.prompt);
            setGeneratedPrompts(promptsArray);
            const newPrompts = promptsArray.map((p: string) => ({
                id: `${storyForPromptCreation.id}-${new Date().getTime()}-${Math.random()}`,
                storyId: storyForPromptCreation.id,
                storyTitle: storyForPromptCreation.title,
                prompt: p
            }));
            addPrompts(newPrompts);
            showToast('Prompts đã được tạo thành công!', 'success');
        } catch (err) {
            console.error(err);
            setError('Không thể tạo prompts. Vui lòng kiểm tra định dạng phản hồi từ API.');
            showToast('Lỗi khi tạo prompts', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopyToClipboard = (content: string) => {
        navigator.clipboard.writeText(content).then(() => {
            showToast('Đã sao chép vào clipboard!', 'success');
        }, (err) => {
            showToast('Lỗi khi sao chép: ' + err, 'error');
        });
    };

    const handleToggleSelectPrompt = (id: string) => {
        setSelectedPromptIds(prev =>
            prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
        );
    };

    const handleDeleteSelected = () => {
        if (selectedPromptIds.length === 0) return;
        deletePrompts(selectedPromptIds);
        showToast(`Đã xóa ${selectedPromptIds.length} prompt.`, 'success');
        setSelectedPromptIds([]);
    };

    const handleImportToVeo = () => {
        if (selectedPromptIds.length === 0) return;

        const promptsToImport: AutomationPrompt[] = prompts
            .filter(p => selectedPromptIds.includes(p.id))
            .map(p => ({
                id: `prompt-${Date.now()}-${Math.random()}`,
                text: p.prompt,
                status: 'idle',
                message: 'Sẵn sàng'
            }));

        addAutomationPrompts(promptsToImport);
        showToast(`Đã import ${promptsToImport.length} prompt vào Veo.`, 'success');
        setSelectedPromptIds([]);
        setActiveView(AppView.AUTO_BROWSER);
    };

    const filteredHistoryPrompts = useMemo(() => {
        if (!historyFilterStoryId) {
            return prompts;
        }
        return prompts.filter(p => p.storyId === historyFilterStoryId);
    }, [prompts, historyFilterStoryId]);

    const renderCreateForm = () => (
        <>
            <div className="mb-6 flex border-b border-gray-300">
                <button type="button" onClick={() => setActiveInputTab('select')} className={`px-4 py-2 font-medium ${activeInputTab === 'select' ? 'text-accent border-b-2 border-accent' : 'text-dark-text'}`}>Chọn câu chuyện có sẵn</button>
                <button type="button" onClick={() => setActiveInputTab('manual')} className={`px-4 py-2 font-medium ${activeInputTab === 'manual' ? 'text-accent border-b-2 border-accent' : 'text-dark-text'}`}>Nhập thủ công</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {activeInputTab === 'select' && (
                    <div className="bg-secondary p-6 rounded-lg shadow-md">
                        <label className="block text-dark-text font-bold mb-2">Chọn câu chuyện</label>
                        <select value={selectedStoryId} onChange={e => setSelectedStoryId(e.target.value)} className="w-full p-3 bg-primary rounded-md border border-gray-300 focus:ring-2 focus:ring-accent focus:outline-none transition">
                            <option value="">-- Chọn một câu chuyện --</option>
                            {stories.map(story => (
                                <option key={story.id} value={story.id}>{story.title}</option>
                            ))}
                        </select>
                    </div>
                )}

                {activeInputTab === 'manual' && (
                     <div className="bg-secondary p-6 rounded-lg shadow-md">
                        <label className="block text-dark-text font-bold mb-2">💡 Ý tưởng câu chuyện</label>
                        <textarea
                            value={manualStoryContent}
                            onChange={e => setManualStoryContent(e.target.value)}
                            placeholder="Mô tả ý tưởng của bạn... Ví dụ: Cậu bé và mẹ đi công viên, chơi đu quay, ăn kem, mặt trời lặn..."
                            className="w-full h-32 p-3 bg-primary rounded-md border border-gray-300 focus:ring-2 focus:ring-accent focus:outline-none transition"
                        />
                    </div>
                )}

                <div className="bg-secondary p-6 rounded-lg shadow-md space-y-4">
                    <div>
                        <label className="block text-dark-text font-bold mb-3">🎨 Style mẫu nhanh</label>
                        <div className="flex flex-wrap gap-2">
                            {stylePills.map(style => (
                                <button
                                    type="button"
                                    key={style}
                                    onClick={() => handleStyleToggle(style)}
                                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5 ${
                                        selectedStyles.includes(style)
                                            ? 'bg-accent text-white'
                                            : 'bg-primary hover:bg-gray-200 text-dark-text'
                                    }`}
                                >
                                    <svg className="w-5 h-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    {style}
                                </button>
                            ))}
                            <button
                                type="button"
                                onClick={() => setShowCustomStyleInput(true)}
                                className="px-3 py-1.5 rounded-full text-sm font-medium transition-colors bg-primary hover:bg-gray-200 text-dark-text flex items-center gap-1.5"
                            >
                                + Tùy chọn thêm
                            </button>
                        </div>
                        {showCustomStyleInput && (
                             <div className="mt-4">
                                <input
                                    type="text"
                                    value={customStyle}
                                    onChange={(e) => setCustomStyle(e.target.value)}
                                    placeholder="Nhập style tùy chỉnh (ví dụ: Ghibli, Van Gogh...)"
                                    className="w-full p-3 bg-primary rounded-md border border-gray-300 focus:ring-2 focus:ring-accent focus:outline-none transition"
                                />
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-dark-text font-bold mb-2">🎭 Thể loại câu chuyện</label>
                        <div className="flex flex-wrap gap-2">
                            {genres.map(genre => (
                                <button
                                    type="button"
                                    key={genre}
                                    onClick={() => setSelectedGenre(genre)}
                                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                                        selectedGenre === genre
                                            ? 'bg-accent text-white'
                                            : 'bg-primary hover:bg-gray-200 text-dark-text'
                                    }`}
                                >
                                    {genre}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                 <div className="bg-secondary p-6 rounded-lg shadow-md">
                    <label className="block text-dark-text font-bold mb-2">Loại Prompt</label>
                    <select value={granularity} onChange={e => setGranularity(e.target.value)} className="w-full p-3 bg-primary rounded-md border border-gray-300 focus:ring-2 focus:ring-accent focus:outline-none transition">
                        <option value="detailed">Chi tiết (cho video 8 giây)</option>
                        <option value="all">Tổng hợp (cho toàn bộ câu chuyện)</option>
                    </select>
                </div>

                <div>
                    <button type="submit" disabled={isLoading || (activeInputTab === 'select' && stories.length === 0)} className="w-full flex justify-center items-center bg-accent hover:bg-indigo-500 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed">
                        {isLoading ? <><Spinner /> <span className="ml-2">Đang tạo...</span></> : 'Tạo Prompts'}
                    </button>
                    {activeInputTab === 'select' && stories.length === 0 && <p className="text-yellow-500 text-center mt-2">Bạn cần tạo một câu chuyện trước.</p>}
                </div>
            </form>

            {error && <p className="text-red-500 mt-4 text-center">{error}</p>}

            {generatedPrompts.length > 0 && (
                <div className="mt-8">
                    <h2 className="text-2xl font-bold text-light mb-4">Các Prompts đã tạo</h2>
                    <div className="space-y-4">
                        {generatedPrompts.map((prompt, index) => (
                            <div key={index} className="bg-secondary p-4 rounded-lg shadow">
                                <p className="text-gray-700">{prompt}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </>
    );

    const renderHistory = () => (
        <div>
            <div className="bg-secondary p-4 rounded-lg shadow-md mb-4 flex items-center gap-4">
                <div className="flex-1">
                    <label className="block text-dark-text font-bold mb-1 text-sm">Lọc theo câu chuyện</label>
                    <select
                        value={historyFilterStoryId}
                        onChange={e => {
                            setHistoryFilterStoryId(e.target.value);
                            setSelectedPromptIds([]);
                        }}
                        className="w-full p-2 bg-primary rounded-md border border-gray-300 focus:ring-2 focus:ring-accent focus:outline-none transition"
                    >
                        <option value="">-- Tất cả câu chuyện --</option>
                        {stories.map(story => (
                            <option key={story.id} value={story.id}>{story.title}</option>
                        ))}
                    </select>
                </div>
                {selectedPromptIds.length > 0 && (
                    <div className="flex items-end gap-2">
                        <button
                            onClick={handleImportToVeo}
                            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.022 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>
                            Import vào Veo ({selectedPromptIds.length})
                        </button>
                        <button
                            onClick={handleDeleteSelected}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
                        >
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            Xóa ({selectedPromptIds.length})
                        </button>
                    </div>
                )}
            </div>

            <div className="space-y-3">
                {filteredHistoryPrompts.length === 0 ? <p className="text-dark-text text-center py-8">Chưa có prompt nào được tạo.</p> : (
                    filteredHistoryPrompts.map(prompt => (
                        <div
                            key={prompt.id}
                            className={`p-3 rounded-lg shadow flex items-center gap-4 transition-colors ${selectedPromptIds.includes(prompt.id) ? 'bg-accent/20' : 'bg-secondary'}`}
                        >
                            <input
                                type="checkbox"
                                className="form-checkbox h-5 w-5 text-accent rounded border-gray-300 focus:ring-accent"
                                checked={selectedPromptIds.includes(prompt.id)}
                                onChange={() => handleToggleSelectPrompt(prompt.id)}
                            />
                            <div className="flex-1 cursor-pointer" onClick={() => handleToggleSelectPrompt(prompt.id)}>
                                <p className="text-gray-700 text-sm">{prompt.prompt}</p>
                                <p className="text-xs text-dark-text mt-1 opacity-75">Từ: {prompt.storyTitle}</p>
                            </div>
                            <button onClick={() => handleCopyToClipboard(prompt.prompt)} title="Sao chép" className="p-2 rounded-md hover:bg-gray-200 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-dark-text" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg></button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );

    return (
        <div className="animate-fade-in">
            <h1 className="text-3xl font-bold text-light mb-2">Tạo Prompt Video</h1>
            <p className="text-dark-text mb-6">Tạo prompt từ câu chuyện có sẵn hoặc nhập thủ công.</p>

            <div className="mb-6">
                <div className="border-b border-gray-200">
                    <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                         <button
                            onClick={() => setMainTab('create')}
                            className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors
                            ${mainTab === 'create'
                                ? 'border-accent text-accent'
                                : 'border-transparent text-dark-text hover:text-light hover:border-gray-300'
                            }`}
                        >
                            Tạo Mới
                        </button>
                         <button
                            onClick={() => setMainTab('history')}
                            className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors
                            ${mainTab === 'history'
                                ? 'border-accent text-accent'
                                : 'border-transparent text-dark-text hover:text-light hover:border-gray-300'
                            }`}
                        >
                            Lịch sử
                        </button>
                    </nav>
                </div>
            </div>

            {mainTab === 'create' ? renderCreateForm() : renderHistory()}
        </div>
    );
};

export default CreatePromptsView;
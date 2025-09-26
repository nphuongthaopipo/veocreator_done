import React, { useEffect, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import Spinner from '../common/Spinner';
import { Story, AutomationState, AutomationPrompt, AutomationStatus } from '../../types';
import { useToast } from '../../context/ToastContext';

const AutoBrowserView: React.FC = () => {
    const {
        currentUser,
        stories,
        prompts: allPrompts,
        addVideo,
        autoSaveConfig,
        setAutoSaveConfig,
        automationState,
        setAutomationState
    } = useAppContext();

    const { showToast } = useToast();

    const { prompts, isRunning, model, aspectRatio } = automationState;

    // --- LOGIC CẬP NHẬT TRẠNG THÁI TỪ MAIN PROCESS ---
    useEffect(() => {
        const unsubscribeLog = window.electronAPI.onBrowserLog((log) => {
            let videoAddedToHistory = false;
            let shouldDownload = false;
            let downloadArgs: any = {};

            setAutomationState((prev: AutomationState) => {
                const newPrompts = prev.prompts.map((p: AutomationPrompt, index: number) => {
                    if (p.id === log.promptId) {
                        const newStatus = log.status as AutomationStatus || p.status;
                        const updates: Partial<AutomationPrompt> = {
                            status: newStatus,
                            message: log.message,
                            videoUrl: log.videoUrl || p.videoUrl,
                            operationName: log.operationName || p.operationName
                        };
                        
                        if (newStatus === 'success' && log.videoUrl && !p.videoUrl) {
                           addVideo({
                                id: `${p.id}-${Date.now()}`,
                                promptId: p.id,
                                promptText: p.text,
                                status: 'completed',
                                videoUrl: log.videoUrl,
                                operationName: log.operationName || undefined
                           });
                           videoAddedToHistory = true;

                           if (autoSaveConfig.enabled && autoSaveConfig.path) {
                                shouldDownload = true;
                                downloadArgs = {
                                    url: log.videoUrl,
                                    promptText: p.text,
                                    savePath: autoSaveConfig.path,
                                    promptIndex: index
                                };
                           }
                        }
                        return { ...p, ...updates };
                    }
                    return p;
                });

                const isStillRunning = newPrompts.some(p => ['queued', 'submitting', 'processing', 'running'].includes(p.status));
                
                if (!isStillRunning && log.message === "Tất cả các prompt đã được xử lý!") {
                     return { ...prev, prompts: newPrompts, isRunning: false };
                }
                
                return { ...prev, prompts: newPrompts, isRunning: isStillRunning };
            });

            if (shouldDownload) {
                window.electronAPI.downloadVideo(downloadArgs);
            }
            if (videoAddedToHistory) {
                showToast('Video mới đã được thêm vào Lịch sử!', 'info');
            }
        });

        const unsubscribeDownload = window.electronAPI.onDownloadComplete(({success, path, error}) => {
            if (success && path !== 'Skipped') {
                showToast(`Video đã được lưu tại: ${path}`, 'success');
            } else if (!success) {
                showToast(`Lỗi tải video: ${error}`, 'error');
            }
        });

        const unsubscribeCookieUpdate = window.electronAPI.onCookieUpdate((updatedCookie) => {
            console.log('Received cookie update from main process:', updatedCookie);
            showToast('Token & Cookie đã được tự động cập nhật từ trình duyệt!', 'info');
        });

        return () => {
            unsubscribeLog();
            unsubscribeDownload();
            unsubscribeCookieUpdate();
        };
    }, [setAutomationState, autoSaveConfig, addVideo, showToast]);

    const { successCount, errorCount, processedCount, totalCount, statusMessage } = useMemo(() => {
        const total = prompts.length;
        if (total === 0) {
            return { successCount: 0, errorCount: 0, processedCount: 0, totalCount: 0, statusMessage: "Sẵn sàng." };
        }

        const success = prompts.filter(p => p.status === 'success').length;
        const error = prompts.filter(p => p.status === 'error').length;
        const processed = success + error;
        
        let message = `Đang xử lý ${processed}/${total}...`;
        if (!isRunning && total > 0) {
            if (processed === total) {
                 message = "Hoàn thành!";
            } else {
                 message = "Đã dừng.";
            }
        }
        if (isRunning && processed === 0) {
            message = "Bắt đầu quá trình...";
        }

        return { successCount: success, errorCount: error, processedCount: processed, totalCount: total, statusMessage: message };
    }, [prompts, isRunning]);
    
    const overallProgress = totalCount > 0 ? (processedCount / totalCount) * 100 : 0;

    const setPrompts = (updater: React.SetStateAction<AutomationPrompt[]>) => {
        setAutomationState((prev: any) => ({ ...prev, prompts: typeof updater === 'function' ? updater(prev.prompts) : updater }));
    };

    const setModel = (newModel: string) => {
        setAutomationState((prev: any) => ({ ...prev, model: newModel }));
    };

    const setAspectRatio = (newAspectRatio: 'LANDSCAPE' | 'PORTRAIT') => {
        setAutomationState((prev: any) => ({ ...prev, aspectRatio: newAspectRatio }));
    };
    
    const updatePromptText = (id: string, text: string) => {
        setPrompts((prev: AutomationPrompt[]) => prev.map((p: AutomationPrompt) => p.id === id ? { ...p, text } : p));
    };
    
    const handleDownload = (videoUrl: string | undefined, promptText: string) => {
        if (videoUrl) {
           window.electronAPI.downloadVideo({ url: videoUrl, promptText });
        } else {
            showToast('Không có URL video để tải xuống.', 'error');
        }
    };
    
    const handleSelectSaveDir = async () => {
        const path = await window.electronAPI.selectDownloadDirectory();
        if (path) {
            setAutoSaveConfig({ ...autoSaveConfig, path });
            showToast(`Thư mục lưu tự động: ${path}`, 'success');
        }
    };

    const handleRunAll = () => {
        if (!currentUser) {
            showToast('Vui lòng đăng nhập để sử dụng tính năng này.', 'error');
            return;
        }
        if (prompts.length === 0) {
            showToast('Vui lòng tải prompts vào danh sách.', 'error');
            return;
        }
        if (autoSaveConfig.enabled && !autoSaveConfig.path) {
            showToast('Vui lòng chọn thư mục để tự động lưu video.', 'error');
            return;
        }
        const promptsToRun = prompts.filter((p: AutomationPrompt) => p.status !== 'success');
        setAutomationState((prev: AutomationState) => ({
            ...prev,
            prompts: prompts.map((p: AutomationPrompt) => ({ ...p, status: 'queued', message: 'Đang chờ...' })),
            isRunning: true
        }));
        window.electronAPI.startBrowserAutomation({
            prompts: promptsToRun,
            authToken: currentUser.token,
            model,
            aspectRatio
        });
    };

    const handleStopAll = () => {
        window.electronAPI.stopBrowserAutomation();
        setAutomationState((prev: AutomationState) => ({ ...prev, isRunning: false }));
    };

    const handleClearAllPrompts = () => {
        if (window.confirm(`Bạn có chắc chắn muốn xóa tất cả ${prompts.length} prompt khỏi danh sách không?`)) {
            setPrompts([]);
            showToast('Đã xóa tất cả prompts.', 'info');
        }
    };

    const addPromptField = () => {
        setPrompts((prev: AutomationPrompt[]) => [...prev, { id: `prompt-${Date.now()}`, text: '', status: 'idle', message: 'Sẵn sàng' }]);
    };

    const removePrompt = (id: string) => {
        setPrompts((prev: AutomationPrompt[]) => prev.filter((p: AutomationPrompt) => p.id !== id));
    };

    return (
        <div className="animate-fade-in h-full flex flex-col">
            <h1 className="text-3xl font-bold text-light mb-2">Tạo video bằng Veo3</h1>
            <p className="text-dark-text mb-6">Tự động hóa quy trình tạo video hàng loạt.</p>

            <div className="bg-secondary p-4 rounded-lg shadow-md mb-4">
                <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
                    {/* Model */}
                    <div>
                        <label className="block text-sm font-medium text-dark-text mb-1">Model</label>
                        <select value={model} onChange={e => setModel(e.target.value)} className="w-full p-2 bg-primary rounded-md border border-border-color min-w-[150px] h-[42px]">
                            <option value="veo_3_0_t2v_fast_ultra">Veo 3 - Fast</option>
                            
                        </select>
                    </div>

                    {/* Tỷ lệ */}
                    <div>
                        <label className="block text-sm font-medium text-dark-text mb-1">Tỷ lệ</label>
                        <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value as any)} className="w-full p-2 bg-primary rounded-md border border-border-color min-w-[150px] h-[42px]">
                             <option value="LANDSCAPE">16:9 Ngang</option>
                             <option value="PORTRAIT">9:16 Dọc</option>
                         </select>
                    </div>

                    {/* Tải prompt */}
                    <div>
                        <label className="block text-sm font-medium text-dark-text mb-1">Tải prompt</label>
                        <select onChange={(e) => {
                            const storyId = e.target.value;
                            const relatedPrompts = storyId ? allPrompts.filter(p => p.storyId === storyId) : [];
                            setPrompts(relatedPrompts.map(p => ({ id: p.id, text: p.prompt, status: 'idle', message: 'Sẵn sàng' })));
                        }} className="w-full p-2 bg-primary rounded-md border border-border-color min-w-[200px] h-[42px]">
                            <option value="">-- Từ câu chuyện --</option>
                            {stories.map((s: Story) => <option key={s.id} value={s.id}>{s.title}</option>)}
                        </select>
                    </div>

                    {/* Nhóm Tự động lưu */}
                    <div className="flex items-end gap-2">
                         <div className="flex flex-col">
                            <label htmlFor="auto-save-toggle" className="flex items-center cursor-pointer mb-2">
                                <div className="relative">
                                    <input type="checkbox" id="auto-save-toggle" className="sr-only peer" checked={autoSaveConfig.enabled} onChange={() => setAutoSaveConfig({...autoSaveConfig, enabled: !autoSaveConfig.enabled })} />
                                    <div className="block bg-gray-400 w-10 h-6 rounded-full peer-checked:bg-green-500 transition"></div>
                                    <div className="dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition peer-checked:translate-x-full"></div>
                                </div>
                                <div className="ml-2 text-dark-text text-sm font-medium whitespace-nowrap">Tự động lưu</div>
                            </label>
                         </div>
                         {autoSaveConfig.enabled && (
                            <div className="flex flex-col items-start">
                                <button onClick={handleSelectSaveDir} className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-2 text-sm h-[42px]">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" /></svg>
                                    {autoSaveConfig.path ? 'Đổi' : 'Chọn'}
                                </button>
                                {autoSaveConfig.path && (
                                     <p className='text-xs text-dark-text mt-1 truncate max-w-[150px]' title={autoSaveConfig.path}>
                                         {autoSaveConfig.path}
                                     </p>
                                )}
                            </div>
                        )}
                    </div>

                     {/* Nhóm nút hành động */}
                    <div className="flex items-center gap-2 ml-auto">
                        <button onClick={handleClearAllPrompts} disabled={isRunning || prompts.length === 0} className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg disabled:bg-gray-400 flex items-center justify-center gap-2 h-[42px]">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                             Xóa tất cả
                        </button>
                        <button onClick={handleRunAll} disabled={isRunning || prompts.length === 0} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg disabled:bg-gray-400 flex items-center justify-center gap-2 h-[42px]">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
                             Chạy tất cả
                        </button>
                        {isRunning && (
                            <button onClick={handleStopAll} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2 h-[42px]">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" /></svg>
                                Dừng tất cả
                            </button>
                        )}
                    </div>
                </div>
            </div>
            
            {/* Thanh tiến trình và bộ đếm */}
            <div className="mb-4 bg-secondary p-3 rounded-lg shadow-inner">
                 <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-4">
                        <span className="font-semibold text-light">{statusMessage}</span>
                        <span className="text-sm text-green-600 font-semibold">Thành công: {successCount}</span>
                        <span className="text-sm text-red-600 font-semibold">Thất bại: {errorCount}</span>
                    </div>
                    <span className="text-sm font-semibold text-accent">{Math.round(overallProgress)}%</span>
                </div>
                <div className="w-full bg-primary rounded-full h-2">
                    <div className="bg-accent h-2 rounded-full transition-all duration-300" style={{ width: `${overallProgress}%` }}></div>
                </div>
            </div>

             {/* Danh sách Prompts */}
             <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                {prompts.map((prompt: AutomationPrompt, index: number) => (
                    <div key={prompt.id} className="bg-secondary p-3 rounded-lg shadow-md grid grid-cols-12 gap-3 items-stretch">
                        <div className="col-span-7 flex flex-col">
                             <div className="flex justify-between items-center mb-1">
                                <label className="block text-dark-text text-sm font-bold">Prompt #{index + 1}</label>
                                <div className="flex items-center gap-2">
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                        prompt.status === 'success' ? 'bg-green-100 text-green-800' :
                                        ['running', 'queued', 'downloading', 'submitting', 'processing'].includes(prompt.status) ? 'bg-blue-100 text-blue-800' :
                                        prompt.status === 'error' ? 'bg-red-100 text-red-800' :
                                        'bg-gray-100 text-gray-800'
                                    }`}>{prompt.message}</span>
                                     <button onClick={() => {}} disabled={isRunning || prompt.status === 'success'} title="Chạy prompt này" className="p-1 hover:bg-green-100 rounded-full disabled:opacity-50">
                                        <svg className="h-4 w-4 text-green-600" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"></path></svg>
                                     </button>
                                     <button onClick={() => removePrompt(prompt.id)} disabled={isRunning} title="Xóa" className="p-1 hover:bg-red-100 rounded-full disabled:opacity-50">
                                        <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                     </button>
                                </div>
                            </div>
                            <textarea
                                value={prompt.text}
                                onChange={e => updatePromptText(prompt.id, e.target.value)}
                                className="w-full flex-1 p-2 bg-primary rounded-md border border-border-color text-sm resize-none"
                                readOnly={isRunning}
                            />
                        </div>
                        <div className="col-span-5 flex flex-col items-center justify-center bg-primary rounded-md border border-border-color p-2 min-h-[150px]">
                            {prompt.videoUrl ? (
                                <div className="w-full h-full relative group">
                                    <video key={prompt.videoUrl} controls className="w-full h-full object-contain rounded-md">
                                        <source src={prompt.videoUrl} type="video/mp4" />
                                    </video>
                                    <button
                                        onClick={() => handleDownload(prompt.videoUrl, prompt.text)}
                                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/50 text-white font-bold py-2 px-4 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                    > Tải về </button>
                                </div>
                            ) : ['running', 'queued', 'downloading', 'submitting', 'processing'].includes(prompt.status) ? (
                                <div className="text-center"> <Spinner className="w-8 h-8 text-blue-500 mx-auto"/> <p className="mt-2 text-dark-text text-sm capitalize">{prompt.status}...</p> </div>
                            ) : (
                                <div className="text-center text-dark-text text-sm"> <p>Kết quả sẽ hiện ở đây</p> </div>
                            )}
                        </div>
                    </div>
                ))}
                 <button onClick={addPromptField} disabled={isRunning} className="mt-4 w-full bg-blue-100 hover:bg-blue-200 text-blue-800 font-bold py-2 px-4 rounded-lg border border-blue-200 disabled:opacity-50">
                    + Thêm Prompt thủ công
                </button>
            </div>
        </div>
    );
};

export default AutoBrowserView;
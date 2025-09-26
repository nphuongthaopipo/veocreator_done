import { app, BrowserWindow, screen as electronScreen, ipcMain, dialog, clipboard, session } from 'electron';
import path from 'path';
import fs from 'fs';
import { autoUpdater } from 'electron-updater';

let stopAutomationFlag = false;
const MAX_CONCURRENT_SESSIONS = 5;
const MAX_RETRIES = 3; 

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];
const isDev = !!VITE_DEV_SERVER_URL;

// =================================================================
// 1. CÁC HÀM TIỆN ÍCH
// =================================================================

async function handleApiRequest(_event: any, { url, cookie, options }: any) {
  try {
    const targetUrl = new URL(url);
    
    let headers: any = {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Origin": "https://labs.google",
      "Referer": "https://labs.google/",
      ...options.headers
    };
    
    if (cookie && cookie.bearerToken) {
        const token = cookie.bearerToken.startsWith('Bearer ') 
            ? cookie.bearerToken.substring(7) 
            : cookie.bearerToken;
        headers['Authorization'] = `Bearer ${token}`;
    }

    if (cookie && cookie.value) {
        headers['Cookie'] = cookie.value;
    }

    if (targetUrl.hostname === "aisandbox-pa.googleapis.com") {
        if (!headers['Authorization']) {
            throw new Error("Bearer Token is required for aisandbox API.");
        }
    }

    const body = typeof options.body === "object" ? JSON.stringify(options.body) : options.body;
    const response = await fetch(url, { ...options, headers, body });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("API Error Response:", errorText);
      throw new Error(`API request to ${url} failed with status ${response.status}`);
    }

    const text = await response.text();
    return text ? JSON.parse(text) : {};
  } catch (error: any) {
    console.error(`Failed to fetch ${url}`, error);
    throw new Error(error.message || "An unknown network error occurred.");
  }
}

ipcMain.on("browser:stop-automation", () => {
  console.log("Received stop automation signal.");
  stopAutomationFlag = true;
});

// ... (Các hàm download, chọn thư mục không thay đổi) ...
ipcMain.on("download-video", async (event, { url, promptText, savePath, promptIndex }) => {
    const mainWindow = BrowserWindow.fromWebContents(event.sender);
    if (!mainWindow) return;
    let finalPath = savePath;

    if (!finalPath) {
        const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
            title: "Lưu video",
            defaultPath: `veo-video-${promptText.replace(/[^a-z0-9]/gi, "_").substring(0, 50)}.mp4`,
            filters: [{ name: "MP4 Videos", extensions: ["mp4"] }]
        });
        if (canceled || !filePath) {
            mainWindow.webContents.send("download-complete", { success: false, error: "Download canceled" });
            return;
        }
        finalPath = filePath;
    } else {
        try {
            if (!fs.existsSync(savePath)) {
                fs.mkdirSync(savePath, { recursive: true });
            }
            const filesInDir = fs.readdirSync(savePath);
            const fileAlreadyExists = filesInDir.some((file) => file.startsWith(`${promptIndex + 1}_`));
            if (fileAlreadyExists) {
                console.log(`Video for prompt #${promptIndex + 1} already exists. Skipping download.`);
                mainWindow.webContents.send("download-complete", { success: true, path: "Skipped" });
                return;
            }
            const randomSuffix = Math.random().toString(36).substring(2, 8);
            const newFilename = `${promptIndex + 1}_${promptText.replace(/[^a-z0-9]/gi, "_").substring(0, 30)}_${randomSuffix}.mp4`;
            finalPath = path.join(savePath, newFilename);
        } catch (dirError: any) {
            console.error("Directory handling error:", dirError);
            mainWindow.webContents.send("download-complete", { success: false, error: "Lỗi khi xử lý thư mục lưu." });
            return;
        }
    }

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch video: ${response.statusText}`);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        fs.writeFileSync(finalPath, buffer);
        mainWindow.webContents.send("download-complete", { success: true, path: finalPath });
    } catch (error: any) {
        console.error("Download error:", error);
        mainWindow.webContents.send("download-complete", { success: false, error: error.message });
    }
});

ipcMain.on('download-image', async (event, { imageDataUrl, storyTitle }) => {
    const mainWindow = BrowserWindow.fromWebContents(event.sender);
    if (!mainWindow) return;

    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        title: 'Lưu ảnh thumbnail',
        defaultPath: `thumbnail-${storyTitle.replace(/[^a-z0-9]/gi, '_').substring(0, 50)}.png`,
        filters: [{ name: 'PNG Images', extensions: ['png'] }]
    });

    if (canceled || !filePath) {
        mainWindow.webContents.send('download-complete', { success: false, error: 'Download canceled' });
        return;
    }

    try {
        const base64Data = imageDataUrl.replace(/^data:image\/png;base64,/, "");
        const buffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync(filePath, buffer);
        mainWindow.webContents.send('download-complete', { success: true, path: filePath });
    } catch (error: any) {
        console.error('Image download error:', error);
        mainWindow.webContents.send('download-complete', { success: false, error: error.message });
    }
});

ipcMain.handle("select-download-directory", async (event) => {
  const mainWindow = BrowserWindow.fromWebContents(event.sender);
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"]
  });
  if (canceled || filePaths.length === 0) {
    return null;
  }
  return filePaths[0];
});


// =================================================================
// 2. LOGIC TỰ ĐỘNG HÓA - PHIÊN BẢN API-ONLY
// =================================================================
ipcMain.on("browser:start-automation", async (event, { prompts, authToken, model, aspectRatio }) => {
    const mainWindow = BrowserWindow.fromWebContents(event.sender);
    stopAutomationFlag = false;

    const sendLog = (promptId: string | null, message: string, status: string, videoUrl: string | null = null, operationName: string | null = null, sceneId: string | null = null) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send("browser:log", { promptId, message, status, videoUrl, operationName, sceneId });
        }
        console.log(`[${promptId || "general"}] ${message}`);
    };

    const firstPromptId = prompts[0]?.id || "automation-task";
    
    const retryMap = new Map<string, number>();
    prompts.forEach((p: any) => retryMap.set(p.id, 0));

    try {
        sendLog(firstPromptId, "Đang lấy cookie từ máy chủ...", "running");
        
        const cookieResponse = await fetch('https://mmoreal.com/api/get_active_cookie.php', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const responseText = await cookieResponse.text();
        if (!cookieResponse.ok) throw new Error(`Không thể lấy cookie (HTTP ${cookieResponse.status}): ${responseText}`);

        let cookieData;
        try {
            cookieData = JSON.parse(responseText);
        } catch (e) {
            throw new Error(`Phản hồi từ máy chủ cookie không hợp lệ. Nội dung: ${responseText}`);
        }

        if (!cookieData.success || !cookieData.cookie) {
            throw new Error(cookieData.message || 'Không tìm thấy cookie hợp lệ từ máy chủ.');
        }
        
        const activeCookie = cookieData.cookie;
        sendLog(firstPromptId, `Đã lấy cookie "${activeCookie.name}". Bắt đầu tạo project...`, "running");

        const createProjectResponse = await handleApiRequest(null, {
            url: 'https://labs.google/fx/api/trpc/project.createProject',
            cookie: activeCookie,
            options: { method: 'POST', body: { json: { projectTitle: `Veo Project API - ${(new Date()).toLocaleString()}`, toolName: "PINHOLE" } } }
        });

        const projectId = createProjectResponse?.result?.data?.json?.result?.projectId;
        if (!projectId) {
            throw new Error("Không thể tạo project mới qua API. Phản hồi: " + JSON.stringify(createProjectResponse));
        }
        sendLog(firstPromptId, `Đã tạo project ID: ${projectId}.`, 'running');

        sendLog(firstPromptId, `Chờ 3 giây để project được kích hoạt...`, 'running');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        let promptQueue = [...prompts];
        const processingPrompts = new Map();

        const handleFailure = (prompt: any, reason: string) => {
            const retries = retryMap.get(prompt.id) || 0;
            if (retries < MAX_RETRIES) {
                const newRetries = retries + 1;
                retryMap.set(prompt.id, newRetries);
                sendLog(prompt.id, `Lỗi: ${reason}. Thử lại lần ${newRetries}/${MAX_RETRIES}...`, "running");
                promptQueue.unshift(prompt);
            } else {
                sendLog(prompt.id, `Lỗi cuối cùng sau ${MAX_RETRIES} lần thử: ${reason}`, "error");
            }
            processingPrompts.delete(prompt.id);
        };

        const submissionManager = async () => {
            while (promptQueue.length > 0 && !stopAutomationFlag) {
                if (processingPrompts.size < MAX_CONCURRENT_SESSIONS) {
                    const prompt = promptQueue.shift();
                    if (!prompt) continue;
                    try {
                        processingPrompts.set(prompt.id, { text: prompt.text, status: "submitting" });
                        sendLog(prompt.id, "Bắt đầu gửi prompt...", "submitting");
                        
                        const clientGeneratedSceneId = `client-generated-uuid-${Date.now()}-${Math.random()}`;
                        
                        // --- LOGIC CẬP NHẬT TỰ ĐỘNG MODEL VÀ TỶ LỆ ---
                        let finalModel = model;
                        let finalAspectRatio = `VIDEO_ASPECT_RATIO_${aspectRatio.toUpperCase()}`;

                        if (aspectRatio === 'PORTRAIT') {
                            finalModel = 'veo_3_0_t2v_fast_portrait_ultra';
                            finalAspectRatio = 'VIDEO_ASPECT_RATIO_PORTRAIT';
                        }
                        // --- KẾT THÚC CẬP NHẬT ---

                        const requestBody = {
                            "clientContext": { 
                                "projectId": projectId,
                                "tool": "PINHOLE" 
                            },
                            "requests": [{
                                "aspectRatio": finalAspectRatio,
                                "seed": Math.floor(Math.random() * 100000),
                                "textInput": { "prompt": prompt.text },
                                "videoModelKey": finalModel,
                                "metadata": { "sceneId": clientGeneratedSceneId }
                            }]
                        };

                        const generateResponse = await handleApiRequest(null, {
                            url: 'https://aisandbox-pa.googleapis.com/v1/video:batchAsyncGenerateVideoText',
                            cookie: activeCookie,
                            options: { method: 'POST', body: requestBody }
                        });
                        
                        sendLog(prompt.id, "Đã gửi prompt, đang chờ phản hồi...", "running");

                        const operation = generateResponse?.operations?.[0];
                        if (operation?.operation?.name && operation?.sceneId) {
                             processingPrompts.set(prompt.id, {
                                ...processingPrompts.get(prompt.id),
                                operationName: operation.operation.name,
                                sceneId: operation.sceneId,
                                status: "processing"
                            });
                            sendLog(prompt.id, "Đã nhận ID, bắt đầu xử lý...", "processing", null, operation.operation.name, operation.sceneId);
                        } else {
                            throw new Error('Không lấy được operation/scene ID. Phản hồi: ' + JSON.stringify(generateResponse));
                        }
                    } catch (error: any) {
                        handleFailure(prompt, error.message);
                    }
                } else {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
        };

        const statusManager = async () => {
            while ((promptQueue.length > 0 || processingPrompts.size > 0) && !stopAutomationFlag) {
                 const promptsToCheck = Array.from(processingPrompts.entries());
                for (const [promptId, data] of promptsToCheck) {
                    const promptData = data as any;
                    if (promptData.status !== "processing" || !promptData.operationName || !promptData.sceneId) continue;
                    try {
                        sendLog(promptId, "Đang kiểm tra trạng thái...", "processing", null, promptData.operationName, promptData.sceneId);

                        const statusResponse = await handleApiRequest(null, {
                            url: "https://aisandbox-pa.googleapis.com/v1/video:batchCheckAsyncVideoGenerationStatus",
                            cookie: activeCookie,
                            options: {
                                method: "POST",
                                body: { operations: [[{ operation: { name: promptData.operationName }, sceneId: promptData.sceneId }]] }
                            }
                        });
                        const operationResult = statusResponse.operations[0];
                        const apiStatus = operationResult.status;
                        
                        let statusMessage = "Trạng thái: " + apiStatus.replace("MEDIA_GENERATION_STATUS_", "").toLowerCase();
                        sendLog(promptId, statusMessage, "processing", null, promptData.operationName, promptData.sceneId);

                        if (apiStatus === "MEDIA_GENERATION_STATUS_SUCCESSFUL") {
                            const videoUrl = operationResult?.operation?.metadata?.video?.fifeUrl || operationResult?.operation?.metadata?.video?.servingBaseUri;
                            sendLog(promptId, "Video hoàn thành!", "success", videoUrl, promptData.operationName, promptData.sceneId);
                            processingPrompts.delete(promptId);
                        } else if (apiStatus === "MEDIA_GENERATION_STATUS_FAILED") {
                             const originalPrompt = prompts.find((p:any) => p.id === promptId);
                             const errorMsg = operationResult?.error?.message || "Lỗi không xác định";
                             if (originalPrompt) {
                                 handleFailure(originalPrompt, errorMsg);
                             } else {
                                 processingPrompts.delete(promptId);
                             }
                        }
                    } catch (error: any) {
                        const originalPrompt = prompts.find((p:any) => p.id === promptId);
                        if (originalPrompt) {
                             handleFailure(originalPrompt, error.message);
                        } else {
                            processingPrompts.delete(promptId);
                        }
                    }
                }
                await new Promise(resolve => setTimeout(resolve, 8000));
            }
            if (!stopAutomationFlag) {
                sendLog(firstPromptId, "Tất cả các prompt đã được xử lý!", "success");
            }
        };
        
        await Promise.all([submissionManager(), statusManager()]);

    } catch (error: any) {
        let errorMessage = `Lỗi nghiêm trọng: ${error.message}`;
        prompts.forEach((p: any) => sendLog(p.id, errorMessage, "error"));
    }
});

// =================================================================
// LOGIC TỰ ĐỘNG CẬP NHẬT
// =================================================================
autoUpdater.autoDownload = false; // Tắt tự động tải, để người dùng quyết định
autoUpdater.autoInstallOnAppQuit = true;

// Hàm gửi thông báo cập nhật về giao diện
function sendUpdateMessage(mainWindow, message, data = null) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-message', message, data);
    }
}

// =================================================================
// 3. HÀM TẠO CỬA SỔ CHÍNH VÀ VÒNG ĐỜI ỨNG DỤNG
// =================================================================
function createWindow() {
  const primaryDisplay = electronScreen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  const mainWindow = new BrowserWindow({
    width,
    height,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
      devTools: isDev
    }
  });

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
    // Chỉ kiểm tra cập nhật khi đã build
    mainWindow.once('ready-to-show', () => {
        autoUpdater.checkForUpdatesAndNotify();
    });
  }
  
  // Lắng nghe các sự kiện từ autoUpdater
  autoUpdater.on('update-available', (info) => {
      sendUpdateMessage(mainWindow, 'update-available', info);
      autoUpdater.downloadUpdate(); // Bắt đầu tải sau khi thông báo
  });

  autoUpdater.on('update-not-available', (info) => {
      sendUpdateMessage(mainWindow, 'update-not-available', info);
  });

  autoUpdater.on('download-progress', (progressObj) => {
      sendUpdateMessage(mainWindow, 'download-progress', progressObj);
  });

  autoUpdater.on('update-downloaded', (info) => {
      sendUpdateMessage(mainWindow, 'update-downloaded', info);
  });
  
  autoUpdater.on('error', (err) => {
      sendUpdateMessage(mainWindow, 'error', err.message);
  });
}

app.whenReady().then(() => {
  if (!isDev) {
      session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
          callback({
              responseHeaders: {
                  ...details.responseHeaders,
                  'Content-Security-Policy': ["script-src 'self'"]
              }
          });
      });
  }

  ipcMain.handle("fetch-api", handleApiRequest);
  createWindow();
});

// Thêm listener để khởi động lại và cài đặt
ipcMain.on('restart-and-install', () => {
    autoUpdater.quitAndInstall();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
// electron/preload.ts
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    fetch: (url, cookie, options) => 
        ipcRenderer.invoke('fetch-api', { url, cookie, options }),
    
    startBrowserAutomation: (args) => 
        ipcRenderer.send('browser:start-automation', args),
        
    stopBrowserAutomation: () => ipcRenderer.send('browser:stop-automation'),
    
    downloadVideo: (args) => ipcRenderer.send('download-video', args),
    downloadImage: (args) => ipcRenderer.send('download-image', args),
    selectDownloadDirectory: () => ipcRenderer.invoke('select-download-directory'),
    
    onDownloadComplete: (callback) => {
        const listener = (_event, result) => callback(result);
        ipcRenderer.on('download-complete', listener);
        return () => ipcRenderer.removeListener('download-complete', listener);
    },
    onBrowserLog: (callback) => {
        const listener = (_event, log) => callback(log);
        ipcRenderer.on('browser:log', listener);
        return () => ipcRenderer.removeListener('browser:log', listener);
    },
    onCookieUpdate: (callback) => {
        const listener = (_event, cookie) => callback(cookie);
        ipcRenderer.on('browser:cookie-update', listener);
        return () => ipcRenderer.removeListener('browser:cookie-update', listener);
    },

    // --- CÁC HÀM MỚI CHO VIỆC CẬP NHẬT ---
    checkForUpdates: () => ipcRenderer.send('check-for-updates'),
    onUpdateMessage: (callback) => {
        const listener = (_event, message, data) => callback(message, data);
        ipcRenderer.on('update-message', listener);
        return () => ipcRenderer.removeListener('update-message', listener);
    },
    restartAndInstall: () => ipcRenderer.send('restart-and-install')
});
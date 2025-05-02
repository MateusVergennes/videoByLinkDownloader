const { app, BrowserWindow } = require('electron');
const path = require('path');
const { fork } = require('child_process');

function createWindow() {
    const win = new BrowserWindow({
        width: 600,
        height: 700
    });

    win.loadURL('http://localhost:3000');
}

app.whenReady().then(() => {
    fork(path.join(__dirname, 'server.js')); // Inicia o servidor Express local
    createWindow();
});

app.on('window-all-closed', () => app.quit());
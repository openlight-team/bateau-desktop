import { app, BrowserWindow, ipcMain, Menu, MenuItem, webContents } from 'electron';
import contextMenu from 'electron-context-menu';
let mainWindow;

function createWindow() {
    const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    frame: false,
    webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        webviewTag: true,
        devTools: false
    }
    })

    mainWindow.loadFile('app.html')
    return mainWindow;
}

app.whenReady().then(() => {
    mainWindow = createWindow()
})

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit()
})

var maximized = false;

ipcMain.on('max', () => {
  //mainWindow is the reference to your window
  if(maximized == false) {
    mainWindow.maximize();
    maximized = true;
  }
  else {
    mainWindow.unmaximize();
    maximized = false;
  }
})

ipcMain.on('min', () => {
  //mainWindow is the reference to your window
  mainWindow.minimize()
})

const dispose = contextMenu();
dispose();
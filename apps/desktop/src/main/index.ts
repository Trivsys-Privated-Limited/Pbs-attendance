import { release } from "node:os";
import { join } from "node:path";
import { BrowserWindow, Menu, app, ipcMain, type IpcMainInvokeEvent, type Tray } from "electron";
import appIconPath from "../../resources/icon.png?asset";
import {
  IPC_CHANNELS,
  type AppInfo,
  type EmployeeSummary,
  type LoginOutcome,
} from "../preload/channels";
import { createApiClient, resolveApiBase } from "./api-client";
import { hardenSession, hardenWindow } from "./security";
import { createSessionManager } from "./session";
import { createTray } from "./tray";

const DEV_SERVER_URL = process.env.ELECTRON_RENDERER_URL ?? null;

/**
 * PBS Attend server (admin app API). Configured at build time via
 * MAIN_VITE_PBS_ATTEND_API_URL. HTTPS required except for localhost during development.
 */
const API_BASE = resolveApiBase(
  import.meta.env.MAIN_VITE_PBS_ATTEND_API_URL ??
    (app.isPackaged ? undefined : "http://localhost:3000"),
);

const sessionManager = createSessionManager({
  api: createApiClient(API_BASE, (input, init) => fetch(input, init)),
  onEnded: (reason) => mainWindow?.webContents.send(IPC_CHANNELS.authSessionEnded, reason),
});

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

function showMainWindow(): void {
  if (!mainWindow) {
    mainWindow = createMainWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1040,
    height: 700,
    minWidth: 880,
    minHeight: 600,
    show: false,
    title: "PBS Attend",
    icon: appIconPath,
    backgroundColor: "#F5F7FB",
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      // Security baseline — do not relax these.
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
      spellcheck: false,
      devTools: !app.isPackaged,
    },
  });

  hardenWindow(win, DEV_SERVER_URL ? new URL(DEV_SERVER_URL).origin : null);

  win.once("ready-to-show", () => win.show());

  // Closing the window keeps PBS Attend running in the tray (visible, never hidden).
  win.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      win.hide();
    }
  });
  win.on("closed", () => {
    mainWindow = null;
  });

  if (!app.isPackaged && DEV_SERVER_URL) {
    void win.loadURL(DEV_SERVER_URL);
  } else {
    void win.loadFile(join(__dirname, "../renderer/index.html"));
  }

  return win;
}

/** Only our own renderer page may call privileged IPC handlers. */
function isTrustedSender(event: IpcMainInvokeEvent): boolean {
  const url = event.senderFrame?.url;
  if (!url || !mainWindow || event.sender !== mainWindow.webContents) return false;
  if (DEV_SERVER_URL && !app.isPackaged) return url.startsWith(new URL(DEV_SERVER_URL).origin);
  return url.startsWith("file://") && url.includes("/renderer/index.html");
}

function registerIpc(): void {
  ipcMain.handle(IPC_CHANNELS.authLogin, async (event, payload: unknown): Promise<LoginOutcome> => {
    if (!isTrustedSender(event)) return { ok: false, error: "UNEXPECTED" };
    return sessionManager.login(payload);
  });
  ipcMain.handle(IPC_CHANNELS.authLogout, async (event): Promise<void> => {
    if (!isTrustedSender(event)) return;
    await sessionManager.logout();
  });
  ipcMain.handle(IPC_CHANNELS.authGetSession, (event): EmployeeSummary | null => {
    if (!isTrustedSender(event)) return null;
    return sessionManager.current();
  });

  ipcMain.handle(IPC_CHANNELS.getAppInfo, (): AppInfo => {
    return {
      version: app.getVersion(),
      platform: process.platform,
      osRelease: release(),
    };
  });
}

function quitApp(): void {
  isQuitting = true;
  app.quit();
}

// Only one PBS Attend instance per Windows session.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", showMainWindow);

  app.on("before-quit", () => {
    isQuitting = true;
    // Best effort: revoke the server session when the app quits.
    void sessionManager.logout();
  });

  void app.whenReady().then(() => {
    app.setAppUserModelId("com.pbsdigitals.attend");
    Menu.setApplicationMenu(null);
    hardenSession();
    registerIpc();
    mainWindow = createMainWindow();
    tray = createTray({ onOpen: showMainWindow, onQuit: quitApp });
  });

  app.on("window-all-closed", () => {
    // Stay in the tray on Windows; quitting is explicit via the tray menu.
    if (isQuitting) app.quit();
  });

  app.on("will-quit", () => {
    tray?.destroy();
    tray = null;
  });
}

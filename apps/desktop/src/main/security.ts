import { session, shell, type BrowserWindow } from "electron";

/** Only https links may leave the app, and they open in the default browser. */
function isSafeExternalUrl(url: string): boolean {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Process-wide hardening that applies to every session and window.
 * The renderer never needs camera, microphone, screen capture, notifications,
 * geolocation or any other permission, so all permission requests are denied.
 */
export function hardenSession(): void {
  const ses = session.defaultSession;
  ses.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  ses.setPermissionCheckHandler(() => false);
  // Block getDisplayMedia entirely: PBS Attend never captures the screen.
  ses.setDisplayMediaRequestHandler((_request, callback) => callback({}));
}

/** Locks a window to its own content: no navigation, no new windows, no webviews. */
export function hardenWindow(win: BrowserWindow, allowedOrigin: string | null): void {
  const contents = win.webContents;

  contents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) void shell.openExternal(url);
    return { action: "deny" };
  });

  contents.on("will-navigate", (event, url) => {
    const sameOrigin = allowedOrigin !== null && url.startsWith(allowedOrigin);
    if (!sameOrigin) event.preventDefault();
  });

  contents.on("will-attach-webview", (event) => event.preventDefault());
}

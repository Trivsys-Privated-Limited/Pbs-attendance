import { Menu, Tray, nativeImage } from "electron";
import trayIconPath from "../../resources/tray-icon.png?asset";

interface TrayOptions {
  onOpen: () => void;
  onQuit: () => void;
}

/**
 * System tray entry. PBS Attend stays visible in the tray while running so
 * employees always know it is active; there is no hidden or silent mode.
 */
export function createTray({ onOpen, onQuit }: TrayOptions): Tray {
  const tray = new Tray(nativeImage.createFromPath(trayIconPath));
  tray.setToolTip("PBS Attend · attendance and Active/Idle status only");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Open PBS Attend", click: onOpen },
      { type: "separator" },
      { label: "Status: not signed in", enabled: false },
      { type: "separator" },
      { label: "Quit PBS Attend", click: onQuit },
    ]),
  );
  tray.on("click", onOpen);
  return tray;
}

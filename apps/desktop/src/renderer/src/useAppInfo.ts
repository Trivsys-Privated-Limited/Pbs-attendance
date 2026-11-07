import { useEffect, useState } from "react";
import type { AppInfo } from "../../preload/channels";

/** Reads non-sensitive app metadata through the preload bridge. */
export function useAppInfo(): AppInfo | null {
  const [info, setInfo] = useState<AppInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    window.pbsAttend
      ?.getAppInfo()
      .then((value) => {
        if (!cancelled) setInfo(value);
      })
      .catch(() => {
        // Bridge unavailable (e.g. opened in a plain browser): keep the fallback label.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return info;
}

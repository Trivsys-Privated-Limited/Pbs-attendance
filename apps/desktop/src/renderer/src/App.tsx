import { Suspense, lazy, useEffect, useState } from "react";
import type { EmployeeSummary } from "../../preload/channels";
import { LoginScreen } from "./screens/LoginScreen";
import { SignedInShell } from "./screens/SignedInShell";

/**
 * Development-only preview of the signed-in screens with fictional data. In production
 * builds `import.meta.env.DEV` is false, so the preview module is never bundled.
 */
const PreviewShell = import.meta.env.DEV ? lazy(() => import("./preview/PreviewShell")) : null;

export function App() {
  const [employee, setEmployee] = useState<EmployeeSummary | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    const auth = window.pbsAttend?.auth;
    if (!auth) return;
    let cancelled = false;
    // Restore the in-memory session after a renderer reload (tokens stay in main).
    void auth.getSession().then((current) => {
      if (!cancelled && current) setEmployee(current);
    });
    const unsubscribe = auth.onSessionEnded(() => {
      setEmployee(null);
      setNotice("Your session has ended. Please sign in again.");
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  if (employee) {
    return (
      <SignedInShell
        employee={employee}
        onSignedOut={() => {
          setEmployee(null);
          setNotice("You have been signed out.");
        }}
      />
    );
  }

  if (previewing && PreviewShell) {
    return (
      <Suspense fallback={null}>
        <PreviewShell onLogout={() => setPreviewing(false)} />
      </Suspense>
    );
  }

  return (
    <LoginScreen
      notice={notice}
      onSignedIn={(e) => {
        setNotice(null);
        setEmployee(e);
      }}
      onOpenPreview={PreviewShell ? () => setPreviewing(true) : undefined}
    />
  );
}

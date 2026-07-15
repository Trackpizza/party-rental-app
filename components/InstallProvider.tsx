"use client";

// App-wide PWA install state. Registers the service worker, captures the
// Android/desktop `beforeinstallprompt` event (which can fire before any button
// mounts), tracks whether the app is already installed / running standalone,
// and detects iOS (any browser can Add to Home Screen since iOS 16.4).
// Consumed by <InstallButton />.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface InstallState {
  canInstall: boolean;
  isIOS: boolean;
  isStandalone: boolean;
  promptInstall: () => Promise<"accepted" | "dismissed" | null>;
}

const Ctx = createContext<InstallState>({
  canInstall: false,
  isIOS: false,
  isStandalone: false,
  promptInstall: async () => null,
});

/** A "where did it go?" message shown right after a desktop/Android install. */
function postInstallMessage(): string {
  const ua = navigator.userAgent;
  const name = document.title || "the app";
  if (/android|iphone|ipad|ipod/i.test(ua)) return "✅ Installed — find it on your home screen.";
  if (/mac/i.test(ua)) return `✅ Installed! Find “${name}” in Launchpad or Applications, and keep it in your Dock.`;
  return `✅ Installed! Find it in your Start menu (search “${name}”), then right-click it in the taskbar to pin it.`;
}

export function InstallProvider({ children }: { children: ReactNode }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [installedMsg, setInstalledMsg] = useState<string | null>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const ua = navigator.userAgent;
    const iOSDevice =
      /iphone|ipad|ipod/i.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setIsIOS(iOSDevice); // any iOS browser can Add to Home Screen since iOS 16.4

    const standaloneMQ = window.matchMedia("(display-mode: standalone)");
    const computeStandalone = () =>
      setIsStandalone(
        standaloneMQ.matches ||
          (window.navigator as unknown as { standalone?: boolean }).standalone === true
      );
    computeStandalone();
    standaloneMQ.addEventListener?.("change", computeStandalone);

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferred(null);
      setIsStandalone(true);
      setInstalledMsg(postInstallMessage());
      window.setTimeout(() => setInstalledMsg(null), 12000);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      standaloneMQ.removeEventListener?.("change", computeStandalone);
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferred) return null;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    return outcome;
  }, [deferred]);

  return (
    <Ctx.Provider value={{ canInstall: !!deferred, isIOS, isStandalone, promptInstall }}>
      {children}
      {installedMsg && (
        <div className="fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4">
          <div className="flex max-w-md items-start gap-3 rounded-xl bg-gray-900 px-4 py-3 text-sm text-white shadow-lg">
            <span>{installedMsg}</span>
            <button
              onClick={() => setInstalledMsg(null)}
              className="-mr-1 text-gray-400 hover:text-white"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

export const useInstall = () => useContext(Ctx);

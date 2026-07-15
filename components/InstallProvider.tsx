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

export function InstallProvider({ children }: { children: ReactNode }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

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
    </Ctx.Provider>
  );
}

export const useInstall = () => useContext(Ctx);

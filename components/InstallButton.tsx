"use client";

// One platform-aware "Install app" control.
// - Android / desktop Chromium: fires the native install prompt.
// - iOS (Safari, Chrome, Edge…): opens a Share -> Add to Home Screen modal
//   (works in any iOS browser since iOS 16.4).
// - Already installed / standalone, or an unsupported browser: renders nothing.

import { useState } from "react";
import { useInstall } from "@/components/InstallProvider";

export default function InstallButton() {
  const { canInstall, isIOS, isStandalone, promptInstall } = useInstall();
  const [showIOS, setShowIOS] = useState(false);

  if (isStandalone || (!canInstall && !isIOS)) return null;

  async function onClick() {
    if (canInstall) await promptInstall();
    else if (isIOS) setShowIOS(true);
  }

  return (
    <>
      <button
        onClick={onClick}
        className="inline-flex items-center gap-1 rounded-full border border-brand/50 px-3 py-1 text-sm font-semibold text-brand hover:bg-brand hover:text-white"
        title="Install this app"
      >
        <span aria-hidden>⬇</span> Install app
      </button>

      {showIOS && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={() => setShowIOS(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Install on iPhone or iPad"
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center gap-2">
              <span className="text-2xl" aria-hidden>🎉</span>
              <h2 className="text-lg font-bold">Add to your Home Screen</h2>
            </div>
            <p className="mb-4 text-sm text-gray-600">
              Install this app for a full-screen, app-like experience:
            </p>
            <ol className="space-y-3 text-sm text-gray-800">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-brand/10 text-xs font-bold text-brand">1</span>
                <span>
                  Tap the <strong>Share</strong> button{" "}
                  <ShareIcon className="mx-0.5 inline-block h-4 w-4 -translate-y-0.5 text-brand" />
                  {" "}— the <strong>bottom</strong> toolbar in Safari, or{" "}
                  <strong>top-right</strong> (or the <strong>⋯</strong> menu) in Chrome.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-brand/10 text-xs font-bold text-brand">2</span>
                <span>
                  Scroll down and tap <strong>Add to Home Screen</strong>{" "}
                  <span aria-hidden>➕</span>.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-brand/10 text-xs font-bold text-brand">3</span>
                <span>
                  Tap <strong>Add</strong> — the app icon appears on your Home Screen.
                </span>
              </li>
            </ol>
            <button
              onClick={() => setShowIOS(false)}
              className="mt-5 w-full rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/** The iOS Safari "Share" glyph (box with an upward arrow). */
function ShareIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M12 3v12M12 3l-3.5 3.5M12 3l3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7 10H5.5A1.5 1.5 0 0 0 4 11.5v7A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 18.5 10H17"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

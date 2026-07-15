"use client";

// When the app is launched as an INSTALLED PWA (standalone display mode) and
// lands on the public root, send it to the real app entry (the admin panel).
// Customers browsing in a normal tab aren't standalone, so they stay on the
// landing page. Also self-heals installs made before the manifest's start_url
// was pointed at /admin (Chrome caches start_url at install time).

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function StandaloneRedirect({ to }: { to: string }) {
  const router = useRouter();
  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) router.replace(to);
  }, [router, to]);
  return null;
}

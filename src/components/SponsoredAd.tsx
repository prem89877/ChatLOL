"use client";

import { useEffect } from "react";
import { reportAdImpression } from "@/lib/adsApi";
import type { SponsoredAd as Ad } from "@/lib/ads/types";

// One impression report per token per page load, even if React renders the effect twice (Strict Mode).
const reported = new Set<string>();

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Clearly labelled sponsored box, separate from the AI answer. All ad text is rendered as plain text. */
export default function SponsoredAd({ ad }: { ad: Ad }) {
  const token = ad.impressionToken;
  useEffect(() => {
    if (!token || reported.has(token)) return;
    reported.add(token);
    void reportAdImpression(token); // fire and forget; never affects the chat
  }, [token]);

  return (
    <aside aria-label="Sponsored advertisement" data-testid="sponsored-ad" className="max-w-full rounded-2xl border border-line bg-panel px-4 py-3 text-sm">
      <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">Sponsored</p>
      <p className="font-semibold">{ad.headline}</p>
      <p className="mt-0.5 text-muted">{ad.body}</p>
      <a
        href={ad.destinationUrl}
        target="_blank"
        rel="sponsored nofollow noopener noreferrer"
        className="mt-2 inline-block font-semibold text-brand hover:underline"
      >
        {ad.ctaText ?? "Learn more"} <span className="font-normal text-muted">({hostOf(ad.destinationUrl)})</span>
      </a>
    </aside>
  );
}

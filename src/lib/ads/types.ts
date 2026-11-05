// Shared by the server routes and the browser. Plain data only.

/** What the browser is allowed to know about an ad. Never contains the publisher key. */
export type SponsoredAd = {
  id: string;
  headline: string;
  body: string;
  ctaText: string | null;
  destinationUrl: string;
  /** Signed token used only to report the impression through ChatLOL's own server. */
  impressionToken: string | null;
};

export type AdLookupReason =
  | "ok"
  | "disabled"
  | "no_topic"
  | "no_fill"
  | "unauthorized"
  | "rate_limited"
  | "unavailable"
  | "invalid_response";

export type ImpressionStatus = "recorded" | "duplicate" | "rejected" | "failed";

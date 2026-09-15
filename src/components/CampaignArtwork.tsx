import { useState } from "react";
import type { Campaign } from "../data";

export function safeImageSource(value?: string): string | undefined {
  if (!value || value.length > 2048 || /[\\\u0000-\u0020\u007f]/.test(value))
    return undefined;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && !url.username && !url.password)
      return url.href;
  } catch {
    /* Unsupported image paths render the same placeholder. */
  }
  return undefined;
}
export function CampaignArtwork({
  campaign,
  variant,
}: {
  campaign: Campaign;
  variant: "hero" | "cover";
}) {
  const source = safeImageSource(
    variant === "hero"
      ? campaign.hero_image || campaign.cover_image
      : campaign.cover_image,
  );
  return (
    <Artwork
      key={source || "empty"}
      source={source}
      campaign={campaign}
      variant={variant}
    />
  );
}
function Artwork({
  source,
  campaign,
  variant,
}: {
  source?: string;
  campaign: Campaign;
  variant: "hero" | "cover";
}) {
  const [failed, setFailed] = useState(false);
  if (source && !failed)
    return (
      <img
        src={source}
        alt={campaign.image_alt || campaign.name}
        onError={() => setFailed(true)}
        referrerPolicy="no-referrer"
      />
    );
  return (
    <span
      role="img"
      aria-label={`${campaign.name} artwork unavailable`}
      className={variant === "cover" ? "art-monogram" : "campaign-monogram"}
      style={{ color: campaign.color }}
    >
      {campaign.symbol}↗
    </span>
  );
}

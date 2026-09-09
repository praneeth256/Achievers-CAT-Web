"use client";

import { useEffect, useState } from "react";
import { getQuestionAsset } from "@/lib/firebase/media";

export default function AssetImage({ assetId, alt }: { assetId: string; alt: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (assetId.startsWith("data:") || assetId.startsWith("https://")) {
      setSrc(assetId);
      return () => { alive = false; };
    }
    getQuestionAsset(assetId).then((asset) => {
      if (alive) setSrc(asset?.dataUrl || null);
    });
    return () => {
      alive = false;
    };
  }, [assetId]);

  if (!src) return <div className="h-24 animate-pulse rounded-xl bg-surface-muted" />;
  return <img src={src} alt={alt} className="max-h-96 w-full object-contain rounded-xl" />;
}

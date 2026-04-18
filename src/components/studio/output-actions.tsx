"use client";

import { useState } from "react";
import { RefreshCw, Share2, Copy, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const OutputActions = ({
  outputId,
  onRegenerate,
  isRegenerating,
}: {
  outputId: string;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
}): React.ReactNode => {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleShare = async (): Promise<void> => {
    setIsSharing(true);
    try {
      const res = await fetch(`/api/outputs/${outputId}/share`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setShareUrl(data.url);
      }
    } catch {
      // Error handling
    } finally {
      setIsSharing(false);
    }
  };

  const handleCopyLink = async (): Promise<void> => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-2">
      {onRegenerate && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRegenerate}
          disabled={isRegenerating}
          className="gap-1.5"
          style={{ borderRadius: 10 }}
        >
          {isRegenerating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Regenerate
        </Button>
      )}

      {shareUrl ? (
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopyLink}
          className="gap-1.5"
          style={{ borderRadius: 10 }}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {copied ? "Copied!" : "Copy Link"}
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={handleShare}
          disabled={isSharing}
          className="gap-1.5"
          style={{ borderRadius: 10 }}
        >
          {isSharing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Share2 className="h-3.5 w-3.5" />
          )}
          Share
        </Button>
      )}
    </div>
  );
};

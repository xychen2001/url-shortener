import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const API_BASE = "http://localhost:3000";

export const App = () => {
  const [originalUrl, setOriginalUrl] = useState("");
  const [customAlias, setCustomAlias] = useState("");
  const [shortUrl, setShortUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const shortenUrl = async () => {
    setLoading(true);
    setError(null);
    setShortUrl(null);
    setCopied(false);

    try {
      const res = await fetch(`${API_BASE}/shorten`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalUrl,
          customAlias: customAlias || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to shorten URL");
      }
      setShortUrl(`${API_BASE}/${data.shortCode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!shortUrl) return;
    await navigator.clipboard.writeText(shortUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">URL Shortener</CardTitle>
          <CardDescription>
            Paste a long URL and get a short link.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              shortenUrl();
            }}
            className="flex flex-col gap-2"
          >
            <Input
              type="url"
              required
              placeholder="https://example.com/very/long/url"
              value={originalUrl}
              onChange={(e) => setOriginalUrl(e.target.value)}
              disabled={loading}
            />
            <Input
              type="text"
              placeholder="custom alias (optional, 3-16 alphanumeric)"
              value={customAlias}
              onChange={(e) => setCustomAlias(e.target.value)}
              disabled={loading}
            />
            <Button type="submit" disabled={loading}>
              {loading ? "Shortening…" : "Shorten"}
            </Button>
          </form>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {shortUrl && (
            <div className="flex flex-col gap-2 rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Short URL</p>
              <div className="flex gap-2">
                <Input readOnly value={shortUrl} />
                <Button type="button" variant="outline" onClick={handleCopy}>
                  {copied ? "Copied!" : "Copy"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

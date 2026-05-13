import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

const API_BASE = 'http://localhost:3000'

export const Home = () => {
  const [originalUrl, setOriginalUrl] = useState('')
  const [customAlias, setCustomAlias] = useState('')
  const [shortUrl, setShortUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notFoundCode, setNotFoundCode] = useState(() =>
    new URLSearchParams(window.location.search).get('notFound'),
  )
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (notFoundCode) {
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [notFoundCode])

  const shortenUrl = async () => {
    setLoading(true)
    setError(null)
    setNotFoundCode(null)
    setShortUrl(null)
    setCopied(false)

    try {
      const res = await fetch(`${API_BASE}/shorten`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalUrl,
          customAlias: customAlias || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to shorten URL')
      }
      setShortUrl(`${API_BASE}/${data.shortCode}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!shortUrl) return
    await navigator.clipboard.writeText(shortUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleReset = () => {
    setShortUrl(null)
    setOriginalUrl('')
    setCustomAlias('')
    setError(null)
    setCopied(false)
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <header className="mb-10 text-center">
          <div className="paper-rise mx-auto mb-6 h-px w-10 bg-primary/70" />
          <h1
            className="paper-rise paper-rise-delay-1 font-serif text-5xl text-foreground leading-[1.02] tracking-tight sm:text-6xl"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            Create Your
            <br />
            <span className="italic">Short Link</span>
          </h1>
        </header>

        <Card
          key={shortUrl ? 'success' : 'form'}
          className="paper-rise paper-rise-delay-2 border-border/60 bg-card shadow-[0_1px_0_rgba(0,0,0,0.02),0_8px_30px_-12px_rgba(60,40,20,0.10)] ring-0"
        >
          <CardContent className="px-5 py-5">
            {!shortUrl ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  shortenUrl()
                }}
                className="flex flex-col gap-3"
              >
                {notFoundCode && (
                  <p className="rounded-md border border-destructive/25 bg-destructive/4 px-3 py-2 text-destructive text-sm">
                    Short URL <span className="font-medium">"{notFoundCode}"</span> was not found.
                  </p>
                )}

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
                  placeholder="custom alias (optional, 3–16 alphanumeric)"
                  value={customAlias}
                  onChange={(e) => setCustomAlias(e.target.value)}
                  disabled={loading}
                />
                <Button type="submit" disabled={loading} className="mt-1 h-11 text-sm">
                  {loading ? 'Shortening…' : 'Shorten'}
                </Button>

                {error && (
                  <p className="text-destructive/90 text-sm" role="alert">
                    {error}
                  </p>
                )}
              </form>
            ) : (
              <div className="flex flex-col items-center gap-5 py-3 text-center">
                <p className="font-sans text-[0.7rem] text-muted-foreground uppercase tracking-[0.22em]">
                  Shortened Successfully!
                </p>
                <a
                  href={shortUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block break-all font-serif text-3xl text-foreground leading-tight transition-colors hover:text-primary sm:text-4xl"
                  style={{ fontFamily: 'var(--font-serif)' }}
                >
                  {shortUrl.replace(/^https?:\/\//, '')}
                </a>
                <div className="flex w-full items-center justify-center gap-2 pt-1">
                  <Button type="button" onClick={handleCopy} className="h-10 min-w-24">
                    {copied ? 'Copied!' : 'Copy link'}
                  </Button>
                  <Button type="button" variant="outline" onClick={handleReset} className="h-10">
                    Shorten another
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

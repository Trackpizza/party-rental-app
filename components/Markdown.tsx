import { marked } from 'marked'

// Renders admin-authored markdown (waiver, consent, release text) to HTML.
// Content is written by the business owner in Settings (trusted), so raw
// HTML passthrough is acceptable. Styling lives in the `.md` block in
// globals.css (Tailwind preflight strips heading/list defaults otherwise).
export default function Markdown({
  text,
  className = '',
}: {
  text: string
  className?: string
}) {
  const html = marked.parse(text || '', { breaks: true, async: false }) as string
  return <div className={`md ${className}`} dangerouslySetInnerHTML={{ __html: html }} />
}

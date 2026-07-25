import { renderMathHtml } from '@/lib/mathRender'

// KaTeX aralash matn — xavfsiz (DOMPurify renderMathHtml ichida).
// Formula bo'lmasa oddiy matn qaytaradi.
export default function MathText({ text }: { text: string }) {
    try {
        const html = renderMathHtml(text || '', 'inline')
        if (html === null) return <>{text}</>
        return <span dangerouslySetInnerHTML={{ __html: html }} />
    } catch {
        return <>{text}</>
    }
}

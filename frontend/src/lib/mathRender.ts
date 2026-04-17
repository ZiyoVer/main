import DOMPurify from 'dompurify'
import katex from 'katex'

const LATEX_COMMAND_RE = /\\(?:frac|dfrac|tfrac|sqrt|sum|prod|int|lim|sin|cos|tan|cot|sec|csc|log|ln|alpha|beta|gamma|delta|theta|lambda|mu|pi|sigma|omega|cdot|times|leq|geq|neq|approx|infty|left|right|begin|end|vec|hat|bar|overline|underline|mathrm|text|pm|mp|to|rightarrow|leftarrow|iff|implies|subset|supset|cup|cap)\b/
const AUTO_WRAP_PATTERNS = [
    /\\(?:frac|dfrac|tfrac)\{[^{}]+\}\{[^{}]+\}/g,
    /\\sqrt(?:\[[^\]]+\])?\{[^{}]+\}/g,
    /\\(?:alpha|beta|gamma|delta|theta|lambda|mu|pi|sigma|omega|cdot|times|leq|geq|neq|approx|infty|pm|mp)\b/g,
    /\\(?:sin|cos|tan|cot|sec|csc|log|ln|lim)\b(?:\s*[a-zA-Z0-9]+)?/g,
]

export function normalizeMathText(text: string): string {
    return text
        .replace(/\\\[(\s*[\s\S]*?\s*)\\\]/g, (_, m) => `\n$$\n${m.trim()}\n$$\n`)
        .replace(/\\\((\s*[\s\S]*?\s*)\\\)/g, (_, m) => `$${m.trim()}$`)
}

function looksLikeStandaloneMathExpression(text: string): boolean {
    const trimmed = text.trim()
    if (!trimmed || trimmed.includes('$')) return false
    if (!LATEX_COMMAND_RE.test(trimmed) && !/[=<>+\-*/^_]/.test(trimmed)) return false

    const residue = trimmed
        .replace(/\\[a-zA-Z]+/g, '')
        .replace(/[0-9\s_^{}()[\]+\-*=<>.,/|:;!?"'`~]+/g, '')
        .trim()

    return residue.length <= 6
}

function autoWrapInlineLatex(text: string): string {
    if (!text || text.includes('$')) return text

    return AUTO_WRAP_PATTERNS.reduce((acc, pattern) => {
        return acc.replace(pattern, match => {
            const trimmed = match.trim()
            return trimmed ? `$${trimmed}$` : match
        })
    }, text)
}

function prepareMathText(text: string, mode: 'inline' | 'display'): string {
    const normalized = normalizeMathText(text || '')
    if (normalized.includes('$')) return normalized
    const autoWrapped = autoWrapInlineLatex(normalized)
    if (autoWrapped.includes('$')) return autoWrapped
    if (!looksLikeStandaloneMathExpression(normalized)) return normalized

    const trimmed = normalized.trim()
    return mode === 'display' ? `$$\n${trimmed}\n$$` : `$${trimmed}$`
}

export function hasRenderableMath(text: string, mode: 'inline' | 'display' = 'inline'): boolean {
    return prepareMathText(text, mode).includes('$')
}

export function renderMathHtml(text: string, mode: 'inline' | 'display' = 'inline'): string | null {
    const prepared = prepareMathText(text || '', mode)
    if (!prepared.includes('$')) return null

    const html = prepared
        .replace(/\$\$([\s\S]+?)\$\$/g, (_, m) => katex.renderToString(m.trim(), { displayMode: true, throwOnError: false }))
        .replace(/\$([^$\n]+)\$/g, (_, m) => katex.renderToString(m.trim(), { throwOnError: false }))

    return DOMPurify.sanitize(html)
}

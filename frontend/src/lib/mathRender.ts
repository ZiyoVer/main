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

    // O'zbekcha matn: "1932-yil", "5-sinf", "2-variant" — defis raqamni so'zga
    // ulaydi (qo'shimcha), bu MINUS emas. Bunday matnni formula deb hisoblamaymiz.
    if (/\d\s*[-–—]\s*[a-zA-ZЀ-ӿ]/.test(trimmed)) return false

    // Sonli ORALIQ/sana: "1865-1917", "10-15", "3-4 ta", "15-20 ball" — diapazon, formula EMAS.
    // (Aks holda defis matematik minus bo'lib render bo'lib ketadi: "1865 − 1917".)
    if (/^\d+\s*[-–—]\s*\d+(\s+[a-zA-ZЀ-ӿ.]+)?$/.test(trimmed)) return false

    // Variant yorlig'i bilan boshlanadi: "A) ...", "B. ..." — MCQ javob matni, formula emas.
    if (/^[A-DА-Г]\s*[).]/.test(trimmed)) return false

    // Tabiiy so'z bo'lsa (3+ harfli ketma-ketlik, LaTeX buyrug'idan tashqari) —
    // bu matn, formula emas. Haqiqiy formulalar $...$ yoki \buyruq bilan yoziladi.
    const withoutCommands = trimmed.replace(/\\[a-zA-Z]+/g, '')
    if (/[a-zA-ZЀ-ӿ]{3,}/.test(withoutCommands)) return false

    // Kuchli math signali shart: LaTeX buyrug'i, yuqori/quyi indeks (^ _), tenglik
    // (= < >), yoki ikki operand orasidagi amal (2+3, a/b). Yolg'iz defis yetarli emas.
    const hasStrongMath =
        LATEX_COMMAND_RE.test(trimmed) ||
        /[=<>^_]/.test(trimmed) ||
        /[0-9a-zA-Z)]\s*[+*/]\s*[0-9a-zA-Z(]/.test(trimmed) // '-' YO'Q: sana oralig'i minus bo'lib qolmasin
    if (!hasStrongMath) return false

    const residue = trimmed
        .replace(/\\[a-zA-Z]+/g, '')
        .replace(/[0-9\s_^{}()[\]+\-*=<>.,/|:;!?"'`~]+/g, '')
        .trim()

    // Tabiiy so'zlar yuqorida "3+ ketma-ket harf" bilan allaqachon bloklangan;
    // bu yerda faqat tarqoq o'zgaruvchilar (E=mc^2 → E,m,c) qoladi.
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

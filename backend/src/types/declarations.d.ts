declare module 'pdf-parse' {
    function pdfParse(buffer: Buffer, options?: Record<string, unknown>): Promise<{ text: string; numpages: number; info: Record<string, unknown> }>
    export = pdfParse
}

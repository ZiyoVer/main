declare module "pdf2pic" {
    export interface Options {
        density?: number;
        saveFilename?: string;
        savePath?: string;
        format?: string;
        width?: number;
        height?: number;
    }

    export interface ConvertOptions {
        responseType?: string;
    }

    export function fromBuffer(buffer: Buffer, options?: Options): (pageNumber: number, convertOptions?: ConvertOptions) => Promise<any>;
    export function fromPath(filePath: string, options?: Options): (pageNumber: number, convertOptions?: ConvertOptions) => Promise<any>;
    export function fromBase64(b64: string, options?: Options): (pageNumber: number, convertOptions?: ConvertOptions) => Promise<any>;
}

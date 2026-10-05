// Ambient declarations for fantasticon's transitive dependencies
declare module 'svg2ttf' {
    namespace svg2ttf {
        interface FontOptions {
            [key: string]: unknown;
        }
    }
    function svg2ttf(svgFont: string, options?: svg2ttf.FontOptions): { buffer: Buffer };
    export default svg2ttf;
}

declare module 'ttf2woff' {
    function ttf2woff(ttf: Uint8Array, options?: Record<string, unknown>): { buffer: Buffer };
    export default ttf2woff;
}

declare module 'svgicons2svgfont' {
    import type { Transform } from 'node:stream';
    interface SVGIcons2SVGFontStreamOptions {
        [key: string]: unknown;
    }
    export { SVGIcons2SVGFontStreamOptions };
    export default class SVGIcons2SVGFontStream extends Transform {
        constructor(options?: SVGIcons2SVGFontStreamOptions);
    }
}

/**
 * Reads RGBA pixels from an image preferring OffscreenCanvas, but falling back to VideoFrame if supported and
 * the browser is mangling OffscreenCanvas getImageData results.
 *
 * @param data - image, imagebitmap, or canvas to parse
 * @param x - top-left x coordinate to read from the image
 * @param y - top-left y coordinate to read from the image
 * @param width - width of the rectangle to read from the image
 * @param height - height of the rectangle to read from the image
 * @returns a promise containing the parsed RGBA pixel values of the image
 */
export declare function getImageData(image: HTMLImageElement | ImageBitmap, x?: number, y?: number, width?: number, height?: number): Promise<Uint8ClampedArray>;
/**
 * Accepts raw image data (encoded jpg or png) as a `Blob` or `ArrayBuffer`, returns an object that can be used as an image source that decodes the image.
 */
export declare const rawDataToCanvasImageSource: (data: ArrayBuffer | Blob) => Promise<HTMLImageElement | ImageBitmap>;

import { type Document, DOMParser } from '@xmldom/xmldom';

/**
 * Sanitizes raw XML input by stripping any leading UTF-8 Byte Order Mark (BOM)
 * and trimming leading/trailing whitespace.
 *
 * @param content - Raw XML string input.
 * @returns The sanitized XML string, or an empty string if input is invalid or empty.
 */
export function sanitizeXmlInput(content: string): string {
  return typeof content === 'string' ? content.replace(/^\uFEFF/, '').trim() : '';
}

/**
 * Configuration options for XML parsing.
 */
export interface XmlParserOptions {
  /**
   * Callback invoked when a warning, error, or fatal error occurs during XML parsing.
   *
   * @param level - The severity level ('warning', 'error', or 'fatalError').
   * @param msg - The error message emitted by the parser.
   */
  onError?: (level: string, msg: string) => void;
  /**
   * Label used in default log messages (e.g. 'KML', 'GPX'). Defaults to 'XML'.
   */
  label?: string;
}

/**
 * Creates a configured `DOMParser` instance with standardized error handling.
 *
 * @param options - Optional parser configuration options.
 * @returns A new `DOMParser` instance.
 */
export function createXmlParser(options?: XmlParserOptions): DOMParser {
  const label = options?.label ?? 'XML';
  return new DOMParser({
    onError:
      options?.onError ??
      ((level: string, msg: string): void => {
        if (level === 'error' || level === 'fatalError') {
          console.error(`${label} parse error (${msg})`);
        }
      }),
  });
}

/**
 * Parses an XML string into a DOM `Document`, stripping any leading UTF-8 BOM
 * and catching fatal errors safely.
 *
 * @param content - Raw XML string content.
 * @param options - Optional parser configuration options.
 * @returns The parsed DOM `Document`, or `null` if the content is empty or unparseable.
 */
export function parseXmlDocument(content: string, options?: XmlParserOptions): Document | null {
  const sanitized = sanitizeXmlInput(content);
  if (sanitized.length === 0) {
    return null;
  }
  try {
    const parser = createXmlParser(options);
    return parser.parseFromString(sanitized, 'text/xml');
  } catch {
    // Parse errors (including fatalError) are already reported by DOMParser via onError.
    return null;
  }
}

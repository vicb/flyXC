import { createXmlParser, parseXmlDocument, sanitizeXmlInput } from './xml';

describe('XML utilities', () => {
  describe('sanitizeXmlInput', () => {
    it('should strip leading UTF-8 BOM', () => {
      expect(sanitizeXmlInput('\uFEFF<xml></xml>')).toBe('<xml></xml>');
    });

    it('should trim surrounding whitespace', () => {
      expect(sanitizeXmlInput('  \n  <xml></xml>  \t  ')).toBe('<xml></xml>');
    });

    it('should handle both BOM and whitespace', () => {
      expect(sanitizeXmlInput('\uFEFF   <xml></xml>  ')).toBe('<xml></xml>');
    });

    it('should handle empty or non-string input', () => {
      expect(sanitizeXmlInput('')).toBe('');
      expect(sanitizeXmlInput('   ')).toBe('');
      expect(sanitizeXmlInput(null as any)).toBe('');
    });
  });

  describe('createXmlParser', () => {
    it('should invoke custom onError on errors', () => {
      const errors: { level: string; msg: string }[] = [];
      const parser = createXmlParser({
        onError: (level, msg) => {
          errors.push({ level, msg });
        },
      });
      try {
        parser.parseFromString('<invalid><unclosed>', 'text/xml');
      } catch {
        // Fatal error throws ParseError in xmldom after reporting to onError.
      }
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.level === 'error' || e.level === 'fatalError')).toBe(true);
    });
  });

  describe('parseXmlDocument', () => {
    it('should parse valid XML', () => {
      const doc = parseXmlDocument('\uFEFF<root><child attr="val">text</child></root>');
      expect(doc).not.toBeNull();
      expect(doc?.getElementsByTagName('child').length).toBe(1);
      expect(doc?.getElementsByTagName('child')[0].getAttribute('attr')).toBe('val');
    });

    it('should return null on empty string', () => {
      expect(parseXmlDocument('')).toBeNull();
      expect(parseXmlDocument('   ')).toBeNull();
      expect(parseXmlDocument('\uFEFF  ')).toBeNull();
    });

    it('should return null on fatal parse error and handle safely', () => {
      const doc = parseXmlDocument('<invalid', { label: 'Test' });
      expect(doc).toBeNull();
    });
  });
});

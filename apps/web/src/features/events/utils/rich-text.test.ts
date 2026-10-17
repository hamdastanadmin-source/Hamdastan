import { describe, expect, it } from 'vitest';

import { parseRichText } from './rich-text';

describe('parseRichText', () => {
  it('reads headings, paragraphs, lists, bold and line breaks', () => {
    const blocks = parseRichText('# برنامه\nشب **موسیقی**\nخط دوم\n\n- اجرای زنده\n- پرسش و پاسخ');
    expect(blocks).toEqual([
      { kind: 'heading', level: 2, content: [{ kind: 'text', text: 'برنامه' }] },
      {
        kind: 'paragraph',
        content: [
          { kind: 'text', text: 'شب ' },
          { kind: 'bold', text: 'موسیقی' },
          { kind: 'break' },
          { kind: 'text', text: 'خط دوم' },
        ],
      },
      { kind: 'list', items: [[{ kind: 'text', text: 'اجرای زنده' }], [{ kind: 'text', text: 'پرسش و پاسخ' }]] },
    ]);
  });

  it('makes links only of web addresses', () => {
    const [safe, unsafe] = parseRichText('[سایت](https://hamdaastaan.ir)\n\n[کلیک](javascript:alert(1))');
    expect(safe).toEqual({ kind: 'paragraph', content: [{ kind: 'link', text: 'سایت', href: 'https://hamdaastaan.ir' }] });
    expect(unsafe.kind === 'paragraph' && unsafe.content.every((part) => part.kind === 'text')).toBe(true);
  });

  it('keeps markup as plain text — there is no HTML', () => {
    const [block] = parseRichText('<script>alert(1)</script>');
    expect(block).toEqual({ kind: 'paragraph', content: [{ kind: 'text', text: '<script>alert(1)</script>' }] });
  });

  it('answers nothing for an empty description', () => {
    expect(parseRichText('  \n\n')).toEqual([]);
  });
});

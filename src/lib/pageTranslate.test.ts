import { describe, expect, it, vi } from 'vitest';
import { buildWords, translateText, startEnglish, stopEnglish } from './pageTranslate';

const dict = buildWords(
  [{ 'অর্ডার': 'Orders', 'মোট': 'Total', 'সেভ করুন': 'Save', 'জন সিলেক্টেড': 'selected', 'লাল': 'Red' }],
  [{ '৳{0} কেনাকাটায় ফ্রি ডেলিভারি': 'Free delivery on orders of ৳{0}', '{0} রঙে {1}টি পণ্য': '{1} products in {0}' }],
);

describe('translateText', () => {
  it('swaps a known text and keeps its spaces', () => {
    expect(translateText(' অর্ডার ', dict)).toBe(' Orders ');
  });
  it('finds a known text inside emoji and punctuation', () => {
    expect(translateText('📦 অর্ডার', dict)).toBe('📦 Orders');
    expect(translateText('মোট:', dict)).toBe('Total:');
    expect(translateText('সেভ করুন!', dict)).toBe('Save!');
  });
  it('turns Bangla numbers, dates and times into English', () => {
    expect(translateText('৳১,২০০', dict)).toBe('৳1,200');
    expect(translateText('২৩ নভেম্বর ২০২৬', dict)).toBe('23 November 2026');
    expect(translateText('৩ দিন আগে', dict)).toBe('3 days ago');
    expect(translateText('প্রায় ২ ঘণ্টা আগে', dict)).toBe('about 2 hours ago');
  });
  it('handles a number before or after a known text', () => {
    expect(translateText('৫ জন সিলেক্টেড', dict)).toBe('5 selected');
    expect(translateText('মোট ১২', dict)).toBe('Total 12');
    expect(translateText('মোট: ৳৫০০', dict)).toBe('Total: ৳500');
  });
  it('fills a text with a value inside', () => {
    expect(translateText('৳১০০০ কেনাকাটায় ফ্রি ডেলিভারি', dict)).toBe('Free delivery on orders of ৳1000');
    expect(translateText('লাল রঙে ৫টি পণ্য', dict)).toBe('5 products in Red');
  });
  it('does each part of a one-line list', () => {
    expect(translateText('মোট | লাল শাড়ি | অর্ডার', dict)).toBe('Total | লাল শাড়ি | Orders');
  });
  it('leaves unknown Bangla and English alone', () => {
    expect(translateText('লাল শাড়ি', dict)).toBeNull();
    expect(translateText('Orders', dict)).toBeNull();
  });
});

describe('the admin page in English', () => {
  it('translates the page, skips memos and typing, and puts Bangla back', async () => {
    document.body.innerHTML = `
      <div id="a">সেভ করুন</div>
      <input id="i" placeholder="অর্ডার" />
      <textarea id="t">অর্ডার</textarea>
      <div class="print-invoice-wrapper"><span id="m">মোট</span></div>
      <div translate="no"><span id="n">মোট</span></div>`;
    startEnglish('admin');
    const $ = (id: string) => document.getElementById(id)!;
    // the word list loads the first time
    await vi.waitFor(() => expect($('a').textContent).toBe('Save'), { timeout: 10000 });
    expect($('i').getAttribute('placeholder')).toBe('Orders');
    expect($('t').textContent).toBe('অর্ডার');
    expect($('m').textContent).toBe('মোট');
    expect($('n').textContent).toBe('মোট');

    // a page change is translated too
    const added = document.createElement('p');
    added.textContent = 'অর্ডার';
    document.body.appendChild(added);
    await new Promise((r) => setTimeout(r, 0));
    expect(added.textContent).toBe('Orders');

    stopEnglish('admin');
    expect($('a').textContent).toBe('সেভ করুন');
    expect($('i').getAttribute('placeholder')).toBe('অর্ডার');
    expect(added.textContent).toBe('অর্ডার');
  });
});

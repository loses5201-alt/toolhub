/*
  HTML 轉純文字核心 —— 純函式、無 DOM(用字串處理,Node 可測)。
  把從網頁/HTML 信件複製來的內容去掉標籤、解開 HTML 實體,保留段落換行,
  得到乾淨可貼的純文字。盡力而為:複雜版面不保證完美,但對一般內文夠用。
  全程瀏覽器、不連網、不上傳。
*/

// 常見具名實體(只收常用的,其餘走數值實體或原樣保留)
const NAMED: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  copy: '©',
  reg: '®',
  trade: '™',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  middot: '·',
  bull: '•',
  deg: '°',
  times: '×',
  divide: '÷',
  euro: '€',
  pound: '£',
  cent: '¢',
  yen: '¥',
  sect: '§',
  para: '¶',
}

/** 解開 HTML 實體:具名(&amp;)、十進位(&#39;)、十六進位(&#x27;)。 */
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z][a-zA-Z0-9]*);/g, (m, body: string) => {
    if (body[0] === '#') {
      const isHex = body[1] === 'x' || body[1] === 'X'
      const cp = parseInt(isHex ? body.slice(2) : body.slice(1), isHex ? 16 : 10)
      if (Number.isNaN(cp) || cp < 0 || cp > 0x10ffff) return m
      try {
        return String.fromCodePoint(cp)
      } catch {
        return m
      }
    }
    return Object.prototype.hasOwnProperty.call(NAMED, body) ? NAMED[body] : m
  })
}

/** 把 HTML 轉成保留段落的純文字。 */
export function htmlToText(html: string): string {
  let s = html
  // 註解、script、style 整塊移除
  s = s.replace(/<!--[\s\S]*?-->/g, '')
  s = s.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '')
  // 換行類標籤
  s = s.replace(/<br\s*\/?>/gi, '\n')
  s = s.replace(/<hr\s*\/?>/gi, '\n')
  // 清單項目前加項目符號
  s = s.replace(/<li[^>]*>/gi, '\n• ')
  // 區塊結束標籤 → 換行
  s = s.replace(
    /<\/(p|div|li|tr|h[1-6]|blockquote|section|article|header|footer|ul|ol|table|thead|tbody|pre|figure)>/gi,
    '\n',
  )
  // 表格儲存格分隔
  s = s.replace(/<\/(td|th)>/gi, '\t')
  // 其餘標籤去掉
  s = s.replace(/<[^>]+>/g, '')
  // 解開實體(在去標籤之後,避免 &lt;script&gt; 被當成標籤)
  s = decodeEntities(s)
  // 正規化空白:行內多重空白/Tab 收斂,逐行 trim,壓掉過多空行
  s = s.replace(/\r\n?/g, '\n')
  s = s.replace(/ {2,}/g, ' ') // 只收斂多重空白,保留 Tab 當儲存格分隔
  s = s
    .split('\n')
    .map((l) => l.trim())
    .join('\n')
  s = s.replace(/\n{3,}/g, '\n\n')
  return s.trim()
}

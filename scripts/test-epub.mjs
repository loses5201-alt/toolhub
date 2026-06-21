/*
  EPUB 解析引擎的回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-epub.mjs
  oracle:手構符合 EPUB 規範的 container.xml / OPF / NCX / nav.xhtml 片段,逐項比對解析結果。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `epub-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/epub.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { parseContainer, parseOpf, findCoverHref, parseNcx, parseNav, resolveHref, parseAttrs, findElements } =
  await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else { fail++; console.error(`✗ ${note}`) }
}

// ---- parseAttrs ----
check('parseAttrs 雙引號', parseAttrs('id="x" href="a.html"').href === 'a.html')
check('parseAttrs 單引號', parseAttrs("media-type='application/xhtml+xml'")['media-type'] === 'application/xhtml+xml')
check('parseAttrs 解實體', parseAttrs('title="A &amp; B"').title === 'A & B')

// ---- findElements(命名空間前綴 / 自閉合)----
check('findElements 前綴', findElements('<dc:title>Hi</dc:title>', 'title')[0].inner === 'Hi')
check('findElements 自閉合屬性', findElements('<item href="a" />', 'item')[0].attrs.href === 'a')
check('findElements 多筆', findElements('<item id="1"/><item id="2"/>', 'item').length === 2)

// ---- container.xml ----
const container = `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`
check('parseContainer 取 OPF 路徑', parseContainer(container) === 'OEBPS/content.opf')
check('parseContainer 無 rootfile 回 null', parseContainer('<container></container>') === null)

// ---- resolveHref ----
check('resolveHref 同層', resolveHref('OEBPS/', 'ch1.xhtml') === 'OEBPS/ch1.xhtml')
check('resolveHref ../ 上層', resolveHref('OEBPS/text/', '../images/c.jpg') === 'OEBPS/images/c.jpg')
check('resolveHref 去錨點', resolveHref('OEBPS/', 'ch1.xhtml#sec2') === 'OEBPS/ch1.xhtml')
check('resolveHref 根目錄 OPF', resolveHref('', 'content.xhtml') === 'content.xhtml')

// ---- OPF(EPUB2 風格,dc: 前綴 + meta cover)----
const opf2 = `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>三體</dc:title>
    <dc:creator opf:role="aut">劉慈欣</dc:creator>
    <dc:creator>譯者 Ken</dc:creator>
    <dc:language>zh-TW</dc:language>
    <dc:publisher>貓頭鷹</dc:publisher>
    <dc:date>2008-01-01</dc:date>
    <dc:identifier id="bookid">urn:isbn:9789861234567</dc:identifier>
    <dc:description>科幻小說 &amp; 經典</dc:description>
    <dc:subject>科幻</dc:subject>
    <dc:subject>小說</dc:subject>
    <meta name="cover" content="cover-img"/>
  </metadata>
  <manifest>
    <item id="cover-img" href="images/cover.jpg" media-type="image/jpeg"/>
    <item id="ch1" href="text/ch1.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch2" href="text/ch2.xhtml" media-type="application/xhtml+xml"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
  </manifest>
  <spine toc="ncx">
    <itemref idref="ch1"/>
    <itemref idref="ch2"/>
  </spine>
</package>`
const o2 = parseOpf(opf2, 'OEBPS/content.opf')
check('OPF version 2.0', o2.meta.version === '2.0')
check('OPF title', o2.meta.title === '三體')
check('OPF 多作者', o2.meta.creators.length === 2 && o2.meta.creators[0] === '劉慈欣')
check('OPF language', o2.meta.language === 'zh-TW')
check('OPF publisher', o2.meta.publisher === '貓頭鷹')
check('OPF date', o2.meta.date === '2008-01-01')
check('OPF identifier(ISBN)', o2.meta.identifiers[0] === 'urn:isbn:9789861234567')
check('OPF description 解實體', o2.meta.description === '科幻小說 & 經典')
check('OPF 多主題', o2.meta.subjects.length === 2 && o2.meta.subjects.includes('小說'))
check('OPF coverItemId', o2.meta.coverItemId === 'cover-img')
check('OPF manifest 4 項', o2.manifest.length === 4)
check('OPF spine 順序', o2.spine.length === 2 && o2.spine[0] === 'ch1' && o2.spine[1] === 'ch2')
check('OPF opfDir', o2.opfDir === 'OEBPS/')
check('findCoverHref(EPUB2 meta)', findCoverHref(o2) === 'OEBPS/images/cover.jpg')

// ---- OPF(EPUB3 風格,properties=cover-image / nav)----
const opf3 = `<package version="3.0" xmlns="http://www.idpf.org/2007/opf">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Book Three</dc:title>
    <dc:language>en</dc:language>
  </metadata>
  <manifest>
    <item id="cover" href="cover.png" media-type="image/png" properties="cover-image"/>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="c1" href="c1.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine><itemref idref="c1"/></spine>
</package>`
const o3 = parseOpf(opf3, 'content.opf')
check('OPF3 version 3.0', o3.meta.version === '3.0')
check('OPF3 無作者回空陣列', o3.meta.creators.length === 0)
check('findCoverHref(EPUB3 properties)', findCoverHref(o3) === 'cover.png')

// ---- toc.ncx(巢狀)----
const ncx = `<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/">
  <navMap>
    <navPoint id="n1" playOrder="1">
      <navLabel><text>第一章</text></navLabel>
      <content src="text/ch1.xhtml"/>
      <navPoint id="n1-1" playOrder="2">
        <navLabel><text>1.1 節</text></navLabel>
        <content src="text/ch1.xhtml#s1"/>
      </navPoint>
    </navPoint>
    <navPoint id="n2" playOrder="3">
      <navLabel><text>第二章</text></navLabel>
      <content src="text/ch2.xhtml"/>
    </navPoint>
  </navMap>
</ncx>`
const toc = parseNcx(ncx, 'OEBPS/')
check('NCX 3 個項目', toc.length === 3)
check('NCX 第一章 label/href', toc[0].label === '第一章' && toc[0].href === 'OEBPS/text/ch1.xhtml' && toc[0].depth === 0)
check('NCX 子章節深度 1', toc[1].label === '1.1 節' && toc[1].depth === 1)
check('NCX 去錨點 + 回到深度 0', toc[2].label === '第二章' && toc[2].depth === 0)

// ---- nav.xhtml(EPUB3,巢狀 ol)----
const nav = `<html xmlns:epub="http://www.idpf.org/2007/ops">
<body>
<nav epub:type="toc">
  <ol>
    <li><a href="c1.xhtml">Chapter 1</a>
      <ol><li><a href="c1.xhtml#s">Section 1.1</a></li></ol>
    </li>
    <li><a href="c2.xhtml">Chapter 2</a></li>
  </ol>
</nav>
<nav epub:type="landmarks"><ol><li><a href="c1.xhtml">Start</a></li></ol></nav>
</body></html>`
const navToc = parseNav(nav, '')
check('nav 取 toc(非 landmarks)3 項? 應只取 toc 的 3 個 a', navToc.length === 3)
check('nav Chapter 1 深度 0', navToc[0].label === 'Chapter 1' && navToc[0].href === 'c1.xhtml' && navToc[0].depth === 0)
check('nav Section 1.1 深度 1', navToc[1].label === 'Section 1.1' && navToc[1].depth === 1)
check('nav Chapter 2 回深度 0', navToc[2].label === 'Chapter 2' && navToc[2].depth === 0)

console.log(fail === 0 ? '\n全部通過 ✅' : `\n${fail} 筆失敗 ❌`)
process.exit(fail === 0 ? 0 : 1)

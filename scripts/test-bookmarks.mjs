/*
  瀏覽器書籤解析引擎的回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-bookmarks.mjs
  oracle:手構符合 Netscape Bookmark 格式的 HTML,逐項比對解析樹、攤平、重複、Markdown / CSV 輸出。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `bm-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/bookmarks.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { parseBookmarks, flattenBookmarks, countNodes, normalizeUrl, findDuplicates, toMarkdown, toCsv } =
  await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else { fail++; console.error(`✗ ${note}`) }
}

const SAMPLE = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><A HREF="https://example.com/" ADD_DATE="1700000000">Example</A>
    <DT><H3 ADD_DATE="1699999999">新聞</H3>
    <DL><p>
        <DT><A HREF="https://news.example.com/a">頭條 &amp; 即時</A>
        <DT><H3>科技</H3>
        <DL><p>
            <DT><A HREF="https://tech.example.com/x">Tech X</A>
        </DL><p>
        <DT><A HREF="https://news.example.com/b">B 版</A>
    </DL><p>
    <DT><A HREF="https://example.com">Example 重複(無尾斜線)</A>
</DL><p>`
const root = parseBookmarks(SAMPLE)

// ---- 樹結構 ----
check('根為 folder', root.type === 'folder')
check('根層 3 個項目(link, 新聞folder, link)', root.children.length === 3)
check('第一筆是連結 Example', root.children[0].type === 'link' && root.children[0].title === 'Example')
check('連結 add_date 轉毫秒', root.children[0].addDate === 1700000000000)
check('第二筆是資料夾 新聞', root.children[1].type === 'folder' && root.children[1].name === '新聞')
check('新聞 資料夾含 頭條 / 科技 / B版', root.children[1].children.length === 3)
check('頭條標題解實體', root.children[1].children[0].title === '頭條 & 即時')
check('科技 是巢狀資料夾', root.children[1].children[1].type === 'folder' && root.children[1].children[1].name === '科技')
check('科技 內含 Tech X', root.children[1].children[1].children[0].title === 'Tech X')
check('B 版 回到 新聞 層級(非科技內)', root.children[1].children[2].type === 'link' && root.children[1].children[2].title === 'B 版')
check('最後一筆回到根層', root.children[2].type === 'link' && /重複/.test(root.children[2].title))

// ---- 計數 ----
const cnt = countNodes(root)
check('資料夾數 2(新聞 + 科技)', cnt.folders === 2)
check('連結數 5', cnt.links === 5)

// ---- 攤平 ----
const flat = flattenBookmarks(root)
check('攤平 5 筆', flat.length === 5)
check('Tech X 資料夾路徑 = 新聞 / 科技', flat.find((f) => f.bookmark.title === 'Tech X').folder === '新聞 / 科技')
check('根層連結路徑為空字串', flat.find((f) => f.bookmark.title === 'Example').folder === '')

// ---- 正規化 / 重複 ----
check('normalizeUrl 去尾斜線', normalizeUrl('https://A.com/') === 'https://a.com')
check('normalizeUrl 去 fragment', normalizeUrl('https://a.com/x#sec') === 'https://a.com/x')
check('normalizeUrl host 小寫但路徑保留大小寫', normalizeUrl('https://A.com/Path') === 'https://a.com/Path')
const dups = findDuplicates(flat)
check('找到 1 組重複(example.com)', dups.length === 1 && dups[0].entries.length === 2)
check('重複組正規化網址', dups[0].url === 'https://example.com')

// ---- Markdown ----
const md = toMarkdown(root)
check('Markdown 含資料夾標題', /# 新聞/.test(md) && /## 科技/.test(md))
check('Markdown 連結格式', /- \[Example\]\(https:\/\/example\.com\/\)/.test(md))
check('Markdown 巢狀深度遞增', md.indexOf('## 科技') > md.indexOf('# 新聞'))

// ---- CSV ----
const csv = toCsv(flat)
check('CSV 含 BOM 與表頭', csv.startsWith('﻿資料夾,標題,網址,加入時間'))
check('CSV 含逗號欄位加引號', csv.includes('"頭條 & 即時"') === false && csv.includes('頭條 & 即時'))
check('CSV 行數 = 1 表頭 + 5 筆', csv.trim().split('\r\n').length === 6)
check('CSV add_date → ISO', /2023-11-/.test(csv))

// ---- 邊界 ----
check('空輸入回空樹', parseBookmarks('').children.length === 0)
check('無 href 的 A 略過', parseBookmarks('<DL><DT><A>no href</A></DL>').children.length === 0)
check('未閉合 DL 不爆', parseBookmarks('<DL><DT><H3>F</H3><DL><DT><A HREF="x">y</A>').children[0].children[0].title === 'y')

console.log(fail === 0 ? '\n全部通過 ✅' : `\n${fail} 筆失敗 ❌`)
process.exit(fail === 0 ? 0 : 1)

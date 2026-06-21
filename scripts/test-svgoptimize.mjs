// SVG 最佳化引擎回歸測試 —— 以「安全瘦身」的明確規則手構樣本為 oracle。
import { execSync } from 'node:child_process'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'svgopt-'))
const entry = join(dir, 'entry.mjs')
const src = join(process.cwd(), 'src/features/svgOptimize.ts').replace(/\\/g, '\\\\')
writeFileSync(
  entry,
  `export { optimizeSvg, removeComments, removeProlog, removeEditorCruft, removeTitleDesc, collapseWhitespace, roundNumbers, byteLength } from '${src}'`,
)
const outFile = join(dir, 'bundle.mjs')
execSync(`npx esbuild ${entry} --bundle --format=esm --platform=node --outfile=${outFile}`, {
  stdio: ['ignore', 'ignore', 'inherit'],
})
const M = await import('file://' + outFile)
const {
  optimizeSvg, removeComments, removeProlog, removeEditorCruft,
  removeTitleDesc, collapseWhitespace, roundNumbers, byteLength,
} = M

let pass = 0
let fail = 0
function eq(actual, expected, msg) {
  if (actual === expected) pass++
  else {
    fail++
    console.error(`✗ ${msg}\n   期望: ${JSON.stringify(expected)}\n   實得: ${JSON.stringify(actual)}`)
  }
}
function ok(cond, msg) {
  if (cond) pass++
  else {
    fail++
    console.error(`✗ ${msg}`)
  }
}

// --- byteLength ---
eq(byteLength('<svg/>'), 6, 'byteLength ASCII')
eq(byteLength('中'), 3, 'byteLength UTF-8 中文 3 bytes')
eq(byteLength(''), 0, 'byteLength 空字串')

// --- removeComments ---
eq(removeComments('<svg><!-- hi --><g/></svg>'), '<svg><g/></svg>', '單行註解移除')
eq(removeComments('<svg><!--\n多行\n註解--><g/></svg>'), '<svg><g/></svg>', '多行註解移除')
eq(removeComments('<svg><g/></svg>'), '<svg><g/></svg>', '無註解不變')
eq(removeComments('a<!--x-->b<!--y-->c'), 'abc', '多個註解')

// --- removeProlog ---
eq(removeProlog('<?xml version="1.0" encoding="UTF-8"?>\n<svg></svg>'), '\n<svg></svg>', 'XML 宣告移除')
eq(removeProlog('<?xml-stylesheet href="x.css"?><svg/>'), '<svg/>', 'xml-stylesheet PI 移除')
eq(
  removeProlog('<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "a.dtd">\n<svg/>'),
  '\n<svg/>',
  'DOCTYPE 移除',
)
eq(removeProlog('<svg/>'), '<svg/>', '無 prolog 不變')

// --- removeEditorCruft ---
eq(
  removeEditorCruft('<svg><metadata>\n<rdf:RDF>x</rdf:RDF>\n</metadata><g/></svg>'),
  '<svg><g/></svg>',
  'metadata 區塊移除',
)
eq(removeEditorCruft('<svg><metadata/><g/></svg>'), '<svg><g/></svg>', '自閉合 metadata 移除')
eq(
  removeEditorCruft('<svg><sodipodi:namedview id="base" showgrid="false"/><g/></svg>'),
  '<svg><g/></svg>',
  '自閉合 sodipodi:namedview 移除',
)
eq(
  removeEditorCruft('<path inkscape:connector-curvature="0" sodipodi:nodetypes="cc" d="M0 0"/>'),
  '<path d="M0 0"/>',
  '編輯器屬性移除、保留 d',
)
eq(
  removeEditorCruft("<path inkscape:label='圖層' d='M0 0'/>"),
  "<path d='M0 0'/>",
  '單引號編輯器屬性移除',
)
eq(
  removeEditorCruft('<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/x" xmlns:sodipodi="http://sodipodi.x">'),
  '<svg xmlns="http://www.w3.org/2000/svg">',
  '編輯器 xmlns 宣告移除、保留主 xmlns',
)
eq(
  removeEditorCruft('<svg xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:inkscape="x">'),
  '<svg xmlns:xlink="http://www.w3.org/1999/xlink">',
  'xlink 命名空間保留、inkscape 移除',
)
eq(removeEditorCruft('<svg><g/></svg>'), '<svg><g/></svg>', '無編輯器內容不變')

// --- removeTitleDesc ---
eq(removeTitleDesc('<svg><title>圖</title><desc>說明</desc><g/></svg>'), '<svg><g/></svg>', 'title/desc 移除')
eq(removeTitleDesc('<svg><g/></svg>'), '<svg><g/></svg>', '無 title/desc 不變')

// --- collapseWhitespace ---
eq(
  collapseWhitespace('<svg>\n  <g>\n    <path/>\n  </g>\n</svg>'),
  '<svg><g><path/></g></svg>',
  '縮排換行壓除',
)
eq(collapseWhitespace('  <svg/>  '), '<svg/>', '首尾空白去除')
eq(collapseWhitespace('<text>a b</text>'), '<text>a b</text>', '文字內單一空格保留(無換行)')
eq(collapseWhitespace('<tspan> </tspan>'), '<tspan> </tspan>', '無換行的空白文字節點保留')
eq(collapseWhitespace('<tspan>\n</tspan>'), '<tspan></tspan>', '含換行的純空白節點壓除')

// --- roundNumbers ---
eq(
  roundNumbers('<path d="M10.12345 20.6789 L0.5 1.0" stroke-width="1.50000"/>', 2),
  '<path d="M10.12 20.68 L0.5 1" stroke-width="1.5"/>',
  '幾何小數四捨五入到 2 位、去尾零',
)
eq(roundNumbers('<rect x="10.6" width="20.4"/>', 0), '<rect x="11" width="20"/>', 'precision 0 取整')
eq(roundNumbers('<path d="M-0.004 1.239"/>', 2), '<path d="M0 1.24"/>', '負零正規化為 0')
eq(roundNumbers('<text id="a1.5">3.14159</text>', 2), '<text id="a1.5">3.14159</text>', '非數值屬性與文字內容不動')
eq(roundNumbers('<path d="M1.5e3 2.25"/>', 2), '<path d="M1.5e3 2.25"/>', '指數記號保持原樣')

// --- optimizeSvg 主流程 ---
const dirty = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Created with Inkscape -->
<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://inkscape.x" width="100" height="100">
  <metadata>
    <rdf:RDF>meta</rdf:RDF>
  </metadata>
  <sodipodi:namedview showgrid="false"/>
  <path inkscape:connector-curvature="0" d="M0 0 L10 10"/>
</svg>`
const res = optimizeSvg(dirty)
eq(
  res.output,
  '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><path d="M0 0 L10 10"/></svg>',
  'optimizeSvg 預設整合輸出',
)
ok(res.originalBytes === byteLength(dirty), 'originalBytes 正確')
ok(res.optimizedBytes === byteLength(res.output), 'optimizedBytes 正確')
ok(res.savedBytes === res.originalBytes - res.optimizedBytes, 'savedBytes = 原 - 後')
ok(res.savedBytes > 0 && res.savedPercent > 0, '確實有瘦身')

// 全部選項關閉 → 僅去首尾空白
const plain = '<svg><!--c--><g/></svg>'
const off = optimizeSvg(plain, {
  removeComments: false,
  removeMetadata: false,
  removeXmlDecl: false,
  collapseWhitespace: false,
})
eq(off.output, plain, '全關閉時輸出不變(已無首尾空白)')
ok(off.savedBytes === 0 && off.savedPercent === 0, '全關閉無瘦身')

// roundNumbers 選項串接(預設關閉,開啟才動數字)
const rn = optimizeSvg('<svg><path d="M1.23456 2.0"/></svg>', { roundNumbers: true, precision: 1 })
eq(rn.output, '<svg><path d="M1.2 2"/></svg>', 'optimizeSvg 開啟 roundNumbers precision 1')

// 空輸入
const empty = optimizeSvg('')
eq(empty.output, '', '空輸入輸出空')
ok(empty.savedPercent === 0, '空輸入 savedPercent 0')

console.log(`\nsvgOptimize: ${pass} 通過, ${fail} 失敗`)
if (fail > 0) process.exit(1)

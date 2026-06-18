/*
  批次檔案改名引擎回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-batchrename.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `batchrename-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/batchRename.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { splitExtension, computeNewNames } = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}`)
  }
}

// --- splitExtension ---
check('splitExtension 一般', JSON.stringify(splitExtension('photo.jpg')) === JSON.stringify({ base: 'photo', ext: '.jpg' }))
check('splitExtension 多點取最後', JSON.stringify(splitExtension('a.b.png')) === JSON.stringify({ base: 'a.b', ext: '.png' }))
check('splitExtension 無副檔名', JSON.stringify(splitExtension('README')) === JSON.stringify({ base: 'README', ext: '' }))
check('splitExtension 開頭點視為無副檔名', JSON.stringify(splitExtension('.gitignore')) === JSON.stringify({ base: '.gitignore', ext: '' }))

const names = (r) => r.map((x) => x.newName)

// --- prefix / suffix ---
check('prefix', names(computeNewNames(['a.jpg', 'b.jpg'], { prefix: 'IMG_' })).join() === 'IMG_a.jpg,IMG_b.jpg')
check('suffix 加在副檔名前', names(computeNewNames(['a.jpg'], { suffix: '_edit' }))[0] === 'a_edit.jpg')
check('prefix+suffix', names(computeNewNames(['a.png'], { prefix: 'p-', suffix: '-s' }))[0] === 'p-a-s.png')

// --- find/replace ---
check('尋找取代', names(computeNewNames(['DSC 001.jpg', 'DSC 002.jpg'], { find: 'DSC ', replace: '旅遊' })).join() === '旅遊001.jpg,旅遊002.jpg')
check('取代全部出現', names(computeNewNames(['a_a_a.txt'], { find: '_', replace: '-' }))[0] === 'a-a-a.txt')
check('取代為空(刪除)', names(computeNewNames(['draft_final.doc'], { find: 'draft_', replace: '' }))[0] === 'final.doc')
check('尋找忽略大小寫', names(computeNewNames(['Photo.jpg'], { find: 'photo', replace: 'X', findIgnoreCase: true }))[0] === 'X.jpg')
check('尋找預設大小寫敏感', names(computeNewNames(['Photo.jpg'], { find: 'photo', replace: 'X' }))[0] === 'Photo.jpg')
check('特殊字元字面比對(. 不當萬用)', names(computeNewNames(['a.b.txt'], { find: '.', replace: '_' }))[0] === 'a_b.txt')

// --- case ---
check('轉小寫只動主檔名', names(computeNewNames(['MyFile.JPG'], { caseMode: 'lower' }))[0] === 'myfile.JPG')
check('轉大寫', names(computeNewNames(['abc.txt'], { caseMode: 'upper' }))[0] === 'ABC.txt')

// --- numbering ---
check('流水號後綴預設從 1', names(computeNewNames(['a.jpg', 'b.jpg', 'c.jpg'], { numbering: true })).join() === 'a1.jpg,b2.jpg,c3.jpg')
check('流水號補零', names(computeNewNames(['a.jpg', 'b.jpg'], { numbering: true, pad: 3 })).join() === 'a001.jpg,b002.jpg')
check('流水號自訂起始與遞增', names(computeNewNames(['a.jpg', 'b.jpg'], { numbering: true, start: 10, step: 5 })).join() === 'a10.jpg,b15.jpg')
check('流水號前綴 + 分隔', names(computeNewNames(['a.jpg', 'b.jpg'], { numbering: true, numberPosition: 'prefix', pad: 2, separator: '_' })).join() === '01_a.jpg,02_b.jpg')
check('流水號 step=0 視為 1', names(computeNewNames(['a.jpg', 'b.jpg'], { numbering: true, step: 0 })).join() === 'a1.jpg,b2.jpg')
check('流水號可負', names(computeNewNames(['a.jpg'], { numbering: true, start: -1, pad: 2 }))[0] === 'a-01.jpg')

// --- 組合:取代再加流水號 ---
check(
  '組合:取代+前綴流水號補零',
  names(computeNewNames(['IMG_x.jpg', 'IMG_y.jpg'], { find: 'IMG_', replace: '', numbering: true, numberPosition: 'prefix', pad: 2, separator: '-' })).join() ===
    '01-x.jpg,02-y.jpg',
)

// --- keepExtension ---
check('keepExtension=false 整名一起處理', names(computeNewNames(['a.jpg'], { keepExtension: false, suffix: '_x' }))[0] === 'a.jpg_x')

// --- 去重 ---
const dup = computeNewNames(['x1.jpg', 'x2.jpg', 'x3.jpg'], { find: 'x1', replace: 'same', findIgnoreCase: false })
check('不同名不加序號', names(dup).join() === 'same.jpg,x2.jpg,x3.jpg')
const allSame = computeNewNames(['p/a.jpg', 'q/b.jpg'].map((s) => s), { caseMode: 'lower' })
check('保留原樣(無規則衝突)', names(allSame).length === 2)
const collide = computeNewNames(['A.jpg', 'a.jpg'], { caseMode: 'lower' })
check('大小寫造成同名→後者加序號', names(collide).join() === 'a.jpg,a (2).jpg')
const collide2 = computeNewNames(['a.txt', 'b.txt', 'c.txt'], { find: 'a', replace: 'b', caseMode: 'none' })
// a→b 變 b.txt 與既有 b.txt 衝突
check('取代造成同名→加序號', names(collide2).join() === 'b.txt,b (2).txt,c.txt')

// --- 邊界 ---
check('空清單回空陣列', computeNewNames([], { prefix: 'x' }).length === 0)
check('保留 original 對應', computeNewNames(['orig.jpg'], { prefix: 'p' })[0].original === 'orig.jpg')
check('取代後主檔名為空→退回原主檔名', names(computeNewNames(['abc.jpg'], { find: 'abc', replace: '' }))[0] === 'abc.jpg')

if (fail) {
  console.error(`\n${fail} 項測試未通過`)
  process.exit(1)
}
console.log('\n批次改名:全部測試通過 ✅')

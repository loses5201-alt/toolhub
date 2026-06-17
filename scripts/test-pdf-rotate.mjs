/*
  PDF 頁面編輯(刪除/重排/旋轉)引擎的回歸測試(node 直接跑,無需框架)。
  用 esbuild 把只依賴 pdf-lib 的 edit.ts 打包成 ESM 再 import(pdf-lib 純 JS,Node 可跑)。
  執行:node scripts/test-pdf-rotate.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PDFDocument, degrees } from 'pdf-lib'

const out = join(tmpdir(), `pdf-rotate-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/tools/pdf-studio/edit.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: out,
  logLevel: 'silent',
})
const { buildEdited, addAngle } = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}`)
  }
}

// --- addAngle 正規化 ---
check('addAngle 0+90=90', addAngle(0, 90) === 90)
check('addAngle 90+90=180', addAngle(90, 90) === 180)
check('addAngle 270+90 環繞回 0', addAngle(270, 90) === 0)
check('addAngle 負數正規化(0-90→270)', addAngle(0, -90) === 270)
check('addAngle 原本就帶 90 的頁再轉 90=180', addAngle(90, 90) === 180)

// --- 建一份 3 頁、各頁尺寸不同的測試 PDF ---
async function makePdf() {
  const doc = await PDFDocument.create()
  doc.addPage([200, 400]) // P0 直式
  const p1 = doc.addPage([300, 300]) // P1 正方,先設原始 90 度
  p1.setRotation(degrees(90))
  doc.addPage([500, 200]) // P2 橫式
  return await doc.save()
}
const srcBytes = await makePdf()

// 旋轉:P0 轉 90、P1(原 90)再轉 90 應為 180、P2 不動;順序維持 0,1,2
const r1 = await buildEdited(srcBytes.buffer.slice(0), [
  { index: 0, rotate: 90 },
  { index: 1, rotate: 90 },
  { index: 2, rotate: 0 },
])
const d1 = await PDFDocument.load(r1)
const pg1 = d1.getPages()
check('輸出頁數不變(3)', pg1.length === 3)
check('P0 旋轉為 90', pg1[0].getRotation().angle === 90)
check('P1 原 90 再 +90 = 180(疊加非覆蓋)', pg1[1].getRotation().angle === 180)
check('P2 未旋轉維持 0', pg1[2].getRotation().angle === 0)
// 旋轉不改變頁面的尺寸記錄(mediaBox 不變,只是顯示方向)
check('P0 尺寸維持 200x400', Math.round(pg1[0].getWidth()) === 200 && Math.round(pg1[0].getHeight()) === 400)

// 刪除 + 重排 + 旋轉一起:只取 P2、P0,且 P2 轉 270
const r2 = await buildEdited(srcBytes.buffer.slice(0), [
  { index: 2, rotate: 270 },
  { index: 0, rotate: 0 },
])
const d2 = await PDFDocument.load(r2)
const pg2 = d2.getPages()
check('刪除+重排:輸出 2 頁', pg2.length === 2)
check('新第一頁 = 原 P2(橫式 500x200)', Math.round(pg2[0].getWidth()) === 500)
check('新第一頁旋轉 270', pg2[0].getRotation().angle === 270)
check('新第二頁 = 原 P0(直式 200x400)', Math.round(pg2[1].getWidth()) === 200)
check('新第二頁未旋轉', pg2[1].getRotation().angle === 0)

// 360 度增量視同不旋轉
const r3 = await buildEdited(srcBytes.buffer.slice(0), [{ index: 0, rotate: 360 }])
const pg3 = (await PDFDocument.load(r3)).getPages()
check('rotate 360 視同不旋轉(維持 0)', pg3[0].getRotation().angle === 0)

if (fail) {
  console.error(`\n${fail} 項失敗`)
  process.exit(1)
}
console.log('\n全部通過')

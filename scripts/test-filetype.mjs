/*
  檔案真實類型偵測引擎的回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-filetype.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `filetype-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/fileType.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { detectType, getExtension, checkFile } = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}`)
  }
}
const U = (...b) => new Uint8Array(b)
const ascii = (s) => [...s].map((c) => c.charCodeAt(0))

// --- detectType ---
check('PDF', detectType(U(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31)).exts.includes('pdf'))
check('PNG', detectType(U(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)).type.includes('PNG'))
check('JPEG', detectType(U(0xff, 0xd8, 0xff, 0xe0)).exts.includes('jpg'))
check('GIF', detectType(U(0x47, 0x49, 0x46, 0x38, 0x39, 0x61)).exts.includes('gif'))
check('ZIP/Office', detectType(U(0x50, 0x4b, 0x03, 0x04)).category === 'archive')
check('RAR', detectType(U(0x52, 0x61, 0x72, 0x21, 0x1a, 0x07)).exts.includes('rar'))
check('7z', detectType(U(0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c)).exts.includes('7z'))
check('舊 Office OLE', detectType(U(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1)).category === 'document')
check('EXE 為可執行', detectType(U(0x4d, 0x5a, 0x90, 0x00)).executable === true)
check('ELF 為可執行', detectType(U(0x7f, 0x45, 0x4c, 0x46)).executable === true)
check('MP3 ID3', detectType(U(0x49, 0x44, 0x33, 0x03)).exts.includes('mp3'))

// 容器:offset 4
check('MP4 ftyp@4', detectType(U(0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70)).category === 'video')

// RIFF 系列
check('WebP', detectType(U(...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WEBP'))).exts.includes('webp'))
check('WAV', detectType(U(...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WAVE'))).category === 'audio')

// 無法辨識
check('純文字無法辨識', detectType(U(...ascii('hello world'))) === null)
check('空檔回 null', detectType(U()) === null)

// --- getExtension ---
check('取副檔名', getExtension('photo.JPG') === 'jpg')
check('多點取最後', getExtension('a.tar.gz') === 'gz')
check('無副檔名回空', getExtension('README') === '')

// --- checkFile ---
const png = U(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)
check('相符 → ok', checkFile(png, 'logo.png').verdict === 'ok')
check('jpg 副檔名實為 png → mismatch', checkFile(png, 'logo.jpg').verdict === 'mismatch')

const exe = U(0x4d, 0x5a, 0x90, 0x00)
check('exe 偽裝成 .jpg → danger', checkFile(exe, 'cute_cat.jpg').verdict === 'danger')
check('danger 訊息含警示', checkFile(exe, 'invoice.pdf').message.includes('可疑'))
check('exe 名為 .exe → ok(相符)', checkFile(exe, 'setup.exe').verdict === 'ok')

const docx = U(0x50, 0x4b, 0x03, 0x04)
check('docx(ZIP 封裝)→ ok', checkFile(docx, 'report.docx').verdict === 'ok')
check('zip 命名 → ok', checkFile(docx, 'files.zip').verdict === 'ok')

check('文字檔 → unknown', checkFile(U(...ascii('plain text')), 'note.txt').verdict === 'unknown')

if (fail) {
  console.error(`\n${fail} 個測試未通過`)
  process.exit(1)
} else {
  console.log('\n全部通過 ✅')
}

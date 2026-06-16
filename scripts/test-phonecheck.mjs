/*
  台灣電話號碼檢視引擎的回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-phonecheck.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `phonecheck-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/phoneCheck.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { checkPhone } = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}`)
  }
}

// 手機
check('0912345678 是手機', checkPhone('0912345678').kind === 'mobile')
check('手機含連字號/空白可正規化', checkPhone('0912-345 678').normalized === '0912345678')
check('手機長度異常被標記', checkPhone('091234567').label.includes('長度異常'))

// +886 正規化
const tw = checkPhone('+886 912 345 678')
check('+886 手機正規化為 09 開頭', tw.normalized === '0912345678')
check('+886 手機判為手機', tw.kind === 'mobile')
check('+886 帶國際格式警訊', tw.warnings.some((w) => w.includes('+886')))
check('886 開頭(無+)也正規化', checkPhone('886912345678').normalized === '0912345678')

// 市話 + 區域
const land = checkPhone('02-2720-8889')
check('02 市話判為市話', land.kind === 'landline')
check('02 區域為臺北/新北/基隆', land.region.includes('臺北'))
check('07 區域為高雄', checkPhone('07-3344556').region === '高雄')
check('089 區域為臺東', checkPhone('089-123456').region === '臺東')

// 免付費 / 付費語音
check('0800 免付費', checkPhone('0800-000-123').kind === 'tollfree')
check('0204 付費語音', checkPhone('0204123456').kind === 'premium')
check('0204 帶高費率警訊', checkPhone('0204123456').warnings.some((w) => w.includes('高費率')))

// 短碼
check('165 是短碼', checkPhone('165').kind === 'shortcode')
check('165 標示反詐騙', checkPhone('165').label.includes('反詐騙'))
check('110 標示報案', checkPhone('110').label.includes('報案'))

// 國際 / 詐騙警訊
const intl = checkPhone('+1 202 555 0143')
check('+1 國外號碼判為 intl', intl.kind === 'intl')
check('國外號碼帶詐騙提醒', intl.warnings.some((w) => w.includes('詐騙')))
check('00x 國際冠碼帶警訊', checkPhone('00212345678').warnings.some((w) => w.includes('國際冠碼')))

// 無法判讀
check('亂碼號碼判為 unknown', checkPhone('12345').kind === 'unknown')

if (fail) {
  console.error(`\n${fail} 個測試未通過`)
  process.exit(1)
} else {
  console.log('\n全部通過 ✅')
}

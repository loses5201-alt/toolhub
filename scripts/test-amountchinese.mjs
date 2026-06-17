/*
  金額轉國字大寫引擎的回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-amountchinese.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `amountchinese-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/amountChinese.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { amountToChinese, chineseToNumber } = await import('file://' + out)

let fail = 0
function eq(note, input, field, expect) {
  const r = amountToChinese(input)
  const got = r[field]
  if (got === expect) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}\n    輸入「${input}」.${field} 期望「${expect}」實得「${got}」`)
  }
}
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}`)
  }
}

// --- 純整數大寫(digits) ---
eq('0 → 零', '0', 'digits', '零')
eq('5 → 伍', '5', 'digits', '伍')
eq('10 → 壹拾', '10', 'digits', '壹拾')
eq('100 → 壹佰', '100', 'digits', '壹佰')
eq('123 → 壹佰貳拾參', '123', 'digits', '壹佰貳拾參')
eq('1000 → 壹仟', '1000', 'digits', '壹仟')
eq('1234 → 壹仟貳佰參拾肆', '1234', 'digits', '壹仟貳佰參拾肆')
eq('10000 → 壹萬', '10000', 'digits', '壹萬')
eq('100000000 → 壹億(去尾零)', '100000000', 'digits', '壹億')

// 含零的連接
eq('1000123 → 壹佰萬零壹佰貳拾參', '1000123', 'digits', '壹佰萬零壹佰貳拾參')
eq('100010000 → 壹億零壹萬', '100010000', 'digits', '壹億零壹萬')
eq('100000001 → 壹億零壹(收斂雙零)', '100000001', 'digits', '壹億零壹')
eq('100001234 → 壹億零壹仟貳佰參拾肆', '100001234', 'digits', '壹億零壹仟貳佰參拾肆')
eq('10001 → 壹萬零壹', '10001', 'digits', '壹萬零壹')
eq('20300405 → 貳仟零參拾萬零肆佰零伍', '20300405', 'digits', '貳仟零參拾萬零肆佰零伍')

// --- 金額寫法(currency) ---
eq('整數金額加「元整」', '1234', 'currency', '壹仟貳佰參拾肆元整')
eq('0 → 零元整', '0', 'currency', '零元整')
eq('含角分', '1234.56', 'currency', '壹仟貳佰參拾肆元伍角陸分')
eq('只有角', '100.50', 'currency', '壹佰元伍角')
eq('角為零分不為零補零', '100.05', 'currency', '壹佰元零伍分')
eq('只有分', '0.05', 'currency', '伍分')
eq('只有角(無整數)', '0.5', 'currency', '伍角')

// --- 四捨五入到分 ---
eq('四捨五入:.555→伍角陸分', '1.555', 'currency', '壹元伍角陸分')
eq('四捨五入:.554→伍角伍分', '1.554', 'currency', '壹元伍角伍分')
eq('進位跨整數:0.999→壹元整', '0.999', 'currency', '壹元整')
eq('進位:9.999→壹拾元整', '9.999', 'currency', '壹拾元整')

// --- 正規化 / 輸入清理 ---
eq('千分位逗號被清掉', '1,234,567', 'digits', '壹佰貳拾參萬肆仟伍佰陸拾柒')
eq('前導零', '007', 'digits', '柒')
check('normalized 去千分位', amountToChinese('1,000.00').normalized === '1000')
check('normalized 保留兩位分', amountToChinese('12.30').normalized === '12.30')
check('normalized 單一分位補零', amountToChinese('12.3').normalized === '12.30')

// --- 錯誤處理 ---
check('空字串報錯', amountToChinese('').ok === false)
check('負數報錯', amountToChinese('-5').ok === false)
check('非數字報錯', amountToChinese('abc').ok === false)
check('超大數(17位)報錯', amountToChinese('1' + '0'.repeat(16)).ok === false)
check('兆級可表示(16位)', amountToChinese('9' + '0'.repeat(15)).ok === true)

// --- 反向:中文數字 → 阿拉伯數字 ---
const cnEq = (note, input, expect) => check(`中→數 ${note}`, chineseToNumber(input).value === expect)
cnEq('個位 五', '五', 5)
cnEq('十', '十', 10)
cnEq('十二', '十二', 12)
cnEq('二十', '二十', 20)
cnEq('二十三', '二十三', 23)
cnEq('一百', '一百', 100)
cnEq('一百零五', '一百零五', 105)
cnEq('一百二十三', '一百二十三', 123)
cnEq('兩百零五', '兩百零五', 205)
cnEq('一千零一', '一千零一', 1001)
cnEq('三萬', '三萬', 30000)
cnEq('一萬零五百', '一萬零五百', 10500)
cnEq('十萬', '十萬', 100000)
cnEq('大寫 壹佰貳拾參', '壹佰貳拾參', 123)
cnEq('大寫整段 1.23億', '壹億貳仟參佰肆拾伍萬陸仟柒佰捌拾玖', 123456789)
cnEq('億萬完整', '一億二千三百四十五萬六千七百八十九', 123456789)
cnEq('兆級', '一兆', 1e12)
cnEq('阿拉伯混用 5萬', '5萬', 50000)
cnEq('簡體 万亿', '一亿', 1e8)
cnEq('〇 當零', '〇', 0)
cnEq('零', '零', 0)
cnEq('小數 三點一四', '三點一四', 3.14)
cnEq('小數 大寫 拾點伍', '拾點伍', 10.5)
cnEq('前後空白', '  二十  ', 20)
check('中→數 空字串報錯', chineseToNumber('').ok === false)
check('中→數 無法辨識字報錯', chineseToNumber('二十蘋果').ok === false)
check('中→數 兩個點報錯', chineseToNumber('三點一點四').ok === false)
check('中→數 與正向一致(38500)', chineseToNumber(amountToChinese('38500').digits).value === 38500)
check('中→數 與正向一致(1234567)', chineseToNumber(amountToChinese('1234567').digits).value === 1234567)

if (fail) {
  console.error(`\n${fail} 個測試未通過`)
  process.exit(1)
} else {
  console.log('\n全部通過 ✅')
}

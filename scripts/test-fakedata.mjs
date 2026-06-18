/*
  測試假資料產生器的回歸測試(無需測試框架,node 直接跑)。
  用 esbuild 即時把 TS 轉成 ESM 再 import。核心保證:
   1) 產生的身分證字號全部通過 isValidTwId(獨立驗證器,與產生器是不同程式路徑)。
   2) 產生的統一編號全部通過 isValidVat。
   3) 同一種子產生同一批資料(可重現);不同種子大多不同。
   4) 手機/市話/Email/生日格式正確;CSV 轉出欄數與跳脫正確。
  執行:node scripts/test-fakedata.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

async function load(entry, name) {
  const out = join(tmpdir(), `${name}-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`)
  await build({ entryPoints: [entry], bundle: true, format: 'esm', outfile: out, logLevel: 'silent' })
  return import('file://' + out)
}

const fake = await load('src/features/fakeData.ts', 'fakedata')
const { isValidTwId } = await load('src/features/twId.ts', 'twid')
const { isValidVat } = await load('src/features/vatCheck.ts', 'vatcheck')

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}`)
  }
}

// --- 1) 身分證:大量產生皆通過獨立驗證器 ---
{
  const rng = fake.mulberry32(12345)
  let allValid = true
  let men = 0
  let women = 0
  for (let i = 0; i < 2000; i++) {
    const g = i % 2 === 0 ? 1 : 2
    const id = fake.genTwId(rng, g)
    if (!isValidTwId(id)) {
      allValid = false
      console.error('  無效身分證:', id)
      break
    }
    if (id[1] === '1') men++
    else if (id[1] === '2') women++
  }
  check('2000 筆身分證全部通過 isValidTwId', allValid)
  check('指定性別碼有效(男/女各 1000)', men === 1000 && women === 1000)
  // 不指定性別也要有效,且兩種性別都會出現
  const rng2 = fake.mulberry32(999)
  const genders = new Set()
  let ok2 = true
  for (let i = 0; i < 500; i++) {
    const id = fake.genTwId(rng2)
    if (!isValidTwId(id)) ok2 = false
    genders.add(id[1])
  }
  check('不指定性別也全部有效', ok2)
  check('不指定性別時 1 與 2 都會出現', genders.has('1') && genders.has('2'))
}

// --- 2) 統一編號:大量產生皆通過 isValidVat ---
{
  const rng = fake.mulberry32(54321)
  let allValid = true
  for (let i = 0; i < 2000; i++) {
    const v = fake.genVat(rng)
    if (!/^\d{8}$/.test(v) || !isValidVat(v)) {
      allValid = false
      console.error('  無效統編:', v)
      break
    }
  }
  check('2000 筆統一編號全部通過 isValidVat(8 碼數字)', allValid)
}

// --- 3) 可重現性 ---
{
  const opts = { count: 50, seed: 2026, fields: ['name', 'twId', 'mobile', 'email', 'vat', 'address'] }
  const a = fake.generate(opts)
  const b = fake.generate(opts)
  check('同一種子產生完全相同的批次', JSON.stringify(a) === JSON.stringify(b))
  const c = fake.generate({ ...opts, seed: 2027 })
  check('不同種子產生不同批次', JSON.stringify(a) !== JSON.stringify(c))
  check('count 與選定欄位數正確', a.length === 50 && Object.keys(a[0]).length === 6)
  // 整批 generate 出來的身分證/統編也要有效
  check('generate() 的身分證有效', a.every((r) => isValidTwId(r.twId)))
  check('generate() 的統編有效', a.every((r) => isValidVat(r.vat)))
  check('性別碼與身分證一致', fake
    .generate({ count: 100, seed: 7, fields: ['gender', 'twId'] })
    .every((r) => (r.gender === '男' ? r.twId[1] === '1' : r.twId[1] === '2')))
}

// --- 4) 各欄位格式 ---
{
  const rng = fake.mulberry32(88)
  let mobileOk = true
  let landlineOk = true
  let emailOk = true
  let bdayOk = true
  for (let i = 0; i < 300; i++) {
    if (!/^09\d{8}$/.test(fake.genMobile(rng))) mobileOk = false
    if (!/^\(0\d{1,2}\)\d{7,8}$/.test(fake.genLandline(rng))) landlineOk = false
    if (!/^[a-z][a-z0-9]{4,8}@[a-z.]+$/.test(fake.genEmail(rng))) emailOk = false
    const bd = fake.genBirthday(rng)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(bd)) bdayOk = false
    const y = Number(bd.slice(0, 4))
    if (y < 2025 - 75 || y > 2025 - 18) bdayOk = false
  }
  check('手機格式 09 開頭共 10 碼', mobileOk)
  check('市話格式 (區碼)號碼', landlineOk)
  check('Email 格式正確', emailOk)
  check('生日格式與年齡範圍正確', bdayOk)
  check('姓名非空且為中文', /^[一-鿿]{2,3}$/.test(fake.genName(rng)))
  check('公司名以公司/企業社結尾', /(公司|企業社)$/.test(fake.genCompany(rng)))
}

// --- 5) CSV 轉出 ---
{
  const rows = [
    { name: '王小明', email: 'a,b@x.com' },
    { name: '李"美"麗', email: 'c@y.com' },
  ]
  const csv = fake.rowsToCsv(rows, ['name', 'email'])
  const lines = csv.split('\n')
  check('CSV 含表頭共 3 行', lines.length === 3)
  check('CSV 表頭用中文標籤', lines[0] === '姓名,Email')
  check('含逗號的欄位加引號', lines[1].includes('"a,b@x.com"'))
  check('含引號的欄位跳脫為兩個雙引號', lines[2].includes('"李""美""麗"'))
  check('空資料只回表頭', fake.rowsToCsv([], ['name']) === '姓名')
  // seedFromString 穩定且可用於 generate
  check('seedFromString 對同字串穩定', fake.seedFromString('測試') === fake.seedFromString('測試'))
  check('seedFromString 對不同字串多半不同', fake.seedFromString('a') !== fake.seedFromString('b'))
}

if (fail) {
  console.error(`\n${fail} 個測試未通過`)
  process.exit(1)
} else {
  console.log('\n全部測試通過 ✓')
}

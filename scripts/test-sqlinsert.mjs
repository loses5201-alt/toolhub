/*
  SQL 語法產生器的回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-sqlinsert.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `sqlinsert-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/sqlInsert.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const m = await import('file://' + out)
const {
  parseTable,
  inferColumnType,
  inferTypes,
  quoteIdent,
  formatValue,
  generateInserts,
  generateCreateTable,
  generateSQL,
} = m

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}`)
  }
}

// --- parseTable ---
const t1 = parseTable('id,name\n1,小明\n2,小華')
check('表頭解析', t1.headers.join(',') === 'id,name')
check('列數', t1.rows.length === 2)
check('儲存格', t1.rows[1].join('|') === '2|小華')
check('TSV', parseTable('a\tb\n1\t2', '\t').headers.join(',') === 'a,b')
check('忽略尾端空行', parseTable('a,b\n1,2\n').rows.length === 1)
check('空表頭補名', parseTable(',x\n1,2').headers[0] === 'col1')

// --- 型別推斷 ---
check('整數欄', inferColumnType(['1', '2', '30']) === 'int')
check('小數欄', inferColumnType(['1.5', '2', '3']) === 'decimal')
check('布林欄', inferColumnType(['true', 'FALSE']) === 'bool')
check('字串欄', inferColumnType(['a', 'b']) === 'string')
check('空欄當字串', inferColumnType(['', '']) === 'string')
check('前導 0 當字串(電話)', inferColumnType(['0912345678', '0223456789']) === 'string')
check('單一 0 仍是整數', inferColumnType(['0', '5']) === 'int')
check('過長整數當字串', inferColumnType(['12345678901234567890']) === 'string')
check('負數整數', inferColumnType(['-3', '4']) === 'int')
check('混合數字非數字→字串', inferColumnType(['1', 'x']) === 'string')

const opts = {
  dialect: 'mysql',
  multiRow: true,
  batchSize: 100,
  emptyAsNull: true,
  inferTypes: true,
  createTable: false,
}

// --- formatValue ---
check('整數不加引號', formatValue('42', 'int', opts) === '42')
check('字串加引號', formatValue('hi', 'string', opts) === "'hi'")
check('單引號跳脫', formatValue("O'Brien", 'string', opts) === "'O''Brien'")
check('MySQL 反斜線跳脫', formatValue('a\\b', 'string', { ...opts, dialect: 'mysql' }) === "'a\\\\b'")
check('Postgres 反斜線不跳脫', formatValue('a\\b', 'string', { ...opts, dialect: 'postgres' }) === "'a\\b'")
check('空值→NULL', formatValue('', 'string', opts) === 'NULL')
check('空值不轉NULL→空字串', formatValue('', 'string', { ...opts, emptyAsNull: false }) === "''")
check('數字欄空值仍NULL', formatValue('', 'int', { ...opts, emptyAsNull: false }) === 'NULL')
check('布林 mysql→1', formatValue('true', 'bool', opts) === '1')
check('布林 postgres→TRUE', formatValue('true', 'bool', { ...opts, dialect: 'postgres' }) === 'TRUE')
check('數字欄遇前導0值仍加引號', formatValue('007', 'int', opts) === "'007'")

// --- quoteIdent ---
check('mysql 反引號', quoteIdent('user', 'mysql') === '`user`')
check('mysql 反引號跳脫', quoteIdent('a`b', 'mysql') === '`a``b`')
check('postgres 雙引號', quoteIdent('user', 'postgres') === '"user"')
check('standard 雙引號跳脫', quoteIdent('a"b', 'standard') === '"a""b"')

// --- generateInserts ---
const t2 = parseTable('id,name,active\n1,小明,true\n2,O\'Brien,false')
const ins = generateInserts(t2, { tableName: 'users', dialect: 'mysql' })
check('多列合併一句', (ins.match(/INSERT INTO/g) || []).length === 1)
check('包含表名與欄位', ins.includes('INSERT INTO `users` (`id`, `name`, `active`) VALUES'))
check('整數不加引號(實際)', ins.includes('(1, '))
check('布林轉 1/0', ins.includes('1)') && ins.includes('0)'))
check('值內單引號跳脫(實際)', ins.includes("'O''Brien'"))
check('結尾分號', ins.trim().endsWith(';'))

const insSingle = generateInserts(t2, { tableName: 'users', multiRow: false })
check('每列一句', (insSingle.match(/INSERT INTO/g) || []).length === 2)

const batched = generateInserts(parseTable('n\n1\n2\n3\n4\n5'), { tableName: 't', batchSize: 2 })
check('batchSize 切句', (batched.match(/INSERT INTO/g) || []).length === 3)

check('inferTypes 關閉→數字也加引號', generateInserts(parseTable('n\n5'), { inferTypes: false }).includes("('5')"))
check('空表回空字串', generateInserts(parseTable('')) === '')
check('預設表名 my_table', generateInserts(parseTable('a\n1')).includes('`my_table`'))

// --- CREATE TABLE ---
const ct = generateCreateTable(parseTable('id,name,price,ok\n1,abc,9.9,true'), {
  tableName: 'goods',
  dialect: 'mysql',
})
check('CREATE TABLE 標頭', ct.startsWith('CREATE TABLE `goods` ('))
check('int 欄型別', /`id` INT/.test(ct))
check('decimal 欄型別', /`price` DECIMAL/.test(ct))
check('bool→TINYINT', /`ok` TINYINT\(1\)/.test(ct))
check('字串→VARCHAR', /`name` VARCHAR\(\d+\)/.test(ct))

const ctPg = generateCreateTable(parseTable('flag\ntrue'), { dialect: 'postgres' })
check('postgres bool→BOOLEAN', /BOOLEAN/.test(ctPg))
const ctLong = generateCreateTable(parseTable('txt\n' + 'x'.repeat(300)), { dialect: 'mysql' })
check('過長字串→TEXT', /TEXT/.test(ctLong))

// --- generateSQL ---
const full = generateSQL(parseTable('id\n1'), { tableName: 't', createTable: true })
check('合併輸出含 CREATE 與 INSERT', full.includes('CREATE TABLE') && full.includes('INSERT INTO'))
check('不含 CREATE 時只有 INSERT', !generateSQL(parseTable('id\n1'), { tableName: 't' }).includes('CREATE TABLE'))

// --- 端到端:往返健全 ---
const e2e = generateSQL(parseTable('代號,金額,備註\nA001,1000,"含,逗號"\nB,,空'), {
  tableName: '訂單',
  dialect: 'postgres',
  createTable: true,
})
check('中文表名/欄名加雙引號', e2e.includes('"訂單"') && e2e.includes('"代號"'))
check('引號內逗號正確解析', e2e.includes("'含,逗號'"))
check('A001 前導非0但混字母→字串', e2e.includes("'A001'"))
check('空金額→NULL', /,\s*NULL,/.test(e2e))

console.log(fail === 0 ? `\n全部通過` : `\n${fail} 筆失敗`)
process.exit(fail === 0 ? 0 : 1)

/*
  SQL 格式化引擎回歸測試(node 直接跑)。
  執行:node scripts/test-sqlformat.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `sqlformat-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/sqlFormat.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { formatSql, minifySql, tokenizeSql } = await import('file://' + out)

let fail = 0
let pass = 0
function ok(c, msg) {
  if (c) pass++
  else {
    fail++
    console.error('✗ FAIL:', msg)
  }
}
function eq(input, expected, msg, opts) {
  const r = formatSql(input, opts)
  if (!r.ok) {
    fail++
    console.error(`✗ FAIL: ${msg} — 格式化失敗:${r.error}`)
    return
  }
  if (r.output === expected) pass++
  else {
    fail++
    console.error(`✗ FAIL: ${msg}\n--- got ---\n${r.output}\n--- want ---\n${expected}\n-----------`)
  }
}

// 顯著 token 序列(忽略空白與註解,關鍵字統一大寫)用於「不改動內容」的驗證
function sig(s) {
  return tokenizeSql(s)
    .filter((t) => t.t !== 'lc' && t.t !== 'bc')
    .map((t) => (t.t === 'word' ? t.v.toUpperCase() : t.v))
}
function sameSig(a, b) {
  const x = sig(a)
  const y = sig(b)
  if (x.length !== y.length) return false
  return x.every((v, i) => v === y[i])
}

// ---- 精確輸出 ----
eq('select 1', 'SELECT 1', 'simple select')
eq('select a,b from t', 'SELECT a,\n  b\nFROM t', 'select list breaks commas')
eq('  select   A , B   from   T  ', 'SELECT A,\n  B\nFROM T', 'whitespace normalised, idents preserved')
eq(
  'select * from a join b on a.id=b.id',
  'SELECT *\nFROM a\nJOIN b ON a.id = b.id',
  'join on new line, dotted ident glued',
)
eq(
  'select * from t where id in (select id from s)',
  'SELECT *\nFROM t\nWHERE id IN (\n  SELECT id\n  FROM s\n)',
  'subquery block paren',
)
eq(
  'select * from t where a between 1 and 10 and b=2',
  'SELECT *\nFROM t\nWHERE a BETWEEN 1 AND 10\n  AND b = 2',
  'between AND not broken, real AND broken',
)
eq(
  'create table t (id INT primary key, name VARCHAR(50))',
  'CREATE TABLE t (\n  id INT PRIMARY KEY,\n  name VARCHAR(50)\n)',
  'create table column block',
)
eq(
  "insert into users (id,name) values (1,'a'),(2,'b')",
  "INSERT INTO users(id, name)\nVALUES (1, 'a'),\n  (2, 'b')",
  'insert values',
)
eq(
  'update t set a=1,b=2 where id=3',
  'UPDATE t\nSET a = 1,\n  b = 2\nWHERE id = 3',
  'update set',
)
eq('delete from t where id=1', 'DELETE FROM t\nWHERE id = 1', 'delete from kept together')
eq(
  'select count(*) as n from t group by k order by n desc',
  'SELECT count(*) AS n\nFROM t\nGROUP BY k\nORDER BY n DESC',
  'group by / order by, function name kept as typed, no space before paren',
)

// ---- 大小寫選項 ----
eq('SELECT a FROM t', 'select a\nfrom t', 'lower case', { keywordCase: 'lower' })
eq('select a from t', 'select a\nfrom t', 'preserve keeps as typed', { keywordCase: 'preserve' })

// ---- 縮排選項 ----
eq('select a,b from t', 'SELECT a,\n    b\nFROM t', 'indent=4', { indent: 4 })

// ---- 字面內容絕不改動 ----
eq("select 'select from where' as c", "SELECT 'select from where' AS c", 'keyword inside string untouched')
ok(formatSql("select 'it''s ok'").output.includes("'it''s ok'"), '雙單引號跳脫保留')
ok(formatSql('select `from` from t').output.includes('`from`'), '反引號識別字保留')
ok(formatSql('select * from t -- 註解\nwhere id=1').output.includes('-- 註解'), '行註解保留')
ok(formatSql('select /* c */ a from t').output.includes('/* c */'), '區塊註解保留')

// ---- 冪等性:format(x) === format(format(x)) ----
const samples = [
  'select a, b, c from t where x=1 and y=2 order by a',
  'select * from t where id in (select id from s where flag=1) and n>0',
  'create table t (id INT primary key, name VARCHAR(50), age INT default 0)',
  "insert into u (a,b) values (1,'x'),(2,'y') returning id",
  'update t set a=1, b=2 where id between 1 and 9 or k is not null',
  'select u.id, count(*) as n from users u left join orders o on o.uid=u.id group by u.id having count(*)>1',
  'with cte as (select id from a) select * from cte join b on b.id=cte.id',
]
for (const s of samples) {
  const once = formatSql(s).output
  const twice = formatSql(once).output
  ok(once === twice, `idempotent: ${s.slice(0, 40)}…`)
  // 格式化後顯著 token 不變(不漏字、不改順序)
  ok(sameSig(s, once), `token preserved: ${s.slice(0, 40)}…`)
}

// ---- minify ----
{
  const r = minifySql("select  a , b\nfrom t\nwhere id = 1 -- c")
  ok(r.ok && r.output === 'SELECT a, b FROM t WHERE id = 1', 'minify removes comments & newlines')
  ok(minifySql("select 'a , b' from t").output === "SELECT 'a , b' FROM t", 'minify keeps string')
  // minify 後再 format,顯著 token 與原文一致
  ok(sameSig('select a,b from t where x in (1,2,3)', minifySql('select a,b from t where x in (1,2,3)').output), 'minify token preserved')
}

// ---- 多語句 ----
eq('select 1;select 2', 'SELECT 1;\n\nSELECT 2', 'two statements separated by blank line')

// ---- 錯誤處理 ----
ok(!formatSql("select 'unterminated").ok, '未結束字串應失敗')
ok(!formatSql('select /* open').ok, '未結束區塊註解應失敗')
ok(formatSql('').ok && formatSql('').output === '', '空字串 ok')
ok(formatSql('   ').output === '', '純空白 ok')

console.log(`\nSQL 格式化:${pass} 通過${fail ? `,${fail} 失敗` : ''}`)
if (fail) process.exit(1)

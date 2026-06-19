/*
  chmod 權限轉換引擎回歸測試(node 直接跑)。
  執行:node scripts/test-chmod.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `chmod-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/chmod.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const {
  parseOctal,
  permsToOctal,
  permsToSymbolic,
  parseSymbolic,
  describe,
  describeSpecial,
} = await import('file://' + out)

let fail = 0
let pass = 0
function eq(a, b, msg) {
  if (a === b) pass++
  else {
    fail++
    console.error(`✗ FAIL: ${msg} — got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`)
  }
}
function ok(c, msg) {
  if (c) pass++
  else {
    fail++
    console.error('✗ FAIL:', msg)
  }
}

// octal -> symbolic 已知對照
const cases = [
  ['755', 'rwxr-xr-x'],
  ['644', 'rw-r--r--'],
  ['777', 'rwxrwxrwx'],
  ['000', '---------'],
  ['700', 'rwx------'],
  ['600', 'rw-------'],
  ['4755', 'rwsr-xr-x'], // setuid + owner exec
  ['2755', 'rwxr-sr-x'], // setgid + group exec
  ['1755', 'rwxr-xr-t'], // sticky + other exec
  ['4655', 'rwSr-xr-x'], // setuid but no owner exec -> S
  ['2745', 'rwxr-Sr-x'], // setgid but no group exec -> S
  ['1754', 'rwxr-xr-T'], // sticky but no other exec -> T
  ['7777', 'rwsrwsrwt'], // all special + all exec
  ['7666', 'rwSrwSrwT'], // all special, no exec -> all caps
]
for (const [oct, sym] of cases) {
  const r = parseOctal(oct)
  ok(r.ok, `parseOctal ${oct} ok`)
  eq(permsToSymbolic(r.perms), sym, `octal ${oct} -> symbolic`)
}

// symbolic -> octal 反向(往返一致)
for (const [oct, sym] of cases) {
  const r = parseSymbolic(sym)
  ok(r.ok, `parseSymbolic ${sym} ok`)
  // permsToOctal 預設省略無特殊位元的首零
  const expected = oct.length === 4 && oct[0] === '0' ? oct.slice(1) : oct
  const got = permsToOctal(r.perms)
  // 對於有特殊位元的(首位非 0)應保留 4 位;否則 3 位
  if (oct[0] !== '0' && oct.length === 4) {
    eq(got, oct, `symbolic ${sym} -> octal ${oct}`)
  } else {
    eq(got, expected.length === 4 ? expected.slice(1) : expected, `symbolic ${sym} -> octal`)
  }
}

// permsToOctal: 3 位無特殊、4 位有特殊
eq(permsToOctal(parseOctal('755').perms), '755', 'permsToOctal 755 -> 3 digit')
eq(permsToOctal(parseOctal('4755').perms), '4755', 'permsToOctal 4755 -> 4 digit')
eq(permsToOctal(parseOctal('755').perms, false), '0755', 'permsToOctal keep leading zero')

// parseOctal 接受 3 位(補零)
eq(parseOctal('644').perms.special, 0, '644 special 0')
eq(parseOctal('644').perms.owner, 6, '644 owner 6')

// parseOctal 錯誤
ok(!parseOctal('').ok, 'empty invalid')
ok(!parseOctal('88').ok, 'non-octal digit invalid')
ok(!parseOctal('7').ok, 'too short invalid')
ok(!parseOctal('12345').ok, 'too long invalid')
ok(!parseOctal('999').ok, '999 invalid')
ok(parseOctal('0o755').ok, '0o prefix accepted')

// parseSymbolic 錯誤與容錯
ok(!parseSymbolic('rwxr-xr').ok, 'short symbolic invalid')
ok(!parseSymbolic('rwxr-xr-xx').ok, '10 char with bad lead invalid type? -> slices to 9') // 10 -> slice(1)
ok(!parseSymbolic('zzzr-xr-x').ok, 'invalid chars')
// ls -l style 10-char with leading type char
{
  const r = parseSymbolic('-rwxr-xr-x')
  ok(r.ok, 'leading type char stripped')
  eq(permsToOctal(r.perms), '755', '-rwxr-xr-x -> 755')
}
{
  const r = parseSymbolic('drwxr-xr-x')
  ok(r.ok, 'directory leading d ok')
  eq(permsToOctal(r.perms), '755', 'drwxr-xr-x -> 755')
}

// describe
{
  const d = describe(parseOctal('755').perms)
  eq(d.length, 3, 'describe 3 roles')
  eq(d[0].can, '讀取 / 寫入 / 執行', 'owner rwx desc')
  eq(d[2].can, '讀取 / — / 執行', 'other r-x desc')
}

// describeSpecial
eq(describeSpecial(parseOctal('755').perms).length, 0, 'no special -> empty')
eq(describeSpecial(parseOctal('4755').perms).length, 1, 'setuid -> 1 line')
ok(describeSpecial(parseOctal('4755').perms)[0].includes('setuid'), 'setuid text')
eq(describeSpecial(parseOctal('7755').perms).length, 3, 'all special -> 3 lines')

console.log(`\nchmod: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)

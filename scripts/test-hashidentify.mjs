/*
  雜湊類型識別引擎回歸測試(node 直接跑)。
  執行:node scripts/test-hashidentify.mjs
  oracle(各演算法的長度/字元集/前綴格式定義 + 公認範例值):
   1) 純十六進位長度對應:32→MD5、40→SHA-1、64→SHA-256、96→SHA-384、128→SHA-512、8→CRC-32。
   2) 有結構的密碼雜湊格式:bcrypt $2a$、md5crypt $1$、sha512crypt $6$、Argon2id、LDAP {SSHA}、MySQL *。
   3) charset 偵測(hex / base64 / other)、base64 解碼位元組長度、空字串、非雜湊字串。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `hashidentify-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/hashIdentify.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { identifyHash, base64ByteLength } = await import('file://' + out)

let pass = 0
let fail = 0
function ok(name, cond) {
  if (cond) pass++
  else {
    fail++
    console.error('✗', name)
  }
}
const top = (s) => identifyHash(s).candidates[0]?.name ?? ''
const names = (s) => identifyHash(s).candidates.map((c) => c.name)

// 1) 十六進位長度對應
ok('MD5 (32 hex)', top('5d41402abc4b2a76b9719d911017c592') === 'MD5')
ok('MD5 候選含 NTLM', names('5d41402abc4b2a76b9719d911017c592').includes('NTLM'))
ok('SHA-1 (40 hex)', top('aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d') === 'SHA-1')
ok('SHA-224 (56 hex)', top('d14a028c2a3a2bc9476102bb288234c415a2b01f828ea62ac5b3e42f') === 'SHA-224')
ok(
  'SHA-256 (64 hex)',
  top('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855') === 'SHA-256',
)
ok(
  'SHA-384 (96 hex)',
  top('38b060a751ac96384cd9327eb1b1e36a21fdb71114be07434c0cc7bf63f6e1da274edebfe76f65fbd51ad2f14898b95b') === 'SHA-384',
)
ok(
  'SHA-512 (128 hex)',
  top(
    'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e',
  ) === 'SHA-512',
)
ok('CRC-32 (8 hex)', top('414fa339') === 'CRC-32')
ok('未知長度 hex (低信心)', identifyHash('abcd').candidates[0]?.confidence === 'low')

// 2) 有結構的密碼雜湊格式
ok('bcrypt $2a$', top('$2a$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW') === 'bcrypt')
ok('bcrypt $2b$', top('$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy') === 'bcrypt')
ok('md5crypt $1$', top('$1$O3JMY.Tw$AdLnLjQ/5jXF9.MTp3gHv/') === 'md5crypt')
ok('sha512crypt $6$', top('$6$rounds=5000$usesomesillyname$svn8UoSVapNtMuq1ukKS4tPQd8iKwSMHWjl/O817G3uBnIFNjnQJuesI68u4OTLiBFdcbYEdFCoEOfaBhO3UO.').startsWith('sha512crypt'))
ok('sha256crypt $5$', top('$5$rounds=80000$wnsT7Yr92oJoP28r$cKhJImk5mfuSKV9b3mumNzlbstFUplKtQXXMo4G6Ep5') === 'sha256crypt')
ok('Argon2id', top('$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQ$RdescudvJCsgt3ub+b+dWRWJTmaaJObG') === 'Argon2id')
ok('Argon2i', top('$argon2i$v=19$m=4096,t=3,p=1$c29tZXNhbHQ$aaaaaaaaaaaaaaaaaaaaaa') === 'Argon2i')
ok('LDAP {SSHA}', top('{SSHA}DkMTwBl+a/3DQVZYzPbZF5lOQzwWFKkS') === 'SSHA (salted SHA-1)')
ok('MySQL 4.1+ *', top('*23AE809DDACAF96AF0FD78ED04B6A265E05AA257') === 'MySQL 4.1+ (SHA-1 雙重)')
ok('scrypt $scrypt$', top('$scrypt$ln=16,r=8,p=1$c29tZXNhbHQ$dGVzdA') === 'scrypt')

// 3) charset / base64 / 邊界
ok('charset hex', identifyHash('5d41402abc4b2a76b9719d911017c592').charset === 'hex')
ok('charset other (有 g)', identifyHash('zzzz此非雜湊').charset === 'other')
ok('空字串 → 無候選', identifyHash('').candidates.length === 0)
ok('空字串 length 0', identifyHash('  ').length === 0)
ok('base64 SHA-1 長度 20 bytes', base64ByteLength('DkMTwBl+a/3DQVZYzPbZF5lOQzw=') === 20)
ok('base64 "QQ==" → 1 byte', base64ByteLength('QQ==') === 1)
ok('base64 "QUJD" → 3 bytes', base64ByteLength('QUJD') === 3)
ok('NTLM 大寫 32 hex 仍判 MD5/NTLM', names('B4B9B02E6F09A9BD760F388B67351E2B').includes('NTLM'))

console.log(`\n雜湊類型識別:${pass} 通過,${fail} 失敗`)
if (fail) process.exit(1)

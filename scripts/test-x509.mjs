/*
  X.509 憑證解讀引擎的回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-x509.mjs
  oracle:以 openssl 產生的一張固定自簽憑證(EC P-256、序號 0x1234、含 SAN)為樣本,
  逐欄比對解析結果是否與 openssl x509 -text 一致。憑證 PEM 內嵌為常數,測試自足、不依賴 openssl。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `x509-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/x509.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { parseCertificate } = await import('file://' + out)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else { fail++; console.error(`✗ ${note}`) }
}

const PEM = `-----BEGIN CERTIFICATE-----
MIICBTCCAaugAwIBAgICEjQwCgYIKoZIzj0EAwIwPjELMAkGA1UEBhMCVFcxFTAT
BgNVBAoMDFRvb2xIdWIgVGVzdDEYMBYGA1UEAwwPdG9vbGh1Yi5leGFtcGxlMB4X
DTI2MDYyMTExMzcwOFoXDTM2MDYxODExMzcwOFowPjELMAkGA1UEBhMCVFcxFTAT
BgNVBAoMDFRvb2xIdWIgVGVzdDEYMBYGA1UEAwwPdG9vbGh1Yi5leGFtcGxlMFkw
EwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEOgRR2JDFMVqg1g3qSEHjIrmV6gJhGnPM
6x5FEKSnB5n0OJKvHQd3qcVKmd5bXUI51hi4hlpbb4n7FdkcuSJFs6OBmDCBlTAd
BgNVHQ4EFgQUXPk8E3ejm4l359/qlJ17xpqPD5EwHwYDVR0jBBgwFoAUXPk8E3ej
m4l359/qlJ17xpqPD5EwDwYDVR0TAQH/BAUwAwEB/zBCBgNVHREEOzA5gg90b29s
aHViLmV4YW1wbGWCE3d3dy50b29saHViLmV4YW1wbGWBEWFAdG9vbGh1Yi5leGFt
cGxlMAoGCCqGSM49BAMCA0gAMEUCIQC4QQcfbRPOkdGm/uDp8XIKwOkDA+eDbma8
Huuo2XhtDAIgG9+M4Q4Vu1kTgz1FQLu9cOUQAW6HX4ELK7lz5YNoYA4=
-----END CERTIFICATE-----`

const b64 = PEM.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')
const bytes = new Uint8Array(Buffer.from(b64, 'base64'))
const c = parseCertificate(bytes)

check('無解析錯誤', !c.error)
check('版本 v3', c.version === 3)
check('序號 0x1234', c.serialHex.toLowerCase() === '1234')
check('簽章演算法 ecdsaWithSHA256', c.signatureAlgorithm === 'ecdsaWithSHA256')
check('subject DN', c.subject.text === 'C=TW, O=ToolHub Test, CN=toolhub.example')
check('issuer DN', c.issuer.text === 'C=TW, O=ToolHub Test, CN=toolhub.example')
check('自簽偵測', c.selfSigned === true)
check('subject 屬性數', c.subject.attrs.length === 3)
check('subject CN 值', c.subject.attrs.find((a) => a.label === 'CN').value === 'toolhub.example')
check('notBefore', c.notBefore === '2026-06-21 11:37:08 UTC')
check('notAfter', c.notAfter === '2036-06-18 11:37:08 UTC')
check('notBeforeMs = UTC', c.notBeforeMs === Date.UTC(2026, 5, 21, 11, 37, 8))
check('公鑰演算法 ecPublicKey', c.publicKeyAlgorithm === 'ecPublicKey')
check('公鑰曲線 P-256', c.publicKeyDetail.includes('P-256'))
check('SAN DNS', c.sans.includes('DNS:toolhub.example') && c.sans.includes('DNS:www.toolhub.example'))
check('SAN email', c.sans.includes('email:a@toolhub.example'))
check('SAN 數量', c.sans.length === 3)
check('含 basicConstraints 擴充', c.extensions.some((e) => e.name === 'basicConstraints'))
check('basicConstraints CA 是', c.extensions.find((e) => e.name === 'basicConstraints').detail.includes('CA: 是'))
check('含 subjectAltName 擴充', c.extensions.some((e) => e.name === 'subjectAltName'))
check('含 subjectKeyIdentifier 擴充', c.extensions.some((e) => e.name === 'subjectKeyIdentifier'))
check('basicConstraints 為 critical', c.extensions.find((e) => e.name === 'basicConstraints').critical === true)

// 錯誤路徑:非憑證(單一 INTEGER)
const bad = parseCertificate(Uint8Array.from([0x02, 0x01, 0x05]))
check('非憑證回報錯誤', !!bad.error)

if (fail) { console.error(`\n${fail} 項測試失敗`); process.exit(1) }
else console.log('\n所有 X.509 憑證解讀測試通過')

# ROADMAP — ToolHub

> 自主開發的待辦與已完成清單,跨 session 接力用。完成一項就移到「已完成」並標日期。

## 已完成
- 骨架(Vue3+TS+Vite+Tailwind v4)、單一事實來源 tools.config、動態路由
- 工具(22 個):可疑網址檢查器、詐騙簡訊檢查、常見詐騙手法圖鑑、資遣費、特休、加班費、貸款試算、定存複利、勞退自提、勞保老年年金、分期APR、綜所稅速算、二代健保、BMI、TDEE、油錢試算、旅費分帳、單位換算、預產期、發票對獎、民國年
- 防詐騙下載中心(30 軟體 10 分類)+ 版本自動更新 Action + NetworkFirst
- 關鍵字導引、PWA、GitHub Pages 部署、每頁 SEO meta + OG
- 長輩友善:字級放大切換(A− / A / A+,存 localStorage)— 2026-06-15
- 深化防詐騙:詐騙簡訊話術辨識(sms-check,複用 linkcheck)— 2026-06-15
- 新增分期實際利率 APR、油錢試算、TDEE — 2026-06-15
- 新增勞保老年年金試算(兩式擇優 + 提前/延後)— 2026-06-15
- 強化 linkcheck:危險協定攔截、官方網域當幌子偵測、擴充品牌庫(回歸測試 23 筆)— 2026-06-15
- 新增常見詐騙手法圖鑑(10 類話術/破綻/應對)— 2026-06-15

## 已完成(續)
- 新增請假扣薪試算、年齡計算(實歲/虛歲/保險年齡)— 2026-06-15
- Signal/Git/Python 加入 GitHub 版本自動更新 — 2026-06-15
- 下載中心:軟體搜尋 + 資料暫缺容錯狀態 — 2026-06-15
- 修正首頁搜尋「LINE 下載」未導向下載中心的問題(虛擬可搜尋項目)— 2026-06-15
- 無障礙:鍵盤 focus-visible 焦點框、prefers-reduced-motion、跳至主要內容 — 2026-06-15

## 處理工坊(2026-06 新方向:純前端、不上傳、無廣告、無浮水印、可批次)
- Unicode 正規化 / 比對(unicode-normalize,category=workshop):解決「兩段文字看起來一樣卻不相等」——
  同一個字可能是單一碼點(é)或基底字＋組合符號(e+◌́),全形/半形與相容字(① ﬁ ㎏)也會讓比對失敗。
  正規化模式給 NFC/NFD/NFKC/NFKD 四種形式(各標碼點/碼元數、是否改變);比對模式判斷兩段文字在哪種形式下
  才相等並指出第一個差異碼點;順手統計組合符/全形/零寬字元。引擎 src/features/unicodeNormalize.ts
  (normalizeAll/listCodePoints 正確處理代理對/analyzeText/compareStrings 純函式無 DOM)+ 回歸測試
  scripts/test-unicodenormalize.mjs(35 筆:é 合成分解、NFKC 相容字 Ａ①ﬁ㎏→A1fikg、碼點清單與 emoji 代理對、
  組合符/全形/零寬統計、比對各情形與差異定位,併入 npm test)。與 text-clean、char-inspect 互補;
  零相依、不上傳;type-check + 全測試 + build 通過 — 2026-06-19
- JWT 簽發 / 產生(jwt-sign,category=workshop):補上「jwt-decode 只能解碼/驗證」的反向能力 —— 在本機用密鑰
  簽出 HS256/384/512 的 JSON Web Token(測 API、後端串接、重現過期/尚未生效情境)。可勾選自動補 iat / nbf(=現在)
  與 exp(分鐘/小時/天後,自動換算 Unix 秒),即時預覽「實際簽入的內容」並三段彩色顯示 token。安全主張同 jwt-decode:
  簽發需密鑰、持有者即可偽造任何憑證,絕不該貼到 jwt.io 等線上產生器;全程瀏覽器、不連網、不上傳;僅對稱式 HMAC。
  引擎沿用並擴充 src/features/jwt.ts(新增 encodeSegment/buildHeader/signingInput/applyTimeClaims 純函式 +
  signJwt 用 crypto.subtle;export 既有 bytesToBase64Url 共用)+ 回歸測試 scripts/test-jwtsign.mjs(39 筆:
  jwt.io 官方 HS256 向量逐字、buildHeader/encodeSegment/signingInput、4 組 payload×演算法與 Node crypto 交叉、
  與同檔 verifyHmac 簽發→驗證往返且錯誤密鑰應失敗、decodeJwt 解回 payload/alg、applyTimeClaims iat/exp/nbf/
  取整/不動原物件,併入 npm test)。與 jwt-decode、hmac 互補;零相依、不上傳;type-check + 全測試 + build 通過 — 2026-06-20
- JSON 修復 / 寬鬆解析(json-repair,category=workshop):以小型遞迴下降解析器容忍常見不嚴謹 JSON 並還原
  成標準 JSON —— 單引號、未加引號的物件鍵、結尾多餘逗號、// 與 /* */ 註解、Python None/True/False、
  十六進位與底線數字、各種跳脫;NaN/Infinity/undefined 轉 null 確保輸出合法。結構嚴重損壞誠實報錯不亂修;
  可輸出美化或單行。整理 LLM 輸出、JS 物件、log 片段最好用。引擎 src/features/jsonRepair.ts
  (Parser 類別 skip/value/object/key/array/string/number/literal + sanitize + repairJson 純函式無 DOM)
  + 回歸測試 scripts/test-jsonrepair.mjs(43 筆:標準不變/單引號/未加引號鍵含特殊字元/各層結尾逗號/
  行區塊開頭註解/Python 字面量/NaN 與 Infinity/hex 與底線與前導點數字/跳脫含 unicode/kitchen sink/深巢狀/
  輸出格式/6 種錯誤/與 JSON.parse 對拍,併入 npm test)。與 json-to-ts、json-schema 互補;
  零相依、不上傳;type-check + 全測試 + build 通過 — 2026-06-19
- Markdown 目錄產生器(markdown-toc,category=workshop):從 Markdown 標題自動產生帶錨點連結的目錄(TOC),
  錨點對齊 github-slugger(先去標點、每個空白逐一換連字號、保留中日韓與底線、重複標題加 -1/-2)貼到
  GitHub 可正確跳轉。略過圍欄程式碼區塊內的 #(``` 與 ~~~)、處理標題行內粗體/連結/行內碼、要求 # 後有空白;
  可選有序/無序清單、限定收錄層級(如只收 H2–H3)、相對最小層級縮排。引擎 src/features/markdownToc.ts
  (stripInline/githubSlug/dedupeSlug/parseHeadings/buildToc 純函式無 DOM)+ 回歸測試 scripts/test-markdowntoc.mjs
  (41 筆:行內去除/slug 標點與 CJK 與底線保留與 C++→c--c 邊界/重複序號/兩種圍欄略過/尾端 #/需空白/
  相對縮排/有序/層級過濾/空,併入 npm test)。與 markdown-preview、markdown-table 互補;
  零相依、不上傳;type-check + 全測試 + build 通過 — 2026-06-19
- HMAC / Webhook 簽章驗證(hmac,category=workshop):用密鑰對訊息算 HMAC-SHA1/256/512(輸出十六進位
  + Base64),驗證 webhook 是否真來自服務方(GitHub X-Hub-Signature-256 / Stripe / LINE Messaging API)。
  可貼收到的簽章定時比對(safeEqualHex 常數時間、大小寫不敏感、自動忽略 sha256= 前綴)。引擎
  src/features/hmacText.ts(bytesToBase64 純函式、hmacBytes/hmacHex/hmacBase64 用 crypto.subtle、safeEqualHex;
  複用 hashText 的 bytesToHex/utf8Bytes)+ 回歸測試 scripts/test-hmactext.mjs(46 筆:base64 已知值、
  RFC 2202 HMAC-SHA1 與 RFC 4231 HMAC-SHA256 官方向量、15 組訊息×演算法與 Node crypto 交叉驗證含中文/空/
  超過 block size 金鑰、safeEqualHex,併入 npm test)。與 text-hash(無密鑰雜湊)互補;
  零相依、不上傳;type-check + 全測試 + build 通過 — 2026-06-19
- TOTP 兩步驟驗證碼產生器(totp,category=workshop):輸入 2FA 設定金鑰(base32)或 otpauth:// 連結,
  在本機即時算出當下一次性驗證碼與倒數秒數(RFC 6238,等同 Google Authenticator/Authy),可選 6/7/8 位、
  30/60 秒週期、SHA-1/256/512。貼上 otpauth:// 自動帶入參數;每秒刷新進度條(≤5 秒轉紅)、點數字複製。
  契合「只有本系統能乾淨+離線達成」DNA:密鑰是高敏資訊,絕不該貼到一般網站,強調不連網/不上傳/不儲存。
  引擎 src/features/totp.ts(base32Decode RFC4648/counterToBytes 大端 8 byte/truncate RFC4226 動態截斷/
  hotp/totp/parseOtpauth;HMAC 用 crypto.subtle,瀏覽器與 Node 22 皆有)+ 回歸測試 scripts/test-totp.mjs
  (45 筆:base32 已知值與容錯、RFC 4226 HOTP counter 0–9 全部官方向量、RFC 6238 TOTP SHA1 六組與 SHA256
  官方向量交叉驗證、remaining/counter、6 位預設、parseOtpauth 解析與拒絕 hotp/缺 secret,併入 npm test)。
  零相依、不上傳;type-check + 全測試 + build 通過 — 2026-06-19
- JSON Schema 產生器(json-schema,category=workshop):貼上範例 JSON 推斷出 JSON Schema(draft-07)。
  陣列合併所有元素結構;物件陣列裡只有部分樣本才有的鍵自動從 required 移除(取交集);integer+number
  推成 number;不同型別合成 anyOf(攤平去重);可選偵測 email/date/date-time/uri/uuid 字串格式;可複製/下載 .json。
  引擎 src/features/jsonSchema.ts(jsonType/detectStringFormat/inferSchema/mergeSchemas/mergeTwo/buildSchema/
  generate 純函式無 DOM)+ 回歸測試 scripts/test-jsonschema.mjs(29 筆:各基本型別/格式偵測開關/物件 required
  與 requireAll 開關/空與同型別與混型別陣列/物件陣列 required 交集/巢狀/mergeSchemas 直接測/anyOf 攤平去重/
  $schema 標頭/generate 解析錯誤/頂層純陣列,併入 npm test)。與 json-to-ts(TS 型別)互補;
  零相依、不上傳;type-check + 全測試 + build 通過 — 2026-06-19
- chmod 權限計算機(chmod-calc,category=workshop):把 Unix 檔案權限的八進位(755)與符號(rwxr-xr-x)
  雙向對照,核取方塊勾選每個身分(u/g/o)的讀/寫/執行即時換算出 chmod 數字與指令,支援 setuid/setgid/sticky
  特殊位元(s/S/t/T 大小寫依該位執行與否)並附白話說明與風險。常見權限(644/755/600/777/700)一鍵帶入。
  引擎 src/features/chmod.ts(parseOctal 接受 3/4 位與 0o 前綴、permsToOctal 省略無特殊位首零、
  permsToSymbolic/parseSymbolic 容許 ls -l 開頭類型字元/describe/describeSpecial 純函式無 DOM)+ 回歸測試
  scripts/test-chmod.mjs(81 筆:14 組八進位↔符號已知對照與往返、特殊位元大小寫、錯誤處理、ls -l 10 字元、
  白話說明,併入 npm test)。零相依、不上傳;type-check + 全測試 + build 通過 — 2026-06-19
- CIDR / 子網計算機(cidr-calc,category=workshop):輸入 IPv4 CIDR(192.168.1.10/24)算出網路位址、
  廣播位址、可用主機範圍、子網路遮罩、萬用遮罩、可用/總位址數,並判斷私有位址(RFC 1918)與 A/B/C 等級。
  支援 /n、純位址(預設 /32)、遮罩寫法(192.168.1.0 255.255.255.0)三種輸入;正確處理 /31 點對點
  (RFC 3021 兩端皆可用)與 /32 單一位址、拒絕非連續遮罩(255.0.255.0)。引擎 src/features/cidr.ts
  (parseIPv4 擋前導零/越界、octetsToInt/intToIp/ipToInt/parseCidr/prefixToMask/maskToPrefix/computeSubnet
  純函式無 DOM,32 位元無號運算)+ 回歸測試 scripts/test-cidr.mjs(78 筆:解析驗證/整數往返/遮罩往返/
  非連續遮罩拒絕/各字首子網實算/私有與等級判斷/邊界 /0 /16 /24 /30 /31 /32,併入 npm test)。
  設定路由器/防火牆/伺服器用;零相依、不上傳;type-check + 全測試 + build 通過 — 2026-06-19
- 文字雜湊值產生器(text-hash,category=workshop):把一段文字算出 MD5 / SHA-1 / SHA-256 / SHA-384 /
  SHA-512 / CRC32,即時重算、可大寫顯示、點一下複製。SHA 家族用 crypto.subtle;MD5 與 CRC32 瀏覽器
  Web Crypto 不提供,改以純函式實作(RFC 1321 MD5 with padding 邊界處理 + 64-bit 長度;IEEE 802.3 CRC32 查表)。
  引擎 src/features/hashText.ts(md5/md5Hex/crc32/crc32Hex/bytesToHex/utf8Bytes 純函式無 DOM)+ 回歸測試
  scripts/test-hashtext.mjs(25 筆:RFC 1321 全部已知向量、CRC32 已知檢查值 cbf43926、padding 邊界 54–120、
  中文 UTF-8、200 組亂數與 Node 內建 crypto 交叉驗證,併入 npm test)。明確標示 MD5/SHA-1 不安全、雜湊不可逆。
  與 file-checksum(檔案雜湊+比對官方校驗碼)互補。零相依、不上傳;type-check + 全測試 + build 通過 — 2026-06-19
- Hex 檢視器(hex-view,category=workshop):把檔案或文字攤開成「位移 + 十六進位 + ASCII」三欄
  (像 xxd / hexdump),看清檔頭魔術位元組、編碼、夾帶內容;三模式 —— 讀取檔案(只讀前 256KB、
  maxBytes 截斷保護)、貼上文字(UTF-8 編碼後看位元組)、十六進位還原(parseHex 容許空白/換行/0x/逗號,
  奇數位數或非 hex 報錯,並還原成 UTF-8 文字)。每列位元組數(8/16/32)與大小寫可調,結果可複製/下載 .txt。
  引擎 src/features/hexView.ts(byteToHex/offsetToHex/byteToAscii/hexDump 排版補空白對齊+分組空白/
  dumpToText/textToBytes/parseHex 純函式無 DOM)+ 回歸測試 scripts/test-hexview.mjs(52 筆:各轉換/
  16 與 17 位元組換列/分組/大小寫/自訂每列/maxBytes 截斷/空輸入/parseHex 容錯與往返/中文 UTF-8,併入 npm test)。
  與 file-type(魔術位元組判型)、char-inspect(碼點)互補。零相依、不上傳;type-check + 全測試 + build 通過 — 2026-06-19
- CSS 漸層產生器(gradient-maker,category=workshop):視覺化調出線性/放射/圓錐漸層,多色標、角度、
  圓心位置即時預覽,一鍵複製可直接用的 CSS;補齊色彩工坊系列(色碼互轉/色階/對比/色盲)缺的漸層需求。
  引擎 src/features/gradientMaker.ts 純函式(stopsToString 依位置排序+位置夾 0–100+四捨五入、buildGradient
  三型別與角度正規化、buildCSS、distributeStops 均勻分布、reverseStops 鏡射),不依賴 DOM 故可 Node 測。
  回歸測試 scripts/test-gradientmaker.mjs(17 筆:排序/夾值/角度正規化含負值與>360/三種漸層字串/分布/反轉,
  併入 npm test)。零新相依;type-check + 全測試 + build 通過 — 2026-06-19
- 社群文字卡 / 語錄圖(text-card,category=workshop):把一段文字做成漂亮的圖片卡片(IG 貼文/限動、
  Threads、FB、公告、金句),取代開 Canva 做圖。Canvas 繪製:漸層/純色背景、黑/明體、置中/靠左、留白、
  粗體、文字色依背景亮度自動擇黑白;尺寸預設 1:1/4:5/9:16/16:9/3:4 對應各社群版位,輸出 1080~1920px PNG,
  可下載或複製到剪貼簿。排版邏輯抽到 src/features/textCard.ts 純函式(isCJK/tokenize/wrapParagraph/wrapText/
  fitFontSize),中英混排自動斷行(CJK 逐字、英數整詞、超長字硬切、行首空白去除、保留明確換行)+ 自動字級
  以二分搜尋在文字框內擇最大可填入字級;不依賴 DOM 故可 Node 測。回歸測試 scripts/test-textcard.mjs
  (19 筆:isCJK/tokenize/英數與 CJK 斷行/硬切/換行/空行/自動字級擇優與邊界,以「每字固定寬」假 measure,
  併入 npm test)。零新相依;type-check + 全測試 + build 通過 — 2026-06-19
- 圖片工坊(image-studio):批次轉檔/壓縮/縮放,canvas 處理、去 EXIF — 2026-06-15
- HEIC 轉 JPG/PNG(heic-convert):iPhone .heic 在 Windows/舊機/網站常打不開,免費線上站要上傳私密照片;
  heic2any(libheif WASM)在瀏覽器內解碼、不上傳,支援拖放/批次/品質/最長邊縮放,多影像 HEIC 取第一張,
  重編碼自動去 EXIF。heic2any ~1.3MB 動態 import + heic-vendor chunk + globIgnores 不預快取(precache 仍 390KB)— 2026-06-15
- PDF 工坊(pdf-studio):合併、整理頁面(刪頁/重排/擷取)、圖片↔PDF — 2026-06-15
  - pdf-lib(合併/組頁/圖轉PDF)+ pdfjs-dist(渲染);PDF 函式庫拆 pdf-vendor chunk 不預快取(PWA 預快取 1163KB→281KB,改 runtime StaleWhileRevalidate)
  - 新增「PDF 浮水印」分頁(Watermark.vue):每頁斜向重複加註用途(防盜用,與 image-watermark 互補,但對象是 PDF 文件);
    因 pdf-lib 內建字型不含中文,改用 canvas 把浮水印畫成透明 PNG 再蓋上每頁(支援中文),相同尺寸頁面共用嵌入圖省檔案;
    顏色/密度/透明度/字級/角度可調,常見用途一鍵帶入;零新相依(複用既有 pdf-lib)— 2026-06-15

- 資料轉換工坊(data-convert):CSV ↔ JSON 互轉,自製解析器處理引號/換行,零相依 — 2026-06-15
  - 升級:加入 Excel(.xlsx)三方互轉(CSV/JSON/Excel),from→to 格式選擇 UI,
    統一以物件陣列為中介;SheetJS 動態 import + sheet-vendor chunk(424KB)不預快取 — 2026-06-15
- ZIP 工坊(zip-studio,category=workshop):把多個檔案/資料夾打包成一個 .zip 好寄出/上傳,
  或把收到的 .zip 在本機解開、逐檔檢視與下載。線上壓縮/解壓站要把可能含機密的檔案上傳到別人伺服器、
  滿廣告又限大小/檔數;本工具用 JSZip(純 JS + pako,無 WASM、不連網)全程在瀏覽器處理、不上傳。
  壓縮三段強度(STORE/標準/最大)、檔名可改(含 / 建資料夾)、同名自動加序號不覆蓋、顯示壓縮比;
  解壓列出全部項目逐檔下載。引擎 src/features/zipStudio.ts(buildZip/readZip/normalizeName 純位元組進出、
  與環境無關故可 Node 測,normalizeName 擋 .. 跳脫)+ 回歸測試 scripts/test-zipstudio.mjs(17 筆:來回一致、
  中文/二進位、同名改名、STORE vs DEFLATE、非 ZIP 報錯,以 esbuild 打包含 jszip 後跑,併入 npm test)。
  JSZip 動態 import + zip-vendor chunk(gzip 45KB)不預快取;不支援密碼加密 ZIP(引導用 secure-box)。
  type-check + test(全 162 筆)+ build 通過 — 2026-06-16拖曳框選塗黑/馬賽克,真的把像素燒掉、不上傳,分享截圖前遮個資 — 2026-06-15
- 表格清理工坊(table-clean,category=workshop):貼上 CSV/TSV(或從 Excel/Google 試算表複製整塊貼上),
  做去空白、刪空白列、去重複(整列或指定欄、可忽略大小寫)、篩選(包含/等於/開頭/數值大小/空白等 10 種運算子)、
  排序(文字 localeCompare 繁中、或當數字排且非數值排最後、穩定排序)、選欄,再匯出 CSV/JSON。管線固定順序
  trim→刪空→去重→篩選→排序→選欄。與 data-convert(格式互轉)、list-compare(兩份清單比對)互補。
  含個資的名單全程瀏覽器處理、不上傳(線上 CSV 清理站都要上傳)。引擎 src/features/tableClean.ts
  (純函式無 DOM,複用 data-convert 的 parseCSV/rowsToCSV,以第一列定欄數補齊/裁切短長列、數值比較吃千分位逗號)
  + 回歸測試 scripts/test-tableclean.mjs(43 筆:解析/TSV/引號/補齊裁切/各清理動作/篩選 10 運算子/數值與穩定排序/
  選欄越界/序列化/端到端管線,併入 npm test)。零新相依;type-check + 全測試 + build 通過 — 2026-06-17
- 亂碼修復(mojibake-fix,category=workshop):修復最常見且可還原的一類亂碼 —— 原文是 UTF-8 卻被當成
  西歐編碼(Latin-1 / Windows-1252)讀,導致「中文」變 ä¸­æ–‡、é 變 Ã©、彎引號變 â€™。做法:把畫面上的
  亂碼字元逆推回原始位元組(0x00–0xFF 直接對應 + Windows-1252 在 0x80–0x9F 的可見特殊字反查表),
  再用 TextDecoder('utf-8',{fatal}) 重新解讀;以「亂碼嫌疑分數」是否下降決定是否接受,最多 5 輪
  (處理雙重/三重亂碼),且偵測到「修了反而更糟」會自動保持原狀不破壞正常文字。誠實揭露限制:含 �(U+FFFD)
  代表位元組已遺失不可還原、Big5 被當 UTF-8 的反向亂碼也無法救。引擎 src/features/mojibake.ts
  (reencodeToBytes/fixOnce/suspicionScore/fixMojibake 純函式無 DOM)+ 回歸測試 scripts/test-mojibake.mjs
  (26 筆:歐語符號/中文/中英混合/emoji/雙重亂碼/正常文字不破壞/逆推與分數,以 latin1 還原程序產生樣本,
  併入 npm test)。零三方相依、不上傳;type-check + 全測試 + build 通過 — 2026-06-17
- 金額大寫互轉升級:num-to-chinese 新增「中文數字 → 阿拉伯數字」反向模式(模式切換分頁),
  讀支票/合約大寫或老文件時核對。引擎 amountChinese.ts 新增 chineseToNumber:加性解析器
  (個位 number、小單位十百千/拾佰仟、大單位萬億兆分節結算 total/section/number),支援大寫與一般、
  兩=2、〇/零、簡體 万亿、阿拉伯混用(5萬)、小數「點/点」逐字串接;無法辨識字/多個小數點回錯誤。
  回歸測試 test-amountchinese.mjs +26 筆(十/二十三/一百零五/兩百零五/億萬完整 123456789/兆/混用/小數/
  錯誤處理/與正向 amountToChinese 來回一致),併入既有 npm test。零新相依;type-check + 全測試 + build 通過 — 2026-06-17
- CSV ↔ Markdown 表格(markdown-table,category=workshop):把 CSV/Excel 表格轉成 GitHub/Notion 風格的
  Markdown 表格(依顯示寬度對齊、CJK 全形算 2 格),或把 Markdown 表格轉回 CSV。寫 README/issue/Notion/HackMD
  時免手刻表格。儲存格內 | 自動逸出 \|、換行轉空白;可指定靠左/置中/靠右(分隔列 :--- / :--: / --:);
  解析容許有無外框管線、偵測對齊、短列補空長列裁切、找不到分隔列報錯。引擎 src/features/markdownTable.ts
  (displayWidth/tableToMarkdown/splitRow/markdownToTable 純函式無 DOM,複用 tableClean 的 Table)+ 回歸測試
  scripts/test-markdowntable.mjs(22 筆:行數/分隔列/逸出/換行/對齊/無外框/對齊偵測/還原/補裁/報錯/往返一致含中文,
  esbuild 多入口打包後跑,併入 npm test)。補足 data-convert 不含 Markdown 的缺口;不上傳;type-check + 全測試 + build 通過 — 2026-06-17
- 時間長度轉換(duration,category=workshop):在人話(1天2小時30分)、時鐘(mm:ss / hh:mm:ss)、
  ISO 8601 期間(PT1H30M、P1DT2H、P1W)、總秒/分/時之間互轉(影片時長、工時、計時、設定檔期間用)。
  parseDuration 依序試:純數字當秒 → 時鐘(冒號分段、末段可帶小數)→ ISO 8601(正則 W/D/T H/M/S 且至少一段非空)
  → 帶單位字串(parseUnits:中文長詞先換[小時/分鐘…]再單字[天/時/分/秒]、英文長寫[hours/minutes…],token 掃描
  須完整消耗無殘留才接受);formatHuman/formatClock(超過一天累進小時)/formatIso/breakdown 輸出。
  引擎 src/features/duration.ts(純函式無 DOM)+ 回歸測試 scripts/test-duration.mjs(50 筆:各格式解析/中英單位/
  錯誤處理/格式化/ISO 與時鐘來回一致,併入 npm test)。與 timestamp-convert(epoch↔日期)區隔。
  零三方相依、不上傳;type-check + 全測試 + build 通過 — 2026-06-19
- Punycode / IDN 網域檢視(punycode,category=anti-scam):把 xn-- 網域解回真正 Unicode、揪出用西里爾/希臘
  字母假冒英文的形近字釣魚網域(延續 anti-scam 第二支柱)。自行實作 RFC 3492 Punycode 編解碼(瀏覽器無內建):
  adapt/basicToDigit/digitToBasic/punyEncode/punyDecode,含溢位防護;labelToUnicode/labelToAscii/domainToUnicode/
  domainToAscii 逐標籤處理、解碼失敗原樣保留;detectScripts 依碼點範圍分類 10 種文字系統,analyzeDomain 標出
  拉丁與西里爾/希臘混用(mixedConfusable)與整體 risky。引擎 src/features/punycode.ts(純函式無 DOM)+ 回歸測試
  scripts/test-punycode.mjs(以 Node 內建 punycode 模組為 oracle 交叉驗證:已知向量 mañana/münchen/bücher/中日韓/
  俄希/emoji + 300 組隨機標籤 encode 與 oracle 一致且可往返、網域層級、detectScripts、analyzeDomain 風險偵測,
  共 50+ 筆,併入 npm test)。零三方相依、不上傳;type-check + 全測試 + build 通過 — 2026-06-19
- 隨機 ID 產生器(id-gen,category=workshop):UUID v4 / ULID / Nano ID 一次大量產生(上限 10000),
  全用 crypto.getRandomValues 密碼學等級亂數。UUID 手動設 version=4、variant=10xx 位元並可選大寫;
  ULID = 10 字 Crockford Base32 時間(高位在前可字典序排序、不含易混淆 I/L/O/U)+ 16 字亂數(256%32=0 無偏差);
  Nano ID 預設 21 字 URL-safe、長度與字元集可調,用拒絕取樣(limit=256-256%len)避免取模偏差。
  引擎 src/features/idGen.ts(uuidV4/isValidUuidV4/ulid/isValidUlid/encodeTimeBase32/nanoid/generate 純函式)
  + 回歸測試 scripts/test-idgen.mjs(33 筆:UUID 格式/版本/variant/2000 筆不重複、ULID 長度/字元集/可排序/
  encodeTime 已知值、Nano ID 長度/自訂字元集/拒絕短字元集/二元分布大致均勻、批次上下限,併入 npm test)。
  與 password-gen(密碼)區隔。零三方相依、不上傳;type-check + 全測試 + build 通過 — 2026-06-19
- HTML 轉純文字(html-to-text,category=workshop):把網頁/HTML 電子報/後台複製來的內容去標籤、解 HTML 實體、
  保留段落換行,洗成乾淨純文字。先移除註解與 script/style 整塊;<br>/<hr> 與區塊結束標籤(p/div/li/h1-6/tr…)轉換行、
  <li> 前加項目符號、td/th 以 Tab 分隔;去掉其餘標籤「後」才解實體(避免 &lt;script&gt; 被當標籤);
  decodeEntities 支援具名(常用 30 個)+ 十進位 &#39; + 十六進位 &#x27;,未知具名/非實體 & 原樣保留;
  正規化只收斂多重空白(保留 Tab)、逐行 trim、壓掉 3+ 空行。引擎 src/features/htmlToText.ts
  (htmlToText/decodeEntities 純函式無 DOM)+ 回歸測試 scripts/test-htmltotext.mjs(33 筆:具名/數值/中文實體/
  未知保留/去標籤/換行/script style 註解移除/清單/巢狀/Tab 分隔/&lt;script&gt; 不誤判/空字串/trim,併入 npm test)。
  零三方相依、不上傳;type-check + 全測試 + build 通過 — 2026-06-19
- 文字跳脫 / 還原(escape-text,category=workshop):四模式 —— 文字→JSON 字串(=JSON.stringify)、
  文字→程式碼跳脫(最小必要、可選引號樣式)、文字→\\uXXXX(逐 UTF-16 碼元轉非 ASCII 與控制字元、反斜線也跳脫
  確保可逆、代理對自然成兩個 \\u)、跳脫→原文(支援 \\n\\r\\t\\b\\f\\v\\0\\\\\\"\\'\\`\\/、\\xXX、\\uXXXX、
  ES6 變長 \\u{...},自動去成對外層引號,未知跳脫保留其後字元,位數不足/缺 } 報明確錯誤)。讀含 \\uXXXX 的 log/設定值、
  把多行文字塞進 JSON 都好用。引擎 src/features/escapeText.ts(toJsonString/escapeForQuote/escapeUnicode/
  unescapeString 純函式無 DOM)+ 回歸測試 scripts/test-escapetext.mjs(45 筆:各模式/引號模式/控制字元/emoji 代理對/
  錯誤處理/escapeForQuote 與 escapeUnicode 各自來回一致含反斜線,併入 npm test)。零三方相依、不上傳;
  type-check + 全測試 + build 通過 — 2026-06-19
- Markdown 預覽 / 轉 HTML(markdown-preview,category=workshop):即時把 Markdown 渲染成畫面與乾淨 HTML,
  寫 README/筆記/部落格時免來回切換、也不必把內容貼到線上 Markdown 編輯器(隱私)。可「複製格式化內容」
  (text/html 寫入剪貼簿,貼進 Word/Gmail/Outlook 保留粗體/清單/表格)、複製 HTML 原始碼、下載 .html
  (含基本排版樣式,再用瀏覽器列印成 PDF)、下載 .md。補足 html-to-text(反向)與 markdown-table(只表格)的缺口。
  引擎 src/features/markdownRender.ts(renderMarkdown/renderInline/escapeHtml 純函式無 DOM):支援標題、
  粗體/斜體/刪除線、行內與圍欄程式碼、連結、圖片、引言、巢狀清單、水平線、表格(複用 markdownTable 的
  markdownToTable);安全性:所有文字一律 HTML 逸出、危險網址(javascript:/vbscript:/data:/file:)過濾掉
  只剩文字、自動連結僅限 http(s)/mailto/tel/ftp,故輸出可安全放進 v-html。行內程式碼先抽出佔位再逸出/套格式
  避免內部符號誤判;底線粗斜體加 word 邊界保護 snake_case;表格偵測需「含 | 且下一行為分隔列」。
  回歸測試 scripts/test-markdownrender.mjs(50 筆:各區塊/逸出/XSS 阻擋(script、javascript:/data: url)/
  巢狀清單/表格對齊/圍欄不解析內部 markdown/snake_case 不破壞/綜合文件,以 esbuild 打包後跑,併入 npm test)。
  零新相依(複用既有 markdownTable);type-check + 全測試 + build 通過 — 2026-06-19
- 網址解析 / 查詢字串編輯(url-parse,category=workshop):把網址用標準 URL API 拆成協定/主機/埠/路徑/錨點,
  查詢字串自製解析器拆成鍵值對(保留順序與重複、'+' 轉空白、壞 %XX 退回原字串不丟例外、旗標型參數記 flag),
  表格可直接編輯/新增/刪除,改完用 buildUrl 即時組回;沒寫協定自動補 https://(記 assumedProtocol);
  一鍵清掉 utm_/fbclid/gclid/igshid 等追蹤碼。與 url-clean(拆轉址包裝)互補:這支著重看清結構與重組。
  引擎 src/features/urlParse.ts(parseUrl/buildUrl/parseQuery/buildQuery/decodeComponent 純函式,URL 為標準全域)
  + 回歸測試 scripts/test-urlparse.mjs(40 筆:各部位/自動補協定/錯誤/解碼編碼/重複鍵/旗標/來回一致/清追蹤碼,
  併入 npm test)。零三方相依、不上傳;type-check + 全測試 + build 通過 — 2026-06-19
- 進位轉換器(base-convert,category=workshop):二/八/十/十六進位一次互轉 + 任意 2–36 進位,用 BigInt 運算,
  64 位元以上超大整數不像 parseInt 失準(64 位元全 1 = 18446744073709551615 實測正確)。parseInBase 容許開頭
  正負號、字串中空白/底線分組、與該進位相符的 0b/0o/0x 前綴,任一字元超界即報錯;toBase 用 BigInt 除餘輸出小寫
  (HEX 顯示轉大寫);convertViews 一次給四種、groupBinary 二進位每 4 位右起分組、bitLength 算位元長度。
  引擎 src/features/baseConvert.ts(digitValue/parseInBase/toBase/convertViews/groupBinary/bitLength 純函式無 DOM)
  + 回歸測試 scripts/test-baseconvert.mjs(45 筆:各進位/前綴/分組/正負號/錯誤處理/超大整數不失真/來回一致 6 種進位,
  併入 npm test)。零三方相依、不上傳;type-check + 全測試 + build 通過 — 2026-06-19
- 文字資料抽取(data-extract,category=workshop):從一大段雜亂文字(轉寄信、文件、PDF 複製文字、貼上網頁)
  一次抓出 Email、網址、台灣手機、有效統一編號,各自去重(email 忽略大小寫、手機正規化成 09 開頭 10 碼)。
  統編複用既有 isValidVat 做檢查碼驗證 → 高精度不誤抓;網址只吃 RFC 3986 ASCII 安全字元(遇中文即停)
  並去尾端標點;手機用 (?:\+?886|0)9... 樣式且過濾市話/不足碼;統編用 lookbehind/lookahead 取獨立 8 碼不從長數字誤抓。
  與 text-redact(遮蔽個資)互補(本工具是抽出)。引擎 src/features/dataExtract.ts(extractEmails/Urls/Mobiles/Vats/
  normalizeMobile/extractAll 純函式無 DOM,import vatCheck.isValidVat)+ 回歸測試 scripts/test-dataextract.mjs
  (23 筆:各類抽取/去重/尾端標點/+886 正規化/市話不誤抓/統編檢查碼過濾/長數字不誤抓/整合/空輸入,併入 npm test)。
  零新相依、不上傳;type-check + 全測試 + build 通過 — 2026-06-17
- JSON 攤平轉表格(json-flatten,category=workshop):把巢狀 JSON(物件裡有物件/陣列)壓平成路徑鍵
  (a.b、a[0].c),頂層陣列→一元素一列、頂層物件→單列,缺欄自動補空,輸出 CSV/JSON 丟進 Excel。
  補足 data-convert「只吃扁平物件陣列」的缺口(巢狀 API 回傳)。boolean→true/false、null→空、空物件/空陣列
  保留鍵避免整列消失、頂層純值用 value 鍵。引擎 src/features/jsonFlatten.ts(flattenInto/flattenOne/
  flattenJson/flattenedToCSV 純函式無 DOM,複用 data-convert 的 objectsToCSV 做欄位聯集+引號逸出)+ 回歸測試
  scripts/test-jsonflatten.mjs(23 筆:巢狀路徑/陣列索引/型別/頂層純值/空物件陣列/多列聯集/CSV 逸出/真實範例,
  併入 npm test)。零新相依、不上傳;type-check + 全測試 + build 通過 — 2026-06-17
- 表格統計 / 樞紐(table-stats,category=workshop):把一份明細「依某欄分組,對另一欄做統計」
  (等同 Excel 樞紐分析 / SQL GROUP BY):支援 count/sum/avg/min/max/distinct 六種聚合,可選不分組(全部一組);
  數值自動吃千分位逗號+去空白、非數值在 sum/avg/min/max 時略過(全組無數值回空字串),avg 分母只算有效數值;
  分組維持首次出現順序;結果兩欄(分組欄/「全部」+ 統計欄),可下載 CSV/JSON。與 table-clean/table-merge/
  list-compare/data-convert 構成資料工具家族。引擎 src/features/tableStats.ts(parseNum/formatNum 整數不帶小數、
  其餘最多 4 位去尾零 / aggregate / computeStats 純函式無 DOM,複用 tableClean 的 Table)+ 回歸測試
  scripts/test-tablestats.mjs(28 筆:六種聚合、空值處理、不分組、千分位、全非數值、首次順序、parseNum/formatNum,
  esbuild 多入口打包後跑,併入 npm test)。資料不上傳;type-check + 全測試 + build 通過 — 2026-06-17
- 表格合併 / VLOOKUP(table-merge,category=workshop):把兩份表格依「對應欄(key)」併成一張,
  等同 Excel VLOOKUP / SQL JOIN(例:左=客戶名單、右=訂單金額,依 Email 對起來)。支援 left join
  (保留所有左列、對不到留空)與 inner join(只留對到的列);右表同 key 取第一筆(VLOOKUP 行為)並回報重複數;
  key 預設忽略英文大小寫+去前後空白(僅 key 正規化,資料值原樣保留);右表欄名與左表衝突自動加「(2)」不覆蓋;
  可選是否帶入右表 key 欄。回報 matched/unmatched/rightDuplicates 統計。與 table-clean(單表清理)、
  list-compare(集合比對)、data-convert(格式互轉)互補。引擎 src/features/tableMerge.ts(純函式無 DOM,
  複用 tableClean 的 Table/parseTable/toCSV)+ 回歸測試 scripts/test-tablemerge.mjs(20 筆:left/inner、
  填值留空、計數、大小寫/去空白 key、重複 key 取第一、欄名衝突改名、多欄、空右表、序列化整合,
  以 esbuild 多入口打包後跑,併入 npm test)。含個資名單不上傳;type-check + 全測試 + build 通過 — 2026-06-17
- 動圖工坊(gif-studio,category=workshop):把多張圖片做成會動的 GIF —— 線上 GIF 製作站多半要上傳照片、
  滿廣告又加浮水印;本工具全程在瀏覽器用 Canvas + gifenc(純 JS、無 WASM/worker)編碼、不上傳。可調輸出寬度
  (高度依第一張比例自動算,最長邊上限 1200px)、播放速度(1–24 張/秒)、縮放方式(完整顯示留白/填滿裁切/拉伸)、
  底色、顏色數(8–256,每張各自量化最佳調色盤畫質較佳)、循環次數(無限/1/3/5,首張寫 repeat 旗標);拖放/多次加入/
  上下移調序/移除;編碼分影格 await 讓進度可更新。引擎 src/features/gifStudio.ts(encodeGif/planCanvasSize/
  fpsToDelay 純函式,像素進、GIF 位元組出,與環境無關)+ 回歸測試 scripts/test-gifstudio.mjs(23 筆:GIF89a 檔頭/
  邏輯螢幕寬高/結尾 0x3B/NETSCAPE2.0 循環擴充/maxColors/空影格與像素數不符與尺寸錯誤、planCanvasSize 等比與最長邊上限、
  fpsToDelay 夾限與 10ms 對齊,以 esbuild 打包含 gifenc 後跑,併入 npm test)。gifenc 動態 import + gif-vendor chunk
  (gzip 3.2KB)不預快取;gifenc 無型別宣告於 env.d.ts 補上;type-check + 全測試 + build 通過 — 2026-06-18
- 證件浮水印加註(image-watermark):交付證件影本前斜向重複加註用途(防盜用,內政部宣導作法),
  canvas 把文字燒進像素、密度/顏色/角度可調、不上傳、可批次;與 image-redact 互補 — 2026-06-15
- 文字清理工坊(text-clean):清掉貼上時夾帶的零寬/不可見字元、全形↔半形、多餘空白/空行、
  行首編號、大小寫,即時字數統計;零相依、不上傳 — 2026-06-15
- 本機密碼產生器(password-gen,category=life):crypto.getRandomValues + 拒絕取樣(無取模偏差),
  保證每類至少一字 + Fisher–Yates 洗牌,熵/強度標示,不連網不記錄(線上產生器可能偷記密碼)— 2026-06-15
- 身分證字號檢核(tw-id-check,category=life):內政部檢查碼規則 + 首碼縣市對照表(I/O/W/X 跳號),
  抓打錯一碼/亂編假號;明確標示「檢查碼正確≠真有此人」;本機計算不上傳。A123456789 驗證通過 — 2026-06-15
- 統一編號檢核(tw-vat-check,category=life):財政部統編檢查碼規則(加權[1,2,1,2,1,2,4,1]、乘積個+十位和,
  現行被 5 整除、第 7 碼為 7 的加 0/加 1 特例),抓打錯一碼/亂編假統編(假發票、人頭公司常見);
  單筆 + 批次(換行/逗號/分號分隔,標無效與重複、可複製無效清單,對帳整名單用);明確標示「檢查碼正確≠真有此公司」
  並附經濟部商工登記公示資料查詢官方連結(查證引導,延續 anti-scam DNA)。引擎 src/features/vatCheck.ts
  (純函式無 DOM)+ 回歸測試 scripts/test-vatcheck.mjs(含台積電/鴻海/統一企業實算、特例分支、批次,併入 npm test,28 筆全過)。
  零三方相依;type-check + test + build 通過 — 2026-06-16
- 電話號碼檢視 / 防詐(phone-check,category=anti-scam):貼上陌生來電號碼,正規化(+886 ↔ 0、去連字號)、
  判類型(手機/市話/免付費/付費語音/短碼/國外)、依區碼推測區域,標出常見詐騙警訊(付費語音 0204 回撥高額、
  國際冠碼/+ 開頭卻自稱國內機構、+886 來電顯示可偽冒等),附 165 全民防騙網 + Whoscall 查證連結。
  明確聲明「非詐騙判定、來電顯示可偽冒」。引擎 src/features/phoneCheck.ts(純函式無 DOM)+ 回歸測試
  scripts/test-phonecheck.mjs(21 筆,併入 npm test)。延續 anti-scam DNA 與「可疑賣家/電話查證引導」待辦。
  零三方相依;type-check + test + build 通過 — 2026-06-16
- 圖片裁切/旋轉(image-crop,category=workshop):把拍歪照片轉正、裁掉背景;左右轉90°/水平鏡像/垂直翻轉 +
  拖曳框選裁切(複用 image-redact 的 pointer 拖曳比例邏輯),操作歷史可逐步復原/回到原圖;
  中間步驟用無損 PNG 暫存避免多次編碼失真,下載時才依選定格式(JPG/PNG+品質)重新編碼;
  canvas 處理、不上傳、重編碼自動去 EXIF。零相依 — 2026-06-15

- 證件照排版 4×6(id-photo,category=workshop):把一張大頭照排成一張 4×6 吋相紙(300 DPI)的多張
  一吋(2.8×3.5)/二吋(3.5×4.5)證件照,可直接拿去超商相片機/沖印店沖洗。鎖定證件比例的可拖曳裁切框
  (框大小用滑桿、整體拖曳對位,box.h 依 spec 比例與圖片長寬連動,畫面上與單張預覽都不變形)+ 即時單張預覽;
  排版時直式/橫式各算可放張數取較多者、整列置中、淺灰裁切參考線;另提供「只下載單張」。
  臉部照片是高敏個資 → 沖印店要錢、線上排版站要上傳臉,本工具全程 canvas 在瀏覽器處理、不上傳、
  重編碼去 EXIF。零相依(純 canvas);換尺寸/首次載入用 nextTick 補畫預覽避免 canvas 清空後空白。
  type-check + build 通過 — 2026-06-16
  - 評估後跳過圖片去背(@imgly/background-removal):需 onnxruntime-web peer + 執行期向 IMG.LY CDN 抓
    ~40MB ONNX 模型 + 引入 4 個 high 漏洞,與「乾淨、不依賴他人伺服器」DNA 衝突且過重,依指示跳過。
- 字幕工坊(subtitle-studio,category=workshop):SRT ↔ WebVTT 互轉、整體平移對時(字幕快/慢幾秒,
  正延後/負提早)、速率縮放(影格率不同造成的漸進偏移)、自動重新編號。線上字幕站要上傳可能含劇本/課程
  機密的字幕檔,本工具全程瀏覽器純函式處理、不上傳。零相依:引擎 src/features/subtitle.ts
  (parseTime/formatTime/parseSubtitles/shiftCues/scaleCues/toSrt/toVtt,以毫秒為內部單位,解析時略過
  WEBVTT 標頭/NOTE/STYLE 與 cue 設定、支援逗號/點與省略小時),含回歸測試 scripts/test-subtitle.mjs
  (23 筆,併入 npm test);上傳檔自動依副檔名切換輸出格式、即時統計句數與時間範圍、複製/下載/範例。
  type-check + test + build 通過 — 2026-06-16
- 網站圖示 / Favicon 產生器(favicon-gen,category=workshop):上傳一張圖,輸出 favicon.ico
  (canvas 各尺寸 PNG → 自製 ICO 容器包 16/32/48)、apple-touch-icon(180)、PWA 圖示(192/512),
  附可直接貼上的 HTML。線上 favicon 站要上傳尚未公開的 logo、夾廣告、有的綁追蹤,本工具全程瀏覽器
  canvas 處理、不上傳。縮放完整/填滿 + 背景(透明/白/黑/品牌色)可選、即時預覽。
  零相依:ICO 組裝引擎 src/features/ico.ts(純函式 little-endian,256 尺寸欄位寫 0),含回歸測試
  scripts/test-ico.mjs(16 筆,驗證標頭/entry/offset/影像放置,併入 npm test)。
  type-check + test + build 通過 — 2026-06-16

- 檔案分割 / 合併(file-split,category=workshop):大檔寄不出去(email/LINE/雲端有大小限制)時,
  把任何檔案切成小份分批傳,收到後再合併還原。線上分割站要把可能很大又含機密的檔案整個上傳到別人伺服器、
  滿廣告又限大小;本工具用 Blob.slice(惰性、不需整檔讀進記憶體)切割、new Blob([...parts]) 合併,
  全程瀏覽器不上傳。分割檔用標準 .001 .002 命名(與 7-Zip/HJSplit 一致),對方就算沒有本工具也能用內建
  copy /b(Windows)/ cat(Mac/Linux)指令合併;合併會依檔名序號自動排序並偵測缺份/重複避免合出損壞檔。
  引擎 src/features/fileSplit.ts(planChunks 切點規劃 + 份數上限保護、partName 補零命名、partIndexOf/baseNameOf、
  orderParts 排序+序列檢查、joinBytes 供測試驗證來回一致;純函式無 DOM)+ 回歸測試 scripts/test-filesplit.mjs
  (26 筆:切點/整除/單份/錯誤/命名/序號/排序缺份重複/位元組來回一致含中文,併入 npm test)。零三方相依、不上傳。
  ⚠️ 本環境 npm registry 被網路政策擋(403)無法裝 node_modules,改用 node --experimental-strip-types
  直跑引擎驗證(26 筆全過);.vue 無法本機 build/type-check,靠細讀 + 既有 image-redact 模式 + 部署 Action
  的真實 build 把關(deploy needs build,build 失敗不會發佈,線上站安全)— 2026-06-16

## 可信策展(2026-06:延續下載中心模式,資料 public/data/*.json + 容錯視圖)
- 推薦好站(/picks,views/Picks.vue + public/data/picks.json):人工挑選、免費好用、連結皆指向官方;
  旗艦收錄「防詐查證」(165/事實查核/MyGoPen/Cofacts)貼合本站 DNA;另含 AI 助手/翻譯學習/修圖設計/台灣在地。
  finder 加虛擬項 picks-center 讓關鍵字導向;App 導覽 + 首頁入口卡;NetworkFirst 自動涵蓋新 JSON — 2026-06-15

## 處理工坊(續)
- CSS 格式化 / 壓縮(css-format,category=workshop):把擠成一行或凌亂的 CSS 排成可讀格式
  (每條宣告獨立一行、選擇器逗號各自成行、巢狀 @media 縮排),或反向壓成單行。與 sql-format、
  xml-format 構成「格式化三兄弟」。正確處理易錯點:url(data:...;base64,...) 內的 ; 與 , 不被誤切
  (掃描器追蹤括號深度)、a:hover 偽類冒號不被當成宣告的 prop:value 冒號(以頂層冒號切分)、
  字串與註解原樣保留(獨立成行或附在該行)。引擎 src/features/cssFormat.ts(collapseWs 收斂空白但保留
  引號內容、splitTopLevel 在括號/中括號/引號外切分、formatDeclaration 以第一個頂層冒號分 prop/value、
  scan 回呼式掃描、formatCss/minifyCss 純函式無 DOM)+ 回歸測試 scripts/test-cssformat.mjs(32 筆:
  規則/選擇器清單/巢狀 @media/前導註解/偽類/括號內逗號/url 冒號/data URI 不誤切/@import/縮排/空白收斂/
  字串保留/空規則,minify 7 種,4 組冪等性 + 結構保留(minify(x)===minify(format(x))),邊界,併入 npm test)。
  零新相依、不上傳;type-check + 全測試 + build 通過 — 2026-06-20
- XML 格式化 / 壓縮(xml-format,category=workshop):把擠成一行的 XML / SVG / RSS / pom.xml / 設定檔
  重新縮排成可讀格式,或反向壓成單行 —— 補足資料轉換群(JSON/YAML/CSV/Excel/INI/.env)一直缺的 XML。
  不依賴 DOMParser,自行 tokenize+建樹+重排(可在 Node 測,也代表全程瀏覽器執行、不上傳;XML 設定常含
  連線字串/密鑰)。保留註解、CDATA、<?xml?> 宣告、DOCTYPE 與屬性值,標籤內多餘空白收斂成單一空格;
  單一文字子節點 inline(<a>x</a>)、空元素 inline、自閉合保留。引擎 src/features/xmlFormat.ts
  (tokenize 處理註解/CDATA/PI/DOCTYPE/標籤含引號內 > 不誤判、normalizeTag 引號外收斂空白、parse 用堆疊
  比對開始/結束標籤、formatXml/minifyXml 純函式無 DOM)+ 回歸測試 scripts/test-xmlformat.mjs(32 筆:
  巢狀/屬性+文字 inline/自閉合/空元素/空白視同空/宣告/註解/CDATA/實體不改動/縮排選項/標籤空白正規化/
  rss 與 pom 巢狀、minify、4 組冪等性 + 結構保留(minify(x)===minify(format(x)))、6 種錯誤(標籤不符/
  未關閉/多出結束/未結束註解與 CDATA),併入 npm test)。零新相依、不上傳;type-check + 全測試 + build 通過 — 2026-06-20
- SQL 格式化 / 美化(sql-format,category=workshop):把擠成一行或排版凌亂的 SQL 整理成可讀格式
  (主要子句各自換行、欄位與條件縮排、頂層逗號斷行、AND/OR 換行;子查詢與 CREATE TABLE 欄位用區塊括號縮排),
  或反向壓成單行(minify,移除註解)。關鍵字大小寫 upper/lower/preserve、縮排 2/4 可選。查詢常含資料表/欄位名
  與參數值,不該貼到陌生線上工具 —— 全程瀏覽器執行、不上傳。與 sql-insert(產生 INSERT)互補。
  引擎 src/features/sqlFormat.ts(tokenizeSql 正確保留字串(含 '' 與反斜線跳脫)、識別字("" / ``)、行與區塊註解、
  數字含 0x/小數/指數、參數 @ : $;formatSql 單遍排版含括號堆疊、區塊 vs 行內括號、BETWEEN…AND 不誤斷;
  minifySql 純函式無 DOM)+ 回歸測試 scripts/test-sqlformat.mjs(41 筆:多項精確輸出 select/join/子查詢/
  create table/insert/update/delete/group by、大小寫與縮排選項、字串與註解內容不改動、7 組冪等性
  format(format(x))===format(x) + 顯著 token 不漏不重排、minify、多語句、未結束字串/註解錯誤,併入 npm test)。
  零新相依、不上傳;type-check + 全測試 + build 通過 — 2026-06-20
- QR Code 產生器(qr-generate,category=workshop):qrcode 函式庫,文字/網址、WiFi、vCard 三模式,
  即時預覽 + 下載 PNG、尺寸/容錯等級可調;直接編碼原始內容(不像線上產生器偷塞追蹤短網址),
  輸入不上傳。qrcode 動態 import,precache +33KB(可接受,未拆 vendor)— 2026-06-15

## 處理工坊(續 2)
- 顏色可讀性檢測(contrast-check,category=workshop):輸入文字色與背景色,依 WCAG 2.1 算對比比值,
  判斷一般字/大字下達不達 AA/AAA,即時預覽實際配色。做簡報/海報/網頁/長輩友善文件選色用,與色彩工坊互補。
  純函式引擎 src/features/contrast.ts(parseColor 吃 #RGB/#RRGGBB/rgb()、relativeLuminance、contrastRatio、
  grade 一般/大字 AA/AAA + UI),回歸測試 scripts/test-contrast.mjs(23 筆:解析/黑白=21/同色=1/
  #767676 vs #777777 AA 臨界/各灰階門檻邊界,併入 npm test 全 784 筆)。零相依、不上傳;type-check + build 通過 — 2026-06-18
- 錄音機(voice-recorder,category=workshop):用麥克風錄語音備忘/訪談/會議/長輩口述,
  可暫停/繼續、即時音量計(AnalyserNode getByteTimeDomainData 算 peak)確認有收音、試聽後下載音檔。
  getUserMedia + MediaRecorder 全程在裝置錄製、聲音不上傳;mime 自動挑選(opus/webm→mp4→ogg)決定副檔名;
  收尾統一 cleanupStream(停軌道/關 AudioContext/取消 rAF)避免麥克風一直亮。與螢幕錄影(錄畫面)互補。
  UI-only 無純邏輯可單元測,比照 screen-record 由部署 build 把關;type-check + build 通過 — 2026-06-18
- 條碼產生器(barcode-generate,category=workshop):把料號、商品編號、書本 ISBN 做成一維條碼
  (CODE128/EAN-13/EAN-8/UPC-A/CODE39/ITF-14),可下載向量 SVG 或 3× 高解析 PNG 印標籤,與 QR Code 產生器
  (二維)互補。線上條碼站常滿廣告/限量/偷塞追蹤;本工具用 JsBarcode 在瀏覽器產生、不上傳。
  純函式引擎 src/features/barcode.ts:GS1 檢查碼(EAN-13/EAN-8/UPC-A/ITF-14 共用「由右交替乘 3、1」)
  + 各格式輸入驗證/正規化(少打檢查碼自動補上並提示、CODE39 自動轉大寫、CODE128 擋中文),與 DOM 無關可 Node 測。
  回歸測試 scripts/test-barcode.mjs(22 筆:以已知真實條碼核算檢查碼/補碼/檢查碼錯誤提示/長度字元驗證/空輸入,
  併入 npm test,全 761 筆通過)。JsBarcode 動態 import + barcode-vendor chunk(68KB)不預快取;
  套件未宣告 types 欄位於 env.d.ts 補最小宣告。type-check + 全測試 + build 通過 — 2026-06-18
- 文字差異比對(text-diff,category=workshop):比對合約改版/條款/規格新舊兩版,
  逐行 + 行內逐字標出改了哪裡(綠＋紅－、配對修改行做詞層級 LCS)。線上 diff 工具多半要把
  可能機密的文字送他人伺服器,此工具全程瀏覽器計算、不上傳。零相依:引擎 src/features/textDiff.ts
  (泛型 LCS,行層級→配對行詞層級),含回歸測試 scripts/test-textdiff.mjs(13 筆,併入 npm test);
  忽略大小寫/空白、行號對照、5000 行上限保護、對調/範例/複製。type-check + build 通過 — 2026-06-15

- PDF 取出文字(pdf-studio 新增「取出文字」分頁,ExtractText.vue + lib.extractPdfText):
  用既有 pdfjs-dist 的 getTextContent 抽出 PDF 可選取文字(依 hasEOL 還原斷行),方便複製/引用/搜尋;
  掃描影像 PDF 抽不到字時明確提示需 OCR、引導改用「PDF 轉圖片」;頁碼分隔可切、複製/下載 .txt、字數統計。
  零新相依(複用 pdf-vendor),不上傳 — 2026-06-15

- 圖片拼接 / 長圖(image-stitch,category=workshop):把多張截圖/收據/對話接成一張長圖(縱向)
  或長條(橫向);可選自動縮放統一寬/高、對齊(靠邊/置中)、間距、底色、PNG/JPG 品質;
  12000px 上限保護避免畫布過大當機。canvas 合成、不上傳、重輸出去 EXIF,零相依 — 2026-06-15

- PDF 頁碼(pdf-studio 新增「PDF 頁碼」分頁,PageNumbers.vue + lib.addPageNumbers):
  在每頁加上「第 X 頁」「X / Y」等頁碼,交付合約/報告前自動編號;格式 {n}/{total} 自訂、
  六向位置、起始頁碼、第一頁不標(封面)、顏色/字級可調。線上加頁碼工具要上傳機密文件且常付費限頁;
  頁碼以 canvas 畫成透明 PNG 蓋上(支援中文,複用浮水印作法),相同號碼+尺寸頁面共用嵌入圖。
  零新相依(複用 pdf-lib),不上傳;type-check + build 通過 — 2026-06-16

- PDF 壓縮(pdf-studio 新增「壓縮 PDF」分頁,Compress.vue + lib.compressPdfViaRaster):
  把每頁用 pdfjs 渲染成 JPEG 再以 pdf-lib 重組,維持原頁面尺寸(pt)。對「手機掃描/相片多」的 PDF
  (最常見寄不出去的情況)大幅縮小;三段強度(倍率+JPEG品質)。誠實揭露代價:文字會變成影像、無法再選取;
  顯示壓縮前後大小與省下%,若沒變小明確建議保留原檔。零新相依(複用 pdfjs+pdf-lib),不上傳 — 2026-06-16

- 本機加密保險箱(secure-box,category=workshop):用 Web Crypto AES-GCM 256 + PBKDF2(25 萬次)
  替文字或檔案上密碼,加密、解密、密碼全程本機不上傳;把結果寄出、另以電話告知密碼對方才解得開。
  引擎 src/features/cryptoBox.ts(純模組、僅用 globalThis.crypto,無 DOM 依賴,故可 Node 測);
  容器 magic"THB1"+salt(16)+iv(12)+密文;GCM 標籤自動偵測密碼錯誤/竄改/非本工具檔案。
  回歸測試 scripts/test-cryptobox.mjs(9 筆:來回/隨機性/錯密碼/竄改/格式,併入 npm test);
  明確警示「忘記密碼無法救回」。零三方相依;type-check + test + build 通過 — 2026-06-16

## 防詐騙(續)
- 信用卡卡號檢核(card-check,category=anti-scam):用 Luhn 檢查碼驗證卡號有沒有打對(少打/多打/錯一碼),
  依 IIN/BIN 開頭與長度判斷發卡組織(Visa/Mastercard/AmEx/JCB/UnionPay/Discover/Diners)。本機計算、不上傳、不儲存;
  明確聲明「檢查碼正確 ≠ 真有此卡」並衛教卡號+期限+末三碼/OTP 湊齊即遭盜刷、假客服話術與 165。
  純函式引擎 src/features/cardCheck.ts(luhnValid/detectBrand 規則順序處理 62/6011 專一前綴與 MC 2221–2720 新號段/
  formatCardNumber AmEx 4-6-5/checkCard 長度核對)+ 回歸測試 scripts/test-cardcheck.mjs(25 筆:公開測試卡號、
  Luhn 正反例、2720/2721 邊界、分組、整合,併入 npm test 全 809 筆)。零相依;type-check + 全測試 + build 通過 — 2026-06-18
- 郵件來源檢視 / 防冒名(email-check,category=anti-scam):貼上可疑信件的「郵件原始碼/標頭」,
  解析 From / Reply-To / Return-Path 與 SPF/DKIM/DMARC 驗證結果,比對寄件網域是否對得上,標出冒名釣魚
  常見破綻:顯示名稱藏別網域、回覆地址跑到別處(BEC 變更匯款)、退信來源不符、驗證失敗、免費信箱卻自稱機構。
  分 高風險/注意/參考 三級並白話解釋,明確聲明「標頭可偽冒、非詐騙判定」並導向官方查證 + 165。
  引擎 src/features/emailHeader.ts(splitHeaders 還原 RFC5322 折行、parseAddress、rootDomain 處理 com.tw 等
  台灣二級網域、analyzeHeaders;純函式無 DOM 可 Node 測)+ 回歸測試 scripts/test-emailheader.mjs
  (19 筆:折行/網域根/各冒名情境/驗證失敗,併入 npm test,全 181 筆通過)。零三方相依、不上傳;
  type-check + test + build 通過 — 2026-06-16
- 文字個資遮蔽(text-redact,category=anti-scam):貼上對話/單據文字,自動找出身分證、手機、
  信用卡、Email 並打碼;轉貼客服對話、分享截圖文字前先遮個資。引擎 src/features/piiMask.ts
  (純規則,身分證用內政部檢查碼、信用卡用 Luhn 驗證才遮,降誤判;重疊去重;保留分隔符)。
  可選類別、保留末 4 碼;即時計數;明確告知銀行帳號/地址/市話等不自動偵測需人工複查。
  回歸測試 scripts/test-piimask.mjs(20 筆,併入 npm test);與「圖片遮蔽」互補。
  零三方相依;type-check + test + build 通過 — 2026-06-16
- QR Code 解碼 / 看網址(qr-decode,category=anti-scam):上傳或貼上含 QR 的截圖/照片,
  用 jsQR 在瀏覽器解出內容(圖片不上傳);解出是網址時警示並一鍵帶 ?u= 丟到可疑網址檢查器
  (link-check 改讀 route.query.u 自動填入)。陌生 QR 直接掃易被導到釣魚頁,先看清楚再決定。
  jsQR 動態 import + qr-vendor chunk(131KB)不預快取 — 2026-06-15
- 照片隱私檢視器 EXIF(exif-viewer,category=anti-scam):exifr 解析照片夾帶的拍攝時間/機型/
  GPS 座標,GPS 紅框警示 + Google Maps 連結;沒夾帶則提示相對安全;連到圖片工坊去 EXIF。
  exifr 拆 exif-vendor chunk(75KB)+ globIgnores 不預快取,照片不上傳 — 2026-06-15
- 檔案校驗碼 / 完整性驗證(file-checksum,category=anti-scam):Web Crypto crypto.subtle.digest
  算 SHA-256/SHA-1/SHA-512,拖放/多選、貼上官方校驗碼自動比對(✓相符/✗不相符 + 警示),
  全程本機不上傳。貼合下載中心「附校驗碼」防掉包 DNA,連回 /downloads — 2026-06-15

- 名單比對 / 去重(list-compare,category=workshop):對帳、整名單最常見的兩件事 —— ①一份名單去重
  (找出重複幾次、留乾淨一份)②比對兩份名單算交集/只在A/只在B/聯集(如「全體」減「已繳」=還沒繳的人)。
  比對選項可忽略大小寫/全形半形/頭尾或多餘空白(避免「看似相同卻被當不同」),輸出保留首次出現原始樣子。
  與 data-convert(格式互轉)、text-diff(逐行逐字 diff)互補;線上同類工具要把含個資名單上傳他人伺服器,
  此工具全程瀏覽器、不上傳。引擎 src/features/listCompare.ts(純函式無 DOM:normalizeKey/parseList/dedupe/compare)
  + 回歸測試 scripts/test-listcompare.mjs(27 筆,併入 npm test)。零三方相依;type-check + test + build 通過 — 2026-06-17

- 抽籤 / 分組無偏差亂數引擎(random-picker,category=life):兩條排程各自新增了功能重複的抽籤工具
  (random-picker / random-draw),已合併為唯一的 random-picker(UI 較佳),並改用具拒絕取樣、有回歸測試的共用引擎
  src/features/randomDraw.ts(原 Math 洗牌 r*(i+1) 有取模偏差 → 改 cryptoRandInt 拒絕取樣,機率真正均等;
  純函式、亂數來源可注入故可確定性測試:cryptoRandInt/shuffle/drawWinners/makeGroupsByCount/makeGroupsBySize)。
  回歸測試 scripts/test-randomdraw.mjs(注入確定性 rand 驗輸出 + 6 萬次取樣驗範圍與均勻度,併入 npm test)。
  zero-dep;type-check + test + build 通過 — 2026-06-17

- 網址清理 / 看穿轉址(url-clean,category=anti-scam):①看穿轉址 —— 把 google.com/url?q=、
  Facebook l.php?u=、Outlook safelinks、l.instagram.com 等轉址包裝一層層拆開(含多層巢狀、迴圈/深度保護、
  通用強參數名 url/u/q/target… 偵測),先看清楚連結最後落點主機再決定點不點(詐騙常用包裝藏釣魚連結);
  ②清理追蹤 —— 移除 utm_*/pk_/mc_… 前綴與 fbclid/gclid/msclkid/igshid… 追蹤參數(大小寫不敏感),
  分享連結更乾淨更短不洩漏來源。與 link-check(風險啟發式)互補並交叉連結。引擎 src/features/urlClean.ts
  (純函式、只用標準 URL:cleanUrl/unwrapRedirect/processUrl)+ 回歸測試 scripts/test-urlclean.mjs
  (24 筆:清理/大小寫/多層巢狀/safelinks/自指不誤拆/整合,併入 npm test)。零三方相依;type-check + test + build 通過 — 2026-06-17

- ISBN 檢核 / 轉換(isbn-check,category=life):驗證書籍 ISBN-10(mod 11 加權,餘 10 寫 X)與 ISBN-13
  (EAN-13 mod 10 交替 1/3 權重)檢查碼,並互轉(978 開頭可轉 ISBN-10,979 不可、明確告知)。單筆分析給兩種
  格式;批次對整批書單標出無效;檢查碼錯時提示正確值;聲明檢查碼正確≠真有此書。引擎 src/features/isbn.ts
  (normalizeIsbn/isbn10CheckDigit/isbn13CheckDigit/isValidIsbn10/13/isbn10to13/isbn13to10/analyzeIsbn 純函式無 DOM)
  + 回歸測試 scripts/test-isbn.mjs(38 筆:真實 ISBN 含 K&R 與末位 X、檢查碼計算、錯一碼/長度/非數字、
  10↔13 互轉與往返、979 不可轉、analyzeIsbn 各情形,併入 npm test)。與 barcode-generate 互補;
  零相依、不上傳;type-check + 全測試 + build 通過 — 2026-06-19
- 羅馬數字轉換(roman-numeral,category=life):阿拉伯數字(1–3999)↔ 標準羅馬數字雙向轉換,採減法記號
  (IV/IX/XL/XC/CD/CM)。解析時用嚴格正則驗證,擋下 IIII/VV/IC/IL 等非規範寫法並提示正確;範圍外與非整數
  明確報錯;大小寫與空白容忍。引擎 src/features/roman.ts(toRoman 查表貪婪、fromRoman 嚴格驗證後解析 純函式無 DOM)
  + 回歸測試 scripts/test-roman.mjs(89 筆:18 組已知對照雙向、範圍邊界、非規範寫法拒絕、大小寫空白、
  全範圍 1..3999 往返一致,併入 npm test)。與 num-to-chinese、amount-english、base-convert 同屬轉換家族;
  零相依、不上傳;type-check + 全測試 + build 通過 — 2026-06-19
- 金額轉國字大寫(num-to-chinese,category=life):把數字金額轉中文大寫(壹貳參…拾佰仟萬億兆、元角分整),
  支票/本票/合約/收據填寫防竄改用。可含千分位逗號、四捨五入到分(進位用 BigInt 避免大數誤差)、可到兆級;
  正確處理節內與節間的零(零壹佰、壹億零壹、收斂雙零、去尾零)、角為零分不為零補零。輸出「金額大寫(新臺幣…元整)」
  與「純數字大寫」兩種。引擎 src/features/amountChinese.ts(純函式)+ 回歸測試 scripts/test-amountchinese.mjs
  (37 筆:整數零處理 / 角分 / 四捨五入跨整數進位 / 千分位 / 溢位,併入 npm test)。零三方相依;type-check + test + build 通過 — 2026-06-17

- 行事曆事件 .ics 產生器(event-ics,category=life):填活動標題/時間/地點/備註/連結/提醒,產生符合 RFC 5545 的
  .ics 下載,直接匯入 Google/Apple/Outlook —— 不必像活動邀請服務那樣授權存取你的行事曆。支援定時(未填結束預設 +1 小時、
  跨日進位)與全日(DTEND 取隔天排他)、VALARM 事前提醒、RFC 文字逸出(逗號/分號/換行/反斜線)、CRLF 行尾、檔名去非法字元。
  採浮動本地時間。引擎 src/features/icsEvent.ts(純函式、uid/dtstamp 可注入故可測)+ 回歸測試 scripts/test-icsevent.mjs
  (27 筆,併入 npm test)。零三方相依;type-check + test + build 通過 — 2026-06-17

- 日期計算機(date-calc,category=datetime):①兩日期相差幾天(另標含頭尾)②從某天加/減 N 天(可勾「只算工作日」
  跳過週末)③兩日期間工作日數(含起訖、排週末)。用於契約/退貨鑑賞期/繳費/活動倒數到期日推算;與 age-calc(年齡)、
  roc-year(年制換算)、due-date(預產期)互補,專做一般日期算術。以 UTC 為基準避免 DST 誤差;parseDate 回推驗證擋
  2/30 等假日期、閏年判斷正確。引擎 src/features/dateCalc.ts(純函式)+ 回歸測試 scripts/test-datecalc.mjs(28 筆,
  併入 npm test)。明確標示「只排週末未扣國定假日」。零三方相依;type-check + test + build 通過 — 2026-06-17

- 檔案真實類型檢測(file-type,category=anti-scam):讀檔案開頭「魔術位元組」判斷實際格式,與副檔名比對。
  抓出詐騙常見的「副檔名造假」—— 名為 照片.jpg 實為 Windows 執行檔(PE/MZ)會標🚫danger;類型不符標 mismatch、
  辨識不出標 unknown、相符標 ok。支援 PDF/PNG/JPEG/GIF/BMP/WebP、ZIP(含 docx/xlsx/apk 等 ZIP 封裝視為相符)、
  RAR/7z/gzip、舊 OLE Office、MP3/WAV/MP4/AVI、EXE/ELF/Mach-O 等;RIFF 系列與 MP4 offset 4 特判。
  明確聲明「非防毒、相符≠安全」,與 file-checksum 交叉連結。引擎 src/features/fileType.ts(純函式:detectType/
  getExtension/checkFile)+ 回歸測試 scripts/test-filetype.mjs(27 筆,併入 npm test)。只讀前 32 bytes、不上傳。
  零三方相依;type-check + test + build 通過 — 2026-06-17

- 合併列印 / 套印(mail-merge,category=workshop):一份範本(內含 {{欄位}} 佔位符)+ 一份名單(第一列欄位名,
  自動偵測逗號或 Tab、支援引號內逗號/換行/跳脫雙引號,可直接貼 Excel),幫每筆各產生填好內容的文字 —— 年節祝福、
  開會通知、繳費提醒、邀請函免逐一改名。回報範本欄位 / 缺漏欄位(缺者留空),逐筆或一次複製。線上套印服務常要上傳
  含個資名單,本工具全程瀏覽器、不上傳不寄送。引擎 src/features/mailMerge.ts(純函式:extractPlaceholders/parseTable/
  merge,內含最小 CSV/TSV 解析器)+ 回歸測試 scripts/test-mailmerge.mjs(23 筆,併入 npm test)。
  零三方相依;type-check + test + build 通過 — 2026-06-17

- 工時時數表(work-hours,category=labor):加總多段班別工時,自動處理跨午夜夜班(下班<=上班 → +24h)、
  扣除休息分鐘(休息≥工時則 0 不為負)、可選填時薪估算「原始工資」(時數×時薪,明示未含加班加成,連結 overtime-pay)。
  打工/排班族對帳薪資、報工時用。引擎 src/features/workHours.ts(純函式:parseTime/shiftMinutes/totalMinutes/
  formatHM/toDecimalHours/estimatePay)+ 回歸測試 scripts/test-workhours.mjs(24 筆,併入 npm test)。
  零三方相依;type-check + test + build 通過 — 2026-06-17

- 文字朗讀(text-speech,category=life,長輩友善):用瀏覽器內建 Web Speech API(speechSynthesis)把貼上的文字唸出來,
  給視力不便/眼睛累/想用聽的長輩與家人。中文語音優先排序、速度/音調可調、播放/暫停/繼續/停止、不支援時優雅降級提示。
  全程在裝置上發聲、文字不上傳、免帳號。UI-only(瀏覽器 API 無純邏輯可單元測,雲端無瀏覽器,靠 type-check + 細讀
  + 功能偵測與 graceful degradation 確保安全);零三方相依;type-check + build 通過 — 2026-06-17

- vCard 聯絡人產生器(vcard-maker,category=workshop):把單筆聯絡人,或一份 Excel/CSV 通訊錄(第一列欄位名)
  做成標準 vCard 3.0 的 .vcf,直接匯入 iPhone/Android/Google/Apple/Outlook 聯絡人,免逐筆手動新增。線上 CSV→vCard
  轉換器要把含姓名電話的個資名單上傳他人伺服器,本工具全程瀏覽器、不上傳(延續 mail-merge/data-convert/event-ics
  「不上傳含個資名單」DNA)。單筆表單 + 批次貼 Excel 兩模式;欄位名同義詞自動對應(姓名/手機/市話/Email/公司/職稱/
  地址/生日/網址/備註,中英文皆可,同欄位重複取第一個、其餘列未對應)。引擎 src/features/vcard.ts(純函式無 DOM:
  escapeText 依 RFC 6350 逸出反斜線/逗號/分號/換行、buildVCard/buildVCards、tableToContacts;CRLF 行尾、為免折行截斷
  中文不做 line folding、N/FN 顯示名 fallback、TEL CELL/HOME、ADR 街道欄、URL/BDAY 不逸出)+ 回歸測試
  scripts/test-vcard.mjs(43 筆:逸出/結構/姓名分合/全欄位/批次略過空白/表格對應/英文大小寫/重複欄/端到端,
  併入 npm test)。本環境 npm registry 已可安裝,實際跑通 type-check + 全測試 + build。零三方相依、不上傳 — 2026-06-17

- 日期計算機升級工作天試算(date-calc):工作日模式新增「放假日 / 補班日」自填(進階面板 CustomDays.vue),
  把交期/請款的工作天算準 —— 扣掉國定假日/公司休假、加回颱風補班/補行上班。引擎 dateCalc.ts 新增 BusinessOpts
  (holidays/workdays Set)、isWorkday(優先序:補班 > 假日 > 週末)、parseDateList(從文字抽合法 YYYY-MM-DD、去重濾無效);
  addBusinessDays/businessDaysBetween 接受 opts 且不帶 opts 時與舊行為完全相同(向後相容)。
  刻意**不內建台灣國定假日**(假日年年不同、雲端沙盒無法驗證官方來源,寫死易誤導)→ 改由使用者依人事行政總處
  辦公日曆表自填、附官方連結,延續「資料可驗證」原則。回歸測試 test-datecalc.mjs +13 筆(parseDateList/isWorkday
  優先序/加扣假日/計補班/無 opts 向後相容)。零新相依;type-check + 全測試 + build 通過 — 2026-06-17

- PDF 工坊「整理頁面」支援逐頁旋轉(pdf-studio/Organize):每頁新增順/逆時針 90° 旋轉鈕,縮圖即時
  CSS transform 預覽,匯出時把旋轉燒進 PDF。lib.ts buildFromOrder 新增 rotations 參數(與 order 等長),
  用 pdf-lib getRotation().angle + delta 正規化後 setRotation(degrees);Organize 以 rot 陣列與 order 同步維護
  (刪除/移動/復原一起 splice/swap)。解決手機/掃描器拍歪的文件要轉正的常見痛點;零新相依(複用既有 pdf-lib)。
  type-check + 全測試 + build 通過 — 2026-06-17

- 音訊工坊(audio-studio,category=workshop):載入音檔(mp3/m4a/wav/ogg/aac…),裁剪片段、淡入淡出、
  音量增減(dB)、峰值正規化、轉單聲道,匯出無失真 16-bit PCM WAV。做手機鈴聲、剪訪談/會議前後空白、
  截一段音訊都好用。與「錄音機」「螢幕錄影」(擷取)互補(這支是編輯)。解碼交給瀏覽器
  AudioContext.decodeAudioData(支援格式依瀏覽器),其餘為純前端運算。處理管線:裁剪→淡化→增益→正規化→單聲道。
  引擎 src/features/audioStudio.ts(encodeWav/decodeWav/sliceAudio/applyGain/applyFade/normalize/mixToMono/
  duration/estimateWavBytes 純函式無 DOM:WAV 為手寫 DataView header + 交錯 16-bit、-1/+1 對稱映射,
  decodeWav 掃 chunk 找 fmt/data 供測試讀回)+ 回歸測試 scripts/test-audiostudio.mjs(26 筆:量測/WAV 編解碼
  來回誤差在量化精度內/非 WAV 報錯/裁剪夾範圍與空段/增益夾不破音/淡入淡出端點為 0 中點半值/正規化峰值≈0.99
  與全靜音不爆 NaN/轉單聲道為平均,以 esbuild 打包後跑,併入 npm test)。零新相依、音檔不上傳;
  type-check + 全測試 + build 通過 — 2026-06-18

- PDF 工坊新增「併頁省紙(N-up)」分頁(pdf-studio/NUp):把多頁 PDF 縮排到每張 A4 放 2/4/6/9 頁
  (2-up 橫式並排、4/6/9 直式格線),印講義、校稿、省紙最實用 —— 線上 N-up 工具多半要上傳檔案。
  來源頁面等比例縮放、置中塞格不變形;不足一張的最後幾格留白。版面幾何抽成純函式 nupLayout.ts
  (A4/sheetLayout/cellBox 由左到右上到下、PDF 左下原點/fitInto 等比置中,無 pdf-lib、無 DOM 可 Node 測);
  lib.ts 新增 nUpPdf 用 pdf-lib embedPages + drawPage 把幾何畫成實體頁。限制:pdf-lib 嵌入頁不套來源
  /Rotate,旋轉頁建議先用「整理頁面」轉正(UI 已提示)。回歸測試 scripts/test-pdfnup.mjs(32 筆:
  各 preset 方向/格線/退回 2-up、格子位置與邊界、換列、fitInto 置中與維持寬高比/邊界不超出/零尺寸不爆,
  esbuild 打包後跑,併入 npm test)。零新相依(複用既有 pdf-lib);type-check + 全測試 + build 通過 — 2026-06-18

- PDF 工坊新增「簽名 / 蓋章」分頁(pdf-studio/SignStamp):把簽名檔或印章圖片直接蓋到 PDF 頁面上 ——
  在頁面預覽圖(pdfjs renderThumbnails maxEdge 1100)上拖曳定位、滑桿調大小,可只蓋當前頁或勾選「每一頁都蓋」
  (印章/騎縫)。閉合既有流程:用本站「手寫簽名製作」做透明背景 PNG → 在此蓋到合約,全程不上傳。
  與「PDF 浮水印」(整頁重複加註防盜)互補,這支是「在指定位置簽一次名/蓋一個章」。座標幾何抽成純函式
  signLayout.ts(clamp/heightFrac/clampBox/centerBox/imagePlacement:畫面左上原點比例 → pdf-lib 左下原點 pt,
  維持原圖長寬比、夾在頁內;無 pdf-lib、無 DOM 可 Node 測);lib.ts 新增 stampImageOnPdf(embedPng/Jpg + drawImage)
  與 getPageRotations(供 UI 提醒旋轉頁會偏移)。限制:pdf-lib 在 MediaBox(未套 /Rotate)作圖,旋轉頁位置會偏,
  偵測到即提示先用「整理頁面」轉正。回歸測試 scripts/test-signlayout.mjs(23 筆:clamp/heightFrac/左上與右下與
  置中座標/畫面往下對應 pdf y 變小/clampBox 夾邊界後不超出上下左右/寬度上下限,esbuild 打包後跑,併入 npm test)。
  零新相依(複用既有 pdf-lib + pdfjs-dist);type-check + 全測試 + build 通過 — 2026-06-18

- 影片轉 GIF(video-gif,category=workshop):把一小段影片(MP4/WebM/MOV…)轉成會動的 GIF ——
  用 <video> 逐點 seek + Canvas drawImage 取 RGBA + 既有 gifenc 編碼,全程在瀏覽器、影片不上傳、
  無廣告、無浮水印、不限時長。零新相依(複用 gifStudio.ts 的 encodeGif/planCanvasSize/fpsToDelay)。
  UI:內嵌 <video controls> 可拖到位置,一鍵「設為開始/結束」裁時間區間;寬度/fps/顏色數/循環可調;
  即時顯示預計影格數,超過 MAX_FRAMES=300 提示縮短區間。取樣規劃抽成純函式 planVideoFrameTimes
  (起點起以 1/fps 等間隔取樣到結束前、超上限截斷、四捨五入到毫秒;與 DOM 無關可 Node 測),
  併入 scripts/test-gifstudio.mjs +18 筆(影格數/起點偏移/遞增/截斷/極短至少 1 張/錯誤處理/fps 夾限)。
  seek 以 'seeked' 事件 + 1.5s 逾時保險;getContext willReadFrequently。與 gif-studio(多張圖片→GIF)
  互補。type-check + 全測試 + build 通過 — 2026-06-18

- IG 九宮格切圖(image-grid,category=workshop):把一張大圖切成 cols×rows 格,依序發到 Instagram
  主頁拼成一整張大圖牆。純 Canvas 裁切、圖片不上傳、無廣告、無浮水印。幾何抽成純函式 imageGrid.ts
  (computeCoverCrop 以中心 cover 裁切到 cols:rows 比例;planGridTiles 回每格來源矩形 + displayIndex +
  postOrder——IG 新貼文排最前故 postOrder=total−displayIndex+1,先貼右下、主頁才由左上拼起;無 DOM 可 Node 測)
  + 回歸測試 scripts/test-imagegrid.mjs(24 筆:寬/高圖裁切置中、3:1/3:2 比例、裁切不超界、格數/面積總和/
  相鄰無縫接續/postOrder 排列/錯誤處理,esbuild 打包後跑,併入 npm test)。預覽框即時顯示保留範圍與格線;
  JPG/PNG、品質可調;打包 ZIP 動態 import 既有 buildZip(STORE)。零新相依;type-check + 全測試 + build 通過 — 2026-06-18

- 表格拆分(table-split,category=workshop):把一份大 CSV/Excel 表格拆成多份 —— 兩種模式:
  (1)按列數平均切(每 N 列一份,表頭帶進每份),(2)按某欄的值分組(同值歸一份,檔名=該欄值,
  可選忽略大小寫、可選輸出時移除分組欄)。匯出可打包 ZIP(每份一個 CSV/JSON,複用 zipStudio.buildZip)
  或匯出單一多工作表 Excel(xlsx.ts 新增 sheetsToExcelBlob,工作表名清非法字元/夾 31 字/去重)。
  Excel 讀檔走既有 data-convert/xlsx 動態 import(sheet-vendor chunk,不預快取)。引擎
  src/features/tableSplit.ts(safeFileName/splitByRows/splitByColumn/uniqueFileNames 純函式無 DOM,
  Table 型別複用 tableClean;splitByColumn 以首見順序穩定分組、空值歸一組)+ 回歸測試
  scripts/test-tablesplit.mjs(40 筆:檔名清理/補零份號/不漏列/邊界、首見順序/空值/dropKeyColumn/
  大小寫/欄超界、唯一檔名加序號,esbuild 打包後跑,併入 npm test)。與 table-clean(清理)、
  data-convert(格式互轉)、list-compare(比對)互補,補上「一份拆多份」的缺口;不上傳。
  零新相依;type-check + 全測試 + build 通過 — 2026-06-18
- 批次檔案改名(batch-rename,category=workshop):一次替整批檔案改名 —— 尋找取代(字面比對、可忽略大小寫、
  取代全部出現)、主檔名大小寫轉換、加前/後綴、加流水號(起始/遞增/補零/前後位置/分隔字串)。即時預覽舊→新,
  打包成 ZIP 下載(瀏覽器無法直接改寫硬碟檔名,以 zipStudio.buildZip level 0 STORE 重新打包)。選檔時以
  localeCompare numeric 自然排序,讓流水號順序符合直覺;副檔名(最後一個點後)預設保留不被規則動到;算出同名
  自動加「(2)」不覆蓋(忽略大小寫比對對應 Win/mac 檔案系統)。規則順序:取代→大小寫→前後綴→流水號→補唯一。
  引擎 src/features/batchRename.ts(splitExtension/computeNewNames 純函式無 DOM,escapeRegExp 讓特殊字元字面比對)
  + 回歸測試 scripts/test-batchrename.mjs(30 筆:拆副檔名/前後綴/取代各情境/大小寫只動主檔名/流水號補零起始遞增
  前後綴負值 step0/組合/keepExtension/去重含大小寫與取代衝突/邊界空清單與空主檔名,esbuild 打包後跑,併入 npm test)。
  零新相依(複用既有 jszip);type-check + 全測試 + build 通過 — 2026-06-18

- 文件掃描美化(doc-scan,category=workshop):把手機拍的文件照片處理成像掃描機掃出來的乾淨檔 ——
  三種模式:彩色增強(自動對比拉伸 + 提亮背景,保留印章/螢光筆顏色)、灰階、黑白(自適應門檻二值化,
  用積分圖 O(1) 算局部平均對抗不均勻光照,把字變純黑、紙變純白、檔案最小)。可多張排序、合併成多頁 PDF
  或各頁匯出 JPG。CamScanner 等手機掃描 App 要付費訂閱、輸出加浮水印又夾廣告,且把私密合約/單據上傳;
  本工具全程在瀏覽器以 Canvas + 純像素演算法處理、不上傳、無浮水印、免註冊。引擎 src/features/docScan.ts
  (luma/toGray/percentileBounds/adaptiveThreshold/applyScan 純函式無 DOM,applyScan 不更動輸入像素以便反覆套用)
  + 回歸測試 scripts/test-docscan.mjs(24 筆:luma 權重/灰階/直方圖百分位界與裁切/全相同回退/積分圖自適應門檻
  均勻全白與暗點判黑/輸出僅 0-255/三模式輸出格式與不破壞原圖/對比拉伸/強度夾住,esbuild 打包後跑,併入 npm test)。
  PDF 匯出走既有 pdf-lib 動態 import(pdf-vendor chunk,不預快取),零新相依;type-check + 全測試(1017 筆)
  + build 通過 — 2026-06-18

- 批次 QR Code(qr-batch,category=workshop):一份清單(每行一筆)一次做成很多個 QR ——
  兩種輸出:(1)打包成 ZIP(每筆一張 512px PNG,檔名取自標籤或內容),(2)排成可直接列印的 A4 標籤頁 PDF
  (自訂每頁欄列數、QR 下方可印英數標籤)。可勾選「逗號/Tab 分標籤,內容」讓每筆帶名稱。活動桌號、座位、
  財產編號、商品/菜單/問卷連結用得上。全程在瀏覽器以 qrcode 函式庫產生,清單不上傳、直接編碼原始內容不轉址不追蹤
  (有別於會偷換短網址的線上產生器)。引擎 src/features/qrBatch.ts(parseEntries/safeName/planSheet 純函式無 DOM,
  planSheet 以左上原點算格子、呼叫端換成 pdf-lib 左下原點)+ 回歸測試 scripts/test-qrbatch.mjs(28 筆:
  多行解析/空行/逗號與 Tab 分隔/只切第一個分隔符/檔名清理去路徑字元收斂底線去前後點夾長度/版面數量與換頁
  不超界格寬計算/欄數 0 與邊界過大報錯,esbuild 打包後跑,併入 npm test)。複用既有 zipStudio.buildZip 打包、
  pdf-lib 動態 import,零新相依;PDF 內建字型不含中文,中文標籤在 PDF 上略過(QR 與 ZIP 檔名仍完整支援中文)。
  與單張「QR Code 產生器」互補。type-check + 全測試(1044 筆)+ build 通過 — 2026-06-18

- 色盲友善檢測(color-blind,category=workshop):上傳圖表/簡報/網頁截圖/地圖,左右並排顯示「原圖 vs 色覺障礙者看到的樣子」,
  檢查紅綠等配色是否仍分得出來(台灣約每 12 位男性 1 位紅綠色覺異常)。四型別:綠色盲(deuteranopia,最常見)、
  紅色盲(protanopia)、藍色盲(tritanopia)、全色盲(achromatopsia,灰階);程度 0–100 以「原色↔全模擬」線性混合模擬色弱。
  採 Machado, Oliveira & Fielding (2009) 廣用的 sRGB 色彩矩陣(severity=1.0),直接作用於 gamma 編碼 sRGB(實務近似);
  全色盲走 Rec.601 luma。線上模擬站(如 Coblis)要上傳圖片;本工具全程瀏覽器 Canvas + 純像素運算、不上傳、可下載模擬 PNG。
  引擎 src/features/colorBlind.ts(clamp255/luma/simulateColor/simulatePixels/colorDistance 純函式無 DOM,
  simulatePixels 不更動輸入、alpha 原樣保留)+ 回歸測試 scripts/test-colorblind.mjs(35 筆:夾值/luma 權重/severity 0 回原色/
  灰與黑白在各型別維持/全色盲三通道相等=luma/紅綠在綠盲紅盲下距離縮小/severity 中間值介於原色與全模擬/距離對稱/
  像素長度與 alpha 保留與不更動輸入,esbuild 打包後跑,併入 npm test)。零新相依;與 contrast-check 互補(對比 vs 色相);
  type-check + 全測試 + build 通過 — 2026-06-18

- JSON ↔ YAML 互轉(json-yaml,category=workshop):雙向轉換,k8s / docker-compose / GitHub Actions / 應用設定檔
  常含 API 金鑰、密碼、內部網址,線上轉換器要上傳;本工具全程瀏覽器轉換、不上傳,可選 2/4 空格縮排或 JSON 壓成一行、
  複製/下載、「拿結果反向驗證」(把結果搬回輸入並對調方向確認來回一致)。解析序列化交給成熟 js-yaml(避免自刻 parser
  把設定轉錯),薄包裝負責統一錯誤訊息(含行號)、擋多份文件(---)給清楚提示、空輸入提示。引擎 src/features/jsonYaml.ts
  (jsonToYaml/yamlToJson 純函式無 DOM,回 {ok,output,error} 不丟例外)+ 回歸測試 scripts/test-jsonyaml.mjs(27 筆:
  基本/巢狀/陣列/來回一致含中文與含冒號井號字串/縮排選項/空與註解 null/無效 JSON 與 YAML 不丟例外/多份文件提示/
  帶引號版本維持字串,esbuild 打包後跑,併入 npm test)。js-yaml 動態 import + yaml-vendor chunk 不預快取(已驗證未進
  precache);補足 data-convert/json-flatten/markdown-table 不含 YAML 的缺口;type-check + 全測試 + build 通過 — 2026-06-18

- 照片壓到指定大小(image-fit-size,category=workshop):台灣報名/考試/政府/公司上傳系統常規定「照片不得超過 ○○ KB」,
  一般工具只有品質滑桿要自己反覆試;本工具用二分搜尋自動找出「大小上限內、JPEG 畫質最高」的品質設定,
  可一併限制最長邊(px),支援多檔逐張壓到同一上限。若連最低品質都還超標,會逐步縮小尺寸(×0.82,最多 8 輪、不縮到 ≤200px)
  再試,並如實標示「已達標 / 已是最小仍略大」。透明背景填白(JPG 無透明)。搜尋演算法 src/features/imageFit.ts
  (fmtSize/fitScale/searchQuality 純函式無 DOM,searchQuality 以注入的 measure 回呼編碼、與瀏覽器無關;maxQ 已達標只量一次、
  連 minQ 都超標回 underTarget=false)+ 回歸測試 scripts/test-imagefit.mjs(21 筆:大小格式化/縮放比例/線性與非線性編碼器找最高達標品質/
  邊界相等視為達標/maxQ 早停只量一次/壓不下回 minQ/async measure,esbuild 打包後跑,併入 npm test)。
  與 image-studio(固定品質)、id-photo(固定沖洗尺寸)互補,補上「壓到指定 KB」缺口;零新相依;type-check + 全測試 + build 通過 — 2026-06-18

- 照片個資清除 / 去 EXIF(exif-strip,category=anti-scam):不重新編碼、畫質完全不變,直接移除 JPEG/PNG 夾帶的
  EXIF/GPS 定位/XMP/IPTC/拍攝時間/相機型號/註解 —— 上傳社群、二手交易、論壇前先清掉,避免洩漏住家或公司位置。
  與 exif-viewer(只「看」夾帶什麼)、image-studio(靠重新壓縮順便去 EXIF 但會壓損畫質/改格式)互補:這支保留原始影像位元與
  ICC 色彩設定檔、原格式,只刪中繼資料段。引擎 src/features/exifStrip.ts(detectType/stripJpeg/stripPng/stripMetadata 純位元組
  無 DOM:JPEG 走標記掃描刪 APP1/APP13/COM、遇 SOS 後整段複製、解析異常原樣回傳不破壞;PNG 刪 tEXt/zTXt/iTXt/eXIf/tIME/dSIG
  chunk、IEND 後截斷)+ 回歸測試 scripts/test-exifstrip.mjs(21 筆:類型偵測/移除 Exif+COM 保留 JFIF+ICC+掃描資料/位元組數正確/
  等冪/無隱私段不變/截斷與超長段不破壞/PNG 移除 tEXt+eXIf 保留 iCCP+IDAT+IEND/IEND 後垃圾丟棄/派發與非影像回傳,esbuild 打包後跑,
  併入 npm test)。零新相依、不上傳、可批次;type-check + 全測試 + build 通過 — 2026-06-18

- Big5 ↔ UTF-8 文字檔轉換(big5-convert,category=workshop):早年 Windows 記事本以預設(ANSI=Big5)存的 .txt/.csv/.srt,
  拿到 Mac、手機、上傳網站或新程式打開中文變整片亂碼;本工具兩種編碼互轉、自動判斷來源編碼(looksLikeUtf8:能以 fatal UTF-8
  解碼即推測 UTF-8,否則當 Big5)、預覽偵測殘留 �、轉成 Big5 時回報無法表示的字。解碼用內建 TextDecoder('big5')(瀏覽器與
  Node 22 full-ICU 皆支援);UTF-8→Big5 編碼以「fatal Big5 解碼器逐一反建反查表(lead 0x81–0xFE × trail 0x40–7E/A1–FE,取最小碼位)」
  即時產生 Big5 編碼器,零相依、確定性,無法表示字以 '?' 代替並列出。與 mojibake-fix(救「UTF-8 被當西歐編碼」的 ä¸­æ–‡ 亂碼)
  互補:這支處理「整個檔案就是某編碼」的轉換。引擎 src/features/big5.ts(decodeBig5/decodeUtf8/encodeUtf8/encodeBig5/looksLikeUtf8
  純函式)+ 回歸測試 scripts/test-big5.mjs(19 筆:中文/ASCII 解編碼/round-trip/換行 tab 保留/emoji 與簡體字列 unmapped 並以 ? 代替/
  UTF-8 往返與位元組數/looksLikeUtf8 對 UTF-8 與 Big5 與 ASCII 判定/空輸入,esbuild 打包後跑,併入 npm test)。
  type-check + 全測試 + build 通過 — 2026-06-18

- 測試假資料產生器(fake-data,category=workshop):一鍵產生大量「擬真但完全虛構」的台灣個資樣本
  (姓名、性別、身分證、生日、手機、市話、Email、地址、公司、統一編號),給開發/測試/教學/示範填表單用 ——
  開發測試不該拿真客戶個資去測系統。重點:身分證字號與統一編號都帶「正確檢查碼」,能通過一般系統格式驗證,
  但隨機湊出、不對應任何真人或真公司(檢查碼正確 ≠ 真實存在)。可填「種子」重現同一批(同種子=同結果),
  匯出 CSV(加 BOM 防 Excel 中文亂碼)/JSON。引擎 src/features/fakeData.ts(mulberry32 可重現亂數 + seedFromString +
  genTwId/genVat/genMobile/genLandline/genName/genEmail/genBirthday/genAddress/genCompany + generate/rowsToCsv 純函式無 DOM;
  身分證末碼權重 1 反推使加權和被 10 整除、統編末碼選使位元乘積數字和被 5 整除)。為共用而新增 src/features/twId.ts
  (抽出 LETTER/REGION 對照表 + isValidTwId,未改動既有 tw-id-check)。回歸測試 scripts/test-fakedata.mjs(24 筆:
  2000 筆身分證/統編分別餵獨立驗證器 isValidTwId/isValidVat 全通過、性別碼與身分證一致、同種子可重現/異種子不同、
  各欄位格式與年齡範圍、CSV 表頭/逗號引號跳脫/空資料、seedFromString 穩定,esbuild 打包後跑,併入 npm test)。
  零新相依、不上傳;type-check + 全測試 + build 通過 — 2026-06-18

- 截圖美化(screenshot-beautify,category=workshop):幫陽春螢幕截圖加上漸層/純色/透明背景留白、圓角、陰影、
  Mac 風格視窗列(紅黃綠燈),貼進簡報/社群/部落格/教學文件立刻變專業;可直接 Ctrl+V 貼上或拖曳,
  選輸出比例(原比例/1:1/16:9/4:3/3:2/9:16)直接配合 IG/YT 縮圖等版位,即時預覽、下載 PNG 或複製到剪貼簿。
  線上截圖美化站多半要上傳圖片、加浮水印或要付費;本工具全程在瀏覽器用 Canvas 合成、不上傳、無廣告、無浮水印。
  純前端零新相依(內建 9 組漸層 + roundRect 自繪);記憶體保護:輸出最長邊上限 6000px 超過則整體等比縮小;
  透明背景輸出 PNG、預覽區用棋盤格底襯托。type-check + 全測試(162)+ build 通過 — 2026-06-18

- 英文金額大寫(amount-english,category=life):把金額轉成英文文字寫法,供外銷發票(commercial invoice)、
  外幣支票、信用狀(L/C)、英文合約使用(金額一律要並列英文文字防竄改)。輸出兩種:支票/發票寫法
  (幣別 + 全大寫英文 + AND NN/100 + ONLY,如 USD ONE THOUSAND TWO HUNDRED THIRTY-FOUR AND 56/100 ONLY)、
  純文字小寫;小數可選 56/100(支票常見)或 fifty-six cents 文字。幣別選單 USD/NT DOLLARS/EUR/JPY 等。
  與 num-to-chinese(中文金額大寫)互補。引擎 src/features/amountEnglish.ts(integerToEnglish 美式短級數
  thousand/million/billion/trillion 至 quadrillion、threeDigitsToWords、amountToEnglish 純函式無 DOM,
  四捨五入到分、千分位逗號容錯、負數/非數字丟錯)+ 回歸測試 scripts/test-amountenglish.mjs(35 筆:
  0~兆級整數/連字號/hundred 無 and/小數 fraction 與 words 模式/單數 cent/幣別大寫/進位/逗號/錯誤處理,
  esbuild 打包後跑,併入 npm test)。零新相依、不上傳;type-check + 全測試(197)+ build 通過 — 2026-06-18

- SQL 語法產生器(sql-insert,category=workshop):把 Excel/CSV/試算表(第一列為欄位名)一鍵轉成 INSERT 語句,
  可一併產生 CREATE TABLE。難點在「乾淨正確」:字串單引號跳脫(' → '')、MySQL 額外跳脫反斜線、空欄轉 NULL、
  數字不加引號,但「開頭是 0 的整數」(電話/統編/郵遞區號)與超過 18 位整數一律保留為字串避免掉開頭/失精度;
  整欄推斷型別(int/decimal/bool/string),布林依方言輸出 1/0 或 TRUE/FALSE;識別字引號 MySQL 反引號、
  其餘雙引號(皆跳脫);多列合併一句(可設 batchSize 切句)或每列一句;支援 MySQL/PostgreSQL/SQLite/標準 SQL。
  線上轉 SQL 服務常要上傳可能含個資的整份資料;本工具全程在瀏覽器、不上傳。引擎 src/features/sqlInsert.ts
  (parseTable/inferColumnType/inferTypes/quoteIdent/formatValue/generateInserts/generateCreateTable/generateSQL
  純函式無 DOM,複用 data-convert 的 parseCSV)+ 回歸測試 scripts/test-sqlinsert.mjs(57 筆:解析/TSV/型別推斷含
  前導0與過長整數/各方言引號與布林/引號跳脫/空值NULL與emptyAsNull/多列與每列與batch/CREATE型別/中文表名/
  端到端,esbuild 打包後跑,併入 npm test)。零新相依、不上傳;type-check + 全測試(254)+ build 通過 — 2026-06-18

- Cron 表達式解讀(cron-explain,category=workshop):輸入 5 欄位 cron(分 時 日 月 週),用白話中文說明,
  並算出接下來 5 次實際執行時間(本機時區)。crontab.guru 很好用但只有英文;這裡中文解讀 + 下次執行時間,
  設 crontab/GitHub Actions/CronJob 排程不再猜。支援 * , - */n、範圍加步進(0-30/10)、a/n 至上限、
  月份/星期英文名(jan、mon-fri)、週日 7=0、@daily/@hourly 等捷徑;正確處理 cron 的「日與週同時限定時任一符合即執行」
  OR 語意。nextRuns 用欄位逐級跳轉(月→日→時→分)快速收斂、有迴圈上限保護,遇不存在的日期組合(2月30)回空陣列。
  引擎 src/features/cron.ts(parseCron/describeCron/nextRuns/dayMatches 純函式無 DOM,零相依)+ 回歸測試
  scripts/test-cron.mjs(39 筆:各種欄位語法/英文名/捷徑/5 種錯誤處理/描述關鍵字/nextRuns 每分鐘/每天/每週一/
  每月15/只在2月/dom+dow OR/每15分,以固定基準日 + 相對關係驗證避免時區依賴,esbuild 打包後跑,併入 npm test)。
  零新相依、不上傳;type-check + 全測試(293)+ build 通過 — 2026-06-18

- JSON 結構比對(json-diff,category=workshop):貼上兩份 JSON,列出新增/刪除/變更的欄位與完整路徑
  (user.tags[1]、特殊字元鍵用 ["a-b"])。做「語意層級」比對:物件鍵不分順序、排版差異忽略,
  不像逐行 diff(text-diff)易被格式干擾;陣列依索引比、型別改變(數字↔字串、物件↔陣列、null↔0)算 changed。
  比對兩次 API 回應、兩版設定檔差在哪很實用。引擎 src/features/jsonDiff.ts(deepEqual/diffValues/compareJSON/
  preview 純函式無 DOM、零相依;diffValues 遞迴物件鍵聯集 + 陣列補長 + 葉節點型別比)+ 回歸測試
  scripts/test-jsondiff.mjs(30 筆:相同/鍵序無關/巢狀路徑/新增刪除/陣列增刪改/型別變更/特殊字元與中文鍵/
  根層級/compareJSON 解析錯誤兩側/摘要計數/preview,esbuild 打包後跑,併入 npm test)。零新相依、不上傳;
  type-check + 全測試(323)+ build 通過 — 2026-06-18

- JSON 轉 TypeScript 型別(json-to-ts,category=workshop):貼上 JSON,自動推斷出對應的 TS interface。
  巢狀物件各自產生具名 interface(依鍵 PascalCase、衝突自動加序號);陣列內多筆物件「合併」成一個型別 ——
  鍵聯集、缺漏鍵標可選(?)、同鍵不同型別合成聯集(a | b);陣列元素 interface 用單數命名(items→Item);
  不合法識別字鍵(連字號/數字開頭/中文)自動加引號;根為陣列或基本值改用 type 別名;空陣列→unknown[]。
  quicktype 太重又多在線上;這支輕量、不上傳。引擎 src/features/jsonToTs.ts(typeForValues/mergeObjects 互遞迴、
  pascalCase/singular/uniqueName 純函式無 DOM、零相依)+ 回歸測試 scripts/test-jsontots.mjs(32 筆:
  基本型別/null/陣列/混合聯集/巢狀具名/陣列合併與可選/同鍵聯集/特殊字元鍵/根陣列與基本值/名稱衝突/空值/
  錯誤處理/深層巢狀,esbuild 打包後跑,併入 npm test)。零新相依、不上傳;type-check + 全測試(355)+ build 通過 — 2026-06-18

- JWT 解碼 / 檢視(jwt-decode,category=workshop):把 JSON Web Token 解開成標頭(header)與內容(payload),
  整理 iss/sub/aud/exp/nbf/iat/jti 等註冊宣告(附友善說明),把 exp/iat/nbf 的 Unix 秒數翻成本地+UTC 可讀時間,
  並直接判斷 Token 是否已過期、尚未生效或有效中(綠/紅/琥珀狀態列)。可在本機用密鑰驗證 HMAC(HS256/384/512)
  簽章 —— 用 Web Crypto subtle 算 HMAC 後與第三段比對(timing-safe),確認沒被竄改;RS/ES 非對稱簽章需公鑰,不處理。
  核心價值 = 安全:很多工程師習慣把「正式環境的存取權杖」貼進 jwt.io 等線上網站,等於把可登入系統的憑證交給第三方;
  本工具全程在瀏覽器、不連網、不上傳。並提醒 payload 只是 Base64 編碼、非加密,任何人都讀得到。
  支援去掉 Bearer 前綴、偵測 JWE 五段式(內容已加密無法解)。引擎 src/features/jwt.ts
  (base64UrlToString/decodeJwt/tokenStatus/humanizeDuration/formatUnix/verifyHmac,純函式 + Web Crypto)+
  回歸測試 scripts/test-jwt.mjs(37 筆:base64url 中文/經典 token 各欄位/Bearer 前綴/空字串/段數/JWE 五段/
  非 base64url/payload 非 JSON/含空白等錯誤/有效期過期-生效-無 exp/nbf 優先/humanize/formatUnix/
  HS256-384-512 正確與錯誤密鑰來回驗證/RS256 不支援,esbuild 打包後跑,併入 npm test)。
  零新相依、不上傳;type-check + 全測試(392)+ build 通過 — 2026-06-18

- 隱形字元 / Unicode 檢視器(char-inspect,category=workshop):貼上文字,逐「字元」(以碼位計,正確處理
  emoji/代理對)攤開,標出零寬/格式類看不見字元、非半形空白(NBSP/全形)、文字方向控制字元(bidi,可視覺
  倒置偽造副檔名)、形近字(西里爾 а/希臘 ο 冒充拉丁 a/o,釣魚網址與假冒帳號常用,並指出它在模仿哪個 ASCII)。
  解決「兩字串看起來一樣卻不相等」除錯、防冒名;可一鍵清理(刪隱形字元/正規化空白/還原形近字)。顯示碼位數/
  UTF-16 長度/UTF-8 位元組三種計數。與 text-clean(批次清理)互補,這支著重逐字檢視辨識。引擎
  src/features/charInspect.ts(inspect/clean 純函式無 DOM,含形近字對照表 CONFUSABLES、bidi/零寬/異常空白集合、
  區塊命名)+ 回歸測試 scripts/test-charinspect.mjs(36 筆:計數/emoji 碼位與位元組/零寬/BOM/NBSP 與全形/RLO/
  控制字元/西里爾與希臘形近字/區塊命名/clean 各選項與並用/空字串,esbuild 打包後跑,併入 npm test)。
  零新相依、不上傳;type-check + 全測試(428)+ build 通過 — 2026-06-18

- 文字統計 / 字數統計(text-stats,category=workshop):貼上文章,正確算出中文字數(逐字計漢字,不像多數
  英文邏輯的線上工具用空白切詞而把「你好世界」算成 0 或 1)、英文單字、字元(含/不含空白)、數字串、標點、
  行/非空行/段落/句數、UTF-8 位元組、預估默讀/朗讀時間;並可選計算依據(總字數/中文字/含空白字元/不含空白)
  設字數上限即時倒數,超過提醒 —— 作文、自傳、書審資料、社群貼文的字數限制好用,敏感草稿不上傳。
  引擎 src/features/textStats.ts(analyzeText/formatDuration 純函式無 DOM:漢字用 \p{Script=Han} 逐碼位、
  英文詞用 [A-Za-z]+ 允許 '/- 連接、數字串吃小數與千分位、句末標點以 lookaround 排除小數點、UTF-8 用
  TextEncoder、閱讀時間中文 5 字/秒英文 3.3 詞/秒估算)+ 回歸測試 scripts/test-textstats.mjs(41 筆:空字串/
  純中文逐字與位元組/純英文與縮寫連字號/中英混合/數字串與小數不誤判句號/標點/行段落含空行/全形空白/emoji 碼位/
  多種句末標點/閱讀時間單調/formatDuration,esbuild 打包後跑,併入 npm test)。零新相依、不上傳;
  與 text-clean(清理)、char-inspect(逐字檢視)互補,這支著重整篇字數統計;type-check + 全測試 + build 通過 — 2026-06-18

- 清單加工(line-tools,category=workshop):把貼上的一欄資料(每行一筆,常從 Excel 複製)變成可直接貼用的
  清單 —— SQL IN 清單 ('a','b')、逗號清單、JSON 字串陣列、Markdown/編號清單;支援逐行去空白、刪空白行、去重
  (保留首次)、每行加引號(single 用 SQL 慣例把 ' 逸出成 ''、double/backtick 用反斜線逸出)、加前後綴、加編號
  (起始可調)、自訂連接字元、整體外框((...) [...])。6 個一鍵範本。解決工程師/行政把一欄值快速變成能貼進
  SQL/程式/表單清單的痛點,線上「逗號清單產生器」常滿廣告又要你貼上內部 ID。引擎 src/features/lineTools.ts
  (processLines/applyQuote/PRESETS 純函式無 DOM)+ 回歸測試 scripts/test-linetools.mjs(28 筆:trim/刪空白/去重順序/
  四種引號與逸出/前後綴/編號位置/連接/外框/六個 preset/空字串,esbuild 打包後跑,併入 npm test)。零新相依、不上傳;
  與 list-compare(比對去重)、table-clean(表格清理)互補,這支專做把一欄值串成可貼清單;type-check + 全測試 + build 通過 — 2026-06-18

- 正規表達式測試器(regex-tester,category=workshop):即時用底色標示 pattern 在測試文字裡比對到哪些片段
  (whitespace-pre-wrap 切段標示、零寬比對防無限迴圈),並列出每處的擷取群組與具名群組;同時把整串 pattern
  逐段拆成「原始片段 + 白話中文說明」(錨點/字元類/量詞/群組/字元集合/跳脫/交替/回溯參照,依 kind 上色)——
  延續 cron-explain「把符號翻成中文」的價值,不只是又一個 regex 測試站。flags 用核取方塊(g/i/m/s/u 附說明)。
  引擎 src/features/regexExplain.ts(explainRegex 手寫 tokenizer 走訪 pattern、合併連續字面、處理 [...] 集合與
  範圍/否定/開頭]、(?: (?= (?<= 等群組前綴、\d \b 簡寫、\1 與 \k<name> 回溯、{n,m} 量詞與惰性 ?;matchAll
  包原生 RegExp 供 UI;純函式無 DOM,以 new RegExp 驗證合法性)+ 回歸測試 scripts/test-regexexplain.mjs
  (38 筆:字面合併/各類字元類與錨點/量詞含惰性/字元集合範圍與否定/各種群組與具名/數字與具名回溯/交替/跳脫/
  不合法 pattern 與 flags 報錯/email 樣式/matchAll 全域與群組與具名與 i 旗標與零寬,esbuild 打包後跑,併入 npm test)。
  零新相依、不上傳;與 cron-explain/json-* 等開發者工具叢集互補;type-check + 全測試 + build 通過 — 2026-06-18

- Unix 時間戳記轉換(timestamp-convert,category=workshop):雙向(時間戳記→日期 / 日期→時間戳記)。
  輸入純數字自動依數值大小判斷單位(秒 <1e11 / 毫秒 <1e14 / 微秒),免自己數位數乘除 1000;
  同時輸出「你的時區/台灣 UTC+8/UTC/ISO 8601」與白話相對時間,點任一格可複製;首頁含每秒更新的現在時間戳記、
  一鍵帶入。引擎 src/features/timestampConvert.ts(parseEpoch/parseDateString/epochInUnit/formatInOffset 以
  UTC 平移實作任意時區牆上時間/toISO/relativeFromNow 純函式無 DOM、now 可注入)+ 回歸測試
  scripts/test-timestampconvert.mjs(30 筆:秒/毫秒/微秒判斷與還原/0/負數/千分位/空白/非數字與小數報錯/
  ISO 與空格分隔解析/台灣與 UTC 與負偏移跨日格式/星期/toISO/相對時間各級距,esbuild 打包後跑,併入 npm test)。
  零新相依、不上傳;與 timezone(世界時鐘)互補,這支專做 epoch↔日期;type-check + 全測試 + build 通過 — 2026-06-18

- 推薦好站(Picks)擴充 22→32 筆:新增「政府 ‧ 官方服務」分類 8 筆(全國法規資料庫、勞保局、健保署、
  電子發票整合平台、戶政司、公路監理服務網、中華郵政、臺銀牌告匯率)—— 強化防詐:長輩搜「監理站/包裹/罰單」常被
  假冒釣魚站洗版,這裡只放可信官網,note 提醒「認明官網、別點簡訊連結」;另補學習(均一教育平台)、文件生產力
  (LibreOffice)各 1 筆。純資料(public/data/picks.json),沿用既有 Picks.vue 容錯讀檔與分類分組,
  電子發票/勞保/健保/法規連結與站內 invoice-lottery/勞動/稅健工具互相呼應;JSON 驗證(無重複 id、欄位齊、URL 合法)
  + type-check + build 通過 — 2026-06-19

- 防詐騙下載中心擴充 32→38 軟體:新增 Thunderbird(免費郵件)、Notepad++、Bitwarden(密碼管理,
  安全防護)、HandBrake(影片轉檔)、Audacity(音訊編輯)、Brave 瀏覽器,皆附官方網域與「認明官網」提醒;
  Notepad++/HandBrake/Audacity 加 github 欄位(release tag 乾淨),併入每日版本自動更新;Bitwarden/Brave/Thunderbird
  因 release channel 較雜暫不自動抓版本。純資料(public/data/software.json),JSON 驗證(無重複 id、URL 合法)通過 — 2026-06-19

- Base64 / Data URI 圖片互轉(image-base64,category=workshop):雙向。編碼把圖片檔(FileReader.readAsDataURL)
  轉成 data URI,附純 Base64、HTML `<img>`、CSS `background-image`、Markdown 四種現成片段一鍵複製,顯示原檔→
  Data URI 大小(說明 Base64 放大約 33%)、超過 10KB 提醒大圖不宜內嵌(無法快取);解碼貼上 data URI 或純 Base64
  (自動清換行/空白、容許有無 data: 前綴),以 atob 還原位元組後依「魔術位元組」辨識真實格式(PNG/JPG/GIF/WebP/
  BMP/SVG,不信任宣告的 MIME),預覽並用正確副檔名下載;非圖片或無效 Base64 給明確錯誤。零三方相依、不上傳
  (線上 Base64 圖片工具多半要上傳又夾廣告);type-check + build 通過 — 2026-06-19

- SVG → PNG / 點陣圖匯出(svg-to-png,category=workshop):貼上 SVG 原始碼或選 .svg 檔,在任意解析度
  轉成 PNG / JPG / WebP。以 DOMParser 解析取得原始尺寸(width/height,否則 viewBox,皆無預設 300×150),
  輸出前把 SVG 設為目標寬高並補 xmlns/viewBox 再序列化,確保 Image() 正確繪製;canvas drawImage→toBlob。
  可鎖定原始比例、選背景(透明/白/黑,JPG 自動填背景)、品質;尺寸夾在 1–8192。SVG 含外部字型/圖片致 canvas
  tainted 或無法繪製時給明確錯誤。零三方相依、不上傳(線上 SVG 轉檔站多半要上傳又夾廣告);type-check + build 通過 — 2026-06-19

- 色階產生器(color-scale,category=workshop):從一個主色生出 50~950 設計系統明暗色階。做法:主色放 500,
  維持色相/飽和度(自製 hex↔rgb↔hsl),亮端內插到近白(L0.97)、暗端內插到近黑(L0.13),兩端達端點、
  全程單調。色塊點擊複製、依明度自動切換深淺文字;輸出 CSS 變數 / Tailwind 設定 / JSON 一鍵複製。與 color-tools
  (色碼互轉 + 照片抽色)、contrast-check(對比)互補。零三方相依、不連網;type-check + build 通過 — 2026-06-19

- 去純色背景 → 透明(bg-color-key,category=workshop):點圖吸取背景色,把白底/綠幕/純色背景變透明 PNG。
  canvas 像素處理:RGB 歐式距離 ≤ 容差 → alpha 0,容差~容差+柔化帶內 → alpha 漸變(去鋸齒);過大圖先縮到
  邊長 1800。即時(watch keyColor/容差/柔化)、棋盤格底襯顯示透明、顯示去除百分比。與 AI 去背(bg-remove,
  需下載模型,適合人/毛髮/複雜背景)互補,這支免模型、即時,專攻純色背景(logo/掃描簽名印章/線稿/截圖)。
  零三方相依、不上傳;type-check + build 通過 — 2026-06-19

- .env ↔ JSON / shell 轉換(dotenv-convert,category=workshop):雙向。.env→JSON 物件與 shell export;
  JSON 物件→.env。引擎 src/features/dotenv.ts(parseDotenv/stringifyDotenv/stringifyShell/pairsToJson/
  jsonToPairs 純函式無 DOM):解析支援 # 註解、空白行、export 前綴、單引號字面值、雙引號 \n\t\r\\\" 跳脫、
  無引號值去行內 # 註解、同名後者覆蓋、不合法鍵名/未結束引號逐行報錯;序列化僅在含空白/#/引號/換行時加雙引號
  並跳脫;shell 以單引號 '\'' 安全脫逸;JSON→.env 數字/布林轉字串、null 轉空、巢狀/陣列/壞語法報錯。
  回歸測試 scripts/test-dotenv.mjs(33 筆,esbuild 打包後跑,併入 npm test)。設定常含金鑰密碼故全程不上傳;
  零三方相依;type-check + 全測試 + build 通過 — 2026-06-19

- 重複 / 相似照片偵測(dup-photos,category=workshop):一次多選照片,用感知雜湊(dHash)找重複/近似圖,
  幫清理相簿。引擎 src/features/imageHash.ts(toGray luma 轉灰階、dHash 9×8 取樣比較相鄰亮度得 64 位元、
  hamming 漢明距離、bitsToHex、clusterByHash 貪婪分群,皆純函式無 DOM);元件以 canvas 把圖縮 9×8 灰階算雜湊,
  依「寬鬆度」(漢明門檻 0~20)即時分群,只列出 ≥2 張的相似群,標「保留建議」並顯示檔名/大小。改尺寸/重存/
  輕壓縮的同張照片也找得到(非僅完全相同檔)。回歸測試 scripts/test-imagehash.mjs(17 筆:灰階/漸層全 1 全 0/
  全平/漢明/hex/分群門檻/保留 id/近似距離小,esbuild 打包後跑,併入 npm test)。照片是隱私故全程不上傳;
  零三方相依;type-check + 全測試 + build 通過 — 2026-06-19

- 等寬純文字表格(text-table,category=workshop):把 CSV/TSV(可從 Excel/試算表整塊貼上)轉成等寬字型下
  對齊的純文字表格,貼進純文字 email、程式碼註解、Slack、README 程式碼區塊、終端機。引擎 src/features/textTable.ts
  (displayWidth CJK 全形算 2、parseDelimited 自動偵測 TSV/CSV 含引號逸出/欄內逗號換行、toTextTable 三種樣式
  grid 框線/ascii +-|/simple 空格+表頭虛線、純數字欄右對齊,皆純函式無 DOM)+ 回歸測試 scripts/test-texttable.mjs
  (22 筆:寬度/CJK/CSV 引號換行跳脫/TSV 偵測/三樣式邊框/每行等寬對齊/數字右對齊/短列補齊/無表頭/空輸入,
  esbuild 打包後跑,併入 npm test)。與 markdown-table(GitHub/Notion 用)、data-convert(格式互轉)互補;
  零三方相依、不上傳;type-check + 全測試 + build 通過 — 2026-06-19

- 品質:補上身分證字號引擎(twId)回歸測試 scripts/test-twid.mjs(20 筆:有效樣本檢查碼「人工依規則
  獨立算出」非反推、含特殊跳號字母 I=34/O=35/W=32/X=30/Z=33、改末碼即無效、格式/性別碼錯誤、
  每前綴恰一個有效檢查碼、LETTER/REGION 對照表),併入 npm test;驗證 isValidTwId 正確 — 2026-06-19

- 品質:搜尋排序邏輯從 finder.ts 抽到純函式 finderRank.ts(rankTools(query, list),無 Vue/config 相依),
  findTools 行為不變(僅注入完整清單)。新增回歸測試 scripts/test-finderrank.mjs(12 筆:空查詢/無命中/
  關鍵字命中/名稱>關鍵字>說明 權重/整句 +5/遞減排序/大小寫不敏感/多詞/純說明低分/不變更原清單),
  併入 npm test。讓首頁關鍵字導引的排序可被測試保護 — 2026-06-19

- INI / 設定檔 ↔ JSON(ini-convert,category=workshop):雙向。引擎 src/features/ini.ts(parseIni/stringifyIni/
  iniToJson/jsonToIni 純函式無 DOM):解析支援 ; 與 # 註解、[區段]、key=value(亦接受 key: value、值只切第一個
  分隔符)、值前後引號去除、區段前根層鍵、同鍵後者覆蓋、重複區段合併;區段缺 ]/無 =/空區段名逐行報錯。
  序列化:根鍵在前區段在後、僅前後空白或含 ;#= 才加引號(內部空白不需,INI 讀到行尾)、數字布林轉字串;
  限一層區段,JSON 巢狀過深/陣列報錯。回歸測試 scripts/test-ini.mjs(25 筆,esbuild 打包後跑,併入 npm test)。
  與 dotenv-convert、json-yaml 互補;設定常含金鑰密碼故不上傳;type-check + 全測試 + build 通過 — 2026-06-19
- 命名格式轉換(case-convert,category=workshop):把變數名/欄位名/詞句在 13 種命名慣例間互轉 ——
  camelCase/PascalCase/snake_case/CONSTANT_CASE/kebab-case/COBOL-CASE/Train-Case/dot.case/path/case/
  Title Case/Sentence case/全小寫/全大寫;自動辨識來源格式並拆字(splitWords 處理 camelCase 邊界、
  縮寫接一般字 HTMLParser→HTML Parser、明確分隔符 _-./:\ 合併、字母接數字不拆),支援多行批次逐行轉換、
  空白行原樣保留。一次列出全部格式各附複製鈕。引擎 src/features/caseConvert.ts(splitWords/joinWords/
  convertCase/convertLines/convertAll 純函式無 DOM)+ 回歸測試 scripts/test-caseconvert.mjs(43 筆:拆字各情境/
  13 格式/跨格式互轉/縮寫正規化/空輸入/批次,esbuild 打包後跑,併入 npm test)。與 line-tools/text-clean 互補
  (這支專做命名慣例);零新相依、不上傳;type-check + 全測試 + build 通過 — 2026-06-19
- 假文 / Lorem Ipsum 產生器(lorem-ipsum,category=workshop):做版面/設計稿時填的「假內文」。
  拉丁 Lorem Ipsum(可選經典開頭 "Lorem ipsum dolor sit amet…")＋中文假文(多數線上 lorem 工具只有拉丁文,
  這裡能產生中文版面用的佔位文字,常用字組句、中文標點 ,、。!?)。段落/句子/字三種單位、數量 1–200、
  固定種子(mulberry32 可注入)可重現同一批。引擎 src/features/loremIpsum.ts(makeRng/latinSentence/
  latinParagraph/cjkSentence/cjkParagraph/generate 純函式無 DOM)+ 回歸測試 scripts/test-loremipsum.mjs
  (24 筆:拉丁字數/經典開頭/句段結構/僅 ASCII、中文字數/漢字範圍/句末標點/逗號頓號/無拉丁字母、
  可重現性、count 夾限,esbuild 打包後跑,併入 npm test)。與 fake-data(擬真個資)、text-card(做圖)區隔;
  零新相依、不上傳;type-check + 全測試 + build 通過 — 2026-06-19
- CSS 陰影產生器(box-shadow,category=workshop):視覺化調出 CSS box-shadow —— 多層陰影(上限 8 層、
  可複製/刪除/排序)、X/Y 位移、模糊、擴散、顏色＋透明度、內陰影(inset),即時預覽方塊(底色/方塊色/圓角可調)、
  一鍵複製 CSS,附柔和卡片/懸浮/內凹/霓虹範本。引擎 src/features/boxShadow.ts(toCssColor:#RGB/#RRGGBB 展開+
  alpha=1 用 hex 否則 rgba()、無效退黑;layerToCss:inset 前綴、模糊夾非負、小數保留;buildBoxShadow 多層逗號連接
  空陣列 none;buildCss;純函式無 DOM)+ 回歸測試 scripts/test-boxshadow.mjs(27 筆:顏色各情境/單層多層/inset/
  負位移/模糊夾 0/none/完整宣告,esbuild 打包後跑,併入 npm test)。補齊 gradient-maker/color-scale 視覺工坊系列;
  零新相依、不上傳;type-check + 全測試 + build 通過 — 2026-06-19
- 網址代稱 / Slug 產生器(slugify,category=workshop):把文章標題/任意文字洗成適合放網址的 slug ——
  去重音(NFD 正規化後刪 U+0300–036F,café→cafe)、標點/空白轉分隔符、收斂多重分隔、去頭尾;可選小寫、
  保留中文/其他文字(\p{L}\p{N},否則只留 a-z0-9)、分隔符 -/_、長度上限(切斷後再去尾端分隔)。支援多行批次。
  引擎 src/features/slugify.ts(stripDiacritics/slugify 純函式無 DOM)+ 回歸測試 scripts/test-slugify.mjs
  (28 筆:標點/多空白/重音/大小寫/分隔符/中文日文保留與 ASCII 移除/長度上限/綜合,esbuild 打包後跑,併入 npm test)。
  與 case-convert(命名慣例)、line-tools 區隔(這支標題→網址);零新相依、不上傳;type-check + 全測試 + build 通過 — 2026-06-19
- 中文排版盤古之白(pangu-spacing,category=workshop):在中日韓文字與英文字母/數字之間自動補半形空格,
  中英混排的文章/貼文/文件更易讀(「在GitHub上有100顆星」→「在 GitHub 上有 100 顆星」)。可重複套用結果不變
  (idempotent)、保留標點與換行、若中英間已有標點分隔則不另加。引擎 src/features/panguSpacing.ts(CJK 範圍含
  中日韓表意字+假名+注音+部首,雙向 regex addSpacing/addSpacingWithCount 純函式無 DOM)+ 回歸測試
  scripts/test-panguspacing.mjs(26 筆:中英/數字/日文/連續切換/idempotent/換行/標點分隔不加/補空格計數/null,
  esbuild 打包後跑,併入 npm test)。與 text-clean(去空白/全半形/隱形字元)互補;繁簡轉換與標點全形化不在範圍;
  零新相依、不上傳;type-check + 全測試 + build 通過 — 2026-06-19
- 資料圖表產生器(data-chart,category=workshop):貼上 CSV/TSV(或從 Excel/試算表複製),選類別欄與數值欄,
  即畫成長條圖 / 折線圖 / 圓餅圖,下載 SVG(向量,放大不模糊)或 PNG(canvas 2x)、可複製 SVG。長條/折線可多選
  數值欄一起比較(自動配色 + 圖例),圓餅圖取第一個數值欄並自動算百分比。自己算座標軸漂亮刻度與圓弧,不依賴
  任何繪圖套件。引擎 src/features/chartSvg.ts(parseNumber 去千分位/貨幣/百分比符號、buildChartData 非數字當 0、
  niceScale 漂亮刻度無浮點雜訊、pieSlices 負值/0 不佔比例且總角 360、polarPoint/arcPath 12 點鐘順時針含整圓兩段弧、
  fmtNum、renderChart 三型別,皆純函式無 DOM)+ 回歸測試 scripts/test-chartsvg.mjs(44 筆:數字解析/資料組裝/
  刻度上下界與間距一致/扇形比例與角度相接/極座標/大弧旗標/SVG 元素數量含分組長條,esbuild 打包後跑,併入 npm test)。
  與 table-stats(先算數字)互補;線上繪圖站常要註冊或上傳故全程不上傳;零新相依;type-check + 全測試 + build 通過 — 2026-06-19
- CSS 緩動曲線編輯器(cubic-bezier,category=workshop):拖動兩個控制點視覺化調出 CSS 動畫節奏,
  右側方塊以瀏覽器真實 transition 重播預覽(跑道平移 + 縮放兩種),支援回彈/過衝(y 超界並提示),
  一鍵複製函式或完整 CSS,可貼上既有 cubic-bezier 字串或四個數字載入。附 ease/linear/ease-in/out/
  ease-in-out/回彈/彈性等範本。引擎 src/features/cubicBezier.ts(makeEasing 用 WebKit UnitBezier 多項式係數,
  以 Newton-Raphson 失敗退二分法由時間 x 解參數 t 再求完成度 y;easeAt/sampleCurve/hasOvershoot/
  toBezierString/buildTransitionCss/parseBezier 純函式無 DOM,x 依 CSS 規範夾 [0,1]、y 不限)+ 回歸測試
  scripts/test-cubicbezier.mjs(linear y===x、各範本端點 0/1、ease-in/out 與對角線比較、ease-in-out 點對稱、
  單調遞增、過衝偵測、x 夾限 y 不限、字串四捨五入、parse 各情形與防呆、NaN/超界夾限,併入 npm test)。
  補齊 gradient-maker/box-shadow/color-scale 視覺工坊系列;零新相依、不上傳;type-check + 全測試 + build 通過 — 2026-06-19
- CSS clamp() 流體字級產生器(clamp-generator,category=workshop):給小螢幕與大螢幕各自的字級/間距,
  自動算出隨視窗寬度平滑縮放的 clamp() CSS(中間用 vw、兩端夾住),免手刻 utopia 式流體排版公式。
  附互動預覽:拖動模擬視窗寬度即時看實際解析出的尺寸;可選 rem/px、自訂根字級(1rem=?px)、
  套用到 font-size/padding/margin/gap/border-radius。引擎 src/features/clampCss.ts(buildClamp 線性內插
  求斜率 slope×100=vw、截距換 rem、min<=max 自動排序、截距為 0 省略;pxToRem;resolveAt 重算同公式供預覽;
  fmt 四捨五入 4 位去尾零去 -0;同寬度/遞減/寬度顛倒給警告;純函式無 DOM)+ 回歸測試
  scripts/test-clampcss.mjs(經典 16px@320→24px@1280 字串、px 單位、自訂 root 20、resolveAt 兩端中點與
  上下夾限、截距 0 只留 vw、同寬度退化、遞減與顛倒警告,併入 npm test)。補齊漸層/陰影/緩動視覺工坊系列;
  零新相依、不上傳;type-check + 全測試 + build 通過 — 2026-06-19
- IEEE 754 浮點數位元檢視器(float-bits,category=workshop):輸入十進位數字(或反過來貼 16 進位反查)
  拆解成電腦實際儲存的符號 / 指數 / 尾數位元(三色標示),並用 BigInt 完整展開「真正存進去的精確十進位值」
  (分母為 2 次方必有限位),看懂浮點誤差從何而來(0.1+0.2≠0.3)。可切 64 位元 double / 32 位元 float,
  支援 NaN、Infinity、subnormal 非正規數,並提示輸入無法精確表示。引擎 src/features/floatBits.ts
  (DataView 取/還原原始位元 bitsToNumber、breakdown 分類 zero/subnormal/normal/infinity/nan 並切位元欄位、
  exactDecimal 把尾數 M×2^E 用 BigInt 展成有限十進位、parseHex/breakdownFromHex 反查;純函式無 DOM)+ 回歸測試
  scripts/test-floatbits.mjs(double/float 已知 hex 1.0/0.5/0.1/-2、欄位長度、0.1 雙精度精確真值、單精度精確值、
  Inf/-Inf/NaN/-0、最小 subnormal 含有效數字、exactDecimal 直測、多值 round-trip、parseHex 含 0x/空白/超長/非法、
  bitsToNumber,併入 npm test)。與 base-convert(整數進位)、hex-view(位元組)互補;零新相依、不上傳;
  type-check + 全測試 + build 通過 — 2026-06-19
- CSS 選擇器優先級計算器(css-specificity,category=workshop):貼上一或多個 CSS 選擇器(每行一個或逗號分隔),
  算出每個的 (a, b, c) 優先級並由高到低排名(三色標示 ID/class/型別),看清「為什麼這條 CSS 沒套用、誰覆蓋誰」。
  正確處理 :is()/:not()/:has() 取引數中最高優先級、:where() 永遠 0、虛擬元素(::before)算 c 而虛擬類別(:hover)
  算 b、舊式單冒號虛擬元素、屬性 [attr] 算 b、通用 * 與組合子不計分、命名空間分隔。引擎 src/features/specificity.ts
  (specificityOne 逐字元解析、matchParen 巢狀括號、splitTop 頂層逗號切分(括號/中括號內不切)、
  :is/:not/:has 遞迴取 maxSpec、compareSpec 三欄比較、rankSelectors 排序並指派同分同名次;純函式無 DOM)+ 回歸測試
  scripts/test-specificity.mjs(W3C/MDN 經典向量:*、li、ul li、ul ol+li、h1+*[rel=up]、li.red.level、#x34y、
  #s12:not(FOO)、.foo :is(.bar,#baz)、:where、虛擬元素/類別、巢狀 :not/:has、複雜混合、連續 class/ID;
  compareSpec、splitTop 括號內逗號不切、rankSelectors 排序與同名次與逗號展開,併入 npm test)。零新相依、不上傳;
  type-check + 全測試 + build 通過 — 2026-06-19
- Glob 樣式比對測試器(glob-tester,category=workshop):填 glob 樣式(每行一個)與要測的路徑,即時看
  每個路徑符合哪些樣式,並顯示第一條樣式編譯出的正規表達式。驗證 tsconfig include/exclude、CI path filter、
  .gitignore/.dockerignore 樣式對不對。語意採 minimatch 常見子集:星號(不跨 /)、雙星號 globstar(段邊界跨多層、
  否則退化)、? 單字元、[abc] 字元集(範圍 a-z 與開頭 !/^ 取反)、{a,b} 巢狀擇一、反斜線跳脫、可不分大小寫。
  引擎 src/features/globMatch.ts(translate 逐字元編譯成 regex、globstar before/afterSlash/atEnd 判定、matchBrace/
  splitBrace 巢狀大括號、escapeLiteral 跳脫所有 metachar、globToRegExp/matchGlob/cleanPatterns(去空行與 #)/
  testPaths 多樣式×多路徑;純函式無 DOM)+ 回歸測試 scripts/test-globmatch.mjs(星號不跨斜線、**/*.js 與 src/**
  與 a/**/b 各情形、非段邊界 ** 退化、? 、字元集範圍與取反、{js,ts} 與巢狀大括號、字面點/加號/括號、反斜線跳脫、
  nocase、cleanPatterns、testPaths 命中清單,併入 npm test)。零新相依、不上傳;type-check + 全測試 + build 通過 — 2026-06-19
- Snowflake ID 解析器(snowflake-id,category=workshop):貼上 Discord / Twitter(X)/ Instagram 的 64 位元
  Snowflake ID,反推內嵌的建立時間(精確到毫秒,給台灣時間/UTC/Unix 毫秒/相對時間)與中間兩個 5 位元欄位
  (Discord:worker/process;Twitter:datacenter/worker)與 12 位元序號,並用四色拆解 42+5+5+12 位元結構。
  可選平台預設 epoch 或自訂 epoch。純位元運算,不查詢任何帳號或內容(無法得知對應的使用者/訊息)。引擎
  src/features/snowflake.ts(parseId 驗證純數字且 ≤64 位元無號、parseSnowflake 以 BigInt 取 ts=(id>>22)+epoch
  與三欄位與 64 位元二進位、parseByPlatform 平台表、snowflakeForTime 由時間反推最小 id;純函式無 DOM)+ 回歸測試
  scripts/test-snowflake.mjs(Discord 官方文件範例 175928847299117063→2016-04-30T11:18:25.796Z/worker1/process0/
  inc7、Twitter epoch 範例、epoch 0、手工組 id 各欄位拆解、parseId 邊界(64 位元上限可/超過 null/負數/非數字/空)、
  snowflakeForTime 往返與早於 epoch 回 0、平台表,併入 npm test)。與 jwt-decode、timestamp-convert 互補;
  零新相依、不上傳;type-check + 全測試 + build 通過 — 2026-06-19
- IPv6 展開 / 壓縮(ipv6-tools,category=workshop):貼上任意寫法的 IPv6,正規化成展開式(8 組各 4 位數)
  與 RFC 5952 標準壓縮式(全小寫、去每組前導零、最長一段連續零群組用 :: 取代(長度≥2、平手取最左)),
  並判斷類型(未指定 :: / loopback ::1 / link-local fe80::/10 / ULA fc00::/7 / 多播 ff00::/8 / IPv4-mapped /
  global 2000::/3),每組附 16 進位與十進位。支援 :: 省略、內嵌 IPv4(::ffff:192.168.1.1)、%zone 介面識別。
  引擎 src/features/ipv6.ts(parseIPv6 處理雙冒號展開/內嵌 IPv4 轉兩組/zone 去除/各種錯誤、expand、compress
  最左最長零段、classify、analyzeIPv6;純函式無 DOM)+ 回歸測試 scripts/test-ipv6.mjs(RFC 5952 壓縮範例、
  全零/::1/去前導零/最左零段優先/單零不壓/最長段/結尾段、IPv4-mapped 展開壓縮與分類、各類型、大寫與 zone 正規化、
  兩個::/組數不足過多/五位 hex/非 hex/IPv4 超界/::佔滿 8 組等非法,併入 npm test)。補上 cidr-calc(IPv4)缺口;
  零新相依、不上傳;type-check + 全測試 + build 通過 — 2026-06-19
- JSON 轉 Go struct(json-to-go,category=workshop):貼上 JSON 自動推斷對應 Go struct(含 `json:"..."` tag)——
  巢狀物件用內嵌匿名 struct、陣列合併所有元素欄位取聯集、同鍵型別衝突退 interface{}、欄位名轉 Go 慣例 PascalCase
  且常見縮寫(ID/URL/API/HTML…)整個大寫、整數 int 含小數 float64、null interface{};欄位對齊交給 gofmt。引擎
  src/features/jsonToGo.ts(goFieldName 切 camelCase 與縮寫邊界、mergeValues 遞迴合併物件/陣列/純量、goType、
  generateGo;純函式無 DOM)+ 回歸測試 scripts/test-jsontogo.mjs(欄位名 id/userId/html-url/api_key/數字開頭/
  全符號、純量與各種陣列、簡單物件、巢狀內嵌 struct、物件陣列欄位聯集、型別衝突、頂層陣列與純量、null、解析錯誤、
  rootName 正規化,併入 npm test)。與 json-to-ts(TypeScript)互補;零新相依、不上傳;
  type-check + 全測試 + build 通過 — 2026-06-19
- 色彩混合器(color-mix,category=workshop):兩種模式——混色(兩色依比例在 sRGB 線性內插,等同 CSS
  color-mix(in srgb,…),並列出兩色之間的色階可點選複製)與疊色(把帶透明度的前景以 source-over alpha
  compositing 疊在背景上,算出最終看到的實色;背景不透明則結果不透明)。解析 #RGB/#RGBA/#RRGGBB/#RRGGBBAA
  與 rgb()/rgba()(含百分比),輸出 HEX 與 RGB。引擎 src/features/colorMix.ts(parseColor、toHex(alpha<1 輸出 8 位)/
  toRgbString、mix 含 alpha 內插、alphaComposite、gradientSteps;純函式無 DOM)+ 回歸測試 scripts/test-colormix.mjs
  (解析各格式與百分比與非法、toHex/RGB、白黑混 #808080、紅藍混 #800080、ratio 0/1/超界夾限、alpha 內插、
  半透明黑/紅疊白已知值、不透明蓋過、全透明回背景、疊不透明 a=1、半透明疊半透明 a=0.75、色階,併入 npm test)。
  補齊 color-tools/color-scale/gradient-maker 色彩工坊系列(這支專做混色與疊色);零新相依、不上傳;
  type-check + 全測試 + build 通過 — 2026-06-19
- Base32 / Base58 編解碼(base32-58,category=workshop):把位元組串(文字或 hex)與 Base32(RFC 4648)/
  Base58(Bitcoin/IPFS 字母表)互轉。Base32 用於 TOTP 兩步驟驗證金鑰、檔名安全字串(含 = 補位、解碼大小寫不敏感);
  Base58 去掉易混淆的 0/O/I/l、前導零位元組編成 1,用於錢包位址、IPFS CID。與 base-convert(數字 2–36 進位)區隔
  ——這支處理位元組編碼。可文字/hex 輸入、編/解碼切換、結果一鍵當輸入(往返)。引擎 src/features/baseEncode.ts
  (utf8/hex 互轉、base32Encode/Decode 位元緩衝、base58Encode/Decode 用 BigInt 大數除法;純函式無 DOM)+ 回歸測試
  scripts/test-baseencode.mjs(Base32 RFC 4648 七組官方向量 ""/f/fo/foo/foob/fooba/foobar、往返含中文、大小寫與
  空白容忍、非法字元 null、Base58 Hello World!→2NEpo7TZRRrLZSi2U 與 hello→Cn8eVZg 與前導零→112、往返、非法 null、
  hex 輔助 hexToBytes/bytesToHex 與透過 hex 編碼,併入 npm test)。零新相依、不上傳;type-check + 全測試 + build 通過 — 2026-06-19
- UUID 檢視器(uuid-inspect,category=workshop):貼上 UUID 判斷版本(v1–v8)與變體(NCS/RFC/Microsoft),
  並對含時間的版本還原內嵌建立時間:v1/v6(60 位元、單位 100 奈秒、自 1582-10-15 起算)與 v7(前 48 位元 Unix
  毫秒、time-ordered RFC 9562)。接受連字號/無連字號/urn:uuid:/大括號格式,辨識 Nil(全零)與 Max(全 F)。
  與 id-gen(產生)互補,這支專做反查;純位元解析不查詢任何資料。引擎 src/features/uuidInspect.ts
  (normalizeUuid、formatCanonical、inspectUuid 取版本/變體並依版本以 BigInt 還原時間戳並扣格里曆 offset、
  v7TimePrefix;純函式無 DOM)+ 回歸測試 scripts/test-uuidinspect.mjs(normalize 各格式與長度/非 hex/空、
  v4 版本變體且無時間、v1 由 ms=0 組出→1970-01-01、v7 前 48 位元 1700000000000 與固定字串 iso、v6 重排序時間→1970、
  Nil/Max special、變體 NCS/Microsoft 判定、非法 null,併入 npm test)。零新相依、不上傳;type-check + 全測試 + build 通過 — 2026-06-19
- User-Agent 解析器(ua-parser,category=workshop):貼上 UA 字串拆出瀏覽器/版本/排版引擎/作業系統/裝置類型
  (桌機/手機/平板/爬蟲),看 server log、分析流量、debug 相容性常用,可一鍵帶入自己的瀏覽器。偵測順序由特殊到通用
  (Edg→Opera→Samsung→Firefox/FxiOS→CriOS→Chrome→Safari→IE),正確處理 iOS 上所有瀏覽器強制 WebKit、
  Chrome 含 Safari/AppleWebKit 的幌子、Windows 10.0 同時對應 10/11、macOS 行銷代號、Googlebot/curl 等爬蟲。
  引擎 src/features/uaParser.ts(detectBrowser/detectEngine/detectOS/detectDevice、windowsName/macName 對照、
  BOT_RE 爬蟲庫;純函式無 DOM)+ 回歸測試 scripts/test-uaparser.mjs(Chrome/Safari/Firefox/Edge/Opera/Samsung/
  iPhone/iPad/Android 手機與平板/CriOS/FxiOS/IE11/Googlebot/curl/空輸入/去空白,併入 npm test)。
  零相依、不上傳;type-check + build 通過 — 2026-06-19
- Cookie 解析器(cookie-parse,category=workshop):把 Set-Cookie(回應)或 Cookie(請求)標頭拆成結構化欄位——
  名稱、值、Domain、Path、Expires、Max-Age、Secure、HttpOnly、SameSite,白話說明存活時間(Max-Age 優先於 Expires、
  皆無則為 session cookie),並附安全性提醒(SameSite=None 需 Secure、缺 HttpOnly/Secure/SameSite)。網頁除錯必備。
  引擎 src/features/cookieParse.ts(parseCookieHeader 多組 name=value、parseSetCookie 拆名值與旗標/屬性並產生警告與
  存活說明、humanDuration 秒轉天/小時/分;純函式無 DOM)+ 回歸測試 scripts/test-cookieparse.mjs(請求標頭多組/
  Cookie: 前綴/值含等號/無值/空、Set-Cookie 各屬性與旗標、Set-Cookie: 前綴、SameSite=None 缺 Secure 警告與
  缺 HttpOnly/Secure/SameSite 警告、session 說明、Max-Age 0/負刪除、Expires 轉 ISO、齊全無警告、空與只有屬性無名稱 null、
  humanDuration 各情形,併入 npm test)。零新相依、不上傳;type-check + 全測試 + build 通過 — 2026-06-19

## 進行中 / 待辦(優先序)
- [x] 圖片去背評估:@imgly/background-removal 拉進 102 套件且 runtime 需從外部 CDN 下載 ~40MB 模型,
      與本專案「精簡 + 自包含」原則不符,**跳過**(未來若改自架模型再評估)
- [ ] 持續深化防詐騙:可疑賣家/電話查證引導
- [ ] 發票對獎接真實/半自動中獎號碼 —— ⚠️ 需可驗證的官方來源(財政部 open data),
      雲端沙盒 WebFetch 被擋無法驗證格式;寫入錯誤中獎號碼風險高,暫緩,待能驗證來源再做
- [ ] 汽機車牌照稅/燃料費試算 —— ⚠️ 需完整官方級距表,沙盒內無法逐項驗證高級距,暫緩
- [ ] og:image 改 PNG(部分平台不渲染 SVG 預覽圖)
- [ ] 下載中心:擴充更多軟體、更多 github 自動版本來源
- [ ] 品質:單元測試擴充、視覺與 RWD 持續打磨

- 推薦好站(picks.json)擴充:32 → 49 筆,新增 17 個可信免費/官方資源 — 2026-06-19
  - 防詐查證:經濟部商工登記公示查詢(查公司真偽/抓假徵才)、Have I Been Pwned(查 email 外洩)、全民資安素養網
  - AI 助手:NotebookLM、Microsoft Copilot;學習翻譯:Duolingo、國教院雙語詞彙(樂詞網,官方審定譯名)
  - 影像設計:Pixabay、Google Fonts、Excalidraw;生產力:Obsidian(本機筆記、隱私佳)
  - 台灣在地:台鐵、高鐵、不動產實價登錄;政府服務:我的 E 政府、財政部稅務入口網、衛福部疾管署
  - 全為高信心可信網址(沙盒 WebFetch 被擋無法逐一驗證,故只收極知名服務與標準 *.gov.tw 域名);
    picks.json 執行時 fetch(NetworkFirst),免重建即生效;build + JSON 驗證(無重複 id)通過

## 注意:工具已 24 個,philosophy 是「窄而深、少而精」,新增前先確認非「網路隨手可得」且資料可驗證

## 注意
- 工具=資料+模組:新增工具只加 src/tools/<id>/Index.vue + tools.config 註冊
- 每檔 <300 行;計算類附依據與「僅供參考」;不上傳資料
- push 前先 `npm run build` 通過;sonnet/opus 雲端 routine 也在跑,push 前先 `git pull --rebase`

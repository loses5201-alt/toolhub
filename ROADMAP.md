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
- 圖片遮蔽(image-redact):拖曳框選塗黑/馬賽克,真的把像素燒掉、不上傳,分享截圖前遮個資 — 2026-06-15
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

## 可信策展(2026-06:延續下載中心模式,資料 public/data/*.json + 容錯視圖)
- 推薦好站(/picks,views/Picks.vue + public/data/picks.json):人工挑選、免費好用、連結皆指向官方;
  旗艦收錄「防詐查證」(165/事實查核/MyGoPen/Cofacts)貼合本站 DNA;另含 AI 助手/翻譯學習/修圖設計/台灣在地。
  finder 加虛擬項 picks-center 讓關鍵字導向;App 導覽 + 首頁入口卡;NetworkFirst 自動涵蓋新 JSON — 2026-06-15

## 處理工坊(續)
- QR Code 產生器(qr-generate,category=workshop):qrcode 函式庫,文字/網址、WiFi、vCard 三模式,
  即時預覽 + 下載 PNG、尺寸/容錯等級可調;直接編碼原始內容(不像線上產生器偷塞追蹤短網址),
  輸入不上傳。qrcode 動態 import,precache +33KB(可接受,未拆 vendor)— 2026-06-15

## 處理工坊(續 2)
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

## 注意:工具已 24 個,philosophy 是「窄而深、少而精」,新增前先確認非「網路隨手可得」且資料可驗證

## 注意
- 工具=資料+模組:新增工具只加 src/tools/<id>/Index.vue + tools.config 註冊
- 每檔 <300 行;計算類附依據與「僅供參考」;不上傳資料
- push 前先 `npm run build` 通過;sonnet/opus 雲端 routine 也在跑,push 前先 `git pull --rebase`

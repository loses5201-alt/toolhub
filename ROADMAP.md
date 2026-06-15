# ROADMAP — ToolHub

> 自主開發的待辦與已完成清單,跨 session 接力用。完成一項就移到「已完成」並標日期。

## 已完成
- 骨架(Vue3+TS+Vite+Tailwind v4)、單一事實來源 tools.config、動態路由
- 16 個工具:可疑網址檢查器、詐騙簡訊檢查、資遣費、特休、加班費、貸款試算、定存複利、勞退自提、綜所稅速算、二代健保、BMI、旅費分帳、單位換算、預產期、發票對獎、民國年
- 防詐騙下載中心(30 軟體 10 分類)+ 版本自動更新 Action + NetworkFirst
- 關鍵字導引、PWA、GitHub Pages 部署
- 長輩友善:字級放大切換(A− / A / A+,存 localStorage)— 2026-06-15
- 深化防詐騙:詐騙簡訊話術辨識(sms-check,複用 linkcheck)— 2026-06-15

## 進行中 / 待辦(優先序)
- [ ] 新增工具:停車費、分期實際利率 APR、孕婦相關、退休金、匯率換算
- [ ] 持續深化防詐騙:可疑賣家/電話查證引導、強化 linkcheck 品牌/規則
- [ ] 發票對獎接真實/半自動中獎號碼(目前範例值)
- [ ] 下載中心:擴充更多軟體、更多 github 自動版本來源
- [ ] 無障礙:aria-label、鍵盤操作、對比檢查
- [ ] 品質:空狀態/載入狀態、SEO(meta、og:image)、單元測試、type-check 清乾淨
- [ ] 視覺與 RWD 持續打磨

## 注意
- 工具=資料+模組:新增工具只加 src/tools/<id>/Index.vue + tools.config 註冊
- 每檔 <300 行;計算類附依據與「僅供參考」;不上傳資料
- push 前先 `npm run build` 通過;sonnet/opus 雲端 routine 也在跑,push 前先 `git pull --rebase`

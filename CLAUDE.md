# IGS ACD Art Tools — Project Context

## 專案簡介
Photoshop CEP 插件框架 + Cocos Creator UI 匯入工具鏈。公司內部美術工具箱。

## 架構速查

```
extension/              ← CEP 插件本體
├── CSXS/manifest.xml   ← 版本號（ExtensionBundleVersion）
├── js/main.js          ← 框架核心（工具載入、UI、postMessage、usage log）
├── js/ps-bridge.js     ← Photoshop API 封裝
├── js/updater.js       ← GitHub 自動更新
├── js/CSInterface.js   ← Adobe CEP SDK（勿改）
├── jsx/host.jsx        ← ExtendScript（PS DOM + Action Manager）
├── tools/              ← 工具目錄（自動掃描 manifest.json）
└── index.html          ← 主面板 UI
installer/setup.nsi     ← NSIS 安裝腳本
.github/workflows/release.yml ← CI/CD
cocos-extension/        ← Cocos Creator igs-ui-importer
```

## 關鍵機制
- **安裝**：.exe → `%APPDATA%\Adobe\CEP\extensions\com.igs.arttools\`
- **更新**：updater.js → GitHub `/releases/latest` → 下載 zip 覆蓋
- **發版**：`git tag vX.X.X && git push origin vX.X.X` → Actions 產生 .exe + .zip
- **Usage Log**：本地 `usage.log` + Google Sheets webhook
- **Config**：`%APPDATA%\IGS-ArtTools\config.json`（token, repo, webhookUrl）

## GitHub
- Repo: `igs-yichonezhu/ACD_PhotoshopTools`（Private）
- 分支: `main`

## 深入文件（需要時再讀）
| 主題 | 檔案路徑 |
|------|---------|
| 完整開發歷程 + Cocos 技術細節 | `docs/開發歷程PRD結案報告.md` |
| 使用者操作手冊 | `docs/操作手冊.md` |
| 安裝說明書 | `docs/安裝說明書.md` |
| GitHub + CI/CD 設定指南 | `GITHUB-SETUP.md` |
| 工具開發範本 | `extension/tools/README-TOOL-TEMPLATE.md` |

## 快速 SOP
- **新增工具**：`tools/` 下建資料夾 + manifest.json + index.html
- **發版**：commit → push → `git tag vX.X.X && git push origin vX.X.X`
- **Cocos 工作流**：ui-to-cocos 匯出 layout.json → Cocos igs-ui-importer 生成 Prefab
- **切開發模式**：建 symlink 直連，改完即時重啟 PS 看效果
- **切回安裝模式**：移除 symlink，改用 .exe 安裝的版本

## 開發模式切換指令
```cmd
# 切開發模式（即時預覽）
mklink /D "%APPDATA%\Adobe\CEP\extensions\com.igs.arttools" "C:\Users\yichonezhu\Documents\Claude\Projects\Photoshop Plugin\extension"

# 切回安裝模式（跟同事一致）
rmdir "%APPDATA%\Adobe\CEP\extensions\com.igs.arttools"
# 然後重新執行 .exe 安裝
```

## 待辦 / 未決議題
- Repo 權限：目前 Public，之後可能改 Private（需決定 PAT 發放方式）
- Webhook URL 硬編碼在 main.js DEFAULT_WEBHOOK，改 Private 前要移到純 config.json 讀取
- 缺少 icon：shared-resources/icon.png、ui-to-cocos/icon.png（48x48 PNG RGBA）

## 注意事項
- manifest.xml 改面板尺寸時，Size 和 MinSize 要一起改
- CSInterface.js 勿改（Adobe SDK）
- config.json 含 PAT，絕不 commit
- host.jsx 文字讀取用 DOM + Action Manager 雙路徑，改前先讀 PRD 報告
- 語言統一繁體中文

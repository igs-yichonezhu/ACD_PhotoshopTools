# IGS ACD Art Tools — Project Context

## 專案簡介
Photoshop CEP 插件框架，公司內部美術工具箱。

## 架構速查

```
extension/              ← CEP 插件本體
├── CSXS/manifest.xml   ← 版本號在這（ExtensionBundleVersion）
├── js/
│   ├── main.js         ← 框架核心（工具載入、UI、postMessage 路由、usage log）
│   ├── ps-bridge.js    ← Photoshop API 封裝
│   ├── updater.js      ← GitHub 自動更新模組
│   └── CSInterface.js  ← Adobe CEP SDK
├── jsx/host.jsx        ← ExtendScript（PS DOM 操作）
├── tools/              ← 所有工具放這裡（每個工具一個資料夾 + manifest.json）
│   ├── color-picker/
│   ├── doc-info/
│   ├── fx-remove-bg/
│   └── ui-to-cocos/
└── index.html          ← 主面板 UI
installer/setup.nsi     ← NSIS 安裝腳本（產生 .exe）
.github/workflows/release.yml ← CI/CD（打 tag 自動發 Release + .exe + .zip）
cocos-extension/        ← Cocos Creator UI 匯入延伸模組
```

## 關鍵機制

- **安裝**：使用者安裝 .exe → 檔案複製到 `%APPDATA%\Adobe\CEP\extensions\com.igs.arttools\`
- **更新**：updater.js 用 GitHub PAT 呼叫 `/releases/latest` → 比對版本 → 下載 zip 覆蓋
- **發版**：`git tag vX.X.X && git push origin vX.X.X` → GitHub Actions 自動建置
- **Usage Log**：開關工具時寫入本地 `usage.log` + POST 到 Google Sheets webhook
- **Config 位置**：`%APPDATA%\IGS-ArtTools\config.json`（token, repo, webhookUrl）

## GitHub

- Repo: `igs-yichonezhu/ACD_PhotoshopTools`（Private）
- 分支: `main`

## 新增工具 SOP

1. 在 `extension/tools/` 下建資料夾
2. 建 `manifest.json`（name, entry, version, category 必填）
3. 建 `index.html`（用 postMessage 呼叫 ps-api）
4. 框架會自動掃描載入

## 發版 SOP

1. 確認變更已 commit + push
2. `git tag v版本號 && git push origin v版本號`
3. GitHub Actions 自動產生 .exe + .zip Release
4. 已安裝的使用者插件會自動偵測到新版

## 注意事項

- CSInterface.js 是 Adobe SDK，不要修改
- config.json 含 GitHub PAT，絕不 commit（已在 .gitignore）
- Google Sheets webhook URL 已硬編碼為預設值在 main.js DEFAULT_WEBHOOK
- NSIS 安裝腳本在 Linux CI 上用 apt 安裝 nsis 建置
- 工具的語言統一用繁體中文

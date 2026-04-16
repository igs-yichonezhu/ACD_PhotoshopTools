# IGS ACD Art Tools — GitHub 與更新機制說明

## 一、整體架構概覽

```
開發者（你）                          同事（使用者）
  │                                      │
  ├─ git commit + push                   │
  ├─ git tag v1.6.2                      │
  ├─ git push origin v1.6.2             │
  │                                      │
  ▼                                      │
GitHub Actions（自動）                   │
  ├─ 更新 manifest.xml 版本號           │
  ├─ 打包 extension/ → .zip             │
  ├─ 打包 cocos-extension/ → .zip       │
  ├─ 編譯 NSIS → .exe 安裝檔            │
  ├─ 從 commit history 產生 Release Notes│
  └─ 發佈 GitHub Release ──────────────→ 插件自動偵測到新版
                                          ├─ 顯示更新 banner
                                          ├─ 點「更新」下載 .zip
                                          ├─ 解壓覆蓋插件目錄
                                          └─ 重啟 Photoshop 完成
```

---

## 二、開發者發版流程

### 日常開發
```bash
# 1. 修改程式碼
# 2. Commit（message 請寫清楚，會自動變成 Release Notes）
git add <files>
git commit -m "新增 XX 功能"

# 3. 推到 GitHub
git push origin main
```

### 發佈新版本
```bash
# 打 tag（遵循 semver 語意化版本）
git tag v1.6.2

# 推送 tag → 觸發 GitHub Actions 自動打包
git push origin v1.6.2
```

### 版本號規則（Semver）
| 範例 | 意義 | 使用時機 |
|------|------|----------|
| v1.6.**1** → v1.6.**2** | Patch | 修 bug、小調整 |
| v1.**6**.0 → v1.**7**.0 | Minor | 新增功能、新增工具 |
| v**1**.0.0 → v**2**.0.0 | Major | 重大架構改動 |

### 如果 Release Notes 寫錯了怎麼辦？
```bash
# 刪除遠端 tag
git tag -d v1.6.2
git push origin :refs/tags/v1.6.2

# 修正後重新打 tag
git tag v1.6.2
git push origin v1.6.2
```

---

## 三、GitHub Actions CI/CD 流程

> 檔案位置：`.github/workflows/release.yml`

當推送符合 `v*.*.*` 格式的 tag 時自動觸發，依序執行：

| 步驟 | 說明 |
|------|------|
| 1. Checkout | 拉取最新程式碼 |
| 2. Extract version | 從 tag 名稱取得版本號（`v1.6.2` → `1.6.2`） |
| 3. Update manifest | 自動將版本號寫入 `manifest.xml`（僅改 BundleVersion 和 Extension Version） |
| 4. Package zip | 打包 `extension/` 為 `igs-arttools-vX.X.X.zip`（供自動更新下載） |
| 5. Package Cocos | 打包 `cocos-extension/` 為 `igs-ui-importer-vX.X.X.zip` |
| 6. Build installer | 用 NSIS 編譯 `installer/setup.nsi` 為 `.exe` 安裝檔（供首次安裝） |
| 7. Release Notes | **自動從 commit history 產生**，抓取上一個 tag 到當前 tag 的所有 commit message |
| 8. Publish Release | 發佈到 GitHub Releases，附帶 `.exe`、`.zip`、`安裝說明書.md` |

### Release 產出物
| 檔案 | 用途 |
|------|------|
| `igs-arttools-setup-vX.X.X.exe` | 首次安裝用（含 NSIS 安裝精靈） |
| `igs-arttools-vX.X.X.zip` | 自動更新下載用（插件本體） |
| `igs-ui-importer-vX.X.X.zip` | Cocos Creator 擴充套件 |
| `安裝說明書.md` | 使用者參考文件 |

---

## 四、Photoshop 插件端自動更新機制

> 檔案位置：`extension/js/updater.js` + `extension/js/main.js`

### 偵測更新時機
| 時機 | 說明 |
|------|------|
| 啟動後 2 秒 | 靜默檢查（不彈窗） |
| 每 1 小時 | 自動靜默檢查（`setInterval` 60 分鐘） |
| 手動按 ↻ | 使用者主動檢查（有結果會彈窗） |

### 更新流程（7 步驟）

```
1. 呼叫 GitHub API
   GET https://api.github.com/repos/{owner}/{repo}/releases/latest
   ├─ 有 Token → 帶 Authorization header（5000 次/小時）
   └─ 無 Token → 匿名請求（60 次/小時）

2. 版本比對
   manifest.xml 的 ExtensionBundleVersion vs Release 的 tag_name
   └─ 用 semver 逐位比較（major → minor → patch）

3. 有新版 → 顯示更新 banner
   ├─ 顯示版本號
   └─ 可展開查看 Release Notes

4. 使用者點「更新」按鈕

5. 下載 .zip
   └─ 存到 %TEMP%\igs-arttools-update.zip

6. 解壓並覆蓋
   ├─ PowerShell Expand-Archive 解壓到暫存目錄
   ├─ 先刪除 tools/ 目錄（確保移除的工具不會殘留）
   └─ 複製新檔案覆蓋到插件安裝路徑

7. 提示重啟 Photoshop
```

### 錯誤處理
| 狀況 | 顯示訊息 |
|------|----------|
| GitHub API 403（限流） | 「要求次數過多，一小時後恢復」 |
| SSL 憑證問題 | 已設定 `NODE_TLS_REJECT_UNAUTHORIZED = '0'` 繞過 |
| 未設定 Repository | 「請先在設定中填入 GitHub Repository」 |
| 下載失敗 | 彈窗顯示錯誤原因 |

---

## 五、安裝路徑與設定檔

### 插件安裝路徑
```
%APPDATA%\Adobe\CEP\extensions\com.igs.arttools\
```

### 設定檔位置
```
%APPDATA%\IGS-ArtTools\config.json
```

### config.json 內容
```json
{
  "token": "",
  "repo": "igs-yichonezhu/ACD_PhotoshopTools",
  "webhookUrl": "https://script.google.com/macros/s/..."
}
```

| 欄位 | 說明 | 必填 |
|------|------|------|
| `token` | GitHub Personal Access Token | 否（Public repo 不需要） |
| `repo` | GitHub Repository（owner/repo 格式） | 是（安裝時預填） |
| `webhookUrl` | Google Sheets webhook URL | 否（用於 usage log） |

---

## 六、使用者首次安裝流程

1. 從 GitHub Releases 下載 `igs-arttools-setup-vX.X.X.exe`
2. 雙擊執行安裝精靈
3. Repository 已預填 `igs-yichonezhu/ACD_PhotoshopTools`，Token 留空
4. 安裝完成後重啟 Photoshop
5. 從選單 `視窗 > 延伸功能（舊版） > IGS ACD Art Tools` 開啟面板

### 安裝精靈自動處理的事項
- 將插件檔案複製到 CEP extensions 路徑
- 設定 CSXS 7～15 的 Debug Mode（Windows Registry）
- 產生 `config.json` 設定檔

---

## 七、常見問題

### Q: 為什麼同事看不到插件？
- 確認 Photoshop 選單 `視窗 > 延伸功能（舊版）` 是否存在
- 確認 `偏好設定 > 增效模組 > 載入延伸功能面板` 已勾選
- 確認 Registry `HKCU\Software\Adobe\CSXS.{7-15}` 的 `PlayerDebugMode` = `1`

### Q: 為什麼顯示「要求次數過多」？
- GitHub 匿名 API 限制 60 次/小時，超過就會被限流
- 等一小時自動恢復，或在設定中填入 GitHub Token 提高到 5000 次/小時

### Q: 更新後舊工具還在？
- 已修正：更新時會先清空 `tools/` 目錄再覆蓋新檔案

### Q: 如何切換開發模式？
```cmd
# 切開發模式（即時預覽，改完重啟 PS 即見效）
mklink /D "%APPDATA%\Adobe\CEP\extensions\com.igs.arttools" "C:\Users\yichonezhu\Documents\Claude\Projects\Photoshop Plugin\extension"

# 切回安裝模式（跟同事一致）
rmdir "%APPDATA%\Adobe\CEP\extensions\com.igs.arttools"
# 然後重新執行 .exe 安裝
```

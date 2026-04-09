# 工具開發範本

## 快速建立新工具

1. 複製此範本資料夾到 `tools/` 下並重新命名
2. 修改 `manifest.json`
3. 編輯 `index.html`
4. 重啟 Photoshop 或重新載入插件面板

## 最小工具結構

```
tools/my-tool/
├── manifest.json    (必要)
├── icon.png         (選填, 48x48)
└── index.html       (必要)
```

## manifest.json 範本

```json
{
    "name": "工具名稱",
    "icon": "icon.png",
    "entry": "index.html",
    "version": "1.0.0",
    "description": "工具說明",
    "category": ["image"],
    "minPsVersion": "20.0"
}
```

## index.html 最小範本

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>我的工具</title>
    <style>
        body {
            font-family: "Segoe UI", sans-serif;
            font-size: 12px;
            color: #e0e0e0;
            background: #2b2b2b;
            padding: 12px;
            margin: 0;
        }
    </style>
</head>
<body>
    <h3>我的工具</h3>

    <script>
        // 呼叫 Photoshop API（複製此段到你的工具中）
        var callCounter = 0;
        var pendingCalls = {};

        function callPsApi(action, params) {
            return new Promise(function (resolve, reject) {
                var callId = 'call_' + (++callCounter);
                pendingCalls[callId] = { resolve: resolve, reject: reject };
                window.parent.postMessage({
                    type: 'ps-api',
                    action: action,
                    params: params || {},
                    callId: callId
                }, '*');
                setTimeout(function () {
                    if (pendingCalls[callId]) {
                        delete pendingCalls[callId];
                        reject('Timeout');
                    }
                }, 10000);
            });
        }

        window.addEventListener('message', function (e) {
            var d = e.data;
            if (!d || d.type !== 'ps-api-response') return;
            var p = pendingCalls[d.callId];
            if (!p) return;
            delete pendingCalls[d.callId];
            d.error ? p.reject(d.error) : p.resolve(d.result);
        });

        // 範例：取得文件資訊
        // callPsApi('getActiveDocument').then(console.log);
    </script>
</body>
</html>
```

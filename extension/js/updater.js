/**
 * IGS ACD Art Tools - GitHub Auto Updater
 * 透過 GitHub Releases API 檢查並下載更新
 *
 * 流程：
 * 1. 啟動時呼叫 GitHub API 取得最新 release
 * 2. 比對本機版本號
 * 3. 有新版 → 顯示更新 banner
 * 4. 用戶按更新 → 下載 zip → 解壓到臨時目錄 → 覆蓋插件目錄
 * 5. 提示重啟 Photoshop
 */

(function () {
    'use strict';

    var fs = require('fs');
    var path = require('path');
    var https = require('https');
    var os = require('os');

    var GITHUB_API = 'api.github.com';

    // Skip SSL certificate verification (for corporate proxies/firewalls)
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

    var updaterState = {
        latestVersion: null,
        downloadUrl: null,
        releaseNotes: null,
        isChecking: false,
        isUpdating: false
    };

    // ============================================
    // Version Comparison
    // ============================================

    /**
     * Compare two semver strings
     * Returns: 1 if a > b, -1 if a < b, 0 if equal
     */
    function compareVersions(a, b) {
        var partsA = a.replace(/^v/, '').split('.').map(Number);
        var partsB = b.replace(/^v/, '').split('.').map(Number);

        for (var i = 0; i < 3; i++) {
            var numA = partsA[i] || 0;
            var numB = partsB[i] || 0;
            if (numA > numB) return 1;
            if (numA < numB) return -1;
        }
        return 0;
    }

    /**
     * Get current version from manifest.xml
     */
    function getCurrentVersion() {
        try {
            var config = App.getConfig();
            if (config.currentVersion) return config.currentVersion;

            var extPath = App.getState().extensionPath;
            var manifestPath = path.join(extPath, 'CSXS', 'manifest.xml');
            var xml = fs.readFileSync(manifestPath, 'utf8');
            var match = xml.match(/ExtensionBundleVersion="([^"]+)"/);
            return match ? match[1] : '0.0.0';
        } catch (e) {
            return '0.0.0';
        }
    }

    // ============================================
    // GitHub API
    // ============================================

    /**
     * Make authenticated GitHub API request
     */
    function githubRequest(endpoint, callback) {
        var config = App.getConfig();

        if (!config.repo) {
            callback('GitHub repo not configured', null);
            return;
        }

        var headers = {
            'User-Agent': 'IGS-ArtTools-Updater',
            'Accept': 'application/vnd.github.v3+json'
        };

        // Token is optional for public repos
        if (config.token) {
            headers['Authorization'] = 'token ' + config.token;
        }

        var options = {
            hostname: GITHUB_API,
            path: '/repos/' + config.repo + endpoint,
            method: 'GET',
            headers: headers
        };

        var req = https.request(options, function (res) {
            var data = '';

            res.on('data', function (chunk) {
                data += chunk;
            });

            res.on('end', function () {
                if (res.statusCode === 200) {
                    try {
                        callback(null, JSON.parse(data));
                    } catch (e) {
                        callback('Failed to parse response', null);
                    }
                } else if (res.statusCode === 401) {
                    callback('GitHub token is invalid or expired', null);
                } else if (res.statusCode === 404) {
                    callback('Repository not found or no releases', null);
                } else {
                    callback('GitHub API error: ' + res.statusCode, null);
                }
            });
        });

        req.on('error', function (e) {
            callback('Network error: ' + e.message, null);
        });

        req.setTimeout(15000, function () {
            req.abort();
            callback('Request timeout', null);
        });

        req.end();
    }

    /**
     * Download a file from URL with auth
     */
    function downloadFile(url, destPath, callback) {
        var config = App.getConfig();

        // Parse the URL
        var urlParts = require('url').parse(url);

        var headers = {
            'User-Agent': 'IGS-ArtTools-Updater',
            'Accept': 'application/octet-stream'
        };

        if (config.token) {
            headers['Authorization'] = 'token ' + config.token;
        }

        var options = {
            hostname: urlParts.hostname,
            path: urlParts.path,
            method: 'GET',
            headers: headers
        };

        var protocol = urlParts.protocol === 'https:' ? https : require('http');

        var req = protocol.request(options, function (res) {
            // Handle redirects (GitHub often redirects asset downloads)
            if (res.statusCode === 302 || res.statusCode === 301) {
                downloadFile(res.headers.location, destPath, callback);
                return;
            }

            if (res.statusCode !== 200) {
                callback('Download failed: HTTP ' + res.statusCode, null);
                return;
            }

            var fileStream = fs.createWriteStream(destPath);
            res.pipe(fileStream);

            fileStream.on('finish', function () {
                fileStream.close();
                callback(null, destPath);
            });

            fileStream.on('error', function (e) {
                fs.unlinkSync(destPath);
                callback('Write error: ' + e.message, null);
            });
        });

        req.on('error', function (e) {
            callback('Download error: ' + e.message, null);
        });

        req.setTimeout(120000, function () {
            req.abort();
            callback('Download timeout', null);
        });

        req.end();
    }

    // ============================================
    // Update Check
    // ============================================

    function checkForUpdates(showNotification) {
        if (updaterState.isChecking) return;

        var config = App.getConfig();
        if (!config.repo) {
            if (showNotification) {
                App.setStatus('請先在設定中填入 GitHub Repository');
            }
            return;
        }

        updaterState.isChecking = true;
        App.setStatus('正在檢查更新...');

        githubRequest('/releases/latest', function (err, release) {
            updaterState.isChecking = false;

            if (err) {
                App.setStatus('檢查更新失敗：' + err);
                // Only show alert for manual check, not auto-check
                if (showNotification && err.indexOf('403') === -1) {
                    alert('檢查更新失敗：\n' + err);
                }
                return;
            }

            var latestVersion = release.tag_name.replace(/^v/, '');
            var currentVersion = getCurrentVersion();

            if (compareVersions(latestVersion, currentVersion) > 0) {
                // Find the zip asset
                var zipAsset = null;
                if (release.assets && release.assets.length > 0) {
                    for (var i = 0; i < release.assets.length; i++) {
                        if (release.assets[i].name.match(/\.zip$/i)) {
                            zipAsset = release.assets[i];
                            break;
                        }
                    }
                }

                if (!zipAsset) {
                    // Fallback to zipball_url
                    updaterState.downloadUrl = release.zipball_url;
                } else {
                    updaterState.downloadUrl = zipAsset.url;
                }

                updaterState.latestVersion = latestVersion;
                updaterState.releaseNotes = release.body || '';

                // Show update banner
                showUpdateBanner(latestVersion, release.body);
                App.setStatus('新版本可用：v' + latestVersion);
            } else {
                App.setStatus('已是最新版本 v' + currentVersion);
                if (showNotification) {
                    alert('目前已是最新版本 v' + currentVersion);
                }
            }
        });
    }

    function showUpdateBanner(version, releaseNotes) {
        var banner = document.getElementById('updateBanner');
        var text = document.getElementById('updateText');
        var notesEl = document.getElementById('releaseNotes');
        var toggleBtn = document.getElementById('releaseNotesToggle');

        text.textContent = '新版本可用 v' + version;
        banner.classList.add('visible');

        if (releaseNotes && notesEl) {
            // Simple markdown-like formatting: keep line breaks, strip ## headers to bold
            var formatted = releaseNotes
                .replace(/^### (.+)$/gm, '<strong>$1</strong>')
                .replace(/^## (.+)$/gm, '<strong>$1</strong>')
                .replace(/^- /gm, '• ')
                .replace(/\n/g, '<br>');
            notesEl.innerHTML = formatted;
            toggleBtn.style.display = 'inline';
        }
    }

    function toggleReleaseNotes() {
        var notesEl = document.getElementById('releaseNotes');
        var toggleBtn = document.getElementById('releaseNotesToggle');
        if (notesEl.classList.contains('visible')) {
            notesEl.classList.remove('visible');
            toggleBtn.textContent = '查看更新內容 ▼';
        } else {
            notesEl.classList.add('visible');
            toggleBtn.textContent = '收起 ▲';
        }
    }

    function hideUpdateBanner() {
        var banner = document.getElementById('updateBanner');
        banner.classList.remove('visible');
    }

    // ============================================
    // Perform Update
    // ============================================

    function performUpdate() {
        if (updaterState.isUpdating || !updaterState.downloadUrl) return;

        updaterState.isUpdating = true;
        App.setStatus('正在下載更新...');

        var updateBtn = document.getElementById('updateBtn');
        updateBtn.textContent = '下載中...';
        updateBtn.disabled = true;

        // Download to temp directory
        var tmpDir = path.join(os.tmpdir(), 'igs-arttools-update');
        var zipPath = path.join(os.tmpdir(), 'igs-arttools-update.zip');

        // Clean up previous temp files
        try {
            if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
            if (fs.existsSync(tmpDir)) deleteFolderRecursive(tmpDir);
        } catch (e) {
            console.warn('Cleanup warning:', e);
        }

        downloadFile(updaterState.downloadUrl, zipPath, function (err) {
            if (err) {
                updaterState.isUpdating = false;
                updateBtn.textContent = '更新';
                updateBtn.disabled = false;
                App.setStatus('下載更新失敗：' + err);
                alert('下載更新失敗：\n' + err + '\n\n請稍後重試或聯繫管理員');
                return;
            }

            App.setStatus('正在解壓更新...');

            // Extract zip
            try {
                extractZip(zipPath, tmpDir, function (extractErr) {
                    if (extractErr) {
                        updaterState.isUpdating = false;
                        updateBtn.textContent = '更新';
                        updateBtn.disabled = false;
                        App.setStatus('解壓更新失敗：' + extractErr);
                        alert('解壓更新失敗：\n' + extractErr + '\n\n請稍後重試或聯繫管理員');
                        return;
                    }

                    // Find the extension directory in extracted content
                    var sourceDir = findExtensionDir(tmpDir);
                    if (!sourceDir) {
                        updaterState.isUpdating = false;
                        updateBtn.textContent = '更新';
                        updateBtn.disabled = false;
                        App.setStatus('更新包格式不正確');
                        alert('更新包格式不正確，找不到 extension 目錄');
                        return;
                    }

                    // Copy files to extension directory
                    var extPath = App.getState().extensionPath;
                    App.setStatus('正在安裝更新...');

                    try {
                        // Clean tools/ directory first so removed tools don't persist
                        var toolsPath = path.join(extPath, 'tools');
                        if (fs.existsSync(toolsPath)) {
                            deleteFolderRecursive(toolsPath);
                        }

                        copyFolderRecursive(sourceDir, extPath);

                        // Cleanup temp files
                        try {
                            fs.unlinkSync(zipPath);
                            deleteFolderRecursive(tmpDir);
                        } catch (e) {
                            console.warn('Cleanup warning:', e);
                        }

                        hideUpdateBanner();
                        updaterState.isUpdating = false;
                        App.setStatus('更新完成！請重啟 Photoshop');

                        alert('更新至 v' + updaterState.latestVersion + ' 完成！\n\n請重新啟動 Photoshop 以套用更新。');

                    } catch (copyErr) {
                        updaterState.isUpdating = false;
                        updateBtn.textContent = '更新';
                        updateBtn.disabled = false;
                        App.setStatus('安裝更新失敗：' + copyErr);
                        alert('安裝更新失敗：\n' + copyErr + '\n\n請稍後重試或聯繫管理員');
                    }
                });

            } catch (e) {
                updaterState.isUpdating = false;
                updateBtn.textContent = '更新';
                updateBtn.disabled = false;
                App.setStatus('更新過程發生錯誤');
                alert('更新過程發生錯誤：\n' + e.message);
            }
        });
    }

    // ============================================
    // File Utilities
    // ============================================

    function extractZip(zipPath, destDir, callback) {
        try {
            // Use Node.js child_process to call PowerShell for extraction (Windows)
            var exec = require('child_process').exec;
            var cmd = 'powershell -command "Expand-Archive -Path \'' + zipPath.replace(/'/g, "''") +
                '\' -DestinationPath \'' + destDir.replace(/'/g, "''") + '\' -Force"';

            exec(cmd, { timeout: 60000 }, function (error, stdout, stderr) {
                if (error) {
                    callback('Extraction failed: ' + (stderr || error.message));
                } else {
                    callback(null);
                }
            });
        } catch (e) {
            callback('Extraction error: ' + e.message);
        }
    }

    function findExtensionDir(baseDir) {
        // Look for 'extension' directory or CSXS/manifest.xml
        var items = fs.readdirSync(baseDir);

        for (var i = 0; i < items.length; i++) {
            var itemPath = path.join(baseDir, items[i]);
            var stat = fs.statSync(itemPath);

            if (stat.isDirectory()) {
                // Direct 'extension' folder
                if (items[i] === 'extension') {
                    return itemPath;
                }

                // GitHub zipball wraps in a directory, check inside
                var subItems = fs.readdirSync(itemPath);
                for (var j = 0; j < subItems.length; j++) {
                    if (subItems[j] === 'extension') {
                        return path.join(itemPath, 'extension');
                    }
                }

                // Check if this IS the extension dir (has CSXS folder)
                if (subItems.indexOf('CSXS') !== -1) {
                    return itemPath;
                }
            }
        }

        // Check if baseDir itself is the extension dir
        if (fs.existsSync(path.join(baseDir, 'CSXS'))) {
            return baseDir;
        }

        return null;
    }

    function copyFolderRecursive(source, target) {
        if (!fs.existsSync(target)) {
            fs.mkdirSync(target, { recursive: true });
        }

        var items = fs.readdirSync(source);
        items.forEach(function (item) {
            var sourcePath = path.join(source, item);
            var targetPath = path.join(target, item);
            var stat = fs.statSync(sourcePath);

            if (stat.isDirectory()) {
                copyFolderRecursive(sourcePath, targetPath);
            } else {
                fs.copyFileSync(sourcePath, targetPath);
            }
        });
    }

    function deleteFolderRecursive(dirPath) {
        if (!fs.existsSync(dirPath)) return;

        fs.readdirSync(dirPath).forEach(function (item) {
            var itemPath = path.join(dirPath, item);
            if (fs.statSync(itemPath).isDirectory()) {
                deleteFolderRecursive(itemPath);
            } else {
                fs.unlinkSync(itemPath);
            }
        });

        fs.rmdirSync(dirPath);
    }

    // ============================================
    // Register to App
    // ============================================

    window.addEventListener('DOMContentLoaded', function () {
        if (window.App) {
            window.App.updater = {
                checkForUpdates: checkForUpdates,
                performUpdate: performUpdate,
                toggleReleaseNotes: toggleReleaseNotes,
                getState: function () { return updaterState; }
            };
        }
    });

})();

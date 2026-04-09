/**
 * IGS ACD Art Tools - Main Application
 * 框架核心：工具掃描、卡片網格、iframe 管理、postMessage 路由
 */

(function () {
    'use strict';

    // Node.js modules (available in CEP)
    var fs = require('fs');
    var path = require('path');
    var os = require('os');

    // Predefined categories
    var CATEGORIES = {
        all: '全部',
        image: '圖片處理',
        text: '文字工具',
        color: '色彩工具',
        export: '匯出工具',
        workflow: '工作流程',
        layer: '圖層工具',
        ui: 'UI 工具',
        other: '其他'
    };

    // Application state
    var state = {
        tools: [],
        currentFilter: 'all',
        currentTool: null,
        config: {},
        extensionPath: '',
        configPath: ''
    };

    // ============================================
    // Initialization
    // ============================================

    function init() {
        var csInterface = new CSInterface();

        // Get extension path
        state.extensionPath = csInterface.getSystemPath(SystemPath.EXTENSION);

        // Config path: %APPDATA%\IGS-ArtTools\config.json
        var appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
        var configDir = path.join(appData, 'IGS-ArtTools');
        state.configPath = path.join(configDir, 'config.json');

        // Ensure config directory exists
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }

        // Load config
        loadConfig();

        // Load tools
        loadTools();

        // Render UI
        renderFilterBar();
        renderTools();
        updateVersionDisplay();

        // Setup postMessage listener for iframe communication
        window.addEventListener('message', handlePostMessage);

        // Check for updates (silent)
        if (state.config.token && state.config.repo) {
            setTimeout(function () {
                App.updater.checkForUpdates(false);
            }, 2000);
        }

        // If no token configured, show settings on first launch
        if (!state.config.token) {
            App.showSettings();
        }

        setStatus('就緒 - 已載入 ' + state.tools.length + ' 個工具');
    }

    // ============================================
    // Config Management
    // ============================================

    function loadConfig() {
        try {
            if (fs.existsSync(state.configPath)) {
                var raw = fs.readFileSync(state.configPath, 'utf8');
                state.config = JSON.parse(raw);
            } else {
                state.config = { token: '', repo: '' };
            }
        } catch (e) {
            console.error('Failed to load config:', e);
            state.config = { token: '', repo: '' };
        }
    }

    function saveConfig(config) {
        try {
            state.config = config;
            var dir = path.dirname(state.configPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(state.configPath, JSON.stringify(config, null, 2), 'utf8');
            return true;
        } catch (e) {
            console.error('Failed to save config:', e);
            return false;
        }
    }

    // ============================================
    // Tool Discovery & Loading
    // ============================================

    function loadTools() {
        var toolsDir = path.join(state.extensionPath, 'tools');
        state.tools = [];

        if (!fs.existsSync(toolsDir)) {
            console.warn('Tools directory not found:', toolsDir);
            return;
        }

        var dirs;
        try {
            dirs = fs.readdirSync(toolsDir);
        } catch (e) {
            console.error('Failed to read tools directory:', e);
            return;
        }

        dirs.forEach(function (dirName) {
            var toolDir = path.join(toolsDir, dirName);
            var manifestPath = path.join(toolDir, 'manifest.json');

            // Skip non-directories
            try {
                if (!fs.statSync(toolDir).isDirectory()) return;
            } catch (e) {
                return;
            }

            // Skip directories without manifest
            if (!fs.existsSync(manifestPath)) {
                console.warn('No manifest.json in tool:', dirName);
                return;
            }

            try {
                var raw = fs.readFileSync(manifestPath, 'utf8');
                var manifest = JSON.parse(raw);

                // Validate required fields
                if (!manifest.name || !manifest.entry) {
                    console.warn('Invalid manifest in tool:', dirName);
                    return;
                }

                // Check PS version compatibility
                if (manifest.minPsVersion) {
                    var csInterface = new CSInterface();
                    var hostVersion = csInterface.hostEnvironment.appVersion;
                    var majorVersion = parseInt(hostVersion.split('.')[0], 10);
                    var minVersion = parseInt(manifest.minPsVersion.split('.')[0], 10);
                    if (majorVersion < minVersion) {
                        console.info('Tool "' + manifest.name + '" requires PS ' + manifest.minPsVersion + ', skipping');
                        return;
                    }
                }

                // Normalize category to array
                var categories = manifest.category || ['other'];
                if (typeof categories === 'string') {
                    categories = [categories];
                }

                state.tools.push({
                    id: dirName,
                    name: manifest.name,
                    icon: manifest.icon ? path.join(toolDir, manifest.icon) : null,
                    entry: path.join(toolDir, manifest.entry),
                    version: manifest.version || '0.0.0',
                    description: manifest.description || '',
                    categories: categories,
                    minPsVersion: manifest.minPsVersion || null,
                    dir: toolDir
                });

            } catch (e) {
                console.error('Failed to load tool manifest:', dirName, e);
            }
        });

        // Sort by name
        state.tools.sort(function (a, b) {
            return a.name.localeCompare(b.name);
        });
    }

    // ============================================
    // UI Rendering
    // ============================================

    function renderFilterBar() {
        var filterBar = document.getElementById('filterBar');
        filterBar.innerHTML = '';

        // Collect all categories used by loaded tools
        var usedCategories = { all: true };
        state.tools.forEach(function (tool) {
            tool.categories.forEach(function (cat) {
                usedCategories[cat] = true;
            });
        });

        // Render filter buttons
        Object.keys(CATEGORIES).forEach(function (key) {
            if (!usedCategories[key]) return;

            var btn = document.createElement('button');
            btn.className = 'filter-btn' + (key === state.currentFilter ? ' active' : '');
            btn.dataset.category = key;
            btn.textContent = CATEGORIES[key];
            btn.onclick = function () {
                App.filterTools(key, btn);
            };
            filterBar.appendChild(btn);
        });

        // Add buttons for unknown categories (not in predefined list)
        Object.keys(usedCategories).forEach(function (key) {
            if (key === 'all' || CATEGORIES[key]) return;

            var btn = document.createElement('button');
            btn.className = 'filter-btn' + (key === state.currentFilter ? ' active' : '');
            btn.dataset.category = key;
            btn.textContent = key;
            btn.onclick = function () {
                App.filterTools(key, btn);
            };
            filterBar.appendChild(btn);
        });
    }

    function renderTools() {
        var grid = document.getElementById('toolsGrid');
        var empty = document.getElementById('emptyState');
        grid.innerHTML = '';

        var filtered = state.tools;
        if (state.currentFilter !== 'all') {
            filtered = state.tools.filter(function (tool) {
                return tool.categories.indexOf(state.currentFilter) !== -1;
            });
        }

        if (filtered.length === 0) {
            empty.style.display = 'flex';
            grid.style.display = 'none';
            return;
        }

        empty.style.display = 'none';
        grid.style.display = 'grid';

        filtered.forEach(function (tool) {
            var card = document.createElement('div');
            card.className = 'tool-card';
            card.onclick = function () {
                App.openTool(tool);
            };
            card.title = tool.description;

            // Icon
            var iconDiv = document.createElement('div');
            iconDiv.className = 'tool-card-icon';
            if (tool.icon && fs.existsSync(tool.icon)) {
                var img = document.createElement('img');
                img.src = 'file:///' + tool.icon.replace(/\\/g, '/');
                img.alt = tool.name;
                iconDiv.appendChild(img);
            } else {
                iconDiv.textContent = tool.name.charAt(0).toUpperCase();
            }
            card.appendChild(iconDiv);

            // Name
            var nameDiv = document.createElement('div');
            nameDiv.className = 'tool-card-name';
            nameDiv.textContent = tool.name;
            card.appendChild(nameDiv);

            // Version
            var verDiv = document.createElement('div');
            verDiv.className = 'tool-card-version';
            verDiv.textContent = 'v' + tool.version;
            card.appendChild(verDiv);

            grid.appendChild(card);
        });
    }

    function updateVersionDisplay() {
        // Read version from manifest.xml or package
        var versionEl = document.getElementById('versionText');
        try {
            var manifestPath = path.join(state.extensionPath, 'CSXS', 'manifest.xml');
            var xml = fs.readFileSync(manifestPath, 'utf8');
            var match = xml.match(/ExtensionBundleVersion="([^"]+)"/);
            if (match) {
                versionEl.textContent = 'v' + match[1];
                state.config.currentVersion = match[1];
            }
        } catch (e) {
            console.error('Failed to read version:', e);
        }
    }

    function setStatus(text) {
        var el = document.getElementById('statusText');
        if (el) el.textContent = text;
    }

    // ============================================
    // Tool Navigation
    // ============================================

    function openTool(tool) {
        state.currentTool = tool;

        var homeView = document.getElementById('homeView');
        var toolView = document.getElementById('toolView');
        var iframe = document.getElementById('toolIframe');
        var title = document.getElementById('toolTitle');

        title.textContent = tool.name;
        iframe.src = 'file:///' + tool.entry.replace(/\\/g, '/');

        homeView.classList.add('hidden');
        toolView.classList.add('active');

        setStatus('工具：' + tool.name);
    }

    function goHome() {
        var homeView = document.getElementById('homeView');
        var toolView = document.getElementById('toolView');
        var iframe = document.getElementById('toolIframe');

        toolView.classList.remove('active');
        homeView.classList.remove('hidden');

        // Unload iframe
        iframe.src = 'about:blank';
        state.currentTool = null;

        setStatus('就緒 - 已載入 ' + state.tools.length + ' 個工具');
    }

    // ============================================
    // Category Filter
    // ============================================

    function filterTools(category, btnElement) {
        state.currentFilter = category;

        // Update active button
        var buttons = document.querySelectorAll('.filter-btn');
        buttons.forEach(function (btn) {
            btn.classList.remove('active');
        });
        if (btnElement) btnElement.classList.add('active');

        renderTools();
    }

    // ============================================
    // PostMessage Handler (iframe ↔ framework)
    // ============================================

    function handlePostMessage(event) {
        var data = event.data;
        if (!data || !data.type) return;

        switch (data.type) {
            case 'ps-api':
                // Framework built-in API call
                handlePsApi(data, event.source);
                break;

            case 'ps-jsx':
                // Custom JSX execution
                handlePsJsx(data, event.source);
                break;

            case 'ps-api-response':
                // Ignore responses (these go to iframes)
                break;

            case 'save-temp-file':
                // Save binary data to a temp file (used by tools like fx-remove-bg)
                handleSaveTempFile(data);
                break;

            case 'save-text-file':
                // Save UTF-8 text to a file (used by tools like ui-to-cocos)
                handleSaveTextFile(data, event.source);
                break;

            case 'mkdir':
                // Create directory recursively
                handleMkdir(data, event.source);
                break;

            default:
                console.warn('Unknown postMessage type:', data.type);
        }
    }

    function handlePsApi(data, source) {
        var action = data.action;
        var params = data.params || {};
        var callId = data.callId || null;

        if (!App.psBridge[action]) {
            sendResponse(source, callId, null, 'Unknown API action: ' + action);
            return;
        }

        App.psBridge[action](params, function (err, result) {
            sendResponse(source, callId, result, err);
        });
    }

    function handlePsJsx(data, source) {
        var script = data.script;
        var callId = data.callId || null;

        if (!script) {
            sendResponse(source, callId, null, 'No script provided');
            return;
        }

        var csInterface = new CSInterface();
        csInterface.evalScript(script, function (result) {
            if (result === 'EvalScript error.') {
                sendResponse(source, callId, null, 'ExtendScript execution error');
            } else {
                sendResponse(source, callId, result, null);
            }
        });
    }

    function sendResponse(source, callId, result, error) {
        if (!source) return;
        try {
            source.postMessage({
                type: 'ps-api-response',
                callId: callId,
                result: result,
                error: error || null
            }, '*');
        } catch (e) {
            console.error('Failed to send response to iframe:', e);
        }
    }

    // ============================================
    // Save Temp File (for tools that need to write binary data)
    // ============================================

    function handleSaveTempFile(data) {
        try {
            var filePath = data.filePath;
            var binaryData = data.binaryData;

            if (!filePath || !binaryData) {
                console.error('save-temp-file: missing filePath or binaryData');
                return;
            }

            // Convert binary string to Buffer and write
            var buffer = Buffer.alloc(binaryData.length);
            for (var i = 0; i < binaryData.length; i++) {
                buffer[i] = binaryData.charCodeAt(i);
            }
            fs.writeFileSync(filePath, buffer);
            console.log('Temp file saved:', filePath);
        } catch (e) {
            console.error('Failed to save temp file:', e);
        }
    }

    // ============================================
    // Save Text File (UTF-8, for JSON etc.)
    // ============================================

    function handleSaveTextFile(data, source) {
        var callId = data.callId || null;
        try {
            var filePath = data.filePath;
            var textContent = data.textContent;

            if (!filePath || textContent === undefined) {
                console.error('save-text-file: missing filePath or textContent');
                sendResponse(source, callId, null, 'missing filePath or textContent');
                return;
            }

            // Ensure directory exists
            var dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            fs.writeFileSync(filePath, textContent, 'utf8');
            console.log('Text file saved:', filePath);
            sendResponse(source, callId, { success: true, filePath: filePath }, null);
        } catch (e) {
            console.error('Failed to save text file:', e);
            sendResponse(source, callId, null, String(e));
        }
    }

    // ============================================
    // Create Directory
    // ============================================

    function handleMkdir(data, source) {
        var callId = data.callId || null;
        try {
            var dirPath = data.dirPath;
            if (!dirPath) {
                sendResponse(source, callId, null, 'missing dirPath');
                return;
            }
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
            }
            console.log('Directory created:', dirPath);
            sendResponse(source, callId, { success: true, dirPath: dirPath }, null);
        } catch (e) {
            console.error('Failed to create directory:', e);
            sendResponse(source, callId, null, String(e));
        }
    }

    // ============================================
    // Settings
    // ============================================

    function showSettings() {
        document.getElementById('inputToken').value = state.config.token || '';
        document.getElementById('inputRepo').value = state.config.repo || '';
        document.getElementById('settingsModal').classList.add('visible');
    }

    function hideSettings() {
        document.getElementById('settingsModal').classList.remove('visible');
    }

    function saveSettings() {
        var token = document.getElementById('inputToken').value.trim();
        var repo = document.getElementById('inputRepo').value.trim();

        if (saveConfig({ token: token, repo: repo })) {
            hideSettings();
            setStatus('設定已儲存');
        } else {
            alert('儲存設定失敗，請檢查檔案權限');
        }
    }

    // ============================================
    // Public API (window.App)
    // ============================================

    window.App = {
        init: init,
        openTool: openTool,
        goHome: goHome,
        filterTools: filterTools,
        showSettings: showSettings,
        hideSettings: hideSettings,
        saveSettings: saveSettings,
        setStatus: setStatus,
        getState: function () { return state; },
        getConfig: function () { return state.config; },
        saveConfig: saveConfig,

        // Will be populated by other modules
        psBridge: {},
        updater: {}
    };

    // Initialize when DOM is ready
    document.addEventListener('DOMContentLoaded', init);

})();

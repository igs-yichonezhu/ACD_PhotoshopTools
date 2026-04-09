'use strict';

/**
 * IGS UI Importer - Cocos Creator 3.x Editor Extension
 *
 * Reads layout.json + images exported by IGS ACD Art Tools PS plugin,
 * generates a .prefab file, and imports it into the project assets.
 *
 * User simply drags the prefab into their scene.
 *
 * Tested on Cocos Creator 3.8.6
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Generate a random fileId (for PrefabInfo)
function randomFileId() {
    return crypto.randomBytes(10).toString('hex').substring(0, 20);
}

// UI_2D layer = 1 << 25 = 33554432
const UI_2D_LAYER = 33554432;

/**
 * Build a Cocos Creator 3.x .prefab JSON from layout data
 */
function buildPrefabJson(layout, imageUuidMap) {
    // The prefab is a flat array of serialized objects.
    // References between objects use { "__id__": arrayIndex }.
    // External asset references use { "__uuid__": "...", "__expectedType__": "..." }.
    const objects = [];

    // Helper: push object and return its index
    function addObj(obj) {
        const idx = objects.length;
        objects.push(obj);
        return idx;
    }

    // ---- Index 0: Prefab asset descriptor ----
    const prefabIdx = addObj({
        '__type__': 'cc.Prefab',
        '_name': '',
        '_objFlags': 0,
        '_native': '',
        'data': null, // will point to root node
        'optimizationPolicy': 0,
        'persistent': false
    });

    // ---- Helper to create a Node + UITransform + PrefabInfo ----
    // Returns { nodeIdx, transformIdx, children: [] }
    function createNode(name, parentIdx, size, position) {
        const nodeIdx = addObj({
            '__type__': 'cc.Node',
            '_name': name,
            '_objFlags': 0,
            '_parent': parentIdx !== null ? { '__id__': parentIdx } : null,
            '_children': [], // filled later
            '_active': true,
            '_components': [], // filled later
            '_prefab': null, // filled later
            '_lpos': {
                '__type__': 'cc.Vec3',
                'x': position ? position.x : 0,
                'y': position ? position.y : 0,
                'z': 0
            },
            '_lrot': { '__type__': 'cc.Quat', 'x': 0, 'y': 0, 'z': 0, 'w': 1 },
            '_lscale': { '__type__': 'cc.Vec3', 'x': 1, 'y': 1, 'z': 1 },
            '_layer': UI_2D_LAYER,
            '_euler': { '__type__': 'cc.Vec3', 'x': 0, 'y': 0, 'z': 0 }
        });

        // UITransform
        const transformIdx = addObj({
            '__type__': 'cc.UITransform',
            '_name': '',
            '_objFlags': 0,
            'node': { '__id__': nodeIdx },
            '_enabled': true,
            '_contentSize': {
                '__type__': 'cc.Size',
                'width': size ? size.width : 0,
                'height': size ? size.height : 0
            },
            '_anchorPoint': { '__type__': 'cc.Vec2', 'x': 0.5, 'y': 0.5 },
            '_priority': 0
        });

        // PrefabInfo
        const prefabInfoIdx = addObj({
            '__type__': 'cc.PrefabInfo',
            'root': { '__id__': 1 }, // always points to root node (index 1)
            'asset': { '__id__': 0 }, // points to Prefab descriptor
            'fileId': randomFileId()
        });

        // Wire up
        objects[nodeIdx]._components.push({ '__id__': transformIdx });
        objects[nodeIdx]._prefab = { '__id__': prefabInfoIdx };

        return { nodeIdx, transformIdx };
    }

    // ---- Root Node (index 1) ----
    const docName = (layout.document.name || 'import').replace(/\.[^.]+$/, '');
    const root = createNode('PSD_' + docName, null, {
        width: layout.document.width,
        height: layout.document.height
    });

    // Point Prefab.data to root node
    objects[prefabIdx].data = { '__id__': root.nodeIdx };

    // ---- Build hierarchy ----
    // Process ALL nodes in layout.json order (groups + leaves interleaved).
    // This preserves the exact PSD sibling order → correct Cocos z-order.
    const nodeMap = { '': root };

    let groupCount = 0;
    let spriteCount = 0;
    let labelCount = 0;
    const failedSprites = [];
    let prefabWarnings = [];

    for (const nodeInfo of layout.nodes) {
        const parentInfo = nodeMap[nodeInfo.parent || ''] || root;

        if (nodeInfo.type === 'group') {
            // Create group node
            const grp = createNode(nodeInfo.name, parentInfo.nodeIdx);
            nodeMap[nodeInfo.path] = grp;
            objects[parentInfo.nodeIdx]._children.push({ '__id__': grp.nodeIdx });
            groupCount++;
            continue;
        }

        // Create leaf node
        const size = nodeInfo.size || null;
        const pos = nodeInfo.position || null;

        const leaf = createNode(nodeInfo.name, parentInfo.nodeIdx, size, pos);
        objects[parentInfo.nodeIdx]._children.push({ '__id__': leaf.nodeIdx });

        // Opacity
        if (nodeInfo.opacity !== undefined && nodeInfo.opacity < 1) {
            const opIdx = addObj({
                '__type__': 'cc.UIOpacity',
                '_name': '',
                '_objFlags': 0,
                'node': { '__id__': leaf.nodeIdx },
                '_enabled': true,
                '_opacity': Math.round(nodeInfo.opacity * 255)
            });
            objects[leaf.nodeIdx]._components.push({ '__id__': opIdx });
        }

        if (nodeInfo.type === 'image' && nodeInfo.image) {
            const uuid = imageUuidMap[nodeInfo.image];

            if (uuid) {
                const spriteIdx = addObj({
                    '__type__': 'cc.Sprite',
                    '_name': '',
                    '_objFlags': 0,
                    'node': { '__id__': leaf.nodeIdx },
                    '_enabled': true,
                    '_customMaterial': null,
                    '_srcBlendFactor': 2,
                    '_dstBlendFactor': 4,
                    '_color': { '__type__': 'cc.Color', 'r': 255, 'g': 255, 'b': 255, 'a': 255 },
                    '_spriteFrame': {
                        '__uuid__': uuid,
                        '__expectedType__': 'cc.SpriteFrame'
                    },
                    '_type': 0,        // SIMPLE
                    '_fillType': 0,
                    '_sizeMode': 2,    // CUSTOM (use our size, not native)
                    '_fillCenter': { '__type__': 'cc.Vec2', 'x': 0, 'y': 0 },
                    '_fillStart': 0,
                    '_fillRange': 0,
                    '_isTrimmedMode': true,
                    '_atlas': null
                });
                objects[leaf.nodeIdx]._components.push({ '__id__': spriteIdx });
                spriteCount++;
            } else {
                failedSprites.push(nodeInfo.name);
            }

        } else if (nodeInfo.type === 'text' && nodeInfo.label) {
            const lbl = nodeInfo.label;
            const r = lbl.color ? Math.round(lbl.color.r || 0) : 255;
            const g = lbl.color ? Math.round(lbl.color.g || 0) : 255;
            const b = lbl.color ? Math.round(lbl.color.b || 0) : 255;

            let hAlign = 0; // LEFT
            if (lbl.horizontalAlign === 'CENTER') hAlign = 1;
            else if (lbl.horizontalAlign === 'RIGHT') hAlign = 2;

            // Vertical text: W=fontSize, overflow=RESIZE_HEIGHT(3), enableWrapText=true
            const isVert = lbl.isVertical || false;
            const overflow = isVert ? 3 : 0;    // 3=RESIZE_HEIGHT, 0=NONE
            const wrapText = isVert ? true : false;

            const labelIdx = addObj({
                '__type__': 'cc.Label',
                '_name': '',
                '_objFlags': 0,
                'node': { '__id__': leaf.nodeIdx },
                '_enabled': true,
                '_customMaterial': null,
                '_srcBlendFactor': 2,
                '_dstBlendFactor': 4,
                '_color': { '__type__': 'cc.Color', 'r': r, 'g': g, 'b': b, 'a': 255 },
                '_string': lbl.text || '',
                '_horizontalAlign': isVert ? 1 : hAlign,  // vertical: CENTER
                '_verticalAlign': 1,  // CENTER
                '_actualFontSize': lbl.fontSize || 24,
                '_fontSize': lbl.fontSize || 24,
                '_fontFamily': lbl.fontFamily || 'Arial',
                '_lineHeight': isVert ? (lbl.fontSize || 24) : (lbl.lineHeight || Math.round((lbl.fontSize || 24) * 1.2)),
                '_overflow': overflow,
                '_enableWrapText': wrapText,
                '_font': null,
                '_isSystemFontUsed': true,
                '_spacingX': lbl.letterSpacing || 0,
                '_isItalic': lbl.isItalic || false,
                '_isBold': lbl.isBold || false,
                '_isUnderline': lbl.isUnderline || false,
                '_underlineHeight': 2,
                '_cacheMode': 0
            });
            objects[leaf.nodeIdx]._components.push({ '__id__': labelIdx });
            labelCount++;

            // Track issues for import report
            if (isVert) {
                if (!prefabWarnings) prefabWarnings = [];
                prefabWarnings.push({ name: nodeInfo.name, issue: '直排文字 → 用 RESIZE_HEIGHT 模擬' });
            }
            if (lbl.hasLayerFX) {
                if (!prefabWarnings) prefabWarnings = [];
                prefabWarnings.push({ name: nodeInfo.name, issue: 'FX效果未帶入 (' + (lbl.layerFXList || []).join(',') + ')' });
            }
        }
    }

    return {
        json: objects,
        stats: {
            groups: groupCount,
            sprites: spriteCount,
            labels: labelCount,
            failedSprites: failedSprites,
            warnings: prefabWarnings,
            rootName: 'PSD_' + docName
        }
    };
}


module.exports = {

    methods: {

        async importLayout() {
            // ---- Step 1: Select layout.json ----
            let result;
            try {
                result = await Editor.Dialog.select({
                    title: '選擇 layout.json',
                    filters: [{ name: 'Layout JSON', extensions: ['json'] }],
                    properties: ['openFile']
                });
            } catch (e) {
                console.error('[IGS UI Importer] Dialog error:', e);
                return;
            }

            if (!result || result.canceled || !result.filePaths || result.filePaths.length === 0) {
                return;
            }

            const jsonPath = result.filePaths[0];
            const baseDir = path.dirname(jsonPath);

            let layout;
            try {
                const raw = fs.readFileSync(jsonPath, 'utf8');
                layout = JSON.parse(raw);
            } catch (e) {
                await Editor.Dialog.error('讀取 layout.json 失敗', { detail: String(e) });
                return;
            }

            if (!layout.nodes || !layout.document) {
                await Editor.Dialog.error('layout.json 格式不正確', { detail: '缺少 nodes 或 document 欄位' });
                return;
            }

            const docName = (layout.document.name || 'import').replace(/\.[^.]+$/, '');
            console.log('[IGS UI Importer] Document:', docName,
                layout.document.width + 'x' + layout.document.height,
                'Nodes:', layout.nodes.length);

            // ---- Step 2: Copy images to project assets ----
            const imagesDir = path.join(baseDir, 'images');
            const hasImages = fs.existsSync(imagesDir);
            const importSubDir = 'igs-ui-import';
            const assetsBaseDir = path.join(Editor.Project.path, 'assets', importSubDir);
            const assetsImagesDir = path.join(assetsBaseDir, 'images');

            let imageCount = 0;
            let imageFiles = [];
            if (hasImages) {
                fs.mkdirSync(assetsImagesDir, { recursive: true });
                imageFiles = fs.readdirSync(imagesDir).filter(f => f.endsWith('.png'));
                imageCount = imageFiles.length;
                for (const imgFile of imageFiles) {
                    fs.copyFileSync(
                        path.join(imagesDir, imgFile),
                        path.join(assetsImagesDir, imgFile)
                    );
                }
                console.log('[IGS UI Importer] Copied', imageCount, 'images');

                // First refresh: let Cocos import images (default type = "texture")
                try {
                    await Editor.Message.request('asset-db', 'refresh-asset', 'db://assets/' + importSubDir);
                } catch (e) {
                    console.warn('[IGS UI Importer] Refresh warning:', e.message);
                }
                await new Promise(r => setTimeout(r, 3000));

                // Step 2b: Change image type from "texture" to "sprite-frame"
                // By default Cocos imports PNGs as type "texture" which only creates
                // a Texture2D sub-asset (@6c48a). For Sprite components we need
                // type "sprite-frame" which also creates a SpriteFrame sub-asset (@f9941).
                let changedCount = 0;
                for (const imgFile of imageFiles) {
                    const metaPath = path.join(assetsImagesDir, imgFile + '.meta');
                    try {
                        if (!fs.existsSync(metaPath)) continue;
                        const metaRaw = fs.readFileSync(metaPath, 'utf8');
                        const meta = JSON.parse(metaRaw);
                        if (meta.userData && meta.userData.type !== 'sprite-frame') {
                            meta.userData.type = 'sprite-frame';
                            meta.userData.fixAlphaTransparencyArtifacts = false;
                            fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');
                            changedCount++;
                        }
                    } catch (e) {
                        console.warn('[IGS UI Importer] Meta update failed:', imgFile, e.message);
                    }
                }
                console.log('[IGS UI Importer] Changed', changedCount, '/', imageCount, 'images to sprite-frame type');

                // Second refresh: re-import with sprite-frame type to generate SpriteFrame sub-assets
                if (changedCount > 0) {
                    try {
                        await Editor.Message.request('asset-db', 'refresh-asset', 'db://assets/' + importSubDir + '/images');
                    } catch (e) {
                        console.warn('[IGS UI Importer] Second refresh warning:', e.message);
                    }
                    await new Promise(r => setTimeout(r, 4000));
                }
            }

            // ---- Step 3: Resolve spriteFrame UUIDs ----
            // After changing type to "sprite-frame", each image has two sub-assets:
            //   - Texture2D:   uuid@6c48a (key "6c48a", importer "texture")
            //   - SpriteFrame: uuid@f9941 (key "f9941", importer "sprite-frame")
            // Sprite._spriteFrame must reference the SpriteFrame UUID, not Texture2D.
            const imageUuidMap = {};
            if (hasImages) {
                for (const nodeInfo of layout.nodes) {
                    if (nodeInfo.type !== 'image' || !nodeInfo.image) continue;
                    if (imageUuidMap[nodeInfo.image]) continue;

                    // First try: read .meta file directly (fastest, most reliable)
                    const metaPath = path.join(assetsImagesDir, nodeInfo.image + '.meta');
                    try {
                        if (fs.existsSync(metaPath)) {
                            const metaRaw = fs.readFileSync(metaPath, 'utf8');
                            const meta = JSON.parse(metaRaw);
                            if (meta.subMetas) {
                                // Look for sprite-frame sub-asset
                                for (const key of Object.keys(meta.subMetas)) {
                                    const sub = meta.subMetas[key];
                                    if (sub.importer === 'sprite-frame' || key === 'f9941') {
                                        imageUuidMap[nodeInfo.image] = sub.uuid;
                                        break;
                                    }
                                }
                            }
                            // Fallback: construct from root UUID
                            if (!imageUuidMap[nodeInfo.image] && meta.uuid) {
                                imageUuidMap[nodeInfo.image] = meta.uuid + '@f9941';
                            }
                        }
                    } catch (e) {
                        console.warn('[IGS UI Importer] Meta read failed:', nodeInfo.image, e.message);
                    }

                    // Second try: use Editor API
                    if (!imageUuidMap[nodeInfo.image]) {
                        const dbPath = 'db://assets/' + importSubDir + '/images/' + nodeInfo.image;
                        try {
                            const info = await Editor.Message.request('asset-db', 'query-asset-info', dbPath);
                            if (info && info.uuid) {
                                imageUuidMap[nodeInfo.image] = info.uuid + '@f9941';
                            }
                        } catch (e) {
                            console.warn('[IGS UI Importer] UUID query failed:', nodeInfo.image, e.message);
                        }
                    }
                }
                console.log('[IGS UI Importer] Resolved', Object.keys(imageUuidMap).length, '/', imageCount, 'spriteFrame UUIDs');
            }

            // ---- Step 4: Generate .prefab file ----
            console.log('[IGS UI Importer] Generating prefab...');

            const prefabResult = buildPrefabJson(layout, imageUuidMap);
            const prefabJsonStr = JSON.stringify(prefabResult.json, null, 2);
            const prefabFileName = 'PSD_' + docName + '.prefab';
            const prefabFilePath = path.join(assetsBaseDir, prefabFileName);

            fs.mkdirSync(assetsBaseDir, { recursive: true });
            fs.writeFileSync(prefabFilePath, prefabJsonStr, 'utf8');
            console.log('[IGS UI Importer] Prefab saved:', prefabFilePath);

            // Refresh to import the prefab
            try {
                await Editor.Message.request('asset-db', 'refresh-asset',
                    'db://assets/' + importSubDir + '/' + prefabFileName);
            } catch (e) {
                // Try refreshing the whole folder
                try {
                    await Editor.Message.request('asset-db', 'refresh-asset', 'db://assets/' + importSubDir);
                } catch (e2) {
                    console.warn('[IGS UI Importer] Prefab refresh warning:', e2.message);
                }
            }
            await new Promise(r => setTimeout(r, 1000));

            // ---- Done! Build report ----
            const stats = prefabResult.stats;
            const warnings = stats.warnings || [];

            // Collect clipped layers and blendMode layers from layout
            const clippedLayers = layout.nodes.filter(n => n.clipped);
            const blendModeLayers = layout.nodes.filter(n => n.blendMode && n.blendMode !== 'NORMAL');
            const textAsImageLayers = layout.nodes.filter(n => n.textAsImage);

            let detail =
                '文件: ' + layout.document.name + '\n' +
                '尺寸: ' + layout.document.width + 'x' + layout.document.height + '\n\n' +
                '群組: ' + stats.groups + ' 個\n' +
                '圖片: ' + stats.sprites + ' 個 (已綁定 SpriteFrame)\n' +
                '文字: ' + stats.labels + ' 個\n';

            if (textAsImageLayers.length > 0) {
                detail += '文字→圖片: ' + textAsImageLayers.length + ' 個\n';
            }

            if (stats.failedSprites.length > 0) {
                detail += '\n⚠ 未綁定圖片: ' + stats.failedSprites.length + ' 個\n';
            }

            // Warnings section
            if (warnings.length > 0 || clippedLayers.length > 0 || blendModeLayers.length > 0) {
                detail += '\n────── 需手動調整 ──────\n';

                if (warnings.length > 0) {
                    for (const w of warnings) {
                        detail += '⚠ ' + w.name + ': ' + w.issue + '\n';
                    }
                }

                if (clippedLayers.length > 0) {
                    detail += '\n⬇ 剪裁遮色片 (' + clippedLayers.length + ' 個):\n';
                    for (const cl of clippedLayers) {
                        detail += '  • ' + cl.name + ' → 需手動設定 cc.Mask\n';
                    }
                }

                if (blendModeLayers.length > 0) {
                    detail += '\n◐ 混合模式 (' + blendModeLayers.length + ' 個):\n';
                    for (const bl of blendModeLayers) {
                        detail += '  • ' + bl.name + ' (' + bl.blendMode + ') → 需自訂 Shader\n';
                    }
                }
            }

            detail += '\n✅ Prefab 已生成: assets/' + importSubDir + '/' + prefabFileName +
                '\n\n👉 請從 Assets 面板將 Prefab 拖入場景的 Canvas 節點下即可使用';

            console.log('[IGS UI Importer] Complete!', JSON.stringify(stats));
            await Editor.Dialog.info('匯入完成！', { detail: detail });
        }
    }
};

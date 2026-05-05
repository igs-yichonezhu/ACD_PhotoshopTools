/**
 * IGS ACD Art Tools - ExtendScript Host
 * Photoshop DOM 操作函式，由 CSInterface.evalScript() 呼叫
 *
 * 命名規則：所有函式以 IGS_ 開頭避免命名衝突
 * 回傳格式：JSON 字串
 */

// ============================================
// Helper Functions
// ============================================

function IGS_jsonStringify(obj) {
    // ExtendScript 沒有 JSON.stringify，手動實作簡易版
    if (obj === null || obj === undefined) return 'null';
    if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);
    if (typeof obj === 'string') {
        var s = obj;
        s = s.replace(/\\/g, '\\\\');
        s = s.replace(/"/g, '\\"');
        s = s.replace(/\n/g, '\\n');
        s = s.replace(/\r/g, '\\r');
        s = s.replace(/\t/g, '\\t');
        // Escape other control characters (U+0000 to U+001F)
        s = s.replace(/[\x00-\x1f]/g, function(ch) {
            var code = ch.charCodeAt(0).toString(16);
            while (code.length < 4) code = '0' + code;
            return '\\u' + code;
        });
        return '"' + s + '"';
    }

    if (obj instanceof Array) {
        var arrItems = [];
        for (var i = 0; i < obj.length; i++) {
            arrItems.push(IGS_jsonStringify(obj[i]));
        }
        return '[' + arrItems.join(',') + ']';
    }

    if (typeof obj === 'object') {
        var objItems = [];
        for (var key in obj) {
            if (obj.hasOwnProperty(key)) {
                objItems.push('"' + key + '":' + IGS_jsonStringify(obj[key]));
            }
        }
        return '{' + objItems.join(',') + '}';
    }

    return String(obj);
}

function IGS_hasActiveDocument() {
    try {
        return app.documents.length > 0 && app.activeDocument != null;
    } catch (e) {
        return false;
    }
}

function IGS_error(msg) {
    return IGS_jsonStringify({ error: msg });
}

function IGS_success(data) {
    return IGS_jsonStringify({ success: true, data: data });
}

// ============================================
// 1. Document Operations (文件操作)
// ============================================

function IGS_getActiveDocument() {
    if (!IGS_hasActiveDocument()) return IGS_error('No active document');

    var doc = app.activeDocument;
    return IGS_success({
        name: doc.name,
        width: doc.width.as('px'),
        height: doc.height.as('px'),
        resolution: doc.resolution,
        mode: String(doc.mode),
        path: doc.path ? String(doc.path) : '',
        saved: doc.saved,
        layerCount: doc.layers.length
    });
}

function IGS_openFile(filePath) {
    try {
        var file = new File(filePath);
        if (!file.exists) return IGS_error('File not found: ' + filePath);
        app.open(file);
        return IGS_success({ name: app.activeDocument.name });
    } catch (e) {
        return IGS_error(String(e));
    }
}

function IGS_saveDocument() {
    if (!IGS_hasActiveDocument()) return IGS_error('No active document');
    try {
        app.activeDocument.save();
        return IGS_success(true);
    } catch (e) {
        return IGS_error(String(e));
    }
}

function IGS_saveDocumentAs(filePath) {
    if (!IGS_hasActiveDocument()) return IGS_error('No active document');
    try {
        var file = new File(filePath);
        var opts = new PhotoshopSaveOptions();
        opts.layers = true;
        app.activeDocument.saveAs(file, opts, true);
        return IGS_success(true);
    } catch (e) {
        return IGS_error(String(e));
    }
}

function IGS_exportPNG(filePath, quality) {
    if (!IGS_hasActiveDocument()) return IGS_error('No active document');
    try {
        var file = new File(filePath);
        var opts = new PNGSaveOptions();
        opts.compression = Math.round((100 - quality) / 100 * 9); // 0-9
        opts.interlaced = false;
        app.activeDocument.saveAs(file, opts, true, Extension.LOWERCASE);
        return IGS_success(true);
    } catch (e) {
        return IGS_error(String(e));
    }
}

function IGS_exportJPG(filePath, quality) {
    if (!IGS_hasActiveDocument()) return IGS_error('No active document');
    try {
        var file = new File(filePath);
        var opts = new JPEGSaveOptions();
        opts.quality = quality; // 0-12
        opts.embedColorProfile = true;
        app.activeDocument.saveAs(file, opts, true, Extension.LOWERCASE);
        return IGS_success(true);
    } catch (e) {
        return IGS_error(String(e));
    }
}

function IGS_closeDocument(save) {
    if (!IGS_hasActiveDocument()) return IGS_error('No active document');
    try {
        if (save) {
            app.activeDocument.close(SaveOptions.SAVECHANGES);
        } else {
            app.activeDocument.close(SaveOptions.DONOTSAVECHANGES);
        }
        return IGS_success(true);
    } catch (e) {
        return IGS_error(String(e));
    }
}

// ============================================
// 2. Layer Operations (圖層操作)
// ============================================

function IGS_getLayers() {
    if (!IGS_hasActiveDocument()) return IGS_error('No active document');

    var doc = app.activeDocument;
    var layers = [];

    function collectLayers(layerSet, depth) {
        for (var i = 0; i < layerSet.length; i++) {
            var layer = layerSet[i];
            layers.push({
                name: layer.name,
                kind: String(layer.kind),
                visible: layer.visible,
                opacity: layer.opacity,
                depth: depth
            });

            // Recurse into layer groups
            if (layer.typename === 'LayerSet' && layer.layers) {
                collectLayers(layer.layers, depth + 1);
            }
        }
    }

    collectLayers(doc.layers, 0);
    return IGS_success(layers);
}

function IGS_getActiveLayer() {
    if (!IGS_hasActiveDocument()) return IGS_error('No active document');
    try {
        var layer = app.activeDocument.activeLayer;
        return IGS_success({
            name: layer.name,
            kind: String(layer.kind),
            visible: layer.visible,
            opacity: layer.opacity,
            blendMode: String(layer.blendMode)
        });
    } catch (e) {
        return IGS_error(String(e));
    }
}

function IGS_selectLayer(name) {
    if (!IGS_hasActiveDocument()) return IGS_error('No active document');
    try {
        var doc = app.activeDocument;
        var layer = null;
        // Try artLayers first, then layerSets (groups)
        try { layer = doc.artLayers.getByName(name); } catch (e1) {}
        if (!layer) {
            try { layer = doc.layerSets.getByName(name); } catch (e2) {}
        }
        if (!layer) return IGS_error('Layer not found: ' + name);
        doc.activeLayer = layer;
        return IGS_success(true);
    } catch (e) {
        return IGS_error('Layer not found: ' + name);
    }
}

function IGS_createLayer(name) {
    if (!IGS_hasActiveDocument()) return IGS_error('No active document');
    try {
        var layer = app.activeDocument.artLayers.add();
        layer.name = name;
        return IGS_success({ name: layer.name });
    } catch (e) {
        return IGS_error(String(e));
    }
}

function IGS_deleteLayer() {
    if (!IGS_hasActiveDocument()) return IGS_error('No active document');
    try {
        app.activeDocument.activeLayer.remove();
        return IGS_success(true);
    } catch (e) {
        return IGS_error(String(e));
    }
}

function IGS_renameLayer(name) {
    if (!IGS_hasActiveDocument()) return IGS_error('No active document');
    try {
        app.activeDocument.activeLayer.name = name;
        return IGS_success(true);
    } catch (e) {
        return IGS_error(String(e));
    }
}

function IGS_setLayerVisibility(name, visible) {
    if (!IGS_hasActiveDocument()) return IGS_error('No active document');
    try {
        var doc = app.activeDocument;
        var layer = null;
        try { layer = doc.artLayers.getByName(name); } catch (e1) {}
        if (!layer) {
            try { layer = doc.layerSets.getByName(name); } catch (e2) {}
        }
        if (!layer) return IGS_error('Layer not found: ' + name);
        layer.visible = visible;
        return IGS_success(true);
    } catch (e) {
        return IGS_error('Layer not found: ' + name);
    }
}

function IGS_setLayerOpacity(opacity) {
    if (!IGS_hasActiveDocument()) return IGS_error('No active document');
    try {
        app.activeDocument.activeLayer.opacity = opacity;
        return IGS_success(true);
    } catch (e) {
        return IGS_error(String(e));
    }
}

// ============================================
// 3. Canvas Operations (畫布操作)
// ============================================

function IGS_getCanvasSize() {
    if (!IGS_hasActiveDocument()) return IGS_error('No active document');
    var doc = app.activeDocument;
    return IGS_success({
        width: doc.width.as('px'),
        height: doc.height.as('px'),
        resolution: doc.resolution
    });
}

function IGS_resizeCanvas(width, height) {
    if (!IGS_hasActiveDocument()) return IGS_error('No active document');
    try {
        app.activeDocument.resizeCanvas(UnitValue(width, 'px'), UnitValue(height, 'px'));
        return IGS_success(true);
    } catch (e) {
        return IGS_error(String(e));
    }
}

function IGS_resizeImage(width, height) {
    if (!IGS_hasActiveDocument()) return IGS_error('No active document');
    try {
        app.activeDocument.resizeImage(UnitValue(width, 'px'), UnitValue(height, 'px'));
        return IGS_success(true);
    } catch (e) {
        return IGS_error(String(e));
    }
}

function IGS_cropToSelection() {
    if (!IGS_hasActiveDocument()) return IGS_error('No active document');
    try {
        var bounds = app.activeDocument.selection.bounds;
        app.activeDocument.crop(bounds);
        return IGS_success(true);
    } catch (e) {
        return IGS_error(String(e));
    }
}

function IGS_rotateCanvas(angle) {
    if (!IGS_hasActiveDocument()) return IGS_error('No active document');
    try {
        app.activeDocument.rotateCanvas(angle);
        return IGS_success(true);
    } catch (e) {
        return IGS_error(String(e));
    }
}

// ============================================
// 5. Color Operations (色彩操作)
// ============================================

function IGS_getForegroundColor() {
    var c = app.foregroundColor.rgb;
    return IGS_success({
        r: Math.round(c.red),
        g: Math.round(c.green),
        b: Math.round(c.blue),
        hex: IGS_rgbToHex(c.red, c.green, c.blue)
    });
}

function IGS_setForegroundColor(r, g, b) {
    try {
        var color = new SolidColor();
        color.rgb.red = r;
        color.rgb.green = g;
        color.rgb.blue = b;
        app.foregroundColor = color;
        return IGS_success(true);
    } catch (e) {
        return IGS_error(String(e));
    }
}

function IGS_getBackgroundColor() {
    var c = app.backgroundColor.rgb;
    return IGS_success({
        r: Math.round(c.red),
        g: Math.round(c.green),
        b: Math.round(c.blue),
        hex: IGS_rgbToHex(c.red, c.green, c.blue)
    });
}

function IGS_setBackgroundColor(r, g, b) {
    try {
        var color = new SolidColor();
        color.rgb.red = r;
        color.rgb.green = g;
        color.rgb.blue = b;
        app.backgroundColor = color;
        return IGS_success(true);
    } catch (e) {
        return IGS_error(String(e));
    }
}

function IGS_swapColors() {
    try {
        var fg = app.foregroundColor;
        app.foregroundColor = app.backgroundColor;
        app.backgroundColor = fg;
        return IGS_success(true);
    } catch (e) {
        return IGS_error(String(e));
    }
}

function IGS_resetColors() {
    try {
        var black = new SolidColor();
        black.rgb.red = 0;
        black.rgb.green = 0;
        black.rgb.blue = 0;

        var white = new SolidColor();
        white.rgb.red = 255;
        white.rgb.green = 255;
        white.rgb.blue = 255;

        app.foregroundColor = black;
        app.backgroundColor = white;
        return IGS_success(true);
    } catch (e) {
        return IGS_error(String(e));
    }
}

function IGS_rgbToHex(r, g, b) {
    function toHex(val) {
        var hex = Math.round(val).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }
    return '#' + toHex(r) + toHex(g) + toHex(b);
}

// ============================================
// 5b. Selection Info - Detect multi-selected layers
//     回傳：選了幾個圖層、active 那個的資訊
// ============================================

function IGS_getSelectionInfo() {
    try {
        if (app.documents.length === 0) {
            return IGS_jsonStringify({error: 'NO_DOCUMENT'});
        }
        var doc = app.activeDocument;

        // 嘗試讀取 targetLayers (Action Manager)
        var selectedCount = 1;
        var selectedNames = [];
        try {
            var ref = new ActionReference();
            ref.putProperty(stringIDToTypeID('property'), stringIDToTypeID('targetLayers'));
            ref.putEnumerated(stringIDToTypeID('document'), stringIDToTypeID('ordinal'), stringIDToTypeID('targetEnum'));
            var desc = executeActionGet(ref);
            if (desc.hasKey(stringIDToTypeID('targetLayers'))) {
                var list = desc.getList(stringIDToTypeID('targetLayers'));
                selectedCount = list.count;
                // 取得每個被選圖層的名稱（透過 itemIndex）
                for (var i = 0; i < list.count; i++) {
                    try {
                        var idx = list.getReference(i).getIndex();
                        // PS 沒有背景時 index 從 0 算，有背景時從 1 算
                        // 直接抓名字
                        var nameRef = new ActionReference();
                        nameRef.putProperty(stringIDToTypeID('property'), stringIDToTypeID('name'));
                        // index 需要做修正（背景圖層）
                        var hasBg = false;
                        try { hasBg = doc.backgroundLayer ? true : false; } catch(e) {}
                        nameRef.putIndex(charIDToTypeID('Lyr '), idx + (hasBg ? 1 : 0));
                        var nameDesc = executeActionGet(nameRef);
                        var n = nameDesc.getString(stringIDToTypeID('name'));
                        selectedNames.push(n);
                    } catch(eName) {}
                }
            }
        } catch(eAm) {}

        // active layer 資訊
        var active = null;
        try {
            var al = doc.activeLayer;
            var isGroup = false;
            try { isGroup = (al.typename === 'LayerSet'); } catch(e) {}
            active = {
                name: al.name,
                isGroup: isGroup,
                isBackground: al.isBackgroundLayer || false
            };
        } catch(e) {
            active = null;
        }

        return IGS_jsonStringify({
            success: true,
            data: {
                selectedCount: selectedCount,
                selectedNames: selectedNames,
                active: active
            }
        });
    } catch(e) {
        return IGS_jsonStringify({error: String(e)});
    }
}

// ============================================
// 6. FX Remove BG - Export active layer as temp PNG
// ============================================

function IGS_exportActiveLayerAsPNG() {
    var newDoc = null;
    try {
        // Check: document open?
        if (app.documents.length === 0) {
            return IGS_jsonStringify({error: 'NO_DOCUMENT'});
        }

        var doc = app.activeDocument;
        var layer = doc.activeLayer;

        // Check: layer exists?
        if (!layer) {
            return IGS_jsonStringify({error: 'NO_LAYER'});
        }

        // Check: is it a layer group?
        var isGroup = false;
        try { isGroup = (layer.layers && layer.layers.length >= 0); } catch(e) {}

        if (isGroup) {
            // For groups: check if it has any child layers
            try {
                if (layer.layers.length === 0) {
                    return IGS_jsonStringify({error: 'EMPTY_GROUP'});
                }
            } catch(e) {
                return IGS_jsonStringify({error: 'EMPTY_GROUP'});
            }
        }

        // Check: layer bounds - is there any visible content?
        try {
            var bounds = layer.bounds;
            var w = bounds[2].as('px') - bounds[0].as('px');
            var h = bounds[3].as('px') - bounds[1].as('px');
            if (w <= 0 || h <= 0) {
                return IGS_jsonStringify({error: 'EMPTY_LAYER'});
            }
        } catch(e) {
            // bounds check failed, layer might still be usable
        }

        var layerName = layer.name;
        var tempFile = new File(Folder.temp + '/igs_fx_temp.png');

        // Duplicate layer to a new transparent document
        newDoc = app.documents.add(
            doc.width, doc.height, doc.resolution,
            'temp_export', NewDocumentMode.RGB, DocumentFill.TRANSPARENT
        );

        app.activeDocument = doc;
        layer.duplicate(newDoc, ElementPlacement.INSIDE);

        app.activeDocument = newDoc;

        // Merge visible layers (preserves transparency, unlike flatten)
        newDoc.mergeVisibleLayers();

        var pngOpts = new PNGSaveOptions();
        pngOpts.compression = 4;
        pngOpts.interlaced = false;
        newDoc.saveAs(tempFile, pngOpts, true, Extension.LOWERCASE);
        newDoc.close(SaveOptions.DONOTSAVECHANGES);
        newDoc = null;

        app.activeDocument = doc;

        return IGS_jsonStringify({
            success: true,
            filePath: tempFile.fsName.replace(/\\/g, '/'),
            layerName: layerName,
            width: doc.width.as('px'),
            height: doc.height.as('px')
        });
    } catch(e) {
        // Clean up temp document if it was created
        try {
            if (newDoc) {
                newDoc.close(SaveOptions.DONOTSAVECHANGES);
            }
        } catch(ignore) {}
        return IGS_jsonStringify({error: String(e)});
    }
}

// ============================================
// 7. FX Remove BG - Import temp PNG as new layer
// ============================================

function IGS_importPNGAsNewLayer(pngPath, newLayerName) {
    try {
        if (app.documents.length === 0) return IGS_jsonStringify({error: 'No document open'});

        var originalDoc = app.activeDocument;
        var tempFile = new File(pngPath);

        if (!tempFile.exists) return IGS_jsonStringify({error: 'Temp file not found'});

        var resultDoc = app.open(tempFile);
        resultDoc.selection.selectAll();
        resultDoc.selection.copy();
        resultDoc.close(SaveOptions.DONOTSAVECHANGES);

        app.activeDocument = originalDoc;
        originalDoc.paste();
        originalDoc.activeLayer.name = newLayerName;

        // Clean up temp file
        tempFile.remove();

        return IGS_jsonStringify({success: true, layerName: newLayerName});
    } catch(e) {
        return IGS_jsonStringify({error: String(e)});
    }
}

// ============================================
// 8. FX Remove BG - Replace original layer with PNG
// ============================================

function IGS_replaceLayerWithPNG(pngPath, layerName) {
    try {
        if (app.documents.length === 0) return IGS_jsonStringify({error: 'No document open'});

        var originalDoc = app.activeDocument;
        var targetLayer = originalDoc.activeLayer;

        if (!targetLayer) return IGS_jsonStringify({error: 'No active layer'});

        var tempFile = new File(pngPath);
        if (!tempFile.exists) return IGS_jsonStringify({error: 'Temp file not found'});

        // Remember position info
        var savedName = targetLayer.name;

        // Open result, copy, close
        var resultDoc = app.open(tempFile);
        resultDoc.selection.selectAll();
        resultDoc.selection.copy();
        resultDoc.close(SaveOptions.DONOTSAVECHANGES);

        // Paste as new layer above the target
        app.activeDocument = originalDoc;
        originalDoc.activeLayer = targetLayer;
        originalDoc.paste();

        var newLayer = originalDoc.activeLayer;
        newLayer.name = savedName;

        // Delete the original layer
        targetLayer.remove();

        // Clean up
        tempFile.remove();

        return IGS_jsonStringify({success: true, layerName: savedName});
    } catch(e) {
        return IGS_jsonStringify({error: String(e)});
    }
}

// ============================================
// 8b. SeedVR2 - Place upscaled PNG back into ORIGINAL document
//     - Opens result PNG, copies, closes
//     - Pastes into original doc as new layer above the target layer
//     - Scales the result down to match the target layer's bounds
//     - Positions to match target layer location
//     - Names with prefix
// ============================================

function IGS_placeUpscaledAsLayer(pngPath, targetLayerName, prefix) {
    try {
        if (app.documents.length === 0) return IGS_jsonStringify({error: 'No document open'});

        var originalDoc = app.activeDocument;

        // Find target layer by name (provided by caller, captured before upscale)
        var targetLayer = null;
        function findByName(layers, name) {
            for (var i = 0; i < layers.length; i++) {
                if (layers[i].name === name) return layers[i];
                try {
                    if (layers[i].layers) {
                        var sub = findByName(layers[i].layers, name);
                        if (sub) return sub;
                    }
                } catch(e) {}
            }
            return null;
        }
        if (targetLayerName) {
            targetLayer = findByName(originalDoc.layers, targetLayerName);
        }
        if (!targetLayer) targetLayer = originalDoc.activeLayer;
        if (!targetLayer) return IGS_jsonStringify({error: 'Target layer not found: ' + targetLayerName});

        // Capture original bounds (in pixels)
        var origBounds = targetLayer.bounds;
        var origLeft   = origBounds[0].as('px');
        var origTop    = origBounds[1].as('px');
        var origRight  = origBounds[2].as('px');
        var origBottom = origBounds[3].as('px');
        var origW = origRight - origLeft;
        var origH = origBottom - origTop;

        var tempFile = new File(pngPath);
        if (!tempFile.exists) return IGS_jsonStringify({error: 'Result file not found: ' + pngPath});

        // Open the upscaled result, copy, close
        var resultDoc = app.open(tempFile);
        resultDoc.selection.selectAll();
        resultDoc.selection.copy();
        resultDoc.close(SaveOptions.DONOTSAVECHANGES);

        // Back to original doc; set active layer = target so paste lands above it
        app.activeDocument = originalDoc;
        originalDoc.activeLayer = targetLayer;
        originalDoc.paste();

        var newLayer = originalDoc.activeLayer;

        // Name the new layer with prefix
        var pfx = prefix || '[SeedVR2_Fixed]_';
        newLayer.name = pfx + targetLayerName;

        // Scale new layer DOWN to match original layer bounds (keep visual footprint)
        var newBounds = newLayer.bounds;
        var newW = newBounds[2].as('px') - newBounds[0].as('px');
        var newH = newBounds[3].as('px') - newBounds[1].as('px');

        if (newW > 0 && newH > 0 && origW > 0 && origH > 0) {
            // Use horizontal scale ratio (assume aspect preserved)
            var scalePct = (origW / newW) * 100;
            newLayer.resize(scalePct, scalePct, AnchorPosition.MIDDLECENTER);

            // Reposition: align to original layer's top-left
            var resizedBounds = newLayer.bounds;
            var dx = origLeft - resizedBounds[0].as('px');
            var dy = origTop  - resizedBounds[1].as('px');
            if (dx !== 0 || dy !== 0) {
                newLayer.translate(UnitValue(dx, 'px'), UnitValue(dy, 'px'));
            }
        }

        // Clean up temp file
        try { tempFile.remove(); } catch(e) {}

        return IGS_jsonStringify({
            success: true,
            layerName: newLayer.name,
            origSize: { width: origW, height: origH },
            upscaledSize: { width: newW, height: newH }
        });
    } catch(e) {
        return IGS_jsonStringify({error: String(e)});
    }
}

// ============================================
// 9. FX Remove BG - Apply PNG as layer mask
// ============================================

function IGS_applyPNGAsLayerMask(pngPath, layerName) {
    try {
        if (app.documents.length === 0) return IGS_jsonStringify({error: 'No document open'});

        var originalDoc = app.activeDocument;
        var targetLayer = originalDoc.activeLayer;

        if (!targetLayer) return IGS_jsonStringify({error: 'No active layer'});

        var tempFile = new File(pngPath);
        if (!tempFile.exists) return IGS_jsonStringify({error: 'Mask file not found'});

        // Open mask image, select all, copy grayscale data
        var maskDoc = app.open(tempFile);
        maskDoc.selection.selectAll();
        maskDoc.selection.copy();
        maskDoc.close(SaveOptions.DONOTSAVECHANGES);

        // Back to original document
        app.activeDocument = originalDoc;
        originalDoc.activeLayer = targetLayer;

        // Add a layer mask (reveal all) using Action Manager
        var idMk = charIDToTypeID('Mk  ');
        var descMask = new ActionDescriptor();
        var idNw = charIDToTypeID('Nw  ');
        var idChnl = charIDToTypeID('Chnl');
        var idRvlA = charIDToTypeID('RvlA');
        descMask.putClass(idNw, idChnl);
        descMask.putEnumerated(charIDToTypeID('At  '), idChnl, idRvlA);
        executeAction(idMk, descMask, DialogModes.NO);

        // Now paste the mask data into the mask channel
        originalDoc.paste();

        // Apply the paste (it goes into the mask since mask is selected)
        // Deselect
        originalDoc.selection.deselect();

        // Switch back to RGB composite view
        originalDoc.activeChannels = [originalDoc.channels[0], originalDoc.channels[1], originalDoc.channels[2]];

        // Clean up temp file
        tempFile.remove();

        return IGS_jsonStringify({success: true, layerName: targetLayer.name});
    } catch(e) {
        return IGS_jsonStringify({error: String(e)});
    }
}

// ============================================
// 10. UI to Cocos - Get full layer tree with metadata
// ============================================

function IGS_getLayerTree() {
    try {
        if (!IGS_hasActiveDocument()) return IGS_error('No active document');

        var doc = app.activeDocument;
        var docW = doc.width.as('px');
        var docH = doc.height.as('px');

        var tree = [];

        function collectLayer(layer, depth, parentPath) {
            var info = {
                name: layer.name,
                depth: depth,
                path: parentPath ? (parentPath + '/' + layer.name) : layer.name,
                visible: layer.visible,
                opacity: layer.opacity
            };

            // Determine type
            var isGroup = false;
            try { isGroup = (layer.typename === 'LayerSet'); } catch(e) {}

            if (isGroup) {
                info.type = 'group';
                info.children = [];
                // Reverse order: PS layers[0] = top, Cocos children[0] = bottom
                for (var i = layer.layers.length - 1; i >= 0; i--) {
                    info.children.push(collectLayer(layer.layers[i], depth + 1, info.path));
                }
            } else {
                // Detect layer kind
                var layerKind = null;
                try { layerKind = layer.kind; } catch(e) {}

                // Skip adjustment layers (they have no pixel content and can't be exported)
                var isAdjustment = false;
                try {
                    isAdjustment = (
                        layerKind === LayerKind.BRIGHTNESSCONTRAST ||
                        layerKind === LayerKind.LEVELS ||
                        layerKind === LayerKind.CURVES ||
                        layerKind === LayerKind.EXPOSURE ||
                        layerKind === LayerKind.VIBRANCE ||
                        layerKind === LayerKind.HUESAT ||
                        layerKind === LayerKind.SELECTIVECOLOR ||
                        layerKind === LayerKind.CHANNELMIXER ||
                        layerKind === LayerKind.POSTERIZE ||
                        layerKind === LayerKind.THRESHOLD ||
                        layerKind === LayerKind.GRADIENTMAP ||
                        layerKind === LayerKind.COLORBALANCE ||
                        layerKind === LayerKind.INVERSION ||
                        layerKind === LayerKind.PHOTOFILTER
                    );
                } catch(e) {}

                if (isAdjustment) {
                    info.type = 'adjustment';
                    tree.push(info);
                    return info;
                }

                // Detect clipping mask (layer.grouped = clipped to layer below)
                try {
                    info.clipped = layer.grouped || false;
                } catch(e) {
                    info.clipped = false;
                }

                // Detect smart object
                try {
                    if (layerKind === LayerKind.SMARTOBJECT) {
                        info.smartObject = true;
                    }
                } catch(e) {}

                // Detect blend mode
                try {
                    info.blendMode = String(layer.blendMode).replace('BlendMode.', '');
                } catch(e) {}

                // --- Detect Layer Effects (FX) via Action Manager ---
                var hasLayerFX = false;
                var layerFXList = [];
                try {
                    app.activeDocument.activeLayer = layer;
                    var fxRef = new ActionReference();
                    fxRef.putEnumerated(charIDToTypeID('Lyr '), charIDToTypeID('Ordn'), charIDToTypeID('Trgt'));
                    var fxDesc = executeActionGet(fxRef);
                    if (fxDesc.hasKey(stringIDToTypeID('layerEffects'))) {
                        hasLayerFX = true;
                        var efx = fxDesc.getObjectValue(stringIDToTypeID('layerEffects'));
                        var fxNames = {
                            'dropShadow': '陰影', 'innerShadow': '內陰影',
                            'outerGlow': '外光暈', 'innerGlow': '內光暈',
                            'bevelEmboss': '斜角浮雕', 'chromeFX': '緞面',
                            'solidFill': '顏色覆蓋', 'gradientFill': '漸層覆蓋',
                            'patternFill': '圖案覆蓋', 'frameFX': '描邊'
                        };
                        for (var fxKey in fxNames) {
                            try {
                                if (efx.hasKey(stringIDToTypeID(fxKey))) {
                                    layerFXList.push(fxNames[fxKey]);
                                }
                            } catch(fe) {}
                        }
                    }
                } catch(e) {}

                if (hasLayerFX) {
                    info.hasLayerFX = true;
                    info.layerFXList = layerFXList;
                }

                var isText = false;
                try { isText = (layerKind === LayerKind.TEXT); } catch(e) {}

                if (isText) {
                    info.type = 'text';
                    var textContent = '';
                    var fontSize = 12;
                    var fontName = '';
                    var textColor = {r:255, g:255, b:255};
                    var justification = 'LEFT';
                    var isBold = false;
                    var isItalic = false;
                    var isUnderline = false;
                    var isStrikethrough = false;
                    var lineHeight = 0;
                    var letterSpacing = 0;
                    var domOK = false;
                    var docDPI = doc.resolution || 72;

                    // --- Try DOM API first ---
                    try {
                        var textItem = layer.textItem;
                        try { textContent = textItem.contents || ''; } catch(e) {}
                        try {
                            if (textItem.size) {
                                fontSize = textItem.size.as('pt');
                                domOK = true;
                            }
                        } catch(e) {}
                        try { fontName = textItem.font || ''; } catch(e) {}
                        try {
                            textColor = {
                                r: Math.round(textItem.color.rgb.red),
                                g: Math.round(textItem.color.rgb.green),
                                b: Math.round(textItem.color.rgb.blue)
                            };
                        } catch(e) {}
                        try { justification = String(textItem.justification || 'LEFT'); } catch(e) {}
                        try { isBold = textItem.fauxBold || false; } catch(e) {}
                        try { isItalic = textItem.fauxItalic || false; } catch(e) {}
                        try { isUnderline = (textItem.underline !== UnderlineType.UNDERLINEOFF); } catch(e) {}
                        try { isStrikethrough = (textItem.strikeThru !== StrikeThruType.STRIKEOFF); } catch(e) {}
                        try {
                            if (textItem.useAutoLeading) {
                                lineHeight = fontSize * 1.2;
                            } else {
                                lineHeight = textItem.leading ? textItem.leading.as('pt') : fontSize * 1.2;
                            }
                        } catch(e) {}
                        try {
                            if (textItem.tracking) {
                                letterSpacing = Math.round(textItem.tracking / 1000 * fontSize * 100) / 100;
                            }
                        } catch(e) {}
                    } catch(e) {}

                    // --- Always read Action Manager for transform + fallback ---
                    var textTransformScale = 1;
                    try {
                        // Use layer ID for precise targeting (activeLayer may fail for nested layers)
                        var amRef = new ActionReference();
                        amRef.putIdentifier(charIDToTypeID('Lyr '), layer.id);
                        var amDesc = executeActionGet(amRef);

                        if (amDesc.hasKey(stringIDToTypeID('textKey'))) {
                            var textDesc = amDesc.getObjectValue(stringIDToTypeID('textKey'));

                            // Read transform matrix (applied by Free Transform on text layers)
                            if (textDesc.hasKey(stringIDToTypeID('transform'))) {
                                var txDesc = textDesc.getObjectValue(stringIDToTypeID('transform'));
                                var tx_yy = 1;
                                try { tx_yy = txDesc.getDouble(stringIDToTypeID('yy')); } catch(e) {}
                                textTransformScale = tx_yy;
                            }

                            // Fallback: read text content from AM if DOM failed
                            if (!textContent && textDesc.hasKey(charIDToTypeID('Txt '))) {
                                textContent = textDesc.getString(charIDToTypeID('Txt ')) || '';
                            }

                            // Fallback: read font size from AM if DOM failed
                            if (!domOK && textDesc.hasKey(stringIDToTypeID('textStyleRange'))) {
                                var styleList = textDesc.getList(stringIDToTypeID('textStyleRange'));
                                if (styleList.count > 0) {
                                    var firstRun = styleList.getObjectValue(0);
                                    if (firstRun.hasKey(stringIDToTypeID('textStyle'))) {
                                        var style = firstRun.getObjectValue(stringIDToTypeID('textStyle'));

                                        if (style.hasKey(stringIDToTypeID('size'))) {
                                            fontSize = style.getDouble(stringIDToTypeID('size'));
                                        }
                                        if (!fontName && style.hasKey(stringIDToTypeID('fontPostScriptName'))) {
                                            fontName = style.getString(stringIDToTypeID('fontPostScriptName'));
                                        }
                                        if (textColor.r === 255 && textColor.g === 255 && textColor.b === 255) {
                                            if (style.hasKey(stringIDToTypeID('color'))) {
                                                var colorDesc = style.getObjectValue(stringIDToTypeID('color'));
                                                try {
                                                    textColor = {
                                                        r: Math.round(colorDesc.getDouble(charIDToTypeID('Rd  '))),
                                                        g: Math.round(colorDesc.getDouble(charIDToTypeID('Grn '))),
                                                        b: Math.round(colorDesc.getDouble(charIDToTypeID('Bl  ')))
                                                    };
                                                } catch(ec) {}
                                            }
                                        }
                                        if (style.hasKey(stringIDToTypeID('syntheticBold'))) {
                                            isBold = style.getBoolean(stringIDToTypeID('syntheticBold'));
                                        }
                                        if (style.hasKey(stringIDToTypeID('syntheticItalic'))) {
                                            isItalic = style.getBoolean(stringIDToTypeID('syntheticItalic'));
                                        }
                                    }
                                }
                            }

                            // Fallback: read paragraph alignment from AM
                            if (justification === 'LEFT' && textDesc.hasKey(stringIDToTypeID('paragraphStyleRange'))) {
                                var paraList = textDesc.getList(stringIDToTypeID('paragraphStyleRange'));
                                if (paraList.count > 0) {
                                    var firstPara = paraList.getObjectValue(0);
                                    if (firstPara.hasKey(stringIDToTypeID('paragraphStyle'))) {
                                        var paraStyle = firstPara.getObjectValue(stringIDToTypeID('paragraphStyle'));
                                        if (paraStyle.hasKey(stringIDToTypeID('align'))) {
                                            var alignStr = typeIDToStringID(paraStyle.getEnumerationValue(stringIDToTypeID('align')));
                                            if (alignStr === 'center') justification = 'Justification.CENTER';
                                            else if (alignStr === 'right') justification = 'Justification.RIGHT';
                                        }
                                    }
                                }
                            }
                        }
                    } catch(amErr) {}

                    // --- Apply transform scale to get VISUAL font size ---
                    // PS textItem.size returns base size before Free Transform.
                    // Character panel shows base × transform scale = visual size.
                    if (textTransformScale !== 1 && textTransformScale > 0) {
                        fontSize = fontSize * textTransformScale;
                        if (lineHeight > 0) {
                            lineHeight = lineHeight * textTransformScale;
                        }
                        // Recalculate letterSpacing with transformed fontSize
                        try {
                            if (layer.textItem && layer.textItem.tracking) {
                                letterSpacing = Math.round(layer.textItem.tracking / 1000 * fontSize * 100) / 100;
                            }
                        } catch(e) {}
                    }

                    // Round final values
                    fontSize = Math.round(fontSize);
                    if (!lineHeight) { lineHeight = Math.round(fontSize * 1.2); }
                    else { lineHeight = Math.round(lineHeight); }

                    if (!textContent) { textContent = layer.name || ''; }

                    info.text = {
                        content: textContent,
                        fontSize: fontSize,
                        fontName: fontName,
                        color: textColor,
                        justification: justification,
                        lineHeight: lineHeight,
                        letterSpacing: letterSpacing,
                        isBold: isBold,
                        isItalic: isItalic,
                        isUnderline: isUnderline,
                        isStrikethrough: isStrikethrough
                    };
                } else {
                    info.type = 'image';
                }

                // Get bounds for non-group layers
                try {
                    var bounds = layer.bounds;
                    info.bounds = {
                        left: bounds[0].as('px'),
                        top: bounds[1].as('px'),
                        right: bounds[2].as('px'),
                        bottom: bounds[3].as('px'),
                        width: bounds[2].as('px') - bounds[0].as('px'),
                        height: bounds[3].as('px') - bounds[1].as('px')
                    };
                } catch(e) {
                    info.bounds = { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
                }
            }

            tree.push(info);
            return info;
        }

        // Reverse order: PS layers[0] = top, Cocos children[0] = bottom
        for (var i = doc.layers.length - 1; i >= 0; i--) {
            collectLayer(doc.layers[i], 0, '');
        }

        return IGS_jsonStringify({
            success: true,
            document: { name: doc.name, width: docW, height: docH, resolution: doc.resolution, dpi: doc.resolution },
            layers: tree
        });
    } catch(e) {
        return IGS_error(String(e));
    }
}

// ============================================
// 11. UI to Cocos - Export a specific layer as PNG by path
// ============================================

function IGS_exportLayerByPath(layerPath, outputPath) {
    var newDoc = null;
    try {
        if (!IGS_hasActiveDocument()) return IGS_error('No active document');

        var doc = app.activeDocument;

        // Find layer by path (e.g. "GroupA/SubGroup/LayerName")
        var parts = layerPath.split('/');
        var target = null;

        function findLayer(layers, pathParts, idx) {
            for (var i = 0; i < layers.length; i++) {
                if (layers[i].name === pathParts[idx]) {
                    if (idx === pathParts.length - 1) {
                        return layers[i];
                    }
                    // Go deeper into group
                    try {
                        if (layers[i].layers) {
                            return findLayer(layers[i].layers, pathParts, idx + 1);
                        }
                    } catch(e) {}
                    return null;
                }
            }
            return null;
        }

        target = findLayer(doc.layers, parts, 0);

        // Fallback: if not found, check if it's the Background layer
        // PS Background layer name may vary by locale (背景, Background, Arrière-plan, etc.)
        if (!target && parts.length === 1) {
            try {
                // Try matching by iterating all top-level layers
                for (var fi = 0; fi < doc.layers.length; fi++) {
                    if (doc.layers[fi].name === parts[0]) {
                        target = doc.layers[fi];
                        break;
                    }
                }
                // Also check doc.backgroundLayer
                if (!target) {
                    try {
                        var bgLayer = doc.backgroundLayer;
                        if (bgLayer && bgLayer.name === parts[0]) {
                            target = bgLayer;
                        }
                    } catch(e) {}
                }
            } catch(e) {}
        }

        if (!target) return IGS_error('Layer not found: ' + layerPath);

        // Check bounds
        try {
            var bounds = target.bounds;
            var w = bounds[2].as('px') - bounds[0].as('px');
            var h = bounds[3].as('px') - bounds[1].as('px');
            if (w <= 0 || h <= 0) return IGS_error('Layer has no content: ' + layerPath);
        } catch(e) {}

        // Duplicate to new transparent doc (at layer bounds size for tighter export)
        var layerBounds = target.bounds;
        var lx = layerBounds[0].as('px');
        var ly = layerBounds[1].as('px');
        var lw = layerBounds[2].as('px') - lx;
        var lh = layerBounds[3].as('px') - ly;

        newDoc = app.documents.add(
            UnitValue(lw, 'px'), UnitValue(lh, 'px'),
            doc.resolution, 'temp_cocos_export',
            NewDocumentMode.RGB, DocumentFill.TRANSPARENT
        );

        app.activeDocument = doc;

        // If the target is a Background layer, duplicate within same doc first,
        // convert the copy, then move to new doc (avoids modifying original PSD)
        var dupLayer;
        try {
            if (target.isBackgroundLayer) {
                var tempCopy = target.duplicate();
                tempCopy.isBackgroundLayer = false;
                dupLayer = tempCopy.duplicate(newDoc, ElementPlacement.INSIDE);
                tempCopy.remove();
            } else {
                dupLayer = target.duplicate(newDoc, ElementPlacement.INSIDE);
            }
        } catch(e) {
            // Fallback: try direct duplicate
            dupLayer = target.duplicate(newDoc, ElementPlacement.INSIDE);
        }

        app.activeDocument = newDoc;

        // If the duplicated layer became a Background layer, convert it to normal
        // (Background layers don't support transparency)
        try {
            if (newDoc.activeLayer.isBackgroundLayer) {
                newDoc.activeLayer.isBackgroundLayer = false;
            }
        } catch(e) {}

        // Move the duplicated layer so its content aligns to top-left of the new doc
        try {
            var newBounds = newDoc.activeLayer.bounds;
            var dx = -newBounds[0].as('px');
            var dy = -newBounds[1].as('px');
            newDoc.activeLayer.translate(UnitValue(dx, 'px'), UnitValue(dy, 'px'));
        } catch(e) {}

        // Merge visible (preserves transparency, unlike flatten)
        newDoc.mergeVisibleLayers();

        // Use Save For Web for silent PNG export (no dialog)
        var outFile = new File(outputPath);
        var sfwOpts = new ExportOptionsSaveForWeb();
        sfwOpts.format = SaveDocumentType.PNG;
        sfwOpts.PNG8 = false; // PNG-24 with alpha
        sfwOpts.transparency = true;
        sfwOpts.interlaced = false;
        sfwOpts.quality = 100;
        newDoc.exportDocument(outFile, ExportType.SAVEFORWEB, sfwOpts);
        newDoc.close(SaveOptions.DONOTSAVECHANGES);
        newDoc = null;

        app.activeDocument = doc;

        return IGS_jsonStringify({
            success: true,
            path: outFile.fsName.replace(/\\/g, '/'),
            width: lw,
            height: lh
        });
    } catch(e) {
        try { if (newDoc) newDoc.close(SaveOptions.DONOTSAVECHANGES); } catch(ignore) {}
        return IGS_error(String(e));
    }
}

// ============================================
// Multilang PSD Export (Tool B)
//   - 掃描 PSD 第一層 group，比對語系關鍵字
//   - 輪流顯隱、匯出 PNG
//   - 輸出位置優先順序：
//       1. 呼叫端傳入的 manualPath（若有）
//       2. project_data.json 的 target_nas_path（若同目錄存在）
//       3. PSD 同層的 #出圖 資料夾（最終 fallback）
// ============================================

function _IGS_parseJSONC(text) {
    if (!text) return null;
    text = String(text).replace(/^﻿/, '');
    text = text.replace(/^\s*\/\/[^\n]*$/gm, '');
    text = text.replace(/([^:\\])\/\/[^\n]*$/gm, '$1');
    try { return eval('(' + text + ')'); } catch(e) { return null; }
}

// ExtendScript 沒有原生 JSON.parse，用 eval 包一層當代用
function _IGS_parseJSON(text) {
    if (!text) return null;
    try { return eval('(' + String(text) + ')'); } catch(e) { return null; }
}

function _IGS_readTextFile(file) {
    if (!file.exists) return null;
    file.encoding = 'UTF-8';
    if (!file.open('r')) return null;
    var t = file.read();
    file.close();
    return t;
}

/**
 * 檢查當前 PSD 的多語系出圖前置條件
 * 回傳：PSD 路徑、是否存檔、project_data.json 是否存在、target_nas_path、匹配到的群組數
 */
function IGS_checkMultilangPrereq(langsJson) {
    try {
        if (!app.documents.length) {
            return IGS_jsonStringify({ success: true, data: { hasDoc: false } });
        }
        var doc = app.activeDocument;
        var docName = doc.name;
        var docSaved = doc.saved;

        var psdDir = '';
        var psdPath = '';
        var hasFile = false;
        try {
            var f = doc.fullName;
            psdPath = f.fsName.replace(/\\/g, '/');
            psdDir = doc.path.fsName.replace(/\\/g, '/');
            hasFile = true;
        } catch(e) {
            hasFile = false;
        }

        // 檢查 project_data.json
        var pdExists = false;
        var pdNasPath = '';
        if (hasFile) {
            var pdFile = new File(psdDir + '/project_data.json');
            if (pdFile.exists) {
                pdExists = true;
                var pdText = _IGS_readTextFile(pdFile);
                var pd = _IGS_parseJSONC(pdText);
                if (pd && pd.target_nas_path) {
                    pdNasPath = String(pd.target_nas_path).replace(/\\/g, '/');
                }
            }
        }

        // 解析語系設定
        var langs = [];
        if (langsJson) {
            langs = _IGS_parseJSON(langsJson) || [];
        }
        if (!langs || langs.length === 0) {
            langs = [
                { suffix: 'CHT', keyword: '_CHT使用' },
                { suffix: 'EN',  keyword: '_EN使用'  }
            ];
        }

        // 掃描第一層 group，找匹配
        var matched = [];
        var allTopGroups = [];   // 所有第一層群組（debug 用）
        for (var i = 0; i < doc.layerSets.length; i++) {
            var ls = doc.layerSets[i];
            allTopGroups.push(ls.name);
            for (var j = 0; j < langs.length; j++) {
                if (ls.name.indexOf(langs[j].keyword) >= 0) {
                    matched.push({ name: ls.name, suffix: langs[j].suffix });
                    break;
                }
            }
        }
        // 第一層 art layers（不是群組的單獨圖層）
        var allTopArtLayers = [];
        for (var iA = 0; iA < doc.artLayers.length; iA++) {
            allTopArtLayers.push(doc.artLayers[iA].name);
        }

        return IGS_jsonStringify({
            success: true,
            data: {
                hasDoc: true,
                docName: docName,
                docSaved: docSaved,
                hasFile: hasFile,
                psdDir: psdDir,
                psdPath: psdPath,
                pdExists: pdExists,
                pdNasPath: pdNasPath,
                matchedGroups: matched,
                allTopGroups: allTopGroups,
                allTopArtLayers: allTopArtLayers
            }
        });
    } catch(e) {
        return IGS_error(String(e));
    }
}

/**
 * 執行多語系出圖
 * @param {string} langsJson - JSON 字串：[{ suffix, keyword }, ...]
 * @param {string} manualOutputPath - 使用者指定的輸出資料夾（優先級最高，若空字串則自動決定）
 */
function IGS_runMultilangExport(langsJson, manualOutputPath) {
    try {
        if (!app.documents.length) return IGS_error('NO_DOCUMENT');
        var doc = app.activeDocument;

        // 必須已存檔
        var psdDir;
        try { psdDir = doc.path; }
        catch(e) { return IGS_error('PSD_NOT_SAVED'); }
        if (!doc.saved) return IGS_error('PSD_HAS_UNSAVED_CHANGES');

        // 解析語系
        var langs = [];
        if (langsJson) {
            langs = _IGS_parseJSON(langsJson) || [];
        }
        if (!langs || langs.length === 0) {
            langs = [
                { suffix: 'CHT', keyword: '_CHT使用' },
                { suffix: 'EN',  keyword: '_EN使用'  }
            ];
        }

        // 決定輸出路徑：manual > project_data.json > #出圖 fallback
        var outFolder = null;
        var sourceUsed = '';
        var fallbackUsed = false;
        var fallbackReason = '';

        if (manualOutputPath && manualOutputPath !== '') {
            var manualF = new Folder(manualOutputPath);
            if (manualF.exists) {
                outFolder = manualF; sourceUsed = 'manual';
            } else {
                try {
                    if (manualF.create()) { outFolder = manualF; sourceUsed = 'manual'; }
                } catch(eMc) {}
                if (!outFolder) {
                    fallbackReason = '手動指定路徑無法存取或建立失敗：' + manualOutputPath;
                }
            }
        }

        if (!outFolder) {
            // 嘗試讀 project_data.json
            var pdFile = new File(psdDir + '/project_data.json');
            if (pdFile.exists) {
                var pd = _IGS_parseJSONC(_IGS_readTextFile(pdFile));
                var nas = pd && pd.target_nas_path ? String(pd.target_nas_path) : '';
                if (nas !== '') {
                    var nasF = new Folder(nas);
                    if (nasF.exists) { outFolder = nasF; sourceUsed = 'project_data'; }
                    else {
                        try { if (nasF.create()) { outFolder = nasF; sourceUsed = 'project_data'; } } catch(eN) {}
                        if (!outFolder) fallbackReason = 'NAS 路徑無法存取或建立失敗：' + nas;
                    }
                }
            }
        }

        if (!outFolder) {
            // 自動模式 fallback：直接用 PSD 同層資料夾
            outFolder = new Folder(psdDir);
            sourceUsed = 'psd_dir';
            fallbackUsed = true;
            if (!fallbackReason) fallbackReason = '未指定 NAS / 手動路徑，使用 PSD 同層';
        }

        // 掃描匹配
        var matched = [];
        for (var i = 0; i < doc.layerSets.length; i++) {
            var ls = doc.layerSets[i];
            for (var j = 0; j < langs.length; j++) {
                if (ls.name.indexOf(langs[j].keyword) >= 0) {
                    matched.push({ layer: ls, lang: langs[j], originalVisible: ls.visible });
                    break;
                }
            }
        }
        if (matched.length === 0) {
            return IGS_error('NO_MATCHED_GROUPS');
        }

        // 全部隱藏
        for (var k = 0; k < matched.length; k++) matched[k].layer.visible = false;

        // 設定 PNG 匯出選項
        var sfwOpts = new ExportOptionsSaveForWeb();
        sfwOpts.format = SaveDocumentType.PNG;
        sfwOpts.PNG8 = false;
        sfwOpts.transparency = true;
        sfwOpts.interlaced = false;

        var psdBase = doc.name.replace(/\.psd$/i, '');
        var exported = [];
        var failedItem = null;

        for (var n = 0; n < matched.length; n++) {
            for (var m = 0; m < matched.length; m++) matched[m].layer.visible = (m === n);
            var outName = psdBase + '_' + matched[n].lang.suffix + '.png';
            var outFile = new File(outFolder + '/' + outName);
            try {
                doc.exportDocument(outFile, ExportType.SAVEFORWEB, sfwOpts);
                exported.push(outName);
            } catch(eExp) {
                failedItem = { name: outName, err: String(eExp) };
                break;
            }
        }

        // 還原可見性
        for (var p = 0; p < matched.length; p++) matched[p].layer.visible = matched[p].originalVisible;

        if (failedItem) {
            return IGS_jsonStringify({
                error: 'EXPORT_FAILED',
                data: {
                    failed: failedItem,
                    exported: exported,
                    total: matched.length,
                    outputFolder: outFolder.fsName.replace(/\\/g, '/')
                }
            });
        }

        return IGS_jsonStringify({
            success: true,
            data: {
                exported: exported,
                outputFolder: outFolder.fsName.replace(/\\/g, '/'),
                sourceUsed: sourceUsed,
                fallbackUsed: fallbackUsed,
                fallbackReason: fallbackReason
            }
        });
    } catch(e) {
        return IGS_error(String(e));
    }
}

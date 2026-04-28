/**
 * IGS ACD Art Tools - Photoshop Bridge
 * 封裝常用的 Photoshop 操作，透過 CSInterface.evalScript() 呼叫 ExtendScript
 *
 * 初始 API 範圍：
 * 1. 文件操作 (Document)
 * 2. 圖層操作 (Layer)
 * 3. 畫布操作 (Canvas)
 * 5. 色彩操作 (Color)
 *
 * 預留（後續版本）：
 * 4. 選取範圍 (Selection)
 * 6. 批次處理 (Batch)
 */

(function () {
    'use strict';

    var csInterface = null;

    function getCSInterface() {
        if (!csInterface) {
            csInterface = new CSInterface();
        }
        return csInterface;
    }

    /**
     * Escape a string for safe embedding in ExtendScript string literals.
     * Prevents injection when layer names contain ", \, newlines, etc.
     */
    function escJSX(str) {
        return (str || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
    }

    /**
     * Execute ExtendScript and return result
     */
    function evalJSX(script, callback) {
        getCSInterface().evalScript(script, function (result) {
            if (result === 'EvalScript error.') {
                callback('ExtendScript error', null);
            } else {
                // Try to parse JSON results
                try {
                    var parsed = JSON.parse(result);
                    callback(null, parsed);
                } catch (e) {
                    callback(null, result);
                }
            }
        });
    }

    // ============================================
    // 1. Document Operations (文件操作)
    // ============================================

    var bridge = {

        /**
         * Get active document info
         */
        getActiveDocument: function (params, callback) {
            evalJSX('IGS_getActiveDocument()', callback);
        },

        /**
         * Open a file
         * @param {string} params.filePath - Full file path
         */
        openFile: function (params, callback) {
            var filePath = escJSX((params.filePath || '').replace(/\\/g, '/'));
            evalJSX('IGS_openFile("' + filePath + '")', callback);
        },

        /**
         * Save active document
         */
        saveDocument: function (params, callback) {
            evalJSX('IGS_saveDocument()', callback);
        },

        /**
         * Save as (PSD)
         * @param {string} params.filePath - Target file path
         */
        saveDocumentAs: function (params, callback) {
            var filePath = escJSX((params.filePath || '').replace(/\\/g, '/'));
            evalJSX('IGS_saveDocumentAs("' + filePath + '")', callback);
        },

        /**
         * Export as PNG
         * @param {string} params.filePath - Target file path
         * @param {number} params.quality - PNG quality (0-100)
         */
        exportPNG: function (params, callback) {
            var filePath = escJSX((params.filePath || '').replace(/\\/g, '/'));
            var quality = params.quality || 100;
            evalJSX('IGS_exportPNG("' + filePath + '", ' + quality + ')', callback);
        },

        /**
         * Export as JPG
         * @param {string} params.filePath - Target file path
         * @param {number} params.quality - JPG quality (0-12)
         */
        exportJPG: function (params, callback) {
            var filePath = escJSX((params.filePath || '').replace(/\\/g, '/'));
            var quality = params.quality || 10;
            evalJSX('IGS_exportJPG("' + filePath + '", ' + quality + ')', callback);
        },

        /**
         * Close active document
         * @param {boolean} params.save - Whether to save before closing
         */
        closeDocument: function (params, callback) {
            var save = params.save ? 'true' : 'false';
            evalJSX('IGS_closeDocument(' + save + ')', callback);
        },

        // ============================================
        // 2. Layer Operations (圖層操作)
        // ============================================

        /**
         * Get all layers info
         */
        getLayers: function (params, callback) {
            evalJSX('IGS_getLayers()', callback);
        },

        /**
         * Get active layer info
         */
        getActiveLayer: function (params, callback) {
            evalJSX('IGS_getActiveLayer()', callback);
        },

        /**
         * Select a layer by name
         * @param {string} params.name - Layer name
         */
        selectLayer: function (params, callback) {
            evalJSX('IGS_selectLayer("' + escJSX(params.name || '') + '")', callback);
        },

        /**
         * Create a new layer
         * @param {string} params.name - Layer name
         */
        createLayer: function (params, callback) {
            evalJSX('IGS_createLayer("' + escJSX(params.name || 'New Layer') + '")', callback);
        },

        /**
         * Delete active layer
         */
        deleteLayer: function (params, callback) {
            evalJSX('IGS_deleteLayer()', callback);
        },

        /**
         * Rename active layer
         * @param {string} params.name - New layer name
         */
        renameLayer: function (params, callback) {
            evalJSX('IGS_renameLayer("' + escJSX(params.name || '') + '")', callback);
        },

        /**
         * Set layer visibility
         * @param {string} params.name - Layer name
         * @param {boolean} params.visible - Visibility state
         */
        setLayerVisibility: function (params, callback) {
            var visible = params.visible ? 'true' : 'false';
            evalJSX('IGS_setLayerVisibility("' + escJSX(params.name || '') + '", ' + visible + ')', callback);
        },

        /**
         * Set layer opacity
         * @param {number} params.opacity - Opacity (0-100)
         */
        setLayerOpacity: function (params, callback) {
            var opacity = Math.max(0, Math.min(100, params.opacity || 100));
            evalJSX('IGS_setLayerOpacity(' + opacity + ')', callback);
        },

        // ============================================
        // 3. Canvas Operations (畫布操作)
        // ============================================

        /**
         * Get canvas size
         */
        getCanvasSize: function (params, callback) {
            evalJSX('IGS_getCanvasSize()', callback);
        },

        /**
         * Resize canvas
         * @param {number} params.width - New width in pixels
         * @param {number} params.height - New height in pixels
         */
        resizeCanvas: function (params, callback) {
            evalJSX('IGS_resizeCanvas(' + (params.width || 0) + ', ' + (params.height || 0) + ')', callback);
        },

        /**
         * Resize image
         * @param {number} params.width - New width in pixels
         * @param {number} params.height - New height in pixels
         */
        resizeImage: function (params, callback) {
            evalJSX('IGS_resizeImage(' + (params.width || 0) + ', ' + (params.height || 0) + ')', callback);
        },

        /**
         * Crop to selection
         */
        cropToSelection: function (params, callback) {
            evalJSX('IGS_cropToSelection()', callback);
        },

        /**
         * Rotate canvas
         * @param {number} params.angle - Rotation angle in degrees
         */
        rotateCanvas: function (params, callback) {
            evalJSX('IGS_rotateCanvas(' + (params.angle || 0) + ')', callback);
        },

        // ============================================
        // 5. Color Operations (色彩操作)
        // ============================================

        /**
         * Get foreground color
         */
        getForegroundColor: function (params, callback) {
            evalJSX('IGS_getForegroundColor()', callback);
        },

        /**
         * Set foreground color
         * @param {number} params.r - Red (0-255)
         * @param {number} params.g - Green (0-255)
         * @param {number} params.b - Blue (0-255)
         */
        setForegroundColor: function (params, callback) {
            evalJSX('IGS_setForegroundColor(' + (params.r || 0) + ',' + (params.g || 0) + ',' + (params.b || 0) + ')', callback);
        },

        /**
         * Get background color
         */
        getBackgroundColor: function (params, callback) {
            evalJSX('IGS_getBackgroundColor()', callback);
        },

        /**
         * Set background color
         * @param {number} params.r - Red (0-255)
         * @param {number} params.g - Green (0-255)
         * @param {number} params.b - Blue (0-255)
         */
        setBackgroundColor: function (params, callback) {
            evalJSX('IGS_setBackgroundColor(' + (params.r || 0) + ',' + (params.g || 0) + ',' + (params.b || 0) + ')', callback);
        },

        /**
         * Swap foreground and background colors
         */
        swapColors: function (params, callback) {
            evalJSX('IGS_swapColors()', callback);
        },

        /**
         * Reset colors to default (black/white)
         */
        resetColors: function (params, callback) {
            evalJSX('IGS_resetColors()', callback);
        },

        // ============================================
        // 6. FX Remove BG Operations
        // ============================================

        /**
         * Get selection info (selected layer count, active layer details)
         */
        getSelectionInfo: function (params, callback) {
            evalJSX('IGS_getSelectionInfo()', callback);
        },

        /**
         * Export active layer as temp PNG for processing
         */
        exportActiveLayerAsPNG: function (params, callback) {
            evalJSX('IGS_exportActiveLayerAsPNG()', callback);
        },

        /**
         * Import a processed PNG as a new layer
         * @param {string} params.pngPath - Path to the PNG file
         * @param {string} params.layerName - Name for the new layer
         */
        importPNGAsNewLayer: function (params, callback) {
            var pngPath = escJSX((params.pngPath || '').replace(/\\/g, '/'));
            var layerName = escJSX(params.layerName || 'processed');
            evalJSX('IGS_importPNGAsNewLayer("' + pngPath + '", "' + layerName + '")', callback);
        },

        /**
         * Replace original layer with processed PNG
         * @param {string} params.pngPath - Path to the PNG file
         * @param {string} params.layerName - Original layer name
         */
        replaceLayerWithPNG: function (params, callback) {
            var pngPath = escJSX((params.pngPath || '').replace(/\\/g, '/'));
            var layerName = escJSX(params.layerName || '');
            evalJSX('IGS_replaceLayerWithPNG("' + pngPath + '", "' + layerName + '")', callback);
        },

        /**
         * Place an upscaled PNG back into the ORIGINAL document as a new layer
         * scaled down to match the target layer's bounds.
         * @param {string} params.pngPath - Path to the upscaled result PNG
         * @param {string} params.targetLayerName - Original layer name to match
         * @param {string} [params.prefix] - Layer name prefix (default "[SeedVR2_Fixed]_")
         */
        placeUpscaledAsLayer: function (params, callback) {
            var pngPath = escJSX((params.pngPath || '').replace(/\\/g, '/'));
            var targetLayerName = escJSX(params.targetLayerName || '');
            var prefix = escJSX(params.prefix || '[SeedVR2_Fixed]_');
            evalJSX('IGS_placeUpscaledAsLayer("' + pngPath + '", "' + targetLayerName + '", "' + prefix + '")', callback);
        },

        /**
         * Apply PNG as layer mask to active layer
         * @param {string} params.pngPath - Path to the mask PNG (grayscale)
         * @param {string} params.layerName - Target layer name
         */
        applyPNGAsLayerMask: function (params, callback) {
            var pngPath = escJSX((params.pngPath || '').replace(/\\/g, '/'));
            var layerName = escJSX(params.layerName || '');
            evalJSX('IGS_applyPNGAsLayerMask("' + pngPath + '", "' + layerName + '")', callback);
        },

        // ============================================
        // 7. UI to Cocos Operations
        // ============================================

        /**
         * Get full layer tree with metadata (type, bounds, text info)
         */
        getLayerTree: function (params, callback) {
            evalJSX('IGS_getLayerTree()', callback);
        },

        /**
         * Export a specific layer as PNG by its path
         * @param {string} params.layerPath - Layer path (e.g. "Group/SubGroup/Layer")
         * @param {string} params.outputPath - Output file path
         */
        exportLayerByPath: function (params, callback) {
            var layerPath = escJSX(params.layerPath || '');
            var outputPath = escJSX((params.outputPath || '').replace(/\\/g, '/'));
            evalJSX('IGS_exportLayerByPath("' + layerPath + '", "' + outputPath + '")', callback);
        }
    };

    // Register bridge to App
    window.addEventListener('DOMContentLoaded', function () {
        if (window.App) {
            window.App.psBridge = bridge;
        }
    });

})();

'use strict';

/**
 * IGS UI Importer - Scene Script (Cocos Creator 3.8.x)
 *
 * Runs inside the scene rendering process with access to cc.* API.
 * Editor.Message is NOT available here — all asset lookups must
 * happen in main.js and be passed in via arguments.
 */

module.exports = {

    /**
     * Build node tree from layout.json
     * @param {Object} layout - parsed layout.json
     * @param {Object} imageUuidMap - { "filename.png": "uuid-string" }
     * @returns {Object} result stats
     */
    buildNodeTree(layout, imageUuidMap) {
        // Wrap everything in try-catch so errors always get returned
        try {
            return this._doBuild(layout, imageUuidMap || {});
        } catch (e) {
            console.error('[IGS UI Importer] Scene script error:', e);
            return { error: String(e.message || e), success: false };
        }
    },

    _doBuild(layout, imageUuidMap) {
        const { Node, UITransform, Sprite, Label, Color, Vec3, Size, Canvas, Camera, Widget } = cc;

        const scene = cc.director.getScene();
        if (!scene) {
            return { error: '沒有開啟的場景', success: false };
        }

        console.log('[IGS UI Importer] Scene:', scene.name, 'children:', scene.children.length);

        // ---- Find or create Canvas ----
        let canvasNode = null;
        let canvasComp = scene.getComponentInChildren(cc.Canvas);

        if (canvasComp) {
            canvasNode = canvasComp.node;
            console.log('[IGS UI Importer] Found existing Canvas:', canvasNode.name);
        } else {
            console.log('[IGS UI Importer] No Canvas found, creating one...');

            // Create Canvas node
            canvasNode = new Node('Canvas');
            canvasNode.parent = scene;

            // Add Canvas component
            canvasComp = canvasNode.addComponent(cc.Canvas);

            // Add UITransform
            const canvasTransform = canvasNode.addComponent(UITransform);
            canvasTransform.setContentSize(new Size(
                layout.document.width || 1920,
                layout.document.height || 1080
            ));

            // Add Widget to make Canvas fill screen
            try {
                const widget = canvasNode.addComponent(cc.Widget);
                widget.isAlignTop = true;
                widget.isAlignBottom = true;
                widget.isAlignLeft = true;
                widget.isAlignRight = true;
                widget.top = 0;
                widget.bottom = 0;
                widget.left = 0;
                widget.right = 0;
            } catch (e) {
                console.warn('[IGS UI Importer] Widget setup warning:', e);
            }

            // Create a Camera for 2D rendering
            try {
                const camNode = new Node('UICamera');
                camNode.parent = canvasNode;
                const cam = camNode.addComponent(cc.Camera);
                cam.projection = cc.Camera.ProjectionType.ORTHO;
                cam.near = 0;
                cam.far = 1000;
                camNode.setPosition(new Vec3(0, 0, 1000));
            } catch (e) {
                console.warn('[IGS UI Importer] Camera setup warning:', e);
            }

            console.log('[IGS UI Importer] Canvas created successfully');
        }

        // ---- Create root node ----
        const docName = (layout.document.name || 'import').replace(/\.[^.]+$/, '');
        const rootNode = new Node('PSD_' + docName);
        rootNode.parent = canvasNode;
        // Set layer to UI_2D (layer 25 in Cocos 3.x)
        try { rootNode.layer = 1 << 25; } catch(e) {}

        const rootTransform = rootNode.addComponent(UITransform);
        rootTransform.setContentSize(new Size(layout.document.width, layout.document.height));

        console.log('[IGS UI Importer] Root node created:', rootNode.name,
            layout.document.width + 'x' + layout.document.height);

        // ---- Build hierarchy in layout.json order ----
        // Process ALL nodes in order (groups + leaves interleaved)
        // to preserve exact PSD sibling order → correct Cocos z-order.
        const nodeMap = { '': rootNode };

        let groupCount = 0;
        let spriteCount = 0;
        let labelCount = 0;
        const failedSprites = [];

        for (const nodeInfo of layout.nodes) {
            const parentNode = nodeMap[nodeInfo.parent || ''] || rootNode;

            if (nodeInfo.type === 'group') {
                const groupNode = new Node(nodeInfo.name);
                groupNode.parent = parentNode;
                try { groupNode.layer = 1 << 25; } catch(e) {}
                groupNode.addComponent(UITransform);
                nodeMap[nodeInfo.path] = groupNode;
                groupCount++;
                continue;
            }

            // Leaf node
            const node = new Node(nodeInfo.name);
            node.parent = parentNode;
            try { node.layer = 1 << 25; } catch(e) {}

            if (nodeInfo.position) {
                node.setPosition(new Vec3(nodeInfo.position.x, nodeInfo.position.y, 0));
            }

            if (nodeInfo.opacity !== undefined && nodeInfo.opacity < 1) {
                try {
                    let opComp = node.getComponent(cc.UIOpacity) || node.addComponent(cc.UIOpacity);
                    opComp.opacity = Math.round(nodeInfo.opacity * 255);
                } catch (e) {}
            }

            const transform = node.addComponent(UITransform);

            if (nodeInfo.type === 'image' && nodeInfo.image) {
                if (nodeInfo.size) {
                    transform.setContentSize(new Size(nodeInfo.size.width, nodeInfo.size.height));
                }

                const uuid = imageUuidMap[nodeInfo.image];
                if (uuid) {
                    try {
                        const asset = cc.assetManager.getAssetByUuid(uuid);
                        if (asset) {
                            const sprite = node.addComponent(Sprite);
                            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
                            sprite.spriteFrame = asset;
                            spriteCount++;
                        } else {
                            failedSprites.push(nodeInfo.name);
                        }
                    } catch (e) {
                        failedSprites.push(nodeInfo.name);
                    }
                } else {
                    failedSprites.push(nodeInfo.name);
                }

            } else if (nodeInfo.type === 'text' && nodeInfo.label) {
                if (nodeInfo.size) {
                    transform.setContentSize(new Size(nodeInfo.size.width, nodeInfo.size.height));
                }

                const label = node.addComponent(Label);
                label.string = nodeInfo.label.text || '';
                label.fontSize = nodeInfo.label.fontSize || 24;
                label.lineHeight = nodeInfo.label.lineHeight || Math.round((nodeInfo.label.fontSize || 24) * 1.2);

                if (nodeInfo.label.color) {
                    const c = nodeInfo.label.color;
                    try {
                        label.color = new Color(c.r || 0, c.g || 0, c.b || 0, 255);
                    } catch (e) {
                        try { node.color = new Color(c.r || 0, c.g || 0, c.b || 0, 255); } catch(e2) {}
                    }
                }

                switch (nodeInfo.label.horizontalAlign) {
                    case 'CENTER': label.horizontalAlign = Label.HorizontalAlign.CENTER; break;
                    case 'RIGHT': label.horizontalAlign = Label.HorizontalAlign.RIGHT; break;
                    default: label.horizontalAlign = Label.HorizontalAlign.LEFT;
                }

                if (nodeInfo.label.letterSpacing) {
                    label.spacingX = nodeInfo.label.letterSpacing;
                }
                if (nodeInfo.label.isBold) { label.isBold = true; }
                if (nodeInfo.label.isItalic) { label.isItalic = true; }
                if (nodeInfo.label.isUnderline) { label.isUnderline = true; }

                label.overflow = Label.Overflow.NONE;
                label.useSystemFont = true;
                if (nodeInfo.label.fontFamily) {
                    label.fontFamily = nodeInfo.label.fontFamily;
                }

                labelCount++;
            }
        }

        console.log('[IGS UI Importer] Done! Groups:', groupCount,
            'Sprites:', spriteCount, 'Labels:', labelCount,
            'Failed:', failedSprites.length);

        return {
            success: true,
            rootName: rootNode.name,
            groups: groupCount,
            sprites: spriteCount,
            labels: labelCount,
            failedSprites: failedSprites
        };
    }
};

/**
 * Module 1: Template-Based Promo Generator
 * Create promos from predefined templates inside Premiere Pro.
 */

var TemplateGenerator = (function () {

    // Default promo templates
    var TEMPLATES = {
        'social-square': {
            id: 'social-square',
            name: 'Social Media Square',
            width: 1080,
            height: 1080,
            fps: 30,
            duration: 15,
            description: 'Instagram/Facebook square post (15 sec)',
            layers: ['Background', 'Product', 'Text Overlay', 'Logo', 'CTA']
        },
        'social-story': {
            id: 'social-story',
            name: 'Social Story / Reel',
            width: 1080,
            height: 1920,
            fps: 30,
            duration: 15,
            description: 'Instagram Story/Reel, YouTube Shorts (15 sec)',
            layers: ['Background', 'Product', 'Text Overlay', 'Logo', 'CTA']
        },
        'youtube-ad': {
            id: 'youtube-ad',
            name: 'YouTube Ad',
            width: 1920,
            height: 1080,
            fps: 30,
            duration: 30,
            description: 'YouTube pre-roll / mid-roll ad (30 sec)',
            layers: ['Background', 'Product', 'Text', 'Logo', 'End Card']
        },
        'banner-landscape': {
            id: 'banner-landscape',
            name: 'Landscape Banner',
            width: 1920,
            height: 1080,
            fps: 30,
            duration: 10,
            description: 'Wide banner / display ad (10 sec)',
            layers: ['Background', 'Product', 'Headline', 'Logo']
        },
        'bumper-6s': {
            id: 'bumper-6s',
            name: '6s Bumper Ad',
            width: 1920,
            height: 1080,
            fps: 30,
            duration: 6,
            description: 'YouTube bumper ad (6 sec)',
            layers: ['Background', 'Product', 'Logo']
        },
        'whatsapp-status': {
            id: 'whatsapp-status',
            name: 'WhatsApp Status',
            width: 1080,
            height: 1920,
            fps: 30,
            duration: 30,
            description: 'WhatsApp status video (30 sec)',
            layers: ['Background', 'Content', 'Text', 'Logo']
        }
    };

    /**
     * Get all available templates
     */
    function getTemplates() {
        // Merge built-in with user-saved custom templates
        var custom = Storage.get('customTemplates', {});
        var all = {};
        for (var k in TEMPLATES) all[k] = TEMPLATES[k];
        for (var c in custom) all[c] = custom[c];
        return all;
    }

    /**
     * Save a custom template
     */
    function saveCustomTemplate(template) {
        var custom = Storage.get('customTemplates', {});
        custom[template.id] = template;
        Storage.set('customTemplates', custom);
    }

    /**
     * Delete a custom template
     */
    function deleteCustomTemplate(templateId) {
        var custom = Storage.get('customTemplates', {});
        delete custom[templateId];
        Storage.set('customTemplates', custom);
    }

    /**
     * Create a new promo sequence from a template
     */
    function createFromTemplate(templateId, options) {
        var tpl = getTemplates()[templateId];
        if (!tpl) {
            return Promise.reject('Template not found: ' + templateId);
        }

        var config = {
            name: (options && options.name) || tpl.name + '_' + Date.now(),
            width: tpl.width,
            height: tpl.height,
            fps: tpl.fps,
            duration: tpl.duration,
            layers: tpl.layers
        };

        return PPro.callAsync('createPromoFromTemplate', config);
    }

    /**
     * Import media and add to template tracks
     */
    function populateTemplate(mediaFiles) {
        if (!mediaFiles || mediaFiles.length === 0) {
            return Promise.reject('No media files provided');
        }

        return PPro.callAsync('importMediaFiles', mediaFiles)
            .then(function () {
                // Add first media to first video track
                return PPro.callMultiAsync('addClipToTimeline', [0, 0, 0]);
            });
    }

    /**
     * Apply a MOGRT (Motion Graphics Template) to the sequence
     */
    function applyGraphicsTemplate(mogrtPath, trackIndex, startTime) {
        return PPro.callMultiAsync('applyMOGRT', [mogrtPath, trackIndex || 1, startTime || 0, 5]);
    }

    /**
     * Update text fields in a MOGRT clip
     */
    function updateText(clipIndex, trackIndex, fieldName, newText) {
        return PPro.callMultiAsync('updateMOGRTText', [clipIndex, trackIndex, fieldName, newText]);
    }

    /**
     * Replace media in a clip
     */
    function replaceMedia(clipIndex, trackIndex, newFilePath) {
        return PPro.callMultiAsync('replaceClipMedia', [clipIndex, trackIndex, newFilePath]);
    }

    /**
     * Render the template creation UI
     */
    function renderUI(container) {
        var templates = getTemplates();
        var html = '<div class="module-section">';
        html += '<h3>Promo Templates</h3>';
        html += '<div class="template-grid">';

        for (var id in templates) {
            var tpl = templates[id];
            html += '<div class="template-card" data-id="' + id + '">';
            html += '<div class="template-preview">';
            html += '<div class="template-size">' + tpl.width + 'x' + tpl.height + '</div>';
            html += '</div>';
            html += '<div class="template-info">';
            html += '<h4>' + tpl.name + '</h4>';
            html += '<p>' + tpl.description + '</p>';
            html += '<span class="template-duration">' + tpl.duration + 's | ' + tpl.fps + 'fps</span>';
            html += '</div>';
            html += '<button class="btn btn-primary btn-create-template" data-template="' + id + '">Create</button>';
            html += '</div>';
        }

        html += '</div>';

        // Custom template form
        html += '<div class="custom-template-section">';
        html += '<h4>Custom Template</h4>';
        html += '<div class="form-row"><label>Name</label><input type="text" id="tpl-name" placeholder="My Template"></div>';
        html += '<div class="form-row"><label>Width</label><input type="number" id="tpl-width" value="1920"></div>';
        html += '<div class="form-row"><label>Height</label><input type="number" id="tpl-height" value="1080"></div>';
        html += '<div class="form-row"><label>FPS</label><input type="number" id="tpl-fps" value="30"></div>';
        html += '<div class="form-row"><label>Duration (s)</label><input type="number" id="tpl-duration" value="15"></div>';
        html += '<button class="btn btn-secondary" id="btn-save-custom-tpl">Save Custom Template</button>';
        html += '</div>';

        // Media import
        html += '<div class="media-import-section">';
        html += '<h4>Add Media to Timeline</h4>';
        html += '<div class="form-row"><label>MOGRT Path</label><input type="text" id="mogrt-path" placeholder="C:\\path\\to\\template.mogrt"></div>';
        html += '<button class="btn btn-secondary" id="btn-apply-mogrt">Apply MOGRT</button>';
        html += '</div>';

        html += '</div>';
        container.innerHTML = html;

        // Bind events
        bindTemplateEvents(container);
    }

    function bindTemplateEvents(container) {
        // Create from template buttons
        var createBtns = container.querySelectorAll('.btn-create-template');
        for (var i = 0; i < createBtns.length; i++) {
            createBtns[i].addEventListener('click', function () {
                var tplId = this.getAttribute('data-template');
                var nameInput = prompt('Promo name:', tplId + '_promo');
                if (nameInput) {
                    createFromTemplate(tplId, { name: nameInput })
                        .then(function (result) {
                            showNotification('Sequence created: ' + result.sequenceName, 'success');
                        })
                        .catch(function (err) {
                            showNotification('Error: ' + err, 'error');
                        });
                }
            });
        }

        // Save custom template
        var saveBtn = container.querySelector('#btn-save-custom-tpl');
        if (saveBtn) {
            saveBtn.addEventListener('click', function () {
                var name = container.querySelector('#tpl-name').value;
                if (!name) { showNotification('Template name required', 'error'); return; }

                saveCustomTemplate({
                    id: 'custom-' + Date.now(),
                    name: name,
                    width: parseInt(container.querySelector('#tpl-width').value) || 1920,
                    height: parseInt(container.querySelector('#tpl-height').value) || 1080,
                    fps: parseInt(container.querySelector('#tpl-fps').value) || 30,
                    duration: parseInt(container.querySelector('#tpl-duration').value) || 15,
                    description: 'Custom template',
                    layers: ['Background', 'Content', 'Text', 'Logo']
                });
                showNotification('Custom template saved!', 'success');
                renderUI(container); // Refresh
            });
        }

        // Apply MOGRT
        var mogrtBtn = container.querySelector('#btn-apply-mogrt');
        if (mogrtBtn) {
            mogrtBtn.addEventListener('click', function () {
                var path = container.querySelector('#mogrt-path').value;
                if (!path) { showNotification('MOGRT path required', 'error'); return; }
                applyGraphicsTemplate(path, 1, 0)
                    .then(function () { showNotification('MOGRT applied!', 'success'); })
                    .catch(function (err) { showNotification('Error: ' + err, 'error'); });
            });
        }
    }

    return {
        getTemplates: getTemplates,
        createFromTemplate: createFromTemplate,
        populateTemplate: populateTemplate,
        applyGraphicsTemplate: applyGraphicsTemplate,
        updateText: updateText,
        replaceMedia: replaceMedia,
        saveCustomTemplate: saveCustomTemplate,
        deleteCustomTemplate: deleteCustomTemplate,
        renderUI: renderUI
    };

})();

/**
 * Module 2: Multi-Platform Auto-Export
 * Export promos for multiple platforms with correct dimensions & presets.
 */

var MultiExport = (function () {

    // Platform export configurations
    var PLATFORMS = {
        'instagram-post': {
            id: 'instagram-post',
            name: 'Instagram Post',
            width: 1080,
            height: 1080,
            format: 'H.264',
            maxDuration: 60,
            maxFileSize: '250MB',
            icon: 'ig'
        },
        'instagram-story': {
            id: 'instagram-story',
            name: 'Instagram Story/Reel',
            width: 1080,
            height: 1920,
            format: 'H.264',
            maxDuration: 90,
            maxFileSize: '250MB',
            icon: 'ig'
        },
        'facebook-feed': {
            id: 'facebook-feed',
            name: 'Facebook Feed',
            width: 1200,
            height: 630,
            format: 'H.264',
            maxDuration: 240,
            maxFileSize: '4GB',
            icon: 'fb'
        },
        'facebook-story': {
            id: 'facebook-story',
            name: 'Facebook Story',
            width: 1080,
            height: 1920,
            format: 'H.264',
            maxDuration: 20,
            maxFileSize: '4GB',
            icon: 'fb'
        },
        'youtube-standard': {
            id: 'youtube-standard',
            name: 'YouTube (1080p)',
            width: 1920,
            height: 1080,
            format: 'H.264',
            maxDuration: null,
            maxFileSize: '128GB',
            icon: 'yt'
        },
        'youtube-shorts': {
            id: 'youtube-shorts',
            name: 'YouTube Shorts',
            width: 1080,
            height: 1920,
            format: 'H.264',
            maxDuration: 60,
            maxFileSize: '128GB',
            icon: 'yt'
        },
        'twitter-video': {
            id: 'twitter-video',
            name: 'Twitter/X Video',
            width: 1920,
            height: 1080,
            format: 'H.264',
            maxDuration: 140,
            maxFileSize: '512MB',
            icon: 'tw'
        },
        'linkedin-video': {
            id: 'linkedin-video',
            name: 'LinkedIn Video',
            width: 1920,
            height: 1080,
            format: 'H.264',
            maxDuration: 600,
            maxFileSize: '5GB',
            icon: 'li'
        },
        'whatsapp-status': {
            id: 'whatsapp-status',
            name: 'WhatsApp Status',
            width: 1080,
            height: 1920,
            format: 'H.264',
            maxDuration: 30,
            maxFileSize: '16MB',
            icon: 'wa'
        },
        'tiktok': {
            id: 'tiktok',
            name: 'TikTok',
            width: 1080,
            height: 1920,
            format: 'H.264',
            maxDuration: 180,
            maxFileSize: '287MB',
            icon: 'tt'
        }
    };

    function getPlatforms() {
        return PLATFORMS;
    }

    /**
     * Export current sequence for a single platform
     */
    function exportForPlatform(platformId, outputDir, presetPath) {
        var platform = PLATFORMS[platformId];
        if (!platform) return Promise.reject('Unknown platform: ' + platformId);

        var fileName = platform.id + '_' + Date.now() + '.mp4';
        var outputPath = outputDir.replace(/[\/\\]$/, '') + '/' + fileName;

        return PPro.callMultiAsync('exportWithPreset', [outputPath, presetPath || '', true]);
    }

    /**
     * Batch export for multiple platforms at once
     */
    function batchExport(platformIds, outputDir, presetBasePath) {
        var exports = [];
        for (var i = 0; i < platformIds.length; i++) {
            var platform = PLATFORMS[platformIds[i]];
            if (!platform) continue;

            var fileName = platform.id + '_' + Date.now() + '.mp4';
            exports.push({
                label: platform.name,
                outputPath: outputDir.replace(/[\/\\]$/, '') + '/' + fileName,
                presetPath: presetBasePath ? (presetBasePath + '/' + platform.id + '.epr') : '',
                platform: platform
            });
        }

        if (exports.length === 0) return Promise.reject('No valid platforms selected');

        return PPro.callAsync('batchExportMultiPlatform', exports);
    }

    /**
     * Create sequence copies for each platform (different dimensions)
     */
    function createPlatformVariants(platformIds) {
        var results = [];

        function createNext(index) {
            if (index >= platformIds.length) {
                return Promise.resolve(results);
            }
            var p = PLATFORMS[platformIds[index]];
            if (!p) return createNext(index + 1);

            return PPro.callMultiAsync('createSequenceCopy', [p.name + '_variant', p.width, p.height])
                .then(function (res) {
                    results.push(res);
                    return createNext(index + 1);
                });
        }

        return createNext(0);
    }

    /**
     * Get user's saved export presets
     */
    function getSavedPresets() {
        return Storage.get('exportPresets', {});
    }

    /**
     * Save custom export preset path for a platform
     */
    function savePresetForPlatform(platformId, presetPath) {
        var presets = getSavedPresets();
        presets[platformId] = presetPath;
        Storage.set('exportPresets', presets);
    }

    /**
     * Render the export UI
     */
    function renderUI(container) {
        var savedPresets = getSavedPresets();

        var html = '<div class="module-section">';
        html += '<h3>Multi-Platform Export</h3>';

        // Output directory
        html += '<div class="form-row">';
        html += '<label>Output Directory</label>';
        html += '<input type="text" id="export-output-dir" placeholder="C:\\Exports" value="' + (Storage.get('lastExportDir', '') ) + '">';
        html += '</div>';

        // Platform checkboxes
        html += '<div class="platform-grid">';
        for (var id in PLATFORMS) {
            var p = PLATFORMS[id];
            var preset = savedPresets[id] || '';
            html += '<div class="platform-card">';
            html += '<label class="platform-check">';
            html += '<input type="checkbox" class="export-platform-cb" data-platform="' + id + '">';
            html += '<span class="platform-icon platform-icon-' + p.icon + '"></span>';
            html += '<span>' + p.name + '</span>';
            html += '</label>';
            html += '<div class="platform-details">';
            html += '<span class="platform-size">' + p.width + 'x' + p.height + '</span>';
            html += '<span class="platform-limit">';
            if (p.maxDuration) html += p.maxDuration + 's max';
            html += '</span>';
            html += '</div>';
            html += '<input type="text" class="platform-preset-input" data-platform="' + id + '" placeholder="AME Preset path (.epr)" value="' + preset + '">';
            html += '</div>';
        }
        html += '</div>';

        // Action buttons
        html += '<div class="export-actions">';
        html += '<button class="btn btn-primary" id="btn-batch-export">Export Selected Platforms</button>';
        html += '<button class="btn btn-secondary" id="btn-create-variants">Create Sequence Variants</button>';
        html += '<button class="btn btn-secondary" id="btn-select-all-platforms">Select All</button>';
        html += '</div>';

        // Export log
        html += '<div id="export-log" class="log-area"></div>';

        html += '</div>';
        container.innerHTML = html;

        bindExportEvents(container);
    }

    function bindExportEvents(container) {
        // Select all
        container.querySelector('#btn-select-all-platforms').addEventListener('click', function () {
            var cbs = container.querySelectorAll('.export-platform-cb');
            var allChecked = true;
            for (var i = 0; i < cbs.length; i++) {
                if (!cbs[i].checked) { allChecked = false; break; }
            }
            for (var j = 0; j < cbs.length; j++) {
                cbs[j].checked = !allChecked;
            }
        });

        // Batch export
        container.querySelector('#btn-batch-export').addEventListener('click', function () {
            var outputDir = container.querySelector('#export-output-dir').value;
            if (!outputDir) { showNotification('Output directory required', 'error'); return; }

            Storage.set('lastExportDir', outputDir);

            var selected = getSelectedPlatforms(container);
            if (selected.length === 0) { showNotification('Select at least one platform', 'error'); return; }

            // Save preset paths
            var presetInputs = container.querySelectorAll('.platform-preset-input');
            for (var i = 0; i < presetInputs.length; i++) {
                var pid = presetInputs[i].getAttribute('data-platform');
                var pval = presetInputs[i].value;
                if (pval) savePresetForPlatform(pid, pval);
            }

            logMessage(container, 'Starting batch export for ' + selected.length + ' platforms...');

            batchExport(selected, outputDir, '')
                .then(function (result) {
                    logMessage(container, 'Export batch started: ' + result.totalJobs + ' jobs queued');
                    showNotification('Export started! Check Adobe Media Encoder.', 'success');
                })
                .catch(function (err) {
                    logMessage(container, 'Export error: ' + err);
                    showNotification('Export error: ' + err, 'error');
                });
        });

        // Create variants
        container.querySelector('#btn-create-variants').addEventListener('click', function () {
            var selected = getSelectedPlatforms(container);
            if (selected.length === 0) { showNotification('Select at least one platform', 'error'); return; }

            logMessage(container, 'Creating ' + selected.length + ' sequence variants...');

            createPlatformVariants(selected)
                .then(function (results) {
                    logMessage(container, 'Created ' + results.length + ' variants');
                    showNotification(results.length + ' sequence variants created!', 'success');
                })
                .catch(function (err) {
                    logMessage(container, 'Error: ' + err);
                    showNotification('Error: ' + err, 'error');
                });
        });
    }

    function getSelectedPlatforms(container) {
        var cbs = container.querySelectorAll('.export-platform-cb:checked');
        var ids = [];
        for (var i = 0; i < cbs.length; i++) {
            ids.push(cbs[i].getAttribute('data-platform'));
        }
        return ids;
    }

    function logMessage(container, msg) {
        var log = container.querySelector('#export-log');
        if (log) {
            var time = new Date().toLocaleTimeString();
            log.innerHTML += '<div class="log-entry">[' + time + '] ' + msg + '</div>';
            log.scrollTop = log.scrollHeight;
        }
    }

    return {
        getPlatforms: getPlatforms,
        exportForPlatform: exportForPlatform,
        batchExport: batchExport,
        createPlatformVariants: createPlatformVariants,
        savePresetForPlatform: savePresetForPlatform,
        renderUI: renderUI
    };

})();

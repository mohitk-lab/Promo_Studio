/**
 * Module 7: Version Creator - One-Click Multi-Version Automation
 * Creates 1080x1080 (square) and 1080x1920 (portrait) versions from main sequence,
 * auto-adjusts clip motion properties, and organizes into "All Render" bin.
 */

var VersionCreator = (function () {

    // Default version configurations matching user's workflow
    var DEFAULT_VERSIONS = [
        { suffix: '1080x1080', width: 1080, height: 1080, label: 'Square (1:1)' },
        { suffix: '1080x1920', width: 1080, height: 1920, label: 'Portrait (9:16)' }
    ];

    var FIT_MODES = {
        'fill': 'Fill (crop to cover frame - no black bars)',
        'fit': 'Fit (show all content - may have bars)',
        'none': 'None (keep original scale/position)'
    };

    /**
     * Get saved version configurations or defaults
     */
    function getVersionConfigs() {
        return Storage.get('versionConfigs', DEFAULT_VERSIONS);
    }

    /**
     * Save custom version configurations
     */
    function saveVersionConfigs(configs) {
        Storage.set('versionConfigs', configs);
    }

    /**
     * Get saved settings
     */
    function getSettings() {
        return Storage.get('versionCreatorSettings', {
            binName: 'All Render',
            createSubBin: true,
            autoAdjust: true,
            fitMode: 'fill'
        });
    }

    /**
     * Save settings
     */
    function saveSettings(settings) {
        Storage.set('versionCreatorSettings', settings);
    }

    /**
     * Create all versions with one click
     */
    function createAllVersions(options) {
        var settings = getSettings();
        var versions = getVersionConfigs();

        var config = {
            versions: options && options.versions ? options.versions : versions,
            binName: (options && options.binName) || settings.binName,
            createSubBin: options && typeof options.createSubBin !== 'undefined' ? options.createSubBin : settings.createSubBin,
            autoAdjust: options && typeof options.autoAdjust !== 'undefined' ? options.autoAdjust : settings.autoAdjust,
            fitMode: (options && options.fitMode) || settings.fitMode
        };

        return PPro.callAsync('createVersionsFromActive', JSON.stringify(config));
    }

    /**
     * Get active sequence info
     */
    function getActiveSequenceInfo() {
        return PPro.callAsync('getActiveSequenceInfo', null);
    }

    /**
     * Scan the All Render bin
     */
    function scanAllRenderBin(binName) {
        return PPro.callMultiAsync('scanBinContents', [binName || 'All Render']);
    }

    /**
     * Render the Version Creator UI
     */
    function renderUI(container) {
        var settings = getSettings();
        var versions = getVersionConfigs();

        var html = '<div class="module-section">';
        html += '<h3>Version Creator</h3>';
        html += '<p class="module-desc">One-click: create square &amp; portrait versions from your main sequence, auto-adjust clips, organize into bin.</p>';

        // Active sequence info
        html += '<div class="version-seq-info" id="version-seq-info">';
        html += '<p class="empty-state">Loading active sequence...</p>';
        html += '</div>';

        // Version configs
        html += '<h4>Versions to Create</h4>';
        html += '<div class="version-list" id="version-list">';
        for (var i = 0; i < versions.length; i++) {
            var v = versions[i];
            html += renderVersionRow(v, i);
        }
        html += '</div>';
        html += '<button class="btn btn-sm btn-secondary" id="btn-add-version">+ Add Version</button>';

        // Settings
        html += '<h4>Settings</h4>';
        html += '<div class="form-row">';
        html += '<label>Target Bin</label>';
        html += '<input type="text" id="vc-bin-name" value="' + (settings.binName || 'All Render') + '" placeholder="All Render">';
        html += '</div>';

        html += '<div class="form-row">';
        html += '<label class="checkbox-label">';
        html += '<input type="checkbox" id="vc-create-subbin" ' + (settings.createSubBin !== false ? 'checked' : '') + '>';
        html += ' Create sub-folder with promo name';
        html += '</label>';
        html += '</div>';

        html += '<div class="form-row">';
        html += '<label class="checkbox-label">';
        html += '<input type="checkbox" id="vc-auto-adjust" ' + (settings.autoAdjust !== false ? 'checked' : '') + '>';
        html += ' Auto-adjust clip position &amp; scale';
        html += '</label>';
        html += '</div>';

        html += '<div class="form-row">';
        html += '<label>Fit Mode</label>';
        html += '<select id="vc-fit-mode">';
        for (var mode in FIT_MODES) {
            html += '<option value="' + mode + '"' + (settings.fitMode === mode ? ' selected' : '') + '>' + FIT_MODES[mode] + '</option>';
        }
        html += '</select>';
        html += '</div>';

        // Main action button
        html += '<div class="version-actions">';
        html += '<button class="btn btn-primary btn-lg" id="btn-create-versions">Create All Versions</button>';
        html += '</div>';

        // Progress / log
        html += '<div id="version-log" class="log-area" style="display:none;"></div>';

        // All Render bin explorer
        html += '<h4>All Render Bin</h4>';
        html += '<div id="all-render-contents">';
        html += '<p class="empty-state">Click refresh to scan bin contents</p>';
        html += '</div>';
        html += '<button class="btn btn-sm btn-secondary" id="btn-scan-bin">Refresh Bin Contents</button>';

        html += '</div>';
        container.innerHTML = html;

        // Load active sequence info
        loadSequenceInfo();

        // Bind events
        bindVersionEvents(container);
    }

    function renderVersionRow(v, index) {
        var html = '<div class="version-row" data-index="' + index + '">';
        html += '<span class="version-badge">' + v.width + 'x' + v.height + '</span>';
        html += '<span class="version-label">' + (v.label || v.suffix) + '</span>';
        html += '<input type="text" class="version-suffix-input" data-index="' + index + '" value="' + v.suffix + '" placeholder="suffix">';
        html += '<button class="btn btn-sm btn-danger btn-remove-version" data-index="' + index + '">X</button>';
        html += '</div>';
        return html;
    }

    function loadSequenceInfo() {
        getActiveSequenceInfo().then(function (result) {
            var area = document.getElementById('version-seq-info');
            if (!area) return;

            if (result && result.success) {
                var d = result.data;
                var html = '<div class="seq-info-card">';
                html += '<div class="seq-info-main">';
                html += '<strong>' + d.name + '</strong>';
                html += '<span class="seq-dimensions">' + d.width + 'x' + d.height + '</span>';
                html += '</div>';
                html += '<div class="seq-info-details">';
                html += '<span>Video Tracks: ' + d.videoTrackCount + '</span>';
                html += '<span>Audio Tracks: ' + d.audioTrackCount + '</span>';
                html += '</div>';
                html += '</div>';
                area.innerHTML = html;
            } else {
                area.innerHTML = '<p class="empty-state">No active sequence. Open a sequence in Premiere Pro first.</p>';
            }
        }).catch(function () {
            var area = document.getElementById('version-seq-info');
            if (area) area.innerHTML = '<p class="empty-state">Could not connect to Premiere Pro</p>';
        });
    }

    function bindVersionEvents(container) {

        // Create All Versions - main button
        container.querySelector('#btn-create-versions').addEventListener('click', function () {
            var btn = this;
            btn.disabled = true;
            btn.textContent = 'Creating versions...';

            // Save current settings
            var currentSettings = {
                binName: container.querySelector('#vc-bin-name').value || 'All Render',
                createSubBin: container.querySelector('#vc-create-subbin').checked,
                autoAdjust: container.querySelector('#vc-auto-adjust').checked,
                fitMode: container.querySelector('#vc-fit-mode').value
            };
            saveSettings(currentSettings);

            // Update suffixes from inputs
            var versions = getVersionConfigs();
            var suffixInputs = container.querySelectorAll('.version-suffix-input');
            for (var i = 0; i < suffixInputs.length; i++) {
                var idx = parseInt(suffixInputs[i].getAttribute('data-index'));
                if (versions[idx]) {
                    versions[idx].suffix = suffixInputs[i].value;
                }
            }
            saveVersionConfigs(versions);

            var logArea = container.querySelector('#version-log');
            logArea.style.display = 'block';
            logArea.innerHTML = '';
            versionLog(logArea, 'Starting version creation...');
            versionLog(logArea, 'Versions: ' + versions.map(function (v) { return v.width + 'x' + v.height; }).join(', '));
            versionLog(logArea, 'Fit mode: ' + currentSettings.fitMode);
            versionLog(logArea, 'Auto-adjust: ' + (currentSettings.autoAdjust ? 'Yes' : 'No'));

            createAllVersions(currentSettings).then(function (result) {
                btn.disabled = false;
                btn.textContent = 'Create All Versions';

                if (result && result.success) {
                    var d = result.data;
                    versionLog(logArea, 'Main sequence: ' + d.mainSequence.name + ' (' + d.mainSequence.width + 'x' + d.mainSequence.height + ')');

                    for (var i = 0; i < d.versions.length; i++) {
                        versionLog(logArea, 'Created: ' + d.versions[i].name + ' (' + d.versions[i].width + 'x' + d.versions[i].height + ')');
                    }

                    if (d.bin) {
                        versionLog(logArea, 'Organized into: ' + d.bin.bin + (d.bin.subBin ? '/' + d.bin.subBin : '') + ' (' + d.bin.movedCount + ' items)');
                    }

                    versionLog(logArea, 'All versions created successfully!');
                    showNotification('Versions created! Check "' + currentSettings.binName + '" bin.', 'success');

                    // Refresh bin contents
                    loadBinContents(container, currentSettings.binName);
                    // Refresh sequence info
                    loadSequenceInfo();
                } else {
                    versionLog(logArea, 'Error: ' + (result ? result.error : 'Unknown error'));
                    showNotification('Error: ' + (result ? result.error : 'Unknown error'), 'error');
                }
            }).catch(function (err) {
                btn.disabled = false;
                btn.textContent = 'Create All Versions';
                versionLog(logArea, 'Error: ' + err);
                showNotification('Error: ' + err, 'error');
            });
        });

        // Add version
        container.querySelector('#btn-add-version').addEventListener('click', function () {
            var w = prompt('Width:', '1080');
            if (!w) return;
            var h = prompt('Height:', '1080');
            if (!h) return;
            var label = prompt('Label:', w + 'x' + h);

            var versions = getVersionConfigs();
            versions.push({
                suffix: w + 'x' + h,
                width: parseInt(w),
                height: parseInt(h),
                label: label || (w + 'x' + h)
            });
            saveVersionConfigs(versions);

            // Re-render the version list
            var listEl = container.querySelector('#version-list');
            var html = '';
            for (var i = 0; i < versions.length; i++) {
                html += renderVersionRow(versions[i], i);
            }
            listEl.innerHTML = html;
            bindRemoveButtons(container);
        });

        // Remove version buttons
        bindRemoveButtons(container);

        // Scan bin button
        container.querySelector('#btn-scan-bin').addEventListener('click', function () {
            var binName = container.querySelector('#vc-bin-name').value || 'All Render';
            loadBinContents(container, binName);
        });
    }

    function bindRemoveButtons(container) {
        var removeBtns = container.querySelectorAll('.btn-remove-version');
        for (var i = 0; i < removeBtns.length; i++) {
            removeBtns[i].addEventListener('click', function () {
                var idx = parseInt(this.getAttribute('data-index'));
                var versions = getVersionConfigs();
                versions.splice(idx, 1);
                saveVersionConfigs(versions);

                // Re-render
                var listEl = container.querySelector('#version-list');
                var html = '';
                for (var j = 0; j < versions.length; j++) {
                    html += renderVersionRow(versions[j], j);
                }
                listEl.innerHTML = html;
                bindRemoveButtons(container);
            });
        }
    }

    function loadBinContents(container, binName) {
        var area = container.querySelector('#all-render-contents');
        if (!area) return;

        area.innerHTML = '<p class="empty-state">Scanning...</p>';

        scanAllRenderBin(binName).then(function (result) {
            if (!result || !result.success) {
                area.innerHTML = '<p class="empty-state">Could not scan bin</p>';
                return;
            }

            var d = result.data;
            if (!d.exists) {
                area.innerHTML = '<p class="empty-state">"' + binName + '" bin not found. It will be created when you create versions.</p>';
                return;
            }

            if (d.items.length === 0) {
                area.innerHTML = '<p class="empty-state">"' + binName + '" bin is empty</p>';
                return;
            }

            var html = '<div class="bin-tree">';
            for (var i = 0; i < d.items.length; i++) {
                var item = d.items[i];
                var indent = (item.path.split('/').length - 1) * 16;
                var icon = item.isBin ? '&#128193;' : '&#127916;';
                html += '<div class="bin-tree-item" style="padding-left:' + indent + 'px;">';
                html += '<span class="bin-icon">' + icon + '</span>';
                html += '<span class="bin-item-name">' + item.name + '</span>';
                if (item.isBin) {
                    html += '<span class="bin-child-count">(' + item.childCount + ')</span>';
                }
                html += '</div>';
            }
            html += '</div>';
            area.innerHTML = html;
        }).catch(function () {
            area.innerHTML = '<p class="empty-state">Error scanning bin</p>';
        });
    }

    function versionLog(logArea, msg) {
        if (!logArea) return;
        var time = new Date().toLocaleTimeString();
        logArea.innerHTML += '<div class="log-entry">[' + time + '] ' + msg + '</div>';
        logArea.scrollTop = logArea.scrollHeight;
    }

    return {
        getVersionConfigs: getVersionConfigs,
        saveVersionConfigs: saveVersionConfigs,
        getSettings: getSettings,
        saveSettings: saveSettings,
        createAllVersions: createAllVersions,
        getActiveSequenceInfo: getActiveSequenceInfo,
        scanAllRenderBin: scanAllRenderBin,
        renderUI: renderUI
    };

})();

/**
 * Module 7: Version Creator - Smart Multi-Version Automation
 * Creates versions (1080x1080, 1080x1920, etc.) from main sequence with:
 * - Per-track role detection (background, narration, overlay, text, lower-third)
 * - MOGRT/Essential Graphics text position adjustment
 * - Crop, Drop Shadow, and position-based effect adjustment
 * - Smart center-pin for narration clips, bottom-pin for lower thirds
 * - Bin comparison/learning system to diff manual vs AI edits
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

    var TRACK_ROLE_LABELS = {
        'background': 'Background (V1 base footage)',
        'narration': 'Narration / Face (center-pin)',
        'overlay': 'Overlay / Logo (preserve corner)',
        'text': 'Text / Graphics (fit + adjust MOGRT)',
        'lower_third': 'Lower Third (pin to bottom)',
        'unknown': 'Auto-detect'
    };

    /**
     * Get saved version configurations or defaults
     */
    function getVersionConfigs() {
        return Storage.get('versionConfigs', DEFAULT_VERSIONS);
    }

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
            fitMode: 'fill',
            smartRoles: true,
            adjustMOGRT: true,
            adjustEffects: true,
            trackOverrides: {}
        });
    }

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
            fitMode: (options && options.fitMode) || settings.fitMode,
            smartRoles: options && typeof options.smartRoles !== 'undefined' ? options.smartRoles : settings.smartRoles,
            adjustMOGRT: options && typeof options.adjustMOGRT !== 'undefined' ? options.adjustMOGRT : settings.adjustMOGRT,
            adjustEffects: options && typeof options.adjustEffects !== 'undefined' ? options.adjustEffects : settings.adjustEffects,
            trackOverrides: (options && options.trackOverrides) || settings.trackOverrides || {}
        };

        return PPro.callAsync('createVersionsFromActive', JSON.stringify(config));
    }

    function getActiveSequenceInfo() {
        return PPro.callAsync('getActiveSequenceInfo', null);
    }

    function scanAllRenderBin(binName) {
        return PPro.callMultiAsync('scanBinContents', [binName || 'All Render']);
    }

    /**
     * Snapshot a sequence's properties for comparison
     */
    function snapshotSequence(seqName) {
        return PPro.callMultiAsync('snapshotSequenceProperties', [seqName]);
    }

    /**
     * Compare two sequences and get property differences
     */
    function compareSequences(seqName1, seqName2) {
        return PPro.callMultiAsync('compareSequenceSnapshots', [seqName1, seqName2]);
    }

    /**
     * Render the Version Creator UI
     */
    function renderUI(container) {
        var settings = getSettings();
        var versions = getVersionConfigs();

        var html = '<div class="module-section">';
        html += '<h3>Version Creator</h3>';
        html += '<p class="module-desc">Smart multi-version automation with track role detection, MOGRT adjustment, and learning from your manual edits.</p>';

        // Active sequence info
        html += '<div class="version-seq-info" id="version-seq-info">';
        html += '<p class="empty-state">Loading active sequence...</p>';
        html += '</div>';

        // Version configs
        html += '<h4>Versions to Create</h4>';
        html += '<div class="version-list" id="version-list">';
        for (var i = 0; i < versions.length; i++) {
            html += renderVersionRow(versions[i], i);
        }
        html += '</div>';
        html += '<button class="btn btn-sm btn-secondary" id="btn-add-version">+ Add Version</button>';

        // Smart Settings
        html += '<h4>Smart Settings</h4>';

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
        html += '<label>Global Fit Mode (fallback)</label>';
        html += '<select id="vc-fit-mode">';
        for (var mode in FIT_MODES) {
            html += '<option value="' + mode + '"' + (settings.fitMode === mode ? ' selected' : '') + '>' + FIT_MODES[mode] + '</option>';
        }
        html += '</select>';
        html += '</div>';

        // Smart role toggles
        html += '<div class="form-row">';
        html += '<label class="checkbox-label">';
        html += '<input type="checkbox" id="vc-smart-roles" ' + (settings.smartRoles !== false ? 'checked' : '') + '>';
        html += ' Smart Track Roles (auto-detect background/narration/text/overlay)';
        html += '</label>';
        html += '</div>';

        html += '<div class="form-row">';
        html += '<label class="checkbox-label">';
        html += '<input type="checkbox" id="vc-adjust-mogrt" ' + (settings.adjustMOGRT !== false ? 'checked' : '') + '>';
        html += ' Adjust MOGRT / Essential Graphics positions';
        html += '</label>';
        html += '</div>';

        html += '<div class="form-row">';
        html += '<label class="checkbox-label">';
        html += '<input type="checkbox" id="vc-adjust-effects" ' + (settings.adjustEffects !== false ? 'checked' : '') + '>';
        html += ' Adjust Effects (Crop, Drop Shadow, etc.)';
        html += '</label>';
        html += '</div>';

        // Track role overrides
        html += '<h4>Track Role Overrides <small>(optional)</small></h4>';
        html += '<p class="module-desc">Override auto-detected roles for specific tracks. Leave as "Auto-detect" to use smart detection.</p>';
        html += '<div id="track-role-overrides">';
        html += '<p class="empty-state">Load sequence to see tracks...</p>';
        html += '</div>';

        // Main action button
        html += '<div class="version-actions">';
        html += '<button class="btn btn-primary btn-lg" id="btn-create-versions">Create All Versions</button>';
        html += ' <button class="btn btn-sm btn-secondary" id="btn-jsx-diagnostic" title="Check if JSX loaded correctly">Diagnose</button>';
        html += '</div>';

        // Progress / log
        html += '<div id="version-log" class="log-area" style="display:none;"></div>';

        // Bin Comparison / Learning
        html += '<h4>Bin Comparison (Learn from Manual Edits)</h4>';
        html += '<p class="module-desc">Compare your manually edited version with the AI version to see exactly what differs.</p>';
        html += '<div class="form-row">';
        html += '<label>Manual Sequence Name</label>';
        html += '<input type="text" id="vc-compare-manual" placeholder="e.g., 1st SelfNarration">';
        html += '</div>';
        html += '<div class="form-row">';
        html += '<label>AI Sequence Name</label>';
        html += '<input type="text" id="vc-compare-ai" placeholder="e.g., 1st SelfNarration AI">';
        html += '</div>';
        html += '<button class="btn btn-sm btn-secondary" id="btn-compare-bins">Compare & Learn</button>';
        html += '<div id="compare-results" style="display:none;"></div>';

        // All Render bin explorer
        html += '<h4>All Render Bin</h4>';
        html += '<div id="all-render-contents">';
        html += '<p class="empty-state">Click refresh to scan bin contents</p>';
        html += '</div>';
        html += '<button class="btn btn-sm btn-secondary" id="btn-scan-bin">Refresh Bin Contents</button>';

        html += '</div>';
        container.innerHTML = html;

        // Load active sequence info + track roles
        loadSequenceInfo();
        loadTrackRoleOverrides(container, settings);

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
        getActiveSequenceInfo().then(function (d) {
            var area = document.getElementById('version-seq-info');
            if (!area) return;

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
        }).catch(function () {
            var area = document.getElementById('version-seq-info');
            if (area) area.innerHTML = '<p class="empty-state">Could not connect to Premiere Pro</p>';
        });
    }

    function loadTrackRoleOverrides(container, settings) {
        getActiveSequenceInfo().then(function (d) {
            var area = container.querySelector('#track-role-overrides');
            if (!area || !d) return;
            var overrides = settings.trackOverrides || {};
            var html = '';

            for (var t = 0; t < d.videoTrackCount; t++) {
                var currentRole = overrides[String(t)] || 'unknown';
                html += '<div class="form-row track-role-row">';
                html += '<label>V' + (t + 1) + '</label>';
                html += '<select class="track-role-select" data-track="' + t + '">';
                for (var role in TRACK_ROLE_LABELS) {
                    html += '<option value="' + role + '"' + (currentRole === role ? ' selected' : '') + '>' + TRACK_ROLE_LABELS[role] + '</option>';
                }
                html += '</select>';
                html += '</div>';
            }

            area.innerHTML = html || '<p class="empty-state">No video tracks found</p>';
        }).catch(function () {});
    }

    function bindVersionEvents(container) {

        // Diagnostic button
        container.querySelector('#btn-jsx-diagnostic').addEventListener('click', function () {
            var logArea = container.querySelector('#version-log');
            logArea.style.display = 'block';
            logArea.innerHTML = '';
            versionLog(logArea, 'Running JSX diagnostic...');

            PPro.callAsync('jsxDiagnostic', null).then(function (d) {
                versionLog(logArea, 'JSX loaded: ' + (d.jsxLoaded ? 'YES' : 'NO'));
                versionLog(logArea, 'Project open: ' + (d.hasProject ? 'YES' : 'NO'));
                versionLog(logArea, 'Active sequence: ' + (d.hasActiveSeq ? 'YES' : 'NO'));
                if (d.seqName) versionLog(logArea, 'Sequence: ' + d.seqName + ' (' + d.seqSize + ')');
                if (d.videoTracks) versionLog(logArea, 'Video tracks: ' + d.videoTracks);
                if (d.fnExists) {
                    for (var fn in d.fnExists) {
                        versionLog(logArea, '  ' + fn + ': ' + (d.fnExists[fn] ? 'OK' : 'MISSING'));
                    }
                }
                if (typeof d.hasClone !== 'undefined') versionLog(logArea, 'seq.clone(): ' + (d.hasClone ? 'OK' : 'MISSING'));
                if (typeof d.hasGetSettings !== 'undefined') versionLog(logArea, 'seq.getSettings(): ' + (d.hasGetSettings ? 'OK' : 'MISSING'));
                if (typeof d.hasOpenSequence !== 'undefined') versionLog(logArea, 'proj.openSequence(): ' + (d.hasOpenSequence ? 'OK' : 'MISSING'));
                versionLog(logArea, 'Diagnostic complete.');
            }).catch(function (err) {
                versionLog(logArea, 'DIAGNOSTIC FAILED: ' + err);
                versionLog(logArea, 'This means the JSX file did not load. Restart Premiere Pro.');
            });
        });

        // Create All Versions - main button
        container.querySelector('#btn-create-versions').addEventListener('click', function () {
            var btn = this;
            btn.disabled = true;
            btn.textContent = 'Creating versions...';

            // Collect track role overrides
            var trackOverrides = {};
            var roleSelects = container.querySelectorAll('.track-role-select');
            for (var rs = 0; rs < roleSelects.length; rs++) {
                var tIdx = roleSelects[rs].getAttribute('data-track');
                var tRole = roleSelects[rs].value;
                if (tRole !== 'unknown') {
                    trackOverrides[tIdx] = tRole;
                }
            }

            // Save current settings
            var currentSettings = {
                binName: container.querySelector('#vc-bin-name').value || 'All Render',
                createSubBin: container.querySelector('#vc-create-subbin').checked,
                autoAdjust: container.querySelector('#vc-auto-adjust').checked,
                fitMode: container.querySelector('#vc-fit-mode').value,
                smartRoles: container.querySelector('#vc-smart-roles').checked,
                adjustMOGRT: container.querySelector('#vc-adjust-mogrt').checked,
                adjustEffects: container.querySelector('#vc-adjust-effects').checked,
                trackOverrides: trackOverrides
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
            versionLog(logArea, 'Starting smart version creation...');
            versionLog(logArea, 'Versions: ' + versions.map(function (v) { return v.width + 'x' + v.height; }).join(', '));
            versionLog(logArea, 'Fit mode: ' + currentSettings.fitMode);
            versionLog(logArea, 'Smart roles: ' + (currentSettings.smartRoles ? 'ON' : 'OFF'));
            versionLog(logArea, 'MOGRT adjust: ' + (currentSettings.adjustMOGRT ? 'ON' : 'OFF'));
            versionLog(logArea, 'Effects adjust: ' + (currentSettings.adjustEffects ? 'ON' : 'OFF'));

            var overrideCount = Object.keys(trackOverrides).length;
            if (overrideCount > 0) {
                versionLog(logArea, 'Track role overrides: ' + overrideCount + ' tracks');
            }

            createAllVersions(currentSettings).then(function (d) {
                btn.disabled = false;
                btn.textContent = 'Create All Versions';

                versionLog(logArea, 'Main sequence: ' + d.mainSequence.name + ' (' + d.mainSequence.width + 'x' + d.mainSequence.height + ')');

                if (d.trackRoles && d.trackRoles.length) {
                    versionLog(logArea, 'Detected track roles:');
                    for (var r = 0; r < d.trackRoles.length; r++) {
                        versionLog(logArea, '  V' + (r + 1) + ': ' + d.trackRoles[r]);
                    }
                }

                for (var i = 0; i < d.versions.length; i++) {
                    versionLog(logArea, 'Created: ' + d.versions[i].name + ' (' + d.versions[i].width + 'x' + d.versions[i].height + ')');
                }

                if (d.bin) {
                    versionLog(logArea, 'Organized into: ' + d.bin.bin + (d.bin.subBin ? '/' + d.bin.subBin : '') + ' (' + d.bin.movedCount + ' items)');
                }

                versionLog(logArea, 'All versions created successfully!');
                showNotification('Versions created! Check "' + currentSettings.binName + '" bin.', 'success');

                loadBinContents(container, currentSettings.binName);
                loadSequenceInfo();
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

        // Compare bins button
        container.querySelector('#btn-compare-bins').addEventListener('click', function () {
            var manualName = container.querySelector('#vc-compare-manual').value;
            var aiName = container.querySelector('#vc-compare-ai').value;

            if (!manualName || !aiName) {
                showNotification('Enter both sequence names to compare', 'error');
                return;
            }

            var resultsArea = container.querySelector('#compare-results');
            resultsArea.style.display = 'block';
            resultsArea.innerHTML = '<p class="empty-state">Comparing sequences...</p>';

            compareSequences(manualName, aiName).then(function (d) {
                if (!d) {
                    resultsArea.innerHTML = '<p class="empty-state">No data returned</p>';
                    return;
                }
                var html = '<div class="compare-summary">';
                html += '<strong>Differences Found: ' + d.totalDifferences + '</strong>';
                html += '</div>';

                if (d.totalDifferences === 0) {
                    html += '<p class="empty-state">No differences found - sequences match!</p>';
                } else {
                    html += '<div class="compare-diffs">';
                    for (var di = 0; di < d.trackDiffs.length; di++) {
                        var diff = d.trackDiffs[di];
                        html += '<div class="diff-row">';

                        if (diff.diff === 'track_missing') {
                            html += '<span class="diff-label">Track V' + (diff.track + 1) + '</span>';
                            html += '<span class="diff-type">Missing in ' + diff.in + '</span>';
                        } else if (diff.diff === 'clip_missing') {
                            html += '<span class="diff-label">V' + (diff.track + 1) + ' Clip ' + diff.clip + '</span>';
                            html += '<span class="diff-type">Missing in ' + diff.in + '</span>';
                        } else {
                            html += '<span class="diff-label">V' + (diff.track + 1) + ' "' + (diff.clipName || '') + '"</span>';
                            html += '<span class="diff-prop">' + diff.property + '</span>';
                            html += '<div class="diff-values">';
                            html += '<span class="diff-val-manual">Manual: ' + JSON.stringify(diff.seq1Value) + '</span>';
                            html += '<span class="diff-val-ai">AI: ' + JSON.stringify(diff.seq2Value) + '</span>';
                            html += '</div>';
                        }

                        html += '</div>';
                    }
                    html += '</div>';
                    html += '<p class="module-desc">Use these differences to set track role overrides above, or adjust your smart settings.</p>';
                }

                resultsArea.innerHTML = html;
            }).catch(function (err) {
                resultsArea.innerHTML = '<p class="empty-state">Error: ' + err + '</p>';
            });
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

        scanAllRenderBin(binName).then(function (d) {
            if (!d) {
                area.innerHTML = '<p class="empty-state">Could not scan bin</p>';
                return;
            }

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
        snapshotSequence: snapshotSequence,
        compareSequences: compareSequences,
        renderUI: renderUI
    };

})();

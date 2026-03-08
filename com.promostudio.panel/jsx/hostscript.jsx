/**
 * Promo Studio - Premiere Pro ExtendScript Host
 * This file runs inside Premiere Pro and has full access to the PPro DOM.
 * All functions here can read/write project files, sequences, clips, etc.
 */

// ============================================================
// UTILITY HELPERS
// ============================================================

/**
 * Begin an undo group - all changes until endUndoGroup() are a single undo step
 */
function beginUndoGroup(groupName) {
    try {
        if (app.project) {
            app.project.addUndoItem(groupName || 'Promo Studio Action');
        }
    } catch (e) {
        // Undo group not supported in this PPro version - continue silently
    }
}

/**
 * Wrap a function call in an undo group for single-step undo
 */
function withUndo(groupName, fn) {
    beginUndoGroup(groupName);
    try {
        return fn();
    } catch (e) {
        return errorResult(e.toString());
    }
}

function jsonStringify(obj) {
    if (typeof JSON !== 'undefined') return JSON.stringify(obj);
    // Fallback for older ExtendScript
    var t = typeof obj;
    if (t === 'string') return '"' + obj.replace(/"/g, '\\"') + '"';
    if (t === 'number' || t === 'boolean') return String(obj);
    if (obj === null) return 'null';
    if (obj instanceof Array) {
        var a = [];
        for (var i = 0; i < obj.length; i++) a.push(jsonStringify(obj[i]));
        return '[' + a.join(',') + ']';
    }
    if (t === 'object') {
        var p = [];
        for (var k in obj) {
            if (obj.hasOwnProperty(k)) p.push('"' + k + '":' + jsonStringify(obj[k]));
        }
        return '{' + p.join(',') + '}';
    }
    return 'null';
}

function getProject() {
    if (!app.project) {
        return null;
    }
    return app.project;
}

function safeResult(data) {
    return jsonStringify({ success: true, data: data });
}

function errorResult(msg) {
    return jsonStringify({ success: false, error: String(msg) });
}

/**
 * Safe JSON parse for incoming args - never uses eval
 */
function safeParse(str) {
    if (typeof str !== 'string') return str;
    try {
        if (typeof JSON !== 'undefined') return JSON.parse(str);
    } catch (e) {
        // If JSON.parse fails, return the raw string
    }
    return str;
}

/**
 * Validate that a file exists on disk
 */
function fileExistsJSX(filePath) {
    try {
        var f = new File(filePath);
        return safeResult({ exists: f.exists, path: filePath });
    } catch (e) {
        return errorResult(e.toString());
    }
}

/**
 * Validate that a folder exists on disk
 */
function folderExistsJSX(folderPath) {
    try {
        var f = new Folder(folderPath);
        return safeResult({ exists: f.exists, path: folderPath });
    } catch (e) {
        return errorResult(e.toString());
    }
}

/**
 * Create folder if it doesn't exist
 */
function ensureFolder(folderPath) {
    try {
        var f = new Folder(folderPath);
        if (!f.exists) {
            var created = f.create();
            return safeResult({ created: created, path: folderPath });
        }
        return safeResult({ created: false, exists: true, path: folderPath });
    } catch (e) {
        return errorResult(e.toString());
    }
}

/**
 * Launch Adobe Media Encoder
 */
function launchEncoder() {
    try {
        if (app.encoder) {
            app.encoder.launchEncoder();
            return safeResult({ launched: true });
        }
        return errorResult('Adobe Media Encoder not available');
    } catch (e) {
        return errorResult(e.toString());
    }
}

/**
 * Get system info for diagnostics
 */
function getSystemInfo() {
    try {
        return safeResult({
            appName: app.name || 'Premiere Pro',
            appVersion: app.version || 'unknown',
            buildNumber: app.build || 'unknown',
            os: $.os || 'unknown',
            engineName: $.engineName || 'ExtendScript',
            locale: $.locale || 'unknown',
            encoderAvailable: !!app.encoder,
            projectOpen: !!app.project
        });
    } catch (e) {
        return errorResult(e.toString());
    }
}

/**
 * Scan a folder for files by extension
 */
function scanFolderForFiles(folderPath, extension) {
    try {
        var f = new Folder(folderPath);
        if (!f.exists) return errorResult('Folder not found: ' + folderPath);

        var pattern = extension ? ('*.' + extension) : '*.*';
        var files = f.getFiles(pattern);
        var result = [];
        for (var i = 0; i < files.length; i++) {
            if (files[i] instanceof File) {
                result.push({
                    name: files[i].name,
                    path: files[i].fsName,
                    size: files[i].length,
                    modified: files[i].modified ? files[i].modified.toString() : ''
                });
            }
        }
        return safeResult(result);
    } catch (e) {
        return errorResult(e.toString());
    }
}


// ============================================================
// PROJECT INFO
// ============================================================

function getProjectInfo() {
    try {
        var proj = getProject();
        if (!proj) return errorResult('No project open');

        var seqs = [];
        for (var i = 0; i < proj.sequences.numSequences; i++) {
            var seq = proj.sequences[i];
            seqs.push({
                name: seq.name,
                id: seq.sequenceID,
                frameSizeH: seq.frameSizeHorizontal,
                frameSizeV: seq.frameSizeVertical,
                frameRate: seq.timebase,
                numVideoTracks: seq.videoTracks.numTracks,
                numAudioTracks: seq.audioTracks.numTracks
            });
        }

        var bins = [];
        for (var b = 0; b < proj.rootItem.children.numItems; b++) {
            var item = proj.rootItem.children[b];
            bins.push({
                name: item.name,
                type: item.type,
                mediaPath: item.getMediaPath ? item.getMediaPath() : ''
            });
        }

        return safeResult({
            name: proj.name,
            path: proj.path,
            sequences: seqs,
            rootItems: bins
        });
    } catch (e) {
        return errorResult(e.toString());
    }
}


// ============================================================
// 1. TEMPLATE-BASED PROMO GENERATOR
// ============================================================

/**
 * Create a new sequence from template settings
 */
function createPromoFromTemplate(templateJSON) {
    try {
        var tpl = safeParse(templateJSON);
        var proj = getProject();
        if (!proj) return errorResult('No project open');
        beginUndoGroup('Create Promo from Template');

        var seqName = tpl.name || ('Promo_' + new Date().getTime());

        // If a preset path is provided, use it for precise sequence settings
        if (tpl.presetPath) {
            proj.createNewSequenceFromPreset(seqName, tpl.presetPath);
        } else {
            proj.createNewSequence(seqName, seqName);
        }

        var seq = proj.activeSequence;
        if (!seq) return errorResult('Failed to create sequence');

        // Apply custom dimensions if provided (override preset or default)
        if (tpl.width && tpl.height) {
            var settings = seq.getSettings();
            if (settings) {
                settings.videoFrameWidth = tpl.width;
                settings.videoFrameHeight = tpl.height;
                seq.setSettings(settings);
            }
        }

        // Apply custom frame rate if provided
        if (tpl.frameRate) {
            var settings2 = seq.getSettings();
            if (settings2) {
                settings2.videoFrameRate = tpl.frameRate;
                seq.setSettings(settings2);
            }
        }

        // Set in/out points if duration is specified
        if (tpl.duration) {
            var endTime = new Time();
            endTime.seconds = tpl.duration;
            seq.setInPoint(0);
            seq.setOutPoint(endTime.ticks);
        }

        var result = {
            sequenceName: seq.name,
            sequenceId: seq.sequenceID,
            width: seq.frameSizeHorizontal,
            height: seq.frameSizeVertical,
            frameRate: tpl.frameRate || seq.timebase
        };

        return safeResult(result);
    } catch (e) {
        return errorResult(e.toString());
    }
}

/**
 * Import media files into the project
 */
function importMediaFiles(filePathsJSON) {
    try {
        var paths = safeParse(filePathsJSON);
        var proj = getProject();
        if (!proj) return errorResult('No project open');

        if (!paths || !paths.length) return errorResult('No file paths provided');

        var importArray = [];
        for (var i = 0; i < paths.length; i++) {
            importArray.push(paths[i]);
        }

        var success = proj.importFiles(importArray, true, proj.rootItem, false);
        return safeResult({ imported: success, count: importArray.length });
    } catch (e) {
        return errorResult(e.toString());
    }
}

/**
 * Add a project item (clip) to the active sequence timeline
 */
function addClipToTimeline(itemIndex, trackIndex, startTime) {
    try {
        var proj = getProject();
        beginUndoGroup('Add Clip to Timeline');
        var seq = proj.activeSequence;
        if (!seq) return errorResult('No active sequence');

        var item = proj.rootItem.children[itemIndex];
        if (!item) return errorResult('Item not found at index: ' + itemIndex);

        var vTrack = seq.videoTracks[trackIndex || 0];
        if (!vTrack) return errorResult('Video track not found');

        var insertTime = new Time();
        insertTime.seconds = startTime || 0;

        vTrack.insertClip(item, insertTime);

        return safeResult({
            clipName: item.name,
            track: trackIndex || 0,
            startTime: startTime || 0
        });
    } catch (e) {
        return errorResult(e.toString());
    }
}

/**
 * Apply Motion Graphics Template (.mogrt) to sequence
 */
function applyMOGRT(mogrtPath, trackIndex, startTime, duration) {
    try {
        var proj = getProject();
        var seq = proj.activeSequence;
        if (!seq) return errorResult('No active sequence');

        var vTrack = seq.videoTracks[trackIndex || 0];
        var insertTime = new Time();
        insertTime.seconds = startTime || 0;

        var mogrtItem = seq.importMGT(
            mogrtPath,
            insertTime.ticks,
            trackIndex || 0,
            trackIndex || 0
        );

        if (mogrtItem) {
            return safeResult({ applied: true, mogrt: mogrtPath });
        }
        return errorResult('Failed to apply MOGRT');
    } catch (e) {
        return errorResult(e.toString());
    }
}

/**
 * Update text in a Motion Graphics clip (MOGRT)
 */
function updateMOGRTText(clipIndex, trackIndex, propertyName, newText) {
    try {
        var seq = getProject().activeSequence;
        var vTrack = seq.videoTracks[trackIndex || 0];
        var clip = vTrack.clips[clipIndex || 0];

        if (!clip) return errorResult('Clip not found');

        var mgComp = clip.getMGTComponent();
        if (!mgComp) return errorResult('Not a Motion Graphics clip');

        var propCount = mgComp.properties.numItems;
        for (var i = 0; i < propCount; i++) {
            var prop = mgComp.properties[i];
            if (prop.displayName === propertyName) {
                prop.setValue(newText, true);
                return safeResult({ updated: true, property: propertyName, value: newText });
            }
        }
        return errorResult('Property not found: ' + propertyName);
    } catch (e) {
        return errorResult(e.toString());
    }
}

/**
 * Replace media in a clip (swap footage)
 */
function replaceClipMedia(clipIndex, trackIndex, newMediaPath) {
    try {
        var proj = getProject();
        beginUndoGroup('Replace Clip Media');
        var seq = proj.activeSequence;
        var vTrack = seq.videoTracks[trackIndex || 0];
        var clip = vTrack.clips[clipIndex || 0];

        if (!clip) return errorResult('Clip not found');

        // Import the new media first
        proj.importFiles([newMediaPath], true, proj.rootItem, false);

        // Find the newly imported item
        var lastItem = proj.rootItem.children[proj.rootItem.children.numItems - 1];

        // Replace the clip's project item
        clip.projectItem.changeMediaPath(newMediaPath, true);

        return safeResult({ replaced: true, newMedia: newMediaPath });
    } catch (e) {
        return errorResult(e.toString());
    }
}


// ============================================================
// 2. MULTI-PLATFORM AUTO-EXPORT
// ============================================================

/**
 * Export active sequence via Adobe Media Encoder with specified preset
 */
function exportWithPreset(outputPath, presetPath, matchSequence) {
    try {
        var proj = getProject();
        var seq = proj.activeSequence;
        if (!seq) return errorResult('No active sequence');

        // Use AME (Adobe Media Encoder) for export
        var jobID = app.encoder.encodeSequence(
            seq,
            outputPath,
            presetPath,
            app.encoder.ENCODE_IN_TO_OUT,
            true // removeOnCompletion
        );

        app.encoder.startBatch();

        return safeResult({
            jobID: jobID,
            output: outputPath,
            preset: presetPath,
            sequence: seq.name
        });
    } catch (e) {
        return errorResult(e.toString());
    }
}

/**
 * Batch export for multiple platforms
 * Takes array of {outputPath, presetPath, label}
 */
function batchExportMultiPlatform(exportsJSON) {
    try {
        var exports = safeParse(exportsJSON);
        var proj = getProject();
        var seq = proj.activeSequence;
        if (!seq) return errorResult('No active sequence');

        var jobs = [];
        for (var i = 0; i < exports.length; i++) {
            var exp = exports[i];
            var jobID = app.encoder.encodeSequence(
                seq,
                exp.outputPath,
                exp.presetPath,
                app.encoder.ENCODE_IN_TO_OUT,
                true
            );
            jobs.push({
                label: exp.label || ('Export_' + i),
                jobID: jobID,
                outputPath: exp.outputPath
            });
        }

        app.encoder.startBatch();

        return safeResult({ totalJobs: jobs.length, jobs: jobs });
    } catch (e) {
        return errorResult(e.toString());
    }
}

/**
 * Create a duplicate sequence with different frame size for platform export
 */
function createSequenceCopy(newName, newWidth, newHeight) {
    try {
        var proj = getProject();
        var seq = proj.activeSequence;
        if (!seq) return errorResult('No active sequence');

        // Clone the current sequence
        seq.clone();

        // The cloned sequence becomes the active one
        var cloned = proj.activeSequence;
        cloned.name = newName;

        // Set new frame size
        var settings = cloned.getSettings();
        if (settings) {
            settings.videoFrameWidth = newWidth;
            settings.videoFrameHeight = newHeight;
            cloned.setSettings(settings);
        }

        return safeResult({
            name: cloned.name,
            width: newWidth,
            height: newHeight,
            id: cloned.sequenceID
        });
    } catch (e) {
        return errorResult(e.toString());
    }
}

/**
 * Get available export presets
 */
function getExportPresets() {
    try {
        var presets = [];
        // Common AME preset paths
        var presetLocations = [
            app.encoder ? 'AME Available' : 'AME Not Loaded'
        ];

        return safeResult({
            encoderAvailable: !!app.encoder,
            info: presetLocations
        });
    } catch (e) {
        return errorResult(e.toString());
    }
}


// ============================================================
// 4. CAMPAIGN SCHEDULER
// ============================================================

/**
 * Get all sequences as campaign items
 */
function getCampaignSequences() {
    try {
        var proj = getProject();
        if (!proj) return errorResult('No project open');

        var campaigns = [];
        for (var i = 0; i < proj.sequences.numSequences; i++) {
            var seq = proj.sequences[i];
            var markers = [];

            // Read sequence markers for schedule info
            var markerCount = seq.markers.numMarkers;
            var marker = seq.markers.getFirstMarker();
            for (var m = 0; m < markerCount; m++) {
                if (marker) {
                    markers.push({
                        name: marker.name,
                        comments: marker.comments,
                        start: marker.start.seconds,
                        end: marker.end.seconds,
                        type: marker.type
                    });
                    marker = seq.markers.getNextMarker(marker);
                }
            }

            campaigns.push({
                name: seq.name,
                id: seq.sequenceID,
                width: seq.frameSizeHorizontal,
                height: seq.frameSizeVertical,
                duration: seq.end !== '0' ? seq.end : 'unknown',
                markers: markers
            });
        }

        return safeResult(campaigns);
    } catch (e) {
        return errorResult(e.toString());
    }
}

/**
 * Add a schedule marker to a sequence
 */
function addScheduleMarker(sequenceIndex, markerName, markerComment, timeInSeconds) {
    try {
        var proj = getProject();
        var seq = proj.sequences[sequenceIndex];
        if (!seq) return errorResult('Sequence not found');

        var markerTime = new Time();
        markerTime.seconds = timeInSeconds || 0;

        var newMarker = seq.markers.createMarker(markerTime.seconds);
        newMarker.name = markerName || 'Schedule';
        newMarker.comments = markerComment || '';
        newMarker.type = 'Comment';

        return safeResult({
            added: true,
            sequence: seq.name,
            marker: markerName
        });
    } catch (e) {
        return errorResult(e.toString());
    }
}

/**
 * Export a specific sequence by index (for scheduled export)
 */
function exportSequenceByIndex(seqIndex, outputPath, presetPath) {
    try {
        var proj = getProject();
        var seq = proj.sequences[seqIndex];
        if (!seq) return errorResult('Sequence not found at index: ' + seqIndex);

        var jobID = app.encoder.encodeSequence(
            seq,
            outputPath,
            presetPath,
            app.encoder.ENCODE_IN_TO_OUT,
            true
        );

        app.encoder.startBatch();

        return safeResult({
            jobID: jobID,
            sequence: seq.name,
            output: outputPath
        });
    } catch (e) {
        return errorResult(e.toString());
    }
}


// ============================================================
// 5. BRAND KIT INTEGRATION
// ============================================================

/**
 * Apply Lumetri Color effect with brand colors to a clip
 */
function applyBrandColor(clipIndex, trackIndex, colorHex) {
    try {
        var proj = getProject();
        if (!proj) return errorResult('No project open');
        var seq = proj.activeSequence;
        if (!seq) return errorResult('No active sequence');
        var vTrack = seq.videoTracks[trackIndex || 0];
        if (!vTrack) return errorResult('Video track not found');
        var clip = vTrack.clips[clipIndex || 0];
        if (!clip) return errorResult('Clip not found');

        // Parse hex color to RGB floats (0-255 range for PPro)
        var hex = colorHex.replace('#', '');
        var r = parseInt(hex.substring(0, 2), 16);
        var g = parseInt(hex.substring(2, 4), 16);
        var b = parseInt(hex.substring(4, 6), 16);

        // Check if Lumetri Color is already applied
        var components = clip.components;
        var lumetriComp = null;

        for (var i = 0; i < components.numItems; i++) {
            if (components[i].displayName === 'Lumetri Color') {
                lumetriComp = components[i];
                break;
            }
        }

        // If Lumetri not found, apply it via QE DOM
        if (!lumetriComp) {
            // Use the effects panel to apply Lumetri
            var qeSeq = qe.project.getActiveSequence();
            if (qeSeq) {
                var qeClip = qeSeq.getVideoTrackAt(trackIndex || 0).getItemAt(clipIndex || 0);
                if (qeClip) {
                    qeClip.addVideoEffect(qe.project.getVideoEffectByName('Lumetri Color'));
                }
            }
            // Re-scan components after applying
            components = clip.components;
            for (var j = 0; j < components.numItems; j++) {
                if (components[j].displayName === 'Lumetri Color') {
                    lumetriComp = components[j];
                    break;
                }
            }
        }

        if (!lumetriComp) return errorResult('Could not apply Lumetri Color effect');

        // Navigate Lumetri properties - set Creative > Tint color
        var effectApplied = false;
        for (var p = 0; p < lumetriComp.properties.numItems; p++) {
            var prop = lumetriComp.properties[p];
            var name = prop.displayName;

            // Set Color Wheels - Midtone Tint for brand color overlay
            if (name === 'Tint Balance') {
                // Tint Balance: -100 (green) to 100 (magenta)
                var tintValue = ((r - g) / 255) * 100;
                prop.setValue(tintValue, true);
                effectApplied = true;
            }
            if (name === 'Temperature') {
                // Temperature: warm/cool based on blue vs red
                var tempValue = ((r - b) / 255) * 100;
                prop.setValue(tempValue, true);
                effectApplied = true;
            }
            if (name === 'Saturation') {
                // Boost saturation slightly for brand color visibility
                prop.setValue(120, true);
                effectApplied = true;
            }
        }

        return safeResult({
            clipIndex: clipIndex,
            colorApplied: effectApplied,
            color: colorHex,
            rgb: { r: r, g: g, b: b }
        });
    } catch (e) {
        return errorResult(e.toString());
    }
}

/**
 * Get all fonts used in the current project/sequence
 */
function getProjectFonts() {
    try {
        var seq = getProject().activeSequence;
        if (!seq) return errorResult('No active sequence');

        var fonts = [];

        // Scan video tracks for text/graphics clips
        for (var t = 0; t < seq.videoTracks.numTracks; t++) {
            var track = seq.videoTracks[t];
            for (var c = 0; c < track.clips.numItems; c++) {
                var clip = track.clips[c];
                var mgComp = clip.getMGTComponent();
                if (mgComp) {
                    for (var p = 0; p < mgComp.properties.numItems; p++) {
                        var prop = mgComp.properties[p];
                        if (prop.displayName.toLowerCase().indexOf('font') >= 0) {
                            fonts.push({
                                track: t,
                                clip: c,
                                clipName: clip.name,
                                property: prop.displayName,
                                value: prop.getValue()
                            });
                        }
                    }
                }
            }
        }

        return safeResult(fonts);
    } catch (e) {
        return errorResult(e.toString());
    }
}

/**
 * Import brand assets (logos, watermarks) into a dedicated bin
 */
function importBrandAssets(assetPathsJSON, binName) {
    try {
        var paths = safeParse(assetPathsJSON);
        var proj = getProject();
        if (!proj) return errorResult('No project open');

        // Create or find brand kit bin
        var brandBin = null;
        for (var i = 0; i < proj.rootItem.children.numItems; i++) {
            if (proj.rootItem.children[i].name === (binName || 'Brand Kit') &&
                proj.rootItem.children[i].type === 2) { // type 2 = bin
                brandBin = proj.rootItem.children[i];
                break;
            }
        }

        if (!brandBin) {
            brandBin = proj.rootItem.createBin(binName || 'Brand Kit');
        }

        // Import into the brand bin
        proj.importFiles(paths, true, brandBin, false);

        return safeResult({
            bin: binName || 'Brand Kit',
            imported: paths.length
        });
    } catch (e) {
        return errorResult(e.toString());
    }
}

/**
 * Add logo/watermark overlay to active sequence
 */
function addLogoOverlay(logoItemIndex, videoTrackIndex, startTime, endTime, position) {
    try {
        var proj = getProject();
        beginUndoGroup('Add Logo Overlay');
        var seq = proj.activeSequence;
        if (!seq) return errorResult('No active sequence');

        var logoItem = proj.rootItem.children[logoItemIndex];
        if (!logoItem) return errorResult('Logo item not found');

        var vTrack = seq.videoTracks[videoTrackIndex || 1]; // Default to track 2 (overlay)
        if (!vTrack) return errorResult('Track not found');

        var insertTime = new Time();
        insertTime.seconds = startTime || 0;

        vTrack.insertClip(logoItem, insertTime);

        // Access the newly added clip to set position/scale
        var clipCount = vTrack.clips.numItems;
        var newClip = vTrack.clips[clipCount - 1];

        if (newClip && position) {
            var components = newClip.components;
            for (var i = 0; i < components.numItems; i++) {
                if (components[i].displayName === 'Motion') {
                    var motionComp = components[i];
                    for (var p = 0; p < motionComp.properties.numItems; p++) {
                        var prop = motionComp.properties[p];
                        if (prop.displayName === 'Position') {
                            prop.setValue([position.x || 0.85, position.y || 0.1], true);
                        }
                        if (prop.displayName === 'Scale') {
                            prop.setValue(position.scale || 15, true);
                        }
                    }
                }
            }
        }

        return safeResult({
            added: true,
            logo: logoItem.name,
            track: videoTrackIndex || 1
        });
    } catch (e) {
        return errorResult(e.toString());
    }
}


// ============================================================
// 6. DYNAMIC PROMO RULES ENGINE
// ============================================================

/**
 * Duplicate a template sequence and customize it (rule-based generation)
 */
function generatePromoFromRule(ruleJSON) {
    try {
        var rule = safeParse(ruleJSON);
        var proj = getProject();
        if (!proj) return errorResult('No project open');
        beginUndoGroup('Generate Promo from Rule');

        // Find source template sequence
        var templateSeq = null;
        for (var i = 0; i < proj.sequences.numSequences; i++) {
            if (proj.sequences[i].name === rule.templateSequence) {
                templateSeq = proj.sequences[i];
                break;
            }
        }

        if (!templateSeq) return errorResult('Template sequence not found: ' + rule.templateSequence);

        // Set as active and clone
        proj.openSequence(templateSeq.sequenceID);
        proj.activeSequence.clone();

        var newSeq = proj.activeSequence;
        newSeq.name = rule.outputName || ('Promo_' + rule.type + '_' + new Date().getTime());

        // Apply text replacements if provided
        if (rule.textReplacements) {
            for (var t = 0; t < newSeq.videoTracks.numTracks; t++) {
                var track = newSeq.videoTracks[t];
                for (var c = 0; c < track.clips.numItems; c++) {
                    var clip = track.clips[c];
                    var mgComp = clip.getMGTComponent();
                    if (mgComp) {
                        for (var r = 0; r < rule.textReplacements.length; r++) {
                            var repl = rule.textReplacements[r];
                            for (var p = 0; p < mgComp.properties.numItems; p++) {
                                if (mgComp.properties[p].displayName === repl.property) {
                                    mgComp.properties[p].setValue(repl.value, true);
                                }
                            }
                        }
                    }
                }
            }
        }

        // Add schedule marker
        if (rule.scheduledDate) {
            var marker = newSeq.markers.createMarker(0);
            marker.name = 'Scheduled: ' + rule.scheduledDate;
            marker.comments = jsonStringify({
                type: rule.type,
                platform: rule.platform,
                date: rule.scheduledDate
            });
        }

        return safeResult({
            created: true,
            sequenceName: newSeq.name,
            sequenceId: newSeq.sequenceID,
            rule: rule.type
        });
    } catch (e) {
        return errorResult(e.toString());
    }
}

/**
 * Get all project sequences that match a naming pattern (for rule matching)
 */
function findSequencesByPattern(pattern) {
    try {
        var proj = getProject();
        var matches = [];

        for (var i = 0; i < proj.sequences.numSequences; i++) {
            var seq = proj.sequences[i];
            if (seq.name.indexOf(pattern) >= 0) {
                matches.push({
                    index: i,
                    name: seq.name,
                    id: seq.sequenceID
                });
            }
        }

        return safeResult(matches);
    } catch (e) {
        return errorResult(e.toString());
    }
}


// ============================================================
// 9. ASSET LIBRARY & MEDIA MANAGER
// ============================================================

/**
 * Get all project items with metadata (full asset inventory)
 */
function getAssetLibrary() {
    try {
        var proj = getProject();
        if (!proj) return errorResult('No project open');

        var assets = [];
        scanBin(proj.rootItem, '', assets);

        return safeResult(assets);
    } catch (e) {
        return errorResult(e.toString());
    }
}

function scanBin(bin, path, assets) {
    for (var i = 0; i < bin.children.numItems; i++) {
        var item = bin.children[i];
        var itemPath = path ? (path + '/' + item.name) : item.name;

        if (item.type === 2) {
            // It's a bin - recurse
            scanBin(item, itemPath, assets);
        } else {
            var mediaPath = '';
            try { mediaPath = item.getMediaPath(); } catch (e) {}

            var inPoint = '';
            var outPoint = '';
            try { inPoint = item.getInPoint().seconds; } catch (e) {}
            try { outPoint = item.getOutPoint().seconds; } catch (e) {}

            assets.push({
                name: item.name,
                path: itemPath,
                type: item.type,
                mediaPath: mediaPath,
                inPoint: inPoint,
                outPoint: outPoint,
                nodeId: item.nodeId || ''
            });
        }
    }
}

/**
 * Create organized bins (folders) in the project
 */
function createBinStructure(binsJSON) {
    try {
        var bins = safeParse(binsJSON);
        var proj = getProject();
        if (!proj) return errorResult('No project open');

        var created = [];
        for (var i = 0; i < bins.length; i++) {
            var newBin = proj.rootItem.createBin(bins[i]);
            created.push(bins[i]);
        }

        return safeResult({ created: created });
    } catch (e) {
        return errorResult(e.toString());
    }
}

/**
 * Search project items by name
 */
function searchAssets(query) {
    try {
        var proj = getProject();
        if (!proj) return errorResult('No project open');

        var results = [];
        searchBin(proj.rootItem, query.toLowerCase(), '', results);

        return safeResult(results);
    } catch (e) {
        return errorResult(e.toString());
    }
}

function searchBin(bin, query, path, results) {
    for (var i = 0; i < bin.children.numItems; i++) {
        var item = bin.children[i];
        var itemPath = path ? (path + '/' + item.name) : item.name;

        if (item.name.toLowerCase().indexOf(query) >= 0) {
            results.push({
                name: item.name,
                path: itemPath,
                type: item.type,
                index: i
            });
        }

        if (item.type === 2) {
            searchBin(item, query, itemPath, results);
        }
    }
}

/**
 * Move a project item to a specific bin
 */
function moveItemToBin(itemIndex, binName) {
    try {
        var proj = getProject();
        var item = proj.rootItem.children[itemIndex];
        if (!item) return errorResult('Item not found');

        // Find target bin
        var targetBin = null;
        for (var i = 0; i < proj.rootItem.children.numItems; i++) {
            if (proj.rootItem.children[i].name === binName &&
                proj.rootItem.children[i].type === 2) {
                targetBin = proj.rootItem.children[i];
                break;
            }
        }

        if (!targetBin) return errorResult('Bin not found: ' + binName);

        item.moveBin(targetBin);

        return safeResult({
            moved: true,
            item: item.name,
            toBin: binName
        });
    } catch (e) {
        return errorResult(e.toString());
    }
}

/**
 * Set metadata/label on a project item (tagging)
 */
function tagAsset(itemIndex, tagName, tagValue) {
    try {
        var proj = getProject();
        if (!proj) return errorResult('No project open');
        var item = proj.rootItem.children[itemIndex];
        if (!item) return errorResult('Item not found');

        // Read existing XMP metadata
        var xmpRaw = item.getXMPMetadata();
        if (!xmpRaw) return errorResult('Cannot access metadata for this item');

        // Build tag string to embed in dc:description
        var tagString = '[' + tagName + ':' + tagValue + ']';

        // Read current project metadata and append tag
        var projectMeta = item.getProjectMetadata();
        var descKey = 'Column.PropertyText.Description';

        // Check if tag already exists in metadata to avoid duplicates
        if (projectMeta && projectMeta.indexOf(tagString) >= 0) {
            return safeResult({
                tagged: true,
                item: item.name,
                tag: tagName,
                value: tagValue,
                note: 'Tag already exists'
            });
        }

        // Use setProjectMetadata to write the tag into the description column
        // This is the proper PPro API for writing project-level metadata
        var schema = 'http://ns.adobe.com/premierePrivateProjectMetaData/1.0/';
        var succeeded = item.setProjectMetadata(
            '<premierePrivateProjectMetaData:Column.PropertyText.Description>' +
            tagString +
            '</premierePrivateProjectMetaData:Column.PropertyText.Description>',
            [descKey]
        );

        return safeResult({
            tagged: true,
            item: item.name,
            tag: tagName,
            value: tagValue
        });
    } catch (e) {
        return errorResult(e.toString());
    }
}

// ============================================================
// 7. VERSION CREATOR - Smart Multi-Version Automation
// ============================================================
// Learning from manual bin editing patterns:
// - Per-track role detection (background, narration, overlay, text, lower-third)
// - MOGRT / Essential Graphics text position adjustment
// - Anchor Point, Rotation, Crop, Drop Shadow adjustment
// - Smart center-pin for narration/face clips
// - Bin comparison/snapshot system for learning manual vs AI differences
// ============================================================

/**
 * Diagnostic: check if the JSX file loaded and core functions exist
 */
function jsxDiagnostic() {
    try {
        var checks = {
            jsxLoaded: true,
            hasProject: !!app.project,
            hasActiveSeq: !!(app.project && app.project.activeSequence),
            fnExists: {
                createVersionsFromActive: typeof createVersionsFromActive === 'function',
                adjustAllClipsSmartV2: typeof adjustAllClipsSmartV2 === 'function',
                detectTrackRole: typeof detectTrackRole === 'function',
                walkKeyframes: typeof walkKeyframes === 'function',
                snapshotSequenceProperties: typeof snapshotSequenceProperties === 'function',
                organizeVersionsIntoBin: typeof organizeVersionsIntoBin === 'function',
                getActiveSequenceInfo: typeof getActiveSequenceInfo === 'function'
            }
        };
        if (app.project && app.project.activeSequence) {
            var seq = app.project.activeSequence;
            checks.seqName = seq.name;
            checks.seqSize = seq.frameSizeHorizontal + 'x' + seq.frameSizeVertical;
            checks.videoTracks = seq.videoTracks.numTracks;
            // Test if clone exists
            checks.hasClone = typeof seq.clone === 'function';
            // Test if getSettings exists
            checks.hasGetSettings = typeof seq.getSettings === 'function';
            // Test if openSequence exists
            checks.hasOpenSequence = typeof app.project.openSequence === 'function';
        }
        return safeResult(checks);
    } catch (e) {
        return errorResult('Diagnostic failed: ' + e.toString());
    }
}

/**
 * Track role constants - detected from track name, clip type, and position
 */
var TRACK_ROLES = {
    BACKGROUND: 'background',   // V1 typically, full-frame footage/color
    NARRATION: 'narration',     // Face/talking head clips (detected by name or track)
    OVERLAY: 'overlay',         // Logos, watermarks, small overlays
    TEXT: 'text',               // Essential Graphics, MOGRTs, text layers
    LOWER_THIRD: 'lower_third', // Lower third graphics (bottom 30%)
    UNKNOWN: 'unknown'
};

/**
 * Detect the role of a track based on its name, clip content, and position
 */
function detectTrackRole(track, trackIndex, totalTracks) {
    var trackName = track.name ? track.name.toLowerCase() : '';

    // Check track name hints
    if (trackName.indexOf('bg') >= 0 || trackName.indexOf('background') >= 0) return TRACK_ROLES.BACKGROUND;
    if (trackName.indexOf('narr') >= 0 || trackName.indexOf('face') >= 0 || trackName.indexOf('cam') >= 0 || trackName.indexOf('selfnarr') >= 0) return TRACK_ROLES.NARRATION;
    if (trackName.indexOf('overlay') >= 0 || trackName.indexOf('logo') >= 0 || trackName.indexOf('watermark') >= 0) return TRACK_ROLES.OVERLAY;
    if (trackName.indexOf('text') >= 0 || trackName.indexOf('title') >= 0 || trackName.indexOf('caption') >= 0) return TRACK_ROLES.TEXT;
    if (trackName.indexOf('lower') >= 0 || trackName.indexOf('l3') >= 0 || trackName.indexOf('lt') >= 0) return TRACK_ROLES.LOWER_THIRD;

    // Scan clip content for hints
    if (track.clips.numItems > 0) {
        var hasMOGRT = false;
        var hasVideo = false;

        for (var c = 0; c < track.clips.numItems && c < 3; c++) {
            var clip = track.clips[c];
            try {
                var mgComp = clip.getMGTComponent();
                if (mgComp) hasMOGRT = true;
            } catch (e) {}

            var clipName = clip.name ? clip.name.toLowerCase() : '';
            if (clipName.indexOf('narr') >= 0 || clipName.indexOf('selfnarr') >= 0 || clipName.indexOf('face') >= 0 || clipName.indexOf('cam') >= 0) return TRACK_ROLES.NARRATION;
            if (clipName.indexOf('logo') >= 0 || clipName.indexOf('watermark') >= 0) return TRACK_ROLES.OVERLAY;
            if (clipName.indexOf('lower') >= 0 || clipName.indexOf('l3') >= 0) return TRACK_ROLES.LOWER_THIRD;

            if (!mgComp) hasVideo = true;
        }

        if (hasMOGRT && !hasVideo) return TRACK_ROLES.TEXT;
    }

    // Position-based heuristic: V1 = background, top tracks = overlays
    if (trackIndex === 0) return TRACK_ROLES.BACKGROUND;
    if (trackIndex === totalTracks - 1 || trackIndex === totalTracks - 2) return TRACK_ROLES.OVERLAY;

    return TRACK_ROLES.UNKNOWN;
}

/**
 * Get fit mode and strategy for a specific track role
 */
function getFitModeForRole(role, globalFitMode) {
    switch (role) {
        case TRACK_ROLES.BACKGROUND:
            return { fitMode: 'fill', centerPin: false, pinBottom: false };
        case TRACK_ROLES.NARRATION:
            return { fitMode: 'fill', centerPin: true, pinBottom: false };
        case TRACK_ROLES.TEXT:
            return { fitMode: 'fit', centerPin: false, pinBottom: false, adjustMOGRT: true };
        case TRACK_ROLES.LOWER_THIRD:
            return { fitMode: 'fit', centerPin: false, pinBottom: true, adjustMOGRT: true };
        case TRACK_ROLES.OVERLAY:
            return { fitMode: 'none', centerPin: false, pinBottom: false, preserveRelative: true };
        default:
            return { fitMode: globalFitMode || 'fill', centerPin: false, pinBottom: false };
    }
}

/**
 * Create multiple size versions from the active sequence.
 * Smart version with track role detection, MOGRT adjustment, and per-track fit modes.
 *
 * configJSON = {
 *   versions: [ { suffix: '1080x1080', width: 1080, height: 1080 }, ... ],
 *   binName: 'All Render',
 *   createSubBin: true,
 *   autoAdjust: true,
 *   fitMode: 'fill',       // global fallback: 'fill' | 'fit' | 'none'
 *   smartRoles: true,       // enable per-track role detection
 *   adjustMOGRT: true,      // adjust MOGRT/Essential Graphics text positions
 *   adjustEffects: true,    // adjust Crop, Drop Shadow, etc.
 *   trackOverrides: {}      // optional: { trackIndex: 'role' } manual overrides
 * }
 */
function createVersionsFromActive(configJSON) {
    try {
        var config = safeParse(configJSON);
        var proj = getProject();
        if (!proj) return errorResult('No project open');

        var mainSeq = proj.activeSequence;
        if (!mainSeq) return errorResult('No active sequence - open a sequence first');

        var mainName = mainSeq.name;
        var mainID = mainSeq.sequenceID;
        var oldWidth = parseInt(mainSeq.frameSizeHorizontal);
        var oldHeight = parseInt(mainSeq.frameSizeVertical);

        var versions = config.versions || [
            { suffix: '1080x1080', width: 1080, height: 1080 },
            { suffix: '1080x1920', width: 1080, height: 1920 }
        ];

        // Detect track roles from the main sequence before cloning
        var trackRoles = [];
        var totalVideoTracks = mainSeq.videoTracks.numTracks;
        for (var tr = 0; tr < totalVideoTracks; tr++) {
            var role = TRACK_ROLES.UNKNOWN;
            if (config.trackOverrides && config.trackOverrides[String(tr)]) {
                role = config.trackOverrides[String(tr)];
            } else if (config.smartRoles !== false) {
                role = detectTrackRole(mainSeq.videoTracks[tr], tr, totalVideoTracks);
            }
            trackRoles.push(role);
        }

        var createdVersions = [];

        for (var v = 0; v < versions.length; v++) {
            var ver = versions[v];
            var newW = parseInt(ver.width);
            var newH = parseInt(ver.height);

            // Switch back to the main sequence before each clone
            try {
                proj.openSequence(mainID);
            } catch (eOpen) {
                // Fallback: find and open sequence by iterating
                for (var si = 0; si < proj.sequences.numSequences; si++) {
                    if (proj.sequences[si].sequenceID === mainID) {
                        proj.activeSequence = proj.sequences[si];
                        break;
                    }
                }
            }

            // Clone the active (main) sequence
            proj.activeSequence.clone();

            // The clone is now active
            var clone = proj.activeSequence;
            clone.name = mainName + '_' + ver.suffix;

            // Change frame size
            try {
                var settings = clone.getSettings();
                if (settings) {
                    settings.videoFrameWidth = newW;
                    settings.videoFrameHeight = newH;
                    clone.setSettings(settings);
                }
            } catch (eSettings) {
                // Fallback: try sequence preset approach
                try {
                    clone.setPlayerPosition(clone.zeroPoint);
                } catch (e2) {}
            }

            // Smart auto-adjust with track roles
            if (config.autoAdjust !== false) {
                var adjustOpts = {
                    fitMode: config.fitMode || 'fill',
                    smartRoles: config.smartRoles !== false,
                    adjustMOGRT: config.adjustMOGRT !== false,
                    adjustEffects: config.adjustEffects !== false,
                    trackRoles: trackRoles
                };
                adjustAllClipsSmartV2(clone, oldWidth, oldHeight, newW, newH, adjustOpts);
            }

            createdVersions.push({
                name: clone.name,
                id: clone.sequenceID,
                width: newW,
                height: newH,
                trackRoles: trackRoles
            });
        }

        // Switch back to the main sequence
        proj.openSequence(mainID);

        // Organize into bin
        var binResult = null;
        if (config.binName) {
            binResult = organizeVersionsIntoBin(
                proj, mainName, mainID, createdVersions,
                config.binName, config.createSubBin !== false
            );
        }

        return safeResult({
            mainSequence: { name: mainName, width: oldWidth, height: oldHeight },
            versions: createdVersions,
            trackRoles: trackRoles,
            bin: binResult
        });
    } catch (e) {
        return errorResult(e.toString());
    }
}

/**
 * Smart V2 adjuster - handles all video tracks with role-aware fit modes
 * Adjusts Motion, MOGRT properties, Crop, Drop Shadow, and more
 */
function adjustAllClipsSmartV2(seq, oldW, oldH, newW, newH, opts) {
    var scaleX = newW / oldW;
    var scaleY = newH / oldH;

    for (var t = 0; t < seq.videoTracks.numTracks; t++) {
        var track = seq.videoTracks[t];
        var role = (opts.trackRoles && opts.trackRoles[t]) || TRACK_ROLES.UNKNOWN;
        var roleStrategy = getFitModeForRole(role, opts.fitMode);

        // Calculate scale factor for this track's role
        var scaleFactor;
        if (roleStrategy.fitMode === 'fill') {
            scaleFactor = Math.max(scaleX, scaleY);
        } else if (roleStrategy.fitMode === 'fit') {
            scaleFactor = Math.min(scaleX, scaleY);
        } else {
            scaleFactor = 1;
        }

        for (var c = 0; c < track.clips.numItems; c++) {
            try {
                var clip = track.clips[c];

                // 1. Adjust Motion component (Position, Scale, Anchor Point, Rotation)
                adjustSingleClipMotionV2(clip, scaleX, scaleY, scaleFactor, roleStrategy);

                // 2. Adjust MOGRT / Essential Graphics text properties
                if (opts.adjustMOGRT && (roleStrategy.adjustMOGRT || role === TRACK_ROLES.TEXT || role === TRACK_ROLES.LOWER_THIRD)) {
                    adjustMOGRTProperties(clip, scaleX, scaleY, oldW, oldH, newW, newH, roleStrategy);
                }

                // 3. Adjust position-based effects (Crop, Drop Shadow, etc.)
                if (opts.adjustEffects) {
                    adjustPositionBasedEffects(clip, scaleX, scaleY, oldW, oldH, newW, newH);
                }
            } catch (e) {
                // Skip clips that can't be adjusted
            }
        }
    }
}

/**
 * V2 Motion adjuster - handles Position, Scale, Anchor Point, and Rotation
 * with smart center-pin for narration clips and bottom-pin for lower thirds
 */
function adjustSingleClipMotionV2(clip, scaleX, scaleY, scaleFactor, roleStrategy) {
    if (!clip || !clip.components) return;

    for (var i = 0; i < clip.components.numItems; i++) {
        var comp = clip.components[i];
        if (comp.displayName !== 'Motion') continue;

        for (var p = 0; p < comp.properties.numItems; p++) {
            var prop = comp.properties[p];
            var name = prop.displayName;

            if (name === 'Position') {
                if (roleStrategy.centerPin) {
                    // Narration: center the clip in the new frame
                    setCenterPosition(prop);
                } else if (roleStrategy.pinBottom) {
                    // Lower third: pin to bottom of frame
                    adjustPositionPinBottom(prop, scaleX, scaleY);
                } else if (roleStrategy.preserveRelative) {
                    // Overlay: preserve relative position (e.g., logo corner stays in corner)
                    adjustPositionRelative(prop, scaleX, scaleY);
                } else {
                    // Default: proportional remap
                    adjustPositionProperty(prop, scaleX, scaleY);
                }
            }

            if (name === 'Scale') {
                adjustScaleProperty(prop, scaleFactor);
            }

            if (name === 'Anchor Point') {
                adjustAnchorPointProperty(prop, scaleX, scaleY);
            }

            // Rotation doesn't need frame-size adjustment typically,
            // but if Uniform Scale is off, we may need to handle it
        }
        break; // Only one Motion component per clip
    }
}

/**
 * Set position to center of frame (0.5, 0.5 in PPro normalized coords)
 * Used for narration/face clips that should be centered
 */
function setCenterPosition(prop) {
    try {
        if (prop.isTimeVarying()) {
            // For keyframed narration, center all keyframes
            walkKeyframes(prop, function (val) {
                if (val && val.length >= 2) {
                    return [0.5, 0.5];
                }
                return val;
            });
        } else {
            prop.setValue([0.5, 0.5], true);
        }
    } catch (e) {}
}

/**
 * Pin position to bottom of frame - keep X proportional, Y pinned low
 * Used for lower thirds
 */
function adjustPositionPinBottom(prop, scaleX, scaleY) {
    try {
        if (prop.isTimeVarying()) {
            walkKeyframes(prop, function (val) {
                if (val && val.length >= 2) {
                    // Keep relative X, but pin Y toward bottom (0.8-0.9 range)
                    var newY = 0.5 + (val[1] - 0.5); // Preserve offset from center but in new frame
                    if (newY < 0.7) newY = 0.8; // Force to lower region if it drifted up
                    return [val[0], newY];
                }
                return val;
            });
        } else {
            var pos = prop.getValue();
            if (pos && pos.length >= 2) {
                var newY = pos[1];
                if (newY < 0.7) newY = 0.8;
                prop.setValue([pos[0], newY], true);
            }
        }
    } catch (e) {}
}

/**
 * Preserve relative position for overlays (logos in corners stay in corners)
 */
function adjustPositionRelative(prop, scaleX, scaleY) {
    try {
        if (prop.isTimeVarying()) {
            walkKeyframes(prop, function (val) {
                if (val && val.length >= 2) {
                    // Keep the same normalized position (PPro uses 0-1 range)
                    // No adjustment needed for normalized coords
                    return val;
                }
                return val;
            });
        }
        // Static values in normalized coords don't need adjustment
    } catch (e) {}
}

/**
 * Adjust Anchor Point property
 */
function adjustAnchorPointProperty(prop, scaleX, scaleY) {
    try {
        if (prop.isTimeVarying()) {
            walkKeyframes(prop, function (val) {
                if (val && val.length >= 2) {
                    return [val[0] * scaleX, val[1] * scaleY];
                }
                return val;
            });
        } else {
            var val = prop.getValue();
            if (val && val.length >= 2) {
                prop.setValue([val[0] * scaleX, val[1] * scaleY], true);
            }
        }
    } catch (e) {}
}

/**
 * Adjust MOGRT / Essential Graphics text properties
 * MOGRTs have their own position/scale properties separate from Motion
 */
function adjustMOGRTProperties(clip, scaleX, scaleY, oldW, oldH, newW, newH, roleStrategy) {
    try {
        var mgComp = clip.getMGTComponent();
        if (!mgComp) return;

        for (var p = 0; p < mgComp.properties.numItems; p++) {
            var prop = mgComp.properties[p];
            var name = prop.displayName ? prop.displayName.toLowerCase() : '';

            // Adjust position-like properties in MOGRT
            if (name.indexOf('position') >= 0 || name.indexOf('location') >= 0 || name.indexOf('offset') >= 0) {
                try {
                    var val = prop.getValue();
                    if (val && typeof val === 'object' && val.length >= 2) {
                        if (roleStrategy.pinBottom) {
                            // Lower third MOGRT: keep X, pin Y to bottom region
                            var yVal = val[1];
                            // If position is in pixel space, remap to new frame
                            if (Math.abs(val[0]) > 1 || Math.abs(val[1]) > 1) {
                                prop.setValue([val[0] * scaleX, newH * 0.8], true);
                            } else {
                                // Normalized space
                                if (yVal < 0.7) yVal = 0.8;
                                prop.setValue([val[0], yVal], true);
                            }
                        } else {
                            // Standard position remap
                            if (Math.abs(val[0]) > 1 || Math.abs(val[1]) > 1) {
                                // Pixel-space position
                                prop.setValue([val[0] * scaleX, val[1] * scaleY], true);
                            }
                            // Normalized positions stay the same
                        }
                    }
                } catch (e) {}
            }

            // Adjust scale-like properties in MOGRT
            if (name.indexOf('scale') >= 0 || name.indexOf('size') >= 0) {
                try {
                    var sVal = prop.getValue();
                    if (typeof sVal === 'number' && sVal > 0) {
                        var mogrtScaleFactor = Math.min(scaleX, scaleY); // fit text within frame
                        prop.setValue(sVal * mogrtScaleFactor, true);
                    }
                } catch (e) {}
            }

            // Adjust font size if it seems pixel-based
            if (name.indexOf('font size') >= 0 || name === 'fontsize' || name === 'text size') {
                try {
                    var fontSize = prop.getValue();
                    if (typeof fontSize === 'number' && fontSize > 5) {
                        var fontScaleFactor = Math.min(scaleX, scaleY);
                        prop.setValue(Math.round(fontSize * fontScaleFactor), true);
                    }
                } catch (e) {}
            }
        }
    } catch (e) {
        // MOGRT adjustment failed - clip may not be a MOGRT
    }
}

/**
 * Adjust position-based effects: Crop, Drop Shadow, Gaussian Blur offset, etc.
 */
function adjustPositionBasedEffects(clip, scaleX, scaleY, oldW, oldH, newW, newH) {
    if (!clip || !clip.components) return;

    for (var i = 0; i < clip.components.numItems; i++) {
        var comp = clip.components[i];
        var compName = comp.displayName ? comp.displayName : '';

        // Adjust Crop effect
        if (compName === 'Crop') {
            adjustCropEffect(comp, scaleX, scaleY, oldW, oldH, newW, newH);
        }

        // Adjust Drop Shadow
        if (compName === 'Drop Shadow') {
            adjustDropShadowEffect(comp, scaleX, scaleY);
        }

        // Adjust any effect with Position/Offset properties
        if (compName !== 'Motion' && compName !== 'Opacity') {
            adjustGenericEffectPositions(comp, scaleX, scaleY);
        }
    }
}

/**
 * Adjust Crop effect percentages for new frame dimensions
 * Crop values are percentages (0-100) so aspect ratio changes need recalculation
 */
function adjustCropEffect(comp, scaleX, scaleY, oldW, oldH, newW, newH) {
    try {
        for (var p = 0; p < comp.properties.numItems; p++) {
            var prop = comp.properties[p];
            var name = prop.displayName;

            // Crop Left/Right are horizontal - adjust based on aspect ratio change
            if (name === 'Left' || name === 'Right') {
                var hVal = prop.getValue();
                if (typeof hVal === 'number' && hVal > 0) {
                    // Convert crop % to pixels in old frame, then back to % in new frame
                    var oldPixels = (hVal / 100) * oldW;
                    var newPercent = (oldPixels / newW) * 100;
                    prop.setValue(Math.min(newPercent, 100), true);
                }
            }

            // Crop Top/Bottom are vertical
            if (name === 'Top' || name === 'Bottom') {
                var vVal = prop.getValue();
                if (typeof vVal === 'number' && vVal > 0) {
                    var oldPixelsV = (vVal / 100) * oldH;
                    var newPercentV = (oldPixelsV / newH) * 100;
                    prop.setValue(Math.min(newPercentV, 100), true);
                }
            }
        }
    } catch (e) {}
}

/**
 * Adjust Drop Shadow distance/offset for new frame dimensions
 */
function adjustDropShadowEffect(comp, scaleX, scaleY) {
    try {
        for (var p = 0; p < comp.properties.numItems; p++) {
            var prop = comp.properties[p];
            var name = prop.displayName;

            if (name === 'Distance' || name === 'Softness') {
                var val = prop.getValue();
                if (typeof val === 'number') {
                    var avgScale = (scaleX + scaleY) / 2;
                    prop.setValue(val * avgScale, true);
                }
            }
        }
    } catch (e) {}
}

/**
 * Adjust position/offset properties in generic effects
 */
function adjustGenericEffectPositions(comp, scaleX, scaleY) {
    try {
        for (var p = 0; p < comp.properties.numItems; p++) {
            var prop = comp.properties[p];
            var name = prop.displayName ? prop.displayName.toLowerCase() : '';

            // Only adjust obvious position/offset properties
            if (name === 'center' || name === 'point of interest' || name === 'offset') {
                try {
                    var val = prop.getValue();
                    if (val && typeof val === 'object' && val.length >= 2) {
                        prop.setValue([val[0] * scaleX, val[1] * scaleY], true);
                    }
                } catch (e) {}
            }
        }
    } catch (e) {}
}

/**
 * Generic keyframe walker - iterates all keyframes and applies a transform function
 */
function walkKeyframes(prop, transformFn) {
    try {
        // Use getKeyframeCount / getKeyframeValue if available (PPro 14+)
        if (typeof prop.getKeyframeCount === 'function') {
            var count = prop.getKeyframeCount();
            for (var k = 0; k < count; k++) {
                try {
                    var val = prop.getKeyframeValue(k);
                    var newVal = transformFn(val);
                    if (newVal !== undefined) {
                        prop.setKeyframeValue(k, newVal);
                    }
                } catch (e2) {}
            }
            return;
        }

        // Fallback: iterate keyframes using findNearestKey
        // Get a starting time reference from the property's first keyframe
        var key = null;
        try {
            key = prop.findNearestKey(0, 0);
        } catch (e3) {
            try {
                // Some PPro versions need a Time object - try creating one
                var t = new Time();
                t.seconds = 0;
                key = prop.findNearestKey(t, 0);
            } catch (e4) {}
        }

        if (!key) return;

        var processedTimes = [];
        var maxIterations = 500;

        while (key && maxIterations > 0) {
            maxIterations--;
            var keyTimeStr = String(key.seconds || key);

            var alreadyDone = false;
            for (var i = 0; i < processedTimes.length; i++) {
                if (processedTimes[i] === keyTimeStr) { alreadyDone = true; break; }
            }
            if (alreadyDone) break;
            processedTimes.push(keyTimeStr);

            try {
                var val = prop.getValueAtKey(key);
                var newVal = transformFn(val);
                if (newVal !== undefined && newVal !== val) {
                    prop.setValueAtKey(key, newVal, true);
                }
            } catch (e5) {}

            // Find next keyframe
            var nextKey = null;
            try {
                var nextSec = (key.seconds || 0) + 0.001;
                nextKey = prop.findNearestKey(nextSec, 0);
                if (!nextKey) {
                    var nt = new Time();
                    nt.seconds = nextSec;
                    nextKey = prop.findNearestKey(nt, 0);
                }
            } catch (e6) {}

            if (!nextKey || (nextKey.seconds || 0) <= (key.seconds || 0)) break;
            key = nextKey;
        }
    } catch (e) {}
}

/**
 * Adjust motion (position, scale) on all video track clips (legacy compat)
 */
function adjustAllClipMotion(seq, oldW, oldH, newW, newH, fitMode) {
    adjustAllClipsSmartV2(seq, oldW, oldH, newW, newH, {
        fitMode: fitMode,
        smartRoles: true,
        adjustMOGRT: true,
        adjustEffects: true,
        trackRoles: []
    });
}

/**
 * Adjust a single clip's Motion component properties (legacy compat)
 */
function adjustSingleClipMotion(clip, scaleX, scaleY, scaleFactor) {
    adjustSingleClipMotionV2(clip, scaleX, scaleY, scaleFactor, {
        fitMode: 'fill', centerPin: false, pinBottom: false
    });
}

/**
 * Adjust Position property - remap X/Y proportionally to new frame
 */
function adjustPositionProperty(prop, scaleX, scaleY) {
    try {
        if (prop.isTimeVarying()) {
            walkKeyframes(prop, function (val) {
                if (val && val.length >= 2) {
                    return [val[0] * scaleX, val[1] * scaleY];
                }
                return val;
            });
        } else {
            var pos = prop.getValue();
            if (pos && pos.length >= 2) {
                prop.setValue([pos[0] * scaleX, pos[1] * scaleY], true);
            }
        }
    } catch (e) {}
}

/**
 * Adjust Scale property - multiply by fill/fit factor
 */
function adjustScaleProperty(prop, scaleFactor) {
    try {
        if (prop.isTimeVarying()) {
            walkKeyframes(prop, function (val) {
                return val * scaleFactor;
            });
        } else {
            var scale = prop.getValue();
            prop.setValue(scale * scaleFactor, true);
        }
    } catch (e) {}
}

// ============================================================
// BIN COMPARISON / LEARNING SYSTEM
// Snapshots clip properties from two bins and returns differences
// so the user can teach the AI what manual edits look like
// ============================================================

/**
 * Snapshot all clip properties from a sequence (for bin comparison)
 * Returns detailed property map per track per clip
 */
function snapshotSequenceProperties(seqName) {
    try {
        var proj = getProject();
        if (!proj) return errorResult('No project open');

        // Find sequence by name
        var seq = null;
        for (var i = 0; i < proj.sequences.numSequences; i++) {
            if (proj.sequences[i].name === seqName) {
                seq = proj.sequences[i];
                break;
            }
        }
        if (!seq) return errorResult('Sequence not found: ' + seqName);

        var snapshot = {
            name: seq.name,
            width: parseInt(seq.frameSizeHorizontal),
            height: parseInt(seq.frameSizeVertical),
            tracks: []
        };

        for (var t = 0; t < seq.videoTracks.numTracks; t++) {
            var track = seq.videoTracks[t];
            var trackData = {
                index: t,
                name: track.name || ('V' + (t + 1)),
                clips: []
            };

            for (var c = 0; c < track.clips.numItems; c++) {
                var clip = track.clips[c];
                var clipData = {
                    index: c,
                    name: clip.name,
                    startTime: clip.start ? clip.start.seconds : 0,
                    endTime: clip.end ? clip.end.seconds : 0,
                    motion: {},
                    mogrt: {},
                    effects: []
                };

                // Capture Motion properties
                for (var ci = 0; ci < clip.components.numItems; ci++) {
                    var comp = clip.components[ci];

                    if (comp.displayName === 'Motion') {
                        for (var p = 0; p < comp.properties.numItems; p++) {
                            var prop = comp.properties[p];
                            try {
                                clipData.motion[prop.displayName] = {
                                    value: prop.getValue(),
                                    keyframed: prop.isTimeVarying()
                                };
                            } catch (e) {}
                        }
                    } else if (comp.displayName !== 'Opacity') {
                        // Capture effect properties
                        var effectData = { name: comp.displayName, props: {} };
                        for (var ep = 0; ep < comp.properties.numItems; ep++) {
                            try {
                                effectData.props[comp.properties[ep].displayName] = comp.properties[ep].getValue();
                            } catch (e) {}
                        }
                        clipData.effects.push(effectData);
                    }
                }

                // Capture MOGRT properties
                try {
                    var mgComp = clip.getMGTComponent();
                    if (mgComp) {
                        for (var mp = 0; mp < mgComp.properties.numItems; mp++) {
                            try {
                                clipData.mogrt[mgComp.properties[mp].displayName] = mgComp.properties[mp].getValue();
                            } catch (e) {}
                        }
                    }
                } catch (e) {}

                trackData.clips.push(clipData);
            }

            snapshot.tracks.push(trackData);
        }

        return safeResult(snapshot);
    } catch (e) {
        return errorResult(e.toString());
    }
}

/**
 * Compare two sequence snapshots and return differences
 * Used to learn what manual edits the user made vs what AI produced
 */
function compareSequenceSnapshots(seqName1, seqName2) {
    try {
        var snap1Result = safeParse(snapshotSequenceProperties(seqName1));
        var snap2Result = safeParse(snapshotSequenceProperties(seqName2));

        if (!snap1Result.success || !snap2Result.success) {
            return errorResult('Could not snapshot both sequences');
        }

        var snap1 = snap1Result.data;
        var snap2 = snap2Result.data;

        var diffs = {
            seq1: seqName1,
            seq2: seqName2,
            frameSizeDiff: (snap1.width !== snap2.width || snap1.height !== snap2.height),
            trackDiffs: []
        };

        var maxTracks = Math.max(snap1.tracks.length, snap2.tracks.length);
        for (var t = 0; t < maxTracks; t++) {
            var t1 = snap1.tracks[t];
            var t2 = snap2.tracks[t];

            if (!t1 || !t2) {
                diffs.trackDiffs.push({
                    track: t,
                    diff: 'track_missing',
                    in: t1 ? seqName1 : seqName2
                });
                continue;
            }

            var maxClips = Math.max(t1.clips.length, t2.clips.length);
            for (var c = 0; c < maxClips; c++) {
                var c1 = t1.clips[c];
                var c2 = t2.clips[c];

                if (!c1 || !c2) {
                    diffs.trackDiffs.push({
                        track: t,
                        clip: c,
                        diff: 'clip_missing',
                        in: c1 ? seqName1 : seqName2
                    });
                    continue;
                }

                // Compare Motion properties
                for (var key in c1.motion) {
                    if (c2.motion[key]) {
                        var v1 = jsonStringify(c1.motion[key].value);
                        var v2 = jsonStringify(c2.motion[key].value);
                        if (v1 !== v2) {
                            diffs.trackDiffs.push({
                                track: t,
                                clip: c,
                                clipName: c1.name,
                                property: 'Motion.' + key,
                                seq1Value: c1.motion[key].value,
                                seq2Value: c2.motion[key].value
                            });
                        }
                    }
                }

                // Compare MOGRT properties
                for (var mkey in c1.mogrt) {
                    if (c2.mogrt[mkey]) {
                        var mv1 = jsonStringify(c1.mogrt[mkey]);
                        var mv2 = jsonStringify(c2.mogrt[mkey]);
                        if (mv1 !== mv2) {
                            diffs.trackDiffs.push({
                                track: t,
                                clip: c,
                                clipName: c1.name,
                                property: 'MOGRT.' + mkey,
                                seq1Value: c1.mogrt[mkey],
                                seq2Value: c2.mogrt[mkey]
                            });
                        }
                    }
                }
            }
        }

        diffs.totalDifferences = diffs.trackDiffs.length;
        return safeResult(diffs);
    } catch (e) {
        return errorResult(e.toString());
    }
}

/**
 * Find or create a bin by name at the project root level
 */
function findOrCreateBinByName(proj, binName) {
    // Search root items for existing bin
    for (var i = 0; i < proj.rootItem.children.numItems; i++) {
        var item = proj.rootItem.children[i];
        if (item.name === binName && item.type === 2) {
            return item;
        }
    }
    // Create new bin
    return proj.rootItem.createBin(binName);
}

/**
 * Find or create a sub-bin within a parent bin
 */
function findOrCreateSubBin(parentBin, subBinName) {
    for (var i = 0; i < parentBin.children.numItems; i++) {
        var item = parentBin.children[i];
        if (item.name === subBinName && item.type === 2) {
            return item;
        }
    }
    return parentBin.createBin(subBinName);
}

/**
 * Find a project item (sequence) by name at root level
 */
function findRootItemByName(proj, name) {
    for (var i = 0; i < proj.rootItem.children.numItems; i++) {
        if (proj.rootItem.children[i].name === name) {
            return proj.rootItem.children[i];
        }
    }
    return null;
}

/**
 * Organize the main sequence and its versions into a bin folder.
 * Creates "All Render / PromoName /" structure.
 */
function organizeVersionsIntoBin(proj, mainName, mainID, versions, binName, createSubBin) {
    var parentBin = findOrCreateBinByName(proj, binName);

    var targetBin = parentBin;
    if (createSubBin) {
        targetBin = findOrCreateSubBin(parentBin, mainName);
    }

    // Move main sequence
    var mainItem = findRootItemByName(proj, mainName);
    if (mainItem) {
        try { mainItem.moveBin(targetBin); } catch (e) {}
    }

    // Move version sequences
    for (var i = 0; i < versions.length; i++) {
        var verItem = findRootItemByName(proj, versions[i].name);
        if (verItem) {
            try { verItem.moveBin(targetBin); } catch (e) {}
        }
    }

    return {
        bin: binName,
        subBin: createSubBin ? mainName : null,
        movedCount: versions.length + 1
    };
}

/**
 * Get active sequence info for the Version Creator UI
 */
function getActiveSequenceInfo() {
    try {
        var proj = getProject();
        if (!proj) return errorResult('No project open');

        var seq = proj.activeSequence;
        if (!seq) return errorResult('No active sequence');

        return safeResult({
            name: seq.name,
            width: parseInt(seq.frameSizeHorizontal),
            height: parseInt(seq.frameSizeVertical),
            duration: seq.end ? (parseFloat(seq.end) - parseFloat(seq.zeroPoint)) : 0,
            videoTrackCount: seq.videoTracks.numTracks,
            audioTrackCount: seq.audioTracks.numTracks,
            id: seq.sequenceID
        });
    } catch (e) {
        return errorResult(e.toString());
    }
}

/**
 * Scan the "All Render" bin (or any bin) and return its contents
 */
function scanBinContents(binName) {
    try {
        var proj = getProject();
        if (!proj) return errorResult('No project open');

        var targetBin = null;
        for (var i = 0; i < proj.rootItem.children.numItems; i++) {
            var item = proj.rootItem.children[i];
            if (item.name === binName && item.type === 2) {
                targetBin = item;
                break;
            }
        }

        if (!targetBin) return safeResult({ exists: false, items: [] });

        var items = [];
        scanBinRecursive(targetBin, '', items);

        return safeResult({ exists: true, name: binName, items: items });
    } catch (e) {
        return errorResult(e.toString());
    }
}

/**
 * Recursively scan bin contents
 */
function scanBinRecursive(bin, path, items) {
    for (var i = 0; i < bin.children.numItems; i++) {
        var item = bin.children[i];
        var itemPath = path ? (path + '/' + item.name) : item.name;

        items.push({
            name: item.name,
            path: itemPath,
            type: item.type, // 1=clip/seq, 2=bin
            isBin: item.type === 2,
            childCount: item.type === 2 ? item.children.numItems : 0
        });

        if (item.type === 2) {
            scanBinRecursive(item, itemPath, items);
        }
    }
}


/**
 * Get metadata for a project item
 */
function getAssetMetadata(itemIndex) {
    try {
        var proj = getProject();
        var item = proj.rootItem.children[itemIndex];
        if (!item) return errorResult('Item not found');

        var metadata = {};
        try { metadata.xmp = item.getXMPMetadata(); } catch (e) {}
        try { metadata.projectMeta = item.getProjectMetadata(); } catch (e) {}
        try { metadata.mediaPath = item.getMediaPath(); } catch (e) {}

        metadata.name = item.name;
        metadata.type = item.type;

        return safeResult(metadata);
    } catch (e) {
        return errorResult(e.toString());
    }
}

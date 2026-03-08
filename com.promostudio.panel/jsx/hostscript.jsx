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
// 7. VERSION CREATOR - One-Click Multi-Version Automation
// ============================================================

/**
 * Create multiple size versions from the active sequence.
 * Clones the sequence for each version, adjusts frame size,
 * auto-adjusts clip motion (scale/position), and organizes into a bin.
 *
 * configJSON = {
 *   versions: [ { suffix: '1080x1080', width: 1080, height: 1080 }, ... ],
 *   binName: 'All Render',
 *   createSubBin: true,
 *   autoAdjust: true,
 *   fitMode: 'fill'  // 'fill' | 'fit' | 'none'
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

        var createdVersions = [];

        for (var v = 0; v < versions.length; v++) {
            var ver = versions[v];
            var newW = parseInt(ver.width);
            var newH = parseInt(ver.height);

            // Switch back to the main sequence before each clone
            proj.openSequence(mainID);

            // Clone the active (main) sequence
            proj.activeSequence.clone();

            // The clone is now active
            var clone = proj.activeSequence;
            clone.name = mainName + '_' + ver.suffix;

            // Change frame size
            var settings = clone.getSettings();
            if (settings) {
                settings.videoFrameWidth = newW;
                settings.videoFrameHeight = newH;
                clone.setSettings(settings);
            }

            // Auto-adjust clip motion properties (position, scale)
            if (config.autoAdjust !== false) {
                var fitMode = config.fitMode || 'fill';
                adjustAllClipMotion(clone, oldWidth, oldHeight, newW, newH, fitMode);
            }

            createdVersions.push({
                name: clone.name,
                id: clone.sequenceID,
                width: newW,
                height: newH
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
            bin: binResult
        });
    } catch (e) {
        return errorResult(e.toString());
    }
}

/**
 * Adjust motion (position, scale) on all video track clips
 * when sequence frame size changes.
 */
function adjustAllClipMotion(seq, oldW, oldH, newW, newH, fitMode) {
    var scaleX = newW / oldW;
    var scaleY = newH / oldH;

    // fill = cover the frame (no black bars), fit = show everything (may have bars)
    var scaleFactor;
    if (fitMode === 'fill') {
        scaleFactor = Math.max(scaleX, scaleY);
    } else if (fitMode === 'fit') {
        scaleFactor = Math.min(scaleX, scaleY);
    } else {
        scaleFactor = 1; // none - don't adjust scale
    }

    for (var t = 0; t < seq.videoTracks.numTracks; t++) {
        var track = seq.videoTracks[t];
        for (var c = 0; c < track.clips.numItems; c++) {
            try {
                adjustSingleClipMotion(track.clips[c], scaleX, scaleY, scaleFactor);
            } catch (e) {
                // Skip clips that can't be adjusted (e.g., adjustment layers)
            }
        }
    }
}

/**
 * Adjust a single clip's Motion component properties.
 * Handles both static values and keyframed properties.
 */
function adjustSingleClipMotion(clip, scaleX, scaleY, scaleFactor) {
    if (!clip || !clip.components) return;

    for (var i = 0; i < clip.components.numItems; i++) {
        var comp = clip.components[i];
        if (comp.displayName !== 'Motion') continue;

        for (var p = 0; p < comp.properties.numItems; p++) {
            var prop = comp.properties[p];

            if (prop.displayName === 'Position') {
                adjustPositionProperty(prop, scaleX, scaleY);
            }

            if (prop.displayName === 'Scale') {
                adjustScaleProperty(prop, scaleFactor);
            }
        }
        break; // Only one Motion component per clip
    }
}

/**
 * Adjust Position property - remap X/Y proportionally to new frame
 */
function adjustPositionProperty(prop, scaleX, scaleY) {
    try {
        if (prop.isTimeVarying()) {
            // Keyframed position - adjust each keyframe
            adjustKeyframedPosition(prop, scaleX, scaleY);
        } else {
            var pos = prop.getValue();
            if (pos && pos.length >= 2) {
                prop.setValue([pos[0] * scaleX, pos[1] * scaleY], true);
            }
        }
    } catch (e) {
        // Silently skip if property can't be adjusted
    }
}

/**
 * Adjust Scale property - multiply by fill/fit factor
 */
function adjustScaleProperty(prop, scaleFactor) {
    try {
        if (prop.isTimeVarying()) {
            adjustKeyframedScale(prop, scaleFactor);
        } else {
            var scale = prop.getValue();
            prop.setValue(scale * scaleFactor, true);
        }
    } catch (e) {
        // Silently skip
    }
}

/**
 * Adjust keyframed Position values.
 * Iterates through the sequence timeline and adjusts keyframe values.
 */
function adjustKeyframedPosition(prop, scaleX, scaleY) {
    try {
        // Use findNearestKey to walk through keyframes
        // Start from time 0, find nearest key, adjust, move forward
        var startTime = new Time();
        startTime.seconds = 0;

        // Get the first key
        var key = prop.findNearestKey(startTime, 0);
        var processedTimes = [];
        var maxIterations = 500; // Safety limit

        while (key && maxIterations > 0) {
            maxIterations--;
            var keyTimeStr = key.seconds.toString();

            // Avoid processing same key twice
            var alreadyDone = false;
            for (var i = 0; i < processedTimes.length; i++) {
                if (processedTimes[i] === keyTimeStr) { alreadyDone = true; break; }
            }
            if (alreadyDone) break;
            processedTimes.push(keyTimeStr);

            var val = prop.getValueAtKey(key);
            if (val && val.length >= 2) {
                prop.setValueAtKey(key, [val[0] * scaleX, val[1] * scaleY], true);
            }

            // Move slightly past current key to find next
            var nextTime = new Time();
            nextTime.seconds = key.seconds + 0.001;
            var nextKey = prop.findNearestKey(nextTime, 0);

            // If we got the same key back, we're done
            if (!nextKey || nextKey.seconds <= key.seconds) break;
            key = nextKey;
        }
    } catch (e) {
        // Keyframe adjustment failed - user can adjust manually
    }
}

/**
 * Adjust keyframed Scale values.
 */
function adjustKeyframedScale(prop, scaleFactor) {
    try {
        var startTime = new Time();
        startTime.seconds = 0;

        var key = prop.findNearestKey(startTime, 0);
        var processedTimes = [];
        var maxIterations = 500;

        while (key && maxIterations > 0) {
            maxIterations--;
            var keyTimeStr = key.seconds.toString();

            var alreadyDone = false;
            for (var i = 0; i < processedTimes.length; i++) {
                if (processedTimes[i] === keyTimeStr) { alreadyDone = true; break; }
            }
            if (alreadyDone) break;
            processedTimes.push(keyTimeStr);

            var val = prop.getValueAtKey(key);
            prop.setValueAtKey(key, val * scaleFactor, true);

            var nextTime = new Time();
            nextTime.seconds = key.seconds + 0.001;
            var nextKey = prop.findNearestKey(nextTime, 0);

            if (!nextKey || nextKey.seconds <= key.seconds) break;
            key = nextKey;
        }
    } catch (e) {
        // Keyframe adjustment failed
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

/**
 * Preset Manager - AME Export Preset Configuration
 * Manages export presets for Adobe Media Encoder.
 *
 * Note: Actual .epr preset files must be created in Adobe Media Encoder.
 * This module manages the configuration and paths to those presets,
 * and provides a built-in fallback system using sequence match export.
 */

var PresetManager = (function () {
    'use strict';

    var STORAGE_KEY = 'amePresets';

    /**
     * Platform preset configurations
     * presetPath: path to .epr file (user must generate in AME)
     * fallback: if no preset, use sequence-match export with these settings
     */
    var PLATFORM_CONFIGS = {
        'instagram-post': {
            name: 'Instagram Post',
            width: 1080, height: 1080,
            fps: 30,
            codec: 'H.264',
            bitrate: '8',
            bitrateUnit: 'Mbps',
            audioCodec: 'AAC',
            audioBitrate: '192',
            audioSampleRate: '48000',
            maxFileSize: '250 MB',
            maxDuration: 60,
            fileExtension: '.mp4',
            presetName: 'PromoStudio_Instagram_Post'
        },
        'instagram-story': {
            name: 'Instagram Story/Reel',
            width: 1080, height: 1920,
            fps: 30,
            codec: 'H.264',
            bitrate: '10',
            bitrateUnit: 'Mbps',
            audioCodec: 'AAC',
            audioBitrate: '192',
            audioSampleRate: '48000',
            maxFileSize: '250 MB',
            maxDuration: 90,
            fileExtension: '.mp4',
            presetName: 'PromoStudio_Instagram_Story'
        },
        'facebook-feed': {
            name: 'Facebook Feed',
            width: 1200, height: 630,
            fps: 30,
            codec: 'H.264',
            bitrate: '8',
            bitrateUnit: 'Mbps',
            audioCodec: 'AAC',
            audioBitrate: '128',
            audioSampleRate: '48000',
            maxFileSize: '4 GB',
            maxDuration: 240,
            fileExtension: '.mp4',
            presetName: 'PromoStudio_Facebook_Feed'
        },
        'facebook-story': {
            name: 'Facebook Story',
            width: 1080, height: 1920,
            fps: 30,
            codec: 'H.264',
            bitrate: '8',
            bitrateUnit: 'Mbps',
            audioCodec: 'AAC',
            audioBitrate: '128',
            audioSampleRate: '48000',
            maxFileSize: '4 GB',
            maxDuration: 20,
            fileExtension: '.mp4',
            presetName: 'PromoStudio_Facebook_Story'
        },
        'youtube-standard': {
            name: 'YouTube 1080p',
            width: 1920, height: 1080,
            fps: 30,
            codec: 'H.264',
            bitrate: '16',
            bitrateUnit: 'Mbps',
            audioCodec: 'AAC',
            audioBitrate: '320',
            audioSampleRate: '48000',
            maxFileSize: '128 GB',
            maxDuration: null,
            fileExtension: '.mp4',
            presetName: 'PromoStudio_YouTube_1080p'
        },
        'youtube-shorts': {
            name: 'YouTube Shorts',
            width: 1080, height: 1920,
            fps: 30,
            codec: 'H.264',
            bitrate: '12',
            bitrateUnit: 'Mbps',
            audioCodec: 'AAC',
            audioBitrate: '256',
            audioSampleRate: '48000',
            maxFileSize: '128 GB',
            maxDuration: 60,
            fileExtension: '.mp4',
            presetName: 'PromoStudio_YouTube_Shorts'
        },
        'twitter-video': {
            name: 'Twitter/X Video',
            width: 1920, height: 1080,
            fps: 30,
            codec: 'H.264',
            bitrate: '6',
            bitrateUnit: 'Mbps',
            audioCodec: 'AAC',
            audioBitrate: '128',
            audioSampleRate: '48000',
            maxFileSize: '512 MB',
            maxDuration: 140,
            fileExtension: '.mp4',
            presetName: 'PromoStudio_Twitter'
        },
        'linkedin-video': {
            name: 'LinkedIn Video',
            width: 1920, height: 1080,
            fps: 30,
            codec: 'H.264',
            bitrate: '10',
            bitrateUnit: 'Mbps',
            audioCodec: 'AAC',
            audioBitrate: '192',
            audioSampleRate: '48000',
            maxFileSize: '5 GB',
            maxDuration: 600,
            fileExtension: '.mp4',
            presetName: 'PromoStudio_LinkedIn'
        },
        'whatsapp-status': {
            name: 'WhatsApp Status',
            width: 1080, height: 1920,
            fps: 30,
            codec: 'H.264',
            bitrate: '3',
            bitrateUnit: 'Mbps',
            audioCodec: 'AAC',
            audioBitrate: '96',
            audioSampleRate: '44100',
            maxFileSize: '16 MB',
            maxDuration: 30,
            fileExtension: '.mp4',
            presetName: 'PromoStudio_WhatsApp'
        },
        'tiktok': {
            name: 'TikTok',
            width: 1080, height: 1920,
            fps: 30,
            codec: 'H.264',
            bitrate: '10',
            bitrateUnit: 'Mbps',
            audioCodec: 'AAC',
            audioBitrate: '192',
            audioSampleRate: '44100',
            maxFileSize: '287 MB',
            maxDuration: 180,
            fileExtension: '.mp4',
            presetName: 'PromoStudio_TikTok'
        }
    };

    /**
     * Get all platform configs
     */
    function getPlatformConfigs() {
        return PLATFORM_CONFIGS;
    }

    /**
     * Get config for a specific platform
     */
    function getConfig(platformId) {
        return PLATFORM_CONFIGS[platformId] || null;
    }

    /**
     * Get user-saved preset file path for a platform
     */
    function getPresetPath(platformId) {
        var saved = Storage.get(STORAGE_KEY, {});
        return saved[platformId] || '';
    }

    /**
     * Save a preset file path for a platform
     */
    function setPresetPath(platformId, path) {
        var saved = Storage.get(STORAGE_KEY, {});
        saved[platformId] = path;
        Storage.set(STORAGE_KEY, saved);
    }

    /**
     * Get all saved preset paths
     */
    function getAllPresetPaths() {
        return Storage.get(STORAGE_KEY, {});
    }

    /**
     * Check which platforms have presets configured
     */
    function getPresetsStatus() {
        var saved = Storage.get(STORAGE_KEY, {});
        var status = {};
        for (var id in PLATFORM_CONFIGS) {
            status[id] = {
                name: PLATFORM_CONFIGS[id].name,
                hasPreset: !!saved[id],
                presetPath: saved[id] || '',
                willUseMatch: !saved[id]
            };
        }
        return status;
    }

    /**
     * Auto-detect AME presets in common locations
     */
    function autoDetectPresets(callback) {
        var script = '';
        script += 'var presetDirs = [];';
        script += 'try {';
        // Windows default AME preset locations
        script += '  var winPath = Folder(Folder.appData.fsName + "/Adobe/Adobe Media Encoder");';
        script += '  if (winPath.exists) presetDirs.push(winPath.fsName);';
        // Mac default
        script += '  var macPath = Folder("~/Library/Application Support/Adobe/Adobe Media Encoder");';
        script += '  if (macPath.exists) presetDirs.push(macPath.fsName);';
        script += '} catch(e) {}';
        script += 'JSON.stringify(presetDirs);';

        csInterface.evalScript(script, function (result) {
            try {
                var dirs = JSON.parse(result);
                callback({ success: true, directories: dirs });
            } catch (e) {
                callback({ success: false, directories: [] });
            }
        });
    }

    /**
     * Generate a guide for creating presets manually in AME
     */
    function getPresetGuide(platformId) {
        var config = PLATFORM_CONFIGS[platformId];
        if (!config) return 'Unknown platform';

        return 'AME Preset Guide for ' + config.name + ':\n' +
            '1. Open Adobe Media Encoder\n' +
            '2. Go to Presets > Create Encoding Preset\n' +
            '3. Format: H.264\n' +
            '4. Video Settings:\n' +
            '   - Width: ' + config.width + '\n' +
            '   - Height: ' + config.height + '\n' +
            '   - Frame Rate: ' + config.fps + ' fps\n' +
            '   - Target Bitrate: ' + config.bitrate + ' ' + config.bitrateUnit + '\n' +
            '5. Audio Settings:\n' +
            '   - Codec: ' + config.audioCodec + '\n' +
            '   - Bitrate: ' + config.audioBitrate + ' kbps\n' +
            '   - Sample Rate: ' + config.audioSampleRate + ' Hz\n' +
            '6. Save preset as: ' + config.presetName + '\n' +
            '7. Export as .epr file from Presets panel\n' +
            '8. Set the path in Promo Studio export settings\n\n' +
            'Limits: ' + (config.maxDuration ? 'Max ' + config.maxDuration + 's' : 'No duration limit') +
            ', Max ' + config.maxFileSize;
    }

    /**
     * Build an export job config for a platform
     */
    function buildExportJob(platformId, outputDir, sequenceName) {
        var config = PLATFORM_CONFIGS[platformId];
        if (!config) return null;

        var presetPath = getPresetPath(platformId);
        var timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        var filename = (sequenceName || 'promo').replace(/[^a-zA-Z0-9_-]/g, '_');
        var outputFile = filename + '_' + platformId + '_' + timestamp + config.fileExtension;

        var separator = outputDir.indexOf('/') >= 0 ? '/' : '\\';
        var outputPath = outputDir.replace(/[\/\\]$/, '') + separator + outputFile;

        return {
            label: config.name,
            outputPath: outputPath,
            presetPath: presetPath,
            width: config.width,
            height: config.height,
            platform: platformId
        };
    }

    return {
        getPlatformConfigs: getPlatformConfigs,
        getConfig: getConfig,
        getPresetPath: getPresetPath,
        setPresetPath: setPresetPath,
        getAllPresetPaths: getAllPresetPaths,
        getPresetsStatus: getPresetsStatus,
        autoDetectPresets: autoDetectPresets,
        getPresetGuide: getPresetGuide,
        buildExportJob: buildExportJob
    };

})();

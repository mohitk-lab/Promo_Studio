/**
 * MOGRT Loader - Manages Motion Graphics Templates for Promo Studio
 *
 * MOGRTs are binary files created in After Effects - they cannot be
 * generated programmatically. This module manages discovery, loading,
 * and cataloging of user's MOGRT files.
 */

var MOGRTLoader = (function () {
    'use strict';

    var STORAGE_KEY = 'mogrtLibrary';
    var _fs, _path;

    try {
        _fs = require('fs');
        _path = require('path');
    } catch (e) {
        console.warn('[MOGRTLoader] Node.js not available');
    }

    /**
     * MOGRT catalog entry:
     * {
     *   id: string,
     *   name: string,
     *   path: string,
     *   category: string,
     *   tags: string[],
     *   addedAt: string,
     *   lastUsed: string|null
     * }
     */

    function getCatalog() {
        return Storage.get(STORAGE_KEY, []);
    }

    function saveCatalog(catalog) {
        Storage.set(STORAGE_KEY, catalog);
    }

    /**
     * Add a MOGRT file to the catalog
     */
    function addMOGRT(filePath, name, category, tags) {
        var catalog = getCatalog();

        // Check for duplicate
        for (var i = 0; i < catalog.length; i++) {
            if (catalog[i].path === filePath) {
                showNotification('MOGRT already in library: ' + catalog[i].name, 'info');
                return catalog[i];
            }
        }

        var entry = {
            id: 'mogrt_' + Date.now(),
            name: name || (typeof FilePicker !== 'undefined' ? FilePicker.getFileName(filePath) : filePath.replace(/^.*[\\\/]/, '')),
            path: filePath,
            category: category || 'Uncategorized',
            tags: tags || [],
            addedAt: new Date().toISOString(),
            lastUsed: null
        };

        catalog.push(entry);
        saveCatalog(catalog);
        return entry;
    }

    /**
     * Remove a MOGRT from catalog
     */
    function removeMOGRT(mogrtId) {
        var catalog = getCatalog();
        catalog = catalog.filter(function (m) { return m.id !== mogrtId; });
        saveCatalog(catalog);
    }

    /**
     * Search MOGRTs by name or tag
     */
    function search(query) {
        var catalog = getCatalog();
        var q = query.toLowerCase();
        return catalog.filter(function (m) {
            if (m.name.toLowerCase().indexOf(q) >= 0) return true;
            if (m.category.toLowerCase().indexOf(q) >= 0) return true;
            for (var i = 0; i < m.tags.length; i++) {
                if (m.tags[i].toLowerCase().indexOf(q) >= 0) return true;
            }
            return false;
        });
    }

    /**
     * Get MOGRTs by category
     */
    function getByCategory(category) {
        var catalog = getCatalog();
        return catalog.filter(function (m) { return m.category === category; });
    }

    /**
     * Get all categories
     */
    function getCategories() {
        var catalog = getCatalog();
        var cats = {};
        for (var i = 0; i < catalog.length; i++) {
            cats[catalog[i].category] = (cats[catalog[i].category] || 0) + 1;
        }
        return cats;
    }

    /**
     * Apply a MOGRT to the active sequence
     */
    function applyToSequence(mogrtId, trackIndex, startTime) {
        var catalog = getCatalog();
        var mogrt = null;
        for (var i = 0; i < catalog.length; i++) {
            if (catalog[i].id === mogrtId) { mogrt = catalog[i]; break; }
        }

        if (!mogrt) return Promise.reject('MOGRT not found');

        // Validate file exists
        if (typeof FilePicker !== 'undefined' && !FilePicker.fileExists(mogrt.path)) {
            return Promise.reject('MOGRT file not found: ' + mogrt.path);
        }

        // Update last used
        mogrt.lastUsed = new Date().toISOString();
        saveCatalog(catalog);

        return PPro.callMultiAsync('applyMOGRT', [mogrt.path, trackIndex || 1, startTime || 0, 5]);
    }

    /**
     * Scan a folder for MOGRT files
     */
    function scanFolder(folderPath, callback) {
        if (!_fs || !_path) {
            // Fallback: use ExtendScript
            var script = 'var f = new Folder("' + folderPath.replace(/\\/g, '/') + '");' +
                'var files = f.getFiles("*.mogrt");' +
                'var result = [];' +
                'for (var i = 0; i < files.length; i++) result.push(files[i].fsName);' +
                'JSON.stringify(result);';

            csInterface.evalScript(script, function (result) {
                try {
                    callback(JSON.parse(result));
                } catch (e) {
                    callback([]);
                }
            });
            return;
        }

        try {
            var files = _fs.readdirSync(folderPath);
            var mogrts = [];
            for (var i = 0; i < files.length; i++) {
                if (_path.extname(files[i]).toLowerCase() === '.mogrt') {
                    mogrts.push(_path.join(folderPath, files[i]));
                }
            }
            callback(mogrts);
        } catch (e) {
            console.error('[MOGRTLoader] scanFolder error:', e);
            callback([]);
        }
    }

    /**
     * Scan a folder and auto-add all MOGRTs to catalog
     */
    function importFromFolder(folderPath, category, callback) {
        scanFolder(folderPath, function (files) {
            var added = 0;
            for (var i = 0; i < files.length; i++) {
                addMOGRT(files[i], null, category || 'Imported');
                added++;
            }
            callback({ added: added, total: files.length });
        });
    }

    /**
     * Get common MOGRT locations
     */
    function getCommonLocations() {
        var locations = [];

        // Common Windows paths
        locations.push({
            label: 'Essential Graphics (User)',
            path: '%APPDATA%\\Adobe\\Common\\Essential Graphics'
        });
        locations.push({
            label: 'After Effects Templates',
            path: '%USERPROFILE%\\Documents\\Adobe\\After Effects\\User Presets'
        });

        // Common Mac paths
        locations.push({
            label: 'Essential Graphics (Mac)',
            path: '~/Library/Application Support/Adobe/Common/Essential Graphics'
        });

        return locations;
    }

    return {
        getCatalog: getCatalog,
        addMOGRT: addMOGRT,
        removeMOGRT: removeMOGRT,
        search: search,
        getByCategory: getByCategory,
        getCategories: getCategories,
        applyToSequence: applyToSequence,
        scanFolder: scanFolder,
        importFromFolder: importFromFolder,
        getCommonLocations: getCommonLocations
    };

})();

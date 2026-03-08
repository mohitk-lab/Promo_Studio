/**
 * Module 9: Asset Library & Media Manager
 * Central media repository with search, tagging, and organization.
 */

var AssetLibrary = (function () {

    var STORAGE_KEY = 'assetTags';

    /**
     * Get tags for assets (stored locally)
     */
    function getAssetTags() {
        return Storage.get(STORAGE_KEY, {});
    }

    /**
     * Save tag for an asset
     */
    function tagAsset(assetName, tags) {
        var allTags = getAssetTags();
        if (!allTags[assetName]) allTags[assetName] = [];

        if (typeof tags === 'string') tags = [tags];
        for (var i = 0; i < tags.length; i++) {
            if (allTags[assetName].indexOf(tags[i]) === -1) {
                allTags[assetName].push(tags[i]);
            }
        }
        Storage.set(STORAGE_KEY, allTags);
    }

    /**
     * Remove tag from asset
     */
    function removeTag(assetName, tag) {
        var allTags = getAssetTags();
        if (allTags[assetName]) {
            allTags[assetName] = allTags[assetName].filter(function (t) { return t !== tag; });
            Storage.set(STORAGE_KEY, allTags);
        }
    }

    /**
     * Get all unique tags
     */
    function getAllTags() {
        var allTags = getAssetTags();
        var unique = {};
        for (var asset in allTags) {
            for (var i = 0; i < allTags[asset].length; i++) {
                unique[allTags[asset][i]] = (unique[allTags[asset][i]] || 0) + 1;
            }
        }
        return unique;
    }

    /**
     * Search assets by tag
     */
    function searchByTag(tag) {
        var allTags = getAssetTags();
        var results = [];
        for (var asset in allTags) {
            if (allTags[asset].indexOf(tag) >= 0) {
                results.push(asset);
            }
        }
        return results;
    }

    /**
     * Fetch full asset library from Premiere Pro project
     */
    function fetchFromProject() {
        return PPro.callAsync('getAssetLibrary');
    }

    /**
     * Search assets in Premiere Pro project by name
     */
    function searchInProject(query) {
        return PPro.callAsync('searchAssets', query);
    }

    /**
     * Create organized bin structure in project
     */
    function createBins(binNames) {
        return PPro.callAsync('createBinStructure', binNames);
    }

    /**
     * Move asset to bin in project
     */
    function moveAsset(itemIndex, binName) {
        return PPro.callMultiAsync('moveItemToBin', [itemIndex, binName]);
    }

    /**
     * Import new media into project
     */
    function importMedia(filePaths) {
        return PPro.callAsync('importMediaFiles', filePaths);
    }

    /**
     * Quick-organize: create standard bins and prompt user
     */
    function quickOrganize() {
        var standardBins = [
            'Footage',
            'Graphics',
            'Audio',
            'Logos',
            'Exports',
            'Templates',
            'Brand Kit'
        ];
        return createBins(standardBins);
    }

    /**
     * Render asset library UI
     */
    function renderUI(container) {
        var localTags = getAssetTags();
        var allTags = getAllTags();

        var html = '<div class="module-section">';
        html += '<h3>Asset Library</h3>';

        // Search bar
        html += '<div class="search-bar">';
        html += '<input type="text" id="asset-search" placeholder="Search assets by name...">';
        html += '<button class="btn btn-primary btn-sm" id="btn-search-assets">Search</button>';
        html += '<button class="btn btn-secondary btn-sm" id="btn-refresh-assets">Refresh from PPro</button>';
        html += '</div>';

        // Tag filter
        var tagKeys = Object.keys(allTags);
        if (tagKeys.length > 0) {
            html += '<div class="tag-filter">';
            html += '<span class="tag-label">Filter by tag:</span>';
            for (var i = 0; i < tagKeys.length; i++) {
                html += '<button class="tag-chip btn-tag-filter" data-tag="' + tagKeys[i] + '">' + tagKeys[i] + ' (' + allTags[tagKeys[i]] + ')</button>';
            }
            html += '<button class="tag-chip tag-clear" id="btn-clear-tag-filter">Clear</button>';
            html += '</div>';
        }

        // Asset list (loaded dynamically)
        html += '<div id="asset-list" class="asset-grid">';
        html += '<p class="empty-state">Click "Refresh from PPro" to load project assets</p>';
        html += '</div>';

        // Quick actions
        html += '<div class="asset-actions">';
        html += '<h4>Quick Actions</h4>';
        html += '<button class="btn btn-secondary" id="btn-quick-organize">Auto-Organize Bins</button>';
        html += '<button class="btn btn-secondary" id="btn-import-media">Import Media Files</button>';
        html += '</div>';

        // Bin creator
        html += '<div class="bin-creator">';
        html += '<h4>Create Bins</h4>';
        html += '<div class="form-row"><input type="text" id="new-bin-name" placeholder="Bin name"></div>';
        html += '<button class="btn btn-secondary btn-sm" id="btn-create-bin">Create Bin</button>';
        html += '</div>';

        // Tag manager
        html += '<div class="tag-manager">';
        html += '<h4>Tag an Asset</h4>';
        html += '<div class="form-row"><label>Asset Name</label><input type="text" id="tag-asset-name" placeholder="clip_001.mp4"></div>';
        html += '<div class="form-row"><label>Tags (comma separated)</label><input type="text" id="tag-values" placeholder="promo, sale, summer"></div>';
        html += '<button class="btn btn-secondary btn-sm" id="btn-add-tags">Add Tags</button>';
        html += '</div>';

        html += '</div>';
        container.innerHTML = html;

        bindAssetEvents(container);
    }

    function renderAssetList(container, assets) {
        var listEl = container.querySelector('#asset-list');
        var localTags = getAssetTags();

        if (!assets || assets.length === 0) {
            listEl.innerHTML = '<p class="empty-state">No assets found</p>';
            return;
        }

        var html = '';
        for (var i = 0; i < assets.length; i++) {
            var asset = assets[i];
            var tags = localTags[asset.name] || [];

            html += '<div class="asset-card" data-index="' + i + '">';
            html += '<div class="asset-icon asset-type-' + getAssetTypeClass(asset.name) + '"></div>';
            html += '<div class="asset-info">';
            html += '<strong class="asset-name" title="' + asset.path + '">' + asset.name + '</strong>';
            if (asset.mediaPath) {
                html += '<span class="asset-path" title="' + asset.mediaPath + '">' + truncatePath(asset.mediaPath) + '</span>';
            }
            if (tags.length > 0) {
                html += '<div class="asset-tags">';
                for (var t = 0; t < tags.length; t++) {
                    html += '<span class="tag-chip tag-sm">' + tags[t] + '</span>';
                }
                html += '</div>';
            }
            html += '</div>';
            html += '</div>';
        }

        listEl.innerHTML = html;
    }

    function bindAssetEvents(container) {
        // Refresh from PPro
        container.querySelector('#btn-refresh-assets').addEventListener('click', function () {
            fetchFromProject()
                .then(function (assets) {
                    renderAssetList(container, assets);
                    showNotification('Loaded ' + assets.length + ' assets from project', 'success');
                })
                .catch(function (err) {
                    showNotification('Error loading assets: ' + err, 'error');
                });
        });

        // Search
        container.querySelector('#btn-search-assets').addEventListener('click', function () {
            var query = container.querySelector('#asset-search').value;
            if (!query) { showNotification('Enter a search query', 'error'); return; }

            searchInProject(query)
                .then(function (results) {
                    renderAssetList(container, results);
                    showNotification('Found ' + results.length + ' matching assets', 'success');
                })
                .catch(function (err) {
                    showNotification('Search error: ' + err, 'error');
                });
        });

        // Enter key search
        container.querySelector('#asset-search').addEventListener('keydown', function (e) {
            if (e.key === 'Enter') container.querySelector('#btn-search-assets').click();
        });

        // Tag filter
        var tagBtns = container.querySelectorAll('.btn-tag-filter');
        for (var i = 0; i < tagBtns.length; i++) {
            tagBtns[i].addEventListener('click', function () {
                var tag = this.getAttribute('data-tag');
                var assetNames = searchByTag(tag);
                var fakeAssets = assetNames.map(function (name) { return { name: name, path: name }; });
                renderAssetList(container, fakeAssets);
                showNotification('Showing ' + assetNames.length + ' assets tagged "' + tag + '"', 'success');
            });
        }

        // Clear tag filter
        var clearBtn = container.querySelector('#btn-clear-tag-filter');
        if (clearBtn) {
            clearBtn.addEventListener('click', function () {
                fetchFromProject().then(function (assets) { renderAssetList(container, assets); });
            });
        }

        // Quick organize
        container.querySelector('#btn-quick-organize').addEventListener('click', function () {
            quickOrganize()
                .then(function (res) {
                    showNotification('Bins created: ' + res.created.join(', '), 'success');
                })
                .catch(function (err) {
                    showNotification('Error: ' + err, 'error');
                });
        });

        // Import media
        container.querySelector('#btn-import-media').addEventListener('click', function () {
            var paths = prompt('Enter file paths (comma separated):');
            if (!paths) return;

            var fileList = paths.split(',').map(function (p) { return p.trim(); });
            importMedia(fileList)
                .then(function () {
                    showNotification('Media imported successfully!', 'success');
                })
                .catch(function (err) {
                    showNotification('Import error: ' + err, 'error');
                });
        });

        // Create bin
        container.querySelector('#btn-create-bin').addEventListener('click', function () {
            var binName = container.querySelector('#new-bin-name').value;
            if (!binName) { showNotification('Bin name required', 'error'); return; }

            createBins([binName])
                .then(function () {
                    showNotification('Bin created: ' + binName, 'success');
                    container.querySelector('#new-bin-name').value = '';
                })
                .catch(function (err) {
                    showNotification('Error: ' + err, 'error');
                });
        });

        // Add tags
        container.querySelector('#btn-add-tags').addEventListener('click', function () {
            var assetName = container.querySelector('#tag-asset-name').value;
            var tagStr = container.querySelector('#tag-values').value;
            if (!assetName || !tagStr) { showNotification('Asset name and tags required', 'error'); return; }

            var tags = tagStr.split(',').map(function (t) { return t.trim(); }).filter(function (t) { return t; });
            tagAsset(assetName, tags);
            showNotification('Tags added to ' + assetName, 'success');
            renderUI(container); // Refresh to show new tags
        });
    }

    function getAssetTypeClass(filename) {
        var ext = filename.split('.').pop().toLowerCase();
        if (['mp4', 'mov', 'avi', 'mkv', 'wmv', 'prproj'].indexOf(ext) >= 0) return 'video';
        if (['mp3', 'wav', 'aac', 'flac', 'ogg'].indexOf(ext) >= 0) return 'audio';
        if (['png', 'jpg', 'jpeg', 'gif', 'psd', 'ai', 'svg', 'tiff', 'bmp'].indexOf(ext) >= 0) return 'image';
        if (['mogrt', 'prfpset', 'epr'].indexOf(ext) >= 0) return 'template';
        return 'other';
    }

    function truncatePath(path) {
        if (path.length > 50) return '...' + path.substring(path.length - 47);
        return path;
    }

    return {
        fetchFromProject: fetchFromProject,
        searchInProject: searchInProject,
        createBins: createBins,
        moveAsset: moveAsset,
        importMedia: importMedia,
        quickOrganize: quickOrganize,
        tagAsset: tagAsset,
        removeTag: removeTag,
        getAllTags: getAllTags,
        searchByTag: searchByTag,
        renderUI: renderUI
    };

})();

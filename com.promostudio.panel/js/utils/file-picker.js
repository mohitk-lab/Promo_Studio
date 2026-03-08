/**
 * File Picker - Native file/folder dialogs via CEP Node.js and ExtendScript
 * Works inside Premiere Pro CEP panel.
 */

var FilePicker = (function () {
    'use strict';

    // Node.js modules (available in CEP panels with --enable-nodejs)
    var _path, _fs;
    try {
        _path = require('path');
        _fs = require('fs');
    } catch (e) {
        console.warn('[FilePicker] Node.js modules not available. Falling back to manual paths.');
    }

    /**
     * Open a file picker dialog via ExtendScript (works always in PPro)
     * @param {string} title - Dialog title
     * @param {string} filter - File filter (e.g., "Video:*.mp4;*.mov,All:*.*")
     * @param {boolean} multiSelect - Allow multiple selection
     * @param {function} callback - Returns array of file paths
     */
    function openFileDialog(title, filter, multiSelect, callback) {
        var script = 'var f = File.openDialog("' +
            (title || 'Select File') + '", "' +
            (filter || '*.*') + '", ' +
            (multiSelect ? 'true' : 'false') + ');';

        if (multiSelect) {
            script += 'if (f) { var r = []; for (var i=0;i<f.length;i++) r.push(f[i].fsName); JSON.stringify(r); } else { "[]"; }';
        } else {
            script += 'f ? f.fsName : "";';
        }

        csInterface.evalScript(script, function (result) {
            if (!result || result === '' || result === 'undefined' || result === 'null') {
                callback([]);
                return;
            }

            try {
                if (multiSelect) {
                    callback(JSON.parse(result));
                } else {
                    callback([result]);
                }
            } catch (e) {
                callback(result ? [result] : []);
            }
        });
    }

    /**
     * Open a folder picker dialog via ExtendScript
     * @param {string} title - Dialog title
     * @param {function} callback - Returns folder path string
     */
    function openFolderDialog(title, callback) {
        var script = 'var f = Folder.selectDialog("' + (title || 'Select Folder') + '"); f ? f.fsName : "";';

        csInterface.evalScript(script, function (result) {
            if (!result || result === '' || result === 'undefined' || result === 'null') {
                callback('');
            } else {
                callback(result);
            }
        });
    }

    /**
     * Open file dialog for specific media types
     */
    function openVideoDialog(callback) {
        openFileDialog(
            'Select Video File',
            'Video:*.mp4;*.mov;*.avi;*.mkv;*.wmv;*.mxf;*.prproj,All:*.*',
            false,
            function (files) { callback(files.length > 0 ? files[0] : ''); }
        );
    }

    function openImageDialog(callback) {
        openFileDialog(
            'Select Image File',
            'Image:*.png;*.jpg;*.jpeg;*.psd;*.ai;*.tiff;*.bmp;*.gif;*.svg,All:*.*',
            false,
            function (files) { callback(files.length > 0 ? files[0] : ''); }
        );
    }

    function openAudioDialog(callback) {
        openFileDialog(
            'Select Audio File',
            'Audio:*.mp3;*.wav;*.aac;*.flac;*.ogg;*.m4a,All:*.*',
            false,
            function (files) { callback(files.length > 0 ? files[0] : ''); }
        );
    }

    function openMOGRTDialog(callback) {
        openFileDialog(
            'Select Motion Graphics Template',
            'MOGRT:*.mogrt,All:*.*',
            false,
            function (files) { callback(files.length > 0 ? files[0] : ''); }
        );
    }

    function openPresetDialog(callback) {
        openFileDialog(
            'Select AME Preset',
            'Preset:*.epr,All:*.*',
            false,
            function (files) { callback(files.length > 0 ? files[0] : ''); }
        );
    }

    function openMultiMediaDialog(callback) {
        openFileDialog(
            'Select Media Files',
            'Media:*.mp4;*.mov;*.avi;*.png;*.jpg;*.psd;*.mp3;*.wav,All:*.*',
            true,
            callback
        );
    }

    /**
     * Check if a file exists (via Node.js)
     */
    function fileExists(filePath) {
        if (!_fs) return true; // Can't check, assume exists
        try {
            return _fs.existsSync(filePath);
        } catch (e) {
            return false;
        }
    }

    /**
     * Check if a directory exists (via Node.js)
     */
    function dirExists(dirPath) {
        if (!_fs) return true;
        try {
            var stat = _fs.statSync(dirPath);
            return stat.isDirectory();
        } catch (e) {
            return false;
        }
    }

    /**
     * Create directory if it doesn't exist
     */
    function ensureDir(dirPath) {
        if (!_fs) return false;
        try {
            if (!_fs.existsSync(dirPath)) {
                _fs.mkdirSync(dirPath, { recursive: true });
            }
            return true;
        } catch (e) {
            console.error('[FilePicker] ensureDir error:', e);
            return false;
        }
    }

    /**
     * Get file extension
     */
    function getExtension(filePath) {
        if (_path) return _path.extname(filePath).toLowerCase();
        var parts = filePath.split('.');
        return parts.length > 1 ? '.' + parts.pop().toLowerCase() : '';
    }

    /**
     * Get filename without path
     */
    function getFileName(filePath) {
        if (_path) return _path.basename(filePath);
        return filePath.replace(/^.*[\\\/]/, '');
    }

    /**
     * Create a browse button that fills an input field
     * @param {HTMLInputElement} inputEl - The text input to fill
     * @param {string} type - 'file', 'folder', 'video', 'image', 'audio', 'mogrt', 'preset', 'multi'
     * @returns {HTMLButtonElement}
     */
    function createBrowseButton(inputEl, type) {
        var btn = document.createElement('button');
        btn.className = 'btn btn-secondary btn-sm btn-browse';
        btn.textContent = 'Browse';
        btn.type = 'button';

        btn.addEventListener('click', function () {
            var handler = function (result) {
                if (Array.isArray(result)) {
                    inputEl.value = result.join(', ');
                } else if (result) {
                    inputEl.value = result;
                }
                // Trigger change event
                inputEl.dispatchEvent(new Event('change'));
            };

            switch (type) {
                case 'folder':
                    openFolderDialog('Select Folder', handler);
                    break;
                case 'video':
                    openVideoDialog(handler);
                    break;
                case 'image':
                    openImageDialog(handler);
                    break;
                case 'audio':
                    openAudioDialog(handler);
                    break;
                case 'mogrt':
                    openMOGRTDialog(handler);
                    break;
                case 'preset':
                    openPresetDialog(handler);
                    break;
                case 'multi':
                    openMultiMediaDialog(handler);
                    break;
                default:
                    openFileDialog('Select File', '*.*', false, function (files) {
                        handler(files.length > 0 ? files[0] : '');
                    });
            }
        });

        return btn;
    }

    /**
     * Auto-attach browse buttons to inputs with data-browse attribute
     * Usage: <input type="text" data-browse="folder">
     */
    function autoAttachBrowseButtons() {
        var inputs = document.querySelectorAll('input[data-browse]');
        for (var i = 0; i < inputs.length; i++) {
            var input = inputs[i];
            // Skip if already has a browse button
            if (input.nextElementSibling && input.nextElementSibling.classList.contains('btn-browse')) continue;

            var browseType = input.getAttribute('data-browse');
            var btn = createBrowseButton(input, browseType);
            input.parentNode.insertBefore(btn, input.nextSibling);
        }
    }

    return {
        openFileDialog: openFileDialog,
        openFolderDialog: openFolderDialog,
        openVideoDialog: openVideoDialog,
        openImageDialog: openImageDialog,
        openAudioDialog: openAudioDialog,
        openMOGRTDialog: openMOGRTDialog,
        openPresetDialog: openPresetDialog,
        openMultiMediaDialog: openMultiMediaDialog,
        fileExists: fileExists,
        dirExists: dirExists,
        ensureDir: ensureDir,
        getExtension: getExtension,
        getFileName: getFileName,
        createBrowseButton: createBrowseButton,
        autoAttachBrowseButtons: autoAttachBrowseButtons
    };

})();

/**
 * Error Handler - Centralized error handling, logging, and user feedback
 */

var ErrorHandler = (function () {
    'use strict';

    var LOG_KEY = 'errorLog';
    var MAX_LOG_ENTRIES = 100;

    // Error severity levels
    var SEVERITY = {
        INFO: 'info',
        WARN: 'warning',
        ERROR: 'error',
        FATAL: 'fatal'
    };

    /**
     * Log an error
     */
    function log(severity, module, message, details) {
        var entry = {
            timestamp: new Date().toISOString(),
            severity: severity,
            module: module,
            message: message,
            details: details || null
        };

        // Console output
        var prefix = '[' + module + ']';
        switch (severity) {
            case SEVERITY.ERROR:
            case SEVERITY.FATAL:
                console.error(prefix, message, details || '');
                break;
            case SEVERITY.WARN:
                console.warn(prefix, message, details || '');
                break;
            default:
                console.log(prefix, message, details || '');
        }

        // Persist to storage
        var logs = Storage.get(LOG_KEY, []);
        logs.push(entry);
        if (logs.length > MAX_LOG_ENTRIES) {
            logs = logs.slice(logs.length - MAX_LOG_ENTRIES);
        }
        Storage.set(LOG_KEY, logs);

        return entry;
    }

    /**
     * Get stored error logs
     */
    function getLogs(severity) {
        var logs = Storage.get(LOG_KEY, []);
        if (severity) {
            return logs.filter(function (l) { return l.severity === severity; });
        }
        return logs;
    }

    /**
     * Clear all logs
     */
    function clearLogs() {
        Storage.set(LOG_KEY, []);
    }

    /**
     * Handle a PPro bridge error with user notification
     */
    function handlePProError(module, error, userMessage) {
        log(SEVERITY.ERROR, module, error);

        var msg = userMessage || _friendlyMessage(error);
        showNotification(msg, 'error');

        return msg;
    }

    /**
     * Wrap a PPro call with automatic error handling
     */
    function wrapAsync(module, promise, userMessage) {
        return promise.catch(function (err) {
            handlePProError(module, String(err), userMessage);
            throw err;
        });
    }

    /**
     * Validate required fields before an operation
     * @param {object} fields - { fieldName: { value, label, type? } }
     * @returns {string|null} - Error message or null if valid
     */
    function validateFields(fields) {
        var errors = [];

        for (var key in fields) {
            if (!fields.hasOwnProperty(key)) continue;
            var field = fields[key];
            var value = field.value;
            var label = field.label || key;

            // Required check
            if (value === undefined || value === null || value === '') {
                errors.push(label + ' is required');
                continue;
            }

            // Type checks
            if (field.type === 'number' && isNaN(Number(value))) {
                errors.push(label + ' must be a number');
            }

            if (field.type === 'path' && typeof value === 'string') {
                // Basic path validation
                if (value.length < 3) {
                    errors.push(label + ' is not a valid path');
                }
            }

            if (field.type === 'date' && typeof value === 'string') {
                if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
                    errors.push(label + ' must be a valid date (YYYY-MM-DD)');
                }
            }

            if (field.min !== undefined && Number(value) < field.min) {
                errors.push(label + ' must be at least ' + field.min);
            }

            if (field.max !== undefined && Number(value) > field.max) {
                errors.push(label + ' must be at most ' + field.max);
            }
        }

        if (errors.length > 0) {
            var msg = errors.join('. ');
            showNotification(msg, 'error');
            return msg;
        }

        return null;
    }

    /**
     * Validate file path exists (if Node.js available)
     */
    function validateFilePath(path, label) {
        if (!path || path.trim() === '') {
            return (label || 'File') + ' path is required';
        }
        if (typeof FilePicker !== 'undefined' && !FilePicker.fileExists(path)) {
            return (label || 'File') + ' not found: ' + path;
        }
        return null;
    }

    /**
     * Validate folder path
     */
    function validateFolderPath(path, label) {
        if (!path || path.trim() === '') {
            return (label || 'Folder') + ' path is required';
        }
        if (typeof FilePicker !== 'undefined' && !FilePicker.dirExists(path)) {
            return (label || 'Folder') + ' not found: ' + path;
        }
        return null;
    }

    /**
     * Check if Premiere Pro project is open
     */
    function requireProject(callback) {
        PPro.call('getProjectInfo', null, function (result) {
            if (result && result.success) {
                callback(null, result.data);
            } else {
                var msg = 'No Premiere Pro project is open. Please open a project first.';
                showNotification(msg, 'error');
                log(SEVERITY.WARN, 'System', msg);
                callback(msg, null);
            }
        });
    }

    /**
     * Check if active sequence exists
     */
    function requireActiveSequence(callback) {
        PPro.call('getProjectInfo', null, function (result) {
            if (!result || !result.success) {
                var msg = 'No Premiere Pro project is open.';
                showNotification(msg, 'error');
                callback(msg, null);
                return;
            }

            if (!result.data.sequences || result.data.sequences.length === 0) {
                var msg2 = 'No sequences found. Create a sequence first.';
                showNotification(msg2, 'error');
                callback(msg2, null);
                return;
            }

            callback(null, result.data);
        });
    }

    /**
     * Convert raw errors to friendly messages
     */
    function _friendlyMessage(error) {
        var str = String(error).toLowerCase();

        if (str.indexOf('no project') >= 0 || str.indexOf('project open') >= 0) {
            return 'No project open. Please open a Premiere Pro project.';
        }
        if (str.indexOf('no active sequence') >= 0) {
            return 'No active sequence. Create or open a sequence first.';
        }
        if (str.indexOf('track not found') >= 0) {
            return 'Video track not found. Add more tracks to your sequence.';
        }
        if (str.indexOf('clip not found') >= 0) {
            return 'Clip not found on the timeline.';
        }
        if (str.indexOf('encoder') >= 0 || str.indexOf('ame') >= 0) {
            return 'Adobe Media Encoder error. Make sure AME is installed and running.';
        }
        if (str.indexOf('mogrt') >= 0 || str.indexOf('mgt') >= 0) {
            return 'Motion Graphics Template error. Check if the .mogrt file is valid.';
        }
        if (str.indexOf('import') >= 0) {
            return 'Media import failed. Check file paths and formats.';
        }
        if (str.indexOf('cep_not_available') >= 0) {
            return 'CEP runtime not available. Extension must run inside Premiere Pro.';
        }
        if (str.indexOf('permission') >= 0 || str.indexOf('access') >= 0) {
            return 'Permission denied. Check file/folder access permissions.';
        }
        if (str.indexOf('parse error') >= 0) {
            return 'Communication error with Premiere Pro. Try again.';
        }

        return 'Error: ' + error;
    }

    /**
     * Global uncaught error handler
     */
    function initGlobalHandler() {
        window.onerror = function (message, source, lineno, colno, error) {
            log(SEVERITY.ERROR, 'Global', message, {
                source: source,
                line: lineno,
                col: colno
            });
            return false; // Don't suppress default handling
        };

        window.addEventListener('unhandledrejection', function (event) {
            log(SEVERITY.ERROR, 'Promise', String(event.reason));
        });
    }

    return {
        SEVERITY: SEVERITY,
        log: log,
        getLogs: getLogs,
        clearLogs: clearLogs,
        handlePProError: handlePProError,
        wrapAsync: wrapAsync,
        validateFields: validateFields,
        validateFilePath: validateFilePath,
        validateFolderPath: validateFolderPath,
        requireProject: requireProject,
        requireActiveSequence: requireActiveSequence,
        initGlobalHandler: initGlobalHandler
    };

})();

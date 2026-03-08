/**
 * PPro Bridge - Communication layer between UI and Premiere Pro ExtendScript
 */

var csInterface = new CSInterface();

var PPro = {
    // Default timeout for JSX calls (ms)
    DEFAULT_TIMEOUT: 30000,

    // Event listener registry
    _eventListeners: {},

    /**
     * Serialize a single argument for JSX
     */
    _serializeArg: function (arg) {
        if (arg === undefined || arg === null) return '';
        if (typeof arg === 'object') {
            return "'" + JSON.stringify(arg).replace(/'/g, "\\'") + "'";
        } else if (typeof arg === 'string') {
            return "'" + arg.replace(/'/g, "\\'") + "'";
        }
        return String(arg);
    },

    /**
     * Parse JSX result safely
     */
    _parseResult: function (result) {
        if (!result || result === 'undefined' || result === 'null') {
            return { success: false, error: 'No response from Premiere Pro' };
        }
        try {
            return JSON.parse(result);
        } catch (e) {
            return { success: false, error: 'Parse error: ' + result };
        }
    },

    /**
     * Execute a JSX function in Premiere Pro host
     */
    /**
     * Wrap script in try-catch at ExtendScript level to catch ALL errors
     * including function-not-found and engine crashes
     */
    _wrapScript: function (script) {
        return 'try{' + script + '}catch(___e){\'{"success":false,"error":"JSX: \'+String(___e)+\'"}\'}'
    },

    call: function (fnName, args, callback) {
        var argsStr = this._serializeArg(args);
        var rawScript = fnName + '(' + argsStr + ')';
        var script = this._wrapScript(rawScript);

        csInterface.evalScript(script, function (result) {
            if (callback) {
                callback(PPro._parseResult(result));
            }
        });
    },

    /**
     * Execute with multiple arguments
     */
    callMulti: function (fnName, argsArray, callback) {
        var parts = [];
        for (var i = 0; i < argsArray.length; i++) {
            parts.push(this._serializeArg(argsArray[i]));
        }

        var rawScript = fnName + '(' + parts.join(', ') + ')';
        var script = this._wrapScript(rawScript);

        csInterface.evalScript(script, function (result) {
            if (callback) {
                callback(PPro._parseResult(result));
            }
        });
    },

    /**
     * Promise-based call with timeout
     */
    callAsync: function (fnName, args, timeout) {
        var self = this;
        var timeoutMs = timeout || self.DEFAULT_TIMEOUT;

        return new Promise(function (resolve, reject) {
            var timer = setTimeout(function () {
                reject('Timeout: ' + fnName + ' did not respond within ' + timeoutMs + 'ms');
            }, timeoutMs);

            self.call(fnName, args, function (result) {
                clearTimeout(timer);
                if (result && result.success) {
                    resolve(result.data);
                } else {
                    reject(result ? result.error : 'Unknown error');
                }
            });
        });
    },

    callMultiAsync: function (fnName, argsArray, timeout) {
        var self = this;
        var timeoutMs = timeout || self.DEFAULT_TIMEOUT;

        return new Promise(function (resolve, reject) {
            var timer = setTimeout(function () {
                reject('Timeout: ' + fnName + ' did not respond within ' + timeoutMs + 'ms');
            }, timeoutMs);

            self.callMulti(fnName, argsArray, function (result) {
                clearTimeout(timer);
                if (result && result.success) {
                    resolve(result.data);
                } else {
                    reject(result ? result.error : 'Unknown error');
                }
            });
        });
    },

    // ============================================================
    // PPro Event Listeners
    // ============================================================

    /**
     * Register for Premiere Pro events
     * Supported events:
     *   - 'projectChanged'   (project opened/closed/switched)
     *   - 'sequenceChanged'  (active sequence changed)
     *   - 'sequenceEdited'   (timeline edit occurred)
     *   - 'itemAdded'        (media imported)
     */
    on: function (eventName, handler) {
        if (!this._eventListeners[eventName]) {
            this._eventListeners[eventName] = [];
        }
        this._eventListeners[eventName].push(handler);
    },

    /**
     * Unregister an event handler
     */
    off: function (eventName, handler) {
        if (!this._eventListeners[eventName]) return;
        if (!handler) {
            delete this._eventListeners[eventName];
            return;
        }
        this._eventListeners[eventName] = this._eventListeners[eventName].filter(
            function (h) { return h !== handler; }
        );
    },

    /**
     * Dispatch event to registered handlers
     */
    _dispatch: function (eventName, data) {
        var handlers = this._eventListeners[eventName] || [];
        for (var i = 0; i < handlers.length; i++) {
            try {
                handlers[i](data);
            } catch (e) {
                console.error('[PPro Event] Error in ' + eventName + ' handler:', e);
            }
        }
    },

    /**
     * Initialize PPro event listeners via CEP event system
     * Call this once at app startup
     */
    initEventListeners: function () {
        var self = this;

        // Project changed (opened/closed/switched)
        csInterface.addEventListener('com.adobe.csxs.events.ProjectChanged', function (evt) {
            self._dispatch('projectChanged', evt.data);
        });

        // Active sequence changed
        csInterface.addEventListener('com.adobe.csxs.events.SequenceActivated', function (evt) {
            self._dispatch('sequenceChanged', evt.data);
        });

        // Sequence edited (clips added/removed/moved)
        csInterface.addEventListener('com.adobe.csxs.events.SequenceChanged', function (evt) {
            self._dispatch('sequenceEdited', evt.data);
        });

        // Item added to project (import)
        csInterface.addEventListener('com.adobe.csxs.events.ItemAddedToProject', function (evt) {
            self._dispatch('itemAdded', evt.data);
        });

        console.log('[PPro Bridge] Event listeners initialized');
    }
};

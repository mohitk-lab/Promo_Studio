/**
 * PPro Bridge - Communication layer between UI and Premiere Pro ExtendScript
 */

var csInterface = new CSInterface();

var PPro = {
    /**
     * Execute a JSX function in Premiere Pro host
     */
    call: function (fnName, args, callback) {
        var argsStr = '';
        if (args !== undefined && args !== null) {
            if (typeof args === 'object') {
                argsStr = "'" + JSON.stringify(args).replace(/'/g, "\\'") + "'";
            } else if (typeof args === 'string') {
                argsStr = "'" + args.replace(/'/g, "\\'") + "'";
            } else {
                argsStr = String(args);
            }
        }

        var script = fnName + '(' + argsStr + ')';

        csInterface.evalScript(script, function (result) {
            if (callback) {
                try {
                    var parsed = JSON.parse(result);
                    callback(parsed);
                } catch (e) {
                    callback({ success: false, error: 'Parse error: ' + result });
                }
            }
        });
    },

    /**
     * Execute with multiple arguments
     */
    callMulti: function (fnName, argsArray, callback) {
        var parts = [];
        for (var i = 0; i < argsArray.length; i++) {
            var arg = argsArray[i];
            if (typeof arg === 'object') {
                parts.push("'" + JSON.stringify(arg).replace(/'/g, "\\'") + "'");
            } else if (typeof arg === 'string') {
                parts.push("'" + arg.replace(/'/g, "\\'") + "'");
            } else {
                parts.push(String(arg));
            }
        }

        var script = fnName + '(' + parts.join(', ') + ')';

        csInterface.evalScript(script, function (result) {
            if (callback) {
                try {
                    callback(JSON.parse(result));
                } catch (e) {
                    callback({ success: false, error: 'Parse error: ' + result });
                }
            }
        });
    },

    /**
     * Promise-based call
     */
    callAsync: function (fnName, args) {
        return new Promise(function (resolve, reject) {
            PPro.call(fnName, args, function (result) {
                if (result && result.success) {
                    resolve(result.data);
                } else {
                    reject(result ? result.error : 'Unknown error');
                }
            });
        });
    },

    callMultiAsync: function (fnName, argsArray) {
        return new Promise(function (resolve, reject) {
            PPro.callMulti(fnName, argsArray, function (result) {
                if (result && result.success) {
                    resolve(result.data);
                } else {
                    reject(result ? result.error : 'Unknown error');
                }
            });
        });
    }
};

/**
 * CSInterface - Adobe CEP Communication Layer
 * Handles communication between HTML panel and ExtendScript host.
 */

function CSInterface() {
    this.CYCRIPT_ENV = 'cycript';
    this.hostEnvironment = null;
}

CSInterface.prototype.getHostEnvironment = function () {
    try {
        var env = window.__adobe_cep__.getHostEnvironment();
        return JSON.parse(env);
    } catch (e) {
        return {
            appName: 'PPRO',
            appVersion: '14.0',
            appLocale: 'en_US',
            appUILocale: 'en_US',
            appId: 'PPRO',
            isAppOnline: true
        };
    }
};

CSInterface.prototype.evalScript = function (script, callback) {
    try {
        if (window.__adobe_cep__) {
            window.__adobe_cep__.evalScript(script, callback || function () {});
        } else {
            console.warn('[CSInterface] No CEP runtime. Script:', script);
            if (callback) callback('CEP_NOT_AVAILABLE');
        }
    } catch (e) {
        console.error('[CSInterface] evalScript error:', e);
        if (callback) callback('ERROR: ' + e.message);
    }
};

CSInterface.prototype.addEventListener = function (type, listener, obj) {
    try {
        if (window.__adobe_cep__) {
            window.__adobe_cep__.addEventListener(type, listener, obj);
        }
    } catch (e) {
        console.error('[CSInterface] addEventListener error:', e);
    }
};

CSInterface.prototype.removeEventListener = function (type, listener, obj) {
    try {
        if (window.__adobe_cep__) {
            window.__adobe_cep__.removeEventListener(type, listener, obj);
        }
    } catch (e) {
        console.error('[CSInterface] removeEventListener error:', e);
    }
};

CSInterface.prototype.dispatchEvent = function (event) {
    try {
        if (window.__adobe_cep__) {
            window.__adobe_cep__.dispatchEvent(event);
        }
    } catch (e) {
        console.error('[CSInterface] dispatchEvent error:', e);
    }
};

CSInterface.prototype.getSystemPath = function (pathType) {
    try {
        return window.__adobe_cep__.getSystemPath(pathType);
    } catch (e) {
        return '';
    }
};

CSInterface.prototype.openURLInDefaultBrowser = function (url) {
    try {
        if (window.__adobe_cep__) {
            window.__adobe_cep__.openURLInDefaultBrowser(url);
        }
    } catch (e) {
        window.open(url, '_blank');
    }
};

CSInterface.THEME_COLOR_CHANGED_EVENT = 'com.adobe.csxs.events.ThemeColorChanged';

// System path constants
CSInterface.SystemPath = {
    USER_DATA: 'userData',
    COMMON_FILES: 'commonFiles',
    MY_DOCUMENTS: 'myDocuments',
    APPLICATION: 'application',
    EXTENSION: 'extension',
    HOST_APPLICATION: 'hostApplication'
};

// CSEvent constructor
function CSEvent(type, scope, appId, extensionId) {
    this.type = type || '';
    this.scope = scope || 'APPLICATION';
    this.appId = appId || '';
    this.extensionId = extensionId || '';
    this.data = '';
}

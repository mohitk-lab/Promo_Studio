/**
 * Storage - Persistent data storage for extension settings, brand kits, rules, etc.
 * Uses localStorage + JSON files for portability.
 */

var Storage = {
    PREFIX: 'promoStudio_',

    get: function (key, defaultVal) {
        try {
            var raw = localStorage.getItem(this.PREFIX + key);
            if (raw === null) return defaultVal || null;
            return JSON.parse(raw);
        } catch (e) {
            return defaultVal || null;
        }
    },

    set: function (key, value) {
        try {
            localStorage.setItem(this.PREFIX + key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error('[Storage] set error:', e);
            return false;
        }
    },

    remove: function (key) {
        localStorage.removeItem(this.PREFIX + key);
    },

    // Get all keys with prefix
    keys: function () {
        var result = [];
        for (var i = 0; i < localStorage.length; i++) {
            var k = localStorage.key(i);
            if (k.indexOf(this.PREFIX) === 0) {
                result.push(k.substring(this.PREFIX.length));
            }
        }
        return result;
    },

    // Export all data as JSON (backup)
    exportAll: function () {
        var data = {};
        var allKeys = this.keys();
        for (var i = 0; i < allKeys.length; i++) {
            data[allKeys[i]] = this.get(allKeys[i]);
        }
        return data;
    },

    // Import data from JSON (restore)
    importAll: function (data) {
        for (var key in data) {
            if (data.hasOwnProperty(key)) {
                this.set(key, data[key]);
            }
        }
    }
};

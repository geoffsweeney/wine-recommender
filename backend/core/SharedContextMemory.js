"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SharedContextMemory = void 0;
/**
 * Shared Context Memory System
 * Uses WeakMap for automatic garbage collection of unused contexts
 */
var SharedContextMemory = /** @class */ (function () {
    function SharedContextMemory() {
        this.contexts = new WeakMap();
        this.versionHistory = new Map();
    }
    /**
     * Stores context for a given agent/entity
     */
    SharedContextMemory.prototype.setContext = function (owner, key, value, metadata) {
        if (!this.contexts.has(owner)) {
            this.contexts.set(owner, new Map());
        }
        var ownerContexts = this.contexts.get(owner);
        var timestamp = Date.now();
        var versionHash = this.generateVersionHash(value);
        ownerContexts.set(key, {
            value: value,
            metadata: metadata || {},
            timestamp: timestamp,
            versionHash: versionHash
        });
        this.recordVersion(key, { value: value, timestamp: timestamp, versionHash: versionHash });
    };
    /**
     * Retrieves context for a given agent/entity
     */
    SharedContextMemory.prototype.getContext = function (owner, key) {
        var _a;
        return (_a = this.contexts.get(owner)) === null || _a === void 0 ? void 0 : _a.get(key);
    };
    /**
     * Gets version history for a context key
     */
    SharedContextMemory.prototype.getVersionHistory = function (key) {
        return this.versionHistory.get(key) || [];
    };
    SharedContextMemory.prototype.generateVersionHash = function (value) {
        var str = typeof value === 'object'
            ? JSON.stringify(value)
            : String(value);
        return Buffer.from(str).toString('base64').slice(0, 16);
    };
    SharedContextMemory.prototype.recordVersion = function (key, version) {
        if (!this.versionHistory.has(key)) {
            this.versionHistory.set(key, []);
        }
        this.versionHistory.get(key).push(version);
    };
    return SharedContextMemory;
}());
exports.SharedContextMemory = SharedContextMemory;

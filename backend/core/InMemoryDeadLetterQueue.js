"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryDeadLetterQueue = void 0;
/**
 * Simple in-memory implementation of a Dead Letter Queue for POC purposes.
 */
var InMemoryDeadLetterQueue = /** @class */ (function () {
    function InMemoryDeadLetterQueue() {
        this.queue = [];
    }
    /**
     * Adds a failed message to the dead letter queue.
     * @param message The failed message.
     */
    InMemoryDeadLetterQueue.prototype.add = function (message) {
        console.log('InMemoryDeadLetterQueue: Adding message to DLQ', message);
        this.queue.push(message);
    };
    /**
     * Retrieves all messages from the dead letter queue.
     * (Note: This is a simplified implementation; a real DLQ might have polling/processing mechanisms)
     * @returns An array of messages in the DLQ.
     */
    InMemoryDeadLetterQueue.prototype.getAll = function () {
        console.log('InMemoryDeadLetterQueue: Retrieving all messages from DLQ.');
        return __spreadArray([], this.queue, true); // Return a copy to prevent external modification
    };
    /**
     * Clears all messages from the dead letter queue.
     */
    InMemoryDeadLetterQueue.prototype.clear = function () {
        console.log('InMemoryDeadLetterQueue: Clearing DLQ.');
        this.queue = [];
    };
    return InMemoryDeadLetterQueue;
}());
exports.InMemoryDeadLetterQueue = InMemoryDeadLetterQueue;

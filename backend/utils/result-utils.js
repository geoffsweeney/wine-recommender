"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.success = success;
exports.failure = failure;
function success(data) {
    return { success: true, data: data };
}
function failure(error) {
    return { success: false, error: error };
}

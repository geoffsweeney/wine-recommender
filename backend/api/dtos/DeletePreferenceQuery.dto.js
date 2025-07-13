"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeletePreferenceQuerySchema = void 0;
var zod_1 = require("zod");
exports.DeletePreferenceQuerySchema = zod_1.z.object({
    preferenceId: zod_1.z.string().min(1, 'Preference ID is required').optional(),
    type: zod_1.z.string().min(1, 'Preference type is required').optional(),
    value: zod_1.z.string().min(1, 'Preference value is required').optional(),
}).refine(function (data) {
    // If no fields are provided, it's valid for "delete all preferences"
    if (!data.preferenceId && !data.type && !data.value) {
        return true;
    }
    // Otherwise, apply the original validation logic
    return data.preferenceId || (data.type && data.value);
}, {
    message: "Either 'preferenceId' or both 'type' and 'value' must be provided, or no parameters for deleting all preferences.",
    path: ['preferenceId', 'type', 'value'],
});

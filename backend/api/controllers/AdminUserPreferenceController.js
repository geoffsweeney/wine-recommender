"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminUserPreferenceController = void 0;
var tsyringe_1 = require("tsyringe");
var BaseController_1 = require("../BaseController");
var AdminUserPreferenceController = function () {
    var _classDecorators = [(0, tsyringe_1.injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var _classSuper = BaseController_1.BaseController;
    var AdminUserPreferenceController = _classThis = /** @class */ (function (_super) {
        __extends(AdminUserPreferenceController_1, _super);
        function AdminUserPreferenceController_1(userProfileService, knowledgeGraphService, logger) {
            var _this = _super.call(this) || this;
            _this.userProfileService = userProfileService;
            _this.knowledgeGraphService = knowledgeGraphService;
            _this.logger = logger;
            return _this;
        }
        AdminUserPreferenceController_1.prototype.executeImpl = function (req, res) {
            return __awaiter(this, void 0, void 0, function () {
                var method, userId, allPreferences, preferences, preferences, _a, type, value, preferenceId, parts, prefType, prefValue, err_1;
                var _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            method = req.method;
                            _c.label = 1;
                        case 1:
                            _c.trys.push([1, 17, , 18]);
                            // Validate userId from params for all user-specific routes
                            if ((_b = req.validatedParams) === null || _b === void 0 ? void 0 : _b.userId) { // Use validatedParams
                                userId = req.validatedParams.userId;
                            }
                            if (!(method === 'GET')) return [3 /*break*/, 6];
                            if (!!userId) return [3 /*break*/, 3];
                            return [4 /*yield*/, this.knowledgeGraphService.getAllUserPreferences()];
                        case 2:
                            allPreferences = _c.sent();
                            this.ok(res, allPreferences);
                            return [3 /*break*/, 5];
                        case 3: return [4 /*yield*/, this.knowledgeGraphService.getPreferences(userId, true)];
                        case 4:
                            preferences = _c.sent();
                            this.ok(res, preferences);
                            _c.label = 5;
                        case 5: return [3 /*break*/, 16];
                        case 6:
                            if (!(method === 'PUT' && userId)) return [3 /*break*/, 8];
                            preferences = req.validatedBody;
                            return [4 /*yield*/, this.knowledgeGraphService.addOrUpdateUserPreferences(userId, preferences)];
                        case 7:
                            _c.sent();
                            this.ok(res, preferences); // Return the preferences that were updated
                            return [3 /*break*/, 16];
                        case 8:
                            if (!(method === 'DELETE' && userId)) return [3 /*break*/, 15];
                            _a = req.validatedQuery, type = _a.type, value = _a.value, preferenceId = _a.preferenceId;
                            if (!(type && value)) return [3 /*break*/, 10];
                            // Case 1: type and value are provided as separate query parameters
                            return [4 /*yield*/, this.knowledgeGraphService.deletePreference(userId, type, value)];
                        case 9:
                            // Case 1: type and value are provided as separate query parameters
                            _c.sent();
                            this.ok(res, { message: "Preference type: ".concat(type, ", value: ").concat(value, " for user ").concat(userId, " deleted successfully") });
                            return [3 /*break*/, 14];
                        case 10:
                            if (!preferenceId) return [3 /*break*/, 12];
                            parts = preferenceId.split(':');
                            if (parts.length !== 2) {
                                this.fail(res, 'Invalid preferenceId format. Expected "type:value".', 400);
                                return [2 /*return*/];
                            }
                            prefType = parts[0], prefValue = parts[1];
                            return [4 /*yield*/, this.knowledgeGraphService.deletePreference(userId, prefType, prefValue)];
                        case 11:
                            _c.sent();
                            this.ok(res, { message: "Preference ".concat(preferenceId, " for user ").concat(userId, " deleted successfully") });
                            return [3 /*break*/, 14];
                        case 12: 
                        // Case 3: No specific preference identifier, delete all preferences for the user
                        return [4 /*yield*/, this.knowledgeGraphService.deleteAllPreferencesForUser(userId)];
                        case 13:
                            // Case 3: No specific preference identifier, delete all preferences for the user
                            _c.sent();
                            this.ok(res, { message: "All preferences for user ".concat(userId, " deleted successfully") });
                            _c.label = 14;
                        case 14: return [3 /*break*/, 16];
                        case 15:
                            this.fail(res, 'Method not allowed or invalid path', 405);
                            _c.label = 16;
                        case 16: return [3 /*break*/, 18];
                        case 17:
                            err_1 = _c.sent();
                            this.logger.error("Error in AdminUserPreferenceController: ".concat(err_1 instanceof Error ? err_1.message : String(err_1)));
                            this.fail(res, err_1 instanceof Error ? err_1 : String(err_1), 500);
                            return [3 /*break*/, 18];
                        case 18: return [2 /*return*/];
                    }
                });
            });
        };
        return AdminUserPreferenceController_1;
    }(_classSuper));
    __setFunctionName(_classThis, "AdminUserPreferenceController");
    (function () {
        var _a;
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create((_a = _classSuper[Symbol.metadata]) !== null && _a !== void 0 ? _a : null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        AdminUserPreferenceController = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return AdminUserPreferenceController = _classThis;
}();
exports.AdminUserPreferenceController = AdminUserPreferenceController;

"use strict";
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
exports.AdminPreferenceService = void 0;
var tsyringe_1 = require("tsyringe");
var result_utils_1 = require("../utils/result-utils");
var AgentError_1 = require("../core/agents/AgentError");
var AdminPreferenceService = function () {
    var _classDecorators = [(0, tsyringe_1.injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var AdminPreferenceService = _classThis = /** @class */ (function () {
        function AdminPreferenceService_1(adminUserPreferenceController, logger) {
            this.adminUserPreferenceController = adminUserPreferenceController;
            this.logger = logger;
        }
        AdminPreferenceService_1.prototype.executeControllerAction = function (method, userId, correlationId, // Add correlationId parameter
        body, query) {
            return __awaiter(this, void 0, void 0, function () {
                var controllerReq, controllerRes, error_1, errorMessage;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            controllerReq = {
                                method: method,
                                validatedParams: { userId: userId },
                                validatedBody: body || [],
                                validatedQuery: query || {},
                            };
                            controllerRes = {
                                status: function (code) {
                                    controllerRes.statusCode = code;
                                    return controllerRes;
                                },
                                json: function (data) {
                                    controllerRes.jsonResponse = data;
                                    return controllerRes;
                                },
                                send: function (data) {
                                    controllerRes.jsonResponse = data;
                                    return controllerRes;
                                },
                            };
                            _b.label = 1;
                        case 1:
                            _b.trys.push([1, 3, , 4]);
                            // Temporarily cast to any to call protected method for demonstration.
                            // In a real scenario, AdminUserPreferenceController would expose public methods
                            // or this service would directly interact with the underlying data layer.
                            return [4 /*yield*/, this.adminUserPreferenceController.executeImpl(controllerReq, controllerRes)];
                        case 2:
                            // Temporarily cast to any to call protected method for demonstration.
                            // In a real scenario, AdminUserPreferenceController would expose public methods
                            // or this service would directly interact with the underlying data layer.
                            _b.sent();
                            if (controllerRes.statusCode >= 200 && controllerRes.statusCode < 300) {
                                return [2 /*return*/, (0, result_utils_1.success)(controllerRes.jsonResponse)];
                            }
                            else {
                                return [2 /*return*/, (0, result_utils_1.failure)(new AgentError_1.AgentError(((_a = controllerRes.jsonResponse) === null || _a === void 0 ? void 0 : _a.error) || 'Unknown error from controller', 'CONTROLLER_ERROR', 'AdminPreferenceService', correlationId, // Use passed correlationId
                                    true, { statusCode: controllerRes.statusCode, response: controllerRes.jsonResponse }))];
                            }
                            return [3 /*break*/, 4];
                        case 3:
                            error_1 = _b.sent();
                            errorMessage = error_1 instanceof Error ? error_1.message : String(error_1);
                            this.logger.error("Error executing controller action: ".concat(errorMessage), { error: error_1 });
                            return [2 /*return*/, (0, result_utils_1.failure)(new AgentError_1.AgentError("Failed to execute controller action: ".concat(errorMessage), 'SERVICE_EXECUTION_ERROR', 'AdminPreferenceService', correlationId, // Use passed correlationId
                                true, { originalError: errorMessage }))];
                        case 4: return [2 /*return*/];
                    }
                });
            });
        };
        AdminPreferenceService_1.prototype.viewUserPreferences = function (userId, correlationId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.executeControllerAction('GET', userId, correlationId)];
                });
            });
        };
        AdminPreferenceService_1.prototype.addOrUpdateUserPreferences = function (userId, preferences, correlationId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.executeControllerAction('PUT', userId, correlationId, preferences)];
                });
            });
        };
        AdminPreferenceService_1.prototype.deletePreference = function (userId, correlationId, type, value, preferenceId) {
            return __awaiter(this, void 0, void 0, function () {
                var query;
                return __generator(this, function (_a) {
                    query = {};
                    if (type && value) {
                        query.type = type;
                        query.value = value;
                    }
                    else if (preferenceId) {
                        query.preferenceId = preferenceId;
                    }
                    return [2 /*return*/, this.executeControllerAction('DELETE', userId, correlationId, undefined, query)];
                });
            });
        };
        AdminPreferenceService_1.prototype.deleteAllPreferencesForUser = function (userId, correlationId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.executeControllerAction('DELETE', userId, correlationId, undefined, {})];
                });
            });
        };
        return AdminPreferenceService_1;
    }());
    __setFunctionName(_classThis, "AdminPreferenceService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        AdminPreferenceService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return AdminPreferenceService = _classThis;
}();
exports.AdminPreferenceService = AdminPreferenceService;

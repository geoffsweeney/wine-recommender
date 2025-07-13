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
exports.AdminConversationalAgent = void 0;
var tsyringe_1 = require("tsyringe");
var zod_1 = require("zod");
var result_utils_1 = require("../../utils/result-utils");
/**
 * Type guard to check if a Result is successful
 * @param result The Result to check
 * @returns true if the result is successful, false otherwise
 */
function isSuccess(result) {
    return result.success;
}
/**
 * Type guard to check if a Result is an error
 * @param result The Result to check
 * @returns true if the result is an error, false otherwise
 */
function isError(result) {
    return !result.success;
}
var AgentError_1 = require("./AgentError");
var CommunicatingAgent_1 = require("./CommunicatingAgent");
var AgentMessage_1 = require("./communication/AgentMessage");
var AgentMessage_2 = require("./communication/AgentMessage");
// Zod schema for the output of the adminPreferenceExtraction prompt
var AdminPreferenceExtractionOutputSchema = zod_1.z.object({
    action: zod_1.z.union([zod_1.z.literal('view'), zod_1.z.literal('add'), zod_1.z.literal('update'), zod_1.z.literal('delete')]),
    userId: zod_1.z.string().min(1, 'User ID is required'),
    preferenceType: zod_1.z.string().optional(),
    preferenceValue: zod_1.z.string().optional(),
    preferenceId: zod_1.z.string().optional(), // For composite IDs like "type:value"
    // Add other fields as needed for specific actions (e.g., new value for update)
});
var AdminConversationalAgent = function () {
    var _classDecorators = [(0, tsyringe_1.injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var _classSuper = CommunicatingAgent_1.CommunicatingAgent;
    var AdminConversationalAgent = _classThis = /** @class */ (function (_super) {
        __extends(AdminConversationalAgent_1, _super);
        function AdminConversationalAgent_1(agentConfig, llmService, promptManager, adminPreferenceService, knowledgeGraphService, userProfileService, dependencies, logger, featureFlags // Inject FeatureFlags
        ) {
            var _this = _super.call(this, agentConfig.agentId, agentConfig, dependencies) || this; // Pass all required dependencies
            _this.agentConfig = agentConfig;
            _this.llmService = llmService;
            _this.promptManager = promptManager;
            _this.adminPreferenceService = adminPreferenceService;
            _this.knowledgeGraphService = knowledgeGraphService;
            _this.userProfileService = userProfileService;
            _this.featureFlags = featureFlags;
            _this.logger = logger; // Assign injected logger
            _this.logger.info("AdminConversationalAgent initialized with ID: ".concat(_this.id));
            _this.logger.info("AdminConversationalAgent: registerMessageHandlers called.");
            _this.registerMessageHandlers(); // Ensure handlers are registered
            return _this;
        }
        AdminConversationalAgent_1.prototype.registerMessageHandlers = function () {
            this.communicationBus.registerMessageHandler(this.id, AgentMessage_1.MessageTypes.ADMIN_CONVERSATIONAL_COMMAND, this.handleMessage.bind(this));
            this.communicationBus.registerMessageHandler(this.id, AgentMessage_1.MessageTypes.ORCHESTRATE_ADMIN_COMMAND, this.handleMessage.bind(this));
        };
        AdminConversationalAgent_1.prototype.getName = function () {
            return this.id; // Return the agent's ID as its name
        };
        // Expose handleMessage for testing
        AdminConversationalAgent_1.prototype.handleMessageForTesting = function (message) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.handleMessage(message)];
                });
            });
        };
        // Expose the protected handleMessage method for testing
        AdminConversationalAgent_1.prototype.handleMessageForTestingProtected = function (message) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.handleMessage(message)];
                });
            });
        };
        AdminConversationalAgent_1.prototype.handleMessage = function (message) {
            return __awaiter(this, void 0, void 0, function () {
                var correlationId, payload, type, userInput, adminCommandRequest, extractionResult, extractedCommand, adminResponseResult, _a, confirmationPayload, responsePayload, error, extractionError, error_1, errorMessage;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            correlationId = message.correlationId, payload = message.payload, type = message.type;
                            this.logger.info("[".concat(correlationId, "] AdminConversationalAgent received message type: ").concat(type), { correlationId: correlationId, type: type });
                            _b.label = 1;
                        case 1:
                            _b.trys.push([1, 11, , 12]);
                            if (!(type === AgentMessage_1.MessageTypes.ADMIN_CONVERSATIONAL_COMMAND || type === AgentMessage_1.MessageTypes.ORCHESTRATE_ADMIN_COMMAND)) return [3 /*break*/, 10];
                            // Check if the feature flag is enabled
                            if (!this.featureFlags.adminConversationalPreferences) {
                                this.logger.warn("[".concat(correlationId, "] Admin conversational preferences feature is disabled."), { correlationId: correlationId });
                                return [2 /*return*/, (0, result_utils_1.failure)(new AgentError_1.AgentError('Admin conversational preferences feature is currently disabled.', 'FEATURE_DISABLED', this.id, correlationId, true))];
                            }
                            userInput = void 0;
                            if (type === AgentMessage_1.MessageTypes.ORCHESTRATE_ADMIN_COMMAND) {
                                adminCommandRequest = payload;
                                userInput = adminCommandRequest.userInput.message;
                            }
                            else {
                                userInput = payload;
                            }
                            this.logger.debug("[".concat(correlationId, "] Processing admin command: \"").concat(userInput, "\""), { correlationId: correlationId, userInput: userInput });
                            return [4 /*yield*/, this.llmService.sendStructuredPrompt('adminPreferenceExtraction', { userInput: userInput }, // Wrap userInput in the correct type
                                { correlationId: correlationId, agentId: this.id, operation: 'extractAdminCommand' })];
                        case 2:
                            extractionResult = _b.sent();
                            if (!isSuccess(extractionResult)) return [3 /*break*/, 9];
                            extractedCommand = extractionResult.data;
                            this.logger.debug("[".concat(correlationId, "] Extracted command: ").concat(JSON.stringify(extractedCommand)), { correlationId: correlationId, extractedCommand: extractedCommand });
                            // Handle unsupported actions
                            if (!['view', 'add', 'update', 'delete'].includes(extractedCommand.action)) {
                                return [2 /*return*/, (0, result_utils_1.failure)(new AgentError_1.AgentError("Unsupported action: ".concat(extractedCommand.action), 'UNSUPPORTED_ADMIN_ACTION', this.id, correlationId))];
                            }
                            // Handle missing preference data for add/update
                            if ((extractedCommand.action === 'add' || extractedCommand.action === 'update') &&
                                !(extractedCommand.preferenceType && extractedCommand.preferenceValue)) {
                                return [2 /*return*/, (0, result_utils_1.failure)(new AgentError_1.AgentError('Missing preference type or value for add/update action', 'MISSING_PREFERENCE_DATA', this.id, correlationId))];
                            }
                            adminResponseResult = void 0;
                            _a = extractedCommand.action;
                            switch (_a) {
                                case 'view': return [3 /*break*/, 3];
                                case 'add': return [3 /*break*/, 5];
                                case 'update': return [3 /*break*/, 5];
                                case 'delete': return [3 /*break*/, 7];
                            }
                            return [3 /*break*/, 8];
                        case 3: return [4 /*yield*/, this.adminPreferenceService.viewUserPreferences(extractedCommand.userId, correlationId)];
                        case 4:
                            adminResponseResult = _b.sent();
                            return [3 /*break*/, 8];
                        case 5: return [4 /*yield*/, this.adminPreferenceService.addOrUpdateUserPreferences(extractedCommand.userId, [{ type: extractedCommand.preferenceType, value: extractedCommand.preferenceValue }], correlationId)];
                        case 6:
                            adminResponseResult = _b.sent();
                            return [3 /*break*/, 8];
                        case 7:
                            {
                                confirmationPayload = {
                                    action: 'confirm_delete',
                                    userId: extractedCommand.userId,
                                    preferenceType: extractedCommand.preferenceType,
                                    preferenceValue: extractedCommand.preferenceValue,
                                    preferenceId: extractedCommand.preferenceId,
                                    message: "Are you sure you want to delete ".concat(extractedCommand.preferenceType ? "".concat(extractedCommand.preferenceType, ": ").concat(extractedCommand.preferenceValue) : extractedCommand.preferenceId ? "preference ID: ".concat(extractedCommand.preferenceId) : 'all preferences', " for user ").concat(extractedCommand.userId, "?")
                                };
                                return [2 /*return*/, (0, result_utils_1.success)((0, AgentMessage_2.createAgentMessage)(AgentMessage_1.MessageTypes.ADMIN_CONFIRMATION_REQUIRED, // New message type for confirmation
                                    confirmationPayload, this.id, message.correlationId, message.correlationId, message.sourceAgent))];
                            }
                            _b.label = 8;
                        case 8:
                            if (isSuccess(adminResponseResult)) {
                                responsePayload = void 0;
                                if (typeof adminResponseResult.data === 'string') {
                                    responsePayload = adminResponseResult.data;
                                }
                                else if (typeof adminResponseResult.data === 'object') {
                                    responsePayload = JSON.stringify(adminResponseResult.data, null, 2); // Pretty print JSON
                                }
                                else {
                                    responsePayload = 'Admin command executed successfully.';
                                }
                                return [2 /*return*/, (0, result_utils_1.success)((0, AgentMessage_2.createAgentMessage)(AgentMessage_1.MessageTypes.ADMIN_RESPONSE, // Use MessageTypes enum
                                    responsePayload, // Send formatted string as payload
                                    this.id, message.correlationId, // Use message.correlationId as conversationId
                                    message.correlationId, // Use message.correlationId as correlationId
                                    message.sourceAgent // Target the source agent
                                    ))];
                            }
                            else {
                                error = adminResponseResult.error;
                                if (error.code === 'MISSING_PREFERENCE_DATA') {
                                    return [2 /*return*/, (0, result_utils_1.failure)(error)];
                                }
                                return [2 /*return*/, (0, result_utils_1.failure)(error)];
                            }
                            return [3 /*break*/, 10];
                        case 9:
                            extractionError = extractionResult.error;
                            this.logger.error("[".concat(correlationId, "] Failed to extract admin command: ").concat(extractionError.message), { correlationId: correlationId, error: extractionError });
                            return [2 /*return*/, (0, result_utils_1.failure)(new AgentError_1.AgentError("Failed to understand command: ".concat(extractionError.message), 'LLM_EXTRACTION_FAILED', this.id, correlationId, true, { originalError: extractionError.message }))];
                        case 10: return [2 /*return*/, (0, result_utils_1.failure)(new AgentError_1.AgentError("Unhandled message type: ".concat(type), 'UNHANDLED_MESSAGE_TYPE', this.id, correlationId))];
                        case 11:
                            error_1 = _b.sent();
                            errorMessage = error_1 instanceof Error ? error_1.message : String(error_1);
                            this.logger.error("[".concat(correlationId, "] Error in AdminConversationalAgent: ").concat(errorMessage), { correlationId: correlationId, error: error_1 });
                            return [2 /*return*/, (0, result_utils_1.failure)(new AgentError_1.AgentError("Internal server error: ".concat(errorMessage), 'ADMIN_AGENT_ERROR', this.id, correlationId, true, { originalError: errorMessage }))];
                        case 12: return [2 /*return*/];
                    }
                });
            });
        };
        return AdminConversationalAgent_1;
    }(_classSuper));
    __setFunctionName(_classThis, "AdminConversationalAgent");
    (function () {
        var _a;
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create((_a = _classSuper[Symbol.metadata]) !== null && _a !== void 0 ? _a : null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        AdminConversationalAgent = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return AdminConversationalAgent = _classThis;
}();
exports.AdminConversationalAgent = AdminConversationalAgent;

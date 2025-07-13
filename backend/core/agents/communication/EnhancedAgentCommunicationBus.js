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
exports.EnhancedAgentCommunicationBus = void 0;
var tsyringe_1 = require("tsyringe");
var AgentCommunicationBus_1 = require("../../AgentCommunicationBus");
var AgentMessage_1 = require("./AgentMessage");
var AgentError_1 = require("../AgentError");
var EnhancedAgentCommunicationBus = function () {
    var _classDecorators = [(0, tsyringe_1.injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var _classSuper = AgentCommunicationBus_1.AgentCommunicationBus;
    var EnhancedAgentCommunicationBus = _classThis = /** @class */ (function (_super) {
        __extends(EnhancedAgentCommunicationBus_1, _super);
        function EnhancedAgentCommunicationBus_1(llmService, logger // Inject logger
        ) {
            var _this = _super.call(this, llmService) || this;
            _this.messageHandlers = new Map();
            _this.responseCallbacks = new Map();
            _this.logger = logger; // Assign logger
            return _this;
        }
        EnhancedAgentCommunicationBus_1.prototype.registerMessageHandler = function (agentId, messageType, handler) {
            this.logger.debug("EnhancedAgentCommunicationBus: Registering handler for agent ".concat(agentId, ", message type ").concat(messageType));
            // Ensure the agent's handler map exists
            if (!this.messageHandlers.has(agentId)) {
                this.messageHandlers.set(agentId, new Map());
            }
            var agentHandlers = this.messageHandlers.get(agentId);
            // Only register if not already present or if different handler
            if (!agentHandlers.has(messageType) || agentHandlers.get(messageType) !== handler) {
                agentHandlers.set(messageType, handler);
            }
        };
        EnhancedAgentCommunicationBus_1.prototype.sendMessageAndWaitForResponse = function (targetAgentId_1, message_1) {
            return __awaiter(this, arguments, void 0, function (targetAgentId, message, timeoutMs // Increased timeout to 30 seconds
            ) {
                var responseId;
                var _this = this;
                if (timeoutMs === void 0) { timeoutMs = 30000; }
                return __generator(this, function (_a) {
                    responseId = message.correlationId;
                    return [2 /*return*/, new Promise(function (resolve) {
                            _this.logger.debug("[".concat(message.correlationId, "] Setting up response callback for ").concat(targetAgentId, ". Timeout: ").concat(timeoutMs, "ms"));
                            var timeout = setTimeout(function () {
                                _this.responseCallbacks.delete(responseId);
                                _this.logger.warn("[".concat(message.correlationId, "] Timeout triggered for ").concat(targetAgentId, ". Callback deleted."));
                                resolve({ success: false, error: new AgentError_1.AgentError("Timeout waiting for response from ".concat(targetAgentId, " for correlationId: ").concat(responseId), 'TIMEOUT_ERROR', message.sourceAgent, message.correlationId) });
                            }, timeoutMs);
                            _this.responseCallbacks.set(responseId, function (response) {
                                _this.logger.debug("[".concat(message.correlationId, "] Callback triggered for ").concat(targetAgentId, ". Clearing timeout and deleting callback."));
                                clearTimeout(timeout);
                                _this.responseCallbacks.delete(responseId);
                                if (response.type === AgentMessage_1.MessageTypes.ERROR) {
                                    var errorPayload = response.payload;
                                    resolve({ success: false, error: errorPayload });
                                }
                                else {
                                    resolve({ success: true, data: response });
                                }
                            });
                            _this.routeMessage(targetAgentId, message);
                        })];
                });
            });
        };
        EnhancedAgentCommunicationBus_1.prototype.routeMessage = function (targetAgentId, message) {
            return __awaiter(this, void 0, void 0, function () {
                var agentHandlers, handler, result, error_1, errorMessage;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            agentHandlers = this.messageHandlers.get(targetAgentId);
                            if (!agentHandlers) {
                                this.logger.warn("No handlers registered for agent: ".concat(targetAgentId, ". Current handlers:"), Array.from(this.messageHandlers.keys()));
                                // Send an error response if no handlers are found for the target agent
                                this.sendResponse(message.sourceAgent, (0, AgentMessage_1.createAgentMessage)(AgentMessage_1.MessageTypes.ERROR, new AgentError_1.AgentError("No handlers registered for agent: ".concat(targetAgentId), 'NO_HANDLER_REGISTERED', 'EnhancedAgentCommunicationBus', message.correlationId), 'EnhancedAgentCommunicationBus', message.conversationId, message.correlationId, message.sourceAgent));
                                return [2 /*return*/];
                            }
                            handler = agentHandlers.get(message.type);
                            if (!handler) {
                                this.logger.warn("No handler for message type ".concat(message.type, " in agent ").concat(targetAgentId));
                                // Send an error response if no handler is found for the message type
                                this.sendResponse(message.sourceAgent, (0, AgentMessage_1.createAgentMessage)(AgentMessage_1.MessageTypes.ERROR, new AgentError_1.AgentError("No handler for message type ".concat(message.type, " in agent ").concat(targetAgentId), 'NO_MESSAGE_TYPE_HANDLER', 'EnhancedAgentCommunicationBus', message.correlationId), 'EnhancedAgentCommunicationBus', message.conversationId, message.correlationId, message.sourceAgent));
                                return [2 /*return*/];
                            }
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 3, , 4]);
                            return [4 /*yield*/, handler(message)];
                        case 2:
                            result = _a.sent();
                            this.logger.debug("[".concat(message.correlationId, "] Handler for ").concat(targetAgentId, " returned result: success=").concat(result.success, ", data=").concat(result.success ? !!result.data : 'N/A', ", error=").concat(!result.success ? !!result.error : 'N/A'));
                            if (result.success) {
                                if (result.data) {
                                    if (message.correlationId) {
                                        this.logger.debug("[".concat(message.correlationId, "] Routing response from handler to sendResponse for ").concat(message.sourceAgent, "."));
                                        this.sendResponse(message.sourceAgent, result.data);
                                    }
                                }
                                else {
                                    this.logger.debug("[".concat(message.correlationId, "] Handler for ").concat(message.type, " in ").concat(targetAgentId, " returned null data."));
                                }
                            }
                            else {
                                this.logger.error("[".concat(message.correlationId, "] Handler for ").concat(message.type, " in ").concat(targetAgentId, " returned an error: ").concat(result.error.message));
                                this.sendResponse(message.sourceAgent, (0, AgentMessage_1.createAgentMessage)(AgentMessage_1.MessageTypes.ERROR, { message: result.error.message, code: result.error.code }, 'EnhancedAgentCommunicationBus', message.conversationId, message.correlationId, message.sourceAgent));
                            }
                            return [3 /*break*/, 4];
                        case 3:
                            error_1 = _a.sent();
                            errorMessage = error_1 instanceof Error ? error_1.message : String(error_1);
                            this.logger.error("[".concat(message.correlationId, "] Error handling message in agent ").concat(targetAgentId, ": ").concat(errorMessage));
                            this.sendResponse(message.sourceAgent, (0, AgentMessage_1.createAgentMessage)(AgentMessage_1.MessageTypes.ERROR, new AgentError_1.AgentError(errorMessage, 'HANDLER_EXECUTION_ERROR', 'EnhancedAgentCommunicationBus', message.correlationId), 'EnhancedAgentCommunicationBus', message.conversationId, message.correlationId, message.sourceAgent));
                            return [3 /*break*/, 4];
                        case 4: return [2 /*return*/];
                    }
                });
            });
        };
        EnhancedAgentCommunicationBus_1.prototype.sendResponse = function (targetAgentId, response) {
            this.logger.debug("EnhancedAgentCommunicationBus: sendResponse called for ".concat(targetAgentId, " with correlationId: ").concat(response.correlationId, ". Full response: ").concat(JSON.stringify(response)));
            var callback = this.responseCallbacks.get(response.correlationId);
            if (callback) {
                this.logger.debug("EnhancedAgentCommunicationBus: Callback found for correlationId: ".concat(response.correlationId, ". Executing callback."));
                callback(response);
            }
            else {
                this.logger.warn("EnhancedAgentCommunicationBus: No callback found for correlationId: ".concat(response.correlationId, ". Message will not be routed."));
            }
        };
        EnhancedAgentCommunicationBus_1.prototype.getName = function () {
            return 'EnhancedAgentCommunicationBus';
        };
        EnhancedAgentCommunicationBus_1.prototype.getCapabilities = function () {
            return ['message-routing', 'response-handling', 'error-handling'];
        };
        EnhancedAgentCommunicationBus_1.prototype.handleMessage = function (message) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    // The bus doesn't handle messages itself, it routes them to other agents
                    return [2 /*return*/, {
                            success: false,
                            error: new AgentError_1.AgentError('EnhancedAgentCommunicationBus does not handle messages directly', 'INVALID_MESSAGE_HANDLER', this.getName(), message.correlationId)
                        }];
                });
            });
        };
        EnhancedAgentCommunicationBus_1.prototype.publishToAgent = function (targetAgentId, message) {
            var _this = this;
            if (targetAgentId === '*') {
                // Broadcast to all registered agents
                this.messageHandlers.forEach(function (handlers, agentId) {
                    if (handlers.has(message.type)) {
                        // Only route if the agent has a handler for this message type
                        _this.logger.debug("Broadcasting message type ".concat(message.type, " to agent ").concat(agentId));
                        _this.routeMessage(agentId, message);
                    }
                });
            }
            else {
                // Normal routing for a specific agent
                this.routeMessage(targetAgentId, message);
            }
        };
        return EnhancedAgentCommunicationBus_1;
    }(_classSuper));
    __setFunctionName(_classThis, "EnhancedAgentCommunicationBus");
    (function () {
        var _a;
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create((_a = _classSuper[Symbol.metadata]) !== null && _a !== void 0 ? _a : null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        EnhancedAgentCommunicationBus = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return EnhancedAgentCommunicationBus = _classThis;
}();
exports.EnhancedAgentCommunicationBus = EnhancedAgentCommunicationBus;

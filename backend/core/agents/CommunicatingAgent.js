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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommunicatingAgent = void 0;
var AgentMessage_1 = require("./communication/AgentMessage");
var BaseAgent_1 = require("./BaseAgent");
var AgentError_1 = require("./AgentError");
var CommunicatingAgent = /** @class */ (function (_super) {
    __extends(CommunicatingAgent, _super);
    function CommunicatingAgent(id, config, dependencies // Inject dependencies
    ) {
        var _this = _super.call(this, id, config, dependencies) || this;
        _this.communicationBus = dependencies.communicationBus;
        _this.logger = dependencies.logger;
        _this.registerHandlers();
        return _this;
    }
    CommunicatingAgent.prototype.getCapabilities = function () {
        return ['communication'];
    };
    // Implement abstract methods from BaseAgent
    CommunicatingAgent.prototype.validateConfig = function (config) {
        // Basic validation, can be overridden by concrete agents
        if (!config) {
            this.logger.warn("[".concat(this.id, "] Agent config is empty."));
        }
    };
    CommunicatingAgent.prototype.getInitialState = function () {
        return {}; // Default empty state, can be overridden
    };
    CommunicatingAgent.prototype.registerHandlers = function () {
        // Concrete agents will register their specific handlers.
        // This base class does not register generic direct-message or broadcast handlers.
    };
    CommunicatingAgent.prototype.handleDirectMessage = function (message) {
        return __awaiter(this, void 0, void 0, function () {
            var traceId, result, errorMessage, error_1, errorMessage, agentError;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        traceId = message.correlationId;
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        this.logger.info("[".concat(traceId, "] Handling direct message for ").concat(this.id, ": ").concat(message.type));
                        return [4 /*yield*/, this.handleMessage(message)];
                    case 2:
                        result = _a.sent();
                        if (result.success) {
                            return [2 /*return*/, result]; // Simply return the result from the concrete agent's handleMessage
                        }
                        else {
                            errorMessage = (0, AgentMessage_1.createAgentMessage)('error-response', { error: result.error.message, code: result.error.code }, this.id, traceId, message.sourceAgent);
                            return [2 /*return*/, { success: false, error: result.error }];
                        }
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _a.sent();
                        errorMessage = error_1 instanceof Error ? error_1.message : String(error_1);
                        this.logger.error("[".concat(traceId, "] Error handling direct message for ").concat(this.id, ": ").concat(errorMessage), { error: error_1 });
                        agentError = new AgentError_1.AgentError("Failed to handle direct message: ".concat(errorMessage), 'COMMUNICATION_ERROR', this.id, traceId, true, // Assuming recoverable for now
                        { originalError: errorMessage });
                        return [2 /*return*/, { success: false, error: agentError }]; // Simply return the error
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    CommunicatingAgent.prototype.handleBroadcast = function (message) {
        return __awaiter(this, void 0, void 0, function () {
            var traceId, responseMessage, errorMessage, agentError;
            return __generator(this, function (_a) {
                traceId = message.correlationId;
                try {
                    this.logger.info("[".concat(traceId, "] Handling broadcast message for ").concat(this.id, ": ").concat(message.type));
                    responseMessage = (0, AgentMessage_1.createAgentMessage)('broadcast-ack', { status: 'acknowledged' }, this.id, traceId, message.sourceAgent // Acknowledge the sender
                    );
                    return [2 /*return*/, { success: true, data: responseMessage }];
                }
                catch (error) { // Explicitly type as unknown
                    errorMessage = error instanceof Error ? error.message : String(error);
                    this.logger.error("[".concat(traceId, "] Error handling broadcast message for ").concat(this.id, ": ").concat(errorMessage), { error: error });
                    agentError = new AgentError_1.AgentError("Failed to handle broadcast message: ".concat(errorMessage), 'COMMUNICATION_ERROR', this.id, traceId, true, { originalError: errorMessage });
                    return [2 /*return*/, { success: false, error: agentError }];
                }
                return [2 /*return*/];
            });
        });
    };
    CommunicatingAgent.prototype.sendToAgent = function (targetAgentId, type, payload, correlationId) {
        return __awaiter(this, void 0, void 0, function () {
            var msgCorrelationId, message, responseResult, error_2, errorMessage, agentError;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        msgCorrelationId = correlationId || this.generateCorrelationId();
                        message = (0, AgentMessage_1.createAgentMessage)(type, payload, this.id, msgCorrelationId, targetAgentId);
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        this.logger.info("[".concat(msgCorrelationId, "] Sending message to ").concat(targetAgentId, ": ").concat(type));
                        return [4 /*yield*/, this.communicationBus.sendMessageAndWaitForResponse(targetAgentId, message)];
                    case 2:
                        responseResult = _a.sent();
                        if (responseResult.success) {
                            // If data is null, it means the operation was successful but yielded no specific AgentMessage
                            // This is handled by the caller (e.g., routes.ts)
                            return [2 /*return*/, { success: true, data: responseResult.data }];
                        }
                        else {
                            return [2 /*return*/, { success: false, error: responseResult.error }];
                        }
                        return [3 /*break*/, 4];
                    case 3:
                        error_2 = _a.sent();
                        errorMessage = error_2 instanceof Error ? error_2.message : String(error_2);
                        this.logger.error("[".concat(msgCorrelationId, "] Failed to send message to ").concat(targetAgentId, ": ").concat(errorMessage), { error: error_2 });
                        agentError = new AgentError_1.AgentError("Failed to send message to ".concat(targetAgentId, ": ").concat(errorMessage), 'COMMUNICATION_ERROR', this.id, msgCorrelationId, true, { originalError: errorMessage });
                        return [2 /*return*/, { success: false, error: agentError }];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    CommunicatingAgent.prototype.broadcast = function (type, payload, correlationId) {
        var msgCorrelationId = correlationId || this.generateCorrelationId();
        var message = (0, AgentMessage_1.createAgentMessage)(type, payload, this.id, msgCorrelationId, '*' // Broadcast to all
        );
        this.logger.info("[".concat(msgCorrelationId, "] Broadcasting message: ").concat(type));
        this.communicationBus.publishToAgent('*', message);
    };
    CommunicatingAgent.prototype.generateCorrelationId = function () {
        return "".concat(this.id, "-").concat(Date.now(), "-").concat(Math.floor(Math.random() * 1000));
    };
    return CommunicatingAgent;
}(BaseAgent_1.BaseAgent));
exports.CommunicatingAgent = CommunicatingAgent;

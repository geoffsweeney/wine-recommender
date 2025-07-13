"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.AgentCommunicationBus = void 0;
var tsyringe_1 = require("tsyringe");
var events_1 = require("events");
var SharedContextMemory_1 = require("./SharedContextMemory");
var AgentError_1 = require("../core/agents/AgentError"); // Import AgentError
var AgentCommunicationBus = function () {
    var _classDecorators = [(0, tsyringe_1.injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var AgentCommunicationBus = _classThis = /** @class */ (function () {
        function AgentCommunicationBus_1(llmService) {
            // console.log('AgentCommunicationBus constructor entered.'); // Temporarily commented out for test clarity
            this.emitter = new events_1.EventEmitter();
            this.agents = new Map();
            this.subscriptions = new Map();
            this.contextMemory = new SharedContextMemory_1.SharedContextMemory();
            this.llmService = llmService;
        }
        AgentCommunicationBus_1.prototype.registerAgent = function (agentId, info) {
            this.agents.set(agentId, __assign(__assign({}, info), { id: agentId, lastSeen: new Date() }));
        };
        AgentCommunicationBus_1.prototype.publish = function (message, topic) {
            var eventName = topic ? "message:".concat(topic) : 'message';
            console.log("AgentCommunicationBus: Publishing message to event \"".concat(eventName, "\""), message); // Add logging
            this.emitter.emit(eventName, message);
        };
        AgentCommunicationBus_1.prototype.subscribe = function (agentId, callback, topic) {
            var eventName = topic ? "message:".concat(topic) : 'message';
            this.emitter.on(eventName, callback);
            this.updateSubscriptions(agentId, eventName);
        };
        AgentCommunicationBus_1.prototype.unsubscribe = function (agentId, callback, topic) {
            var eventName = topic ? "message:".concat(topic) : 'message';
            this.emitter.off(eventName, callback);
            this.updateSubscriptions(agentId, eventName, true);
        };
        AgentCommunicationBus_1.prototype.updateSubscriptions = function (agentId, eventName, remove) {
            if (remove === void 0) { remove = false; }
            if (!this.subscriptions.has(agentId)) {
                this.subscriptions.set(agentId, new Set());
            }
            var agentSubs = this.subscriptions.get(agentId);
            if (remove) {
                agentSubs.delete(eventName);
            }
            else {
                agentSubs.add(eventName);
            }
        };
        AgentCommunicationBus_1.prototype.getSubscriptions = function (agentId) {
            return Array.from(this.subscriptions.get(agentId) || []);
        };
        AgentCommunicationBus_1.prototype.getAgentInfo = function (agentId) {
            return this.agents.get(agentId);
        };
        AgentCommunicationBus_1.prototype.listAgents = function () {
            return Array.from(this.agents.values());
        };
        // Context Memory Integration
        AgentCommunicationBus_1.prototype.setContext = function (agentId, key, value, metadata) {
            var agent = this.agents.get(agentId);
            if (agent) {
                this.contextMemory.setContext(agent, key, value, metadata);
            }
        };
        AgentCommunicationBus_1.prototype.getContext = function (agentId, key) {
            var _a;
            var agent = this.agents.get(agentId);
            return agent ? (_a = this.contextMemory.getContext(agent, key)) === null || _a === void 0 ? void 0 : _a.value : undefined;
        };
        AgentCommunicationBus_1.prototype.getContextWithMetadata = function (agentId, key) {
            var agent = this.agents.get(agentId);
            return agent ? this.contextMemory.getContext(agent, key) : undefined;
        };
        AgentCommunicationBus_1.prototype.shareContext = function (sourceAgentId, targetAgentId, key) {
            var context = this.getContextWithMetadata(sourceAgentId, key);
            if (context) {
                this.setContext(targetAgentId, key, context.value, __assign({}, context.metadata));
            }
        };
        AgentCommunicationBus_1.prototype.broadcastContext = function (agentId, key) {
            var _this = this;
            var context = this.getContextWithMetadata(agentId, key);
            if (context) {
                this.listAgents()
                    .filter(function (agent) { return agent.id !== agentId; })
                    .forEach(function (agent) {
                    _this.setContext(agent.id, key, context.value, __assign({}, context.metadata));
                });
            }
        };
        /**
         * Sends a prompt to the configured LLM service.
         * @param prompt The prompt to send to the LLM.
         * @returns A promise that resolves with the LLM's response, or undefined if no LLM service is configured.
         */
        AgentCommunicationBus_1.prototype.sendLLMPrompt = function (prompt, correlationId) {
            return __awaiter(this, void 0, void 0, function () {
                var llmResponseResult, error_1, errorMessage;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!this.llmService) {
                                console.warn('LLMService is not configured in AgentCommunicationBus.');
                                return [2 /*return*/, { success: false, error: new AgentError_1.AgentError('LLMService not configured', 'LLM_SERVICE_NOT_CONFIGURED', 'AgentCommunicationBus', correlationId) }];
                            }
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 3, , 4]);
                            return [4 /*yield*/, this.llmService.sendPrompt('rawLlmPrompt', { promptContent: prompt }, { correlationId: correlationId })];
                        case 2:
                            llmResponseResult = _a.sent();
                            if (!llmResponseResult.success) {
                                return [2 /*return*/, { success: false, error: llmResponseResult.error }];
                            }
                            return [2 /*return*/, { success: true, data: llmResponseResult.data }];
                        case 3:
                            error_1 = _a.sent();
                            errorMessage = error_1 instanceof Error ? error_1.message : String(error_1);
                            return [2 /*return*/, { success: false, error: new AgentError_1.AgentError("Error from LLMService: ".concat(errorMessage), 'LLM_SERVICE_ERROR', 'AgentCommunicationBus', correlationId, true, { originalError: errorMessage }) }];
                        case 4: return [2 /*return*/];
                    }
                });
            });
        };
        /**
         * Sends a message to a specific agent.
         * @param recipientAgentId The ID of the recipient agent.
         * @param payload The message payload.
         */
        AgentCommunicationBus_1.prototype.sendMessage = function (recipientAgentId, payload) {
            console.log("AgentCommunicationBus: Sending message to ".concat(recipientAgentId, " with payload:"), payload);
            // In a real implementation, this would involve routing the message
            // to the appropriate agent instance. For now, we'll just emit an event.
            this.emitter.emit("agentMessage:".concat(recipientAgentId), payload);
        };
        return AgentCommunicationBus_1;
    }());
    __setFunctionName(_classThis, "AgentCommunicationBus");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        AgentCommunicationBus = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return AgentCommunicationBus = _classThis;
}();
exports.AgentCommunicationBus = AgentCommunicationBus;

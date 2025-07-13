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
exports.LLMService = void 0;
var tsyringe_1 = require("tsyringe");
var AgentError_1 = require("../core/agents/AgentError");
var result_utils_1 = require("../utils/result-utils");
var LLMService = function () {
    var _classDecorators = [(0, tsyringe_1.injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var LLMService = _classThis = /** @class */ (function () {
        function LLMService_1(promptManager, logger, apiUrl, model, apiKey) {
            this.promptManager = promptManager;
            this.logger = logger;
            this.config = { apiUrl: apiUrl, model: model, apiKey: apiKey };
        }
        LLMService_1.prototype.sendPrompt = function (task, variables, logContext) {
            return __awaiter(this, void 0, void 0, function () {
                var startTime, systemPromptResult, promptResult, fullPrompt, llmResponse, error_1;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            startTime = Date.now();
                            this.logger.info('Sending LLM prompt', __assign(__assign({}, logContext), { task: String(task) }));
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 6, , 7]);
                            return [4 /*yield*/, this.promptManager.ensureLoaded()];
                        case 2:
                            _a.sent();
                            return [4 /*yield*/, this.promptManager.getSystemPrompt()];
                        case 3:
                            systemPromptResult = _a.sent();
                            return [4 /*yield*/, this.promptManager.getPrompt(task, variables)];
                        case 4:
                            promptResult = _a.sent();
                            if (!promptResult.success) {
                                this.logger.error('Failed to get prompt from PromptManager', __assign(__assign({}, logContext), { task: String(task), error: promptResult.error.message }));
                                return [2 /*return*/, (0, result_utils_1.failure)(new AgentError_1.AgentError("Failed to get prompt for task ".concat(String(task), ": ").concat(promptResult.error.message), 'LLM_PROMPT_ERROR', 'LLMService', logContext.correlationId || 'unknown', true))];
                            }
                            fullPrompt = promptResult.data;
                            return [4 /*yield*/, this.callLlmApi(systemPromptResult, fullPrompt, logContext)];
                        case 5:
                            llmResponse = _a.sent();
                            this.logger.info('LLM prompt sent successfully', __assign(__assign({}, logContext), { task: String(task), duration: Date.now() - startTime }));
                            return [2 /*return*/, (0, result_utils_1.success)(llmResponse)];
                        case 6:
                            error_1 = _a.sent();
                            this.logger.error('Error sending LLM prompt', __assign(__assign({}, logContext), { task: String(task), error: error_1 instanceof Error ? error_1.message : String(error_1), stack: error_1 instanceof Error ? error_1.stack : undefined }));
                            return [2 /*return*/, (0, result_utils_1.failure)(new AgentError_1.AgentError("Error sending LLM prompt for task ".concat(String(task), ": ").concat(error_1 instanceof Error ? error_1.message : String(error_1)), 'LLM_API_CALL_FAILED', 'LLMService', logContext.correlationId || 'unknown', true, // Recoverable
                                { originalError: error_1 instanceof Error ? error_1.message : String(error_1) }))];
                        case 7: return [2 /*return*/];
                    }
                });
            });
        };
        LLMService_1.prototype.sendStructuredPrompt = function (task, variables, logContext) {
            return __awaiter(this, void 0, void 0, function () {
                var startTime, outputSchema, systemPromptResult, promptResult, fullPrompt, llmResponse, parsedResponse, error_2;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            startTime = Date.now();
                            this.logger.debug("LLMService: Entering sendStructuredPrompt. Task: ".concat(String(task), ", Raw Variables: ").concat(JSON.stringify(variables)));
                            this.logger.info('Sending structured LLM prompt', __assign(__assign({}, logContext), { task: String(task) }));
                            this.logger.debug("LLMService: sendStructuredPrompt called with task: ".concat(String(task), ", variables: ").concat(JSON.stringify(variables))); // Existing log
                            return [4 /*yield*/, this.promptManager.ensureLoaded()];
                        case 1:
                            _a.sent();
                            outputSchema = this.promptManager.getOutputSchemaForTask(task);
                            if (!outputSchema) {
                                this.logger.error("No output schema found for task ".concat(String(task)), __assign(__assign({}, logContext), { task: String(task) }));
                                return [2 /*return*/, (0, result_utils_1.failure)(new AgentError_1.AgentError("No output schema found for task ".concat(String(task)), 'LLM_STRUCTURED_PROMPT_ERROR', 'LLMService', logContext.correlationId || 'unknown', false))];
                            }
                            _a.label = 2;
                        case 2:
                            _a.trys.push([2, 7, , 8]);
                            return [4 /*yield*/, this.promptManager.ensureLoaded()];
                        case 3:
                            _a.sent();
                            return [4 /*yield*/, this.promptManager.getSystemPrompt()];
                        case 4:
                            systemPromptResult = _a.sent();
                            return [4 /*yield*/, this.promptManager.getPrompt(task, variables)];
                        case 5:
                            promptResult = _a.sent();
                            if (!promptResult.success) {
                                this.logger.error('Failed to get prompt from PromptManager for structured output', __assign(__assign({}, logContext), { task: String(task), error: promptResult.error.message }));
                                return [2 /*return*/, (0, result_utils_1.failure)(new AgentError_1.AgentError("Failed to get structured prompt for task ".concat(String(task), ": ").concat(promptResult.error.message), 'LLM_STRUCTURED_PROMPT_ERROR', 'LLMService', logContext.correlationId || 'unknown', true))];
                            }
                            fullPrompt = promptResult.data;
                            return [4 /*yield*/, this.callStructuredLlmApi(systemPromptResult, fullPrompt, logContext)];
                        case 6:
                            llmResponse = _a.sent();
                            // Validate the LLM response against the provided outputSchema
                            try {
                                this.logger.debug("LLMService: Raw LLM response before validation: ".concat(JSON.stringify(llmResponse)), logContext);
                                parsedResponse = outputSchema.parse(llmResponse);
                                this.logger.info('Structured LLM prompt sent successfully and response validated', __assign(__assign({}, logContext), { task: String(task), duration: Date.now() - startTime }));
                                return [2 /*return*/, (0, result_utils_1.success)(parsedResponse)];
                            }
                            catch (validationError) {
                                this.logger.error('Invalid LLM response: Failed to validate against output schema', __assign(__assign({}, logContext), { task: String(task), error: validationError instanceof Error ? validationError.message : String(validationError), response: llmResponse }));
                                return [2 /*return*/, (0, result_utils_1.failure)(new AgentError_1.AgentError("Invalid LLM response: Failed to validate against output schema: ".concat(validationError instanceof Error ? validationError.message : String(validationError)), 'LLM_RESPONSE_VALIDATION_ERROR', 'LLMService', logContext.correlationId || 'unknown', true, // Recoverable
                                    { originalError: validationError instanceof Error ? validationError.message : String(validationError) }))];
                            }
                            return [3 /*break*/, 8];
                        case 7:
                            error_2 = _a.sent();
                            this.logger.error('Error sending structured LLM prompt', __assign(__assign({}, logContext), { task: String(task), error: error_2 instanceof Error ? error_2.message : String(error_2), stack: error_2 instanceof Error ? error_2.stack : undefined }));
                            return [2 /*return*/, (0, result_utils_1.failure)(new AgentError_1.AgentError("Error sending structured LLM prompt for task ".concat(String(task), ": ").concat(error_2 instanceof Error ? error_2.message : String(error_2)), 'LLM_STRUCTURED_API_CALL_FAILED', 'LLMService', logContext.correlationId || 'unknown', true, // Recoverable
                                { originalError: error_2 instanceof Error ? error_2.message : String(error_2) }))];
                        case 8: return [2 /*return*/];
                    }
                });
            });
        };
        LLMService_1.prototype.callLlmApi = function (systemPrompt, userPrompt, logContext) {
            return __awaiter(this, void 0, void 0, function () {
                var response, errorBody, data, error_3;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 5, , 6]);
                            return [4 /*yield*/, fetch("".concat(this.config.apiUrl, "/api/chat"), {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        // 'Authorization': `Bearer ${this.config.apiKey}`, // Ollama typically doesn't use API keys
                                    },
                                    body: JSON.stringify({
                                        model: this.config.model,
                                        messages: [
                                            { role: 'system', content: systemPrompt },
                                            { role: 'user', content: userPrompt },
                                        ],
                                        stream: false, // We want a single response
                                    }),
                                })];
                        case 1:
                            response = _a.sent();
                            if (!!response.ok) return [3 /*break*/, 3];
                            return [4 /*yield*/, response.text()];
                        case 2:
                            errorBody = _a.sent();
                            throw new Error("Ollama API call failed with status ".concat(response.status, ": ").concat(errorBody));
                        case 3: return [4 /*yield*/, response.json()];
                        case 4:
                            data = (_a.sent());
                            return [2 /*return*/, data.message.content];
                        case 5:
                            error_3 = _a.sent();
                            this.logger.error('Error during Ollama API call', __assign(__assign({}, logContext), { error: error_3 instanceof Error ? error_3.message : String(error_3), stack: error_3 instanceof Error ? error_3.stack : undefined }));
                            throw error_3; // Re-throw to be caught by the calling method
                        case 6: return [2 /*return*/];
                    }
                });
            });
        };
        LLMService_1.prototype.callStructuredLlmApi = function (systemPrompt, userPrompt, logContext) {
            return __awaiter(this, void 0, void 0, function () {
                var response, errorBody, data, error_4;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 5, , 6]);
                            return [4 /*yield*/, fetch("".concat(this.config.apiUrl, "/api/chat"), {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        // 'Authorization': `Bearer ${this.config.apiKey}`,
                                    },
                                    body: JSON.stringify({
                                        model: this.config.model,
                                        messages: [
                                            { role: 'system', content: systemPrompt },
                                            { role: 'user', content: userPrompt },
                                        ],
                                        format: 'json', // Request JSON format
                                        stream: false,
                                        // Ollama doesn't directly support 'response_model' like some other LLMs,
                                        // but 'format: "json"' combined with a good system prompt usually suffices.
                                        // If a specific JSON schema validation is needed, it would be done client-side.
                                    }),
                                })];
                        case 1:
                            response = _a.sent();
                            if (!!response.ok) return [3 /*break*/, 3];
                            return [4 /*yield*/, response.text()];
                        case 2:
                            errorBody = _a.sent();
                            throw new Error("Ollama structured API call failed with status ".concat(response.status, ": ").concat(errorBody));
                        case 3: return [4 /*yield*/, response.json()];
                        case 4:
                            data = (_a.sent());
                            // Ollama returns the JSON object directly in data.message.content if format: 'json' is used.
                            // It might be a stringified JSON, so we need to parse it.
                            try {
                                return [2 /*return*/, JSON.parse(data.message.content)];
                            }
                            catch (parseError) {
                                this.logger.error('Failed to parse structured LLM response as JSON', __assign(__assign({}, logContext), { responseContent: data.message.content, error: parseError instanceof Error ? parseError.message : String(parseError) }));
                                throw new Error('Invalid JSON response from LLM');
                            }
                            return [3 /*break*/, 6];
                        case 5:
                            error_4 = _a.sent();
                            this.logger.error('Error during Ollama structured API call', __assign(__assign({}, logContext), { error: error_4 instanceof Error ? error_4.message : String(error_4), stack: error_4 instanceof Error ? error_4.stack : undefined }));
                            throw error_4; // Re-throw to be caught by the calling method
                        case 6: return [2 /*return*/];
                    }
                });
            });
        };
        return LLMService_1;
    }());
    __setFunctionName(_classThis, "LLMService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        LLMService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return LLMService = _classThis;
}();
exports.LLMService = LLMService;

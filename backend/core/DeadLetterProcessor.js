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
exports.BasicDeadLetterProcessor = exports.LoggingDeadLetterHandler = exports.DeadLetterProcessor = void 0;
var tsyringe_1 = require("tsyringe");
/**
 * Abstract base class for processing failed messages with retry capabilities.
 * Handles failed message processing by:
 * 1. Attempting to retry processing through all registered handlers
 * 2. Falling back to permanent failure handling if retries are exhausted
 *
 * @example Basic Usage
 * ```typescript
 * class MyDeadLetterProcessor extends DeadLetterProcessor {
 *   constructor() {
 *     super({
 *       maxReplayAttempts: 3,
 *       retryManager: new RetryManagerImpl()
 *     }, [new LoggingHandler(), new DatabaseHandler()]);
 *   }
 *
 *   protected async handlePermanentFailure(
 *     message: unknown,
 *     error: Error,
 *     metadata: Record<string, unknown>
 *   ): Promise<void> {
 *     // Custom permanent failure logic
 *   }
 * }
 *
 * const processor = new MyDeadLetterProcessor();
 * await processor.process(failedMessage, error);
 * ```
 *
 * @example With Metadata
 * ```typescript
 * await processor.process(message, error, {
 *   queue: 'orders',
 *   attemptCount: 2
 * });
 * ```
 */
var DeadLetterProcessor = /** @class */ (function () {
    function DeadLetterProcessor(options, handlers) {
        if (handlers === void 0) { handlers = []; }
        this.options = Object.freeze(__assign({}, options));
        this.handlers = __spreadArray([], handlers, true);
    }
    DeadLetterProcessor.prototype.process = function (message_1, error_1) {
        return __awaiter(this, arguments, void 0, function (message, error, metadata) {
            var finalError_1;
            var _this = this;
            if (metadata === void 0) { metadata = {}; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 4]);
                        return [4 /*yield*/, this.options.retryManager.executeWithRetry(function () { return __awaiter(_this, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, Promise.all(this.handlers.map(function (handler) {
                                                return handler.handle(message, error, metadata);
                                            }))];
                                        case 1:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            }); })];
                    case 1:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 2:
                        finalError_1 = _a.sent();
                        return [4 /*yield*/, this.handlePermanentFailure(message, error, metadata)];
                    case 3:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    return DeadLetterProcessor;
}());
exports.DeadLetterProcessor = DeadLetterProcessor;
/**
 * A basic DeadLetterHandler that logs failed messages.
 */
var LoggingDeadLetterHandler = function () {
    var _classDecorators = [(0, tsyringe_1.injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var LoggingDeadLetterHandler = _classThis = /** @class */ (function () {
        function LoggingDeadLetterHandler_1() {
        }
        LoggingDeadLetterHandler_1.prototype.handle = function (message, error, metadata) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    console.error('LoggingDeadLetterHandler: Failed message received:', {
                        message: message,
                        error: error.message,
                        metadata: metadata,
                    });
                    return [2 /*return*/];
                });
            });
        };
        return LoggingDeadLetterHandler_1;
    }());
    __setFunctionName(_classThis, "LoggingDeadLetterHandler");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        LoggingDeadLetterHandler = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return LoggingDeadLetterHandler = _classThis;
}();
exports.LoggingDeadLetterHandler = LoggingDeadLetterHandler;
/**
 * A concrete DeadLetterProcessor that uses an in-memory queue for permanent failures
 * and includes a logging handler.
 */
var BasicDeadLetterProcessor = function () {
    var _classDecorators = [(0, tsyringe_1.injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var _classSuper = DeadLetterProcessor;
    var BasicDeadLetterProcessor = _classThis = /** @class */ (function (_super) {
        __extends(BasicDeadLetterProcessor_1, _super);
        function BasicDeadLetterProcessor_1(dlq, loggingHandler, retryManager) {
            var _this = this;
            // Configure options for the base DeadLetterProcessor
            var options = {
                maxReplayAttempts: 3, // Example: allow up to 3 retry attempts
                retryManager: retryManager,
            };
            // Register the logging handler with the base processor
            _this = _super.call(this, options, [loggingHandler]) || this;
            _this.dlq = dlq;
            return _this;
        }
        BasicDeadLetterProcessor_1.prototype.handlePermanentFailure = function (message, error, metadata) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    console.error('BasicDeadLetterProcessor: Handling permanent failure. Adding to DLQ.');
                    // Add the failed message to the in-memory DLQ
                    this.dlq.add({
                        message: message,
                        error: error.message,
                        metadata: metadata,
                        timestamp: new Date().toISOString(),
                    });
                    return [2 /*return*/];
                });
            });
        };
        BasicDeadLetterProcessor_1.prototype.addToDLQ = function (error, message, metadata) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    console.error('BasicDeadLetterProcessor: Adding to DLQ.');
                    this.dlq.add({
                        message: message,
                        error: error.message,
                        metadata: metadata,
                        timestamp: new Date().toISOString(),
                    });
                    return [2 /*return*/];
                });
            });
        };
        return BasicDeadLetterProcessor_1;
    }(_classSuper));
    __setFunctionName(_classThis, "BasicDeadLetterProcessor");
    (function () {
        var _a;
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create((_a = _classSuper[Symbol.metadata]) !== null && _a !== void 0 ? _a : null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        BasicDeadLetterProcessor = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return BasicDeadLetterProcessor = _classThis;
}();
exports.BasicDeadLetterProcessor = BasicDeadLetterProcessor;

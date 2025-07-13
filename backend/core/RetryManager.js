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
exports.FixedDelayPolicy = exports.ExponentialBackoffPolicy = exports.RetryManager = void 0;
/**
 * Abstract base class for managing retry operations with circuit breaker integration
 * @example
 * ```typescript
 * const retryManager = new (class extends RetryManager {
 *   constructor() {
 *     super(
 *       { maxAttempts: 3, circuitBreaker: new CircuitBreakerImpl() },
 *       [new ExponentialBackoffPolicy(100, 1000)]
 *     );
 *   }
 * })();
 *
 * await retryManager.executeWithRetry(() => fetchData());
 * ```
 */
var RetryManager = /** @class */ (function () {
    function RetryManager(options, policies) {
        this.options = Object.freeze(__assign({}, options));
        this.policies = __spreadArray([], policies, true);
    }
    RetryManager.prototype.executeWithRetry = function (fn) {
        return __awaiter(this, void 0, void 0, function () {
            var attempt, lastError, _loop_1, this_1, state_1;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        attempt = 0;
                        lastError = new Error('No attempts made');
                        _loop_1 = function () {
                            var _b, error_1, delay_1;
                            return __generator(this, function (_c) {
                                switch (_c.label) {
                                    case 0:
                                        attempt++;
                                        _c.label = 1;
                                    case 1:
                                        _c.trys.push([1, 3, , 6]);
                                        _b = {};
                                        return [4 /*yield*/, this_1.options.circuitBreaker.execute(function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                                                return [2 /*return*/, fn()];
                                            }); }); })];
                                    case 2: return [2 /*return*/, (_b.value = _c.sent(), _b)];
                                    case 3:
                                        error_1 = _c.sent();
                                        lastError = error_1;
                                        if (!this_1.shouldRetry(attempt, lastError)) {
                                            return [2 /*return*/, "break"];
                                        }
                                        delay_1 = this_1.getDelay(attempt);
                                        if (!(delay_1 > 0)) return [3 /*break*/, 5];
                                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, delay_1); })];
                                    case 4:
                                        _c.sent();
                                        _c.label = 5;
                                    case 5: return [3 /*break*/, 6];
                                    case 6: return [2 /*return*/];
                                }
                            });
                        };
                        this_1 = this;
                        _a.label = 1;
                    case 1:
                        if (!(attempt < this.options.maxAttempts)) return [3 /*break*/, 3];
                        return [5 /*yield**/, _loop_1()];
                    case 2:
                        state_1 = _a.sent();
                        if (typeof state_1 === "object")
                            return [2 /*return*/, state_1.value];
                        if (state_1 === "break")
                            return [3 /*break*/, 3];
                        return [3 /*break*/, 1];
                    case 3: throw lastError;
                }
            });
        });
    };
    RetryManager.prototype.shouldRetry = function (attempt, error) {
        return this.policies.some(function (policy) { return policy.shouldRetry(attempt, error); });
    };
    RetryManager.prototype.getDelay = function (attempt) {
        return Math.max.apply(Math, this.policies.map(function (policy) { return policy.getDelay(attempt); }));
    };
    return RetryManager;
}());
exports.RetryManager = RetryManager;
/**
 * Implements exponential backoff retry policy
 * @example
 * ```typescript
 * const policy = new ExponentialBackoffPolicy(100, 1000);
 * ```
 */
var ExponentialBackoffPolicy = /** @class */ (function () {
    function ExponentialBackoffPolicy(baseDelay, maxDelay, retryableErrors) {
        if (retryableErrors === void 0) { retryableErrors = [Error]; }
        this.baseDelay = baseDelay;
        this.maxDelay = maxDelay;
        this.retryableErrors = retryableErrors;
    }
    ExponentialBackoffPolicy.prototype.shouldRetry = function (attempt, error) {
        return this.retryableErrors.some(function (ErrorType) { return error instanceof ErrorType; });
    };
    ExponentialBackoffPolicy.prototype.getDelay = function (attempt) {
        return Math.min(this.baseDelay * Math.pow(2, attempt - 1), this.maxDelay);
    };
    return ExponentialBackoffPolicy;
}());
exports.ExponentialBackoffPolicy = ExponentialBackoffPolicy;
/**
 * Implements fixed delay retry policy
 * @example
 * ```typescript
 * const policy = new FixedDelayPolicy(200);
 * ```
 */
var FixedDelayPolicy = /** @class */ (function () {
    function FixedDelayPolicy(delay, retryableErrors) {
        if (retryableErrors === void 0) { retryableErrors = [Error]; }
        this.delay = delay;
        this.retryableErrors = retryableErrors;
    }
    FixedDelayPolicy.prototype.shouldRetry = function (attempt, error) {
        return this.retryableErrors.some(function (ErrorType) { return error instanceof ErrorType; });
    };
    FixedDelayPolicy.prototype.getDelay = function (attempt) {
        return this.delay;
    };
    return FixedDelayPolicy;
}());
exports.FixedDelayPolicy = FixedDelayPolicy;

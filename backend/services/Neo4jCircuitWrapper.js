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
exports.Neo4jCircuitWrapper = void 0;
var tsyringe_1 = require("tsyringe"); // Import injectable and inject
var AgentError_1 = require("../core/agents/AgentError"); // Import AgentError
var CircuitBreaker_1 = require("../core/CircuitBreaker");
var Neo4jCircuitWrapper = function () {
    var _classDecorators = [(0, tsyringe_1.injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var Neo4jCircuitWrapper = _classThis = /** @class */ (function () {
        function Neo4jCircuitWrapper_1(driver, options, logger) {
            var _this = this;
            this.driver = driver;
            this.logger = logger;
            var circuitOptions = __assign(__assign({}, options), { fallback: function (error) {
                    _this.logger.warn('Circuit breaker is open - operation blocked', { error: error.message });
                    throw new Error("Circuit breaker is open: ".concat(error.message));
                } });
            this.circuit = new CircuitBreaker_1.CircuitBreaker(circuitOptions);
        }
        Neo4jCircuitWrapper_1.prototype.execute = function (fn) {
            return __awaiter(this, void 0, void 0, function () {
                var _this = this;
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.circuit.execute(function () { return fn(_this.driver); })];
                });
            });
        };
        Neo4jCircuitWrapper_1.prototype.executeQuery = function (query, params) {
            return __awaiter(this, void 0, void 0, function () {
                var operation, result, error_1, errorMessage;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            this.logger.debug('Executing Neo4j query', { query: query, params: params });
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 3, , 4]);
                            operation = function () { return __awaiter(_this, void 0, void 0, function () {
                                var session, result_1, closeError_1;
                                var _this = this;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            session = null;
                                            _a.label = 1;
                                        case 1:
                                            _a.trys.push([1, , 3, 8]);
                                            session = this.driver.session();
                                            this.logger.debug('Neo4jCircuitWrapper: Calling session.run with query and params:', { query: query, params: params }); // New log
                                            return [4 /*yield*/, session.run(query, params || {})];
                                        case 2:
                                            result_1 = _a.sent();
                                            if (!(result_1 === null || result_1 === void 0 ? void 0 : result_1.records)) {
                                                this.logger.debug('Query returned no records');
                                                return [2 /*return*/, []];
                                            }
                                            return [2 /*return*/, result_1.records.map(function (record) {
                                                    _this.logger.debug('Processing Neo4j record:', { recordKeys: record.keys, recordValues: record.toObject() });
                                                    try {
                                                        var extractedData_1 = {};
                                                        record.keys.forEach(function (key) {
                                                            var stringKey = key.toString(); // Convert symbol keys to string representation
                                                            var value = record.get(key);
                                                            if (value && typeof value === 'object' && value.properties) {
                                                                // If the value is a Neo4j Node or Relationship, extract its properties
                                                                extractedData_1[stringKey] = __assign({}, value.properties);
                                                                if (value.elementId) {
                                                                    extractedData_1[stringKey].id = value.elementId; // Add elementId as 'id' to the extracted object
                                                                }
                                                            }
                                                            else if (value && typeof value === 'object' && value.low !== undefined && value.high !== undefined) {
                                                                // Handle Neo4j Integer type
                                                                extractedData_1[stringKey] = value.toNumber();
                                                            }
                                                            else {
                                                                // For other direct values or non-node/relationship objects
                                                                extractedData_1[stringKey] = value;
                                                            }
                                                        });
                                                        return extractedData_1;
                                                    }
                                                    catch (parseError) {
                                                        _this.logger.error('Failed to parse Neo4j record', {
                                                            error: parseError,
                                                            recordKeys: record.keys,
                                                            recordObject: record.toObject()
                                                        });
                                                        return record.toObject(); // Fallback to original toObject
                                                    }
                                                })];
                                        case 3:
                                            if (!session) return [3 /*break*/, 7];
                                            _a.label = 4;
                                        case 4:
                                            _a.trys.push([4, 6, , 7]);
                                            return [4 /*yield*/, session.close()];
                                        case 5:
                                            _a.sent();
                                            return [3 /*break*/, 7];
                                        case 6:
                                            closeError_1 = _a.sent();
                                            this.logger.warn('Failed to close Neo4j session', { closeError: closeError_1 });
                                            return [3 /*break*/, 7];
                                        case 7: return [7 /*endfinally*/];
                                        case 8: return [2 /*return*/];
                                    }
                                });
                            }); };
                            return [4 /*yield*/, this.circuit.execute(operation)];
                        case 2:
                            result = _a.sent();
                            return [2 /*return*/, { success: true, data: result }];
                        case 3:
                            error_1 = _a.sent();
                            errorMessage = error_1 instanceof Error ? error_1.message : String(error_1);
                            this.logger.error('Neo4j query execution failed', {
                                error: error_1,
                                query: query,
                                params: params,
                                errorMessage: errorMessage
                            });
                            return [2 /*return*/, { success: false, error: new AgentError_1.AgentError("Neo4j query failed: ".concat(errorMessage), 'NEO4J_QUERY_FAILED', 'Neo4jCircuitWrapper', 'N/A', true, { originalError: errorMessage }) }];
                        case 4: return [2 /*return*/];
                    }
                });
            });
        };
        Neo4jCircuitWrapper_1.prototype.verifyConnection = function () {
            return __awaiter(this, void 0, void 0, function () {
                var error_2, errorMessage;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            return [4 /*yield*/, this.circuit.execute(function () { return __awaiter(_this, void 0, void 0, function () {
                                    var session;
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0:
                                                session = null;
                                                _a.label = 1;
                                            case 1:
                                                _a.trys.push([1, , 3, 6]);
                                                session = this.driver.session();
                                                return [4 /*yield*/, session.run('RETURN 1 as test')];
                                            case 2:
                                                _a.sent();
                                                this.logger.debug('Neo4j connection verified successfully');
                                                return [3 /*break*/, 6];
                                            case 3:
                                                if (!session) return [3 /*break*/, 5];
                                                return [4 /*yield*/, session.close()];
                                            case 4:
                                                _a.sent();
                                                _a.label = 5;
                                            case 5: return [7 /*endfinally*/];
                                            case 6: return [2 /*return*/];
                                        }
                                    });
                                }); })];
                        case 1:
                            _a.sent();
                            return [2 /*return*/, { success: true, data: true }];
                        case 2:
                            error_2 = _a.sent();
                            errorMessage = error_2 instanceof Error ? error_2.message : String(error_2);
                            this.logger.error('Neo4j connection verification failed', { error: errorMessage });
                            return [2 /*return*/, { success: false, error: new AgentError_1.AgentError("Neo4j connection failed: ".concat(errorMessage), 'NEO4J_CONNECTION_FAILED', 'Neo4jCircuitWrapper', 'N/A', false, { originalError: errorMessage }) }];
                        case 3: return [2 /*return*/];
                    }
                });
            });
        };
        Neo4jCircuitWrapper_1.prototype.close = function () {
            return __awaiter(this, void 0, void 0, function () {
                var error_3;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            return [4 /*yield*/, this.driver.close()];
                        case 1:
                            _a.sent();
                            this.logger.info('Neo4j driver closed successfully');
                            return [3 /*break*/, 3];
                        case 2:
                            error_3 = _a.sent();
                            this.logger.error('Failed to close Neo4j driver', { error: error_3 });
                            throw error_3;
                        case 3: return [2 /*return*/];
                    }
                });
            });
        };
        Neo4jCircuitWrapper_1.prototype.getCircuitState = function () {
            return this.circuit.getState();
        };
        return Neo4jCircuitWrapper_1;
    }());
    __setFunctionName(_classThis, "Neo4jCircuitWrapper");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        Neo4jCircuitWrapper = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return Neo4jCircuitWrapper = _classThis;
}();
exports.Neo4jCircuitWrapper = Neo4jCircuitWrapper;

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
exports.Neo4jService = void 0;
var neo4j_driver_1 = require("neo4j-driver");
var tsyringe_1 = require("tsyringe");
var AgentError_1 = require("../core/agents/AgentError"); // Import AgentError
var Neo4jService = function () {
    var _classDecorators = [(0, tsyringe_1.injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var Neo4jService = _classThis = /** @class */ (function () {
        function Neo4jService_1(uri, user, password, circuit, logger) {
            this.uri = uri;
            this.user = user;
            this.password = password;
            this.circuit = circuit;
            this.logger = logger;
            this.driver = null;
        }
        Neo4jService_1.prototype.init = function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    if (this.driver) {
                        this.logger.info('Neo4j driver already initialized.');
                        return [2 /*return*/];
                    }
                    try {
                        this.driver = neo4j_driver_1.default.driver(this.uri, neo4j_driver_1.default.auth.basic(this.user, this.password), {
                            maxConnectionLifetime: 3 * 60 * 60 * 1000, // 3 hours
                            maxConnectionPoolSize: 50,
                            connectionAcquisitionTimeout: 2 * 60 * 1000, // 2 minutes
                            disableLosslessIntegers: false
                        });
                        this.logger.info('Neo4j driver initialized successfully');
                    }
                    catch (error) {
                        this.logger.error('Failed to initialize Neo4j driver', { error: error });
                        throw error;
                    }
                    return [2 /*return*/];
                });
            });
        };
        Neo4jService_1.prototype.executeQuery = function (query, params) {
            return __awaiter(this, void 0, void 0, function () {
                var processedParams, circuitResult;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!!this.driver) return [3 /*break*/, 2];
                            return [4 /*yield*/, this.init()];
                        case 1:
                            _a.sent(); // Initialize driver if not already
                            _a.label = 2;
                        case 2:
                            processedParams = params ? this.convertToNeo4jTypes(params) : undefined;
                            return [4 /*yield*/, this.circuit.executeQuery(query, processedParams)];
                        case 3:
                            circuitResult = _a.sent();
                            if (!circuitResult.success) {
                                throw circuitResult.error; // Propagate AgentError
                            }
                            return [2 /*return*/, circuitResult.data];
                    }
                });
            });
        };
        Neo4jService_1.prototype.convertToNeo4jTypes = function (params) {
            var _this = this;
            var processed = {};
            for (var _i = 0, _a = Object.entries(params); _i < _a.length; _i++) {
                var _b = _a[_i], key = _b[0], value = _b[1];
                if (value === null || value === undefined) {
                    processed[key] = value;
                }
                else if (typeof value === "number" && Number.isFinite(value)) {
                    // Convert integers to Neo4j integer type for specific parameters
                    if (Number.isInteger(value) && (key === 'limit' ||
                        key === 'skip' ||
                        key.toLowerCase().includes('count') ||
                        (key.toLowerCase().includes('id') && !key.toLowerCase().includes('uuid')))) {
                        processed[key] = (0, neo4j_driver_1.int)(Math.floor(Math.abs(value)));
                    }
                    else {
                        processed[key] = value;
                    }
                }
                else if (Array.isArray(value)) {
                    processed[key] = value.map(function (item) {
                        if (typeof item === "number" && Number.isInteger(item)) {
                            return (0, neo4j_driver_1.int)(item);
                        }
                        return typeof item === "object" && item !== null
                            ? _this.convertToNeo4jTypes(item)
                            : item;
                    });
                }
                else if (typeof value === "object" && value !== null && !(value instanceof Date)) {
                    processed[key] = this.convertToNeo4jTypes(value);
                }
                else {
                    processed[key] = value;
                }
            }
            return processed;
        };
        Neo4jService_1.prototype.verifyConnection = function () {
            return __awaiter(this, void 0, void 0, function () {
                var verificationResult;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!this.driver) {
                                this.logger.warn('Cannot verify connection - driver not initialized');
                                return [2 /*return*/, { success: false, error: new AgentError_1.AgentError('Neo4j driver not initialized', 'NEO4J_DRIVER_NOT_INITIALIZED', 'Neo4jService', 'N/A', false) }];
                            }
                            return [4 /*yield*/, this.circuit.verifyConnection()];
                        case 1:
                            verificationResult = _a.sent();
                            if (!verificationResult.success) {
                                return [2 /*return*/, { success: false, error: verificationResult.error }];
                            }
                            return [2 /*return*/, { success: true, data: verificationResult.data }];
                    }
                });
            });
        };
        Neo4jService_1.prototype.close = function () {
            return __awaiter(this, void 0, void 0, function () {
                var error_1;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!this.driver) return [3 /*break*/, 4];
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 3, , 4]);
                            return [4 /*yield*/, this.circuit.close()];
                        case 2:
                            _a.sent();
                            this.driver = null;
                            this.logger.info('Neo4j service closed successfully');
                            return [3 /*break*/, 4];
                        case 3:
                            error_1 = _a.sent();
                            this.logger.error('Failed to close Neo4j service', { error: error_1 });
                            throw error_1;
                        case 4: return [2 /*return*/];
                    }
                });
            });
        };
        Neo4jService_1.prototype.getCircuitState = function () {
            return this.circuit.getCircuitState();
        };
        // Health check method for monitoring
        Neo4jService_1.prototype.healthCheck = function () {
            return __awaiter(this, void 0, void 0, function () {
                var circuitState, connectionVerificationResult, connectionVerified;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            circuitState = this.getCircuitState();
                            return [4 /*yield*/, this.verifyConnection()];
                        case 1:
                            connectionVerificationResult = _a.sent();
                            connectionVerified = connectionVerificationResult.success && connectionVerificationResult.data;
                            return [2 /*return*/, {
                                    status: connectionVerified && circuitState === 'CLOSED' ? 'healthy' : 'unhealthy',
                                    circuitState: circuitState,
                                    connectionVerified: connectionVerified
                                }];
                    }
                });
            });
        };
        return Neo4jService_1;
    }());
    __setFunctionName(_classThis, "Neo4jService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        Neo4jService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return Neo4jService = _classThis;
}();
exports.Neo4jService = Neo4jService;

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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KnowledgeGraphService = void 0;
var tsyringe_1 = require("tsyringe");
var KnowledgeGraphService = function () {
    var _classDecorators = [(0, tsyringe_1.injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var KnowledgeGraphService = _classThis = /** @class */ (function () {
        function KnowledgeGraphService_1(neo4j, logger) {
            this.neo4j = neo4j;
            this.logger = logger;
            this.logger.info('KnowledgeGraphService initialized');
        }
        /**
         * Add or update a user preference node and relationship.
         * This method now handles an array of preferences.
         */
        KnowledgeGraphService_1.prototype.addOrUpdateUserPreferences = function (userId, preferences) {
            return __awaiter(this, void 0, void 0, function () {
                var _i, preferences_1, preference;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _i = 0, preferences_1 = preferences;
                            _a.label = 1;
                        case 1:
                            if (!(_i < preferences_1.length)) return [3 /*break*/, 4];
                            preference = preferences_1[_i];
                            return [4 /*yield*/, this.neo4j.executeQuery("\n        MERGE (u:User {id: $userId})\n        MERGE (p:Preference {type: $type, value: $value})\n        ON CREATE SET p.source = $source, p.confidence = $confidence, p.timestamp = $timestamp, p.active = $active\n        ON MATCH SET p.source = $source, p.confidence = $confidence, p.timestamp = $timestamp, p.active = $active\n        MERGE (u)-[:HAS_PREFERENCE]->(p)\n      ", {
                                    userId: userId,
                                    type: preference.type,
                                    value: preference.value,
                                    source: preference.source,
                                    confidence: preference.confidence,
                                    timestamp: preference.timestamp,
                                    active: preference.active,
                                })];
                        case 2:
                            _a.sent();
                            _a.label = 3;
                        case 3:
                            _i++;
                            return [3 /*break*/, 1];
                        case 4: return [2 /*return*/];
                    }
                });
            });
        };
        /**
         * Get all user preferences from the graph.
         */
        KnowledgeGraphService_1.prototype.getAllUserPreferences = function () {
            return __awaiter(this, void 0, void 0, function () {
                var query, results, groupedPreferences;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            query = "\n      MATCH (u:User)-[:HAS_PREFERENCE]->(p:Preference)\n      RETURN u.id AS userId, p\n    ";
                            return [4 /*yield*/, this.neo4j.executeQuery(query)];
                        case 1:
                            results = _a.sent();
                            groupedPreferences = {};
                            results.forEach(function (record) {
                                var userId = record.userId;
                                var preference = record.p;
                                if (!groupedPreferences[userId]) {
                                    groupedPreferences[userId] = [];
                                }
                                groupedPreferences[userId].push(preference);
                            });
                            return [2 /*return*/, Object.entries(groupedPreferences).map(function (_a) {
                                    var userId = _a[0], prefs = _a[1];
                                    return ({ userId: userId, preferences: prefs });
                                })];
                    }
                });
            });
        };
        /**
         * Get user preferences, optionally including inactive ones.
         */
        KnowledgeGraphService_1.prototype.getPreferences = function (userId_1) {
            return __awaiter(this, arguments, void 0, function (userId, includeInactive) {
                var query, results;
                if (includeInactive === void 0) { includeInactive = false; }
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            query = includeInactive
                                ? "\n      MATCH (u:User {id: $userId})-[:HAS_PREFERENCE]->(p:Preference)\n     RETURN p"
                                : "\n      MATCH (u:User {id: $userId})-[:HAS_PREFERENCE]->(p:Preference)\n     WHERE p.active = true RETURN p";
                            return [4 /*yield*/, this.neo4j.executeQuery(query, { userId: userId })];
                        case 1:
                            results = _a.sent();
                            // The executeQuery now returns objects with the 'p' key containing the extracted properties
                            return [2 /*return*/, results.map(function (record) { return record.p; })];
                    }
                });
            });
        };
        /**
         * Delete a user preference by type and value.
         */
        KnowledgeGraphService_1.prototype.deletePreference = function (userId, type, value) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.neo4j.executeQuery("\n      MATCH (u:User {id: $userId})-[r:HAS_PREFERENCE]->(p:Preference {type: $type, value: $value})\n      DELETE r, p\n    ", { userId: userId, type: type, value: value })];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        };
        /**
         * Delete all preferences for a given user.
         */
        KnowledgeGraphService_1.prototype.deleteAllPreferencesForUser = function (userId) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.neo4j.executeQuery("\n      MATCH (u:User {id: $userId})-[r:HAS_PREFERENCE]->(p:Preference)\n      DELETE r, p\n    ", { userId: userId })];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        };
        // ...existing methods continue here (no duplicate class declaration)...
        KnowledgeGraphService_1.prototype.findSimilarWines = function (wineId_1) {
            return __awaiter(this, arguments, void 0, function (wineId, limit) {
                var integerLimit, cypher, similarWines;
                if (limit === void 0) { limit = 5; }
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            integerLimit = Math.floor(Math.max(0, parseInt(limit, 10)));
                            if (isNaN(integerLimit)) {
                                this.logger.warn("Invalid limit value provided: ".concat(limit, ". Defaulting to 5."));
                                integerLimit = 5; // Set default to 5 if invalid
                            }
                            cypher = 'MATCH (w:Wine {id: $wineId})-[:SIMILAR_TO]->(similar:Wine)\nRETURN similar\nLIMIT $limit';
                            return [4 /*yield*/, this.neo4j.executeQuery(cypher, { wineId: wineId, limit: integerLimit })];
                        case 1:
                            similarWines = _a.sent();
                            this.logger.debug('KnowledgeGraphService - similarWines after executeQuery:', similarWines);
                            return [2 /*return*/, similarWines];
                    }
                });
            });
        };
        KnowledgeGraphService_1.prototype.findWinesByIngredients = function (ingredients) {
            return __awaiter(this, void 0, void 0, function () {
                var cypher, wines;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!ingredients || ingredients.length === 0) {
                                return [2 /*return*/, []];
                            }
                            cypher = 'MATCH (i:Ingredient)\nWHERE i.name IN $ingredients\nMATCH (i)-[:PAIRS_WITH]->(w:Wine)\nWITH w, count(DISTINCT i) as ingredientCount\nWHERE ingredientCount = size($ingredients)\nRETURN w';
                            return [4 /*yield*/, this.neo4j.executeQuery(cypher, { ingredients: ingredients })];
                        case 1:
                            wines = _a.sent();
                            this.logger.debug('KnowledgeGraphService - findWinesByIngredients after executeQuery:', wines);
                            return [2 /*return*/, wines];
                    }
                });
            });
        };
        KnowledgeGraphService_1.prototype.findWinesByPreferences = function (preferences) {
            return __awaiter(this, void 0, void 0, function () {
                var query, parameters, conditions, wines;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            this.logger.debug('KnowledgeGraphService: Finding wines by preferences:', preferences);
                            if (!preferences || Object.keys(preferences).length === 0) { // Check if preferences object is empty
                                this.logger.debug('KnowledgeGraphService: No specific preferences provided, returning empty array.');
                                return [2 /*return*/, []]; // Return empty array if preferences is undefined or empty
                            }
                            query = 'MATCH (w:Wine)';
                            parameters = {};
                            conditions = [];
                            if (preferences.wineType) {
                                conditions.push('w.type = $wineType');
                                parameters.wineType = preferences.wineType;
                            }
                            if (preferences.sweetness) {
                                conditions.push('w.sweetness = $sweetness');
                                parameters.sweetness = preferences.sweetness;
                            }
                            if (preferences.priceRange) {
                                conditions.push('w.price >= $minPrice AND w.price <= $maxPrice');
                                parameters.minPrice = preferences.priceRange[0];
                                parameters.maxPrice = preferences.priceRange[1];
                            }
                            if (preferences.country) {
                                conditions.push('w.region = $country');
                                parameters.country = preferences.country;
                            }
                            // TODO: Enhance foodPairing logic to support multiple ingredients, flavor profiles, and more nuanced matching.
                            // Current implementation assumes a direct match to a single Food node by name.
                            if (preferences.foodPairing) {
                                // This requires matching a Food node and then finding paired wines
                                // This makes a single MATCH clause more complex.
                                // Let's simplify for the minimum implementation and assume foodPairing in preferences
                                // is a string that can be matched against a property on the Wine node or a related Food node.
                                // For now, let's assume a direct relationship to a Food node by name.
                                query += ' MATCH (w)-[:PAIRS_WITH]->(f:Food)';
                                conditions.push('f.name = $foodPairing');
                                parameters.foodPairing = preferences.foodPairing;
                            }
                            // Excluding allergens requires a different pattern, potentially a negative match
                            if (preferences.excludeAllergens && preferences.excludeAllergens.length > 0) {
                                // This is more complex and might require a WHERE NOT EXISTS or a separate match and filter
                                // For minimum implementation, let's skip excludeAllergens for now or add a basic placeholder
                                this.logger.warn('Excluding allergens is not yet fully implemented.');
                                // TODO: Implement allergen exclusion logic
                            }
                            if (conditions.length > 0) {
                                query += ' WHERE ' + conditions.join(' AND ');
                            }
                            query += ' RETURN w';
                            this.logger.debug('KnowledgeGraphService - findWinesByPreferences query:', query);
                            this.logger.debug('KnowledgeGraphService - findWinesByPreferences parameters:', parameters);
                            return [4 /*yield*/, this.neo4j.executeQuery(query, parameters)];
                        case 1:
                            wines = _a.sent();
                            this.logger.debug('KnowledgeGraphService - findWinesByPreferences after executeQuery:', wines);
                            return [2 /*return*/, wines];
                    }
                });
            });
        };
        KnowledgeGraphService_1.prototype.findWinesByCombinedCriteria = function (ingredients, preferences) {
            return __awaiter(this, void 0, void 0, function () {
                var query, parameters, conditions, charType, values, wines;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            this.logger.debug('KnowledgeGraphService: Finding wines by combined criteria:', { ingredients: ingredients, preferences: preferences });
                            if ((!ingredients || ingredients.length === 0) && (!preferences || Object.keys(preferences).length === 0)) {
                                this.logger.debug('KnowledgeGraphService: No ingredients or preferences provided for combined search, returning empty array.');
                                return [2 /*return*/, []];
                            }
                            query = 'MATCH (w:Wine)';
                            parameters = {};
                            conditions = [];
                            // Add ingredient matching
                            if (ingredients && ingredients.length > 0) {
                                query += ' MATCH (w)<-[:PAIRS_WITH]-(i:Ingredient) WHERE i.name IN $ingredients'; // Filter ingredients first
                                parameters.ingredients = ingredients;
                                // Ensure all ingredients are matched
                                query += ' WITH w, COLLECT(DISTINCT i.name) as matchedIngredients';
                                // Replace apoc.coll.intersection with standard Cypher for checking all ingredients are matched
                                conditions.push('ALL(ing IN $ingredients WHERE ing IN matchedIngredients)');
                            }
                            // Add preference matching
                            if (preferences && Object.keys(preferences).length > 0) {
                                if (preferences.wineType) {
                                    conditions.push('w.type = $wineType');
                                    parameters.wineType = preferences.wineType;
                                }
                                if (preferences.sweetness) {
                                    conditions.push('w.sweetness = $sweetness');
                                    parameters.sweetness = preferences.sweetness;
                                }
                                if (preferences.priceRange) {
                                    conditions.push('w.price >= $minPrice AND w.price <= $maxPrice');
                                    parameters.minPrice = preferences.priceRange[0];
                                    parameters.maxPrice = preferences.priceRange[1];
                                }
                                if (preferences.foodPairing) {
                                    query += ' MATCH (w)-[:PAIRS_WITH]->(f:Food)';
                                    conditions.push('f.name = $foodPairing');
                                    parameters.foodPairing = preferences.foodPairing;
                                }
                                if (preferences.country) {
                                    conditions.push('w.region = $country');
                                    parameters.country = preferences.country;
                                }
                                // Add wine characteristics from food pairing
                                if (preferences.wineCharacteristics) {
                                    for (charType in preferences.wineCharacteristics) {
                                        if (Object.prototype.hasOwnProperty.call(preferences.wineCharacteristics, charType)) {
                                            values = preferences.wineCharacteristics[charType];
                                            if (values && values.length > 0) {
                                                // Assuming wine properties match characteristic types (e.g., w.color, w.style)
                                                conditions.push("w.".concat(charType, " IN $").concat(charType));
                                                parameters[charType] = values;
                                            }
                                        }
                                    }
                                }
                            }
                            if (conditions.length > 0) {
                                query += ' WHERE ' + conditions.join(' AND ');
                            }
                            query += ' RETURN w';
                            this.logger.debug("KnowledgeGraphService - findWinesByCombinedCriteria query: ".concat(query));
                            this.logger.debug("KnowledgeGraphService - findWinesByCombinedCriteria parameters: ".concat(JSON.stringify(parameters)));
                            return [4 /*yield*/, this.neo4j.executeQuery(query, parameters)];
                        case 1:
                            wines = _a.sent();
                            this.logger.debug("KnowledgeGraphService - findWinesByCombinedCriteria found ".concat(wines.length, " wines: ").concat(JSON.stringify(wines)));
                            return [2 /*return*/, wines];
                    }
                });
            });
        };
        KnowledgeGraphService_1.prototype.findWinesByType = function (wineType) {
            return __awaiter(this, void 0, void 0, function () {
                var cypher, wines;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!wineType) {
                                return [2 /*return*/, []];
                            }
                            cypher = 'MATCH (w:Wine {type: $wineType})\nRETURN w';
                            return [4 /*yield*/, this.neo4j.executeQuery(cypher, { wineType: wineType })];
                        case 1:
                            wines = _a.sent();
                            this.logger.debug('KnowledgeGraphService - findWinesByType after executeQuery:', wines);
                            return [2 /*return*/, wines];
                    }
                });
            });
        };
        KnowledgeGraphService_1.prototype.findWinesByName = function (wineNames) {
            return __awaiter(this, void 0, void 0, function () {
                var wines;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!wineNames || wineNames.length === 0) {
                                return [2 /*return*/, []];
                            }
                            return [4 /*yield*/, this.neo4j.executeQuery("\n       MATCH (w:Wine)\n       WHERE w.name IN $wineNames\n       RETURN w\n     ", { wineNames: wineNames })];
                        case 1:
                            wines = _a.sent();
                            this.logger.debug('KnowledgeGraphService - findWinesByName after executeQuery:', wines);
                            return [2 /*return*/, wines];
                    }
                });
            });
        };
        KnowledgeGraphService_1.prototype.getWinePairings = function (wineId) {
            return __awaiter(this, void 0, void 0, function () {
                var cypher;
                return __generator(this, function (_a) {
                    cypher = 'MATCH (w:Wine {id: $wineId})-[:PAIRS_WITH]->(pairing:Wine)\nRETURN pairing';
                    return [2 /*return*/, this.neo4j.executeQuery(cypher, { wineId: wineId })];
                });
            });
        };
        KnowledgeGraphService_1.prototype.getWineById = function (wineId) {
            return __awaiter(this, void 0, void 0, function () {
                var results;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.neo4j.executeQuery("\n       MATCH (w:Wine {id: $wineId})\n       RETURN w\n     ", { wineId: wineId })];
                        case 1:
                            results = _a.sent();
                            return [2 /*return*/, results[0] || null];
                    }
                });
            });
        };
        /**
         * Create a new Wine node in the graph.
         * @param wine The wine object to create (should match WineNode interface)
         */
        KnowledgeGraphService_1.prototype.createWineNode = function (wine) {
            return __awaiter(this, void 0, void 0, function () {
                var id, properties, cypher;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            // Defensive: ensure required fields exist
                            if (!wine.id || !wine.name) {
                                throw new Error('Wine must have at least an id and name');
                            }
                            id = wine.id, properties = __rest(wine, ["id"]);
                            cypher = "\n      MERGE (w:Wine {id: $id})\n      SET w += $properties\n    ";
                            return [4 /*yield*/, this.neo4j.executeQuery(cypher, { id: id, properties: properties })];
                        case 1:
                            _a.sent();
                            this.logger.info("Created or updated Wine node with id: ".concat(wine.id));
                            return [2 /*return*/];
                    }
                });
            });
        };
        return KnowledgeGraphService_1;
    }());
    __setFunctionName(_classThis, "KnowledgeGraphService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        KnowledgeGraphService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return KnowledgeGraphService = _classThis;
}();
exports.KnowledgeGraphService = KnowledgeGraphService;

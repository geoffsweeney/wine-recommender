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
exports.PromptManager = void 0;
var tsyringe_1 = require("tsyringe");
var result_utils_1 = require("../utils/result-utils");
var zod_1 = require("zod");
var fs = require("fs"); // Add this import for native file watching
var ExtractPreferencesSchema = zod_1.z.object({
    userInput: zod_1.z.string().min(1, 'User input cannot be empty'),
    conversationContext: zod_1.z.union([zod_1.z.string(), zod_1.z.object({})]),
});
var FoodPairingSchema = zod_1.z.object({
    food: zod_1.z.string().min(1, 'Food cannot be empty'),
});
// Output schema for extractPreferences prompt (LLM response)
var ExtractPreferencesOutputSchema = zod_1.z.object({
    preferences: zod_1.z.record(zod_1.z.any()).optional(),
    confidence: zod_1.z.number().min(0).max(1).optional(),
    reasoning: zod_1.z.string().optional(),
});
var RecommendWinesSchema = zod_1.z.object({
    wineType: zod_1.z.string().optional(),
    budget: zod_1.z.number().positive().optional(),
    region: zod_1.z.string().optional(),
    occasion: zod_1.z.string().optional(),
    food: zod_1.z.string().optional(),
    dislikes: zod_1.z.array(zod_1.z.string()).optional(),
    country: zod_1.z.string().optional(),
    wineCharacteristics: zod_1.z.record(zod_1.z.string()).optional(),
});
// Schema for the output of the recommendWines prompt (LLM response)
var RecommendWinesOutputSchema = zod_1.z.object({
    recommendations: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string(),
        grapeVarieties: zod_1.z.array(zod_1.z.object({
            name: zod_1.z.string(),
            percentage: zod_1.z.number().optional()
        })).optional()
    })),
    confidence: zod_1.z.number(),
    reasoning: zod_1.z.string(),
});
var RefineSuggestionsSchema = zod_1.z.object({
    currentRecommendations: zod_1.z.array(zod_1.z.object({}).passthrough()),
    reasoning: zod_1.z.string().optional(),
    userInput: zod_1.z.string().optional(),
    conversationHistory: zod_1.z.array(zod_1.z.object({}).passthrough()).optional(),
    preferences: zod_1.z.object({}).passthrough().optional(),
    ingredients: zod_1.z.array(zod_1.z.string()).optional(),
});
var ExplanationSchema = zod_1.z.object({
    wineName: zod_1.z.string().nullable(),
    ingredients: zod_1.z.array(zod_1.z.string()),
    preferences: zod_1.z.object({}).passthrough(),
    recommendationContext: zod_1.z.object({}).passthrough(),
});
var ResolveSynonymSchema = zod_1.z.object({
    canonicalTerm: zod_1.z.string().optional(),
});
var RawLlmPromptSchema = zod_1.z.object({
    promptContent: zod_1.z.string().min(1, 'Prompt content cannot be empty'),
});
// Schema for the input variables to the inputValidation prompt
var InputValidationInputSchema = zod_1.z.object({
    userInput: zod_1.z.string(),
});
// Schema for the output of the inputValidation prompt (LLM response)
var InputValidationOutputSchema = zod_1.z.object({
    isValid: zod_1.z.boolean(),
    cleanedInput: zod_1.z.object({
        ingredients: zod_1.z.array(zod_1.z.string()).optional(),
        budget: zod_1.z.number().nullable().optional(),
        occasion: zod_1.z.string().nullable().optional(),
    }).optional(),
    extractedData: zod_1.z.object({
        standardizedIngredients: zod_1.z.record(zod_1.z.string()).optional(),
        dietaryRestrictions: zod_1.z.array(zod_1.z.string()).optional(),
        preferences: zod_1.z.record(zod_1.z.any()).optional(),
    }).optional(),
    errors: zod_1.z.array(zod_1.z.string()).optional(),
});
var EnhanceKnowledgeGraphSchema = zod_1.z.object({
    wineList: zod_1.z.string(),
    contextInfo: zod_1.z.string(),
});
var AdminPreferenceExtractionSchema = zod_1.z.object({
    userInput: zod_1.z.string().min(1, 'User input cannot be empty'),
});
var AdminPreferenceExtractionOutputSchema = zod_1.z.object({
    action: zod_1.z.union([zod_1.z.literal('view'), zod_1.z.literal('add'), zod_1.z.literal('update'), zod_1.z.literal('delete')]),
    userId: zod_1.z.string().min(1, 'User ID is required'),
    preferenceType: zod_1.z.string().optional(),
    preferenceValue: zod_1.z.string().optional(),
    preferenceId: zod_1.z.string().optional(), // For composite IDs like "type:value"
});
var TemplateRenderer = /** @class */ (function () {
    function TemplateRenderer() {
    }
    TemplateRenderer.render = function (template, variables) {
        var _this = this;
        try {
            var rendered = template.replace(/{{(.*?)}}/g, function (match, key) {
                var trimmedKey = key.trim();
                var value = _this.getNestedValue(variables, trimmedKey);
                if (value === undefined || value === null)
                    return '';
                if (Array.isArray(value))
                    return value.join(', ');
                if (typeof value === 'object')
                    return JSON.stringify(value, null, 2);
                return value.toString();
            });
            var unreplacedVars = rendered.match(/{{.*?}}/g);
            if (unreplacedVars) {
                return (0, result_utils_1.failure)(new Error("Unresolved template variables: ".concat(unreplacedVars.join(', '))));
            }
            return (0, result_utils_1.success)(rendered);
        }
        catch (error) {
            return (0, result_utils_1.failure)(new Error("Template rendering failed: ".concat(error instanceof Error ? error.message : String(error))));
        }
    };
    TemplateRenderer.getNestedValue = function (obj, path) {
        return path.split('.').reduce(function (current, key) {
            return current && current[key] !== undefined ? current[key] : undefined;
        }, obj);
    };
    return TemplateRenderer;
}());
var PromptManager = function () {
    var _classDecorators = [(0, tsyringe_1.injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var PromptManager = _classThis = /** @class */ (function () {
        function PromptManager_1(logger, fileSystem, path, config // Inject the config
        ) {
            var _a, _b, _c;
            this.logger = logger;
            this.fileSystem = fileSystem;
            this.path = path;
            this.prompts = {};
            this.renderedCache = new Map();
            this.loadPromise = null;
            this.watchers = [];
            this.config = {
                baseDir: config.baseDir || this.path.join(__dirname, '../prompts'),
                defaultVersion: config.defaultVersion || '', // Ensure string type, fallback to empty string
                enableCaching: (_a = config.enableCaching) !== null && _a !== void 0 ? _a : true,
                enableValidation: (_b = config.enableValidation) !== null && _b !== void 0 ? _b : true,
                watchForChanges: (_c = config.watchForChanges) !== null && _c !== void 0 ? _c : false, // Default to false for tests
            };
            // Don't set currentVersion yet; do it in loadPrompts
            this.currentVersion = '';
            this.loadPromise = this.loadPrompts();
            if (this.config.watchForChanges) {
                this.logger.info("[PromptManager] watchForChanges is enabled. Setting up file watchers...");
                this.setupWatchers();
            }
        }
        PromptManager_1.prototype.setupWatchers = function () {
            return __awaiter(this, void 0, void 0, function () {
                var baseWatcher, versions, _loop_1, this_1, _i, versions_1, version, err_1;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            // Clean up any existing watchers
                            this.watchers.forEach(function (w) { return w.close(); });
                            this.watchers = [];
                            baseWatcher = fs.watch(this.config.baseDir, { persistent: false }, function (event, filename) {
                                if (filename && /^v\d+$/.test(filename)) {
                                    _this.logger.info("[PromptManager] Detected version directory change (".concat(event, "): ").concat(filename, ". Reloading prompts..."));
                                    _this.reloadPrompts();
                                    _this.setupWatchers(); // Re-setup watchers for new/removed versions
                                }
                            });
                            this.watchers.push(baseWatcher);
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 7, , 8]);
                            return [4 /*yield*/, this.fileSystem.readdir(this.config.baseDir)];
                        case 2:
                            versions = _a.sent();
                            _loop_1 = function (version) {
                                var versionDir, stat, watcher;
                                return __generator(this, function (_b) {
                                    switch (_b.label) {
                                        case 0:
                                            if (!/^v\d+$/.test(version))
                                                return [2 /*return*/, "continue"];
                                            versionDir = this_1.path.join(this_1.config.baseDir, version);
                                            return [4 /*yield*/, this_1.fileSystem.stat(versionDir)];
                                        case 1:
                                            stat = _b.sent();
                                            if (!stat.isDirectory())
                                                return [2 /*return*/, "continue"];
                                            watcher = fs.watch(versionDir, { persistent: false }, function (event, filename) {
                                                if (filename && filename.endsWith('.prompt')) {
                                                    _this.logger.info("[PromptManager] Detected prompt file change (".concat(event, ") in ").concat(version, "/").concat(filename, ". Reloading prompts..."));
                                                    _this.reloadPrompts();
                                                }
                                            });
                                            this_1.watchers.push(watcher);
                                            this_1.logger.info("[PromptManager] Watching prompt directory: ".concat(versionDir));
                                            return [2 /*return*/];
                                    }
                                });
                            };
                            this_1 = this;
                            _i = 0, versions_1 = versions;
                            _a.label = 3;
                        case 3:
                            if (!(_i < versions_1.length)) return [3 /*break*/, 6];
                            version = versions_1[_i];
                            return [5 /*yield**/, _loop_1(version)];
                        case 4:
                            _a.sent();
                            _a.label = 5;
                        case 5:
                            _i++;
                            return [3 /*break*/, 3];
                        case 6: return [3 /*break*/, 8];
                        case 7:
                            err_1 = _a.sent();
                            this.logger.error("[PromptManager] Error setting up file watchers: ".concat(err_1 instanceof Error ? err_1.message : String(err_1)));
                            return [3 /*break*/, 8];
                        case 8: return [2 /*return*/];
                    }
                });
            });
        };
        PromptManager_1.prototype.loadPrompts = function () {
            return __awaiter(this, void 0, void 0, function () {
                var versions, versionDirs, _i, versions_2, version, promptDir, stat, _a, versionDirs_1, version, promptDir, template, files, _b, files_1, file, task, filePath, content, _c, templateContent, metadata, parseError_1, versionToUse, loadedTasks, inputValidationSchema, error_1;
                var _d, _e;
                return __generator(this, function (_f) {
                    switch (_f.label) {
                        case 0:
                            _f.trys.push([0, 16, , 17]);
                            return [4 /*yield*/, this.fileSystem.readdir(this.config.baseDir)];
                        case 1:
                            versions = _f.sent();
                            versionDirs = [];
                            _i = 0, versions_2 = versions;
                            _f.label = 2;
                        case 2:
                            if (!(_i < versions_2.length)) return [3 /*break*/, 5];
                            version = versions_2[_i];
                            promptDir = this.path.join(this.config.baseDir, version);
                            return [4 /*yield*/, this.fileSystem.stat(promptDir)];
                        case 3:
                            stat = _f.sent();
                            if (stat.isDirectory() && /^v\d+$/.test(version)) {
                                versionDirs.push(version);
                            }
                            _f.label = 4;
                        case 4:
                            _i++;
                            return [3 /*break*/, 2];
                        case 5:
                            if (versionDirs.length === 0) {
                                throw new Error("No versioned prompt directories found in ".concat(this.config.baseDir));
                            }
                            _a = 0, versionDirs_1 = versionDirs;
                            _f.label = 6;
                        case 6:
                            if (!(_a < versionDirs_1.length)) return [3 /*break*/, 15];
                            version = versionDirs_1[_a];
                            promptDir = this.path.join(this.config.baseDir, version);
                            template = {};
                            return [4 /*yield*/, this.fileSystem.readdir(promptDir)];
                        case 7:
                            files = _f.sent();
                            _b = 0, files_1 = files;
                            _f.label = 8;
                        case 8:
                            if (!(_b < files_1.length)) return [3 /*break*/, 13];
                            file = files_1[_b];
                            if (!file.endsWith('.prompt'))
                                return [3 /*break*/, 12];
                            task = this.path.basename(file, '.prompt');
                            filePath = this.path.join(promptDir, file);
                            content = void 0;
                            _f.label = 9;
                        case 9:
                            _f.trys.push([9, 11, , 12]);
                            return [4 /*yield*/, this.fileSystem.readFile(filePath, 'utf-8')];
                        case 10:
                            content = _f.sent();
                            _c = this.parsePromptFile(content), templateContent = _c.template, metadata = _c.metadata;
                            template[task] = {
                                template: templateContent.trim(),
                                description: (metadata === null || metadata === void 0 ? void 0 : metadata.description) || '',
                                inputSchema: this.getInputSchemaForTask(task),
                                outputSchema: this.getOutputSchemaForTask(task),
                                metadata: metadata,
                            };
                            return [3 /*break*/, 12];
                        case 11:
                            parseError_1 = _f.sent();
                            this.logger.error("PromptManager: Error parsing prompt file: ".concat(filePath, "\n").concat(parseError_1 instanceof Error ? parseError_1.message : String(parseError_1)));
                            throw new Error("Failed to load prompts: Error in file ".concat(filePath, ": ").concat(parseError_1 instanceof Error ? parseError_1.message : String(parseError_1)));
                        case 12:
                            _b++;
                            return [3 /*break*/, 8];
                        case 13:
                            this.prompts[version] = template;
                            _f.label = 14;
                        case 14:
                            _a++;
                            return [3 /*break*/, 6];
                        case 15:
                            versionToUse = this.config.defaultVersion;
                            if (!versionToUse || !this.prompts[versionToUse]) {
                                // Find the highest version (e.g., v10 > v2 > v1)
                                versionToUse = versionDirs
                                    .map(function (name) { return ({ name: name, num: parseInt(name.slice(1), 10) }); })
                                    .sort(function (a, b) { return b.num - a.num; })[0].name;
                                this.logger.info("PromptManager: No valid defaultVersion set, using highest version \"".concat(versionToUse, "\""));
                            }
                            else {
                                this.logger.info("PromptManager: Using configured defaultVersion \"".concat(versionToUse, "\""));
                            }
                            this.currentVersion = versionToUse;
                            this.renderedCache.clear();
                            this.logger.debug("PromptManager: Prompts loaded successfully for versions: ".concat(Object.keys(this.prompts).join(', ')));
                            loadedTasks = Object.keys(this.prompts[this.currentVersion] || {});
                            this.logger.info("PromptManager: Loaded prompt tasks for version \"".concat(this.currentVersion, "\": ").concat(loadedTasks.join(', ')));
                            inputValidationSchema = (_e = (_d = this.prompts[this.currentVersion]) === null || _d === void 0 ? void 0 : _d.inputValidation) === null || _e === void 0 ? void 0 : _e.outputSchema;
                            if (inputValidationSchema) {
                                this.logger.debug("PromptManager: InputValidationOutputSchema loaded: ".concat(inputValidationSchema.toString()));
                            }
                            return [3 /*break*/, 17];
                        case 16:
                            error_1 = _f.sent();
                            this.logger.error("Failed to load prompts: ".concat(error_1 instanceof Error ? error_1.message : String(error_1)), { error: error_1 });
                            throw new Error("Failed to load prompts: ".concat(error_1 instanceof Error ? error_1.message : String(error_1)));
                        case 17: return [2 /*return*/];
                    }
                });
            });
        };
        PromptManager_1.prototype.parsePromptFile = function (content) {
            var _a;
            if (!content || content.trim() === '') {
                throw new Error('Invalid prompt format: Prompt content is empty');
            }
            var lines = content.split('\n');
            if (((_a = lines[0]) === null || _a === void 0 ? void 0 : _a.trim()) === '---') {
                var endIndex = lines.findIndex(function (line, index) { return index > 0 && line.trim() === '---'; });
                if (endIndex > 0) {
                    var metadataLines = lines.slice(1, endIndex);
                    var template = lines.slice(endIndex + 1).join('\n');
                    var metadata_1 = {};
                    metadataLines.forEach(function (line) {
                        var colonIndex = line.indexOf(':');
                        if (colonIndex === -1) {
                            throw new Error("Prompt metadata parsing failed: Invalid line in frontmatter: \"".concat(line, "\""));
                        }
                        var key = line.substring(0, colonIndex).trim();
                        var value = line.substring(colonIndex + 1).trim();
                        // Ignore input_schema and output_schema from metadata as they are now directly mapped
                        if (key !== 'input_schema' && key !== 'output_schema') {
                            metadata_1[key] = value;
                        }
                    });
                    if (!metadata_1.name || !metadata_1.description) {
                        throw new Error('Missing required metadata fields (name and description)');
                    }
                    return { template: template, metadata: metadata_1 };
                }
                else {
                    throw new Error('Invalid prompt format: YAML frontmatter end marker (---) not found or malformed.');
                }
            }
            else {
                throw new Error('Invalid prompt format: must contain YAML frontmatter between --- markers');
            }
        };
        PromptManager_1.prototype.getInputSchemaForTask = function (task) {
            switch (task) {
                case 'extractPreferences': return ExtractPreferencesSchema;
                case 'foodPairing': return FoodPairingSchema;
                case 'recommendWines': return RecommendWinesSchema;
                case 'refineSuggestions': return RefineSuggestionsSchema;
                case 'explanation': return ExplanationSchema;
                case 'resolveSynonym': return ResolveSynonymSchema;
                case 'rawLlmPrompt': return RawLlmPromptSchema;
                case 'inputValidation': return InputValidationInputSchema; // Input schema for validation prompt
                case 'enhanceKnowledgeGraph': return EnhanceKnowledgeGraphSchema;
                case 'adminPreferenceExtraction': return AdminPreferenceExtractionSchema; // Input schema for admin preference extraction
                default: return undefined;
            }
        };
        PromptManager_1.prototype.getOutputSchemaForTask = function (task) {
            this.logger.debug("[PromptManager] getOutputSchemaForTask called with task: ".concat(String(task)));
            switch (task) {
                case 'extractPreferences':
                    this.logger.debug('[PromptManager] Returning ExtractPreferencesOutputSchema');
                    return ExtractPreferencesOutputSchema;
                case 'recommendWines':
                    this.logger.debug('[PromptManager] Returning RecommendWinesOutputSchema');
                    return RecommendWinesOutputSchema;
                case 'inputValidation':
                    this.logger.debug('[PromptManager] Returning InputValidationOutputSchema');
                    return InputValidationOutputSchema; // Output schema for validation prompt
                case 'resolveSynonym':
                    this.logger.debug('[PromptManager] Returning ResolveSynonymSchema');
                    return ResolveSynonymSchema; // Assuming output is also a resolved synonym
                case 'adminPreferenceExtraction':
                    this.logger.debug('[PromptManager] Returning AdminPreferenceExtractionOutputSchema');
                    return AdminPreferenceExtractionOutputSchema; // Output schema for admin preference extraction
                default:
                    this.logger.warn("[PromptManager] No output schema found for task: ".concat(String(task)));
                    return undefined;
            }
        };
        PromptManager_1.prototype.ensureLoaded = function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!this.loadPromise) return [3 /*break*/, 2];
                            return [4 /*yield*/, this.loadPromise];
                        case 1:
                            _a.sent();
                            this.loadPromise = null;
                            _a.label = 2;
                        case 2: return [2 /*return*/];
                    }
                });
            });
        };
        PromptManager_1.prototype.setVersion = function (version) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.ensureLoaded()];
                        case 1:
                            _a.sent();
                            if (!this.prompts[version]) {
                                return [2 /*return*/, (0, result_utils_1.failure)(new Error("Prompt version \"".concat(version, "\" not found.")))];
                            }
                            this.currentVersion = version;
                            this.renderedCache.clear();
                            return [2 /*return*/, (0, result_utils_1.success)(true)];
                    }
                });
            });
        };
        PromptManager_1.prototype.getAvailableVersions = function () {
            return Object.keys(this.prompts);
        };
        PromptManager_1.prototype.getCurrentVersion = function () {
            return this.currentVersion;
        };
        PromptManager_1.prototype.getSystemPrompt = function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.ensureLoaded()];
                        case 1:
                            _a.sent();
                            return [2 /*return*/, this.prompts[this.currentVersion].system.template];
                    }
                });
            });
        };
        PromptManager_1.prototype.getPrompt = function (task, variables) {
            return __awaiter(this, void 0, void 0, function () {
                var promptTask, cacheKey, renderResult;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.ensureLoaded()];
                        case 1:
                            _a.sent();
                            promptTask = this.prompts[this.currentVersion][task];
                            if (!promptTask) {
                                return [2 /*return*/, (0, result_utils_1.failure)(new Error("Prompt template \"".concat(String(task), "\" not found in version \"").concat(this.currentVersion, "\".")))];
                            }
                            // Debug log: show variables sent to LLM for recommendWines
                            if (task === 'recommendWines') {
                                this.logger.info("[PromptManager] Variables sent to recommendWines prompt: ".concat(JSON.stringify(variables, null, 2)));
                            }
                            if (this.config.enableValidation && promptTask.inputSchema) {
                                this.logger.debug("Validating variables for task \"".concat(String(task), "\". Schema: ").concat(promptTask.inputSchema.toString(), ". Variables: ").concat(JSON.stringify(variables)));
                                try {
                                    promptTask.inputSchema.parse(variables);
                                }
                                catch (error) {
                                    if (error instanceof zod_1.z.ZodError) {
                                        this.logger.error("Variable validation failed for \"".concat(String(task), "\": ").concat(error.errors.map(function (e) { return e.message; }).join(', '), ". Variables: ").concat(JSON.stringify(variables)));
                                        return [2 /*return*/, (0, result_utils_1.failure)(new Error("Variable validation failed for \"".concat(String(task), "\": ").concat(error.errors.map(function (e) { return e.message; }).join(', '))))];
                                    }
                                    this.logger.error("Variable validation failed for \"".concat(String(task), "\": ").concat(error instanceof Error ? error.message : String(error), ". Variables: ").concat(JSON.stringify(variables)));
                                    return [2 /*return*/, (0, result_utils_1.failure)(new Error("Variable validation failed for \"".concat(String(task), "\": ").concat(error instanceof Error ? error.message : String(error))))];
                                }
                            }
                            cacheKey = "".concat(this.currentVersion, "-").concat(String(task), "-").concat(JSON.stringify(variables));
                            if (this.config.enableCaching && this.renderedCache.has(cacheKey)) {
                                return [2 /*return*/, (0, result_utils_1.success)(this.renderedCache.get(cacheKey))];
                            }
                            renderResult = TemplateRenderer.render(promptTask.template, variables);
                            if (renderResult.success && this.config.enableCaching) {
                                this.renderedCache.set(cacheKey, renderResult.data);
                            }
                            return [2 /*return*/, renderResult];
                    }
                });
            });
        };
        PromptManager_1.prototype.getPromptTask = function (task) {
            return this.prompts[this.currentVersion][task];
        };
        PromptManager_1.prototype.getPromptMetadata = function (task) {
            var promptTask = this.prompts[this.currentVersion][task];
            if (!promptTask) {
                return (0, result_utils_1.failure)(new Error("Prompt template \"".concat(String(task), "\" not found in version \"").concat(this.currentVersion, "\".")));
            }
            var metadata = promptTask.metadata || {};
            var name = metadata.name || String(task); // Use task name if 'name' is not in metadata
            var description = promptTask.description || '';
            var version = metadata.version;
            return (0, result_utils_1.success)({ name: name, description: description, version: version });
        };
        PromptManager_1.prototype.debugPrompt = function (task, variables) {
            return __awaiter(this, void 0, void 0, function () {
                var filledPrompt;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.getPrompt(task, variables)];
                        case 1:
                            filledPrompt = _a.sent();
                            if (filledPrompt.success) {
                                console.log("\n==== ".concat(String(task), " Prompt (v").concat(this.currentVersion, ") ===="));
                                console.log(filledPrompt.data);
                                console.log('======================================\n');
                            }
                            else {
                                console.error("Prompt error: ".concat(filledPrompt.error.message));
                            }
                            return [2 /*return*/];
                    }
                });
            });
        };
        PromptManager_1.prototype.clearCache = function () {
            this.renderedCache.clear();
        };
        PromptManager_1.prototype.reloadPrompts = function () {
            return __awaiter(this, void 0, void 0, function () {
                var error_2;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            this.clearCache();
                            return [4 /*yield*/, this.loadPrompts()];
                        case 1:
                            _a.sent();
                            if (this.config.watchForChanges) {
                                this.logger.info("[PromptManager] Re-initializing file watchers after reload.");
                                this.setupWatchers();
                            }
                            return [2 /*return*/, (0, result_utils_1.success)(true)];
                        case 2:
                            error_2 = _a.sent();
                            return [2 /*return*/, (0, result_utils_1.failure)(new Error("Failed to reload prompts: ".concat(error_2 instanceof Error ? error_2.message : String(error_2))))];
                        case 3: return [2 /*return*/];
                    }
                });
            });
        };
        PromptManager_1.prototype.getStats = function () {
            return {
                currentVersion: this.currentVersion,
                availableVersions: this.getAvailableVersions(),
                cacheSize: this.renderedCache.size,
                totalPrompts: Object.keys(this.prompts[this.currentVersion] || {}).length,
            };
        };
        return PromptManager_1;
    }());
    __setFunctionName(_classThis, "PromptManager");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        PromptManager = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return PromptManager = _classThis;
}();
exports.PromptManager = PromptManager;

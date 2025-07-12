import { injectable, inject } from 'tsyringe';
import { Result } from '../core/types/Result';
import { success, failure } from '../utils/result-utils';
import { z } from 'zod';
import { TYPES } from '../di/Types';
import { ILogger } from '../types/ILogger';
import { IFileSystem } from '../types/IFileSystem';
import { IPath } from '../types/IPath';
import * as fs from 'fs'; // Add this import for native file watching

export interface PromptVariables {
  [key: string]: string | number | boolean | string[] | null | undefined | object;
}

export type AdminPreferenceExtractionOutput = z.infer<typeof AdminPreferenceExtractionOutputSchema>;


export interface PromptTask<T = PromptVariables, U = any> { // T for input variables, U for output schema
 template: string;
  description?: string;
  inputSchema?: z.ZodSchema<T>; // Schema for input variables
  outputSchema?: z.ZodSchema<U>; // Schema for LLM output
  metadata?: {
    version?: string;
    author?: string;
    created?: string;
    modified?: string;
  };
}


export interface PromptTemplate {
  system: PromptTask;
  extractPreferences: PromptTask<ExtractPreferencesVars>;
  foodPairing: PromptTask<FoodPairingVars>;
  recommendWines: PromptTask<RecommendWinesVars>;
  refineSuggestions: PromptTask<RefineSuggestionsVars>;
  explanation: PromptTask<ExplanationVars>; // Added
  resolveSynonym: PromptTask<ResolveSynonymVars>; // Added for synonym resolution
  rawLlmPrompt: PromptTask<RawLlmPromptVars>; // Added for raw LLM prompts
  inputValidation: PromptTask<InputValidationVars>; // Added for input validation
  enhanceKnowledgeGraph: PromptTask<EnhanceKnowledgeGraphVars>; // Added for enhancing KG results
  adminPreferenceExtraction: PromptTask<AdminPreferenceExtractionVars>; // Added for admin preference management
}

interface PromptVersions {
  [version: string]: PromptTemplate;
}

export interface PromptManagerConfig { // Export the interface
  baseDir?: string;
  defaultVersion?: string;
  enableCaching?: boolean;
  enableValidation?: boolean;
  watchForChanges?: boolean;
}

export interface ExtractPreferencesVars {
  userInput: string;
  conversationContext: string | object;
}

export interface FoodPairingVars {
  food: string;
}

export interface RecommendWinesVars {
  wineType?: string;
  budget?: number;
  region?: string;
  occasion?: string;
  food?: string;
  dislikes?: string[];
  country?: string;
  wineCharacteristics?: Record<string, string>;
}

export interface RefineSuggestionsVars {
  currentRecommendations: object;
  reasoning?: string;
  userInput?: string;
  conversationHistory?: object;
  preferences?: object;
  ingredients?: string[];
}

export interface ExplanationVars {
  wineName: string | null;
  ingredients: string[];
  preferences: any; // Or a more specific type if available
  recommendationContext: object; // Or a more specific type if available
}

export interface ResolveSynonymVars {
  type: string;
  synonym: string;
  examples: string; // Examples to guide the LLM
  schema: string; // JSON schema for the expected output
}

export interface RawLlmPromptVars {
  promptContent: string;
}

export interface InputValidationVars {
  userInput: string;
  // Add other variables needed for input validation prompt
}

export interface EnhanceKnowledgeGraphVars {
  wineList: string;
  contextInfo: string;
}

export interface AdminPreferenceExtractionVars {
  userInput: string;
}


const ExtractPreferencesSchema = z.object({
  userInput: z.string().min(1, 'User input cannot be empty'),
  conversationContext: z.union([z.string(), z.object({})]),
});


const FoodPairingSchema = z.object({
  food: z.string().min(1, 'Food cannot be empty'),
});

// Output schema for extractPreferences prompt (LLM response)
const ExtractPreferencesOutputSchema = z.object({
  preferences: z.record(z.any()).optional(),
  confidence: z.number().min(0).max(1).optional(),
  reasoning: z.string().optional(),
});

const RecommendWinesSchema = z.object({
  wineType: z.string().optional(),
  budget: z.number().positive().optional(),
  region: z.string().optional(),
  occasion: z.string().optional(),
  food: z.string().optional(),
  dislikes: z.array(z.string()).optional(),
  country: z.string().optional(),
  wineCharacteristics: z.record(z.string()).optional(),
});

// Schema for the output of the recommendWines prompt (LLM response)
const RecommendWinesOutputSchema = z.object({
  recommendations: z.array(z.object({
    name: z.string(),
    grapeVarieties: z.array(z.object({
      name: z.string(),
      percentage: z.number().optional()
    })).optional()
  })),
  confidence: z.number(),
  reasoning: z.string(),
});

const RefineSuggestionsSchema = z.object({
  currentRecommendations: z.array(z.object({}).passthrough()),
  reasoning: z.string().optional(),
  userInput: z.string().optional(),
  conversationHistory: z.array(z.object({}).passthrough()).optional(),
  preferences: z.object({}).passthrough().optional(),
  ingredients: z.array(z.string()).optional(),
});

const ExplanationSchema = z.object({
  wineName: z.string().nullable(),
  ingredients: z.array(z.string()),
  preferences: z.object({}).passthrough(),
  recommendationContext: z.object({}).passthrough(),
});

const ResolveSynonymSchema = z.object({
  canonicalTerm: z.string().optional(),
});

const RawLlmPromptSchema = z.object({
  promptContent: z.string().min(1, 'Prompt content cannot be empty'),
});

// Schema for the input variables to the inputValidation prompt
const InputValidationInputSchema = z.object({
  userInput: z.string(),
});

// Schema for the output of the inputValidation prompt (LLM response)
const InputValidationOutputSchema = z.object({
  isValid: z.boolean(),
  cleanedInput: z.object({
    ingredients: z.array(z.string()).optional(),
    budget: z.number().nullable().optional(),
    occasion: z.string().nullable().optional(),
  }).optional(),
  extractedData: z.object({
    standardizedIngredients: z.record(z.string()).optional(),
    dietaryRestrictions: z.array(z.string()).optional(),
    preferences: z.record(z.any()).optional(),
  }).optional(),
  errors: z.array(z.string()).optional(),
});

const EnhanceKnowledgeGraphSchema = z.object({
  wineList: z.string(),
  contextInfo: z.string(),
});

const AdminPreferenceExtractionSchema = z.object({
  userInput: z.string().min(1, 'User input cannot be empty'),
});

const AdminPreferenceExtractionOutputSchema = z.object({
  action: z.union([z.literal('view'), z.literal('add'), z.literal('update'), z.literal('delete')]),
  userId: z.string().min(1, 'User ID is required'),
  preferenceType: z.string().optional(),
  preferenceValue: z.string().optional(),
  preferenceId: z.string().optional(), // For composite IDs like "type:value"
});


class TemplateRenderer {
  public static render(template: string, variables: PromptVariables): Result<string, Error> {
    try {
      const rendered = template.replace(/{{(.*?)}}/g, (match, key) => {
        const trimmedKey = key.trim();
        const value = this.getNestedValue(variables, trimmedKey);
        if (value === undefined || value === null) return '';
        if (Array.isArray(value)) return value.join(', ');
        if (typeof value === 'object') return JSON.stringify(value, null, 2);
        return value.toString();
      });

      const unreplacedVars = rendered.match(/{{.*?}}/g);
      if (unreplacedVars) {
        return failure(new Error(`Unresolved template variables: ${unreplacedVars.join(', ')}`));
      }

      return success(rendered);
    } catch (error) {
      return failure(new Error(`Template rendering failed: ${error instanceof Error ? error.message : String(error)}`));
    }
  }

  private static getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }
}

@injectable()
export class PromptManager {
  private prompts: PromptVersions = {};
  private currentVersion: string;
  private config: Required<PromptManagerConfig>;
  private renderedCache = new Map<string, string>();
  private loadPromise: Promise<void> | null = null;
  private watchers: fs.FSWatcher[] = [];

  constructor(
    @inject(TYPES.Logger) private logger: ILogger,
    @inject(TYPES.FileSystem) private fileSystem: IFileSystem,
    @inject(TYPES.Path) private path: IPath,
    @inject(TYPES.PromptManagerConfig) config: PromptManagerConfig // Inject the config
  ) {
    this.config = {
      baseDir: config.baseDir || this.path.join(__dirname, '../prompts'),
      defaultVersion: config.defaultVersion || '', // Ensure string type, fallback to empty string
      enableCaching: config.enableCaching ?? true,
      enableValidation: config.enableValidation ?? true,
      watchForChanges: config.watchForChanges ?? false, // Default to false for tests
    };
    // Don't set currentVersion yet; do it in loadPrompts
    this.currentVersion = '';
    this.loadPromise = this.loadPrompts();
    if (this.config.watchForChanges) {
      this.logger.info(`[PromptManager] watchForChanges is enabled. Setting up file watchers...`);
      this.setupWatchers();
    }
  }

  private async setupWatchers() {
    // Clean up any existing watchers
    this.watchers.forEach(w => w.close());
    this.watchers = [];

    // Watch the base directory for new/removed version folders
    const baseWatcher = fs.watch(this.config.baseDir, { persistent: false }, (event, filename) => {
      if (filename && /^v\d+$/.test(filename)) {
        this.logger.info(`[PromptManager] Detected version directory change (${event}): ${filename}. Reloading prompts...`);
        this.reloadPrompts();
        this.setupWatchers(); // Re-setup watchers for new/removed versions
      }
    });
    this.watchers.push(baseWatcher);

    // Watch each version directory for prompt file changes
    try {
      const versions = await this.fileSystem.readdir(this.config.baseDir);
      for (const version of versions) {
        if (!/^v\d+$/.test(version)) continue;
        const versionDir = this.path.join(this.config.baseDir, version);
        const stat = await this.fileSystem.stat(versionDir);
        if (!stat.isDirectory()) continue;
        const watcher = fs.watch(versionDir, { persistent: false }, (event, filename) => {
          if (filename && filename.endsWith('.prompt')) {
            this.logger.info(`[PromptManager] Detected prompt file change (${event}) in ${version}/${filename}. Reloading prompts...`);
            this.reloadPrompts();
          }
        });
        this.watchers.push(watcher);
        this.logger.info(`[PromptManager] Watching prompt directory: ${versionDir}`);
      }
    } catch (err) {
      this.logger.error(`[PromptManager] Error setting up file watchers: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async loadPrompts(): Promise<void> {
    try {
      const versions = await this.fileSystem.readdir(this.config.baseDir);

      // Only keep directories matching /^v\d+$/
      const versionDirs: string[] = [];
      for (const version of versions) {
        const promptDir = this.path.join(this.config.baseDir, version);
        const stat = await this.fileSystem.stat(promptDir);
        if (stat.isDirectory() && /^v\d+$/.test(version)) {
          versionDirs.push(version);
        }
      }

      if (versionDirs.length === 0) {
        throw new Error(`No versioned prompt directories found in ${this.config.baseDir}`);
      }

      // Load all prompt templates for all versions
      for (const version of versionDirs) {
        const promptDir = this.path.join(this.config.baseDir, version);
        const template: Partial<PromptTemplate> = {};
        const files = await this.fileSystem.readdir(promptDir);

        for (const file of files) {
          if (!file.endsWith('.prompt')) continue;

          const task = this.path.basename(file, '.prompt') as keyof PromptTemplate;
          const filePath = this.path.join(promptDir, file);
          let content: string;
          try {
            content = await this.fileSystem.readFile(filePath, 'utf-8');
            const { template: templateContent, metadata } = this.parsePromptFile(content);
            template[task] = {
              template: templateContent.trim(),
              description: metadata?.description || '',
              inputSchema: this.getInputSchemaForTask(task),
              outputSchema: this.getOutputSchemaForTask(task),
              metadata,
            };
          } catch (parseError) {
            this.logger.error(`PromptManager: Error parsing prompt file: ${filePath}\n${parseError instanceof Error ? parseError.message : String(parseError)}`);
            throw new Error(`Failed to load prompts: Error in file ${filePath}: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
          }
        }

        this.prompts[version] = template as PromptTemplate;
      }

      // Determine which version to use as current
      let versionToUse = this.config.defaultVersion;
      if (!versionToUse || !this.prompts[versionToUse]) {
        // Find the highest version (e.g., v10 > v2 > v1)
        versionToUse = versionDirs
          .map(name => ({ name, num: parseInt(name.slice(1), 10) }))
          .sort((a, b) => b.num - a.num)[0].name;
        this.logger.info(`PromptManager: No valid defaultVersion set, using highest version "${versionToUse}"`);
      } else {
        this.logger.info(`PromptManager: Using configured defaultVersion "${versionToUse}"`);
      }
      this.currentVersion = versionToUse;

      this.renderedCache.clear();
      this.logger.debug(`PromptManager: Prompts loaded successfully for versions: ${Object.keys(this.prompts).join(', ')}`);
      // Log the loaded prompt tasks for the current version
      const loadedTasks = Object.keys(this.prompts[this.currentVersion] || {});
      this.logger.info(`PromptManager: Loaded prompt tasks for version "${this.currentVersion}": ${loadedTasks.join(', ')}`);
      // Log the specific schema for inputValidation to verify nullable properties
      const inputValidationSchema = this.prompts[this.currentVersion]?.inputValidation?.outputSchema;
      if (inputValidationSchema) {
        this.logger.debug(`PromptManager: InputValidationOutputSchema loaded: ${inputValidationSchema.toString()}`);
      }
    } catch (error) {
      this.logger.error(`Failed to load prompts: ${error instanceof Error ? error.message : String(error)}`, { error });
      throw new Error(`Failed to load prompts: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private parsePromptFile(content: string): { template: string; metadata?: any; } {
    if (!content || content.trim() === '') {
        throw new Error('Invalid prompt format: Prompt content is empty');
    }

    const lines = content.split('\n');
    if (lines[0]?.trim() === '---') {
        const endIndex = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
        if (endIndex > 0) {
            const metadataLines = lines.slice(1, endIndex);
            const template = lines.slice(endIndex + 1).join('\n');
            
            const metadata: any = {};

            metadataLines.forEach(line => {
                const colonIndex = line.indexOf(':');
                if (colonIndex === -1) {
                    throw new Error(`Prompt metadata parsing failed: Invalid line in frontmatter: "${line}"`);
                }
                const key = line.substring(0, colonIndex).trim();
                const value = line.substring(colonIndex + 1).trim();
                
                // Ignore input_schema and output_schema from metadata as they are now directly mapped
                if (key !== 'input_schema' && key !== 'output_schema') {
                    metadata[key] = value;
                }
            });

            if (!metadata.name || !metadata.description) {
                throw new Error('Missing required metadata fields (name and description)');
            }
            
            return { template, metadata };
        } else {
            throw new Error('Invalid prompt format: YAML frontmatter end marker (---) not found or malformed.');
        }
    } else {
        throw new Error('Invalid prompt format: must contain YAML frontmatter between --- markers');
    }
  }

  public getInputSchemaForTask(task: keyof PromptTemplate): z.ZodSchema<any> | undefined {
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
  }

  public getOutputSchemaForTask(task: keyof PromptTemplate): z.ZodSchema<any> | undefined {
    this.logger.debug(`[PromptManager] getOutputSchemaForTask called with task: ${String(task)}`);
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
        this.logger.warn(`[PromptManager] No output schema found for task: ${String(task)}`);
        return undefined;
    }
  }

  public async ensureLoaded(): Promise<void> {
    if (this.loadPromise) {
      await this.loadPromise;
      this.loadPromise = null;
    }
  }

  public async setVersion(version: string): Promise<Result<boolean, Error>> {
    await this.ensureLoaded();
    
    if (!this.prompts[version]) {
      return failure(new Error(`Prompt version "${version}" not found.`));
    }
    
    this.currentVersion = version;
    this.renderedCache.clear();
    return success(true);
  }

  public getAvailableVersions(): string[] {
    return Object.keys(this.prompts);
  }

  public getCurrentVersion(): string {
    return this.currentVersion;
  }

  public async getSystemPrompt(): Promise<string> {
    await this.ensureLoaded();
    return this.prompts[this.currentVersion].system.template;
  }

  public async getPrompt<T extends keyof PromptTemplate>(
    task: T,
    variables: PromptTemplate[T] extends PromptTask<infer V> ? V : PromptVariables
  ): Promise<Result<string, Error>> {
    await this.ensureLoaded();
    
    const promptTask = this.prompts[this.currentVersion][task];
    if (!promptTask) {
      return failure(new Error(`Prompt template "${String(task)}" not found in version "${this.currentVersion}".`));
    }

    // Debug log: show variables sent to LLM for recommendWines
    if (task === 'recommendWines') {
      this.logger.info(`[PromptManager] Variables sent to recommendWines prompt: ${JSON.stringify(variables, null, 2)}`);
    }

    if (this.config.enableValidation && promptTask.inputSchema) {
      this.logger.debug(`Validating variables for task "${String(task)}". Schema: ${promptTask.inputSchema.toString()}. Variables: ${JSON.stringify(variables)}`);
      try {
        promptTask.inputSchema.parse(variables as unknown);
      } catch (error) {
        if (error instanceof z.ZodError) {
          this.logger.error(`Variable validation failed for "${String(task)}": ${error.errors.map(e => e.message).join(', ')}. Variables: ${JSON.stringify(variables)}`);
          return failure(new Error(`Variable validation failed for "${String(task)}": ${error.errors.map(e => e.message).join(', ')}`));
        }
        this.logger.error(`Variable validation failed for "${String(task)}": ${error instanceof Error ? error.message : String(error)}. Variables: ${JSON.stringify(variables)}`);
        return failure(new Error(`Variable validation failed for "${String(task)}": ${error instanceof Error ? error.message : String(error)}`));
      }
    }

    const cacheKey = `${this.currentVersion}-${String(task)}-${JSON.stringify(variables)}`;
    if (this.config.enableCaching && this.renderedCache.has(cacheKey)) {
      return success(this.renderedCache.get(cacheKey)!);
    }

    const renderResult = TemplateRenderer.render(promptTask.template, variables as PromptVariables);
    if (renderResult.success && this.config.enableCaching) {
      this.renderedCache.set(cacheKey, renderResult.data);
    }
    return renderResult;
  }


  public getPromptTask<T extends keyof PromptTemplate>(task: T): PromptTask<PromptVariables> {
    return this.prompts[this.currentVersion][task] as PromptTask<PromptVariables>;
  }

  public getPromptMetadata<T extends keyof PromptTemplate>(task: T): Result<{ name: string; description: string; version?: string; }, Error> {
    const promptTask = this.prompts[this.currentVersion][task];
    if (!promptTask) {
      return failure(new Error(`Prompt template "${String(task)}" not found in version "${this.currentVersion}".`));
    }
    
    const metadata = promptTask.metadata || {};
    const name = (metadata as any).name || String(task); // Use task name if 'name' is not in metadata
    const description = promptTask.description || '';
    const version = (metadata as any).version;

    return success({ name, description, version });
  }

  public async debugPrompt<T extends keyof PromptTemplate>(
    task: T,
    variables: PromptTemplate[T] extends PromptTask<infer V> ? V : PromptVariables
  ): Promise<void> {

    const filledPrompt = await this.getPrompt(task, variables);
    if (filledPrompt.success) {
      console.log(`\n==== ${String(task)} Prompt (v${this.currentVersion}) ====`);
      console.log(filledPrompt.data);
      console.log('======================================\n');
    } else {
      console.error(`Prompt error: ${filledPrompt.error.message}`);
    }
}

  public clearCache(): void {
    this.renderedCache.clear();
  }

  public async reloadPrompts(): Promise<Result<boolean, Error>> {
    try {
      this.clearCache();
      await this.loadPrompts();
      if (this.config.watchForChanges) {
        this.logger.info(`[PromptManager] Re-initializing file watchers after reload.`);
        this.setupWatchers();
      }
      return success(true);
    } catch (error) {
      return failure(new Error(`Failed to reload prompts: ${error instanceof Error ? error.message : String(error)}`));
    }
  }

  public getStats(): {
    currentVersion: string;
    availableVersions: string[];
    cacheSize: number;
    totalPrompts: number;
  } {
    return {
      currentVersion: this.currentVersion,
      availableVersions: this.getAvailableVersions(),
      cacheSize: this.renderedCache.size,
      totalPrompts: Object.keys(this.prompts[this.currentVersion] || {}).length,
    };
  }
}

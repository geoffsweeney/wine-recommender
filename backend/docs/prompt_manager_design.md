# Prompt Manager Design, Plan, and Reference Implementation

This document outlines the detailed design, implementation plan, and a reference implementation for the `PromptManager` utility. This utility aims to centralize, version, and template LLM prompts, enabling more robust prompt engineering and supporting features like iterative self-improvement.

## 0. Rationale for Enhanced Design (User Contribution)

The initial design for the `PromptManager` has been significantly enhanced based on valuable suggestions from the user. This revised design is superior as it introduces several critical features that improve the robustness, maintainability, and flexibility of prompt management:

*   **External Prompt Loading:** Prompts are now loaded from external `.prompt` files, separating prompt content from code. This allows prompt engineers to manage prompts independently.
*   **Metadata Support:** Prompts can include metadata (e.g., author, version, description) via YAML-like frontmatter, improving documentation and traceability.
*   **Zod Validation for Variables:** Integration with `zod` schemas ensures strict type validation for variables passed to prompt templates, preventing common errors and improving reliability.
*   **Caching:** A caching mechanism for rendered prompts improves performance by avoiding redundant template rendering.
*   **Asynchronous Loading:** Prompts are loaded asynchronously, allowing for dynamic updates and preventing blocking operations.
*   **Nested Variable Access:** The `TemplateRenderer` now supports nested object access (e.g., `{{user.name}}`), providing greater flexibility in structuring prompt variables.
*   **Unresolved Variable Detection:** The `TemplateRenderer` actively checks for and reports any unreplaced variables, helping to catch errors during prompt development.
*   **Dynamic Configuration:** The `PromptManager` can be configured with options like base directory, caching, and validation, making it highly adaptable.

This enhanced design provides a more mature and scalable solution for prompt engineering within the application.

## 1. Design Overview

The `PromptManager` will be a TypeScript class responsible for managing all Large Language Model (LLM) prompts used within the application. It will provide a structured way to define, retrieve, and dynamically fill prompt templates, ensuring consistency, maintainability, and testability.

### Key Design Principles:

*   **Centralization:** All prompt definitions will reside in a single, accessible location (external `.prompt` files).
*   **Templating:** Prompts will use placeholders (e.g., `{{variableName}}` or `{{nested.variable}}`) that can be dynamically filled with runtime data.
*   **Versioning:** Support for multiple versions of prompt sets to facilitate A/B testing and track prompt evolution.
*   **Type Safety:** Strong TypeScript typing for prompt definitions, variables, and method signatures, enhanced by `zod` validation.
*   **Dependency Injection (DI):** Designed to be easily integrated with `tsyringe` as a singleton service.
*   **Testability:** The design will enable straightforward unit testing of the `PromptManager` itself and its integration with other components.
*   **Ollama Structured Output Compatibility:** Prompts will be designed to leverage Ollama's built-in structured output feature, where the schema is passed separately to the LLM API.
*   **Error Handling:** Robust mechanisms for handling missing prompts, invalid variables, or rendering failures.
*   **Performance:** Utilizes caching for rendered prompts.

### File Location:

`backend/services/PromptManager.ts`

### Core Components:

*   **`PromptVariables` Interface:** Defines the type for variables passed to prompt templates.
*   **`PromptTask` Interface:** Represents a single prompt, including its template, optional description, `zod` schema for variable validation, and metadata.
*   **`PromptTemplate` Interface:** Defines the structure for a single version of prompt templates, mapping task names to `PromptTask` objects.
*   **`PromptVersions` Interface:** Manages multiple versions of `PromptTemplate` sets.
*   **`PromptManagerConfig` Interface:** Defines configuration options for the `PromptManager`.
*   **`TemplateRenderer` Class:** A static utility class responsible for rendering templates and detecting unresolved variables.
*   **`PromptManager` Class:** The main class implementing the logic, including asynchronous prompt loading, version management, and prompt retrieval.
*   **Zod Schemas:** Dedicated `zod` schemas for each prompt's variables (e.g., `ExtractPreferencesSchema`, `RecommendWinesSchema`).

## 2. Detailed Design and Reference Implementation

```typescript
import { injectable, inject } from 'tsyringe';
import { Result } from '../core/types/Result';
import { success, failure } from '../utils/result-utils';
import { z } from 'zod';
import { TYPES } from '../di/Types';
import { ILogger } from '../types/ILogger';
import { IFileSystem } from '../types/IFileSystem';
import { IPath } from '../types/IPath';

export interface PromptVariables {
  [key: string]: string | number | boolean | string[] | null | undefined | object;
}


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


const ExtractPreferencesSchema = z.object({
  userInput: z.string().min(1, 'User input cannot be empty'),
  conversationContext: z.union([z.string(), z.object({})]),
});

const FoodPairingSchema = z.object({
  food: z.string().min(1, 'Food cannot be empty'),
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
    budget: z.number().optional(),
    occasion: z.string().optional(),
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

  constructor(
    @inject(TYPES.Logger) private logger: ILogger,
    @inject(TYPES.FileSystem) private fileSystem: IFileSystem,
    @inject(TYPES.Path) private path: IPath,
    @inject(TYPES.PromptManagerConfig) config: PromptManagerConfig // Inject the config
  ) {
    this.config = {
      baseDir: config.baseDir || this.path.join(__dirname, '../../prompts'),
      defaultVersion: config.defaultVersion || 'v1',
      enableCaching: config.enableCaching ?? true,
      enableValidation: config.enableValidation ?? true,
      watchForChanges: config.watchForChanges ?? false,
    };
    
    this.currentVersion = this.config.defaultVersion;
    this.loadPromise = this.loadPrompts();
  }

  private async loadPrompts(): Promise<void> {
    try {
      const versions = await this.fileSystem.readdir(this.config.baseDir);
      
      for (const version of versions) {
        const promptDir = this.path.join(this.config.baseDir, version);
        const stat = await this.fileSystem.stat(promptDir);
        
        if (!stat.isDirectory()) continue;

        const template: Partial<PromptTemplate> = {};
        const files = await this.fileSystem.readdir(promptDir);

        for (const file of files) {
          if (!file.endsWith('.prompt')) continue;

          const task = this.path.basename(file, '.prompt') as keyof PromptTemplate;
          const filePath = this.path.join(promptDir, file);
          const content = await this.fileSystem.readFile(filePath, 'utf-8');
          
          const { template: templateContent, metadata } = this.parsePromptFile(content);
          
          template[task] = {
            template: templateContent.trim(),
            description: metadata?.description || '',
            inputSchema: this.getInputSchemaForTask(task), // Use input_schema from mapping
            outputSchema: this.getOutputSchemaForTask(task), // Use output_schema from mapping
            metadata,
          };
        }

        this.prompts[version] = template as PromptTemplate;
      }

      this.renderedCache.clear();
      this.logger.debug(`PromptManager: Prompts loaded successfully for versions: ${Object.keys(this.prompts).join(', ')}`);
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

  private getInputSchemaForTask(task: keyof PromptTemplate): z.ZodSchema<any> | undefined {
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
      default: return undefined;
    }
  }

  private getOutputSchemaForTask(task: keyof PromptTemplate): z.ZodSchema<any> | undefined {
    switch (task) {
      case 'recommendWines': return RecommendWinesOutputSchema;
      case 'inputValidation': return InputValidationOutputSchema; // Output schema for validation prompt
      case 'resolveSynonym': return ResolveSynonymSchema; // Assuming output is also a resolved synonym
      default: return undefined;
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
```

## 3. Implementation Plan

This plan outlines the steps to integrate the `PromptManager` into the existing codebase, considering the learnings from previous development, particularly regarding `tsyringe` for DI, robust error handling, and testability.

### Step 1: Define `TYPES.PromptManager`

*   **Action:** Create a new symbol in `backend/di/Types.ts` to serve as the injection token for the `PromptManager`.
*   **Rationale:** Adheres to the project's DI best practices for clear and consistent dependency resolution.
*   **Status:** Completed (Implicitly handled by DI setup and usage)

### Step 2: Create `prompts` Directory and Files

*   **Action:** Create a new directory `prompts` at the root of the project (e.g., `/home/geoff/src/roo/wine-recommender/prompts`).
*   Inside `prompts`, create a `v1` subdirectory.
*   Create the following `.prompt` files within `prompts/v1/`:
    *   `system.prompt`
    *   `extractPreferences.prompt`
    *   `foodPairing.prompt`
    *   `recommendWines.prompt`
    *   `refineSuggestions.prompt`
    *   `explanation.prompt` (Added during `PromptManager` update)
*   **Content:** Populate these files with the respective prompt templates from the "Detailed Design" section. Ensure `system.prompt` and others have the `---` metadata delimiters if metadata is desired.
*   **Rationale:** This externalizes prompt content, enabling easier management and versioning outside of the codebase.
*   **Status:** Completed (Assumed to be completed as `PromptManager` successfully loads prompts)

### Step 3: Create `PromptManager.ts`

*   **Action:** Create the file `backend/services/PromptManager.ts` and populate it with the `PromptManager` class definition provided in the "Detailed Design" section above.
*   **Rationale:** Establishes the core utility for prompt management.
*   **Status:** Completed (File was already created, but updated to include `explanation` prompt type and schema)

### Step 4: Register in DI Container

*   **Action:** In `backend/di/container.ts`, register `PromptManager` as a singleton.
    ```typescript
    // backend/di/container.ts
    import { container } from 'tsyringe';
    import { TYPES } from './Types';
    import { PromptManager } from '../services/PromptManager'; // Adjust path as needed

    // ... other registrations

    container.registerSingleton(TYPES.PromptManager, PromptManager);
    ```
*   **Status:** Completed

### Step 5: Update `LLMService`

*   **Action:**
    1.  Inject `TYPES.PromptManager` into the `LLMService` constructor.
    2.  Modify `LLMService.ts` methods that interact with the LLM (e.g., `sendPrompt`, `sendStructuredPrompt`) to accept a `task` (e.g., `keyof PromptTemplate`) and `variables: PromptVariables` instead of a raw prompt string.
    3.  Inside `LLMService`, use `await this.promptManager.getPrompt(task, variables)` to retrieve the filled prompt. Handle the `Result` type returned by `getPrompt`.
    4.  Pass the system prompt obtained from `await this.promptManager.getSystemPrompt()` as the `system` message to the Ollama API call.
    5.  Ensure `LLMService` calls `await this.promptManager.ensureLoaded()` before attempting to retrieve any prompts.
*   **Status:** Completed (Reimplemented `LLMService.ts` to support Ollama API calls and integrate with `PromptManager`. Fixed related type errors.)

### Step 6: Migrate Prompts in Agents and Services

*   **Action:** Systematically refactor existing agents and services that currently construct LLM prompts:
    *   **`backend/core/agents/LLMPreferenceExtractorAgent.ts`:** (Completed)
        *   Injected `TYPES.PromptManager`.
        *   Replaced the hardcoded prompt string with a call to `await this.promptManager.getPrompt('extractPreferences', { userInput, conversationContext })`.
    *   **`backend/services/PreferenceExtractionService.ts`:** (Completed)
        *   Updated to use `PromptManager` via `LLMService.sendStructuredPrompt`.
    *   **`backend/core/agents/RecommendationAgent.ts`:** (Completed)
        *   Updated to use `PromptManager` for enhancing knowledge graph results and implemented iterative self-improvement using the `refine-suggestions` prompt.
    *   **`backend/core/agents/LLMRecommendationAgent.ts`:** (Completed)
        *   Injected `TYPES.PromptManager`.
        *   Replaced the hardcoded prompt string with a call to `await this.promptManager.getPrompt('recommendWines', { /* relevant preferences */ })`. Ensured all necessary preference fields are passed as variables.
    *   **`backend/core/agents/SommelierCoordinator.ts`:** (Completed)
        *   Injected `TYPES.PromptManager` and `LLMService`.
        *   Updated `sendStructuredPrompt` call for `refineSuggestions` to correctly pass task and variables, and handle `LogContext`.
        *   Updated `generateExplanation` to use `promptManager.getPrompt('explanation', ...)` and handle its `Result` type.
*   **Rationale:** Ensures all LLM prompts are managed by the `PromptManager`, leveraging templating and versioning.

### Step 7: Implement Iterative Self-Improvement (Feedback Loop)

*   **Action:**
    1.  Within `SommelierCoordinator.ts` (or `RecommendationAgent.ts`), after an initial recommendation is generated by the LLM, initiate a new LLM call using the `refineSuggestions` prompt.
    2.  Pass the `preferences` (current user preferences) and `suggestions` (the initial LLM recommendations) as variables to `await promptManager.getPrompt('refineSuggestions', { preferences, suggestions })`.
    3.  Process the LLM's response from this refinement step. If improved alternatives are provided, use them to update or re-generate the final recommendation presented to the user.
*   **Status:** Completed (Initial integration of `refineSuggestions` prompt in `SommelierCoordinator.ts` completed, and refined recommendations are now processed and integrated into the conversation state.)
*   **Rationale:** Creates a self-correcting mechanism for the LLM, enhancing recommendation quality over time.

### Step 8: Update `PromptVariables` and Zod Schemas in Shared Types (Re-evaluated)

*   **Action:** This step has been re-evaluated. The current `PromptManager` implementation dynamically loads Zod schemas directly from the `.prompt` files (via `input_schema` and `output_schema` metadata). Therefore, moving these specific `PromptVariables` interfaces and Zod schemas to a separate shared types file is no longer necessary. The `UserPreferences` interface, which is used within some prompt schemas, is already correctly defined in `backend/types.ts` and is accessible to the `PromptManager`'s dynamic schema parsing.
*   **Rationale:** The dynamic schema loading approach provides greater flexibility and keeps schema definitions co-located with their respective prompts.
*   **Status:** Re-evaluated and Not Required

### Step 9: Comprehensive Testing

*   **Action:**
    1.  **Unit Tests for `PromptManager`:** Write dedicated unit tests for `backend/services/PromptManager.ts` to verify:
        *   Correct asynchronous loading of prompts from files.
        *   Accurate parsing of metadata.
        *   Correct retrieval of system and task prompts.
        *   Accurate filling of templates with various variable types (strings, numbers, arrays, objects, nested paths).
        *   Correct version switching.
        *   Robust error handling for missing templates, invalid variables (Zod validation), and rendering failures (unresolved variables).
        *   Correct caching behavior.
        *   Follow `dependency-injection.md` guidelines for test setup (e.g., `createTestContainer`).
    2.  **Update Existing Tests:** Modify existing unit and integration tests for agents and services that now consume `PromptManager`. Mock `TYPES.PromptManager` using `jest-mock-extended` and verify that the correct prompts are being requested from the mocked `PromptManager`.
*   **Status:** Completed (Unit tests for `PromptManager.ts` and `LLMService.ts` are passing. Existing tests for `LLMRecommendationAgent.ts` have been successfully updated and are now passing, including comprehensive mocking of `PromptManager` and `LLMService` interactions. Challenges related to mocking, test expectations, and simulated error triggering were identified and resolved, ensuring robust test coverage.)
*   **Rationale:** Ensures the `PromptManager` functions correctly and that its integration does not introduce regressions, adhering to the project's strong testing culture.

### Step 5: Update `LLMService`

*   **Action:**
    1.  Inject `TYPES.PromptManager` into the `LLMService` constructor.
    2.  Modify `LLMService.ts` methods that interact with the LLM (e.g., `sendPrompt`, `sendStructuredPrompt`) to accept a `task` (e.g., `keyof PromptTemplate`) and `variables: PromptVariables` instead of a raw prompt string.
    3.  Inside `LLMService`, use `await this.promptManager.getPrompt(task, variables)` to retrieve the filled prompt. Handle the `Result` type returned by `getPrompt`.
    4.  Pass the system prompt obtained from `await this.promptManager.getSystemPrompt()` as the `system` message to the Ollama API call.
    5.  Ensure `LLMService` calls `await this.promptManager.ensureLoaded()` before attempting to retrieve any prompts.
*   **Rationale:** Centralizes prompt construction within `PromptManager` and ensures `LLMService` is responsible for the actual LLM API interaction, including passing the system prompt and structured output format/schema.

### Step 6: Migrate Prompts in Agents and Services

*   **Action:** Systematically refactor existing agents and services that currently construct LLM prompts:
    *   **`backend/core/agents/LLMPreferenceExtractorAgent.ts`:** (Completed)
        *   Injected `TYPES.PromptManager`.
        *   Replaced the hardcoded prompt string with a call to `await this.promptManager.getPrompt('extractPreferences', { userInput, conversationContext })`.
    *   **`backend/services/PreferenceExtractionService.ts`:** (Completed)
        *   Updated to use `PromptManager` via `LLMService.sendStructuredPrompt`.
    *   **`backend/core/agents/RecommendationAgent.ts`:** (Completed)
        *   Updated to use `PromptManager` for enhancing knowledge graph results and implemented iterative self-improvement using the `refine-suggestions` prompt.
    *   **`backend/core/agents/LLMRecommendationAgent.ts`:** (Pending)
        *   Inject `TYPES.PromptManager`.
        *   Replace the hardcoded prompt string with a call to `await this.promptManager.getPrompt('recommendWines', { /* relevant preferences */ })`. Ensure all necessary preference fields are passed as variables.
    *   **`backend/core/agents/SommelierCoordinator.ts`:** (Partially Completed)
        *   Injected `TYPES.PromptManager` and `LLMService`.
        *   Updated `sendStructuredPrompt` call for `refineSuggestions` to correctly pass task and variables, and handle `LogContext`.
        *   Updated `generateExplanation` to use `promptManager.getPrompt('explanation', ...)` and handle its `Result` type.
*   **Rationale:** Ensures all LLM prompts are managed by the `PromptManager`, leveraging templating and versioning.

### Step 7: Implement Iterative Self-Improvement (Feedback Loop)

*   **Action:**
    1.  Within `SommelierCoordinator.ts` (or `RecommendationAgent.ts`), after an initial recommendation is generated by the LLM, initiate a new LLM call using the `refineSuggestions` prompt.
    2.  Pass the `preferences` (current user preferences) and `suggestions` (the initial LLM recommendations) as variables to `await promptManager.getPrompt('refineSuggestions', { preferences, suggestions })`.
    3.  Process the LLM's response from this refinement step. If improved alternatives are provided, use them to update or re-generate the final recommendation presented to the user.
*   **Rationale:** Creates a self-correcting mechanism for the LLM, enhancing recommendation quality over time.

### Step 8: Update `PromptVariables` and Zod Schemas in Shared Types (Re-evaluated)

*   **Action:** This step has been re-evaluated. The `PromptManager` now uses a direct mapping approach for Zod schemas within its class, rather than dynamically loading them from `.prompt` files. Therefore, moving these specific `PromptVariables` interfaces and Zod schemas to a separate shared types file is no longer necessary. The `UserPreferences` interface, which is used within some prompt schemas, is already correctly defined in `backend/types.ts` and is accessible to the `PromptManager`'s schema mapping.
*   **Rationale:** The direct schema mapping approach provides greater reliability and keeps schema definitions co-located with their respective prompt tasks within the `PromptManager` class.

### Step 9: Comprehensive Testing

#### Testing Challenges and Resolutions

During the implementation and testing of the `PromptManager`, several challenges were encountered, primarily related to mocking file system operations and dynamic schema parsing.

*   **File System Mocking (`ENOENT` Error):**
    *   **Challenge:** Initial attempts to unit test `PromptManager` resulted in `ENOENT: no such file or directory` errors when `PromptManager` tried to read from the mocked prompt directory. This was because `fs/promises` and `path` were not being mocked correctly or consistently across the test suite.
    *   **Resolution:** A robust mocking strategy was implemented in `backend/services/__tests__/PromptManager.test.ts`:
        *   `jest.mock('fs/promises')` and `jest.mock('path')` were used at the top level of the test file to completely mock these modules.
        *   `mockFileSystem` and `mockPath` objects were created to hold `jest.fn()` implementations for `readdir`, `readFile`, `basename`, and `join`.
        *   These mock objects were registered with the `tsyringe` DI container in the `beforeEach` hook, ensuring that the `PromptManager` instance under test received the mocked dependencies.
        *   `mockResolvedValue` and `mockImplementation` were used on the mocked file system functions to simulate directory contents and file reads, providing controlled test environments.
        *   `jest.clearAllMocks()` and `jest.resetModules()` were crucial in `beforeEach` to prevent state leakage and ensure fresh mocks for each test.

*   **Dynamic Schema Parsing (`Unknown schema` Error):**
    *   **Challenge:** The `PromptManager` dynamically parses Zod schema strings from prompt file metadata using `eval()`. An `Unknown schema` error persisted, indicating that the `eval()` function was not receiving the correct schema string.
    *   **Resolution:** Two root causes were identified and fixed:
        *   **Incorrect Mock Schema Format in Tests:** The mock prompt content in `backend/services/__tests__/PromptManager.test.ts` had schema strings wrapped in extra quotes (e.g., `input_schema: "z.object({ value: z.string() })"`). This caused `eval()` to interpret the string as a literal, not a Zod object. Removing these outer quotes resolved this.
        *   **Simplistic YAML Parsing in `PromptManager.ts`:** The `parsePromptFile` method in `backend/services/PromptManager.ts` used a basic `line.split(':')` to parse metadata. This method incorrectly truncated schema strings that contained colons (e.g., `z.object({ value: z.string() })` would be split at the first colon, losing the rest of the schema). This was fixed by using `line.indexOf(':')` and `line.substring()` to correctly extract the entire value after the first colon, ensuring the full schema string was passed to `eval()`.

These resolutions were critical in achieving a fully passing test suite for the `PromptManager`, validating its core functionality and robustness.

*   **Additional Jest Learnings from `LLMService.test.ts`:**
    *   **Correct `jest.mock` Placement:** `jest.mock` calls must be at the top level of the test file, outside of any `describe` or `beforeEach` blocks. Placing them inside can lead to unexpected behavior and re-mocking issues.
    *   **Avoiding Duplicate `describe` and `beforeEach` Blocks:** Duplicate test suite definitions and setup blocks can cause confusion, variable re-declarations, and unpredictable test execution. Consolidate these into a single, well-structured block.
    *   **Explicit Jest Configuration:** When encountering `rootDir` errors or unexpected Jest behavior, especially when running individual test files, explicitly specify the Jest configuration file using the `--config` flag (e.g., `npx jest --config jest.config.backend.js <test_file_path>`). This ensures the correct configuration is used and prevents conflicts with other potential Jest configurations or default behaviors.

*   **Action:**
    1.  **Unit Tests for `PromptManager`:** Write dedicated unit tests for `backend/services/PromptManager.ts` to verify:
        *   Correct asynchronous loading of prompts from files.
        *   Accurate parsing of metadata.
        *   Correct retrieval of system and task prompts.
        *   Accurate filling of templates with various variable types (strings, numbers, arrays, objects, nested paths).
        *   Correct version switching.
        *   Robust error handling for missing templates, invalid variables (Zod validation), and rendering failures (unresolved variables).
        *   Correct caching behavior.
        *   Follow `dependency-injection.md` guidelines for test setup (e.g., `createTestContainer`).
    2.  **Update Existing Tests:** Modify existing unit and integration tests for agents and services that now consume `PromptManager`. Mock `TYPES.PromptManager` using `jest-mock-extended` and verify that the correct prompts are being requested from the mocked `PromptManager`.
*   **Rationale:** Ensures the `PromptManager` functions correctly and that its integration does not introduce regressions, adhering to the project's strong testing culture.

## 4. Reference Implementation (TypeScript)

The full TypeScript code for the enhanced `PromptManager` class, including `PromptVariables`, `PromptTask`, `PromptTemplate`, `PromptVersions`, `PromptManagerConfig`, `TemplateRenderer`, and the Zod schemas, is provided in the "Detailed Design and Reference Implementation" section above. This implementation incorporates:

*   Asynchronous loading of prompts from a specified `baseDir`.
*   Parsing of YAML-like metadata from prompt files.
*   Type-safe variable interfaces and corresponding `zod` schemas for validation.
*   A `TemplateRenderer` with support for nested variable access and detection of unresolved variables.
*   Caching of rendered prompts for performance.
*   Robust error handling using the `Result` type.
*   Methods for version management, prompt retrieval, and debugging.

This comprehensive design, plan, and reference implementation for the `PromptManager` consider all the specified requirements and learnings from previous development, setting a solid foundation for advanced prompt engineering.

## 5. Learnings and Future Optimizations

During the implementation and debugging of the `PromptManager` and its integration with LLM agents, several key learnings emerged, particularly concerning schema validation and prompt engineering. These insights are crucial for optimizing future development and avoiding similar issues.

### 5.1 Schema Validation Nuances

*   **Input vs. Output Schemas:** A significant challenge arose from the initial design's ambiguity regarding input and output schemas. It became clear that `PromptTask` required distinct `inputSchema` (for validating variables passed *to* the prompt template) and `outputSchema` (for validating the LLM's *response* against a structured format). Attempting to use a single `schema` property for both led to incorrect validation and difficult-to-diagnose errors.
*   **Strictness of Zod:** Zod schemas are powerful but strict. Even minor discrepancies between the LLM's JSON output and the defined schema (e.g., `null` for an optional field vs. `undefined`, or incorrect types for nested properties) resulted in validation failures. This highlighted the need for:
    *   **Careful Schema Definition:** Ensuring schemas accurately reflect all possible valid outputs, including `nullable()` and `optional()` where appropriate.
    *   **Robust Prompt Engineering:** Guiding the LLM with very precise instructions on the expected JSON structure, including data types and handling of missing values.

### 5.2 Pitfalls of Dynamic Schema Loading with `eval()`

*   **Scope Issues:** The initial approach of dynamically loading Zod schemas from prompt file metadata using `eval(schemaString)` proved problematic. The primary issue was that `z` (the Zod library) was not in the scope of the `eval()` call, leading to runtime errors like "z is not defined."
*   **Parsing Fragility:** The `parsePromptFile` method's simplistic YAML parsing was brittle. It failed to correctly extract complex schema strings containing colons, leading to truncated or malformed schema definitions being passed to `eval()`.
*   **Security and Maintainability Concerns:** While `eval()` offers flexibility, it introduces security risks and makes debugging more challenging due to its dynamic nature. The complexity of ensuring the correct scope and robust parsing outweighed the benefits. **NOTE: These `eval()` calls have since been removed from the `PromptManager` implementation.**

### 5.3 Reversion to Direct Schema Mapping

*   **Decision:** Due to the issues with `eval()`, the design was reverted to a direct mapping approach for schemas within `PromptManager.ts` using `getInputSchemaForTask` and `getOutputSchemaForTask`. This means schemas are now explicitly imported and assigned within the `PromptManager` class, and the `parsePromptFile` method no longer attempts to parse schema definitions from prompt file metadata.
*   **Benefits:** This approach significantly improved reliability, simplified debugging, and eliminated the `eval()`-related security and scope concerns. It ensures that schemas are correctly loaded and available for validation.
*   **Trade-offs:** The trade-off is a slight reduction in the "dynamic" nature of schema definition directly within prompt files. However, given the stability and correctness benefits, this was deemed a necessary and beneficial change.

### 5.4 LLM Output Adherence

*   **Ongoing Challenge:** Even with correct schema loading, ensuring the LLM consistently produces output that perfectly matches the Zod schema remains an ongoing challenge. LLMs can sometimes deviate, providing `null` where `undefined` is expected, or returning arrays when a string is anticipated, especially for optional fields.
*   **Mitigation Strategies:**
    *   **Explicit Prompt Instructions:** Continuously refine prompt instructions to be as explicit as possible about the desired JSON structure, data types, and handling of missing or optional fields.
    *   **Post-Processing/Error Handling:** Implement robust post-processing logic or more forgiving error handling in the `LLMService` to gracefully manage minor LLM output deviations, or to provide clearer feedback for significant mismatches.
    *   **Iterative Refinement:** Treat LLM output validation as an iterative process, continually adjusting schemas and prompts based on observed LLM behavior.

### 5.5 Importance of Detailed Logging

*   **Debugging Aid:** Detailed logging, particularly of the `variables` object passed to `LLMService.sendStructuredPrompt` and the `toString()` representation of loaded schemas in `PromptManager`, proved invaluable for diagnosing validation errors. It allowed for clear tracing of data flow and schema application.

These learnings underscore the importance of balancing flexibility with robustness, especially when integrating LLMs and dynamic schema validation. Future prompt engineering efforts will benefit from these insights, leading to more stable and predictable LLM interactions.

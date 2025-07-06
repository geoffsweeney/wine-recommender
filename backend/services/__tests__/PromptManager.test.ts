import 'reflect-metadata';
import { z } from 'zod';
import { container } from 'tsyringe';
import { PromptManager } from '../PromptManager';
import * as fs from 'fs';
import * as path from 'path';
import { promises as fsPromises } from 'fs';
import { TYPES } from '../../di/Types';
import { MockZodType, createMockZodType } from '../../__mocks__/zod';
import { Result } from '../../core/types/Result';
import { success, failure } from '../../utils/result-utils';
import { ILogger } from '../../types/ILogger';
import { IFileSystem } from '../../types/IFileSystem';
import { IPath } from '../../types/IPath';

// Create mock implementations
const mockFileSystem: jest.Mocked<{
  readdir: (path: string) => Promise<string[]>;
  readFile: (path: string, encoding: string) => Promise<string>;
  stat: (path: string) => Promise<{ isDirectory: () => boolean }>;
}> = {
  readdir: jest.fn(),
  readFile: jest.fn(),
  stat: jest.fn(), // Initialize stat as a jest.fn() here
};

const mockPath: jest.Mocked<typeof path> = {
  basename: jest.fn(),
  join: jest.fn(),
} as any;

describe('PromptManager', () => {
  let promptManager: PromptManager;
  const mockPromptsDir = '/mock/prompts';
  let mockLogger: any; // To capture logger calls

  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Register mock services in DI container
    container.register(TYPES.FileSystem, { useValue: mockFileSystem });
    container.register(TYPES.Path, { useValue: mockPath });
    mockLogger = { // Mock logger
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };
    container.register(TYPES.Logger, { useValue: mockLogger });

    // Mock readdir and readFile for the initial load in constructor
    // Set mock implementation for stat inside beforeEach
    mockFileSystem.stat.mockResolvedValue({
      isDirectory: () => true,
    });

    // Mock readdir using mockImplementation for a more robust mock that works for reloads
    mockFileSystem.readdir.mockImplementation(async (dirPath: string) => {
      if (dirPath === mockPromptsDir) {
        return ['v1'];
      } else if (dirPath === `${mockPromptsDir}/v1`) {
        return [
          'system.prompt',
          'extractPreferences.prompt',
          'foodPairing.prompt',
          'recommendWines.prompt',
          'refineSuggestions.prompt',
          'explanation.prompt', // Added explanation prompt
        ];
      }
      throw new Error(`Unknown directory: ${dirPath}`);
    });

    mockFileSystem.readFile.mockImplementation((filePath: any) => {
      const fileName = mockPath.basename(filePath.toString());
      
      let content;
      switch (fileName) {
        case 'system.prompt':
          content = `---
name: System Prompt
description: Global system instructions
version: 1.0.0
---
You are a helpful assistant.`;
          break;
        case 'extractPreferences.prompt':
          content = `---
name: Extract Preferences
description: Extracts user preferences
version: 1.0.0
input_schema: |
  z.object({ userInput: z.string(), conversationContext: z.union([z.string(), z.object({})]) })
---
Extract preferences from: {{userInput}}`;
          break;
        case 'foodPairing.prompt':
          content = `---
name: Food Pairing
description: Suggests wine pairings for food
version: 1.0.0
input_schema: |
  z.object({ food: z.string() })
---
Suggest wine for: {{food}}`;
          break;
        case 'recommendWines.prompt':
          content = `---
name: Recommend Wines
description: Recommends wines based on criteria
version: 1.0.0
input_schema: |
  z.object({ wineType: z.string().optional(), budget: z.number().optional() })
---
Recommend wines: {{wineType}} {{budget}}`;
          break;
        case 'refineSuggestions.prompt':
          content = `---
name: Refine Suggestions
description: Refines wine suggestions
version: 1.0.0
input_schema: |
  z.object({ preferences: z.object({}).passthrough(), suggestions: z.object({}).passthrough() })
---
Refine suggestions: {{preferences}} {{suggestions}}`;
          break;
        case 'explanation.prompt':
          content = `---
name: Explanation
description: Provides explanation for a wine
version: 1.0.0
input_schema: |
  z.object({ wineName: z.string().nullable(), ingredients: z.array(z.string()), preferences: z.any(), recommendationContext: z.any() })
---
Explain wine: {{wineName}} for {{ingredients}}`;
          break;
        default:
          return Promise.reject(new Error(`ENOENT: no such file or directory, open '${filePath}'`));
      }
      return Promise.resolve(content);
    });

    mockPath.basename.mockImplementation((p: string, ext?: string) => {
      const parts = p.split('/');
      const filename = parts[parts.length - 1] || p;
      const result = ext ? filename.replace(ext, '') : filename;
      return result;
    });

    mockPath.join.mockImplementation((...args: string[]) => {
      // Simulate path.join behavior for the mock directory structure
      if (args[0] === mockPromptsDir && args[1] === 'v1') {
        return `${mockPromptsDir}/v1`;
      }
      return args.join('/');
    });

    // Register PromptManager with a factory to explicitly provide its config
    container.register<PromptManager>(PromptManager, {
      useFactory: (c) => {
        const logger = c.resolve<ILogger>(TYPES.Logger);
        const fileSystem = c.resolve<IFileSystem>(TYPES.FileSystem);
        const pathService = c.resolve<IPath>(TYPES.Path);
        return new PromptManager(logger, fileSystem, pathService, { baseDir: mockPromptsDir }); // Pass mockPromptsDir as baseDir
      }
    });
    promptManager = container.resolve(PromptManager);
    await (promptManager as any).loadPromise; // Wait for prompts to load

    // Mock parseZodSchema is no longer needed as schemas are evaluated directly from content
    // The PromptManager's internal logic handles schema parsing.
  });

  afterEach(() => {
    jest.restoreAllMocks();
    container.reset(); // Reset DI container after each test
  });

  it('should initialize and load prompts from the directory', async () => {
    const promptResult = await promptManager.getPrompt('recommendWines', { wineType: 'red', budget: 50 });
    expect(promptResult.success).toBe(true);
    if (promptResult.success) { // Check success before accessing data
      expect(promptResult.data).toBe('Recommend wines: red 50');
    }

    const systemPrompt = await promptManager.getSystemPrompt();
    expect(systemPrompt).toBe('You are a helpful assistant.');
  });

  it('should render a prompt with variables', async () => {
    const promptResult = await promptManager.getPrompt('foodPairing', { food: 'steak' });
    expect(promptResult.success).toBe(true);
    if (promptResult.success) { // Check success before accessing data
      expect(promptResult.data).toBe('Suggest wine for: steak');
    }
  });

  it('should throw an error if prompt not found', async () => {
    const promptResult = await promptManager.getPrompt('nonExistentPrompt' as any, {}); // Cast to any for test
    expect(promptResult.success).toBe(false);
    if (!promptResult.success) { // Check success before accessing error
      expect(promptResult.error?.message).toContain('Prompt template "nonExistentPrompt" not found');
    }
  });

  it('should validate input variables against schema', async () => {
    // Valid input
    const validResult = await promptManager.getPrompt('extractPreferences', { userInput: 'I like sweet wines', conversationContext: {} });
    expect(validResult.success).toBe(true);
    if (validResult.success) { // Check success before accessing data
      expect(validResult.data).toBe('Extract preferences from: I like sweet wines');
    }

    // Invalid input
    const invalidResult = await promptManager.getPrompt('extractPreferences', { userInput: 123 as any, conversationContext: {} });
    expect(invalidResult.success).toBe(false);
    if (!invalidResult.success) { // Check success before accessing error
      expect(invalidResult.error?.message).toContain('Variable validation failed for "extractPreferences"');
    }
  });

  it('should use cache when enabled', async () => {
    // First call, should read from file
    const firstResult = await promptManager.getPrompt('recommendWines', { wineType: 'white' });
    expect(firstResult.success).toBe(true);
    expect(mockFileSystem.readFile).toHaveBeenCalledTimes(6); // Initial load of all 6 prompts

    mockFileSystem.readFile.mockClear(); // Clear calls after initial load

    // Second call with same variables, should use cache
    const secondResult = await promptManager.getPrompt('recommendWines', { wineType: 'white' });
    expect(secondResult.success).toBe(true);
    expect(mockFileSystem.readFile).toHaveBeenCalledTimes(0); // Should be from cache
  });

  it('should clear cache on reloadPrompts', async () => {
    // Ensure prompts are loaded and cached
    await promptManager.getPrompt('recommendWines', { wineType: 'red' });
    // mockFileSystem.readFile.mockClear(); // Removed: This clears the call count for readFile prematurely

    // Reload prompts
    const reloadResult = await promptManager.reloadPrompts();
    expect(reloadResult.success).toBe(true);
    expect(mockFileSystem.readdir).toHaveBeenCalledTimes(4); // 2 for initial, 2 for reload
    expect(mockFileSystem.readFile).toHaveBeenCalledTimes(12); // 6 for initial, 6 for reload

    // Clear readFile calls after reload to test cache hit
    mockFileSystem.readFile.mockClear();

    // After reload, subsequent calls should use cache
    const afterReloadResult = await promptManager.getPrompt('recommendWines', { wineType: 'red' });
    expect(afterReloadResult.success).toBe(true);
    expect(mockFileSystem.readFile).toHaveBeenCalledTimes(0); // Should be from cache
  });

  it('should retrieve prompt metadata', async () => {
    const metadataResult = await promptManager.getPromptMetadata('explanation');
    expect(metadataResult.success).toBe(true);
    if (metadataResult.success) {
      expect(metadataResult.data).toBeDefined();
      expect(metadataResult.data.name).toBe('Explanation');
      expect(metadataResult.data.version).toBe('1.0.0');
    }
  });

  it('should retrieve prompt task', async () => {
    const promptTask = promptManager.getPromptTask('foodPairing');
    expect(promptTask).toBeDefined();
    expect(promptTask.template).toContain('{{food}}');
    expect(promptTask.description).toBe('Suggests wine pairings for food');
  });

  it('should handle fs.readdir error during initial load', async () => {
    // Reset mocks and container to simulate a fresh start for this specific test
    jest.restoreAllMocks();
    container.reset();
    container.register(TYPES.FileSystem, { useValue: mockFileSystem });
    container.register(TYPES.Path, { useValue: mockPath });
    container.register(TYPES.Logger, { useValue: mockLogger });

    mockFileSystem.readdir.mockRejectedValueOnce(new Error('Permission denied'));
    
    // Re-create PromptManager instance to trigger loadPrompts in constructor
    // Re-register PromptManager with a factory to explicitly provide its config
    container.register<PromptManager>(PromptManager, {
      useFactory: (c) => {
        const logger = c.resolve<ILogger>(TYPES.Logger);
        const fileSystem = c.resolve<IFileSystem>(TYPES.FileSystem);
        const pathService = c.resolve<IPath>(TYPES.Path);
        return new PromptManager(logger, fileSystem, pathService, {}); // Pass an empty config
      }
    });
    promptManager = container.resolve(PromptManager);
    await expect((promptManager as any).loadPromise).rejects.toThrow('Failed to load prompts: Permission denied');
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to load prompts'), expect.any(Object));
  });

  it('should handle empty prompt content during load', async () => {
    const promptName = 'empty-prompt';
    jest.restoreAllMocks();
    container.reset();
    container.register(TYPES.FileSystem, { useValue: mockFileSystem });
    container.register(TYPES.Path, { useValue: mockPath });
    container.register(TYPES.Logger, { useValue: mockLogger });
    container.register<PromptManager>(PromptManager, {
      useFactory: (c) => {
        const logger = c.resolve<ILogger>(TYPES.Logger);
        const fileSystem = c.resolve<IFileSystem>(TYPES.FileSystem);
        const pathService = c.resolve<IPath>(TYPES.Path);
        return new PromptManager(logger, fileSystem, pathService, { baseDir: mockPromptsDir });
      }
    });

    mockFileSystem.readdir.mockResolvedValueOnce(['v1']);
    mockFileSystem.readdir.mockResolvedValueOnce([`${promptName}.prompt`]);
    mockFileSystem.readFile.mockResolvedValueOnce(''); // Empty content
    mockFileSystem.stat.mockResolvedValue({ isDirectory: () => true }); // Ensure stat is mocked

    promptManager = container.resolve(PromptManager);
    await expect((promptManager as any).loadPromise).rejects.toThrow('Invalid prompt format: Prompt content is empty');
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid prompt format: Prompt content is empty'), expect.any(Object));
  });

  it('should handle missing YAML frontmatter markers during load', async () => {
    const promptName = 'no-frontmatter-prompt';
    jest.restoreAllMocks();
    container.reset();
    container.register(TYPES.FileSystem, { useValue: mockFileSystem });
    container.register(TYPES.Path, { useValue: mockPath });
    container.register(TYPES.Logger, { useValue: mockLogger });
    container.register<PromptManager>(PromptManager, {
      useFactory: (c) => {
        const logger = c.resolve<ILogger>(TYPES.Logger);
        const fileSystem = c.resolve<IFileSystem>(TYPES.FileSystem);
        const pathService = c.resolve<IPath>(TYPES.Path);
        return new PromptManager(logger, fileSystem, pathService, { baseDir: mockPromptsDir });
      }
    });

    mockFileSystem.readdir.mockResolvedValueOnce(['v1']);
    mockFileSystem.readdir.mockResolvedValueOnce([`${promptName}.prompt`]);
    mockFileSystem.readFile.mockResolvedValueOnce('Just some content without markers'); // Missing markers
    mockFileSystem.stat.mockResolvedValue({ isDirectory: () => true }); // Ensure stat is mocked

    promptManager = container.resolve(PromptManager);
    await expect((promptManager as any).loadPromise).rejects.toThrow('Invalid prompt format: must contain YAML frontmatter between --- markers');
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid prompt format: must contain YAML frontmatter between --- markers'), expect.any(Object));
  });

  it('should handle invalid YAML syntax in frontmatter during load', async () => {
    const promptName = 'invalid-yaml-prompt';
    jest.restoreAllMocks();
    container.reset();
    container.register(TYPES.FileSystem, { useValue: mockFileSystem });
    container.register(TYPES.Path, { useValue: mockPath });
    container.register(TYPES.Logger, { useValue: mockLogger });
    container.register<PromptManager>(PromptManager, {
      useFactory: (c) => {
        const logger = c.resolve<ILogger>(TYPES.Logger);
        const fileSystem = c.resolve<IFileSystem>(TYPES.FileSystem);
        const pathService = c.resolve<IPath>(TYPES.Path);
        return new PromptManager(logger, fileSystem, pathService, { baseDir: mockPromptsDir });
      }
    });

    mockFileSystem.readdir.mockResolvedValueOnce(['v1']);
    mockFileSystem.readdir.mockResolvedValueOnce([`${promptName}.prompt`]);
    mockFileSystem.readFile.mockResolvedValueOnce(`---
name: Test
invalid: : syntax
---
Content`); // Invalid YAML
    mockFileSystem.stat.mockResolvedValue({ isDirectory: () => true }); // Ensure stat is mocked

    promptManager = container.resolve(PromptManager);
    await expect((promptManager as any).loadPromise).rejects.toThrow('Missing required metadata fields (name and description)');
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Missing required metadata fields (name and description)'), expect.any(Object));
  });

  it('should handle missing name or description in metadata during load', async () => {
    const promptName = 'missing-fields-prompt';
    jest.restoreAllMocks();
    container.reset();
    container.register(TYPES.FileSystem, { useValue: mockFileSystem });
    container.register(TYPES.Path, { useValue: mockPath });
    container.register(TYPES.Logger, { useValue: mockLogger });
    container.register<PromptManager>(PromptManager, {
      useFactory: (c) => {
        const logger = c.resolve<ILogger>(TYPES.Logger);
        const fileSystem = c.resolve<IFileSystem>(TYPES.FileSystem);
        const pathService = c.resolve<IPath>(TYPES.Path);
        return new PromptManager(logger, fileSystem, pathService, { baseDir: mockPromptsDir });
      }
    });

    mockFileSystem.readdir.mockResolvedValueOnce(['v1']);
    mockFileSystem.readdir.mockResolvedValueOnce([`${promptName}.prompt`]);
    mockFileSystem.readFile.mockResolvedValueOnce(`---
name: Test
---
Content`); // Missing description
    mockFileSystem.stat.mockResolvedValue({ isDirectory: () => true }); // Ensure stat is mocked

    promptManager = container.resolve(PromptManager);
    await expect((promptManager as any).loadPromise).rejects.toThrow('Missing required metadata fields (name and description)');
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Missing required metadata fields (name and description)'), expect.any(Object));
  });

  it('should return correct stats', async () => {
    // Ensure prompts are loaded
    await promptManager.getPrompt('system', {});
    const stats = promptManager.getStats();
    expect(stats.currentVersion).toBe('v1');
    expect(stats.availableVersions).toEqual(['v1']);
    expect(stats.cacheSize).toBeGreaterThan(0); // At least system prompt should be cached
    expect(stats.totalPrompts).toBe(6); // 6 prompts mocked
  });
});

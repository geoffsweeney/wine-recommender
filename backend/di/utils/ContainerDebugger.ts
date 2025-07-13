import { DependencyContainer, InjectionToken } from 'tsyringe';
import { TYPES } from '../Types'; // Assuming TYPES is accessible

export class ContainerDebugger {
  private container: DependencyContainer;

  constructor(container: DependencyContainer) {
    this.container = container;
  }

  /**
   * Lists all known registered dependency tokens.
   * Note: tsyringe does not expose a direct way to list all registered tokens.
   * This method relies on the `TYPES` object to list potential registrations.
   * For actual runtime registrations, a more advanced mechanism would be needed.
   */
  public listKnownDependencies(): string[] {
    return Object.keys(TYPES).map(key => {
      const token = (TYPES as any)[key];
      if (typeof token === 'symbol') {
        return `Symbol(${token.description || key})`;
      }
      return key; // For string tokens, if any
    });
  }

  /**
   * Attempts to resolve a dependency and logs its type.
   * Useful for checking if a dependency can be resolved.
   */
  public checkResolution<T>(token: InjectionToken<T>): { token: string; resolvable: boolean; instanceType?: string; error?: string } {
    try {
      const instance = this.container.resolve(token);
      return {
        token: this.getTokenName(token),
        resolvable: true,
        instanceType: instance?.constructor?.name || typeof instance,
      };
    } catch (error) {
      return {
        token: this.getTokenName(token),
        resolvable: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Provides a basic representation of a dependency's tree.
   * This is a simplified version and might not show the full runtime graph.
   */
  public getDependencyTree(token: InjectionToken<any>, depth = 0, maxDepth = 3, visited = new Set<InjectionToken<any>>()): string[] {
    const tree: string[] = [];
    const tokenName = this.getTokenName(token);
    const indent = '  '.repeat(depth);

    if (visited.has(token)) {
      tree.push(`${indent}- ${tokenName} (Circular Reference Detected)`);
      return tree;
    }

    visited.add(token);
    tree.push(`${indent}- ${tokenName}`);

    if (depth >= maxDepth) {
      tree.push(`${indent}  ... (max depth reached)`);
      return tree;
    }

    // This part is highly dependent on tsyringe's internal metadata, which is not public.
    // A more robust solution would involve parsing the class's constructor parameters
    // using reflection metadata (reflect-metadata).
    // For now, we'll just list direct dependencies if they are explicitly known or can be inferred.

    // Example: If we knew how to get constructor parameters and their @inject tokens
    // const dependencies = getDependenciesFromMetadata(token); // Hypothetical function
    // for (const depToken of dependencies) {
    //   tree.push(...this.getDependencyTree(depToken, depth + 1, maxDepth, visited));
    // }

    // For a practical debugger, you might manually map common dependencies or
    // rely on the ConfigurationRegistry to provide dependency graph information.
    // Since ConfigurationRegistry is planned to handle dependency graphs,
    // this method might be more useful for simple resolution checks.

    return tree;
  }

  private getTokenName(token: InjectionToken<any>): string {
    if (typeof token === 'symbol') {
      return `Symbol(${token.description || 'unknown'})`;
    }
    if (typeof token === 'function' && token.name) {
      return token.name;
    }
    return String(token);
  }
}
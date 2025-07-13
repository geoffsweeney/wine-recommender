import { TYPES } from './Types';
import { ContainerManager } from './ContainerManager';

type ServiceConfig = {
  dependencies: symbol[];
  initializationOrder?: number;
};

export class ConfigurationRegistry {
  private serviceConfigs: Map<symbol, ServiceConfig> = new Map();
  private dependencyGraph: Map<symbol, Set<symbol>> = new Map();
  private sortedServices: symbol[] = [];

  constructor(private containerManager: ContainerManager) {}

  public registerService(
    serviceToken: symbol,
    dependencies: symbol[] = []
  ): void {
    this.serviceConfigs.set(serviceToken, { dependencies });
    this.dependencyGraph.set(serviceToken, new Set(dependencies));
  }

  public validateConfiguration(): void {
    this.detectCircularDependencies();
    this.topologicalSort();
    this.validateDependencies();
  }

  public getInitializationOrder(): symbol[] {
    return [...this.sortedServices];
  }

  private detectCircularDependencies(): void {
    const visited = new Map<symbol, CycleState>();
    enum CycleState { VISITING, VISITED }
    const path: symbol[] = []; // To store the current path in DFS

    const visit = (service: symbol): boolean => {
      visited.set(service, CycleState.VISITING);
      path.push(service);

      const dependencies = this.dependencyGraph.get(service) || new Set();
      for (const dep of dependencies) {
        const depState = visited.get(dep);
        if (depState === CycleState.VISITING) {
          // Cycle detected! Reconstruct the cycle path
          const cycleStartIndex = path.indexOf(dep);
          const cyclePath = path.slice(cycleStartIndex).map(token => token.toString());
          throw new Error(`Circular dependency detected: ${cyclePath.join(' -> ')} -> ${dep.toString()}`);
        }
        if (depState === undefined) { // Not visited yet
          if (visit(dep)) {
            return true; // Propagate cycle detection up
          }
        }
      }

      path.pop(); // Remove from current path as we backtrack
      visited.set(service, CycleState.VISITED);
      return false;
    };

    for (const service of this.dependencyGraph.keys()) {
      if (visited.get(service) === undefined) { // Only visit unvisited nodes
        if (visit(service)) {
          // This branch should ideally not be reached if the error is thrown inside visit()
          // but it's good for completeness.
          // The error is thrown directly from inside the recursive call.
        }
      }
    }
  }

  private topologicalSort(): void {
    const numDependencies: Map<symbol, number> = new Map();
    const dependents: Map<symbol, symbol[]> = new Map(); // Maps a service to services that depend on it

    // Initialize numDependencies and build dependents map
    for (const [service, config] of this.serviceConfigs) {
      numDependencies.set(service, config.dependencies.length);
      for (const dep of config.dependencies) {
        if (!dependents.has(dep)) {
          dependents.set(dep, []);
        }
        dependents.get(dep)?.push(service);
      }
    }

    const queue: symbol[] = [];
    this.sortedServices = [];

    // Enqueue services with no dependencies
    for (const [service, count] of numDependencies) {
      if (count === 0) {
        queue.push(service);
      }
    }

    let count = 0;
    while (queue.length > 0) {
      const service = queue.shift()!;
      this.sortedServices.push(service);
      count++;

      // For each service that depends on the current service
      const servicesThatDependOnThis = dependents.get(service) || [];
      for (const dependentService of servicesThatDependOnThis) {
        numDependencies.set(dependentService, numDependencies.get(dependentService)! - 1);
        if (numDependencies.get(dependentService) === 0) {
          queue.push(dependentService);
        }
      }
    }

    if (count !== this.serviceConfigs.size) {
      const remainingServices = Array.from(numDependencies.entries())
        .filter(([, count]) => count > 0)
        .map(([token]) => token.toString());
      throw new Error(`Circular dependencies prevent topological sorting. Remaining services in cycle: ${remainingServices.join(', ')}`);
    }
  }

  private validateDependencies(): void {
    for (const [service, config] of this.serviceConfigs) {
      for (const dep of config.dependencies) {
        if (!this.containerManager.getMainContainer().isRegistered(dep)) {
          throw new Error(`Dependency ${dep.toString()} for service ${service.toString()} is not registered`);
        }
      }
    }
  }

  public getServiceConfig(service: symbol): ServiceConfig {
    const config = this.serviceConfigs.get(service);
    if (!config) {
      throw new Error(`Configuration not found for service: ${service.toString()}`);
    }
    return config;
  }

  public getAllServiceTokens(): symbol[] {
    return Array.from(this.serviceConfigs.keys());
  }
}
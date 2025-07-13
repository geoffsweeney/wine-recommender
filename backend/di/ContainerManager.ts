import { DependencyContainer } from 'tsyringe';
import { TYPES } from './Types';
import { Mutex } from './Mutex';

export class ContainerManager {
  private static instance: ContainerManager;
  private mainContainer!: DependencyContainer;
  private childContainers: DependencyContainer[] = [];

  private constructor() {
    // Private constructor to enforce singleton
  }

  private static readonly mutex = new Mutex();

  public static async getInstance(): Promise<ContainerManager> {
    if (!ContainerManager.instance) {
      await ContainerManager.mutex.runExclusive(async () => {
        if (!ContainerManager.instance) {
          ContainerManager.instance = new ContainerManager();
        }
      });
    }
    return ContainerManager.instance;
  }

  public initializeContainer(container: DependencyContainer): void {
    this.mainContainer = container;
    this.childContainers = [];
  }

  public createChildContainer(): DependencyContainer {
    const childContainer = this.mainContainer.createChildContainer();
    this.childContainers.push(childContainer);
    return childContainer;
  }

  public getMainContainer(): DependencyContainer {
    return this.mainContainer;
  }

  public validateContainer(): void {
    // Implementation for container validation
    this.validateDependencies();
    this.checkForCircularDependencies();
  }

  public resetContainer(): void {
    this.mainContainer.reset();
    this.childContainers.forEach(container => container.reset());
    this.childContainers = [];
  }

  private validateDependencies(): void {
    // Check all required dependencies are registered
    Object.values(TYPES).forEach(token => {
      if (!this.mainContainer.isRegistered(token)) {
        throw new Error(`Dependency not registered: ${token.toString()}`);
      }
    });
  }

  private checkForCircularDependencies(): void {
    // Stub for circular dependency check
    // Actual implementation would use a graph-based approach
  }

  // Additional lifecycle management methods
  public async shutdown(): Promise<void> {
    await this.teardownServices();
    this.resetContainer();
  }

  private async teardownServices(): Promise<void> {
    // Implementation for graceful shutdown of services
  }
}
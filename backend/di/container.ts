import 'reflect-metadata';
import { container, DependencyContainer } from 'tsyringe';
import { DependencySetup } from './DependencySetup';

export async function setupContainer(): Promise<DependencyContainer> {
  const dependencySetup = new DependencySetup(container);
  await dependencySetup.setup();
  return container;
}

export { container };

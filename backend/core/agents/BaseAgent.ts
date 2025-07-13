import { inject } from 'tsyringe'; // Import inject
import { AgentMessage } from './communication/AgentMessage'; // Temporary import, will be refactored
import { AgentError } from './AgentError';
import { Result } from '../types/Result';
import { TYPES } from '../../di/Types'; // Import TYPES

// Placeholder for AgentDependencies - will be properly defined in backend/di/Types.ts
interface AgentDependencies {
  logger: any; // Replace with actual logger interface
  messageQueue: any; // Replace with actual message queue interface
  stateManager: any; // Replace with actual state manager interface
  config: any; // Replace with actual config interface
  cache?: any;
  metrics?: any;
}

export abstract class BaseAgent<TConfig = unknown, TState = unknown> {
  protected readonly id: string;
  protected readonly config: TConfig;
  protected state: TState;
  protected dependencies: AgentDependencies; // Made protected for now

  constructor(
    id: string,
    config: TConfig,
    @inject(TYPES.AgentDependencies) dependencies: AgentDependencies
  ) {
    this.id = id;
    this.config = config;
    this.dependencies = dependencies;
    this.validateConfig(config);
    this.state = this.getInitialState();
  }
  
  protected abstract handleMessage<T>(
    message: AgentMessage<T>
  ): Promise<Result<AgentMessage | null, AgentError>>; // Changed return type to Result
  
  protected abstract validateConfig(config: TConfig): void;
  protected abstract getInitialState(): TState;
}
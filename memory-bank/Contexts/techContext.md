# Technical Context

## Core Technologies
- **Frontend**: Next.js 14
- **Backend**: Node.js 20
- **LLM Integration**: Ollama
- **Database**: SQLlite
- **Testing**: Jest, React Testing Library

## Development Environment
- Node.js 20.x
- npm 10.x
- TypeScript 5.x
- ESLint + Prettier for code quality
- Docker for containerization

## Key Dependencies
  - Frontend:
    - react
    - next
    - tailwindcss
    - class-variance-authority, clsx, tailwind-merge, lucide-react (UI components)
- Backend:
    - next (handles API routes)
    - tsyringe (Dependency Injection)
    - reflect-metadata (for tsyringe decorators)
    - ollama (LLM interaction - assumed, check package.json)
    - @modelcontextprotocol/sdk (MCP communication)
    - iron-session (Session management)
    - sql.js (SQLite database)
    - zod (Validation, now also for LLM prompt variables)
    - fs/promises (Node.js built-in for asynchronous file system operations)
    - path (Node.js built-in for handling and transforming file paths)
    - jest (Testing)

## Environment Variables
- OLLAMA_HOST
- NODE_ENV
- API_SECRET
- DATABASE_URL (if applicable)

## Development Setup
1. Install Node.js and npm
2. Clone repository
3. Run `npm install`
4. Configure environment variables
5. Start development servers:
   - Frontend: `npm run dev`
   - Backend: `npm run start:dev`

## Testing Strategy
- Unit tests for individual components and functions
- Integration tests for API endpoints
- End-to-end tests for user flows
- Mock services for external dependencies

### Service Mocking

We utilize `jest-mock-extended` to create deep mocks of service dependencies in our unit and integration tests. This approach provides granular control over mock behavior, ensuring better test isolation and reliability compared to manual mocking or extending base classes.

For example, in `src/services/__tests__/RecommendationService.test.ts`, we use `mockDeep` to create mocks for `Neo4jService`, `KnowledgeGraphService`, and the logger, injecting these mocks into the `RecommendationService` instance under test.

It is recommended to implement mocks for services that interact with external dependencies or have complex side effects, such as the `LLMService`, to ensure fast, deterministic, and cost-effective test execution.

## Deployment Considerations
- Containerized deployment with Docker
- CI/CD pipeline setup
- Monitoring and logging
- Scalability planning

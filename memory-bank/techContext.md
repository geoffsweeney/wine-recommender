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
    - zod (Validation)
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

## Deployment Considerations
- Containerized deployment with Docker
- CI/CD pipeline setup
- Monitoring and logging
- Scalability planning

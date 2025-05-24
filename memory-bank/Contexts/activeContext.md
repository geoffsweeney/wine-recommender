# Active Context (Updated: 2025-04-06)

## Current Focus
- Refining the LLM Orchestrator workflow and tool implementations.
- Implementing actual MCP client calls for the `research_wine_prices` tool.
- Improving state management within `ContextModel` based on tool results.
- Enhancing error handling and testing coverage, particularly integration tests.

## Recent Changes
- Implemented `LLMOrchestrator` to replace `AgentCoordinator`.
- Defined core tools (`get_initial_recommendations`, `research_wine_prices`, `analyze_wine_value`, `ask_user_question`, `present_final_result`) within `ToolRegistry`.
- Integrated `LLMOrchestrator` into the `/api/chat.ts` API route.
- Verified core orchestrator logic with unit tests.
- Implemented `McpClientService.ts` and integrated it into `/api/chat.ts` to enable actual MCP calls for the `research_wine_prices` tool.
- Updated documentation (`progress.md`, `systemPatterns.md`, `plan_llm_orchestrator.md`, `projectbrief.md`, etc.) to reflect the new architecture and progress.
- Merged feature branch (`feat/improve-tool-schema-prompting`) into `main` and cleaned up branches.

## Next Steps (High Level - See progress.md & remaining_tasks.md for details)
1.  Implement actual data fetching (replace mock) in the Buyer Agent MCP server.
2.  Refine `SommelierAgent` prompts and parsing.
3.  Implement context updates in `ContextModel` based on tool results.
4.  Improve API response handling after tool execution.
5.  Add integration tests for the API endpoint.
6.  Address TODOs within tool implementations (`ToolRegistry.ts`).
7.  Verify/complete `DatabaseService` implementation.
8.  Implement Authentication & Authorization.

## Active Decisions
- Using LLM Orchestrator pattern for backend workflow management.
- Tool-based architecture for encapsulating actions.
- Using MCP for communication with the Buyer Agent server.
- Continuing with Next.js, Node.js, Ollama, SQLite stack.

## Considerations
- Robust error handling across the orchestration flow.
- Efficient state management and context updates.
- Scalability of the LLM calls and tool executions.
- Security implications of tool execution and MCP calls.
- Need for comprehensive integration testing.

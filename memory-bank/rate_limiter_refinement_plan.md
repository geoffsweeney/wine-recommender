# Rate Limiter Refinement Plan

## Objective

Refine the rate limiter implementation in `src/server.ts` and update the corresponding tests in `src/server/__tests__/rateLimiter.test.ts` to address failing tests and ensure the rate limiter is applied correctly to specific routes.

## Analysis

- The current rate limiter middleware in `src/server.ts` is applied globally to all routes, which is not the intended behavior.
- The calculation for the `ratelimit-remaining` header is incorrect.
- Error handling for exceeding the rate limit is missing in the middleware.
- The tests in `src/server/__tests__/rateLimiter.test.ts` target test routes that will not be rate limited once the middleware is applied correctly, causing them to fail.

## Plan

1.  **Modify `src/server.ts`:**
    *   Update the `rateLimiterMiddleware` function:
        *   Import `RateLimiterMemory` error type from `rate-limiter-flexible`.
        *   Implement a `try...catch` block around the `llmRateLimiter.consume(clientIp)` call.
        *   In the `catch` block, check if the caught error is an instance of the `RateLimiterMemory` error type. If it is, send a 429 status code response with:
            *   A `retry-after` header set to the `msBeforeNext` property of the error object, converted to seconds.
            *   A JSON body like `{ error: 'Too many requests, please try again later.' }`.
        *   If the error is not a `RateLimiterMemory` error, re-throw the error or pass it to `next(error)`.
        *   Adjust the `ratelimit-remaining` header calculation to use the `remainingPoints` property from the result of the `llmRateLimiter.consume` promise.
    *   Remove the global application of the middleware by deleting the line `app.use(rateLimiterMiddleware);`.
    *   Import the `createRouter` function from `./api/routes`.
    *   Mount the API router with the rate limiter middleware applied specifically to the `/api` path: `app.use('/api', rateLimiterMiddleware, createRouter());`.

2.  **Modify `src/server/__tests__/rateLimiter.test.ts`:**
    *   Update all test requests that currently target `/test-rate-limit` or `/test-rate-limit-2` to instead target `/api/recommendations` (using a POST request with a minimal valid JSON body, e.g., `{}`) or `/api/search` (using a GET request with a query parameter, e.g., `/api/search?query=test`).
    *   Review the test case 'should track different endpoints separately'. Since a single rate limiter is applied to the entire `/api` router, this test's original intent (testing separate rate limits per endpoint) is no longer applicable in the same way. It should be removed or commented out, or potentially adapted if a different aspect of rate limiting needs to be tested (e.g., user-specific rate limits, which is not currently implemented). For this plan, I will suggest removing it as it tests a behavior that will no longer exist.
    *   Ensure the test case 'should include proper rate limit headers' correctly targets a rate-limited route (`/api/recommendations` or `/api/search`).
    *   Ensure the test case 'should reset after window expires' correctly targets a rate-limited route (`/api/recommendations` or `/api/search`).

## Implementation Steps (to be performed in Code Mode)

1.  Open `src/server.ts`.
2.  Implement the changes to `rateLimiterMiddleware` as described in the plan.
3.  Remove the global `app.use(rateLimiterMiddleware);`.
4.  Import `createRouter` and apply the middleware to the `/api` path.
5.  Open `src/server/__tests__/rateLimiter.test.ts`.
6.  Update test requests to target `/api/recommendations` or `/api/search`.
7.  Remove or comment out the 'should track different endpoints separately' test.
8.  Run the tests to confirm they pass.
9.  Review the code for any potential issues or further refinements.
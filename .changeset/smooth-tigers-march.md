---
"@techstream/quark-create-app": patch
---

Fix OpenRouter error classification and max-rounds behavior in AI worker

- **Error classification**: Change remaining `AppError` throws in the streaming code path to `ServiceError("OpenRouter", ...)` for proper external-service error handling (OpenRouter API errors, missing response body, retry exhaustion)
- **Graceful max-rounds**: Replace `throw new AppError` when the tool-calling loop exceeds 20 rounds with a graceful return that includes `truncated: true` and an assistant hint message, preventing conversation crashes

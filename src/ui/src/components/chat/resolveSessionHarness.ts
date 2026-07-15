import type {
  AgentBackendConfig,
  AgentBackendRuntimeHarness,
} from "../../services/tauri/agentBackends";
import { effectiveHarness } from "../../services/tauri/agentBackends";
import { resolveSessionBackend } from "./resolveSessionBackend";

/**
 * Resolve the runtime harness for a chat session using the same fallback
 * chain the Rust send pipeline applies: explicit per-session provider →
 * org default backend id → first available backend. Returns `null` only
 * when the backend list is genuinely empty (e.g. agent_backends hasn't
 * loaded yet). Callers should treat `null` as "don't know — be
 * conservative" (disable destructive actions, fail closed) rather than
 * assuming a specific harness.
 *
 * Used by `ChatPanel`'s `/compact` dispatch purely as a readiness guard:
 * a `null` result means `agent_backends` hasn't loaded yet, so `/compact`
 * should surface a "backend not ready" notice rather than fire blind.
 * Every harness (Claude Code, Codex Native) supports `/compact`, so the
 * resolved harness value itself no longer gates the command.
 */
export function resolveSessionHarness(args: {
  sessionId: string;
  selectedModelProvider: Record<string, string | undefined>;
  agentBackends: AgentBackendConfig[];
  defaultAgentBackendId: string;
}): AgentBackendRuntimeHarness | null {
  const { sessionId, selectedModelProvider, agentBackends, defaultAgentBackendId } = args;
  const backend = resolveSessionBackend({
    sessionId,
    selectedModelProvider,
    agentBackends,
    defaultAgentBackendId,
  });
  if (!backend) return null;
  return effectiveHarness(backend);
}

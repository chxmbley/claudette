import { useMemo } from "react";
import { useAppStore } from "../../stores/useAppStore";
import { buildModelRegistry, type Model } from "./modelRegistry";

/**
 * Returns the chat-side model registry with Claudette's cross-cutting
 * visibility gates (`alternativeBackendsEnabled` / `codexEnabled`)
 * already applied — always pulled from the store so no consumer
 * rebuilds what `shouldExposeBackendModels` already encodes.
 */
export function useModelRegistry(): readonly Model[] {
  const alternativeBackendsEnabled = useAppStore(
    (s) => s.alternativeBackendsEnabled,
  );
  const codexEnabled = useAppStore((s) => s.codexEnabled);
  const agentBackends = useAppStore((s) => s.agentBackends);
  return useMemo(
    () =>
      buildModelRegistry(alternativeBackendsEnabled, agentBackends, codexEnabled),
    [alternativeBackendsEnabled, agentBackends, codexEnabled],
  );
}

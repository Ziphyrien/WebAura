import { useLiveQuery } from "dexie-react-hooks";
import { loadSession } from "@firefly/pi/sessions/session-service";

export function useSelectedSessionSummary(sessionId: string | undefined) {
  return useLiveQuery(async () => {
    if (!sessionId) {
      return undefined;
    }

    return await loadSession(sessionId);
  }, [sessionId]);
}

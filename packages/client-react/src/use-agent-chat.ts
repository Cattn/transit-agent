import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiClientError, applyDraftPatch, createDeviceId, type AgentMessageResponse, type DraftState, type DraftChangeSource, type TripDraftPatch, type PlanResponse } from '@transit/shared';
import { useApi } from './api-context.js';

export interface ChatMessage { id: string; role: 'user' | 'agent'; text: string; questions?: AgentMessageResponse['questions']; plan?: PlanResponse; draft?: DraftState; at: string }

function resultingDraft(draft: DraftState, patch: TripDraftPatch): DraftState {
  try {
    return applyDraftPatch(draft, patch, 'agent');
  } catch {
    return draft;
  }
}

export function useAgentChat(draft: DraftState, apply: (patch: TripDraftPatch, source: DraftChangeSource) => void) {
  const api = useApi();
  const session = useRef<string | undefined>(undefined);
  const busy = useRef(false);
  const generation = useRef(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiClientError>();
  const [lastPlan, setLastPlan] = useState<PlanResponse>();
  const [previousApi, setPreviousApi] = useState(api);
  if (previousApi !== api) {
    setPreviousApi(api);
    setMessages([]);
    setPending(false);
    setError(undefined);
    setLastPlan(undefined);
  }
  useEffect(() => () => { generation.current++; session.current = undefined; busy.current = false; }, [api]);
  const send = useCallback(async (text: string) => {
    if (busy.current || !text.trim()) return;
    busy.current = true;
    const current = generation.current;
    setPending(true);
    setError(undefined);
    setMessages((items) => [...items, { id: createDeviceId(), role: 'user', text, at: new Date().toISOString() }]);
    try {
      const response = await api.sendAgentMessage({ sessionId: session.current, message: text, draft: draft.draft });
      if (current !== generation.current) return;
      session.current = response.sessionId;
      apply(response.draftPatch, 'agent');
      setLastPlan(response.plan);
      const snapshot = response.plan ? { plan: response.plan, draft: resultingDraft(draft, response.draftPatch) } : {};
      setMessages((items) => [...items, { id: createDeviceId(), role: 'agent', text: response.reply, questions: response.questions, ...snapshot, at: new Date().toISOString() }]);
    } catch (error) {
      if (current === generation.current) setError(error instanceof ApiClientError ? error : new ApiClientError(0, 'unknown', String(error)));
    } finally {
      if (current === generation.current) { busy.current = false; setPending(false); }
    }
  }, [api, draft, apply]);
  return { messages, pending, error, send, lastPlan };
}

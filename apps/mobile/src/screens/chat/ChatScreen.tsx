import { useEffect, useMemo, useRef } from 'react';
import { describePatch, type DraftChangeSource, type DraftState, type PlanResponse, type TripDraft, type TripDraftPatch } from '@transit/shared';
import { useAgentChat } from '@transit/client-react';
import { useAppColors } from '../../theme/appearance';
import type { AppColors } from '../../theme/colors';
import { ChatChrome } from './ChatChrome';

export interface AgentChip {
  field: string;
  label: string;
}

export interface ChatEntry {
  id: string;
  role: 'user' | 'agent';
  text: string;
  chips: AgentChip[];
  questions: string[];
  replies: string[];
}

export interface ChatChromeProps {
  colors: AppColors;
  entries: ChatEntry[];
  pending: boolean;
  error?: string;
  onSend: (text: string) => void;
  onChip: (field: string) => void;
  onClose: () => void;
}

export interface ChatScreenProps {
  draft: DraftState;
  apply: (patch: TripDraftPatch, source: DraftChangeSource) => void;
  onPlan: (plan: PlanResponse, draft: TripDraft) => void;
  onOpenFilters: (field: string) => void;
  onClose: () => void;
}

function agentChips({ draft, provenance }: DraftState): AgentChip[] {
  const chips: AgentChip[] = [];
  for (const [field, source] of Object.entries(provenance)) {
    if (source !== 'agent') continue;
    const [group, key] = field.split('.') as [keyof typeof draft, string | undefined];
    const value: unknown = key ? (draft[group] as Record<string, unknown> | undefined)?.[key] : draft[group];
    if (value === undefined) continue;
    const patch = (key ? { [group]: { [key]: value } } : { [group]: value }) as TripDraftPatch;
    const label = describePatch(patch)[0];
    if (label) chips.push({ field, label });
  }
  return chips;
}

export function ChatScreen({ draft, apply, onPlan, onOpenFilters, onClose }: ChatScreenProps) {
  const colors = useAppColors();
  const { messages, pending, error, send, lastPlan } = useAgentChat(draft, apply);

  const forwarded = useRef<PlanResponse>(undefined);
  useEffect(() => {
    if (!lastPlan || forwarded.current === lastPlan) return;
    forwarded.current = lastPlan;
    onPlan(lastPlan, draft.draft);
  }, [lastPlan, draft.draft, onPlan]);

  const entries = useMemo<ChatEntry[]>(() => {
    const lastAgent = messages.findLastIndex((message) => message.role === 'agent');
    const lastWithOptions = messages.findLastIndex((message) => message.questions?.some((question) => question.options?.length));
    const chips = agentChips(draft);
    return messages.map((message, index) => ({
      id: message.id,
      role: message.role,
      text: message.text,
      chips: index === lastAgent ? chips : [],
      questions: message.questions?.map((question) => question.question) ?? [],
      replies: index === lastWithOptions && index === messages.length - 1 ? (message.questions ?? []).flatMap((question) => question.options ?? []) : []
    }));
  }, [messages, draft]);

  const errorText = error
    ? error.status === 503 || error.code === 'agent_unavailable' ? 'The agent is not available yet.' : 'Could not reach the agent. Try again.'
    : undefined;

  return (
    <ChatChrome
      colors={colors}
      entries={entries}
      pending={pending}
      error={errorText}
      onSend={(text) => void send(text.trim())}
      onChip={onOpenFilters}
      onClose={onClose}
    />
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { describePatch, type DraftChangeSource, type DraftState, type PlanResponse, type TripDraft, type TripDraftPatch } from '@transit/shared';
import { useAgentChat } from '@transit/client-react';
import { useAppColors } from '../../theme/appearance';
import type { AppColors } from '../../theme/colors';
import { itineraryCardText } from '../results/ItineraryCard';
import type { ResultCard } from '../results/ResultsScreen';
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
  card?: ResultCard;
}

export interface ChatChromeProps {
  colors: AppColors;
  entries: ChatEntry[];
  pending: boolean;
  status?: string;
  error?: string;
  onSend: (text: string) => void;
  onChip: (field: string) => void;
  onCard: (entryId: string) => void;
  onClose: () => void;
}

export type ChatSession = ReturnType<typeof useAgentChat> & { changed: string[] };

export interface ChatScreenProps {
  draft: DraftState;
  chat: ChatSession;
  now: Date;
  onOpenFilters: (field: string) => void;
  onSelectCard: (draft: DraftState, plan: PlanResponse, itineraryId: string) => void;
  onClose: () => void;
}

const nestedGroups = new Set(['vehicles', 'constraints', 'preferences']);

function changedFields(patch: TripDraftPatch): string[] {
  return Object.entries(patch).flatMap(([group, value]) => (nestedGroups.has(group) && value ? Object.keys(value).map((key) => `${group}.${key}`) : [group]));
}

function agentChips({ draft, provenance }: DraftState, changed: string[]): AgentChip[] {
  const chips: AgentChip[] = [];
  for (const field of changed) {
    if (provenance[field] !== 'agent') continue;
    const [group, key] = field.split('.') as [keyof typeof draft, string | undefined];
    const value: unknown = key ? (draft[group] as Record<string, unknown> | undefined)?.[key] : draft[group];
    if (value === undefined) continue;
    const patch = (key ? { [group]: { [key]: value } } : { [group]: value }) as TripDraftPatch;
    const label = describePatch(patch)[0];
    if (label) chips.push({ field, label });
  }
  return chips;
}

export function useChatSession(draft: DraftState, apply: (patch: TripDraftPatch, source: DraftChangeSource) => void, onPlan: (plan: PlanResponse, draft: TripDraft) => void): ChatSession {
  const [changed, setChanged] = useState<string[]>([]);
  const track = useCallback((patch: TripDraftPatch, source: DraftChangeSource) => {
    setChanged(changedFields(patch));
    apply(patch, source);
  }, [apply]);
  const chat = useAgentChat(draft, track);
  const { lastPlan } = chat;

  const forwarded = useRef<PlanResponse>(undefined);
  useEffect(() => {
    if (!lastPlan || forwarded.current === lastPlan) return;
    forwarded.current = lastPlan;
    onPlan(lastPlan, draft.draft);
  }, [lastPlan, draft.draft, onPlan]);

  return { ...chat, changed };
}

export function ChatScreen({ draft, chat, now, onOpenFilters, onSelectCard, onClose }: ChatScreenProps) {
  const colors = useAppColors();
  const { messages, pending, error, send, changed, progress } = chat;

  const entries = useMemo<ChatEntry[]>(() => {
    const lastAgent = messages.findLastIndex((message) => message.role === 'agent');
    const lastWithOptions = messages.findLastIndex((message) => message.questions?.some((question) => question.options?.length));
    const chips = agentChips(draft, changed);
    return messages.map((message, index) => {
      const best = message.plan?.itineraries[0];
      return {
        id: message.id,
        role: message.role,
        text: message.text,
        chips: index === lastAgent ? chips : [],
        questions: message.questions?.map((question) => question.question) ?? [],
        replies: index === lastWithOptions && index === messages.length - 1 ? (message.questions ?? []).flatMap((question) => question.options ?? []) : [],
        card: best && message.draft ? { id: best.id, text: itineraryCardText(best, now, message.draft.draft.timeZone), selected: false, saved: false } : undefined
      };
    });
  }, [messages, draft, changed, now]);

  const status = { idle: 'Thinking…', thinking: 'Thinking…', locating: 'Finding places…', searching: 'Searching routes…', routes: 'Found routes, finishing up…', done: 'Finishing up…', error: 'Thinking…' }[progress.phase];

  const errorText = error
    ? error.status === 503 || error.code === 'agent_unavailable' ? 'The agent is not available yet.' : 'Could not reach the agent. Try again.'
    : undefined;

  return (
    <ChatChrome
      colors={colors}
      entries={entries}
      pending={pending}
      status={status}
      error={errorText}
      onSend={(text) => void send(text.trim())}
      onChip={onOpenFilters}
      onCard={(entryId) => {
        const message = messages.find((item) => item.id === entryId);
        const best = message?.plan?.itineraries[0];
        if (message?.draft && message.plan && best) onSelectCard(message.draft, message.plan, best.id);
      }}
      onClose={onClose}
    />
  );
}

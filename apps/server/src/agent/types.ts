import type { AgentMessageRequest, AgentMessageResponse, AgentProgressUpdate } from '@transit/shared';

export interface AgentTurnInput extends AgentMessageRequest { deviceId: string }
export type ProgressEmitter = (update: AgentProgressUpdate) => void;
export interface PlannerAgent {
  respond(input: AgentTurnInput, signal?: AbortSignal): Promise<AgentMessageResponse>;
  stream?(input: AgentTurnInput, emit: ProgressEmitter, signal?: AbortSignal): Promise<AgentMessageResponse>;
}

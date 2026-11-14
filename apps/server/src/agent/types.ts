import type { AgentMessageRequest, AgentMessageResponse } from '@transit/shared';

export interface AgentTurnInput extends AgentMessageRequest { deviceId: string }
export interface PlannerAgent {
  respond(input: AgentTurnInput, signal?: AbortSignal): Promise<AgentMessageResponse>;
}

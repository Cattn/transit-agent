import { InMemorySessionService, LlmAgent, Runner, isFinalResponse } from '@google/adk';
import { AgentMessageResponseSchema } from '@transit/shared';
import type { AgentTurnInput, PlannerAgent } from './types.js';
import { createPlannerTools, type TurnContext } from './tools.js';
import { instructions } from './instructions.js';
import { modelFor } from './models.js';

const sessions = new InMemorySessionService();
const appName = 'transit-agent';

export class AdkPlanner implements PlannerAgent {
  constructor(private readonly deps: Pick<TurnContext, 'providers' | 'itineraries'>) {}

  async respond(input: AgentTurnInput, signal?: AbortSignal) {
    const abortSignal = AbortSignal.any([AbortSignal.timeout(40_000), ...(signal ? [signal] : [])]);
    const scope = { appName, userId: input.deviceId };
    const session = (input.sessionId ? await sessions.getSession({ ...scope, sessionId: input.sessionId }) : undefined)
      ?? await sessions.createSession(scope);
    const turn: TurnContext = { ...this.deps, deviceId: input.deviceId, draft: input.draft, patch: {}, questions: [], signal: abortSignal };
    const tools = createPlannerTools(turn);
    const agent = new LlmAgent({ name: 'trip_planner', model: modelFor('planner'), instruction: instructions(input.draft.timeZone), tools });
    const runner = new Runner({ appName, agent, sessionService: sessions });
    let reply = '';
    try {
      for await (const event of runner.runAsync({ userId: input.deviceId, sessionId: session.id, abortSignal, newMessage: { role: 'user', parts: [{ text: JSON.stringify({ message: input.message, draft: input.draft }) }] } })) {
        // A model error arrives as an event, not a throw. Fail the turn instead of returning an empty reply.
        if (event.errorCode) throw new Error(`Planner model error ${event.errorCode}: ${event.errorMessage ?? 'no message'}`);
        if (isFinalResponse(event)) reply = event.content?.parts?.map((part) => part.text ?? '').join('') ?? '';
      }
      abortSignal.throwIfAborted();
      return AgentMessageResponseSchema.parse({ sessionId: session.id, reply, draftPatch: turn.patch, questions: turn.questions, plan: turn.plan });
    } finally {
      await runner.close();
    }
  }
}

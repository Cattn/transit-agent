import { InMemorySessionService, LlmAgent, Runner, isFinalResponse } from '@google/adk';
import { AgentMessageResponseSchema } from '@transit/shared';
import type { AgentTurnInput, PlannerAgent, ProgressEmitter } from './types.js';
import { createPlannerTools, type TurnContext } from './tools.js';
import { instructions } from './instructions.js';
import { modelFor, thinkingFor } from './models.js';

const sessions = new InMemorySessionService();
const appName = 'transit-agent';

export class AdkPlanner implements PlannerAgent {
  constructor(private readonly deps: Pick<TurnContext, 'providers' | 'itineraries' | 'places'>) {}

  respond(input: AgentTurnInput, signal?: AbortSignal) {
    return this.run(input, () => undefined, signal);
  }

  stream(input: AgentTurnInput, emit: ProgressEmitter, signal?: AbortSignal) {
    return this.run(input, emit, signal);
  }

  private async run(input: AgentTurnInput, emit: ProgressEmitter, signal?: AbortSignal) {
    const abortSignal = AbortSignal.any([AbortSignal.timeout(40_000), ...(signal ? [signal] : [])]);
    const scope = { appName, userId: input.deviceId };
    const session = (input.sessionId ? await sessions.getSession({ ...scope, sessionId: input.sessionId }) : undefined)
      ?? await sessions.createSession(scope);
    const turn: TurnContext = { ...this.deps, deviceId: input.deviceId, draft: input.draft, location: input.location, patch: {}, questions: [], signal: abortSignal, emit };
    const tools = createPlannerTools(turn);
    const agent = new LlmAgent({ name: 'trip_planner', model: modelFor('planner'), instruction: instructions(input.draft.timeZone), tools, generateContentConfig: { thinkingConfig: { thinkingLevel: thinkingFor('planner') } } });
    const runner = new Runner({ appName, agent, sessionService: sessions });
    let reply = '';
    emit({ type: 'thinking' });
    try {
      for await (const event of runner.runAsync({ userId: input.deviceId, sessionId: session.id, abortSignal, newMessage: { role: 'user', parts: [{ text: JSON.stringify({ message: input.message, draft: input.draft, location: input.location }) }] } })) {
        if (event.errorCode) throw new Error(`Planner model error ${event.errorCode}: ${event.errorMessage ?? 'no message'}`);
        if (isFinalResponse(event)) reply = event.content?.parts?.map((part) => part.text ?? '').join('') ?? '';
      }
      abortSignal.throwIfAborted();
      const response = AgentMessageResponseSchema.parse({ sessionId: session.id, reply, draftPatch: turn.patch, questions: turn.questions, plan: turn.plan });
      emit({ type: 'done', response });
      return response;
    } finally {
      await runner.close();
    }
  }
}

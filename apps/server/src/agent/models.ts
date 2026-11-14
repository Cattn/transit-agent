export type AgentTask = 'planner';

export function modelFor(task: AgentTask, env = process.env): string {
  return env[`AGENT_MODEL_${task.toUpperCase()}`]?.trim() || env.GEMINI_MODEL?.trim() || 'gemini-4-hydrogen';
}

const truthy = (value: string | undefined) => ['true', '1'].includes(value?.trim().toLowerCase() ?? '');

/** Vertex AI mode, mirroring ADK: GOOGLE_GENAI_USE_ENTERPRISE wins over the deprecated GOOGLE_GENAI_USE_VERTEXAI. */
export function usesVertex(env = process.env): boolean {
  return env.GOOGLE_GENAI_USE_ENTERPRISE !== undefined ? truthy(env.GOOGLE_GENAI_USE_ENTERPRISE) : truthy(env.GOOGLE_GENAI_USE_VERTEXAI);
}

/** The planner can run with a Gemini API key, or on Vertex AI with Application Default Credentials. */
export function plannerConfigured(env = process.env): boolean {
  if (usesVertex(env)) return Boolean(env.GOOGLE_CLOUD_PROJECT?.trim() && env.GOOGLE_CLOUD_LOCATION?.trim());
  return Boolean(env.GEMINI_API_KEY?.trim() || env.GOOGLE_API_KEY?.trim() || env.GOOGLE_GENAI_API_KEY?.trim());
}

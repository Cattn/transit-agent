import { ThinkingLevel } from '@google/genai';

export type AgentTask = 'planner';

const defaultThinking: Record<AgentTask, ThinkingLevel> = { planner: ThinkingLevel.LOW };

export function modelFor(task: AgentTask, env = process.env): string {
  return env[`AGENT_MODEL_${task.toUpperCase()}`]?.trim() || env.GEMINI_MODEL?.trim() || 'gemini-3.8-flash';
}

export function thinkingFor(task: AgentTask, env = process.env): ThinkingLevel {
  const level = env[`AGENT_THINKING_${task.toUpperCase()}`]?.trim().toUpperCase();
  return Object.values(ThinkingLevel).find((value) => value === level) ?? defaultThinking[task];
}

const truthy = (value: string | undefined) => ['true', '1'].includes(value?.trim().toLowerCase() ?? '');

export function usesVertex(env = process.env): boolean {
  return env.GOOGLE_GENAI_USE_ENTERPRISE !== undefined ? truthy(env.GOOGLE_GENAI_USE_ENTERPRISE) : truthy(env.GOOGLE_GENAI_USE_VERTEXAI);
}

export function plannerConfigured(env = process.env): boolean {
  if (usesVertex(env)) return Boolean(env.GOOGLE_CLOUD_PROJECT?.trim() && env.GOOGLE_CLOUD_LOCATION?.trim());
  return Boolean(env.GEMINI_API_KEY?.trim() || env.GOOGLE_API_KEY?.trim() || env.GOOGLE_GENAI_API_KEY?.trim());
}

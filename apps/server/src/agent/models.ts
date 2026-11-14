export type AgentTask = 'planner';

export function modelFor(task: AgentTask, env = process.env): string {
  return env[`AGENT_MODEL_${task.toUpperCase()}`]?.trim() || env.GEMINI_MODEL?.trim() || 'gemini-4-hydrogen';
}

import { describe, expect, it } from 'vitest';
import { plannerConfigured } from './models.js';

describe('plannerConfigured', () => {
  it('is off with no credentials', () => expect(plannerConfigured({})).toBe(false));
  it('accepts a Gemini API key', () => expect(plannerConfigured({ GEMINI_API_KEY: 'k' })).toBe(true));
  it('accepts Vertex AI with project and location (ADC)', () =>
    expect(plannerConfigured({ GOOGLE_GENAI_USE_VERTEXAI: 'true', GOOGLE_CLOUD_PROJECT: 'p', GOOGLE_CLOUD_LOCATION: 'global' })).toBe(true));
  it('needs project and location in Vertex mode', () =>
    expect(plannerConfigured({ GOOGLE_GENAI_USE_ENTERPRISE: '1', GOOGLE_CLOUD_PROJECT: 'p', GEMINI_API_KEY: 'k' })).toBe(false));
  it('lets GOOGLE_GENAI_USE_ENTERPRISE=false override the deprecated flag', () =>
    expect(plannerConfigured({ GOOGLE_GENAI_USE_ENTERPRISE: 'false', GOOGLE_GENAI_USE_VERTEXAI: 'true', GEMINI_API_KEY: 'k' })).toBe(true));
});

describe('planner tool declarations', () => {
  it('omit schema keywords Gemini function declarations reject', async () => {
    const { createPlannerTools } = await import('./tools.js');
    const declarations = JSON.stringify(createPlannerTools({} as never).map((tool) => tool._getDeclaration()));
    expect(declarations).not.toMatch(/exclusiveM(in|ax)imum/);
    expect(declarations).toContain('carMpg');
  });
});

describe('planner instructions', () => {
  it('include the current local date and time so "now" resolves', async () => {
    const { instructions } = await import('./instructions.js');
    const text = instructions('America/New_York', new Date('2026-11-14T09:05:00Z'));
    expect(text).toContain('Today is 2026-11-14 and the current time is 04:05, timezone America/New_York.');
  });
});

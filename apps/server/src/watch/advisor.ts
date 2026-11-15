import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { z } from 'zod';
import type { Itinerary, SavedItinerary, WatchStatus } from '@transit/shared';
import { modelFor, usesVertex } from '../agent/models.js';

const MINUTE_MS = 60_000;
const ADVISOR_TIMEOUT_MS = 20_000;

export interface WatchIssue {
  saved: SavedItinerary;
  current: Itinerary;
  status: WatchStatus;
  departInMinutes: number;
  replacements: Itinerary[];
}

export interface WatchAdvice {
  message: string;
  replacementId?: string;
}

export interface WatchAdvisor {
  advise(issue: WatchIssue, signal?: AbortSignal): Promise<WatchAdvice>;
}

export function thinkingForLead(departInMinutes: number): ThinkingLevel {
  if (departInMinutes > 120) return ThinkingLevel.HIGH;
  if (departInMinutes > 30) return ThinkingLevel.MEDIUM;
  return ThinkingLevel.LOW;
}

const AdviceSchema = z.object({ message: z.string().min(1).max(280), replacementId: z.string().optional() });

const brief = (it: Itinerary) => ({
  id: it.id,
  summary: it.summary,
  departAt: it.departAt,
  arriveAt: it.arriveAt,
  transfers: it.transfers,
  walkMinutes: it.walkMinutes,
  costUsd: it.cost.totalUsd,
  risk: it.risk,
  legs: it.legs.map((leg) => ({ mode: leg.mode, routeName: leg.routeName, departAt: leg.departAt, arriveAt: leg.arriveAt, timeSource: leg.timeSource, delayMinutes: leg.delayMinutes }))
});

const instruction = `You watch a saved transit trip for one rider and write the status line their home screen shows.
Something changed: a delay, a risk of arriving late, or a missed departure.
Write one or two short, calm sentences. Keep the exact leave-by time and clock times from ruleMessage; never invent times, delays or live data.
If replacements are listed, choose the best one for this rider (on time for arriveBy first, then fewer transfers and less waiting) and return its id as replacementId, and say what changed.
Reply as JSON: {"message": string, "replacementId"?: string}.`;

export class GeminiWatchAdvisor implements WatchAdvisor {
  private readonly client: GoogleGenAI;

  constructor(env = process.env) {
    this.client = usesVertex(env)
      ? new GoogleGenAI({ vertexai: true, project: env.GOOGLE_CLOUD_PROJECT, location: env.GOOGLE_CLOUD_LOCATION })
      : new GoogleGenAI({ apiKey: env.GEMINI_API_KEY || env.GOOGLE_API_KEY || env.GOOGLE_GENAI_API_KEY });
  }

  async advise(issue: WatchIssue, signal?: AbortSignal): Promise<WatchAdvice> {
    const timeout = AbortSignal.timeout(ADVISOR_TIMEOUT_MS);
    const response = await this.client.models.generateContent({
      model: modelFor('watch'),
      contents: JSON.stringify({
        label: issue.saved.label,
        timeZone: issue.saved.request.timeZone,
        arriveBy: issue.saved.request.constraints.arriveBy,
        lateTolerance: issue.saved.request.preferences.lateTolerance,
        departInMinutes: Math.round(issue.departInMinutes),
        state: issue.status.state,
        ruleMessage: issue.status.message,
        trip: brief(issue.current),
        replacements: issue.replacements.map(brief)
      }),
      config: {
        systemInstruction: instruction,
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingLevel: thinkingForLead(issue.departInMinutes) },
        abortSignal: signal ? AbortSignal.any([signal, timeout]) : timeout
      }
    });
    const advice = AdviceSchema.parse(JSON.parse(response.text ?? ''));
    if (advice.replacementId !== undefined && !issue.replacements.some((it) => it.id === advice.replacementId)) delete advice.replacementId;
    return advice;
  }
}

export const minutesUntil = (iso: string, now: Date) => (Date.parse(iso) - now.getTime()) / MINUTE_MS;

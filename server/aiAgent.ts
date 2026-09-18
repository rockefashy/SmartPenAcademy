import { GoogleGenAI, Type, FunctionDeclaration } from '@google/genai';
import { db } from './supabaseDb.ts';
import { User, StudentProfile, ROLES, AuditExecutionMode } from '../src/types';
import { sendFeeReminderEmail } from './email.ts';
import { landingProperties } from '../src/properties/landing.properties.ts';
import { ALL_TOOLS, PUBLIC_TOOLS, getToolsForRole, toolRegistry } from './tools/registry.ts';
export { ALL_TOOLS, PUBLIC_TOOLS, getToolsForRole, toolRegistry };
import { verifyToolStudentAccess, canCoachAccessStudent, findStudent } from './tools/helpers.ts';
export { verifyToolStudentAccess, canCoachAccessStudent, findStudent };
import { buildRoleSystemInstruction } from './prompts/agentPrompts.ts';
import { detectIntent } from './helpers/intentRouter.ts';
import { recordAudit, sanitizeAuditArguments } from './helpers/audit.ts';
export { detectIntent };
export type EnrollmentIntent = 'student' | 'coach' | null;

// ================= RATE LIMITING FOR MUTATING TOOLS (SUPABASE-BACKED ATOMIC RPC) =================
async function checkToolRateLimit(
  userId: string,
  toolName: string,
  maxCalls: number,
  windowMs: number
): Promise<{ allowed: boolean; retryAfter: number }> {
  const key = `tool:${userId}:${toolName}`;
  const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));
  return await db.checkRateLimit(key, maxCalls, windowSeconds);
}

export interface ToolCallResult {
  toolName: string;
  args: any;
  result: any;
  summary: string;
  success: boolean;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'model' | 'system';
  content: string;
  toolResults?: ToolCallResult[];
}

export interface AIAgentRequest {
  messages: ChatMessage[];
  userContext: User | null;
  settings?: {
    apiKey?: string;
    apiUrl?: string;
    model?: string;
    temperature?: number;
  };
}

// AgentTool Execution Engine with Strict Ownership Validation, Rate-Limiting, and Centralized Audit Logging
export async function executeTool(
  name: string,
  args: any,
  userContext: User | null,
  executionMode: AuditExecutionMode = 'remote_gemini'
): Promise<ToolCallResult> {
  const today = new Date().toISOString().split('T')[0];

  const logAudit = async (result: any, summary: string, success: boolean): Promise<ToolCallResult> => {
    const sanitizedArgs = sanitizeAuditArguments(args);

    try {
      await recordAudit({
        actorId: userContext?.id,
        actorUsername: userContext?.username,
        actorRole: userContext?.role,
        actorStudentId: userContext?.studentId,
        action: name,
        summary,
        arguments: sanitizedArgs,
        result: result ? (typeof result === 'object' ? result : { data: result }) : null,
        status: success ? 'success' : 'failed',
        executionMode
      });
    } catch (auditErr) {
      console.error('[AUDIT LOG ERROR]', auditErr);
    }

    return {
      toolName: name,
      args: sanitizedArgs,
      result,
      summary,
      success
    };
  };

  // 1. Tool Lookup in AgentTool Registry
  const tool = toolRegistry[name];
  if (!tool) {
    return await logAudit(null, `Tool ${name} is not recognized.`, false);
  }

  // 2. Atomic PostgreSQL Rate Limiting via tool-declared threshold
  const rateLimit = tool.rateLimit || { maxCalls: 30, windowMs: 60 * 1000 };
  const rateCheck = await checkToolRateLimit(userContext?.id || 'anonymous', name, rateLimit.maxCalls, rateLimit.windowMs);
  if (!rateCheck.allowed) {
    return await logAudit(
      null,
      `Rate limit exceeded: Too many '${name}' calls requested in a short period. Please wait ${rateCheck.retryAfter} seconds before trying again.`,
      false
    );
  }

  // 3. Declarative Role-Based Access Control
  if (tool.allowedRoles && tool.allowedRoles.length > 0) {
    if (!userContext || !tool.allowedRoles.includes(userContext.role as any)) {
      return await logAudit(
        null,
        tool.accessDeniedMessage || `Access Denied: You do not have permission to execute '${name}'.`,
        false
      );
    }
  }

  // 4. Execution & Centralized Audit Logging
  try {
    const res = await tool.execute(args || {}, {
      user: userContext,
      executionMode,
      today
    });
    return await logAudit(res.result, res.summary, res.success !== false);
  } catch (error: any) {
    console.error(`Error executing tool ${name}:`, error);
    return await logAudit(null, `Error executing tool ${name}: ${error.message || error}`, false);
  }
}

// System instructions and intent routing are delegated to ./prompts/agentPrompts.ts and ./helpers/intentRouter.ts

// Master AI Agent Process Function - Direct LLM Reasoning with Tools and Natural Language Response
export async function handleAIAgentChat(reqBody: AIAgentRequest): Promise<{ reply: string; toolResults: ToolCallResult[] }> {
  const { messages, userContext, settings } = reqBody;

  // Zero-LLM Fast-Path: Consolidated Intent Intercept
  const lastUserMessage = [...(messages || [])].reverse().find(m => m.role === 'user')?.content || '';
  const fastPathResponse = detectIntent(lastUserMessage, userContext);
  if (fastPathResponse) {
    return fastPathResponse;
  }

  const apiKey = settings?.apiKey || process.env.GEMINI_API_KEY;
  const preferredModel = settings?.model || 'gemini-3.8-flash';

  if (!apiKey) {
    return {
      reply: "⚠️ The AI assistant is currently offline because the Gemini API key is not configured.",
      toolResults: []
    };
  }

  // Resilient model fallback chain with Gemini 3.8 Flash and Gemini 3.7 Flash as primary
  const candidateModels = [
    preferredModel,
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-flash-latest'
  ].filter((v, i, a) => a.indexOf(v) === i);

  const systemInstruction = buildRoleSystemInstruction(userContext);
  const activeTools = getToolsForRole(userContext?.role);

  // Construct conversation history for Gemini
  const contents: any[] = messages.slice(-10).map(m => ({
    role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });

  // Generous timeout (45 seconds) to give the LLM ample time for tool execution and response generation
  const fetchWithTimeout = async (
    modelName: string,
    callContents: any[],
    includeTools: boolean = true,
    timeoutMs: number = 45000
  ) => {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Model ${modelName} timed out after ${timeoutMs}ms`)), timeoutMs);
    });

    const isThinkingModel = modelName.includes('3.') || modelName.includes('2.5');

    const generatePromise = ai.models.generateContent({
      model: modelName,
      contents: callContents,
      config: {
        systemInstruction,
        temperature: settings?.temperature ?? 0.7,
        ...(isThinkingModel ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        ...(includeTools ? { tools: [{ functionDeclarations: activeTools }] } : {})
      }
    });

    return await Promise.race([generatePromise, timeoutPromise]);
  };

  let lastError: any = null;

  for (const modelToTry of candidateModels) {
    try {
      const response = await fetchWithTimeout(modelToTry, contents, true, 45000);

      const toolResults: ToolCallResult[] = [];
      const functionCalls = response.functionCalls;

      if (functionCalls && functionCalls.length > 0) {
        const functionResponses: any[] = [];
        for (const fc of functionCalls) {
          const toolResult = await executeTool(fc.name, fc.args, userContext, 'remote_gemini');
          toolResults.push(toolResult);
          functionResponses.push({
            functionResponse: {
              name: fc.name,
              response: { result: toolResult.result || toolResult.summary },
              ...(fc.id ? { id: fc.id } : {})
            }
          });
        }

        // Pass model candidate content (including thoughtSignature) and tool responses back to Gemini
        try {
          const modelCandidateContent = response.candidates?.[0]?.content || {
            role: 'model',
            parts: functionCalls.map(fc => ({ functionCall: fc }))
          };

          const followUpContents = [
            ...contents,
            modelCandidateContent,
            {
              role: 'user',
              parts: functionResponses
            }
          ];

          // Call without tools so the model synthesizes the final conversational response
          const followUpResponse = await fetchWithTimeout(modelToTry, followUpContents, false, 45000);
          const followUpText = followUpResponse.text?.trim();
          if (followUpText) {
            return {
              reply: followUpText,
              toolResults
            };
          }
        } catch (followUpErr: any) {
          console.warn(`[AI_AGENT] Follow-up response synthesis with ${modelToTry} encountered error:`, followUpErr?.message || followUpErr);
        }

        // Graceful fallback to verified tool execution summaries if second conversational turn fails/throttles
        const toolSummaries = toolResults.map(t => t.summary).filter(Boolean).join('\n\n');
        return {
          reply: toolSummaries || "Your request was processed successfully.",
          toolResults
        };
      }

      return {
        reply: response.text || "I have processed your request.",
        toolResults: []
      };
    } catch (error: any) {
      lastError = error;
      const errMsg = error?.message || String(error);
      console.warn(`[AI_AGENT] Model ${modelToTry} failed:`, errMsg);

      // If transient 503 high demand spike, perform a single brief backoff retry before falling through
      if (errMsg.includes('503') || errMsg.includes('high demand') || errMsg.includes('UNAVAILABLE')) {
        try {
          console.info(`[AI_AGENT] Retrying ${modelToTry} after 1.5s backoff for transient 503...`);
          await new Promise(resolve => setTimeout(resolve, 1500));
          const retryResponse = await fetchWithTimeout(modelToTry, contents, true, 45000);
          if (retryResponse.text) {
            return {
              reply: retryResponse.text,
              toolResults: []
            };
          }
        } catch (retryErr: any) {
          console.warn(`[AI_AGENT] Retry for ${modelToTry} also failed:`, retryErr?.message || retryErr);
          lastError = retryErr;
        }
      }
      continue;
    }
  }

  // Parse error into human-friendly response rather than raw JSON
  const rawErr = lastError?.message || String(lastError || 'Unable to connect');
  let userFriendly = rawErr;
  if (rawErr.includes('429') || rawErr.includes('RESOURCE_EXHAUSTED') || rawErr.includes('quota')) {
    userFriendly = "The AI service is temporarily experiencing high traffic or quota limits. Please try again in a few seconds.";
  } else if (rawErr.includes('503') || rawErr.includes('UNAVAILABLE') || rawErr.includes('high demand')) {
    userFriendly = "Google Gemini is temporarily experiencing high demand spikes on their servers. Please try sending your message again in a few moments.";
  } else if (rawErr.includes('403') || rawErr.includes('PERMISSION_DENIED') || rawErr.includes('denied access')) {
    userFriendly = "The AI service API key or project access is restricted by Google. Please check your Gemini API key in settings or the Google Cloud console.";
  } else if (rawErr.startsWith('{')) {
    try {
      const parsed = JSON.parse(rawErr);
      userFriendly = parsed.error?.message || rawErr;
    } catch {
      userFriendly = rawErr;
    }
  }

  return {
    reply: `⚠️ ${userFriendly}`,
    toolResults: []
  };
}

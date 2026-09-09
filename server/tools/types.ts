import { FunctionDeclaration } from '@google/genai';
import { User } from '../../src/types';

export interface AgentToolContext {
  user: User | null;
  executionMode: 'remote_gemini' | 'local_agent' | 'direct_api';
  today: string;
}

export interface AgentToolResult {
  result: any;
  summary: string;
  success?: boolean;
}

export interface AgentTool {
  name: string;
  declaration: FunctionDeclaration;
  allowedRoles?: ('admin' | 'coach' | 'student')[];
  accessDeniedMessage?: string;
  rateLimit: {
    maxCalls: number;
    windowMs: number;
  };
  execute: (args: any, context: AgentToolContext) => Promise<AgentToolResult>;
}

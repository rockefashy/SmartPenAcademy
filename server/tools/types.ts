import { FunctionDeclaration } from '@google/genai';
import { User, AuditExecutionMode } from '../../src/types';

export interface AgentToolContext {
  user: User | null;
  executionMode: AuditExecutionMode;
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
  selfServiceOnly?: boolean;
  accessDeniedMessage?: string;
  rateLimit: {
    maxCalls: number;
    windowMs: number;
  };
  execute: (args: any, context: AgentToolContext) => Promise<AgentToolResult>;
}

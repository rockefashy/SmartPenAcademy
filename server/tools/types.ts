import { FunctionDeclaration } from '@google/genai';
import { User, AuditExecutionMode, ROLES, UserRole } from '../../src/types';
export { ROLES };
export type { UserRole };

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
  allowedRoles?: UserRole[];
  selfServiceOnly?: boolean;
  accessDeniedMessage?: string;
  rateLimit: {
    maxCalls: number;
    windowMs: number;
  };
  execute: (args: any, context: AgentToolContext) => Promise<AgentToolResult>;
}

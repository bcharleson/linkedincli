import type { z } from 'zod';

export interface CommandDefinition<TInput extends z.ZodObject<any> = z.ZodObject<any>> {
  /** MCP tool name, e.g. "profile_view" */
  name: string;
  /** CLI group, e.g. "profile" */
  group: string;
  /** CLI subcommand, e.g. "view" */
  subcommand: string;
  /** Shared help text for CLI and MCP */
  description: string;
  /** CLI usage examples */
  examples?: string[];
  /** Zod schema — validates both CLI flags and MCP input */
  inputSchema: TInput;
  /** Maps Zod fields to CLI args/options */
  cliMappings: CliMapping;
  /** HTTP endpoint (for standard CRUD via executeCommand) */
  endpoint?: {
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    path: string;
  };
  /** Where each field goes in the HTTP request */
  fieldMappings?: Record<string, 'path' | 'query' | 'body'>;
  /** Whether this endpoint returns paginated results */
  paginated?: boolean;
  /** Handler function — called for both CLI and MCP */
  handler: (input: any, client: LinkedInClient) => Promise<unknown>;
}

export interface CliMapping {
  args?: Array<{
    field: string;
    name: string;
    required?: boolean;
  }>;
  options?: Array<{
    field: string;
    flags: string;
    description?: string;
  }>;
}

export interface GlobalOptions {
  output?: string;
  pretty?: boolean;
  quiet?: boolean;
  fields?: string;
  fromChrome?: boolean;
  chromeProfile?: string;
  liAt?: string;
  jsessionid?: string;
}

export interface AuthFlags {
  liAt?: string;
  jsessionid?: string;
  fromChrome?: boolean;
  chromeProfile?: string;
}

export interface LinkedInAuth {
  liAt: string;
  jsessionid: string;
  /**
   * Full cookie header with all linkedin.com cookies. When present, the HTTP
   * client uses this instead of synthesizing a minimal `li_at; JSESSIONID`
   * pair — LinkedIn's anti-abuse can invalidate sessions that send a thin jar.
   */
  cookieHeader?: string;
}

export interface LinkedInClient {
  request<T = unknown>(options: {
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    path: string;
    query?: Record<string, string | number | boolean | undefined>;
    body?: unknown;
    baseRequest?: boolean;
  }): Promise<T>;

  get<T = unknown>(path: string, query?: Record<string, any>): Promise<T>;
  post<T = unknown>(path: string, body?: unknown, query?: Record<string, any>): Promise<T>;
  patch<T = unknown>(path: string, body?: unknown): Promise<T>;
  put<T = unknown>(path: string, body?: unknown): Promise<T>;
  delete<T = unknown>(path: string, query?: Record<string, any>): Promise<T>;
}

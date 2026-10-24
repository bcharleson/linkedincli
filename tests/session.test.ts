import { afterEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { verifiedProfile } from '../src/core/session.js';
vi.mock('../src/core/config.js', () => ({ loadConfig: async () => ({ li_at: 'test', jsessionid: 'test' }) }));
vi.mock('../src/core/auth.js', () => ({ resolveAuth: async () => ({ liAt: 'test', jsessionid: 'test' }), wantsFromChrome: () => false }));
vi.mock('../src/core/output.js', () => ({ output: vi.fn(), outputError: vi.fn() }));
import { output } from '../src/core/output.js';
import { registerStatusCommand, sessionInvalidReason } from '../src/commands/auth/login.js';
const member = { firstName: 'Test', lastName: 'Member', entityUrn: 'urn:li:fs_miniProfile:test' };
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
it('accepts direct, nested, and normalized member responses', () => {
 for (const body of [member, {miniProfile:member}, {data:{miniProfile:member}}, {data:{'*miniProfile':member.entityUrn},included:[member]}]) expect(verifiedProfile(body)).toEqual(member);
});
it.each(['<html>Login</html>', {}, {message:'error'}, {included:[member]}, null])('rejects unrecognized payload %j', body => {
 expect(() => verifiedProfile(body)).toThrow(/could not be verified/);
});
it('preserves redirect diagnostics instead of claiming cookies expired', () => {
 expect(sessionInvalidReason({code:'AUTH_ERROR',message:'Session redirected by LinkedIn'})).toBe('Session redirected by LinkedIn');
});
async function verify(status: number, body: string, headers: Record<string,string> = {}) {
 const fetch = vi.fn().mockResolvedValue({status,headers:new Headers(headers),text:async()=>body});
 vi.stubGlobal('fetch',fetch);
 const program = new Command(); registerStatusCommand(program);
 await program.parseAsync(['status','--verify'], {from:'user'});
 return fetch;
}
it.each([429,500])('status verification does not retry HTTP %s', async status => {
 const fetch = await verify(status,'{}');
 expect(fetch).toHaveBeenCalledTimes(1);
 expect(output).toHaveBeenCalledWith(expect.objectContaining({session_valid:'unknown'}),expect.anything());
});
it('does not validate a 200 login page', async () => {
 await verify(200,'<html><form action="/login"></form></html>');
 expect(output).toHaveBeenCalledWith(expect.objectContaining({session_valid:'unknown'}),expect.anything());
});
it('validates a nested member response with a single GET', async () => {
 const fetch = await verify(200,JSON.stringify({miniProfile:member}));
 expect(fetch).toHaveBeenCalledTimes(1);
 expect(fetch.mock.calls[0][1]).toMatchObject({method:'GET',redirect:'manual'});
 expect(output).toHaveBeenCalledWith(expect.objectContaining({session_valid:true,profile:'Test Member'}),expect.anything());
});

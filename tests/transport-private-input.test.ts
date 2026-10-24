import { afterEach, expect, it, vi } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const dir = mkdtempSync(join(tmpdir(),'linkedin-private-input-'));
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); rmSync(dir,{recursive:true,force:true}); });
it('passes dummy credentials and body through stdin, not process arguments', async () => {
 const bin = join(dir,'fake-curl');
 writeFileSync(bin, `#!/usr/bin/env node
let input=''; process.stdin.on('data', c=>input+=c); process.stdin.on('end',()=>{
process.stdout.write('HTTP/1.1 200 OK\\r\\nContent-Type: application/json\\r\\n\\r\\n'+JSON.stringify({args:process.argv.slice(2),input}));
});`, {mode:0o700});
 vi.stubEnv('LINKEDIN_HTTP','curl-impersonate'); vi.stubEnv('LINKEDIN_CURL_IMPERSONATE_BIN',bin);
 const {httpRequest} = await import('../src/core/transport.js');
 const body=JSON.stringify({text:'quoted "text"\nnext line'});
 const response=await httpRequest('https://example.test/', {method:'POST',headers:{cookie:'li_at=dummy-private-token','csrf-token':'dummy-csrf'},body});
 const capture=JSON.parse(await response.text());
 expect(capture.args.join(' ')).not.toContain('dummy-private-token');
 expect(capture.args.join(' ')).not.toContain('dummy-csrf');
 expect(capture.input).toContain('header = "cookie: li_at=dummy-private-token"');
 expect(capture.input).toContain('data-binary = '+JSON.stringify(body));
 expect(capture.args).toContain('--config');
});

it.skipIf(!process.env.LINKEDIN_TEST_CURL_BIN)('round-trips private headers and escaped JSON through real curl on loopback', async () => {
 const {createServer} = await import('node:http');
 const server=createServer((req,res)=>{
  let body=''; req.on('data',c=>body+=c); req.on('end',()=>{
   res.setHeader('content-type','application/json'); res.end(JSON.stringify({cookie:req.headers.cookie,body}));
  });
 });
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 try {
  vi.stubEnv('LINKEDIN_HTTP','curl-impersonate');
  vi.stubEnv('LINKEDIN_CURL_IMPERSONATE_BIN',process.env.LINKEDIN_TEST_CURL_BIN!);
  const {httpRequest}=await import('../src/core/transport.js');
  const address=server.address() as {port:number};
  const body=JSON.stringify({text:'Quotes " and backslash \\ and newline\nUnicode ü'});
  const response=await httpRequest(`http://127.0.0.1:${address.port}/`,{method:'POST',headers:{cookie:'li_at=dummy-only'},body});
  expect(response.status).toBe(200);
  expect(JSON.parse(await response.text())).toEqual({cookie:'li_at=dummy-only',body});
 } finally { await new Promise<void>(resolve=>server.close(()=>resolve())); }
});

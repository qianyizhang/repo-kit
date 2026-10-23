import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { mkdtemp, mkdir, writeFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { DiscussionStore } from './packages/repo-canvas/src/server/discussion.ts';
import { documentSchema } from './packages/reports/contracts.ts';
const root = await mkdtemp(resolve('..','boundary-probes-'));
const repo = resolve(root, 'repo'); await mkdir(repo); execFileSync('git',['init','-q',repo]); await writeFile(resolve(repo,'README.md'),'Fixture only');
const client = new Client({name:'review-probe',version:'1'});
await client.connect(new StdioClientTransport({ command:process.execPath,args:[resolve('dist/canvas-server.mjs')],stderr:'pipe',env:{...process.env,XDG_STATE_HOME:root,MCP_APP_LOG_ROOT:resolve(root,'diagnostics')} }));
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
const call=(name:string,args:Record<string,unknown>,threadId=a)=>client.callTool({name,arguments:args,_meta:{threadId}});
const opened=await call('canvas_open',{repo}); const contextId=opened.structuredContent!.contextId;
const state=await call('canvas_app',{contextId,request:{action:'state',args:{}}}); const value=state.structuredContent!.value as any;
const observed=await call('canvas_app',{contextId,request:{action:'view_write',args:{view:{document:value.document,baseRevision:value.revision,scope:'repo',selections:[],panel:'chat',navigation:true,viewport:{x:0,y:0,zoom:1,width:1200,height:800},dirty:false,conflict:false}}}});
const revision=(observed.structuredContent!.value as any).revision;
const results:any={mode:'synthetic shared-server ownership probe; no installed cross-chat claim',crossChatApp:await call('canvas_app',{contextId,request:{action:'state',args:{}}},b),crossChatDiscovery:await call('canvas_requests',{},b),crossChatSnapshot:await call('canvas_snapshot',{contextId,includeDocument:true},b),crossChatCommand:await call('canvas_command',{contextId,expectedRevision:revision,command:{action:'fit'}},b)};
await client.close();
const identity={repo,chat:a,directory:root};const store=new DiscussionStore(identity);store.write(0,'fixture',[]);
const directory=resolve(root,'repo-workbench/discussions');const file=(await readdir(directory)).find(p=>p.endsWith('.json'))!;
await mkdir(resolve(directory,file+'.lock'));
try {new DiscussionStore(identity).write(1,'after restart',[]);results.orphanLock='unexpected success';}catch(e){results.orphanLock=String(e);}
const bad={version:3,title:'malformed fixture',threads:[{id:'thread',turns:[null]}]};results.nestedTraceValidation=documentSchema.safeParse(bad).success;
try { results.nullThreadValidation=documentSchema.safeParse({version:3,title:'malformed fixture',threads:[null]}).success;}catch(e){results.nullThreadValidationThrows=String(e);}
await writeFile(resolve('..','boundary-probes.json'),JSON.stringify(results,null,2));
console.log(JSON.stringify(results,null,2));

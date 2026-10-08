import {describe,expect,it} from 'vitest';
import {trialMessage} from './inviteAnalytics';

describe('invitation game telemetry',()=>{
 const run='a'.repeat(32);
 const source={} as Window;
 const frame={contentWindow:source} as HTMLIFrameElement;
 const src='https://game.example/play?mode=demo';
 it('accepts only a known game iframe and exact origin',()=>{
  const event={origin:'https://game.example',source,data:{protocol:'p2l-invite-analytics-v1',type:'trial_start',run_id:run}} as MessageEvent;
  expect(trialMessage(event,frame,src)).toEqual({event:'trial_start',runID:run});
  expect(trialMessage({...event,origin:'https://evil.example'} as MessageEvent,frame,src)).toBeNull();
  expect(trialMessage({...event,source:{} as Window} as MessageEvent,frame,src)).toBeNull();
  expect(trialMessage({...event,data:{...event.data,run_id:'bad'}} as MessageEvent,frame,src)).toBeNull();
 });
});

import {expect,it} from 'vitest';
import {readPlayerConfig} from './playerConfig';
import {walletConfiguration} from './walletConfig';
it('reads public client configuration and uses the selected network',()=>{
 const c=readPlayerConfig({VITE_TELEGRAM_BOT_USERNAME:' @p2l_bot ',VITE_TELEGRAM_APP_NAME:' play ',VITE_WALLETCONNECT_PROJECT_ID:'0123456789abcdef0123456789abcdef',VITE_WALLET_NETWORK:'testnet'});
 expect(c.telegram_bot_username).toBe('p2l_bot');expect(c.telegram_app_name).toBe('play');
 expect(walletConfiguration(c.walletconnect_project_id,c.wallet_network).chain.id).toBe(46630);
});
it('defaults to mainnet and leaves optional integration names empty',()=>{
 expect(readPlayerConfig({})).toEqual({telegram_bot_username:'',telegram_app_name:'',walletconnect_project_id:'',wallet_network:'mainnet'});
});
it('keeps invalid wallet settings subject to wallet validation',()=>{
 const c=readPlayerConfig({VITE_WALLETCONNECT_PROJECT_ID:'invalid'});
 expect(()=>walletConfiguration(c.walletconnect_project_id,c.wallet_network)).toThrow();
});

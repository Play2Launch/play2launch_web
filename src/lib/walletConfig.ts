// Official network parameters: https://docs.robinhood.com/chain/connecting/
export function walletConfiguration(projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '', network = import.meta.env.VITE_WALLET_NETWORK || 'mainnet') {
  if (!/^[a-f0-9]{32}$/i.test(projectId.trim())) throw new Error('WalletConnect Project ID is missing or invalid.');
  if (network !== 'mainnet' && network !== 'testnet') throw new Error('Wallet network must be mainnet or testnet.');
  const testnet = network === 'testnet';
  return {
    projectId: projectId.trim(),
    chain: {
      id: testnet ? 46630 : 4663,
      name: testnet ? 'Robinhood Chain Testnet' : 'Robinhood Chain',
      nativeCurrency: {name: 'Ether', symbol: 'ETH', decimals: 18},
      rpcUrls: {default: {http: [testnet ? 'https://rpc.testnet.chain.robinhood.com' : 'https://rpc.mainnet.chain.robinhood.com']}},
      blockExplorers: {default: {name: 'Blockscout', url: testnet ? 'https://explorer.testnet.chain.robinhood.com' : 'https://robinhoodchain.blockscout.com'}},
      testnet,
    },
  };
}

export function idoWalletChains() {
 const nativeCurrency={name:'Ether',symbol:'ETH',decimals:18};
 return [
  {id:1,name:'Ethereum',rpc:'https://ethereum-rpc.publicnode.com',explorer:'https://etherscan.io',testnet:false},
  {id:11155111,name:'Ethereum Sepolia',rpc:'https://ethereum-sepolia-rpc.publicnode.com',explorer:'https://sepolia.etherscan.io',testnet:true},
  {id:4663,name:'Robinhood Chain',rpc:'https://rpc.mainnet.chain.robinhood.com',explorer:'https://robinhoodchain.blockscout.com',testnet:false},
  {id:46630,name:'Robinhood Chain Testnet',rpc:'https://rpc.testnet.chain.robinhood.com',explorer:'https://explorer.testnet.chain.robinhood.com',testnet:true},
 ].map(n=>({id:n.id,name:n.name,nativeCurrency,rpcUrls:{default:{http:[n.rpc]}},blockExplorers:{default:{name:'Explorer',url:n.explorer}},testnet:n.testnet}));
}

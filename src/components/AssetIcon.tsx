export function AssetIcon({kind,size=24}:{kind:string;size?:number}) {
 const ethereum=kind==='ethereum', robinhood=kind==='robinhood';
 return <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" style={{flexShrink:0,verticalAlign:'middle'}}>
  <circle cx="16" cy="16" r="16" fill={ethereum?'#e9ecff':robinhood?'#d2ff5a':kind==='usdc'?'#2775ca':kind==='usdt'?'#269f82':'#173a32'}/>
  {ethereum?<><path d="M16 4 9 16l7 4 7-4Z" fill="#6275c9"/><path d="m9 18 7 10 7-10-7 4Z" fill="#45549a"/></>:robinhood?<><path d="M9 25c5-8 3-15 16-20 1 11-5 16-12 16Z" fill="#183520"/><path d="m11 23 9-13" stroke="#d2ff5a" strokeWidth="1.5"/></>:<text x="16" y="22" textAnchor="middle" fill="white" fontWeight="700" fontSize="18">{kind==='usdt'?'₮':kind==='usdc'?'$':'G'}</text>}
 </svg>;
}

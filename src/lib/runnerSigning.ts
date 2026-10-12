// Per-round client possession proof; neither obfuscation nor signatures prove
// human gameplay. The server independently replays every accepted report.
export const SIGNING_VERSION='p2l-sign-v1';
export type SigningMaterial={version:string;public_key:string;key_material:string};
type BoundRound={id:string;game_key:string;rules:string;seed:number;signing?:SigningMaterial};
const domain=new TextEncoder().encode('P2L-RUNNER-SIGNED-V1\n');
function decode(value:string,max:number){if(typeof value!=='string'||value.length>max)throw Error('Invalid round signing material.');return Uint8Array.from(atob(value),c=>c.charCodeAt(0))}
function encode(value:Uint8Array){let text='';for(const b of value)text+=String.fromCharCode(b);return btoa(text)}
const url64=(value:Uint8Array)=>encode(value).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
export function recoverRoundScalar(m:SigningMaterial){
 if(m.version!==SIGNING_VERSION)throw Error('Please refresh to update the game submission protocol.');
 const raw=decode(m.key_material,256);if(raw.length<64||raw.length>192)throw Error('Invalid round signing material.');
 const view=new DataView(raw.buffer,raw.byteOffset,raw.byteLength);
 // Check high words before converting bounded uint64s to JavaScript numbers.
 const fields=[0,8,16,24].map(offset=>{if(view.getUint32(offset,false)!==0)throw Error('Invalid signing rule.');return view.getUint32(offset+4,false)});
 const [a,la,b,lb]=fields;
 if(a>=b||b>32||la<1||la>64||lb<1||lb>64||raw.length!==64+la+lb)throw Error('Invalid signing rule.');
 let body=raw.slice(32);body=Uint8Array.from([...body.slice(0,a),...body.slice(a+la)]);body=Uint8Array.from([...body.slice(0,b),...body.slice(b+lb)]);
 raw.fill(0);return body;
}
const bytesToSign=(payload:Uint8Array)=>{const out=new Uint8Array(domain.length+payload.length);out.set(domain);out.set(payload,domain.length);return out};
export async function createRoundSigner(round:BoundRound){
 if(!round.signing||!globalThis.crypto?.subtle)throw Error('Secure game signing is unavailable. Refresh or use an updated HTTPS browser.');
 const m=round.signing,scalar=recoverRoundScalar(m),pub=decode(m.public_key,100);
 if(pub.length!==65||pub[0]!==4){scalar.fill(0);throw Error('Invalid signing public key.')}
 let key:CryptoKey;
 try{key=await crypto.subtle.importKey('jwk',{kty:'EC',crv:'P-256',x:url64(pub.slice(1,33)),y:url64(pub.slice(33)),d:url64(scalar),ext:false,key_ops:['sign']},{name:'ECDSA',namedCurve:'P-256'},false,['sign'])}finally{scalar.fill(0)}
 // Test the actual key and browser implementation before allowing the round.
 const verifier=await crypto.subtle.importKey('raw',pub,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
 const test=new TextEncoder().encode('P2L signing self-test');
 const signature=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,test);
 if(!await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},verifier,signature,test))throw Error('Round signing self-test failed.');
 // Only the host keeps this closure. No credentials/private material go to iframe.
 return async(submissionID:string,report:unknown)=>{
  if(!/^[a-f0-9]{32}$/.test(submissionID))throw Error('Invalid submission ID.');
  const payload=new TextEncoder().encode(JSON.stringify({v:SIGNING_VERSION,session_id:round.id,submission_id:submissionID,game_key:round.game_key,rules:round.rules,seed:round.seed,report}));
  if(payload.length>512*1024)throw Error('Game report is too large.');
  const sig=new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,bytesToSign(payload)));
  return {payload:encode(payload),signature:encode(sig)};
 };
}

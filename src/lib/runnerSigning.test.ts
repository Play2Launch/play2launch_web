import {webcrypto,generateKeyPairSync,verify} from 'node:crypto';
import {it,expect,vi,afterEach} from 'vitest';
import {createRoundSigner,recoverRoundScalar,SIGNING_VERSION,type SigningMaterial} from './runnerSigning';
function material(){const {privateKey,publicKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});const jwk=privateKey.export({format:'jwk'});const raw=Buffer.from(jwk.d!,'base64url');const header=Buffer.alloc(32);[8,15,24,10].forEach((v,i)=>header.writeBigUInt64BE(BigInt(v),i*8));const keyMaterial=Buffer.concat([header,raw.subarray(0,8),Buffer.alloc(15,123),raw.subarray(8,24),Buffer.alloc(10,42),raw.subarray(24)]);return {raw,publicKey,m:{version:SIGNING_VERSION,public_key:Buffer.concat([Buffer.from([4]),Buffer.from(jwk.x!,'base64url'),Buffer.from(jwk.y!,'base64url')]).toString('base64'),key_material:keyMaterial.toString('base64')} satisfies SigningMaterial}}
afterEach(()=>vi.unstubAllGlobals());
it('recovers two offsets and signs exact bound bytes interoperable with standard P-256',async()=>{
 vi.stubGlobal('crypto',webcrypto);const {m,raw,publicKey}=material();expect(Buffer.from(recoverRoundScalar(m))).toEqual(raw);
 const sign=await createRoundSigner({id:'gs1',game_key:'gx1',rules:'rules',seed:123,signing:m});const report={elapsed_ms:10000,score:1,inputs:[{tick:1,held:true},{tick:1,held:false}],metrics:{distance:0.5}};
 const result=await sign('a'.repeat(32),report);const bytes=Buffer.from(result.payload,'base64');
 expect(JSON.parse(bytes.toString())).toMatchObject({session_id:'gs1',seed:123,report});
 expect(verify('sha256',Buffer.concat([Buffer.from('P2L-RUNNER-SIGNED-V1\n'),bytes]),{key:publicKey,dsaEncoding:'ieee-p1363'},Buffer.from(result.signature,'base64'))).toBe(true);
 const changed=Buffer.from(bytes.toString().replace('gs1','gs2'));expect(verify('sha256',Buffer.concat([Buffer.from('P2L-RUNNER-SIGNED-V1\n'),changed]),{key:publicKey,dsaEncoding:'ieee-p1363'},Buffer.from(result.signature,'base64'))).toBe(false);
});
it('rejects invalid rules, unavailable crypto and inconsistent key material before play',async()=>{
 const {m}=material();const raw=Buffer.from(m.key_material,'base64');raw.writeBigUInt64BE(2n**63n,0);expect(()=>recoverRoundScalar({...m,key_material:raw.toString('base64')})).toThrow();
 vi.stubGlobal('crypto',undefined);await expect(createRoundSigner({id:'gs1',game_key:'gx1',rules:'rules',seed:1,signing:m})).rejects.toThrow();
 vi.stubGlobal('crypto',webcrypto);const other=material();await expect(createRoundSigner({id:'gs1',game_key:'gx1',rules:'rules',seed:1,signing:{...m,public_key:other.m.public_key}})).rejects.toThrow();
});

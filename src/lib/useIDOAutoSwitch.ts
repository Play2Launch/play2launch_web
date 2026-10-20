import {useEffect,useRef,useState} from 'react';
// One attempt per connected account and campaign chain. Later Relay chain changes
// must not trigger another switch back to the IDO network.
export function useIDOAutoSwitch(connected:boolean,address:string|undefined,actualChain:number|undefined,targetChain:number,switchChain:()=>Promise<unknown>){
 const attempted=useRef('');
 const [error,setError]=useState('');
 useEffect(()=>{
  if(!connected||!address){attempted.current='';setError('');return;}
  if(!Number.isSafeInteger(actualChain)||!actualChain)return;
  const key=`${address.toLowerCase()}:${targetChain}`;
  if(attempted.current===key)return;
  attempted.current=key;setError('');
  if(actualChain===targetChain)return;
  void switchChain().catch(()=>{
   if(attempted.current===key)setError('Network switch was cancelled or failed. Use the switch button to continue.');
  });
 },[connected,address,actualChain,targetChain,switchChain]);
 return error;
}

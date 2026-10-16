import {type ReactNode} from 'react';
import {Navigate,useLocation} from 'react-router-dom';
import {useApp} from '../state';

export function NicknameGate({children}:{children:ReactNode}){
 const {user}=useApp();const location=useLocation();
 if(user?.mode==='live'&&user.nicknameSet===false&&location.pathname!=='/profile'){
  // Do not mount the destination page: its effects could start a game before a redirect.
  return <Navigate to="/profile" replace/>;
 }
 return <>{children}</>;
}

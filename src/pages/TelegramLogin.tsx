import {Link} from 'react-router-dom';
import {useApp} from '../state';
export default function TelegramLogin(){
 const app=useApp();
 return <section className="empty-panel"><h1>Telegram sign-in</h1>{app.authError?<><p role="alert">{app.authError}</p><button className="btn btn-primary" onClick={()=>app.setAuthOpen(true)}>Try signing in again</button><Link to="/">Back to campaigns</Link></>:<p role="status">Completing your sign-in…</p>}</section>;
}

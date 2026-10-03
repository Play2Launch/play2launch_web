import { Link, useParams } from 'react-router-dom';
import { ActivityFeed } from '../components/ActivityFeed';

export default function PostDetail() {
 const {postId}=useParams();
 return <section className="post-detail"><Link className="text-link" to="/following">← Back to Feed</Link><h1>Post</h1>
 {postId && /^sp[0-9a-f]{64}$/.test(postId) ? <ActivityFeed key={postId} kind="user" discover postId={postId} filters={<span className="muted small">Public post</span>}/> : <div className="empty-panel">This post link is invalid.</div>}
 </section>;
}

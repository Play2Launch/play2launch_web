import { useState, type FormEvent } from "react";
import {
  BadgeCheck,
  ShieldCheck,
  LockKeyhole,
  ArrowUpRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useApp } from "../state";
import { LiveVerification } from "./LiveVerification";
import { liveAuth } from "../lib/api";
import { verificationLabels, type KolApplication } from "../lib/verification";

export function KolBadge() {
  const app = useApp();
  if (!app.kolPermissions.canCreateTeam) return null;
  return (
    <span
      className="kol-badge"
      title="Local KOL approval simulation. Not real identity verification or investment endorsement."
    >
      <BadgeCheck size={16} /> KOL VERIFIED · DEMO
    </span>
  );
}

export function ReviewDemoControls() {
  const app = useApp();
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const request = app.kolRequest;
  if (liveAuth) return null;
  const review = (status: "approved" | "rejected" | "revoked") => {
    try {
      app.reviewKolDemo(status, reason);
      setReason("");
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <section className="review-demo">
      <h3>Review simulation · NOT an admin console</h3>
      <p>
        Local test controls only. In production, review decisions belong to the
        server-side admin system.
      </p>
      {!request ? (
        <Link className="text-link" to="/verification">
          Submit a demo KOL application first <ArrowUpRight size={16} />
        </Link>
      ) : (
        <>
          <p>
            Current application:{" "}
            <strong>{verificationLabels[request.status]}</strong>
          </p>
          {(request.status === "pending" || request.status === "approved") && (
            <>
              <label>
                Review reason
                <textarea
                  maxLength={300}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Required for rejection or revocation"
                />
              </label>
              <div className="verification-actions">
                {request.status === "pending" ? (
                  <>
                    <button
                      className="btn btn-secondary"
                      onClick={() => review("approved")}
                    >
                      Simulate approval
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => review("rejected")}
                    >
                      Simulate rejection
                    </button>
                  </>
                ) : (
                  <button
                    className="btn btn-secondary"
                    onClick={() => review("revoked")}
                  >
                    Simulate revocation
                  </button>
                )}
              </div>
            </>
          )}
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}

export default function VerificationPage() {
  const app = useApp();
  const request = app.kolRequest;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">P2L / COMMUNITY IDENTITY</span>
          <h1>
            Earn your community badge<span>.</span>
          </h1>
          <p>
            Apply as a KOL captain. Campaigns are created and published by the
            platform.
          </p>
        </div>
        <ShieldCheck size={40} className="accent" />
      </div>
      <div className="verification-layout">
        <section className="membership-card verification-content">
          <span className="pill neutral">LOCAL APPLICATION · DEMO</span>
          {!app.user ? (
            <>
              <h2>Sign in to apply</h2>
              <p>
                Your application will be attached to your account, not a
                campaign invitation.
              </p>
              <button
                className="btn btn-primary"
                onClick={() => app.setAuthOpen(true)}
              >
                Sign in to apply <ArrowUpRight size={16} />
              </button>
            </>
          ) : liveAuth ? (
            <>
              <LiveVerification key={app.user.id} userId={app.user.id} />
            </>
          ) : (
            <>
              <h2>
                {request
                  ? verificationLabels[request.status]
                  : "Apply for KOL verification"}
              </h2>
              <KolBadge />
              {request && (
                <div className="verification-status" role="status">
                  <p>
                    {request.status === "pending"
                      ? "Application received. No privileges are granted while review is pending."
                      : request.reason}
                  </p>
                  <p className="small muted">
                    Updated {new Date(request.updated).toLocaleString()}
                  </p>
                  <p>
                    Submitted public profile:{" "}
                    <span className="verification-url">
                      {request.socialUrl}
                    </span>
                  </p>
                </div>
              )}
              {(!request ||
                request.status === "rejected" ||
                request.status === "revoked") && (
                <ApplicationForm
                  key={`${app.user.id}:${request?.updated || "new"}`}
                />
              )}
              {request?.status === "approved" && (
                <p>
                  Your demo KOL eligibility is active. Create a team in an
                  existing campaign; no campaign publishing rights were granted.
                  <Link className="text-link" to="/captain">
                    Open captain studio <ArrowUpRight size={16} />
                  </Link>
                </p>
              )}
              {request && (
                <details className="verification-history">
                  <summary>Application history</summary>
                  <ol>
                    {request.history.map((item, i) => (
                      <li key={i}>
                        <strong>{verificationLabels[item.status]}</strong> ·{" "}
                        {new Date(item.at).toLocaleString()}
                        <p>{item.reason}</p>
                      </li>
                    ))}
                  </ol>
                </details>
              )}
            </>
          )}
        </section>
        <aside className="membership-card verification-content">
          <h2>What the badge means</h2>
          <p>
            In production, P2L will review account ownership and community
            identity. A social link alone is not proof of ownership.
          </p>
          <div className="verification-permission">
            <BadgeCheck size={20} />
            <div>
              <strong>KOL / Captain</strong>
              <p>
                {app.kolPermissions.canCreateTeam
                  ? "Eligible to create a campaign team · demo."
                  : "Team creation stays locked until KOL approval."}
              </p>
            </div>
          </div>
          <div className="verification-permission">
            <LockKeyhole size={20} />
            <div>
              <strong>Platform-managed campaigns</strong>
              <p>
                Only platform administrators can create, publish or take down
                campaigns. Players and KOL captains cannot publish activities.
              </p>
            </div>
          </div>
          <p className="small muted">
            Demo badges are not real verification. No guarantee of token safety,
            returns or rewards. Never submit passwords, private keys or identity
            documents here.
          </p>
          <Link to="/profile" className="text-link">
            Back to profile <ArrowUpRight size={16} />
          </Link>
        </aside>
      </div>
    </>
  );
}

function ApplicationForm() {
  const app = useApp();
  const previous = app.kolRequest;
  const [input, setInput] = useState<KolApplication>({
    displayName: previous?.displayName || app.user?.name || "",
    socialUrl: previous?.socialUrl || "",
    introduction: previous?.introduction || "",
  });
  const [error, setError] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    try {
      app.submitKol(input);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <form className="verification-form" onSubmit={submit}>
      <label>
        Public display name
        <input
          required
          minLength={2}
          maxLength={60}
          value={input.displayName}
          onChange={(e) => setInput({ ...input, displayName: e.target.value })}
        />
      </label>
      <label>
        Public social profile
        <input
          required
          type="url"
          maxLength={150}
          placeholder="https://x.com/your_handle"
          value={input.socialUrl}
          onChange={(e) => setInput({ ...input, socialUrl: e.target.value })}
        />
      </label>
      <label>
        Community introduction
        <textarea
          required
          minLength={20}
          maxLength={500}
          rows={5}
          placeholder="Tell us about your community and the games you want to bring them to."
          value={input.introduction}
          onChange={(e) => setInput({ ...input, introduction: e.target.value })}
        />
      </label>
      <p className="small muted">
        Public information only. Stored on this device; nothing is sent for real
        review.
      </p>
      {error && (
        <p role="alert" className="negative">
          {error}
        </p>
      )}
      <button className="btn btn-primary" type="submit">
        {previous ? "Resubmit application" : "Submit application"}
        <ArrowUpRight size={16} />
      </button>
    </form>
  );
}

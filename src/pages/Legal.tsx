import { Link } from "react-router-dom";
import "./Legal.css";

function LegalHeader({ title, description }: { title: string; description: string }) {
  return (
    <header className="legal-header">
      <span className="eyebrow">PLAY TO LAUNCH · LEGAL</span>
      <h1>{title}</h1>
      <p>{description}</p>
      <small>Last updated October 13, 2026</small>
    </header>
  );
}

export function TermsPage() {
  return (
    <article className="legal-page">
      <LegalHeader title="Terms of Service" description="The rules for using PlayToLaunch, joining campaigns and taking part in the community." />
      <div className="legal-document">
        <p>These Terms of Service (“Terms”) govern your use of the PlayToLaunch website, Telegram Mini App, games, campaigns and community features (together, the “Service”). In these Terms, “P2L”, “we” and “us” refer to PlayToLaunch. By creating an account or using the Service, you agree to these Terms. If you do not agree, please do not use the Service.</p>

        <section><h2>1. Eligibility and your account</h2>
          <p>You must meet the minimum age and other eligibility requirements that apply where you live and to any campaign you enter. You may not use the Service where doing so would violate applicable law.</p>
          <p>Keep your account information accurate and your credentials secure. You are responsible for activity on your account. Do not sell, share or transfer your account without our authorization. Contact <a href="mailto:support@play2launch.com">support@play2launch.com</a> if you believe it has been compromised. Email and Telegram sign-in may also be subject to the relevant provider’s terms.</p>
        </section>

        <section><h2>2. Campaigns, games and rankings</h2>
          <p>Each campaign or game may have its own published eligibility, scoring, team and deadline rules. Those rules supplement these Terms. Only results accepted by our systems under the applicable rules count toward official rankings or campaign progress. Practice rounds, incomplete or invalid results, and submissions after a deadline may be excluded.</p>
          <p>We may investigate suspected errors, cheating or manipulation and correct or remove affected scores, rankings or benefits. Game scores, team scores, campaign progress and P2L Points are separate measures; one does not automatically create an entitlement in another.</p>
        </section>

        <section><h2>3. P2L Points and tokens</h2>
          <p>P2L Points are platform participation points governed by the rules shown in the Service. They are not money, cryptocurrency, securities or a stored-value balance, and cannot be bought, sold, transferred or redeemed unless we expressly introduce a separate program with its own terms.</p>
          <p>Earning P2L Points, joining a team, receiving KOL status or reaching a campaign milestone does not guarantee a token launch, token allocation, airdrop, reward or financial return. Any future token-related activity, if offered, will have separate terms and eligibility requirements. Information on P2L is not investment, legal or tax advice. We may correct points credited in error or obtained through prohibited activity.</p>
        </section>

        <section><h2>4. Teams, invitations and KOL status</h2>
          <p>Team membership and scoring follow each campaign’s published rules. Joining a team does not necessarily transfer scores previously earned elsewhere. An invitation does not override campaign deadlines, capacity, eligibility or joining restrictions.</p>
          <p>Referral credit is awarded only when its rules are met. Duplicate accounts, self-referrals, automated registrations and attempts to inflate participation are prohibited. KOL verification is a platform status, not our endorsement of a person’s statements or a promise of rewards. We may approve, reject or revoke that status under our verification and conduct rules. KOLs and captains may not falsely claim to represent P2L.</p>
        </section>

        <section><h2>5. Your content and conduct</h2>
          <p>You may publish posts, profile details, images, team information and other content (“User Content”). You retain ownership of it and give us a non-exclusive, worldwide, royalty-free license to host, display, format and share it as needed to operate and promote the Service. This license ends when the content is deleted, except where limited retention is needed for backups, legal obligations, disputes or copies already shared by others.</p>
          <p>You must have the rights to submit your content. Do not post unlawful, infringing, fraudulent, abusive or misleading material; impersonate or harass others; distribute malware; scrape or disrupt the Service; exploit game bugs; manipulate rankings; or evade restrictions. Do not use P2L to promote scams or make misleading claims about tokens or returns.</p>
          <p>We may review, limit or remove content and restrict accounts when reasonably needed to enforce these Terms, protect users or comply with law. Report concerns to <a href="mailto:support@play2launch.com">support@play2launch.com</a>.</p>
        </section>

        <section><h2>6. Third-party services</h2>
          <p>Campaigns may link to games, projects, websites or services run by others. We do not control their availability, content or practices. Review their terms and privacy notices before using them. A listing or link on P2L is not, by itself, a guarantee of safety or an endorsement.</p>
        </section>

        <section><h2>7. Privacy and account requests</h2>
          <p>Our <Link to="/privacy">Privacy Policy</Link> explains how we handle personal information. You may stop using the Service at any time. To request deletion of your account or personal information, email <a href="mailto:support@play2launch.com">support@play2launch.com</a>. We will review and process your request in accordance with the Privacy Policy and applicable law.</p>
        </section>

        <section><h2>8. Availability, changes and termination</h2>
          <p>We may update, suspend or discontinue features for maintenance, security, legal or operational reasons. We may suspend or close an account for a material breach, suspected fraud or a security risk. Where appropriate, we will explain our decision and consider an appeal sent to our support address.</p>
          <p>We may revise these Terms. We will publish the updated version and its date and provide additional notice of material changes where appropriate. If the law requires renewed agreement, we will request it before continued use.</p>
        </section>

        <section><h2>9. Disclaimers and contact</h2>
          <p>The Service is provided on an “as available” basis. We do not guarantee uninterrupted access, error-free operation, a particular ranking or any future reward. Nothing in these Terms limits rights or liabilities that cannot legally be limited. To the extent permitted by law, we are not responsible for indirect or consequential losses arising from use of the Service.</p>
          <p>Questions about these Terms: <a href="mailto:support@play2launch.com">support@play2launch.com</a>.</p>
        </section>
      </div>
    </article>
  );
}

export function PrivacyPage() {
  return (
    <article className="legal-page">
      <LegalHeader title="Privacy Policy" description="What information P2L uses, who can see it and how to contact us about it." />
      <div className="legal-document">
        <p>This Privacy Policy describes how PlayToLaunch (“P2L”, “we”, “us”) handles personal information when you use our website, Telegram Mini App, games, campaigns and community features. For privacy questions or requests, contact <a href="mailto:support@play2launch.com">support@play2launch.com</a>.</p>

        <section><h2>1. Information we collect</h2>
          <ul>
            <li><strong>Account and identity:</strong> email address, password in protected form, verification and password-reset information, account identifiers, and Telegram identity details when you use Telegram sign-in or the Mini App.</li>
            <li><strong>Profile and community:</strong> display name, username, avatar, posts, likes, follows, messages, team membership, invitations and KOL applications or review outcomes.</li>
            <li><strong>Games and participation:</strong> submitted rounds, accepted scores, campaign and team progress, rankings, P2L Points and referral activity.</li>
            <li><strong>Technical information:</strong> device and browser details, IP address, security and access logs, and information needed to operate sessions and prevent abuse.</li>
            <li><strong>Support:</strong> information you send when contacting us or requesting help.</li>
          </ul>
          <p>If you provide an avatar image URL, the image may be loaded from that external host. If you upload an avatar, we store the image so it can be displayed in the Service.</p>
        </section>

        <section><h2>2. How we use information</h2>
          <p>We use information to create and secure accounts; verify identity; provide games, teams, rankings, P2L Points and community features; send account, KOL and service notices; respond to requests; detect cheating, spam and fraud; troubleshoot and improve the Service; and meet applicable legal obligations. Where a legal basis is required, these activities may rely on performance of our agreement with you, our legitimate interests, a legal obligation or your consent, depending on the activity and applicable law.</p>
        </section>

        <section><h2>3. What others can see</h2>
          <p>Your public profile, avatar, username, posts, KOL badge, team participation and applicable scores or rankings may be visible to other users or to anyone viewing public pages. Do not put private information in public profile fields or posts. Private messages are intended for their participants, but may be accessed by authorized staff where reasonably necessary for support, safety, abuse review or legal compliance.</p>
        </section>

        <section><h2>4. Service providers and external services</h2>
          <p>We use providers to host and secure the Service, deliver email, verify Telegram sign-in and provide other features. Where enabled, Cloudflare Turnstile helps protect registration and other actions from abuse. On the production website, we use Google Firebase Analytics to measure page views and selected game events. We do not intentionally include invitation tokens, user IDs or game session IDs in the page paths sent to Analytics. These providers may process technical data under their own applicable terms and privacy notices.</p>
          <p>We may also disclose information when required by law, to protect users and the Service, or as part of a business transfer subject to appropriate safeguards. Following a link to an external campaign or site takes you to a service with its own privacy practices.</p>
        </section>

        <section><h2>5. Storage and retention</h2>
          <p>We keep information for as long as reasonably needed to provide the Service, maintain the integrity of scores and referrals, resolve disputes, prevent abuse and meet legal obligations. Retention periods vary by type of information and applicable requirements. Deleting an account may not immediately remove information from backups or records that we must or may lawfully retain. We limit access to retained information as appropriate.</p>
          <p>We use browser storage and, where applicable, cookies for sessions and site functionality. Our production analytics provider may also use identifiers or similar technologies. Your browser or device settings may offer additional controls.</p>
        </section>

        <section><h2>6. Your choices and rights</h2>
          <p>You can edit certain profile details in the Service. To request access, correction or deletion of personal information, or to raise another privacy concern, email <a href="mailto:support@play2launch.com">support@play2launch.com</a> from the address associated with your account where possible. We may ask for information needed to verify your identity. Available rights and exceptions depend on where you live. You can also stop using P2L and, where applicable, use your browser or device controls for storage and analytics.</p>
        </section>

        <section><h2>7. International processing and security</h2>
          <p>Our providers and users may be in different countries, so information may be processed outside your country. Where required, we use appropriate safeguards for such transfers. We use reasonable technical and organizational measures to protect information, but no online service can guarantee absolute security.</p>
        </section>

        <section><h2>8. Children and changes</h2>
          <p>The Service is not intended for anyone who does not meet the minimum age required to use it in their location. If you believe a child has provided personal information in violation of applicable rules, contact us.</p>
          <p>We may update this Policy as our practices change. We will post the revised version and update the date above, and provide additional notice when appropriate. Questions or requests: <a href="mailto:support@play2launch.com">support@play2launch.com</a>.</p>
        </section>
      </div>
      <p className="legal-related">Also read our <Link to="/terms">Terms of Service</Link>.</p>
    </article>
  );
}

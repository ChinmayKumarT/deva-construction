import Link from "next/link";

export const metadata = {
  title: "Privacy policy — Construction Manager",
  description:
    "What data Construction Manager collects, how it is used, and how to delete it.",
};

const EFFECTIVE_DATE = "2026-06-25";
const CONTACT_EMAIL = "thedeva.co@gmail.com"; // replace with your support address
const DEVELOPER_NAME = "Construction Manager"; // replace with your legal name

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12 prose prose-slate">
      <h1>Privacy Policy</h1>
      <p className="text-sm text-slate-500">Effective {EFFECTIVE_DATE}</p>

      <p>
        This Privacy Policy describes how {DEVELOPER_NAME} ("we", "us") collects, uses, and
        protects information when you use the Construction Manager mobile and web applications
        ("the App"). This is a template — review with a lawyer before publishing if you handle
        anything sensitive.
      </p>

      <h2>1. Who controls your data</h2>
      <p>
        The App is a business tool used by individual construction companies. When you use the App,
        your data is collected and controlled by:
      </p>
      <ul>
        <li>
          <strong>The construction company</strong> that invited you (the data controller for
          business records like projects, materials, payments, attendance, and project updates).
        </li>
        <li>
          <strong>{DEVELOPER_NAME}</strong> (the data processor for authentication and hosting).
        </li>
      </ul>

      <h2>2. What we collect</h2>
      <table>
        <thead>
          <tr><th>Category</th><th>Examples</th><th>Why</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>Account</td>
            <td>Email, password (hashed), full name, role</td>
            <td>Sign-in, role-based access</td>
          </tr>
          <tr>
            <td>Business records</td>
            <td>Project, client, supplier, labourer details; materials; payments; attendance</td>
            <td>Core app function</td>
          </tr>
          <tr>
            <td>User content</td>
            <td>Project update notes and photos you upload</td>
            <td>Progress tracking</td>
          </tr>
          <tr>
            <td>Technical</td>
            <td>Device type, OS version, IP address, crash logs</td>
            <td>Reliability and security</td>
          </tr>
        </tbody>
      </table>
      <p>We do <strong>not</strong> collect: precise location, contacts, SMS, microphone, or browsing history.</p>

      <h2>3. How it is stored</h2>
      <p>
        Data is stored with Supabase Inc., which provides authentication, Postgres, and object
        storage. Servers are located in the region selected by the construction company at account
        setup. Network traffic is encrypted in transit (HTTPS); passwords are hashed at rest.
      </p>

      <h2>4. How it is shared</h2>
      <ul>
        <li>
          Within your construction company, business records are visible to admins, managers,
          and to the specific client/supplier/labourer the record concerns. This is enforced by
          row-level security in the database.
        </li>
        <li>We do not sell data or share it with advertisers.</li>
        <li>
          We disclose data only when required by law, or to protect our rights or others' safety.
        </li>
      </ul>

      <h2>5. Retention</h2>
      <p>
        We keep your authentication record (email + password hash + profile) until you delete your
        account. Business records (projects, materials, payments, attendance) are kept by the
        construction company for accounting and audit purposes even after you delete your account;
        they are <em>unlinked</em> from your identity at that point.
      </p>

      <h2>6. Your rights</h2>
      <ul>
        <li>
          <strong>Delete your account</strong> — at any time from inside the App or via the public
          page at <Link href="/delete-account">/delete-account</Link>. This deletes your login and
          profile and signs you out.
        </li>
        <li>
          <strong>Access &amp; correct</strong> — most of your data is visible on your dashboard.
          Contact the admin of your construction company for changes to business records.
        </li>
        <li>
          <strong>Object / portability</strong> — email {CONTACT_EMAIL} and we will respond
          within 30 days.
        </li>
      </ul>

      <h2>7. Children</h2>
      <p>
        The App is intended for users 18 and over. We do not knowingly collect data from children.
      </p>

      <h2>8. Changes</h2>
      <p>
        We may update this policy. Material changes will be announced inside the App at least 14
        days before they take effect.
      </p>

      <h2>9. Contact</h2>
      <p>
        Privacy questions: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>

      <p className="mt-10">
        <Link href="/">← Back</Link>
      </p>
    </main>
  );
}

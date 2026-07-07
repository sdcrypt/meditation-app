import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Account() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
  };

  return (
    <main className="account-page">
      <div className="site-shell account-shell">
        {location.state?.error && (
          <div className="account-alert" role="alert">{location.state.error}</div>
        )}
        <section className="account-hero">
          <div className="account-avatar">{user.email.slice(0, 1).toUpperCase()}</div>
          <div>
            <p className="eyebrow">Your account</p>
            <h1>A place for your practice.</h1>
            <p>{user.email}</p>
          </div>
          {user.is_admin && <span className="account-admin-badge">Administrator</span>}
        </section>

        <section className="account-grid">
          <article>
            <span>Account status</span>
            <strong>Active</strong>
            <p>Joined {new Date(user.created_at).toLocaleDateString()}</p>
          </article>
          <article>
            <span>Progress synchronization</span>
            <strong>Coming next</strong>
            <p>Your current progress remains safely associated with this browser.</p>
          </article>
          <article>
            <span>Preferences</span>
            <strong>Stored locally</strong>
            <p>Account-level preference synchronization is not enabled yet.</p>
          </article>
        </section>

        <section className="account-actions">
          <div><h2>Session</h2><p>Sign out of this browser.</p></div>
          <button onClick={handleLogout}>Log out</button>
        </section>
      </div>
    </main>
  );
}

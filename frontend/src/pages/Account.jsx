import { useLocation, useNavigate } from "react-router-dom";
import MeditationCard from "../components/MeditationCard";
import { useAuth } from "../context/AuthContext";
import { useFavorites } from "../context/FavoritesContext";

export default function Account() {
  const { user, logout } = useAuth();
  const { favorites, isLoading: favoritesLoading } = useFavorites();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
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
            <strong>Account-backed</strong>
            <p>Your history, mindful minutes, and streaks follow this account.</p>
          </article>
          <article>
            <span>Preferences</span>
            <strong>Synced to account</strong>
            <p>Your onboarding choices now follow this account after sign in.</p>
          </article>
        </section>

        <section className="account-saved">
          <div className="account-section-heading">
            <div>
              <p className="eyebrow">Saved library</p>
              <h2>Saved meditations</h2>
            </div>
            <span>{favorites.length} saved</span>
          </div>
          {favoritesLoading ? (
            <div className="account-saved-empty">Loading saved meditations…</div>
          ) : favorites.length > 0 ? (
            <div className="account-saved-grid">
              {favorites.map((favorite) => (
                <MeditationCard
                  key={favorite.id}
                  meditation={favorite.meditation}
                  reason="Saved by you"
                />
              ))}
            </div>
          ) : (
            <div className="account-saved-empty">
              <h3>No saved meditations yet.</h3>
              <p>Use the heart button on Explore or a meditation detail page to save practices here.</p>
            </div>
          )}
        </section>

        <section className="account-actions">
          <div><h2>Session</h2><p>Sign out of this browser.</p></div>
          <button onClick={handleLogout}>Log out</button>
        </section>
      </div>
    </main>
  );
}

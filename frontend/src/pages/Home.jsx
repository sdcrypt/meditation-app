import { Link } from "react-router-dom";

const PlayIcon = ({ small = false }) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    className={small ? "play-icon play-icon--small" : "play-icon"}
  >
    <path d="M8.2 5.8c0-1.05 1.17-1.67 2.04-1.08l8.23 5.55a1.3 1.3 0 0 1 0 2.16l-8.23 5.55a1.3 1.3 0 0 1-2.04-1.08V5.8Z" />
  </svg>
);

const ArrowIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="arrow-icon">
    <path d="M5 12h13M13 6l6 6-6 6" />
  </svg>
);

const categoryData = [
  {
    icon: "✦",
    title: "Explore meditations",
    text: "Browse guided practices by mood, duration, level, and teacher.",
    tone: "lilac",
    to: "/explore",
  },
  {
    icon: "◒",
    title: "Start a program",
    text: "Follow a structured sequence like calm, sleep, or beginner mindfulness.",
    tone: "sage",
    to: "/programs",
  },
  {
    icon: "⌁",
    title: "Track progress",
    text: "See mindful minutes, history, streaks, and completed sessions.",
    tone: "sky",
    to: "/progress",
  },
  {
    icon: "♡",
    title: "Make it yours",
    text: "Save favorites, set preferences, and manage reminders from your account.",
    tone: "peach",
    to: "/account",
  },
];

const sessions = [
  {
    title: "Guided meditation library",
    description: "Artwork cards, teachers, descriptions, tags, benefits, and filters are already part of Explore.",
    action: "Browse Explore",
    to: "/explore",
    className: "session-art session-art--morning",
    eyebrow: "Meditations",
  },
  {
    title: "Step-by-step programs",
    description: "Start a program, continue the next practice, and track completion across the sequence.",
    action: "View Programs",
    to: "/programs",
    className: "session-art session-art--stress",
    eyebrow: "Programs",
  },
  {
    title: "Account-based practice",
    description: "Login keeps saved meditations, preferences, reminders, and progress attached to your account.",
    action: "Open Account",
    to: "/account",
    className: "session-art session-art--sleep",
    eyebrow: "Progress",
  },
];

export default function Home() {
  return (
    <main className="home-page">
      <section className="hero">
        <div className="hero-orb hero-orb--one" />
        <div className="hero-orb hero-orb--two" />
        <div className="hero__content site-shell">
          <div className="hero__copy">
            <p className="eyebrow">A quieter mind starts here</p>
            <h1>Make space for<br />what matters.</h1>
            <p className="hero__lede">
              A simple meditation app for guided practices, structured programs,
              saved favorites, progress tracking, and daily email reminders.
            </p>
            <div className="hero__actions">
              <Link className="button button--primary" to="/explore">
                Explore meditations <ArrowIcon />
              </Link>
              <Link className="button button--text" to="/programs">
                <span className="mini-play"><PlayIcon small /></span>
                Browse programs
              </Link>
            </div>
            <div className="hero__proof">
              <div className="avatar-stack" aria-hidden="true">
                <span>01</span><span>02</span><span>03</span><span>✓</span>
              </div>
              <p><strong>No inflated claims.</strong><br />Just the features available in the app today.</p>
            </div>
          </div>

          <div className="hero-visual" aria-label="A peaceful meditation player">
            <div className="sun-glow" />
            <div className="distant-mountain distant-mountain--one" />
            <div className="distant-mountain distant-mountain--two" />
            <div className="landscape landscape--back" />
            <div className="landscape landscape--front" />
            <div className="meditating-person" aria-hidden="true">
              <span className="person__head" />
              <span className="person__body" />
              <span className="person__arms" />
              <span className="person__legs" />
            </div>
            <div className="now-playing">
              <button className="now-playing__button" aria-label="Play Open Sky meditation">
                <PlayIcon />
              </button>
              <div>
                <span>Player ready</span>
                <strong>Resume practice</strong>
                <small>with progress saved</small>
              </div>
              <div className="sound-wave" aria-hidden="true">
                <i /><i /><i /><i /><i />
              </div>
            </div>
            <div className="breath-card">
              <span className="breath-card__dot" />
              <div><strong>Daily reminder</strong><small>Email practice nudges</small></div>
              <b>✓</b>
            </div>
          </div>
        </div>
        <a className="scroll-cue" href="#benefits">
          <span>Scroll to explore</span><i />
        </a>
      </section>

      <section className="trust-strip">
        <div className="site-shell trust-strip__inner">
          <p>What Still supports today</p>
          <span />
          <div><strong>Explore</strong><small>searchable meditation library</small></div>
          <div><strong>Programs</strong><small>ordered practice paths</small></div>
          <div><strong>Progress</strong><small>history, minutes, streaks</small></div>
        </div>
      </section>

      <section className="benefits section site-shell" id="benefits">
        <div className="section-heading section-heading--center">
          <p className="eyebrow">Start from anywhere</p>
          <h2>Choose what you want to do next</h2>
          <p>Each card opens a real section of the app, so the landing page is useful instead of decorative.</p>
        </div>
        <div className="category-grid">
          {categoryData.map((category) => (
            <Link
              className={`category-card category-card--${category.tone}`}
              key={category.title}
              to={category.to}
            >
              <div className="category-card__icon">{category.icon}</div>
              <h3>{category.title}</h3>
              <p>{category.text}</p>
              <span className="category-card__arrow" aria-hidden="true">
                <ArrowIcon />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="featured-section section" id="featured">
        <div className="site-shell">
          <div className="section-heading section-heading--row">
            <div>
              <p className="eyebrow">Built around the real product</p>
              <h2>Main app areas</h2>
            </div>
            <Link className="text-link" to="/explore">Explore all meditations <ArrowIcon /></Link>
          </div>
          <div className="session-grid">
            {sessions.map((session, index) => (
              <Link className="session-card" key={session.title} to={session.to}>
                <div className={session.className}>
                  <span className="session-art__eyebrow">{session.eyebrow}</span>
                  <span className="session-art__orb" />
                  <span className="session-art__ridge session-art__ridge--one" />
                  <span className="session-art__ridge session-art__ridge--two" />
                  <span className="session-art__action"><ArrowIcon /></span>
                  <span className="session-art__number">0{index + 1}</span>
                </div>
                <div className="session-card__body">
                  <div>
                    <h3>{session.title}</h3>
                    <p>{session.description}</p>
                  </div>
                  <span>{session.action}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="ritual section">
        <div className="site-shell ritual__grid">
          <div className="ritual-visual">
            <div className="ritual-visual__sun" />
            <div className="ritual-visual__window">
              <span /><span /><span />
            </div>
            <div className="ritual-visual__plant"><i /><i /><i /><b /></div>
            <div className="ritual-visual__person"><i /><b /><span /></div>
            <div className="ritual-quote">
              <span>“</span>
              <p>Peace comes from within.<br />Do not seek it without.</p>
            </div>
          </div>
          <div className="ritual__copy">
            <p className="eyebrow">Your practice, your pace</p>
            <h2>Build a practice that can continue across days.</h2>
            <p>
              Still now supports the core loop a meditation app needs: discover
              content, start a guided session, continue programs, save favorites,
              and return with progress intact.
            </p>
            <ol className="ritual-steps">
              <li><span>01</span><div><strong>Set preferences</strong><p>Choose goals, duration, experience level, and practice time.</p></div></li>
              <li><span>02</span><div><strong>Practice from Explore or Programs</strong><p>Use filters, featured meditations, and program sequences.</p></div></li>
              <li><span>03</span><div><strong>Return with context</strong><p>Resume audio, track history, and continue the next program step.</p></div></li>
            </ol>
            <Link className="button button--dark" to="/explore">Find your practice <ArrowIcon /></Link>
          </div>
        </div>
      </section>

      <section className="testimonial section">
        <div className="testimonial__inner site-shell">
          <p className="eyebrow">Simple and honest</p>
          <blockquote>
            A landing page should explain what the app actually does, then help
            people reach the right next screen quickly.
          </blockquote>
          <div className="testimonial__author testimonial__author--links">
            <Link to="/explore">Explore meditations</Link>
            <Link to="/programs">View programs</Link>
            <Link to="/progress">Check progress</Link>
          </div>
        </div>
      </section>

      <section className="final-cta">
        <div className="final-cta__orb final-cta__orb--left" />
        <div className="final-cta__orb final-cta__orb--right" />
        <div className="site-shell final-cta__content">
          <p className="eyebrow">Begin with one breath</p>
          <h2>Start with one practice, then build from there.</h2>
          <p>Browse the meditation library or follow a structured program when you want a clear path.</p>
          <Link className="button button--cream" to="/explore">Start meditating <ArrowIcon /></Link>
          <small>Account is optional for browsing. Login saves progress and preferences across devices.</small>
        </div>
      </section>
    </main>
  );
}

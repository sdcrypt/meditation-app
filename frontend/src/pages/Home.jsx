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
  { icon: "✦", title: "Sleep", text: "Drift off naturally", tone: "lilac" },
  { icon: "◒", title: "Stress", text: "Find your calm", tone: "sage" },
  { icon: "⌁", title: "Focus", text: "Clear your mind", tone: "sky" },
  { icon: "♡", title: "Self-love", text: "Come home to you", tone: "peach" },
];

const sessions = [
  {
    title: "Morning Stillness",
    teacher: "Maya Chen",
    duration: "10 min",
    className: "session-art session-art--morning",
    eyebrow: "Start your day",
  },
  {
    title: "Letting Go of Stress",
    teacher: "Jonah Reed",
    duration: "15 min",
    className: "session-art session-art--stress",
    eyebrow: "Release & restore",
  },
  {
    title: "Deep Sleep Journey",
    teacher: "Elena Silva",
    duration: "25 min",
    className: "session-art session-art--sleep",
    eyebrow: "Sleep deeply",
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
              Guided meditations, sleep stories, and calming soundscapes
              designed to bring more ease into your everyday.
            </p>
            <div className="hero__actions">
              <Link className="button button--primary" to="/explore">
                Begin your journey <ArrowIcon />
              </Link>
              <a className="button button--text" href="#featured">
                <span className="mini-play"><PlayIcon small /></span>
                Try a free meditation
              </a>
            </div>
            <div className="hero__proof">
              <div className="avatar-stack" aria-hidden="true">
                <span>AJ</span><span>ML</span><span>SK</span><span>+</span>
              </div>
              <p><strong>4.9</strong> <span className="stars">★★★★★</span><br />Loved by mindful people worldwide</p>
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
                <span>Now playing · 10 min</span>
                <strong>Open Sky</strong>
                <small>with Maya Chen</small>
              </div>
              <div className="sound-wave" aria-hidden="true">
                <i /><i /><i /><i /><i />
              </div>
            </div>
            <div className="breath-card">
              <span className="breath-card__dot" />
              <div><strong>Breathe in</strong><small>Follow the rhythm</small></div>
              <b>4</b>
            </div>
          </div>
        </div>
        <a className="scroll-cue" href="#benefits">
          <span>Scroll to explore</span><i />
        </a>
      </section>

      <section className="trust-strip">
        <div className="site-shell trust-strip__inner">
          <p>Made for your whole day</p>
          <span />
          <div><strong>2,000+</strong><small>guided practices</small></div>
          <div><strong>85</strong><small>expert teachers</small></div>
          <div><strong>190</strong><small>countries finding calm</small></div>
        </div>
      </section>

      <section className="benefits section site-shell" id="benefits">
        <div className="section-heading section-heading--center">
          <p className="eyebrow">Whatever you need today</p>
          <h2>A practice for every feeling</h2>
          <p>Small moments of mindfulness can change the shape of your entire day.</p>
        </div>
        <div className="category-grid">
          {categoryData.map((category) => (
            <article className={`category-card category-card--${category.tone}`} key={category.title}>
              <div className="category-card__icon">{category.icon}</div>
              <h3>{category.title}</h3>
              <p>{category.text}</p>
              <a href="#featured" aria-label={`Explore ${category.title}`}>
                <ArrowIcon />
              </a>
            </article>
          ))}
        </div>
      </section>

      <section className="featured-section section" id="featured">
        <div className="site-shell">
          <div className="section-heading section-heading--row">
            <div>
              <p className="eyebrow">Curated for you</p>
              <h2>Pause. Press play. Feel better.</h2>
            </div>
            <Link className="text-link" to="/explore">Explore all meditations <ArrowIcon /></Link>
          </div>
          <div className="session-grid">
            {sessions.map((session, index) => (
              <article className="session-card" key={session.title}>
                <div className={session.className}>
                  <span className="session-art__eyebrow">{session.eyebrow}</span>
                  <span className="session-art__orb" />
                  <span className="session-art__ridge session-art__ridge--one" />
                  <span className="session-art__ridge session-art__ridge--two" />
                  <button aria-label={`Play ${session.title}`}><PlayIcon /></button>
                  <span className="session-art__number">0{index + 1}</span>
                </div>
                <div className="session-card__body">
                  <div>
                    <h3>{session.title}</h3>
                    <p>with {session.teacher}</p>
                  </div>
                  <span>{session.duration}</span>
                </div>
              </article>
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
            <h2>Build a ritual that feels like you.</h2>
            <p>
              Whether you have two minutes or twenty, find thoughtful guidance
              for the moments you need it most. No pressure. No perfection.
            </p>
            <ol className="ritual-steps">
              <li><span>01</span><div><strong>Choose your intention</strong><p>Tell us how you want to feel.</p></div></li>
              <li><span>02</span><div><strong>Find your guide</strong><p>Explore voices and practices that resonate.</p></div></li>
              <li><span>03</span><div><strong>Make it yours</strong><p>Build a rhythm that fits your real life.</p></div></li>
            </ol>
            <Link className="button button--dark" to="/explore">Find your practice <ArrowIcon /></Link>
          </div>
        </div>
      </section>

      <section className="testimonial section">
        <div className="testimonial__inner site-shell">
          <p className="eyebrow">A calmer world, together</p>
          <blockquote>
            “This has become the gentlest part of my day. I arrive feeling
            scattered and leave feeling like myself again.”
          </blockquote>
          <div className="testimonial__author">
            <span>NR</span><div><strong>Nina R.</strong><small>Practicing for 428 days</small></div>
          </div>
          <div className="testimonial__dots"><i className="active" /><i /><i /></div>
        </div>
      </section>

      <section className="final-cta">
        <div className="final-cta__orb final-cta__orb--left" />
        <div className="final-cta__orb final-cta__orb--right" />
        <div className="site-shell final-cta__content">
          <p className="eyebrow">Begin with one breath</p>
          <h2>Your calmer life is already within you.</h2>
          <p>Join a community making more room for rest, clarity, and joy.</p>
          <Link className="button button--cream" to="/explore">Start meditating free <ArrowIcon /></Link>
          <small>No credit card needed · Start in under a minute</small>
        </div>
      </section>
    </main>
  );
}

import { Link } from "react-router-dom";
import MeditationArtwork from "./MeditationArtwork";

const programArtworkMeditation = (program) =>
  program.meditations?.[0]?.meditation || {
    id: program.id,
    title: program.title,
    artwork_url: program.artwork_url,
    category: program.goal,
  };

export default function ProgramCard({ program }) {
  const count = program.meditations?.length ?? 0;

  return (
    <Link className="program-card" to={`/programs/${program.id}`}>
      <MeditationArtwork
        meditation={{
          ...programArtworkMeditation(program),
          artwork_url: program.artwork_url || programArtworkMeditation(program).artwork_url,
        }}
        className="program-card__art"
      >
        <span className="program-card__badge">{count} practices</span>
      </MeditationArtwork>
      <div className="program-card__body">
        <p>{program.goal || "mindfulness"} · {program.level}</p>
        <h3>{program.title}</h3>
        <span>{program.description}</span>
      </div>
    </Link>
  );
}

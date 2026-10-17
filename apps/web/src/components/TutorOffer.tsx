import { useEffect, useRef, useState } from 'react';
import type { AssignmentContext } from '../../../../packages/types.js';
import { Icon } from './Icons.js';

type Feedback = AssignmentContext['feedback'][number];

/** Open only for a new mistake hint actually saved by Go, never for a guessed local assessment. */
export function TutorOffer({feedback}: {feedback: Feedback[]}) {
  const seen = useRef<Set<string> | null>(null);
  const [offer, setOffer] = useState<Feedback | null>(null);
  useEffect(() => {
    const keys = feedback.map(mark => `${mark.id}:${mark.updatedAt}`);
    if (seen.current) {
      const next = feedback.filter(mark => mark.assessment === 'developing' && !seen.current!.has(`${mark.id}:${mark.updatedAt}`)).sort((a,b) => b.updatedAt-a.updatedAt)[0];
      if (next) setOffer(next);
      else setOffer(current => current && feedback.some(mark => mark.id === current.id && mark.updatedAt === current.updatedAt && mark.assessment === 'developing') ? current : null);
    }
    seen.current = new Set(keys);
  }, [feedback]);
  if (!offer) return null;
  return <aside className="tutor-offer" aria-label="New tutor hint" aria-live="polite">
    <header><span><Icon name="spark" size={18}/> A hint from your tutor</span><button className="icon-button" aria-label="Dismiss tutor hint" onClick={() => setOffer(null)}><Icon name="close" size={17}/></button></header>
    <p>{offer.explanation}</p><div className="next-step"><strong>Try this next</strong>{offer.nextStep}</div>
    <p className="fineprint">Keep working. This hint is also saved in Tutor feedback.</p>
  </aside>;
}

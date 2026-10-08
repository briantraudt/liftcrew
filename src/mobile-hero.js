import './mobile-hero.css';

// Reuse the same illustrations and booking action across both layouts.
const hero = document.querySelector('.one-page .hero');
const process = document.querySelector('.lc-process');
const actions = hero?.querySelector('.hero-actions');
if (hero && process && actions) {
  const originalPosition = document.createComment('Process section position');
  const actionsPosition = document.createComment('Hero booking action position');
  process.before(originalPosition);
  actions.before(actionsPosition);
  const mobile = matchMedia('(max-width:600px)');
  function placeHeroContent() {
    if (mobile.matches) hero.append(process, actions);
    else {
      originalPosition.after(process);
      actionsPosition.after(actions);
    }
  }
  mobile.addEventListener('change', placeHeroContent);
  placeHeroContent();
}

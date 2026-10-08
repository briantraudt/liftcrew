import './mobile-hero.css';

// Reuse the same illustrations in the mobile hero and desktop process section.
const hero = document.querySelector('.one-page .hero');
const process = document.querySelector('.lc-process');
if (hero && process) {
  const originalPosition = document.createComment('Process section position');
  process.before(originalPosition);
  const mobile = matchMedia('(max-width:600px)');
  function placeProcess() {
    if (mobile.matches) hero.append(process);
    else originalPosition.after(process);
  }
  mobile.addEventListener('change', placeProcess);
  placeProcess();
}

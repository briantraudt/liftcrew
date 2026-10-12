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

// The subject sits at 70% of the source photo's width. Anchor that point to
// the mobile center or the actual desktop gap, including when the form moves.
if (hero) {
  const photo = document.createElement('div');
  photo.className = 'hero-photo';
  photo.setAttribute('aria-hidden', 'true');
  const image = document.createElement('img');
  image.alt = '';
  image.decoding = 'async';
  image.fetchPriority = 'high';
  photo.append(image);
  hero.prepend(photo);
  const inner = hero.querySelector('.hero-inner');
  const copy = hero.querySelector('.hero-copy');
  let frame = 0;

  function positionPhoto() {
    frame = 0;
    if (!image.naturalWidth || !image.naturalHeight) return;
    const box = photo.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const mobile = matchMedia('(max-width:600px)').matches;
    const desktop = matchMedia('(min-width:851px)').matches;
    const ratio = image.naturalWidth / image.naturalHeight;
    // Preserve the current mobile photo track and the forklift's proportions.
    const height = mobile ? Math.max(box.height, box.width / ratio) : box.height;
    const width = height * ratio;
    let center = box.width / 2;
    if (desktop && copy) {
      const card = inner?.querySelector('.hero-booking,.booking-modal-placeholder');
      const copyBox = copy.getBoundingClientRect();
      const cardBox = card?.getBoundingClientRect();
      if (cardBox?.width && cardBox.left >= copyBox.right - 1) {
        center = (copyBox.right + cardBox.left) / 2 - box.left;
      }
    } else if (!mobile) {
      center = box.width * 0.7;
    }
    photo.style.setProperty('--hero-photo-width', `${width}px`);
    photo.style.setProperty('--hero-photo-height', `${height}px`);
    photo.style.setProperty('--hero-photo-left', `${center - width * 0.7}px`);
    photo.style.setProperty('--hero-photo-top', `${(box.height - height) * 0.45}px`);
  }

  function schedulePhoto() {
    if (!frame) frame = requestAnimationFrame(positionPhoto);
  }

  image.addEventListener('load', () => {
    hero.classList.add('hero-photo-ready');
    positionPhoto();
  });
  // Keep the original CSS photo as the fallback when the image cannot load.
  image.addEventListener('error', () => hero.classList.remove('hero-photo-ready'));
  image.src = '/hero-forklift.webp';
  if (image.complete && image.naturalWidth) {
    hero.classList.add('hero-photo-ready');
    positionPhoto();
  }
  const observer = new ResizeObserver(schedulePhoto);
  [hero, photo, inner, copy].filter(Boolean).forEach(element => observer.observe(element));
  if (inner) new MutationObserver(schedulePhoto).observe(inner, {childList: true});
  window.addEventListener('resize', schedulePhoto, {passive: true});
  document.fonts?.ready.then(schedulePhoto);
}

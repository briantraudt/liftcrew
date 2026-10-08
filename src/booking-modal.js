import './booking-modal.css';

export function createBookingModal(form) {
  const modal = document.createElement('div');
  modal.id = 'booking-modal';
  modal.className = 'booking-modal';
  modal.hidden = true;
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'booking-modal-title');
  const panel = document.createElement('div');
  panel.className = 'booking-modal-panel';
  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'booking-modal-close';
  closeButton.setAttribute('aria-label', 'Close booking');
  closeButton.textContent = '×';
  panel.append(closeButton);
  modal.append(panel);
  document.body.append(modal);
  const title = form.querySelector('.booking-title strong');
  title.id = 'booking-modal-title';
  title.tabIndex = -1;
  const placeholder = document.createElement('div');
  placeholder.className = 'booking-modal-placeholder';
  placeholder.setAttribute('aria-hidden', 'true');
  let opener = null;
  let scrollY = 0;
  let background = [];

  function open(trigger = opener) {
    if (!modal.hidden) return;
    opener = trigger;
    scrollY = window.scrollY;
    placeholder.style.height = `${form.getBoundingClientRect().height}px`;
    form.replaceWith(placeholder);
    panel.append(form);
    background = [...document.querySelectorAll('body > main, body > .site-header')]
      .map(element => ({element, inert: element.inert}));
    background.forEach(({element}) => {element.inert = true;});
    document.body.style.setProperty('--booking-scroll-top', `-${scrollY}px`);
    document.documentElement.classList.add('booking-modal-open');
    document.body.classList.add('booking-modal-open');
    modal.hidden = false;
    form.scrollTop = 0;
    title.focus({preventScroll: true});
  }

  function close(restoreFocus = true) {
    if (modal.hidden) return;
    document.querySelector(`#${form.id}-calendar:not([hidden]) [data-action="close"]`)?.click();
    placeholder.replaceWith(form);
    modal.hidden = true;
    background.forEach(({element, inert}) => {element.inert = inert;});
    document.documentElement.classList.remove('booking-modal-open');
    document.body.classList.remove('booking-modal-open');
    document.body.style.removeProperty('--booking-scroll-top');
    window.scrollTo({top: scrollY, behavior: 'instant'});
    if (restoreFocus) opener?.focus({preventScroll: true});
  }

  closeButton.addEventListener('click', () => close());
  modal.addEventListener('click', event => {if (event.target === modal) close();});
  modal.addEventListener('keydown', event => {
    // A dropdown handles its own Escape before the surrounding dialog does.
    if (event.defaultPrevented) return;
    if (event.key === 'Escape') {event.preventDefault(); close(); return;}
    if (event.key !== 'Tab') return;
    const controls = [...panel.querySelectorAll('button,input,select,textarea,a[href],[tabindex]')]
      .filter(element => !element.disabled && element.tabIndex >= 0 && element.getClientRects().length);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && (document.activeElement === first || document.activeElement === title)) {
      event.preventDefault(); last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first?.focus();
    }
  });

  document.querySelectorAll('a[href="#booking-form"]').forEach(link => {
    link.setAttribute('aria-haspopup', 'dialog');
    link.setAttribute('aria-controls', modal.id);
    link.addEventListener('click', event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      open(link);
    });
  });
  if (location.hash === '#booking-form') open();
  return {open, close, get isOpen() {return !modal.hidden;}, get scrollY() {return scrollY;}};
}

import './select.css';

// Keep the native select as the form's source of truth; render the menu ourselves
// so macOS, Windows and mobile all use LiftCrew's palette.
const controls = new Map();
let openControl = null;
let nextId = 0;

function enhance(select) {
  if (select.multiple || select.size > 1 || !select.isConnected) return;
  if (controls.has(select)) {controls.get(select).sync(); return;}
  const id = `lc-select-${++nextId}`;
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'lc-select-trigger';
  trigger.id = id;
  trigger.setAttribute('role', 'combobox');
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', `${id}-list`);
  const value = document.createElement('span');
  value.className = 'lc-select-value';
  trigger.append(value);
  const list = document.createElement('div');
  list.id = `${id}-list`;
  list.className = 'lc-select-list';
  list.setAttribute('role', 'listbox');
  list.hidden = true;

  const labels = [...select.labels];
  const name = select.getAttribute('aria-label') || labels.map(label => {
    const copy = label.cloneNode(true);
    copy.querySelectorAll('select,input,textarea,button').forEach(node => node.remove());
    return copy.textContent.trim();
  }).join(' ') || select.name;
  trigger.setAttribute('aria-label', name);
  list.setAttribute('aria-label', name);
  const describedBy = select.getAttribute('aria-describedby');
  if (describedBy) trigger.setAttribute('aria-describedby', describedBy);
  select.classList.add('lc-native-select');
  select.tabIndex = -1;
  select.setAttribute('aria-hidden', 'true');
  select.after(trigger);
  document.body.append(list);
  let active = -1;
  let search = '';
  let lastKey = 0;
  const enabled = () => [...select.options].map((option, index) => ({option, index}))
    .filter(({option}) => !option.disabled && !option.hidden && !option.parentElement.disabled);

  function sync() {
    value.textContent = select.selectedOptions[0]?.label || 'Select';
    trigger.disabled = select.matches(':disabled');
    trigger.setAttribute('aria-required', String(select.required));
    if (select.validity.valid) trigger.removeAttribute('aria-invalid');
    if (trigger.disabled && openControl === control) close();
  }
  function place() {
    if (list.hidden) return;
    const rect = trigger.getBoundingClientRect();
    const viewport = window.visualViewport;
    const height = viewport?.height || innerHeight;
    const width = viewport?.width || innerWidth;
    const top = viewport?.offsetTop || 0;
    const left = viewport?.offsetLeft || 0;
    const below = top + height - rect.bottom - 12;
    const above = rect.top - top - 12;
    const up = below < 220 && above > below;
    list.style.width = `${Math.min(rect.width, width - 16)}px`;
    list.style.maxHeight = `${Math.min(300, Math.max(44, up ? above : below))}px`;
    list.style.left = `${Math.max(left + 8, Math.min(rect.left, left + width - list.offsetWidth - 8))}px`;
    list.style.top = `${up ? rect.top - list.offsetHeight - 6 : rect.bottom + 6}px`;
  }
  function highlight(index) {
    active = index;
    for (const item of list.children) {
      const focused = Number(item.dataset.index) === active;
      item.classList.toggle('is-active', focused);
      item.setAttribute('aria-selected', String(focused));
      if (focused) {
        trigger.setAttribute('aria-activedescendant', item.id);
        if (item.offsetTop < list.scrollTop) list.scrollTop = item.offsetTop;
        else if (item.offsetTop + item.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = item.offsetTop + item.offsetHeight - list.clientHeight;
      }
    }
  }
  function open() {
    if (trigger.disabled || !enabled().length) return;
    openControl?.close();
    sync();
    list.replaceChildren(...enabled().map(({option, index}) => {
      const item = document.createElement('div');
      item.id = `${id}-option-${index}`;
      item.className = 'lc-select-option';
      item.dataset.index = index;
      item.setAttribute('role', 'option');
      item.textContent = option.label;
      return item;
    }));
    list.hidden = false;
    openControl = control;
    trigger.setAttribute('aria-expanded', 'true');
    trigger.focus({preventScroll: true});
    place();
    highlight(enabled().some(item => item.index === select.selectedIndex) ? select.selectedIndex : enabled()[0].index);
  }
  function close(commit = false) {
    if (list.hidden) return;
    const changed = commit && active >= 0 && select.selectedIndex !== active;
    if (commit && active >= 0) select.selectedIndex = active;
    list.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    trigger.removeAttribute('aria-activedescendant');
    openControl = null;
    search = '';
    sync();
    if (changed) {
      select.dispatchEvent(new Event('input', {bubbles: true}));
      select.dispatchEvent(new Event('change', {bubbles: true}));
    }
  }
  const control = {select, trigger, list, sync, close, place};
  controls.set(select, control);
  sync();
  trigger.addEventListener('click', () => list.hidden ? open() : close());
  trigger.addEventListener('focus', sync);
  trigger.addEventListener('blur', () => close(true));
  trigger.addEventListener('keydown', event => {
    const {key} = event;
    if (key === 'Escape') {if (!list.hidden) event.preventDefault(); close(); return;}
    if (key === 'Tab') {close(true); return;}
    if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      if (list.hidden) open(); else close(true);
      return;
    }
    const movement = {ArrowDown: 1, ArrowUp: -1, PageDown: 10, PageUp: -10};
    if (key in movement || key === 'Home' || key === 'End') {
      event.preventDefault();
      const wasClosed = list.hidden;
      if (wasClosed) open();
      if (event.altKey && key === 'ArrowUp') {close(true); return;}
      const items = enabled();
      if (!items.length) return;
      const current = items.findIndex(item => item.index === active);
      const position = key === 'Home' ? 0 : key === 'End' ? items.length - 1 : wasClosed ? current : Math.max(0, Math.min(items.length - 1, current + movement[key]));
      highlight(items[position].index);
      return;
    }
    if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      if (list.hidden) open();
      const now = Date.now();
      search = now - lastKey > 700 ? key.toLowerCase() : search + key.toLowerCase();
      lastKey = now;
      const repeated = [...search].every(char => char === search[0]);
      const term = repeated ? search[0] : search;
      const items = enabled();
      const start = repeated ? items.findIndex(item => item.index === active) + 1 : 0;
      const ordered = [...items.slice(start), ...items.slice(0, start)];
      const match = ordered.find(({option}) => option.label.toLowerCase().startsWith(term));
      if (match) highlight(match.index);
    }
  });
  // Keep DOM focus on the combobox when clicking an option; touch still scrolls.
  list.addEventListener('mousedown', event => event.preventDefault());
  list.addEventListener('pointermove', event => {
    const option = event.target.closest('[role=option]');
    if (event.pointerType === 'mouse' && option) highlight(Number(option.dataset.index));
  });
  list.addEventListener('click', event => {
    const option = event.target.closest('[role=option]');
    if (!option) return;
    highlight(Number(option.dataset.index));
    close(true);
    trigger.focus({preventScroll: true});
  });
  select.addEventListener('input', sync);
  select.addEventListener('change', sync);
  select.addEventListener('focus', () => trigger.focus());
  select.addEventListener('invalid', event => {
    event.preventDefault();
    trigger.setAttribute('aria-invalid', 'true');
    // Let reportValidity focus an earlier invalid field before moving to us.
    const first = select.form?.querySelector(':invalid');
    if (!first || first === select) trigger.focus();
  });
  labels.forEach(label => label.addEventListener('click', event => {
    if (event.target.closest('button,a,input,textarea,select')) return;
    event.preventDefault();
    trigger.focus();
  }));
}

export function refreshSelects(root = document) {
  if (root.matches?.('select')) enhance(root);
  root.querySelectorAll?.('select').forEach(enhance);
}

refreshSelects();
new MutationObserver(records => {
  for (const record of records) {
    const select = record.target.closest?.('select');
    if (select) enhance(select);
    record.addedNodes.forEach(node => {if (node.nodeType === 1) refreshSelects(node);});
  }
  for (const [select, control] of controls) {
    if (!select.isConnected) {
      control.close();
      control.trigger.remove();
      control.list.remove();
      controls.delete(select);
    }
  }
}).observe(document.body, {childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'required', 'selected']});
document.addEventListener('pointerdown', event => {
  if (openControl && !openControl.trigger.contains(event.target) && !openControl.list.contains(event.target)) openControl.close(true);
});
document.addEventListener('reset', () => setTimeout(() => refreshSelects(), 0));
window.addEventListener('resize', () => openControl?.place());
window.addEventListener('scroll', event => {if (openControl && event.target !== openControl.list) openControl.close();}, true);
window.visualViewport?.addEventListener('resize', () => openControl?.place());

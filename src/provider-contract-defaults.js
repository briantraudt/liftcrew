// Identity defaults are editable preparation data, never legal approval or signatures.
const fields = {entity:'legal_entity',address:'notice_address',email:'notice_email'};

export function populateContractDefaults(form, data, edited = new Set()) {
  if (!form || !data || typeof data !== 'object') return 0;
  let count = 0;
  for (const [name,key] of Object.entries(fields)) {
    const input = form.elements.namedItem(name);
    const value = data[key];
    if (!input || edited.has(name) || String(input.value || '').trim() || typeof value !== 'string' || !value.trim()) continue;
    input.value = value;
    count++;
  }
  return count;
}

export function watchContractDefaults(root, loadDefaults, Observer = globalThis.MutationObserver) {
  if (!root || typeof loadDefaults !== 'function' || !Observer) return () => {};
  const seen = new WeakSet();
  let stopped = false;
  function scan() {
    if (stopped) return;
    const form = root.querySelector('#publish-form');
    if (!form || seen.has(form)) return;
    seen.add(form);
    const edited = new Set();
    const onEdit = event => { if (Object.hasOwn(fields,event.target?.name)) edited.add(event.target.name); };
    form.addEventListener('input',onEdit);
    form.addEventListener('change',onEdit);
    const note = form.ownerDocument.createElement('p');
    note.className = 'field-hint';
    note.dataset.contractIdentityStatus = '';
    note.setAttribute('role','status');
    note.textContent = 'Loading saved contracting details…';
    form.prepend(note);
    Promise.resolve().then(loadDefaults).then(data => {
      if (stopped || !root.contains(form)) return;
      const count = populateContractDefaults(form,data,edited);
      note.textContent = data
        ? (count ? 'Saved contracting details loaded. Confirm them before publishing the final agreement.' : 'Your entered contracting details were preserved. Confirm them before publishing the final agreement.')
        : 'No saved contracting details. Enter the legal entity, notice address and email before publishing.';
    }).catch(() => {
      if (!stopped && root.contains(form)) note.textContent = 'Saved contracting details could not be loaded. Enter them manually before publishing.';
    }).finally(() => {
      form.removeEventListener('input',onEdit);
      form.removeEventListener('change',onEdit);
    });
  }
  const observer = new Observer(scan);
  observer.observe(root,{childList:true,subtree:true});
  scan();
  return () => { stopped = true; observer.disconnect(); };
}

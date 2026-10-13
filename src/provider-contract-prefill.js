import {db,check} from './operator-api.js';
import {watchContractDefaults} from './provider-contract-defaults.js';

const stop = watchContractDefaults(document.querySelector('#review-app'),async () =>
  check(await db.from('provider_contract_defaults')
    .select('legal_entity,notice_address,notice_email').eq('id',true).maybeSingle())
);
window.addEventListener('pagehide',stop,{once:true});

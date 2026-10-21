import {escapeHtml as h} from './operator-data.js';

// Presentation only. The legal signature is recorded solely by authenticated server RPCs.
// Always show every character of the verified published (or personalized) agreement.
export function renderAgreementPreview(agreement,{personalized=false}={}){
 if(!agreement?.body)return '';
 const type=personalized?'Prepared for your business':'Published terms — read-only preview';
 return '<div class="agreement-view-meta"><strong>'+h(type)+'</strong><span>'+h(agreement.version||'')+'</span></div>'+
  '<div class="agreement-preview" id="contract-text" tabindex="0" role="region" aria-label="Complete provider agreement, read only">'+h(agreement.body)+'</div>';
}

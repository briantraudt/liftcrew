import {escapeHtml as h} from './operator-data.js';

// Presentation only. The legal signature is recorded solely by authenticated server RPCs.
// Always show every character of the verified published (or personalized) agreement.
export function renderAgreementPreview(agreement,{personalized=false}={}){
 if(!agreement?.body)return '';
 const meta=personalized?'':'<div class="agreement-view-meta"><strong>Published terms — read-only preview</strong><span>'+h(agreement.version||'')+'</span></div>';
 return meta+
  '<div class="agreement-preview" id="contract-text" tabindex="0" role="region" aria-label="Complete provider agreement, read only">'+h(agreement.body)+'</div>';
}

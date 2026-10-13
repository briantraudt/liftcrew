// Render contract text as text nodes, never as executable HTML from a database field.
export function agreementBlocks(body){
 if(typeof body!=='string'||body.length<2000||body.length>100000)throw Error('The published agreement is unavailable.');
 return body.trim().split(/\n\s*\n/).map(text=>({text,tag:/^\d+\. [^\n]{1,100}$/.test(text)||text.startsWith('Schedule A |')?'h2':/^(Service and commercial terms|Insurance, claims and liability|Administration and signatures)$/.test(text)?'h3':'p'}));
}
export function validatePublishedAgreement(value){
 if(!value||typeof value.version!=='string'||typeof value.body!=='string'||typeof value.sha256!=='string'||!/^[a-f0-9]{64}$/.test(value.sha256))throw Error('The published agreement is unavailable.');
 if(/review draft|\[[A-Z _/]+\]|_{3,}|\{\{/i.test(value.body))throw Error('The agreement contains unresolved draft fields.');
 agreementBlocks(value.body);
 return value;
}

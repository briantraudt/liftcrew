// PostgreSQL can serialize an empty composite row as an object of null fields.
// Only a persisted, complete envelope can be displayed or used for signing.
export function contractEnvelope(value){
 if(!value?.id)return null;
 if(typeof value.id!=='string'||!/^[-0-9a-f]{36}$/i.test(value.id)||typeof value.body!=='string'||!value.body.trim()||typeof value.sha256!=='string'||!/^[0-9a-f]{64}$/i.test(value.sha256))throw Error('The personalized agreement could not be verified. Reload and try again.');
 return value;
}
export function requiredContractEnvelope(value,{signed=false}={}){
 const envelope=contractEnvelope(value);
 if(!envelope||(signed&&!envelope.provider_signed_at))throw Error(signed?'The agreement signature was not confirmed. Please try again.':'The personalized agreement was not prepared. Please try again.');
 return envelope;
}

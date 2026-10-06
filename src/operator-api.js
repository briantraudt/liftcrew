import {createClient} from '@supabase/supabase-js';
import {SUPABASE_URL,SUPABASE_KEY} from './operator-config.js';
import {validateFile} from './operator-data.js';
export const db=createClient(SUPABASE_URL,SUPABASE_KEY);
export function check(result){if(result.error)throw result.error;return result.data;}
export async function uploadDocument(application,file,kind,entityId='',expiresOn=null){
 const ext=validateFile(file);
 const signature=new Uint8Array(await file.slice(0,12).arrayBuffer());
 const prefix=String.fromCharCode(...signature);
 const valid={pdf:prefix.startsWith('%PDF-'),jpg:signature[0]===255&&signature[1]===216&&signature[2]===255,png:signature[0]===137&&prefix.slice(1,4)==='PNG',webp:prefix.startsWith('RIFF')&&prefix.slice(8,12)==='WEBP'};
 if(!valid[ext])throw Error('The file content does not match its file type. Export a valid PDF or image and try again.');
 const id=crypto.randomUUID(),path=`${application.user_id}/${application.id}/${id}.${ext}`;
 const row={id,application_id:application.id,owner_id:application.user_id,kind,entity_id:entityId,filename:file.name,mime_type:file.type,bytes:file.size,object_path:path,expires_on:expiresOn||null};
 check(await db.from('operator_documents').insert(row));
 const uploaded=await db.storage.from('operator-documents').upload(path,file,{contentType:file.type,upsert:false});
 if(uploaded.error){const removed=await db.from('operator_documents').delete().eq('id',id);if(removed.error)await db.from('operator_documents').update({active:false}).eq('id',id);throw uploaded.error;}
 return {...row,active:true};
}
export async function downloadDocument(doc){
 const blob=check(await db.storage.from('operator-documents').download(doc.object_path));
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=doc.filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
export async function removeDocument(application,doc){
 if(application.revision>0){check(await db.from('operator_documents').update({active:false}).eq('id',doc.id));return;}
 check(await db.storage.from('operator-documents').remove([doc.object_path]));
 check(await db.from('operator_documents').delete().eq('id',doc.id));
}

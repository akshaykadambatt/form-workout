import{initializeTestEnvironment,assertFails,assertSucceeds}from'@firebase/rules-unit-testing';
import{doc,getDoc,setDoc}from'firebase/firestore';
import{readFile}from'node:fs/promises';
const env=await initializeTestEnvironment({projectId:'demo-form-workout',firestore:{host:'127.0.0.1',port:8087,rules:await readFile('firestore.rules','utf8')}});
try{
 const owner=env.authenticatedContext('owner',{email:'akshayakn6@gmail.com',email_verified:true}).firestore();
 const other=env.authenticatedContext('other',{email:'someone@example.com',email_verified:true}).firestore();
 const unverified=env.authenticatedContext('owner',{email:'akshayakn6@gmail.com',email_verified:false}).firestore();
 const guest=env.unauthenticatedContext().firestore();
 await assertSucceeds(setDoc(doc(owner,'users/owner/sessions/test'),{test:true}));
 await assertSucceeds(getDoc(doc(owner,'users/owner/sessions/test')));
 await assertFails(getDoc(doc(other,'users/owner/sessions/test')));
 await assertFails(setDoc(doc(other,'users/other/sessions/test'),{test:true}));
 await assertFails(getDoc(doc(guest,'users/owner/sessions/test')));
 await assertFails(getDoc(doc(unverified,'users/owner/sessions/test')));
 await assertFails(setDoc(doc(owner,'users/other/sessions/test'),{test:true}));
 console.log('PASS: owner read/write; denied unauthenticated, other user, unverified email, cross-user writes.');
}finally{await env.cleanup();}

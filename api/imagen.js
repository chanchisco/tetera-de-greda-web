import { services } from '../server/firebase.js';
export default async function(req,res) {
 if(!['GET','HEAD'].includes(req.method)) return res.status(405).end();
 const id=new URL(req.url,'https://local.invalid').searchParams.get('id');
 if(!/^[a-f0-9]{64}$/.test(id||'')) return res.status(400).end();
 try {
  const image=(await services().db.doc(`imagenesPublicas/${id}`).get()).data()?.data;
  const match=/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(image||'');
  if(!match) return res.status(404).end();
  res.setHeader('Content-Type',`image/${match[1]}`);
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Cache-Control','public, max-age=31536000, immutable');
  res.setHeader('CDN-Cache-Control','public, max-age=31536000, immutable');
  return res.status(200).end(req.method==='HEAD'?undefined:Buffer.from(match[2],'base64'));
 } catch {res.setHeader('Cache-Control','no-store');return res.status(503).end();}
}

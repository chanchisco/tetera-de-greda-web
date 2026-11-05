import { siteConfig } from './site-config.js';
const value=siteConfig.social?.facebook;
if(value){try{const url=new URL(value);if(url.protocol==='https:'&&(url.hostname==='facebook.com'||url.hostname.endsWith('.facebook.com')||url.hostname==='fb.me'))for(const element of document.querySelectorAll('[data-facebook]')){if(element.tagName==='A')element.href=url.href;element.hidden=false;}}catch{ /* Enlace pendiente: no publicar un destino inventado. */ }}

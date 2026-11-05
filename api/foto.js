import { services } from '../server/firebase.js';
import { createImageHandler } from '../server/image-response.js';
export default createImageHandler({getDb:()=>services().db,legacy:true});

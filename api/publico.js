import { services } from '../server/firebase.js';
import { createPublicCatalogHandler } from '../server/public-catalog.js';
export default createPublicCatalogHandler({getDb:()=>services().db});

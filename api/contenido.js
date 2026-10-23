import { services } from '../server/firebase.js';
import { createContentHandler } from '../server/content.js';
export default createContentHandler({getServices:services,origin:process.env.APP_ORIGIN});

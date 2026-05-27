import { setGlobalOptions } from 'firebase-functions';

setGlobalOptions({ maxInstances: 10, region: 'europe-west3' });

export { generateImage } from './generateImage';
export { generateModelImages } from './generateModelImages';

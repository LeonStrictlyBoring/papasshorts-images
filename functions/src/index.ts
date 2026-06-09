import { initializeApp, getApps } from 'firebase-admin/app';
import { setGlobalOptions } from 'firebase-functions';

if (!getApps().length) initializeApp();
setGlobalOptions({ maxInstances: 10, region: 'europe-west3' });

export { generateImage } from './generateImage';
export { generateModelImages } from './generateModelImages';
export { generateSettingImages } from './generateSettingImages';
export { generateShootingShots } from './generateShootingShots';
export { createUser, deleteUser } from './userManagement';
export { getSignedDownloadUrl } from './getSignedDownloadUrl';

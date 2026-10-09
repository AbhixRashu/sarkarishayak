import { loadServiceAccount, getGoogleAccessToken, GOOGLE_SCOPES } from './google-auth.mjs';

async function checkSites() {
  const { keyData } = loadServiceAccount();
  const token = await getGoogleAccessToken(keyData, GOOGLE_SCOPES.webmasters);
  const res = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('Sites:', JSON.stringify(await res.json(), null, 2));
}

checkSites().catch(console.error);

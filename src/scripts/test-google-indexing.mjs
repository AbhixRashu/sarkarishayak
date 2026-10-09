import { loadServiceAccount, getGoogleAccessToken, GOOGLE_SCOPES } from './google-auth.mjs';

async function testIndexing() {
  const { keyData } = loadServiceAccount();
  const token = await getGoogleAccessToken(keyData, GOOGLE_SCOPES.indexing);
  const testUrl = 'https://govtjob.salarypitcher.com/latest-jobs/up-police-constable-2027/';

  console.log('Sending URL_UPDATED notification for:', testUrl);
  const pubRes = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      url: testUrl,
      type: 'URL_UPDATED'
    })
  });
  const pubData = await pubRes.json();
  console.log('Publish result (HTTP ' + pubRes.status + '):', JSON.stringify(pubData, null, 2));

  console.log('\nChecking metadata for:', testUrl);
  const metaRes = await fetch(`https://indexing.googleapis.com/v3/urlNotifications/metadata?url=${encodeURIComponent(testUrl)}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const metaData = await metaRes.json();
  console.log('Metadata result (HTTP ' + metaRes.status + '):', JSON.stringify(metaData, null, 2));
}

testIndexing().catch(console.error);

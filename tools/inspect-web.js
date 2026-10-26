const https = require('https');

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    }).on('error', reject);
  });
}

async function main() {
  const page = await get('https://www.yapin.gg/');
  const allScripts = [...page.body.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
  console.log('Inline scripts count:', allScripts.length);
  for (let i = 0; i < allScripts.length; i++) {
    const content = allScripts[i][1];
    if (content.length > 0) {
      console.log(`Script ${i} length: ${content.length}`);
      console.log(content.slice(0, 300));
    }
  }
}

main().catch(console.error);

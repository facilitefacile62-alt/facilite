const https = require('https');

https.get('https://ffacilite.com/manifest.json', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => { 
    console.log("Status:", res.statusCode);
    console.log("Headers:", res.headers);
    console.log("Data (first 500 chars):", data.substring(0, 500)); 
  });
}).on('error', (err) => { 
  console.error("Error:", err.message); 
});

https.get('https://ffacilite.com/', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => { 
    const match = data.match(/<link[^>]*rel="manifest"[^>]*>/i);
    console.log("Manifest link in HTML:", match ? match[0] : "Not found");
  });
}).on('error', (err) => { 
  console.error("Error:", err.message); 
});

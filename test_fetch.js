const http = require('http');

http.get('http://localhost:3000/pub.jpeg', (res) => {
  console.log('Status Code:', res.statusCode);
  if (res.statusCode !== 200) {
    res.on('data', d => console.log(d.toString()));
  }
}).on('error', (e) => {
  console.error(e);
});

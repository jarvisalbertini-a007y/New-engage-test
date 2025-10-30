const express = require('express');
const app = express();
const port = 5000;

app.get('/', (req, res) => {
  res.send('Server is running! Your AI Sales Platform is starting up...');
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});
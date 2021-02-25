const express = require('express');
const path = require("path");
const app = express();
const port = 8080;

app.use(express.static('public'))

const public = path.join(process.cwd(), "public");

app.get('/', (req, res) => {
    res.sendFile(path.join(public, 'index.html'));
});

app.get('/json', (req, res) => {
    res.sendFile(path.join(public, "json", 'index.html'));
});

app.get('/ndjson', (req, res) => {
    res.sendFile(path.join(public, "json", 'index.html'));
});

app.listen(port);
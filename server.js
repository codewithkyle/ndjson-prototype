const express = require("express");
const app = express();
const port = 5005;
app.listen(port);
const fs = require("fs");
const path = require("path");

app.get("/ndjson-3", async (req, res) => {
    return res.sendFile(path.join(__dirname, "public", "ndjson-3", "index.html"));
});

app.get("/ndjson-2", async (req, res) => {
    return res.sendFile(path.join(__dirname, "public", "ndjson-2", "index.html"));
});

app.get("/ndjson", async (req, res) => {
    return res.sendFile(path.join(__dirname, "public", "ndjson", "index.html"));
});

app.get("/json", async (req, res) => {
    return res.sendFile(path.join(__dirname, "public", "json", "index.html"));
});

app.get("/", async (req, res) => {
    return res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/*", async (req, res) => {
    let requestedFilePath = path.join(__dirname, "public", req.path);
    if (fs.existsSync(requestedFilePath)) {
        return res.sendFile(requestedFilePath);
    }
});

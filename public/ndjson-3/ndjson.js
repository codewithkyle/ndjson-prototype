let reader = null;
const decoder = new TextDecoder();
let buffer = "";
let workerUid = null;

function send(obj){
    self.postMessage({
        type: "result",
        result: {
            id: obj.id,
            name: obj.name,
        },
        uid: workerUid,
    });
}
function processJSON(){
    return new Promise(resolve => {
        const results = buffer.split("\n");
        while(true){
            try {
                const obj = JSON.parse(results[0]);
                send(obj);
                buffer = buffer.replace(/.*\n+/, "");
                results.splice(0, 1);
                if (!results.length){
                    break;
                }
            } catch(e) {
                break;
            }
        }
        resolve();
    });
}
async function processText({ done, value }) {
    if (!done) {
        const chunk = decoder.decode(value);
        buffer += chunk;
        await processJSON();
    }
    return done;
}
async function readStream(stream) {
    reader = stream.getReader();
    let done = false;
    while (!done){
        const nextChunk = await reader.read();
        done = await processText(nextChunk);
    }
}
async function fetchData(url){
    const response = await fetch(url, {
        method: "GET",
        headers: new Headers({
            Accept: "application/x-ndjson",
        }),
    });
    await readStream(response.body);
    self.postMessage({
        type: "done",
        uid: workerUid,
    });
}
self.onmessage = (e) => {
    const { url, uid } = e.data;
    workerUid = uid;
    fetchData(url);
}
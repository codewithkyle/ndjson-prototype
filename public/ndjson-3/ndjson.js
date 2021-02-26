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
function processJSON(objects){
    return new Promise(resolve => {
        while(true){
            try {
                send(JSON.parse(objects.pop()));
                if (!objects.length){
                    break;
                }
            } catch(e) {
                console.error(e);
            }
        }
        resolve();
    });
}
async function processText({ done, value }) {
    if (!done) {
        const chunk = decoder.decode(value);
        buffer += chunk;
        const objects = buffer.split("\n");
        buffer = objects.pop();
        if (objects.length){
            await processJSON(objects.reverse());
        }
    } else if (buffer.length){
        const objects = buffer.split("\n");
        await processJSON(objects.reverse());
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
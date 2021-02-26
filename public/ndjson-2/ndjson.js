let reader = null;
const decoder = new TextDecoder();
let buffer = "";
const ids = {};

function send(card){
    self.postMessage({
        type: "render",
        card: card,
    });
}
function processJSON(){
    return new Promise(resolve => {
        const results = buffer.split("\n");
        while(true){
            try {
                const obj = JSON.parse(results[0]);
                if (!(obj.id in ids)){
                    ids[obj.id] = obj.name;
                    send(obj);
                }
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
(async () => {
    const response = await fetch("/data.ndjson");
    await readStream(response.body);
    self.postMessage({
        type: "done",
    });
})();
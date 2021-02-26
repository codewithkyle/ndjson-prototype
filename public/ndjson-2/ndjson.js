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
async function processJSON(){
    return new Promise(resolve => {
        const results = buffer.split("\n");
        while(true){
            try {
                const obj = JSON.parse(results[0]);
                if (!(obj.id in ids)){
                    ids[obj.id] = obj.name;
                    send(obj);
                    processed++;
                } else {
                    console.log("skipping duplicate object");
                }
                buffer = buffer.replace(/.*\n+/, "");
                results.splice(0, 1);
                if (!results.length){
                    console.log("buffer is empty");
                    break;
                }
            } catch(e) {
                console.log("buffer only contains a partial object");
                break;
            }
        }
        resolve();
    });
}
async function processText({ done, value }) {
    if (done) {
        self.postMessage({
            type: "done",
        });
        return;
    }
    const chunk = decoder.decode(value);
    buffer += chunk;
    await processJSON();
    return reader.read().then(processText);
}
function readStream(stream) {
    reader = stream.getReader();
    reader.read().then(processText);
}
(async () => {
    const response = await fetch("/data.ndjson");
    readStream(response.body);
})();
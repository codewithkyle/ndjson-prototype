let reader = null;
const decoder = new TextDecoder();
let buffer = "";

async function send(card){
    self.postMessage({
        type: "render",
        card: card,
    });
}
function processJSON(){
    const result = buffer.split("\n");
    while(true){
        try {
            const obj = JSON.parse(result[0]);
            if (!Object.keys(obj).length){
                console.log("Something happened", obj);
                break;
            }
            buffer = buffer.replace(/.*\n/, "");
            result.splice(0, 1);
            send(obj);
            if (!result.length){
                break;
            }
        } catch(e) {
            break;
        }
    }
}
function processText({ done, value }) {
    if (done) {
        self.postMessage({
            type: "done",
        });
        return;
    }
    const chunk = decoder.decode(value);
    buffer += chunk;
    processJSON();
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
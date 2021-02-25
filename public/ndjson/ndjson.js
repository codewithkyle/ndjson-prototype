const parseJSON = () => new TransformStream({
    transform(chunk, controller) {
        controller.enqueue(JSON.parse(chunk));
    }
});

const splitStream = splitOn => {
    let buffer = "";
    return new TransformStream({
        transform(chunk, controller) {
            buffer += chunk;
            const parts = buffer.split(splitOn);
            parts.slice(0, -1).forEach(part => controller.enqueue(part));
            buffer = parts[parts.length - 1];
        },
        flush(controller) {
            if (buffer) controller.enqueue(buffer);
        }
    });
};
const fetchJSONLD = url => fetch(url)
                            .then(response => ({
                                response,
                                reader: response.body
                                .pipeThrough(new TextDecoderStream())
                                // Needed to stream by line and then JSON parse the line
                                .pipeThrough(splitStream("\n"))
                                .pipeThrough(parseJSON())
                                .getReader()
                            }));
(async () => {
    fetchJSONLD("/data.ndjson").then(({ response, reader }) => {
        const length = response.headers.get("Content-Length");
        self.postMessage({
            type: "length",
            length: length,
        })
        const onReadChunk = async chunk => {
            if (chunk.done) {
                self.postMessage({
                    type: "done"
                });
                return;
            }
            self.postMessage({
                type: "render",
                data: chunk.value,
            });
            reader.read().then(onReadChunk);
        };
        reader.read().then(onReadChunk);
    });
})();
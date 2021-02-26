importScripts("/ndjson-3/util.js");

const DB_NAME = "demodb";

class IDBWorker {
    constructor() {
        this.db = null;
        self.onmessage = this.inbox.bind(this);
        this.tables = [];
        this.workerPool = {};
        this.main();
    }

    async insertData(uid, keyPath = null, table = null){
        this.workerPool[uid].busy = true;
        if (keyPath === null || table === null){
            table = this.workerPool[uid].table;
            keyPath = this.getTableKey(table);
        }
        const row = this.workerPool[uid].rows.splice(0, 1)[0];
        if (typeof row === "object"){
            const exists = await this.db.getFromIndex(table, keyPath, row[keyPath]);
            if (!exists){
                await this.db.put(table, row);
            }
            this.send("unpack-tick");
        }
        if (!this.workerPool[uid].rows.length){
            this.workerPool[uid].busy = false;
            if (this.workerPool[uid].status === "INSERTING"){
                delete this.workerPool[uid];
                this.send("unpack-finished");
            }
        } else {
            this.insertData(uid, keyPath, table);
        }
    }

    async workerInbox(e){
        const { worker, table, rows, busy } = this.workerPool[e.data.uid];
        switch (e.data.type){
            case "done":
                this.send("download-finished");
                if (worker){
                    worker.terminate();
                    this.workerPool[e.data.uid].status = "INSERTING";
                    if (!busy){
                        this.insertData();
                    }
                }
                break;
            default:
                rows.push(e.data.result);
                this.send("download-tick");
                if (!busy){
                    this.insertData(e.data.uid);
                }
                break;
        }
    }

    inbox(e) {
        const messageEventData = e.data;
        const origin = e?.origin ?? null;
        const { type, data, uid } = messageEventData;
        switch (type) {
            case "delete":
                this.delete(data)
                    .then(() => {
                    this.send("response", true, uid, origin);
                })
                    .catch((error) => {
                    console.error(error);
                    this.send("response", false, uid, origin);
                });
                break;
            case "put":
                this.put(data)
                    .then(() => {
                    this.send("response", true, uid, origin);
                })
                    .catch((error) => {
                    console.error(error);
                    this.send("response", false, uid, origin);
                });
                break;
            case "search":
                this.search(data).then((output) => {
                    this.send("response", output, uid, origin);
                });
                break;
            case "get":
                this.get(data).then((output) => {
                    this.send("response", output, uid, origin);
                });
                break;
            case "count":
                this.count(data).then((output) => {
                    this.send("response", output, uid, origin);
                });
                break;
            case "select":
                this.select(data).then((output) => {
                    this.send("response", output, uid, origin);
                });
                break;
            case "ingest":
                this.ingestData(data)
                    .then(() => {
                    this.send("response", true, uid, origin);
                })
                    .catch((error) => {
                    console.error(error);
                    this.send("response", false, uid, origin);
                });
                break;
            case "purge":
                this.purgeData();
                break;
            default:
                console.warn(`Unhandled IDB Worker inbox message type: ${type}`);
                break;
        }
    }
    send(type = "response", data = null, uid = null, origin = null) {
        const message = {
            type: type,
            data: data,
            uid: uid,
        };
        if (origin) {
            self.postMessage(message, origin);
        }
        else {
            // @ts-expect-error
            self.postMessage(message);
        }
    }
    getTableKey(table) {
        let key = "id";
        for (let i = 0; i < this.tables.length; i++) {
            if (this.tables[i].name === table) {
                if (this.tables[i]?.keyPath) {
                    key = this.tables[i].keyPath;
                }
                break;
            }
        }
        return key;
    }
    async ingestData(data) {
        const { route, table } = data;
        const workerUid = uid();
        const worker = new Worker("/ndjson-3/ndjson.js");
        this.workerPool[workerUid] = {
            worker: worker,
            table: table,
            rows: [],
            busy: false,
            status: "PARSING",
        };
        worker.onmessage = this.workerInbox.bind(this);
        worker.postMessage({
            url: route,
            uid: workerUid,
        });
    }
    async purgeData() {
        // @ts-expect-error
        await idb.deleteDB(DB_NAME, {
            blocked() {
                this.send("error", "Failed to purge local data because this app is still open in other tabs.");
            },
        });
    }
    async main() {
        try {
            const request = await fetch("/ndjson-3/schema.json");
            const scheam = await request.json();
            this.tables = scheam.tables;
            this.db = await idb.openDB(DB_NAME, scheam.version, {
                upgrade(db, oldVersion, newVersion, transaction) {
                    // Purge old stores so we don't brick the JS runtime VM when upgrading
                    for (let i = 0; i < db.objectStoreNames.length; i++) {
                        db.deleteObjectStore(db.objectStoreNames[i]);
                    }
                    for (let i = 0; i < scheam.tables.length; i++) {
                        const table = scheam.tables[i];
                        const options = {
                            keyPath: "id",
                            autoIncrement: false,
                        };
                        if (table?.keyPath) {
                            options.keyPath = table.keyPath;
                        }
                        if (typeof table.autoIncrement !== "undefined") {
                            options.autoIncrement = table.autoIncrement;
                        }
                        const store = db.createObjectStore(table.name, options);
                        for (let k = 0; k < table.columns.length; k++) {
                            const column = table.columns[k];
                            store.createIndex(column.key, column.key, {
                                unique: column?.unique ?? false,
                            });
                        }
                    }
                },
                blocked() {
                    this.send("error", "This app needs to restart. Close all tabs for this app and before relaunching.");
                },
                blocking() {
                    this.send("error", "This app needs to restart. Close all tabs for this app before relaunching.");
                },
            });
            this.send("ready");
        }
        catch (e) {
            console.error(e);
        }
    }
    async delete(data) {
        const { table, key } = data;
        await this.db.delete(table, key);
        return;
    }
    async put(data) {
        const { table, key, value } = data;
        if (key !== null) {
            await this.db.put(table, value, key);
        }
        else {
            await this.db.put(table, value);
        }
        return;
    }
    fuzzySearch(rows, query, key) {
        const options = {
            threshold: -Infinity,
            allowTypo: false,
        };
        if (Array.isArray(key)) {
            options["keys"] = key;
        }
        else {
            options["key"] = key;
        }
        const results = fuzzysort.go(query, rows, options);
        const output = [];
        for (let i = 0; i < results.length; i++) {
            output.push(results[i].obj);
        }
        return output;
    }
    async search(data) {
        const { table, key, query, limit, page } = data;
        const rows = await this.db.getAll(table);
        let output = [];
        if (query) {
            output = this.fuzzySearch(rows, query, key);
        }
        else {
            output = rows;
        }
        if (limit !== null) {
            let start = (page - 1) * limit;
            let end = page * limit;
            output = output.slice(start, end);
        }
        return output;
    }
    async get(data) {
        const { table, key, index } = data;
        let output = null;
        if (index !== null) {
            output = await this.db.getFromIndex(table, index, key);
        }
        else {
            output = await this.db.get(table, key);
        }
        return output;
    }
    async count(data) {
        const { table, query, key } = data;
        const rows = await this.db.getAll(table);
        let output = 0;
        if (query && key) {
            output = this.fuzzySearch(rows, query, key).length;
        }
        else {
            output = rows.length;
        }
        return output;
    }
    async select(data) {
        const { table, page, limit } = data;
        const rows = await this.db.getAll(table);
        let output = [];
        if (limit !== null) {
            let start = (page - 1) * limit;
            let end = page * limit;
            output = rows.slice(start, end);
        }
        else {
            output = rows;
        }
        return output;
    }
}
new IDBWorker();
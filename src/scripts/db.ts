import lf from "lovefield"

const sdbSchema = lf.schema.create("sourcesDB", 4)
sdbSchema
    .createTable("sources")
    .addColumn("sid", lf.Type.INTEGER)
    .addPrimaryKey(["sid"], false)
    .addColumn("url", lf.Type.STRING)
    .addColumn("iconurl", lf.Type.STRING)
    .addColumn("name", lf.Type.STRING)
    .addColumn("openTarget", lf.Type.NUMBER)
    .addColumn("lastFetched", lf.Type.DATE_TIME)
    .addColumn("serviceRef", lf.Type.STRING)
    .addColumn("rules", lf.Type.OBJECT)
    .addColumn("textDir", lf.Type.NUMBER)
    .addColumn("hidden", lf.Type.BOOLEAN)
    .addNullable(["iconurl", "serviceRef", "rules"])
    .addIndex("idxURL", ["url"], true)

const idbSchema = lf.schema.create("itemsDB", 3)
idbSchema
    .createTable("items")
    .addColumn("_id", lf.Type.INTEGER)
    .addPrimaryKey(["_id"], true)
    .addColumn("source", lf.Type.INTEGER)
    .addColumn("title", lf.Type.STRING)
    .addColumn("link", lf.Type.STRING)
    .addColumn("date", lf.Type.DATE_TIME)
    .addColumn("fetchedDate", lf.Type.DATE_TIME)
    .addColumn("thumb", lf.Type.STRING)
    .addColumn("content", lf.Type.STRING)
    .addColumn("snippet", lf.Type.STRING)
    .addColumn("creator", lf.Type.STRING)
    .addColumn("hasRead", lf.Type.BOOLEAN)
    .addColumn("starred", lf.Type.BOOLEAN)
    .addColumn("hidden", lf.Type.BOOLEAN)
    .addColumn("notify", lf.Type.BOOLEAN)
    .addColumn("serviceRef", lf.Type.STRING)
    .addColumn("embedding", lf.Type.OBJECT)
    .addNullable(["thumb", "creator", "serviceRef", "embedding"])
    .addIndex("idxDate", ["date"], false, lf.Order.DESC)
    .addIndex("idxService", ["serviceRef"], false)

idbSchema
    .createTable("api_calls")
    .addColumn("id", lf.Type.INTEGER)
    .addPrimaryKey(["id"], true)
    .addColumn("model", lf.Type.STRING)
    .addColumn("api_type", lf.Type.STRING)
    .addColumn("call_context", lf.Type.STRING)
    .addColumn("prompt_tokens", lf.Type.INTEGER)
    .addColumn("completion_tokens", lf.Type.INTEGER)
    .addColumn("total_tokens", lf.Type.INTEGER)
    .addColumn("timestamp", lf.Type.DATE_TIME)
    .addIndex("idxTimestamp", ["timestamp"], false, lf.Order.DESC)
    .addIndex("idxModel", ["model"], false)

export let sourcesDB: lf.Database
export let sources: lf.schema.Table
export let itemsDB: lf.Database
export let items: lf.schema.Table
export let apiCalls: lf.schema.Table

async function onUpgradeSourceDB(rawDb: lf.raw.BackStore) {
    const version = rawDb.getVersion()
    if (version < 2) {
        await rawDb.addTableColumn("sources", "textDir", 0)
    }
    if (version < 3) {
        await rawDb.addTableColumn("sources", "hidden", false)
    }
    // Version 4: Removed fetchFrequency column (no longer used)
    // If upgrading from version 3, the fetchFrequency column will remain in the database
    // but won't be used by the application, which is fine
}

async function onUpgradeItemsDB(rawDb: lf.raw.BackStore) {
    const version = rawDb.getVersion()
    if (version < 2) {
        // 添加embedding字段，初始值为null
        await rawDb.addTableColumn("items", "embedding", null)
    }
    // Version 3: 添加 api_calls 表
    if (version < 3) {
        // 表会在schema升级时自动创建
    }
}

export async function init() {
    sourcesDB = await sdbSchema.connect({ onUpgrade: onUpgradeSourceDB })
    sources = sourcesDB.getSchema().table("sources")
    itemsDB = await idbSchema.connect({ onUpgrade: onUpgradeItemsDB })
    items = itemsDB.getSchema().table("items")
    apiCalls = itemsDB.getSchema().table("api_calls")
}


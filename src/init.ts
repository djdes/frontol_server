import { DbRequest, createTrigger, deleteTrigger } from "./tools";
(async () => {
	try {
		await DbRequest(`ALTER TABLE DOCUMENT ADD last_order_update VARCHAR(25)`);
		console.log("Column last_order_update added");
	} catch (err: any) {
		console.log("addColl (column may already exist):", err?.message || err);
	}
	try {
		await deleteTrigger();
	} catch (err: any) {
		console.log("deleteTrigger (may not exist):", err?.message || err);
	}
	try {
		await createTrigger();
	} catch (err: any) {
		console.log("createTrigger:", err?.message || err);
	}
	console.log("init done");
	process.exit(0);
})();

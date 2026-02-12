import { DbRequest } from "./tools";
(async () => {
	try {
		const result = await DbRequest(`SELECT FIRST 1 ID FROM DOCUMENT`);
		console.log("DB health check OK:", result);
	} catch (err: any) {
		console.error("DB health check FAILED:", err?.message || err);
		process.exit(1);
	}
	console.log("init done");
	process.exit(0);
})();

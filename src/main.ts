import { startSchedules } from "./schedules/schedules-start";

process.env.TZ = "Asia/Qyzylorda";

const main = async () => {
	startSchedules();
};

main();

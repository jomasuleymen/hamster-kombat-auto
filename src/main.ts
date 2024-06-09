import { startSchedules } from "./schedules/schedules-start";

process.env.TZ = "Asia/Qyzylorda";

const main = async () => {
	Date.prototype.toJSON = function () {
		return this.toLocaleString("ru") + " - " + process.env.TZ;
	};

	Date.prototype.toLocaleString = function () {
		return this.toLocaleString("ru") + " - " + process.env.TZ;
	};

	startSchedules();
};

main();

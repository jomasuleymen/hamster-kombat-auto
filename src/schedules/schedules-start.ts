import { ToadScheduler } from "toad-scheduler";
import { updateAuthTokenJob } from "./auth.sh";
import { hamsterJobs } from "./hamster.sh";

export async function startSchedules() {
	const scheduler = new ToadScheduler();

	scheduler.addSimpleIntervalJob(updateAuthTokenJob());
	hamsterJobs().forEach((job) => scheduler.addSimpleIntervalJob(job));
}

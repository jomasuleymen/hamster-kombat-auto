import { ToadScheduler } from "toad-scheduler";
import { updateAuthTokenJob } from "./auth.sh";
import { clickerAutomationJob } from "./clicker.sh";

export async function startSchedules() {
	const scheduler = new ToadScheduler();
	
	scheduler.addSimpleIntervalJob(updateAuthTokenJob());
	scheduler.addSimpleIntervalJob(clickerAutomationJob());
}

import { Hamster } from "src/hamster/hamster";
import { logger } from "src/utils/logger";
import { sleep } from "src/utils/time.util";
import { SimpleIntervalJob, Task } from "toad-scheduler";

async function clickerAutomation(account: Hamster) {
	const actions = [
		account.sync.bind(account),
		account.completeTap.bind(account),
		account.fetchUpgrades.bind(account),
		account.upgradeItems.bind(account),
	];

	for (let action of actions) {
		try {
			await action();

			await sleep(5_000);
		} catch (err) {
			logger.error({
				source: "clickerAutomationJob",
				message: err.message,
			});
			break;
		}
	}
}

export function clickerAutomationJob() {
	const account = new Hamster();
	logger.info("Starting clickerAutomationJob");

	const task = new Task("update auth token", () => clickerAutomation(account));
	const job = new SimpleIntervalJob({ hours: 3, runImmediately: true }, task);

	return job;
}

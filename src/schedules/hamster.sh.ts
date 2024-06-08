import { Hamster } from "src/hamster/hamster";
import { logger } from "src/utils/logger";
import { sleep } from "src/utils/time.util";
import { SimpleIntervalJob, Task } from "toad-scheduler";

async function upgraderAutomation(account: Hamster) {
	const actions = [
		account.sync.bind(account),
		account.fetchUpgrades.bind(account),
		account.upgradeItems.bind(account),
	];

	for (let action of actions) {
		try {
			await action();

			await sleep(5_000);
		} catch (err) {
			logger.error({
				source: "upgraderAutomation",
				message: err.message,
			});
			break;
		}
	}
}

async function clickerAutomation(account: Hamster) {
	const actions = [account.completeTap.bind(account)];

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

function upgraderAutomationJob(account: Hamster) {
	logger.info("Starting upgraderAutomationJob");

	const task = new Task("upgrader automation job", () =>
		upgraderAutomation(account)
	);
	const job = new SimpleIntervalJob({ hours: 3, runImmediately: true }, task);

	return job;
}

function clickerAutomationJob(account: Hamster) {
	logger.info("Starting clickerAutomationJob");

	const task = new Task("clicker autmation job", () =>
		clickerAutomation(account)
	);
	const job = new SimpleIntervalJob(
		{ minutes: 15, runImmediately: true },
		task
	);

	return job;
}

export const hamsterJobs = () => {
	const account = new Hamster();
	return [clickerAutomationJob(account), upgraderAutomationJob(account)];
};

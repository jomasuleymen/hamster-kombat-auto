import { SH_INTERVAL } from 'src/constants/hamster-api.constant';
import { Hamster } from 'src/hamster/hamster';
import { logger } from 'src/utils/logger';
import { sleep } from 'src/utils/time.util';
import { SimpleIntervalJob, Task } from 'toad-scheduler';

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
				source: 'upgraderAutomation',
				message: err.message,
			});
			break;
		}
	}
}

async function tapAutomation(account: Hamster) {
	const actions = [
		account.sync.bind(account),
		account.completeTap.bind(account),
	];

	for (let action of actions) {
		try {
			await action();

			await sleep(5_000);
		} catch (err) {
			logger.error({
				source: 'clickerAutomationJob',
				message: err.message,
			});
		}
	}
}

async function dailyCipherAutomation(account: Hamster) {
	const actions = [
		account.sync.bind(account),
		account.claimDailyCipher.bind(account),
	];

	for (let action of actions) {
		try {
			await action();

			await sleep(5_000);
		} catch (err) {
			logger.error({
				source: 'dailyCipherAutomation',
				message: err.message,
			});
		}
	}
}

function upgraderAutomationJob(account: Hamster) {
	logger.info('Starting upgraderAutomationJob');

	const task = new Task('upgraderAutomationJob', () =>
		upgraderAutomation(account)
	);
	const job = new SimpleIntervalJob(
		{ milliseconds: SH_INTERVAL.HAMSTER.UPGRADES, runImmediately: true },
		task
	);

	return job;
}

function tapAutomationJob(account: Hamster) {
	logger.info('Starting tapAutomationJob');

	const task = new Task('tapAutomationJob', () => tapAutomation(account));
	const job = new SimpleIntervalJob(
		{
			milliseconds: SH_INTERVAL.HAMSTER.TAP,
			runImmediately: true,
		},
		task
	);

	return job;
}

function dailyCipherAutomationJob(account: Hamster) {
	logger.info('Starting dailyCipherAutomationJob');

	const task = new Task('dailyCipherAutomationJob', () =>
		dailyCipherAutomation(account)
	);
	const job = new SimpleIntervalJob(
		{
			milliseconds: SH_INTERVAL.HAMSTER.CLAIM_DAILY_CIPHER,
			runImmediately: true,
		},
		task
	);

	return job;
}

export const hamsterJobs = () => {
	const account = new Hamster();
	return [
	//	upgraderAutomationJob(account),
	];
};

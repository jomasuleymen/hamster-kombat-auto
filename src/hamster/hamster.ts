import { Semaphore } from 'async-mutex';
import { ENDPOINT, SH_INTERVAL } from 'src/constants/hamster-api.constant';
import hamsterAxios from 'src/utils/axios.instance';
import { writeObjectToFile } from 'src/utils/file.util';
import { logger } from 'src/utils/logger';
import { addSecondsToDate, sleep } from 'src/utils/time.util';
import { MILLISECONDS_PER_SECOND, MINUTE, SECOND } from 'time-constants';
import {
	DailyCipher,
	HamsterUserData,
	Upgrade,
	UpgradeReqResponse,
} from './hamster.type';

export class Hamster {
	private synced: boolean;

	private userData: HamsterUserData;
	private sortedUpgrades: Upgrade[];
	private requestSemaphore: Semaphore;
	private dailyCipher: DailyCipher;
	private expensesOnQueue: number;
	private lastSyncedTime: number;
	private nextCipherAvailableDate: Date;

	constructor() {
		this.sortedUpgrades = [];
		this.synced = false;
		this.userData = {
			balanceCoins: 0,
			earnPerTap: 0,
			maxTaps: 0,
			earnPassivePerHour: 0,
		};
		this.dailyCipher = {
			cipher: '',
			isClaimed: true,
			remainSeconds: 0,
		};
		this.requestSemaphore = new Semaphore(1);
		this.expensesOnQueue = 0;
		this.nextCipherAvailableDate = new Date();
		this.lastSyncedTime = 0;
	}

	private async runExclusive(callback: () => any) {
		return await this.requestSemaphore.runExclusive(async () => {
			await sleep(1_000);
			return await callback();
		});
	}

	async sync() {
		await this.runExclusive(async () => {
			if (Date.now() - this.lastSyncedTime <= MINUTE) {
				return;
			}

			const data = await hamsterAxios.post(ENDPOINT.SYNC).then((data) => {
				return data.data;
			});

			const { clickerUser } = data;
			this.setUserData(clickerUser);

			const config = await hamsterAxios.post(ENDPOINT.CONFIG).then((data) => {
				return data.data;
			});

			const { dailyCipher } = config;
			this.dailyCipher = {
				cipher: dailyCipher.cipher,
				isClaimed: dailyCipher.isClaimed,
				remainSeconds: dailyCipher.remainSeconds,
			};

			this.synced = true;
			this.lastSyncedTime = Date.now();
		});
	}

	async fetchUpgrades() {
		await this.runExclusive(async () => {
			const data = await hamsterAxios
				.post(ENDPOINT.UPGRADES_FOR_BUY)
				.then((data) => {
					return data.data;
				});

			const { upgradesForBuy } = data;
			this.setUpgrades(upgradesForBuy);
		});
	}

	async completeTap() {
		if (!this.synced) return;

		await this.runExclusive(async () => {
			return await hamsterAxios
				.post(ENDPOINT.TAP, {
					availableTaps: 0,
					count: Math.floor(this.userData.maxTaps / this.userData.earnPerTap),
					timestamp: Date.now(),
				})
				.then((data) => data.data);
		});
	}

	private decodeCipher(cipher: string) {
		const delimeter = '4';

		try {
			if (cipher.length <= 4) return atob(cipher);
			if (cipher.charAt(3) == delimeter)
				return atob(cipher.slice(0, 3) + cipher.slice(4));

			return atob(cipher.replace(/4/g, ''));
		} catch (_) {
			return null;
		}
	}

	async claimDailyCipher() {
		if (!this.synced) return;
		if (new Date() < this.nextCipherAvailableDate) return;
		if (this.dailyCipher.isClaimed) {
			this.nextCipherAvailableDate = new Date(
				Date.now() +
					(this.dailyCipher.remainSeconds + 10) * MILLISECONDS_PER_SECOND
			);
			return;
		}

		const cipher = this.decodeCipher(this.dailyCipher.cipher);
		if (!cipher) return;

		logger.info({
			source: 'account.claimDailyCipher',
			cipher,
		});

		return await this.runExclusive(async () => {
			await hamsterAxios
				.post(ENDPOINT.CLAIM_CIPHER, {
					cipher,
				})
				.then((data) => {
					const { remainSeconds } = data.data || {};
					if (remainSeconds) {
						this.nextCipherAvailableDate = new Date(
							Date.now() + (remainSeconds + 10) * MILLISECONDS_PER_SECOND
						);
					}
				});
		});
	}

	private async upgradeItem(item: Upgrade) {
		await this.runExclusive(async () => {
			logger.info({
				source: 'account.upgradeItems',
				action: 'upgrading',
				upgrade: item,
			});

			this.expensesOnQueue -= item.price;

			await hamsterAxios
				.post(ENDPOINT.UPGRADE, {
					timestamp: Date.now(),
					upgradeId: item.id,
				})
				.then((data) => {
					const { upgradesForBuy, clickerUser } = data.data;
					this.setUpgrades(upgradesForBuy);
					this.setUserData(clickerUser);
				});
		});
	}

	private setUserData(clickerUser: any) {
		this.userData = {
			balanceCoins: clickerUser.balanceCoins,
			earnPerTap: clickerUser.earnPerTap,
			maxTaps: clickerUser.maxTaps,
			earnPassivePerHour: clickerUser.earnPassivePerHour,
		};
	}

	private setUpgrades(upgradesForBuy: UpgradeReqResponse[]) {
		let newUpgrades: Upgrade[] = upgradesForBuy.map((upgrade) => {
			return {
				id: upgrade.id,
				isAvailable: upgrade.isAvailable,
				isExpired: upgrade.isExpired,
				cooldownSeconds: upgrade.cooldownSeconds || 0,
				cooldownEnds: upgrade.cooldownSeconds
					? addSecondsToDate(upgrade.cooldownSeconds)
					: null,
				name: upgrade.name,
				price: upgrade.price,
				currentProfitPerHour: upgrade.currentProfitPerHour,
				profitPerHour: upgrade.profitPerHour,
				profitPerHourDelta: upgrade.profitPerHourDelta,
				section: upgrade.section,
				ratio: upgrade.price / upgrade.profitPerHourDelta,
			};
		});

		newUpgrades = newUpgrades.filter(
			(upgrade) =>
				upgrade.profitPerHourDelta > 0 &&
				upgrade.isAvailable &&
				!upgrade.isExpired
		);

		newUpgrades.sort((a, b) => a.ratio - b.ratio);
		this.sortedUpgrades = newUpgrades;
	}

	private getUpgradeableItems(upgrades: Upgrade[]) {
		const upgradeAbleItems: Upgrade[] = [];
		let tempUpgrades = [...upgrades];
		tempUpgrades.sort((a, b) => a.ratio - b.ratio);

		const firstUpgradeable = tempUpgrades.find(
			(upgrade) =>
				upgrade.profitPerHourDelta > 0 &&
				upgrade.isAvailable &&
				!upgrade.isExpired
		);
		if (!firstUpgradeable) return upgradeAbleItems;

		while (tempUpgrades.length) {
			let remainBalanceCoins =
				this.userData.balanceCoins - this.expensesOnQueue;
			const upgrade = tempUpgrades.find((upgrade) => {
				let isUpgradeable =
					upgrade.profitPerHourDelta > 0 &&
					upgrade.isAvailable &&
					!upgrade.isExpired;

				if (isUpgradeable && upgrade.cooldownEnds) {
					const remainCooldownMs = upgrade.cooldownEnds.getTime() - Date.now();
					isUpgradeable = remainCooldownMs < SH_INTERVAL.HAMSTER.UPGRADES * 0.9;
				}

				return isUpgradeable;
			});

			if (!upgrade) break;
			if (remainBalanceCoins - upgrade.price < 0) break;

			if (upgrade.ratio > firstUpgradeable.ratio * 1.3) break;

			upgradeAbleItems.push(upgrade);
			tempUpgrades = tempUpgrades.filter((a) => a.id !== upgrade.id);
			this.expensesOnQueue += upgrade.price;
		}

		return upgradeAbleItems;
	}

	async upgradeItems() {
		const upgradeableItems = this.getUpgradeableItems(this.sortedUpgrades);
		const promises = upgradeableItems.map(async (upgrade) => {
			try {
				// if optimal profitable item on cooldown, just wait it.
				if (upgrade.cooldownEnds) {
					logger.info({
						source: 'account.upgradeItems',
						action: 'waiting for cooldown',
						upgrade: upgrade,
					});

					await sleep(
						upgrade.cooldownEnds.getTime() - Date.now() + 10 * SECOND
					);

					upgrade.cooldownSeconds = 0;
					upgrade.cooldownEnds = null;
				}

				await this.upgradeItem(upgrade);
			} catch (err) {
				logger.error({
					source: 'account.upgradeItems',
					message: err.message,
					upgrade: upgrade,
				});
			}
		});

		writeObjectToFile(
			{
				lastUpdateDate: new Date(),
				userData: this.userData,
				expensesOnQueue: this.expensesOnQueue,
				upgradeableItems,
				upgrades: this.sortedUpgrades,
			},
			'upgrades.json'
		);

		Promise.all(promises);
	}
}

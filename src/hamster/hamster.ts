import { Semaphore } from "async-mutex";
import { ENDPOINT, SH_INTERVAL } from "src/constants/hamster-api.constant";
import hamsterAxios from "src/utils/axios.instance";
import { writeObjectToFile } from "src/utils/file.util";
import { logger } from "src/utils/logger";
import { addSecondsToDate, sleep } from "src/utils/time.util";
import { SECOND } from "time-constants";
import { HamsterUserData, Upgrade, UpgradeResponse } from "./hamster.type";

export class Hamster {
	private synced: boolean;

	private userData: HamsterUserData;
	private sortedUpgrades: Upgrade[];
	private updateItemSemaphore: Semaphore;
	private expensesOnQueue: number;

	constructor() {
		this.sortedUpgrades = [];
		this.synced = false;
		this.userData = {
			balanceCoins: 0,
			earnPerTap: 0,
			maxTaps: 0,
			earnPassivePerHour: 0,
		};

		this.updateItemSemaphore = new Semaphore(1);
		this.expensesOnQueue = 0;
	}

	async sync() {
		const data = await hamsterAxios.post(ENDPOINT.SYNC).then((data) => {
			return data.data;
		});

		const { clickerUser } = data;
		this.setUserData(clickerUser);

		this.synced = true;
	}

	async fetchUpgrades() {
		const data = await hamsterAxios
			.post(ENDPOINT.UPGRADES_FOR_BUY)
			.then((data) => {
				return data.data;
			});

		const { upgradesForBuy } = data;
		this.setUpgrades(upgradesForBuy);
	}

	async completeTap() {
		if (!this.synced) {
			return;
		}

		return await hamsterAxios
			.post(ENDPOINT.TAP, {
				availableTaps: 0,
				count: Math.floor(this.userData.maxTaps / this.userData.earnPerTap),
				timestamp: Date.now(),
			})
			.then((data) => data.data);
	}

	private async upgradeItem(item: Upgrade) {
		await this.updateItemSemaphore.runExclusive(async () => {
			logger.info({
				source: "account.upgradeItems",
				action: "upgrading",
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

			await sleep(1_000);
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

	private setUpgrades(upgradesForBuy: UpgradeResponse[]) {
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
		// find first available and profitable item
		let tempUpgrades = [...upgrades];
		const upgradeAbleItems = [];

		while (tempUpgrades.length) {
			let remainBalanceCoins =
				this.userData.balanceCoins - this.expensesOnQueue;
			const upgrade = tempUpgrades.find((upgrade) => {
				let found =
					upgrade.profitPerHourDelta > 0 &&
					upgrade.isAvailable &&
					!upgrade.isExpired;

				if (found && upgrade.cooldownEnds) {
					const remainCooldownMs = upgrade.cooldownEnds.getTime() - Date.now();
					found = remainCooldownMs < SH_INTERVAL.HAMSTER.UPGRADES * 0.9;
				}

				return found;
			});

			if (!upgrade) break;
			if (remainBalanceCoins - upgrade.price < 0) break;

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
						source: "account.upgradeItems",
						action: "waiting for cooldown",
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
					source: "account.upgradeItems",
					message: err.message,
					upgrade: upgrade,
				});
			}
		});

		writeObjectToFile(
			{
				lastUpdateDate: new Date(),
				upgradeableItems,
				expensesOnQueue: this.expensesOnQueue,
				upgrades: this.sortedUpgrades,
			},
			"upgrades.json"
		);

		Promise.all(promises);
	}
}

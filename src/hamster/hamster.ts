import { ENDPOINT, ERR } from "src/constants/hamster-api.constant";
import hamsterAxios from "src/utils/axios.instance";
import { writeObjectToFile } from "src/utils/file.util";
import { logger } from "src/utils/logger";
import { addSecondsToDate, sleep } from "src/utils/time.util";
import { HOUR } from "time-constants";
import { HamsterUserData, Upgrade, UpgradeResponse } from "./hamster.type";

export class Hamster {
	private synced: boolean;
	private isUpgrading: boolean;

	private userData: HamsterUserData;
	private sortedUpgrades: Upgrade[];

	constructor() {
		this.sortedUpgrades = [];
		this.synced = false;
		this.userData = {
			balanceCoins: 0,
			earnPerTap: 0,
			maxTaps: 0,
			earnPassivePerHour: 0,
		};
	}

	private setUserData(clickerUser: any) {
		this.userData = {
			balanceCoins: clickerUser.balanceCoins,
			earnPerTap: clickerUser.earnPerTap,
			maxTaps: clickerUser.maxTaps,
			earnPassivePerHour: clickerUser.earnPassivePerHour,
		};
	}

	async sync() {
		const data = await hamsterAxios.post(ENDPOINT.SYNC).then((data) => {
			return data.data;
		});

		const { clickerUser } = data;
		this.setUserData(clickerUser);

		this.synced = true;
	}

	private setUpgrades(upgradesForBuy: UpgradeResponse[]) {
		const newUpgrades: Upgrade[] = upgradesForBuy.map((upgrade) => {
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

		newUpgrades.sort((a, b) => a.ratio - b.ratio);

		this.sortedUpgrades = newUpgrades;
		const upgradeItem = this.getFirstUpgradeable(this.sortedUpgrades);

		writeObjectToFile(
			{
				lastUpdateDate: new Date(),
				upgradeItem,
				upgrades: this.sortedUpgrades,
			},
			"upgrades.json"
		);
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
		return await hamsterAxios
			.post(ENDPOINT.UPGRADE, {
				timestamp: Date.now(),
				upgradeId: item.id,
			})
			.then((data) => {
				const { upgradesForBuy, clickerUser } = data.data;
				this.setUpgrades(upgradesForBuy);
				this.setUserData(clickerUser);
			});
	}

	private getFirstUpgradeable(upgrades: Upgrade[]) {
		// find first available and profitable item
		return upgrades.find(
			(upgrade) =>
				upgrade.price > 0 &&
				upgrade.profitPerHourDelta > 0 &&
				upgrade.isAvailable &&
				!upgrade.isExpired
		);
	}

	async upgradeItems() {
		if (!this.synced || this.isUpgrading) {
			return;
		}

		this.isUpgrading = true;
		const upgradeItem = this.getFirstUpgradeable(this.sortedUpgrades);

		while (true) {
			if (upgradeItem) {
				try {
					// if optimal profitable item costs highest or on cooldown, just wait them.
					if (upgradeItem.cooldownEnds) {
						if (upgradeItem.cooldownEnds.getTime() <= Date.now() + 2 * HOUR) {
							logger.info({
								source: "account.upgradeItems",
								action: "waiting for cooldown",
								upgrade: upgradeItem,
							});
							await sleep(upgradeItem.cooldownEnds.getTime() - Date.now());
						} else {
							break;
						}
					}

					if (upgradeItem.price > this.userData.balanceCoins) {
						const needCoins = upgradeItem.price - this.userData.balanceCoins;
						const waitHours = needCoins / this.userData.earnPassivePerHour;
						const waitingMillis = waitHours * HOUR;

						if (waitHours <= 2) {
							logger.info({
								source: "account.upgradeItems",
								action: "waiting for coins",
								upgrade: upgradeItem,
								needCoins,
								endsUp: new Date(Date.now() + waitingMillis),
							});

							await sleep(waitingMillis);
						} else {
							break;
						}
					}

					await this.upgradeItem(upgradeItem);

					logger.info({
						source: "account.upgradeItems",
						action: "upgrading",
						upgrade: upgradeItem,
					});
				} catch (err) {
					if (err.response?.data.message !== ERR.INSUFFICIENT_FUNDS) {
						upgradeItem.isAvailable = false;
					}

					logger.error({
						source: "account.upgradeItems",
						message: err.message,
						upgrade: upgradeItem,
					});
				} finally {
					await sleep(3000);
				}
			} else {
				logger.info({
					source: "account.upgradeItems",
					message: "Nothing to update",
					balance: this.userData.balanceCoins,
					profitPerHour: this.userData.earnPassivePerHour,
				});

				this.isUpgrading = false;
				return;
			}
		}

		this.isUpgrading = false;
	}
}

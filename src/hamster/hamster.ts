import { ENDPOINT } from "src/constants/hamster-api.constant";
import hamsterAxios from "src/utils/axios.instance";
import { HamsterUserData, Upgrade } from "./hamster.type";
import { sleep } from "src/utils/time.util";
import { logger } from "src/utils/logger";

export class Hamster {
	userData: HamsterUserData;
	sortedUpgrades: Upgrade[];

	constructor() {
		this.sortedUpgrades = [];
		this.userData = {
			balanceCoins: 0,
			earnPerTap: 0,
			maxTaps: 0,
		};
	}

	async sync() {
		const data = await hamsterAxios.post(ENDPOINT.SYNC).then((data) => {
			return data.data;
		});

		const { clickerUser } = data;

		this.userData = {
			balanceCoins: clickerUser.balanceCoins,
			earnPerTap: clickerUser.earnPerTap,
			maxTaps: clickerUser.maxTaps,
		};
	}

	private setUpgrades(upgrades: any) {
		const newUpgrades: Upgrade[] = upgrades.map((upgrade: any) => {
			return {
				id: upgrade.id,
				isAvailable: upgrade.isAvailable,
				isExpired: upgrade.isExpired,
				cooldownSeconds: upgrade.cooldownSeconds || 0,
				name: upgrade.name,
				price: upgrade.price,
				currentProfitPerHour: upgrade.currentProfitPerHour,
				profitPerHour: upgrade.profitPerHour,
				profitPerHourDelta: upgrade.profitPerHourDelta,
				section: upgrade.section,
				ratio: upgrade.price / upgrade.profitPerHourDelta,
			};
		});

		newUpgrades.sort((a, b) => a.ration - b.ration);

		this.sortedUpgrades = newUpgrades;
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
		if (!this.userData) {
			console.log("User data is null");
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
				this.userData.balanceCoins -= item.price;

				const { upgradesForBuy } = data.data;
				this.setUpgrades(upgradesForBuy);
			});
	}

	async upgradeItems() {
		while (true) {
			const upgradeItem = this.sortedUpgrades.find((upgrade) => {
				if (upgrade.cooldownSeconds > 0) return false;

				return (
					upgrade.price > 0 &&
					upgrade.profitPerHourDelta > 0 &&
					upgrade.price < this.userData.balanceCoins &&
					upgrade.isAvailable &&
					!upgrade.isExpired
				);
			});

			if (upgradeItem) {
				try {
					this.upgradeItem(upgradeItem);
				} catch (err) {
					upgradeItem.isAvailable = true;
					logger.error({
						source: "account.upgradeItems",
						message: err.message,
						item: upgradeItem,
					});
				} finally {
					await sleep(3000);
				}
			} else {
				logger.info({
					source: "account.upgradeItems",
					message: `Nothing to update, balance: ${this.userData.balanceCoins}`,
				});

				return;
			}
		}
	}
}

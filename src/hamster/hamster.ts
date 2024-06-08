import { ENDPOINT, ERR } from "src/constants/hamster-api.constant";
import hamsterAxios from "src/utils/axios.instance";
import { logger } from "src/utils/logger";
import { sleep } from "src/utils/time.util";
import { HamsterUserData, Upgrade } from "./hamster.type";

export class Hamster {
	userData: HamsterUserData;
	sortedUpgrades: Upgrade[];

	constructor() {
		this.sortedUpgrades = [];
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
	}

	private setUpgrades(upgradesForBuy: any) {
		const newUpgrades: Upgrade[] = upgradesForBuy.map((upgrade: any) => {
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
		if (!this.userData || !this.userData.maxTaps || !this.userData.earnPerTap) {
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
				this.userData.balanceCoins -= item.price;

				const { upgradesForBuy, clickerUser } = data.data;
				this.setUpgrades(upgradesForBuy);
				this.setUserData(clickerUser);
			});
	}

	async upgradeItems() {
		while (true) {
			// find first available and profitable item
			const upgradeItem = this.sortedUpgrades.find(
				(upgrade) =>
					upgrade.price > 0 &&
					upgrade.profitPerHourDelta > 0 &&
					upgrade.isAvailable &&
					!upgrade.isExpired
			);

			if (upgradeItem) {
				// if optimal profitable item costs highest or on cooldown, just wait them.
				if (
					upgradeItem.price > this.userData.balanceCoins ||
					upgradeItem.cooldownSeconds > 0
				)
					return;

				try {
					this.upgradeItem(upgradeItem);

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

				return;
			}
		}
	}
}

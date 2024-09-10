import { HOUR, MINUTE, SECOND } from "time-constants";

export const BASE_URL = "https://api.hamsterkombat.io";

export const ERR = {
	UPGRADE_COOLDOWN: "UPGRADE_COOLDOWN",
	INSUFFICIENT_FUNDS: "INSUFFICIENT_FUNDS",
};

export const ENDPOINT = {
	SYNC: `${BASE_URL}/clicker/sync`,
	CONFIG: `${BASE_URL}/clicker/config`,
	TAP: `${BASE_URL}/clicker/tap`,
	CLAIM_CIPHER: `${BASE_URL}/clicker/claim-daily-cipher`,
	UPGRADE: `${BASE_URL}/clicker/buy-upgrade`,
	UPGRADES_FOR_BUY: `${BASE_URL}/clicker/upgrades-for-buy`,
};

export const SH_INTERVAL = {
	HAMSTER: {
		TAP: 20 * MINUTE,
		UPGRADES: 30 * MINUTE,
		CLAIM_DAILY_CIPHER: 1 * HOUR,
	},
	ENV: {
		AUTH_TOKEN: 30 * SECOND,
	},
};

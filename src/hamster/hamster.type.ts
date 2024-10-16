export interface HamsterUserData {
	balanceCoins: number;
	earnPerTap: number;
	maxTaps: number;
	earnPassivePerHour: number;
}

export interface UpgradeReqResponse {
	id: string;
	isAvailable: boolean;
	cooldownSeconds: number;
	isExpired: boolean;
	name: string;
	price: number;
	currentProfitPerHour: number;
	profitPerHour: number;
	profitPerHourDelta: number;
	section: string;
}

export interface Upgrade {
	id: string;
	isAvailable: boolean;
	cooldownSeconds: number;
	cooldownEnds: Date | null;
	isExpired: boolean;
	name: string;
	price: number;
	currentProfitPerHour: number;
	profitPerHour: number;
	profitPerHourDelta: number;
	section: string;
	ratio: number;
}

export interface DailyCipher {
	cipher: string;
	isClaimed: boolean;
	remainSeconds: number;
}

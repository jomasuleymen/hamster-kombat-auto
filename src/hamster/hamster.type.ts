export interface HamsterUserData {
	balanceCoins: number;
	earnPerTap: number;
	maxTaps: number;
	earnPassivePerHour: number;
}

export interface UpgradeResponse {
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

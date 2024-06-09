export const sleep = (ms: number) => {
	return new Promise((resolve) => setTimeout(resolve, ms));
};

export function addSecondsToDate(seconds: number): Date {
	const currentDate = new Date();
	const newDate = new Date(currentDate.getTime() + seconds * 1000);

	return newDate;
}

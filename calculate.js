function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function addTimeDuration(duration) {
	const [hours, minutes, seconds] = duration.split(":").map(Number);

	const currentDate = new Date();

	currentDate.setHours(currentDate.getHours() + hours);
	currentDate.setMinutes(currentDate.getMinutes() + minutes);
	currentDate.setSeconds(currentDate.getSeconds() + seconds);

	return currentDate;
}

function parseToDouble(value) {
	// Remove commas
	value = value.replace(/,/g, "");

	// Handle K, M, B suffixes
	const suffixes = {
		K: 1e3,
		M: 1e6,
		B: 1e9,
	};

	const match = value.match(/([-+]?[0-9]*\.?[0-9]+)([KMB]?)/i);
	if (match) {
		let number = parseFloat(match[1]);
		const suffix = match[2].toUpperCase();
		if (suffix in suffixes) {
			number *= suffixes[suffix];
		}
		return number;
	}

	// If no suffix, parse directly
	return parseFloat(value);
}

function getTabItems(document) {
	const tabsList = document.getElementsByClassName("tabs-list")[0];
	if (!tabsList) {
		console.log("Tabs list is not found");
		return [];
	}
	const tabItems = Array.from(tabsList.getElementsByClassName("tabs-item"));

	if (!tabItems || !tabItems.length) {
		console.log("tabItems list is null or empty");
		return;
	}

	return tabItems;
}

function getUpgradeItems(document, tabName = "unnamed-tab") {
	function getSpecialsItems(document) {
		const myCards = document.getElementsByClassName("tabs-special-inner")[0];
		return myCards.getElementsByClassName("upgrade-special");
	}

	let items = document.getElementsByClassName("upgrade-item");

	if (items.length == 0) {
		items = getSpecialsItems(document);
	}

	if (!items || !items.length) {
		console.log(`${tabName} items is null or empty`);
		return [];
	}

	return items;
}

function getBottomSheet() {
	return document.getElementsByClassName("bottom-sheet open")[0];
}

async function closeBottomSheet() {
	const closeButton = document.getElementsByClassName("bottom-sheet-close")[0];
	if (closeButton) {
		closeButton.click();

		await sleep(500);
	}
}

function getPricesFromBottomSheet(sheet) {
	let prices = sheet.getElementsByClassName("price-value");

	if (prices && prices.length >= 2) {
		const data = {};

		upgradeProfit = parseToDouble(prices[0].innerText);
		upgradePrice = parseToDouble(prices[1].innerText);

		const button = sheet.getElementsByClassName(
			"bottom-sheet-button button-large"
		)[0];

		if (!button) {
			return false;
		}

		if (button.innerText.includes(":")) {
			data.endUpgrading = addTimeDuration(button.innerText);
		} else if (button.innerText.toLowerCase().trim() !== "go ahead") {
			return false;
		}

		Object.assign(data, {
			profit: upgradeProfit,
			price: upgradePrice,
			proportion: upgradePrice / upgradeProfit,
		});

		return data;
	}

	return false;
}

async function getUpgradeItemInfo(document, tabName, upgradeItem) {
	if (upgradeItem.classList.contains("is-disabled")) {
		return;
	}

	upgradeItem.click();
	await sleep(500);

	const itemTitle =
		upgradeItem.getElementsByClassName("upgrade-item-title")[0] ||
		upgradeItem.getElementsByClassName("upgrade-special-title")[0];

	const itemName = itemTitle?.innerText;

	const sheet = getBottomSheet();
	if (!sheet) {
		console.log(`${tabName} -> ${itemName} is can't be opened`);
		return;
	}

	const pricesData = getPricesFromBottomSheet(sheet);

	if (!pricesData) {
		console.log(`${tabName} -> ${itemName} prices undefined`);
		return;
	}

	return {
		tab: tabName,
		item: itemName,
		...pricesData,
	};
}

async function getTabItemsInfo(document, tab) {
	const tabItemsInfo = [];

	tab.click();
	await sleep(250);

	const tabName = tab.innerText;
	const upgradeItems = getUpgradeItems(document, tabName);

	for (let [index, upgradeItem] of Object.entries(upgradeItems)) {
		const data = await getUpgradeItemInfo(document, tabName, upgradeItem);

		if (data) {
			data.itemIndex = Number(index);
			tabItemsInfo.push(data);
		}
	}

	return tabItemsInfo;
}

async function getItemsInfo(document) {
	const tabsItemsInfo = [];

	const tabs = getTabItems(document);

	for (let [index, tab] of Object.entries(tabs)) {
		const itemsInfo = await getTabItemsInfo(document, tab);
		itemsInfo.forEach(function (item) {
			item.tabIndex = Number(index);
		});

		tabsItemsInfo.push(...itemsInfo);
	}

	await closeBottomSheet();

	return tabsItemsInfo;
}

function getBalance(document) {
	const balanceText = document
		.getElementsByClassName("user-balance-large-inner")[0]
		.getElementsByTagName("p")[0].innerText;
	return parseToDouble(balanceText);
}

function sortItemsInfo(itemsInfo) {
	itemsInfo.sort((a, b) => a.proportion - b.proportion);
}

async function openTabByIndex(document, index) {
	const tabs = getTabItems(document);

	const tab = tabs[index];
	tab.click();

	await sleep(150);
}

async function openItemByIndex(document, index) {
	const upgradeItems = getUpgradeItems(document);

	const item = upgradeItems[index];
	item.click();

	let tryCount = 4;

	while (!getBottomSheet() && tryCount-- > 0) {
		await sleep(500);
		console.log("Opening bottom sheet...");
	}
}

async function upgradeItem(document, itemInfo) {
	console.log(`upgrading`);
	console.log(itemInfo);

	await openTabByIndex(document, itemInfo.tabIndex);
	await openItemByIndex(document, itemInfo.itemIndex);

	const button = document.getElementsByClassName("bottom-sheet-button")[0];

	if (button.innerText.includes(":")) {
		itemInfo.endUpgrading = addTimeDuration(button.innerText);
		await closeBottomSheet();
		return true;
	}

	if (button && button.innerText.toLowerCase().trim() === "go ahead") {
		button.click();
		await closeBottomSheet();

		await updateItemInfo(document, itemInfo);

		return true;
	}

	await closeBottomSheet();
	return false;
}

async function updateItemInfo(document, itemInfo) {
	await openTabByIndex(document, itemInfo.tabIndex);
	await openItemByIndex(document, itemInfo.itemIndex);

	const newPricesInfo = getPricesFromBottomSheet(getBottomSheet());
	if (newPricesInfo) {
		Object.assign(itemInfo, newPricesInfo);
	} else {
		itemInfo.proportion = 1000000000;
	}

	await closeBottomSheet();
}

function findItemForUpgrading(itemsInfo) {
	const balance = getBalance(document);
	sortItemsInfo(itemsInfo);

	const upgradeItemInfo = itemsInfo.find(function (item) {
		if (item.endUpgrading && item.endUpgrading > new Date()) return false;

		return balance >= item.price;
	});

	return upgradeItemInfo;
}

async function startUpgrading(document, itemsInfo) {
	while (true) {
		const upgradeItemInfo = findItemForUpgrading(itemsInfo);

		if (!upgradeItemInfo) {
			console.log("No items to upgrade");
			return;
		}

		await upgradeItem(document, upgradeItemInfo);

		await sleep(1000);
	}
}

const itemsInfo = await getItemsInfo(document);
// await startUpgrading(document, itemsInfo);

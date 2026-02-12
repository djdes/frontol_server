import {
	saveToFile,
	readFile,
	DbRequest,
	saveAllCols,
	isCardPayment,
} from "./tools";
global.fetch = require("node-fetch");
// import Firebird from "node-firebird";
// import fs from "fs";

// addColl();
// DbRequest(`SELECT rdb$get_context('SYSTEM', 'ENGINE_VERSION')
// from rdb$database;`)
// 	.then((res) => {
// 		console.log("res", res);
// 	});

const debug = false;

export interface Product {
	price: number;
	code: number;
	quantity: number;
	priceBase: number;
}
export interface Order {
	STATE: number | "cancelled";
	ID: number;
	CHEQUENUMBER: number;
	SUMM: number;
	SUMMWD: number;
	products: any[];
	isCardPayment: boolean;
	lastOrderUpdate: string;
}
const formatOrderDate = (doc: tables.RootObject): string => {
	try {
		const d = new Date(doc.CLOSEDATE);
		const t = new Date(doc.CLOSETIME);
		const year = d.getFullYear();
		const month = String(d.getMonth() + 1).padStart(2, "0");
		const day = String(d.getDate()).padStart(2, "0");
		const hours = String(t.getHours()).padStart(2, "0");
		const minutes = String(t.getMinutes()).padStart(2, "0");
		const seconds = String(t.getSeconds()).padStart(2, "0");
		return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
	} catch {
		return new Date().toLocaleString("sv-SE");
	}
};
const innerState = {
	eventListenerinProgress: false,
	checkOrdersUpdatesInProgress: false,
};

const clearEmptyOrders = (_orders: Order[]) => {
	return _orders.filter((x) => x.SUMM > 0);
};
const isOrderCancel = (_products: Product[]) => {
	return _products.every((x) => x.price < 0);
};
export const clearRemovedProducts = (_products: Product[]) => {
	// const removedProds = _products.filter((x) => x.price < 0);
	// let removerdProductsCount = removedProds.length;
	// console.log("order.products", order.products);
	// console.log("clearRemovedProducts removedProds", removedProds);
	// if (debug) saveToFile(`debug/removedProds`, removedProds);
	if (debug) saveToFile(`debug/clearRemovedProducts__products`, _products);

	// console.log("removedProds", -removedProds[0].price);
	const productsByCode: { [key: number]: Product[] } = {};
	_products.forEach((prod) => {
		if (!productsByCode[prod.code]) productsByCode[prod.code] = [];
		productsByCode[prod.code].push(prod);
	});

	const products: Product[] = [];

	Object.keys(productsByCode).forEach((key) => {
		const prods = productsByCode[parseInt(key)];

		const product = {
			code: prods[0].code,
			price: prods.reduce(
				(accumulator, prod) => accumulator + prod.price,
				0
			),
			priceBase: prods.reduce(
				(accumulator, prod) => accumulator + prod.priceBase,
				0
			),
			quantity: prods.reduce(
				(accumulator, prod) => accumulator + prod.quantity,
				0
			),
		};
		if (product.price > 0) {
			products.push(product);
		}
	});
	if (debug) saveToFile(`debug/clearRemovedProducts_products`, products);

	return products;
};

const prepareOrderData = async (_orders: Orders) => {
	const data: Order[] = [];
	const cancelledOrders: Order[] = [];
	for (let index = 0; index < _orders.length; index++) {
		const _order = _orders[index];
		if (isOrderCancel(_order.products)) {
			const id = _order.DOCUMENTID; //id of cancelled order
			// console.log("isOrderCancel", _order);
			const order = await getOrder(id);
			// console.log("cancelled order", order);
			if (!order) continue;
			cancelledOrders.push({
				STATE: "cancelled",
				ID: order.ID,
				SUMM: order.SUMM,
				SUMMWD: order.SUMMWD,
				products: order.products,
				isCardPayment: order.isCardPayment,
				CHEQUENUMBER: order.CHEQUENUMBER,
				lastOrderUpdate: formatOrderDate(order),
			});
			continue;
		}

		let products: Product[] = [];

		let needRemove = false;
		_order.products.forEach((prod: Product) => {
			if (prod.price < 0) {
				needRemove = true;
			}
		});
		// if (_order.CHEQUENUMBER == 7528) {
		// 	console.log(
		// 		"prepareOrderData _order.CHEQUENUMBER == 7528 products before",
		// 		_order.products
		// 	);
		// }
		if (needRemove) {
			products = clearRemovedProducts(_order.products);
		} else {
			products = _order.products;
		}
		// if (_order.CHEQUENUMBER == 7528) {
		// 	console.log(
		// 		"prepareOrderData _order.CHEQUENUMBER == 7528 products after clearRemovedProducts",
		// 		products
		// 	);
		// }

		data.push({
			STATE: _order.STATE,
			ID: _order.ID,
			SUMM: _order.SUMM,
			SUMMWD: _order.SUMMWD,
			products: products,
			isCardPayment: _order.isCardPayment,
			CHEQUENUMBER: _order.CHEQUENUMBER,
			lastOrderUpdate: formatOrderDate(_order),
		});
	} //end for

	// _item;
	const _data = clearEmptyOrders(data);
	return [..._data, ...cancelledOrders];
};

export const getOrder = async (id: number) => {
	const orders: tables.RootObject[] = (await DbRequest(
		`SELECT * FROM DOCUMENT WHERE id = '${id}'`
	)) as tables.RootObject[];
	if (!orders.length) {
		return false;
	}
	if (debug) console.log("getOrder id order", id, orders[0]);
	// saveToFile("debug/orders_selected", orders);
	return orders[0];
};

export const getOrdersSinceId = async (lastId: number) => {
	const orders: any = await DbRequest(
		`SELECT first 10000 * FROM DOCUMENT WHERE STATE = 1 AND ID > ${lastId} ORDER BY ID`
	);
	if (orders?.length > 0) {
		console.log(`>>> Найдено ${orders.length} новых заказов (lastId: ${lastId})`);
	}
	return orders;
};

const sendToSite = async (_data: Orders) => {
	if (debug) saveToFile(`debug/data`, _data);
	const data = await prepareOrderData(_data);
	console.log("sendToSite", data.length);
	const config: any = await readFile("config");

	const cancelled = data.filter((x) => x.STATE === "cancelled");
	if (cancelled.length > 0) {
		console.log("sendToSite отмены:", cancelled.length);
	}

	const res = await fetch(`https://admin.magday.ru/frontol/order.php`, {
		method: "post",
		body: JSON.stringify({ orders: data, userId: config.userId }),
	});
	if (!res.ok) {
		throw new Error(`HTTP ${res.status}: ${res.statusText}`);
	}
	console.log(`<<< Отправлено ${data.length} заказов, HTTP ${res.status}`);
	return res;
};
const getState = async (): Promise<{ lastId: number }> => {
	let state: any = await readFile("state");

	// Valid new format
	if (!state.error && (state.lastId || state.lastId === 0)) {
		return state;
	}

	// Try backup
	const stateBackup: any = await readFile("stateBackup");
	if (!stateBackup.error && (stateBackup.lastId || stateBackup.lastId === 0)) {
		await saveToFile("state", stateBackup);
		console.log("Восстановлено из бэкапа, lastId:", stateBackup.lastId);
		return stateBackup;
	}

	// Migration from old timestamp format or fresh start
	// Get current max ID to avoid reprocessing all historical orders
	try {
		const result: any = await DbRequest(
			`SELECT MAX(ID) as MAX_ID FROM DOCUMENT WHERE STATE = 1`
		);
		const maxId = result?.[0]?.MAX_ID || 0;
		console.log(`State migration: setting lastId to current max ID: ${maxId}`);
		const newState = { lastId: maxId };
		await saveToFile("state", newState);
		await saveToFile("stateBackup", newState);
		return newState;
	} catch (err) {
		console.error("Failed to query max ID for migration, starting from 0:", err);
		const newState = { lastId: 0 };
		await saveToFile("state", newState);
		return newState;
	}
};

const checkOrdersUpdatesOnce = async (): Promise<{ orders: Orders; maxId: number } | false> => {
	if (innerState.checkOrdersUpdatesInProgress) return false;
	innerState.checkOrdersUpdatesInProgress = true;
	try {
		const res = await checkOrdersUpdates();
		return res;
	} finally {
		innerState.checkOrdersUpdatesInProgress = false;
	}
};
const checkOrdersUpdates = async () => {
	const state = await getState();
	const lastId = state.lastId;

	const orders = (await getOrdersSinceId(lastId)) as
		| Array<tables.RootObject>
		| false;
	if (orders === false) return;
	if (orders.length > 0) {
		for (let i = 0; i < orders.length; i++) {
			console.log("eventListener order", orders[i].CHEQUENUMBER, "ID:", orders[i].ID);
			orders[i].products = await getProductsByOrderId(orders[i].ID);
			orders[i].isCardPayment = await isCardPayment(orders[i].ID);
		}

		const _orders: Orders = [];
		orders.forEach((_order) => {
			if (_order.products.length > 0) {
				_orders.push(_order);
			}
		});

		if (debug) await saveToFile("debug/orders", orders);
		if (_orders.length > 0) {
			return { orders: _orders, maxId: Math.max(...orders.map((o) => o.ID)) };
		}
	}
	return false;
};
const eventListener = async () => {
	setInterval(async () => {
		if (innerState.eventListenerinProgress) return;
		if (innerState.checkOrdersUpdatesInProgress) return;
		try {
			const result = await checkOrdersUpdatesOnce();
			if (!result) return;
			const { orders: changed_orders, maxId } = result as { orders: Orders; maxId: number };
			innerState.eventListenerinProgress = true;
			const step = 50;
			for (
				let index = 0;
				index < changed_orders.length;
				index = index + step
			) {
				console.log(
					`eventListener sendToSite ${index} of ${
						changed_orders.length > index + step
							? index + step
							: changed_orders.length
					} / ${changed_orders.length}`
				);
				await sendToSite(
					changed_orders.slice(index, index + step)
				);
			}
			// Сохраняем state ТОЛЬКО после успешной отправки всех заказов
			await saveToFile("state", { lastId: maxId });
			setTimeout(() => {
				saveToFile("stateBackup", { lastId: maxId });
			}, 10000);
		} catch (err: any) {
			console.error("Ошибка цикла:", err?.message || err);
			// state НЕ сохраняется — заказы будут повторно отправлены
		} finally {
			innerState.eventListenerinProgress = false;
		}
	}, 10000);
};
const main = () => {
	process.on("unhandledRejection", (err) => {
		console.error("Unhandled rejection:", err);
	});
	process.on("uncaughtException", (err) => {
		console.error("Uncaught exception:", err);
	});
	console.log(`version:1.9.1`);
	eventListener();
};
main();
const getProductByCode = async (code: number) => {
	const product = await DbRequest(`SELECT * FROM SPRT WHERE CODE = ${code}`);
	if (Array.isArray(product)) {
		return product[0];
	} else {
		return [];
	}
};

const getProductsByOrderId = async (orderId: number) => {
	// console.log(`getProductsByOrderId orderId`, orderId);
	const tranzt = await DbRequest(
		`SELECT * FROM TRANZT WHERE DOCUMENTID = ${orderId}`
	);
	let products: any = [];
	//@ts-ignore
	// console.log("tranzt.length" , tranzt.length);
	if (debug) await saveToFile(`debug/getProductsByOrderId_tranzt`, tranzt);

	//@ts-ignore
	for (let i = 0; i < tranzt.length; i++) {
		//@ts-ignore
		let item = tranzt[i];
		// console.log("tranzt item" , item);
		if (
			item.WARECODE > 0 &&
			item.SUMM &&
			item.QUANTITY &&
			item.TRANZTYPE !== 17 &&
			item.TRANZTYPE !== 87 &&
			item.TRANZTYPE !== 37
		) {
			// let product = await getProductByCode(item.WARECODE);
			let product = {
				priceBase: item.SUMM,
				price: item.SUMMWD,
				code: item.WARECODE,
				quantity: item.QUANTITY,
				// test: item,
			};
			products.push(product);
		}
	}
	if (debug)
		await saveToFile(`debug/getProductsByOrderId_products`, products);

	return products;

	// const getProductCodeFromTranzt = (tranzt: any) => {
	// 	let code;
	// 	tranzt.forEach((element: any) => {
	// 		if (element.WARECODE > 0) {
	// 			code = element.WARECODE;
	// 		}
	// 	});
	// 	return code;
	// };
	// const getProductPriceFromTranzt = (tranzt: any) => {
	// 	let price;
	// 	tranzt.forEach((element: any) => {
	// 		if (element.WARECODE > 0 && element.SUMM) {
	// 			price = element.SUMM;
	// 		}
	// 	});
	// 	return price;
	// };
	// const productCode = getProductCodeFromTranzt(tranzt);
	// if (productCode) {
	// 	console.log("productCode", productCode);
	// 	const product = await getProductByCode(productCode);
	// 	if (product) {
	// 		const productPrice = await getProductPriceFromTranzt(tranzt);
	// 		product.price = 0;
	// 		if (productPrice) {
	// 			product.price = productPrice;
	// 		}
	// 		saveToFile("product", product);
	// 		return [product];
	// 	} else {
	// 		console.log("error - product not found");
	// 	}
	// } else {
	// 	console.log("error - productCode not found");
	// }
};

// saveAllCols();

// SPRT - products
// DOCUMENT - orders

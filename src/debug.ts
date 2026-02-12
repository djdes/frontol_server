import {
	Order,
	Product,
	clearRemovedProducts,
	getOrdersSinceId,
} from "./index";
import {
	readFile,
	saveToFile,
	saveAllCols,
	DbRequest,
	isCardPayment,
} from "./tools";

// saveAllCols();

(async () => {
	// const orders = await getOrdersFromDate("2022-07-22 18:01:05.1180");
	// console.log("orders", orders);
	// saveToFile("orders", orders);
	// const TRANZT = await readFile("debug/dbcol/TRANZT");
	// const DOCUMENT = await readFile("debug/dbcol/DOCUMENT");
	// // const TRAUTH = await readFile("debug/dbcol/TRAUTH");
	// // 309202
	// // 25851
	// const items1 = DOCUMENT.filter((x: any) => x.ID === 309202);
	// const items2 = TRANZT.filter((x: any) => x.DOCUMENTID === 309202);
	// // const items1 = TRAUTH.filter((x: any) => x.DOCUMENTID === 308703);
	// // const items2 = TRAUTH.filter((x: any) => x.DOCUMENTID === 308711);
	// // const items = TRANZT.filter((x: any) => x.SUMM === 158);
	// console.log("items1", items1?.length);
	// console.log("items2", items2?.length);
	// // console.log("items2", items2?.length);
	// saveToFile("debug/DOCUMENT_items", items1);
	// saveToFile("debug/TRANZT_items", items2);
	// saveToFile("debug/products", products);
	// saveToFile("debug/TRAUTH_items", items1);
	// saveToFile("debug/TRAUTH_items2", items2);
	// const test1 = await isCardPayment(308703);
	// const test2 = await isCardPayment(308711);
	// console.log("test1 308703", test1);
	// console.log("test2 308711", test2);
	//
})();

// export const debugOrder = async (orders: Order[]) => {
// 	orders.forEach((order) => {
// 		if (order.products.length === 0) {
// 			console.log(order);
// 		}

// 		let needRemove = false;
// 		order.products.forEach((prod) => {
// 			if (prod.price < 0) {
// 				needRemove = true;
// 			}
// 		});
// 		if (needRemove) {
// 			order.products = clearRemovedProducts(order.products);
// 		}
// 		// console.log("order.products", order.products);
// 	});
// 	saveToFile("clearedData", orders);
// };
// (async () => {
// 	// @ts-ignore
// 	const orders: Order[] = await readFile("newData");
// 	console.log("debug orders", orders.length);
// 	debugOrder(orders);
// })();

// import { sendEmail } from "./tools";
// sendEmail().catch(console.error);

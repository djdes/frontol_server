// const fs = require("fs").promises;
import * as fs from "fs";
import * as nodemailer from "nodemailer";

// import * as Firebird from 'node-firebird';
const Firebird = require("node-firebird");

const options: any = {};
// options.host = "127.0.0.1";
options.host = "localhost";
options.port = 3050;
// options.database = "database.fdb";
options.database = "D:\\FRONTOL_DB\\MAIN.GDB"; //DB - DB-FRONTOL MAIN.GDB
options.user = "SYSDBA";
options.password = "masterkey";
options.lowercase_keys = false; // set to true to lowercase keys
options.role = null; // default
options.pageSize = 4096; // default when creating database
// options.pageSize = 10; // default when creating database

export const DbRequest = async (query: string) => {
	const config: any = await readFile("config");
	if (config.database) {
		options.database = config.database;
	}
	return new Promise((resolve, reject) => {
		Firebird.attach(options, function (err: any, db: any) {
			// console.log("existsSync", fs.existsSync(options.database));
			// if (fs.existsSync(options.database)) {
			// }
			if (err) {
				console.log("err", err);
				reject(err);
			}
			// console.log("db", db);
			try {
				db.query(query, function (err: any, result: any) {
					// db.query(`SELECT * FROM SPRT`, function (err, result) {
					if (err) {
						console.log("err", err);
						reject(err);
					}
					resolve(result);
					db.detach();
				});
			} catch (err) {
				console.log("err", err);
				reject(err);
			}
		});
	});
};
//
export const saveToFile = async (name: string, obg: any) => {
	const data = JSON.stringify(obg);
	// console.log("saveToFile", name, data, obg.lastTimeUpdate);
	try {
		await fs.writeFile(`${name}.json`, data, null, () => {});
	} catch (error) {
		console.error(
			`Got an error trying to write to a file: ${error.message}`
		);
		await fs.unlink(`${name}.json`, function (err: any) {
			if (err) throw err;
		});
		await fs.appendFile(`${name}.json`, data, function (err) {
			if (err) throw err;
		});
	}
};
export const safeJsonParse = async (data: any) => {
	try {
		const _data = JSON.parse(data);
		if (_data) {
			return _data;
		}
	} catch (err) {
		// console.log("safeJsonParse err", err);
		return null;
	}
	return null;
};
const readFileSync = async (name: string) => {
	return new Promise((resolve, reject) => {
		fs.readFile(`${name}.json`, "utf8", (err: any, data: any) => {
			if (err) {
				reject({ error: err });
			}
			resolve(data);
		});
	});
};
export const readFile = async (name: string) => {
	const data = await readFileSync(name).catch((err) => {
		return { error: err };
	});
	const _data = await safeJsonParse(data).catch((err) => {
		return { error: err };
	});
	// console.log("_data", name, _data);
	if (_data) {
		// console.log("_data resolve", name, _data);
		return _data;
	} else {
		// console.log("_data reject", "err");
		return { error: "err" };
	}
};

export const getAllCols = async () => {
	return new Promise((resolve, reject) => {
		Firebird.attach(options, function (err: any, db: any) {
			if (err) throw err;
			db.query(
				"SELECT a.RDB$RELATION_NAME FROM RDB$RELATIONS a WHERE COALESCE(RDB$SYSTEM_FLAG, 0) = 0 AND RDB$RELATION_TYPE = 0",
				function (err: any, result: any) {
					if (err) {
						reject(err);
						console.log("err", err);
					}
					const res: any = [];
					result.forEach((item: any) => {
						res.push(item["RDB$RELATION_NAME"].replace(/ /g, ""));
					});
					resolve(res);
					db.detach();
				}
			);
		});
	});
};
export const saveAllCols = async () => {
	const cols = await getAllCols();
	console.log("cols", cols);
	//@ts-ignore
	cols.filter(
		(col: string) =>
			col !== "PRINTFORM" &&
			col !== "GIFTCARDCOUNTER" &&
			col !== "COUPONTYPE" &&
			col !== "AIGS1" &&
			col !== "FMSYNCSTATE" &&
			col !== "TRANZTEXCISESTAMP" &&
			col !== "SERVICEDATA" &&
			col !== "OFDAGENTREQUISITES"
	).forEach(async (colName: any) => {
		console.log("colName_", colName);
		const resCount = await DbRequest(
			`SELECT count(*) FROM ${colName}`
		).catch((err) => {
			console.log("resCount err", err);
			return null;
		});
		console.log("resCount", resCount);
		if (!resCount) return;
		//@ts-ignore
		const count = resCount[0].COUNT;
		// const skip = count > 10 ? count - 10 : 0;
		const skip = 0;
		console.log(`count ${colName}`, count);
		// console.log(`count ${colName}`, resCount);

		try {
			Firebird.attach(options, function (err: any, db: any) {
				if (err) {
					console.log("err", err);
					return;
				}
				try {
					db.query(
						`SELECT skip ${skip} * FROM ${colName}`,
						function (err: any, result: any) {
							if (err) {
								console.log("err", err);
							}
							// console.log("result 123", result);
							if (result.length > 0) {
								fs.writeFile(
									`debug/dbcol/${colName}.json`,
									JSON.stringify(result, null, 2),
									null,
									() => {}
								);
							}
							db.detach();
						}
					);
				} catch (err) {
					console.log("db.query err", err);
				}
			});
		} catch (err) {
			console.log("err", err);
		}
	});
};
export const isCardPayment = async (id: number) => {
	const items = await DbRequest(
		`SELECT * FROM TRAUTH WHERE DOCUMENTID = ${id}`
	);
	// console.log("isCardPayment items", items);
	if (Array.isArray(items) && items?.length > 0) {
		return true;
	}
	return false;
};

export async function sendEmail() {
	// Generate test SMTP service account from ethereal.email
	// Only needed if you don't have a real mail account for testing
	// let testAccount = await nodemailer.createTestAccount();

	// create reusable transporter object using the default SMTP transport
	let transporter = nodemailer.createTransport({
		host: "smtp.mail.ru",
		port: 465,
		secure: true, // true for 465, false for other ports
		auth: {
			user: "r12lb3gb@inbox.ru", // generated ethereal user
			pass: "Hxld1wstmI", // generated ethereal password
		},
	});

	// send mail with defined transport object
	let info = await transporter.sendMail({
		from: '"Fred Foo 👻" <r12lb3gb@inbox.ru>', // sender address
		to: "webvladkorn@gmail.com", // list of receivers
		subject: "Hello ✔", // Subject line
		text: "Hello world?", // plain text body
		html: "<b>Hello world?</b>", // html body
	});

	console.log("Message sent: %s", info.messageId);
	// Message sent: <b658f8ca-6296-ccf4-8306-87d57a0b4321@example.com>

	// Preview only available when sending through an Ethereal account
	// console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
	// Preview URL: https://ethereal.email/message/WaQKMgKddxQDoou...
}

// let s = new SMTPClient({
// 	host: "smtp.mail.ru",
// 	port: 25,

// 	// 465
// });
// export const sendEmail = () => {
// 	(async function () {
// 		await s.connect();
// 		await s.greet({ hostname: "r12lb3gb@inbox.ru" }); // runs EHLO command or HELO as a fallback
// 		await s.authPlain({ username: "test", password: "Hxld1wstmI" }); // authenticates a user
// 		await s.mail({ from: "from@test.com" }); // runs MAIL FROM command
// 		await s.rcpt({ to: "webvladkorn@gmail.com" }); // runs RCPT TO command (run this multiple times to add more recii)
// 		await s.data("mail source"); // runs DATA command and streams email source
// 		await s.quit(); // runs QUIT command
// 	})().catch(console.error);
// };

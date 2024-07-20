import winston from "winston";

class ActionFilterTransport extends winston.transports.File {
	log(info: any, next: () => void) {
		if (info.message && info.message.action && super.log) {
			super.log(info, next);
		} else {
			next();
		}
	}
}

export const logger = winston.createLogger({
	level: "info",
	format: winston.format.combine(
		winston.format.timestamp({
			format: () => new Date().toString(),
		}),
		winston.format.json({ space: 2 })
	),
	rejectionHandlers: false,
	exitOnError: false,
	transports: [
		new winston.transports.File({
			dirname: "logs",
			filename: "info.log",
			level: "info",
			
		}),
		new winston.transports.File({
			dirname: "logs",
			filename: "error.log",
			level: "error",
		}),
		new ActionFilterTransport({
			dirname: "logs",
			filename: "action.log",
			level: "info",
		}),
	],
});

// if (process.env.NODE_ENV !== "production") {
// 	logger.add(
// 		new winston.transports.Console({
// 			format: winston.format.simple(),
// 		})
// 	);
// }

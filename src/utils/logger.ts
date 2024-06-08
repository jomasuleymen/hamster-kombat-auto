import winston from "winston";

export const logger = winston.createLogger({
	level: "info",
	format: winston.format.combine(
		winston.format.timestamp(),
		winston.format.json()
	),
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
	],
});

// if (process.env.NODE_ENV !== "production") {
// 	logger.add(
// 		new winston.transports.Console({
// 			format: winston.format.simple(),
// 		})
// 	);
// }

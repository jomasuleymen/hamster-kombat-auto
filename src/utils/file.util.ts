import { writeFile } from "fs";
import path from "path";
import { logger } from "./logger";

export function writeObjectToFile(data: Object, fileName: string) {
	writeFile(
		path.resolve(`logs/${fileName}`),
		JSON.stringify(data, null, 2),
		(err) => {
			if (err) {
				logger.error({
					source: writeObjectToFile,
					message: err.message,
				});
			}
		}
	);
}

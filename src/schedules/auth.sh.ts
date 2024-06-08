import dotenv from 'dotenv';
import hamsterAxios from 'src/utils/axios.instance';
import { SimpleIntervalJob, Task } from 'toad-scheduler';

function updateAuthToken() {
	dotenv.config({ override: true });
	hamsterAxios.defaults.headers.common.Authorization =
		`Bearer ${process.env.AUTH_TOKEN}`
}

export function updateAuthTokenJob() {
	const task = new Task('update auth token', updateAuthToken)
	const job = new SimpleIntervalJob({ seconds: 30, runImmediately: true }, task)

	return job;
}
import axios from "axios";
import { BASE_URL } from "src/constants/hamster-api.constant";

const hamsterAxios = axios.create({
	baseURL: BASE_URL,
	timeout: 5_000,
	headers: {
		"Content-Type": "application/json",
		Host: "api.hamsterkombat.io",
		Origin: "api.hamsterkombat.io",
		Referer: "api.hamsterkombat.io/",
		Authorization:
			"Bearer 1717845496957fBWwXpBwt6GsQnHLf3CukEqrTfYPtE8Y12Km0X13B2PHLFLrr3gNgPZg9eY1kB1I989152898",
		"User-Agent":
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
	}
});

hamsterAxios.interceptors.response.use((response) => response, (error) => {
	if (error.response?.data) {
		console.log(error.response.data);
	}

	return Promise.reject(error);
});

export default hamsterAxios;
export const config = {
	appName: "My Quark App",
	environment: process.env.NODE_ENV || "development",
	api: {
		baseUrl: process.env.API_BASE_URL || "http://localhost:3000",
	},
	database: {
		url:
			process.env.DATABASE_URL ||
			"postgresql://user:password@localhost:5432/myapp",
	},
	redis: {
		url: process.env.REDIS_URL || "redis://localhost:6379",
	},
	email: {
		from: process.env.EMAIL_FROM || "noreply@myquarkapp.com",
		provider: process.env.EMAIL_PROVIDER || "mailhog",
	},
};

export default config;

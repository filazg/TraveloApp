const fs = require("fs/promises");
const path = require("path");

const APP_ENV = process.env.APP_ENV || "local";

const resolvePath = (baseName) => {
    const envFile = path.resolve(process.cwd(), `config/${baseName}.${APP_ENV}.json`);
    const fallback = path.resolve(process.cwd(), `config/${baseName}.json`);
    return { envFile, fallback };
};

const readConfig = async (baseName) => {
    const { envFile, fallback } = resolvePath(baseName);
    try {
        const raw = await fs.readFile(envFile, "utf-8");
        return JSON.parse(raw);
    } catch (e) {
        if (e.code !== "ENOENT") throw e;
        const raw = await fs.readFile(fallback, "utf-8");
        return JSON.parse(raw);
    }
};

const getActiveEnv = () => APP_ENV;

module.exports = { readConfig, getActiveEnv };

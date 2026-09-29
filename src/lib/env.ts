import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().default("postgresql://postgres:postgrespassword@localhost:5432/smart_health"),
  ML_SERVICE_URL: z.string().url().default("http://localhost:8000"),
  GEMINI_API_KEY: z.string().optional().default(""),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type Env = z.infer<typeof envSchema>;

let parsedEnv: Env;

try {
  parsedEnv = envSchema.parse({
    DATABASE_URL: process.env.DATABASE_URL,
    ML_SERVICE_URL: process.env.ML_SERVICE_URL,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
    NODE_ENV: process.env.NODE_ENV,
  });
} catch (error) {
  if (process.env.NODE_ENV !== "production") {
    console.warn("⚠️ Environment validation warning, falling back to defaults:", error);
  }
  parsedEnv = envSchema.parse({});
}

export const env = parsedEnv;

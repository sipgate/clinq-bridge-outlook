import { config as dotenvConfig } from "dotenv";

dotenvConfig();

const APP_ID = process.env.APP_ID;
const APP_PASSWORD = process.env.APP_PASSWORD;
const APP_SCOPES = process.env.APP_SCOPES;
const REDIRECT_URI = process.env.REDIRECT_URI;
const OAUTH_IDENTIFIER = process.env.OAUTH_IDENTIFIER;

if (!APP_ID) {
  throw new Error("Missing APP_ID in environment");
}
if (!APP_PASSWORD) {
  throw new Error("Missing APP_PASSWORD in environment");
}
if (!APP_SCOPES) {
  throw new Error("Missing APP_SCOPES in environment");
}
if (!REDIRECT_URI) {
  throw new Error("Missing REDIRECT_URI in environment");
}
if (!OAUTH_IDENTIFIER) {
  throw new Error("Missing OAUTH_IDENTIFIER in environment");
}

export const env = {
  APP_ID,
  APP_PASSWORD,
  APP_SCOPES,
  REDIRECT_URI,
  OAUTH_IDENTIFIER,
};

import { Adapter, Config, Contact, PhoneNumberLabel } from "@clinq/bridge";
import { Client } from "@microsoft/microsoft-graph-client";
import { Request } from "express";
import { parseEnvironment } from "./config";
import { OutlookContact } from "./model";

const { APP_ID, APP_PASSWORD, APP_SCOPES, REDIRECT_URI } = parseEnvironment();

const credentials = {
	client: {
		id: APP_ID,
		secret: APP_PASSWORD
	},
	auth: {
		tokenHost: "https://login.microsoftonline.com",
		authorizePath: "common/oauth2/v2.0/authorize",
		tokenPath: "common/oauth2/v2.0/token"
	}
};

export class OutlookAdapter implements Adapter {
	public async getContacts(config: Config): Promise<Contact[]> {
		const client = Client.init({
			authProvider: done => {
				done(null, config.apiKey.split(":")[0]);
			}
		});

		const outlookContacts = await client
			.api("/me/contacts")
			.select("id,givenName,surname,emailAddresses,companyName,displayName,businessPhones,homePhones,mobilePhone")
			.orderby("givenName ASC")
			.get();

		return outlookContacts ? this.toClinqContact(outlookContacts.value) : [];
	}

	public async getOAuth2RedirectUrl(): Promise<string> {
		const host = credentials.auth.tokenHost;
		const path = credentials.auth.authorizePath;
		const scopes = APP_SCOPES.split(" ").join("+");
		const callbackUri = encodeURI(REDIRECT_URI);
		return `${host}/${path}?redirect_uri=${callbackUri}&scope=${scopes}&response_type=code&client_id=${APP_ID}`;
	}

	public async handleOAuth2Callback(req: Request): Promise<Config> {
		const { code } = req.query;

		const oauth2Client = require("simple-oauth2").create(credentials);

		const result = await oauth2Client.authorizationCode.getToken({
			client_id: APP_ID,
			client_secret: APP_PASSWORD,
			code,
			redirect_uri: REDIRECT_URI,
			scope: APP_SCOPES
		});

		const { access_token: accessToken, id_token: idToken } = oauth2Client.accessToken.create(result).token;

		const config = {
			apiKey: `${accessToken}:`,
			apiUrl: ""
		};

		return config;
	}

	private toClinqContact(contacts: OutlookContact[]): Contact[] {
		return contacts.map(contact => {
			const email = contact.emailAddresses.find(Boolean);
			return {
				id: contact.id,
				name: contact.displayName,
				firstName: contact.givenName,
				lastName: contact.surname,
				email: email ? email.address : null,
				organization: contact.companyName,
				phoneNumbers: [
					...contact.homePhones.map(phoneNumber => ({
						label: PhoneNumberLabel.HOME,
						phoneNumber
					})),
					...contact.businessPhones.map(phoneNumber => ({
						label: PhoneNumberLabel.WORK,
						phoneNumber
					})),
					...(contact.mobilePhone
						? [
								{
									label: PhoneNumberLabel.MOBILE,
									phoneNumber: contact.mobilePhone
								}
						  ]
						: [])
				],
				contactUrl: "",
				avatarUrl: ""
			};
		});
	}
}

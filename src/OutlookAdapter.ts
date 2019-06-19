import { Adapter, Config, Contact, PhoneNumberLabel } from "@clinq/bridge";
import { Client } from "@microsoft/microsoft-graph-client";
import { Request } from "express";
import { create } from "simple-oauth2";
import { env } from "./env";
import { OutlookContact } from "./model";
import jwtDecode from "jwt-decode"

const { APP_ID, APP_PASSWORD, APP_SCOPES, REDIRECT_URI } = env;

const TEN_MINUTES = 600;

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

const refreshAccessToken = async (refreshToken: string) => {
	const {
		token: { access_token }
	} = await create(credentials)
		.accessToken.create({
			refresh_token: refreshToken
		})
		.refresh();

	return access_token;
}

const getClient = (config: Config) => {
	const [accessToken, refreshToken] = config.apiKey.split(":");

	return Client.init({
		authProvider: async done => {

			const { exp } = jwtDecode(accessToken);
			const now = Math.round(new Date().getTime() / 1000);
			const expired = (now - TEN_MINUTES) > exp

			done(null, expired ? await refreshAccessToken(refreshToken) : accessToken);
		}
	});
};

export class OutlookAdapter implements Adapter {
	public async getContacts(config: Config): Promise<Contact[]> {
		const client = getClient(config);

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

		const oauth2Client = create(credentials);

		const result = await oauth2Client.authorizationCode.getToken({
			code,
			redirect_uri: REDIRECT_URI
		});

		const {
			token: { access_token, refresh_token }
		} = oauth2Client.accessToken.create(result);

		return {
			apiKey: `${access_token}:${refresh_token}`,
			apiUrl: ""
		};
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

import {Adapter, Config, Contact, PhoneNumberLabel} from "@clinq/bridge";
import {Request} from "express";
import {OutlookContact} from "./model";


const credentials = {
	client: {
		id: process.env.APP_ID,
		secret: process.env.APP_PASSWORD,
	},
	auth: {
		tokenHost: 'https://login.microsoftonline.com',
		authorizePath: 'common/oauth2/v2.0/authorize',
		tokenPath: 'common/oauth2/v2.0/token'
	}
};

const jwtDecode = require('jwt-decode');

export class OutlookAdapter implements Adapter {

	private toClinqContact(contacts: OutlookContact[]): Contact[] {
		return contacts.map(contact => ({
			id: contact.id,
			name: contact.displayName,
			firstName: contact.givenName,
			lastName: contact.surname,
			email: contact.emailAddresses.find(i => true).address,
			organization: contact.companyName,
			phoneNumbers: [
				...contact.homePhones.map(phoneNumber => ({
					label: PhoneNumberLabel.HOME,
					phoneNumber: phoneNumber
				})),
				...contact.businessPhones.map(phoneNumber => ({
					label: PhoneNumberLabel.WORK,
					phoneNumber: phoneNumber
				})),
				...contact.mobilePhone ? ([{
					label: PhoneNumberLabel.MOBILE,
					phoneNumber: contact.mobilePhone
				}]) : []
			],
			contactUrl: "",
			avatarUrl: ""
		}));
	}

	public async getContacts(config: Config): Promise<Contact[]> {

		const graph = require('@microsoft/microsoft-graph-client');

		const [accessToken, refreshToken] = config.apiKey.split(":");

		// check access token validity

		const client = graph.Client.init({
			authProvider: (done) => {
				done(null, accessToken);
			}
		});

		const outlookContacts = await client
		.api('/me/contacts')
		.select('id,givenName,surname,emailAddresses,companyName,displayName,businessPhones,homePhones,mobilePhone')
		.orderby('givenName ASC')
		.get();

		return outlookContacts ? this.toClinqContact(outlookContacts.value) : [];
	}

	public async getOAuth2RedirectUrl(): Promise<string> {
		const host = credentials.auth.tokenHost;
		const path = credentials.auth.authorizePath;
		const scopes = process.env.APP_SCOPES.split(" ").join("+");
		const callbackUri = encodeURI(process.env.REDIRECT_URI);
		const appId = process.env.APP_ID;
		return `${host}/${path}?redirect_uri=${callbackUri}&scope=${scopes}&response_type=code&client_id=${appId}`;
	};

	public async handleOAuth2Callback(req: Request): Promise<Config> {

		const {code} = req.query;

		const oauth2Client = require('simple-oauth2').create(credentials);

		const result = await oauth2Client.authorizationCode.getToken({
			client_id: process.env.APP_ID,
			client_secret: process.env.APP_PASSWORD,
			code: code,
			redirect_uri: process.env.REDIRECT_URI,
			scope: process.env.APP_SCOPES
		});

		const {access_token: accessToken, refresh_token: refreshToken} = oauth2Client.accessToken.create(result).token;

		const {exp}  = jwtDecode(accessToken);
		const now = Math.round(new Date().getTime() / 1000);

		if ((now - exp) < 215400) {
			const newToken = await oauth2Client.accessToken.create({refresh_token: refreshToken}).refresh();
		}

		const config = {
			apiKey: `${accessToken}:${refreshToken}`,
			apiUrl: "",
		};

		return config;
	};
}

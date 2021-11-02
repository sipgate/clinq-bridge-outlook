import {
  Adapter,
  ClinqBetaEnvironment,
  Config,
  Contact,
  ContactTemplate,
  ContactUpdate,
  OAuthURLConfig,
  PhoneNumberLabel,
  ServerError,
} from "@clinq/bridge";
import { Client } from "@microsoft/microsoft-graph-client";
import { Request } from "express";
import { create } from "simple-oauth2";
import { env } from "./env";
import { OutlookContact, OutlookContactTemplate } from "./model";

const { APP_ID, APP_PASSWORD, APP_SCOPES, REDIRECT_URI } = env;

const PAGE_SIZE = 100;

const credentials = {
  client: {
    id: APP_ID,
    secret: APP_PASSWORD,
  },
  auth: {
    tokenHost: "https://login.microsoftonline.com",
    authorizePath: "common/oauth2/v2.0/authorize",
    tokenPath: "common/oauth2/v2.0/token",
  },
};

const refreshAccessToken = async (refreshToken: string) => {
  const {
    token: { access_token },
  } = await create(credentials)
    .accessToken.create({
      refresh_token: refreshToken,
    })
    .refresh();

  return access_token;
};

const getClient = (config: Config) => {
  const [, refreshToken] = config.apiKey.split(":");

  return Client.init({
    authProvider: async (done) => {
      try {
        const token = await refreshAccessToken(refreshToken);
        done(null, token);
      } catch (error) {
        done(error, null);
      }
    },
  });
};

export class OutlookAdapter implements Adapter {
  public async getContactsPage(
    client: Client,
    contacts: any[] = []
  ): Promise<Contact[]> {
    console.log("fetching next page");

    const response = await client
      .api("/me/contacts")
      .skip(contacts.length)
      .top(PAGE_SIZE)
      .select(
        "id,givenName,surname,emailAddresses,companyName,displayName,businessPhones,homePhones,mobilePhone"
      )
      .orderby("givenName ASC")
      .get();

    const merged = response ? [...response.value, ...contacts] : contacts;

    console.log(
      `fetched ${response.value.length} contacts - got total of ${merged.length} contacts so far`
    );

    if (response && response.value.length === PAGE_SIZE) {
      return this.getContactsPage(client, merged);
    }

    console.log(`fetched all pages, returning ${merged.length} contacts`);

    return merged.map(this.toClinqContact);
  }

  public async getContacts(config: Config): Promise<Contact[]> {
    console.log("fetching contacts");
    return this.getContactsPage(getClient(config));
  }

  public async createContact(config: Config, contact: ContactTemplate) {
    const client = getClient(config);

    const created = await client
      .api("/me/contacts")
      .post(this.toOutlookContactTemplate(contact));

    return this.toClinqContact(created);
  }

  public async updateContact(
    config: Config,
    id: string,
    contact: ContactUpdate
  ) {
    const client = getClient(config);

    const updated = await client
      .api(`/me/contacts/${id}`)
      .patch(this.toOutlookContactTemplate(contact));

    return this.toClinqContact(updated);
  }

  public async deleteContact(config: Config, id: string) {
    const client = getClient(config);

    return client.api(`/me/contacts/${id}`).delete();
  }

  public async getOAuth2RedirectUrl(
    urlConfig?: OAuthURLConfig | undefined
  ): Promise<string> {
    const host = credentials.auth.tokenHost;
    const path = credentials.auth.authorizePath;
    const scopes = APP_SCOPES.split(" ").join("+");

    const clinqEnvironment = urlConfig && urlConfig.clinqEnvironment;
    const callbackUri = encodeURIComponent(
      REDIRECT_URI + `?clinq_environment=${clinqEnvironment}`
    );

    console.log("getOAuth2RedirectURL", callbackUri);

    return `${host}/${path}?redirect_uri=${callbackUri}&scope=${scopes}&response_type=code&client_id=${APP_ID}`;
  }

  public async handleOAuth2Callback(
    req: Request,
    clinqEnvironment?: ClinqBetaEnvironment
  ): Promise<{ apiKey: string; apiUrl: string }> {
    const { code } = req.query;

    if (typeof code !== "string") {
      throw new ServerError(400, "Invalid code");
    }

    const oauth2Client = create(credentials);

    const result = await oauth2Client.authorizationCode.getToken({
      code,
      redirect_uri: REDIRECT_URI + `?clinq_environment=${clinqEnvironment}`,
    });
    console.log(
      "handleOAuth2Callback",
      clinqEnvironment,
      REDIRECT_URI + `?clinq_environment=${clinqEnvironment}`
    );

    const {
      token: { access_token, refresh_token },
    } = oauth2Client.accessToken.create(result);

    return {
      apiKey: `${access_token}:${refresh_token}`,
      apiUrl: "",
    };
  }

  private toOutlookContactTemplate(
    contact: ContactTemplate
  ): OutlookContactTemplate {
    const filterPhoneNumbers = (label: PhoneNumberLabel) =>
      contact.phoneNumbers
        .filter((phoneNumber) => phoneNumber.label === label)
        .map((phoneNumber) => phoneNumber.phoneNumber);

    const businessPhones = filterPhoneNumbers(PhoneNumberLabel.WORK);
    const homePhones = filterPhoneNumbers(PhoneNumberLabel.HOME);
    const mobilePhone = filterPhoneNumbers(PhoneNumberLabel.MOBILE).find(
      Boolean
    );
    const displayName = [contact.firstName, contact.lastName]
      .filter(Boolean)
      .join(" ");

    return {
      displayName,
      givenName: contact.firstName || "",
      surname: contact.lastName || "",
      companyName: contact.organization || "",
      emailAddresses: contact.email
        ? [{ name: contact.email, address: contact.email }]
        : [],
      businessPhones,
      homePhones,
      mobilePhone: mobilePhone || "",
    };
  }

  private toClinqContact(contact: OutlookContact): Contact {
    const email = contact.emailAddresses.find(Boolean);
    return {
      id: contact.id,
      name: contact.displayName || null,
      firstName: contact.givenName || null,
      lastName: contact.surname || null,
      email: email ? email.address : null,
      organization: contact.companyName || null,
      phoneNumbers: [
        ...contact.homePhones.map((phoneNumber) => ({
          label: PhoneNumberLabel.HOME,
          phoneNumber,
        })),
        ...contact.businessPhones.map((phoneNumber) => ({
          label: PhoneNumberLabel.WORK,
          phoneNumber,
        })),
        ...(contact.mobilePhone
          ? [
              {
                label: PhoneNumberLabel.MOBILE,
                phoneNumber: contact.mobilePhone,
              },
            ]
          : []),
      ],
      contactUrl: null,
      avatarUrl: null,
    };
  }
}

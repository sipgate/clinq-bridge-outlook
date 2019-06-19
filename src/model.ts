export interface OutlookEmailAddress {
	name: string,
	address: string
}

export interface OutlookContactTemplate {
	displayName: string;
	givenName: string;
	surname: string;
	companyName: string;
	emailAddresses: OutlookEmailAddress[];
	businessPhones: string[];
	homePhones: string[];
	mobilePhone: string;
}

export interface OutlookContact extends OutlookContactTemplate {
	id: string;
}

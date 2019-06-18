export interface OutlookEmailAddress {
	name: string,
	address: string
}

export interface OutlookContact {
	id: string;
	displayName: string;
	givenName: string;
	surname: string;
	companyName: string;
	emailAddresses: OutlookEmailAddress[];
	businessPhones: string[];
	homePhones: string[];
	mobilePhone: string;
}

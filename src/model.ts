export interface IOutlookEmailAddress {
	address: string;
}

export enum PersonType {
	PERSON = "Person",
	GROUP = "Group"
}

export interface IOutlookPhones {
	type: string;
	number: string;
}

export interface IOutlookContactTemplate {
	displayName: string;
	givenName: string;
	surname: string;
	companyName: string;
	emailAddresses: IOutlookEmailAddress[];
	businessPhones: string[];
	homePhones: string[];
	mobilePhone: string;
}

export interface IOutlookPeopleTemplate {
	displayName: string;
	givenName: string;
	surname: string;
	companyName: string;
	scoredEmailAddresses: IOutlookEmailAddress[];
	phones: IOutlookPhones[];
}

export interface IOutlookPeople extends IOutlookPeopleTemplate {
	id: string;
	personType: {
		class: PersonType;
		subclass: string;
	};
}

export interface IOutlookContact extends IOutlookContactTemplate {
	id: string;
}

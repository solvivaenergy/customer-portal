/**
 * Terms and privacy policy are published on solvivaenergy.com; the portal links to them rather than
 * keeping a copy (the site blocks iframe embedding with X-Frame-Options: SAMEORIGIN, so a link-out
 * card is the only way to show the live text). Content owner: Legal/Marketing.
 */
export type LegalLink = {
  title: string;
  /** Used in the button label: "Read the <shortTitle>". */
  shortTitle: string;
  subtitle: string;
  description: string;
  url: string;
};

export const TERMS: LegalLink = {
  title: "Standard Terms and Conditions",
  shortTitle: "Terms and Conditions",
  subtitle: "Solar photovoltaic system purchase and installation",
  description: "The standard terms and conditions that apply to the purchase and installation of your Solviva solar photovoltaic system, including delivery, commissioning, warranties and payment.",
  url: "https://www.solvivaenergy.com/standard-terms-and-conditions",
};

export const PRIVACY: LegalLink = {
  title: "Privacy Policy",
  shortTitle: "Privacy Policy",
  subtitle: "How Solviva Energy handles your personal data",
  description: "How Solviva Energy collects, uses, stores, shares and protects your personal data under the Data Privacy Act of 2012, and your rights as a data subject.",
  url: "https://www.solvivaenergy.com/policies/privacy",
};

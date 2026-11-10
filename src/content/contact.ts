/**
 * Contact details shown on Support → Contact support. Source: the Figma mockup; the mailboxes, the
 * hotline's availability and the wording were confirmed by CX (Lili) on 2026-11-10. Both mailboxes are
 * Odoo helpdesk team aliases (Customer Care, Technical Aftersales).
 * The non-technical hotline (0917 802 8948) was removed on 2026-11-05 at Alden's request; email covers it.
 */
export const CONTACT = {
  /** How the hotline's availability is worded ("Available 24/7"; was Tuesday – Saturday, 8:00 AM to 5:00 PM until 2026-11-10). */
  hotlineAvailability: "24/7",
  technical: { label: "Technical concerns", phone: "0917 841 2254", tel: "+639178412254" },
  /** The general mailbox, also the sender shown on PMS request threads. */
  email: "customer@solvivaenergy.com",
  /** Every mailbox on the Contact support page, with what each is for. */
  emails: [
    { label: "General inquiries", address: "customer@solvivaenergy.com" },
    { label: "Technical support", address: "tech.support@solvivaenergy.com" },
  ],
  address: "31/F, RCBC Plaza, Yuchengco Tower, 6819 Ayala Ave, Bel-Air, Makati City, 1200 Metro Manila",
  officeHours: "Monday – Friday, 8:00 AM to 5:00 PM",
  website: "https://www.solvivaenergy.com",
  faqUrl: "https://www.solvivaenergy.com/faq",
};

/** Referral programme copy. Earnings have no data source yet (placeholder, 2026-10-08). */
export const REFERRAL = {
  rewardPhp: 10000,
  blurb: "Earn ₱10,000 for each friend who switches to solar with Solviva.",
  landingUrl: "https://www.solvivaenergy.com",
};

export const PMS = {
  inclusions: [
    "Solar module cleaning and inspection",
    "Thermal scanning",
    "Inverter and panel board checks",
    "Grounding system assessment",
    "Monitoring device inspection",
    "System safety and structural integrity checks",
  ],
  pricing: "For systems up to 10 kWp, our PMS starts at ₱10,000 (VAT inclusive). Larger systems are priced at ₱900 per kWp.",
  consent:
    "By submitting this form, you authorize Solviva Energy, Inc. to access the site for the PMS. An authorized representative must be present during the visit. Our Aftersales team will reach out within 2 business days to confirm your schedule.",
};

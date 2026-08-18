export const OFFLINE_TILL_NUMBER = "4211224";
export const TILL_NAME = "MARTHA WAMBUI";
export const DEFAULT_PIN = "9898";
export const START_BALANCE = 850;
export const ACTIVATION_FEE = 800;

export type ServiceReference = "data" | "sms" | "minutes" | "tunukiwa";

export type Offer = {
  id: string;
  price: number;
  title: string;
  validity: string;
  service: ServiceReference;
  note?: string;
};

export type OfferGroup = {
  id: string;
  name: string;
  tagline: string;
  icon: string;
  offers: Offer[];
};

export const OFFER_GROUPS: OfferGroup[] = [
  {
    id: "bingwa",
    name: "Bingwa Data",
    tagline: "Buy only once per day per number",
    icon: "🔂",
    offers: [
      {
        id: "b19",
        price: 19,
        title: "1GB",
        validity: "1 hour",
        service: "data",
        note: "Available 11pm – 4pm",
      },
      { id: "b20", price: 20, title: "250MB", validity: "24 hours", service: "data" },
      { id: "b49", price: 49, title: "400MB", validity: "7 days", service: "data" },
      { id: "b55", price: 55, title: "750MB + 50 SMS", validity: "24 hours", service: "data" },
      { id: "b99", price: 99, title: "1.5GB", validity: "24 hours", service: "data" },
      { id: "b299", price: 299, title: "2.5GB", validity: "Weekly", service: "data" },
    ],
  },
  {
    id: "sms",
    name: "SMS Bundles",
    tagline: "Buy many times per day",
    icon: "♻️",
    offers: [
      { id: "s5", price: 5, title: "20 SMS", validity: "Daily", service: "sms" },
      { id: "s10", price: 10, title: "200 SMS", validity: "Daily", service: "sms" },
      { id: "s30", price: 30, title: "1000 SMS", validity: "7 days", service: "sms" },
    ],
  },
  {
    id: "minutes",
    name: "Minutes",
    tagline: "Talk more for less",
    icon: "📞",
    offers: [
      { id: "m22", price: 22, title: "45 Minutes", validity: "3 hours", service: "minutes" },
      { id: "m51", price: 51, title: "60 Minutes", validity: "Till midnight", service: "minutes" },
    ],
  },
  {
    id: "tunukiwa",
    name: "Tunukiwa Data",
    tagline: "Buy many times per day",
    icon: "🔥",
    offers: [
      {
        id: "t23",
        price: 23,
        title: "1GB",
        validity: "1 hour",
        service: "tunukiwa",
        note: "Available 11pm – 4pm",
      },
      { id: "t52", price: 52, title: "750MB", validity: "24 hours", service: "tunukiwa" },
      { id: "t110", price: 110, title: "2GB", validity: "24 hours", service: "tunukiwa" },
    ],
  },
];

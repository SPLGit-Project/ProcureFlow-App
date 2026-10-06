export interface FeatureUpdate {
  id: string;
  title: string;
  description: string;
  location: string;
  pdf: string;
  video: string;
  poster: string;
  duration: string;
}

const base = '/feature-updates/2026-10-06';
export const FEATURE_UPDATES: readonly FeatureUpdate[] = [
  {
    id: 'supplier-stock', title: 'Supplier Stock and Availability',
    description: 'Find the right item, filter stock availability and understand what is available to order.',
    location: 'Supplier Stock directory',
    pdf: '01_ProcureFlow_Supplier_Stock_and_Availability.pdf', video: 'ProcureFlow_Supplier_Stock_Explainer.mp4', duration: '1:37',
  },
  {
    id: 'supplier-price-comparison', title: 'Supplier Price Comparison',
    description: 'Compare supplier options side by side and check the applicable price before creating a request.',
    location: 'Supplier Stock → Compare suppliers',
    pdf: '02_ProcureFlow_Supplier_Price_Comparison.pdf', video: 'ProcureFlow_Supplier_Price_Comparison_Explainer.mp4', duration: '1:39',
  },
  {
    id: 'ncc-and-alternate-supplier-requests', title: 'NCC and Alternate Supplier Requests',
    description: 'Recognise preferred suppliers and record the reason when an alternate supplier is needed.',
    location: 'Supplier Stock and Create Request',
    pdf: '03_ProcureFlow_NCC_and_Alternate_Supplier_Requests.pdf', video: 'ProcureFlow_NCC_and_Alternate_Supplier_Requests_Explainer.mp4', duration: '1:42',
  },
  {
    id: 'stock-reservations-and-concur-handover', title: 'Stock Reservations and Concur Handover',
    description: 'Follow a reservation from approval through the Concur PR and purchase-order handover.',
    location: 'Request Details and Active Requests',
    pdf: '04_ProcureFlow_Stock_Reservations_and_Concur_Handover.pdf', video: 'ProcureFlow_Stock_Reservations_and_Concur_Handover_Explainer.mp4', duration: '1:43',
  },
  {
    id: 'reservation-expiry-and-re-reserve', title: 'Reservation Expiry and Re-Reserve',
    description: 'Understand the 48-hour countdown, PR protection and how to re-reserve after expiry.',
    location: 'Request Details → Reservation status',
    pdf: '05_ProcureFlow_Reservation_Expiry_and_Re_Reserve.pdf', video: 'ProcureFlow_Reservation_Expiry_and_Re_Reserve_Explainer.mp4', duration: '1:44',
  },
  {
    id: 'stock-reporting-and-reservation-follow-up', title: 'Stock Reporting and Reservation Follow-Up',
    description: 'Read stock balances, On Order quantities and reservation queues to prioritise follow-up.',
    location: 'Reports → Dynamic Stock & Reservation Insights',
    pdf: '06_ProcureFlow_Stock_Reporting_and_Reservation_Follow_Up.pdf', video: 'ProcureFlow_Stock_Reporting_and_Reservation_Follow_Up_Explainer.mp4', duration: '1:51',
  },
].map(feature => ({ ...feature, pdf: `${base}/${feature.pdf}`, video: `${base}/${feature.video}`, poster: `${base}/${feature.id}.jpg` }));

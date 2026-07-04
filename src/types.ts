export interface PhotoItem {
  url: string;
  caption: string;
}

export interface OnsiteService {
  id: string;
  companyName: string;
  companyAddress: string;
  contactName: string;
  contactDetails?: string;
  contactPhone: string;
  contactEmail: string;
  partnerCompany?: string;
  serviceType: string;
  onsiteLocation: string;
  techName: string;
  salesName: string;
  assignedDate: string; // YYYY-MM-DD
  actionDate: string;   // YYYY-MM-DD
  fixedDate: string;    // YYYY-MM-DD
  workingDays: number;  // computed: fixedDate - actionDate
  repairDuration: number; // computed: fixedDate - assignedDate
  symptomReport: string;
  inspectionCause: string;
  solution: string;
  notes: string;
  status: 'Pending' | 'In Progress' | 'Completed';
  photos: PhotoItem[]; // Up to 4 photos
  createdAt: string;
  updatedAt: string;
}

export interface OncallService {
  id: string;
  companyName: string;
  companyAddress: string;
  contactName: string;
  contactDetails?: string;
  contactPhone: string;
  contactEmail: string;
  partnerCompany?: string;
  productType: string;
  salesName: string;
  assignedDate: string; // YYYY-MM-DD
  fixedDate: string;    // YYYY-MM-DD
  repairDuration: number; // computed: fixedDate - assignedDate
  techName: string;
  symptomReport: string;
  solution: string;
  notes: string;
  status: 'Pending' | 'In Progress' | 'Completed';
  createdAt: string;
  updatedAt: string;
}

export interface Claim {
  id: string;
  companyName: string;
  companyAddress: string;
  contactName: string;
  contactDetails?: string;
  contactPhone: string;
  contactEmail: string;
  partnerCompany?: string;
  productType: string;
  productBrand: string;
  model: string;
  serialNumber: string;
  purchaseDate: string; // YYYY-MM-DD
  warrantyPeriod: string; // e.g. "1 Year", "3 Years"
  remainingWarranty: string; // computed remaining days/months
  claimDestination: string;
  claimBuilding: string;
  receivedClaimDate: string; // YYYY-MM-DD
  returnedClaimDate: string; // YYYY-MM-DD (can be empty if not returned yet)
  inspectorName: string;
  claimStatus: 'Received' | 'Checking' | 'Sent to Vendor' | 'Ready for Return' | 'Completed' | 'Rejected';
  photoBeforeUrl: string;
  photoAfterUrl: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  companyName: string;
  companyAddress: string;
  contactName: string;
  contactDetails?: string;
  contactPhone: string;
  contactEmail: string;
  partnerCompany?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LookupTypes {
  onsiteServiceTypes: string[];
  oncallProductTypes: string[];
  claimProductTypes: string[];
}

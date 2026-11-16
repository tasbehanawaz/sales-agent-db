/**
 * Pakistani names and places for init/localize_pkr.js.
 *
 * Every company, hospital and pharmacy name here is invented by combining a
 * place or family word with a trade word. They are not meant to be real
 * businesses, and a name that happens to match one is a coincidence.
 */

// Rivers, mountains, valleys and landmarks used as company name stems.
const STEMS = [
  'Indus', 'Ravi', 'Chenab', 'Jhelum', 'Sutlej', 'Karakoram', 'Margalla', 'Mehran', 'Hunza', 'Swat',
  'Neelum', 'Shandur', 'Thar', 'Cholistan', 'Bolan', 'Khyber', 'Makran', 'Kirthar', 'Tarbela', 'Mangla',
  'Shalimar', 'Rohtas', 'Deosai', 'Rakaposhi', 'Hingol', 'Keenjhar', 'Haleji', 'Manchar', 'Ziarat', 'Chitral',
  'Skardu', 'Pothwar', 'Soan', 'Kunhar', 'Panjnad', 'Taxila', 'Harappa', 'Ranikot', 'Derawar', 'Kohsar',
  'Gulberg', 'Clifton', 'Saddar', 'Anarkali', 'Lyallpur', 'Noor', 'Hilal', 'Sitara', 'Zarrin', 'Gulshan',
  'Kalash', 'Nathia', 'Ayubia', 'Ormara', 'Pasni', 'Sibi', 'Bannu', 'Kohat', 'Hazara', 'Malakand',
  'Kaghan', 'Astore', 'Shigar', 'Passu', 'Gojal', 'Tirich', 'Nanga', 'Rawal', 'Simly', 'Khanpur',
];

const SURNAMES = [
  'Khan', 'Ahmed', 'Malik', 'Qureshi', 'Siddiqui', 'Butt', 'Chaudhry', 'Sheikh', 'Raza', 'Hashmi',
  'Javed', 'Zaidi', 'Abbasi', 'Mirza', 'Bhatti', 'Awan', 'Rana', 'Bajwa', 'Cheema', 'Memon',
  'Soomro', 'Baloch', 'Durrani', 'Khattak', 'Afridi', 'Shah', 'Naqvi', 'Ansari', 'Farooqi', 'Rizvi',
  'Kazmi', 'Lodhi', 'Niazi', 'Tareen', 'Iqbal', 'Aslam', 'Akhtar', 'Hussain', 'Mahmood', 'Saleem',
  'Yousaf', 'Rafiq', 'Anwar', 'Latif', 'Hameed', 'Zafar', 'Haider', 'Jamil', 'Gill', 'Dar',
  'Paracha', 'Kiani', 'Satti', 'Gondal',
];

const MALE = [
  'Ahmed', 'Ali', 'Hassan', 'Hussain', 'Usman', 'Bilal', 'Faisal', 'Imran', 'Kamran', 'Farhan',
  'Asad', 'Saad', 'Hamza', 'Zain', 'Omar', 'Tariq', 'Waqas', 'Junaid', 'Adnan', 'Naveed',
  'Shahid', 'Rizwan', 'Arslan', 'Fahad', 'Danish', 'Haris', 'Salman', 'Owais', 'Zeeshan', 'Kashif',
  'Nadeem', 'Sohail', 'Yasir', 'Atif', 'Irfan', 'Khurram', 'Babar', 'Saqib', 'Mohsin', 'Shoaib',
  'Talha', 'Umair', 'Waleed', 'Ammar', 'Muneeb', 'Raheel', 'Sajid', 'Aamir', 'Noman', 'Fawad',
];

const FEMALE = [
  'Ayesha', 'Fatima', 'Sana', 'Hira', 'Mahnoor', 'Zainab', 'Maryam', 'Amna', 'Sadia', 'Rabia',
  'Nida', 'Saima', 'Asma', 'Farah', 'Mehwish', 'Iqra', 'Kiran', 'Sidra', 'Bushra', 'Uzma',
  'Samina', 'Nadia', 'Huma', 'Aliya', 'Shazia', 'Rubina', 'Anum', 'Komal', 'Hina', 'Laiba',
  'Areeba', 'Javeria', 'Tahira', 'Saba', 'Maham', 'Rida', 'Alina', 'Noor', 'Fiza', 'Mariam',
];

// Apex customer industries. Public sector bodies carry no company suffix.
const CUSTOMER_TRADES = {
  Consumer: ['Foods', 'Beverages', 'Textiles', 'Retail', 'Home Products', 'Dairy'],
  Energy: ['Power', 'Energy', 'Petroleum', 'Gas', 'Solar', 'Hydro Power'],
  'Financial Services': ['Finance', 'Capital', 'Leasing', 'Investments', 'Insurance', 'Securities'],
  Healthcare: ['Hospital', 'Healthcare', 'Diagnostics', 'Medical Centre', 'Pharma', 'Clinics'],
  Industrial: ['Steel', 'Cement', 'Engineering', 'Chemicals', 'Industries', 'Packaging'],
  Technology: ['Technologies', 'Systems', 'Software', 'Digital', 'Tech Solutions', 'Data Services'],
  Telecommunications: ['Telecom', 'Communications', 'Networks', 'Broadband', 'Fibre Networks', 'Wireless'],
  'Public Sector': ['Development Authority', 'Water & Sanitation Agency', 'Education Foundation', 'Transport Authority', 'Health Board', 'Municipal Committee'],
};

// Apex vendor categories, named after a family business.
const VENDOR_TRADES = {
  Facilities: ['Facility Services', 'Maintenance Services', 'Cleaning Services', 'Property Services'],
  Logistics: ['Logistics', 'Cargo Services', 'Freight', 'Goods Transport'],
  Marketing: ['Media', 'Advertising', 'Creative', 'Events'],
  Materials: ['Traders', 'Supplies', 'Industrial Supplies', 'Trading Company'],
  'Professional Services': ['& Co. Chartered Accountants', 'Associates', 'Consulting', 'Legal Associates'],
  Technology: ['IT Services', 'Infotech', 'Computers', 'Software House'],
  'Temporary Labour': ['Manpower Services', 'Staffing Solutions', 'HR Services', 'Workforce Solutions'],
  Utilities: ['Utility Services', 'Power Services', 'Water Services', 'Energy Services'],
};

// Audit finding titles by process. A finding gets one of its process's titles.
const FINDINGS = {
  'Access Management': ['Leaver access not revoked on time', 'Privileged access not reviewed', 'Shared user accounts in use'],
  'Budgeting & Forecasting': ['Budget revisions approved after period close', 'Forecast assumptions not documented', 'Variance reviews not evidenced'],
  'Contract Management': ['Contracts renewed without review', 'Signed contracts not stored centrally', 'Contract terms not reflected in billing'],
  'Customer Master': ['Credit limits changed without approval', 'Duplicate customer records not merged', 'Customer bank details changed without verification'],
  'Customer Service': ['Credit notes issued without approval', 'Complaints closed without resolution', 'SLA breaches not escalated'],
  Cybersecurity: ['Critical patches not applied', 'Multi-factor authentication not enforced', 'Security incidents not logged'],
  'Data Governance': ['Data owners not assigned', 'Master data changes not logged', 'Retention policy not applied'],
  'Fixed Assets': ['Asset register not reconciled to ledger', 'Asset disposals not recorded', 'Physical verification not performed'],
  'Hire to Retire': ['Leavers not removed from payroll promptly', 'Offer letters issued without approval', 'Personnel files incomplete'],
  'IT Change': ['Changes deployed without approval', 'Emergency changes not reviewed after release', 'Testing evidence missing for changes'],
  Inventory: ['Stock counts not reconciled', 'Slow-moving stock not provided for', 'Stock write-offs approved without evidence'],
  'Order to Cash': ['Sales orders released over credit limit', 'Invoices raised late', 'Price overrides without approval'],
  Payroll: ['Payroll changes not independently checked', 'Overtime paid without approval', 'Payroll headcount not reconciled to HR'],
  'Procure to Pay': ['Purchase orders raised after invoice', 'Three-way match overridden', 'Purchases split to avoid approval limits'],
  'Project Delivery': ['Project costs charged to the wrong code', 'Milestones billed without sign-off', 'Change requests not approved'],
  'Record to Report': ['Manual journals posted without review', 'Account reconciliations completed late', 'Suspense balances not cleared'],
  'Revenue Recognition': ['Revenue recognised before delivery', 'Contract modifications not assessed', 'Cut-off errors at month end'],
  Tax: ['Withholding tax deducted at the wrong rate', 'Sales tax returns filed late', 'Tax provision not reconciled to ledger'],
  Treasury: ['Bank reconciliations not reviewed', 'Payment limits exceeded', 'Cash forecast not updated'],
  'Vendor Master': ['Vendor bank details changed without callback', 'Inactive vendors not blocked', 'Duplicate vendor records'],
};

// Apex legal entities: one holding company and one services company per region.
const APEX_ENTITIES = {
  ENT001: { entity: 'Apex North Holdings', location: 'Islamabad' },
  ENT002: { entity: 'Apex Khyber Services', location: 'Peshawar' },
  ENT003: { entity: 'Apex South Holdings', location: 'Karachi' },
  ENT004: { entity: 'Apex Sindh Services', location: 'Hyderabad' },
  ENT005: { entity: 'Apex East Holdings', location: 'Lahore' },
  ENT006: { entity: 'Apex Punjab Services', location: 'Faisalabad' },
  ENT007: { entity: 'Apex West Holdings', location: 'Quetta' },
  ENT008: { entity: 'Apex Balochistan Services', location: 'Quetta' },
};

// Sales regions to the cities a doctor can practise in.
const SALES_CITIES = {
  North: ['Islamabad', 'Rawalpindi', 'Peshawar', 'Abbottabad', 'Mardan', 'Mingora'],
  South: ['Karachi', 'Hyderabad', 'Sukkur', 'Larkana', 'Nawabshah', 'Mirpurkhas'],
  East: ['Lahore', 'Gujranwala', 'Sialkot', 'Sheikhupura', 'Kasur', 'Gujrat'],
  West: ['Quetta', 'Dera Ismail Khan', 'Turbat', 'Khuzdar', 'Zhob', 'Gwadar'],
  Central: ['Faisalabad', 'Multan', 'Sargodha', 'Bahawalpur', 'Sahiwal', 'Jhang'],
};

// Manufacturing plants. Alpha, Beta and Gamma keep their names and move; the
// city-named plants take a Pakistani city and a matching line and machine code.
const PLANTS = {
  'Plant Alpha': { name: 'Plant Alpha', location: 'Lahore', region: 'Punjab' },
  'Plant Beta': { name: 'Plant Beta', location: 'Karachi', region: 'Sindh' },
  'Plant Gamma': { name: 'Plant Gamma', location: 'Faisalabad', region: 'Punjab' },
  'São Paulo Manufacturing': { name: 'Hyderabad Manufacturing', location: 'Hyderabad', region: 'Sindh', from: 'SAO', to: 'HDD' },
  'Mexico City Manufacturing': { name: 'Multan Manufacturing', location: 'Multan', region: 'Punjab', from: 'MEX', to: 'MUX' },
  'Shanghai Manufacturing': { name: 'Sialkot Manufacturing', location: 'Sialkot', region: 'Punjab', from: 'SHA', to: 'SKT' },
  'Berlin Manufacturing': { name: 'Peshawar Manufacturing', location: 'Peshawar', region: 'Khyber Pakhtunkhwa', from: 'BER', to: 'PEW' },
  'Tokyo Manufacturing': { name: 'Islamabad Manufacturing', location: 'Islamabad', region: 'Islamabad Capital Territory', from: 'TYO', to: 'ISB' },
  'Dubai Manufacturing': { name: 'Quetta Manufacturing', location: 'Quetta', region: 'Balochistan', from: 'DXB', to: 'UET' },
  'Singapore Manufacturing': { name: 'Gujranwala Manufacturing', location: 'Gujranwala', region: 'Punjab', from: 'SIN', to: 'GRW' },
  'Toronto Manufacturing': { name: 'Rawalpindi Manufacturing', location: 'Rawalpindi', region: 'Punjab', from: 'YYZ', to: 'RWP' },
};

const SUPPLIERS = {
  'Premium Ingredients Inc': 'Ravi Pharma Ingredients (Pvt) Ltd',
  'Quality Chemicals Co': 'Chenab Chemicals (Pvt) Ltd',
  'PharmaMaterials LLC': 'Mehran Pharma Materials (Pvt) Ltd',
  'Advanced Materials Corp': 'Karakoram Advanced Materials Ltd',
  'Global Suppliers Ltd': 'Sutlej Global Suppliers Ltd',
  'ChemCorp Inc': 'Margalla Chemical Corporation',
};

/** Small seeded generator, so a re-run on a fresh copy gives the same names. */
function random(seed) {
  let a = 0;
  for (const ch of seed) a = (Math.imul(a ^ ch.charCodeAt(0), 2654435761) >>> 0);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(items, rand) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Hands out unique names from a list of candidates per group, in a fixed
 * shuffled order. Throws when a group runs out, rather than repeating a name.
 */
function uniquePicker(candidatesByGroup, seed) {
  const rand = random(seed);
  const queues = {};
  for (const [group, list] of Object.entries(candidatesByGroup)) queues[group] = shuffled(list, rand);
  const used = new Set();
  return (group) => {
    const queue = queues[group];
    if (!queue) throw new Error(`no names for group "${group}"`);
    while (queue.length) {
      const name = queue.pop();
      if (!used.has(name)) {
        used.add(name);
        return name;
      }
    }
    throw new Error(`ran out of unique names for "${group}"`);
  };
}

function customerPicker() {
  const groups = {};
  for (const [industry, trades] of Object.entries(CUSTOMER_TRADES)) {
    groups[industry] = STEMS.flatMap((stem) => trades.map((trade) => `${stem} ${trade}`));
  }
  const pick = uniquePicker(groups, 'apex-customers');
  return (industry, segment) => {
    const base = pick(industry);
    if (industry === 'Public Sector') return base;
    return ['Strategic', 'Enterprise'].includes(segment) ? `${base} Limited` : `${base} (Pvt) Ltd`;
  };
}

function vendorPicker() {
  const groups = {};
  for (const [category, trades] of Object.entries(VENDOR_TRADES)) {
    groups[category] = SURNAMES.flatMap((s) => trades.flatMap((t) =>
      t.startsWith('&') ? [`${s} ${t}`] : [`${s} ${t}`, `${s} Brothers ${t}`, `${s} & Sons ${t}`]));
  }
  return uniquePicker(groups, 'apex-vendors');
}

function personPicker(seed) {
  const people = [...MALE, ...FEMALE].flatMap((first) => SURNAMES.map((last) => `${first} ${last}`));
  const pick = uniquePicker({ all: people }, seed);
  return () => pick('all');
}

function hospitalPicker() {
  const names = [
    ...STEMS.flatMap((s) => [`${s} Hospital`, `${s} General Hospital`, `${s} Medical Complex`, `${s} Medical Centre`]),
    ...SURNAMES.flatMap((s) => [`${s} Clinic`, `${s} Family Clinic`]),
  ];
  const pick = uniquePicker({ all: names }, 'sales-hospitals');
  return () => pick('all');
}

function pharmacyPicker() {
  const pick = uniquePicker({
    Retail: [...STEMS.map((s) => `${s} Pharmacy`), ...SURNAMES.flatMap((s) => [`${s} Medical Store`, `${s} Chemists`])],
    Hospital: STEMS.map((s) => `${s} Hospital Pharmacy`),
    Clinic: [...STEMS.map((s) => `${s} Clinic Pharmacy`), ...SURNAMES.map((s) => `${s} Clinic Dispensary`)],
  }, 'sales-pharmacies');
  return (channel) => pick(channel);
}

/** Stable choice from a list, keyed by an id, so a row always maps the same way. */
function choose(list, key) {
  const rand = random(String(key));
  return list[Math.floor(rand() * list.length)];
}

module.exports = {
  FINDINGS, APEX_ENTITIES, SALES_CITIES, PLANTS, SUPPLIERS,
  customerPicker, vendorPicker, personPicker, hospitalPicker, pharmacyPicker, choose,
};

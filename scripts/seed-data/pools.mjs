/**
 * Realistic name / handle / company / title pools for synthetic seeds.
 * Combinatorial generation for scale; curated fragments for cultural + length variety.
 */

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = [
  // Broad English / common
  'James', 'Emma', 'Olivia', 'Liam', 'Noah', 'Ava', 'Sophia', 'Lucas', 'Mason', 'Harper',
  'Ethan', 'Amelia', 'Mia', 'Alexander', 'Charlotte', 'Benjamin', 'Evelyn', 'Henry', 'Scarlett', 'Daniel',
  'Grace', 'Jack', 'Chloe', 'Samuel', 'Lily', 'Matthew', 'Zoe', 'David', 'Nora', 'Joseph',
  'Hannah', 'Andrew', 'Ella', 'Ryan', 'Victoria', 'Nathan', 'Penelope', 'Chris', 'Stella', 'Adam',
  'Claire', 'Mark', 'Julia', 'Kevin', 'Natalie', 'Brian', 'Audrey', 'Justin', 'Maya', 'Eric',
  // South Asian
  'Aarav', 'Priya', 'Rohan', 'Ananya', 'Vikram', 'Isha', 'Arjun', 'Meera', 'Kabir', 'Sneha',
  'Nikhil', 'Pooja', 'Aditya', 'Kavya', 'Rahul', 'Neha', 'Sanjay', 'Deepa', 'Amit', 'Shreya',
  'Dev', 'Anika', 'Kiran', 'Riya', 'Varun', 'Tanvi', 'Siddharth', 'Aisha', 'Manish', 'Diya',
  // East / Southeast Asian
  'Wei', 'Mei', 'Hiro', 'Yuki', 'Kenji', 'Hana', 'Min', 'Soo', 'Jin', 'Yuna',
  'Chen', 'Li', 'Anh', 'Mai', 'Tran', 'Nguyen', 'Sora', 'Ren', 'Kai', 'Linh',
  'Hyejin', 'Joon', 'Akira', 'Sakura', 'Bo', 'Xia', 'Jun', 'Nari', 'Phuc', 'Thao',
  // Latin American / Spanish / Portuguese
  'Sofia', 'Diego', 'Camila', 'Mateo', 'Valentina', 'Santiago', 'Isabella', 'Sebastian', 'Lucia', 'Gabriel',
  'Mariana', 'Andres', 'Carmen', 'Felipe', 'Elena', 'Ricardo', 'Paula', 'Javier', 'Adriana', 'Luis',
  'Fernanda', 'Miguel', 'Catalina', 'Rafael', 'Beatriz', 'Hector', 'Alejandra', 'Pablo', 'Rosa', 'Joao',
  // Middle Eastern / North African
  'Omar', 'Layla', 'Yusuf', 'Amira', 'Hassan', 'Noor', 'Karim', 'Salma', 'Tariq', 'Leila',
  'Samir', 'Yasmin', 'Rami', 'Dina', 'Farid', 'Hanaa', 'Zain', 'Mona', 'Idris', 'Rania',
  // African / diaspora
  'Amara', 'Kwame', 'Zuri', 'Chidi', 'Amina', 'Tunde', 'Nia', 'Kofi', 'Imani', 'Abebe',
  'Sanaa', 'Jelani', 'Ayo', 'Makena', 'Tendai', 'Zola', 'Obi', 'Asha', 'Bongani', 'Folake',
  // European diaspora
  'Ingrid', 'Lars', 'Freya', 'Soren', 'Anika', 'Mateusz', 'Kasia', 'Piotr', 'Ioana', 'Andrei',
  'Giulia', 'Marco', 'Chiara', 'Luca', 'Nina', 'Oskar', 'Elise', 'Theo', 'Marta', 'Hugo',
  // Additional common
  'Jordan', 'Taylor', 'Casey', 'Morgan', 'Avery', 'Quinn', 'Riley', 'Cameron', 'Reese', 'Parker',
  'Alex', 'Sam', 'Jamie', 'Robin', 'Shawn', 'Tracy', 'Pat', 'Dana', 'Leslie', 'Kim',
];

const LAST = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
  'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
  'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
  'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
  'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts',
  'Patel', 'Shah', 'Khan', 'Singh', 'Sharma', 'Gupta', 'Mehta', 'Reddy', 'Nair', 'Iyer',
  'Chopra', 'Malhotra', 'Banerjee', 'Mukherjee', 'Desai', 'Joshi', 'Kapoor', 'Verma', 'Rao', 'Pillai',
  'Kim', 'Park', 'Choi', 'Jung', 'Kang', 'Cho', 'Yoon', 'Han', 'Oh', 'Shin',
  'Wang', 'Li', 'Zhang', 'Liu', 'Chen', 'Yang', 'Huang', 'Zhao', 'Wu', 'Zhou',
  'Tanaka', 'Suzuki', 'Sato', 'Watanabe', 'Ito', 'Yamamoto', 'Nakamura', 'Kobayashi', 'Kato', 'Yoshida',
  'Tran', 'Pham', 'Hoang', 'Vu', 'Dang', 'Bui', 'Do', 'Ngo', 'Duong', 'Mai',
  'Silva', 'Santos', 'Oliveira', 'Souza', 'Costa', 'Pereira', 'Almeida', 'Nascimento', 'Lima', 'Araujo',
  'Hassan', 'Ali', 'Ahmed', 'Ibrahim', 'Omar', 'Hussein', 'Abbas', 'Rahman', 'Farouk', 'Nasser',
  'Okafor', 'Adeyemi', 'Mensah', 'Owusu', 'Diallo', 'Kamau', 'Abebe', 'Bekele', 'Ndlovu', 'Dlamini',
  'Andersen', 'Nielsen', 'Berg', 'Lindqvist', 'Novak', 'Kowalski', 'Nowak', 'Popescu', 'Ionescu', 'Rossi',
  'Bianchi', 'Conti', 'Moreau', 'Dubois', 'Laurent', 'Schmidt', 'Weber', 'Fischer', 'Meyer', 'Wagner',
  'Okonkwo', 'Nwosu', 'Chaudhary', 'Fernandez', 'Castillo', 'Morales', 'Reyes', 'Gutierrez', 'Ortiz', 'Jimenez',
  'McCarthy', 'OBrien', 'Murphy', 'Kelly', 'Sullivan', 'Walsh', 'Byrne', 'Ryan', 'Quinn', 'Doyle',
  'Cohen', 'Levy', 'Friedman', 'Goldberg', 'Kaplan', 'Rosen', 'Weiss', 'Stein', 'Adler', 'Klein',
  'Haddad', 'Mansour', 'Khalil', 'Saleh', 'Youssef', 'Barakat', 'Suleiman', 'Aziz', 'Karim', 'Darwish',
];

const COMPANY_A = [
  'Harbor', 'Summit', 'Northgate', 'Cedar', 'Pinecrest', 'Riverbend', 'Oakmont', 'Brighton', 'Fairview', 'Westbrook',
  'Clearwater', 'Stonebridge', 'Lakeside', 'Redwood', 'Silverline', 'Horizon', 'Cascade', 'Meridian', 'Atlas', 'Beacon',
  'Cornerstone', 'Peak', 'Valley', 'Prairie', 'Coastal', 'Hillcrest', 'Maple', 'Aspen', 'Granite', 'Ironwood',
  'Skyline', 'Keystone', 'Pioneer', 'Frontier', 'Legacy', 'Alliance', 'Unity', 'Prime', 'Apex', 'Vertex',
  'Nexus', 'Pulse', 'Forge', 'Anchor', 'Bridge', 'Field', 'Grove', 'Ridge', 'Park', 'Station',
];

const COMPANY_B = [
  'Health', 'Logistics', 'Partners', 'Group', 'Systems', 'Solutions', 'Services', 'Financial', 'Capital', 'Labs',
  'Media', 'Retail', 'Foods', 'Construction', 'Engineering', 'Consulting', 'Therapeutics', 'Clinics', 'Education', 'Academy',
  'Software', 'Analytics', 'Networks', 'Motors', 'Properties', 'Hospitality', 'Energy', 'Utilities', 'Insurance', 'Staffing',
  'Manufacturing', 'Packaging', 'Security', 'Communications', 'Research', 'Design', 'Studio', 'Works', 'Industries', 'Holdings',
];

const COMPANY_SUFFIX = ['', ' Inc.', ' LLC', ' Co.', ' Group', ' Partners', ' Holdings', ''];

const CURATED_COMPANIES = [
  'Northline Transit Authority', 'St. Agnes Medical Center', 'Bayview Credit Union', 'Third Street Coffee Roasters',
  'Keller & Moss Accounting', 'Pacific Rim Import Co.', 'Greenfield Public Schools', 'Riverside Animal Clinic',
  'Metro Facilities Management', 'Arcadia Senior Living', 'County Line Farm Supply', 'BrightPath Childcare',
  'Orion Dental Associates', 'Summit Trail Outfitters', 'Lumen Civic Theater', 'Portside Warehousing',
  'Eastgate Family Practice', 'Nova Payroll Services', 'Cross County Electric', 'Willow Bend Library District',
  'Alder Home Services', 'Trinity Community Bank', 'Horizon Orthopedics', 'Blue Heron Marketing',
  'Canyon Road Auto Group', 'First Harbor Insurance', 'Maple Leaf Catering', 'Unity Hospice Care',
  'Sandstone Architecture', 'Crown Street Bakery', 'Regional Freight Solutions', 'Open Door Legal Aid',
  'Pinnacle Veterinary Group', 'Southshore Yacht Club', 'Fieldstone Nurseries', 'Capitol Hill Tutoring',
  'River City Plumbing', 'Amber Light Studios', 'Northern Tools Supply', 'Civic Tech Collective',
];

const TITLES = [
  'Product Manager', 'Senior Accountant', 'Registered Nurse', 'Operations Lead', 'Marketing Specialist',
  'Software Engineer', 'HR Business Partner', 'Store Manager', 'Physical Therapist', 'High School Teacher',
  'Financial Analyst', 'Customer Success Manager', 'Project Coordinator', 'Executive Assistant', 'Sales Director',
  'Data Analyst', 'Clinical Social Worker', 'Logistics Supervisor', 'UX Designer', 'Restaurant Owner',
  'Civil Engineer', 'Paralegal', 'Pharmacist', 'Recruiter', 'IT Support Specialist',
  'Brand Manager', 'Nurse Educator', 'Construction Superintendent', 'Content Strategist', 'Loan Officer',
  'Founder & CEO', 'Girlboss | Founder', 'Managing Partner', 'Principal Consultant', 'Director of People',
  'VP of Operations', 'Senior Consultant', 'Team Lead', 'Independent Contractor', 'Freelance Designer',
  'Assistant Manager', 'Barista & Shift Lead', 'Warehouse Associate', 'Research Associate', 'Adjunct Professor',
  'Real Estate Agent', 'Personal Trainer', 'Dental Hygienist', 'EMT', 'Librarian',
];

const CITIES = [
  'Austin', 'Chicago', 'Seattle', 'Atlanta', 'Denver', 'Boston', 'Portland', 'Nashville', 'Minneapolis', 'Phoenix',
  'Toronto', 'Vancouver', 'London', 'Manchester', 'Dublin', 'Singapore', 'Bengaluru', 'Mumbai', 'Lagos', 'Nairobi',
  'Mexico City', 'São Paulo', 'Santiago', 'Berlin', 'Amsterdam', 'Seoul', 'Tokyo', 'Manila', 'Dubai', 'Cairo',
];

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function shuffle(rng, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Build ≥800 unique realistic display names with balanced first-name variety. */
export function buildNamePool(seed = 42) {
  const rng = mulberry32(seed);
  const names = new Set();
  const firsts = shuffle(rng, FIRST);
  const lasts = shuffle(rng, LAST);
  const firstUse = new Map();
  const maxPerFirst = 4; // wave/full: avoid Luca×200 style clumps

  // Round-robin across first names with random lasts
  let guard = 0;
  while (names.size < 800 && guard++ < 20000) {
    const f = firsts[guard % firsts.length];
    const used = firstUse.get(f) || 0;
    if (used >= maxPerFirst) continue;
    const l = lasts[Math.floor(rng() * lasts.length)];
    const roll = rng();
    let full;
    if (roll < 0.1) full = `${f} ${String.fromCharCode(65 + Math.floor(rng() * 26))}. ${l}`;
    else if (roll < 0.16) full = `${f} ${l}-${lasts[Math.floor(rng() * lasts.length)]}`;
    else full = `${f} ${l}`;
    if (names.has(full)) continue;
    names.add(full);
    firstUse.set(f, used + 1);
  }

  // Top up with any remaining unique combos if needed
  for (const f of shuffle(rng, FIRST)) {
    if (names.size >= 900) break;
    for (const l of shuffle(rng, LAST)) {
      if (names.size >= 900) break;
      if ((firstUse.get(f) || 0) >= 6) break;
      const full = `${f} ${l}`;
      if (names.has(full)) continue;
      names.add(full);
      firstUse.set(f, (firstUse.get(f) || 0) + 1);
    }
  }

  return shuffle(rng, [...names]);
}

export function buildHandle(name, used, rng) {
  const parts = name.replace(/\./g, '').split(/\s+/).filter(Boolean);
  const first = (parts[0] || 'user').toLowerCase().replace(/[^a-z]/g, '');
  const last = (parts[parts.length - 1] || 'person').toLowerCase().replace(/[^a-z]/g, '');
  const patterns = [
    () => `${first}.${last}`,
    () => `${first}${last.slice(0, 1)}`,
    () => `${first}_${last}`,
    () => `${first}${last}${Math.floor(rng() * 90 + 10)}`,
    () => `${first[0]}${last}`,
    () => `${first}.${last}${Math.floor(rng() * 9 + 1)}`,
  ];
  for (let i = 0; i < 20; i++) {
    const h = patterns[i % patterns.length]();
    const handle = h.startsWith('@') ? h : h;
    if (!used.has(handle) && handle.length >= 3) {
      used.add(handle);
      return handle;
    }
  }
  const fallback = `${first}${last}${Math.floor(rng() * 9000 + 1000)}`;
  used.add(fallback);
  return fallback;
}

export function buildCompanyPool(seed = 99) {
  const rng = mulberry32(seed);
  const set = new Set(CURATED_COMPANIES);
  while (set.size < 280) {
    const a = pick(rng, COMPANY_A);
    const b = pick(rng, COMPANY_B);
    const s = pick(rng, COMPANY_SUFFIX);
    set.add(`${a} ${b}${s}`.trim());
  }
  return [...set];
}

export function linkedinHeadline(rng, company, title = null) {
  const t = title || pick(rng, TITLES);
  const styles = [
    `${t} at ${company}`,
    `${t} | ${company}`,
    `${t} · ${company}`,
    `${t} at ${company} | Parent | Always learning`,
    `${t} | Open to connect`,
    `Girlboss | ${t} at ${company}`,
    `${t} at ${company}`,
  ];
  return pick(rng, styles);
}

export function twitterHandleLine(handle) {
  return `@${handle.replace(/^@/, '')}`;
}

export { pick, shuffle, mulberry32, CITIES, TITLES, FIRST, LAST };

export const ICONS = {
  logoIcon: "/logo.svg",
  logoPng1: "/logo1.png",
};

export const DEERO_SERVICES = [
  "Graphic Design",
  "Digital Marketing",
  "Web Solutions",
  "Event Branding",
  "Web Hosting",
  "Custom Service",
];

export const DEEERO_SERVICE_SUBCATEGORIES = [
  {
    "Graphic Design": ["Xirmada Curdun", "Xirmada Hanaqaad", "Xirmada Kabac"],
  },
  {
    "Digital Marketing": [
      "Baahiye Package",
      "Bidhaamiye Package",
      "Bullaliye Package",
    ],
  },
  {
    "Web Solutions": ["Kaabe Hosting", "Keydiye Hosting", "Heegan Hosting"],
  },
  {
    "Event Branding": ["Bile Event", "Dhameys Event", "Dhalal Event"],
  },
  {
    "Web Hosting": ["Basic", "Interprise", "Startup"],
  },
];

export const DEERO_SOURCES = [
  "Social Media",
  "Company Website",
  "Friend / Referral",
  "Online Ads",
  "Event / Exhibition",
  "Google Search / Online Search",
  "Office Location",
];

export const ROUTES = {
  createTask: "/tasks/create",
  editTask: (id: string) => `/tasks/edit/${id}`,
  tasks: "/tasks",
  users: "/users",
  uploadUserFile: (id: string) => `/users/upload/${id}`,
  "my-tasks": "/my-tasks",
  "my-tasks-edit": (id: string) => `/my-tasks/edit/${id}`,
  createUser: "/users/create",
  assignAnotherTask: (id: string) => `/tasks/create/${id}`,
  editUser: (id: string) => `/users/edit/${id}`,
  logout: "/auth/login",
  clients: "/clients",
  createClient: "/clients/create",
  viewClient: (id: string) => `/clients/${id}`,
  addSeriveForClient: (id: string) => `/clients/create/${id}`,
  login: "/auth/login",
  verify: "/auth/verify",
  register: "/auth/register",
  dashboard: "/",
  payments: `/payments?tab=overview`,
  income: "/payments/income",
  expense: "/payments/expense",
  createInvoice: (
    transactionId: string,
    type: "income" | "expense",
    detailsId: string,
    createdAt: string,
  ) =>
    `/invoice/created/${transactionId}?type=${type}&detailsId=${detailsId}&createdAt=${createdAt}`,
  profile: `/profile`,
  report: ({
    type,
    startDate,
    endDate,
    userId,
  }: {
    type: "client" | "users" | "income" | "expense" | "user";
    startDate?: string;
    endDate?: string;
    userId?: string;
  }) => {
    const base = `/api/report/${type}`;
    if (userId) return `${base}/?userId=${userId}`;
    if (!startDate && !endDate) {
      return base;
    } else if (startDate && endDate) {
      return `${base}?startDate=${startDate}&endDate=${endDate}`;
    } else if (startDate) {
      return `${base}/?startDate=${startDate}`;
    } else {
      return `${base}/?endDate=${endDate}`;
    }
  },
  taskReport: (id: string) => `/tasks/report/${id}`,
  paymentReport: "/payments/report",
  userSalaryReport: `/users/report`,
  clientReport: `/clients/report`,
  paySalary: (userId: string) => `/users/pay/${userId}`,
  transactionDetails: (id: string, type: "income" | "expense") =>
    type === "income" ? `/payments/income/${id}` : `/payments/expense/${id}`,
  settings: "/settings",
};

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const INCOME_TYEPS = [
  "Sales Revenue (services)",
  "Consulting Income",
  "Advanced Payments",
  "Other Income",
];

export const EXPENSE_TYPES = [
  "Staff launch casting",
  "Staff Commissions (Sales Incentives)",
  "Rent	Utilities (electricity, water, internet, phone)",
  "Marketing and Advertising",
  "Transportation and Logistics",
  "Supplies and Materials",
  "Equipment and Assets",
  "Licenses and Subscriptions",
  "Repairs and Maintenance",
  "Petty Cash",
  "Taxes and Government Fees",
  "Business Licenses",
  "Other Expense",
];

export const INCOME_STATUS = ["Paid", "Partially Paid", "Unpaid(Recievable)"];
export const PAYMENT_METHODS = [
  "EVC PLus",
  "Bank Transfer",
  "Waafi Transfer",
  "Offline-cash",
];
export const EXPENSE_STATUS = ["Paid", "Partially Paid", "Unpaid(Payable)"];

export const EMAIL_TEMPELATES = {
  emailVerification: {
    subject: "DEERO EMAIL Verification-",
    description:
      "Thank you for joining us! Please verify your email address to activate your account and get started.",
    buttonText: "Verify Your Email",
  },
};

export const SWR_CACH_KEYS = {
  users: {
    key: "/users/data",
    userSessionsKey: "/users/sessions",
  },
  income: {
    key: "/income/data",
  },
  expense: {
    key: "/expense/data",
  },
  clients: {
    key: "/clients/data",
  },
  tasks: {
    key: "/tasks/data",
  },
  myTasks: {
    key: "/mytasks/data",
  },
  taskNotifications: {
    key: "/task-notifications/data",
  },
};

export const TASK_NOTIFICATION_CONFIG = {
  NEW_ASSIGNMENT_WINDOW_MINUTES: 10,
  DEADLINE_SOON_WINDOW_MINUTES: 30,
  MAX_ITEMS: 20,
} as const;

export const Taxs = ["VAT", "Salary Tax", "NONE"];

export const WEB_HOSTING = {
  Basic: [
    "WordPress Hosting",
    "Website 1",
    "Subdomains 5",
    "SSD Storage 50GB",
    "Bandwidth 5GB",
    "Databases 10",
    "Email Accounts- 3",
    "SSL Certificates 24/7",
    "Support & Server Monitoring",
  ],
  Enterprise: [
    "Linux Hosting",
    "Websites Unlimited & Free Domain",
    "Subdomains Unlimited",
    "SSD Storage Unlimited",
    "Bandwidth Unlimited",
    "Databases Unlimited",
    "Email Accounts Unlimited",
    "SSL Certificates 24/7",
    "Support & Server Monitoring",
  ],
  Startup: [
    "Linux Hosting",
    "Website 10",
    "Subdomains 20",
    "SSD Storage 100GB",
    "Bandwidth 20GB",
    "Databases 20",
    "Email Accounts 10",
    "SSL Certificates 24/7",
    "Support & Server Monitoring",
  ],
};

export const SOCIAL_MEDIA_MARKETING = {
  "Baahiye Package": [
    "8+ Custom Posters/Month",
    "2+ Cover Designs/Month",
    "3+ Promo Videos (60s each)",
    "Content Creation (Text, Video & Images)",
  ],
  "Bidhaameye Package": [
    "16+ Custom Posters/Month",
    "3+ Cover Designs/Month",
    "8+ Promo Videos (60s each) and Voice Over",
    "Content Creation (Text, Video & Images)",
  ],
  "Bullaaliye Package": [
    "12+ Custom Posters/Month",
    "2+ Cover Designs/Month",
    "4+ Promo Videos (60s each) and Voice Over",
    "Content Creation (Text, Video & Images)",
  ],
};

export const WEBSITE_DESIGN = {
  "Kaabe Package": [
    "Custom website design and layout",
    "Responsive design for all screen sizes",
    "Up to 7 pages of content",
    "Basic on-page SEO optimization",
    "Professional business email",
  ],
  "Keydiye Package": [
    "Custom website design and layout",
    "Responsive design for all screen sizes",
    "Up to 12 pages of content",
    "Advanced on-page SEO optimization",
    "Professional business email",
  ],
  "Heegan Package": [
    "Custom website design and layout",
    "Responsive design for all screen sizes",
    "Up to 20 pages of content",
    "Advanced on-page SEO optimization",
    "Professional business email",
  ],
};

export const GRAPHIC_DESIGN = {
  "Curdun Package": [
    "Logo Design - 2 Options",
    "Brand Guideline",
    "Business card",
    "ID Card",
    "Outdoor Banner",
  ],
  "Hanaqaad Package": [
    "Logo Design - 3 Options",
    "Brand Consulting",
    "Brand Guideline",
    "Full Stationery Design",
    "Banners, Roll up Banner and Billboard",
  ],
  "Kobac Package": [
    "Brand Consulting",
    "Logo Design - 4 Options",
    "Brand Guideline",
    "Stationery Design",
    "Marketing Material",
  ],
};

export const EVENT_BRANDING = {
  "Bile Event": [
    "Event Symbol and Logo",
    "In and outdoor Banners: Backdrop Banner, Roll up Banner and Billboard",
    "Abstract/Concept Book (15 Pages)",
    "Event Materials: Tags/Badges",
  ],
  "Dhameys Event": [
    "Event Symbol and Logo",
    "In and outdoor Banners: Backdrop Banner, Roll up Banner and Billboard",
    "Abstract/Concept Book (20 Pages)",
    "Event Materials: Tags/Badges",
  ],
  "Dhalaal Event": [
    "Event Symbol and Logo",
    "In and outdoor Banners: Backdrop Banner, Roll up Banner and Billboard",
    "Abstract/Concept Book (20 Pages)",
    "Event Materials: Tags/Badges",
  ],
};

export const DEPARTMENTS = [
  "Strategy and Insights",
  "Sales and Marketing",
  "Finance",
  "Creative",
  "Development",
  "Supervisor",
  "Operations Controller",
];

export const TASK_PRIORITIES = ["normal", "medium", "urgent"] as const;

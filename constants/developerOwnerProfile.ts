export interface DeveloperCredentialGroup {
  titleAr: string;
  descriptionAr: string;
  highlights: string[];
}

export const DEVELOPER_OWNER_PROFILE = {
  nameAr: "عاصم عبدالرحمن محمد عمر",
  nameEn: "Asim Abdulrahman Mohammed Omer",
  roleAr: "مالك ومطور نظام فوترة",
  roleEn: "Founder & Developer of Fawtara",
  publicProfileUrl: "https://www.credly.com/users/asim-abdulrahman",
  professionalSummaryAr:
    "مطور ومالك نظام فوترة بخلفية قوية في تحليل البيانات، الأمن السيبراني، الحوسبة السحابية، الشبكات، تجربة المستخدم، إدارة المشاريع، والذكاء الاصطناعي. يركز على بناء نظام تشغيل متكامل للشركات المستأجرة مع عزل البيانات، استقرار الخدمة، وسهولة إدارة الفروع والموظفين والاشتراكات.",
  professionalSummaryEn:
    "Founder and developer of Fawtara with a strong background in data analytics, cybersecurity, cloud, networking, UX, project management, and AI. Focused on building a reliable multi-tenant business operations platform with isolated company data, branch operations, staff permissions, and subscription management.",
};

export const DEVELOPER_CREDENTIAL_GROUPS: DeveloperCredentialGroup[] = [
  {
    titleAr: "تحليل البيانات وعلوم البيانات",
    descriptionAr: "خبرة موثقة في تحليل البيانات، قواعد البيانات، البرمجة التحليلية، وإدارة البيانات.",
    highlights: [
      "Google Advanced Data Analytics Professional Certificate",
      "Google Data Analytics Professional Certificate",
      "Introduction to Data Science - Cisco",
      "Cloud FinOps - Intel",
    ],
  },
  {
    titleAr: "الأمن السيبراني وحماية البيانات",
    descriptionAr: "خلفية قوية في الأمن السيبراني، حماية الشبكات، الاستجابة للحوادث، وأمن قواعد البيانات.",
    highlights: [
      "IBM Cybersecurity Specialist Professional Certificate",
      "Cybersecurity Essentials",
      "Ethical Hacker - Cisco",
      "Incident Response and Digital Forensics",
      "Network Security & Database Vulnerabilities",
    ],
  },
  {
    titleAr: "السحابة و DevOps والبنية التحتية",
    descriptionAr: "معرفة متقدمة في السحابة، DevOps، أمن السحابة، الحاويات، وخطوط النشر المستمر.",
    highlights: [
      "Cloud DevOps - Intel",
      "Cloud Security - Intel",
      "Introduction to Cloud Computing - IBM/Coursera",
      "Confidential Computing Security - Intel",
    ],
  },
  {
    titleAr: "الشبكات والأتمتة",
    descriptionAr: "خبرة في أساسيات الشبكات، الدفاع الشبكي، المحاكاة، وأتمتة الشبكات.",
    highlights: [
      "Network Technician Career Path - Cisco",
      "Network Defense - Cisco",
      "Understanding Cisco Network Automation Essentials",
      "Cisco AI Technical Practitioner",
    ],
  },
  {
    titleAr: "الذكاء الاصطناعي وتجربة المستخدم",
    descriptionAr: "قدرة على تصميم تجارب مستخدم عملية وبناء حلول مدعومة بالذكاء الاصطناعي.",
    highlights: [
      "Build an AI Agent - IBM SkillsBuild",
      "AI Experiential Learning Lab: Industry Immersion",
      "Capstone Project: Applying UI/UX Design in the Real World",
      "Enterprise Design Thinking Practitioner",
    ],
  },
  {
    titleAr: "إدارة المشاريع والقيادة",
    descriptionAr: "معرفة في Agile، Lean، إدارة المشاريع، حل المشكلات، والتواصل المهني.",
    highlights: [
      "PMP Exam Preparation",
      "McKinsey.org Forward Program",
      "Agile Explorer",
      "Lean Leadership Masterclass Attendee",
    ],
  },
];

export const OWNER_PROFILE_PRIVACY_NOTE_AR =
  "تم اعتماد ملخص مهني آمن فقط. لا يتم عرض تاريخ الميلاد، رقم التعريف، أو أي بيانات حساسة داخل واجهة النظام العامة.";

// Judge-style sample data with planted traps, in official template column order.
// Applications: Application ID | Applicant name | City | State | Pin code | Investment capacity (₹ lakh) |
//   Retail experience (years) | Current / past business | Space available | Space size (sq ft) | Floor |
//   Target launch (months) | Preferred language | Notes from applicant
// Territories: Territory ID | City | State | Pin codes covered | City tier | Open slots | Priority
// null = empty cell. Strings are written as text cells, numbers as numeric cells.
const K = 'Karnataka';
const applications = [
  ['APP-002', 'Ananya Rao', 'Bengaluru', K, 560101, 45, 8, 'Runs a mobile accessories shop', 'Owned', 650, 'Ground', 4, 'Kannada', null],
  ['APP-003', 'Vikram Shetty', 'Bengaluru', K, 560102, 35, 3, 'Runs a clothing store', 'Rented', 450, 'Ground', 3, 'English', 'Can start fit-out quickly'],
  ['APP-004', 'Farhan Ali', 'Bengaluru', K, 560103, 32, 1, 'No previous business', 'Rented', 420, 'Ground', 5, 'Hindi', null],
  ['APP-005', 'Deepa Nair', 'Bengaluru', K, 560101, 40, 2, 'Owns a stationery shop', 'Rented', 500, 'Ground', 3, 'English', 'Same street as another applicant'],
  ['APP-006', 'Ravi Gowda', 'Mysuru', K, 570001, 30, 4, 'Runs a footwear store', 'Rented', 450, 'Ground', 3, 'Kannada', 'Wants to open before Diwali'],
  ['APP-007', 'Suresh Hegde', 'Mysuru', K, 570002, 38, 6, 'Runs a hardware store', 'Owned', null, 'Ground', 4, 'English', 'Shop is in the family building'],
  ['APP-008', 'Lakshmi Prasad', 'Mysuru', K, 570009, 50, 7, 'Runs a pharmacy', 'Owned', 600, 'Ground', 4, 'Kannada', null],
  ['APP-009', 'Meera Joshi', 'Mangaluru', K, 575101, '₹25,00,000', 6, 'Runs a clothing store', 'Rented', 500, 'Ground', 4, 'Hindi', null],
  ['APP-010', 'Imran Khan', 'Mangaluru', K, 575102, 32, 2, 'Runs a bakery', 'Rented', 400, 'Ground', 1, 'Hindi', 'Wants to open next month'],
  ['APP-011', 'Shreya Kamath', 'Mangaluru', K, 575103, 20, 3, 'Runs a beauty parlour', 'Rented', 450, 'Ground', 5, 'English', null],
  ['APP-012', 'Kavya Murthy', 'Bengaluru', K, 560104, 40, 5, 'Runs a gift shop', 'Not yet identified', null, 'Not known', 4, 'Kannada', 'Looking for a shop near the metro station'],
  ['APP-013', 'Basavaraj Patil', 'Hubballi-Dharwad', K, 580101, 35, 4, 'Runs a hardware store', 'Owned', 500, 'Ground', 6, 'Kannada', null],
  ['APP-014', 'Anil Desai', 'Hubballi-Dharwad', K, 580105, 40, 6, 'Runs a sweets shop', 'Rented', 450, 'Ground', 4, 'Kannada', null],
  ['APP-015', 'Pooja Kulkarni', 'Belagavi', K, 590101, 30, 0, 'Family runs a textile shop', 'Rented', 400, 'Ground', 6, 'Hindi', 'New to retail, needs training'],
  ['APP-016', 'Manjunath S', 'Davanagere', K, 577101, 30, 2, 'Runs a tea stall', 'Not yet identified', 450, 'Not known', 5, 'Kannada', null],
  ['APP-017', 'Harish Reddy', 'Mysuru', K, 570008, 35, null, 'Runs a cafe', 'Rented', 450, 'Ground', 4, 'English', null],
  ['APP-018', 'Sanjay Gupta', 'Belagavi', K, 590102, 45, 6, 'Owned a mobile shop for 6 years', 'Rented', 500, 'Mall unit', 4, 'Hindi', null],
  ['APP-019', 'Rohan Pai', 'Davanagere', K, 577102, '40 lakhs', 3, 'Runs an electronics store', 'Owned', 500, 'Ground', 3, 'Kannada', null],
  ['APP-020', 'Fatima Begum', 'Hubballi-Dharwad', K, 580102, 30, 5, 'Runs a tailoring shop', 'Rented', 400, 'Ground', 4, 'Hindi', null],
  ['APP-021', 'Kiran Kumar', 'Tumakuru', K, 572101, 35, 4, 'Runs a grocery store', 'Rented', 450, 'Ground', 4, 'English', null],
];
const territories = [
  ['TER-01', 'Mysuru', K, '570001, 570002, 570008, 570009', 'Tier 2', 2, 'High'],
  ['TER-02', 'Bengaluru', K, '560101, 560102, 560103, 560104', 'Tier 1', 2, 'High'],
  ['TER-03', 'Mangaluru', K, '575101, 575102, 575103', 'Tier 2', 1, 'Medium'],
  ['TER-04', 'Hubballi-Dharwad', K, '580101, 580102', 'Tier 2', 1, 'Low'],
  ['TER-05', 'Davanagere', K, '577101, 577102', 'Tier 3', 1, 'High'],
  ['TER-06', 'Belagavi', K, '590101, 590102', 'Tier 2', 1, 'Medium'],
];
module.exports = { applications, territories };

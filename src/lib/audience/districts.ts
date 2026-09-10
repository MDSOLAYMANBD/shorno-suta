// Bangladesh district dictionary with Bangla, English and common misspellings.
// Used by detectDistrict() to bucket plain-text addresses.

export interface DistrictEntry {
  name: string;        // canonical English name
  bn: string;          // canonical Bangla
  division: string;
  aliases: string[];   // lowercase aliases + misspellings (en + bn)
}

export const DISTRICTS: DistrictEntry[] = [
  // Dhaka division
  { name: 'Dhaka', bn: 'ঢাকা', division: 'Dhaka', aliases: ['dhaka', 'dahka', 'dacca', 'ঢাকা'] },
  { name: 'Gazipur', bn: 'গাজীপুর', division: 'Dhaka', aliases: ['gazipur', 'gazpur', 'গাজীপুর', 'গাজিপুর'] },
  { name: 'Narayanganj', bn: 'নারায়ণগঞ্জ', division: 'Dhaka', aliases: ['narayanganj', 'narayangonj', 'নারায়ণগঞ্জ', 'নারায়নগঞ্জ'] },
  { name: 'Tangail', bn: 'টাঙ্গাইল', division: 'Dhaka', aliases: ['tangail', 'টাঙ্গাইল', 'টাংগাইল'] },
  { name: 'Kishoreganj', bn: 'কিশোরগঞ্জ', division: 'Dhaka', aliases: ['kishoreganj', 'kishorganj', 'কিশোরগঞ্জ'] },
  { name: 'Manikganj', bn: 'মানিকগঞ্জ', division: 'Dhaka', aliases: ['manikganj', 'মানিকগঞ্জ'] },
  { name: 'Munshiganj', bn: 'মুন্সিগঞ্জ', division: 'Dhaka', aliases: ['munshiganj', 'munshigonj', 'মুন্সিগঞ্জ'] },
  { name: 'Narsingdi', bn: 'নরসিংদী', division: 'Dhaka', aliases: ['narsingdi', 'নরসিংদী'] },
  { name: 'Rajbari', bn: 'রাজবাড়ী', division: 'Dhaka', aliases: ['rajbari', 'রাজবাড়ী'] },
  { name: 'Madaripur', bn: 'মাদারীপুর', division: 'Dhaka', aliases: ['madaripur', 'মাদারীপুর'] },
  { name: 'Gopalganj', bn: 'গোপালগঞ্জ', division: 'Dhaka', aliases: ['gopalganj', 'গোপালগঞ্জ'] },
  { name: 'Faridpur', bn: 'ফরিদপুর', division: 'Dhaka', aliases: ['faridpur', 'ফরিদপুর'] },
  { name: 'Shariatpur', bn: 'শরীয়তপুর', division: 'Dhaka', aliases: ['shariatpur', 'shariotpur', 'শরীয়তপুর'] },

  // Chattogram division
  { name: 'Chattogram', bn: 'চট্টগ্রাম', division: 'Chattogram', aliases: ['chattogram', 'chittagong', 'ctg', 'চট্টগ্রাম', 'চিটাগাং'] },
  { name: 'Coxs Bazar', bn: 'কক্সবাজার', division: 'Chattogram', aliases: ["cox's bazar", 'coxs bazar', 'cox bazar', 'কক্সবাজার'] },
  { name: 'Bandarban', bn: 'বান্দরবান', division: 'Chattogram', aliases: ['bandarban', 'বান্দরবান'] },
  { name: 'Rangamati', bn: 'রাঙ্গামাটি', division: 'Chattogram', aliases: ['rangamati', 'রাঙ্গামাটি', 'রাঙামাটি'] },
  { name: 'Khagrachhari', bn: 'খাগড়াছড়ি', division: 'Chattogram', aliases: ['khagrachhari', 'khagrachari', 'খাগড়াছড়ি'] },
  { name: 'Cumilla', bn: 'কুমিল্লা', division: 'Chattogram', aliases: ['cumilla', 'comilla', 'কুমিল্লা'] },
  { name: 'Brahmanbaria', bn: 'ব্রাহ্মণবাড়িয়া', division: 'Chattogram', aliases: ['brahmanbaria', 'b.baria', 'ব্রাহ্মণবাড়িয়া'] },
  { name: 'Chandpur', bn: 'চাঁদপুর', division: 'Chattogram', aliases: ['chandpur', 'চাঁদপুর', 'চাদপুর'] },
  { name: 'Lakshmipur', bn: 'লক্ষ্মীপুর', division: 'Chattogram', aliases: ['lakshmipur', 'laxmipur', 'লক্ষ্মীপুর', 'লক্ষীপুর'] },
  { name: 'Noakhali', bn: 'নোয়াখালী', division: 'Chattogram', aliases: ['noakhali', 'নোয়াখালী'] },
  { name: 'Feni', bn: 'ফেনী', division: 'Chattogram', aliases: ['feni', 'ফেনী'] },

  // Sylhet division
  { name: 'Sylhet', bn: 'সিলেট', division: 'Sylhet', aliases: ['sylhet', 'sylet', 'সিলেট'] },
  { name: 'Moulvibazar', bn: 'মৌলভীবাজার', division: 'Sylhet', aliases: ['moulvibazar', 'মৌলভীবাজার'] },
  { name: 'Habiganj', bn: 'হবিগঞ্জ', division: 'Sylhet', aliases: ['habiganj', 'হবিগঞ্জ'] },
  { name: 'Sunamganj', bn: 'সুনামগঞ্জ', division: 'Sylhet', aliases: ['sunamganj', 'সুনামগঞ্জ'] },

  // Rajshahi division
  { name: 'Rajshahi', bn: 'রাজশাহী', division: 'Rajshahi', aliases: ['rajshahi', 'rajsahi', 'রাজশাহী'] },
  { name: 'Bogura', bn: 'বগুড়া', division: 'Rajshahi', aliases: ['bogura', 'bogra', 'বগুড়া'] },
  { name: 'Pabna', bn: 'পাবনা', division: 'Rajshahi', aliases: ['pabna', 'পাবনা'] },
  { name: 'Sirajganj', bn: 'সিরাজগঞ্জ', division: 'Rajshahi', aliases: ['sirajganj', 'সিরাজগঞ্জ'] },
  { name: 'Natore', bn: 'নাটোর', division: 'Rajshahi', aliases: ['natore', 'নাটোর'] },
  { name: 'Naogaon', bn: 'নওগাঁ', division: 'Rajshahi', aliases: ['naogaon', 'নওগাঁ'] },
  { name: 'Chapainawabganj', bn: 'চাঁপাইনবাবগঞ্জ', division: 'Rajshahi', aliases: ['chapainawabganj', 'chapai', 'চাঁপাইনবাবগঞ্জ'] },
  { name: 'Joypurhat', bn: 'জয়পুরহাট', division: 'Rajshahi', aliases: ['joypurhat', 'জয়পুরহাট'] },

  // Khulna division
  { name: 'Khulna', bn: 'খুলনা', division: 'Khulna', aliases: ['khulna', 'খুলনা'] },
  { name: 'Jashore', bn: 'যশোর', division: 'Khulna', aliases: ['jashore', 'jessore', 'যশোর'] },
  { name: 'Satkhira', bn: 'সাতক্ষীরা', division: 'Khulna', aliases: ['satkhira', 'সাতক্ষীরা'] },
  { name: 'Bagerhat', bn: 'বাগেরহাট', division: 'Khulna', aliases: ['bagerhat', 'বাগেরহাট'] },
  { name: 'Kushtia', bn: 'কুষ্টিয়া', division: 'Khulna', aliases: ['kushtia', 'kustia', 'কুষ্টিয়া'] },
  { name: 'Chuadanga', bn: 'চুয়াডাঙ্গা', division: 'Khulna', aliases: ['chuadanga', 'চুয়াডাঙ্গা'] },
  { name: 'Magura', bn: 'মাগুরা', division: 'Khulna', aliases: ['magura', 'মাগুরা'] },
  { name: 'Jhenaidah', bn: 'ঝিনাইদহ', division: 'Khulna', aliases: ['jhenaidah', 'ঝিনাইদহ'] },
  { name: 'Narail', bn: 'নড়াইল', division: 'Khulna', aliases: ['narail', 'নড়াইল'] },
  { name: 'Meherpur', bn: 'মেহেরপুর', division: 'Khulna', aliases: ['meherpur', 'মেহেরপুর'] },

  // Barishal division
  { name: 'Barishal', bn: 'বরিশাল', division: 'Barishal', aliases: ['barishal', 'barisal', 'বরিশাল'] },
  { name: 'Patuakhali', bn: 'পটুয়াখালী', division: 'Barishal', aliases: ['patuakhali', 'পটুয়াখালী'] },
  { name: 'Bhola', bn: 'ভোলা', division: 'Barishal', aliases: ['bhola', 'ভোলা'] },
  { name: 'Pirojpur', bn: 'পিরোজপুর', division: 'Barishal', aliases: ['pirojpur', 'পিরোজপুর'] },
  { name: 'Barguna', bn: 'বরগুনা', division: 'Barishal', aliases: ['barguna', 'বরগুনা'] },
  { name: 'Jhalokati', bn: 'ঝালকাঠি', division: 'Barishal', aliases: ['jhalokati', 'ঝালকাঠি'] },

  // Rangpur division
  { name: 'Rangpur', bn: 'রংপুর', division: 'Rangpur', aliases: ['rangpur', 'রংপুর'] },
  { name: 'Dinajpur', bn: 'দিনাজপুর', division: 'Rangpur', aliases: ['dinajpur', 'দিনাজপুর'] },
  { name: 'Kurigram', bn: 'কুড়িগ্রাম', division: 'Rangpur', aliases: ['kurigram', 'কুড়িগ্রাম'] },
  { name: 'Gaibandha', bn: 'গাইবান্ধা', division: 'Rangpur', aliases: ['gaibandha', 'গাইবান্ধা'] },
  { name: 'Nilphamari', bn: 'নীলফামারী', division: 'Rangpur', aliases: ['nilphamari', 'নীলফামারী'] },
  { name: 'Panchagarh', bn: 'পঞ্চগড়', division: 'Rangpur', aliases: ['panchagarh', 'পঞ্চগড়'] },
  { name: 'Thakurgaon', bn: 'ঠাকুরগাঁও', division: 'Rangpur', aliases: ['thakurgaon', 'ঠাকুরগাঁও'] },
  { name: 'Lalmonirhat', bn: 'লালমনিরহাট', division: 'Rangpur', aliases: ['lalmonirhat', 'লালমনিরহাট'] },

  // Mymensingh division
  { name: 'Mymensingh', bn: 'ময়মনসিংহ', division: 'Mymensingh', aliases: ['mymensingh', 'ময়মনসিংহ'] },
  { name: 'Jamalpur', bn: 'জামালপুর', division: 'Mymensingh', aliases: ['jamalpur', 'জামালপুর'] },
  { name: 'Netrokona', bn: 'নেত্রকোণা', division: 'Mymensingh', aliases: ['netrokona', 'নেত্রকোনা', 'নেত্রকোণা'] },
  { name: 'Sherpur', bn: 'শেরপুর', division: 'Mymensingh', aliases: ['sherpur', 'শেরপুর'] },
];

// Pre-built lookup. Sort longer aliases first so "Cox's Bazar" beats "Cox".
const SORTED_ALIASES = DISTRICTS
  .flatMap((d) => d.aliases.map((a) => ({ alias: a.toLowerCase(), district: d })))
  .sort((a, b) => b.alias.length - a.alias.length);

export function detectDistrict(address: string | null | undefined): DistrictEntry | null {
  if (!address) return null;
  const hay = address.toLowerCase();
  for (const { alias, district } of SORTED_ALIASES) {
    if (hay.includes(alias)) return district;
  }
  return null;
}

export function getDistrictByName(name: string | null | undefined): DistrictEntry | null {
  if (!name) return null;
  const low = name.toLowerCase();
  return DISTRICTS.find((d) => d.name.toLowerCase() === low || d.bn === name) || null;
}

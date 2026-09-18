/**
 * Utility to generate complete and Google Search Console-compliant
 * Schema.org JobPosting structured data for Sarkari Sahayak job postings.
 */

export const KNOWN_ORGANIZATION_ADDRESSES = [
  // Major State Recruiting Bodies
  { match: /\bupsssc\b/i, streetAddress: 'PICUP Bhawan, Vibhuti Khand, Gomti Nagar', addressLocality: 'Lucknow', addressRegion: 'Uttar Pradesh', postalCode: '226010' },
  { match: /\buppsc\b|up public service/i, streetAddress: '10, Kasturba Gandhi Marg', addressLocality: 'Prayagraj', addressRegion: 'Uttar Pradesh', postalCode: '211018' },
  { match: /\bbpsc\b|bihar public service/i, streetAddress: '15, Jawaharlal Nehru Marg, Bailey Road', addressLocality: 'Patna', addressRegion: 'Bihar', postalCode: '800001' },
  { match: /\bbssc\b|bihar staff/i, streetAddress: 'PO Veterinary College, Patna', addressLocality: 'Patna', addressRegion: 'Bihar', postalCode: '800014' },
  { match: /\brpsc\b|rajasthan public service/i, streetAddress: 'Ghooghara Ghati, Jaipur Road', addressLocality: 'Ajmer', addressRegion: 'Rajasthan', postalCode: '305001' },
  { match: /\brsmssb\b|rajasthan staff/i, streetAddress: 'State Institute of Agriculture Management Premises, Durgapura', addressLocality: 'Jaipur', addressRegion: 'Rajasthan', postalCode: '302018' },
  { match: /\bruhs\b|rajasthan university of health sciences/i, streetAddress: 'Sector-18, Kumbha Marg, Pratap Nagar', addressLocality: 'Jaipur', addressRegion: 'Rajasthan', postalCode: '302033' },
  { match: /\bwbpsc\b|west bengal public service/i, streetAddress: '161A, S. P. Mukherjee Road, Mudiali, Kalighat', addressLocality: 'Kolkata', addressRegion: 'West Bengal', postalCode: '700026' },
  { match: /\bwbprb\b|west bengal police/i, streetAddress: 'Araksha Bhawan, 5th Floor, Block-DJ, Sector-II, Salt Lake City', addressLocality: 'Kolkata', addressRegion: 'West Bengal', postalCode: '700091' },
  { match: /\bmppsc\b|madhya pradesh public/i, streetAddress: 'Residency Area, Daly College Road', addressLocality: 'Indore', addressRegion: 'Madhya Pradesh', postalCode: '452001' },
  { match: /\bjpsc\b|jharkhand public service/i, streetAddress: 'Circular Road, Ahirtoli', addressLocality: 'Ranchi', addressRegion: 'Jharkhand', postalCode: '834001' },
  { match: /\bjssc\b|jharkhand staff/i, streetAddress: 'Chaay Bagan, Namkum', addressLocality: 'Ranchi', addressRegion: 'Jharkhand', postalCode: '834010' },
  { match: /\bhpsc\b|haryana public service/i, streetAddress: 'Bays 1-10, Block B, Sector 4', addressLocality: 'Panchkula', addressRegion: 'Haryana', postalCode: '134112' },
  { match: /\bhssc\b|haryana staff/i, streetAddress: 'Bays 67-70, Sector 2', addressLocality: 'Panchkula', addressRegion: 'Haryana', postalCode: '134151' },
  { match: /\bukpsc\b|uttarakhand public/i, streetAddress: 'Gurukul Kangri', addressLocality: 'Haridwar', addressRegion: 'Uttarakhand', postalCode: '249404' },
  { match: /\bopsc\b|odisha public/i, streetAddress: '19, Dr. P. K. Parija Road', addressLocality: 'Cuttack', addressRegion: 'Odisha', postalCode: '753001' },
  { match: /\btnpsc\b|tamil nadu public/i, streetAddress: 'TNPSC Road, V.O.C. Nagar, Park Town', addressLocality: 'Chennai', addressRegion: 'Tamil Nadu', postalCode: '600003' },
  { match: /\bkpsc\b|karnataka public/i, streetAddress: 'Udyoga Soudha, Devaraj Urs Road', addressLocality: 'Bengaluru', addressRegion: 'Karnataka', postalCode: '560001' },
  { match: /\bmpsc\b|maharashtra public/i, streetAddress: '5th Floor, MTNL Cooperage Building, Maharshi Karve Road', addressLocality: 'Mumbai', addressRegion: 'Maharashtra', postalCode: '400021' },
  { match: /\bappsc\b|andhra pradesh public/i, streetAddress: 'New HODs Building, MG Road', addressLocality: 'Vijayawada', addressRegion: 'Andhra Pradesh', postalCode: '520010' },
  { match: /\btspsc\b|telangana state public/i, streetAddress: 'Prathibha Bhavan, Nampally', addressLocality: 'Hyderabad', addressRegion: 'Telangana', postalCode: '500001' },
  { match: /kerala psc/i, streetAddress: 'Pattom Palace P.O.', addressLocality: 'Thiruvananthapuram', addressRegion: 'Kerala', postalCode: '695004' },
  { match: /\bppsc\b|punjab public service/i, streetAddress: 'Baradari Gardens', addressLocality: 'Patiala', addressRegion: 'Punjab', postalCode: '147001' },
  { match: /\bpsssb\b|punjab subordinate/i, streetAddress: 'Forest Complex, Sector 68', addressLocality: 'SAS Nagar, Mohali', addressRegion: 'Punjab', postalCode: '160062' },
  { match: /\bjkpsc\b|j&k public/i, streetAddress: 'Resham Ghar Colony, Bakshi Nagar', addressLocality: 'Jammu', addressRegion: 'Jammu and Kashmir', postalCode: '180001' },
  { match: /\bcgpsc\b|chhattisgarh public/i, streetAddress: 'Shankar Nagar Road, Bhagat Singh Chowk', addressLocality: 'Raipur', addressRegion: 'Chhattisgarh', postalCode: '492001' },

  // Central Recruiting Bodies & PSUs
  { match: /\bupsc\b|union public service/i, streetAddress: 'Dholpur House, Shahjahan Road', addressLocality: 'New Delhi', addressRegion: 'Delhi', postalCode: '110069' },
  { match: /\bssc\b|staff selection commission/i, streetAddress: 'Block No-12, CGO Complex, Lodhi Road', addressLocality: 'New Delhi', addressRegion: 'Delhi', postalCode: '110003' },
  { match: /\brailway|\brrb\b|\brrc\b/i, streetAddress: 'Rail Bhawan, 256-A, Raisina Road', addressLocality: 'New Delhi', addressRegion: 'Delhi', postalCode: '110001' },
  { match: /\bibps\b|institute of banking personnel/i, streetAddress: 'IBPS House, 90 Feet, D.P. Road, Kandivali East', addressLocality: 'Mumbai', addressRegion: 'Maharashtra', postalCode: '400101' },
  { match: /state bank of india|\bsbi\b/i, streetAddress: 'State Bank Bhavan, Madame Cama Road, Nariman Point', addressLocality: 'Mumbai', addressRegion: 'Maharashtra', postalCode: '400021' },
  { match: /reserve bank of india|\brbi\b/i, streetAddress: 'Central Office Building, Shahid Bhagat Singh Road, Fort', addressLocality: 'Mumbai', addressRegion: 'Maharashtra', postalCode: '400001' },
  { match: /delhi police/i, streetAddress: 'Delhi Police Headquarters, Jai Singh Road', addressLocality: 'New Delhi', addressRegion: 'Delhi', postalCode: '110001' },
  { match: /indian army|\barmy\b/i, streetAddress: 'Integrated HQ of MoD (Army), South Block', addressLocality: 'New Delhi', addressRegion: 'Delhi', postalCode: '110011' },
  { match: /indian navy|\bnavy\b/i, streetAddress: 'Integrated HQ of MoD (Navy), Sena Bhawan', addressLocality: 'New Delhi', addressRegion: 'Delhi', postalCode: '110011' },
  { match: /air force|\biaf\b/i, streetAddress: 'Air Headquarters, Vayu Bhawan, Rafi Marg', addressLocality: 'New Delhi', addressRegion: 'Delhi', postalCode: '110106' },
  { match: /\bbsf\b|border security force/i, streetAddress: 'Block 10, CGO Complex, Lodhi Road', addressLocality: 'New Delhi', addressRegion: 'Delhi', postalCode: '110003' },
  { match: /\bcrpf\b/i, streetAddress: 'Directorate General, CGO Complex, Lodhi Road', addressLocality: 'New Delhi', addressRegion: 'Delhi', postalCode: '110003' },
  { match: /\bcisf\b/i, streetAddress: 'Block 13, CGO Complex, Lodhi Road', addressLocality: 'New Delhi', addressRegion: 'Delhi', postalCode: '110003' },
  { match: /\bitbp\b/i, streetAddress: 'Block 2, CGO Complex, Lodhi Road', addressLocality: 'New Delhi', addressRegion: 'Delhi', postalCode: '110003' },
  { match: /\bkvs\b|kendriya vidyalaya/i, streetAddress: '18, Institutional Area, Shaheed Jeet Singh Marg', addressLocality: 'New Delhi', addressRegion: 'Delhi', postalCode: '110016' },
  { match: /\bnvs\b|navodaya vidyalaya/i, streetAddress: 'B-15, Institutional Area, Sector 62', addressLocality: 'Noida', addressRegion: 'Uttar Pradesh', postalCode: '201309' },
  { match: /\bdrdo\b/i, streetAddress: 'DRDO Bhawan, Rajaji Marg', addressLocality: 'New Delhi', addressRegion: 'Delhi', postalCode: '110011' },
  { match: /\bisro\b/i, streetAddress: 'Antariksh Bhavan, New BEL Road', addressLocality: 'Bengaluru', addressRegion: 'Karnataka', postalCode: '560094' },
  { match: /\biocl\b|indian oil/i, streetAddress: 'Scope Complex, Core-2, 7, Institutional Area, Lodhi Road', addressLocality: 'New Delhi', addressRegion: 'Delhi', postalCode: '110003' },
  { match: /\bntpc\b/i, streetAddress: 'NTPC Bhawan, SCOPE Complex, 7 Institutional Area, Lodhi Road', addressLocality: 'New Delhi', addressRegion: 'Delhi', postalCode: '110003' },
  { match: /\bon-?gc\b/i, streetAddress: 'Deendayal Urja Bhawan, 5 Nelson Mandela Marg, Vasant Kunj', addressLocality: 'New Delhi', addressRegion: 'Delhi', postalCode: '110070' },
  { match: /\bbel\b|bharat electronics/i, streetAddress: 'Outer Ring Road, Nagavara', addressLocality: 'Bengaluru', addressRegion: 'Karnataka', postalCode: '560045' },
  { match: /\bbhel\b/i, streetAddress: 'BHEL House, Siri Fort', addressLocality: 'New Delhi', addressRegion: 'Delhi', postalCode: '110049' },
  { match: /\baiims\b/i, streetAddress: 'Ansari Nagar, Sri Aurobindo Marg', addressLocality: 'New Delhi', addressRegion: 'Delhi', postalCode: '110029' },
  { match: /\bjipmer\b/i, streetAddress: 'Dhanvantari Nagar, Gorimedu', addressLocality: 'Puducherry', addressRegion: 'Puducherry', postalCode: '605006' },
  { match: /\bindia\s*post\b|\bpost\s*office\b|\bdepartment\s*of\s*posts\b|\bdak\s*vibh?ag\b/i, streetAddress: 'Dak Bhawan, Sansad Marg', addressLocality: 'New Delhi', addressRegion: 'Delhi', postalCode: '110001' },
];

export const STATE_ADDRESS_DIRECTORY = {
  'UP': { streetAddress: 'Vidhan Sabha Marg, Hazratganj', addressLocality: 'Lucknow', addressRegion: 'Uttar Pradesh', postalCode: '226001' },
  'Uttar Pradesh': { streetAddress: 'Vidhan Sabha Marg, Hazratganj', addressLocality: 'Lucknow', addressRegion: 'Uttar Pradesh', postalCode: '226001' },
  'Bihar': { streetAddress: 'Old Secretariat, Bailey Road', addressLocality: 'Patna', addressRegion: 'Bihar', postalCode: '800015' },
  'Rajasthan': { streetAddress: 'Janpath, Jyoti Nagar', addressLocality: 'Jaipur', addressRegion: 'Rajasthan', postalCode: '302005' },
  'West Bengal': { streetAddress: 'Nabanna, 325 Sarat Chatterjee Road, Mandirtala', addressLocality: 'Kolkata', addressRegion: 'West Bengal', postalCode: '711102' },
  'Delhi': { streetAddress: 'Delhi Secretariat, Players Building, IP Estate', addressLocality: 'New Delhi', addressRegion: 'Delhi', postalCode: '110002' },
  'Maharashtra': { streetAddress: 'Mantralaya, Madam Cama Road, Nariman Point', addressLocality: 'Mumbai', addressRegion: 'Maharashtra', postalCode: '400032' },
  'MP': { streetAddress: 'Vallabh Bhawan, Mantralaya', addressLocality: 'Bhopal', addressRegion: 'Madhya Pradesh', postalCode: '462004' },
  'Madhya Pradesh': { streetAddress: 'Vallabh Bhawan, Mantralaya', addressLocality: 'Bhopal', addressRegion: 'Madhya Pradesh', postalCode: '462004' },
  'Karnataka': { streetAddress: 'Vidhana Soudha, Ambedkar Beedhi', addressLocality: 'Bengaluru', addressRegion: 'Karnataka', postalCode: '560001' },
  'Tamil Nadu': { streetAddress: 'Fort St. George, Rajaji Salai', addressLocality: 'Chennai', addressRegion: 'Tamil Nadu', postalCode: '600009' },
  'Gujarat': { streetAddress: 'New Sachivalaya, Sector 10', addressLocality: 'Gandhinagar', addressRegion: 'Gujarat', postalCode: '382010' },
  'Haryana': { streetAddress: 'Haryana Civil Secretariat, Sector 1', addressLocality: 'Chandigarh', addressRegion: 'Haryana', postalCode: '160001' },
  'Punjab': { streetAddress: 'Punjab Civil Secretariat, Sector 1', addressLocality: 'Chandigarh', addressRegion: 'Punjab', postalCode: '160001' },
  'Odisha': { streetAddress: 'Lok Seva Bhavan, Sachivalaya Marg', addressLocality: 'Bhubaneswar', addressRegion: 'Odisha', postalCode: '751001' },
  'Assam': { streetAddress: 'Janata Bhawan, Dispur', addressLocality: 'Guwahati', addressRegion: 'Assam', postalCode: '781006' },
  'Jharkhand': { streetAddress: 'Project Building, Dhurwa', addressLocality: 'Ranchi', addressRegion: 'Jharkhand', postalCode: '834004' },
  'Chhattisgarh': { streetAddress: 'Mahanadi Bhawan, Mantralaya, Sector 19', addressLocality: 'Nava Raipur Atal Nagar', addressRegion: 'Chhattisgarh', postalCode: '492002' },
  'Uttarakhand': { streetAddress: 'Uttarakhand Secretariat, 4 Subhash Road', addressLocality: 'Dehradun', addressRegion: 'Uttarakhand', postalCode: '248001' },
  'HP': { streetAddress: 'HP Secretariat, Armsdale Building', addressLocality: 'Shimla', addressRegion: 'Himachal Pradesh', postalCode: '171002' },
  'Himachal Pradesh': { streetAddress: 'HP Secretariat, Armsdale Building', addressLocality: 'Shimla', addressRegion: 'Himachal Pradesh', postalCode: '171002' },
  'J&K': { streetAddress: 'Civil Secretariat, Resham Ghar Colony', addressLocality: 'Jammu', addressRegion: 'Jammu and Kashmir', postalCode: '180001' },
  'Telangana': { streetAddress: 'BR Ambedkar Telangana State Secretariat', addressLocality: 'Hyderabad', addressRegion: 'Telangana', postalCode: '500022' },
  'AP': { streetAddress: 'AP Secretariat, Velagapudi', addressLocality: 'Amaravati', addressRegion: 'Andhra Pradesh', postalCode: '522238' },
  'Andhra Pradesh': { streetAddress: 'AP Secretariat, Velagapudi', addressLocality: 'Amaravati', addressRegion: 'Andhra Pradesh', postalCode: '522238' },
  'Kerala': { streetAddress: 'Government Secretariat, MG Road, Statue', addressLocality: 'Thiruvananthapuram', addressRegion: 'Kerala', postalCode: '695001' },
  'Goa': { streetAddress: 'Secretariat, Porvorim', addressLocality: 'Porvorim', addressRegion: 'Goa', postalCode: '403521' },
  'Tripura': { streetAddress: 'New Capital Complex', addressLocality: 'Agartala', addressRegion: 'Tripura', postalCode: '799010' },
  'Puducherry': { streetAddress: 'Chief Secretariat, Goubert Avenue', addressLocality: 'Puducherry', addressRegion: 'Puducherry', postalCode: '605001' },
  'Sikkim': { streetAddress: 'Tashiling Secretariat', addressLocality: 'Gangtok', addressRegion: 'Sikkim', postalCode: '737101' },
  'Central': { streetAddress: 'Central Secretariat, Rajpath Area', addressLocality: 'New Delhi', addressRegion: 'Delhi', postalCode: '110001' },
  'All India': { streetAddress: 'Central Secretariat, Rajpath Area', addressLocality: 'New Delhi', addressRegion: 'Delhi', postalCode: '110001' }
};

export function resolveJobAddress(job) {
  // 1. Explicit address provided directly on job object
  if (job.jobLocation?.address?.streetAddress && job.jobLocation?.address?.postalCode) {
    return {
      streetAddress: job.jobLocation.address.streetAddress,
      addressLocality: job.jobLocation.address.addressLocality,
      addressRegion: job.jobLocation.address.addressRegion,
      postalCode: job.jobLocation.address.postalCode,
      addressCountry: 'IN'
    };
  }

  // 2. Known organization addresses
  const orgTitle = [job.organization, job.title, job.slug].filter(Boolean).join(' ');
  for (const item of KNOWN_ORGANIZATION_ADDRESSES) {
    if (item.match.test(orgTitle)) {
      return {
        streetAddress: item.streetAddress,
        addressLocality: item.addressLocality,
        addressRegion: item.addressRegion,
        postalCode: item.postalCode,
        addressCountry: 'IN'
      };
    }
  }

  // 3. Known state capital addresses
  if (job.state && STATE_ADDRESS_DIRECTORY[job.state]) {
    const s = STATE_ADDRESS_DIRECTORY[job.state];
    return {
      streetAddress: s.streetAddress,
      addressLocality: s.addressLocality,
      addressRegion: s.addressRegion,
      postalCode: s.postalCode,
      addressCountry: 'IN'
    };
  }

  for (const [key, val] of Object.entries(STATE_ADDRESS_DIRECTORY)) {
    if ((job.state && job.state.includes(key)) || orgTitle.includes(key)) {
      return {
        streetAddress: val.streetAddress,
        addressLocality: val.addressLocality,
        addressRegion: val.addressRegion,
        postalCode: val.postalCode,
        addressCountry: 'IN'
      };
    }
  }

  // 4. Fallback to Central Secretariat (New Delhi)
  return {
    streetAddress: 'Central Secretariat, Rajpath Area',
    addressLocality: 'New Delhi',
    addressRegion: 'Delhi',
    postalCode: '110001',
    addressCountry: 'IN'
  };
}

export function resolveBaseSalary(job) {
  // If explicit baseSalary object already has value or min/max
  if (job.baseSalary?.value?.value || (job.baseSalary?.value?.minValue && job.baseSalary?.value?.maxValue)) {
    return job.baseSalary;
  }

  const text = [job.salary, job.salaryDetails?.grossSalary, job.salaryDetails?.payScale]
    .filter(Boolean)
    .join(' ');

  // Look for currency patterns like ₹19,900 - ₹63,200 or 19900 to 63200
  const matches = [...text.matchAll(/(?:₹|Rs\.?|INR)?\s*([0-9]{1,3}(?:,[0-9]{2,3})+|[0-9]{4,7})/gi)]
    .map(m => parseInt(m[1].replace(/,/g, ''), 10))
    .filter(n => n >= 5000 && n <= 500000); // monthly salary bounds

  let valueObj;
  if (matches.length >= 2) {
    valueObj = {
      "@type": "QuantitativeValue",
      "minValue": Math.min(matches[0], matches[1]),
      "maxValue": Math.max(matches[0], matches[1]),
      "unitText": "MONTH"
    };
  } else if (matches.length === 1) {
    valueObj = {
      "@type": "QuantitativeValue",
      "value": matches[0],
      "unitText": "MONTH"
    };
  } else {
    // Standard 7th CPC entry-level pay matrix (Level 1)
    valueObj = {
      "@type": "QuantitativeValue",
      "minValue": 18000,
      "maxValue": 56900,
      "unitText": "MONTH"
    };
  }

  return {
    "@type": "MonetaryAmount",
    "currency": "INR",
    "value": valueObj
  };
}

export function resolveValidThrough(lastDate) {
  if (!lastDate) return "2026-12-31";
  if (/^\d{4}-\d{2}-\d{2}$/.test(lastDate)) return lastDate;
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(lastDate)) {
    const parts = lastDate.split('/');
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return "2026-12-31";
}

export function buildJobPostingSchema(job, siteUrl = 'https://govtjob.salarypitcher.com') {
  const address = resolveJobAddress(job);
  const salary = resolveBaseSalary(job);
  const validThrough = resolveValidThrough(job.lastDate);

  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    "title": job.title,
    "description": `${job.title} — ${job.organization}. ${job.vacancies || 'Multiple'} vacancies. Last date: ${job.lastDate}. Apply online.`,
    "datePosted": job.startDate || new Date().toISOString().split('T')[0],
    "validThrough": validThrough,
    "employmentType": "FULL_TIME",
    "directApply": true,
    "hiringOrganization": {
      "@type": "Organization",
      "name": job.organization,
      "sameAs": job.applyUrl || siteUrl
    },
    "jobLocation": {
      "@type": "Place",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": address.streetAddress,
        "addressLocality": address.addressLocality,
        "addressRegion": address.addressRegion,
        "postalCode": address.postalCode,
        "addressCountry": "IN"
      }
    },
    "baseSalary": salary,
    "identifier": {
      "@type": "PropertyValue",
      "name": job.organization,
      "value": job.advNumber || job.slug
    },
    "applicationContact": {
      "@type": "Organization",
      "name": job.organization
    }
  };
}

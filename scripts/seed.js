require('dotenv').config();
const mongoose = require('mongoose');
const Job = require('../models/Job');
const Company = require('../models/Company');

const companies = [
  { name: 'Darwinbox', website: 'https://darwinbox.com', techStack: ['React', 'Node.js', 'TypeScript'], industry: 'HR Tech', size: '500-1000', location: 'Hyderabad' },
  { name: 'Freshworks', website: 'https://freshworks.com', techStack: ['React', 'TypeScript', 'Redux'], industry: 'SaaS', size: '1000+', location: 'Hyderabad' },
  { name: 'BrowserStack', website: 'https://browserstack.com', techStack: ['React', 'TypeScript', 'Jest', 'Playwright'], industry: 'Developer Tools', size: '500-1000', location: 'Remote' },
  { name: 'Razorpay', website: 'https://razorpay.com', techStack: ['React', 'TypeScript', 'Redux', 'Next.js'], industry: 'Fintech', size: '1000+', location: 'Hyderabad' },
  { name: 'Publicis Sapient', website: 'https://publicissapient.com', techStack: ['React', 'TypeScript', 'Tailwind CSS', 'Redux'], industry: 'Consulting', size: '1000+', location: 'Hyderabad' },
];

const jobTemplates = [
  { title: 'Senior Frontend Developer', skills: ['React', 'TypeScript', 'Redux', 'Next.js'], experienceMin: 3, experienceMax: 6, locationType: 'hybrid', salaryMin: 900000, salaryMax: 1500000, description: 'Build scalable frontend for enterprise HR platform.' },
  { title: 'React Engineer', skills: ['React', 'TypeScript', 'Tailwind CSS', 'Jest'], experienceMin: 2, experienceMax: 5, locationType: 'remote', salaryMin: 1000000, salaryMax: 1800000, description: 'Build best-in-class UI for fintech products.' },
  { title: 'Frontend Engineer II', skills: ['React', 'TypeScript', 'Playwright', 'Vite'], experienceMin: 3, experienceMax: 7, locationType: 'remote', salaryMin: 1200000, salaryMax: 2000000, description: 'Own frontend testing strategy and performance.' },
];

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('MongoDB connected');
//   await Company.deleteMany({});
//   await Job.deleteMany({});
  const createdCompanies = await Company.insertMany(companies);
  console.log('Seeded ' + createdCompanies.length + ' companies');
  const jobs = createdCompanies.flatMap((company, i) =>
    jobTemplates.map((template, j) => ({
      ...template,
      company: company._id,
      companyName: company.name,
      location: company.location,
      source: 'manual',
      tags: ['frontend', 'react', 'senior'],
      postedAt: new Date(Date.now() - (i * 3 + j) * 24 * 60 * 60 * 1000),
    }))
  );
  const createdJobs = await Job.insertMany(jobs);
  console.log('Seeded ' + createdJobs.length + ' jobs');
  await mongoose.disconnect();
  console.log('Done');
}

seed().catch((err) => { console.error(err); process.exit(1); });

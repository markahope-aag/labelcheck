const https = require('https');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

console.log('🕷️  FDA GRAS Notice Inventory Scraper\n');

const BASE_URL = 'hfpappexternal.fda.gov';
const DELAY_MS = 1000; // 1 second delay between requests to be polite
const RESULTS_PER_PAGE = 25; // FDA shows 25 results per page

let allSubstances = [];
let currentPage = 1;
let totalPages = null;

// Fetch a single page
function fetchPage(startRow) {
  return new Promise((resolve, reject) => {
    const path = `/scripts/fdcc/index.cfm?set=GRASNotices&sort=GRN_No&order=DESC&startrow=${startRow}&type=basic&search=`;

    const options = {
      hostname: BASE_URL,
      path: path,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    };

    https.get(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        resolve(data);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// Parse HTML and extract substance data
function parseHTML(html) {
  const $ = cheerio.load(html);
  const substances = [];

  // Find the summaryTable specifically
  $('#summaryTable tbody tr').each((i, row) => {
    const cells = $(row).find('td');
    if (cells.length >= 2) {
      const grnNo = $(cells[0]).text().trim();
      const substance = $(cells[1]).text().trim();

      // Only add if we have valid data (just check for numeric GRN)
      if (grnNo && substance && grnNo.match(/\d+/)) {
        substances.push({
          ingredient_name: substance,
          gras_notice_number: 'GRN ' + grnNo,
          gras_status: 'notice',
          source_reference: 'GRN ' + grnNo,
          category: 'food ingredient', // Will be categorized later
          synonyms: [],
          common_name: substance
        });
      }
    }
  });

  // Try to find total count
  const pageInfo = $('body').text();
  const match = pageInfo.match(/(\d+)\s+records/i);
  if (match && !totalPages) {
    const totalRecords = parseInt(match[1]);
    totalPages = Math.ceil(totalRecords / RESULTS_PER_PAGE);
    console.log(`📊 Found ${totalRecords} total records (${totalPages} pages)\n`);
  }

  return substances;
}

// Sleep function for rate limiting
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Main scraping function
async function scrapeAll() {
  console.log('🚀 Starting scrape...\n');

  try {
    let startRow = 1;
    let hasMore = true;
    let pageNum = 0;

    while (hasMore) {
      pageNum++;
      console.log(`📄 Fetching page ${pageNum} (starting at row ${startRow})...`);

      const html = await fetchPage(startRow);
      const substances = parseHTML(html);

      if (substances.length === 0) {
        console.log('   No more data found.');
        hasMore = false;
        break;
      }

      console.log(`   ✅ Found ${substances.length} substances`);
      allSubstances = allSubstances.concat(substances);

      // Check if we've reached the end
      if (totalPages && pageNum >= totalPages) {
        console.log(`   📊 Reached final page (${pageNum}/${totalPages})`);
        hasMore = false;
      } else if (substances.length < RESULTS_PER_PAGE) {
        console.log('   📊 Last page detected (fewer results than page size)');
        hasMore = false;
      }

      startRow += RESULTS_PER_PAGE;

      // Be polite - wait before next request
      if (hasMore) {
        await sleep(DELAY_MS);
      }

      // Safety limit - stop after 100 pages to avoid infinite loops
      if (pageNum >= 100 && hasMore) {
        console.log('\n⚠️  Reached safety limit of 100 pages.');
        console.log('   Stopping to avoid potential issues.');
        console.log('   You can adjust this limit in the script if needed.\n');
        hasMore = false;
      }
    }

    console.log(`\n✅ Scraping complete!`);
    console.log(`📦 Total substances collected: ${allSubstances.length}\n`);

    // Save to JSON
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const outputPath = path.join(dataDir, 'gras-notices-scraped.json');
    fs.writeFileSync(outputPath, JSON.stringify(allSubstances, null, 2));

    console.log(`💾 Saved to: ${outputPath}`);
    console.log(`\n📝 Next step: Run 'node import-gras-data.js' to import into database`);
    console.log(`   (The import script will automatically use this file)\n`);

    return allSubstances;

  } catch (error) {
    console.error('\n❌ Error during scraping:', error.message);
    console.error('\nPartially scraped data:');
    console.error(`   Collected: ${allSubstances.length} substances before error`);

    if (allSubstances.length > 0) {
      const dataDir = path.join(__dirname, 'data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      const outputPath = path.join(dataDir, 'gras-notices-partial.json');
      fs.writeFileSync(outputPath, JSON.stringify(allSubstances, null, 2));
      console.error(`   💾 Saved partial data to: ${outputPath}`);
    }

    throw error;
  }
}

// Run the scraper
scrapeAll().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

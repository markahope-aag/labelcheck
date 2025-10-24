require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const pdfParse = require('pdf-parse-fork');

const pdfPath = 'C:\\Users\\markh\\Desktop\\CRNGrandfatherlist.pdf';

(async () => {
  try {
    console.log('Reading PDF:', pdfPath);
    const buffer = fs.readFileSync(pdfPath);

    console.log('Extracting text from PDF...');
    const data = await pdfParse(buffer);
    const text = data.text;

    console.log('\n=== RAW TEXT PREVIEW (first 2000 chars) ===');
    console.log(text.substring(0, 2000));
    console.log('\n=== END PREVIEW ===\n');

    // Save full text to file for analysis
    fs.writeFileSync('grandfather-list-raw.txt', text, 'utf8');
    console.log('Full text saved to: grandfather-list-raw.txt');

    console.log('\nTotal characters extracted:', text.length);
    console.log('Total lines:', text.split('\n').length);

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
})();

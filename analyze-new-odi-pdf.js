require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const pdfParse = require('pdf-parse-fork');

const pdfPath = 'G:\\My Drive\\Downloads\\FDA-2011-D-0376-1627_attachment_1.pdf';

(async () => {
  try {
    console.log('Reading PDF:', pdfPath);
    const buffer = fs.readFileSync(pdfPath);

    console.log('Extracting text from PDF...');
    const data = await pdfParse(buffer);
    const text = data.text;

    console.log('\n=== PDF METADATA ===');
    console.log('Pages:', data.numpages);
    console.log('Total characters:', text.length.toLocaleString());
    console.log('Total lines:', text.split('\n').length);

    console.log('\n=== FIRST 3000 CHARACTERS ===');
    console.log(text.substring(0, 3000));

    console.log('\n=== SEARCHING FOR KEY INDICATORS ===');

    // Check for UNPA
    const unpaMatches = text.match(/UNPA/gi);
    console.log('UNPA mentions:', unpaMatches?.length || 0);

    // Check for CRN
    const crnMatches = text.match(/CRN/gi);
    console.log('CRN mentions:', crnMatches?.length || 0);

    // Check for "Old Dietary Ingredient" or similar
    const odiMatches = text.match(/old dietary ingredient/gi);
    console.log('ODI mentions:', odiMatches?.length || 0);

    // Check for grandfathered
    const grandfatherMatches = text.match(/grandfather/gi);
    console.log('Grandfather mentions:', grandfatherMatches?.length || 0);

    // Save full text for analysis
    fs.writeFileSync('new-odi-pdf-raw.txt', text, 'utf8');
    console.log('\nFull text saved to: new-odi-pdf-raw.txt');

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
})();

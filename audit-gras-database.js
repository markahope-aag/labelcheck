const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function auditDatabase() {
  console.log('🔍 Auditing GRAS Database for Quality Issues...\n');

  try {
    // Get all ingredients
    const { data: allIngredients, error } = await supabase.from('gras_ingredients').select('*');

    if (error) throw error;

    console.log(`📊 Total ingredients in database: ${allIngredients.length}\n`);

    // Check for duplicates by ingredient name
    console.log('🔍 Checking for duplicate ingredient names...');
    const nameCount = {};
    const duplicateNames = [];

    allIngredients.forEach((ing) => {
      const name = ing.ingredient_name.toLowerCase().trim();
      nameCount[name] = (nameCount[name] || 0) + 1;
      if (nameCount[name] === 2) {
        duplicateNames.push(name);
      }
    });

    if (duplicateNames.length > 0) {
      console.log(`   ⚠️  Found ${duplicateNames.length} duplicate ingredient names:`);
      duplicateNames.slice(0, 10).forEach((name) => {
        const matches = allIngredients.filter(
          (i) => i.ingredient_name.toLowerCase().trim() === name
        );
        console.log(`      • "${matches[0].ingredient_name}" (${nameCount[name]} times)`);
        matches.forEach((m, idx) => {
          console.log(
            `        ${idx + 1}. ID: ${m.id}, Status: ${m.gras_status}, Source: ${m.source_reference}`
          );
        });
      });
      if (duplicateNames.length > 10) {
        console.log(`      ... and ${duplicateNames.length - 10} more`);
      }
    } else {
      console.log('   ✅ No duplicate ingredient names found\n');
    }

    // Check for duplicates by GRN number
    console.log('🔍 Checking for duplicate GRN numbers...');
    const grnCount = {};
    const duplicateGRNs = [];

    allIngredients
      .filter((ing) => ing.gras_notice_number)
      .forEach((ing) => {
        const grn = ing.gras_notice_number.toUpperCase().trim();
        grnCount[grn] = (grnCount[grn] || 0) + 1;
        if (grnCount[grn] === 2) {
          duplicateGRNs.push(grn);
        }
      });

    if (duplicateGRNs.length > 0) {
      console.log(`   ⚠️  Found ${duplicateGRNs.length} duplicate GRN numbers:`);
      duplicateGRNs.slice(0, 10).forEach((grn) => {
        const matches = allIngredients.filter(
          (i) => i.gras_notice_number && i.gras_notice_number.toUpperCase().trim() === grn
        );
        console.log(`      • ${grn} (${grnCount[grn]} times)`);
        matches.forEach((m, idx) => {
          console.log(`        ${idx + 1}. "${m.ingredient_name}" (ID: ${m.id})`);
        });
      });
      if (duplicateGRNs.length > 10) {
        console.log(`      ... and ${duplicateGRNs.length - 10} more`);
      }
    } else {
      console.log('   ✅ No duplicate GRN numbers found\n');
    }

    // Check for empty or null required fields
    console.log('🔍 Checking for missing required fields...');
    const missingName = allIngredients.filter(
      (i) => !i.ingredient_name || i.ingredient_name.trim() === ''
    );
    const missingStatus = allIngredients.filter((i) => !i.gras_status);
    const missingCategory = allIngredients.filter((i) => !i.category);

    if (missingName.length > 0) {
      console.log(`   ⚠️  ${missingName.length} ingredients missing name`);
    }
    if (missingStatus.length > 0) {
      console.log(`   ⚠️  ${missingStatus.length} ingredients missing GRAS status`);
    }
    if (missingCategory.length > 0) {
      console.log(`   ⚠️  ${missingCategory.length} ingredients missing category`);
    }
    if (missingName.length === 0 && missingStatus.length === 0 && missingCategory.length === 0) {
      console.log('   ✅ All required fields are populated\n');
    } else {
      console.log('');
    }

    // Check for suspicious patterns
    console.log('🔍 Checking for suspicious patterns...');
    const suspiciousChars = allIngredients.filter((i) => /[<>{}[\]\\|`~]/.test(i.ingredient_name));
    const tooLong = allIngredients.filter((i) => i.ingredient_name.length > 200);
    const tooShort = allIngredients.filter((i) => i.ingredient_name.length < 2);

    if (suspiciousChars.length > 0) {
      console.log(`   ⚠️  ${suspiciousChars.length} ingredients with suspicious characters`);
      suspiciousChars.slice(0, 5).forEach((i) => {
        console.log(`      • "${i.ingredient_name}"`);
      });
    }
    if (tooLong.length > 0) {
      console.log(`   ⚠️  ${tooLong.length} ingredients with names > 200 chars`);
      tooLong.slice(0, 3).forEach((i) => {
        console.log(`      • "${i.ingredient_name.substring(0, 80)}..."`);
      });
    }
    if (tooShort.length > 0) {
      console.log(`   ⚠️  ${tooShort.length} ingredients with names < 2 chars`);
    }
    if (suspiciousChars.length === 0 && tooLong.length === 0 && tooShort.length === 0) {
      console.log('   ✅ No suspicious patterns detected\n');
    } else {
      console.log('');
    }

    // Category distribution
    console.log('📊 Category Distribution:');
    const categoryCount = {};
    allIngredients.forEach((i) => {
      categoryCount[i.category] = (categoryCount[i.category] || 0) + 1;
    });
    const sortedCategories = Object.entries(categoryCount).sort((a, b) => b[1] - a[1]);

    console.log(`   Total categories: ${sortedCategories.length}`);
    console.log('   Top 10:');
    sortedCategories.slice(0, 10).forEach(([cat, count]) => {
      console.log(`      ${cat}: ${count}`);
    });
    console.log('');

    // Status distribution
    console.log('📊 GRAS Status Distribution:');
    const statusCount = {};
    allIngredients.forEach((i) => {
      statusCount[i.gras_status] = (statusCount[i.gras_status] || 0) + 1;
    });
    Object.entries(statusCount)
      .sort((a, b) => b[1] - a[1])
      .forEach(([status, count]) => {
        console.log(`   ${status}: ${count}`);
      });
    console.log('');

    // Summary
    console.log('📋 Summary:');
    const issues = [];
    if (duplicateNames.length > 0) issues.push(`${duplicateNames.length} duplicate names`);
    if (duplicateGRNs.length > 0) issues.push(`${duplicateGRNs.length} duplicate GRNs`);
    if (missingName.length > 0) issues.push(`${missingName.length} missing names`);
    if (missingStatus.length > 0) issues.push(`${missingStatus.length} missing status`);
    if (missingCategory.length > 0) issues.push(`${missingCategory.length} missing category`);
    if (suspiciousChars.length > 0) issues.push(`${suspiciousChars.length} suspicious chars`);

    if (issues.length === 0) {
      console.log('   ✅ Database is clean - no issues detected!');
    } else {
      console.log(`   ⚠️  Found ${issues.length} issue(s):`);
      issues.forEach((issue) => console.log(`      • ${issue}`));
    }
  } catch (error) {
    console.error('❌ Audit failed:', error);
    process.exit(1);
  }
}

auditDatabase();

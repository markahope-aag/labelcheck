import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { getActiveRegulatoryDocuments, buildRegulatoryContext, getRecommendedDocuments } from '@/lib/regulatory-documents';
import { sendEmail } from '@/lib/resend';
import { generateAnalysisResultEmail } from '@/lib/email-templates';
import { preprocessImage } from '@/lib/image-processing';
import { createSession, addIteration } from '@/lib/session-helpers';
import { checkGRASCompliance } from '@/lib/gras-helpers';
import { checkNDICompliance } from '@/lib/ndi-helpers';
import { checkIngredientsForAllergens } from '@/lib/allergen-helpers';
import { processPdfForAnalysis } from '@/lib/pdf-helpers';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let user = await supabase
      .from('users')
      .select('id, email')
      .eq('clerk_user_id', userId)
      .maybeSingle()
      .then(res => res.data);

    // If user doesn't exist in Supabase, create them (fallback for webhook issues)
    if (!user) {
      try {
        const client = await clerkClient();
        const clerkUser = await client.users.getUser(userId);
        const userEmail = clerkUser?.emailAddresses?.[0]?.emailAddress || '';

        if (!userEmail) {
          console.error('No email found for Clerk user:', userId);
          return NextResponse.json({ error: 'User email not found' }, { status: 400 });
        }

        // Use admin client to bypass RLS when creating user
        const { data: newUser, error: createError } = await supabaseAdmin
          .from('users')
          .insert({
            clerk_user_id: userId,
            email: userEmail,
          })
          .select('id, email')
          .single();

        if (createError) {
          console.error('Error creating user in Supabase:', createError);
          return NextResponse.json({
            error: `Failed to create user record: ${createError.message}`
          }, { status: 500 });
        }

        if (!newUser) {
          console.error('User creation returned no data');
          return NextResponse.json({ error: 'Failed to create user record' }, { status: 500 });
        }

        user = newUser;
        console.log('Successfully created user:', newUser.id);
      } catch (err: any) {
        console.error('Exception creating user:', err);
        return NextResponse.json({
          error: `Failed to create user: ${err.message}`
        }, { status: 500 });
      }
    }

    const currentMonth = new Date().toISOString().slice(0, 7);

    const { data: usage } = await supabase
      .from('usage_tracking')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', currentMonth)
      .maybeSingle();

    if (!usage) {
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('plan_tier, status')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      const limits: Record<string, number> = {
        basic: 10,
        pro: 100,
        enterprise: -1,
      };

      const planTier = subscription?.plan_tier || 'basic';
      const limit = limits[planTier] || 5;

      const { error: usageError } = await supabase.from('usage_tracking').insert({
        user_id: user.id,
        month: currentMonth,
        analyses_used: 0,
        analyses_limit: limit,
      });

      if (usageError) {
        console.error('Error creating usage tracking:', usageError);
      }
    }

    const { data: currentUsage } = await supabase
      .from('usage_tracking')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', currentMonth)
      .maybeSingle();

    if (!currentUsage) {
      return NextResponse.json({ error: 'Failed to track usage' }, { status: 500 });
    }

    // Check if user is an admin - admins have unlimited access
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);
    const isAdmin = clerkUser?.publicMetadata?.role === 'admin';

    // Only enforce limits for non-admin users
    if (
      !isAdmin &&
      currentUsage.analyses_limit !== -1 &&
      currentUsage.analyses_used >= currentUsage.analyses_limit
    ) {
      return NextResponse.json(
        { error: 'Monthly analysis limit reached. Please upgrade your plan.' },
        { status: 429 }
      );
    }

    const formData = await request.formData();
    const imageFile = formData.get('image') as File;
    const existingSessionId = formData.get('sessionId') as string | null;

    if (!imageFile) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    // Handle session creation or use existing session
    let sessionId = existingSessionId;
    let session = null;

    if (!sessionId) {
      // Create a new session for this analysis
      const productHint = imageFile.name.replace(/\.[^/.]+$/, ''); // Remove extension
      const { data: newSession, error: sessionError } = await createSession(
        user.id,
        `Analysis: ${productHint}`,
        true // use admin
      );

      if (sessionError || !newSession) {
        console.error('Error creating session:', sessionError);
        // Don't fail the analysis if session creation fails
        // The analysis will work without a session (backward compatible)
      } else {
        session = newSession;
        sessionId = newSession.id;
        console.log('Created new session:', sessionId);
      }
    }

    console.log('📥 Processing image file...');
    const bytes = await imageFile.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Detect if this is a PDF or image
    const isPdf = imageFile.type === 'application/pdf';
    let base64Data: string | undefined;
    let pdfTextContent: string | undefined;
    let mediaType: 'image/jpeg' | 'image/png' = 'image/jpeg'; // Default
    let contentType: 'image' | 'document' | 'text';

    if (isPdf) {
      // Hybrid PDF processing: text extraction first, CloudConvert fallback
      const pdfResult = await processPdfForAnalysis(buffer);

      if (pdfResult.type === 'text') {
        // Text extraction successful
        pdfTextContent = pdfResult.content as string;
        contentType = 'text';
        console.log(`✅ Using extracted text (${pdfTextContent.length} characters)`);
      } else {
        // CloudConvert converted PDF to image
        const imageBuffer = pdfResult.content as Buffer;
        base64Data = imageBuffer.toString('base64');
        mediaType = 'image/jpeg';
        contentType = 'document';
        console.log('✅ Using CloudConvert image conversion');
      }
    } else {
      console.log('🖼️ Preprocessing image...');
      // For images, preprocess to improve readability
      const processedBuffer = await preprocessImage(buffer);
      base64Data = processedBuffer.toString('base64');
      mediaType = 'image/jpeg';
      contentType = 'image';
      console.log('✅ Image preprocessed');
    }

    console.log('📚 Fetching regulatory documents...');
    let regulatoryDocuments;
    let ragInfo = null;

    if (pdfTextContent) {
      // RAG lite for PDFs - filter by pre-classified category
      const { documents, preClassifiedCategory, documentCount, totalCount } =
        await getRecommendedDocuments(pdfTextContent);
      regulatoryDocuments = documents;
      ragInfo = { preClassifiedCategory, documentCount, totalCount };
      console.log(`✅ RAG Lite: Loaded ${documentCount}/${totalCount} documents for ${preClassifiedCategory}`);
    } else {
      // Fallback for images - load all documents (can't pre-classify without text)
      regulatoryDocuments = await getActiveRegulatoryDocuments();
      console.log(`✅ Loaded all ${regulatoryDocuments.length} documents (image mode)`);
    }

    const regulatoryContext = buildRegulatoryContext(regulatoryDocuments);

    // Separate cached context from dynamic prompt
    const analysisInstructions = `You are a labeling regulatory compliance expert. Analyze this label ${isPdf ? 'PDF document' : 'image'} and provide a comprehensive evaluation of its compliance with FDA and USDA labeling requirements based on the regulatory documents provided above.

**STEP 1: PRODUCT CATEGORY CLASSIFICATION**

Before performing the detailed compliance analysis, you MUST first determine which regulatory category this product falls into. This is CRITICAL because different product categories have entirely different regulatory requirements.

**🔍 PRIMARY CLASSIFICATION RULE - CHECK PANEL TYPE FIRST:**
- If label has **"Supplement Facts" panel** → DIETARY_SUPPLEMENT (regardless of product type)
- If label has **"Nutrition Facts" panel** → NOT a supplement (classify as FOOD, BEVERAGE, or ALCOHOLIC_BEVERAGE)
- **Panel type is the definitive regulatory indicator** - it overrides ingredients, claims, and marketing

Classify the product into ONE of these four categories based on the following criteria:

1. **DIETARY_SUPPLEMENT** - Select this ONLY if:
   - **REQUIRED:** Has a "Supplement Facts" panel (NOT "Nutrition Facts")
   - **OR:** Label explicitly states "dietary supplement"
   - **WARNING:** Do NOT classify as supplement just because it contains vitamins, minerals, collagen, protein, etc.
   - **WARNING:** Do NOT classify as supplement just because it makes health claims
   - **IF IT HAS NUTRITION FACTS PANEL:** It is NOT a dietary supplement (even if fortified or makes claims)

2. **ALCOHOLIC_BEVERAGE** - Select this if ANY of these are true:
   - Contains alcohol ≥0.5% ABV (alcohol by volume)
   - Label shows "% ALC BY VOL" or "PROOF"
   - Has TTB (Alcohol and Tobacco Tax and Trade Bureau) approval number or statement
   - Is beer, wine, spirits, hard seltzer, malt beverage, or alcoholic kombucha
   - Contains government warning about alcohol consumption and pregnancy
   - **EDGE CASE:** Non-alcoholic beer (<0.5% ABV) = NON_ALCOHOLIC_BEVERAGE
   - **EDGE CASE:** Kombucha 0.5-2% ABV = ALCOHOLIC_BEVERAGE (TTB regulated)

3. **NON_ALCOHOLIC_BEVERAGE** - Select this if ALL of these are true:
   - Ready-to-drink liquid marketed as a BEVERAGE for refreshment/hydration
   - Statement of identity includes: "beverage," "drink," "juice," "soda," "tea," "energy drink," "sports drink," "soft drink"
   - Contains <0.5% alcohol OR no alcohol
   - NOT a dietary supplement (no "supplement facts")
   - **PRIMARY PURPOSE:** Refreshment, hydration, or enjoyment (NOT meal replacement)
   - **IMPORTANT:** Serving size typically in fl oz

   **Examples:** Coca-Cola, orange juice, Red Bull, Gatorade, bottled tea, bottled coffee drinks
   **NOT beverages:** Milk, drinkable yogurt, soup, broth, meal replacement shakes (these are FOOD)

4. **CONVENTIONAL_FOOD** - Select this if NONE of the above apply:
   - Standard packaged foods (snacks, cereals, baked goods, frozen meals, etc.)
   - Condiments, sauces, seasonings
   - Fresh or processed meats, poultry, seafood
   - **ALL DAIRY PRODUCTS:** Milk, cheese, yogurt, butter, cream, ice cream, drinkable yogurt, chocolate milk
   - Soups, broths, bouillon (even though liquid)
   - Infant formula and baby food
   - Coffee beans, ground coffee, tea leaves (not ready-to-drink)
   - Any food product that doesn't fit the other three categories

   **KEY DISTINCTION - Food vs Beverage:**
   - Dairy liquids (milk, drinkable yogurt) = FOOD (even though drinkable)
   - Soups/broths = FOOD (nutritional purpose, not refreshment)
   - Meal replacement liquids = FOOD or SUPPLEMENT (depends on Supplement Facts panel)
   - The differentiator is MARKETING/PURPOSE: refreshment vs nutrition/meal

**CRITICAL CLASSIFICATION EDGE CASES:**

- **Protein bars/shakes:** If has Supplement Facts = DIETARY_SUPPLEMENT, if Nutrition Facts = CONVENTIONAL_FOOD
- **Fortified beverages:** If ready-to-drink + marketed as beverage = NON_ALCOHOLIC_BEVERAGE (even with added vitamins)
- **Drinkable yogurt/kefir:** Always CONVENTIONAL_FOOD (dairy product, not beverage)
- **Kombucha:** Check ABV - if ≥0.5% = ALCOHOLIC_BEVERAGE, if <0.5% = NON_ALCOHOLIC_BEVERAGE
- **Energy shots:** If Supplement Facts = DIETARY_SUPPLEMENT, if Nutrition Facts = NON_ALCOHOLIC_BEVERAGE
- **Coffee (ready-to-drink, bottled/canned):** NON_ALCOHOLIC_BEVERAGE (unless supplement facts)
- **Coffee (dry grounds, pods, instant, beans):** CONVENTIONAL_FOOD (unless supplement facts)
- **Herbal tea (ready-to-drink, bottled):** NON_ALCOHOLIC_BEVERAGE (unless supplement facts)
- **Herbal tea (dry leaves, tea bags):** CONVENTIONAL_FOOD (unless supplement facts)

**STEP 2: CLASSIFICATION CONFIDENCE & AMBIGUITY DETECTION**

After determining the category, evaluate your confidence and check for ambiguity:

**A. CONFIDENCE LEVEL:**
- **HIGH (90-100%):** Multiple clear indicators, no conflicting evidence
  - Example: Label states "Dietary Supplement" + has Supplement Facts + makes structure/function claim
  - Example: Shows 5% ABV + government warning + TTB number
- **MEDIUM (60-89%):** Some indicators present but missing key elements OR minor conflicts
  - Example: Contains vitamins/protein but has Nutrition Facts (could be food OR supplement)
  - Example: Ready-to-drink liquid but unclear if beverage or meal replacement
- **LOW (<60%):** Conflicting indicators or insufficient information
  - Example: Has Supplement Facts panel but no "dietary supplement" statement
  - Example: Makes health claims but labeled as conventional food

**B. AMBIGUITY CHECK - Could this product fit ANOTHER category?**

Check if the product could reasonably be classified differently:

**🚨 CRITICAL AMBIGUITY DETECTION REQUIREMENTS 🚨**

**STOP AND CHECK - You MUST flag as ambiguous if ANY of these are true:**

✋ **MANDATORY AMBIGUITY TRIGGER #1:**
- Product has **Nutrition Facts panel** (not Supplement Facts)
- **AND** contains ANY of these ingredients: collagen, biotin, vitamins, minerals, protein powder, amino acids, herbal extracts, probiotics, omega-3, CoQ10
- **EXAMPLE:** Coffee with Nutrition Facts + collagen + biotin = **MUST BE AMBIGUOUS**
- **ACTION:** Set is_ambiguous: true, list both CONVENTIONAL_FOOD/NON_ALCOHOLIC_BEVERAGE (based on panel) AND DIETARY_SUPPLEMENT (based on ingredients) as options

✋ **MANDATORY AMBIGUITY TRIGGER #2:**
- Product has **Nutrition Facts panel** (not Supplement Facts)
- **AND** makes ANY health/structure/function claims using words like: supports, promotes, boosts, enhances, strengthens, improves, helps, benefits (skin, hair, joints, immunity, etc.)
- **EXAMPLE:** Beverage with Nutrition Facts + "supports skin health" claim = **MUST BE AMBIGUOUS**
- **ACTION:** Set is_ambiguous: true, explain that health claims suggest supplement but panel says food/beverage

✋ **MANDATORY AMBIGUITY TRIGGER #3:**
- Panel type (Nutrition Facts vs Supplement Facts) **conflicts** with ingredients or marketing
- **EXAMPLE:** Has Supplement Facts but sold as "protein bar" = **MUST BE AMBIGUOUS**

**REAL-WORLD AMBIGUOUS PRODUCT EXAMPLES:**
1. **Coffee pods with collagen + Nutrition Facts** ← THIS EXACT SCENARIO
   - Panel says: CONVENTIONAL_FOOD or NON_ALCOHOLIC_BEVERAGE
   - Ingredients say: DIETARY_SUPPLEMENT (has collagen, biotin, vitamins)
   - **YOU MUST FLAG THIS AS AMBIGUOUS** with both categories as options

2. **Energy drink with vitamins + Nutrition Facts**
   - Could be NON_ALCOHOLIC_BEVERAGE or DIETARY_SUPPLEMENT

3. **Protein shake with Nutrition Facts**
   - Could be CONVENTIONAL_FOOD (meal replacement) or DIETARY_SUPPLEMENT

**If you flag as ambiguous (which you MUST for above scenarios), you MUST:**
1. Set "is_ambiguous: true"
2. Set "category_confidence" to "medium" or "low" (NEVER "high" if ambiguous)
3. List "alternative_categories" with clear rationale for EACH option
4. Fill out "category_options" with guidance for ALL viable categories
5. Explain the conflict in "ambiguity_reason"

**STEP 3: CATEGORY OPTIONS & GUIDANCE** (Required if ambiguous OR confidence < HIGH)

For EACH viable category (detected + alternatives), provide:

1. **Current Label Compliance:** Is the current label configuration compliant for this category?
2. **Required Changes:** What MUST change to be compliant in this category?
3. **Allowed Claims:** What can the manufacturer say/claim in this category?
4. **Prohibited Claims:** What is NOT allowed in this category?
5. **Pros & Cons:** Trade-offs of choosing this category
6. **Recommendation:** Which category makes most sense given current label and likely manufacturer intent?

${isPdf ? `IMPORTANT INSTRUCTIONS FOR READING THE PDF:
This is a PDF of a label design mockup. READ THE TEXT from this PDF carefully and analyze it for compliance. The PDF may have complex design elements:
- Text in various orientations (rotated, vertical, sideways, upside-down)
- Small fonts (ingredient lists, fine print, legal text)
- Text on complex backgrounds or with overlays
- Multiple colors and fonts with varying contrast
- Poor contrast or faded text
- Text wrapping around design elements
- Decorative fonts that may be harder to read

Extract all visible text from the PDF and analyze for regulatory compliance. Take your time to examine every section of the label design thoroughly, including any rotated or vertically-oriented text.` : `IMPORTANT INSTRUCTIONS FOR READING THE IMAGE:
- The text on this label may be very small, difficult to read, or have poor contrast
- Text may be oriented vertically, sideways, or even upside-down
- If you encounter rotated text, mentally rotate the image to read it correctly
- Look very carefully at all text, including fine print and small ingredient lists
- If text is blurry or unclear, use context clues from surrounding text to decipher it
- Pay special attention to ingredient lists which are often in very small font
- Some labels may have text on dark backgrounds or vice versa - adjust your reading accordingly
- Take your time to examine every section of the label thoroughly
- If certain information is genuinely illegible, note that in your analysis`}

ANALYSIS STRUCTURE REQUIREMENTS:

Your analysis must follow this exact structure and evaluate each regulatory category:

1. **General Labeling Requirements**: Evaluate the label against basic FDA/USDA requirements
   - Statement of Identity (Name of Food): Is the product name clear, prominent, and on the principal display panel?
     **🚨 MISLEADING MARKETING TERMS CHECK**: The product name or prominent label text contains ANY of these FDA-discouraged marketing terms, flag as potential violation:
     • "Superfood" - Not a defined term by FDA; generally considered misleading
     • "Detox" or "Cleanse" - Implies disease treatment without approval
     • "Miracle" - Exaggerated, unsubstantiated claim
     • "Cure" or "Treat" - Drug claims prohibited on foods/supplements
     If found, add recommendation: "Remove misleading marketing term '[term]' from product name/labeling. This term is not defined by FDA and may constitute a misleading claim that could violate FD&C Act Section 403(a)."
   - Net Quantity of Contents: Is it properly declared in both US Customary and metric units? Is it in the bottom 30% of the display panel? **IMPORTANT:** Either US customary OR metric may appear first - both orders are FDA compliant (e.g., "15 oz (425 g)" OR "425 g (15 oz)" are both acceptable). The secondary measurement should appear in parentheses.
   - Name and Address of Manufacturer/Distributor: Is the manufacturer or distributor clearly listed with complete address? Are qualifying phrases like "distributed by" used correctly?

2. **Ingredient Labeling**: Review ingredient declaration compliance
   - **🚨 CRITICAL FOR DIETARY SUPPLEMENTS**: For supplements, extract ALL active ingredients from the Supplement Facts panel (including proprietary blends) IN ADDITION TO the separate ingredient list. Both sources must be included in ingredients_list array.
   - **WHERE TO FIND INGREDIENTS**:
     • Dietary Supplements: Look in BOTH the "Supplement Facts" panel (active ingredients) AND the "Other Ingredients" or "Ingredients" list below the panel
     • Conventional Foods: Look for "Ingredients:" list (usually below Nutrition Facts panel or elsewhere on label)
   - List and Order: Are ingredients listed in descending order of predominance by weight?
   - Flavor Declaration: Are artificial flavors, natural flavors, and spices properly declared?
   - Specific Ingredient Requirements: Are colors specifically named? Are preservatives listed with their function?

3. **Food Allergen Labeling Requirements (FALCPA/FASTER Act)**: Critical compliance check
   - **APPLIES TO ALL PRODUCTS**: Allergen labeling requirements apply to ALL foods including dietary supplements per FALCPA Section 403(w)
   - Major Food Allergens (MFAs): The nine major allergens are: Milk, Egg, Fish, Crustacean shellfish, Tree nuts, Wheat, Peanuts, Soybeans, and Sesame
   - **STEP 1**: Identify if ANY of the 9 MFAs are actually present in the ingredients list
   - **STEP 2**: IF NO allergens are present in ingredients → status: "compliant", potential_allergens: [], risk_level: "low", details: "No major food allergens detected in ingredients. Product is compliant with FALCPA as there are no allergens to declare."
   - **STEP 3**: IF allergens ARE present → Check if there's a "Contains" statement OR parenthetical declarations
   - **STEP 4**: Use conditional language for ambiguous ingredients - "IF ingredient X contains [allergen], THEN declaration is required"
   - **🚨 ABSOLUTE RULE**: ONLY use "potentially_non_compliant" or "non_compliant" if you have CONFIRMED that allergens ARE PRESENT in the ingredients. Do NOT use these statuses based on hypothetical scenarios like "if allergens were present". If ZERO allergens are detected, status MUST be "compliant".
   - **NEVER use "not_applicable" status** - even if no allergens are present, the status should be "compliant" (meaning compliant with FALCPA because no allergens to declare)

**IF product_category is DIETARY_SUPPLEMENT, your analysis MUST include these sections in order:**

4. **Supplement Facts Panel**: Evaluate the dietary supplement panel compliance
   - **REQUIRED PANEL**: Label MUST have a "Supplement Facts" panel (21 CFR 101.36), supplements do NOT have exemptions
   - **CHECK FOR WRONG PANEL TYPE**:
     • Does label show "Nutrition Facts" panel? If YES → Status = NON-COMPLIANT, explanation = "Dietary supplements must use Supplement Facts panel, not Nutrition Facts panel per 21 CFR 101.36"
     • Does label show "Supplement Facts" panel? If NO → Status = NON-COMPLIANT, explanation = "Supplement Facts panel is required but missing"
   - **IF CORRECT PANEL TYPE PRESENT** (Supplement Facts), validate:
     • Serving size clearly stated
     • Amount per serving listed for each dietary ingredient
     • % Daily Value (DV) shown for vitamins/minerals with established DVs
     • Proprietary blend disclosures (if applicable)
     • Format compliance (title, headings, layout per 21 CFR 101.36)
   - **DO NOT validate Nutrition Facts rounding rules** on a Supplement Facts panel (different requirements)
   - Set panel_present: true/false, panel_type_correct: true/false, exemption_applicable: false

5. **Claims**: Evaluate all claims made on the supplement label
   - **🚨 CRITICAL**: Scan the ENTIRE label for claims - including front panel, side panels, and any promotional text. Look for subtle marketing language.
   - **Structure/Function Claims**: Look for claims about body functions - these can be ANYWHERE on the label:
     • **Common Examples**: "supports immune health", "promotes joint function", "enhances energy", "boosts performance", "increases stamina", "improves vitality"
     • **Sexual/Performance Claims**: "enhances pleasure", "improves performance", "increases intensity", "boosts libido", "sexual energy", "stamina", "endurance"
     • **Energy/Athletic Claims**: "pre-workout", "post-workout", "muscle recovery", "athletic performance", "endurance"
     • List ALL S/F claims found (check product name, taglines, front panel text, side panel descriptions)
     • Verify substantiation requirements
     • Check for required disclaimer: "This statement has not been evaluated by the FDA. This product is not intended to diagnose, treat, cure, or prevent any disease."
   - **Nutrient Content Claims**: Look for claims about nutrient levels (e.g., "high in vitamin C", "good source of calcium")
     • Validate against regulatory definitions (high ≥20% DV, good source 10-19% DV)
   - **Health Claims**: Check if any FDA-authorized health claims are made (rare on supplements)
   - **Prohibited Claims**: Flag any disease treatment/cure claims (illegal for supplements)

6. **Additional Regulatory Considerations for Supplements**:
   - **DHEA Warning Requirements** (Anabolic Steroid Control Act of 2004):
     • **CHECK INGREDIENTS**: Search for "DHEA", "dehydroepiandrosterone", "prasterone" in ALL ingredients (Supplement Facts panel AND other ingredients list)
     • **IF DHEA IS PRESENT**, the label MUST include warning statement per 21 USC 353b:
       - Required warning text (verbatim): "DHEA is a prohormone. Not for use by individuals under the age of 18 years old. Do not use if pregnant or nursing. Consult a physician before using this or any dietary supplement."
       - Warning must be prominently displayed on label
     • **IF DHEA IS PRESENT BUT WARNING IS MISSING OR INCOMPLETE** → Mark as NON-COMPLIANT, high priority
     • **IF NO DHEA** → Status: COMPLIANT (not applicable)
   - **NDI (New Dietary Ingredient) Compliance**:
     • **IMPORTANT**: The database check will automatically validate ingredients against TWO databases:
       1. **Old Dietary Ingredients Database (2,193 ingredients)**: Pre-October 15, 1994 ingredients that are grandfathered and do NOT require NDI notifications
       2. **NDI Notifications Database (1,253 ingredients)**: Post-1994 ingredients that HAVE filed NDI notifications with FDA
     • **YOU DO NOT need to flag NDI issues in the AI analysis** - the database check handles this automatically
     • If asked about NDI in the AI prompt, note: "NDI compliance is automatically verified against FDA databases after analysis"
   - **Good Manufacturing Practices (cGMP)**: Note if relevant
   - **Other Supplement-Specific Requirements**: Product-specific labeling requirements

**IF product_category is CONVENTIONAL_FOOD, NON_ALCOHOLIC_BEVERAGE, or ALCOHOLIC_BEVERAGE, your analysis MUST include:**

4. **Nutrition Labeling**: Assess nutrition facts panel requirements and exemptions
   - **REQUIRED PANEL** (unless exempt): Label should have "Nutrition Facts" panel per 21 CFR 101.9
   - **CHECK FOR WRONG PANEL TYPE**:
     • Does label show "Supplement Facts" panel? If YES → Status = NON-COMPLIANT, explanation = "This panel type is only for dietary supplements. Food/beverage products must use Nutrition Facts panel."
     • Does label show "Nutrition Facts" panel? If NO → Check if exemption applies (see below)
   - **EXEMPTIONS CHECK** (if Nutrition Facts panel is missing):
     • Coffee, tea, spices with no added nutrients
     • Foods with no significant nutritional value
     • Foods in small packages
     • If exempt → Status = COMPLIANT, provide exemption reason
     • If NOT exempt → Status = NON-COMPLIANT
   - **IF NUTRITION FACTS PANEL PRESENT**, validate rounding rules:
     • Calories: <5 cal must be "0" or "5"
     • Fiber/Protein/Fat/Carbs: <0.5g must be "0g"
     • Cholesterol: <2mg must be "0mg", round to nearest 5mg
     • Sodium: <5mg must be "0mg", round to 5mg or 10mg
     • Flag violations as NON-COMPLIANT

5. **Claims**: Evaluate all claims made on the food/beverage label
   - **Nutrient Content Claims** (e.g., "low fat", "high fiber", "fortified"):
     • List ALL claims found
     • Validate against definitions (21 CFR 101.13, 101.54, 101.62)
     • Example: "High" requires ≥20% DV, "Good Source" requires 10-19% DV
   - **Health Claims**: Check for FDA-authorized health claims (e.g., "calcium reduces risk of osteoporosis")
     • Verify claim is authorized and properly worded
   - **Structure/Function Claims**: Generally not allowed on conventional foods (only supplements)
     • If found, flag as potential violation
   - **Prohibited Claims**: Flag any disease treatment/cure claims (illegal)

6. **Additional Regulatory Considerations**: Evaluate any other applicable requirements

   **🚨 FORTIFICATION POLICY COMPLIANCE - CRITICAL CHECK:**

   **⚠️ IMPORTANT**: FDA Fortification Policy (21 CFR 104) ONLY applies to CONVENTIONAL FOODS and BEVERAGES.
   **DO NOT apply fortification policy to DIETARY SUPPLEMENTS** - they are regulated under DSHEA, not 21 CFR 104.

   IF product_category is CONVENTIONAL_FOOD, NON_ALCOHOLIC_BEVERAGE, or ALCOHOLIC_BEVERAGE:
   If the label uses terms "enriched", "fortified", "added", "with added X", or lists added vitamins/minerals:

   A. **Check Product is Appropriate Vehicle for Fortification:**
   - **INAPPROPRIATE VEHICLES** (flag as potential violation):
     • Coffee (plain or flavored) - minimal nutritional value
     • Tea (plain or flavored) - minimal nutritional value
     • Candy, gum - primarily sugar, not nutrient-dense
     • Carbonated beverages, soft drinks - not nutrient-dense
     • Snack foods (chips, pretzels, cookies) - high cal, low nutrients

   - **APPROPRIATE VEHICLES**:
     • Bread, flour, cereals - staple foods
     • Milk and dairy products - naturally nutrient-dense
     • Fruit juices - naturally contain nutrients
     • Meal replacement products - intended as nutrition source

   B. **Fortification Policy Violations to Flag:**
   - "Enriched" or "Fortified" claims on coffee/tea/soda
   - Adding 100% DV of vitamins to products with <50 calories
   - Fortifying products with no significant nutritional value
   - Adding nutrients solely to make misleading nutrient content claims

   C. **What to Report:**
   - If inappropriate vehicle: Mark as NON-COMPLIANT, cite FDA fortification policy
   - Explain: "Fortifying [product type] with [nutrients] may violate FDA fortification policy which discourages fortifying non-nutrient-dense foods"
   - Reference: 21 CFR 104 (Nutritional Quality Guidelines), FDA Fortification Policy

   **📢 CLAIMS DETECTION & VALIDATION:**

   D. **Structure/Function (S/F) Claims - MUST DETECT & ANALYZE:**
   Look for claims about what a nutrient or ingredient does in the body:
   - Words to detect: "supports", "promotes", "boosts", "enhances", "strengthens", "improves", "helps", "benefits", "contributes to", "maintains"
   - Body functions: "immune health", "skin health", "hair health", "joint function", "bone strength", "energy", "metabolism", "digestion", "heart health"

   **Examples of S/F claims:**
   - "Biotin contributes to normal skin health"
   - "Selenium supports hair health"
   - "Zinc helps protect cells from oxidative stress"
   - "Supports immune function"

   **Validation Requirements:**
   - S/F claims must be truthful and not misleading
   - Nutrient levels must support the claim (generally ≥10% DV)
   - Cannot imply disease treatment/cure
   - List ALL S/F claims found on the label

   E. **Nutrient Content Claims (NCCs) - MUST DETECT & VALIDATE:**
   Look for claims about nutrient levels in the product:

   **Common NCCs to detect:**
   - "Enriched", "Fortified" - implies ≥10% more DV than reference food
   - "High", "Rich in", "Excellent source" - requires ≥20% DV per serving
   - "Good source", "Contains", "Provides" - requires 10-19% DV per serving
   - "More", "Enriched", "Fortified", "Added" - requires ≥10% more than reference
   - "Free" (fat-free, sugar-free) - must have <0.5g per serving
   - "Low" (low fat, low sodium) - specific thresholds apply
   - "Reduced", "Less", "Fewer" - must be 25% less than reference

   **Validation Requirements:**
   - Check if nutrient levels meet the definition
   - Example: "High in Zinc" requires ≥20% DV of Zinc per serving
   - If claim is made but level doesn't meet definition = NON-COMPLIANT
   - List ALL NCCs found and whether they meet regulatory definitions

   F. **Other Special Labeling:**
   - Date labeling, caffeine disclosure, organic claims, etc.
   - Product-Specific Requirements: Based on product type (beverage, coffee, meat, etc.)

6. **Summary Compliance Table**: Provide a structured summary

Return your response as a JSON object with the following structure:
{
  "product_name": "Name of the product from the label",
  "product_type": "Type of product (e.g., 'Coffee', 'Snack Food', 'Beverage', 'Packaged Meal')",
  "product_category": "MUST be one of: DIETARY_SUPPLEMENT | ALCOHOLIC_BEVERAGE | NON_ALCOHOLIC_BEVERAGE | CONVENTIONAL_FOOD (determined from STEP 1)",
  "category_rationale": "Brief explanation of why this category was selected (2-3 sentences citing specific label elements)",
  "category_confidence": "high|medium|low (from STEP 2)",
  "category_ambiguity": {
    "is_ambiguous": true|false,
    "alternative_categories": ["Array of other viable categories if ambiguous"],
    "ambiguity_reason": "Explanation of why multiple categories could apply",
    "label_conflicts": [
      {
        "severity": "critical|high|medium|low",
        "conflict": "Description of the conflict",
        "current_category": "Category as detected",
        "violation": "What regulation is violated"
      }
    ]
  },
  "category_options": {
    "DETECTED_CATEGORY_NAME": {
      "current_label_compliant": true|false,
      "required_changes": ["List of changes needed for compliance"],
      "allowed_claims": ["What claims/statements are permitted"],
      "prohibited_claims": ["What claims/statements are NOT allowed"],
      "regulatory_requirements": ["Key regulatory requirements for this category"],
      "pros": ["Advantages of choosing this category"],
      "cons": ["Disadvantages/restrictions of this category"]
    },
    "ALTERNATIVE_CATEGORY_NAME": {
      "...": "Same structure for each alternative category"
    }
  },
  "recommendation": {
    "suggested_category": "CATEGORY_NAME",
    "confidence": "high|medium|low",
    "reasoning": "Detailed explanation of recommendation",
    "key_decision_factors": ["Factor 1", "Factor 2", "Factor 3"]
  },
  "general_labeling": {
    "statement_of_identity": {
      "status": "compliant|non_compliant|not_applicable",
      "details": "Detailed explanation of findings",
      "regulation_citation": "Specific regulation (e.g., '21 CFR 101.3')"
    },
    "net_quantity": {
      "status": "compliant|non_compliant|not_applicable",
      "details": "Detailed explanation",
      "regulation_citation": "Specific regulation"
    },
    "manufacturer_address": {
      "status": "compliant|non_compliant|not_applicable",
      "details": "Detailed explanation",
      "regulation_citation": "Specific regulation"
    }
  },
  "ingredient_labeling": {
    "status": "compliant|non_compliant|not_applicable",
    "ingredients_list": ["ingredient1", "ingredient2", ...],
    "details": "Analysis of ingredient declaration compliance including order, naming, sub-ingredients",
    "regulation_citation": "21 CFR 101.4"
  },
  "allergen_labeling": {
    "status": "compliant|potentially_non_compliant (NEVER use not_applicable - use compliant if no allergens present)",
    "details": "Detailed analysis with conditional statements about potential allergen-containing ingredients",
    "potential_allergens": ["List of ingredients that may contain MFAs"],
    "has_contains_statement": true|false,
    "risk_level": "low|medium|high",
    "regulation_citation": "FALCPA Section 403(w), FASTER Act"
  },
  "supplement_facts_panel": {
    "note": "ONLY include this section if product_category is DIETARY_SUPPLEMENT",
    "status": "compliant|non_compliant",
    "panel_present": true|false,
    "panel_type_correct": true|false,
    "wrong_panel_issue": "Description if Nutrition Facts panel is present instead of Supplement Facts",
    "panel_compliance": {
      "serving_size_clear": true|false,
      "amount_per_serving_listed": true|false,
      "daily_values_shown": true|false,
      "format_compliant": true|false,
      "issues": ["List any format or content issues"]
    },
    "details": "Full explanation of Supplement Facts panel compliance",
    "regulation_citation": "21 CFR 101.36"
  },
  "nutrition_labeling": {
    "note": "ONLY include this section if product_category is CONVENTIONAL_FOOD, NON_ALCOHOLIC_BEVERAGE, or ALCOHOLIC_BEVERAGE",
    "status": "compliant|non_compliant|not_applicable",
    "panel_present": true|false,
    "panel_type_correct": true|false,
    "wrong_panel_issue": "Description if Supplement Facts panel is present instead of Nutrition Facts",
    "exemption_applicable": true|false,
    "exemption_reason": "Explanation if exemption applies (e.g., 'Coffee with no added nutrients qualifies for exemption')",
    "rounding_validation": {
      "has_errors": true|false,
      "errors_found": [
        {
          "nutrient": "Nutrient name (e.g., 'Calories', 'Fiber')",
          "declared_value": "Value shown on label",
          "required_value": "Correct value per FDA rounding rules",
          "rule_violated": "Explanation of rounding rule"
        }
      ]
    },
    "details": "Full explanation of nutrition labeling compliance or exemption",
    "regulation_citation": "21 CFR 101.9"
  },
  "claims": {
    "note": "ALWAYS include this section for ALL product types",
    "structure_function_claims": {
      "claims_present": true|false,
      "claims_found": [
        {
          "claim_text": "Exact text of claim from label",
          "compliance_issue": "Any compliance issue with this claim",
          "disclaimer_required": true|false,
          "disclaimer_present": true|false
        }
      ],
      "status": "compliant|non_compliant|not_applicable"
    },
    "nutrient_content_claims": {
      "claims_present": true|false,
      "claims_found": [
        {
          "claim_type": "Type of claim (e.g., 'high', 'good source', 'fortified')",
          "claim_text": "Exact text from label",
          "nutrient": "Nutrient being claimed",
          "nutrient_level": "% DV or amount per serving",
          "required_level": "Regulatory threshold",
          "meets_definition": true|false,
          "issue": "Any compliance issue"
        }
      ],
      "status": "compliant|non_compliant|not_applicable"
    },
    "health_claims": {
      "claims_present": true|false,
      "claims_found": ["List of health claims if any"],
      "status": "compliant|non_compliant|not_applicable"
    },
    "prohibited_claims": {
      "claims_present": true|false,
      "claims_found": ["List of disease/cure claims that are prohibited"],
      "status": "compliant|non_compliant|not_applicable"
    },
    "details": "Overall claims compliance analysis"
  },
  "additional_requirements": {
    "note": "Include fortification ONLY for conventional foods/beverages, NOT supplements",
    "fortification": {
      "status": "compliant|non_compliant|not_applicable",
      "is_fortified": true|false,
      "nutrients_added": ["List of added vitamins/minerals if any"],
      "fortification_claims": ["List of 'enriched'/'fortified' claims on label"],
      "vehicle_appropriate": true|false|null,
      "product_type": "Type of product (e.g., 'coffee', 'cereal', 'candy')",
      "policy_violation": {
        "present": true|false,
        "severity": "critical|high|medium|low",
        "issue": "Description of fortification policy violation",
        "reasoning": "Why this product is inappropriate vehicle for fortification"
      },
      "details": "Full analysis of fortification compliance and policy",
      "regulation_citation": "21 CFR 104, FDA Fortification Policy"
    },
    "other_requirements": [
      {
        "requirement": "Name of requirement (e.g., 'Caffeine Disclosure', 'cGMP for supplements')",
        "status": "compliant|non_compliant|not_applicable",
        "details": "Explanation"
      }
    ]
  },
  "overall_assessment": {
    "primary_compliance_status": "compliant|likely_compliant|potentially_non_compliant|non_compliant",
    "confidence_level": "high|medium|low",
    "summary": "2-3 sentence overall summary of compliance status",
    "key_findings": ["Finding 1", "Finding 2", "Finding 3"]
  },
  "compliance_table": [
    {
      "element": "Labeling Element Name",
      "status": "Compliant|Potentially Non-compliant|Non-compliant|Not Applicable",
      "rationale": "Brief rationale or condition for compliance"
    }
  ],
  "recommendations": [
    {
      "priority": "critical|high|medium|low",
      "recommendation": "Specific actionable recommendation",
      "regulation": "Relevant regulation citation"
    }
  ]
}

**CRITICAL REQUIREMENTS**:
1. Use conditional language for potential violations (e.g., "IF artificial cream flavor contains milk protein, THEN...")
2. Always consider exemptions before marking nutrition labeling as non-compliant
3. Provide specific regulation citations (CFR sections, act names) for every finding
4. Distinguish between "non-compliant" (definite violation) and "potentially non-compliant" (conditional on information not visible)
5. For coffee, spices, and similar products: they are typically EXEMPT from Nutrition Facts panels
6. Base compliance status on visible information; use "potentially non-compliant" when ingredient composition is unknown
7. In the compliance_table, provide a clear summary similar to the NotebookLM format
8. **PANEL TYPE MISMATCH = CRITICAL VIOLATION**: If product is classified as DIETARY_SUPPLEMENT but has "Nutrition Facts" panel (or vice versa), this is a CRITICAL priority recommendation. Generate recommendation: "Replace [wrong panel type] with [correct panel type] per [regulation citation]"`;

    // Helper function to call OpenAI API with retry logic for rate limits
    const callOpenAIWithRetry = async (maxRetries = 3) => {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(`🤖 Calling OpenAI GPT-5 mini (attempt ${attempt}/${maxRetries})...`);
        try {
          // Construct the message content based on content type
          let userMessage: any;

          if (pdfTextContent) {
            // Text-only mode (PDF with extractable text)
            userMessage = {
              role: 'user' as const,
              content:
                regulatoryContext +
                '\n\n' +
                analysisInstructions +
                '\n\n## Extracted PDF Text:\n\n' +
                pdfTextContent,
            };
          } else if (base64Data) {
            // Image mode (regular images or CloudConvert-converted PDFs)
            userMessage = {
              role: 'user' as const,
              content: [
                {
                  type: 'text' as const,
                  text: regulatoryContext + '\n\n' + analysisInstructions,
                },
                {
                  type: 'image_url' as const,
                  image_url: {
                    url: `data:${mediaType};base64,${base64Data}`,
                    detail: 'high' as const,
                  },
                },
              ],
            };
          } else {
            throw new Error('No content available for analysis');
          }

          return await openai.chat.completions.create({
            model: 'gpt-4o',
            max_completion_tokens: 8192,
            messages: [userMessage],
            response_format: { type: 'json_object' },
          });
        } catch (error: any) {
          // Check if it's a rate limit error
          if (error?.status === 429 || error?.error?.type === 'rate_limit_error') {
            console.log(`Rate limit hit, attempt ${attempt}/${maxRetries}`);

            if (attempt === maxRetries) {
              // On final attempt, throw a user-friendly error
              throw new Error('API rate limit reached. Please wait 60 seconds and try again. If this persists, you may need to upgrade your OpenAI API plan at https://platform.openai.com/settings');
            }

            // Exponential backoff: wait 5s, 10s, 20s
            const waitTime = 5000 * Math.pow(2, attempt - 1);
            console.log(`Waiting ${waitTime}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }

          // If not a rate limit error, throw immediately
          throw error;
        }
      }

      throw new Error('Failed to get response from API after retries');
    };

    // Call OpenAI API
    const completion = await callOpenAIWithRetry();

    const responseText = completion.choices[0]?.message?.content;
    if (!responseText) {
      throw new Error('No text response from AI');
    }

    console.log('=== AI Response (first 500 chars) ===');
    console.log(responseText.substring(0, 500));
    console.log('=== End preview ===');

    // Parse JSON response
    // OpenAI's JSON mode should return clean JSON, but we'll add error handling
    let analysisData: any;
    try {
      analysisData = JSON.parse(responseText);
      console.log('✅ Successfully parsed analysis data');
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      console.error('Raw response (first 1000 chars):', responseText.substring(0, 1000));
      throw new Error('Failed to parse AI response');
    }

    // GRAS Compliance Checking
    // Check if ingredients are present and validate against GRAS database
    // IMPORTANT: GRAS (21 CFR 170.3) only applies to CONVENTIONAL FOODS and BEVERAGES
    // Dietary supplements are regulated under DSHEA and do NOT require GRAS ingredients
    const isConventionalFoodProduct = analysisData.product_category === 'CONVENTIONAL_FOOD' ||
                                       analysisData.product_category === 'NON_ALCOHOLIC_BEVERAGE' ||
                                       analysisData.product_category === 'ALCOHOLIC_BEVERAGE';

    if (isConventionalFoodProduct &&
        analysisData.ingredient_labeling?.ingredients_list &&
        Array.isArray(analysisData.ingredient_labeling.ingredients_list) &&
        analysisData.ingredient_labeling.ingredients_list.length > 0) {

      console.log('Checking GRAS compliance for', analysisData.product_category, 'ingredients:', analysisData.ingredient_labeling.ingredients_list);

      try {
        const grasCompliance = await checkGRASCompliance(analysisData.ingredient_labeling.ingredients_list);

        console.log('GRAS compliance check complete:', {
          total: grasCompliance.totalIngredients,
          compliant: grasCompliance.grasCompliant,
          nonGRAS: grasCompliance.nonGRASIngredients,
        });

        // Add GRAS compliance info to analysis data
        analysisData.gras_compliance = {
          status: grasCompliance.overallCompliant ? 'compliant' : 'non_compliant',
          total_ingredients: grasCompliance.totalIngredients,
          gras_compliant_count: grasCompliance.grasCompliant,
          non_gras_ingredients: grasCompliance.nonGRASIngredients,
          gras_ingredients: grasCompliance.grasIngredients,
          detailed_results: grasCompliance.detailedResults,
        };

        // If non-GRAS ingredients found, add critical recommendations
        if (!grasCompliance.overallCompliant && grasCompliance.nonGRASIngredients.length > 0) {
          console.log('CRITICAL: Non-GRAS ingredients detected:', grasCompliance.nonGRASIngredients);

          // Initialize recommendations array if it doesn't exist
          if (!analysisData.recommendations) {
            analysisData.recommendations = [];
          }

          // Add critical recommendations for each non-GRAS ingredient
          grasCompliance.nonGRASIngredients.forEach((ingredient) => {
            analysisData.recommendations.unshift({
              priority: 'critical',
              recommendation: `CRITICAL: Ingredient "${ingredient}" is NOT found in the FDA GRAS (Generally Recognized as Safe) database. This ingredient may require FDA pre-market approval (food additive petition), could be a prohibited substance, or may need special GRAS determination. Remove this ingredient or obtain proper FDA approval before marketing this product.`,
              regulation: '21 CFR 170.3 (Definitions), 21 CFR 170.30 (GRAS determination)',
            });
          });

          // Update overall compliance status to reflect GRAS violations
          if (analysisData.overall_assessment) {
            analysisData.overall_assessment.primary_compliance_status = 'non_compliant';

            // Add GRAS violation to key findings
            if (!analysisData.overall_assessment.key_findings) {
              analysisData.overall_assessment.key_findings = [];
            }
            analysisData.overall_assessment.key_findings.unshift(
              `CRITICAL: ${grasCompliance.nonGRASIngredients.length} ingredient(s) not in FDA GRAS database: ${grasCompliance.nonGRASIngredients.join(', ')}`
            );
          }

          // Add to compliance table
          if (!analysisData.compliance_table) {
            analysisData.compliance_table = [];
          }
          analysisData.compliance_table.unshift({
            element: 'GRAS Ingredient Compliance',
            status: 'Non-compliant',
            rationale: `${grasCompliance.nonGRASIngredients.length} ingredient(s) not in FDA GRAS database: ${grasCompliance.nonGRASIngredients.join(', ')}. Requires FDA approval.`,
          });
        } else {
          // All ingredients are GRAS-compliant
          console.log('All ingredients are GRAS-compliant');

          if (!analysisData.compliance_table) {
            analysisData.compliance_table = [];
          }
          analysisData.compliance_table.push({
            element: 'GRAS Ingredient Compliance',
            status: 'Compliant',
            rationale: `All ${grasCompliance.totalIngredients} ingredients found in FDA GRAS database`,
          });
        }
      } catch (grasError) {
        console.error('Error checking GRAS compliance:', grasError);
        // Don't fail the analysis if GRAS check fails, just log the error
        // The analysis will continue without GRAS compliance info
      }
    } else if (analysisData.product_category === 'DIETARY_SUPPLEMENT') {
      console.log('Product is a dietary supplement - GRAS compliance not applicable (regulated under DSHEA, not 21 CFR 170.3)');
    } else {
      console.log('No ingredients found in analysis - skipping GRAS check');
    }

    // NDI (New Dietary Ingredient) Compliance Checking
    // Only check for dietary supplements (ingredients not marketed before Oct 15, 1994 require NDI notification)
    if (analysisData.product_category === 'DIETARY_SUPPLEMENT' &&
        analysisData.ingredient_labeling?.ingredients_list &&
        Array.isArray(analysisData.ingredient_labeling.ingredients_list) &&
        analysisData.ingredient_labeling.ingredients_list.length > 0) {

      console.log('Checking NDI compliance for dietary supplement ingredients:', analysisData.ingredient_labeling.ingredients_list);

      try {
        const ndiCompliance = await checkNDICompliance(analysisData.ingredient_labeling.ingredients_list);

        console.log('NDI compliance check complete:', {
          total: ndiCompliance.summary.totalChecked,
          withNDI: ndiCompliance.summary.withNDI,
          withoutNDI: ndiCompliance.summary.withoutNDI,
          requiresNotification: ndiCompliance.summary.requiresNotification,
        });

        // Add NDI compliance info to analysis data
        analysisData.ndi_compliance = {
          status: ndiCompliance.summary.requiresNotification > 0 ? 'requires_verification' : 'compliant',
          total_ingredients: ndiCompliance.summary.totalChecked,
          with_ndi_count: ndiCompliance.summary.withNDI,
          without_ndi_count: ndiCompliance.summary.withoutNDI,
          requires_notification_count: ndiCompliance.summary.requiresNotification,
          detailed_results: ndiCompliance.results,
        };

        // If ingredients without NDI found, add informational recommendations
        if (ndiCompliance.summary.requiresNotification > 0) {
          console.log('INFO: Ingredients requiring NDI verification detected');

          // Initialize recommendations array if it doesn't exist
          if (!analysisData.recommendations) {
            analysisData.recommendations = [];
          }

          // Add informational note for ingredients that may require verification
          const ingredientsWithoutNDI = ndiCompliance.results
            .filter(r => r.requiresNDI)
            .map(r => r.ingredient);

          analysisData.recommendations.push({
            priority: 'medium',
            recommendation: `INFORMATIONAL: The following ingredients are not in our pre-1994 dietary ingredients database (${ingredientsWithoutNDI.join(', ')}). Most dietary supplement ingredients were marketed before October 15, 1994 and are grandfathered under DSHEA (no NDI notification required). However, if any of these ingredients were first marketed AFTER October 15, 1994, they would require an NDI notification filed with FDA 75 days before marketing. Our database contains 2,193 old dietary ingredients and 1,253 ingredients with filed NDI notifications. These ingredients may simply not be in our database yet.`,
            regulation: 'FD&C Act Section 413 (DSHEA), 21 CFR 190.6 (NDI Notification)',
          });

          // Add to compliance table
          if (!analysisData.compliance_table) {
            analysisData.compliance_table = [];
          }
          analysisData.compliance_table.push({
            element: 'NDI (New Dietary Ingredient) Compliance',
            status: 'Informational',
            rationale: `${ndiCompliance.summary.requiresNotification} ingredient(s) not found in our database. Likely grandfathered (pre-1994). Verify if truly new ingredients.`,
          });
        } else {
          console.log('All ingredients either have NDI notifications or verification not applicable');

          if (!analysisData.compliance_table) {
            analysisData.compliance_table = [];
          }
          analysisData.compliance_table.push({
            element: 'NDI (New Dietary Ingredient) Compliance',
            status: 'Compliant',
            rationale: `All ingredients either have NDI notifications on file or are exempt (pre-1994 ingredients)`,
          });
        }
      } catch (ndiError) {
        console.error('Error checking NDI compliance:', ndiError);
        // Don't fail the analysis if NDI check fails, just log the error
      }
    } else if (analysisData.product_category === 'DIETARY_SUPPLEMENT') {
      console.log('No ingredients found in supplement analysis - skipping NDI check');
    }

    // Major Food Allergen Compliance Checking (FALCPA/FASTER Act)
    // Check all products with ingredients for allergen presence and declaration
    if (analysisData.ingredient_labeling?.ingredients_list &&
        Array.isArray(analysisData.ingredient_labeling.ingredients_list) &&
        analysisData.ingredient_labeling.ingredients_list.length > 0) {

      console.log('Checking major allergen compliance for ingredients:', analysisData.ingredient_labeling.ingredients_list);

      try {
        const allergenResults = await checkIngredientsForAllergens(analysisData.ingredient_labeling.ingredients_list);

        console.log('Allergen compliance check complete:', {
          totalIngredients: allergenResults.summary.totalIngredients,
          ingredientsWithAllergens: allergenResults.summary.ingredientsWithAllergens,
          uniqueAllergensDetected: allergenResults.summary.uniqueAllergensDetected,
          allergens: allergenResults.allergensDetected.map(a => a.allergen_name),
        });

        // Add allergen compliance info to analysis data
        analysisData.allergen_database_check = {
          total_ingredients: allergenResults.summary.totalIngredients,
          ingredients_with_allergens: allergenResults.summary.ingredientsWithAllergens,
          allergens_detected: allergenResults.allergensDetected.map(a => ({
            name: a.allergen_name,
            category: a.allergen_category,
            found_in: allergenResults.ingredientsWithAllergens
              .filter(i => i.allergens.some(al => al.allergen?.id === a.id))
              .map(i => i.ingredient),
          })),
          high_confidence_matches: allergenResults.summary.highConfidenceMatches,
          medium_confidence_matches: allergenResults.summary.mediumConfidenceMatches,
        };

        // If allergens are detected, verify proper declaration
        if (allergenResults.allergensDetected.length > 0) {
          console.log('ALLERGENS DETECTED:', allergenResults.allergensDetected.map(a => a.allergen_name).join(', '));

          // Check if AI analysis found proper allergen labeling
          const aiAllergenStatus = analysisData.allergen_labeling?.status;
          const hasContainsStatement = analysisData.allergen_labeling?.has_contains_statement;

          // Initialize recommendations array if it doesn't exist
          if (!analysisData.recommendations) {
            analysisData.recommendations = [];
          }

          // Cross-reference database findings with AI analysis
          if (aiAllergenStatus === 'potentially_non_compliant' || aiAllergenStatus === 'non_compliant' || !hasContainsStatement) {
            // AI detected missing allergen declarations - validate with database
            const detectedAllergenNames = allergenResults.allergensDetected.map(a => a.allergen_name);

            analysisData.recommendations.push({
              priority: 'critical',
              recommendation: `CRITICAL ALLERGEN VIOLATION: The following major food allergens were detected in ingredients but may not be properly declared: ${detectedAllergenNames.join(', ')}. Per FALCPA Section 403(w) and FASTER Act, all major food allergens MUST be declared either (1) in parentheses following the ingredient (e.g., "Whey (milk)") OR (2) in a "Contains:" statement immediately after the ingredient list. Missing allergen declarations can result in FDA enforcement action and mandatory recalls.`,
              regulation: 'FALCPA Section 403(w), FASTER Act, 21 USC §343(w)',
            });

            // Add detailed breakdown of which ingredients contain which allergens
            const allergenDetails = allergenResults.allergensDetected.map(allergen => {
              const ingredients = allergenResults.ingredientsWithAllergens
                .filter(i => i.allergens.some(al => al.allergen?.id === allergen.id))
                .map(i => i.ingredient);
              return `${allergen.allergen_name}: found in ${ingredients.join(', ')}`;
            });

            analysisData.recommendations.push({
              priority: 'high',
              recommendation: `Allergen source breakdown: ${allergenDetails.join('; ')}. Ensure proper declaration for ALL listed allergens.`,
              regulation: 'FALCPA/FASTER Act Compliance',
            });

            if (!analysisData.compliance_table) {
              analysisData.compliance_table = [];
            }
            analysisData.compliance_table.push({
              element: 'Major Food Allergen Declaration',
              status: 'Non-Compliant',
              rationale: `${allergenResults.allergensDetected.length} major allergen(s) detected in ingredients but proper declaration missing or unclear`,
            });
          } else if (aiAllergenStatus === 'compliant') {
            // AI found proper declarations - confirm with database
            console.log('Allergens properly declared (validated by both AI and database)');

            if (!analysisData.compliance_table) {
              analysisData.compliance_table = [];
            }
            analysisData.compliance_table.push({
              element: 'Major Food Allergen Declaration',
              status: 'Compliant',
              rationale: `All ${allergenResults.allergensDetected.length} major allergen(s) properly declared per FALCPA/FASTER Act`,
            });
          }
        } else {
          // No allergens detected by database
          console.log('No major food allergens detected in ingredients');

          if (!analysisData.compliance_table) {
            analysisData.compliance_table = [];
          }
          analysisData.compliance_table.push({
            element: 'Major Food Allergen Declaration',
            status: 'Not Applicable',
            rationale: 'No major food allergens detected in ingredients',
          });
        }
      } catch (allergenError) {
        console.error('Error checking allergen compliance:', allergenError);
        // Don't fail the analysis if allergen check fails, just log the error
        // The AI-based allergen checking will still be present in analysisData.allergen_labeling
      }
    } else {
      console.log('No ingredients found in analysis - skipping allergen database check');
    }

    // Determine compliance status from the new analysis structure
    const complianceStatus = analysisData.overall_assessment?.primary_compliance_status || 'unknown';
    const dbComplianceStatus =
      complianceStatus === 'compliant' || complianceStatus === 'likely_compliant' ? 'compliant' :
      complianceStatus === 'potentially_non_compliant' ? 'minor_issues' :
      'major_violations';

    const { data: analysis, error: insertError} = await supabaseAdmin
      .from('analyses')
      .insert({
        user_id: user.id,
        image_url: base64Data
          ? `data:${mediaType};base64,${base64Data.substring(0, 100)}...`
          : `text/plain;preview,${pdfTextContent?.substring(0, 100) || ''}...`,
        image_name: imageFile.name,
        analysis_result: analysisData,
        compliance_status: dbComplianceStatus,
        issues_found: analysisData.recommendations?.filter((r: any) => r.priority === 'critical' || r.priority === 'high')?.length || 0,
        session_id: sessionId || null,
        product_category: analysisData.product_category || null,
        category_rationale: analysisData.category_rationale || null,
        category_confidence: analysisData.category_confidence || null,
        is_category_ambiguous: analysisData.category_ambiguity?.is_ambiguous || false,
        alternative_categories: analysisData.category_ambiguity?.alternative_categories || null,
        // user_selected_category, category_selection_reason, compared_categories remain NULL initially
        // These are set when user makes a selection in the Category Selector UI
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error saving analysis:', insertError);
      return NextResponse.json({ error: 'Failed to save analysis' }, { status: 500 });
    }

    const { error: usageUpdateError } = await supabase
      .from('usage_tracking')
      .update({ analyses_used: currentUsage.analyses_used + 1 })
      .eq('user_id', user.id)
      .eq('month', currentMonth);

    if (usageUpdateError) {
      console.error('Error updating usage:', usageUpdateError);
    }

    // Create iteration record if this is part of a session
    if (sessionId) {
      const { error: iterationError } = await addIteration(
        sessionId,
        'image_analysis',
        {
          image_name: imageFile.name,
          file_size: imageFile.size,
          media_type: mediaType,
        },
        analysisData,
        analysis.id,
        undefined,
        true // use admin
      );

      if (iterationError) {
        console.error('Error creating iteration:', iterationError);
        // Don't fail the analysis if iteration creation fails
      } else {
        console.log('Created iteration for session:', sessionId);
      }
    }

    try {
      const emailHtml = generateAnalysisResultEmail({
        productName: analysisData.product_name || 'Unknown Product',
        summary: analysisData.overall_assessment?.summary || 'Analysis completed successfully.',
        healthScore: 0, // No longer using health score
        complianceStatus: analysis.compliance_status,
        recommendations: analysisData.recommendations?.map((r: any) =>
          `[${r.priority.toUpperCase()}] ${r.recommendation} (${r.regulation})`
        ) || [],
        analyzedAt: analysis.created_at,
      });

      await sendEmail({
        to: user.email,
        subject: `Label Analysis Complete: ${analysisData.product_name || 'Your Product'}`,
        html: emailHtml,
      });
    } catch (emailError) {
      console.error('Error sending email notification:', emailError);
    }

    // Determine if category selector should be shown
    const showCategorySelector =
      analysisData.category_confidence !== 'high' ||
      analysisData.category_ambiguity?.is_ambiguous ||
      (analysisData.category_ambiguity?.label_conflicts &&
       analysisData.category_ambiguity.label_conflicts.length > 0);

    return NextResponse.json({
      id: analysis.id,
      image_name: analysis.image_name,
      compliance_status: analysis.compliance_status,
      issues_found: analysis.issues_found,
      created_at: analysis.created_at,
      ...analysisData,
      show_category_selector: showCategorySelector,
      usage: {
        used: currentUsage.analyses_used + 1,
        limit: currentUsage.analyses_limit,
      },
      session: sessionId ? {
        id: sessionId,
        title: session?.title || null,
      } : null,
    });
  } catch (error: any) {
    console.error('Error analyzing image:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to analyze image' },
      { status: 500 }
    );
  }
}

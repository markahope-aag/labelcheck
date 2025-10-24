# Regulatory Analysis Prompts

This directory contains the prompt templates used for AI-powered label analysis.

## Purpose

Instead of embedding prompts directly in TypeScript code, we store them as markdown files for:
- **Easy editing** - Non-developers can modify prompts
- **Version control** - Cleaner git diffs
- **A/B testing** - Swap out prompts to test variations
- **Separation of concerns** - Code focuses on logic, prompts focus on content

## Structure

```
prompts/
├── README.md                          # This file
├── categories/                        # Category-specific rules
│   ├── dietary-supplement.md          # Supplement-specific requirements
│   ├── conventional-food.md           # Food-specific requirements
│   ├── alcoholic-beverage.md          # Alcohol/TTB requirements
│   └── non-alcoholic-beverage.md      # Beverage-specific requirements
├── common-sections.md                 # Analysis approach (applies to all)
└── json-schema.md                     # Response format specification

## How It Works

1. User uploads a label
2. System pre-classifies product category (DIETARY_SUPPLEMENT, CONVENTIONAL_FOOD, etc.)
3. `lib/prompt-loader.ts` loads the appropriate category-specific prompt
4. Prompt is composed: intro + category rules + common sections + JSON schema
5. AI analyzes label using focused prompt (only relevant regulations)

## Editing Prompts

### Format Guidelines

- Use Markdown formatting for readability
- Keep sections organized with headers
- Include regulation citations (e.g., "21 CFR 101.9")
- Use bullet points for lists
- Bold **IMPORTANT** concepts

### Example Edit

To add a new requirement to dietary supplements:

```markdown
## 8. NEW REQUIREMENT NAME

- Requirement description
- How to check compliance
- What to look for on label
```

### Testing After Edits

1. Enable feature flag: `USE_CATEGORY_SPECIFIC_PROMPTS=true`
2. Restart dev server: `npm run dev`
3. Upload test label for affected category
4. Verify new requirement is checked

## Prompt Caching

Prompts are cached in memory after first load for performance. To clear cache during development:

```typescript
import { clearPromptCache } from '@/lib/prompt-loader';
clearPromptCache();
```

## Files Explained

### Categories (category-specific rules)

- **dietary-supplement.md** - FDA/DSHEA rules for supplements
  - Supplement Facts panel
  - Structure/function claims
  - Disclaimer requirements
  - Sexual health claims guidance

- **conventional-food.md** - FDA rules for packaged foods
  - Nutrition Facts panel
  - Rounding validation
  - Fortification policy
  - Nutrient content claims

- **alcoholic-beverage.md** - TTB rules for alcohol products
  - COLA requirements
  - Government health warning
  - Prohibited health claims

- **non-alcoholic-beverage.md** - FDA rules for beverages
  - Caffeine disclosure
  - Juice percentage
  - Fortification restrictions

### Common Files

- **common-sections.md** - Analysis approach (extract → evaluate → status → recommendations)
- **json-schema.md** - Expected JSON response structure

## Version Control

When editing prompts:
- Create a branch for significant changes
- Test thoroughly before merging
- Document changes in commit messages
- Consider A/B testing major rewrites

## Performance

**File Sizes:**
- Dietary supplement: ~1.5 KB
- Conventional food: ~1.8 KB
- Alcoholic beverage: ~1.2 KB
- Non-alcoholic beverage: ~1.4 KB
- Common sections: ~0.8 KB
- JSON schema: ~1.3 KB

**Total per analysis:** ~6-8 KB (vs. 30 KB+ for generic prompt)

## Future Enhancements

- **Prompt versioning** - Track and A/B test prompt variations
- **Dynamic assembly** - Mix rules from multiple categories for edge cases
- **Localization** - Support for different regulatory jurisdictions
- **Expert review** - Workflow for regulatory experts to approve changes

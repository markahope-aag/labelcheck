# Technical Debt Tracking

**Last Updated:** 2025-11-02
**Total Items:** 1 High Priority

Items are prioritized based on impact to code quality, maintainability, and risk.

---

## 🔴 High Priority

### 1. Type Safety - Replace `any` Types
**Identified:** 2025-11-02 (Cursor Agent analysis)
**Impact:** Type safety, IDE autocomplete, bug prevention
**Effort:** 2-3 hours
**Risk:** Low (non-breaking change)

**Issue:**
- 144 instances of `any` type throughout codebase
- Reduces type safety and IntelliSense
- Harder to catch bugs at compile time
- Makes refactoring more dangerous

**Key Problem Areas:**
```typescript
// lib/analysis/orchestrator.ts
export interface DocumentLoadResult {
  regulatoryDocuments: any[];  // ❌ Should be RegulatoryDocument[]
}

// app/analyze/page.tsx
const [result, setResult] = useState<any>(null);  // ❌ Should be AnalysisResult

// lib/supabase.ts (line 82)
analysis_result: any;  // ⚠️ This one might be justified (complex AI JSON)
```

**Recommended Approach:**
1. **Phase 1: Define core types** (30 min)
   - Create `AnalysisResult` interface
   - Create detailed type for `analysis_result` JSON structure
   - Document all AI response fields

2. **Phase 2: Replace in critical paths** (1 hour)
   - Update `app/analyze/page.tsx` state types
   - Update `lib/analysis/orchestrator.ts`
   - Update component props

3. **Phase 3: Replace remaining instances** (1 hour)
   - Work through remaining files
   - Use `grep -r ":\s*any"` to find all
   - Replace with proper types

4. **Phase 4: Enable strict mode** (30 min)
   - Update `tsconfig.json` to strict
   - Fix any new errors
   - Verify build passes

**Benefits:**
- ✅ Better autocomplete in IDE
- ✅ Catch bugs at compile time
- ✅ Easier refactoring
- ✅ Self-documenting code
- ✅ Onboarding easier for new developers

**Files to Update:**
- `lib/supabase.ts` - Analysis interface
- `lib/analysis/orchestrator.ts` - Document types
- `app/analyze/page.tsx` - Component state
- `app/analysis/[id]/page.tsx` - Detail page state
- `components/*.tsx` - Props interfaces

**Tracking:**
- [ ] Create type definitions file `types/analysis.ts`
- [ ] Replace analysis result any types
- [ ] Replace regulatory document any types
- [ ] Replace component props any types
- [ ] Enable TypeScript strict mode
- [ ] Verify all builds pass

**Notes:**
- Some `any` types may be justified (e.g., complex AI JSON)
- Document WHY if keeping `any` type
- Use `unknown` instead of `any` where possible

---

## 🟡 Medium Priority

*No items yet*

---

## 🟢 Low Priority

*No items yet*

---

## 📋 Completed

*No items yet*

---

## 📊 Statistics

- **High Priority:** 1
- **Medium Priority:** 0
- **Low Priority:** 0
- **Completed:** 0
- **Total Active:** 1

---

## 🔄 Review Schedule

- **Weekly:** Check for new high-priority items
- **Monthly:** Review and prioritize medium/low items
- **Quarterly:** Plan sprints to pay down debt

---

## 💡 How to Use This File

**When to Add Items:**
- Code reviews reveal patterns
- AI tools (Cursor, Claude) identify issues
- Performance problems emerge
- Refactoring becomes difficult
- New features blocked by old code

**When to Address Items:**
- During slow periods
- When working in related code
- Before major features in same area
- During quarterly planning

**Priority Guidelines:**
- **High:** Blocks features, security risk, major bug source
- **Medium:** Affects productivity, code quality
- **Low:** Nice to have, minor improvements

---

## 🎯 Next Actions

**Immediate:** Document new debt as discovered
**This Month:** Plan Type Safety refactor (Item #1)
**Next Quarter:** Schedule 2-3 days for debt paydown

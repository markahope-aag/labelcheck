# Analyze Page Refactoring Guide

**Status:** 🟡 Phase 1 Complete (Custom Hooks Extracted)
**Current Line Count:** 2,265 lines → Target: ~800 lines
**Session:** 15
**Date:** 2025-11-02

## Overview

The `app/analyze/page.tsx` file grew to **2,265 lines** - far too large for a single component. This document tracks the refactoring effort to break it down into maintainable, testable pieces.

## Refactoring Strategy

### Phase 1: Extract Custom Hooks ✅ COMPLETE
**Goal:** Move business logic out of component into reusable hooks
**Impact:** ~500 lines of logic extracted
**Status:** ✅ Complete

### Phase 2: Refactor Main Page (Next Session)
**Goal:** Update `app/analyze/page.tsx` to use the new hooks
**Impact:** Reduce from 2,265 lines to ~800 lines
**Status:** ⏳ Pending

### Phase 3: Extract Presentational Components (Future)
**Goal:** Break render JSX into smaller components
**Impact:** Further reduce to ~300-400 lines
**Status:** ⏳ Future

---

## Phase 1: Custom Hooks (COMPLETE)

### 1. `hooks/useFileUpload.ts` ✅

**Purpose:** Handle file selection, drag-and-drop, preview generation, and image quality checking

**Extracted Logic:**
- File type validation (image/PDF)
- File size validation (10MB max)
- Preview generation
- Image quality API calls
- Drag-and-drop event handlers
- Error handling

**API:**
```typescript
interface UseFileUploadReturn {
  // State
  selectedFile: File | null;
  previewUrl: string;
  isDragging: boolean;
  imageQuality: ImageQualityMetrics | null;
  showQualityWarning: boolean;
  error: string;

  // Methods
  processFile: (file: File) => Promise<void>;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleDragEnter: (e: React.DragEvent<HTMLDivElement>) => void;
  handleDragLeave: (e: React.DragEvent<HTMLDivElement>) => void;
  handleDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  handleDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  resetFile: () => void;
  clearError: () => void;
}

// Usage in component:
const fileUpload = useFileUpload();
```

**Lines Extracted:** ~220 lines

**Benefits:**
- ✅ Testable in isolation
- ✅ Reusable across components
- ✅ Clear separation of concerns
- ✅ All file-related logic in one place

---

### 2. `hooks/useAnalysis.ts` ✅

**Purpose:** Handle label analysis state, API calls, progress tracking, and result management

**Extracted Logic:**
- Analysis API calls
- Progress simulation (0-100%)
- Progress step messages
- Result state management
- Session ID management
- Revised mode logic
- Category selector flow
- Error handling with rate limit support

**API:**
```typescript
interface UseAnalysisReturn {
  // State
  isAnalyzing: boolean;
  analysisProgress: number;
  analysisStep: string;
  result: AnalyzeImageResponse | null;
  error: string;
  errorCode: string;
  sessionId: string | null;
  isRevisedMode: boolean;
  previousResult: AnalyzeImageResponse | null;
  showCategorySelector: boolean;
  analysisData: AnalyzeImageResponse | null;

  // Methods
  analyzeLabel: (file: File, labelName?: string) => Promise<void>;
  setResult: (result: AnalyzeImageResponse | null) => void;
  setSessionId: (id: string | null) => void;
  enterRevisedMode: () => void;
  exitRevisedMode: () => void;
  handleCategorySelection: () => void;
  clearError: () => void;
  reset: () => void;
}

// Usage in component:
const analysis = useAnalysis({
  userId,
  onSuccess: (result) => console.log('Analysis complete', result),
  onError: (error, code) => console.error('Analysis failed', error),
});
```

**Lines Extracted:** ~280 lines

**Benefits:**
- ✅ Complex state machine isolated
- ✅ Easy to test progress simulation
- ✅ Callback pattern for success/error
- ✅ Revised mode logic centralized

---

### 3. `hooks/useAnalysisSession.ts` ✅

**Purpose:** Handle analysis session features (sharing, chat, text checking, comparison)

**Extracted Logic:**
- Share link generation
- Share dialog state
- Clipboard copy functionality
- Chat panel state
- Text checker panel state
- Category comparison view state

**API:**
```typescript
interface UseAnalysisSessionReturn {
  // Share
  shareDialogOpen: boolean;
  shareUrl: string;
  copied: boolean;
  openShareDialog: (analysisId: string) => Promise<void>;
  closeShareDialog: () => void;
  copyShareUrl: () => void;

  // Chat
  isChatOpen: boolean;
  openChat: () => void;
  closeChat: () => void;

  // Text checker
  isTextCheckerOpen: boolean;
  openTextChecker: () => void;
  closeTextChecker: () => void;

  // Comparison
  showComparison: boolean;
  openComparison: () => void;
  closeComparison: () => void;
}

// Usage in component:
const session = useAnalysisSession();
```

**Lines Extracted:** ~150 lines

**Benefits:**
- ✅ All dialog/panel state in one place
- ✅ Share URL generation logic isolated
- ✅ Easy to add new session features

---

## Phase 2: Refactor Main Page (NEXT SESSION)

**Goal:** Update `app/analyze/page.tsx` to use the new hooks

### Step 1: Import New Hooks

```typescript
import { useFileUpload } from '@/hooks/useFileUpload';
import { useAnalysis } from '@/hooks/useAnalysis';
import { useAnalysisSession } from '@/hooks/useAnalysisSession';
```

### Step 2: Replace useState Calls

**Before:**
```typescript
const [selectedFile, setSelectedFile] = useState<File | null>(null);
const [previewUrl, setPreviewUrl] = useState<string>('');
const [isDragging, setIsDragging] = useState(false);
const [imageQuality, setImageQuality] = useState<ImageQualityMetrics | null>(null);
// ... 20+ more state variables
```

**After:**
```typescript
const fileUpload = useFileUpload();
const analysis = useAnalysis({ userId });
const session = useAnalysisSession();
const [labelName, setLabelName] = useState<string>(''); // Keep local UI state
```

### Step 3: Replace Function Definitions

**Before:**
```typescript
const processFile = async (file: File) => {
  // 70+ lines of logic
};

const handleAnalyze = async () => {
  // 120+ lines of logic
};

const handleShare = async () => {
  // 40+ lines of logic
};
```

**After:**
```typescript
// All logic now in hooks!
// Just call: fileUpload.processFile(file)
// Just call: analysis.analyzeLabel(file, labelName)
// Just call: session.openShareDialog(analysisId)
```

### Step 4: Update JSX to Use Hook State

**Before:**
```typescript
<Button onClick={handleAnalyze} disabled={!selectedFile || isAnalyzing}>
  {isAnalyzing ? <Loader2 className="animate-spin" /> : 'Analyze'}
</Button>
```

**After:**
```typescript
<Button onClick={() => analysis.analyzeLabel(fileUpload.selectedFile!, labelName)}
        disabled={!fileUpload.selectedFile || analysis.isAnalyzing}>
  {analysis.isAnalyzing ? <Loader2 className="animate-spin" /> : 'Analyze'}
</Button>
```

### Expected Outcome

**Current:** 2,265 lines
**After Phase 2:** ~800 lines (65% reduction)

**Breakdown:**
- Hooks extracted: ~650 lines
- Render JSX: ~800 lines
- Helper functions: ~100 lines (formatComplianceStatus, etc.)

---

## Phase 3: Extract Presentational Components (FUTURE)

After Phase 2, the page will still be ~800 lines of JSX. We can further extract:

### Potential Components

#### 1. `components/analyze/FileUploadZone.tsx`
**Purpose:** File upload UI with drag-and-drop
**Lines:** ~150
**Props:**
```typescript
interface FileUploadZoneProps {
  fileUpload: ReturnType<typeof useFileUpload>;
  labelName: string;
  onLabelNameChange: (name: string) => void;
}
```

#### 2. `components/analyze/AnalysisProgressIndicator.tsx`
**Purpose:** Progress bar and step messages during analysis
**Lines:** ~80
**Props:**
```typescript
interface AnalysisProgressIndicatorProps {
  progress: number;
  step: string;
  isAnalyzing: boolean;
}
```

#### 3. `components/analyze/AnalysisResultsDisplay.tsx`
**Purpose:** Full analysis results with all sections
**Lines:** ~400 (this is the massive JSX block)
**Props:**
```typescript
interface AnalysisResultsDisplayProps {
  result: AnalyzeImageResponse;
  sessionId: string | null;
  onShare: () => void;
  onChat: () => void;
  onTextCheck: () => void;
  onRevise: () => void;
  onExport: () => void;
}
```

#### 4. `components/analyze/RevisionComparisonView.tsx`
**Purpose:** Show before/after comparison when in revised mode
**Lines:** ~100
**Props:**
```typescript
interface RevisionComparisonViewProps {
  previousResult: AnalyzeImageResponse;
  currentResult: AnalyzeImageResponse;
}
```

### Expected Outcome (After Phase 3)

**Current:** 2,265 lines
**After Phase 3:** ~300-400 lines (83% reduction)

**Final Page Structure:**
```typescript
export default function AnalyzePage() {
  const { userId } = useAuth();
  const router = useRouter();

  // Custom hooks
  const fileUpload = useFileUpload();
  const analysis = useAnalysis({ userId });
  const session = useAnalysisSession();

  // Local UI state
  const [labelName, setLabelName] = useState('');

  // Effects
  useEffect(() => { /* redirect if not logged in */ }, [userId]);

  // Render
  return (
    <div className="container">
      <FileUploadZone
        fileUpload={fileUpload}
        labelName={labelName}
        onLabelNameChange={setLabelName}
      />

      {analysis.isAnalyzing && (
        <AnalysisProgressIndicator
          progress={analysis.analysisProgress}
          step={analysis.analysisStep}
          isAnalyzing={analysis.isAnalyzing}
        />
      )}

      {analysis.result && (
        <AnalysisResultsDisplay
          result={analysis.result}
          sessionId={analysis.sessionId}
          onShare={() => session.openShareDialog(analysis.result.id)}
          onChat={session.openChat}
          onTextCheck={session.openTextChecker}
          onRevise={analysis.enterRevisedMode}
          onExport={handleExport}
        />
      )}

      {/* Dialogs and panels */}
      <AnalysisChat
        open={session.isChatOpen}
        onClose={session.closeChat}
        sessionId={analysis.sessionId}
      />

      <TextChecker
        open={session.isTextCheckerOpen}
        onClose={session.closeTextChecker}
        sessionId={analysis.sessionId}
      />

      {/* ... other dialogs */}
    </div>
  );
}
```

---

## Testing Strategy

### Unit Tests for Hooks

#### `hooks/useFileUpload.test.ts`
- ✅ File type validation
- ✅ File size validation
- ✅ Preview URL generation
- ✅ Quality check API call
- ✅ Drag-and-drop handlers
- ✅ Error handling

#### `hooks/useAnalysis.test.ts`
- ✅ Analysis API call
- ✅ Progress simulation
- ✅ Error handling
- ✅ Rate limit errors
- ✅ Revised mode flow
- ✅ Category selector flow

#### `hooks/useAnalysisSession.test.ts`
- ✅ Share link generation
- ✅ Clipboard copy
- ✅ Dialog state management
- ✅ Panel state management

### Integration Tests

After Phase 3 (component extraction):
- Full upload → analyze → results flow
- Revision flow
- Share flow
- Chat flow
- Text checker flow

---

## Benefits of Refactoring

### Code Quality
- ✅ **Separation of Concerns** - Logic vs UI cleanly separated
- ✅ **Single Responsibility** - Each hook has one clear purpose
- ✅ **DRY Principle** - Hooks can be reused
- ✅ **Testability** - Each hook can be tested in isolation

### Developer Experience
- ✅ **Easier to Navigate** - Find logic quickly
- ✅ **Easier to Modify** - Change one hook without touching others
- ✅ **Easier to Review** - Smaller PRs, clearer diffs
- ✅ **Better Autocomplete** - TypeScript knows exact shape

### Maintainability
- ✅ **Reduces Merge Conflicts** - Logic in separate files
- ✅ **Safer Refactoring** - Tests catch regressions
- ✅ **Faster Onboarding** - New devs understand structure
- ✅ **Future-Proof** - Easy to add features

---

## Migration Checklist

### Phase 1 (Session 15) ✅
- [x] Create `hooks/useFileUpload.ts`
- [x] Create `hooks/useAnalysis.ts`
- [x] Create `hooks/useAnalysisSession.ts`
- [x] Add TypeScript types
- [x] Add JSDoc comments
- [ ] Run TypeScript check
- [ ] Commit hooks

### Phase 2 (Session 16)
- [ ] Import hooks in `app/analyze/page.tsx`
- [ ] Replace state variables with hook destructuring
- [ ] Remove old function definitions
- [ ] Update JSX to use hook state/methods
- [ ] Test all functionality
- [ ] Run TypeScript check
- [ ] Commit refactored page

### Phase 3 (Future)
- [ ] Extract `FileUploadZone` component
- [ ] Extract `AnalysisProgressIndicator` component
- [ ] Extract `AnalysisResultsDisplay` component
- [ ] Extract `RevisionComparisonView` component
- [ ] Update main page to use components
- [ ] Test all functionality
- [ ] Run TypeScript check
- [ ] Commit extracted components

---

## Performance Considerations

### Before Refactoring
- ❌ All logic re-renders on any state change
- ❌ Large component tree harder to optimize
- ❌ Difficult to memoize effectively

### After Refactoring
- ✅ Hook state changes are isolated
- ✅ Smaller components easier to memoize
- ✅ Can use React.memo on extracted components
- ✅ Better code splitting opportunities

---

## Notes for Next Session

1. **Start with Phase 2** - Refactor main page to use hooks
2. **Test thoroughly** - This is the riskiest change (touching render logic)
3. **Keep git commits small** - One hook integration at a time
4. **Consider Phase 3** - If time permits, extract FileUploadZone first

**Estimated Time:**
- Phase 2: 2-3 hours
- Phase 3: 2-3 hours
- **Total Remaining:** 4-6 hours

---

## Related Documentation

- [Testing Infrastructure](./TESTING.md)
- [Technical Debt Tracker](./TECHNICAL_DEBT.md)
- [Session Notes](./SESSION_NOTES.md)

# Analysis Sessions Feature Specification

**Status:** In Development
**Created:** 2025-10-22
**Last Updated:** 2025-10-22

## Overview

The Analysis Sessions feature transforms LabelCheck from a one-shot analysis tool into an iterative compliance improvement workspace. Users can analyze a label, identify issues, and then iterate through multiple improvement methods (text checks, AI chat, revised images) all within a single session context.

## Problem Statement

Manufacturers need to:
1. Check prospective label content **before** creating physical mockups
2. Ask clarifying questions about compliance requirements
3. Test alternative wordings to resolve warnings
4. Track their compliance improvement progress
5. Maintain context across multiple iterations

Current limitation: Each analysis is isolated with no way to iterate or maintain context.

## Solution

A **session-based workflow** where users can:
- Start with an image upload OR text content
- Get compliance analysis with warnings
- Iterate using three methods:
  - 💬 **Chat with AI** about specific warnings
  - 📝 **Check Alternative Text** to test revised wording
  - 📸 **Upload Revised Label** to verify fixes
- See progress timeline showing improvement
- Maintain full context throughout the process

---

## Database Schema

### Tables Created

**`analysis_sessions`**
```sql
- id: UUID (PK)
- user_id: UUID (FK → users)
- title: TEXT (nullable, user can name the session)
- status: TEXT (in_progress | resolved | archived)
- created_at: TIMESTAMP
- updated_at: TIMESTAMP (auto-updated on changes)
```

**`analysis_iterations`**
```sql
- id: UUID (PK)
- session_id: UUID (FK → analysis_sessions)
- iteration_type: TEXT (image_analysis | text_check | chat_question | revised_analysis)
- input_data: JSONB (flexible structure based on type)
- result_data: JSONB (AI response or analysis result)
- analysis_id: UUID (FK → analyses, for image analyses)
- parent_iteration_id: UUID (FK → analysis_iterations, for threading)
- created_at: TIMESTAMP
```

**Modified: `analyses`**
- Added: `session_id: UUID (FK → analysis_sessions)`

### RLS Policies

- Users can only access their own sessions and iterations
- All operations (SELECT, INSERT, UPDATE, DELETE) are restricted by user_id
- Admin operations bypass RLS using `supabaseAdmin` client

---

## Implementation Phases

### Phase 1: Database Infrastructure ✅ COMPLETED

- [x] Create migration file
- [x] Define TypeScript interfaces
- [x] Build helper functions (`lib/session-helpers.ts`)
- [x] Test migration on Supabase

**Files:**
- `supabase/migrations/20251022000000_create_analysis_sessions.sql`
- `lib/supabase.ts` (interfaces)
- `lib/session-helpers.ts` (CRUD operations)

---

### Phase 2: Update Existing Analysis Flow 🔄 IN PROGRESS

**Goal:** Modify the current image analysis flow to create sessions

**Changes to `/app/analyze/page.tsx`:**
1. When user uploads image and clicks "Analyze":
   - Create a new session
   - Create first iteration (type: `image_analysis`)
   - Store analysis with `session_id`

2. After analysis completes:
   - Show results as before
   - Add session context UI
   - Show iteration action buttons

**Changes to `/app/api/analyze/route.ts`:**
1. Accept optional `sessionId` parameter
2. If provided, add iteration to existing session
3. If not provided, create new session (backward compatibility)
4. Return both analysis result and session data

**Backward Compatibility:**
- Existing analyses have `session_id = null` (still work fine)
- Old analysis flows continue to function
- Sessions are opt-in enhancement

---

### Phase 3: Iteration Action Buttons

**Location:** Analysis results page (after analysis completes)

**UI Design:**
```
┌─────────────────────────────────────────────────┐
│ Analysis Results                                │
│ [Compliance warnings and details shown here]    │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ Improve This Analysis                           │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────┐│
│ │ 💬 Ask AI    │ │ 📝 Check Text│ │📸 Upload ││
│ │ Questions    │ │ Alternative  │ │ Revision ││
│ │              │ │              │ │          ││
│ │ Get help     │ │ Test revised │ │ Analyze  ││
│ │ understanding│ │ content      │ │ updated  ││
│ │ requirements │ │              │ │ label    ││
│ └──────────────┘ └──────────────┘ └──────────┘│
└─────────────────────────────────────────────────┘
```

**Behavior:**
- Each button expands a panel below
- Only one panel open at a time
- All actions add iterations to current session

---

### Phase 4: Chat Interface

**Route:** In-page panel (not separate route for better UX)

**Features:**
1. **Context-Aware Prompts:**
   - AI knows the current analysis results
   - Can reference specific warnings by number
   - Maintains conversation thread

2. **Example Questions:**
   - "What format is required for the allergen statement?"
   - "Can I use 'natural flavors' or does it need to be specific?"
   - "How should I word the net weight for a 12oz product?"

3. **Implementation:**
   ```typescript
   // API: /api/analyze/chat
   POST {
     sessionId: string,
     message: string,
     parentIterationId?: string // for threading
   }
   ```

4. **Response:**
   - Streams AI response for better UX
   - Creates `chat_question` iteration
   - Links to parent (if follow-up)

---

### Phase 5: Text Content Checker

**Route:** In-page panel

**Features:**
1. **Input Methods:**
   - Plain text textarea
   - PDF upload (extract text with `pdf-parse-fork`)
   - Future: Word doc upload

2. **Structured Input Fields (Optional Enhancement):**
   ```
   Product Name: [          ]
   Ingredients:  [          ]
   Allergens:    [          ]
   Net Weight:   [          ]
   Nutrition:    [          ]
   ```

3. **Analysis Context:**
   - References original image analysis
   - Shows side-by-side comparison:
     - "Original had 3 warnings"
     - "This version has 1 warning"
   - Highlights what changed

4. **Implementation:**
   ```typescript
   // API: /api/analyze/text
   POST {
     sessionId: string,
     textContent: string,
     structuredData?: object
   }
   ```

5. **Modified AI Prompt:**
   ```
   You are analyzing prospective label content (text-only, no image).

   Original analysis context:
   [Include original warnings/issues]

   User is testing alternative content:
   [New text content]

   Evaluate:
   1. Does this resolve the original warnings?
   2. Are there new compliance issues?
   3. What's still missing?
   ```

---

### Phase 6: Revised Image Upload

**Route:** In-page panel (reuses image upload component)

**Features:**
1. Upload new label image
2. Automatically linked to session
3. Compare to previous iteration:
   - Show issue count: "3 → 1" with visual indicator
   - Highlight resolved warnings in green
   - Highlight new warnings in red

4. **Implementation:**
   - Reuse existing `/api/analyze` endpoint
   - Pass `sessionId` parameter
   - Create `revised_analysis` iteration

---

### Phase 7: Session Timeline/History

**UI Component:** `<SessionTimeline />`

**Display:**
```
Session History
├─ 📸 Original Upload (3 warnings)
│  └─ 💬 Q: "What allergen format needed?"
│     └─ [AI response summary]
├─ 📝 Checked Alternative Text (2 warnings)
│  └─ Improved: Resolved "missing allergen statement"
│  └─ Still needs: "Net weight format"
└─ 📸 Final Upload (0 warnings) ✅ Compliant!
```

**Features:**
- Collapsible entries
- Click to view full iteration details
- Visual progress indicators (warning count decreasing)
- Export session report (PDF showing full journey)

**Implementation:**
```typescript
// Component: components/SessionTimeline.tsx
interface SessionTimelineProps {
  sessionId: string;
}
```

---

## API Endpoints

### New Endpoints

**`POST /api/sessions`**
- Create new session
- Returns session ID

**`GET /api/sessions/:id`**
- Get session with all iterations
- Returns timeline data

**`POST /api/analyze/chat`**
- Chat about analysis
- Creates chat_question iteration

**`POST /api/analyze/text`**
- Analyze text content
- Creates text_check iteration

### Modified Endpoints

**`POST /api/analyze`**
- Add optional `sessionId` parameter
- If provided, add to existing session
- If not, create new session

---

## Usage Tracking & Limits

**Question:** How do we count iterations against usage limits?

**Options:**

1. **Count all iterations equally**
   - Each iteration (image, text, chat) = 1 analysis
   - Simple but might discourage iteration

2. **Count only image analyses**
   - Chat and text checks are free
   - Encourages iteration
   - **RECOMMENDED**

3. **Tiered counting**
   - Image analysis = 1 credit
   - Text check = 0.5 credit
   - Chat = 0.25 credit or free

**Implementation:**
- Update `usage_tracking` increment logic
- Display remaining credits on session page
- Warn before running out

---

## User Experience Flow

### Scenario 1: Pre-Production Content Check

1. User has prospective label text (not designed yet)
2. Goes to `/analyze`
3. Clicks "Check Text Alternative"
4. Pastes ingredient list, product name, etc.
5. Gets compliance analysis
6. Sees warnings about missing allergen statement
7. Clicks "Ask AI" → "What format is required?"
8. AI explains requirements
9. Revises text, checks again
10. Resolves all warnings
11. Proceeds to label design with confidence

### Scenario 2: Post-Production Label Fix

1. User uploads existing label image
2. Gets 3 compliance warnings
3. Asks AI about specific warning
4. Uploads revised label image
5. Sees improvement: 3 → 1 warning
6. Asks about remaining warning
7. Uploads final revision
8. Achieves full compliance
9. Exports session report as proof of due diligence

---

## Future Enhancements

### Phase 8+: Advanced Features

1. **Session Templates**
   - Save common workflows as templates
   - Share templates with team members

2. **Batch Session Management**
   - Work on multiple products simultaneously
   - Dashboard showing all active sessions

3. **Compliance Score Tracking**
   - Visual score: 0-100 based on warnings
   - Track score improvement over time

4. **Export Session Report**
   - PDF showing full iteration journey
   - Proof of compliance improvement
   - Shareable with stakeholders

5. **Team Collaboration**
   - Share sessions with team members
   - Comments and annotations
   - Assignment of tasks

6. **Smart Suggestions**
   - AI proactively suggests what to try next
   - "Based on this warning, try updating your ingredient list"

---

## Success Metrics

**KPIs to Track:**

1. **Session Engagement**
   - % of analyses that create sessions
   - Average iterations per session
   - Session completion rate (reach 0 warnings)

2. **Iteration Type Usage**
   - Chat questions per session
   - Text checks per session
   - Revised uploads per session

3. **Compliance Improvement**
   - Average warning reduction
   - Time to resolution
   - % of sessions achieving full compliance

4. **User Satisfaction**
   - Session feature adoption rate
   - User feedback/ratings
   - Feature usage vs. one-off analyses

---

## Technical Considerations

### Performance

- **Lazy Loading:** Load iterations on demand, not all at once
- **Caching:** Cache session context for chat AI
- **Streaming:** Stream chat responses for better UX
- **Pagination:** For sessions with many iterations

### Error Handling

- **Session Creation Fails:** Fallback to non-session analysis
- **Iteration Save Fails:** Show warning, allow retry
- **AI Request Fails:** Show error, don't break session

### Data Management

- **Session Cleanup:** Archive old sessions after 90 days
- **Storage:** Monitor JSONB size (might get large)
- **Backups:** Ensure sessions are in backup strategy

---

## Testing Plan

### Unit Tests

- [ ] Session creation and management helpers
- [ ] Iteration CRUD operations
- [ ] Compliance progress calculation

### Integration Tests

- [ ] End-to-end session flow
- [ ] All iteration types
- [ ] Session timeline rendering

### Manual Testing Scenarios

1. **Happy Path:** Complete session from upload → resolved
2. **Chat Only:** Ask questions without uploads
3. **Text Only:** Pre-production content checking
4. **Error Recovery:** Handle API failures gracefully
5. **Mobile:** Ensure responsive design works

---

## Deployment Checklist

- [ ] Apply database migration to production
- [ ] Test with sample users
- [ ] Monitor error rates
- [ ] Check performance metrics
- [ ] Gather user feedback
- [ ] Document feature in help docs
- [ ] Update pricing page (if usage limits change)
- [ ] Send feature announcement email

---

## Open Questions

1. **Auto-save vs Manual Save:** Should chat messages auto-save iterations?
2. **Session Naming:** Auto-generate titles or require user input?
3. **Session Sharing:** Allow sharing sessions with non-users?
4. **Anonymous Sessions:** Allow non-logged-in users to create temporary sessions?

---

## References

- Database schema: `supabase/migrations/20251022000000_create_analysis_sessions.sql`
- TypeScript types: `lib/supabase.ts`
- Helper functions: `lib/session-helpers.ts`
- Current analyze page: `app/analyze/page.tsx`
- Current API route: `app/api/analyze/route.ts`

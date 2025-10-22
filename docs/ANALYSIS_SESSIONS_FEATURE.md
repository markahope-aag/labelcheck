# Analysis Sessions Feature Specification

**Status:** Phase 6 Completed - Full Iteration Workflow Ready
**Created:** 2025-10-22
**Last Updated:** 2025-10-22 (Session 3)

## Implementation Status Summary

### ✅ Completed (Ready for Testing)
- **Database Infrastructure** - Sessions and iterations tables with RLS policies
- **Backend API** - Session creation, iteration tracking, chat endpoint, text/PDF analysis endpoint
- **Frontend UI** - Session context display, iteration buttons, chat interface, text/PDF checker modal
- **AI Chat Feature** - Fully functional context-aware Q&A system
- **Text Content Checker** - Dual-mode text/PDF analyzer with vision-based PDF reading
- **Revised Image Upload** - Complete revision workflow with visual comparison
- **Comparison Engine** - Tracks issues resolved/remaining/new across iterations with visual metrics

### 🔄 In Progress
- None currently

### 📋 Planned (Future Phases)
- Session timeline/history component
- Session export and reporting

---

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

### Phase 2: Update Existing Analysis Flow ✅ COMPLETED

**Goal:** Modify the current image analysis flow to create sessions

**Implementation:**

**Changes to `/app/api/analyze/route.ts`:**
- ✅ Accepts optional `sessionId` parameter from frontend
- ✅ Creates new session automatically if no sessionId provided
- ✅ Generates session title from uploaded filename (e.g., "Analysis: ProductName")
- ✅ Adds `session_id` field to analysis database record
- ✅ Creates iteration record (type: `image_analysis`) for each analysis
- ✅ Returns session data in API response
- ✅ Uses admin client for session operations to bypass RLS

**Changes to `/app/analyze/page.tsx`:**
- ✅ Added `sessionId` state management
- ✅ Extracts and stores session data from API response
- ✅ Displays session context banner when analysis completes
- ✅ Shows three iteration action buttons (Chat enabled, others coming soon)
- ✅ Resets sessionId when starting new analysis

**Backward Compatibility:**
- ✅ Existing analyses have `session_id = null` (still work fine)
- ✅ Old analysis flows continue to function without changes
- ✅ Sessions are automatic but don't break existing functionality

**Files Modified:**
- `app/api/analyze/route.ts` (Lines 135-163, 378, 398-420, 454-457)
- `app/analyze/page.tsx` (Lines 28, 107-109, 122, 334-402)

---

### Phase 3: Iteration Action Buttons ✅ COMPLETED

**Implementation:**

Created a beautiful session context banner that displays after analysis completes:

**Visual Design:**
- Gradient background (blue to indigo)
- "Analysis Session Active" header with clock icon
- Grid of three action buttons:
  1. **💬 Ask AI Questions** - Enabled, opens chat interface
  2. **📝 Check Text Alternative** - Disabled, coming soon
  3. **📸 Upload Revised Label** - Disabled, coming soon
- Each button has custom icon and color scheme
- Session ID displayed at bottom for reference

**Features:**
- ✅ Responsive grid (stacks on mobile, 3 columns on desktop)
- ✅ Hover effects on enabled buttons
- ✅ Clear visual feedback for disabled states
- ✅ Context message explaining iteration capability
- ✅ Only shown when sessionId exists

**Files Modified:**
- `app/analyze/page.tsx` (Lines 334-402)

**Screenshot Location:**
```
┌────────────────────────────────────────────┐
│ Analysis Session Active                    │
│ You can now iterate on this analysis...    │
│                                            │
│ [💬 Ask AI]  [📝 Check Text]  [📸 Upload] │
│                                            │
│ Session ID: abc123... • Maintains context  │
└────────────────────────────────────────────┘
```

---

### Phase 4: Chat Interface ✅ COMPLETED

**Implementation:**

**Backend API:** `app/api/analyze/chat/route.ts`
- ✅ Accepts `sessionId` and `message` from user
- ✅ Retrieves session with all iterations for context
- ✅ Builds comprehensive context message including:
  - Latest analysis results (product name, compliance status)
  - All recommendations with priority levels
  - Allergen information and potential issues
  - Last 3 chat messages for conversation continuity
- ✅ Sends context + question to Claude 3.5 Sonnet
- ✅ Saves chat interaction as `chat_question` iteration
- ✅ Returns AI response to frontend

**Frontend Component:** `components/AnalysisChat.tsx`
- ✅ Modal dialog interface (full-screen overlay)
- ✅ Clean card-based design (600px height, responsive)
- ✅ **Empty State:**
  - Welcoming message with icon
  - Three clickable suggested questions:
    - "What allergen format is required?"
    - "How should I word the net weight declaration?"
    - "Can you explain the ingredient order requirement?"
- ✅ **Active Conversation:**
  - Message bubbles (blue for user, gray for AI)
  - Timestamps on each message
  - Auto-scroll to latest message
  - Loading indicator while AI thinks
- ✅ **Input Area:**
  - Text input with send button
  - Enter to send keyboard shortcut
  - Context indicator message

**Integration:** `app/analyze/page.tsx`
- ✅ Added `isChatOpen` state
- ✅ Updated "Ask AI Questions" button (enabled, with onClick)
- ✅ Renders AnalysisChat component when sessionId exists
- ✅ Chat dialog manages its own open/close state

**Features:**
- ✅ Context-aware responses based on specific analysis results
- ✅ Conversation history maintained across messages
- ✅ Database persistence (all chats saved as iterations)
- ✅ Real-time messaging with loading states
- ✅ Error handling with toast notifications
- ✅ Clean, modern UI with suggested questions

**Files Created:**
- `app/api/analyze/chat/route.ts` (164 lines)
- `components/AnalysisChat.tsx` (177 lines)

**Files Modified:**
- `app/analyze/page.tsx` (Lines 14, 30, 352-363, 787-793)

**API Endpoint:**
```typescript
POST /api/analyze/chat
Body: {
  sessionId: string,
  message: string,
  parentIterationId?: string // optional, for threading
}
Response: {
  response: string,
  iterationId: string,
  timestamp: string
}
```

---

### Phase 5: Text Content Checker ✅ COMPLETED

**Implementation:**

**Backend API:** `app/api/analyze/text/route.ts`
- ✅ Accepts both JSON (text mode) and FormData (PDF mode)
- ✅ Dual input support:
  - **Text Mode:** Plain text content via JSON body
  - **PDF Mode:** PDF file upload with vision-based text extraction
- ✅ Fetches session with all iterations for comparison context
- ✅ Builds context including original analysis findings
- ✅ **PDF Processing (Vision-Based):**
  - Converts PDF to base64
  - Sends to Claude API with `type: 'document'`
  - Uses Claude's vision capabilities to read complex label layouts
  - Handles text in various orientations, fonts, colors, backgrounds
  - No simple text extraction - full visual understanding
- ✅ **Text Processing:**
  - Analyzes plain text content for compliance
  - Notes limitations (can't evaluate visual elements)
- ✅ Comparison logic in AI prompt:
  - Lists original issues found
  - Identifies resolved issues
  - Identifies remaining issues
  - Identifies new issues introduced
  - Provides improvement summary
- ✅ Saves as `text_check` iteration with metadata
- ✅ Returns analysis with comparison data

**Frontend Component:** `components/TextChecker.tsx`
- ✅ Modal dialog interface (full-screen overlay)
- ✅ **Mode Selector:**
  - Tab-style buttons to switch between Paste Text / Upload PDF
  - Clear visual feedback for active mode
- ✅ **Text Mode Features:**
  - Large textarea with placeholder example
  - "Load Example" button with sample coffee label text
  - Helper text explaining what to include
  - Warning about text-only limitations
- ✅ **PDF Mode Features:**
  - Drag-and-drop upload area
  - File validation (PDF type, 10MB max)
  - File preview with name and size
  - "Remove File" button
  - Info panel explaining complex text recognition capabilities
- ✅ **UI/UX:**
  - Blue info panel explaining how it works (changes based on mode)
  - Yellow warning panel for text mode limitations
  - Green info panel for PDF capabilities
  - Disabled state handling
  - Loading states during analysis
  - Toast notifications for success/error
- ✅ **Integration:**
  - Sends FormData for PDF, JSON for text
  - Calls parent callback on completion
  - Closes modal after successful analysis

**Integration:** `app/analyze/page.tsx`
- ✅ Added `isTextCheckerOpen` state
- ✅ Updated "Check Text Alternative" button (enabled, with onClick)
- ✅ Added `handleTextAnalysisComplete` callback
- ✅ Renders TextChecker component when sessionId exists
- ✅ Passes analysis results to comparison view

**Technical Implementation:**
- ✅ Updated `@anthropic-ai/sdk` to v0.67.0 for PDF document support
- ✅ Claude API uses `type: 'document'` with `media_type: 'application/pdf'`
- ✅ Vision-based reading (not simple text extraction)
- ✅ Regulatory context included in prompts
- ✅ Comparison data structure in response

**Files Created:**
- `app/api/analyze/text/route.ts` (293 lines)
- `components/TextChecker.tsx` (336 lines)

**Files Modified:**
- `app/analyze/page.tsx` (Lines 32, 383-395, 195-207, 811-819)
- `package.json` (@anthropic-ai/sdk upgraded to 0.67.0)

**API Endpoint:**
```typescript
POST /api/analyze/text

// Text mode:
Content-Type: application/json
Body: {
  sessionId: string,
  textContent: string
}

// PDF mode:
Content-Type: multipart/form-data
Body: FormData {
  sessionId: string,
  pdf: File
}

Response: {
  ...analysisData, // Same structure as image analysis
  comparison?: {
    issues_resolved: string[],
    issues_remaining: string[],
    new_issues: string[],
    improvement_summary: string
  },
  iterationId: string,
  analysisType: 'text_check',
  timestamp: string
}
```

**Key Features:**
- ✅ Dual-mode input (text + PDF with vision)
- ✅ Context-aware comparison to original analysis
- ✅ Complex PDF text recognition (rotated, small fonts, poor contrast)
- ✅ Limitation warnings for text-only mode
- ✅ Database persistence as iterations
- ✅ Clean, modern UI with mode switching

---

### Phase 6: Revised Image Upload ✅ COMPLETED

**Route:** In-page panel (reuses image upload component)

**Implementation:**

**Frontend:** `app/analyze/page.tsx`
- ✅ Added `isRevisedMode` and `previousResult` state management
- ✅ Enabled "Upload Revised Label" button with onClick handler
- ✅ Shows purple "Revision Mode Active" banner when in revision mode
- ✅ Automatically passes `sessionId` to API for revised uploads
- ✅ Comparison calculation engine counts issues across all sections
- ✅ Visual comparison component displays:
  - Previous issue count
  - Improvement metric (↓ resolved, ↑ new, = no change)
  - Current issue count with green highlight if fully compliant
  - Success message when compliance status improves

**API Integration:**
- ✅ Modified `handleAnalyze` to include `sessionId` in FormData for revisions
- ✅ Reuses existing `/api/analyze` endpoint (no backend changes needed)
- ✅ Creates `revised_analysis` iteration automatically via existing session logic

**User Experience:**
1. User completes initial analysis
2. Clicks "Upload Revised Label" button
3. Previous results stored for comparison
4. Upload UI reappears with "Revision Mode" indicator
5. User uploads improved label
6. Beautiful comparison card shows improvement metrics:
   - Three-column layout (Previous → Improvement → Current)
   - Color-coded indicators (green for improvements, red for new issues)
   - Special success message if compliance status improved
7. User can continue iterating

**Visual Design:**
- Gradient purple-to-pink comparison card
- Responsive grid layout (stacks on mobile)
- Large, bold improvement numbers
- Success checkmarks and status improvements highlighted
- Fully compliant results get green background with "✓ Fully Compliant!"

**Files Modified:**
- `app/analyze/page.tsx` (Lines 33-34, 89-131, 221-296, 536-614)

---

### Phase 7: Session Timeline/History 📋 PLANNED

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

## What's Working Now (Ready for Testing)

### User Experience Flow

**1. Upload Label → Session Created**
- User uploads label image on `/analyze` page
- Backend automatically creates a new session
- Session ID returned with analysis results
- First iteration record created (type: `image_analysis`)

**2. View Results with Session Context**
- Analysis results displayed as before (fully backward compatible)
- NEW: Session context banner appears above results
- Banner shows "Analysis Session Active" with three action buttons
- Session ID shown for reference

**3. Ask AI Questions (ACTIVE)**
- User clicks "Ask AI Questions" button
- Chat modal opens with empty state showing suggested questions
- User types question or clicks suggestion
- AI receives full context:
  - Product name and type
  - Compliance status and summary
  - All recommendations with priorities
  - Allergen information
  - Previous chat history (last 3 exchanges)
- AI response displayed in chat interface
- Chat saved to database as `chat_question` iteration
- User can ask follow-up questions with maintained context

**4. Check Text Alternative (ACTIVE)**
- User clicks "Check Text Alternative" button
- Modal opens with dual-mode selector (Paste Text / Upload PDF)
- User pastes prospective label text or uploads PDF
- AI analyzes content with vision-based PDF reading
- Comparison shows issues resolved/remaining/new vs. original
- Saved as `text_check` iteration

**5. Upload Revised Label (ACTIVE)**
- User clicks "Upload Revised Label" button
- Purple "Revision Mode Active" banner appears
- Upload UI reappears to accept new image
- User uploads improved label
- AI analyzes with session context
- **Comparison Card Displays:**
  - Previous issue count (e.g., "5 issues")
  - Improvement arrow (↓ 3 Issues Resolved)
  - Current issue count (e.g., "2 issues remaining")
  - Green highlight if fully compliant
  - Success message if status improved
- Creates `revised_analysis` iteration
- User can iterate multiple times

**6. Database Tracking**
- All sessions stored in `analysis_sessions` table
- All iterations (image analysis + chat) in `analysis_iterations` table
- Full audit trail of user's compliance improvement journey
- RLS policies ensure user can only see their own data

### Technical Details

**Session Creation:**
- Automatic on first image analysis
- Title auto-generated from filename (e.g., "Analysis: Coffee Label.png")
- Status set to `in_progress`
- Uses `supabaseAdmin` to bypass RLS for creation

**Iteration Tracking:**
- Image analysis creates `image_analysis` iteration
- Chat creates `chat_question` iteration
- Text/PDF check creates `text_check` iteration
- Revised upload creates `revised_analysis` iteration
- Each iteration has `input_data` and `result_data` JSONB fields
- Timestamps track when each interaction occurred

**Context Building:**
- Chat API fetches session with all iterations
- Builds context from latest analysis + recent chats
- Sends comprehensive context to Claude API
- Response quality improved by including full analysis details

### What Needs Testing

**Happy Path:**
1. Upload a label image with compliance issues
2. Wait for analysis to complete
3. Click "Ask AI Questions" and ask about specific warnings
4. Click "Check Text Alternative" and test revised text
5. Click "Upload Revised Label" and upload improved version
6. Verify comparison card shows accurate improvement metrics
7. Repeat revision process to test multiple iterations
8. Verify all improvements tracked correctly

**Visual Verification:**
- Session banner displays with all 3 buttons enabled
- Revision mode banner appears when uploading revised label
- Comparison card shows correct issue counts
- Green highlight appears when fully compliant
- Improvement arrows show correct direction (↓ ↑ =)
- Success message displays when status improves

**Database Verification:**
- Check `analysis_sessions` table for new records
- Check `analysis_iterations` table for all types: `image_analysis`, `chat_question`, `text_check`, `revised_analysis`
- Verify `analyses.session_id` is populated
- Verify iteration order and timestamps are correct

**Edge Cases:**
- Multiple analyses by same user (new session each time)
- Multiple revisions in same session (comparison always vs. previous)
- Upload same image twice (comparison shows no change)
- Upload worse image (comparison shows new issues with ↑)
- Session persists across page refreshes (sessionId in state)
- Revised upload with no issues in original (comparison still works)

---

## API Endpoints

### Implemented Endpoints

**`POST /api/analyze/chat`** ✅ ACTIVE
- Accept chat questions about analysis
- Build context from session iterations
- Save conversation to database
- Return AI response

**Modified: `POST /api/analyze`** ✅ ACTIVE
- Now creates sessions automatically
- Accepts optional `sessionId` parameter
- Returns session data in response

### Planned Endpoints

**`POST /api/sessions`**
- Create new session manually
- Returns session ID

**`GET /api/sessions/:id`**
- Get session with all iterations
- Returns timeline data for display

**`POST /api/analyze/text`**
- Analyze text content (prospective labels)
- Creates text_check iteration
- Compares to original analysis

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

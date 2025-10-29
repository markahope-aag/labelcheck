# Phase II: Product Library + Workflow Management

**Status:** Planned for Future Development
**Priority:** High
**Created:** 2025-10-29

## Problem Statement

Currently, LabelCheck focuses on **single-analysis workflows**. Users like Sarah analyze individual labels, but as their product lines grow, they need:

1. **Product-centric organization** - Group all SKU variants and versions in one place
2. **Version tracking** - See history of iterations for each product (v1 → v2 → v3)
3. **Batch operations** - Manage multiple products together
4. **Collaborative workflows** - Assign tasks, add comments, approve changes
5. **Status management** - Track products through Draft → Review → Approved → Print-Ready states

## Phase I Solution (Implemented)

**Label Name Field:**
- Added `label_name` text field to `analyses` table
- User can name each analysis (e.g., "Cold Brew Coffee - Original")
- Searchable/filterable in history page
- Falls back to AI-extracted `product_name` if not provided

**Impact:**
- Analysis history becomes a de facto product list
- Sarah searches "Cold Brew" and sees all Cold Brew products/versions
- Simple, low-overhead solution that provides immediate value

**Limitations:**
- Still analysis-centric (chronological), not product-centric (grouped by SKU)
- No explicit version linking
- No batch operations or workflow management

---

## Phase II Features (Planned)

### 1. Product Library

**Concept:** A dedicated "My Products" page that groups analyses by product/SKU.

#### Database Schema

**New Table: `products`**
```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

  -- Product Identification
  product_name TEXT NOT NULL,
  product_line TEXT, -- e.g., "Coffee Line", "Protein Bars"
  sku TEXT, -- UPC, SKU, or internal product code

  -- Metadata
  category TEXT, -- CONVENTIONAL_FOOD, DIETARY_SUPPLEMENT, etc.
  description TEXT,
  tags TEXT[], -- e.g., ["gluten-free", "organic", "coffee"]

  -- Status Tracking
  current_status TEXT NOT NULL DEFAULT 'draft', -- draft, in_review, approved, print_ready, archived
  latest_analysis_id UUID REFERENCES analyses(id),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_products_user_id ON products(user_id);
CREATE INDEX idx_products_organization_id ON products(organization_id);
CREATE INDEX idx_products_current_status ON products(current_status);
CREATE INDEX idx_products_tags ON products USING gin(tags);
```

**Modified Table: `analyses`**
```sql
-- Add foreign key to link analyses to products
ALTER TABLE analyses
ADD COLUMN product_id UUID REFERENCES products(id) ON DELETE SET NULL;

CREATE INDEX idx_analyses_product_id ON analyses(product_id);
```

#### UI/UX

**Products Dashboard (`/products`)**
```
┌─────────────────────────────────────────────────────────┐
│ MY PRODUCTS                          [+ New Product]    │
├─────────────────────────────────────────────────────────┤
│ Search: [cold brew          ]  Status: [All       ▼]   │
│ Tags: [coffee] [gluten-free] [x]                        │
├─────────────────────────────────────────────────────────┤
│ Coffee Line (3 products)                                │
│                                                          │
│ ┌──────────────────────────────────────────────────┐   │
│ │ Cold Brew - Original                              │   │
│ │ ✅ PRINT-READY • 3 versions • UPC: 012345678901  │   │
│ │ Last updated: Oct 25, 2025                        │   │
│ │ [View] [Upload New Version] [Archive]            │   │
│ └──────────────────────────────────────────────────┘   │
│                                                          │
│ ┌──────────────────────────────────────────────────┐   │
│ │ Cold Brew - Vanilla                               │   │
│ │ ⚠️ IN REVIEW • 2 versions • 2 issues remaining   │   │
│ │ Last updated: Oct 20, 2025                        │   │
│ │ [View] [Upload New Version] [Archive]            │   │
│ └──────────────────────────────────────────────────┘   │
│                                                          │
│ Protein Bars (5 products) [Expand ▼]                    │
└─────────────────────────────────────────────────────────┘
```

**Product Detail Page (`/products/[id]`)**
```
┌─────────────────────────────────────────────────────────┐
│ Cold Brew Coffee - Original                              │
│ ✅ PRINT-READY • UPC: 012345678901                       │
├─────────────────────────────────────────────────────────┤
│ VERSION HISTORY                                          │
│                                                          │
│ ✅ v3 (Oct 25, 2025) - APPROVED FOR PRINT               │
│    Status: Print-Ready • 0 issues • Approved by: Jane   │
│    [View Analysis] [Download PDF] [Revert to This]      │
│                                                          │
│ 🔄 v2 (Oct 20, 2025) - Fixed allergen statement          │
│    Status: Reviewed • 2 issues resolved                 │
│    [View Analysis] [Compare to v3]                       │
│                                                          │
│ ❌ v1 (Oct 15, 2025) - Initial submission                │
│    Status: Non-Compliant • 5 critical issues found      │
│    [View Analysis]                                       │
│                                                          │
├─────────────────────────────────────────────────────────┤
│ CURRENT ISSUES (0)                                       │
│ ✅ All compliance issues resolved!                       │
│                                                          │
├─────────────────────────────────────────────────────────┤
│ ACTIONS                                                  │
│ [Upload New Version] [Share with Co-packer]             │
│ [Export Compliance Report] [Archive Product]            │
└─────────────────────────────────────────────────────────┘
```

**Features:**
- Group products by product line/category
- See all versions of a specific product
- Track status progression (Draft → Review → Approved → Print-Ready)
- Quick access to current issues
- Upload new version linked to same product

---

### 2. Workflow Management

**Concept:** Structured approval process with task assignment and status tracking.

#### Database Schema

**New Table: `product_tasks`**
```sql
CREATE TABLE product_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  analysis_id UUID REFERENCES analyses(id) ON DELETE CASCADE,

  -- Task Details
  title TEXT NOT NULL,
  description TEXT,
  task_type TEXT NOT NULL, -- fix_issue, review, approve, redesign, etc.
  priority TEXT NOT NULL DEFAULT 'medium', -- critical, high, medium, low

  -- Assignment
  assigned_to UUID REFERENCES users(id),
  assigned_by UUID REFERENCES users(id),

  -- Status
  status TEXT NOT NULL DEFAULT 'open', -- open, in_progress, completed, cancelled

  -- Metadata
  related_issue_index INTEGER, -- Links to specific issue in recommendations array
  due_date DATE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_product_tasks_product_id ON product_tasks(product_id);
CREATE INDEX idx_product_tasks_assigned_to ON product_tasks(assigned_to);
CREATE INDEX idx_product_tasks_status ON product_tasks(status);
```

**New Table: `product_comments`**
```sql
CREATE TABLE product_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  analysis_id UUID REFERENCES analyses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,

  -- Comment Content
  comment_text TEXT NOT NULL,
  comment_type TEXT DEFAULT 'general', -- general, issue_feedback, approval, rejection

  -- References
  related_issue_index INTEGER, -- Links to specific issue in recommendations
  parent_comment_id UUID REFERENCES product_comments(id), -- For threading

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_product_comments_product_id ON product_comments(product_id);
CREATE INDEX idx_product_comments_analysis_id ON product_comments(analysis_id);
```

**New Table: `product_approvals`**
```sql
CREATE TABLE product_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  analysis_id UUID REFERENCES analyses(id) ON DELETE CASCADE NOT NULL,

  -- Approval Details
  approver_id UUID REFERENCES users(id) NOT NULL,
  approval_status TEXT NOT NULL, -- approved, rejected, changes_requested
  approval_notes TEXT,

  -- Workflow Step
  step_name TEXT NOT NULL, -- e.g., "Regulatory Review", "Design Approval", "Final Sign-Off"

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_product_approvals_product_id ON product_approvals(product_id);
CREATE INDEX idx_product_approvals_analysis_id ON product_approvals(analysis_id);
```

#### UI/UX

**Task Management Section (on Product Detail Page)**
```
┌─────────────────────────────────────────────────────────┐
│ TASKS (2 open, 3 completed)                              │
│                                                          │
│ ☐ Fix net weight format                                 │
│   Priority: HIGH • Assigned to: Designer                 │
│   Due: Oct 30, 2025 • Related to Issue #2               │
│   [Mark Complete] [Add Comment] [Reassign]              │
│                                                          │
│ ☐ Update allergen statement                             │
│   Priority: CRITICAL • Assigned to: Me                   │
│   Due: Oct 28, 2025 • Related to Issue #1               │
│   [Mark Complete] [Add Comment]                          │
│                                                          │
│ [+ Add Task] [View Completed]                           │
└─────────────────────────────────────────────────────────┘
```

**Comments Section**
```
┌─────────────────────────────────────────────────────────┐
│ COMMENTS (5)                                             │
│                                                          │
│ Jane Smith • Oct 25, 2025 3:45 PM                       │
│ "Allergen statement looks good now. Approved!"          │
│   [Reply] [Edit] [Delete]                               │
│                                                          │
│   └─ You • Oct 25, 2025 4:02 PM                         │
│      "Thanks for the review!"                            │
│                                                          │
│ Designer • Oct 20, 2025 10:30 AM                        │
│ "Updated the net weight format per FDA requirements."    │
│   [Reply] [Link to Version]                             │
│                                                          │
│ [Add Comment...]                                         │
└─────────────────────────────────────────────────────────┘
```

**Approval Workflow**
```
┌─────────────────────────────────────────────────────────┐
│ APPROVAL STATUS                                          │
│                                                          │
│ ✅ Design Review - Approved by Designer (Oct 20)        │
│ ✅ Regulatory Review - Approved by Consultant (Oct 22)  │
│ ⏳ Final Sign-Off - Pending (Sarah)                      │
│                                                          │
│ [Approve for Print] [Request Changes] [Reject]          │
└─────────────────────────────────────────────────────────┘
```

---

### 3. Batch Operations

**Concept:** Perform actions on multiple products at once.

#### Features

**Multi-Select Products:**
```
┌─────────────────────────────────────────────────────────┐
│ MY PRODUCTS                       [Select Mode: ON]     │
├─────────────────────────────────────────────────────────┤
│ ☑ Cold Brew - Original     ✅ PRINT-READY               │
│ ☑ Cold Brew - Vanilla      ⚠️ IN REVIEW                 │
│ ☐ Cold Brew - Mocha        🔄 DRAFT                      │
│                                                          │
│ 2 selected • [Export All] [Archive All] [Tag All]       │
└─────────────────────────────────────────────────────────┘
```

**Batch Actions:**
- Export multiple products as single PDF
- Archive multiple products
- Apply tags to multiple products
- Change status for multiple products
- Share multiple products with team member

---

### 4. Enhanced Sharing & Collaboration

**Concept:** Share products with specific instructions and track who viewed/edited.

#### Database Schema

**New Table: `product_shares`**
```sql
CREATE TABLE product_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  shared_by UUID REFERENCES users(id) NOT NULL,

  -- Share Details
  share_token TEXT UNIQUE NOT NULL,
  share_type TEXT NOT NULL DEFAULT 'view', -- view, comment, edit
  recipient_email TEXT,

  -- Message
  share_message TEXT,
  instructions TEXT,

  -- Tracking
  expires_at TIMESTAMPTZ,
  view_count INTEGER DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_product_shares_product_id ON product_shares(product_id);
CREATE INDEX idx_product_shares_token ON product_shares(share_token);
```

#### UI/UX

**Share Dialog with Instructions**
```
┌─────────────────────────────────────────────────────────┐
│ Share "Cold Brew - Original"                             │
├─────────────────────────────────────────────────────────┤
│ Recipient Email:                                         │
│ [designer@example.com                              ]     │
│                                                          │
│ Permission Level:                                        │
│ ( ) View Only                                            │
│ (•) View + Comment                                       │
│ ( ) Full Edit Access                                     │
│                                                          │
│ Message (optional):                                      │
│ ┌────────────────────────────────────────────────┐      │
│ │ Hi! Please review this label and update the    │      │
│ │ net weight format per Issue #2.                │      │
│ └────────────────────────────────────────────────┘      │
│                                                          │
│ Specific Tasks:                                          │
│ ☑ Fix net weight format (Issue #2)                      │
│ ☑ Update allergen statement (Issue #1)                  │
│                                                          │
│ Expires: [7 days ▼]                                      │
│                                                          │
│ [Cancel] [Share Product]                                 │
└─────────────────────────────────────────────────────────┘
```

**Sharing Activity Log**
```
┌─────────────────────────────────────────────────────────┐
│ SHARING ACTIVITY                                         │
│                                                          │
│ Shared with designer@example.com                         │
│ • View + Comment access                                  │
│ • Last viewed: Oct 26, 2025 2:30 PM                     │
│ • 3 comments added                                       │
│ [Revoke Access] [Resend Invitation]                     │
└─────────────────────────────────────────────────────────┘
```

---

## Implementation Roadmap

### Phase II.A: Product Library (4-6 weeks)
**Priority:** HIGH

1. **Week 1-2: Database & Backend**
   - Create `products` table
   - Add `product_id` foreign key to `analyses`
   - Build API endpoints:
     - `POST /api/products` - Create product
     - `GET /api/products` - List products
     - `GET /api/products/[id]` - Get product with versions
     - `PUT /api/products/[id]` - Update product
     - `DELETE /api/products/[id]` - Archive product
   - Migration to optionally link existing analyses to products

2. **Week 3-4: Frontend UI**
   - `/products` page - Product dashboard
   - `/products/[id]` page - Product detail with version history
   - Upload new version workflow
   - Product grouping by product line

3. **Week 5-6: Polish & Testing**
   - Search and filter by tags, status, product line
   - Batch operations (select multiple, export all)
   - User testing and feedback

### Phase II.B: Workflow Management (6-8 weeks)
**Priority:** MEDIUM

1. **Week 1-2: Database & Backend**
   - Create `product_tasks`, `product_comments`, `product_approvals` tables
   - Build API endpoints for task management
   - Build API endpoints for comments
   - Build API endpoints for approvals

2. **Week 3-5: Frontend UI**
   - Task management UI on product detail page
   - Comments section with threading
   - Approval workflow interface
   - Email notifications for assignments

3. **Week 6-8: Advanced Features**
   - Task due dates and reminders
   - Task templates for common workflows
   - Approval chains (multi-step approvals)
   - Activity feed showing all product changes

### Phase II.C: Enhanced Sharing (2-3 weeks)
**Priority:** LOW (but high user value)

1. **Week 1-2: Database & Backend**
   - Create `product_shares` table
   - Build share API with permissions
   - Track view/comment activity

2. **Week 3: Frontend UI**
   - Share dialog with instructions
   - Activity log showing who viewed/commented
   - Recipient view with task list

---

## Success Metrics

**Product Library Adoption:**
- % of users who create products (vs. just uploading analyses)
- Average number of products per user
- Average versions per product

**Workflow Engagement:**
- % of products with tasks assigned
- Average task completion time
- % of products with comments/collaboration

**Collaboration Impact:**
- Number of product shares sent
- % of shares that result in comments/edits
- Time to resolve issues (with vs. without collaboration)

**User Satisfaction:**
- NPS score for product library feature
- Feature adoption rate (% of paid users using it)
- Support ticket reduction (fewer "how do I organize my labels" questions)

---

## Technical Considerations

### Performance
- **Pagination:** Product lists and version history should paginate for users with 100+ products
- **Caching:** Cache product status summaries to avoid recalculating on every page load
- **Indexes:** Proper indexes on `product_id`, `user_id`, `organization_id`, `status`, `tags`

### Data Migration
- Existing analyses remain functional without `product_id` link
- Provide UI to "Link to Product" for historical analyses
- Auto-suggest product based on `label_name` similarity

### Backward Compatibility
- History page remains functional for analysis-centric view
- Users can continue using single-analysis workflow if they prefer
- Product library is optional, not required

---

## Alternative Approaches Considered

### Approach 1: Keep it Simple (Chosen for Phase I)
- Add `label_name` field to analyses
- Use search to find all analyses with similar names
- **Pros:** Quick to implement, low complexity
- **Cons:** No explicit version linking, no workflow management

### Approach 2: Full Product Library (Phase II)
- Dedicated `products` table with version history
- Task assignment and approval workflows
- **Pros:** Professional product management, great UX
- **Cons:** Higher complexity, longer development time

### Approach 3: Hybrid (Recommended Path)
- **Phase I:** Label name field (implemented)
- **Phase II.A:** Product library with version history
- **Phase II.B:** Workflow management as optional add-on
- **Pros:** Iterative value delivery, test and learn
- **Cons:** Some features delayed

---

## Open Questions

1. **Auto-linking:** Should the system auto-create products when it detects similar `label_name` values?
2. **Pricing:** Is product library a premium feature or available to all plans?
3. **Team Plans:** Should products be shared at organization level or per-user?
4. **Versioning:** How do we handle major vs. minor version changes?
5. **Archiving:** Should archived products be hidden or just filtered out by default?

---

## References

- Current label_name implementation: `supabase/migrations/20251029000000_add_label_name.sql`
- Analysis Sessions feature: `docs/ANALYSIS_SESSIONS_FEATURE.md`
- Database schema: `lib/supabase.ts`
- User feedback: TBD after Phase I testing

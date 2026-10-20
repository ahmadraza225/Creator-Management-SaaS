# Product spec: Creator Retainers (v0.1)

Owner: content strategy team (internal only). Last updated: October 2026.

## 1. Goal

One place to run every retainer collaboration from "creator shortlisted" to "final payment made", replacing the manual Google Sheets tracker. Keep it simple: no feature that needs an API we don't have, no roles yet, no client logins.

## 2. Decisions

### Source of truth: this app's own database
- **Not Euka or Reacher.** Their APIs only cover shops connected to our account. At the time of writing, the Euka key sees one brand with no retainer programs and the Reacher key sees three shops, none of which are the client brands in the tracker. Neither can hold the pipeline.
- **Not Google Sheets as a database.** The tracker shows why: notes inside number columns ("$500 for 10 since budget has some flexibility"), "20 videos" vs `20`, goal rows mixed with creator rows, one tab per brand, and no history. A database enforces clean values and lets the app compute budgets and to-dos.
- **Euka / Reacher become enrichment later** (Phase 2): pull views/GMV for videos of brands whose shops are connected, matched by creator handle and video URL. Each brand already has optional `eukaBrandId` / `reacherShopId` fields for this.
- Google Sheets stays available as an **export** (Payments → Export CSV).

### Payments: recorded, not sent
Clients pay creators directly by PayPal or Zelle, so the app never moves money and doesn't use Euka or Reacher wallets. It records each payment's state:

| Status | Meaning |
|---|---|
| Pending | Not requested yet |
| Details shared with client | We sent the client the creator's PayPal/Zelle details and the amount |
| On hold | Paused (dispute, missing videos, client asked to wait) |
| Paid | Client confirmed: date, method, transaction ID, proof link (screenshot in Drive) |
| Cancelled | Will not be paid |

Each retainer automatically gets an **Upfront** payment (default 50% of the flat fee) and a **Final** payment (the rest). Bonus/other payments can be added. If the fee changes after the upfront is paid, the final becomes "fee minus what was paid".

### Retainer deal = flat fee for N videos + base commission % + shop ads commission %
Commissions are stored for reference (they're paid through TikTok Shop, not by us).

### Users
Email + password login. Everyone is ADMIN for now; the `role` column exists so roles can be added later without a migration.

## 3. Pipeline stages

`Shortlisted → Client review → Client approved → Contract sent → Contract signed → Sample shipped → Posting → Completed`, with exits `Stopped` and `Declined`.

Mapping from the old sheet: "Shared with client"/"Client review" → Client review · Client status "Accepted" → Client approved · "Contract shared" → Contract sent · "Contract Signed, Awaiting upfront and sample" → Contract signed · "Sample shipped" → Sample shipped · "Posting started" → Posting · "collab completed" → Completed · Collab status "Stopped" → Stopped · "Rejected"/client "Declined" → Declined.

## 4. Budget rules (Brands & budgets screen)
- Monthly budget per brand. A retainer counts toward the month it **starts**.
- **Allocated** = full flat fee of every retainer from "Client approved" to "Completed", plus what was actually paid on "Stopped" ones. Shortlisted/client review/declined count as 0.
- **Remaining** = budget − allocated (negative = over budget, shown in red). Usage bar turns amber at 90% and red above 100%.
- **Videos** = delivered (not marked "doesn't count") vs required.

## 5. "Waiting on you" rules
| Trigger | Action shown |
|---|---|
| In client review > 3 days | Chase client for a decision |
| Client approved | Send contract |
| Contract sent > 3 days | Follow up on unsigned contract |
| Signed+ and creator has no payout details | Collect PayPal / Zelle details (urgent) |
| Signed+ and upfront Pending | Share upfront payment details with client (urgent) |
| Upfront "details shared" | Confirm upfront was paid by client |
| Upfront on hold | Upfront payment on hold (urgent) |
| Signed+ and sample not sent | Ship sample |
| Posting, past due date | Overdue x/y videos (urgent) |
| Posting, below a straight line from start to due date | Behind pace |
| Posted videos without Spark code | Get Spark code |
| All videos delivered, final not paid | Arrange final payment (urgent) · Mark collab completed |

## 6. Roadmap

**v0.1 (this version):** everything above, plus the spreadsheet importer, Spark code list per brand and angle performance per brand from manually entered views/GMV.

**v0.2: enrichment from APIs, only for connected shops**
- Nightly job: for each brand with `reacherShopId` / `eukaBrandId`, fetch creator videos and fill views + GMV on matching videos. Also suggest new videos from retainer creators that haven't been added yet.
- Requirement: the client's TikTok Shop must be connected to our Reacher or Euka account, and the developer needs the REST API key for that plan.

**v0.3: nice-to-haves (only if the team asks)**
- Activity history per retainer (who changed what)
- Weekly email digest of "Waiting on you"
- AI angle tagging from video transcripts (Claude API)
- Roles (strategist vs finance) once the team agrees on them

## 7. Out of scope (on purpose)
Client logins and shared links, sending payments, outreach/DM automation (Reacher/Euka already do this), contracts e-signing (keep using Drive links).

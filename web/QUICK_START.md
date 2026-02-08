# Quick Start: New Playbook Dashboard

## 🚀 Access the New Dashboard

Navigate to: **`/playbook`**

Example: `http://localhost:3000/playbook` (dev) or `https://yourapp.com/playbook` (production)

## ✨ What You'll See

### Desktop View (1024px+)
```
┌─────────────────────────────────────────────────────────┐
│  Your Playbook                   [Tokens] [Streak]      │
│  Track → Goal → Actions. One clear next step.           │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────┐  ┌──────────────────────┐
│  Next step              │  │  Weekly patterns     │
│  ○ 6-day streak         │  │  • Risk window: ...  │
│  [Continue Plan]        │  │  • Best tool: ...    │
│                         │  │  • Best lever: ...   │
│  Today's actions        │  │  [Apply plan]        │
│  [Track] [Wellness]     │  │                      │
│  ☐ Action 1    [Start]  │  │  Tokens              │
│  ☐ Action 2    [Start]  │  │  [Buy tokens]        │
│  ☑ Action 3    [Done]   │  │                      │
└─────────────────────────┘  └──────────────────────┘
```

### Mobile View (375px)
```
┌─────────────────────┐
│  Your Playbook      │
│  [Tokens] [Streak]  │
└─────────────────────┘
┌─────────────────────┐
│  Next step          │
│  [Continue Plan]    │
└─────────────────────┘
┌─────────────────────┐
│  Today's actions    │
│  [Track goal tab]   │
│  [Wellness tab]     │
│  Actions list...    │
└─────────────────────┘
┌─────────────────────┐
│  Weekly patterns    │
└─────────────────────┘
┌─────────────────────┐
│  Tokens             │
└─────────────────────┘
```

## 🎯 Core Interactions

### Toggle Action Tabs
1. Click **"Porn goal: [name]"** to see Track actions
2. Click **"Wellness"** to see Wellness actions
3. Action list updates immediately

### Complete an Action
1. Click **"Start"** on any action → navigates to action flow (currently alerts + goes to chat)
2. After completing, click **"Done"** → marks complete, updates streak

### Manage Settings
1. Click **"Manage"** button (top right of actions card)
2. Change primary track (Porn/Sex/Food)
3. Edit goal names
4. Click "Regenerate" buttons (placeholder - TODO)
5. Close modal

### Continue Plan
1. Click **"Continue Plan (2 min)"** → starts first incomplete action
2. If all complete → opens Manage modal

## 📊 Data Sources

Currently using **mock/placeholder data** for:
- Track actions (3 items)
- Wellness actions (3 items)
- Weekly patterns insights

**Real data** from Supabase:
- ✅ Token balance
- ✅ User profile
- ✅ Challenges and goals
- ✅ Action completions (for streak)

## 🔧 Integration TODOs

### Priority 1: Connect Action Flow
Replace the alert in `handleStartAction()` with your real action execution:
- Navigate to chat with action context
- Open action modal
- Start protocol/timer

### Priority 2: Real Actions
Replace mock data in `fetchActionsForGoals()`:
- Query `action_plans` table
- Map to Track vs Wellness goals
- Display user-specific actions

### Priority 3: Manage Save Logic
Implement save handlers in Manage modal:
- Update `users.primary_track`
- Save goal name changes
- Call action generation API

### Priority 4: Weekly Patterns
Calculate real insights:
- Risk windows from activity logs
- Best tools from completion patterns
- Most effective boundaries

## 🐛 Known Limitations

1. **Mock Actions**: Not pulling from real `action_plans` yet
2. **Action Start**: Just alerts + navigates, needs full flow
3. **Manage Save**: UI only, doesn't persist changes
4. **Patterns**: Hardcoded placeholders, needs analytics

All clearly marked with `// TODO:` comments in code.

## 📁 Key Files

- **Page**: `pages/playbook.js`
- **Styles**: `styles/Playbook.module.css`
- **Nav Link**: `components/Layout.js` (line ~107)
- **Docs**: `PLAYBOOK_DASHBOARD_README.md`

## ✅ Testing Checklist

- [ ] Load `/playbook` (logged in)
- [ ] Resize browser 320px → 1400px (no overflow)
- [ ] Toggle Track ↔ Wellness tabs
- [ ] Click Start on action
- [ ] Click Done on action (check streak updates)
- [ ] Open Manage modal
- [ ] Change track dropdown
- [ ] Close modal (X button or click outside)
- [ ] Click "Continue Plan"
- [ ] Click "Support Now" link → goes to `/support-now`
- [ ] Click "Buy tokens" → goes to `/buy-tokens`

## 🎨 Customization

### Change Primary Track Default
In `playbook.js` line 79:
```javascript
const userPrimaryTrack = dbUser.primary_track || 'porn' // Change default here
```

### Adjust Mock Actions
In `playbook.js` line 211-238:
```javascript
const mockTrackActions = [
  { id: 'track-1', title: 'Your action here', ... }
]
```

### Update Patterns Placeholders
In `playbook.js` JSX (line ~490):
```jsx
<li>Risk window: 10:30pm-12:30am</li>
```

## 🚨 Troubleshooting

**Issue**: Page loads but no data  
**Fix**: Check Supabase auth - must be logged in

**Issue**: Actions don't mark complete  
**Fix**: Ensure `action_completions` table exists in Supabase

**Issue**: Streak always shows 0  
**Fix**: Complete at least one action via "Done" button

**Issue**: Layout breaks on mobile  
**Fix**: Hard refresh browser (Ctrl+Shift+R) to clear CSS cache

## 🎉 You're Ready!

The new Playbook dashboard is live at `/playbook`. The old dashboard at `/dashboard` is untouched as a backup.

**Next**: Start integrating real action data and connect the action execution flow!

# Lecturer & Rep Scoping — What Changed and Why

## The problem this fixes

Before this update, any user with `role='lecturer'` could see every unit,
every assignment, every group, and every submission in the entire database —
regardless of whether they actually taught that unit. Same for `role='rep'`.
Role was being used as a global permission switch instead of a scope.

## The fix: `Unit.lecturers`

`Unit` now has a `lecturers` many-to-many field. A lecturer only sees data
tied to units where they appear in that list. This is the actual teaching
relationship — not implied by role, but explicit and assignable.

```python
unit = Unit.objects.get(code='OR301')
unit.lecturers.add(some_lecturer_user)   # now they can see OR301's data
unit.lecturers.remove(some_lecturer_user)  # now they can't
```

A `rep` is scoped differently: through their own group's `unit`. A rep
coordinates within their class, so they see whatever unit their group
belongs to — not the whole institution.

## How to assign a lecturer to a unit

**Option 1 — Django Admin (easiest for now):**
1. Go to `http://localhost:8000/admin`
2. Click "Units"
3. Open a unit, use the "Lecturers" multi-select box to add/remove lecturers
4. Save

**Option 2 — via the API:**
When a lecturer creates a unit through `POST /api/units/`, they're
automatically added as a lecturer of that unit. No manual step needed for
units they create themselves. Manual assignment in Django Admin is only
needed when one lecturer needs access to a unit someone else created
(e.g. co-teaching, or a TA situation).

## What's now scoped (was previously global)

| Endpoint | Before | Now |
|---|---|---|
| `GET /api/dashboard/` | All institution totals | Only units the lecturer teaches |
| `GET /api/assignments/` | Every assignment | Only assignments in their units |
| `GET /api/groups/all/` | Every group | Only groups in their units |
| `GET /api/units/` | Every unit | Only units they teach (or their class's unit, for reps) |
| `GET /api/group-assignments/` | Every link | Only links within their units |
| `GET /api/submissions/` | Every submission | Only submissions within their units |
| `POST /api/assignments/` | Could post to any unit | Blocked unless they teach that unit |
| `POST /api/group-assignments/` | Could link any group/assignment | Blocked unless both belong to a unit they teach |
| `GET /api/groups/progress/?group_id=X` | Could inspect any group | Blocked unless that group's unit is theirs |

## Required: run migrations after pulling this update

Because `Unit.lecturers` is a new field, you need one more migration step.
From `backend/Groupwork/`:

```bash
python manage.py makemigrations assignments
python manage.py migrate
```

If you already have a database with data in it, existing units will have
**zero lecturers** until you assign them — either in Django Admin or by
having that lecturer re-create/claim the unit. The demo seed script
(`seed.py`) handles this automatically for fresh installs.

## What this does NOT yet solve

This scopes lecturers/reps to **units**. It doesn't yet handle:
- Multiple lecturers genuinely co-teaching one unit and needing different
  permission levels (e.g. one can grade, one can only view)
- A lecturer teaching across multiple semesters of the same unit code
  (you'd currently need a new `Unit` per semester, e.g. `OR301-2026`)
- Students seeing only the units they're enrolled in, as opposed to only
  the one unit tied to their current group (acceptable for now since your
  business rule is "one student → one group" anyway)

These are reasonable next steps once the core scoping is solid, but aren't
urgent for your 4th-year project scope.

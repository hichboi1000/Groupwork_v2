"""
Run this after migrations to populate demo data so you can test immediately.
Usage: python manage.py shell < seed.py

This seed deliberately demonstrates EVERY piece of the new scoping model:
- Two lecturers, each teaching a unit the other doesn't (lecturer scoping)
- Two classes, each managed by a different rep (rep scoping)
- A co-teaching scenario (a second lecturer joining an existing unit code)
- A class attached to a unit via UnitOffering (the rep-controlled link)
- A task marked done WITH evidence attached (the new requirement)
"""

from django.contrib.auth import get_user_model
from classes.models import Class
from groups.models import Group
from assignments.models import Unit, Assignment, UnitOffering, GroupAssignment
from tasks.models import Task
from django.utils import timezone
from datetime import timedelta

User = get_user_model()

print("Seeding demo data...")

# ── Users ──────────────────────────────────────────────────────────────────────
lecturer = User.objects.create_user(
    username='dr_kamau', password='demo1234',
    first_name='Dr. James', last_name='Kamau',
    email='kamau@university.ac.ke', role='lecturer'
)

lecturer2 = User.objects.create_user(
    username='dr_njoroge', password='demo1234',
    first_name='Dr. Susan', last_name='Njoroge',
    email='njoroge@university.ac.ke', role='lecturer'
)

# Co-teaches OR301 alongside Dr. Kamau — demonstrates the co-lecturer join
co_lecturer = User.objects.create_user(
    username='dr_mwangi', password='demo1234',
    first_name='Dr. Paul', last_name='Mwangi',
    email='mwangi@university.ac.ke', role='lecturer'
)

rep = User.objects.create_user(
    username='class_rep', password='demo1234',
    first_name='Faith', last_name='Wanjiru',
    email='faith@students.ac.ke', role='rep'
)

# Second rep managing a DIFFERENT class — demonstrates rep scoping
rep2 = User.objects.create_user(
    username='rep_kibet', password='demo1234',
    first_name='Daniel', last_name='Kibet',
    email='daniel@students.ac.ke', role='rep'
)

leader = User.objects.create_user(
    username='team_leader', password='demo1234',
    first_name='Brian', last_name='Otieno',
    email='brian@students.ac.ke', role='leader'
)

mary = User.objects.create_user(
    username='mary_w', password='demo1234',
    first_name='Mary', last_name='Wambui',
    email='mary@students.ac.ke', role='student'
)

jane = User.objects.create_user(
    username='jane_k', password='demo1234',
    first_name='Jane', last_name='Karanja',
    email='jane@students.ac.ke', role='student'
)

peter = User.objects.create_user(
    username='peter_m', password='demo1234',
    first_name='Peter', last_name='Mwangi',
    email='peter@students.ac.ke', role='student'
)

print("  Users created")

# ── Units (permanent, lecturer-owned) ────────────────────────────────────────
unit = Unit.objects.create(name='Operations Research', code='OR301', created_by=lecturer)
unit.lecturers.add(lecturer)
unit.lecturers.add(co_lecturer)  # co-teaching: same unit, two lecturers

unit2 = Unit.objects.create(name='Database Systems', code='CS302', created_by=lecturer2)
unit2.lecturers.add(lecturer2)  # Njoroge teaches CS302, NOT OR301 — proves scoping

print("  Units created: OR301 (co-taught by Kamau + Mwangi), CS302 (Njoroge only)")

# ── Assignments (belong to Unit, not to a specific offering) ────────────────
assignment = Assignment.objects.create(
    title='Operations Research Assignment 1',
    description='Answer all questions in Section A and B. Show all workings.',
    unit=unit,
    deadline=timezone.now() + timedelta(days=7),
    created_by=lecturer
)

assignment2 = Assignment.objects.create(
    title='Database Normalization Exercise',
    description='Normalize the given schema to 3NF and justify each step.',
    unit=unit2,
    deadline=timezone.now() + timedelta(days=10),
    created_by=lecturer2
)

print("  Assignments created")

# ── Classes (rep-managed cohorts — NOT reusable labels, see DESIGN_DECISIONS.md) ─
bbit32 = Class.objects.create(
    name='BBIT 3.2', program='BBIT', stage='3.2', cohort_year=2024,
    code='BBIT32', created_by=rep
)
bbit32.reps.add(rep)

pm21 = Class.objects.create(
    name='Project Management 2.1', program='PM', stage='2.1', cohort_year=2025,
    code='PM21XZ', created_by=rep2
)
pm21.reps.add(rep2)

print("  Classes created: BBIT 3.2 (code: BBIT32), PM 2.1 (code: PM21XZ)")

# ── Group (belongs to Class permanently, not to a Unit) ──────────────────────
group = Group.objects.create(
    name='Team Alpha', code='ALPHA1',
    description='BBIT 3.2 project group',
    leader=leader, class_field=bbit32
)
group.members.add(leader, mary, jane, peter)

print("  Group created — code: ALPHA1 (belongs to BBIT 3.2)")

# ── UnitOffering: the rep attaches their class to a unit ─────────────────────
# This is the ONLY action that creates the link — lecturers never initiate it.
offering = UnitOffering.objects.create(
    unit=unit, class_field=bbit32, attached_by=rep, status='active'
)

print("  BBIT 3.2 attached to OR301 by Faith (rep-controlled action)")

# ── GroupAssignment: scoped to the offering, not just the unit ───────────────
ga = GroupAssignment.objects.create(
    offering=offering, group=group, assignment=assignment, status='in_progress'
)

print("  GroupAssignment linked, scoped to this specific offering")

# ── Tasks — including one marked done WITH evidence (the new requirement) ────
Task.objects.create(
    title='Section A: Questions 1–5',
    description='Solve the linear programming problems using the simplex method.',
    assignment=assignment, group=group,
    assigned_to=mary, created_by=leader,
    status='done',
    submission_text='Solved using the Big-M method. Optimal solution: x1=4, x2=6, Z=420. Full workings attached in the group drive.',
    due_date=timezone.now() + timedelta(days=3)
)

Task.objects.create(
    title='Section A: Questions 6–10',
    description='Transportation and assignment problems.',
    assignment=assignment, group=group,
    assigned_to=peter, created_by=leader,
    status='progress',
    due_date=timezone.now() + timedelta(days=4)
)

Task.objects.create(
    title='Section B: Presentation Slides',
    description='Create 10 slides summarising our approach and findings.',
    assignment=assignment, group=group,
    assigned_to=jane, created_by=leader,
    status='todo',
    due_date=timezone.now() + timedelta(days=6)
)

Task.objects.create(
    title='Final Report Compilation',
    description='Compile everyone\'s work into the final document.',
    assignment=assignment, group=group,
    assigned_to=leader, created_by=leader,
    status='todo',
    due_date=timezone.now() + timedelta(days=7)
)

print("  Tasks created (one already marked done, WITH evidence attached)")

print("\n✅ Demo data seeded successfully!")
print("\n─────────────────────────────────────────────")
print("Demo login credentials:")
print("  Lecturer:    dr_kamau     / demo1234  (teaches OR301, co-taught)")
print("  Lecturer:    dr_njoroge   / demo1234  (teaches CS302 only)")
print("  Co-lecturer: dr_mwangi    / demo1234  (co-teaches OR301 with Kamau)")
print("  Class Rep:   class_rep    / demo1234  (manages BBIT 3.2)")
print("  Class Rep:   rep_kibet    / demo1234  (manages PM 2.1 — separate)")
print("  Leader:      team_leader  / demo1234")
print("  Student:     mary_w       / demo1234  (already submitted Task 1)")
print("  Student:     jane_k       / demo1234")
print("  Student:     peter_m      / demo1234")
print("─────────────────────────────────────────────")
print("\nTo verify the new scoping model works:")
print("  1. Log in as dr_kamau or dr_mwangi → both see OR301's data identically")
print("     (co-teaching: same unit, shared visibility)")
print("  2. Log in as dr_njoroge → sees ONLY CS302, no trace of OR301")
print("  3. Log in as class_rep → manages ONLY BBIT 3.2")
print("  4. Log in as rep_kibet → manages ONLY PM 2.1, sees nothing about BBIT 3.2")
print("  5. Try creating a unit with code 'OR301' as a NEW lecturer — you")
print("     should be added as a co-lecturer, not create a duplicate unit")
print("  6. As mary_w, try setting an unsubmitted task to 'done' with no")
print("     text/file attached — it should be rejected")
print("─────────────────────────────────────────────")

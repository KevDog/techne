# Glossary

Theatrical domain terms used in this project. All code naming must use these definitions.

---

## Production Hierarchy

**Organization (Org)**
A theater company or university theater program. The top-level entity. Users belong to one or more orgs.

**Season**
A collection of shows produced by an org within a period (typically an academic year or calendar year).

**Show**
A single theatrical production (e.g., "Hamlet", "The Nutcracker"). The primary unit of collaboration. Contains departments, members, materials, and meetings.

**Department**
A design discipline within a show (e.g., Lighting, Scenic, Costume, Sound, Projection, Hair & Makeup). Departments are defined per show — there is no standard set.

---

## People & Roles

**Member**
A user assigned to a specific show. Has a role (defined by the org or show) that controls their permissions.

**Role Definition**
A named set of permission flags assigned to members. Defined at the org level and optionally overridden at the show level. Never hardcoded — orgs create their own (e.g., "Lighting Designer", "Master Electrician", "Director", "TD", "Dramaturg").

**Director**
A show member responsible for the overall artistic vision. Not a hardcoded role type — defined by the org.

**Designer**
A show member responsible for a specific department's design. Not a hardcoded role type.

**Stage Manager (SM)**
Coordinates production logistics. Not a hardcoded role type.

**Technical Director (TD)**
Oversees technical execution of designs. Not a hardcoded role type.

---

## Design Materials

**Material**
Any piece of design content uploaded or linked within a show. Types: image, file, link, note.

**Rendering**
A visual representation of a design (set, costume, lighting, etc.). Typically an image or PDF.

**Plot**
A technical document showing the layout of design elements (e.g., lighting plot, sound plot). Typically a file attachment.

**Sketch**
An early-stage hand-drawn or digital rough of a design concept.

**Reference**
External content (link, image, video) collected as inspiration or research.

---

## Notes

**Note (commentary)**
Markdown-formatted commentary attached to a material or show. Distinct from the `note` material type (which is a design artifact in the annealing lifecycle). Notes are editable by any org member, support tags, and are soft-deleted via `hidden_at` rather than hard-deleted.

**Hidden Note**
A note where `hidden_at` is non-null. Hidden notes are preserved in the database for design history but collapsed in the UI by default. Any org member can hide or restore a note.

**Soft Delete**
The pattern of marking a record invisible by setting a `hidden_at` timestamp rather than deleting the row. Used for notes to preserve design history. There is no DELETE RLS policy on the `notes` table.

---

## Workflow & Lifecycle

**Annealing Model**
The process by which design materials move from chaotic exploration toward firm decisions, mirroring the physical process of annealing (controlled cooling to remove imperfections).

**Exploratory**
A material state. Early-stage, no commitment — anything can be added without friction.

**Proposed**
A material state. A member has flagged this material as a candidate decision.

**Decided**
A material state. The material has been approved per the show's approval workflow and represents a firm design decision.

**Approval Mode**
A show-level setting controlling how materials reach "decided" state. Either `single` (any member approves) or `multi` (specific roles must all sign off).

---

## Meetings

**Design Meeting**
A scheduled or ad-hoc session where the creative team reviews materials together. Supported by the app's live "follow the leader" mode.

**Production Meeting**
A broader meeting including technical and production staff. Also supported by the app.

**Meeting Notes**
Notes captured during or after a meeting, attached to the meeting record.

**Follow the Leader**
The app's live meeting mode where one member (the presenter) drives navigation and all other connected members' views follow in real time.

**Presenter**
The member currently driving navigation in a live meeting. Any member can claim this role at any time.

**Browse Mode**
The default live meeting state where each member navigates independently while seeing others' presence.

---

## Technical Terms

**Room**
A Liveblocks construct representing a live session for a specific show. One room per show.

**Presence**
Real-time data about a connected user's current state (cursor position, current material being viewed).

**RLS (Row Level Security)**
A Supabase/Postgres feature that enforces data access rules at the database level, ensuring org isolation.

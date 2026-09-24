---
version: 1
slug: "index-html"
primary_target: "index.html"
related_targets: []
---

# Kingdom Academy — área de membros (index.html)

Scope: the whole app — login/arranque, student area (Início, Meus cursos, Vitrine, Curso/Aula, Calendário, Comunidade, Conquistas, Certificados, Definições) and admin panel. Visitor mode: **Operate**.

Audience and job: students resume a lesson, check the next live session, post in the community, track progress; the Kingdom team runs content, people and business from the admin screens. Constraints: plain HTML/CSS/JS, no build; JS renders markup with existing class names; admin Aparência overrides accent colour, name, logo, default theme; backend untouched.

Chosen direction: redesign into the pinned Kingdom Library world ("The Warm Dashboard, Loud Art"), user-mandated.

## Direction contract

THESIS: The Academy becomes a sibling of the Kingdom Library — a calm warm dashboard where the course covers and the student's own progress are the only loud things. It refuses the dark "creator-course" LMS template (black ground, neon accent, uppercase eyebrows over every heading).

OWN-WORLD: Stone canvas #f5f3f0, deeper sidebar #efece8, white cards graded to #fbfaf8 with 22px corners, warm diffuse negative-spread shadows, hairline #e8e3dd. One orange voice: the sunrise gradient #ff7f37→#f2570f on the single primary per view, progress fills and brand panels. Every pressable thing a full pill. Google Sans 400/500 only, 700 for the wordmark. Lucide-shaped 1.8 stroke icons. Status only in pills and dots; violet only for time (live sessions countdown) and people mentions. Full dark theme from the same tokens.

STORY: The student sees where they stopped and continues in one tap; the admin reads the state of the school at a glance and acts from the sidebar.

FIRST VIEWPORT: Student Início — greeting headline (no eyebrow) left with date as muted lead, "Continuar" card with lesson cover on a pastel field, progress bar and the one gradient CTA; KPI row below. Login — split screen: orange gradient brand panel with crown mark and the admin-editable headline, white form card with 48px fields and a 52px gradient pill.

FORM: Pinned world from brief (Kingdom Library design system), position 1 of 1, seed key: pinned-kingdom-library.

FINISH: unreviewed and unfinished until the finish reviewer ships it and the documenter writes DESIGN.md.

# LearnMate Frontend Design

LearnMate is a calm learning workspace for K12 students, not a conventional analytics dashboard and not a toy-like game. The interface should make the next useful action obvious while preserving room for curiosity.

## Visual thesis

The product combines the precision and restraint of a well-made notebook with small, meaningful signs of discovery. Most of the interface stays neutral; color identifies learning modes and progress instead of decorating empty space.

### Color tokens

| Token | Value | Role |
| --- | --- | --- |
| Canvas | `#F7F8F5` | Quiet page background |
| Surface | `#FFFFFF` | Working surfaces |
| Ink | `#18201C` | Primary text and actions |
| Blue | `#2864DC` | Active navigation and course learning |
| Green | `#248667` | Progress, experiments, and success |
| Violet | `#7555C7` | Free exploration |

Yellow `#F2B84B` is reserved for small streak and achievement signals. Large colored backgrounds and decorative gradients are avoided.

### Typography

- Use Noto Sans SC for readable Simplified Chinese across school and home devices.
- Use only weights 400, 500, and 600.
- Keep body lines short and conversational. Headings use tighter tracking, but never novelty typography.
- Interface copy uses words students already know: “课程”, “探索”, “实验室”, “继续学习”.

### Layout

- Desktop: fixed 224 px learning navigation, fluid primary workspace, 300 px progress rail.
- Tablet: navigation remains; the progress rail moves beneath the primary workspace.
- Mobile: a compact top bar and four-item bottom navigation keep destinations thumb-reachable. All content becomes a single column.
- The first viewport prioritizes one question: “What should I do next?” The current lesson and ask box answer it.

## Component rules

- Containers use shadow rings rather than layout-changing borders.
- Functional radii range from 8–18 px according to hierarchy; pills are limited to prompts and small status elements.
- Interactive targets are at least 40 px on desktop and 44 px for primary mobile actions.
- Keyboard focus uses a white inner ring and blue outer ring.
- Motion responds to user actions only. Reduced-motion preferences are respected.
- Icons always accompany plain-language labels in primary navigation.

## K12 adaptation

- Younger students see large actions, concrete examples, progress they can recognize, and no technical setup language.
- Older students can enter the same three spaces and receive denser course or coding content without learning a second navigation model.
- Personalization is explained through evidence (“you understand with pictures fastest”), making the system's adaptation visible and understandable.

## Generic patterns intentionally avoided

- No collection of equal-weight KPI cards.
- No decorative gradients, glass panels, or oversized marketing hero.
- No mascot-heavy or candy-colored treatment that would alienate secondary-school students.
- No chat-only home screen; structured learning and free questions remain equally visible.

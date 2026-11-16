# Inventario de componentes

Generado desde `src/components` y componentes locales de `src/app`. "Usos" = archivos que importan el módulo. 0 usos = candidato a código muerto.

| Componente (archivo) | Exporta | Cliente | Líneas | Usos | Accesibilidad detectada |
|---|---|---|---|---|---|
| `src/app/(auth)/forgot-password/ForgotForm.tsx` | ForgotForm | sí | 33 | 1 | label |
| `src/app/(auth)/login/LoginForm.tsx` | LoginForm | sí | 31 | 1 | label |
| `src/app/(auth)/mfa/MfaChallenge.tsx` | MfaChallenge | sí | 38 | 1 | label |
| `src/app/(auth)/reset-password/ResetForm.tsx` | ResetForm | sí | 26 | 1 | label |
| `src/app/(auth)/signup/SignupForm.tsx` | SignupForm | sí | 78 | 1 | role, label |
| `src/app/app/AgentHome.tsx` | AgentHome, AgentHomeView | no | 240 | 2 | aria-*, sr-only, alt |
| `src/app/app/CommandPalette.tsx` | CommandPalette | sí | 106 | 1 | aria-*, role |
| `src/app/app/MobileNav.tsx` | MobileNav | sí | 70 | 1 | aria-*, role |
| `src/app/app/Sidebar.tsx` | Sidebar | sí | 97 | 2 | aria-* |
| `src/app/app/UserMenu.tsx` | UserMenu | sí | 46 | 1 | aria-*, role |
| `src/app/app/athlete/passport/PassportEditor.tsx` | PassportEditor | sí | 340 | 1 | aria-*, label |
| `src/app/app/campaigns/new/CampaignForm.tsx` | CampaignForm | sí | 64 | 1 | label |
| `src/app/app/loading.tsx` | — | no | 16 | 0 | aria-*, role |
| `src/app/app/opportunities/new/OpportunityForm.tsx` | OpportunityForm | sí | 130 | 1 | label |
| `src/app/app/portfolio/PortfolioView.tsx` | PortfolioView | no | 174 | 2 | aria-*, sr-only |
| `src/app/app/portfolio/[athleteId]/AthleteWorkspaceView.tsx` | AthleteWorkspaceView, TAB | no | 275 | 1 | aria-* |
| `src/app/app/settings/CookiePrefsButton.tsx` | CookiePrefsButton | sí | 12 | 1 | — |
| `src/app/app/settings/DataRequestForm.tsx` | DataRequestForm | sí | 34 | 1 | label |
| `src/app/app/share/ShareView.tsx` | ShareView | no | 126 | 1 | aria-*, sr-only |
| `src/app/athletes/[id]/cv/PrintButton.tsx` | PrintButton | sí | 10 | 1 | — |
| `src/app/onboarding/OnboardingForm.tsx` | OnboardingForm | sí | 175 | 1 | sr-only, label |
| `src/app/oportunidades/[id]/View.tsx` | PublicOpportunityView | no | 101 | 2 | aria-*, role |
| `src/app/r/[token]/RecruitingCardView.tsx` | RecruitingCardView | no | 141 | 1 | aria-* |
| `src/components/ActionForm.tsx` | ActionForm | sí | 34 | 7 | role |
| `src/components/AiSearchBar.tsx` | AiSearchBar | sí | 44 | 1 | aria-* |
| `src/components/AskGala.tsx` | AskGala | sí | 99 | 2 | aria-*, role |
| `src/components/AthleteCard.tsx` | AthleteCard | no | 59 | 3 | aria-* |
| `src/components/BlockButton.tsx` | BlockButton | sí | 36 | 1 | aria-*, label |
| `src/components/Captcha.tsx` | Captcha | sí | 19 | 4 | — |
| `src/components/CookieBanner.tsx` | CookieBanner | sí | 76 | 1 | aria-*, role, sr-only |
| `src/components/CountUp.tsx` | CountUp | sí | 33 | 3 | aria-* |
| `src/components/GuideView.tsx` | GuideIndex, GuideArticle | no | 61 | 4 | aria-* |
| `src/components/Icon.tsx` | Icon | no | 43 | 2 | aria-* |
| `src/components/InviteLink.tsx` | InviteLink | sí | 42 | 2 | aria-* |
| `src/components/LiveThread.tsx` | LiveThread | sí | 26 | 1 | — |
| `src/components/Logo.tsx` | Logo | no | 19 | 10 | aria-* |
| `src/components/MatchBreakdown.tsx` | MatchBreakdown | no | 72 | 2 | aria-*, sr-only |
| `src/components/NavIcon.tsx` | NavIcon | no | 20 | 3 | aria-* |
| `src/components/NetCostCalculator.tsx` | NetCostCalculator | sí | 117 | 2 | aria-*, role |
| `src/components/OpportunityCard.tsx` | OpportunityCard | no | 65 | 3 | — |
| `src/components/PasswordStrength.tsx` | PasswordStrength | sí | 22 | 1 | aria-* |
| `src/components/PlanUnlocks.tsx` | PlanUnlocks | no | 64 | 2 | aria-* |
| `src/components/ProgressRing.tsx` | ProgressRing | no | 14 | 2 | aria-*, role |
| `src/components/PublicMobileMenu.tsx` | MobileMenu | sí | 55 | 1 | aria-* |
| `src/components/PublicShell.tsx` | PublicHeader, PublicFooter | no | 138 | 11 | aria-*, role, sr-only |
| `src/components/QuestionForms.tsx` | AskQuestionForm, AnswerQuestionForm | sí | 44 | 1 | role, sr-only, label |
| `src/components/RecommendationForm.tsx` | RecommendationForm | sí | 25 | 1 | role, sr-only, label |
| `src/components/Reveal.tsx` | Reveal | sí | 51 | 3 | — |
| `src/components/RoleHero.tsx` | RoleHero, ShortcutTiles, ROLE | no | 116 | 2 | aria-*, alt |
| `src/components/SubmitButton.tsx` | SubmitButton | sí | 15 | 22 | aria-* |
| `src/components/TrustSeal.tsx` | TrustSeal | no | 37 | 2 | aria-*, role, sr-only |
| `src/components/TwoFactorCard.tsx` | TwoFactorCard | sí | 101 | 1 | aria-*, label, alt |
| `src/components/agency/CaseForms.tsx` | OpenCaseForm, UpdateCaseForm, ActivityForm, TaskForm, ContactForm, ImportContactsForm | sí | 234 | 3 | role, sr-only, label |
| `src/components/agency/PipelineBoard.tsx` | PipelineBoard | no | 89 | 2 | aria-*, sr-only |
| `src/components/autonomy.tsx` | DocumentUpload, CustomDocumentForm, RosterInviteForm, DeleteAccountForm, PrintButton, ExternalOfferForm | sí | 142 | 10 | aria-*, role, sr-only |
| `src/components/forms.tsx` | ApplyOpportunityForm, ContactRequestForm, MessageForm, ReportButton, CampaignApplyForm, RepresentationForm | sí | 326 | 9 | aria-*, label |
| `src/components/growth.tsx` | SaveSearchForm, AthleteUpdateForm, PlanRequestForm, FeedbackForm, PracticeEngine, ThemeToggle | sí | 268 | 9 | aria-*, role, sr-only |
| `src/components/landing/HeroAudience.tsx` | HeroAudience | sí | 149 | 1 | aria-*, role |
| `src/components/landing/MatchPreview.tsx` | MatchPreview | no | 53 | 1 | aria-* |
| `src/components/landing/OptionsQuiz.tsx` | OptionsQuiz | sí | 95 | 1 | aria-*, role |
| `src/components/landing/PassportPreview.tsx` | PassportPreview | no | 54 | 1 | aria-* |
| `src/components/landing/ProductTour.tsx` | ProductTour | sí | 88 | 1 | aria-*, role |
| `src/components/landing/Timeline.tsx` | Timeline | sí | 43 | 0 | aria-* |
| `src/components/portfolio-client.tsx` | PortfolioFilterBar, NoteComposer, NoteBody, ConfirmSubmit, EndRepresentationForm | sí | 226 | 2 | aria-*, role, sr-only |
| `src/components/portfolio.tsx` | StatusPill, AthleteAvatar, KpiTile, Panel, PanelLink, ActivityFeed | no | 148 | 22 | aria-*, alt |
| `src/components/recruiting-client.tsx` | CoachAccessForm, CopyButton, NewLinkForm | sí | 78 | 2 | aria-*, role, sr-only |
| `src/components/ui.tsx` | Button, ButtonLink, Card, CardTitle, Badge, PageHeader | no | 121 | 95 | aria-*, role, label |

## Candidatos a código muerto (0 importaciones)

- `src/app/app/loading.tsx` (falso positivo: convención de Next.js, se usa implícitamente)
- `src/components/landing/Timeline.tsx`

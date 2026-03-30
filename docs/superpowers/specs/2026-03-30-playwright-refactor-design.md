# Playwright Refactor Design

Date: 2026-03-30

## Goal

Refactor the existing Metamod Playwright test suite so it follows stronger Playwright best practices, is easier to read, and makes it obvious to an engineer what each file is responsible for.

The refactor will improve structure and safe interaction patterns without inventing new product behavior. Existing user changes in the working tree must be preserved.

## Current State

The repository already has a useful top-level structure:

- `tests/` for specs
- `pages/` for page objects
- `fixtures/` for shared test setup
- `utils/` for helpers
- `config/` for environment and Playwright configuration

The main maintainability problem is concentration of responsibility:

- `pages/AgentRefinementPage.js` owns too many concerns at once
- some tests still reach for raw selectors instead of page-level intent methods
- polling and state-detection logic are mixed directly into page classes
- a few flows use patterns that are harder to reason about, such as random answer selection and ad hoc waits

## Desired Outcome

After the refactor:

1. Specs should read like business scenarios, not like browser scripts.
2. Page objects should own UI interaction details.
3. Pure parsing and state comparison should live outside page classes.
4. Large page objects should be split into smaller units with clear responsibilities.
5. Safer Playwright patterns should replace brittle ones where the current UI already supports that change.

## Scope

### In Scope

- Refactor the full Playwright test codebase structure while preserving current covered behavior
- Split oversized refinement logic into smaller modules
- Move raw test selectors into page objects when that improves clarity
- Improve names so fixture and method purpose is immediately clear
- Reduce duplicated flow logic where multiple specs perform the same setup or verification steps
- Replace brittle interaction patterns only when they can be derived from existing UI behavior in the current code
- Keep the existing dirty worktree intact and avoid overwriting user edits

### Out of Scope

- Changing product behavior
- Adding brand-new test coverage not implied by the current suite
- Rewriting the framework in TypeScript
- Introducing external libraries beyond the current project dependencies
- Reworking Azure pipeline behavior unless the refactor requires a path or command update

## Chosen Approach

Use a layered refactor.

Keep the current high-level repository structure, but narrow each file so it has one clear purpose:

- Specs describe scenario flow and assertions
- Fixtures provide shared test context
- Page modules handle browser actions and UI state entry points
- Utility modules perform pure data transformation and reporting

This approach is safer than a full architectural rewrite and more durable than only cleaning up specs.

## Design

### Architecture

The refactor will preserve the existing folder model and strengthen its boundaries.

- `tests/` remains the entry point for scenarios
- `fixtures/` remains the source of authenticated and refinement-ready contexts
- `pages/` remains the owner of browser-facing operations
- `utils/` remains the owner of pure helper logic

The refinement area will stop being a single oversized page object. Instead, the public refinement-facing API will stay centered around `AgentRefinementPage`, but that class will delegate to smaller modules.

### Components and Responsibilities

#### Tests

`tests/login.spec.js`

- keep as a small, readable smoke-style suite
- remove low-level assertion noise where a page-level helper expresses intent better

`tests/metamod.spec.js`

- keep the scenario-driven coverage
- move ad hoc page selectors into page methods where the meaning is clearer in the page layer

`tests/agent-refinement-loop.spec.js`

- keep the loop behavior and JSON reporting intent
- improve readability by leaning on better-named methods and reduced inline orchestration noise

`tests/agent-refinement-context.spec.js`

- remain the clearest end-to-end refinement scenario
- rely on page-level and helper-level abstractions instead of carrying duplicated local helpers

#### Fixtures

`fixtures/pages.js`

- continue to expose page objects
- keep page object creation centralized

`fixtures/auth.js`

- continue to own authenticated browser context setup
- keep worker-scoped authenticated flow reusable
- improve clarity of fixture names only where helpful and low risk

`fixtures/refinement.js`

- continue to layer refinement-specific dependencies on top of authenticated context
- keep `OpenAIRefinementClient` injection explicit

#### Page Layer

`pages/AgentRefinementPage.js`

- remain the public facade used by tests
- stop carrying every low-level implementation detail directly
- delegate specialized work to smaller refinement modules

Planned refinement submodules:

- `pages/refinement/RefinementCanvasSection.js`
  - canvas readiness
  - node discovery
  - node connect and run actions
  - refine entry points

- `pages/refinement/PlaygroundPanel.js`
  - playground open and reset behavior
  - send message flow
  - wait for state change
  - collect visible messages and timeline state

- `pages/refinement/SystemPromptEditor.js`
  - open prompt editor
  - read prompt
  - write prompt
  - save and close prompt interactions

`pages/ChatPage.js`, `pages/DashboardPage.js`, `pages/FlowsPage.js`, and `pages/AgentCanvasPage.js`

- keep their existing domain boundaries
- add intent-revealing methods where tests currently reach into raw selectors

#### Utility Layer

Existing utility modules will remain, but pure logic should be favored over embedding parsing inside page classes.

Likely utility ownership after refactor:

- text normalization and primitive parsing stay in `utils/refinement.js`
- artifact writing stays in `utils/refinementArtifacts.js`
- OpenAI client behavior stays in `utils/openaiRefinement.js`
- any new pure comparison or transcript/timeline transformation helpers should live in `utils/` rather than in page classes

### Data Flow

The intended test flow after refactor is:

1. A spec requests a ready fixture.
2. The fixture provides authenticated page objects and any refinement services.
3. The spec calls high-level page methods that describe the scenario.
4. Page facades delegate to smaller page modules for concrete browser operations.
5. Pure helper modules transform collected UI text into comparison or reporting data.
6. The spec performs final assertions using stable outputs from those abstractions.

This keeps browser knowledge in the page layer and business-level meaning in the spec layer.

### Playwright Best-Practice Improvements

The refactor may improve brittle patterns, but only when the change is supported by the current code and UI signals.

Safe improvements include:

- replacing test-level selectors with page methods
- preferring semantic locators already present in the suite
- centralizing fallback click behavior instead of duplicating it
- reducing random or opaque control flow when a deterministic choice is possible from current UI text
- making wait loops more targeted and easier to understand

The refactor will not invent selectors, statuses, or app states that are not already represented in the current implementation.

### Error Handling

The refactor should preserve the suite's current defensive posture while making failures easier to diagnose.

Principles:

- keep explicit errors when required UI states never appear
- prefer descriptive error messages tied to the missing condition
- preserve timeout intent for long-running refinement flows
- keep graceful handling for optional UI like walkthroughs, popups, and approval prompts
- avoid swallowing failures unless the action is truly optional

### Testing and Verification Strategy

Verification must prove the refactor did not silently change the suite's intended behavior.

Planned verification:

- run focused tests for the suites directly affected by the refactor
- run at least the login suite plus targeted refinement coverage
- if practical in the current environment, run the full Playwright suite after the refactor
- inspect failures before claiming improvement

Refactor sequencing should follow a safe cycle:

1. establish or update tests around refactor-sensitive helpers where practical
2. make the structural change
3. run the targeted suite
4. expand verification outward

## Constraints

- Do not overwrite or revert existing uncommitted user changes.
- Keep the refactor in JavaScript and CommonJS.
- Keep existing environment-variable behavior intact unless a change is necessary for clarity and remains backward compatible.
- Avoid speculative cleanup outside the Playwright automation code.

## Risks

### Risk: Refinement flow regressions

The refinement page owns complex UI state transitions and long-running waits.

Mitigation:

- refactor in small slices
- preserve current observable behavior
- verify targeted refinement specs after each structural step

### Risk: Hidden coupling across fixtures and page objects

Tests may rely on current fixture names or object shapes.

Mitigation:

- keep public fixture contracts stable where possible
- change names only when the gain is clear
- refactor consumers alongside providers in the same pass

### Risk: False confidence from structural cleanup alone

Cleaner code can still break real flows.

Mitigation:

- require fresh Playwright verification before claiming the refactor is complete

## Implementation Direction

The implementation should happen in phases:

1. Extract low-risk helpers and page methods used by multiple specs.
2. Split refinement responsibilities behind the existing `AgentRefinementPage` facade.
3. Update tests to use clearer intent-driven methods.
4. Run targeted verification after each phase.
5. Finish with suite-wide cleanup and a broader verification run.

## Success Criteria

The refactor is successful when:

- the suite remains runnable with the same environment inputs
- specs are easier to read top-down
- engineers can tell what each file owns without reading unrelated internals
- refinement logic is no longer concentrated in one oversized page object
- verification shows no regressions in the targeted suites

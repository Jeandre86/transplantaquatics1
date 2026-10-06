# Backend follow-up

## Displayed data-quality issues

- **Athlete/swimmer display name:** A legacy/imported profile value `Great Britain &` is an obvious non-person value. The frontend leaves it unchanged rather than guessing a correction. Review the source/import record and repair it in the data-maintenance workflow.

## Deferred until the API supports them

- **Rows per page:** Current list loading functions do not accept a page-size argument. Do not expose a rows-per-page selector until the relevant endpoint/query accepts and honors a page size.

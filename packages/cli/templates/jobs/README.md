# @yourscope/jobs

Scaffolded background job definitions for your Quark project.

This package is **yours** after scaffolding - edit the queues, job names, and payload conventions to match your product. There is no automatic sync back to Quark.

## Use this package when

- work should happen outside the web request cycle
- you need retries, backoff, or queue-based processing
- you want a stable contract between the web app and `apps/worker`

## What it owns

- `src/definitions.js` - queue names and job names
- `src/index.js` - package exports

The actual job execution happens in the paired worker app:

- `apps/worker/src/handlers/`
- `apps/worker/src/index.js`

## First files to edit in a scaffolded project

1. `packages/jobs/src/definitions.js` - add queue names and job names
2. `apps/worker/src/handlers/index.js` - register handlers
3. `apps/worker/src/handlers/*.js` - implement the actual job logic

## Default jobs

The starter template ships with examples for:

- welcome email delivery
- reset-password email delivery
- orphaned file cleanup

Treat them as examples, not a required domain model.

## Add a new job

1. Add a queue or job name in `src/definitions.js`
2. Create a handler in `apps/worker/src/handlers/`
3. Register that handler in `apps/worker/src/handlers/index.js`
4. Dispatch the job from the web app using `createQueue()` and `addJob()` from `@usequark/quark-core`

## Relationship to Quark Core

`@usequark/quark-core` provides the queue infrastructure.

`@yourscope/jobs` defines **your** queue names and job names.

That split lets you update infrastructure separately from business-specific job contracts.

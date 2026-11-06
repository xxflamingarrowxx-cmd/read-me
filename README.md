# Read-Me

Stable beta `0.1.0-beta.2` for testing. A pixel reading room: log the books you actually sit with, leave a short note, and dress the shelf with points. Points are not for sale.

Sign in with Google, X, or email, then choose the name on your shelf. That name is yours, not the one from the sign-in.

## Run it

Node 22.

```bash
npm install
npm run dev
```

`npm run build` checks the production build.

## Beta on GitHub

Pushing a tag named like `v0.1.0-beta.2` runs the typecheck and the production build, then publishes a GitHub prerelease. The release is created only if the build passes.

`v0.1.0-beta.2` is the build that went through a full pass of sign-in, naming, shelves, points, the shop, friends, notes, and reports.